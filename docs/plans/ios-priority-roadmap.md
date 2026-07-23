# Archon iOS Priority Roadmap

**Status:** active plan for the next development session  
**Product priority:** Native iOS companion before further website expansion  
**Principle:** Ship a trustworthy mobile companion for real Archon tasks; do not simulate agent activity, workspace access, or preview safety.

## Tonight's branch decision

| Branch | Decision | Reason |
| --- | --- | --- |
| `claude/ios-agent-ui-hardening` | **iOS integration candidate** | Contains the adaptive iPhone layout, truthful agent UI, error-copy fixes, real task polling, and does not include AG's unsafe preview prototype. |
| `ios-companion` | **Freeze; do not merge** | It contains useful early iOS work but also concurrent, unverified changes and an invented client-side file-edit protocol. |
| `feat/workspace-sync` | **Reject; do not merge** | It changes backend ownership/runtime behavior without the approved contract, retains raw-path sync, and needs a clean rebuild by the backend owner. |

Only one agent may write to the selected iOS integration branch at a time. New work starts from the current candidate branch in a dedicated branch and is merged only after review and macOS verification.

## Milestone 0 — prove the current app on macOS

This is the first task tomorrow. No one should claim the app is release-ready until it passes in Xcode.

1. Check out `claude/ios-agent-ui-hardening` on a Mac.
2. Create `ios/Config.xcconfig` from `Config.example.xcconfig`; never commit it.
3. Generate `Archon.xcodeproj` with XcodeGen.
4. Run unit tests on at least an iPhone SE and a current large iPhone simulator.
5. Run manually on an authenticated test account.

Required manual checks:

- The editor starts directly below the navigation bar on compact iPhones; no large dead band appears above it.
- The Agent panel opens at the medium detent, expands to large, scrolls safely, and keeps the composer above the keyboard.
- Portrait, landscape, and Dynamic Type accessibility sizes remain usable.
- Explorer selection opens the correct file and file edits persist after restarting the app.
- Error messages are human-readable and never show `Archon.APIError`, Swift type names, or raw error codes.
- Provider choices accurately reflect server-configured providers; mock mode is visibly demo-only.
- Starting, observing, cancelling, and completing an agent task shows only real backend state.

If a build, test, or simulator check fails, record the exact command, output, device, and screenshot before changing code.

### Screen-fit corrective task (physical iPhone priority)

The screenshots captured on July 23 show the full app canvas inset vertically: a large black band appears above the IDE and another below it. This is separate from the Agent sheet's detent and must be diagnosed on the physical device before visual polish continues.

Required investigation:

1. Confirm the app target's launch screen, deployment target, scene configuration, and supported orientation settings. A stale launch-screen constraint, custom root container, or compatibility mode can make the app appear letterboxed.
2. In Xcode's View Debugger, inspect the `UIWindow`, root `UIHostingController`, `IDEView`, `NavigationStack`, and presented sheet frames. Record each frame and safe-area inset on the affected device.
3. Add temporary debug-only frame/safe-area logging if the View Debugger does not reveal the parent that constrains the root view. Remove the instrumentation before merging.
4. Confirm that `ArchonApp` places `IDEView` directly in `WindowGroup`, with no fixed outer frame, scale effect, padding, spacer, or legacy wrapper.
5. Test a clean build after deleting the simulator app. Also test a physical iPhone if available; screenshots alone are not enough to identify whether the problem comes from the app, simulator display scaling, or an iOS compatibility setting.

Correction requirements:

- The root `IDEView` must fill the UIWindow's safe-area content region at every supported iPhone size and orientation.
- The app must not use fixed screen dimensions, device-specific offsets, arbitrary `Spacer`s, or `ignoresSafeArea` as a workaround.
- Navigation chrome begins beneath the status/Dynamic Island area and content extends naturally to the home-indicator safe area.
- The Agent panel remains a presented adaptive sheet; it must not resize, offset, or letterbox the presenting app.
- Treat iPhone SE, a Dynamic Island iPhone, and landscape as required acceptance devices.

