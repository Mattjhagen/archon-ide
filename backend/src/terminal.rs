use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use portable_pty::{CommandBuilder, PtySize, native_pty_system, PtyPair};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tokio::sync::mpsc;

use crate::auth::AuthUser;

pub struct TerminalManager {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

pub struct TerminalSession {
    pub pty: PtyPair,
    pub reader_tx: mpsc::Sender<String>,
    pub user_id: String,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn session_key(user_id: &str, session_id: &str) -> String {
        format!("{}:{}", user_id, session_id)
    }
}

#[derive(Deserialize)]
pub struct CreateTermReq {
    pub project_path: String,
    #[serde(default)]
    pub cols: u16,
    #[serde(default)]
    pub rows: u16,
}

#[derive(Serialize)]
pub struct TermSessionId {
    pub id: String,
}

pub async fn create_session(
    req: HttpRequest,
    state: web::Data<crate::AppState>,
    body: web::Json<CreateTermReq>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "auth required"})),
    };
    let id = uuid::Uuid::new_v4().to_string();
    let key = TerminalManager::session_key(&user.id, &id);
    let pty_system = native_pty_system();

    let size = PtySize {
        rows: body.rows.max(24),
        cols: body.cols.max(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pty_pair = match pty_system.openpty(size) {
        Ok(p) => p,
        Err(e) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}))
        }
    };

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&body.project_path);

    match pty_pair.slave.spawn_command(cmd) {
        Ok(_) => {
            let (tx, _rx) = mpsc::channel::<String>(256);
            let tx_reader = tx.clone();

            let mut reader = match pty_pair.master.try_clone_reader() {
                Ok(r) => r,
                Err(e) => {
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": e.to_string()}))
                }
            };

            thread::spawn(move || {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).to_string();
                            if tx_reader.blocking_send(text).is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });

            let session = TerminalSession {
                pty: pty_pair,
                reader_tx: tx,
                user_id: user.id,
            };

            state
                .terminal_sessions
                .sessions
                .lock()
                .unwrap()
                .insert(key, session);

            HttpResponse::Ok().json(TermSessionId { id })
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct TermInputReq {
    pub id: String,
    pub data: String,
}

pub async fn write_input(
    req: HttpRequest,
    state: web::Data<crate::AppState>,
    body: web::Json<TermInputReq>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "auth required"})),
    };
    let key = TerminalManager::session_key(&user.id, &body.id);
    let sessions = state.terminal_sessions.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&key) {
        let mut writer = match session.pty.master.take_writer() {
            Ok(w) => w,
            Err(e) => {
                return HttpResponse::InternalServerError()
                    .json(serde_json::json!({"error": e.to_string()}))
            }
        };
        match writer.write_all(body.data.as_bytes()) {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
            Err(e) => HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()})),
        }
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Session not found"}))
    }
}

#[derive(Deserialize)]
pub struct TermResizeReq {
    pub id: String,
    pub cols: u16,
    pub rows: u16,
}

pub async fn resize(
    req: HttpRequest,
    state: web::Data<crate::AppState>,
    body: web::Json<TermResizeReq>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "auth required"})),
    };
    let key = TerminalManager::session_key(&user.id, &body.id);
    let sessions = state.terminal_sessions.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&key) {
        let size = PtySize {
            rows: body.rows,
            cols: body.cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        match session.pty.master.resize(size) {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
            Err(e) => HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()})),
        }
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Session not found"}))
    }
}

#[derive(Deserialize)]
pub struct TermDestroyReq {
    pub id: String,
}

pub async fn destroy_session(
    req: HttpRequest,
    state: web::Data<crate::AppState>,
    body: web::Json<TermDestroyReq>,
) -> HttpResponse {
    let user = match req.extensions().get::<AuthUser>().cloned() {
        Some(u) => u,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "auth required"})),
    };
    let key = TerminalManager::session_key(&user.id, &body.id);
    state
        .terminal_sessions
        .sessions
        .lock()
        .unwrap()
        .remove(&key);
    HttpResponse::Ok().json(serde_json::json!({"ok": true}))
}
