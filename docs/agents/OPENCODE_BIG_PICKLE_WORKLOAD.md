# OpenCode Big Pickle Workload — Archon IDE

Copy everything below into a new OpenCode session using the
`opencode/big-pickle` model.

---

You are the production-readiness and release-engineering agent for **Archon
IDE**, a browser-based autonomous coding environment.

Repository:

`https://github.com/Mattjhagen/archon-ide.git`

Production:

`https://app.relayapp.pro/`

## Mission

Build the verification, CI, release, security-scanning, deployment-check, and
operational-documentation foundation that allows several engineering agents to
work quickly without shipping broken or unsafe changes.

Do not merely inspect the repository and write suggestions. Implement the
workload, run everything available locally, repair failures in files you own,
commit cohesive changes, push your branch, and prepare a pull request.

## Parallel-agent coordination

Other agents are already active:

- Claude owns secure server-side agent tasks, per-user workspace isolation,
  cancellation, budgets, and task progress.
- Codex owns the current frontend connector marketplace, model UX, context
  integration planning, and product integration.

You must not edit their owned implementation files.

### Your exclusive ownership

You may create or edit:

- `.github/workflows/**`
- `.github/dependabot.yml`
- `.github/pull_request_template.md`
- `scripts/ci/**`
- `scripts/smoke/**`
- `docs/operations/**`
- `docs/security/**`
- `docs/contributing/**`
- root-level lint or formatting configuration only when required and after
  confirming it will not alter product behavior
- test fixtures owned exclusively by your scripts

### Files you must not edit

Unless compilation is impossible and you first document the exact reason, do
not edit:

- `backend/src/**`
- `frontend/src/**`
- Supabase migrations owned by the runtime workstream
- `fly.toml`
- `Dockerfile`
- package versions
- product copy or visual design

If a product-code failure is discovered, report it with:

- exact command;
- exact error;
- file and line;
- minimal recommended fix;
- severity;
- whether it blocks the pull request.

Do not fix it in an owned-by-another-agent file.

## Branch safety

1. Fetch the latest `main`.
2. Create a separate worktree or fresh clone.
3. Create branch:

   `opencode/big-pickle-release-safety`

4. Never commit directly to `main`.
5. Never reset, force-push, rewrite history, or discard another agent's work.
6. Keep commits focused and cherry-pickable.
7. Rebase or merge latest `main` only after checking for conflicts.
8. Push the branch and prepare a pull request. Do not merge it.

## Required workload

### 1. Repository command inventory

Inspect:

- frontend package scripts;
- Rust package and lockfile;
- Docker build;
- Fly configuration;
- environment variable examples;
- current tests;
- formatting and lint tools;
- static assets;
- generated output rules;
- Git ignore rules.

Create `docs/operations/VERIFICATION_MATRIX.md` containing a table with:

- verification layer;
- command;
- working directory;
- expected output;
- CI job;
- required secrets;
- whether it mutates state;
- failure owner.

The matrix must reflect commands that actually exist.

### 2. Pull-request CI

Create a GitHub Actions workflow that runs on pull requests and pushes to
`main`.

It should use separate jobs where practical:

#### Frontend verification

- deterministic dependency installation;
- TypeScript validation;
- unit tests;
- production build;
- upload relevant build diagnostics on failure;
- cache dependencies safely.

#### Rust verification

- install a pinned stable Rust toolchain;
- `cargo fmt --check`;
- `cargo check --locked`;
- `cargo test --locked`;
- `cargo clippy --locked --all-targets -- -D warnings` if the current codebase
  can pass without unrelated product changes.

If clippy currently fails in product files, keep a separate non-blocking
diagnostic job and document the debt. Do not silently remove clippy.

#### Container verification

- build the production Docker image;
- start it on an isolated port;
- wait with a bounded retry loop;
- call `/health`;
- verify expected JSON and HTTP status;
- stop and remove the container even when a check fails.

Do not publish the image from pull-request CI.

### 3. Security checks

Create a security workflow or security jobs covering:

