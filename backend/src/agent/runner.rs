// =============================================================
// Server-side agent task runner.
//
// `spawn_task_runner` launches a background tokio task that drives an
// autonomous coding loop:
//
//   1. Transition task to Planning then Running.
//   2. Loop:
//      a. Check cancellation flag.
//      b. Check step budget.
//      c. Check credit budget.
//      d. Ask the model for the next structured JSON action.
//      e. Validate action against an explicit allowlist.
//      f. Execute one bounded tool call through WorkspacePolicy.
//      g. Record a sanitized event.
//      h. Feed the result back as a user message.
//   3. On done / blocked / cancel / budget-exceeded / error → terminate
//      the task in the appropriate state.
//
// The model is prompted to respond with a single JSON object describing
// one action.  This makes the loop provider-agnostic (no native function-
// calling APIs required) and gives us a strict parse-time allowlist.
// =============================================================

use std::path::PathBuf;
use std::sync::Arc;

use uuid::Uuid;

use crate::agent::domain::{AgentEvent, AgentTask, EventKind, TaskStatus};
use crate::agent::memory::MemoryStore;
use crate::agent::model_adapter::{call_model, AdapterMessage};
use crate::agent::repository::TaskStore;
use crate::agent::workspace::WorkspacePolicy;
use crate::ai::ReasoningEffort;

/// Maximum bytes returned from a single `read_file` call.
const MAX_FILE_READ_BYTES: usize = 51_200; // 50 KB

/// Maximum bytes stored in an event's `metadata.preview` field.
const MAX_METADATA_PREVIEW_BYTES: usize = 4_096;

/// Actions the model is permitted to request.
const ALLOWED_ACTIONS: &[&str] = &[
    "list_tree",
    "read_file",
    "search",
    "git_status",
    "git_diff",
    "write_file",
    "done",
    "blocked",
];

// ─── Public entry point ───────────────────────────────────────────────────────

