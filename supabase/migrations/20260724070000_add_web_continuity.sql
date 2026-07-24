alter table public.user_preferences
drop constraint if exists user_preferences_appearance_check;

alter table public.user_preferences
add constraint user_preferences_appearance_check
check (appearance in ('obsidian', 'luminous', 'paper', 'glass'));

alter table public.user_preferences
add column if not exists preferred_model text not null default 'gpt-5.6-terra',
add column if not exists reasoning_effort text not null default 'medium'
  check (reasoning_effort in ('low', 'medium', 'high')),
add column if not exists last_project_path text,
add column if not exists profile_avatar_url text,
add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.chat_sessions
add column if not exists project_id uuid references public.projects(id) on delete set null,
add column if not exists project_path text;

create index if not exists chat_sessions_project_updated_idx
on public.chat_sessions (project_id, updated_at desc)
where project_id is not null;

alter table public.projects
add column if not exists web_path text;

create index if not exists projects_user_web_path_idx
on public.projects (user_id, web_path)
where web_path is not null;

create or replace function public.delete_current_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_current_user() from public;
revoke all on function public.delete_current_user() from anon;
grant execute on function public.delete_current_user() to authenticated;
