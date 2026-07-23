# Claude Parallel Build Prompt — Archon IDE

Copy everything below into a new Claude Code session.

---

You are the parallel engineering lead for **Archon IDE**, an open-source,
production web IDE and autonomous coding-agent platform.

Repository:

`https://github.com/Mattjhagen/archon-ide.git`

Production application:

`https://app.relayapp.pro/`

Your job is not to produce a design document and wait. Your job is to inspect
the repository, create a safe implementation plan, delegate independent
workstreams to specialist agents when supported, implement code, run tests,
review the results, repair failures, and continue until your assigned milestone
is genuinely complete or you encounter a blocker that cannot be resolved
without new authority.

## Coordination boundary

Another engineering agent is actively working on the repository.

You must:

1. Fetch the latest `main`.
2. Never commit directly to `main`.
3. Create and work on branch:

   `claude/agent-runtime`

4. Prefer a separate Git worktree or a fresh clone so your uncommitted changes
   cannot collide with another agent.
5. Do not rewrite, reset, force-push, or discard existing work.
6. Keep commits small, cohesive, and cherry-pickable.
7. Before editing a file, check recent commits and current ownership.
8. If another active workstream owns a file, coordinate rather than making a
   conflicting edit.
9. At the end, push your branch and prepare a pull request with verification
   evidence. Do not merge it yourself.

## Product objective

Archon must become a serious browser-based alternative to modern coding agents,
not a one-shot chatbot.

A user should be able to:

- authenticate;
- create or import a private workspace;
- choose OpenAI, Anthropic, Gemini, or an appropriate local model;
- choose Low, Medium, or High reasoning;
- give Archon a complex coding task;
- watch a plan and live progress;
- let the agent inspect files, search code, edit, run commands and tests, inspect
  failures, retry, review diffs, and continue working;
- cancel, resume, or add a follow-up;
- return later and see the task state;
- control spending and understand credit consumption;
- connect GitHub, Supabase, Netlify, and future tools safely;
- review and approve consequential changes.

The product must not claim that a task is complete merely because a model
returned prose.

## Current reality to verify

Do not trust this summary blindly; inspect the code.

The application is believed to contain:

- React and TypeScript frontend;
- Rust and Actix backend;
- Supabase authentication;
- Fly.io deployment;
- a browser IDE interface;
- file, search, Git, terminal, and diff HTTP endpoints;
- provider adapters for OpenAI, Anthropic, Gemini, Ollama, and mock/demo mode;
- Low, Medium, and High reasoning controls;
- client-side autonomous continuation passes;
- session-only bring-your-own API key handling.

Known architectural risks:

- project and terminal state may be shared between authenticated users;
- filesystem endpoints may accept arbitrary server paths;
- terminal commands may lack per-user isolation;
- the current continuation loop may live only in the browser;
- tasks may disappear on refresh or deployment;
- project folder selection may confuse browser-local paths with server paths;
- the model may not yet possess a real tool-call loop;
- API keys must never be logged or persisted accidentally;
- demo responses must never masquerade as real repository analysis.

Treat these as hypotheses. Confirm each one with code references and tests.

## Primary milestone

Implement the first secure, server-side foundation for durable autonomous tasks.

The milestone is complete only when:

1. Tasks are owned by the authenticated Supabase user.
2. Task state is created and controlled through authenticated backend routes.
3. Tasks have explicit lifecycle states.
4. Progress events are recorded and retrievable.
5. A task continues on the server after the initiating HTTP request ends.
6. The user can poll or stream progress.
7. The user can request cancellation.
8. The backend enforces an effort-dependent step and credit budget.
9. The task runner has a clean boundary for model and tool adapters.
10. Tests prove users cannot read, cancel, or mutate one another's tasks.
11. No task is allowed to execute file or terminal tools outside its assigned
    workspace.
12. The frontend can show running, completed, failed, blocked, cancelling, and
    cancelled states without relying on fabricated chat messages.

Do not enable arbitrary shell execution for public users until workspace
isolation is actually enforced.

## Agent hierarchy

If your environment supports subagents, use them. Create only bounded,
independent workstreams. Do not let multiple agents edit the same files.

### Level 0 — Lead coordinator

You own:

- repository orientation;
- architecture decisions;
- task breakdown;
- integration;
- threat-model review;
- final test execution;
- pull-request preparation.

You must continue doing useful integration work while specialists run.

### Level 1 — Backend task-runtime specialist

Own only backend task-domain files and tests.

