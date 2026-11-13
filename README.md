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
| `npm run bench` | Starker Bot: Challenge (Seed 12345) und Level `solution-5`; Spiel- und Nachrechenzeit, Level/Sterne/Kills |
| `npm run balance` | Balancing-Kennzahlen über 20 Läufe je Bot (`-- --sweep '{…}'`, `-- --balance '{…}'`, `-- --json`); `-- --levels [n] [ids…]` prüft die 24 Kampagnen-Level |
| `npm run assets` | Atlas `public/assets/game.json` + Seiten `game-0.png`, `game-1.png` aus `assets-src/` bauen (SVG-Rendering, Farbvarianten, Icons) |
| `npm run check:assets` | Prüft, dass jede Datei in `public/assets/` und `public/audio/` mit Lizenz in `CREDITS.md` steht (Grafik ≤ 8 MB, Audio ≤ 12 MB) |
| `npm run test:integration` | Integrationstests gegen das Supabase-Projekt (nicht Teil von `npm test`) |
| `npm run build:sim` / `db:push` / `fn:deploy` | Sim-Bündel für Deno / Migrationen einspielen / Edge Functions deployen |

## Spielaufbau (Spielversion 0.4.0 – „SAFe Edition“, Spec `specs/campaigns/spec.md`)

Das Spiel startet im **Hauptmenü** (Profil mit Account-Level und XP, Rangliste, Weiterspielen):

- **Kampagne** – die NEON-KFZ-Zentrale als Hochhaus: 4 Etagen = SAFe-Ebenen (Team, ART/PI-Planning-Halle,
  Large Solution/Serverraum, Portfolio/Vorstandsetage), je 6 Level, Level 6 ist der Boss. Jede Etage hat eigenen Look,
  eigene Musik und eigene Gegner (Impediment, Spike, Abhängigkeit, Enabler, Compliance-Audit, Schatten-IT,
  Vendor Lock-in, Epic; Bosse Sprint-Scope-Explosion, Big-Room-Chaos, Integrations-Hydra, Lean Business Case Q4).
  1–3 Sterne je nach verbleibender Moral; ≥ 1 Stern schaltet das nächste Level frei.
- **Daily Challenge** (alle dieselbe Karte), **Freies Spiel** (Karte wählen; Challenge 30 zählt für die
  Karten-Rangliste, Endlos nicht).
- **XP und Account-Level** (1–50): XP für Kills, Wellen, Sterne, Sieg und Erstabschluss; je Level 1 Skillpunkt.
- **Skilltree** mit 3 Ästen (Team & Technik, Prozess & Flow, Führung & Kultur), 27 Skills; Respec kostenlos.
  Skills zählen in Ranglisten – der Server rechnet jeden Lauf mit dem eingefrorenen Skill-Stand nach.
- **Ranglisten** je Daily, Karte und Level; **21 Erfolge**.
- Im Spiel: Pause (`P`/Knopf), Wellenvorschau, Zielmodus je Rolle (Erster/Letzter/Stärkster/Nächster),
  Upgrade-Zweig ab Stufe 3.

Online liegt der Fortschritt im Konto (anonym; per E-Mail + Passwort sicherbar – sofort, ohne Bestätigungsmail – und damit auf anderen Geräten nutzbar),
offline lokal im Browser („nicht gewertet“). Routen: `#/menu`, `#/campaign`, `#/level/<id>`, `#/skills`, `#/ranks`,
`#/achievements`, `#/free`. Direktlinks mit Spielparametern (z. B. `?map=…&seed=…`) starten wie früher sofort ein
freies Spiel ohne Menü. Entwicklung: `npm run dev` + `?shell=mock` zeigt die Shell mit Testdaten.

## Steuerung

**Modi:** *Challenge* (Standard) – 30 Wellen, danach „RELEASE ERFOLGREICH!“ mit Moral-Bonus (Moral × 100);
*Endlos* – bis zum Burnout; *Level* – Kampagnen-Level mit eigener Wellenzahl.

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
| `P` / Pause-Knopf | Pause (Planen und Platzieren in der Pause möglich) |
| `Esc` / Rechtsklick | Auswahl aufheben bzw. Pause beenden |

