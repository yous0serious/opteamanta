# 📌 BACKLOG DEFENSE 3000

Tower Defense im Agile-Büro: Der Fachbereich schickt Anforderungen, Change Requests, Features und
Objectives – stell dein Team (Dualo, Business Analyst, Entwickler, PPL, Scrum Master) auf, bevor alles
in die Deadline rauscht.

Technik: **Phaser 4** (WebGL) · **TypeScript** · **Vite** · deterministische Simulation mit Replays.
Die ursprüngliche Einzeldatei liegt als Referenz unter `tower-defenese-opTEAManta-v2.html`.

## Schnellstart

Voraussetzung: Node ≥ 22.12, npm.

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Skript | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Typecheck + statisches Bundle in `dist/` (läuft ohne Backend, ohne CDN) |
| `npm run preview` | `dist/` lokal ausliefern (Port 4173) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint (inkl. Determinismus-Regel für `src/sim`) |
| `npm test` | Alle Vitest-Suites der Simulation |
| `npm run test:e2e` | Playwright-Smoke-Test im Browser (Chromium, headless) |
| `npm run replay -- <datei.json>` | Replay headless nachrechnen; Exit 0 = Ergebnis stimmt, 1 = Abweichung, 2 = ungültig |
| `npm run bench` | Fester Bot-Lauf (Seed 12345, bis Welle 30) mit Laufzeitmessung |
| `npm run assets` | Atlas `public/assets/game.{png,json}` aus `assets-src/` bauen (SVG-Rendering, Farbvarianten) |
| `npm run check:assets` | Prüft, dass jede Datei in `public/assets/` mit Lizenz in `CREDITS.md` steht (≤ 3 MB) |

## Steuerung

| Eingabe | Aktion |
|---|---|
| `1`–`5` / Buttons | Turm wählen |
| Klick aufs Feld | Turm platzieren bzw. vorhandenen Turm auswählen |
| `U` / `S` | Upgrade / Verkaufen (ausgewählter Turm) |
| Leertaste / grüner Button | Nächster Sprint, nach Game Over neu starten |
| `Esc` / Rechtsklick | Auswahl aufheben |

### URL-Parameter

| Parameter | Wirkung |
|---|---|
| `seed=<0…4294967295>` | Fester Seed (sonst zufällig) – gleicher Seed + gleiche Eingaben = gleiches Spiel |
| `map=spaghetti\|waterfall\|release-train\|matrix` | Karte erzwingen (sonst aus dem Seed) |
| `speed=1…10` | Start-Tempo (über den Button nur 1–3) |
| `fx=high\|low` | Effektstufe: `high` (Standard) mit Schatten, Glow, Vignette; `low` ohne Filter, halbe Partikel |
| `bench=1` | Performance-Szenario (299 Türme, 150 Gegner); Ergebnis nach ~12 s im Info-Panel und in der Konsole |
| `debug=1` | Controller als `window.__bd` (im Dev-Server immer), inkl. `window.__bd.debug` |

Beispiel: `http://localhost:5173/?seed=7&map=waterfall&speed=3`

## Aufbau

```
src/
  sim/            Deterministische Simulation – kein Phaser, kein DOM (ADR-0002)
    data/         Türme, Gegner, Karten (Werte 1:1 aus dem Original)
    game.ts       Game: apply(command), step() = 1 Tick à 1/60 s, stateHash(), toReplay()
    replay.ts     parseReplay(), runReplay()
    rng.ts        mulberry32 (Seed-RNG)
  view/           Darstellung
    PreloadScene.ts  Lädt Atlas + Handschrift (Caveat) mit Fortschrittsbalken
    GameScene.ts  Phaser-Szene: rendert den Sim-Zustand, Effekte aus Sim-Events
    layers.ts     Zeichenebenen + Filter pro Ebene (nur WebGL)
    render/       Whiteboard, Türme (Magnet-Badges), Post-its, Partikel, Banner, DONE-Haufen
    controller.ts Brücke HUD ↔ Szene ↔ Sim, Fixed-Step-Loop, Tempo, Auswahl, Hitstop
    hud.ts        DOM-Seitenleiste, input.ts Tastatur, audio.ts prozeduraler Sound
  main.ts         Einstieg
assets-src/       Rohdateien: Kenney-CC0 (Figuren, Partikel) + eigene SVGs, manifest.json
public/assets/    Generierter Atlas + CREDITS.md (Lizenzen)
tests/sim/        Vitest: Daten, Wirtschaft, Wellen, Türme, Gegner, Determinismus, Reinheit, Replay
tests/view/       Vitest: DONE-Haufen, Lizenzen, Emoji-freies Spielfeld
tests/e2e/        Playwright: Smoke-Test, Grafik-Prüfungen
tools/            Bot, Replay-CLI, Benchmark
specs/            Specs (Ziele, Akzeptanzkriterien)
.ai/              Plan, Ledger, ADRs, Roadmap
```

