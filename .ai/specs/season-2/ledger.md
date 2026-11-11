# Ledger: Saison 2 (5)

**Spec:** [spec.md](../../../specs/season-2/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (Regel-Commit) | Typen (`rte/rta/rto/board`, `meeting/hotfix`, `syncTime`, `phase`, `frozenTime`, Grund `limit`, Ereignisse `synced/businessValue/freeze/axed`), Daten + Konstanten (`RTE_SYNC`, `RTA_RUNWAY`, `RTO_VALUE`, `BOARD_ABILITY`), `supportAction`, `runwayFactor` in `hurt`, RTO beim Wellenende, Freeze in der Gegnerschleife, `jamTime`, Wellenmix, `stateHash`, Version 0.3.0; Sim-Bündel neu gebaut. Ruling: Unterstützungsrollen handeln nur während laufender Wellen (keine Effekte in der Planungsphase). |
| T02 | done | (Regel-Commit) | general: `roles2` (41), `enemies2` (12), `season2` (6) + Anpassung `data`, `waves`, `logic`; 242/242 grün, keine Abweichungen. Ruling: Vorstands-Phase wechselt auch, wenn kein Nicht-Boss zum Einstampfen da ist (per Test festgeschrieben). |
| T03 | done | (Regel-Commit) | Bots: starker Bot mit RTA (Abdeckung), RTE (meiste Teammitglieder in Reichweite), RTO/Vorstand (ruhige Felder), Vorstand ab Welle 6; Referenz-Bot-Rotation + RTO/RTA/RTE; `npm run balance` misst Rollennutzung. Tuning: Läufe enden fast immer in Boss-Wellen (16/21/26) → Boss-Faktor 2,6 trifft Median 21. Alle Ziele ✓ (Referenzwerte v0.3.0 in der Spec). |
| T04 | todo | – | Ruling: Function-Deploy erst in T13 (Live-Client läuft bis zum Push mit 0.2.0; ein 0.3.0-Server würde dessen Läufe ablehnen). Integrationstests ebenfalls in T13. |
| T05 | todo | – | |
| T06 | todo | – | |
| T07 | todo | – | |
| T08 | todo | – | |
| T09 | todo | – | |
| T10 | todo | – | |
| T11 | todo | – | |
| T12 | todo | – | |
| T13 | todo | – | |

## Rulings

- **R-1** Pakete A (Optik, Sound, Teilen) und B (neue Rollen/Gegner) zusammen als Saison 2 (Nutzerentscheidung); RTO = Release Train Owner (Nutzer), Rollen RTE, RTA, RTO, Vorstand; Gegner Meeting-Einladung, Hotfix; Effekte „Maximal + Schalter“; Musik Warteschleife + Funk + Boss; Teilen Text + Bildkarte.
- **R-2** Audio-Mischlösung (ADR-0006) nach Recherche: CC0-Musik/-SFX, fehlende Büro-Geräusche prozedural.

## Open questions

- keine

## Log

- 2026-11-11: Spec 5 + ADR-0006 + Plan entworfen.
