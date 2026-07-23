create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  repository_url text,
  default_branch text not null default 'main',
  region text not null default 'ord',
  status text not null default 'pending' check (status in ('pending','provisioning','running','stopped','error','deleting')),
  machine_id text,
  volume_id text,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces(owner_id);
create index workspaces_status_idx on public.workspaces(status);

alter table public.workspaces enable row level security;

create policy "workspace owners can read" on public.workspaces for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "workspace owners can create" on public.workspaces for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "workspace owners can update" on public.workspaces for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "workspace owners can delete" on public.workspaces for delete to authenticated
using ((select auth.uid()) = owner_id);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance text not null default 'obsidian' check (appearance in ('obsidian','luminous','paper')),
  preferred_provider text not null default 'mock',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "users can read their preferences" on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy "users can create their preferences" on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "users can update their preferences" on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
revoke all on public.workspaces from anon;
revoke all on public.user_preferences from anon;
