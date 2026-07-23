// =============================================================
// Model adapter — provider-agnostic model call interface.
//
// Returns plain text + token counts rather than HttpResponse, so
// the runner can call any provider without depending on HTTP handler
// types.  Provider-specific payloads are fully encapsulated here.
//
// API keys are accepted as Option<&str> and resolved from environment
// variables when not supplied by the caller.  They are never logged.
// =============================================================

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::ai::ReasoningEffort;

/// A single message in the conversation history.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AdapterMessage {
    pub role: String,
    pub content: String,
}

/// Successful response from a model call.
pub struct AdapterResponse {
    pub content: String,
    pub input_tokens: usize,
    pub output_tokens: usize,
}

/// Error from a model call (message is safe to surface to the user).
#[derive(Debug)]
pub struct AdapterError(pub String);

impl std::fmt::Display for AdapterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Call a model through the named provider and return the raw text response.
pub async fn call_model(
    messages: &[AdapterMessage],
    provider: &str,
    model: &str,
    api_key: Option<&str>,
    effort: ReasoningEffort,
    max_tokens: u32,
) -> Result<AdapterResponse, AdapterError> {
    match provider {
        "anthropic" => call_anthropic(messages, model, api_key, max_tokens).await,
        "openai" => call_openai(messages, model, api_key, effort, max_tokens).await,
        "gemini" => call_gemini(messages, model, api_key, max_tokens).await,
        "ollama" => call_ollama(messages, model, max_tokens).await,
        "mock" => Ok(call_mock(messages)),
        _ => Err(AdapterError(format!("unknown provider: {provider}"))),
    }
}

// ── Mock ──────────────────────────────────────────────────────────────────────

