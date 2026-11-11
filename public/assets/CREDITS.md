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
| `char/*` | Toon Characters 1, Ordner `PNG/Poses HD` (Male adventurer, Female adventurer, Female person, Male person, Robot) – https://opengameart.org/content/toon-characters-1 (`assets-src/kenney/toon-characters-1/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `enemy/*` | Monster Builder Pack, Ordner `PNG/Default`, beim Build zusammengesetzt und eingefärbt (`tools/monsters.ts`) – https://opengameart.org/content/monster-builder-pack (`assets-src/kenney/monster-builder-pack/License.txt`); Ticket-Symbole, Post-it und Krone (`prop/crown`) eigene SVGs | Kenney (www.kenney.nl); Projekt Backlog Defense | CC0 + eigenes Werk |
| `tile/*` | Topdown Shooter, Ordner `PNG/Tiles` (Böden, Teppiche, Möbel, Pflanzen) – https://opengameart.org/content/topdown-shooter (`assets-src/kenney/topdown-shooter/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `item/*` | Generic Items, Ordner `PNG/Colored` – https://opengameart.org/content/generic-items (`assets-src/kenney/generic-items/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `splat/*` | Splat Pack, Ordner `PNG/Default (256px)`, beim Build eingefärbt – https://opengameart.org/content/splat-pack (`assets-src/kenney/splat-pack/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `puff/*` | Smoke Particles, Ordner `PNG/White puff` – https://opengameart.org/content/smoke-particle-assets (`assets-src/kenney/smoke-particles/License.txt`) | Kenney (www.kenney.nl) | CC0 |

## Schrift

| Paket | Quelle | Lizenz |
|---|---|---|
| Caveat (`@fontsource/caveat`, von Vite gebündelt) | https://fonts.google.com/specimen/Caveat · https://github.com/fontsource/font-files | OFL-1.1 |
