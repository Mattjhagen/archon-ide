# Archon IDE

A browser-based AI coding assistant. Rust backend serves the React frontend as static files, same process — similar to Tauri but runs headless on a server.

**Production:** [app.relayapp.pro](https://app.relayapp.pro)

## Stack

- **Backend:** Rust, actix-web, git2, portable-pty, reqwest
- **Frontend:** React 18, TypeScript, Vite, Monaco Editor, xterm.js
- **Auth:** Supabase (JWT middleware in Rust)
- **Deploy:** Docker + Fly.io

## Quick Start

```bash
# Build frontend
cd frontend && npm install && npm run build && cd ..

# Run backend (serves frontend + API)
cd backend && cargo run

# Open http://localhost:3847
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI / compatible provider key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `OPENAI_MODEL` | No | `gpt-4o` | Default model |
| `ANTHROPIC_API_KEY` | No | — | Anthropic key |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Local Ollama endpoint |
| `PORT` | No | `3847` | Server port |
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | — | Supabase anon/public key |
| `ALLOWED_ORIGINS` | No | `https://relayapp.pro,...` | Comma-separated CORS origins |
| `MAX_BODY_BYTES` | No | `2097152` (2 MB) | Max request body size |

## Architecture

```
archon-ide/
├── backend/                 # Rust (actix-web)
│   ├── src/
│   │   ├── main.rs          # Server entry, routes, CORS, middleware
│   │   ├── auth.rs          # Supabase JWT verification, require_auth
│   │   ├── fs.rs            # Filesystem ops, project tree, search, diff
│   │   ├── git.rs           # Git status, diff, commit, log, branches, blame
│   │   ├── terminal.rs      # PTY terminal sessions (portable-pty)
│   │   ├── ai.rs            # AI provider adapters (OpenAI, Anthropic, Ollama, Mock)
│   │   ├── ws.rs            # WebSocket handler
│   │   └── agent/           # Background AI task runtime
│   │       ├── mod.rs
│   │       ├── routes.rs    # Task CRUD + SSE event stream
│   │       └── repository.rs # Per-user task store
│   └── Cargo.toml
├── frontend/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx                    # Main layout
│   │   ├── hooks/useAppState.ts       # Core state management
│   │   ├── components/                # Sidebar, Editor, Chat, Terminal, etc.
│   │   ├── lib/api.ts                 # REST API client
│   │   └── __tests__/                 # Unit tests (vitest)
│   └── package.json
├── fly.toml                 # Fly.io deploy config
├── Dockerfile               # Multi-stage: node → rust → debian-slim
├── .env.example             # Environment variable reference
└── agents.md                # Full project documentation for AI agents
```

## API Endpoints

All `/api/*` routes require a valid Supabase JWT in the `Authorization` header.

### Files

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fs/read` | Read file contents |
| POST | `/api/fs/write` | Write file contents |
| POST | `/api/fs/tree` | Get directory tree |
| POST | `/api/fs/mkdir` | Create directory |
| POST | `/api/fs/rename` | Rename / move path |
| POST | `/api/fs/delete` | Delete file or directory |
| POST | `/api/fs/search` | Full-text search across files |
| POST | `/api/project/open` | Set active project root |
| POST | `/api/diff/preview` | Preview a unified diff |
| POST | `/api/diff/apply` | Apply a unified diff to a file |

### Git

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/git/status` | Working tree status |
| POST | `/api/git/diff` | Diff (staged or unstaged) |
| POST | `/api/git/log` | Commit log |
| POST | `/api/git/branches` | List branches |
| POST | `/api/git/commit` | Create commit |
| POST | `/api/git/blame` | Line-by-line blame |

### AI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/providers` | List configured providers |
| POST | `/api/ai/chat` | Synchronous chat completion |
| POST | `/api/ai/complete` | Code completion |
| POST | `/api/ai/jobs` | Create async background job |
| GET | `/api/ai/jobs/{id}` | Get job status + logs |

### Terminal

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/term/create` | Create PTY session |
| POST | `/api/term/input` | Write to PTY |
| POST | `/api/term/resize` | Resize PTY |
| POST | `/api/term/destroy` | Destroy PTY session |

### Agent

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/tasks` | Create background task |
| GET | `/api/agent/tasks` | List user's tasks |
| GET | `/api/agent/tasks/{id}` | Get task detail |
| GET | `/api/agent/tasks/{id}/events` | SSE event stream |
| POST | `/api/agent/tasks/{id}/cancel` | Cancel task |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |

## Security

- **CORS:** restricted to `ALLOWED_ORIGINS` (defaults to relayapp.pro + localhost)
- **Auth:** Supabase JWT verified on every `/api/*` route via Actix middleware
- **Body limit:** `MAX_BODY_BYTES` (default 2 MB) applied via `PayloadConfig`
- **FS scope:** all file operations accept an explicit `project_root` — the server does not enforce user-level path isolation (known limitation)

## Tests

```bash
cd frontend && npx vitest run
```

## Deploy

```bash
fly deploy
```

Builds the Docker image (multi-stage: frontend build → Rust release → debian-slim runtime) and deploys to Fly.io.

## Further Reading

See `agents.md` in the repo root for the full project reference — data models, state management, auth flow, frontend architecture, and the complete roadmap.
