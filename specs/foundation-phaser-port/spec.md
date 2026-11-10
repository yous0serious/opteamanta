# Spec: Fundament – Port auf Phaser 4 mit deterministischer Simulation

**Status:** Done
**Size:** M
**Ticket:** –
**Plan:** `.ai/specs/foundation-phaser-port/plan.md` · **Ledger:** `.ai/specs/foundation-phaser-port/ledger.md`

## Ziel

„Backlog Defense 3000“ existiert heute als einzelne HTML-Datei (`tower-defenese-opTEAManta-v2.html`,
Canvas 2D, Logik und Darstellung vermischt, `Math.random` überall). Diese Spec überführt das Spiel
funktionsgleich in ein TypeScript-Projekt mit Phaser 4 und trennt eine **deterministische
Simulation** (`src/sim/`) strikt von der **Darstellung** (`src/view/`). Jeder Lauf wird als
**Replay** (Seed + Kommandos) aufgezeichnet und kann headless nachgespielt werden.
Das ist die Voraussetzung für die Folge-Specs: neue Grafik (Spec 2), eine fälschungssichere
Bestenliste mit Supabase, deren Edge Function Replays nachrechnet (Spec 3), und neue Inhalte (Spec 4).

## Nicht-Ziele

- Neue Grafik, Sprites, CC0-Assets, Shader/Filter, neue Sounds (→ Spec 2). Optik bleibt sinngemäß wie heute (Emojis, Whiteboard).
- Bestenliste, Supabase, Login, Nickname (→ Spec 3).
- Neue Türme, Gegner, Karten, Upgrade-Zweige, Daily Challenge, Menü-Szene (→ Spec 4).
- Balancing-Änderungen: alle Spielwerte bleiben 1:1 (Ausnahmen nur im Abschnitt „Bewusste Abweichungen“).
- Mobile/Touch-Optimierung, Barrierefreiheit, Lokalisierung, Hosting/Deployment.
- Löschen der Referenzdatei `tower-defenese-opTEAManta-v2.html` (bleibt als Referenz im Repo).

## Randbedingungen

- Laufzeit: Node 22 (≥ 22.12), npm. Versionen gepinnt: `phaser` 4.2.1,
  `vite` 8.x, `vitest` 5.x, `typescript` 6.0.3 (nicht 7.x: `typescript-eslint` verlangt `<6.1`),
  `eslint` 10.x + `typescript-eslint` 8.x, `tsx` 4.x.
- Der Build ist rein statisch (`dist/`), lädt nichts von CDNs und läuft ohne Backend.
- `src/sim/` importiert weder `phaser` noch DOM-APIs und verwendet nur IEEE-exakte Arithmetik
  (`+ - * /`, `Math.sqrt`, `Math.round/floor/ceil/min/max/abs/sign`). Verboten in `src/sim/`:
  `Math.random`, `Math.hypot`, `Math.pow`, `Math.sin/cos/tan/atan2/exp/log`, `**`, `Date`,
  `performance`. Grund: diese Funktionen dürfen je JS-Engine minimal abweichen, dann laufen Replays
  zwischen Browser (z. B. Firefox) und Server (Deno/V8) auseinander.
- Simulation mit fester Tickrate **60 Hz** (`DT = 1/60`). Spielgeschwindigkeit x1/x2/x3 ändert nur die
  Zahl der Ticks pro Bildschirm-Frame, nie `DT`.
- Kosmetischer Zufall (Kill-Sprüche, Partikel, Wackeln) lebt in `src/view/` und darf `Math.random` nutzen;
  er beeinflusst die Simulation nie.
- Dokumentation und Kommentare auf Deutsch, Bezeichner im Code auf Englisch.

## Entscheidungen

- Engine Phaser 4 + TypeScript + Vite statt PixiJS, Godot-Web oder Three.js → [ADR-0001](../../.ai/knowledge/decisions/0001-engine-phaser4-typescript-vite.md)
- Deterministische Simulation getrennt von der Darstellung, Replays aus Seed + Kommandos → [ADR-0002](../../.ai/knowledge/decisions/0002-deterministic-sim-replays.md)
- HUD/Seitenleiste bleibt DOM (HTML/CSS) über bzw. neben dem Phaser-Canvas; nur das Spielfeld rendert Phaser. Grund: Texte, Buttons und spätere Formulare (Nickname, Bestenliste) sind im DOM einfacher und zugänglicher.
- Prozedurales WebAudio wird 1:1 nach `src/view/audio.ts` portiert; echte Assets kommen in Spec 2.
- Turm-IDs werden sprechend umbenannt: `coffee→dualo`, `fine→analyst`, `laser→dev`, `legal→ppl`, `scrum→scrum`. Gegner-IDs bleiben.
- `npm test` führt alle Vitest-Suites aus; der Playwright-Smoke-Test läuft separat über `npm run test:e2e`.

