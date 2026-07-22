# Archon IDE

A local-first AI coding assistant built with Rust + React. Similar architecture to Tauri — Rust backend serves the React frontend as static files, same process.

## Stack

- **Backend**: Rust, actix-web, git2, portable-pty, reqwest
- **Frontend**: React, TypeScript, Vite, Monaco Editor, xterm.js

## Quick Start

```bash
# Build frontend
cd frontend && npm install && npm run build && cd ..

# Run backend (serves frontend + API)
cd backend && cargo run

# Open http://localhost:3847
```

## Architecture

```
archon-ide/
├── backend/          # Rust (actix-web) - serves API + static frontend
│   ├── src/
│   │   ├── main.rs      # Server entry, routes
│   │   ├── fs.rs        # Filesystem ops, project tree, search
│   │   ├── git.rs       # Git status, diff, commit, log, branches
│   │   ├── terminal.rs  # PTY terminal sessions (portable-pty)
│   │   ├── ai.rs        # AI provider adapters (OpenAI, Anthropic, Ollama, Mock)
│   │   └── ws.rs        # WebSocket handler
│   └── Cargo.toml
├── frontend/         # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx              # Main layout
│   │   ├── hooks/useAppState.ts # Core state management
│   │   ├── components/          # Sidebar, Editor, Chat, Terminal, etc.
│   │   ├── lib/api.ts           # REST API client
│   │   └── __tests__/           # 37 unit tests
│   └── package.json
└── .env.example
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fs/read` | Read file contents |
| POST | `/api/fs/write` | Write file contents |
| POST | `/api/fs/tree` | Get directory tree |
| POST | `/api/fs/search` | Search files |
| POST | `/api/project/open` | Open a project |
| POST | `/api/git/status` | Git status |
| POST | `/api/git/diff` | Git diff |
| POST | `/api/git/commit` | Create commit |
| GET | `/api/ai/providers` | List AI providers |
| POST | `/api/ai/chat` | AI chat completion |
| POST | `/api/term/create` | Create terminal session |
| POST | `/api/term/input` | Write to terminal |

## Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
PORT=3847
```

## Tests

```bash
cd frontend && npx vitest run
```

37 tests covering utility functions and domain logic.