Screen-fit acceptance evidence:

- Before/after screenshots from the same device and orientation.
- View Debugger capture or recorded root/safe-area frame values.
- No black bands outside normal system safe-area regions.
- No clipped composer, toolbar, or preview after keyboard appearance and rotation.

## Milestone 1 — merge a stable iOS foundation

After Milestone 0 passes, open a focused PR from the candidate branch. It should contain only the native iOS directory and any necessary documentation.

The stable foundation includes:

- SwiftUI lifecycle and GitHub/Supabase sign-in.
- Keychain-backed Supabase session storage.
- Truthful onboarding, accessibility labels, Dynamic Type, and 44pt touch targets.
- Responsive iPhone/iPad shell and UIKit-backed code editor.
- Persistent local workspace cache in Documents.
- Backend-driven task list, task detail, event polling, cancellation, retry/backoff, and safe error presentation.

Do not merge until all of these are true:

- `Config.xcconfig` is ignored and no keys appear in Git history or logs.
- Swift models decode real backend fixtures, including all agent event kinds and fractional timestamps.
- Polling has deterministic unit tests for success, duplicate events, retries, explicit stop, and all terminal task states.
- macOS/Xcode tests pass and the simulator checklist is recorded in the PR.

## Milestone 2 — make workspace selection real

The present "server workspace path" field is temporary and must stay explicitly labeled as an advanced server-side path. It is not a multi-user cloud workspace product.

Build the backend ownership layer before replacing it:

1. Define a durable, server-owned `workspace_id` with `owner_id`, lifecycle status, creation timestamps, and an internal-only server path.
2. Persist the model using reviewed migrations and enforce ownership in every workspace and task query.
3. Provision actual workspace storage without blocking filesystem calls in request handlers or hiding provisioning failures.
4. Change task creation to require an authorized `workspace_id`; validate ownership before queueing a task.
5. Build an iOS workspace picker backed by `GET /api/workspaces`, with empty, loading, error, and retry states.

Security requirements:

- Never send or return physical server paths to iOS.
- Never accept raw paths as workspace identifiers.
- Use opaque UUIDs and return 404 for missing or unauthorized workspaces.
- Keep production workspace records durable across restarts.
- Add backend tests for cross-user access, missing workspaces, invalid IDs, and task-creation authorization.

## Milestone 3 — workspace file synchronization contract

Do not parse markdown, model responses, or invented `file_edit` events in iOS. The server is the source of truth for task-owned workspace files.

The backend owner should propose and implement a reviewed contract with these minimum properties:

| Need | Contract requirement |
| --- | --- |
| Identity | Opaque `workspace_id`; authenticated ownership check on every request. |
| Paths | Normalized relative POSIX paths only, for example `src/index.html`. Reject absolute paths, `..`, backslashes, NUL bytes, symlink escapes, and empty segments. |
| Initial state | Snapshot endpoint with a monotonic workspace revision. |
| Incremental state | Changes endpoint using `after_revision`, with modified and deleted files. |
| Content | Separate bounded UTF-8 text file-content endpoint. Binary assets are out of scope for v1. |
| Writes | Optimistic concurrency using `base_revision` and/or `expected_checksum`; return `409 Conflict` with current metadata. |
| Integrity | SHA-256 checksum of exact UTF-8 bytes; audit source (`agent` or `user`) and timestamp. |
| Safety | Pagination, file-count limits, content-size limits, rate limits, and audit logs. |

iOS work starts only after the backend contract, authorization tests, and deployment are complete. The client will sync by revision, preserve unresolved user edits, and present conflicts for user review rather than overwriting content.

## Milestone 4 — safe web-app preview

Web preview is a later iOS feature, limited initially to HTML, CSS, and JavaScript projects.

Prerequisites:

- Milestone 3 file sync is deployed and verified.
- Preview reads the authoritative synchronized workspace, not a filename-only local cache.
- The preview feature has an explicit product-state label while experimental.