### Bewusste Abweichungen vom Original

| # | Original | Neu | Grund |
|---|---|---|---|
| D-1 | Zeitschritt variabel (Frame-dt, max 0,05 s) | fest 1/60 s | Determinismus |
| D-2 | Karte per `Math.random` | Karte aus dem Seed (`rng.int(4)` als erster Zug des RNG) oder explizit per `mapId` | Determinismus |
| D-3 | Türme zielen auch auf Gegner, die im selben Tick schon besiegt wurden (`hp<=0`) | Gegner mit `hp<=0` werden beim Zielen übersprungen | Bugfix, verschwendete Schüsse |
| D-4 | `TW.fine.slow = .45` ist definiert, aber wirkungslos (Verlangsamung ist fix 50 %) | Feld entfällt, Verlangsamung bleibt 50 % | Totes Feld |
| D-5 | Nach Game Over läuft die Logik mit 30 % Tempo weiter; Türme töten weiter, Score steigt noch | Nach Game Over ist der Zustand eingefroren (`step()` ändert nichts mehr); nur die Darstellung animiert Partikel/Texte aus | Score muss für die Bestenliste final sein |
| D-6 | Abstandsvergleich mit `Math.hypot(...) <= r` | `dx·dx + dy·dy <= r·r` (bzw. `< r·r` beim Splash) | Engine-unabhängig exakt (siehe Randbedingungen) |

## Referenzwerte (müssen 1:1 gelten)

Spielfeld: Zelle 40 px, 24 × 15 Zellen, 960 × 600 px. Start: 200 SP Kapazität, 100 % Moral, Welle 0, Score 0.

**Türme**

| ID | Name | Emoji | Kosten | Reichweite | Rate (s) | Schaden | Sonderwerte | Farbe |
|---|---|---|---|---|---|---|---|---|
| dualo | Dualo | 🎓 | 30 | 100 | 0.35 | 6 | 8 % Chance pro Schuss: fällt aus, Cooldown 2 s, kein Schuss | #1e88e5 |
| analyst | Business Analyst | 📋 | 70 | 105 | 0.7 | 5 | Treffer verlangsamt auf 50 % für `1.5 + 0.3·Stufe` s | #43a047 |
| dev | Entwickler | 👩‍💻 | 120 | 150 | – (Dauerstrahl) | 45 DPS | trifft jeden Tick `dps·DT` | #d81b60 |
| ppl | PPL | 🧭 | 150 | 140 | 1.5 | 40 | Splash-Radius `65·(1+0.1·(Stufe−1))` (strikt `<`); Aura 120: andere Türme im Abstand ≤ 120 erhalten ×1.25 auf Schaden/DPS (nicht stapelbar, PPL selbst nie) | #f9a825 |
| scrum | Scrum Master | 🔁 | 110 | 115 | 2.4 | 4 | Rückstoß `70·(1+0.2·(Stufe−1))` Pfad-Pixel, beim Boss ×0.15; Rückstoß-Cooldown am Gegner 1.2 s, Boss 4 s; nur wenn der Gegner den Treffer überlebt | #8e24aa |

Stufen 1–5. Skalierung pro Stufe `L` (1-basiert): Reichweite ×`(1+0.1·(L−1))`; Schaden/DPS ×`1.5^(L−1)` = `[1, 1.5, 2.25, 3.375, 5.0625]`; Rate ×`0.9^(L−1)` = `[1, 0.9, 0.81, 0.729, 0.6561]`.
Upgrade-Kosten auf Stufe `L`: `round(Kosten·0.8·L)`; ab Stufe 5 kein Upgrade. Verkaufen: `round(investiert·0.6)` (investiert = Kaufpreis + alle Upgrades).
Projektilgeschwindigkeit: PPL 320 px/s, alle anderen 520 px/s; Projektile verfolgen ihr Ziel, solange es lebt.
Zielwahl: der Gegner in Reichweite (`Abstand ≤ Reichweite`) mit der größten zurückgelegten Pfaddistanz; bei Gleichstand der zuerst gespawnte.

