-- ============================================================
-- Agent task runtime — durable storage layer.
--
-- Production path for the in-memory TaskStore in
-- backend/src/agent/repository.rs.  Apply with:
--
--   supabase db push                  (local dev)
--   supabase migration up             (remote)
--
-- Security model:
--   • Row-level security enforces per-user ownership on every table.
--   • api_keys are NEVER stored here.  The application layer holds
--     them in memory only for the duration of the background task.
--   • event metadata is bounded by the application layer before insert.
--   • service-role credentials must never be exposed to the frontend.
-- ============================================================

create extension if not exists pgcrypto;

-- ─── agent_tasks ─────────────────────────────────────────────────────────────

create table public.agent_tasks (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  workspace_id        uuid        references public.workspaces(id) on delete set null,

  title               text        not null check (char_length(title) between 1 and 200),
  request             text        not null check (char_length(request) between 1 and 10000),
  provider            text        not null,
  model               text        not null,
  reasoning_effort    text        not null default 'medium'
                                  check (reasoning_effort in ('low', 'medium', 'high')),

  -- Lifecycle state machine
  status              text        not null default 'queued'
                                  check (status in (
                                    'queued', 'planning', 'running', 'verifying',
                                    'completed', 'blocked', 'failed',
                                    'cancelling', 'cancelled'
                                  )),

  -- Budget tracking
  current_step        integer     not null default 0,
  max_steps           integer     not null,
  credits_used        bigint      not null default 0,
  credit_limit        bigint      not null,

  -- Timestamps
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz,

  -- Error information (safe to surface to the owning user)
  error_code          text,
  error_message       text,
  cancel_requested_at timestamptz,

  -- Workspace path used for WorkspacePolicy validation.
  -- Not sensitive but must match what the runner uses.
  workspace_path      text        not null
);

create index agent_tasks_user_id_idx  on public.agent_tasks(user_id);
create index agent_tasks_status_idx   on public.agent_tasks(status);
create index agent_tasks_created_idx  on public.agent_tasks(created_at desc);

alter table public.agent_tasks enable row level security;

create policy "task owners can read"
  on public.agent_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "task owners can create"
  on public.agent_tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "task owners can update"
  on public.agent_tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Deletion is intentionally not granted to authenticated users via RLS;
-- tasks may be hard-deleted only by service-role (e.g. workspace cleanup).

grant select, insert, update on public.agent_tasks to authenticated;
revoke all on public.agent_tasks from anon;

-- ─── agent_events ────────────────────────────────────────────────────────────

create table public.agent_events (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.agent_tasks(id) on delete cascade,
  sequence    bigint      not null,
  kind        text        not null check (kind in (
                'task_created', 'status_changed', 'model_request', 'model_response',
                'tool_call', 'tool_result', 'verification_started', 'verification_result',
                'error', 'cancel_requested', 'completed'
              )),
  summary     text        not null check (char_length(summary) <= 500),
  -- Bounded JSON blob.  Application layer must not store raw API keys,
  -- full file content, or other sensitive data here.
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index agent_events_task_id_seq_idx on public.agent_events(task_id, sequence asc);

alter table public.agent_events enable row level security;

-- Events inherit ownership from their task via a subquery join.
-- This avoids a foreign-key RLS join that could be slow at scale;
-- the alternative is a task_user_id denormalized column.
create policy "task owners can read events"
  on public.agent_events for select to authenticated
  using (
    exists (
      select 1 from public.agent_tasks t
       where t.id = task_id
         and t.user_id = (select auth.uid())
    )
  );

-- Events are written by the backend service role only; authenticated
-- users may not insert or update them directly.
grant select on public.agent_events to authenticated;
revoke insert, update, delete on public.agent_events from authenticated;
revoke all on public.agent_events from anon;

-- ─── updated_at trigger ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agent_tasks_set_updated_at
  before update on public.agent_tasks
  for each row execute function public.set_updated_at();

-- ─── Migration notes ─────────────────────────────────────────────────────────
--
-- To switch backend/src/agent/repository.rs from InMemoryTaskStore to
-- Supabase/Postgres:
--
-- 1. Add `sqlx` or `postgrest-rs` to Cargo.toml.
-- 2. Implement a `SupabaseTaskStore` struct satisfying the same method
--    signatures as `TaskStore`.
-- 3. Replace `AppState.agent_tasks: Arc<TaskStore>` with the new type.
-- 4. Read task rows with `SELECT * FROM agent_tasks WHERE id=$1 AND user_id=$2`.
-- 5. The RLS policies above are the enforcement layer; still verify
--    user_id server-side as a defence-in-depth measure.
-- 6. Event inserts must use the service role key, never the publishable key.
-- 7. Cancel flag: use a `pg_notify` channel instead of AtomicBool,
--    or poll the cancel_requested_at column in the runner loop.
-- 8. Restart persistence: the runner must re-hydrate from agent_events
--    on startup or after a crash to resume in-progress tasks.
--
-- Until the migration is complete, the in-memory store is the source of
-- truth.  Tasks are lost on server restart.  This is documented as a
-- known limitation in the PR.
