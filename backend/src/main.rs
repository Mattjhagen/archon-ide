mod agent;
mod ai;
mod auth;
mod fs;
mod git;
mod terminal;
mod ws;

use actix_cors::Cors;
use actix_files as fs_serve;
use actix_web::{web, App, HttpResponse, HttpServer, middleware};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub open_project: Arc<RwLock<Option<String>>>,
    pub terminal_sessions: terminal::TerminalManager,
    pub agent_tasks: Arc<agent::repository::TaskStore>,
    pub agent_memory: Arc<agent::memory::MemoryStore>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3847".to_string())
        .parse()
        .unwrap_or(3847);

    let state = web::Data::new(AppState {
        open_project: Arc::new(RwLock::new(None)),
        terminal_sessions: terminal::TerminalManager::new(),
        agent_tasks: agent::repository::TaskStore::new(),
        agent_memory: agent::memory::MemoryStore::new(),
    });

    let dist = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../frontend/dist");
    log::info!("Archon IDE backend starting on port {}", port);
    log::info!("Serving frontend from {:?}", dist);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(state.clone())
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
                .route("/agent/tasks/{id}/cancel", web::post().to(agent::routes::cancel_task))
                // Workspace context memory
                .route("/agent/memory", web::get().to(agent::routes::get_memory))
                .route("/agent/memory", web::delete().to(agent::routes::clear_memory)))
            .service(fs_serve::Files::new("/", dist.to_string_lossy().as_ref()).index_file("index.html"))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
