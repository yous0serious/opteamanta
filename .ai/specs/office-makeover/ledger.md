# Ledger: Büro-Neuauftritt und automatische Daily (4)

**Spec:** [spec.md](../../../specs/office-makeover/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commits) | `src/online/names.ts` (Generator, alle 400 Kombinationen ≤ 16 Zeichen und DB-gültig, Test), `ensureProfile` mit bis zu 5 Versuchen, `DailyFlow.boot/start/playFree/rename`, `Controller.restartOverride/startFree`; Schalter Daily/Freies Spiel, Teamname-Chip mit Umbenennen-Dialog. Live gegen Supabase: Daily ohne Klick (start-run 1×), Name „Quick Sloth 7478“, Auto-Einreichen → „Geprüft · Tagesrang 1“, Nochmal → neue Daily, Freies Spiel ohne Daily, Umbenennen ok, 0 Konsolenfehler. general: `tests/e2e/leaderboard.spec.ts` 13 Fälle, Gesamtsuite 30/30. Ruling: Kommt die Session erst, nachdem der Spieler losgelegt hat, wird sie für den nächsten Neustart aufgehoben (spart einen start-run). |
| T02 | in_progress | – | 15 Kenney-Pakete gesichtet (alle CC0 laut `License.txt`); übernommen: Posen (5 Rollen × 14), Monster-Baukasten, Topdown-Shooter-Böden/Möbel (80), Generic Items (16), Splats, Rauch. Bench vorher (Sandbox, nur Canvas – WebGL in der Sandbox nicht aktivierbar, 15 Flag-Kombinationen geprüft): fx=high avg 25,0 / p95 31,7 ms, fx=low avg 23,6 / p95 28,3 ms. Ruling: Look darf nicht von WebGL-Filtern abhängen (Glow/Licht als additive Sprites). |
| T03 | todo | – | |
| T04 | todo | – | |
| T05 | todo | – | |
| T06 | todo | – | |
| T07 | todo | – | |
| T08 | todo | – | |
| T09 | todo | – | |
| T10 | todo | – | |

## Rulings

- **R-1** Nur kostenlose Assets (Nutzer); Stil „Cartoon-Büro“ (Nutzerwahl, ADR-0005); Prototyp-Gate vor dem Ausbau.
- **R-2** Daily immer automatisch, freies Spiel optional; Teamname automatisch und änderbar (Nutzerentscheidungen).
- **R-3** Kenney-Pakete über Kenneys OpenGameArt-Uploads bezogen (kenney.nl aus der Sandbox 403); Lizenz je Zip geprüft: alle 15 gesichteten Pakete CC0.

## Open questions

- keine

## Log

- 2026-11-11: Recherche (frei/kostenpflichtig/Phaser-4-Effekte), Pakete gesichtet, Spec 4 + ADR-0005 + Plan entworfen.
