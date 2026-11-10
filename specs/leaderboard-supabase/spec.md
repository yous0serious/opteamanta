# Spec: Bestenliste mit Supabase (Teil 3b)

**Status:** Approved
**Size:** L
**Ticket:** –
**Plan:** `.ai/specs/leaderboard-supabase/plan.md` (nach Freigabe) · **Ledger:** `.ai/specs/leaderboard-supabase/ledger.md`
**Baut auf:** [balancing-challenge](../balancing-challenge/spec.md) (Spielversion 0.2.0) · Vorarbeit: [Anti-Cheat-Analyse](../../.ai/knowledge/requirements/anti-cheat.md)

## Ziel

Spieler messen sich in einer **Daily Challenge**: Alle spielen am selben Tag denselben Seed und dieselbe Karte im
Challenge-Modus (30 Wellen). Der Server vergibt den Lauf, nimmt das Replay entgegen, rechnet es selbst nach und trägt nur den
**selbst berechneten** Score ein. Die Bestenliste zeigt die Top 10 des Tages und der Woche in der Seitenleiste; neue
Bestwerte laufen durch den News-Ticker. Spieler melden sich anonym an und wählen einen Nickname.

## Nicht-Ziele

- Ranglisten für Endlos- oder freie Challenge-Läufe (bleiben lokal).
- Captcha (Entscheidung des Nutzers; Risiko siehe unten), E-Mail-/GitHub-Login, Konten über Geräte hinweg.
- Blockliste für Nicknames (Entscheidung des Nutzers); stattdessen Admin-Funktion zum Löschen.
- Erkennung von Bots/TAS (technisch nicht ausschließbar; offen kommuniziert).
- Änderungen an Spielregeln oder Balancing.

## Randbedingungen

