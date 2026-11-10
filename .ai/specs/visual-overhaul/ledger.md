# Ledger: Grafik-Overhaul „Living Whiteboard 2.0“ (2a)

**Spec:** [spec.md](../../../specs/visual-overhaul/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | d8acef5 | Atlas 396×399, 21 Frames (15 Köpfe aus `Parts HD`, 6 Partikel), 110 KB; `check:assets` Exit 0, Gegenprobe Dummy-Datei Exit 1. Ruling: HD-Köpfe (106 px) auf 56 px skaliert, scharf bei 2× DPR. Ruling: Kenney-Dateien im Repo nach Rolle benannt (`dualo-head.png` …), Original-Pfade in `CREDITS.md`. Ruling: Packer `MaxRectsBin`/`BestAreaFit`, max. 1024 px (die Standard-Packer erzeugten einen 70×1278-Streifen). |
| T02 | done | 8162e9d | 24 eigene SVGs; Atlas 730×753, 45 Frames, 251 KB; Kontaktabzug `.tmp/evidence/visual/atlas-sheet-v2.png`. Ruling: zusätzliche Frames `prop/magnet-disc` (Innenscheibe) und `ui/arrow` (Richtungszeiger). Ruling: Kenney-Partikel sind weiß auf Schwarz (für additives Blending) – Build-Option `lumaToAlpha` wandelt Helligkeit in Transparenz, damit sie auf dem hellen Whiteboard sichtbar und einfärbbar sind. Boss-Symbol nach Sichtprüfung neu gezeichnet. |
| T03 | done | (T03/T04-Commit) | Preload-Szene mit Marker-Fortschrittsbalken, Caveat (600/700) über `@fontsource`, Effektstufe `?fx`, Ebenen mit Filtern pro Ebene; `window.__bd.debug` (`filters`, `motion`, `renderer`, `pile`, `scene`). Ruling R-4 (siehe unten). Ruling: Filter werden nur im WebGL-Renderer gesetzt und gemeldet. |
| T04 | done | (T03/T04-Commit) | Whiteboard-Textur, eingefärbtes Klebeband (vorgefärbte Varianten je Karte), Post-it-Karten, Marker-Strich bei Wellenbeginn, DONE-Haufen (`DonePile`, max. 60, Pfadzellen ausgespart); Haufen im Browser geprüft (12 Kugeln sichtbar). Ruling: Klebeband als gestrecktes Bild statt TileSprite (TileSprite ignoriert in Phaser 4 Tint/Blend). Bugfix aus Spec 1: Canvas wurde um 2,5 % zu groß skaliert und unten/rechts abgeschnitten (Phaser maß den 12-px-Rahmen mit) – Rahmen jetzt auf `#frame`, Canvas exakt 960×600. |
| T05 | done | (T05–T07-Commit) | Magnet-Badges: Ring (vorgefärbt je Rolle, `off` grau), Scheibe, Kenney-Kopf (normal/Fokus/Schock), Glanz, Richtungspfeil, Sterne; Erscheinen (Back-Out), Pop beim Upgrade, Squash beim Schuss, Wippen (aus bei reduzierter Bewegung). Canvas-Fallback zeichnet eigene Schatten. |
| T06 | done | (T05–T07-Commit) | Post-its je Typ mit Marker-Symbol, Treffer-Aufblitzen über weißen Frame (statt Tint, Canvas-tauglich), Boss mit Eselsohr-Post-it, Namensschild und pulsierendem Glow (nur WebGL+high, registriert als `boss:Glow`). Kill: Zerknüllen (150 ms) + Bogenflug (600 ms) in den DONE-Haufen; Sichtprüfung: 49 Kugeln nach Boss-Welle. |
| T07 | done | (T05–T07-Commit) | Projektile als Sprites (Kaffeebohne, Fragezeichen, Kreispfeil, Pinnnadel) mit Marker-Spur; Entwickler-Strahl in eigener Ebene mit Glow (`beams:Glow`) + `</>`-Partikel; Phaser-Emitter je Familie/Farbe/Stärke (vorgefärbte Kenney-Texturen); Wellen-Banner mit Textmarker; Hitstop 60 ms bei Boss-Kill; Game-Over-Entsättigung (`camera:ColorMatrix`, nur WebGL+high). Ruling: „⚠“-Zeichen im Boss-Banner durch „!“ ersetzt (AC-3). Emoji-Test grün (136/136). |
| T08 | done | (T08/T10-Commit) | `?bench=1` (Seed 12345, Karte matrix, 299 Türme Stufe 3, 150 Gegner, 2 s Aufwärmen + 10 s Messung). Sandbox (Canvas, ohne GPU): `fx=high` avg 23,6 ms / p95 28,3 ms, `fx=low` avg 23,3 ms / p95 26,7 ms. Host-Messung (WebGL) steht aus. |
| T09 | done | b9d6905 | general: 4 Dateien – `donePile.test.ts` (3, AC-6), `no-emoji.test.ts` (1, AC-3), `credits.test.ts` (2, AC-2), `visual.spec.ts` (6 E2E: AC-6, AC-8 ×2, AC-9, AC-11, AC-13). AC-8 läuft in der Sandbox im Canvas-Zweig. Brief-Korrektur: Welle 2 zeigt „Sprint 1“. |
| T10 | done | (T08/T10-Commit) | README (Assets, `fx`, `bench`, Hosting), Trivy-Delta 0 neue CRITICAL/HIGH, Baseline nur Abhängigkeiten (Secret-Scanner meldet die lokale, gitignorierte `github_token.txt` – nicht im Repo). |

## AC-Nachweise

| AC | Ergebnis | Nachweis |
|---|---|---|
| AC-1 | erfüllt | `git diff 6bd19c8 HEAD -- src/sim` leer; `npm test` 136/136; `npm run bench` Hash `088db987`, Score 287 780 |
| AC-2 | erfüllt | `npm run check:assets` (5 Einträge, 633 KB); `tests/view/credits.test.ts` inkl. Gegenprobe |
| AC-3 | erfüllt | `tests/view/no-emoji.test.ts` grün (Spielfeld-Code ohne Emojis, R-8); Screenshots im Sandbox-Chromium ohne Emoji-Fonts ohne Ersatzkästchen |
| AC-4 | erfüllt | `.tmp/evidence/visual/t07/towers.png`, `wave1.png`, `boss.png` (Badges, Sterne, Fokus-/Schock-Gesicht) |
| AC-5 | erfüllt | `t07/wave1.png`, `t07/boss.png` (Post-its mit Symbolen, Lebensbalken, Boss mit Namensschild); Boss-Glow nur WebGL → Host |
| AC-6 | erfüllt | `tests/view/donePile.test.ts`, E2E „AC-6 pile after one wave“; Sichtprüfung 49 Kugeln |
| AC-7 | erfüllt | Code-Review `render/particles.ts` (Phaser-Emitter), Screenshots Strahl/Projektile |
| AC-8 | teilweise | `fx=low` → keine Filter (E2E grün); `fx=high` im Canvas-Fallback → `[]` (E2E grün). **Offen:** WebGL-Zweig (`towers:Shadow`, `enemies:Shadow`, `camera:Vignette`) auf dem Host prüfen |
| AC-9 | erfüllt | E2E „AC-9 reduced motion“ (`motion()` = `{shake:false, hitstop:false}`); Banner/Hitstop im Code an `reducedMotion` gekoppelt |
| AC-10 | erfüllt | `.tmp/evidence/visual/t04/full-shot2.png`, `t07/banner.png` (Textur, Klebeband, Marker-Strich) |
| AC-11 | erfüllt | E2E „AC-11 local requests only, preload done, canvas 960x600“ |
| AC-12 | offen | Sandbox: avg 23,6 ms (Canvas, ohne GPU). **Offen:** Host-Messung mit WebGL (`?bench=1`, `?bench=1&fx=low`) |
| AC-13 | erfüllt | `npm run test:e2e` 15/15 grün; Screenshots `.tmp/evidence/visual/new-*.png` und `t07/*` |

## Rulings

- **R-1** Kenney-Assets kommen von Kenneys eigenen OpenGameArt-Uploads. kenney.nl ist zwar per Sandbox-Policy freigegeben, liefert Downloads aber nur über einen JavaScript-Spendendialog und blockt Skript-Abrufe; das wird nicht umgangen (Planung).
- **R-2** Papier- und Markergeräusche werden in 2b prozedural erzeugt (kein CC0-Pack verfügbar); Drittanbieter-Spiegel wie gamesounds.xyz sind ausgeschlossen (ADR-0003).
- **R-3** Werkzeuge in der Sandbox geprüft: `sharp` 0.x (libvips 8.18.7, inkl. `feTurbulence`), `free-tex-packer-core` 0.3.9 (Phaser-Atlas-Export), `@fontsource/caveat` (OFL-1.1) (Planung).
- **R-4** Farben werden beim Asset-Build vorgefärbt (`tools/asset-variants.ts`, Paletten direkt aus den Sim-Daten: Gegner, Türme, Karten, Stiftfarben), statt zur Laufzeit per Tint. Grund: Der Sandbox-Chromium hat kein WebGL (auch SwiftShader startet nicht), Phaser fällt auf Canvas zurück, und der Canvas-Renderer von Phaser 4 kann weder Tint noch Filter. So sieht das Spiel auch im Canvas-Fallback richtig aus. Atlas: 179 Frames, 627 KB (T03/T04).
- **R-5** Folge aus R-4: Nachweise für WebGL-Effekte (AC-8 Filter, AC-12 Performance) kommen vom Host des Nutzers; E2E-Tests prüfen Filter nur, wenn `debug.renderer()` = `webgl`, sonst wird `[]` erwartet (T03).
- **R-6** Veröffentlichung auf dem privaten GitHub-Repo `yous0serious/opteamanta` (Nutzerwunsch, für Netlify): neuer Verlauf ab einem Snapshot-Commit mit privater Identität (`yous0serious`, GitHub-Noreply-Adresse); ab hier committet das lokale Repo mit dieser Identität. Der frühere Verlauf bleibt lokal unter `archive/*`. Lockfile-URLs auf `registry.npmjs.org` umgestellt (Integrität unverändert), interne Hostnamen/Bezeichnungen in Doku neutralisiert, `netlify.toml` ergänzt. Token liegt nur lokal (`github_token.txt`, gitignored) und wird nicht in der Git-Konfiguration gespeichert.
- **R-7** `body[data-ready="1"]` signalisiert, dass die Spielszene Eingaben annimmt; der Smoke-Test wartet darauf (vorher gingen Klicks während des Preloads verloren – Smoke-Fall 4 rot).
- **R-8** AC-3 gilt für das Spielfeld (Canvas). Die DOM-Seitenleiste (`hud.ts`) darf Emojis behalten, weil dort die Systemschrift rendert; der Emoji-Test nimmt `hud.ts` und `texts.ts` (Ticker) aus (T09).

## Open questions

- **O-1** (aus Spec 1, vor Spec 3) Balancing: Endlos-Läufe enden praktisch nie.

## Log

- 2026-11-10: Spec 2a freigegeben (`196abd5`), Figuren-Mapping bestätigt. Plan, 10 Briefs geschrieben.
- 2026-11-10: T01–T10 umgesetzt (Commit-Hashes vor `2d0b0c7` liegen auf `archive/*`). 136 Vitest-, 15 Playwright-Tests grün. Offen: AC-8 (WebGL-Zweig) und AC-12 (Host-Messung) – Nutzer misst auf https://opteamanta.netlify.app/?bench=1 bzw. `&fx=low` und prüft Schatten/Glow/Vignette.
