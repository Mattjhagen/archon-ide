# Archon IDE — Agent Reference

This document is the single source of truth for anyone working on Archon IDE.
Read it before writing code, opening a branch, or reviewing a PR.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | Archon IDE |
| Repo | `github.com/Mattjhagen/archon-ide` |
| Production | `https://app.relayapp.pro/` |
| Stack | Rust (actix-web) backend + React/TypeScript frontend |
| Deployment | Fly.io (`archon-ide-pacmac`, `ord` region) |
| Auth | Supabase (GitHub OAuth + email magic links) |
| Design system | Dark theme, Inter + JetBrains Mono, accent `#7c5cfc` |

Archon is a browser-based autonomous coding environment. Users authenticate,
open a project, choose an AI provider, and give Archon a complex coding task.
The agent plans, inspects files, edits code, runs verification, and reports
results — all server-side.

---

## 2. Directory Structure

```
archon-ide/
├── backend/                  # Rust (actix-web) — API + static file serving
│   ├── src/
│   │   ├── main.rs           # Server entry, route registration, AppState
│   │   ├── auth.rs           # Supabase session validation middleware
│   │   ├── fs.rs             # Filesystem ops: read, write, tree, mkdir, rename, delete, search, diff
│   │   ├── git.rs            # Git status, diff, log, branches, commit, blame
│   │   ├── terminal.rs       # PTY terminal sessions (portable-pty)
│   │   ├── ai.rs             # AI provider adapters (OpenAI, Anthropic, Gemini, Ollama, Mock)
│   │   ├── ws.rs             # WebSocket handler
│   │   └── agent/            # Autonomous task runtime
│   │       ├── mod.rs
│   │       ├── domain.rs     # AgentTask, AgentEvent, TaskStatus state machine
│   │       ├── repository.rs # In-memory TaskStore with per-user enforcement
│   │       ├── workspace.rs  # WorkspacePolicy: path containment validation
│   │       ├── model_adapter.rs # Provider-agnostic model call interface
│   │       ├── runner.rs     # Background task execution loop
│   │       └── routes.rs     # HTTP handlers for agent task API
│   ├── Cargo.toml
│   └── Cargo.lock
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx           # Main layout, keyboard shortcuts, setup/welcome routing
│   │   ├── hooks/
│   │   │   └── useAppState.ts    # Central state management
│   │   ├── components/
│   │   │   ├── Agent/        # TaskPanel, TaskTimeline
│   │   │   ├── AiChat/       # AiChatPanel
│   │   │   ├── Auth/         # AuthGate (Supabase OAuth + magic link)
│   │   │   ├── DiffPreview/  # DiffPreviewPanel
│   │   │   ├── Editor/       # EditorArea (Monaco)
│   │   │   ├── FileExplorer/ # Sidebar file tree
│   │   │   ├── GitStatus/    # Git status panel
│   │   │   ├── Layout/       # Sidebar, WelcomeScreen
│   │   │   ├── Settings/     # SettingsModal
│   │   │   ├── Setup/        # SetupScreen (theme + provider selection)
│   │   │   ├── StatusBar/    # Bottom status bar
│   │   │   └── Terminal/     # TerminalPanel (xterm.js)
│   │   ├── lib/
│   │   │   ├── api.ts            # REST API client (fs, git, ai, diff)
│   │   │   ├── agentApi.ts       # Agent task API client
│   │   │   ├── supabase.ts       # Supabase client + authenticatedFetch
│   │   │   ├── appearance.ts     # Theme (obsidian/luminous/paper)
│   │   │   ├── utils.ts          # Language detection, helpers
│   │   │   ├── agent-terminal.ts # Agent terminal integration
│   │   │   ├── contextImport.ts  # Local conversation context import
│   │   │   ├── integrations.ts   # Connector marketplace stubs
│   │   │   ├── modelProfiles.ts  # Model capability metadata
│   │   │   └── semantic-indexer.ts # Semantic indexing stub
│   │   ├── types/
│   │   │   ├── index.ts      # Core domain types (TreeNode, FileContent, Git, etc.)
│   │   │   └── agent.ts      # Agent task types (AgentTask, AgentEvent, TaskStatus)
│   │   ├── styles/           # global.css
│   │   └── __tests__/        # 5 test files (680 lines)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── postcss.config.js
├── supabase/
│   └── migrations/
│       ├── 20260722235000_create_archon_tenant_schema.sql
│       ├── 20260722235100_restrict_rls_auto_enable_function.sql
│       └── 20260722235200_create_agent_tasks.sql
├── docs/
│   ├── agents/               # Workload prompts for parallel agents
│   │   ├── CLAUDE_PARALLEL_BUILD_PROMPT.md
│   │   ├── OPENCODE_BIG_PICKLE_WORKLOAD.md
│   │   ├── GOOGLE_ANTIGRAVITY_IOS_WORKLOAD.md
│   │   └── GOOGLE_ANTIGRAVITY_UX_WORKLOAD.md
│   ├── integrations/
│   ├── marketing/
│   └── ux/
├── ios/                      # iOS companion app (Swift/SwiftUI)
├── .github/
│   └── FUNDING.yml
├── Dockerfile
├── fly.toml
├── .env.example
├── .gitignore
├── README.md
└── design-qa.md
```

