mod agent;
mod ai;
mod auth;
mod fs;
mod git;
mod terminal;
mod ws;

use actix_web::web::PayloadConfig;

use actix_cors::Cors;
use actix_files as fs_serve;
use actix_web::{web, App, HttpResponse, HttpServer, middleware};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct AppState {
    pub open_project: Arc<RwLock<HashMap<String, String>>>,
    pub terminal_sessions: terminal::TerminalManager,
    pub agent_tasks: Arc<agent::repository::TaskStore>,
    pub ai_jobs: Arc<RwLock<HashMap<Uuid, ai::AiJob>>>,
    pub max_body_bytes: usize,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3847".to_string())
        .parse()
        .unwrap_or(3847);

    let max_body_bytes: usize = std::env::var("MAX_BODY_BYTES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2_097_152); // 2 MB default

    let state = web::Data::new(AppState {
        open_project: Arc::new(RwLock::new(HashMap::new())),
        terminal_sessions: terminal::TerminalManager::new(),
        agent_tasks: agent::repository::TaskStore::new(),
        ai_jobs: Arc::new(RwLock::new(HashMap::new())),
        max_body_bytes,
    });

    let dist = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../frontend/dist");
    log::info!("Archon IDE backend starting on port {}", port);
    log::info!("Serving frontend from {:?}", dist);

    HttpServer::new(move || {
        let allowed_origins = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "https://relayapp.pro,https://app.relayapp.pro,http://localhost:3847,http://localhost:5173".to_string());

        let mut cors_builder = Cors::default();
        for origin in allowed_origins.split(',') {
            let trimmed = origin.trim();
            if !trimmed.is_empty() {
                cors_builder = cors_builder.allowed_origin(trimmed);
            }
        }
        let cors = cors_builder
            .allowed_methods(["GET", "POST", "OPTIONS"])
            .allowed_headers([
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
            ])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
            .app_data(PayloadConfig::new(state.max_body_bytes))
            .route("/health", web::get().to(|| async { HttpResponse::Ok().json(serde_json::json!({"status": "ok"})) }))
            .service(web::scope("/api")
                .wrap(middleware::from_fn(auth::require_auth))
                .route("/fs/read", web::post().to(fs::read_file))
                .route("/fs/write", web::post().to(fs::write_file))
                .route("/fs/tree", web::post().to(fs::list_tree))
                .route("/fs/mkdir", web::post().to(fs::mkdir))
                .route("/fs/rename", web::post().to(fs::rename))
                .route("/fs/delete", web::post().to(fs::delete_path))
                .route("/fs/search", web::post().to(fs::search_files))
                .route("/project/open", web::post().to(fs::open_project))
                .route("/git/status", web::post().to(git::status))
                .route("/git/diff", web::post().to(git::diff))
                .route("/git/log", web::post().to(git::log_entries))
                .route("/git/branches", web::post().to(git::branches))
                .route("/git/commit", web::post().to(git::commit))
                .route("/git/blame", web::post().to(git::blame))
                .route("/ai/providers", web::get().to(ai::list_providers))
                .route("/ai/chat", web::post().to(ai::chat))
                .route("/ai/jobs", web::post().to(ai::create_job))
                .route("/ai/jobs/{id}", web::get().to(ai::get_job))
                .route("/ai/complete", web::post().to(ai::complete))
                .route("/term/create", web::post().to(terminal::create_session))
                .route("/term/input", web::post().to(terminal::write_input))
                .route("/term/resize", web::post().to(terminal::resize))
                .route("/term/destroy", web::post().to(terminal::destroy_session))
                .route("/diff/apply", web::post().to(fs::apply_diff))
                .route("/diff/preview", web::post().to(fs::preview_diff))
                // Agent task runtime
                .route("/agent/tasks", web::post().to(agent::routes::create_task))
                .route("/agent/tasks", web::get().to(agent::routes::list_tasks))
                .route("/agent/tasks/{id}", web::get().to(agent::routes::get_task))
                .route("/agent/tasks/{id}/events", web::get().to(agent::routes::get_task_events))
                .route("/agent/tasks/{id}/cancel", web::post().to(agent::routes::cancel_task)))
            .service(fs_serve::Files::new("/", dist.to_string_lossy().as_ref()).index_file("index.html"))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