Implementation requirements:

- Use a non-persistent `WKWebsiteDataStore`.
- Serve only normalized workspace files through a custom `archon://local` scheme handler.
- Use a navigation delegate that denies every non-`archon://local` navigation and popup.
- Inject a restrictive Content Security Policy that blocks remote connections by default.
- Add a narrow JavaScript error bridge for `error` and `unhandledrejection`; it may report diagnostics but must not expose arbitrary native commands.
- Match files by canonical relative path, never basename alone.
- Add tests for traversal paths, duplicate basenames, missing assets, external navigation, unsupported content, and preview errors.

Acceptance test after security review:

1. A real agent task creates `index.html`, `style.css`, and `script.js` through the backend workspace contract.
2. iOS syncs the revisioned changes and renders a neon clock in preview.
3. Editing the clock’s color from iOS uses optimistic concurrency and reports a conflict rather than silently overwriting an agent change.
4. The workspace survives app restart and server task completion.

## Milestone 5 — production mobile product flow

After the core IDE is trustworthy, complete the user journey:

1. GitHub sign-in establishes identity only; copy must say it grants no repository access.
2. User selects or creates a server-provisioned workspace.
3. User selects an available model and a reasoning level.
4. User creates a task, sees its plan/progress/events, and can cancel it.
5. User reviews task results, files, diffs, verification, and genuine blockers.
6. User returns later and sees durable task/workspace history.

Reasoning levels must remain honest:

- **Low:** smaller task/credit budget.
- **Medium:** default balanced task/credit budget.
- **High:** higher task/credit budget, visibly explained before submission.

Provider policy:

- iOS never embeds or directly calls third-party provider keys.
- Until per-user encrypted BYOK storage exists server-side, show only server-configured models and say so.
- Future subscription/company-key use requires server-side quotas, audit logs, rate limits, abuse controls, and clear billing disclosures.

## Quality, security, and release gates

Every iOS feature PR must include:

- Focused branch and a single owner; no concurrent direct commits to the same branch.
- Unit tests for models, state machines, and network error behavior.
- No fake progress, simulated analysis, or hard-coded model capability claims in production UI.
- Secrets review: no keys in source, logs, screenshots, fixtures, or Git history.
- Accessibility review: VoiceOver labels, Dynamic Type, contrast, focus order, and 44pt targets.
- macOS verification notes: Xcode version, simulator/device, test command, and manual result.
- A rollback note for changes touching auth, persistence, workspace access, or task execution.

The iOS app is ready for broader beta only when:

- The macOS test suite passes.
- Authentication/session restore and sign-out work on a physical device.
- Authorized users cannot access another user’s task or workspace data.
- Workspace syncing and conflict handling have end-to-end tests.
- The preview cannot leave the local scheme or access remote network resources without an explicit future permission model.
- Production errors are observable to operators but safe and useful to users.

## Tomorrow's execution order

1. **Mac verification:** run the candidate iOS branch and capture the iPhone layout/auth/task results.
2. **Fix only verified failures:** keep patches scoped to the candidate branch.
3. **Merge stable iOS foundation:** after review and passing Xcode checks.
4. **Backend contract design review:** assign one backend owner for durable workspace provisioning and sync; do not reuse `feat/workspace-sync`.
5. **Workspace picker + task creation update:** build iOS against the reviewed opaque-ID API.
6. **Revisioned sync, then safe preview:** no client-invented event parsing.
7. **Website work resumes only after** the iOS foundation, workspace ownership contract, and mobile task workflow are stable.

## Ownership and communication

- **iOS integration owner:** one agent on the approved iOS branch.
- **Backend/runtime owner:** one agent for workspace provisioning, sync, task authorization, and migrations.
- **Release reviewer:** independently checks auth, cross-user access, tests, and production claims.
- **Website work:** paused except for urgent production fixes.

Each handoff must state the branch, commit, exact checks run, results, outstanding Mac-only verification, and any blocker. A plan, mock, or uncompiled code is never reported as a completed production capability.
