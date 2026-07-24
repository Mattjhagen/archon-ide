create table public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    project_id uuid null references public.projects(id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null check (char_length(content) between 1 and 100000),
    provider text null check (provider is null or char_length(provider) <= 100),
    model text null check (model is null or char_length(model) <= 200),
    created_at timestamptz not null default now()
);

create index chat_messages_user_created_at_idx
    on public.chat_messages (user_id, created_at desc);

create index chat_messages_project_created_at_idx
    on public.chat_messages (project_id, created_at desc)
    where project_id is not null;

alter table public.chat_messages enable row level security;

create policy "Users can view their own chat messages"
on public.chat_messages
for select
to authenticated
using (
    (select auth.uid()) = user_id
    and (
        project_id is null
        or exists (
            select 1
            from public.projects
            where projects.id = chat_messages.project_id
              and projects.user_id = (select auth.uid())
        )
    )
);

create policy "Users can create their own chat messages"
on public.chat_messages
for insert
to authenticated
with check (
    (select auth.uid()) = user_id
    and (
        project_id is null
        or exists (
            select 1
            from public.projects
            where projects.id = chat_messages.project_id
              and projects.user_id = (select auth.uid())
        )
    )
);

create policy "Users can delete their own chat messages"
on public.chat_messages
for delete
to authenticated
using (
    (select auth.uid()) = user_id
    and (
        project_id is null
        or exists (
            select 1
            from public.projects
            where projects.id = chat_messages.project_id
              and projects.user_id = (select auth.uid())
        )
    )
);

revoke all on table public.chat_messages from anon;
revoke all on table public.chat_messages from public;
grant select, insert, delete on table public.chat_messages to authenticated;
