# ADR-0004: Architektur der Bestenliste

**Status:** proposed
**Date:** 2026-11-10
**Authors:** Projektteam Backlog Defense
**References:** [Spec leaderboard-supabase](../../../specs/leaderboard-supabase/spec.md), ADR-0002, [Anti-Cheat-Analyse](../requirements/anti-cheat.md)

## Context

Die Bestenliste ist öffentlich, der Client und sein Publishable Key ebenso. Scores müssen deshalb serverseitig entstehen.
Die Simulation ist deterministisch (ADR-0002); ein Challenge-Lauf lässt sich in ~0,3 s (Node) nachrechnen. Supabase Edge
Functions haben 2 s CPU pro Aufruf; `EdgeRuntime.waitUntil` hebt das Limit nicht auf. Ohne Vorgaben könnten Spieler sich
günstige Seeds aussuchen („Seed-Shopping“) oder fremde Replays einreichen.

## Decision

1. **Server vergibt Läufe:** `start-run` erzeugt eine Session mit Tages-Seed (HMAC mit Function-Secret); `submit-run` akzeptiert nur Replays, die exakt zur eigenen, unbenutzten, nicht abgelaufenen Session passen.
2. **Asynchrone Prüfung:** Einreichungen landen als `pending`; `verify-runs` prüft je Aufruf genau ein Replay (eigenes CPU-Budget), angestoßen durch `submit-run` und minütlich per `pg_cron`/`pg_net`.
3. **Schreiben nur serverseitig, Lesen über RPC:** RLS ohne Client-Schreibrechte auf Lauf-/Einreichungstabellen; Bestenliste über `security definer`-Funktionen.
4. **Eine Simulation:** `src/sim` wird per esbuild für Deno gebündelt; ein Test verhindert veraltete Bündel.

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Sessions + asynchrone Prüfung | Fälschungssicher, Seed-Shopping ausgeschlossen, CPU-Limit pro Replay | Mehr Bausteine (Queue, Cron) | – (gewählt) |
| Inline-Prüfung in `submit-run` | Einfacher, sofortiges Ergebnis | Teilt sich das 2-s-Budget mit Validierung/DB; Ausfall = verlorene Einreichung | Weniger robust; als Optimierung später möglich |
| Client schreibt Score direkt (nur Plausibilität) | Minimal | Beliebig fälschbar | Bestenliste wertlos |
| Eigener Server (Node) statt Edge Functions | Keine CPU-Grenze | Betrieb, Kosten, zweite Plattform | Unverhältnismäßig |

## Consequences

**Positive**

- Score entsteht nur auf dem Server; Manipulation des Clients ist wirkungslos.
- Gleiche Bedingungen für alle durch den Tages-Seed.

**Negative**

- Ergebnis erst nach Sekunden sichtbar (Statusanzeige nötig).
- Bots/TAS bleiben möglich (offen kommuniziert); ohne Captcha nur Standard-Ratenlimits gegen Massen-Accounts.

## Verification

Integrationstests gegen das Supabase-Projekt (RLS, Ablehnungsgründe, Prüfung), CPU-Messung in der Edge-Runtime, Bündel-Test.
