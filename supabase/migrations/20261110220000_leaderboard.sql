-- Bestenliste (Spec leaderboard-supabase, ADR-0004).
-- Alle Tabellen mit RLS; Clients schreiben nur das eigene Profil. Läufe/Einreichungen nur über Edge Functions (service_role).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ===================== Tabellen =====================

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null
    check (nickname ~ '^[A-Za-zÄÖÜäöüß0-9_-]([A-Za-zÄÖÜäöüß0-9 _-]{1,14})[A-Za-zÄÖÜäöüß0-9_-]$'),
  created_at timestamptz not null default now()
);
create unique index profiles_nickname_lower_key on public.profiles (lower(nickname));

create table public.run_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'daily' check (kind in ('daily')),
  daily_date date not null,
  seed bigint not null check (seed between 0 and 4294967295),
  map_id text not null,
  mode text not null default 'challenge' check (mode in ('challenge')),
  game_version text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index run_sessions_user_day_idx on public.run_sessions (user_id, daily_date);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.run_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_date date not null,
  game_version text not null,
  replay jsonb not null,
  replay_hash text not null unique,
  end_tick integer not null,
  status text not null default 'pending' check (status in ('pending', 'verifying', 'verified', 'rejected')),
  reason text,
  score integer,
  wave integer,
  lives integer,
  won boolean,
  attempts integer not null default 0,
  submitted_at timestamptz not null default now(),
  claimed_at timestamptz,
  verified_at timestamptz
);
create index submissions_status_idx on public.submissions (status, submitted_at);
create index submissions_board_idx on public.submissions (game_version, daily_date, status, score desc);
create index submissions_user_idx on public.submissions (user_id);

create table public.rate_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start date not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- ===================== RLS =====================

alter table public.profiles enable row level security;
alter table public.run_sessions enable row level security;
alter table public.submissions enable row level security;
alter table public.rate_counters enable row level security;

create policy profiles_select_all on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy submissions_select_own on public.submissions for select to authenticated using (user_id = (select auth.uid()));

-- Zusätzlich zu RLS: Schreibrechte entziehen (Supabase vergibt sie standardmäßig an anon/authenticated).
revoke insert, update, delete, truncate on public.run_sessions, public.submissions, public.rate_counters from anon, authenticated;
revoke select on public.run_sessions, public.rate_counters from anon, authenticated;
revoke delete, truncate on public.profiles from anon, authenticated;
revoke insert, update on public.profiles from anon;

-- ===================== Öffentliche RPCs =====================