- Supabase-Projekt `opteamanta` (Region eu-west-3, Postgres 17). Gespeichert werden nur anonyme Nutzer-ID, Nickname, Replays und Ergebnisse – keine IP-Adressen, keine E-Mails.
- Der Browser kennt nur URL und Publishable Key (Netlify-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Secret Key, Tages-Geheimnis und Worker-Geheimnis existieren nur als Function-Secrets.
- Jede Tabelle hat RLS; Clients schreiben nie direkt in `run_sessions`/`submissions`.
- Server und Client rechnen mit **derselben** Simulation (`src/sim`, gebündelt für Deno); `gameVersion` muss übereinstimmen.
- Prüfung pro Replay innerhalb des Edge-Function-Limits (2 s CPU); Messung in der echten Edge-Runtime.
- Ohne Supabase-Variablen (lokal, E2E) läuft das Spiel unverändert; die Bestenliste zeigt „offline“.
- Tageswechsel um 00:00 Europe/Berlin.

## Entscheidungen

- Architektur: serverseitig vergebene Lauf-Sessions, asynchrone Prüf-Warteschlange, Lesen nur über RPC → [ADR-0004](../../.ai/knowledge/decisions/0004-leaderboard-architecture.md)
- Tages-Seed = erste 32 Bit von HMAC-SHA256(Tages-Geheimnis, `YYYY-MM-DD`) – vorab nicht berechenbar; Karte folgt aus dem Seed (wie im Spiel).
- Mehrere Versuche pro Tag erlaubt, es zählt der beste geprüfte Lauf; Wochenwertung = bester Tageslauf der ISO-Woche (Berlin).
- Rangfolge: Score absteigend, dann Moral absteigend, dann früherer Prüfzeitpunkt.
- Nickname: 3–16 Zeichen aus Buchstaben (inkl. Umlaute/ß), Ziffern, Leerzeichen, `-`, `_`; eindeutig ohne Groß-/Kleinschreibung.
- Sim-Bündel für Deno per esbuild (`npm run build:sim` → `supabase/functions/_shared/sim.js`); ein Test stellt sicher, dass das Bündel aktuell ist.

## Design

**Tabellen (`public`, alle mit RLS):**
`profiles(user_id PK → auth.users, nickname, created_at)` – lesen: alle; anlegen/ändern: nur eigene Zeile.
`run_sessions(id, user_id, kind 'daily', daily_date, seed, map_id, mode 'challenge', game_version, issued_at, expires_at, used_at)` – kein Client-Zugriff.
`submissions(id, session_id UNIQUE, user_id, replay jsonb, replay_hash UNIQUE, status pending|verifying|verified|rejected, reason, score, wave, lives, won, end_tick, attempts, submitted_at, verified_at)` – lesen: nur eigene Zeilen.
`rate_counters(user_id, bucket, window_start, count)` – kein Client-Zugriff.

**RPCs (security definer, ausführbar für `anon`/`authenticated`):** `get_leaderboard(period 'day'|'week', ref_date)` → Top 10 + eigener Rang; `get_ticker()` → letzte neue Tagesbestwerte. Interne RPCs (nur `service_role`): `claim_submission()` mit `FOR UPDATE SKIP LOCKED`, `finish_submission(...)`, `admin_reject_submission(id, reason)`, `admin_delete_profile(user_id)`.

**Edge Functions (Deno):**
- `start-run` (Auth): prüft Rate-Limit (≤ 30 Sessions/User/Tag), legt Tages-Session an, liefert `{sessionId, seed, mapId, mode, gameVersion, expiresAt}` (Ablauf 3 h).
- `submit-run` (Auth): Session gehört dem User, unbenutzt, nicht abgelaufen; Replay-Seed/Karte/Modus/Version = Session; `parseReplay(maxTicks: 200 000)`; Echtzeit-Plausibilität `jetzt − issued_at ≥ endTick / 60 / 10`; Hash-Dedupe; speichert `pending`, markiert Session benutzt, stößt `verify-runs` an; Antwort sofort.
- `verify-runs` (nur mit Worker-Geheimnis): holt per `claim_submission()` genau ein Replay, rechnet nach (`runReplay`), schreibt Ergebnis oder Ablehnungsgrund. Zusätzlich jede Minute per `pg_cron` + `pg_net` (Nachzügler, Wiederholung bei Abbruch, max. 3 Versuche).
- Wartung per `pg_cron` täglich: abgelaufene Sessions löschen, anonyme Nutzer ohne Profil und ohne Einreichung nach 30 Tagen entfernen.

**Client:** `@supabase/supabase-js`; beim Start anonyme Anmeldung (Session im `localStorage`); Seitenleisten-Reiter „🏆 Bestenliste“ (Heute/Woche, Top 10, eigener Rang, Button „Daily spielen“); nach Spielende in einer Daily-Session: Nickname-Dialog (falls noch keiner), Einreichen, Status abfragen bis `verified`/`rejected`; Ticker zeigt neue Tagesbestwerte (Abfrage alle 60 s).

**Risiken:** Ohne Captcha sind Massen-Accounts nur durch Supabase-Standardlimits (30 anonyme Anmeldungen/h/IP) und das Session-Limit gebremst; Bots/TAS können gute Läufe erzeugen (fester Seed für alle begrenzt den Vorteil nicht); Deno-Performance unbekannt bis zur Messung.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | Migrationen liegen versioniert unter `supabase/migrations/` und sind im Projekt eingespielt; alle Tabellen haben RLS. Mit Publishable Key und anonymer Sitzung sind direkte INSERT/UPDATE/DELETE auf `run_sessions`, `submissions`, `rate_counters` sowie fremde `profiles` verboten; SELECT auf fremde `submissions` liefert nichts. | Integrationstest `tests/integration/rls.test.ts` |
| AC-2 | `start-run` liefert für denselben Berliner Tag allen Nutzern denselben Seed und dieselbe Karte, für verschiedene Tage verschiedene; der Seed ist ohne Tages-Geheimnis nicht ableitbar; mehr als 30 Sessions pro Nutzer und Tag werden abgelehnt (HTTP 429). | Unit-Test (Seed-Logik) + Integrationstest |
| AC-3 | `submit-run` lehnt ab (HTTP 4xx mit Grund): fremde/benutzte/abgelaufene Session, abweichender Seed/Karte/Modus/Version, ungültiges Replay, unplausibel kurze Echtzeit, doppeltes Replay. Gültige Replays werden als `pending` gespeichert. | Integrationstest `tests/integration/submit.test.ts` |
| AC-4 | Ein gültiges Replay wird innerhalb von 90 s `verified`; der gespeicherte Score ist der vom Server berechnete. Ein Replay mit manipuliertem `result` wird `rejected` mit Grund „Ergebnis stimmt nicht“. | Integrationstest (Bot-Replays) |
| AC-5 | Das Nachrechnen des längsten Challenge-Replays aus `npm run balance` dauert in der Edge-Runtime < 1 500 ms CPU (gemessen und im Ledger). | Messung `verify-runs` (Log/Antwort) |
| AC-6 | `get_leaderboard('day'|'week')` liefert Top 10 nach Score ↓, Moral ↓, Prüfzeit ↑, nur `verified`, nur der beste Lauf je Nutzer, mit Nickname; dazu den eigenen Rang. | Integrationstest |
| AC-7 | Nicknames: Regeln laut Entscheidungen werden per DB-Constraint erzwungen; doppelter Name (Groß-/Klein egal) wird abgelehnt; `admin_delete_profile` ist nur mit Secret Key ausführbar. | Integrationstest |
| AC-8 | Das Sim-Bündel unter `supabase/functions/_shared/` entspricht dem aktuellen `src/sim` (Test schlägt fehl, wenn `npm run build:sim` vergessen wurde). | `tests/sim/bundle.test.ts` |
| AC-9 | Browser: anonyme Anmeldung beim Start; Reiter „Bestenliste“ mit Heute/Woche und eigenem Rang; „Daily spielen“ startet den Server-Lauf; nach Spielende Nickname-Dialog (beim ersten Mal), Einreichen und Statusanzeige bis „geprüft“; neue Tagesbestwerte erscheinen im Ticker. | E2E mit gemockten Supabase-Antworten + manueller Live-Test |
| AC-10 | Ohne Supabase-Variablen zeigt der Reiter „Bestenliste offline“, alle bisherigen E2E-Tests bleiben grün, keine Konsolenfehler. | `npm run test:e2e` |
| AC-11 | Keine Secrets im Repo oder Bundle: `dist/` und Git enthalten weder Secret Key noch Access Token noch Tages-/Worker-Geheimnis. | Grep über `dist/` und `git grep` |
