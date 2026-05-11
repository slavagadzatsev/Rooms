-- Rooms Supabase schema draft
-- Apply this later in Supabase SQL editor after the project is created.

create extension if not exists "pgcrypto";

-- Public Storage buckets used by the app.
-- Public means files can be rendered by clients; uploads are still protected by policies below.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('room-images', 'room-images', true),
  ('message-attachments', 'message-attachments', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read rumo storage" on storage.objects;
create policy "public read rumo storage" on storage.objects
  for select using (bucket_id in ('avatars', 'room-images', 'message-attachments'));

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "authenticated upload room images" on storage.objects;
create policy "authenticated upload room images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "authenticated upload message attachments" on storage.objects;
create policy "authenticated upload message attachments" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'message-attachments'
  );

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  bio text default '',
  location text default '',
  avatar_url text,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  color text default '#6B5CE7',
  focus_tags text[] not null default '{}',
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

delete from public.profile_interests interest
using (
  select id, row_number() over (
    partition by user_id, lower(name)
    order by created_at asc, id asc
  ) as duplicate_rank
  from public.profile_interests
) duplicates
where interest.id = duplicates.id
and duplicates.duplicate_rank > 1;

create unique index if not exists profile_interests_user_name_unique
  on public.profile_interests (user_id, lower(name));

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  icon text,
  image_url text,
  icon_bg text default '#ede9ff',
  card_bg text,
  type text not null check (type in ('project', 'networking', 'learning')),
  privacy text not null default 'public' check (privacy in ('public', 'invite', 'private')),
  language text not null default 'English',
  max_members int not null check (max_members between 3 and 15),
  lifetime_days int not null check (lifetime_days in (7, 14, 30)),
  expires_at timestamptz not null,
  pulse_goal int not null default 1,
  pulse_count int not null default 0,
  alive_streak int not null default 0,
  checkin_enabled boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_tags (
  room_id uuid not null references public.rooms(id) on delete cascade,
  tag text not null,
  primary key (room_id, tag)
);

create table if not exists public.room_roles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  color text default '#7C5CFC',
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

alter table public.room_roles
  add column if not exists color text default '#7C5CFC';

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Member',
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  reply_to uuid references public.messages(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image', 'file', 'link')),
  storage_path text,
  url text,
  label text default '',
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

alter table public.message_attachments
  add column if not exists width integer;

alter table public.message_attachments
  add column if not exists height integer;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  dedupe_key text,
  title text not null,
  body text default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  messages boolean not null default true,
  mentions boolean not null default true,
  invites boolean not null default true,
  room_activity boolean not null default true,
  room_expiry boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  target_type text not null check (target_type in ('room', 'user', 'message')),
  content_id text,
  target_id text,
  target_name text default '',
  reason text not null,
  details text default '',
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'action_taken', 'dismissed')),
  priority text not null default 'low' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  action_note text
);

alter table public.profiles add column if not exists banned boolean not null default false;
alter table public.rooms add column if not exists hidden boolean not null default false;
alter table public.rooms add column if not exists card_bg text;
alter table public.messages add column if not exists hidden boolean not null default false;
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_user_dedupe_key_unique
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;
alter table public.reports add column if not exists content_id text;
alter table public.reports add column if not exists priority text not null default 'low';
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists action_note text;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'reviewed', 'action_taken', 'dismissed'));
alter table public.reports drop constraint if exists reports_priority_check;
alter table public.reports add constraint reports_priority_check
  check (priority in ('low', 'medium', 'high'));

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text default 'user_requested',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.profile_interests enable row level security;
alter table public.rooms enable row level security;
alter table public.room_tags enable row level security;
alter table public.room_roles enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reports enable row level security;
alter table public.account_deletion_requests enable row level security;

-- Realtime: required for live chat, reactions, attachments and room/member updates.
do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'rooms',
    'room_members',
    'room_roles',
    'room_tags',
    'messages',
    'message_attachments',
    'message_reactions',
    'notifications'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array realtime_tables loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "interests are readable" on public.profile_interests;
create policy "interests are readable" on public.profile_interests
  for select using (true);

drop policy if exists "users manage own interests" on public.profile_interests;
create policy "users manage own interests" on public.profile_interests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper: check membership without triggering rooms RLS (breaks recursion)
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id and status = 'active');
$$;

-- Helper: check room exists without triggering room_members RLS (breaks recursion)
create or replace function public.room_exists(p_room_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.rooms where id = p_room_id);
$$;

drop policy if exists "public rooms are readable" on public.rooms;
create policy "public rooms are readable" on public.rooms
  for select using (
    hidden = false
    and (
      privacy = 'public'
      or created_by = auth.uid()
      or public.is_room_member(id, auth.uid())
      or exists (
        select 1
        from public.notifications
        where notifications.room_id = rooms.id
          and notifications.user_id = auth.uid()
          and notifications.event_type = 'invite'
      )
    )
  );

drop policy if exists "users create rooms" on public.rooms;
create policy "users create rooms" on public.rooms
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.banned = false
    )
  );

drop policy if exists "creators update rooms" on public.rooms;
create policy "creators update rooms" on public.rooms
  for update using (auth.uid() = created_by);

drop policy if exists "room metadata readable with room" on public.room_tags;
create policy "room metadata readable with room" on public.room_tags
  for select using (exists (select 1 from public.rooms where rooms.id = room_tags.room_id));

drop policy if exists "creators manage tags" on public.room_tags;
create policy "creators manage tags" on public.room_tags
  for all using (
    exists (select 1 from public.rooms where rooms.id = room_tags.room_id and rooms.created_by = auth.uid())
  );

