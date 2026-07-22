use actix_web::{web, HttpResponse};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};
use std::fs;
use std::path::{Path, PathBuf};

use crate::AppState;

#[derive(Deserialize)]
pub struct ReadFileReq {
    pub path: String,
}

#[derive(Serialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size: u64,
    pub is_binary: bool,
}

pub async fn read_file(
    _state: web::Data<AppState>,
    body: web::Json<ReadFileReq>,
) -> HttpResponse {
    let path = PathBuf::from(&body.path);
    if !path.exists() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "File not found"}));
    }
    match fs::read(&path) {
        Ok(bytes) => {
            let is_binary = bytes.iter().any(|&b| b == 0);
            let content = if is_binary {
                String::from("[binary file]")
            } else {
                String::from_utf8_lossy(&bytes).to_string()
            };
            let size = bytes.len() as u64;
            HttpResponse::Ok().json(FileContent {
                path: body.path.clone(),
                content,
                size,
                is_binary,
            })
        }
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct WriteFileReq {
    pub path: String,
    pub content: String,
}

pub async fn write_file(
    _state: web::Data<AppState>,
    body: web::Json<WriteFileReq>,
) -> HttpResponse {
    let path = PathBuf::from(&body.path);
    if let Some(parent) = path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()}));
        }
    }
    match fs::write(&path, &body.content) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct TreeReq {
    pub root: String,
    #[serde(default)]
    pub max_depth: Option<usize>,
}

#[derive(Serialize, Clone)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
    pub depth: usize,
}

pub async fn list_tree(
    _state: web::Data<AppState>,
    body: web::Json<TreeReq>,
) -> HttpResponse {
    let root = PathBuf::from(&body.root);
    if !root.exists() || !root.is_dir() {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "Invalid root directory"}));
    }
    let max_depth = body.max_depth.unwrap_or(10);
    let tree = build_tree(&root, &root, 0, max_depth);
    HttpResponse::Ok().json(tree)
}

fn build_tree(path: &Path, root: &Path, depth: usize, max_depth: usize) -> TreeNode {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let mut children = Vec::new();
    let is_dir = path.is_dir();

    if is_dir && depth < max_depth {
        let mut entries: Vec<_> = match fs::read_dir(path) {
            Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
            Err(_) => return make_node(name, path, root, true, depth, children),
        };
        entries.sort_by(|a, b| {
            let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
            b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
        });

        for entry in entries {
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') && depth == 0 && file_name != ".gitignore" && file_name != ".env" {
                continue;
            }
            if file_name == "node_modules" || file_name == "target" || file_name == ".git" {
                continue;
            }
            children.push(build_tree(&entry_path, root, depth + 1, max_depth));
        }
    }

    make_node(name, path, root, is_dir, depth, children)
}

fn make_node(
    name: String, path: &Path, root: &Path, is_dir: bool,
    depth: usize, children: Vec<TreeNode>,
) -> TreeNode {
    TreeNode {
        name,
        path: path.strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string(),
        is_dir,
        children,
        depth,
    }
}

#[derive(Deserialize)]
pub struct OpenProjectReq {
    pub path: String,
}

pub async fn open_project(
    state: web::Data<AppState>,
    body: web::Json<OpenProjectReq>,
) -> HttpResponse {
    let path = PathBuf::from(&body.path);
    if !path.exists() || !path.is_dir() {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({"error": "Invalid project path"}));
    }
    {
        let mut proj = state.open_project.write().await;
        *proj = Some(body.path.clone());
    }
    let tree = build_tree(&path, &path, 0, 8);
    HttpResponse::Ok().json(serde_json::json!({
        "path": body.path,
        "tree": tree
    }))
}

#[derive(Deserialize)]
pub struct MkdirReq {
    pub path: String,
}

pub async fn mkdir(
    _state: web::Data<AppState>,
    body: web::Json<MkdirReq>,
) -> HttpResponse {
    match fs::create_dir_all(&body.path) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct RenameReq {
    pub from: String,
    pub to: String,
}

pub async fn rename(
    _state: web::Data<AppState>,
    body: web::Json<RenameReq>,
) -> HttpResponse {
    match fs::rename(&body.from, &body.to) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct DeleteReq {
    pub path: String,
}

pub async fn delete_path(
    _state: web::Data<AppState>,
    body: web::Json<DeleteReq>,
) -> HttpResponse {
    let p = PathBuf::from(&body.path);
    if p.is_dir() {
        match fs::remove_dir_all(&p) {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
            Err(e) => HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()})),
        }
    } else {
        match fs::remove_file(&p) {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"ok": true})),
            Err(e) => HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": e.to_string()})),
        }
    }
}

