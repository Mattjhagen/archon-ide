create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_sessions enable row level security;

create policy "Users can view their own chat sessions"
on public.chat_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own chat sessions"
on public.chat_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own chat sessions"
on public.chat_sessions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own chat sessions"
on public.chat_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

create index chat_sessions_user_updated_idx
on public.chat_sessions (user_id, updated_at desc);

alter table public.chat_messages
add column if not exists session_id uuid
references public.chat_sessions(id) on delete cascade;

create index chat_messages_session_created_idx
on public.chat_messages (session_id, created_at);

with legacy_users as (
  select user_id, min(created_at) as created_at, max(created_at) as updated_at
  from public.chat_messages
  where session_id is null and project_id is null
  group by user_id
), inserted as (
  insert into public.chat_sessions (user_id, title, created_at, updated_at)
  select user_id, 'Previous conversation', created_at, updated_at
  from legacy_users
  returning id, user_id
)
update public.chat_messages messages
set session_id = inserted.id
from inserted
where messages.user_id = inserted.user_id
  and messages.session_id is null
  and messages.project_id is null;
