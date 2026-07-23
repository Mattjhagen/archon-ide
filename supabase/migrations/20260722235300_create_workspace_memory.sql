-- ============================================================
-- Workspace context memory — durable storage layer.
--
-- Production path for the in-memory MemoryStore in
-- backend/src/agent/memory.rs.
--
-- Security model:
--   • Memory entries are readable only by users who own at least
--     one task in the workspace (via task ownership chain).
--   • Content is bounded at the application layer (500 chars/entry,
--     50 entries/workspace).
--   • API keys are NEVER stored here.
-- ============================================================

create table public.workspace_memory (
  id                uuid        primary key default gen_random_uuid(),
  workspace_path    text        not null,
  -- The user who owns this memory entry (via the originating task)
  user_id           uuid        not null references auth.users(id) on delete cascade,
  -- The task that produced this entry
  task_id           uuid        references public.agent_tasks(id) on delete set null,

  kind              text        not null check (kind in ('task_summary', 'file_changed', 'observation')),
  -- Bounded at 500 chars by the application layer
  content           text        not null check (char_length(content) <= 500),
  created_at        timestamptz not null default now()
);

create index workspace_memory_user_path_idx
  on public.workspace_memory(user_id, workspace_path, created_at desc);

alter table public.workspace_memory enable row level security;

-- Owners can read their own memory
create policy "memory owners can read"
  on public.workspace_memory for select to authenticated
  using ((select auth.uid()) = user_id);

-- Owners can insert their own memory (application uses service role in practice)
create policy "memory owners can create"
  on public.workspace_memory for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No authenticated update or delete — entries are append-only from the app layer
-- Clearing is done via a service-role delete in the backend.
grant select, insert on public.workspace_memory to authenticated;
revoke update, delete on public.workspace_memory from authenticated;
revoke all on public.workspace_memory from anon;

-- ─── Migration notes ─────────────────────────────────────────────────────────
--
-- To switch backend/src/agent/memory.rs from in-memory to Supabase:
--
-- 1. Replace MemoryStore's in-memory HashMap with postgrest-rs queries.
-- 2. INSERT entries using service-role credentials (same as agent_events).
-- 3. SELECT for context: ORDER BY created_at DESC LIMIT 10.
-- 4. DELETE for clear: WHERE user_id=$uid AND workspace_path=$path
--    (service-role; bypasses the no-delete RLS above).
-- 5. Keep the 500-char content cap at the application layer; the
--    database constraint is defence-in-depth.