---

## 3. Architecture

### Request flow

```
Browser
  → Supabase auth (JWT in localStorage)
  → authenticatedFetch (adds Bearer token)
  → Actix-web server (require_auth middleware validates token against Supabase)
  → Route handler (fs / git / ai / agent / terminal)
  → Response
```

### AppState (server-side shared state)

```rust
pub struct AppState {
    pub open_project: Arc<RwLock<Option<String>>>,      // GLOBAL — shared across users
    pub terminal_sessions: terminal::TerminalManager,    // GLOBAL — shared across users
    pub agent_tasks: Arc<agent::repository::TaskStore>,  // Per-user enforced
}
```

**KNOWN GAP:** `open_project` and `terminal_sessions` are global. Two
authenticated users opening different projects will conflict. The agent task
system (`agent_tasks`) is properly per-user.

### Agent task runtime

The autonomous coding loop runs server-side in a background tokio task:

1. User creates task via `POST /api/agent/tasks`
2. Server stores task + API key (in memory, separate from task entity)
3. `spawn_task_runner` launches a background tokio task
4. Loop: check cancel → check budgets → call model → parse JSON action →
   execute tool → record event → feed result back → repeat
5. Terminates on: done, blocked, failed, cancelled, or budget exhaustion

Lifecycle states:
```
queued → planning → running → verifying → completed
                         ↗ blocked
                         ↗ failed
           cancelling → cancelled
```

### Tool allowlist (agent runner)

The agent can only call these tools:
- `list_tree` — list directory (max depth 3)
- `read_file` — read file (max 50 KB, relative paths only)
- `search` — grep across files
- `git_status` — git status --short
- `git_diff` — git diff --stat
- `write_file` — write/overwrite a file inside workspace
- `done` — mark task complete (requires evidence)
- `blocked` — report genuine external blocker

### Workspace isolation (agent runner only)

`WorkspacePolicy` validates every file path the agent touches:
- Rejects absolute paths
- Rejects `../` traversal
- Rejects paths resolving outside workspace root
- **KNOWN GAP:** Symlinks are NOT resolved — a symlink inside the workspace
  pointing outside will pass validation

### Budget system

| Reasoning Effort | Max Steps | Credit Limit | Max Tokens/Call |
|---|---|---|---|
| Low | 5 | 20 | 2,048 |
| Medium | 15 | 100 | 4,096 |
| High | 40 | 500 | 8,192 |

Credit formula: `ceil((input + output) / 1000) * effort_multiplier`
- Low: 1x, Medium: 2x, High: 4x

---

## 4. API Endpoints