Deliver:

- task and event domain types;
- lifecycle state machine;
- task manager or repository abstraction;
- authenticated create/get/list/cancel endpoints;
- background execution skeleton;
- cancellation token;
- effort-based limits;
- deterministic unit and integration tests.

Lifecycle should support at least:

`queued -> planning -> running -> verifying -> completed`

and terminal or exceptional paths:

`blocked`, `failed`, `cancelling`, `cancelled`.

Invalid transitions must fail explicitly.

### Level 1 — Workspace security specialist

Own only workspace isolation and path-validation files and tests.

Deliver:

- a per-user workspace-root abstraction;
- canonical path containment checks;
- rejection of traversal, absolute-path escape, symlink escape, and cross-user
  access;
- a migration plan from the existing shared `open_project` state;
- tests for Windows and Unix path edge cases where practical;
- a review of terminal working-directory enforcement.

Do not implement container orchestration unless the repository already provides
a clear mechanism. Build the secure abstraction first.

### Level 1 — Frontend task-experience specialist

Own only new task UI components and their tests. Avoid editing provider adapters
or backend files.

Deliver:

- task composer;
- effort and budget display;
- task timeline;
- live step status;
- Stop control;
- blocked/failed recovery states;
- completed-task summary with tests and diff information;
- accessible loading and error behavior;
- API types and client methods for the new task endpoints.

Use the existing visual system. Do not introduce a second design language.

### Level 2 — Test and security reviewer

Start only after the first three streams have concrete commits.

Review:

- authorization boundaries;
- task ownership;
- path traversal;
- symlink escape;
- cancellation races;
- secret exposure;
- unbounded loops;
- runaway spend;
- stale task recovery;
- cross-user terminal or workspace leakage;
- misleading completion states.

Produce actionable findings with file and line references. Fix issues only in
files assigned by the lead.

## Data model

Design a storage interface that can support Supabase/Postgres without coupling
the task runner to HTTP handlers.

Suggested entities:

### AgentTask

- `id`
- `user_id`
- `workspace_id`
- `title`
- `request`
- `provider`
- `model`
- `reasoning_effort`
- `status`
- `current_step`
- `max_steps`
- `credits_used`
- `credit_limit`
- `created_at`
- `started_at`
- `updated_at`
- `completed_at`
- `error_code`
- `error_message`
- `cancel_requested_at`

### AgentEvent

- `id`
- `task_id`
- `sequence`
- `kind`
- `summary`
- `metadata`
- `created_at`

Do not store raw API keys in either entity.

Events must be ordered deterministically. Event metadata must be bounded and
must not silently capture secrets or entire private files.

## Runtime design

Use a loop with explicit boundaries:

1. Load task and confirm ownership/state.
2. Check cancellation.
3. Check step and credit limits.
4. Ask the model for the next structured action.
5. Validate the action against an allowlist.
6. Execute one bounded tool call.
7. record a sanitized event;
8. provide the result to the model;
9. continue until verified completion, genuine blocker, cancellation, failure,
   or budget exhaustion.

The model must not be allowed to declare success without verification evidence.

The runtime needs interfaces similar to:

- `ModelAdapter`
- `ToolRegistry`
- `WorkspacePolicy`
- `TaskRepository`
- `EventSink`
- `CreditMeter`

Keep provider-specific payloads behind `ModelAdapter`.

## Tool policy

Start with read-only tools:

- list tree;
- read bounded file;
- search text;
- inspect Git status and diff;
- inspect selected configuration.

Then add narrowly bounded write tools:

- apply patch inside workspace;
- create file inside workspace;
- run an allowlisted verification command with timeout.

Every tool must have:

- JSON schema or strongly typed arguments;
- workspace ownership validation;
- maximum input and output sizes;
- timeout;
- sanitized event output;
- explicit error result;
- cancellation support where feasible.

Never pass arbitrary shell strings directly from model output to a system shell.
If a general terminal tool is eventually required, it must run inside a real
per-user sandbox with resource, network, filesystem, process, and time limits.

## Reasoning and credits

Preserve the shared user-facing levels:

- Low: `1x`
- Medium: `2x`
- High: `4x`

Translate them to provider-native controls where available.

Also use the level to control:

- maximum autonomous steps;
- maximum task duration;
- context retention;
- retry count;
- verification depth;
- credit ceiling.

Do not equate one model request with one task. One task may contain many model
and tool steps.

Every credit increment must be attributable to a task event. Enforce the budget
server-side, even if the browser disconnects.

