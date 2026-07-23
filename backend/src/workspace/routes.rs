use actix_web::{web, HttpRequest, HttpResponse};
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;
use crate::workspace::domain::Workspace;

#[derive(Deserialize)]
pub struct CreateWorkspaceReq {
    pub name: String,
}

pub async fn create_workspace(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateWorkspaceReq>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "authentication required"})),
    };

    let name = body.name.trim().to_string();
    if name.is_empty() || name.len() > 80 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "name must be 1-80 characters"}));
    }

    // In a real environment, we'd provision a physical volume/machine here.
    // For the in-memory mock, we'll map it to a local temp folder or the current dir.
    let server_path = format!("/tmp/archon_workspaces/{}", Uuid::new_v4());
    std::fs::create_dir_all(&server_path).unwrap_or_default();

    let ws = Workspace::new(user.id.clone(), name, server_path);
    let stored = state.workspaces.create(ws).await;

    HttpResponse::Created().json(&stored)
}

pub async fn list_workspaces(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "authentication required"})),
    };

    let workspaces = state.workspaces.list_for_user(&user.id).await;
    HttpResponse::Ok().json(workspaces)
}

pub async fn get_workspace(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "authentication required"})),
    };

    let id = path.into_inner();
    match state.workspaces.get_for_user(id, &user.id).await {
        Some(ws) => HttpResponse::Ok().json(ws),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "workspace not found"})),
    }
}