/// Spawn a background tokio task that runs the agent loop.
/// Returns immediately; the task continues after the HTTP request ends.
pub fn spawn_task_runner(task: &AgentTask, store: Arc<TaskStore>, memory: Arc<MemoryStore>) {
    let task_id = task.id;
    let user_id = task.user_id.clone();
    let workspace_path = task.workspace_path.clone();
    let provider = task.provider.clone();
    let model = task.model.clone();
    let effort = task.reasoning_effort;
    let request = task.request.clone();

    tokio::spawn(async move {
        run_task(
            task_id,
            user_id,
            workspace_path,
            provider,
            model,
            effort,
            request,
            store,
            memory,
        )
        .await;
    });
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async fn run_task(
    task_id: Uuid,
    user_id: String,
    workspace_path: String,
    provider: String,
    model: String,
    effort: ReasoningEffort,
    request: String,
    store: Arc<TaskStore>,
    memory: Arc<MemoryStore>,
) {
    let policy = WorkspacePolicy::new(&workspace_path);

    // Retrieve the API key (held in a side-channel, not in AgentTask)
    let api_key = store.take_api_key(task_id).await;

    // ── Planning ─────────────────────────────────────────────────────────────

    if let Err(e) = store
        .transition(task_id, &user_id, TaskStatus::Planning, None)
        .await
    {
        log::error!("task {task_id}: failed to enter planning: {e}");
        return;
    }
    emit(&store, task_id, EventKind::StatusChanged, "Planning started".into(), serde_json::json!({"status": "planning"})).await;

    // Inject cross-session workspace memory into the system prompt
    let memory_block = memory.build_context_block(&workspace_path).await;
    let context_entry_count = memory.get_context(&workspace_path).await.len();
    if context_entry_count > 0 {
        emit(
            &store,
            task_id,
            EventKind::ToolResult,
            format!("Loaded {context_entry_count} workspace memory entries"),
            serde_json::json!({"memory_entries": context_entry_count}),
        ).await;
    }

    let system_prompt = build_system_prompt(&workspace_path, &request, effort, &memory_block);
    let mut messages: Vec<AdapterMessage> = vec![
        AdapterMessage {
            role: "system".into(),
            content: system_prompt,
        },
        AdapterMessage {
            role: "user".into(),
            content: request.clone(),
        },
    ];

    // ── Running ──────────────────────────────────────────────────────────────

    if let Err(e) = store
        .transition(task_id, &user_id, TaskStatus::Running, None)
        .await
    {
        log::error!("task {task_id}: failed to enter running: {e}");
        return;
    }
    emit(&store, task_id, EventKind::StatusChanged, "Task running".into(), serde_json::json!({"status": "running"})).await;

    let max_tokens: u32 = match effort {
        ReasoningEffort::Low => 2_048,
        ReasoningEffort::Medium => 4_096,
        ReasoningEffort::High => 8_192,
    };

    let effort_multiplier: u64 = match effort {
        ReasoningEffort::Low => 1,
        ReasoningEffort::Medium => 2,
        ReasoningEffort::High => 4,
    };

    // ── Main loop ─────────────────────────────────────────────────────────────

    loop {
        // 1. Cancellation check
        if store.is_cancel_requested(task_id).await {
            let _ = store
                .transition(task_id, &user_id, TaskStatus::Cancelling, None)
                .await;
            let _ = store
                .transition(task_id, &user_id, TaskStatus::Cancelled, None)
                .await;
            emit(&store, task_id, EventKind::StatusChanged, "Cancelled by user".into(), serde_json::json!({"status": "cancelled"})).await;
            return;
        }

        // 2. Step budget
        let task_snapshot = match store.get_for_user(task_id, &user_id).await {
            Some(t) => t,
            None => break,
        };
        if task_snapshot.current_step >= task_snapshot.max_steps {
            let msg = format!(
                "Step budget exhausted ({}/{})",
                task_snapshot.current_step, task_snapshot.max_steps
            );
            let _ = store
                .transition(
                    task_id,
                    &user_id,
                    TaskStatus::Failed,
                    Some(("step_budget_exceeded".into(), msg.clone())),
                )
                .await;
            emit(&store, task_id, EventKind::Error, msg, serde_json::json!({})).await;
            return;
        }

        // 3. Credit budget
        if task_snapshot.credits_used >= task_snapshot.credit_limit {
            let msg = format!(
                "Credit budget exhausted ({}/{})",
                task_snapshot.credits_used, task_snapshot.credit_limit
            );
            let _ = store
                .transition(
                    task_id,
                    &user_id,
                    TaskStatus::Failed,
                    Some(("credit_budget_exceeded".into(), msg.clone())),
                )
                .await;
            emit(&store, task_id, EventKind::Error, msg, serde_json::json!({})).await;
            return;
        }

        // 4. Call model
        let step = task_snapshot.current_step + 1;
        emit(
            &store,
            task_id,
            EventKind::ModelRequest,
            format!("Calling {model} · step {step}/{}", task_snapshot.max_steps),
            serde_json::json!({"step": step, "provider": provider, "model": model}),
        )
        .await;

        let model_result = call_model(
            &messages,
            &provider,
            &model,
            api_key.as_deref(),
            effort,
            max_tokens,
        )
        .await;

        store.increment_step(task_id).await;

        match model_result {
            Err(e) => {
                let msg = format!("Model error: {e}");
                emit(&store, task_id, EventKind::Error, msg.clone(), serde_json::json!({})).await;
                let _ = store
                    .transition(
                        task_id,
                        &user_id,
                        TaskStatus::Failed,
                        Some(("model_error".into(), msg)),
                    )
                    .await;
                return;
            }

            Ok(resp) => {
                // 5. Account for credits
                let token_blocks =
                    ((resp.input_tokens + resp.output_tokens).max(1) + 999) / 1_000;
                let credits = (token_blocks as u64) * effort_multiplier;
                store.add_credits(task_id, credits).await;

                emit(
                    &store,
                    task_id,
                    EventKind::ModelResponse,
                    format!(
                        "Response received · {} in / {} out tokens",
                        resp.input_tokens, resp.output_tokens
                    ),
                    serde_json::json!({
                        "input_tokens": resp.input_tokens,
                        "output_tokens": resp.output_tokens,
                        "credits_charged": credits,
                    }),
                )
                .await;

                // 6. Parse JSON action from model response
                match parse_action(&resp.content) {
                    Err(parse_err) => {
                        // Feed parse error back so model can self-correct
                        emit(
                            &store,
                            task_id,
                            EventKind::Error,
                            format!("Response parse error: {parse_err}"),
                            serde_json::json!({}),
                        )
                        .await;
                        messages.push(AdapterMessage {
                            role: "assistant".into(),
                            content: resp.content.clone(),
                        });
                        messages.push(AdapterMessage {
                            role: "user".into(),
                            content: format!(
                                "Your response could not be parsed as a valid JSON action. \
                                 Error: {parse_err}\n\
                                 Respond with ONLY a single JSON object matching the schema. \
                                 No markdown, no prose."
                            ),
                        });
                        continue;
                    }

                    Ok(action) => {
                        messages.push(AdapterMessage {
                            role: "assistant".into(),
                            content: resp.content.clone(),
                        });

                        match action.action.as_str() {
                            // ── Terminal: done ────────────────────────────────
                            "done" => {
                                let summary = action
                                    .args
                                    .get("summary")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Task completed")
                                    .to_string();
                                let evidence = action
                                    .args
                                    .get("evidence")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();

                                let _ = store
                                    .transition(task_id, &user_id, TaskStatus::Verifying, None)
                                    .await;
                                emit(
                                    &store,
                                    task_id,
                                    EventKind::VerificationStarted,
                                    "Verifying completion".into(),
                                    serde_json::json!({"summary": summary, "evidence": evidence}),
                                )
                                .await;

                                // Accept the model's evidence as verification for this version.
                                // Future: run an automated verification tool call here.
                                let _ = store
                                    .transition(task_id, &user_id, TaskStatus::Completed, None)
                                    .await;

                                // Write task summary to workspace memory so future tasks can
                                // benefit from what was learned this session.
                                memory
                                    .record_task_summary(&workspace_path, summary.clone(), task_id)
                                    .await;

                                emit(
                                    &store,
                                    task_id,
                                    EventKind::Completed,
                                    summary,
                                    serde_json::json!({"evidence": evidence}),
                                )
                                .await;
                                return;
                            }

                            // ── Terminal: blocked ─────────────────────────────
                            "blocked" => {
                                let reason = action
                                    .args
                                    .get("reason")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Unspecified blocker")
                                    .to_string();
                                let _ = store
                                    .transition(
                                        task_id,
                                        &user_id,
                                        TaskStatus::Blocked,
                                        Some(("blocked".into(), reason.clone())),
                                    )
                                    .await;
                                emit(
                                    &store,
                                    task_id,
                                    EventKind::StatusChanged,
                                    format!("Blocked: {reason}"),
                                    serde_json::json!({"reason": reason}),
                                )
                                .await;
                                return;
                            }

                            // ── Tool call ─────────────────────────────────────
                            tool_name => {
                                let args_preview = format_args_preview(&action.args);
                                emit(
                                    &store,
                                    task_id,
                                    EventKind::ToolCall,
                                    format!("{tool_name}({args_preview})"),
                                    serde_json::json!({"tool": tool_name}),
                                )
                                .await;

                                let tool_result =
                                    execute_tool(tool_name, &action.args, &policy).await;

                                let (summary, result_text, ok) = match &tool_result {
                                    Ok(content) => {
                                        // Record file writes to workspace memory
                                        if tool_name == "write_file" {
                                            if let Some(path) = action.args.get("path").and_then(|v| v.as_str()) {
                                                memory.record_file_change(&workspace_path, path, task_id).await;
                                            }
                                        }
                                        (format!("{tool_name} succeeded"), content.clone(), true)
                                    }
                                    Err(e) => {
                                        let msg = format!("{tool_name} failed: {e}");
                                        (msg.clone(), msg, false)
                                    }
                                };

                                // Truncate large outputs for event metadata
                                let preview = if result_text.len() > MAX_METADATA_PREVIEW_BYTES {
                                    format!(
                                        "{}… [truncated {} bytes]",
                                        &result_text[..MAX_METADATA_PREVIEW_BYTES],
                                        result_text.len() - MAX_METADATA_PREVIEW_BYTES
                                    )
                                } else {
                                    result_text.clone()
                                };

                                emit(
                                    &store,
                                    task_id,
                                    EventKind::ToolResult,
                                    summary,
                                    serde_json::json!({"ok": ok, "preview": preview}),
                                )
                                .await;

                                // Feed result back to the model
                                messages.push(AdapterMessage {
                                    role: "user".into(),
                                    content: format!(
                                        "Tool result for {tool_name}:\n{result_text}"
                                    ),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Loop exited without a return — should not happen
    let _ = store
        .transition(
            task_id,
            &user_id,
            TaskStatus::Failed,
            Some(("internal_error".into(), "Task loop exited unexpectedly".into())),
        )
        .await;
}

// ─── Action parsing ───────────────────────────────────────────────────────────

struct ParsedAction {
    action: String,
    args: serde_json::Map<String, serde_json::Value>,
}

fn parse_action(content: &str) -> Result<ParsedAction, String> {
    // Strip markdown code fences if the model wrapped its JSON
    let stripped = content.trim();
    let json_str = if stripped.starts_with('`') {
        // Extract between first { and last }
        let start = stripped.find('{').ok_or("no JSON object found")?;
        let end = stripped.rfind('}').ok_or("unclosed JSON object")?;
        &stripped[start..=end]
    } else {
        stripped
    };

    let val: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("JSON parse error: {e}"))?;

    let action = val["action"]
        .as_str()
        .ok_or("missing required field 'action'")?
        .to_string();

    if !ALLOWED_ACTIONS.contains(&action.as_str()) {
        return Err(format!(
            "action '{action}' is not in the allowlist: {ALLOWED_ACTIONS:?}"
        ));
    }

    let args = val["args"].as_object().cloned().unwrap_or_default();

    Ok(ParsedAction { action, args })
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async fn execute_tool(
    tool: &str,
    args: &serde_json::Map<String, serde_json::Value>,
    policy: &WorkspacePolicy,
) -> Result<String, String> {
    match tool {
        "list_tree" => {
            let root_rel = args.get("root").and_then(|v| v.as_str()).unwrap_or(".");
            let root = policy.resolve(root_rel).map_err(|e| e.to_string())?;
            Ok(build_tree_text(&root, 0, 3))
        }

        "read_file" => {
            let path_rel = args
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or("read_file: missing 'path'")?;
            let path = policy.resolve(path_rel).map_err(|e| e.to_string())?;

            let bytes = tokio::fs::read(&path)
                .await
                .map_err(|e| format!("read_file: {e}"))?;
            if bytes.iter().any(|&b| b == 0) {
                return Err("read_file: binary files cannot be read as text".into());
            }
            if bytes.len() > MAX_FILE_READ_BYTES {
                return Err(format!(
                    "read_file: file is {} bytes, limit is {}",
                    bytes.len(),
                    MAX_FILE_READ_BYTES
                ));
            }
            String::from_utf8(bytes).map_err(|e| format!("read_file: encoding error: {e}"))
        }

        "search" => {
            let root_rel = args.get("root").and_then(|v| v.as_str()).unwrap_or(".");
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .ok_or("search: missing 'query'")?;
            if query.is_empty() {
                return Err("search: query must not be empty".into());
            }
            let root = policy.resolve(root_rel).map_err(|e| e.to_string())?;
            Ok(search_in_dir(&root, query))
        }

        "git_status" => {
            let output = tokio::process::Command::new("git")
                .args([
                    "-C",
                    policy.workspace_root.to_str().unwrap_or("."),
                    "status",
                    "--short",
                ])
                .output()
                .await
                .map_err(|e| format!("git_status: {e}"))?;
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }

        "git_diff" => {
            let output = tokio::process::Command::new("git")
                .args([
                    "-C",
                    policy.workspace_root.to_str().unwrap_or("."),
                    "diff",
                    "--stat",
                ])
                .output()
                .await
                .map_err(|e| format!("git_diff: {e}"))?;
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }

        "write_file" => {
            let path_rel = args
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or("write_file: missing 'path'")?;
            let content = args
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or("write_file: missing 'content'")?;
            let path = policy.resolve(path_rel).map_err(|e| e.to_string())?;

            if let Some(parent) = path.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("write_file: create_dir_all: {e}"))?;
            }
            tokio::fs::write(&path, content)
                .await
                .map_err(|e| format!("write_file: {e}"))?;

            Ok(format!(
                "Wrote {} bytes to {}",
                content.len(),
                path_rel
            ))
        }

        _ => Err(format!("unknown tool: {tool}")),
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn build_tree_text(root: &std::path::Path, depth: usize, max_depth: usize) -> String {
    if depth > max_depth {
        return String::new();
    }
    let mut out = String::new();
    let Ok(mut entries) = std::fs::read_dir(root) else {
        return out;
    };
    let mut entries: Vec<_> = entries.by_ref().filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| {
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
        (!is_dir, e.file_name())
    });

    let indent = "  ".repeat(depth);
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            out.push_str(&format!("{indent}{name}/\n"));
            out.push_str(&build_tree_text(&entry.path(), depth + 1, max_depth));
        } else {
            out.push_str(&format!("{indent}{name}\n"));
        }
    }
    out
}

fn search_in_dir(root: &std::path::Path, query: &str) -> String {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    let walker = ignore::WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker.filter_map(|e| e.ok()) {
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(entry.path()) else {
            continue;
        };
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                let rel = entry
                    .path()
                    .strip_prefix(root)
                    .unwrap_or(entry.path());
                results.push(format!("{}:{}: {}", rel.display(), i + 1, line.trim()));
                if results.len() >= 50 {
                    return results.join("\n");
                }
            }
        }
    }

    if results.is_empty() {
        format!("No results found for '{query}'")
    } else {
        results.join("\n")
    }
}

fn format_args_preview(args: &serde_json::Map<String, serde_json::Value>) -> String {
    args.iter()
        .take(2)
        .map(|(k, v)| {
            let val = v.as_str().unwrap_or("…");
            format!("{k}={val}")
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn build_system_prompt(workspace_path: &str, request: &str, effort: ReasoningEffort, memory_block: &str) -> String {
    let depth_hint = match effort {
        ReasoningEffort::Low => "Work efficiently — minimise tool calls.",
        ReasoningEffort::Medium => "Work thoroughly — verify changes before marking done.",
        ReasoningEffort::High => {
            "Work deeply — inspect, implement, verify, and review your own work."
        }
    };

    format!(
        r#"You are Archon, an autonomous coding agent.
Workspace: {workspace_path}
Task: {request}

{depth_hint}{memory_block}

Respond with EXACTLY ONE JSON object — no markdown fences, no prose, just the JSON:
{{
  "action": "<action_name>",
  "args": {{ <action-specific arguments> }},
  "reasoning": "<brief explanation of why you are taking this action>"
}}

Available actions:
- list_tree:  {{"root": "."}}                          List directory tree (max depth 3)
- read_file:  {{"path": "relative/path"}}              Read a file (max 50 KB, relative paths only)
- search:     {{"root": ".", "query": "text"}}         Search for text across files
- git_status: {{}}                                     Show git status
- git_diff:   {{}}                                     Show git diff summary
- write_file: {{"path": "relative/path", "content": "…"}}  Write or overwrite a file
- done:       {{"summary": "…", "evidence": "…"}}      Mark task complete (requires verification evidence)
- blocked:    {{"reason": "…"}}                        Report genuine external blocker

Rules:
- All paths MUST be relative (no leading /).
- Never reference paths outside the workspace.
- Use `done` only after confirming your output produces the expected result.
- Use `blocked` only for genuine external dependencies you cannot satisfy.
- Do not ask clarifying questions — work with what you have.
"#
    )
}

/// Append a progress event to the store.
async fn emit(
    store: &TaskStore,
    task_id: Uuid,
    kind: EventKind,
    summary: String,
    metadata: serde_json::Value,
) {
    let seq = store.next_sequence(task_id).await;
    let event = AgentEvent::new(task_id, seq, kind, summary, metadata);
    store.append_event(event).await;
}