**Gegner** (HP vor Skalierung, Speed in px/s, Belohnung in SP)

| ID | Name | Emoji | HP | Speed | Belohnung | Sonderwerte | Farbe |
|---|---|---|---|---|---|---|---|
| req | Anforderung | 📝 | 30 | 60 | 6 | – | #fff176 |
| cr | Change Request | 🔄 | 16 | 115 | 4 | – | #a5d6a7 |
| story | User Story | 🧩 | 14 | 90 | 3 | – | #b3e5fc |
| obj | Objective | 🎯 | 110 | 38 | 12 | Leck kostet 8 % Moral | #ffcc80 |
| feat | Feature | 📦 | 70 | 55 | 15 | zerfällt beim Kill in 2 User Stories an derselben Pfadposition | #f48fb1 |
| creep | Scope Creep | 🐛 | 40 | 62 | 8 | wächst um 5 % der aktuellen Max-HP pro s (HP und Max-HP), bis Max-HP = 2× Start-Max-HP | #dce775 |
| debt | Tech Debt | 💸 | 65 | 45 | 11 | alle 3 s (erstes Mal nach 1 s): Türme im Abstand ≤ 75 sind 2 s außer Betrieb | #cfd8dc |
| boss | MEGA-OBJECTIVE „Alles digital bis Q4“ | 🐘 | 900 | 28 | 150 | Leck kostet 40 % Moral | #ef9a9a |

HP-Skalierung in Welle `w`: `hpS = 1 + (w−1)·0.28`. Kill-Belohnung: `round(Belohnung·√hpS)` SP, Score `+ 10 ×` diese Belohnung.
Leck (Gegner erreicht das Pfadende): Moral −5 (Objective −8, Boss −40). Moral ≤ 0 ⇒ Game Over, Warteschlange wird geleert.

**Wellen**

- Welle `w` hat `8 + 2·w` Gegner; eine Welle ist ein PIP, wenn `(w−1) mod 5 = 0` (Wellen 1, 6, 11, …).
- Typ je Gegner aus `r = rng.next()`:
  - PIP und `w>1`: `r<0.35` obj, `r<0.75` feat, sonst req; zusätzlich am Ende 1 boss.
  - PIP und `w=1`: `r<0.15` feat, sonst req.
  - sonst, in dieser Reihenfolge: `w>1 ∧ r<0.25` cr; `w>2 ∧ r<0.37` obj; `w>2 ∧ r<0.49` feat; `w>2 ∧ r<0.62` creep; `w>3 ∧ r<0.72` debt; sonst req.
- Der erste Gegner erscheint im Starttick der Welle, danach alle `max(0.25, 0.9 − 0.03·w)` s (höchstens einer pro Tick).
- Welle beendet, wenn Warteschlange und Spielfeld leer sind: Bonus `50 + 10·w` SP.
- Eine neue Welle startet nur, wenn keine Welle läuft und kein Game Over ist.

**Karten** (Wegpunkte in Zellen, Mittelpunkt = `Zelle·40 + 20`)

| mapId | Name | Wegpunkte |
|---|---|---|
| spaghetti | Spaghetti-Prozess | (-1,2) (6,2) (6,7) (2,7) (2,12) (12,12) (12,3) (18,3) (18,11) (24,11) |
| waterfall | Wasserfall-Modell | (-1,2) (21,2) (21,7) (2,7) (2,12) (24,12) |
| release-train | Release-Train | (-1,7) (5,7) (5,2) (11,2) (11,12) (17,12) (17,4) (21,4) (21,9) (24,9) |
| matrix | Matrix-Organisation | (-1,12) (4,12) (4,2) (9,2) (9,9) (14,9) (14,1) (20,1) (20,13) (24,13) |

