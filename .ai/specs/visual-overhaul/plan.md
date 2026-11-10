# Plan: Grafik-Overhaul „Living Whiteboard 2.0“ (2a)

**Spec:** [spec.md](../../../specs/visual-overhaul/spec.md) · **Ledger:** [ledger.md](ledger.md)
**Branch:** `feature/foundation-phaser-port` (fortgesetzt; MR erst nach 2a) · **Size:** L (10 Tasks in 4 Phasen)
**Gate:** Der Nutzer gibt Plan + Briefs frei, bevor T01 startet.

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Pipeline | T01, T02 | `npm run assets && npm run check:assets` grün, Atlas ≤ 3 MB, Kontaktabzug aller Frames in `.tmp/evidence/visual/atlas-sheet.png` |
| 2 Grundgerüst | T03, T04 | Preload-Szene lädt Atlas + Font; Whiteboard/Pfad/DONE-Haufen sichtbar; Spec-1-Smoke grün |
| 3 Spielobjekte & Effekte | T05, T06, T07 (seriell, gleiche Dateien), T09 parallel | Alle Objekte als Sprites, Filter/Juice aktiv, `npm run build` grün |
| 4 Nachweis | T08, T10 | Jedes AC mit Nachweis im Ledger |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Asset-Pipeline: Abhängigkeiten, `assets-src/`-Manifest, Kenney-Dateien, `npm run assets`, `check:assets`, `CREDITS.md` | – | hannibal | – | AC-2 |
| T02 | Eigene Requisiten-SVGs (Post-it, Magnet, Klebeband, Papierkugel, Projektile, 8 Typ-Symbole, Whiteboard-Textur) | T01 | hannibal | – | AC-3, AC-10 |
| T03 | Boot/Preload-Szene, Font, Effektstufe `fx`, reduzierte Bewegung, Ebenen-Struktur mit Filtern | T01 | hannibal | – | AC-8, AC-9, AC-11 |
| T04 | Whiteboard, Klebeband, Marker-Pfad-Animation, DONE-Haufen (Logik als reines Modul) | T02, T03 | hannibal | – | AC-6, AC-10 |
| T05 | Türme als Magnet-Badges mit Figuren und Animationen | T04 | hannibal | T09 | AC-4 |
| T06 | Gegner als Post-its, Kill-Animation in den Haufen, Boss | T05 | hannibal | T09 | AC-5, AC-6 |
| T07 | Projektile, Partikel-Emitter, Filter, Hitstop, Squash, Wellen-Banner | T06 | hannibal | T09 | AC-7, AC-8, AC-9 |
| T08 | `?bench=1`-Szenario mit Frame-Zeit-Messung | T07 | hannibal | T10 | AC-12 |
| T09 | Tests: Unit (Haufen, Emoji-Freiheit, Credits) + E2E (Filter, reduced motion, Requests, Screenshots) | T04 (Interfaces) | general (background) | T05–T07 | AC-2, AC-3, AC-6, AC-8, AC-9, AC-11, AC-13 |
| T10 | Gesamtverifikation, README, Ledger, Trivy-Delta | T07, T09 | hannibal | T08 | AC-1, AC-13 |

## Arbeitsregeln

- `src/sim/` wird nicht angefasst (AC-1); jeder Task prüft `git diff 6bd19c8 -- src/sim`.
- Jeder Task endet mit grünem Verify-Befehl und Ledger-Zeile; ein Commit pro Task (Conventional Commits).
- Tests nutzen Literalwerte aus der Spec.
- Visuelle Tasks liefern Screenshots nach `.tmp/evidence/visual/`.
