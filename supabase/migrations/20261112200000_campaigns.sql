-- Kampagnen, Progression und Ranglisten je Karte/Level (Spec campaigns, ADR-0004).
-- Ergänzt 20261110220000_leaderboard.sql. Clients lesen eigene Fortschrittszeilen (RLS) bzw. per RPC; geschrieben wird
-- nur serverseitig (Edge Functions mit Secret Key bzw. SECURITY-DEFINER-Funktionen, die nur service_role ausführen darf).

-- ===================== Lauf-Sessions: Daily, Level, Karte =====================

alter table public.run_sessions drop constraint if exists run_sessions_kind_check;
alter table public.run_sessions drop constraint if exists run_sessions_mode_check;
alter table public.run_sessions
  add column level_id text,
  add column board text,
  add column loadout jsonb not null default '{}'::jsonb;
update public.run_sessions set board = 'daily:' || daily_date::text where board is null;
alter table public.run_sessions
  alter column board set not null,
  add constraint run_sessions_kind_check check (kind in ('daily', 'level', 'map')),
  add constraint run_sessions_mode_check check (mode in ('challenge', 'level')),
  add constraint run_sessions_level_check check ((kind = 'level') = (level_id is not null)),
  add constraint run_sessions_board_check
    check (board ~ '^(daily:[0-9]{4}-[0-9]{2}-[0-9]{2}|level:[a-z0-9-]{1,32}|map:[a-z0-9-]{1,32})$'),
  add constraint run_sessions_loadout_check check (jsonb_typeof(loadout) = 'object');

-- ===================== Einreichungen: Board-Zuordnung und Ergebnisse =====================
-- `daily_date` ist ab jetzt das Lauf-Datum (Berlin) aller Arten; die Daily-Rangliste filtert zusätzlich auf kind = 'daily'.

alter table public.submissions
  add column kind text not null default 'daily',
  add column board text,
  add column level_id text,
  add column map_id text,
  add column mode text not null default 'challenge',
  add column loadout jsonb not null default '{}'::jsonb,
  add column kills integer,
  add column stars smallint,
  add column leaks integer,
  add column best_combo integer,
  add column bosses text[] not null default '{}',
  add column xp integer not null default 0,
  add column new_achievements text[] not null default '{}';
update public.submissions s
   set board = 'daily:' || s.daily_date::text, map_id = r.map_id
  from public.run_sessions r
 where r.id = s.session_id and s.board is null;
alter table public.submissions
  alter column board set not null,
  alter column map_id set not null,
  add constraint submissions_kind_check check (kind in ('daily', 'level', 'map')),
  add constraint submissions_mode_check check (mode in ('challenge', 'level')),
  add constraint submissions_stars_check check (stars between 0 and 3),
  add constraint submissions_xp_check check (xp >= 0);

create index submissions_board_id_idx on public.submissions (game_version, board, status, score desc);
create index submissions_map_idx on public.submissions (game_version, map_id, mode, status, score desc);
create index submissions_level_idx on public.submissions (game_version, level_id, status, score desc) where level_id is not null;
create index submissions_kind_day_idx on public.submissions (game_version, kind, daily_date, status, score desc);

-- ===================== Profil: XP (nur serverseitig) =====================

alter table public.profiles add column xp integer not null default 0 check (xp >= 0);

-- Clients dürfen nur Nickname (und die eigene user_id per Upsert) schreiben – nie die XP.
revoke insert, update on public.profiles from authenticated;
grant insert (user_id, nickname), update (user_id, nickname) on public.profiles to authenticated;

-- XP aus bereits geprüften Läufen übernehmen, falls das Profil erst nach dem Lauf entsteht (oder neu angelegt wird).
create or replace function public.profiles_init_xp()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.xp := coalesce((select sum(s.xp) from public.submissions s where s.user_id = new.user_id and s.status = 'verified'), 0);
  return new;
end;
$$;
create trigger profiles_init_xp before insert on public.profiles for each row execute function public.profiles_init_xp();
revoke execute on function public.profiles_init_xp() from public, anon, authenticated;

-- ===================== Fortschritt =====================

create table public.level_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  level_id text not null check (level_id ~ '^[a-z0-9-]{1,32}$'),
  best_stars smallint not null default 0 check (best_stars between 0 and 3),
  best_score integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

