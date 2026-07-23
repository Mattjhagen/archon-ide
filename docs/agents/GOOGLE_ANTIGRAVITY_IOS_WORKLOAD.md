# Archon iOS Companion — Build Worklist for Google Antigravity

## Mission

Build a native iPhone companion for Archon that lets a signed-in developer start, follow, steer, cancel, and review long-running autonomous coding tasks from anywhere.

This is **not** a mobile clone of the desktop IDE. v1 should be excellent at the high-value loop:

> Connect a repository → describe work → approve the plan → follow live progress → review the diff/checkpoint → send follow-up or stop.

The companion depends on the secure, server-side task runtime. Do not claim a local iPhone filesystem, terminal, repository write access, task isolation, or a completed deployment feature unless the relevant backend contract is present and verified.

## Product decisions

- **Target:** iPhone first, iOS 17+, Swift 5.10, SwiftUI, async/await.
- **Brand:** Archon / Relay, using the existing dark, graphite/teal visual language. Do not introduce a separate consumer-app aesthetic.
- **Authentication:** Supabase GitHub OAuth using the existing project/session. Store session credentials only in Keychain.
- **API host:** production uses `https://app.relayapp.pro`; make it environment-configurable for local/staging builds.
- **Data ownership:** every API call carries the authenticated Supabase bearer token. Never accept a user ID supplied by the client.
- **v1 task model:** the mobile app consumes the existing authenticated agent endpoints:
  - `GET /api/agent/tasks`
  - `POST /api/agent/tasks`
  - `GET /api/agent/tasks/{id}`
  - `GET /api/agent/tasks/{id}/events`
  - `POST /api/agent/tasks/{id}/cancel`
- **Workspace constraint:** task creation must use a server-provisioned workspace ID/root selected from a repository/workspace list. Do **not** expose arbitrary filesystem-path entry in the iOS UI.

## Non-goals for v1

- Full Monaco-style code editing.
- A raw shell or terminal emulator.
- Storing provider API keys in the app, UserDefaults, analytics, or task history.
- Silent destructive changes, auto-merge, or command execution.
- Local semantic indexing on iPhone.

## Delivery order

### Milestone 0 — Foundation and contract audit

1. Create `ios/Archon/` as an Xcode project with SwiftUI app lifecycle.
2. Add configuration for development, staging, and production API/Supabase URLs. No secret belongs in source control.
3. Implement typed API models for task status, task events, provider/model metadata, reasoning effort, error responses, and pagination readiness.
4. Build an `AuthenticatedAPIClient` that adds the current Supabase access token, decodes non-2xx API errors, and retries only safe GET requests.
5. Add a deterministic mock API client used by previews and unit tests.

**Acceptance:** a simulator build can list mock tasks and render every lifecycle state: queued, planning, running, verifying, completed, blocked, failed, cancelling, cancelled.

### Milestone 1 — Auth and trust-first onboarding

1. Add a compact relay/Archon welcome screen with “Continue with GitHub.”
2. Complete Supabase OAuth via the approved mobile deep-link callback and restore sessions from Keychain.
3. Show a clear first-run explanation: GitHub sign-in authenticates the person; it does not grant repository access until a repository connection is explicitly made.
4. Add a logged-out state, session-expired recovery, and sign-out that clears local nonessential state.
5. Support Dynamic Type, VoiceOver labels, minimum 44pt hit targets, and reduced motion.

**Acceptance:** an authenticated user can close/reopen the app without signing in again; a revoked/expired session returns to a clear sign-in state without leaking task information.

### Milestone 2 — Task inbox and live task detail

1. Build the home screen as a task inbox, grouped into Active, Needs attention, and Recent.
2. Use task status, current/max steps, credit usage/limit, model, and last event to make progress legible at a glance.
3. Build task detail with a chronological event timeline: planning, model calls, tool calls, tool results, verification, completion/blocker/error.
4. Poll active task details every 2–5 seconds using app-lifecycle-aware polling. Stop polling when backgrounded; resume and refresh when foregrounded.
5. Add pull-to-refresh, empty states, loading/error/retry states, and accessible status descriptions.
6. Add a prominent Stop control for active tasks, with confirmation only when a tool operation is currently in flight. Reflect cancelling/cancelled states accurately.

**Acceptance:** the user can start on web, open iOS later, and see the same task status/events; stopping a task on either surface updates the other after refresh.

### Milestone 3 — New autonomous task composer

