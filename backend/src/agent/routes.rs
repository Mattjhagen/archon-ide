// =============================================================
// HTTP handlers for the agent task API.
//
// All five endpoints require a valid Supabase session (enforced by
// the `require_auth` middleware registered on /api).  User ID is
// always derived from the validated session — never from the request body.
//
// Authorization pattern for task lookups:
//   task.user_id == authenticated_user.id
//
// Authorization failures return 404 (not 403) to avoid leaking
// whether a task exists for another user.
// =============================================================

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::Deserialize;
use uuid::Uuid;

use crate::agent::domain::AgentTask;
use crate::agent::runner::spawn_task_runner;
use crate::ai::ReasoningEffort;
use crate::auth::AuthUser;
use crate::AppState;

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateTaskReq {
    /// Short human-readable title (1–200 chars).
    pub title: String,
    /// Full task description / coding request (1–10 000 chars).
    pub request: String,
    /// Provider id: "anthropic" | "openai" | "gemini" | "ollama" | "mock"
    pub provider: String,
    /// Model id within the chosen provider.
    pub model: String,
    /// Controls step/credit budget and model depth.
    #[serde(default)]
    pub reasoning_effort: ReasoningEffort,
    /// Bring-your-own-key.  Held in memory only for the task's lifetime;
    /// never stored in the task entity or logged.
    pub api_key: Option<String>,
    /// Server-side workspace path.  All file operations are validated
    /// against this root via WorkspacePolicy.
    pub workspace_path: String,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// POST /api/agent/tasks
///
/// Create a task and immediately start the background runner.
/// Returns 201 Created with the initial task state.
pub async fn create_task(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateTaskReq>,
) -> HttpResponse {
    let user = auth_user(&req);
    let Some(user) = user else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    // Input validation
    let title = body.title.trim().to_string();
    if title.is_empty() || title.len() > 200 {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "title must be 1–200 characters"}));
    }
    let request = body.request.trim().to_string();
    if request.is_empty() || request.len() > 10_000 {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "request must be 1–10 000 characters"}));
    }
    if body.workspace_path.trim().is_empty() {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "workspace_path is required"}));
    }

    let task = AgentTask::new(
        user.id.clone(),
        title,
        request,
        body.provider.clone(),
        body.model.clone(),
        body.reasoning_effort,
        body.workspace_path.clone(),
    );

    // Store API key separately from the task entity
    let api_key = body.api_key.clone().filter(|k| !k.is_empty());
    let stored = state.agent_tasks.create(task, api_key).await;

    // Launch background runner
    spawn_task_runner(&stored, state.agent_tasks.clone());

    HttpResponse::Created().json(&stored)
}

/// GET /api/agent/tasks
///
/// List all tasks for the authenticated user, most-recent first.
pub async fn list_tasks(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    let Some(user) = auth_user(&req) else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let tasks = state.agent_tasks.list_for_user(&user.id).await;
    HttpResponse::Ok().json(tasks)
}

/// GET /api/agent/tasks/{id}
///
/// Get a single task.  Returns 404 for both not-found and wrong-user.
pub async fn get_task(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let Some(user) = auth_user(&req) else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let task_id = path.into_inner();
    match state.agent_tasks.get_for_user(task_id, &user.id).await {
        Some(task) => HttpResponse::Ok().json(task),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "task not found"})),
    }
}

/// GET /api/agent/tasks/{id}/events
///
/// Return the ordered event log for a task.  Returns 404 for not-found / wrong-user.
pub async fn get_task_events(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let Some(user) = auth_user(&req) else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let task_id = path.into_inner();
    match state
        .agent_tasks
        .get_events_for_user(task_id, &user.id)
        .await
    {
        Some(events) => HttpResponse::Ok().json(events),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "task not found"})),
    }
}

/// POST /api/agent/tasks/{id}/cancel
///
/// Request cancellation of a running task.  The runner picks up the flag
/// on its next iteration.  Idempotent for active tasks; 409 for already-terminal.
pub async fn cancel_task(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let Some(user) = auth_user(&req) else {
        return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "authentication required"}));
    };

    let task_id = path.into_inner();

    use crate::agent::domain::TransitionError;
    match state.agent_tasks.request_cancel(task_id, &user.id).await {
        Ok(_) => HttpResponse::Ok()
            .json(serde_json::json!({"ok": true, "message": "cancellation requested"})),
        Err(TransitionError::NotFound) | Err(TransitionError::Unauthorized) => {
            // Unified 404 — do not reveal whether the task exists for another user
            HttpResponse::NotFound().json(serde_json::json!({"error": "task not found"}))
        }
        Err(TransitionError::AlreadyTerminal) => {
            HttpResponse::Conflict()
                .json(serde_json::json!({"error": "task is already complete"}))
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn auth_user(req: &HttpRequest) -> Option<AuthUser> {
    req.extensions().get::<AuthUser>().cloned()
}