**Handy/Tablet (Touch):** Rolle antippen, dann ein Feld antippen – das zeigt nur die Vorschau (Reichweite, frei/belegt);
erneutes Tippen auf dasselbe Feld oder „Hier einsetzen“ platziert. Man kann auch zuerst das Feld und dann die Rolle
wählen. Ein platzierter Arbeitsplatz zeigt per Tippen Upgrade/Abgeben. Hochkant liegt das Spielfeld oben, darunter
Start-Button, Infobox und Rollen; quer füllt das Spielfeld die Höhe, rechts daneben eine scrollbare Spalte.
Auf Android gibt es einen Vollbild-Knopf (sperrt quer); auf dem iPhone „Zum Home-Bildschirm“ (Web-App-Manifest,
startet ohne Browserleisten). Ton startet nach dem ersten Tippen und pausiert, wenn die App im Hintergrund ist.

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

## Replay-Format 3 (Spielversion 0.4.0)

```json
{
  "format": 3,
  "gameVersion": "0.4.0",
  "seed": 12345,
  "levelId": "team-3",
  "mapId": "waterfall",
  "mode": "level",
  "loadout": { "pair": 2, "wsjf": 1 },
  "commands": [[0, "place", "dev", 10, 4], [0, "startWave"], [900, "target", 1, "strong"], [1830, "upgrade", 1, "a"]],
  "endTick": 40194,
  "result": { "score": 12100, "wave": 10, "lives": 85, "over": true, "won": true, "kills": 180, "stars": 3, "leaks": 1 }
}
```

Kommandos gelten im angegebenen Tick vor dessen `step()`. Aufgezeichnet werden nur angenommene Kommandos.
`upgrade` braucht beim Schritt auf Stufe 3 den Zweig (`a`/`b`). `parseReplay` lehnt Format 1/2, fremde Spielversionen,
unbekannte Level/Modi/Skills und Werte außerhalb der Grenzen ab (Feldgröße, Tick-/Kommando-Limits). Nach Spielende
speichert das Spiel das Replay in `localStorage['bd.lastReplay']`; der Button „Replay“ exportiert es als Datei.

## Grafik und Assets

Look „Cartoon-Büro“ (Spec `office-makeover`, ADR-0005), ausschließlich CC0 und eigene Grafiken:

- **Teammitglieder:** Kenney „Toon Characters 1“ (Ganzkörper-Posen für Ruhe, Angriff, Tippen, Jubeln, Burnout) an eigenen
  Schreibtischen; Ausstattung und Sterne zeigen die Stufe.
- **Gegner:** Monster aus Kenneys „Monster Builder Pack“, beim Asset-Build zusammengesetzt (`tools/monsters.ts`,
  Rezepte in `assets-src/manifest.json`) – mit Lauf-Frames, Treffer-Silhouette und Ticket-Post-it.
- **Boden:** beim Start erzeugt (Dielen, Teppich, Fliesen je Karte), animiertes Kanban-Laufband, Deko in Schrägsicht
  (eigene SVGs: Pflanze, Wasserspender, Kaffeemaschine, Drucker, Aktenschrank).
- **Effekte:** Kenney „Particle Pack“, „Smoke Particles“, „Splat Pack“ (Bodenflecken), „Generic Items“ (Geschosse).
- **Licht und Reaktionen:** Kenney „Light Masks“ (weiches, schräg einfallendes Fensterlicht auf dem Boden, beim Build
  geschert/weichgezeichnet) und „Emotes Pack“ (Sprechblasen: Zzz, Herzbruch beim Leak, Sterne beim Upgrade …).
  Schwebende Texte werden zusammengefasst („×3“), weichen einander aus und sind auf 9 gleichzeitig begrenzt.
