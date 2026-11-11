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
| T06 | done | (T06–T08-Commit) | general: `tests/integration/` (rls 17, start-run 3, submit-run 12, leaderboard 4, cpu 1) = 38/38 grün gegen das Projekt (65 s), `vitest.integration.config.ts`; `npm test` schließt `tests/integration` aus. AC-5: längster Challenge-Lauf (starker Bot, release-train, Seed 5, 103 085 Ticks) in der Edge-Runtime **306 ms**. Einreichung → `verified` ~0,1 s (submit-run stößt verify-runs direkt an). Testdaten mit eigener `game_version` `it-…`, alle Testnutzer gelöscht; keine Abweichungen vom Backend. |
| T07 | done | (T06–T08-Commit) | `src/online/api.ts` (supabase-js per dynamischem Import nur mit `VITE_SUPABASE_*` → eigener Chunk 56 kB gzip; ohne Variablen keine Netzwerkaufrufe), `src/online/daily.ts` (Start, Einreichen, Status alle 3 s bis 120 s, Gründe auf Deutsch), `src/view/nickname.ts` (`<dialog>`, Validierung wie DB-Constraint, „Name schon vergeben“), Controller `startDaily`/`onFinished`/`daily`; Moduswahl in der Daily gesperrt, Karte zeigt „· 📅 Daily“. |
| T08 | done | (T06–T08-Commit) | `src/view/leaderboard.ts`: Block „🏆 Bestenliste“ (Heute/Woche, Top 10, eigene Zeile auch außerhalb mit „…“, Nicknames nur per `textContent`), Button „📅 Daily spielen“, Statuszeile mit Wiederholen-Knopf, Aktualisierung alle 60 s (nicht bei verstecktem Tab), Ticker „+++ NEUER TAGESREKORD … +++“ vor den Witzen. Live-Test gegen Supabase (Online-Build auf :5173): anonyme Anmeldung, Daily 11.11. (Release-Train), Burnout, Nickname-Validierung, Einreichen → „✅ Geprüft · Tagesrang 1“, Heute/Woche zeigen den Lauf, 0 Konsolenfehler; Testnutzer gelöscht. Screenshots `.tmp/evidence/lb-*.png`. Ruling: Playwright-Chromium braucht in der Sandbox Proxy + `ignoreHTTPSErrors` (SSL-Interception), nur im Wegwerf-Skript. |
| T09 | done | (T09/T10-Commit) | general: `tests/e2e/leaderboard.spec.ts` (9 Fälle) + `fixtures/supabase-mock.ts` (`page.route` auf `http://supabase.test`), zweiter webServer (:4175, Online-Build mit Dummy-Variablen). Fund: Offline blieben die Tabs „Heute | Woche“ sichtbar (`.row { display:flex }` überschreibt `hidden`) → behoben mit `#lb-tabs[hidden]`. Erkenntnis: postgrest-js `maybeSingle()` erwartet ein JSON-Array (`Accept: */*`). |
| T10 | done | (T09/T10-Commit) | Secret-Grep (Werte von Secret Key, Access Token, GitHub-Token, `DAILY_SECRET`, `VERIFY_SECRET`): 0 Treffer in 206 Git-Dateien, Git-Historie (`--all`), `dist/` und Online-Build; Präfix `sb_secret_` im supabase-js-Chunk ist Bibliothekscode (Schlüsseltyp-Erkennung). Trivy (DB 2026-11-10, nur `--scanners vuln`): 0 Funde, Delta 0 neue CRITICAL/HIGH, Baseline erneuert. README „Bestenliste und Betrieb“. Gesamtlauf siehe AC-Nachweise. |

## AC-Nachweise

