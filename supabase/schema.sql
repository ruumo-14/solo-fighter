-- SOLO FIGHTER: Supabase schema
-- Run this file in Supabase SQL Editor. Never put the service_role key in browser code.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '冒険者' check (char_length(display_name) between 1 and 24),
  role text not null default 'player' check (role in ('player','admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb,
  crystal bigint not null default 0 check (crystal >= 0),
  total_crystal_earned bigint not null default 0 check (total_crystal_earned >= 0),
  player_level integer not null default 1 check (player_level >= 1),
  current_stage integer not null default 1 check (current_stage >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.character_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_key text not null,
  level integer not null default 1 check (level >= 1),
  breakthrough integer not null default 0 check (breakthrough >= 0),
  spent_crystal bigint not null default 0 check (spent_crystal >= 0),
  unique(user_id, character_key)
);
create table if not exists public.pet_ownership (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_key text not null,
  level integer not null default 1 check (level >= 1),
  unique(user_id, pet_key)
);
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('equipment','item','gacha_ticket','icon','breakthrough_material')),
  item_key text not null,
  rarity text not null default 'ノーマル' check (rarity in ('ノーマル','レア','エピック','レジェンド','S1')),
  element text not null default 'ノーマル',
  quantity integer not null default 1 check (quantity >= 0),
  equipped boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.stage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage integer not null,
  mode text not null check (mode in ('normal','hard','endless','time_attack')),
  result text not null check (result in ('clear','failed')),
  elapsed_seconds integer not null default 0,
  highest_wave integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.mission_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_key text not null,
  progress integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, mission_key)
);
create table if not exists public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key(user_id, achievement_key)
);
create table if not exists public.player_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_key text not null,
  obtained_at timestamptz not null default now(),
  primary key(user_id, title_key)
);
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 180),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at desc);
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  price bigint not null check (price > 0),
  status text not null default 'listed' check (status in ('listed','sold','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  report_type text not null check (report_type in ('bug','contact')),
  body text not null check (char_length(body) between 5 and 1000),
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.gacha_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  banner_type text not null check (banner_type in ('character','pet','s1')),
  result_key text not null,
  rarity text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.weekly_rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('weekly_crystal','endless','time_attack','lifetime_crystal')),
  period_start date not null,
  score numeric not null,
  created_at timestamptz not null default now(),
  unique(user_id, category, period_start)
);
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Create a profile for every newly registered account. role is always player.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name','冒険者'))
  on conflict (id) do nothing;
  insert into public.player_saves(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin check reads a server-controlled role. Users cannot update their own role.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and suspended = false); $$;

alter table public.profiles enable row level security;
alter table public.player_saves enable row level security;
alter table public.character_ownership enable row level security;
alter table public.pet_ownership enable row level security;
alter table public.inventory enable row level security;
alter table public.stage_records enable row level security;
alter table public.mission_progress enable row level security;
alter table public.achievements enable row level security;
alter table public.player_titles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.market_listings enable row level security;
alter table public.support_reports enable row level security;
alter table public.gacha_history enable row level security;
alter table public.weekly_rankings enable row level security;
alter table public.admin_audit_log enable row level security;

-- Public profile display, private account state.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profile owner updates display name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'player' and suspended = false);
create policy "save owner reads" on public.player_saves for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "save owner writes" on public.player_saves for insert to authenticated with check (user_id = auth.uid());
create policy "save owner updates" on public.player_saves for update to authenticated using (user_id = auth.uid() and not coalesce((select suspended from public.profiles where id = auth.uid()), true)) with check (user_id = auth.uid());
create policy "character owner all" on public.character_ownership for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "pet owner all" on public.pet_ownership for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "inventory owner read" on public.inventory for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "inventory owner insert" on public.inventory for insert to authenticated with check (user_id = auth.uid());
create policy "inventory owner update" on public.inventory for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "stage records owner read" on public.stage_records for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "stage records owner insert" on public.stage_records for insert to authenticated with check (user_id = auth.uid());
create policy "missions owner all" on public.mission_progress for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "achievements owner read" on public.achievements for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "achievements owner insert" on public.achievements for insert to authenticated with check (user_id = auth.uid());
create policy "titles owner read" on public.player_titles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "titles owner insert" on public.player_titles for insert to authenticated with check (user_id = auth.uid());
create policy "chat read authenticated" on public.chat_messages for select to authenticated using (true);
create policy "chat insert own" on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
create policy "chat delete admin" on public.chat_messages for delete to authenticated using (public.is_admin());
create policy "market read listed" on public.market_listings for select to authenticated using (status = 'listed' or seller_id = auth.uid() or public.is_admin());
create policy "market seller creates" on public.market_listings for insert to authenticated with check (seller_id = auth.uid());
create policy "market seller cancels" on public.market_listings for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "reports create" on public.support_reports for insert to authenticated with check (user_id = auth.uid());
create policy "reports owner or admin read" on public.support_reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "gacha history owner read" on public.gacha_history for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "gacha history owner insert" on public.gacha_history for insert to authenticated with check (user_id = auth.uid());
create policy "rankings public read" on public.weekly_rankings for select to authenticated using (true);
create policy "rankings own insert" on public.weekly_rankings for insert to authenticated with check (user_id = auth.uid());
create policy "admin audit read" on public.admin_audit_log for select to authenticated using (public.is_admin());

-- IMPORTANT:
-- Do not grant browser clients authority to change currency, gacha outcomes, marketplace transfers,
-- rankings, admin roles, suspensions, or account deletion. Implement these as verified server-side
-- Edge Functions / trusted backend transactions before enabling competitive online play.
-- Promote the first administrator manually from the Supabase SQL editor after verifying their user ID:
-- update public.profiles set role='admin' where id='YOUR_AUTH_USER_UUID';