## Regeln für `src/sim/` (Determinismus)

Die Simulation muss in jedem Browser und auf dem Server (später Supabase Edge Function) bitgenau gleich
rechnen. Daher gilt – per ESLint erzwungen:

- Zufall nur über den Seed-RNG (`createRng`), nie `Math.random`.
- Nur IEEE-exakte Arithmetik: `+ - * /`, `Math.sqrt`, `Math.round/floor/ceil/min/max/abs/sign`, `Math.imul`.
  Verboten: `Math.hypot/pow/sin/cos/tan/atan2/exp/log`, `**`, `Date`, `performance`, DOM, `phaser`.
- Abstände über Quadrate vergleichen (`dx*dx + dy*dy <= r*r`).
- Zustand ändert sich nur über `Game.apply(command)` und `Game.step()`; die Darstellung liest nur.
- Jede Balancing-Änderung erhöht `GAME_VERSION` (`src/sim/version.ts`) – alte Replays sind dann nicht mehr vergleichbar.

## Replay-Format v1

```json
{
  "format": 1,
  "gameVersion": "0.1.0",
  "seed": 12345,
  "mapId": "matrix",
  "commands": [[0, "place", "dev", 10, 4], [0, "startWave"], [1830, "upgrade", 1]],
  "endTick": 74690,
  "result": { "score": 287780, "wave": 30, "lives": 100, "over": false }
}
```

Kommandos gelten im angegebenen Tick vor dessen `step()`. Aufgezeichnet werden nur angenommene Kommandos.
Nach Game Over speichert das Spiel das Replay in `localStorage['bd.lastReplay']`; der Button
„💾 Replay herunterladen“ exportiert es als Datei.

## Grafik und Assets

- Figuren und Partikel: Kenney „Toon Characters 1“ und „Particle Pack“ (CC0), Requisiten (Post-it, Klebeband, Magnet,
  Symbole) als eigene SVGs, Schrift Caveat (OFL-1.1). Lizenzen: `public/assets/CREDITS.md`.
- Farben werden beim Asset-Build vorgefärbt (Paletten aus den Sim-Daten, `src/view/render/palette.ts`), damit das
  Spiel auch im Canvas-Renderer (ohne WebGL) richtig aussieht. Filter (Schatten, Glow, Vignette, Entsättigung) gibt
  es nur mit WebGL und `fx=high`.
- Bewegungsreduktion: Bei `prefers-reduced-motion: reduce` entfallen Wackeln, Hitstop und Animationen.

## Hosting

Netlify baut aus `main` (`netlify.toml`: `npm run build`, Ordner `dist`, Node 22). Der Atlas ist eingecheckt;
nach Änderungen in `assets-src/` lokal `npm run assets` ausführen und das Ergebnis committen.

## Supabase (ab Spec 3)

Die Bestenliste kommt mit Spec 3. Zugangsdaten gehören in `.env.local` (nicht eingecheckt) bzw. in die
Netlify-Umgebungsvariablen. Vorarbeit zu Anti-Cheat: `.ai/knowledge/requirements/anti-cheat.md`.

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Weiterführend

- Spec: [`specs/foundation-phaser-port/spec.md`](specs/foundation-phaser-port/spec.md),
  [`specs/visual-overhaul/spec.md`](specs/visual-overhaul/spec.md)
- Roadmap: [`.ai/knowledge/roadmap.md`](.ai/knowledge/roadmap.md)
- ADRs: [`.ai/knowledge/decisions/`](.ai/knowledge/decisions/_index.md)
