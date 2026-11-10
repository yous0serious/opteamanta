# Plan: Balancing & Challenge-Modus (3a)

**Spec:** [spec.md](../../../specs/balancing-challenge/spec.md) · **Ledger:** [ledger.md](ledger.md)
**Branch:** `feature/balancing-challenge` · **Size:** M (7 Tasks in 3 Phasen)
**Gate:** Der Nutzer gibt Plan + Briefs frei, bevor T01 startet.

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Mechanik | T01, T02, T03 | `npm run typecheck && npm run lint`; `npm run balance` läuft und gibt die Kennzahlen aus |
| 2 Tuning | T04, dann T05 ∥ T06 | AC-3 bis AC-7 laut `npm run balance`/`bench` erfüllt; Referenzwerte in der Spec; `npm test` grün |
| 3 Nachweis | T07 | Jedes AC mit Nachweis im Ledger; Push nach `main` (Netlify) |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Sim: Modi, Sieg, Replay-Format 2, `GAME_VERSION` 0.2.0, Parser-Härtung | – | hannibal | – | AC-1, AC-2 |
| T02 | Sim: Balancing-Hebel als `BalanceConfig` (exponentielles HP-Wachstum, entkoppelte Belohnung, Wellenbonus, Gegnerzahl, Boss) | T01 | hannibal | – | AC-8 |
| T03 | Starker Bot + `npm run balance` (Kennzahlen über 20 Läufe) | T02 | hannibal | – | AC-3–AC-7 |
| T04 | Tuning-Schleife; Referenzwerte v0.2.0 in die Spec | T03 | hannibal | – | AC-3–AC-8 |
| T05 | Tests: Spec-1-Werte → v0.2.0, Modi/Sieg, Replay-Format 2 | T04 | general (background) | T06 | AC-1, AC-2, AC-8 |
| T06 | View: Modus-Wahl, „Welle n / 30“, Sieg-Bildschirm, E2E-Fall | T01 | hannibal | T05 | AC-9 |
| T07 | Gesamtverifikation, Ledger, README, Push | T05, T06 | hannibal | – | alle |

## Arbeitsregeln

- Jeder Task endet mit grünem Verify-Befehl und Ledger-Zeile; Commits als `yous0serious` (Conventional Commits).
- Tests nutzen Literalwerte aus der Spec (Tabelle „Referenzwerte v0.2.0“).
- Push nach `main` erst nach T07 (Netlify deployt `main`).
