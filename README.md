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
| `npm run bench` | Starker Bot, Challenge (Seed 12345): Spiel- und Nachrechenzeit des Replays |
| `npm run balance` | Balancing-Kennzahlen über 20 Läufe je Bot (`-- --sweep '{…}'`, `-- --balance '{…}'`, `-- --json`) |
| `npm run assets` | Atlas `public/assets/game.{png,json}` aus `assets-src/` bauen (SVG-Rendering, Farbvarianten) |
| `npm run check:assets` | Prüft, dass jede Datei in `public/assets/` mit Lizenz in `CREDITS.md` steht (≤ 3 MB) |
| `npm run test:integration` | Integrationstests gegen das Supabase-Projekt (nicht Teil von `npm test`) |
| `npm run build:sim` / `db:push` / `fn:deploy` | Sim-Bündel für Deno / Migrationen einspielen / Edge Functions deployen |

## Steuerung

**Modi:** *Challenge* (Standard) – 30 Wellen, danach „RELEASE ERFOLGREICH!“ mit Moral-Bonus (Moral × 100);
*Endlos* – bis zum Burnout. Wahl in der Seitenleiste vor dem ersten Sprint oder per `?mode=endless`.
Spielversion 0.3.0 – **Saison 2** (Spec `specs/season-2/spec.md`, Werte in `src/sim/data/`).

| Rolle | Taste | Kosten | Wirkung |
|---|---|---|---|
| Dualo | 1 | 30 | Wirft Kaffeetassen; fehlt manchmal (Klausurphase) |
| Business Analyst | 2 | 70 | Rückfragen verlangsamen Tickets |
| Entwickler | 3 | 120 | Dauerstrahl aus Code |
| PPL | 4 | 150 | Flächenschaden, +25 % für Teammitglieder in der Aura |
| Scrum Master | 5 | 110 | Schickt Tickets zurück ins Refinement |
| RTE | 6 | 140 | Alle 10 s PI-Sync: 4 s lang 30 % schneller, löst Tech-Debt-Störungen |
| RTA | 7 | 130 | Architektur-Runway: +25 % Schaden im Bereich, Tech Debt doppelt |
| RTO | 8 | 100 | Business Value: 15 SP (+10 je Stufe) pro Sprint-Ende |
| Vorstand | 9 | 500 | Max. 1; alle 20 s Budget-Freeze bzw. „Projekt eingestampft“ |

| Eingabe | Aktion |
|---|---|
| `1`–`9` / Karten | Rolle wählen |
| Klick aufs Feld | Platzieren bzw. vorhandenen Arbeitsplatz auswählen |
| `U` / `S` | Upgrade / Abgeben (ausgewählter Arbeitsplatz) |
| Leertaste / großer Button | Nächster Sprint, nach Spielende neu starten |
| `Esc` / Rechtsklick | Auswahl aufheben |

**Einstellungen** (Zahnrad oben rechts): Effektstufe *Maximal* (Combos, Zeitlupe, Kamerafahrten), *Normal* (ohne Zeitlupe/Zoom),
*Ruhig* (ohne Wackeln, Combos, Animationen; Standard bei `prefers-reduced-motion`), Lautstärke für Musik und Effekte, Stumm,
Tempo, Modus im freien Spiel und Teamname. Bei offenem Dialog reagiert das Spiel nicht auf Tasten.
Nach Spielende teilt „Teilen“ das Ergebnis als Text und Bildkarte.

### URL-Parameter

| Parameter | Wirkung |
|---|---|
| `seed=<0…4294967295>` | Fester Seed (sonst zufällig) – gleicher Seed + gleiche Eingaben = gleiches Spiel |
| `map=spaghetti\|waterfall\|release-train\|matrix` | Karte erzwingen (sonst aus dem Seed) |
| `speed=1…10` | Start-Tempo (über den Button nur 1–3) |
| `mode=challenge\|endless` | Spielmodus (Standard `challenge`) |
| `fx=max\|normal\|calm` (`high` = max, `low` = calm) | Effektstufe (überschreibt die gespeicherte Wahl) |
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
    leaderboard.ts Bestenliste + Ticker, nickname.ts Teamnamen-Dialog
  online/         Supabase-Anbindung (api.ts), Daily-Ablauf (daily.ts) – nur mit VITE_SUPABASE_*
  main.ts         Einstieg
