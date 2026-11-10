# Asset-Lizenzen

Jede Datei in `public/assets/` steht hier mit Quelle, Autor und Lizenz (Spec visual-overhaul AC-2, ADR-0003).
Zulässig sind nur `CC0`, `OFL-1.1` und `eigenes Werk`. Prüfung: `npm run check:assets`.

## Dateien

| Datei | Inhalt | Lizenz |
|---|---|---|
| `game.png` | Spiel-Atlas (generiert von `npm run assets` aus `assets-src/`, Quellen siehe unten) | CC0 (Kenney) + eigenes Werk |
| `game.json` | Frame-Daten zum Atlas (generiert) | eigenes Werk |

## Quellen im Atlas

| Frames | Quelle | Autor | Lizenz |
|---|---|---|---|
| `head/*` | Toon Characters 1, Ordner `PNG/Parts HD` (`head`, `headFocus`, `headShock`) – https://opengameart.org/content/toon-characters-1 (Kenneys eigener Upload; `assets-src/kenney/toon-characters-1/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `fx/*` | Particle Pack (`circle_05`, `spark_04`, `star_06`, `smoke_08`, `dirt_02`) – https://opengameart.org/content/particle-pack-80-sprites (`assets-src/kenney/particle-pack/License.txt`); beim Build Helligkeit → Transparenz umgewandelt | Kenney (www.kenney.nl) | CC0 |
| `prop/*`, `proj/*`, `sym/*`, `ui/*` | Eigene SVGs in `assets-src/props/` | Projekt Backlog Defense | eigenes Werk |

## Schrift

| Paket | Quelle | Lizenz |
|---|---|---|
| Caveat (`@fontsource/caveat`, von Vite gebündelt) | https://fonts.google.com/specimen/Caveat · https://github.com/fontsource/font-files | OFL-1.1 |