### Unauthenticated

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{"status": "ok"}` |

### Authenticated (all `/api/*` routes)

| Method | Path | Description |
|---|---|---|
| POST | `/api/fs/read` | Read file contents |
| POST | `/api/fs/write` | Write file contents |
| POST | `/api/fs/tree` | Get directory tree |
| POST | `/api/fs/mkdir` | Create directory |
| POST | `/api/fs/rename` | Rename file/directory |
| POST | `/api/fs/delete` | Delete file/directory |
| POST | `/api/fs/search` | Search files by text |
| POST | `/api/project/open` | Open a project (sets global state) |
| POST | `/api/git/status` | Git status |
| POST | `/api/git/diff` | Git diff |
| POST | `/api/git/log` | Git log |
| POST | `/api/git/branches` | List branches |
| POST | `/api/git/commit` | Create commit |
| POST | `/api/git/blame` | Git blame |
| GET | `/api/ai/providers` | List AI providers + models |
| POST | `/api/ai/chat` | AI chat completion |
| POST | `/api/ai/complete` | Code completion |
| POST | `/api/term/create` | Create terminal session |
| POST | `/api/term/input` | Write to terminal |
| POST | `/api/term/resize` | Resize terminal |
| POST | `/api/term/destroy` | Destroy terminal session |
| POST | `/api/diff/apply` | Apply diff |
| POST | `/api/diff/preview` | Preview diff |
| POST | `/api/agent/tasks` | Create autonomous task |
| GET | `/api/agent/tasks` | List user's tasks |
| GET | `/api/agent/tasks/{id}` | Get task detail |
| GET | `/api/agent/tasks/{id}/events` | Get task event log |
| POST | `/api/agent/tasks/{id}/cancel` | Request task cancellation |

---

## 5. AI Providers

| Provider | Models | Requires Key | Notes |
|---|---|---|---|
| OpenAI | GPT-5.6 Sol, GPT-5.6 Terra | Yes | Uses `/v1/responses` endpoint |
| Anthropic | Claude Sonnet 4, Claude Haiku 4 | Yes | Uses adaptive thinking |
| Google Gemini | Gemini 3 Pro, Gemini 3 Flash | Yes | Uses `/v1beta/models/` endpoint |
| Ollama | Llama 3.2, CodeLlama, DeepSeek Coder | No | Local models, auto-detected |
| Mock | Mock Responses | No | Always available, simulated responses |

API keys are:
- Supplied by the user in the browser (session-only, in React state)
- Passed to the backend per-request via `api_key` field
- Stored in memory for the duration of an agent task (in `TaskStore.api_keys`)
- Never logged, never serialized in task/event JSON
- Cleared when task reaches a terminal state

---

## 6. Environment Variables

```bash
# AI providers
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.6-sol
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GEMINI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Server
PORT=3847

# Supabase
SUPABASE_URL=https://ibhrmenurandwvvebqfb.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_URL=https://ibhrmenurandwvvebqfb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`VITE_` prefixed variables are bundled into the frontend JS. Never put
service-role keys or secrets in `VITE_` variables.

---

## 7. Frontend Components

### App flow

```
App.tsx
  ├── SetupScreen (first run: theme + provider selection)
  ├── WelcomeScreen (no project open)
  │     └── StatusBar + SettingsModal
  └── Main IDE layout (project open)
        ├── Sidebar (FileExplorer, GitStatus, Search)
        ├── EditorArea (Monaco tabs) OR DiffPreviewPanel
        ├── TerminalPanel (xterm.js, bottom)
        ├── AiChatPanel OR TaskPanel (right side)
        └── StatusBar (bottom)
```

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save active file |
| Ctrl+` | Toggle terminal |
| Ctrl+B | Toggle sidebar |
| Ctrl+E | Toggle AI panel |

### Themes

- **Obsidian** — Quiet graphite with electric violet precision (`#7c5cff`)
- **Luminous** — Deep navy with crisp cyan and mint (`#28d7c0`)
- **Paper** — Warm daylight surfaces with cobalt (`#1769e0`)

Set via `data-appearance` attribute on `<html>`, backed by `localStorage`.

---

## 8. Tests

### Frontend (Vitest)

```bash
cd frontend && npx vitest run
```

Test files:
- `__tests__/agent.test.ts` (386 lines) — Agent types, status helpers, API client
- `__tests__/domain.test.ts` (64 lines) — Domain type validation
- `__tests__/utils.test.ts` (104 lines) — Language detection, helpers
- `__tests__/contextImport.test.ts` (37 lines) — Context import logic
- `__tests__/modelProfiles.test.ts` (20 lines) — Model profile data
- `components/Auth/AuthGate.test.tsx` (34 lines) — Auth flow
- `components/Setup/SetupScreen.test.tsx` (25 lines) — Setup flow
- `components/Layout/WelcomeScreen.test.tsx` (10 lines) — Welcome screen

### Backend (Rust)

```bash
cd backend && cargo test
```

Test modules:
- `agent/domain.rs` — Lifecycle transitions, budget limits, serialization safety
- `agent/repository.rs` — Ownership enforcement, cross-user denial, cancellation, budget tracking, API key isolation
- `agent/workspace.rs` — Path traversal, absolute path rejection, containment

---

## 9. Build & Deploy

### Local development

```bash
# Frontend dev server (port 5173)
cd frontend && npm install && npm run dev

# Backend (port 3847, serves frontend dist)
cd frontend && npm run build && cd ../backend && cargo run
```

### Production build

```bash
cd frontend && npm run build && cd ../backend && cargo build --release
```

### Docker

```bash
docker build -t archon-ide .
docker run -p 8080:8080 --env-file .env archon-ide
```

### Fly.io

```bash
fly deploy
```

Current config: `fly.toml` — app `archon-ide-pacmac`, `ord` region,
shared-cpu-1x, 1GB RAM, auto-stop/auto-start, min 1 machine.

---

## 10. Known Gaps & Security Issues

### Architecture

| Gap | Severity | Location | Notes |
|---|---|---|---|
| Global `open_project` state | HIGH | `main.rs:16`, `fs.rs` | Two users opening projects conflict. Needs per-user workspace scoping. |
| Global terminal sessions | HIGH | `main.rs:17`, `terminal.rs` | Any user can write to any terminal. Needs per-user isolation. |
| FS endpoints accept arbitrary paths | HIGH | `fs.rs` | No path validation outside agent runner. Any authenticated user can read/write any file the server process can access. |
| In-memory task store | MEDIUM | `repository.rs` | Tasks lost on server restart. Needs Postgres/Supabase persistence. |
| Symlink escape not blocked | MEDIUM | `workspace.rs:15` | Agent runner's WorkspacePolicy doesn't resolve symlinks. |
| No CI/CD | MEDIUM | `.github/` | No GitHub Actions workflows, no automated testing on PR. |
| No smoke tests | LOW | — | No automated health/auth endpoint verification. |
| No security scanning | LOW | — | No dependency audit, no secret detection. |

### Frontend

| Gap | Location | Notes |
|---|---|---|
| Browser folder picker can't reach server | `App.tsx:58-72` | `webkitdirectory` picks local paths, but the server needs server-side paths. |
| Chat mode uses client-side continuation loop | `useAppState.ts:214-265` | The agent task runner exists server-side but the chat panel still runs its own multi-pass loop in the browser. |
| No workspace provisioning UI | — | Users must type a server-side path manually. No repository/workspace list from the server. |

### Backend

| Gap | Location | Notes |
|---|---|---|
| No rate limiting | `main.rs` | No per-user request throttling. |
| No request size limits | `main.rs` | Large request bodies could exhaust memory. |
| Broad CORS | `main.rs:43-47` | `allow_any_origin()` — needs restriction for production. |
| No structured logging | `main.rs:24` | Only `env_logger`, no JSON/structured output. |

---

## 11. What's Done (Merged)

- [x] Rust backend with actix-web, all route handlers
- [x] React frontend with Vite, Tailwind, Monaco, xterm.js
- [x] Supabase auth (GitHub OAuth + email magic links)
- [x] Agent task domain types and lifecycle state machine
- [x] Per-user task repository with ownership enforcement
- [x] Workspace path containment policy
- [x] Background task runner with JSON-action loop
- [x] Provider-agnostic model adapter (OpenAI, Anthropic, Gemini, Ollama, Mock)
- [x] Agent task REST API (create, list, get, events, cancel)
- [x] Frontend TaskPanel with composer, timeline, polling, stop
- [x] Frontend task types and API client
- [x] Three themes (Obsidian, Luminous, Paper)
- [x] Setup/onboarding flow (theme + provider selection)
- [x] 37+ frontend unit tests
- [x] Backend domain, repository, and workspace tests
- [x] Dockerfile (multi-stage: node → rust → debian)
- [x] Fly.io deployment config
- [x] Supabase migrations for agent tasks
- [x] iOS companion foundation (auth, Keychain, API client)
- [x] Onboarding accessibility improvements (PR #3 merged)

---

## 12. What Needs To Be Done

### Priority 1 — Security & Isolation (must fix before public use)

1. **Per-user workspace scoping** — Replace global `open_project` with
   per-user workspace state. Each user should have their own project path
   stored in their session, not in a global `RwLock`.

2. **FS endpoint path validation** — Add `WorkspacePolicy` checks to all
   `/api/fs/*` and `/api/project/open` endpoints. Currently only the agent
   runner validates paths.

3. **Per-user terminal isolation** — Scope terminal sessions to the
   authenticated user. One user must not be able to write to another user's
   terminal.

4. **CORS restriction** — Replace `allow_any_origin()` with a whitelist of
   `relayapp.pro` domains.

5. **Request size limits** — Add `Payload::new().limit()` to Actix extractors
   to prevent memory exhaustion.

### Priority 2 — Persistence & Reliability

6. **Persistent task storage** — Move `TaskStore` from in-memory `HashMap` to
   Supabase/Postgres. The migration `20260722235200_create_agent_tasks.sql`
   already exists but the repository still uses in-memory storage.

7. **CI/CD pipeline** — Add GitHub Actions:
   - Frontend: `npm ci`, `tsc`, `vitest run`, `vite build`
   - Backend: `cargo fmt --check`, `cargo check`, `cargo test`
   - Docker: build, start, health check, stop
   - Security: dependency audit, secret detection

8. **Rate limiting** — Add per-user rate limits on `/api/ai/chat` and
   `/api/agent/tasks` to prevent abuse.

### Priority 3 — Product Completeness

9. **Connect chat panel to agent runner** — The `AiChatPanel` should create
   server-side tasks instead of running its own client-side continuation loop.
   Show task timeline in the chat surface.

10. **Workspace provisioning** — Backend endpoint to list available
    workspaces/repos so users don't type raw server paths.

11. **Menu bar functionality** — File/Edit/View/Help dropdowns should work
    (new project, undo, toggle panels, keyboard shortcuts).

12. **ZIP export** — Package the project with correct platform structure.

13. **Syntax highlighting polish** — Verify Monaco language detection covers
    all common file types.

### Priority 4 — Quality & Polish

14. **Smoke tests** — Health endpoint, auth rejection, main page HTML,
    robots.txt, no secrets in responses.

15. **Security documentation** — `docs/security/SECRETS_AND_ENVIRONMENT.md`:
    what's public vs secret, key rotation, forbidden storage locations.

16. **Operations documentation** — `docs/operations/RELEASE_RUNBOOK.md`:
    pre-release checks, deployment, health checks, rollback.

17. **PR template** — `.github/pull_request_template.md` with scope, security
    impact, test evidence, deployment impact.

18. **Dependabot** — Weekly npm + Cargo + GitHub Actions dependency updates.

19. **Mobile responsive** — Test and fix 320px and 768px viewports.

20. **iOS companion merge** — The `ios/` directory and Swift code are on
    `main` but need a production backend (workspace provisioning, plan
    approval APIs) before the mobile app is useful.

---

## 13. Parallel Agent Workstreams

Four agent workstreams were defined during initial development. Current status:

| Agent | Branch | Scope | Status |
|---|---|---|---|
| Claude | `claude/agent-runtime` | Server-side agent task runtime | **Merged** (PR #2) |
| Google Antigravity UX | `antigravity/onboarding-a11y` | Onboarding, accessibility, setup | **Merged** (PR #3) |
| OpenCode Big Pickle | (not started) | CI, release safety, security, docs | **Not started** — workload defined in `docs/agents/OPENCODE_BIG_PICKLE_WORKLOAD.md` |
| Google Antigravity iOS | (not started) | Native iPhone companion | **Not started** — workload defined in `docs/agents/GOOGLE_ANTIGRAVITY_IOS_WORKLOAD.md` |

The iOS companion code exists in `ios/` on `main` but was committed directly
rather than through the Antigravity workload process.

---

## 14. File Ownership

Before editing a file, check this table to avoid conflicts:

| Area | Owned Files | Owner |
|---|---|---|
| Agent runtime | `backend/src/agent/**` | Claude workstream |
| Workspace security | `backend/src/agent/workspace.rs` | Claude workstream |
| Agent UI | `frontend/src/components/Agent/**`, `frontend/src/types/agent.ts`, `frontend/src/lib/agentApi.ts` | Claude workstream |
| Onboarding/Auth/Setup | `frontend/src/components/Auth/**`, `frontend/src/components/Setup/**`, `frontend/src/components/Layout/WelcomeScreen.tsx` | Antigravity UX |
| CI/CD, docs, scripts | `.github/**`, `scripts/**`, `docs/operations/**`, `docs/security/**`, `docs/contributing/**` | Big Pickle workstream |
| iOS companion | `ios/**` | Antigravity iOS |
| Everything else | `backend/src/main.rs`, `backend/src/fs.rs`, `backend/src/git.rs`, `frontend/src/App.tsx`, `frontend/src/hooks/**` | Integration (lead) |

---

## 15. Design Tokens

```css
/* Obsidian (default) */
--bg-void:      #06060a
--bg-base:      #0c0c14
--bg-surface:   #12121e
--bg-raised:    #1a1a2e
--bg-overlay:   #22223a
--accent:       #7c5cfc
--accent-hover: #9b7eff
--accent-subtle: rgba(124, 92, 252, 0.12)
--text-primary: #e8e8f0
--text-secondary: #9898b0
--text-muted:   #5a5a78
--border-faint: rgba(255, 255, 255, 0.06)
--border-default: rgba(255, 255, 255, 0.10)
--success:      #22c55e
--warning:      #f59e0b
--danger:       #ef4444
```

Fonts: Inter (UI), JetBrains Mono (code).
Icon library: Lucide React.

---

## 16. Quick Reference

```bash
# Run all tests
cd frontend && npx vitest run
cd backend && cargo test

# Build for production
cd frontend && npm run build
cd backend && cargo build --release

# Docker
docker build -t archon-ide .

# Deploy
fly deploy

# Local dev (two terminals)
cd frontend && npm run dev     # port 5173
cd backend && cargo run         # port 3847
```
