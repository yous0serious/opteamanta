# Ledger: Bestenliste mit Supabase (3b)

**Spec:** [spec.md](../../../specs/leaderboard-supabase/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commit) | Supabase-CLI 3.1.0 (devDep), `supabase init` (`project_id = opteamanta`, anonyme Anmeldung, Site-URL). Remote per Management-API: anonyme Anmeldung an (Limit 30/h/IP), Site-URL + lokale Redirect-URLs. Function-Secrets `DAILY_SECRET`, `VERIFY_SECRET` (zufällig, lokal nur in `.agent-state/fn_secrets.json`), `SB_SECRET_KEY`. Ruling: Migrationen per eigenem `tools/db-push.ts` über die Management-API (CLI-`db push` bräuchte das DB-Passwort), Tracking in `supabase_migrations.schema_migrations` wie die CLI; Functions per `tools/fn-deploy.ts` (`--use-api`, ohne Docker). |
| T02 | todo | – | |
| T03 | todo | – | |
| T04 | todo | – | |
| T05 | todo | – | |
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
