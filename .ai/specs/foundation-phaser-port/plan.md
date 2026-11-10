# Plan: Fundament – Port auf Phaser 4 mit deterministischer Simulation

**Spec:** [spec.md](../../../specs/foundation-phaser-port/spec.md) · **Ledger:** [ledger.md](ledger.md)
**Branch:** `feature/foundation-phaser-port` · **Size:** M (8 Tasks in 4 Phasen)
**Gate:** Der Nutzer gibt Spec + Briefs frei, bevor T01 startet.

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Gerüst | T01 | `npm ci && npm run build && npm run typecheck && npm run lint && npm test` grün |
| 2 Simulation | T02, dann T03 ∥ T04 | `npm test` grün (alle Suites aus T04), `npm run bench` läuft |
| 3 Darstellung | T05, T06 | `npm run build` grün, manuelle Spielrunde über 3 Wellen ohne Konsolenfehler |
| 4 Nachweis | T07 ∥ T08 | Jedes AC mit Nachweis im Ledger |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Projektgerüst: Vite, TS, Phaser, Vitest, ESLint inkl. Sim-Reinheitsregel | – | hannibal | – | AC-1, AC-2, AC-9 |
| T02 | Simulation `src/sim/` (Daten, RNG, Game, Kommandos, Events, Hash, Replay) | T01 | hannibal | – | AC-3–AC-8, AC-10 |
| T03 | Bot, Replay-CLI, Benchmark (`tools/`) | T02 | hannibal | T04 | AC-10, AC-13 |
| T04 | AC-Tests der Simulation (`tests/sim/`) | T02 | general (background) | T03, T05, T06 | AC-3–AC-10 |
| T05 | Phaser-Spielfeld: Szene, Fixed-Step-Loop, Rendering, Eingabe | T02 | hannibal | T04 | AC-11, AC-12 |
| T06 | DOM-HUD, Audio, Ticker, Replay-Export, URL-Parameter | T05 | hannibal | T04 | AC-10, AC-11 |
| T07 | Playwright-Smoke-Test + Screenshots alt/neu | T06 | general (background) | T08 | AC-10, AC-11, AC-12 |
| T08 | README, Gesamtverifikation, Ledger | T03, T04, T06 | hannibal | T07 | AC-1, AC-2, AC-13 |

## Arbeitsregeln

- Jeder Task endet mit grünem Verify-Befehl und aktualisierter Ledger-Zeile.
- Tests ändern sich zusammen mit dem Code, den sie abdecken.
- Tests nutzen Literalwerte aus der Spec, keine aus `src/sim/data` importierten Konstanten.
- Commits: Conventional Commits, ein Commit pro Task inkl. Ledger-Zeile.
