# Google Antigravity Workload — Archon IDE UX Quality

Copy everything below into a new Google Antigravity Project task. Run it in a
new isolated Git worktree.

---

You are the **product-quality and accessibility lead** for Archon IDE, a
browser-based autonomous coding environment.

Repository:

`https://github.com/Mattjhagen/archon-ide.git`

Production:

`https://app.relayapp.pro/`

## Mission

Make the first five minutes in Archon feel intentional, accessible, responsive,
and trustworthy on desktop and mobile.

Your outcome is not a visual redesign for its own sake. A new user must be able
to understand what Archon is, authenticate, complete setup, choose a model and
theme, reach the welcome screen, understand what actions are currently
available, and operate the interface with a keyboard or assistive technology.

Implement improvements, verify them in a browser, record evidence artifacts,
and continue until your workstream is complete or has a real external blocker.

## Parallel-work rules

Several agents are working in this repository.

- Claude owns server-side agent tasks, user isolation, workspace policy, task
  lifecycle, cancellation, budgets, and task APIs.
- OpenCode Big Pickle owns CI, release safety, smoke tests, security checks,
  and operational documentation.
- Codex owns product integrations, connector marketplace, context-import
  planning, public discovery, and final integration review.

You must work in a separate worktree and branch:

`antigravity/onboarding-a11y`

Never commit to `main`. Never force-push, reset, reformat unrelated code, or
discard another agent's changes. Fetch the latest `main` before starting and
again before opening a pull request.

## Exclusive file ownership

You may edit or add only these paths unless an owner explicitly hands off more:

- `frontend/src/components/Auth/**`
- `frontend/src/components/Setup/**`
- `frontend/src/components/Layout/WelcomeScreen.tsx`
- `frontend/src/components/Layout/WelcomeScreen.test.tsx`
- `frontend/src/components/Auth/**/*.test.tsx`
- `frontend/src/components/Setup/**/*.test.tsx`
- `frontend/src/styles/global.css` only in a clearly labeled onboarding and
  accessibility section at the end of the file
- `docs/ux/**`

Do not edit:

- `backend/**`
- `frontend/src/hooks/**`
- `frontend/src/lib/**`
- `frontend/src/App.tsx`
- `frontend/src/components/Settings/**`
- `.github/**`
- `fly.toml`, `Dockerfile`, lockfiles, or package versions

If another file must change for a correct fix, do not edit it. Record a small,
precise handoff note with the file, lines, desired API, and user impact.

## Product truth rules

The interface must not imply a capability that is absent.

In particular:

- Do not claim workspaces are isolated until the backend guarantees it.
- Do not present browser folder selection as a working cloud import when it
  cannot reach the server.
- Do not imply that GitHub authentication grants repository access.
- Do not promise a connector is linked merely because it is planned.
- Do not call mock responses real analysis.
- Do not hide security limitations behind attractive copy.

Prefer wording such as “coming next,” “requires a connected workspace,” or
“available after secure workspace provisioning” where appropriate.

## Required work

### 1. First-run journey audit

Inspect the actual code and production site. Build a concise journey map in:

`docs/ux/FIRST_RUN_AUDIT.md`

Audit these states:

1. signed out;
2. GitHub OAuth sign-in;
3. email magic-link sign-in;
4. setup step one / theme selection;
5. setup step two / provider selection;
6. no API key;
7. invalid or missing API key;
8. setup completion;
9. welcome screen with no project;
10. keyboard-only navigation;
11. 320 px wide mobile viewport;
12. 768 px tablet viewport;
13. 1440 px desktop viewport;
14. reduced-motion preference;
15. screen-reader landmark and label pass.

For each issue include severity, reproduction, user impact, and whether you
fixed it in your branch.

### 2. Authentication quality

Improve only real behavior that is visible in the Auth component:

- semantic landmarks, heading order, labels, and error announcements;
- keyboard focus sequence;
- disabled/loading states for GitHub OAuth and email submission;
- clear validation for an empty or invalid email;
- prevent duplicate submits;
- preserve user-entered email after an error;
- focus-visible styles that meet contrast expectations;
- clear explanation of what GitHub sign-in does and does not authorize;
- mobile layout without horizontal overflow;
- respects `prefers-reduced-motion`.

Use `aria-live` for asynchronous status and errors. Do not expose provider
error internals if they contain sensitive data.

### 3. Setup quality

