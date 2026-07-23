use actix_web::{web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

use crate::agent::workspace::WorkspacePolicy;
use crate::auth::AuthUser;
use crate::AppState;

#[derive(Deserialize)]
pub struct SnapshotReq {
    pub workspace_path: String,
}

#[derive(Serialize)]
pub struct SnapshotRes {
    pub workspace: String,
    pub files: Vec<FileState>,
}

#[derive(Serialize)]
pub struct FileState {
    pub path: String,
    pub content: String,
    pub checksum: String,
    pub version: u64,
}

#[derive(Deserialize)]
pub struct PatchReq {
    pub workspace_path: String,
    pub path: String,
    pub content: String,
}

fn compute_checksum(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub async fn get_snapshot(
    req: HttpRequest,
    _state: web::Data<AppState>,
    body: web::Json<SnapshotReq>,
) -> HttpResponse {
    let _user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "authentication required"})),
    };

    let policy = WorkspacePolicy::new(&body.workspace_path);
    let root = policy.workspace_root.clone();

    if !root.exists() || !root.is_dir() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid workspace directory"}));
    }

    let mut files = Vec::new();
    let walker = ignore::WalkBuilder::new(&root)
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker.filter_map(|e| e.ok()) {
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            let file_path = entry.path();
            
            // Skip binary files and ignored stuff like node_modules
            if file_path.components().any(|c| c.as_os_str() == "node_modules" || c.as_os_str() == ".git") {
                continue;
            }
            
            if let Ok(bytes) = fs::read(file_path) {
                if !bytes.iter().any(|&b| b == 0) {
                    let content = String::from_utf8_lossy(&bytes).into_owned();
                    let relative_path = file_path.strip_prefix(&root).unwrap_or(file_path).to_string_lossy().to_string();
                    
                    files.push(FileState {
                        path: format!("/{}", relative_path),
                        checksum: compute_checksum(&content),
                        content,
                        version: 1,
                    });
                }
            }
        }
    }

    HttpResponse::Ok().json(SnapshotRes {
        workspace: body.workspace_path.clone(),
        files,
    })
}

pub async fn apply_patch(
    req: HttpRequest,
    _state: web::Data<AppState>,
    body: web::Json<PatchReq>,
) -> HttpResponse {
    let _user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "authentication required"})),
    };

    let policy = WorkspacePolicy::new(&body.workspace_path);
    
    let canonical_path = body.path.trim_start_matches('/');
    
    let resolved_path = match policy.resolve(canonical_path) {
        Ok(p) => p,
        Err(e) => return HttpResponse::Forbidden().json(serde_json::json!({"error": format!("Invalid path: {}", e)})),
    };

    if let Some(parent) = resolved_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Failed to create directories: {}", e)}));
        }
    }

    match fs::write(&resolved_path, &body.content) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": format!("Failed to write file: {}", e)})),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checksum_computation() {
        let content = "hello world";
        let hash = compute_checksum(content);
        assert_eq!(hash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    }
}