create table public.skill_alloc (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null check (skill_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  rank smallint not null check (rank between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.achievements_unlocked (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null check (achievement_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  unlocked_at timestamptz not null default now(),
  submission_id uuid references public.submissions (id) on delete set null,
  primary key (user_id, achievement_id)
);

alter table public.level_results enable row level security;
alter table public.skill_alloc enable row level security;
alter table public.achievements_unlocked enable row level security;

create policy level_results_select_own on public.level_results for select to authenticated using (user_id = (select auth.uid()));
create policy skill_alloc_select_own on public.skill_alloc for select to authenticated using (user_id = (select auth.uid()));
create policy achievements_select_own on public.achievements_unlocked for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.level_results, public.skill_alloc, public.achievements_unlocked from anon, authenticated;
revoke select on public.level_results, public.skill_alloc, public.achievements_unlocked from anon;

-- ===================== Öffentliche RPCs =====================

-- Daily-Rangliste (alt, Top 10) und Ticker: nur Daily-Läufe – Level-/Kartenläufe tragen ebenfalls ein daily_date.
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
    where s.status = 'verified' and s.kind = 'daily' and s.game_version = version and s.daily_date between b.d_from and b.d_to
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

create or replace function public.get_ticker(since timestamptz, version text)
returns table (nickname text, score integer, daily_date date, verified_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.nickname, s.score, s.daily_date, s.verified_at
  from public.submissions s join public.profiles p on p.user_id = s.user_id
  where s.status = 'verified' and s.kind = 'daily' and s.game_version = version and s.verified_at > since
    and s.score = (
      select max(s2.score) from public.submissions s2
      where s2.status = 'verified' and s2.kind = 'daily' and s2.game_version = version and s2.daily_date = s.daily_date
    )
  order by s.verified_at desc
  limit 5;
$$;

-- Rangliste je Board: `daily:<YYYY-MM-DD>` | `level:<LevelId>` | `map:<MapId>` (Challenge auf dieser Karte, inkl. Daily).
-- Zeitraum `all` | `week` (ISO-Woche) | `day`; bei Daily bestimmt das Datum der Board-ID den Tag/die Woche, sonst `ref_date`
-- (null = heute in Berlin). Bester geprüfter Lauf je Nutzer; Score ↓, Moral ↓, Prüfzeit ↑. Top 50 + eigene Umgebung (±2).
create or replace function public.get_board(board text, period text, ref_date date, version text)
returns table (rank integer, nickname text, score integer, wave integer, stars integer, lives integer, won boolean, is_me boolean)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_kind text := split_part(coalesce(get_board.board, ''), ':', 1);
  v_key text := substr(coalesce(get_board.board, ''), length(split_part(coalesce(get_board.board, ''), ':', 1)) + 2);
  v_period text := coalesce(get_board.period, 'all');
  v_ref date := coalesce(get_board.ref_date, (now() at time zone 'Europe/Berlin')::date);
  v_version text := get_board.version;
  v_from date;
  v_to date;
  v_me uuid := auth.uid();
begin
  if v_period not in ('all', 'week', 'day') or v_version is null then return; end if;
  if v_kind = 'daily' then
    if v_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return; end if;
    begin
      v_ref := v_key::date;
    exception when others then
      return;
    end;
  elsif v_kind not in ('level', 'map') or v_key !~ '^[a-z0-9-]{1,32}$' then
    return;
  end if;
  if v_period = 'day' then
    v_from := v_ref; v_to := v_ref;
  elsif v_period = 'week' then
    v_from := date_trunc('week', v_ref)::date; v_to := v_from + 6;
  end if;

  return query
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.wave, s.stars, s.lives, s.won, s.verified_at
    from public.submissions s
    where s.status = 'verified' and s.game_version = v_version
      and ((v_kind = 'daily' and s.kind = 'daily')
        or (v_kind = 'level' and s.level_id = v_key)
        or (v_kind = 'map' and s.mode = 'challenge' and s.level_id is null and s.map_id = v_key))
      and (v_from is null or s.daily_date between v_from and v_to)
    order by s.user_id, s.score desc, s.lives desc, s.verified_at asc
  ),
  ranked as (
    select b.*, p.nickname,
           row_number() over (order by b.score desc, b.lives desc, b.verified_at asc)::integer as rnk
    from best b join public.profiles p on p.user_id = b.user_id
  ),
  mine as (select r.rnk from ranked r where r.user_id = v_me)
  select r.rnk, r.nickname, r.score, r.wave, r.stars::integer, r.lives, r.won, coalesce(r.user_id = v_me, false)
  from ranked r
  where r.rnk <= 50 or exists (select 1 from mine m where r.rnk between m.rnk - 2 and m.rnk + 2)
  order by r.rnk;
end;
$$;

-- XP eines Nutzers: Profilwert, ohne Profil die Summe der geprüften Läufe (siehe profiles_init_xp). Nur service_role
-- (und SECURITY-DEFINER-Funktionen wie get_progress).
create or replace function public.user_xp(p_user uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.xp from public.profiles p where p.user_id = p_user),
    (select sum(s.xp)::integer from public.submissions s where s.user_id = p_user and s.status = 'verified'),
    0);
$$;
-- Eigener Fortschritt in einem Aufruf (XP, Level-Bestwerte, Skills, Erfolge, Nickname). Null ohne Anmeldung.
create or replace function public.get_progress()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'nickname', (select p.nickname from public.profiles p where p.user_id = auth.uid()),
    'xp', public.user_xp(auth.uid()),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object('level_id', l.level_id, 'best_stars', l.best_stars, 'best_score', l.best_score) order by l.level_id)
      from public.level_results l where l.user_id = auth.uid()), '[]'::jsonb),
    'skills', coalesce((select jsonb_object_agg(k.skill_id, k.rank) from public.skill_alloc k where k.user_id = auth.uid()), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.achievement_id, 'unlocked_at', a.unlocked_at) order by a.unlocked_at)
      from public.achievements_unlocked a where a.user_id = auth.uid()), '[]'::jsonb)
  ) end;