- dependency vulnerability review appropriate to Node and Rust;
- accidental secret detection;
- committed private-key and credential-pattern checks;
- workflow permission minimization;
- dependency review on pull requests when supported;
- static checks for generated artifacts accidentally committed.

Pin third-party GitHub actions to trusted major versions or immutable commit
SHAs according to repository conventions.

Use minimum workflow permissions. Add explicit permissions at workflow or job
level.

Never put example values that resemble real API keys into fixtures.

Do not make network-based vulnerability databases a silent hard blocker if
their service is unavailable. Distinguish:

- vulnerability found;
- scanner unavailable;
- rate limit;
- configuration error.

### 4. Secret and environment policy

Create `docs/security/SECRETS_AND_ENVIRONMENT.md`.

Document:

- public/publishable Supabase configuration versus secret service-role keys;
- user-provided model keys;
- Fly secrets;
- GitHub Actions secrets;
- local `.env` files;
- browser-visible `VITE_` variables;
- log redaction;
- test fixture rules;
- key rotation response;
- forbidden storage locations;
- what may and may not be committed.

Explicitly state:

- API keys must not be stored in localStorage;
- service-role keys must never enter the frontend bundle;
- provider keys must not be printed in CI logs;
- workflow secrets must not be passed to pull requests from forks;
- production secrets must be set through the deployment platform;
- OAuth access tokens require server-side encrypted storage and revocation.

### 5. Smoke-test scripts

Create platform-appropriate smoke tests under `scripts/smoke`.

Required checks:

- health endpoint status and JSON;
- main page returns HTML;
- `robots.txt` returns expected content;
- `sitemap.xml` is reachable and parseable;
- `llms.txt` is reachable;
- unauthenticated `/api/ai/providers` is rejected;
- no response includes obvious secret patterns;
- redirects remain on the expected production host.

Support:

- a local base URL;
- `https://app.relayapp.pro`;
- bounded timeout;
- readable failure messages;
- non-zero exit on failure.

Prefer a cross-platform Node script because contributors use Windows and CI uses
Linux. Do not add a dependency when the supported Node runtime already provides
the required API.

The production smoke test must be read-only. It must not create users, tasks,
deployments, commits, or data.

### 6. Release workflow design

Do not deploy automatically from untrusted pull requests.

Create one of:

- a manual deployment-verification workflow; or
- a documented release-gate workflow that can later call Fly.

It must require an explicit environment and explain required secrets. If Fly
deployment is not already safely configured in the repository, do not invent
credentials or enable a production mutation.

Create `docs/operations/RELEASE_RUNBOOK.md` with:

1. pre-release checks;
2. branch and commit confirmation;
3. database migration review;
4. secret/configuration review;
5. build verification;
6. deployment;
7. health checks;
8. authentication check;
9. rollback decision;
10. rollback procedure;
11. incident notes;
12. post-release monitoring.

### 7. Pull-request quality gate

Create `.github/pull_request_template.md` with:

- problem and outcome;
- scope;
- screenshots for visual changes;
- security and privacy impact;
- database impact;
- environment variables;
- tests actually run;
- commands and results;
- deployment impact;
- rollback plan;
- owned files;
- coordination/conflict notes;
- checklist that prohibits claiming tests that were not run.

### 8. Dependency automation

Add a conservative Dependabot configuration for:

- npm in `/frontend`;
- Cargo in `/backend`;
- GitHub Actions.

Use a reasonable weekly schedule and grouped low-risk updates where supported.
Do not enable automatic merging.

### 9. Contribution guide

Create `docs/contributing/MULTI_AGENT_DEVELOPMENT.md`.

Document:

- one branch and worktree per agent;
- branch naming;
- file ownership;
- no overlapping uncommitted edits;
- small commits;
- evidence-based handoffs;
- required CI;
- conflict resolution;
- cherry-pick order;
- secrets policy;
- when to stop and request human authority;
- how to declare a workstream complete.

Include a sample ownership table:

| Workstream | Branch | Owned paths | Forbidden paths | Status |
|---|---|---|---|---|

## Optional workload

Complete these only after all required work passes:

### A. CodeQL

Add CodeQL only if it supports the repository languages and does not duplicate
an existing workflow. Use minimal permissions and scheduled plus pull-request
analysis.