supabase/         Migrationen, Edge Functions (Deno), gebündelte Sim (_shared/sim.js), config.toml
assets-src/       Rohdateien: Kenney-CC0 (Figuren, Partikel) + eigene SVGs, manifest.json
public/assets/    Generierter Atlas + CREDITS.md (Lizenzen)
tests/sim/        Vitest: Daten, Wirtschaft, Wellen, Türme, Gegner, Determinismus, Reinheit, Replay
tests/view/       Vitest: DONE-Haufen, Lizenzen, Emoji-freies Spielfeld
tests/e2e/        Playwright: Smoke-Test, Grafik-Prüfungen, Bestenliste (Supabase gemockt)
tests/server/     Vitest: Server-Logik (Tages-Seed, Berliner Datum, Einreichungsprüfung)
tests/integration/ Vitest gegen das echte Supabase-Projekt (RLS, Functions, Rangliste, CPU-Messung)
tools/            Bots, Replay-CLI, Benchmark, Balancing, Sim-Bündel, Supabase-Deploy
specs/            Specs (Ziele, Akzeptanzkriterien)
.ai/              Plan, Ledger, ADRs, Roadmap
```

## Regeln für `src/sim/` (Determinismus)

Die Simulation muss in jedem Browser und auf dem Server (Supabase Edge Function `verify-runs`) bitgenau gleich
rechnen. Daher gilt – per ESLint erzwungen:

- Zufall nur über den Seed-RNG (`createRng`), nie `Math.random`.
- Nur IEEE-exakte Arithmetik: `+ - * /`, `Math.sqrt`, `Math.round/floor/ceil/min/max/abs/sign`, `Math.imul`.
  Verboten: `Math.hypot/pow/sin/cos/tan/atan2/exp/log`, `**`, `Date`, `performance`, DOM, `phaser`.
- Abstände über Quadrate vergleichen (`dx*dx + dy*dy <= r*r`).
- Zustand ändert sich nur über `Game.apply(command)` und `Game.step()`; die Darstellung liest nur.
- Jede Balancing-Änderung erhöht `GAME_VERSION` (`src/sim/version.ts`) – alte Replays sind dann nicht mehr vergleichbar.

## Replay-Format 2 (Spielversion 0.2.0)

```json
{
  "format": 2,
  "gameVersion": "0.2.0",
  "seed": 12345,
  "mapId": "matrix",
  "mode": "challenge",
  "commands": [[0, "place", "dev", 10, 4], [0, "startWave"], [1830, "upgrade", 1]],
  "endTick": 60194,
  "result": { "score": 26500, "wave": 26, "lives": -20, "over": true, "won": false }
}
```

Kommandos gelten im angegebenen Tick vor dessen `step()`. Aufgezeichnet werden nur angenommene Kommandos.
`parseReplay` lehnt Format 1, fremde Spielversionen, unbekannte Modi und Werte außerhalb der Grenzen ab
(Feldgröße, Tick-/Kommando-Limits). Nach Spielende speichert das Spiel das Replay in
`localStorage['bd.lastReplay']`; der Button „💾 Replay herunterladen“ exportiert es als Datei.

## Grafik und Assets

Look „Cartoon-Büro“ (Spec `office-makeover`, ADR-0005), ausschließlich CC0 und eigene Grafiken:

- **Teammitglieder:** Kenney „Toon Characters 1“ (Ganzkörper-Posen für Ruhe, Angriff, Tippen, Jubeln, Burnout) an eigenen
  Schreibtischen; Ausstattung und Sterne zeigen die Stufe.
- **Gegner:** Monster aus Kenneys „Monster Builder Pack“, beim Asset-Build zusammengesetzt (`tools/monsters.ts`,
  Rezepte in `assets-src/manifest.json`) – mit Lauf-Frames, Treffer-Silhouette und Ticket-Post-it.
- **Boden:** beim Start erzeugt (Dielen, Teppich, Fliesen je Karte), animiertes Kanban-Laufband, Deko in Schrägsicht
  (eigene SVGs: Pflanze, Wasserspender, Kaffeemaschine, Drucker, Aktenschrank).
- **Effekte:** Kenney „Particle Pack“, „Smoke Particles“, „Splat Pack“ (Bodenflecken), „Generic Items“ (Geschosse).
- **Oberfläche:** Schriften Caveat und Nunito (OFL-1.1), Icons als eigene SVGs. Lizenzen: `public/assets/CREDITS.md`.
- **Saison-2-Figuren:** RTE, RTA, RTO, Vorstand und Statisten entstehen beim Asset-Build aus den Kenney-Figuren
  (Umfärben + eigenes Zubehör, `tools/characters.ts`; Kopfposition je Pose per Template-Matching).
- **Audio (ADR-0006):** CC0-Musik von OpenGameArt (Planung: „Two Left Socks“, Welle: „Raspberry Jam“,
  Boss: „Hard Boss Battle 1“), Kenney-Jingles und -Soundeffekte, Telefon und Drucker prozedural (WebAudio).
  Quellen und Lizenzbelege: `assets-src/audio/SOURCES.md`, `public/assets/CREDITS.md`; Budget ≤ 8 MB.
- Farben werden beim Build vorgefärbt bzw. Silhouetten vorgerendert, damit das Spiel auch im Canvas-Renderer (ohne
  WebGL) vollständig aussieht; mit WebGL und `fx=high` kommt ein weicher Schatten dazu. Keine abdunkelnden Filter.
- Bewegungsreduktion: Bei `prefers-reduced-motion: reduce` entfallen Wackeln, Hitstop, Lauf- und Atemanimationen.

## Hosting

Netlify baut aus `main` (`netlify.toml`: `npm run build`, Ordner `dist`, Node 22). Der Atlas ist eingecheckt;
nach Änderungen in `assets-src/` lokal `npm run assets` ausführen und das Ergebnis committen.

## Bestenliste (Daily Challenge) und Betrieb

Alle spielen pro Berliner Kalendertag denselben Seed im Challenge-Modus. Der Server vergibt den Lauf, rechnet das
eingereichte Replay nach und trägt nur den **selbst berechneten** Score ein (ADR-0004,
[`specs/leaderboard-supabase/spec.md`](specs/leaderboard-supabase/spec.md)). Ohne die beiden Variablen läuft das
Spiel offline („Bestenliste offline“, keine Netzwerkaufrufe).

Online startet beim Öffnen automatisch ein Daily-Lauf; jeder bekommt einen automatischen Teamnamen
(„<Adjektiv> <Tier> <NNNN>“, per Klick änderbar), Ergebnisse werden nach Spielende ohne Dialog eingereicht und
„Nochmal“ startet einen neuen Daily-Versuch. Der Schalter „Freies Spiel“ wechselt zu lokalen Spielen
(Challenge oder Endlos), die nicht in die Bestenliste eingehen.

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co          # Netlify-Umgebungsvariable
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...          # browser-tauglich, Rechte über RLS
```

