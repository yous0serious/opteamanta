# Plan: Bestenliste mit Supabase (3b)

**Spec:** [spec.md](../../../specs/leaderboard-supabase/spec.md) · **Ledger:** [ledger.md](ledger.md) · **ADR:** [0004](../../knowledge/decisions/0004-leaderboard-architecture.md)
**Branch:** `feature/leaderboard-supabase` · **Size:** L (10 Tasks in 4 Phasen)
**Gate:** Der Nutzer gibt Plan + Briefs frei, bevor T01 startet.

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Backend-Fundament | T01, T02, T03 | Migrationen eingespielt; Anonymous Auth an; `npm run build:sim` erzeugt Bündel; RLS-Smoke per `curl` |
| 2 Server-Logik | T04, T05, dann T06 | Functions deployt; Integrationstests (`npm run test:integration`) grün; CPU-Messung im Ledger |
| 3 Client | T07, T08 ∥ T09 | Daily-Lauf live spielbar und eingereicht; E2E mit Mocks grün |
| 4 Nachweis | T10 | Alle ACs mit Nachweis; Push nach `main` |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Supabase-CLI, `supabase/` initialisieren, Projekt verknüpfen, Anonymous Auth aktivieren, Function-Secrets setzen | – | hannibal | – | AC-11 |
| T02 | Migration: Tabellen, Constraints, RLS, RPCs, `pg_cron`-Jobs | T01 | hannibal | T03 | AC-1, AC-6, AC-7 |
| T03 | Sim-Bündel für Deno (`npm run build:sim`) + Bündel-Test | – | hannibal | T02 | AC-8 |
| T04 | Gemeinsame, testbare Logik (`supabase/functions/_shared/logic.ts`): Tages-Seed, Berliner Datum/Woche, Session-/Replay-Abgleich, Plausibilität | T03 | hannibal | – | AC-2, AC-3 |
| T05 | Edge Functions `start-run`, `submit-run`, `verify-runs`; Deploy | T02, T04 | hannibal | – | AC-2–AC-5 |
| T06 | Integrationstests gegen Supabase + CPU-Messung | T05 | general (background) | T07 | AC-1–AC-7 |
| T07 | Client: supabase-js, anonyme Anmeldung, Daily-Session-Flow, Nickname-Dialog, Einreichen + Status | T05 | hannibal | T06 | AC-9, AC-10 |
| T08 | UI: Reiter „Bestenliste“ (Heute/Woche, eigener Rang), Ticker-Bestwerte | T07 | hannibal | T09 | AC-9 |
| T09 | E2E mit gemockten Supabase-Antworten (Playwright `page.route`) + Offline-Fall | T07 | general (background) | T08 | AC-9, AC-10 |
| T10 | Gesamtverifikation, Secret-Grep, README (Betrieb: Secrets rotieren, Läufe sperren), Ledger, Push | T06, T08, T09 | hannibal | – | AC-10, AC-11, alle |

## Arbeitsregeln

- Secrets nur aus `supabase_token.txt`/`supabase_secret.txt` in Shell-Variablen lesen, nie ausgeben, nie in Dateien unter Git schreiben.
- Jede DB-Änderung als neue Migration (keine Änderungen am Live-Schema per Hand).
- Commits als `yous0serious`; Push nach `main` erst nach T10.