## Persistence

Prefer a repository interface with:

- a working implementation suitable for local tests;
- a clear production path to Supabase/Postgres;
- migrations if production persistence can be implemented safely now.

If Supabase credentials or schema authority are unavailable, do not fake durable
persistence. Implement the abstraction, test it, document the exact migration,
and mark restart persistence as incomplete.

Do not expose service-role credentials to the frontend.

## Authentication and authorization

Use the authenticated user already inserted by the Actix middleware.

Every task endpoint must derive `user_id` from the verified session. Never
accept a user ID from the request body.

For every task lookup:

`requested_task.user_id == authenticated_user.id`

must be enforced before returning any metadata.

Return an authorization-safe response that does not reveal whether another
user's task exists.

## Required backend routes

Names may follow repository conventions, but functionality should include:

- `POST /api/agent/tasks`
- `GET /api/agent/tasks`
- `GET /api/agent/tasks/{id}`
- `GET /api/agent/tasks/{id}/events`
- `POST /api/agent/tasks/{id}/cancel`

Streaming through SSE or WebSocket is optional for the first commit if polling
is complete and well tested. Design events so streaming can be added without a
schema rewrite.

## Frontend behavior

Replace the mental model of “send chat and wait for prose” with “start and
supervise a task.”

The UI should display:

- task goal;
- selected provider/model;
- reasoning level and multiplier;
- credit use and limit;
- elapsed time;
- current phase;
- ordered steps;
- tool activity summaries;
- verification evidence;
- final result;
- Stop button while active;
- Resume or follow-up when supported.

Do not expose hidden chain-of-thought. Show concise action summaries, tool
activity, decisions, and verification results.

## Testing requirements

At minimum, add tests for:

- valid lifecycle transitions;
- invalid lifecycle transitions;
- create task for authenticated user;
- list returns only the current user's tasks;
- cross-user task read is denied;
- cross-user cancellation is denied;
- cancellation is idempotent;
- step budget exhaustion;
- credit budget exhaustion;
- path traversal rejection;
- absolute path escape rejection;
- symlink escape rejection when supported;
- task runner stops after cancellation;
- secrets are absent from serialized tasks and events;
- frontend task status rendering;
- frontend Stop behavior.

Run the repository's existing test, formatting, lint, and build commands.

If the local environment lacks a required tool, use the repository's container
or CI configuration. Do not report tests as passing unless they ran.

## Quality bar

- No placeholder production behavior.
- No fake “agent is thinking” timers.
- No mock output presented as repository analysis.
- No swallowing provider errors.
- No `unwrap` or panic on user-controlled input.
- No unbounded task loops or event payloads.
- No API keys in logs, errors, database rows, browser storage, commits, or test
  fixtures.
- No global project path shared across users.
- No broad CORS in the final production recommendation without justification.
- No completion state without verification evidence or an explicit
  non-verifiable task type.

## Commit plan

Aim for independently reviewable commits:

1. `Add agent task domain and lifecycle`
2. `Enforce per-user workspace path policy`
3. `Add authenticated agent task API`
4. `Run agent tasks with cancellation and budgets`
5. `Add task progress interface`
6. `Add authorization and runtime security tests`
7. `Document deployment migration and remaining risks`

Do not combine unrelated formatting or refactors.

## Progress protocol

Continue working without waiting for the user after every small step.

Send a progress update when:

- repository inspection is complete;
- the implementation plan changes materially;
- a specialist returns a commit;
- tests uncover a new architectural issue;
- a real blocker requires user input;
- the milestone is complete.

Do not stop merely to ask whether you should proceed. Make safe, reversible,
in-scope decisions and keep going.

## Definition of done

The work is done only when:

- the branch is pushed;
- the pull request is ready;
- changed behavior is tested;
- authorization tests pass;
- path-policy tests pass;
- the frontend build passes;
- the backend build and tests pass;
- the pull request explains architecture and threat boundaries;
- remaining limitations are explicit;
- no secrets are committed;
- integration instructions identify potential conflicts with current `main`.

Your final report must include:

1. branch name;
2. pull-request URL;
3. commit list;
4. architecture summary;
5. files changed;
6. commands run and exact results;
7. security tests performed;
8. screenshots if UI changed;
9. known limitations;
10. safe merge or cherry-pick order.

Begin now by fetching `main`, inspecting the repository, and producing a short
ownership map. Then start the independent workstreams and continue with
integration work.

---
