-- WarrantyBridge schema (applied to the production Supabase project)
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'buyer' check (role in ('buyer','builder')),
  company text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, full_name, role, company)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'role','buyer'),
          new.raw_user_meta_data->>'company');
  return new;
end; $fn$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  closing_date date,
  warranty_months int not null default 12,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('buyer','builder')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(6),'hex'),
  invited_role text not null check (invited_role in ('buyer','builder')),
  created_by uuid not null references public.profiles(id),
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'other',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','acknowledged','scheduled','dispatched','in_progress','resolved','closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null default 'status_change',
  old_status text, new_status text, note text,
  created_at timestamptz not null default now()
);

create table public.issue_photos (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  path text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  household_id uuid not null,
  sender_id uuid not null references public.profiles(id),
  body text not null default '',
  image_path text,
  created_at timestamptz not null default now()
);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index on public.household_members (user_id);
create index on public.issues (household_id);
create index on public.messages (issue_id);
create index on public.issue_events (issue_id);
create index on public.issue_photos (issue_id);
create index on public.invites (household_id);

create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists(select 1 from household_members where household_id = hid and user_id = auth.uid());
$fn$;

create or replace function public.create_household(p_name text, p_address text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare hid uuid;
begin
  if p_role not in ('buyer','builder') then raise exception 'bad role'; end if;
  insert into households (name, address, created_by) values (p_name, p_address, auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, member_role) values (hid, auth.uid(), p_role);
  return hid;
end; $fn$;

-- Invite codes are reusable: one standing code per role per household.
-- claimed_by/claimed_at record the most recent claim for audit purposes.
create or replace function public.claim_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare inv record;
begin
  select * into inv from invites where code = lower(trim(p_code));
  if not found then raise exception 'Invalid invite code'; end if;
  if exists(select 1 from household_members where household_id = inv.household_id and user_id = auth.uid()) then
    raise exception 'You are already a member of this household';
  end if;
  update invites set claimed_by = auth.uid(), claimed_at = now() where id = inv.id;
  insert into household_members (household_id, user_id, member_role) values (inv.household_id, auth.uid(), inv.invited_role);
  return inv.household_id;
end; $fn$;

create or replace function public.log_issue_status() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if old.status is distinct from new.status then
    insert into issue_events (issue_id, actor_id, event_type, old_status, new_status)
    values (new.id, auth.uid(), 'status_change', old.status, new.status);
  end if;
  new.updated_at = now();
  return new;
end; $fn$;
create trigger issues_status_log before update on public.issues
for each row execute function public.log_issue_status();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.issues enable row level security;
alter table public.issue_events enable row level security;
alter table public.issue_photos enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

create policy "households read" on public.households for select to authenticated using (public.is_member(id));
create policy "households update" on public.households for update to authenticated using (public.is_member(id));

create policy "members read" on public.household_members for select to authenticated using (public.is_member(household_id));

create policy "invites read" on public.invites for select to authenticated using (public.is_member(household_id));
create policy "invites create" on public.invites for insert to authenticated with check (created_by = auth.uid() and public.is_member(household_id));
create policy "invites delete" on public.invites for delete to authenticated using (public.is_member(household_id));

create policy "issues read" on public.issues for select to authenticated using (public.is_member(household_id));
create policy "issues create" on public.issues for insert to authenticated with check (created_by = auth.uid() and public.is_member(household_id));
create policy "issues update" on public.issues for update to authenticated using (public.is_member(household_id));

create policy "events read" on public.issue_events for select to authenticated using (exists(select 1 from public.issues i where i.id = issue_id and public.is_member(i.household_id)));
create policy "events create" on public.issue_events for insert to authenticated with check (actor_id = auth.uid() and exists(select 1 from public.issues i where i.id = issue_id and public.is_member(i.household_id)));

create policy "photos read" on public.issue_photos for select to authenticated using (exists(select 1 from public.issues i where i.id = issue_id and public.is_member(i.household_id)));
create policy "photos create" on public.issue_photos for insert to authenticated with check (uploaded_by = auth.uid() and exists(select 1 from public.issues i where i.id = issue_id and public.is_member(i.household_id)));

create policy "messages read" on public.messages for select to authenticated using (public.is_member(household_id));
create policy "messages create" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_member(household_id));

create policy "reads read" on public.message_reads for select to authenticated using (exists(select 1 from public.messages m where m.id = message_id and public.is_member(m.household_id)));
create policy "reads create" on public.message_reads for insert to authenticated with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('attachments','attachments', true);
create policy "attachments upload" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "attachments read" on storage.objects for select using (bucket_id = 'attachments');

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reads;
alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.issue_events;
