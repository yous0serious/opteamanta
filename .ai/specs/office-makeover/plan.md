# Plan: Büro-Neuauftritt und automatische Daily (4)

**Spec:** [spec.md](../../../specs/office-makeover/spec.md) · **Ledger:** [ledger.md](ledger.md) · **ADR:** [0005](../../knowledge/decisions/0005-office-art-direction.md)
**Branch:** `feature/office-makeover` · **Size:** L (10 Tasks in 4 Phasen)

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Daily + Grundlagen | T01, T02 | Daily automatisch (E2E grün); CC0-Pakete im Repo, Atlas baut, Bench-Referenz gemessen |
| 2 Prototyp | T03 | **Nutzer-Gate (AC-12):** Screenshots der Prototyp-Szene freigegeben |
| 3 Ausbau | T04, T05, T06, T07 (teils parallel), T08 | Alle Rollen, Gegner, Karten, UI und Effekte fertig |
| 4 Nachweis | T09 (Tests, background), T10 | Alle ACs mit Nachweis; Push nach `main`, Live-Test |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Daily automatisch, Auto-Teamname, Namensänderung, Schalter „Freies Spiel“ | – | hannibal | T02 | AC-1, AC-2 |
| T02 | Asset-Aufnahme: Kenney-Pakete (nur genutzte Dateien + License), Manifest, Monster-Zusammenbau im Asset-Build, Nunito, CREDITS; Bench-Referenz vorher | – | hannibal | T01 | AC-8, AC-9 |
| T03 | Prototyp: Bodenrenderer (Parkett, Laufband, Deko), 2 Rollen (Entwickler, PPL) mit Arbeitsplatz + Posen, 2 Gegner (Anforderung, Feature), Effekte, UI-Grundgerüst; Screenshots → Gate | T01, T02 | hannibal | – | AC-3, AC-12 |
| T04 | Alle 5 Rollen: Arbeitsplätze, Posen-Zustandsmaschine, Stufenanzeige, Geschosse/Effekte je Rolle | T03 | hannibal | T05 | AC-4, AC-6 |
| T05 | Alle 8 Gegner: Monster, Laufanimation, Treffer, Tod, Decals, Boss-Leiste, Zerfall/Wachstum | T03 | hannibal | T04 | AC-5, AC-6 |
| T06 | Alle 4 Karten: Bodenvarianten, Laufband-Verlauf, Deko-Platzierung, Start/Ziel (Fachbereich-Tür, Deadline) | T03 | hannibal | T07 | AC-3 |
| T07 | Oberfläche: Kopfleiste, Turmkarten, Bestenliste/Daily-Karte, Dialoge, Icons statt Emojis, Overlays Sieg/Burnout/Welle | T03 | hannibal | T06 | AC-7 |
| T08 | Feinschliff: Effekte für Platzieren/Upgrade/Verkauf/Leck/Wellenende/Sieg/Burnout, fx=low, reduced motion, Canvas-Fallback, Leistung | T04–T07 | hannibal | T09 | AC-6, AC-8, AC-10 |
| T09 | Tests: E2E/Visual-Tests an neue Oberfläche anpassen, neue AC-Tests (Helligkeit, Posen, Effekttypen, Layout 1366 × 768) | T07 | general (background) | T08 | AC-1–AC-7, AC-10 |
| T10 | Gesamtverifikation, Screenshot-Bögen, Bench nachher, README/CREDITS, Push, Live-Test | T08, T09 | hannibal | – | alle |

## Arbeitsregeln

- `src/sim` wird nicht geändert (AC-11); Darstellung liest nur den Sim-Zustand und Events.
- Neue Grafiken nur über `assets-src/` + `npm run assets`; jede Datei in `CREDITS.md`.
- Commits als `yous0serious`; Lockfile nur mit `registry.npmjs.org`-URLs (Test `tests/lockfile.test.ts`).
