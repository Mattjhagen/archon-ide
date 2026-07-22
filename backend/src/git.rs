use actix_web::{web, HttpResponse};
use git2::{Repository, Status, StatusOptions, DiffOptions};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct GitReq {
    pub project_path: String,
}

#[derive(Serialize)]
pub struct GitStatusResult {
    pub branch: String,
    pub files: Vec<GitFileStatus>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| e.to_string())
}

fn status_to_string(status: Status) -> String {
    if status.contains(Status::INDEX_NEW) || status.contains(Status::WT_NEW) {
        "new".to_string()
    } else if status.contains(Status::INDEX_MODIFIED) || status.contains(Status::WT_MODIFIED) {
        "modified".to_string()
    } else if status.contains(Status::INDEX_DELETED) || status.contains(Status::WT_DELETED) {
        "deleted".to_string()
    } else if status.contains(Status::INDEX_RENAMED) || status.contains(Status::WT_RENAMED) {
        "renamed".to_string()
    } else {
        "unchanged".to_string()
    }
}

pub async fn status(
    body: web::Json<GitReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(_e) => return HttpResponse::Ok().json(GitStatusResult {
            branch: "none".to_string(),
            files: vec![],
            ahead: 0,
            behind: 0,
        }),
    };

    let branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "detached".to_string());

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut files = Vec::new();
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let status_str = status_to_string(entry.status());
            let staged = entry.status().intersects(
                Status::INDEX_NEW | Status::INDEX_MODIFIED |
                Status::INDEX_DELETED | Status::INDEX_RENAMED
            );
            files.push(GitFileStatus {
                path: path.to_string(),
                status: status_str,
                staged,
            });
        }
    }

    let (ahead, behind) = count_ahead_behind(&repo);

    HttpResponse::Ok().json(GitStatusResult {
        branch,
        files,
        ahead,
        behind,
    })
}

fn count_ahead_behind(repo: &Repository) -> (usize, usize) {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (0, 0),
    };
    let head_oid = match head.target() {
        Some(oid) => oid,
        None => return (0, 0),
    };

    let branch_name = match head.shorthand() {
        Some(n) => n,
        None => return (0, 0),
    };

    let upstream_ref = format!("refs/remotes/origin/{}", branch_name);
    let upstream = match repo.refname_to_id(&upstream_ref) {
        Ok(oid) => oid,
        Err(_) => return (0, 0),
    };

    let mut ahead = 0;
    let mut behind = 0;

    if let Ok(mut walk) = repo.revwalk() {
        if walk.push(upstream).is_ok() {
            behind = walk.count();
        }
    }

    if let Ok(mut walk2) = repo.revwalk() {
        if walk2.push(head_oid).is_ok() {
            ahead = walk2.count();
        }
    }

    (ahead, behind)
}

#[derive(Serialize)]
pub struct DiffEntry {
    pub path: String,
    pub status: String,
    pub content: String,
}

pub async fn diff(
    body: web::Json<GitReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut entries = Vec::new();

    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let status_str = status_to_string(entry.status());
            let mut diff_opts = DiffOptions::new();
            let diff = repo.diff_index_to_workdir(None, Some(&mut diff_opts));

            if let Ok(diff) = diff {
                let mut diff_text = String::new();
                diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
                    diff_text.push_str(&String::from_utf8_lossy(line.content()));
                    true
                }).ok();

                entries.push(DiffEntry {
                    path: path.to_string(),
                    status: status_str,
                    content: diff_text,
                });
            }
        }
    }

    HttpResponse::Ok().json(entries)
}

#[derive(Serialize)]
pub struct LogEntry {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

pub async fn log_entries(
    body: web::Json<GitReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut revwalk = match repo.revwalk() {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    revwalk.set_sorting(git2::Sort::TIME).ok();
    revwalk.push_head().ok();

    let mut entries = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= 20 { break; }
        if let Ok(oid) = oid {
            if let Ok(commit) = repo.find_commit(oid) {
                let time = chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_default();

                entries.push(LogEntry {
                    hash: oid.to_string()[..8].to_string(),
                    author: commit.author().name().unwrap_or("unknown").to_string(),
                    date: time,
                    message: commit.summary().unwrap_or("").to_string(),
                });
            }
        }
    }

    HttpResponse::Ok().json(entries)
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
}

pub async fn branches(
    body: web::Json<GitReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let current = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_default();

    let mut branches = Vec::new();
    if let Ok(branch_iter) = repo.branches(Some(git2::BranchType::Local)) {
        for branch_result in branch_iter.flatten() {
            if let Ok(Some(name)) = branch_result.0.name() {
                branches.push(BranchInfo {
                    name: name.to_string(),
                    is_current: name == current,
                });
            }
        }
    }

    HttpResponse::Ok().json(branches)
}

#[derive(Deserialize)]
pub struct CommitReq {
    pub project_path: String,
    pub message: String,
    pub files: Option<Vec<String>>,
}

pub async fn commit(
    body: web::Json<CommitReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut index = match repo.index() {
        Ok(i) => i,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    if let Some(files) = &body.files {
        for file in files {
            let _ = index.add_path(std::path::Path::new(file));
        }
    } else {
        let _ = index.add_all(["*"], git2::IndexAddOption::DEFAULT, None);
    }

    if let Err(e) = index.write() {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()}));
    }

    let tree_id = match index.write_tree() {
        Ok(id) => id,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let tree = match repo.find_tree(tree_id) {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let sig = repo.signature().unwrap_or_else(|_| {
        git2::Signature::now("Archon IDE", "archon@local").unwrap()
    });

    let head_oid = repo.head().ok().and_then(|h| h.target());

    let parent_commit = head_oid.and_then(|oid| repo.find_commit(oid).ok());
    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    match repo.commit(Some("HEAD"), &sig, &sig, &body.message, &tree, &parents) {
        Ok(oid) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "commit": oid.to_string()
        })),
        Err(e) => HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
pub struct BlameReq {
    pub project_path: String,
    pub file_path: String,
}

#[derive(Serialize)]
pub struct BlameLine {
    pub line: usize,
    pub commit: String,
    pub author: String,
    pub date: String,
    pub content: String,
}

pub async fn blame(
    body: web::Json<BlameReq>,
) -> HttpResponse {
    let repo = match open_repo(&body.project_path) {
        Ok(r) => r,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let path = std::path::Path::new(&body.file_path);
    let blame_result = match repo.blame_file(path, None) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": e.to_string()})),
    };

    let mut lines = Vec::new();
    for (i, hunk) in blame_result.iter().enumerate() {
        let commit = repo.find_commit(hunk.final_commit_id());
        let (author, date) = if let Ok(c) = commit {
            (
                c.author().name().unwrap_or("unknown").to_string(),
                chrono::DateTime::from_timestamp(c.time().seconds(), 0)
                    .map(|dt| dt.format("%Y-%m-%d").to_string())
                    .unwrap_or_default(),
            )
        } else {
            ("unknown".to_string(), "".to_string())
        };

        lines.push(BlameLine {
            line: i + 1,
            commit: hunk.final_commit_id().to_string()[..8].to_string(),
            author,
            date,
            content: String::new(),
        });
    }

    HttpResponse::Ok().json(lines)
}