-- Top 10 (Tag oder ISO-Woche) + eigene Zeile; bester geprüfter Lauf je Nutzer; Score ↓, Moral ↓, Prüfzeit ↑.
create or replace function public.get_leaderboard(period text, ref_date date, version text)
returns table (rank integer, nickname text, score integer, wave integer, lives integer, won boolean, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with bounds as (
    select case when period = 'week' then date_trunc('week', ref_date)::date else ref_date end as d_from,
           case when period = 'week' then (date_trunc('week', ref_date) + interval '6 days')::date else ref_date end as d_to
  ),
  best as (
    select distinct on (s.user_id) s.user_id, s.score, s.wave, s.lives, s.won, s.verified_at
    from public.submissions s, bounds b
    where s.status = 'verified' and s.game_version = version and s.daily_date between b.d_from and b.d_to
    order by s.user_id, s.score desc, s.lives desc, s.verified_at asc
  ),
  ranked as (
    select best.*, p.nickname,
           row_number() over (order by best.score desc, best.lives desc, best.verified_at asc)::integer as rnk
    from best join public.profiles p on p.user_id = best.user_id
  )
  select rnk, nickname, score, wave, lives, won, user_id = auth.uid()
  from ranked
  where rnk <= 10 or user_id = auth.uid()
  order by rnk;
$$;

-- Neue Tagesbestwerte seit `since` (für den Ticker), höchstens 5.
create or replace function public.get_ticker(since timestamptz, version text)
returns table (nickname text, score integer, daily_date date, verified_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.nickname, s.score, s.daily_date, s.verified_at
  from public.submissions s join public.profiles p on p.user_id = s.user_id
  where s.status = 'verified' and s.game_version = version and s.verified_at > since
    and s.score = (
      select max(s2.score) from public.submissions s2
      where s2.status = 'verified' and s2.game_version = version and s2.daily_date = s.daily_date
    )
  order by s.verified_at desc
  limit 5;
$$;

-- ===================== Interne RPCs (nur service_role) =====================

-- Zähler pro Nutzer/Bucket/Tag erhöhen; true, wenn das Limit noch eingehalten ist.
create or replace function public.bump_rate(p_user uuid, p_bucket text, p_day date, p_limit integer)
returns boolean
language sql volatile security definer set search_path = public
as $$
  insert into public.rate_counters as r (user_id, bucket, window_start, count)
  values (p_user, p_bucket, p_day, 1)
  on conflict (user_id, bucket, window_start) do update set count = r.count + 1
  returning count <= p_limit;
$$;

-- Nächste Einreichung zur Prüfung beanspruchen (hängende nach 2 min erneut, max. 3 Versuche).
create or replace function public.claim_submission()
returns setof public.submissions
language plpgsql volatile security definer set search_path = public
as $$
begin
  update public.submissions
     set status = 'rejected', reason = 'Prüfung fehlgeschlagen', verified_at = now()
   where status = 'verifying' and claimed_at < now() - interval '2 minutes' and attempts >= 3;
  return query
  update public.submissions
     set status = 'verifying', claimed_at = now(), attempts = attempts + 1
   where id = (
     select id from public.submissions
      where status = 'pending' or (status = 'verifying' and claimed_at < now() - interval '2 minutes')
      order by submitted_at
      for update skip locked
      limit 1
   )
  returning *;
end;
$$;

create or replace function public.finish_submission(
  p_id uuid, p_status text, p_reason text, p_score integer, p_wave integer, p_lives integer, p_won boolean
) returns void
language sql volatile security definer set search_path = public
as $$
  update public.submissions
     set status = p_status, reason = p_reason, score = p_score, wave = p_wave, lives = p_lives, won = p_won, verified_at = now()
   where id = p_id and status = 'verifying';
$$;

create or replace function public.admin_reject_submission(p_id uuid, p_reason text)
returns void
language sql volatile security definer set search_path = public
as $$
  update public.submissions set status = 'rejected', reason = coalesce(p_reason, 'Vom Admin gesperrt'), verified_at = now()
   where id = p_id;
$$;

create or replace function public.admin_delete_profile(p_user uuid)
returns void
language sql volatile security definer set search_path = public
as $$
  delete from public.profiles where user_id = p_user;
$$;

revoke execute on function public.bump_rate(uuid, text, date, integer) from public, anon, authenticated;
revoke execute on function public.claim_submission() from public, anon, authenticated;
revoke execute on function public.finish_submission(uuid, text, text, integer, integer, integer, boolean) from public, anon, authenticated;
revoke execute on function public.admin_reject_submission(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_delete_profile(uuid) from public, anon, authenticated;
grant execute on function public.bump_rate(uuid, text, date, integer) to service_role;
grant execute on function public.claim_submission() to service_role;
grant execute on function public.finish_submission(uuid, text, text, integer, integer, integer, boolean) to service_role;
grant execute on function public.admin_reject_submission(uuid, text) to service_role;
grant execute on function public.admin_delete_profile(uuid) to service_role;
grant execute on function public.get_leaderboard(text, date, text) to anon, authenticated;
grant execute on function public.get_ticker(timestamptz, text) to anon, authenticated;

-- ===================== Cron-Jobs =====================
-- Vault-Einträge `project_url` und `verify_secret` werden außerhalb der Migration gesetzt (keine Geheimnisse im Repo).

select cron.schedule(
  'verify-runs',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/verify-runs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-verify-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'verify_secret')
      ),
      body := '{}'::jsonb
    )
    from generate_series(1, least(5, (select count(*)::integer from public.submissions where status in ('pending', 'verifying'))));
  $job$
);

select cron.schedule(
  'leaderboard-maintenance',
  '15 3 * * *',
  $job$
    delete from public.run_sessions where used_at is null and expires_at < now() - interval '1 day';
    delete from public.rate_counters where window_start < current_date - 7;
    delete from auth.users u
     where u.is_anonymous and u.created_at < now() - interval '30 days'
       and not exists (select 1 from public.profiles p where p.user_id = u.id)
       and not exists (select 1 from public.submissions s where s.user_id = u.id);
  $job$
);
