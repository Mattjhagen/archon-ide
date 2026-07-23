# Conversation Context Import Contract

## Purpose

Archon lets a user bring selected conversation history from another AI product
into a specific coding task. Imported material is optional reference context,
not an instruction source with elevated authority.

The browser-side importer currently parses an export locally for preview only.
It does not upload, persist, or attach the export to a model request until the
authenticated task-context API described here exists.

## Privacy and trust boundaries

1. An import belongs to one authenticated user and one task.
2. The client must never persist raw import content in `localStorage`, URLs,
   analytics, logs, browser error reports, or task titles.
3. The client uploads only after the user chooses **Attach to task**.
4. The API stores encrypted-at-rest source material only when durable task
   context is explicitly enabled. A privacy-preserving implementation may store
   a normalized summary plus user-approved excerpts instead.
5. Users can inspect, remove, and delete each import independently of the task.
6. Providers never receive source content until that task invokes the model.
7. Imports are treated as untrusted data. Text inside an import cannot alter
   tool policy, user identity, credit limits, model choice, or system rules.
8. Raw uploaded data and derived excerpts must obey user ownership checks on
   every read, update, delete, and task execution path.

## Supported inputs

The initial client parser accepts:

- ChatGPT-style JSON exports with a conversation mapping;
- generic JSON arrays of messages;
- Claude or Gemini exports that expose readable message/content fields;
- Markdown;
- plain UTF-8 text.

It does not execute scripts, render HTML, follow links, extract attachments, or
parse archives. The current local review limit is 1.5 MB per file and 120,000
normalized characters per draft. The backend must enforce independent limits.

## Proposed API

All routes are inside the existing authenticated `/api` scope. The backend
derives `user_id` from the validated session and never accepts it in a request
body.

### Create an import

`POST /api/agent/tasks/{task_id}/context-imports`

Request:

```json
{
  "source": "chatgpt",
  "title": "OAuth debugging notes",
  "messages": [
    {"role": "user", "content": "The callback loops after login."},
    {"role": "assistant", "content": "Check the redirect allow list."}
  ],
  "consent": {
    "attach_to_task": true,
    "retain_until": "task_completion"
  }
}
```

Response:

```json
{
  "id": "ctx_...",
  "task_id": "task_...",
  "source": "chatgpt",
  "title": "OAuth debugging notes",
  "status": "ready",
  "message_count": 2,
  "character_count": 78,
  "created_at": "2026-07-22T00:00:00Z"
}
```

### List task imports

`GET /api/agent/tasks/{task_id}/context-imports`

Returns metadata and a redacted preview by default. Raw content requires the
task owner and a deliberate `include=content` request, subject to the product's
retention policy.

### Delete an import

`DELETE /api/agent/tasks/{task_id}/context-imports/{context_import_id}`

Deletion must remove raw material and derived excerpts that are not already
captured in immutable audit records. Audit records must contain no raw content.

## Storage shape

Suggested durable fields:

| Field | Notes |
|---|---|
| `id` | opaque UUID or prefixed ID |
| `task_id` | foreign key to owned task |
| `user_id` | authorization index; never client supplied |
| `source` | normalized source enum |
| `title` | bounded, plain text |
| `content_ciphertext` | optional encrypted raw content |
| `content_summary` | bounded model-neutral summary or user-approved excerpt |
| `message_count` | bounded integer |
| `character_count` | bounded integer |
| `retention_policy` | session, task completion, or explicit user retention |
| `created_at`, `deleted_at` | audit metadata only |

## Context assembly rules

At task execution time:

1. Load only imports authorized for the current task and user.
2. Prefer a task-specific summary and selected excerpts over raw history.
3. Enforce a source-specific and provider-specific character/token budget.
4. Label all imported text as untrusted reference material.
5. Never merge an import into system instructions.
6. Record an event that context was used without recording raw content.
7. Make it visible in the task timeline which import influenced the task.

## Required tests

- A user cannot list, read, attach, or delete another user's import.
- A task cannot attach an import owned by another task or workspace.
- Oversized payloads fail before storage.
- Unsupported role/content shapes are rejected or normalized safely.
- HTML/script-like content is treated as plain text.
- API logs and error messages do not contain raw imported content.
- Deletion removes accessible content and future model context.
- Cancellation and task completion respect the selected retention policy.

## Handoff

Claude's task-runtime workstream should implement the authenticated routes,
storage, ownership checks, lifecycle hooks, and task timeline events. Codex can
then replace the local-only review action with explicit attach, inspect, and
delete controls.