Alle Zellen auf den Wegsegmenten (inkl. Endpunkte) sind nicht bebaubar. Bebaubar: Zelle im Raster, kein Weg, kein Turm, genug SP.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | `npm ci` und `npm run build` laufen fehlerfrei; `dist/` enthält eine lauffähige statische Seite ohne Verweise auf externe Hosts (`http(s)://` außer SVG-Namespaces). | Build-Log + `grep` über `dist/` |
| AC-2 | `npm run typecheck`, `npm run lint` und `npm test` beenden sich mit Exit-Code 0. | Befehlsausgabe |
| AC-3 | Turm-, Gegner- und Kartendaten in `src/sim/data/` entsprechen exakt den Referenzwerten dieser Spec. | `tests/sim/data.test.ts` |
| AC-4 | Wirtschaft gilt wie spezifiziert: Startwerte 200/100, Platzierungsregeln, Upgrade-Kosten, Max-Stufe 5, Verkaufserlös 60 %, Kill-Belohnung und Score, Wellenbonus, Moralverlust bei Leck, Game Over bei Moral ≤ 0. | `tests/sim/economy.test.ts` |
| AC-5 | Wellen gelten wie spezifiziert: Größe, Typverteilung je Phase, PIP-Rhythmus mit Boss ab Welle 6, HP-Skalierung, Spawn-Intervall, Start nur ohne laufende Welle. | `tests/sim/waves.test.ts` |
| AC-6 | Turmeffekte gelten wie spezifiziert: Stufenskalierung, Zielwahl, Dauerstrahl, Projektilverfolgung, BA-Verlangsamung, PPL-Splash und -Aura, Scrum-Rückstoß inkl. Boss-Faktor und Cooldown, Dualo-Ausfall, Außer-Betrieb durch Tech Debt. | `tests/sim/towers.test.ts` |
| AC-7 | Gegner-Sonderfähigkeiten gelten wie spezifiziert: Feature-Zerfall, Scope-Creep-Wachstum mit Obergrenze, Tech-Debt-Störimpuls (1 s / 3 s / 2 s / Radius 75). | `tests/sim/enemies.test.ts` |
| AC-8 | Determinismus: gleicher Seed + gleiche Kommandoliste ergibt nach gleicher Tickzahl einen identischen `stateHash`; ein anderer Seed ergibt einen anderen Hash; die Tickzahl ist unabhängig von der Spielgeschwindigkeit. | `tests/sim/determinism.test.ts` |
| AC-9 | `src/sim/` verwendet keine der verbotenen APIs und importiert weder `phaser` noch DOM-Typen; ein Verstoß lässt `npm run lint` fehlschlagen. | ESLint-Regel + `tests/sim/purity.test.ts` |
| AC-10 | Jeder Lauf erzeugt ein Replay im Format v1; `npm run replay -- <datei>` spielt es headless nach und gibt dieselbe Welle, Moral und denselben Score aus wie der Lauf im Browser; ein manipuliertes Replay (z. B. geänderter `result.score`) wird als Abweichung gemeldet (Exit-Code ≠ 0). | `tests/sim/replay.test.ts` + manueller Lauf |
| AC-11 | Im Browser ist der Funktionsumfang des Originals vorhanden: 5 Türme über Buttons und Tasten 1–5 platzierbar, Platzierungsvorschau mit Reichweite, Turmauswahl per Klick mit Info-Panel, Upgrade [U], Verkaufen [S], Sprint starten per Button/Leertaste, Abbrechen per ESC/Rechtsklick, Tempo x1/x2/x3, Sound an/aus, News-Ticker, Game-Over-Bildschirm mit Neustart; während eines Laufs über 3 Wellen gibt es keine Konsolenfehler. | `tests/e2e/smoke.spec.ts` (Playwright) + Checkliste |
| AC-12 | Das Spielfeld ist optisch gleichwertig zum Original: Whiteboard mit Raster und Kanban-Spalten, Klebeband-Pfad mit Laufmarkierung, Start-/Deadline-Karten, Post-it-Gegner mit Lebensbalken, Magnet-Türme mit Stufensternen, Strahlen, Projektile, Papierschnipsel, Ringe, schwebende Texte, Kamerawackeln, Rotblitz bei Leck. | Screenshots alt/neu in `.tmp/evidence/` |
| AC-13 | `npm run bench` spielt einen festen Bot-Lauf (Seed 12345) headless bis Game Over oder Welle 30 und gibt Laufzeit in ms, Tickzahl, Welle und Score aus; das Ergebnis steht im Ledger. | Befehlsausgabe + Ledger-Eintrag |