1. Create a focused task composer: workspace/repository picker, task title, detailed request, provider/model picker, and Low/Medium/High reasoning selection.
2. Show transparent effort guidance from the server budget contract:
   - Low: 5 steps / 20 credits
   - Medium: 15 steps / 100 credits
   - High: 40 steps / 500 credits
   Treat these as task budgets, not a provider price quote.
3. Add request templates for bug fix, feature, investigate, refactor, and test failure. Templates must remain editable.
4. Validate locally, then submit through the typed API client. Disable duplicate submission while creating.
5. If the backend does not yet expose repository/workspace provisioning, ship the picker only against mock/test data and leave real task creation behind a truthful “Connect a workspace on web” state.

**Acceptance:** with a real provisioned workspace API available, a user can submit a task and immediately land on the running-task detail; without that API, the app never asks for a raw path or makes a false capability claim.

### Milestone 4 — Plan approval, checkpoints, and review (contract-gated)

Implement only after the backend exposes explicit APIs and authorization rules.

1. Add a Plan review screen with goal, constraints, proposed files, risks, success checks, and estimated budget.
2. Require a deliberate “Approve and run” action before a plan may write files.
3. Add a checkpoint list with changed files, generated summary, test evidence, timestamp, and per-checkpoint credit usage.
4. Add a diff viewer optimized for mobile review, with file selection and line-level readability.
5. Add rollback confirmation that spells out exactly what is restored. Never display a rollback button without a server endpoint that performs it safely.

**Acceptance:** plan approval, checkpoint creation, diff review, and rollback all use server-authoritative state and remain correct after app restart.

### Milestone 5 — Notifications and follow-up

1. Register for APNs only after the user opts in; store device tokens through an authenticated, user-owned backend endpoint.
2. Notify on completed, blocked, failed, and approval-needed tasks—not every tool call.
3. Deep link notifications directly to the relevant task detail.
4. Allow a follow-up instruction only when the backend offers a supported continuation endpoint. Otherwise, explain that follow-up is available on web for the current release.

**Acceptance:** notification opt-out is respected, blocked-task notifications deep-link correctly, and no task content appears in lock-screen text by default.

## Architecture expectations

```text
ios/Archon/
  App/                 app entry, environment configuration, deep links
  Auth/                Supabase session and Keychain storage
  Networking/          authenticated API client, DTOs, error mapping
  Features/Tasks/      inbox, composer, detail, timeline, polling state
  Features/Workspaces/ repository/workspace selection (contract-gated)
  Features/Review/     plans, checkpoints, diffs (contract-gated)
  DesignSystem/        color, type, spacing, reusable accessible controls
  Tests/               unit tests, API decoding, view-model tests, UI smoke tests
```

- Use `@MainActor` view models and explicit loading/error/success states.
- Keep API DTOs separate from rendering models.
- Use SwiftUI previews backed by fixture data for every state.
- No third-party dependency without a concrete reason and license review.
- Capture structured, privacy-safe telemetry only after a product decision; never log prompts, source code, tokens, or API keys.

## Security and safety requirements

1. Keychain for sessions; no tokens or API keys in logs, crash reports, UserDefaults, screenshots, or push notification bodies.
2. TLS only; use App Transport Security defaults. Do not weaken ATS for development.
3. Treat all task titles, messages, metadata, and previews as untrusted text. Render as text; do not execute HTML or deep links supplied by task metadata.
4. Do not expose command execution controls until server-side policy, command classification, audit logging, approval, and workspace isolation are verified.
5. Do not cache source code or tool-result previews offline by default. Cache only the minimum task list/status metadata necessary for a responsive inbox.
6. Preserve server authorization: wrong-user or missing task remains indistinguishable from not-found in the client experience.

## Test and release checklist

- Unit-test API error parsing, auth restoration, lifecycle-state formatting, credit/step presentation, and polling stop/resume behavior.
- UI-test sign-in handoff, empty inbox, active task, blocked task, cancellation, Dynamic Type XXL, and VoiceOver-focused controls.
- Test on current iPhone simulator sizes and at least one physical device before TestFlight.
- Validate poor/offline network behavior and token expiry.
- Add privacy manifest and App Store privacy nutrition labels from actual data behavior, not assumptions.
- Run a manual security review before connecting real GitHub repositories or workspace write access.

## Handoff format

For each milestone, report:

1. Exact files changed.
2. Backend contracts used and any missing contract that blocks the next step.
3. Tests run and their result.
4. Screenshots/recording of a simulator flow when browser tooling is not relevant.
5. Product-truth wording used for any gated or simulated feature.

Do not start Milestone 4 or terminal controls by mocking a production capability as if it exists. Escalate the missing backend contract instead.