- **Oberfläche:** Schriften Caveat und Nunito (OFL-1.1), Icons als eigene SVGs. Lizenzen: `public/assets/CREDITS.md`.
- **Saison-2-Figuren:** RTE, RTA, RTO, Vorstand und Statisten entstehen beim Asset-Build aus den Kenney-Figuren
  (Umfärben + eigenes Zubehör, `tools/characters.ts`; Kopfposition je Pose per Template-Matching).
- **Audio (ADR-0006):** CC0-Musik von OpenGameArt (Planung: „Two Left Socks“, Welle: „Raspberry Jam“,
  Boss: „Hard Boss Battle 1“, dazu Planungs-/Wellen-Musik je Kampagnen-Etage), Kenney-Jingles, -Soundeffekte und
  UI-Klänge, Telefon und Drucker prozedural (WebAudio).
  Quellen und Lizenzbelege: `assets-src/audio/SOURCES.md`, `public/assets/CREDITS.md`; Budget ≤ 12 MB.
- **Kampagnen-Looks** (`src/view/render/office/themes.ts`): Großraumbüro (Eiche, Fensterlicht), PI-Planning-Halle
  (Teppich, Program Board, Flipcharts, Spots), Serverraum (helle Fliesen, Racks mit LEDs, Kabelkanäle, kühles Licht),
  Vorstandsetage (Marmor, Glas, Ledermöbel, Skyline-Licht). Icons für Gegner, Skills, Erfolge, Kampagnen aus
  Kenney „Board Game Icons“/„Game Icons“ und eigenen SVGs; zwei Atlas-Seiten (`game-0.png`, `game-1.png`).
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

Online meldet sich das Spiel anonym an; jeder bekommt einen automatischen Teamnamen („<Adjektiv> <Tier> <NNNN>“,
änderbar). Gewertete Läufe (Daily, Kampagnen-Level, Challenge 30 auf einer Karte) werden nach Spielende ohne Dialog
eingereicht; XP, Level-Bestwerte und Erfolge schreibt nur der Server nach dem Nachrechnen gut. Direktlinks mit
Spielparametern nutzen weiter den alten Ablauf (automatischer Daily-Lauf, Schalter „Freies Spiel“).

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co          # Netlify-Umgebungsvariable
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...          # browser-tauglich, Rechte über RLS
```

| Baustein | Ort |
|---|---|
| Schema, RLS, RPCs, Cron-Jobs | `supabase/migrations/` → `npm run db:push` (Management-API, Token aus `supabase_token.txt`) |
| Edge Functions `start-run` (Daily/Level/Karte, friert Skill-Stand ein), `submit-run`, `verify-runs` (XP, Erfolge, Level-Bestwerte), `allocate-skill` | `supabase/functions/` → `npm run fn:deploy` |
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
- *Grenzen:* bis 30 Daily-Läufe und 150 Level-/Karten-Läufe pro Nutzer und Tag, 30 anonyme Anmeldungen pro Stunde
  und IP (Supabase-Standard), Replays höchstens 200.000 Ticks.
  Bots/TAS lassen sich nicht ausschließen (Anti-Cheat-Analyse: `.ai/knowledge/requirements/anti-cheat.md`).
- *Konto sichern:* E-Mail + Passwort werden direkt ans anonyme Konto gehängt (`updateUser`), Anmelden auf anderen
  Geräten per `signInWithPassword`. Es werden keine Mails verschickt: In Supabase Auth ist „Confirm email“ aus
  (`mailer_autoconfirm`), kein SMTP nötig. Folge: E-Mail-Adressen sind ungeprüft, „Passwort vergessen“ gibt es nicht.

## Weiterführend

- Spec: [`specs/foundation-phaser-port/spec.md`](specs/foundation-phaser-port/spec.md),
  [`specs/visual-overhaul/spec.md`](specs/visual-overhaul/spec.md),
  [`specs/balancing-challenge/spec.md`](specs/balancing-challenge/spec.md),
  [`specs/leaderboard-supabase/spec.md`](specs/leaderboard-supabase/spec.md)
- Roadmap: [`.ai/knowledge/roadmap.md`](.ai/knowledge/roadmap.md)
- ADRs: [`.ai/knowledge/decisions/`](.ai/knowledge/decisions/_index.md)