$$;

-- ===================== Interne RPCs (nur service_role) =====================


-- Statistik der geprüften Läufe eines Nutzers in der Form von AchievementStats (src/sim/data/progression.ts), ohne
-- accountLevel (rechnet die Edge Function aus den XP). Grundlage der Erfolge in verify-runs.
create or replace function public.user_stats(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with runs as (
    select s.kind, s.mode, s.won, s.kills, s.leaks, s.best_combo, s.bosses,
           (select coalesce(sum(e.value::integer), 0) from jsonb_each_text(s.loadout) as e) as skill_points
    from public.submissions s
    where s.user_id = p_user and s.status = 'verified'
  )
  select jsonb_build_object(
    'runs', count(*),
    'wins', count(*) filter (where r.won),
    'kills', coalesce(sum(r.kills), 0),
    'dailyRuns', count(*) filter (where r.kind = 'daily'),
    'challengeWins', count(*) filter (where r.mode = 'challenge' and r.won),
    'endlessBestWave', 0,
    'bestCombo', coalesce(max(r.best_combo), 0),
    'flawlessWins', count(*) filter (where r.won and r.leaks = 0),
    'bossesDefeated', coalesce((select jsonb_agg(distinct b.boss) from runs r2, unnest(r2.bosses) as b (boss)), '[]'::jsonb),
    'levelStars', coalesce((
      select jsonb_object_agg(l.level_id, l.best_stars) from public.level_results l where l.user_id = p_user and l.best_stars > 0
    ), '{}'::jsonb),
    'maxSkillPoints', coalesce(max(r.skill_points), 0)
  )
  from runs r;
$$;
-- Prüfergebnis atomar übernehmen: Einreichung, Level-Bestwert, XP und Erfolge. Nur einmal je Einreichung (status
-- 'verifying'); pro Nutzer serialisiert, damit der Erstabschluss-Bonus nicht doppelt vergeben wird.
-- Liefert { xp, firstClear, achievements } oder null, wenn die Einreichung nicht (mehr) in Prüfung ist.
create or replace function public.finish_run(
  p_id uuid, p_status text, p_reason text, p_score integer, p_wave integer, p_lives integer, p_won boolean,
  p_kills integer, p_stars integer, p_leaks integer, p_best_combo integer, p_bosses text[], p_xp integer,
  p_first_clear_bonus integer, p_achievements text[]
) returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_sub public.submissions%rowtype;
  v_prev smallint;
  v_first boolean := false;
  v_gained integer := 0;
  v_fresh text[] := '{}';
begin
  select * into v_sub from public.submissions where id = p_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('progress:' || v_sub.user_id::text, 0));
  select * into v_sub from public.submissions where id = p_id and status = 'verifying' for update;
  if not found then return null; end if;

  if p_status = 'verified' then
    v_gained := greatest(coalesce(p_xp, 0), 0);
    if v_sub.level_id is not null then
      select l.best_stars into v_prev from public.level_results l where l.user_id = v_sub.user_id and l.level_id = v_sub.level_id;
      v_first := coalesce(v_prev, 0) = 0 and coalesce(p_stars, 0) >= 1;
      if v_first then v_gained := v_gained + greatest(coalesce(p_first_clear_bonus, 0), 0); end if;
      insert into public.level_results as l (user_id, level_id, best_stars, best_score, updated_at)
      values (v_sub.user_id, v_sub.level_id, coalesce(p_stars, 0), p_score, now())
      on conflict (user_id, level_id) do update
        set best_stars = greatest(l.best_stars, excluded.best_stars),
            best_score = greatest(l.best_score, excluded.best_score),
            updated_at = now()
        where excluded.best_stars > l.best_stars or excluded.best_score > coalesce(l.best_score, -2147483648);
    end if;
    update public.profiles set xp = xp + v_gained where user_id = v_sub.user_id;
    with ins as (
      insert into public.achievements_unlocked (user_id, achievement_id, submission_id)
      select v_sub.user_id, a, p_id from unnest(coalesce(p_achievements, '{}'::text[])) as a
      on conflict (user_id, achievement_id) do nothing
      returning achievement_id
    )
    select coalesce(array_agg(achievement_id), '{}'::text[]) into v_fresh from ins;
  end if;

  update public.submissions
     set status = p_status, reason = p_reason, score = p_score, wave = p_wave, lives = p_lives, won = p_won,
         kills = p_kills, stars = p_stars, leaks = p_leaks, best_combo = p_best_combo, bosses = coalesce(p_bosses, '{}'), xp = v_gained, new_achievements = v_fresh, verified_at = now()
   where id = p_id;
  return jsonb_build_object('xp', v_gained, 'firstClear', v_first, 'achievements', to_jsonb(v_fresh));