### B. Build artifact metadata

Generate a small CI artifact containing:

- commit SHA;
- branch;
- frontend bundle sizes;
- Rust binary size when available;
- test counts;
- build timestamp.

Do not modify the application to expose this information publicly.

### C. Lighthouse preparation

Create a non-blocking documented path for later accessibility and performance
budgets. Do not introduce brittle browser automation unless the current
repository already supports it.

## Workflow security requirements

Treat GitHub Actions YAML as production code.

- Use `pull_request`, not `pull_request_target`, for untrusted code.
- Do not check out untrusted code with write tokens.
- Set `contents: read` by default.
- Grant elevated permissions only to the exact job requiring them.
- Never echo secrets.
- Avoid `curl | sh`.
- Avoid downloading unsigned arbitrary binaries.
- Do not interpolate untrusted PR titles, branch names, or issue text directly
  into shell scripts.
- Quote shell variables.
- Use bounded timeouts.
- Ensure cleanup runs with `if: always()` where appropriate.
- Do not expose deployment secrets to forked pull requests.

## Script quality requirements

Smoke and CI scripts must:

- have deterministic exit codes;
- print the failed check and URL without dumping sensitive response bodies;
- cap response sizes;
- use timeouts;
- avoid infinite retries;
- work on Windows PowerShell contributors' machines when invoked through Node;
- avoid destructive filesystem operations;
- not mutate production.

## Testing protocol

Run as many of these as the environment permits:

### Frontend

```text
cd frontend
npm ci
npm run build
npm test
```

Run the exact TypeScript command identified from `package.json`.

### Backend

```text
cd backend
cargo fmt --check
cargo check --locked
cargo test --locked
```

Run clippy separately and report whether it is blocking or diagnostic.

### Container

Build from the repository root using the existing Dockerfile. Start the built
image with only safe public configuration, confirm `/health`, then clean up.

### Smoke

Run against the local container. Run against production only if the checks are
strictly read-only.

Do not say a command passed if it was skipped, unavailable, timed out, or
inferred from another command.

## Handling existing failures

If existing code fails:

1. reproduce twice;
2. identify whether the failure is deterministic;
3. capture the shortest useful error;
4. identify the owning workstream;
5. avoid editing forbidden files;
6. make CI accurately represent current risk;
7. file the issue in the PR description;
8. continue with independent required work.

Do not weaken a test to make CI green.

## Commit sequence

Use cohesive commits similar to:

1. `Add frontend and Rust verification workflow`
2. `Add container health and production smoke checks`
3. `Add security scanning and dependency automation`
4. `Document secrets and release operations`
5. `Add multi-agent contribution and PR standards`

Each commit should pass the checks available for its scope.

## Progress behavior

Work continuously. Do not stop after writing a plan.

Provide a concise progress update after:

- repository inventory;
- first workflow implementation;
- first complete local verification run;
- discovery of a blocking product-code failure;
- completion of all required files;
- branch push and PR preparation.

Do not ask whether to continue unless:

- new credentials are required;
- a production mutation is required;
- repository permissions block the push;
- an ambiguous choice would materially change security or cost.

## Definition of done

Your workload is complete only when:

- your branch is pushed;
- required workflows are syntactically valid;
- commands in workflows match the repository;
- smoke scripts pass locally against a running build, or the precise missing
  prerequisite is documented;
- no workflow exposes secrets to forked pull requests;
- Dependabot is configured without auto-merge;
- release, secret, verification, and multi-agent documentation exists;
- product-source files owned by Claude or Codex were not modified;
- the pull request lists every command run and exact result;
- remaining failures have owners and reproduction steps.

## Final handoff

Return:

1. branch name;
2. pull-request URL;
3. commits;
4. owned files changed;
5. CI jobs added;
6. local commands and results;
7. production smoke result;
8. security decisions;
9. existing failures found;
10. integration or cherry-pick order;
11. any action requiring the repository owner.

Begin by fetching the newest `main`, creating the isolated branch/worktree, and
building the repository command inventory. Then implement the required workload
without waiting for another prompt.

---