| Baustein | Ort |
|---|---|
| Schema, RLS, RPCs, Cron-Jobs | `supabase/migrations/` → `npm run db:push` (Management-API, Token aus `supabase_token.txt`) |
| Edge Functions `start-run`, `submit-run`, `verify-runs` | `supabase/functions/` → `npm run fn:deploy` |
| Simulation für Deno | `npm run build:sim` → `supabase/functions/_shared/sim.js` (Test schlägt fehl, wenn veraltet) |
| Integrationstests gegen das Projekt | `npm run test:integration` (braucht `supabase.txt`, `supabase_secret.txt`, `.agent-state/fn_secrets.json`) |

Lokale Zugangsdateien (alle gitignored, nie committen): `supabase.txt` (URL, Publishable Key),
`supabase_secret.txt` (Secret Key), `supabase_token.txt` (Access Token für Deploy/Migrationen).
Function-Secrets im Projekt: `DAILY_SECRET` (Tages-Seed), `VERIFY_SECRET` (Prüf-Worker, auch im Vault für den Cron-Job),
`SB_SECRET_KEY`.

**Betrieb**

- *Lauf sperren:* `select admin_reject_submission('<submission-id>', 'Grund');` (SQL-Editor oder Secret Key).
- *Nickname/Profil löschen:* `select admin_delete_profile('<user-id>');` – Läufe bleiben, erscheinen aber nicht mehr.
- *Secrets rotieren:* neuen Wert per `supabase secrets set` bzw. Management-API setzen; bei `VERIFY_SECRET` auch den
  Vault-Eintrag `verify_secret` aktualisieren. Ein neues `DAILY_SECRET` ändert den Seed des laufenden Tages.
- *Neue Saison:* Jede Änderung von `GAME_VERSION` startet eine neue Bestenliste (Abfragen filtern nach Version);
  danach `npm run build:sim` und `npm run fn:deploy`.
- *Wartung:* Cron `leaderboard-maintenance` (03:15 UTC) löscht abgelaufene Sessions und anonyme Nutzer ohne Profil
  und ohne Läufe nach 30 Tagen; Cron `verify-runs` prüft minütlich liegengebliebene Einreichungen.
- *Grenzen:* bis 30 Daily-Läufe pro Nutzer und Tag, 30 anonyme Anmeldungen pro Stunde und IP (Supabase-Standard).
  Bots/TAS lassen sich nicht ausschließen (Anti-Cheat-Analyse: `.ai/knowledge/requirements/anti-cheat.md`).

## Weiterführend

- Spec: [`specs/foundation-phaser-port/spec.md`](specs/foundation-phaser-port/spec.md),
  [`specs/visual-overhaul/spec.md`](specs/visual-overhaul/spec.md),
  [`specs/balancing-challenge/spec.md`](specs/balancing-challenge/spec.md),
  [`specs/leaderboard-supabase/spec.md`](specs/leaderboard-supabase/spec.md)
- Roadmap: [`.ai/knowledge/roadmap.md`](.ai/knowledge/roadmap.md)
- ADRs: [`.ai/knowledge/decisions/`](.ai/knowledge/decisions/_index.md)