fn call_mock(messages: &[AdapterMessage]) -> AdapterResponse {
    let last = messages.last().map(|m| m.content.as_str()).unwrap_or("");

    // First call: explore the workspace
    // Subsequent calls (after a tool_result): finish
    let content = if last.starts_with("Tool result for") || last.contains("Continue") {
        serde_json::json!({
            "action": "done",
            "args": {
                "summary": "Mock task completed successfully",
                "evidence": "Mock provider always reports immediate success after one tool step"
            },
            "reasoning": "Mock mode: return done after first tool call"
        })
        .to_string()
    } else {
        serde_json::json!({
            "action": "list_tree",
            "args": { "root": "." },
            "reasoning": "Exploring workspace structure as first step"
        })
        .to_string()
    };

    let token_estimate = content.len() / 4;
    AdapterResponse {
        content,
        input_tokens: messages.iter().map(|m| m.content.len() / 4).sum(),
        output_tokens: token_estimate,
    }
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async fn call_anthropic(
    messages: &[AdapterMessage],
    model: &str,
    request_key: Option<&str>,
    max_tokens: u32,
) -> Result<AdapterResponse, AdapterError> {
    let api_key = resolve_key(request_key, "ANTHROPIC_API_KEY")
        .ok_or_else(|| AdapterError("Anthropic API key is not configured".to_string()))?;

    let mut system_msg = String::new();
    let mut user_msgs: Vec<serde_json::Value> = Vec::new();

    for m in messages {
        if m.role == "system" {
            system_msg = m.content.clone();
        } else {
            user_msgs.push(serde_json::json!({ "role": m.role, "content": m.content }));
        }
    }

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_msgs,
    });
    if !system_msg.is_empty() {
        body["system"] = serde_json::json!(system_msg);
    }

    let resp = Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AdapterError(e.to_string()))?;

    let val: serde_json::Value = resp.json().await.map_err(|e| AdapterError(e.to_string()))?;

    if let Some(err) = val.get("error") {
        return Err(AdapterError(
            err["message"]
                .as_str()
                .unwrap_or("unknown error from Anthropic")
                .to_string(),
        ));
    }

    let content = val["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|b| b["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(AdapterResponse {
        content,
        input_tokens: val["usage"]["input_tokens"].as_u64().unwrap_or(0) as usize,
        output_tokens: val["usage"]["output_tokens"].as_u64().unwrap_or(0) as usize,
    })
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async fn call_openai(
    messages: &[AdapterMessage],
    model: &str,
    request_key: Option<&str>,
    effort: ReasoningEffort,
    max_tokens: u32,
) -> Result<AdapterResponse, AdapterError> {
    let api_key = resolve_key(request_key, "OPENAI_API_KEY")
        .ok_or_else(|| AdapterError("OpenAI API key is not configured".to_string()))?;

    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

    let effort_str = match effort {
        ReasoningEffort::Low => "low",
        ReasoningEffort::Medium => "medium",
        ReasoningEffort::High => "high",
    };

    let input: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": [{ "type": "input_text", "text": m.content }]
            })
        })
        .collect();

    let resp = Client::new()
        .post(format!("{base_url}/responses"))
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&serde_json::json!({
            "model": model,
            "input": input,
            "max_output_tokens": max_tokens,
            "reasoning": { "effort": effort_str },
        }))
        .send()
        .await
        .map_err(|e| AdapterError(e.to_string()))?;

    let val: serde_json::Value = resp.json().await.map_err(|e| AdapterError(e.to_string()))?;

    if val.get("error").is_some() {
        return Err(AdapterError(
            val["error"]["message"]
                .as_str()
                .unwrap_or("unknown error from OpenAI")
                .to_string(),
        ));
    }

    let content = val["output"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|item| item["content"].as_array().into_iter().flatten())
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(AdapterResponse {
        content,
        input_tokens: val["usage"]["input_tokens"].as_u64().unwrap_or(0) as usize,
        output_tokens: val["usage"]["output_tokens"].as_u64().unwrap_or(0) as usize,
    })
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async fn call_gemini(
    messages: &[AdapterMessage],
    model: &str,
    request_key: Option<&str>,
    max_tokens: u32,
) -> Result<AdapterResponse, AdapterError> {
    let api_key = resolve_key(request_key, "GEMINI_API_KEY")
        .ok_or_else(|| AdapterError("Gemini API key is not configured".to_string()))?;

    let contents: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": if m.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": m.content }]
            })
        })
        .collect();

    let system = messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let mut payload = serde_json::json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": max_tokens }
    });
    if !system.is_empty() {
        payload["systemInstruction"] = serde_json::json!({ "parts": [{ "text": system }] });
    }

    let resp = Client::new()
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        ))
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AdapterError(e.to_string()))?;

    let val: serde_json::Value = resp.json().await.map_err(|e| AdapterError(e.to_string()))?;

    if val.get("error").is_some() {
        return Err(AdapterError(
            val["error"]["message"]
                .as_str()
                .unwrap_or("unknown error from Gemini")
                .to_string(),
        ));
    }

    let content = val["candidates"][0]["content"]["parts"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|p| p["text"].as_str())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(AdapterResponse {
        content,
        input_tokens: val["usageMetadata"]["promptTokenCount"]
            .as_u64()
            .unwrap_or(0) as usize,
        output_tokens: val["usageMetadata"]["candidatesTokenCount"]
            .as_u64()
            .unwrap_or(0) as usize,
    })
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async fn call_ollama(
    messages: &[AdapterMessage],
    model: &str,
    max_tokens: u32,
) -> Result<AdapterResponse, AdapterError> {
    let base_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    let resp = Client::new()
        .post(format!("{base_url}/api/chat"))
        .json(&serde_json::json!({
            "model": model,
            "messages": msgs,
            "options": { "num_predict": max_tokens },
            "stream": false,
        }))
        .send()
        .await
        .map_err(|e| AdapterError(e.to_string()))?;

    let val: serde_json::Value = resp.json().await.map_err(|e| AdapterError(e.to_string()))?;

    Ok(AdapterResponse {
        content: val["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        input_tokens: val["prompt_eval_count"].as_u64().unwrap_or(0) as usize,
        output_tokens: val["eval_count"].as_u64().unwrap_or(0) as usize,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn resolve_key(request_key: Option<&str>, env_var: &str) -> Option<String> {
    request_key
        .filter(|k| !k.is_empty())
        .map(str::to_owned)
        .or_else(|| std::env::var(env_var).ok().filter(|k| !k.is_empty()))
}