Improve the setup flow so it communicates choice, consequences, and progress:

- the step indicator must be semantic and announce progress;
- every theme and provider selection must be keyboard operable;
- selected choices need visible focus plus non-color selection cues;
- API-key inputs require accessible labels and provider-specific placeholders;
- key visibility toggle must have an accessible name and state;
- clarify session-only key handling without making unsupported security claims;
- validate required keys before continuing;
- ensure a narrow viewport can scroll through all provider choices;
- no keyboard trap;
- reduced-motion friendly animations;
- preserve the existing premium visual character.

### 4. Welcome-screen quality

The no-project screen must make the actual next step clear:

- distinguish current working actions from upcoming cloud workspace features;
- explain in plain language why a project is required before editor shortcuts
  do anything;
- make the keyboard shortcut hints accurate and reachable by keyboard;
- ensure primary actions have explicit accessible labels;
- avoid a fake file-picker flow;
- provide a compact “What works today” and “What is being added” disclosure;
- do not add backend calls or invent workspace provisioning.

### 5. Visual resilience

Review owned screens for:

- 200% browser zoom;
- system font fallback;
- long provider/model labels;
- browser autofill styling;
- high contrast / forced colors where feasible;
- dark, luminous, and paper themes;
- invalid input styles;
- focus rings that are never clipped;
- overflow and scroll lock;
- safe-area padding on mobile.

Add narrowly scoped CSS at the end of `global.css`. Do not alter unrelated
editor or settings styles.

### 6. Tests

Add or extend frontend tests for owned behavior:

- email validation and email submit;
- OAuth and magic-link loading/disabled states;
- accessible status/error messages;
- setup theme and provider keyboard selection;
- setup missing-key prevention;
- accessible names for key controls;
- welcome actions and accurate shortcut hints;
- no duplicate submit while a request is active.

Use the existing testing framework and patterns. Do not add a new test library
unless it is already a dependency.

### 7. Browser verification and artifacts

Use Antigravity's browser or local browser verification to inspect the actual
flows at 320, 768, and 1440 px widths.

Capture artifacts that are safe to include in the pull request:

- before/after screenshots of the owned screens;
- keyboard navigation proof;
- accessible status/error proof;
- test output;
- a concise walkthrough note.

Never include API keys, OAuth callback parameters, session tokens, email
addresses, personal filesystem paths, or private repositories in artifacts.

## Accessibility acceptance criteria

The completed branch must satisfy:

- one visible `h1` for each major page/state;
- meaningful landmark structure;
- all interactive controls reachable and usable by keyboard;
- visible focus indicator with sufficient contrast;
- no color-only state indication;
- form errors and async updates announced;
- modals/components in owned files have intentional focus behavior;
- no horizontal scroll at 320 px for owned screens;
- normal motion is reduced when `prefers-reduced-motion: reduce` is set;
- all icon-only controls have names;
- text remains usable at 200% zoom;
- buttons never appear successful if the underlying action failed.

## Verification commands

Inspect package scripts first, then run applicable checks. At minimum attempt:

```text
cd frontend
npm run build
npm test
```

Run the exact TypeScript validation used by the repository. If local tooling is
missing, use the repository-supported runtime or document the exact blocker.

Do not claim a test passed unless it actually ran.

## Commit plan

Prefer small, reviewable commits:

1. `Audit first-run accessibility and responsive gaps`
2. `Improve authentication feedback and keyboard flow`
3. `Harden setup accessibility and mobile behavior`
4. `Clarify welcome screen actions and shortcut scope`
5. `Add first-run interaction tests and UX evidence`

## Progress protocol

Keep working autonomously. Do not stop after each observation.

Report progress when:

- the audit is complete;
- a real flow defect is reproduced;
- each commit is ready;
- tests identify an external blocker;
- browser verification is complete;
- your branch and PR are ready.

If you find a backend or shared-code issue, write a handoff note and continue
with the independent UX work.

## Final handoff

Return:

1. branch name;
2. pull-request URL;
3. commits;
4. exact files changed;
5. audit findings and what was fixed;
6. screenshots/artifacts;
7. test commands and exact results;
8. accessibility acceptance criteria status;
9. handoffs to Claude, OpenCode, or Codex;
10. known limitations.

Begin by creating the worktree and auditing the live first-run journey. Then
implement and verify improvements without waiting for another user prompt.

---
