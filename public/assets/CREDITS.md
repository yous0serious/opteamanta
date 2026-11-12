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
| `char/*` | Toon Characters 1, Ordner `PNG/Poses HD` (Male adventurer, Female adventurer, Female person, Male person, Robot) – https://opengameart.org/content/toon-characters-1 (`assets-src/kenney/toon-characters-1/License.txt`); Saison-2-Rollen (`char/rte|rta|rto|board/*`), Porträts `head/rte|rta|rto|board` und Statisten (`char/npc*/*`) beim Build umgefärbt (`tools/characters.ts`), Zubehör (Mütze, Brillen, Krawatte, Fliege) eigene SVGs | Kenney (www.kenney.nl); Projekt Backlog Defense | CC0 + eigenes Werk |
| `enemy/*` | Monster Builder Pack, Ordner `PNG/Default`, beim Build zusammengesetzt und eingefärbt (`tools/monsters.ts`) – https://opengameart.org/content/monster-builder-pack (`assets-src/kenney/monster-builder-pack/License.txt`); Ticket-Symbole, Post-it und Krone (`prop/crown`) eigene SVGs | Kenney (www.kenney.nl); Projekt Backlog Defense | CC0 + eigenes Werk |
| `tile/*` | Topdown Shooter, Ordner `PNG/Tiles` (Böden, Teppiche, Möbel, Pflanzen) – https://opengameart.org/content/topdown-shooter (`assets-src/kenney/topdown-shooter/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `item/*` | Generic Items, Ordner `PNG/Colored` – https://opengameart.org/content/generic-items (`assets-src/kenney/generic-items/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `splat/*` | Splat Pack, Ordner `PNG/Default (256px)`, beim Build eingefärbt – https://opengameart.org/content/splat-pack (`assets-src/kenney/splat-pack/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `puff/*` | Smoke Particles, Ordner `PNG/White puff` – https://opengameart.org/content/smoke-particle-assets (`assets-src/kenney/smoke-particles/License.txt`) | Kenney (www.kenney.nl) | CC0 |
| `light/*` | Light Masks, Ordner `Default` (`window_k_blur`) – https://kenney.nl/assets/light-masks (`assets-src/kenney/light-masks/License.txt`); beim Build geschert, weichgezeichnet, Helligkeit → Transparenz und warm eingefärbt | Kenney (www.kenney.nl) | CC0 |
| `emote/*` | Emotes Pack, Ordner `PNG/Vector/Style 4` – https://kenney.nl/assets/emotes-pack (`assets-src/kenney/emotes-pack/License.txt`) | Kenney (www.kenney.nl) | CC0 |

## App-Icons (außerhalb von `public/assets/`)

| Datei | Inhalt | Lizenz |
|---|---|---|
| `../icon.svg`, `../icon-192.png`, `../icon-512.png`, `../icon-maskable-512.png`, `../apple-touch-icon.png` | Web-App-Icon (Post-it „BD“), PNGs aus dem SVG gerendert | eigenes Werk |

## Schrift

| Paket | Quelle | Lizenz |
|---|---|---|
| Caveat (`@fontsource/caveat`, von Vite gebündelt) | https://fonts.google.com/specimen/Caveat · https://github.com/fontsource/font-files | OFL-1.1 |

## Audio

Jede Datei in `public/audio/` steht hier mit Quelle, Autor und Lizenz (Spec season-2 AC-10/AC-14, ADR-0006). Nur `CC0` oder `eigenes Werk`. Nachweise: `assets-src/audio/SOURCES.md`. Prüfung: `npm run check:assets`.

| Datei | Quelle | Autor | Lizenz |
|---|---|---|---|
| `audio/music/music-planning.mp3` | https://opengameart.org/content/two-left-socks | congusbongus | CC0 |
| `audio/music/music-wave.mp3` | https://opengameart.org/content/raspberry-jam | congusbongus | CC0 |
| `audio/music/music-boss.mp3` | https://opengameart.org/content/hard-boss-battle-1 | MintoDog | CC0 |
| `audio/music/jingle-victory.mp3` | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 |
| `audio/music/jingle-gameover.mp3` | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 |
| `audio/music/jingle-wave.mp3` | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 |
| `audio/music/jingle-boss.mp3` | https://opengameart.org/content/85-short-music-jingles | Kenney | CC0 |
| `audio/sfx/click.mp3` | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 |
| `audio/sfx/select.mp3` | https://opengameart.org/content/interface-sounds | Kenney | CC0 |
| `audio/sfx/place.mp3` | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 |
| `audio/sfx/upgrade.mp3` | https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc | Kenney | CC0 |
| `audio/sfx/sell.mp3` | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 |
| `audio/sfx/coin.mp3` | https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips | Kenney | CC0 |
| `audio/sfx/hit.mp3` | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 |
| `audio/sfx/kill.mp3` | https://opengameart.org/content/pop-sounds | cogitollc | CC0 |
| `audio/sfx/split.mp3` | https://opengameart.org/content/pop-sounds | cogitollc | CC0 |
| `audio/sfx/boss.mp3` | https://opengameart.org/content/alarm-2 | frenchyboy | CC0 |
| `audio/sfx/leak.mp3` | https://opengameart.org/content/interface-sounds | Kenney | CC0 |
| `audio/sfx/throw.mp3` | https://opengameart.org/content/air-woosh-move | almitory | CC0 |
| `audio/sfx/sync.mp3` | https://opengameart.org/content/pleasing-bell-sound-effect | Spring Spring | CC0 |
| `audio/sfx/freeze.mp3` | https://opengameart.org/content/sci-fi-sounds | Kenney | CC0 |
| `audio/sfx/axe.mp3` | https://opengameart.org/content/various-paper-sound-effects | luckius | CC0 |
| `audio/sfx/typing.mp3` | https://opengameart.org/content/typing-soundeffect | johndekale | CC0 |
| `audio/sfx/combo.mp3` | https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc | Kenney | CC0 |
| `audio/sfx/applause.mp3` | https://opengameart.org/content/well-done | qubodup | CC0 |
| `audio/sfx/jam.mp3` | https://opengameart.org/content/interface-sounds | Kenney | CC0 |
| `audio/sfx/businessValue.mp3` | https://opengameart.org/content/50-rpg-sound-effects | Kenney | CC0 |

