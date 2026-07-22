mod ai;
mod fs;
mod git;
mod terminal;
mod ws;

use actix_cors::Cors;
use actix_files as fs_serve;
use actix_web::{web, App, HttpServer, middleware};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub open_project: Arc<RwLock<Option<String>>>,
    pub terminal_sessions: terminal::TerminalManager,
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
            .route("/api/fs/read", web::post().to(fs::read_file))
            .route("/api/fs/write", web::post().to(fs::write_file))
            .route("/api/fs/tree", web::post().to(fs::list_tree))
            .route("/api/fs/mkdir", web::post().to(fs::mkdir))
            .route("/api/fs/rename", web::post().to(fs::rename))
            .route("/api/fs/delete", web::post().to(fs::delete_path))
            .route("/api/fs/search", web::post().to(fs::search_files))
            .route("/api/project/open", web::post().to(fs::open_project))
            .route("/api/git/status", web::post().to(git::status))
            .route("/api/git/diff", web::post().to(git::diff))
            .route("/api/git/log", web::post().to(git::log_entries))
            .route("/api/git/branches", web::post().to(git::branches))
            .route("/api/git/commit", web::post().to(git::commit))
            .route("/api/git/blame", web::post().to(git::blame))
            .route("/api/ai/providers", web::get().to(ai::list_providers))
            .route("/api/ai/chat", web::post().to(ai::chat))
            .route("/api/ai/complete", web::post().to(ai::complete))
            .route("/api/term/create", web::post().to(terminal::create_session))
            .route("/api/term/input", web::post().to(terminal::write_input))
            .route("/api/term/resize", web::post().to(terminal::resize))
            .route("/api/term/destroy", web::post().to(terminal::destroy_session))
            .route("/api/diff/apply", web::post().to(fs::apply_diff))
            .route("/api/diff/preview", web::post().to(fs::preview_diff))
            .route("/ws", web::get().to(ws::ws_handler))
            .service(fs_serve::Files::new("/", dist.to_string_lossy().as_ref()).index_file("index.html"))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