end;
$$;

-- Skill-Verteilung ersetzen (geprüft in der Edge Function `allocate-skill` mit der Sim-Regel validateLoadout).
-- Optimistische Sperre: schlägt fehl (false), wenn sich die Verteilung seit dem Lesen geändert hat.
create or replace function public.replace_skill_alloc(p_user uuid, p_expected jsonb, p_loadout jsonb)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_cur jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('skills:' || p_user::text, 0));
  select coalesce(jsonb_object_agg(k.skill_id, k.rank), '{}'::jsonb) into v_cur from public.skill_alloc k where k.user_id = p_user;
  if v_cur <> coalesce(p_expected, '{}'::jsonb) then return false; end if;
  delete from public.skill_alloc where user_id = p_user;
  insert into public.skill_alloc (user_id, skill_id, rank)
  select p_user, e.key, e.value::integer from jsonb_each_text(coalesce(p_loadout, '{}'::jsonb)) as e where e.value::integer > 0;
  return true;
end;
$$;

revoke execute on function public.user_xp(uuid) from public, anon, authenticated;
revoke execute on function public.user_stats(uuid) from public, anon, authenticated;
revoke execute on function public.finish_run(uuid, text, text, integer, integer, integer, boolean, integer, integer, integer, integer, text[], integer, integer, text[])
  from public, anon, authenticated;
revoke execute on function public.replace_skill_alloc(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.get_progress() from public, anon;
revoke execute on function public.get_board(text, text, date, text) from public;
grant execute on function public.user_xp(uuid) to service_role;
grant execute on function public.user_stats(uuid) to service_role;
grant execute on function public.finish_run(uuid, text, text, integer, integer, integer, boolean, integer, integer, integer, integer, text[], integer, integer, text[])
  to service_role;
grant execute on function public.replace_skill_alloc(uuid, jsonb, jsonb) to service_role;
grant execute on function public.get_progress() to authenticated;
grant execute on function public.get_board(text, text, date, text) to anon, authenticated;
