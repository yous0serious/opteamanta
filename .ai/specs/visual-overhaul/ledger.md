# Ledger: Grafik-Overhaul „Living Whiteboard 2.0“ (2a)

**Spec:** [spec.md](../../../specs/visual-overhaul/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | d8acef5 | Atlas 396×399, 21 Frames (15 Köpfe aus `Parts HD`, 6 Partikel), 110 KB; `check:assets` Exit 0, Gegenprobe Dummy-Datei Exit 1. Ruling: HD-Köpfe (106 px) auf 56 px skaliert, scharf bei 2× DPR. Ruling: Kenney-Dateien im Repo nach Rolle benannt (`dualo-head.png` …), Original-Pfade in `CREDITS.md`. Ruling: Packer `MaxRectsBin`/`BestAreaFit`, max. 1024 px (die Standard-Packer erzeugten einen 70×1278-Streifen). |
| T02 | done | 8162e9d | 24 eigene SVGs; Atlas 730×753, 45 Frames, 251 KB; Kontaktabzug `.tmp/evidence/visual/atlas-sheet-v2.png`. Ruling: zusätzliche Frames `prop/magnet-disc` (Innenscheibe) und `ui/arrow` (Richtungszeiger). Ruling: Kenney-Partikel sind weiß auf Schwarz (für additives Blending) – Build-Option `lumaToAlpha` wandelt Helligkeit in Transparenz, damit sie auf dem hellen Whiteboard sichtbar und einfärbbar sind. Boss-Symbol nach Sichtprüfung neu gezeichnet. |
| T03 | done | (T03/T04-Commit) | Preload-Szene mit Marker-Fortschrittsbalken, Caveat (600/700) über `@fontsource`, Effektstufe `?fx`, Ebenen mit Filtern pro Ebene; `window.__bd.debug` (`filters`, `motion`, `renderer`, `pile`, `scene`). Ruling R-4 (siehe unten). Ruling: Filter werden nur im WebGL-Renderer gesetzt und gemeldet. |
| T04 | done | (T03/T04-Commit) | Whiteboard-Textur, eingefärbtes Klebeband (vorgefärbte Varianten je Karte), Post-it-Karten, Marker-Strich bei Wellenbeginn, DONE-Haufen (`DonePile`, max. 60, Pfadzellen ausgespart); Haufen im Browser geprüft (12 Kugeln sichtbar). Ruling: Klebeband als gestrecktes Bild statt TileSprite (TileSprite ignoriert in Phaser 4 Tint/Blend). Bugfix aus Spec 1: Canvas wurde um 2,5 % zu groß skaliert und unten/rechts abgeschnitten (Phaser maß den 12-px-Rahmen mit) – Rahmen jetzt auf `#frame`, Canvas exakt 960×600. |
| T05 | todo | – | |
| T06 | todo | – | |
| T07 | todo | – | |
| T08 | todo | – | |
| T09 | todo | – | |
| T10 | todo | – | |

## Rulings

- **R-1** Kenney-Assets kommen von Kenneys eigenen OpenGameArt-Uploads. kenney.nl ist zwar per Sandbox-Policy freigegeben, liefert Downloads aber nur über einen JavaScript-Spendendialog und blockt Skript-Abrufe; das wird nicht umgangen (Planung).
- **R-2** Papier- und Markergeräusche werden in 2b prozedural erzeugt (kein CC0-Pack verfügbar); Drittanbieter-Spiegel wie gamesounds.xyz sind ausgeschlossen (ADR-0003).
- **R-3** Werkzeuge in der Sandbox geprüft: `sharp` 0.x (libvips 8.18.7, inkl. `feTurbulence`), `free-tex-packer-core` 0.3.9 (Phaser-Atlas-Export), `@fontsource/caveat` (OFL-1.1) (Planung).
- **R-4** Farben werden beim Asset-Build vorgefärbt (`tools/asset-variants.ts`, Paletten direkt aus den Sim-Daten: Gegner, Türme, Karten, Stiftfarben), statt zur Laufzeit per Tint. Grund: Der Sandbox-Chromium hat kein WebGL (auch SwiftShader startet nicht), Phaser fällt auf Canvas zurück, und der Canvas-Renderer von Phaser 4 kann weder Tint noch Filter. So sieht das Spiel auch im Canvas-Fallback richtig aus. Atlas: 179 Frames, 627 KB (T03/T04).
- **R-5** Folge aus R-4: Nachweise für WebGL-Effekte (AC-8 Filter, AC-12 Performance) kommen vom Host des Nutzers; E2E-Tests prüfen Filter nur, wenn `debug.renderer()` = `webgl`, sonst wird `[]` erwartet (T03).
- **R-6** Veröffentlichung auf dem privaten GitHub-Repo `yous0serious/opteamanta` (Nutzerwunsch, für Netlify): neuer Verlauf ab einem Snapshot-Commit mit privater Identität (`yous0serious`, GitHub-Noreply-Adresse); ab hier committet das lokale Repo mit dieser Identität. Der frühere Verlauf bleibt lokal unter `archive/*`. Lockfile-URLs auf `registry.npmjs.org` umgestellt (Integrität unverändert), interne Hostnamen/Bezeichnungen in Doku neutralisiert, `netlify.toml` ergänzt. Token liegt nur lokal (`github_token.txt`, gitignored) und wird nicht in der Git-Konfiguration gespeichert.
- **R-7** `body[data-ready="1"]` signalisiert, dass die Spielszene Eingaben annimmt; der Smoke-Test wartet darauf (vorher gingen Klicks während des Preloads verloren – Smoke-Fall 4 rot).

## Open questions

- **O-1** (aus Spec 1, vor Spec 3) Balancing: Endlos-Läufe enden praktisch nie.

## Log

- 2026-11-10: Spec 2a freigegeben (`196abd5`), Figuren-Mapping bestätigt. Plan, 10 Briefs geschrieben. Wartet auf Freigabe des Plans.
