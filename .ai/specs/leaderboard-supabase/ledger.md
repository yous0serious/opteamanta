# Ledger: Bestenliste mit Supabase (3b)

**Spec:** [spec.md](../../../specs/leaderboard-supabase/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commit) | Supabase-CLI 3.1.0 (devDep), `supabase init` (`project_id = opteamanta`, anonyme Anmeldung, Site-URL). Remote per Management-API: anonyme Anmeldung an (Limit 30/h/IP), Site-URL + lokale Redirect-URLs. Function-Secrets `DAILY_SECRET`, `VERIFY_SECRET` (zufällig, lokal nur in `.agent-state/fn_secrets.json`), `SB_SECRET_KEY`. Ruling: Migrationen per eigenem `tools/db-push.ts` über die Management-API (CLI-`db push` bräuchte das DB-Passwort), Tracking in `supabase_migrations.schema_migrations` wie die CLI; Functions per `tools/fn-deploy.ts` (`--use-api`, ohne Docker). |
| T02 | done | (T02-Commit) | Migration `20261110220000_leaderboard.sql` eingespielt (`npm run db:push`); Vault `project_url`/`verify_secret` außerhalb der Migration gesetzt. Datenbankprüfung: RLS auf 4/4 Tabellen, Cron-Jobs `verify-runs` (minütlich, bis 5 Aufrufe) und `leaderboard-maintenance` (03:15 UTC), nur `get_leaderboard`/`get_ticker` öffentlich. Gegenprobe als anonymer Nutzer: Schreiben/Lesen `run_sessions`, Schreiben `submissions`, interne RPCs, fremdes Profil → 403; eigene Submissions leer; ungültiger Nickname → 400 (Constraint); eigenes Profil und `get_leaderboard` → erlaubt. Ruling: Schreibrechte zusätzlich zu RLS per `revoke` entzogen (Defense in Depth). |
| T03 | done | (T03-Commit) | `tools/build-sim.ts` (esbuild, ESM, neutral) → `supabase/functions/_shared/sim.js` (24,5 KB, ohne Importe, Banner mit Quell-Hash); `tests/sim/bundle.test.ts` grün. Gegenprobe: Bündel rechnet das Bot-Replay mit identischem Hash `aee8c823` nach (131 ms in Node). Bündel vom Linting ausgenommen. |
| T04 | done | (T04-Commit) | `supabase/functions/_shared/logic.ts` (nur WebCrypto/Intl): `berlinDate`, `isoWeekRange`, `dailySeed` (HMAC-SHA256, Präfix `daily:`), `mapForSeed`, `checkSubmission` (alle Gründe aus T04), `replayHash` (ohne `result`). `tests/server/logic.test.ts`: 18/18 grün (inkl. Mitternacht Berlin Winter/Sommer, Tag der Zeitumstellung). Ruling: Abgleich Seed/Karte/Modus/Version vor `parseReplay`, damit Gründe spezifisch sind. |
| T05 | done | (T04/T05-Commit) | `start-run`, `submit-run`, `verify-runs` + `_shared/http.ts` deployt (`npm run fn:deploy`, CLI mit `--remote=<ref> --yes`). Rauchtest gegen das Projekt: ohne Token 401 (`start-run`, `verify-runs`); `start-run` 200 (Tag 2026-11-11 Berlin, Karte aus Seed); `submit-run` 202 → `verified` in ~2 s; zweite Einreichung derselben Session 409 `session_used`; manipuliertes `result` → `rejected` „Ergebnis stimmt nicht“ (Server-Score 120 statt behauptet 1120). Ruling: Dedupe über `replay_hash` ohne `result` lehnt identische Eingaben auch zwischen verschiedenen Nutzern ab (gewollt: Kopieren fremder Replays). |
| T06 | todo | – | |
| T07 | todo | – | |
| T08 | todo | – | |
| T09 | todo | – | |
| T10 | todo | – | |

## Rulings

- **R-1** Supabase-Projekt `opteamanta` (Ref `hqdvuessvcmtlcsysrmi`, eu-west-3, Postgres 17) war leer; Zugriff per Access Token (`supabase_token.txt`) und Secret Key (`supabase_secret.txt`), beide gitignored (Planung).
- **R-2** Daily: unbegrenzte Versuche, bester geprüfter Lauf zählt (Nutzerentscheidung); kein Captcha, keine Nickname-Blockliste (Nutzerentscheidungen, Risiko in Spec dokumentiert).

## Open questions

- keine

## Log

- 2026-11-10: Spec 3b freigegeben, ADR-0004 (proposed). Plan + 10 Briefs geschrieben, wartet auf Freigabe.