| AC | Ergebnis | Nachweis |
|---|---|---|
| AC-1 | erfüllt | `tests/integration/rls.test.ts` (RLS/Grants: direkte Writes 4xx, fremde Submissions leer, interne RPCs 403); Datenbankprüfung T02 |
| AC-2 | erfüllt | `tests/server/logic.test.ts` (Berliner Tag, Seed je Tag/Geheimnis), `tests/integration/start-run.test.ts` (gleicher Seed für 2 Nutzer, 401, 429 ab Lauf 31) |
| AC-3 | erfüllt | `tests/server/logic.test.ts` + `tests/integration/submit-run.test.ts` (alle Gründe mit Status und Code) |
| AC-4 | erfüllt | `tests/integration/submit-run.test.ts` (gültig → `verified` mit Server-Score; manipuliert → `rejected` „Ergebnis stimmt nicht“) |
| AC-5 | erfüllt | `tests/integration/cpu.test.ts`: 103 085 Ticks in **306 ms** in der Edge-Runtime (< 1 500 ms) |
| AC-6 | erfüllt | `tests/integration/leaderboard.test.ts` (Reihenfolge Score/Moral/Prüfzeit, bester Lauf je Nutzer, eigener Rang außerhalb Top 10, Woche Mo–So, Ticker) |
| AC-7 | erfüllt | `tests/integration/rls.test.ts` (Nickname-Regeln, Eindeutigkeit ohne Groß/Klein, `admin_delete_profile` nur mit Secret Key) |
| AC-8 | erfüllt | `tests/sim/bundle.test.ts`; Bündel rechnet identisch (Hash `aee8c823`) |
| AC-9 | erfüllt | `tests/e2e/leaderboard.spec.ts` Fälle 2–9 (gemockt) + Live-Test T08 gegen das echte Projekt; Screenshots `.tmp/evidence/lb-*.png` |
| AC-10 | erfüllt | `tests/e2e/leaderboard.spec.ts` Fall 1 (offline, keine externen Requests) + alle bisherigen E2E grün |
| AC-11 | erfüllt | Secret-Grep T10 (0 Treffer) |

## Rulings

- **R-1** Supabase-Projekt `opteamanta` (Ref `hqdvuessvcmtlcsysrmi`, eu-west-3, Postgres 17) war leer; Zugriff per Access Token (`supabase_token.txt`) und Secret Key (`supabase_secret.txt`), beide gitignored (Planung).
- **R-2** Daily: unbegrenzte Versuche, bester geprüfter Lauf zählt (Nutzerentscheidung); kein Captcha, keine Nickname-Blockliste (Nutzerentscheidungen, Risiko in Spec dokumentiert).
- **R-3** `leaderboard.ts`/`nickname.ts` sind reines DOM und stehen in der Emoji-Ausnahmeliste wie `hud.ts` (Regel für das Canvas unverändert).
- **R-4** `npm audit` (Nexus-Policy-Feed) meldet 113 Funde nur in älteren Dev-Werkzeugen (eslint, typescript-eslint, vite, vitest, free-tex-packer-core); Laufzeit-Abhängigkeiten 0 Funde, Trivy 0 Funde. Nicht durch diese Spec eingeführt.

## Open questions

- **O-1** (Nutzer) Die Bestenliste liegt bei kleineren Fensterhöhen unterhalb des sichtbaren Bereichs der Seitenleiste; ggf. später einklappbare Turmliste oder Platzierung über dem Turm-Block.

## Log

- 2026-11-10: Spec 3b freigegeben, ADR-0004 (proposed). Plan + 10 Briefs geschrieben, wartet auf Freigabe.
- 2026-11-11: T01–T10 abgeschlossen; typecheck, lint, test 179/179, build, test:e2e 26/26, test:integration 38/38 grün; Push nach `main`.
- 2026-11-11: Netlify-Build hing bei `npm install` (8 min, „Exit handler never called“): 28 `resolved`-URLs im Lockfile zeigten auf den Sandbox-Spiegel (interner Host, für Netlify unerreichbar). Fix: auf registry.npmjs.org umgestellt (Integrität stichprobenhaft geprüft), sauberes `npm ci` nur gegen das öffentliche Registry ok, Schutztest `tests/lockfile.test.ts`. Netlify-Badge verdeckte „Daily spielen“ → `padding-bottom: 80px`. Live-Test auf opteamanta.netlify.app: kompletter Daily-Ablauf bis „Geprüft · Tagesrang 1“, 0 Konsolenfehler.