drop policy if exists "roles readable with room" on public.room_roles;
create policy "roles readable with room" on public.room_roles
  for select using (exists (select 1 from public.rooms where rooms.id = room_roles.room_id));

drop policy if exists "creators manage roles" on public.room_roles;
create policy "creators manage roles" on public.room_roles
  for all using (
    exists (select 1 from public.rooms where rooms.id = room_roles.room_id and rooms.created_by = auth.uid())
  );

drop policy if exists "members readable with room" on public.room_members;
create policy "members readable with room" on public.room_members
  for select using (public.room_exists(room_id));

drop policy if exists "users join as themselves" on public.room_members;
create policy "users join as themselves" on public.room_members
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.banned = false
    )
  );

drop policy if exists "creators invite room members" on public.room_members;
create policy "creators invite room members" on public.room_members
  for insert with check (
    exists (
      select 1
      from public.rooms
      where rooms.id = room_members.room_id
        and rooms.created_by = auth.uid()
        and rooms.hidden = false
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = room_members.user_id
      and profiles.banned = false
    )
  );

drop policy if exists "users update own membership" on public.room_members;
create policy "users update own membership" on public.room_members
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      status = 'left'
      or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.banned = false
      )
    )
  );

drop policy if exists "messages readable by room members" on public.messages;
create policy "messages readable by room members" on public.messages
  for select using (
    hidden = false
    and (
      public.is_room_member(room_id, auth.uid())
      or exists (
        select 1
        from public.rooms
        where rooms.id = messages.room_id
          and rooms.hidden = false
          and rooms.privacy = 'public'
      )
    )
  );

drop policy if exists "creators update invited memberships" on public.room_members;
create policy "creators update invited memberships" on public.room_members
  for update using (
    exists (
      select 1
      from public.rooms
      where rooms.id = room_members.room_id
        and rooms.created_by = auth.uid()
        and rooms.hidden = false
    )
  )
  with check (
    exists (
      select 1
      from public.rooms
      where rooms.id = room_members.room_id
        and rooms.created_by = auth.uid()
        and rooms.hidden = false
    )
  );

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.profiles where id = auth.uid() and banned = false)
    and public.is_room_member(room_id, auth.uid())
  );

drop policy if exists "users soft delete own messages" on public.messages;
create policy "users soft delete own messages" on public.messages
  for update using (auth.uid() = sender_id);

drop policy if exists "attachments readable by room members" on public.message_attachments;
create policy "attachments readable by room members" on public.message_attachments
  for select using (
    public.is_room_member(room_id, auth.uid())
    or exists (
      select 1
      from public.rooms
      where rooms.id = message_attachments.room_id
        and rooms.hidden = false
        and rooms.privacy = 'public'
    )
  );

drop policy if exists "members create own attachments" on public.message_attachments;
create policy "members create own attachments" on public.message_attachments
  for insert with check (
    auth.uid() = uploaded_by
    and exists (select 1 from public.profiles where id = auth.uid() and banned = false)
    and public.is_room_member(room_id, auth.uid())
  );

drop policy if exists "reactions readable by room members" on public.message_reactions;
create policy "reactions readable by room members" on public.message_reactions
  for select using (
    exists (
      select 1
      from public.messages
      join public.room_members on room_members.room_id = messages.room_id
      where messages.id = message_reactions.message_id
      and room_members.user_id = auth.uid()
      and room_members.status = 'active'
    )
    or exists (
      select 1
      from public.messages
      join public.rooms on rooms.id = messages.room_id
      where messages.id = message_reactions.message_id
        and rooms.hidden = false
        and rooms.privacy = 'public'
    )
  );

drop policy if exists "users manage own reactions" on public.message_reactions;
create policy "users manage own reactions" on public.message_reactions
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.banned = false
    )
  );

drop policy if exists "users manage own follows" on public.follows;
create policy "users manage own follows" on public.follows
  for all using (auth.uid() = follower_id)
  with check (
    auth.uid() = follower_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.banned = false
    )
  );

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "users create own notifications" on public.notifications;
create policy "users create own notifications" on public.notifications
  for insert with check (
    auth.uid() = user_id
    or (
      event_type = 'invite'
      and actor_id = auth.uid()
      and exists (
        select 1
        from public.rooms
        where rooms.id = notifications.room_id
          and rooms.hidden = false
          and (
            rooms.created_by = auth.uid()
            or public.is_room_member(rooms.id, auth.uid())
          )
      )
    )
  );

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

drop policy if exists "users read own notification preferences" on public.notification_preferences;
create policy "users read own notification preferences" on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own notification preferences" on public.notification_preferences;
create policy "users insert own notification preferences" on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own notification preferences" on public.notification_preferences;
create policy "users update own notification preferences" on public.notification_preferences
  for update using (auth.uid() = user_id);

drop policy if exists "users read own push tokens" on public.push_tokens;
create policy "users read own push tokens" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own push tokens" on public.push_tokens;
create policy "users insert own push tokens" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own push tokens" on public.push_tokens;
create policy "users update own push tokens" on public.push_tokens
  for update using (auth.uid() = user_id);

drop policy if exists "users create own reports" on public.reports;
create policy "users create own reports" on public.reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "users read own reports" on public.reports;
create policy "users read own reports" on public.reports
  for select using (auth.uid() = reporter_id);

drop policy if exists "users create own deletion requests" on public.account_deletion_requests;
create policy "users create own deletion requests" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "users read own deletion requests" on public.account_deletion_requests;
create policy "users read own deletion requests" on public.account_deletion_requests
  for select using (auth.uid() = user_id);