#[derive(Deserialize)]
pub struct SearchReq {
    pub root: String,
    pub query: String,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub line: usize,
    pub content: String,
}

pub async fn search_files(
    _state: web::Data<AppState>,
    body: web::Json<SearchReq>,
) -> HttpResponse {
    let root = PathBuf::from(&body.root);
    let query = body.query.to_lowercase();
    let mut results = Vec::new();

    let walker = WalkBuilder::new(&root)
        .hidden(false)
        .git_ignore(true)
        .build();

    for entry in walker.filter_map(|e| e.ok()) {
        if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                for (i, line) in content.lines().enumerate() {
                    if line.to_lowercase().contains(&query) {
                        results.push(SearchResult {
                            path: entry.path().strip_prefix(&root)
                                .unwrap_or(entry.path())
                                .to_string_lossy()
                                .to_string(),
                            line: i + 1,
                            content: line.to_string(),
                        });
                        if results.len() >= 100 {
                            return HttpResponse::Ok().json(results);
                        }
                    }
                }
            }
        }
    }
    HttpResponse::Ok().json(results)
}

#[derive(Deserialize)]
pub struct ApplyDiffReq {
    pub path: String,
    pub new_content: String,
}

pub async fn apply_diff(
    _state: web::Data<AppState>,
    body: web::Json<ApplyDiffReq>,
) -> HttpResponse {
    let path = PathBuf::from(&body.path);
    let old_content = fs::read_to_string(&path).unwrap_or_default();

    let diff = TextDiff::from_lines(&old_content, &body.new_content);
    let mut patch = String::new();
    for op in diff.ops() {
        for change in diff.iter_changes(op) {
            match change.tag() {
                ChangeTag::Insert => {
                    patch.push('+');
                    patch.push_str(change.as_str().unwrap_or(""));
                }
                ChangeTag::Delete => {
                    patch.push('-');
                    patch.push_str(change.as_str().unwrap_or(""));
                }
                ChangeTag::Equal => {
                    patch.push(' ');
                    patch.push_str(change.as_str().unwrap_or(""));
                }
            }
        }
    }

    match fs::write(&path, &body.new_content) {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "diff": patch
        })),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct PreviewDiffReq {
    pub path: String,
    pub new_content: String,
}

#[derive(Serialize)]
pub struct DiffPreview {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Serialize)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub content: String,
}

pub async fn preview_diff(
    _state: web::Data<AppState>,
    body: web::Json<PreviewDiffReq>,
) -> HttpResponse {
    let path = PathBuf::from(&body.path);
    let old_content = fs::read_to_string(&path).unwrap_or_default();
    let diff = TextDiff::from_lines(&old_content, &body.new_content);

    let mut hunks = Vec::new();
    let mut additions = 0;
    let mut deletions = 0;

    for op in diff.ops() {
        let mut hunk_content = String::new();
        let mut old_count = 0;
        let mut new_count = 0;

        for change in diff.iter_changes(op) {
            match change.tag() {
                ChangeTag::Insert => {
                    hunk_content.push('+');
                    hunk_content.push_str(change.as_str().unwrap_or(""));
                    new_count += 1;
                    additions += 1;
                }
                ChangeTag::Delete => {
                    hunk_content.push('-');
                    hunk_content.push_str(change.as_str().unwrap_or(""));
                    old_count += 1;
                    deletions += 1;
                }
                ChangeTag::Equal => {
                    hunk_content.push(' ');
                    hunk_content.push_str(change.as_str().unwrap_or(""));
                    old_count += 1;
                    new_count += 1;
                }
            }
        }

        hunks.push(DiffHunk {
            old_start: op.old_range().start + 1,
            old_lines: old_count,
            new_start: op.new_range().start + 1,
            new_lines: new_count,
            content: hunk_content,
        });
    }

    HttpResponse::Ok().json(DiffPreview {
        path: body.path.clone(),
        hunks,
        additions,
        deletions,
    })
}
