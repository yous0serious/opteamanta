# ADR-0002: Deterministische Simulation mit Replays

**Status:** proposed
**Date:** 2026-11-10
**Authors:** Projektteam Backlog Defense
**References:** [Spec foundation-phaser-port](../../../specs/foundation-phaser-port/spec.md), ADR-0001

## Context

Eine öffentliche Bestenliste ist nur glaubwürdig, wenn Scores nicht einfach per Request
gefälscht werden können. Der Supabase-Key im Browser ist öffentlich; jeder kann die API direkt
aufrufen. Prüfbar wird ein Score nur, wenn der Server den Lauf selbst nachrechnen kann.
Zusätzlich brauchen wir automatisierte Balancing- und Regressionstests ohne Browser.

## Decision

1. Die Spiellogik liegt in `src/sim/`: reines TypeScript ohne Phaser/DOM, feste Tickrate 60 Hz,
   Zufall nur aus einem Seed-RNG (mulberry32), nur IEEE-exakte Arithmetik
   (keine `Math.hypot/pow/sin/cos/atan2/exp/log`, kein `Math.random`, kein `Date`).
2. Die Darstellung (`src/view/`) liest den Zustand und reagiert auf Events der Simulation;
   sie verändert den Zustand nur über Kommandos (`place`, `upgrade`, `sell`, `startWave`).
3. Ein Replay besteht aus Format-Version, Spielversion, Seed, Karte und der Liste angenommener
   Kommandos mit Tick. Es reicht, um den Lauf exakt zu reproduzieren.
4. Eine ESLint-Regel erzwingt die Einschränkungen in `src/sim/`.

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Deterministische Sim + Replay | Score serverseitig nachrechenbar, Replays, Tests ohne Browser | Disziplin nötig (keine verbotenen APIs), feste Tickrate | – (gewählt) |
| Plausibilitätsgrenzen (Score ≤ f(Welle)) | Sehr einfach | Fälschungen innerhalb der Grenzen bleiben möglich | Zu schwach als alleiniger Schutz (bleibt als Zusatzprüfung) |
| Server-autoritatives Spiel (Logik läuft auf dem Server) | Maximal sicher | Echtzeit-Backend, Latenz, Kosten | Unverhältnismäßig für ein Casual-Spiel |
| Keine Prüfung | Kein Aufwand | Bestenliste wertlos | – |

## Consequences

**Positive**

- Die Edge Function in Spec 3 kann `src/sim/` direkt importieren und Scores verifizieren.
- Golden- und Bot-Tests sichern das Balancing ab.

**Negative**

- Rechenzeit der Nachprüfung wächst mit der Laufdauer (Messung über `npm run bench`, Entscheidung in Spec 3).
- Jede Balancing-Änderung macht alte Replays ungültig; Bestenlisten werden pro `gameVersion` geführt.

## Verification

`tests/sim/determinism.test.ts`, `tests/sim/replay.test.ts`, ESLint-Regel für `src/sim/`.
