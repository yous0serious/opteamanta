# Spec: Kampagnen, Hauptmenü, Progression – „Backlog Defense: SAFe Edition“ (Teil 6)

**Status:** In Arbeit
**Size:** XL
**Plan:** `.ai/specs/campaigns/plan.md` · **Ledger:** `.ai/specs/campaigns/ledger.md`
**Baut auf:** [season-2](../season-2/spec.md), [leaderboard-supabase](../leaderboard-supabase/spec.md), [office-makeover](../office-makeover/spec.md)

## Ziel

Aus dem Ein-Bildschirm-Spiel wird ein vollständiges Tower-Defense-Spiel im SAFe-Kontext: **Hauptmenü** mit Ranglisten,
**4 Kampagnen à 6 Level** (Team → ART → Large Solution → Portfolio) mit eigenem Look, eigenen Gegnern und Bossen,
**XP und Account-Level**, **Skilltree** (3 Äste), **Ranglisten pro Map, pro Level und Daily**, dazu Wellenvorschau, Pause,
Zielmodi, Upgrade-Zweige, Tutorial und Erfolge. Fortschritt liegt serverseitig (fälschungssicher), Skills zählen in
Ranglisten und werden im Replay mitgeprüft (Nutzerentscheidungen 2026-11-12).

## Nicht-Ziele

- Bezahlinhalte, Lootboxen, Energie-Systeme. KI-generierte Grafik/Musik. CC-BY-Assets.
- Mehrspieler in Echtzeit. Native Apps (Web/PWA bleibt).

## Randbedingungen

- Simulation bleibt deterministisch (ADR-0002, ESLint-Regeln für `src/sim`). Alle neuen Mechaniken, Skills, Zielmodi und
  Upgrade-Zweige wirken nur über Daten + Seed-RNG; der Server rechnet jedes Ranglisten-Replay nach.
- Grafik/Audio nur CC0 (Kenney, OpenGameArt-CC0) und eigene Werke; jede Datei in `public/assets/CREDITS.md`;
  Atlas + Schriften ≤ 8 MB (neues Budget), Audio ≤ 12 MB.
- Canvas-Renderer bleibt spielbar; Helligkeit der Spielfelder ≥ 0,70 (office-makeover AC-3) – auch dunklere Themes
  (Serverraum) bleiben hell gehalten.
- Mobile (Mobile-Update vom 2026-11-12) bleibt vollständig spielbar: alle neuen Screens hoch/quer, Touch.
- Offline-Betrieb ohne `VITE_SUPABASE_*`: Kampagne lokal spielbar, Fortschritt lokal (als „nicht gewertet“ markiert),
  Ranglisten zeigen „offline“.

## Entscheidungen

### Spielversion / Replays
- `GAME_VERSION` = **0.4.0**, **Replay-Format 3**:
  `{ format: 3, gameVersion, seed, levelId | null, mapId, mode, loadout: SkillLoadout, commands, endTick, result }`.
  `mode`: `'challenge' | 'endless' | 'level'`. `result` zusätzlich `kills`, `stars` (0–3), `leaks`.
- Neue Replay-Kommandos: `[tick, 'target', towerId, TargetMode]`, `[tick, 'upgrade', towerId, branch?]`
  (`branch` = `'a' | 'b'`, nur beim Schritt Stufe 2 → 3 Pflicht).
- `parseReplay` lehnt Format 2 ab; Server kennt nur 0.4.0.

### Level-Daten (`src/sim/data/campaigns.ts`)
```ts
type CampaignId = 'team' | 'art' | 'solution' | 'portfolio';
interface CampaignDef { id: CampaignId; name: string; tagline: string; theme: ThemeId; levels: LevelId[]; boss: EnemyType }
interface LevelDef {
  id: LevelId;                 // 'team-1' … 'portfolio-6'
  campaign: CampaignId; index: number; name: string; briefing: string;
  mapId: MapId; waves: number; startMoney: number; lives?: number;
  roles: TowerType[];          // verfügbare Rollen (Kampagne 1 schaltet sie nach und nach frei)
  pool: WaveBand[];            // Gegner-Gewichte je Wellenbereich
  bossWaves: Array<{ wave: number; boss: EnemyType }>;
  mods?: { hp?: number; speed?: number; reward?: number }; // Multiplikatoren
  stars: { two: number; three: number }; // Mindest-Moral für 2/3 Sterne (1 Stern = geschafft)
  tutorial?: boolean;
}
interface WaveBand { from: number; to: number; size: [base: number, perWave: number]; weights: Partial<Record<EnemyType, number>> }
```
Wellen werden per Seed-RNG aus den Gewichten gezogen (wie heute), Boss-Wellen fest. `Game.peekWave(n)` liefert die
Zusammensetzung einer künftigen Welle ohne Zustand zu ändern (Wellenvorschau).

### Kampagnen und Themes
| Kampagne | Name | Theme (`ThemeId`) | neue Gegner | Boss |
|---|---|---|---|---|
| `team` | Team-Ebene: Das erste PI | `open-office` (Eiche, Fensterlicht, Pflanzen) | `impediment`, `spike` | `b-scope` „Sprint-Scope-Explosion“ |
| `art` | ART: Der Release Train fährt ein | `big-room` (PI-Planning-Halle, Teppich, Program Board mit roten Fäden, Sticky-Wände) | `dependency`, `enabler` | `b-pi` „Big-Room-Chaos“ |
| `solution` | Large Solution: Abhängigkeitshölle | `server-room` (helle Fliesen, Serverschränke, Kabelkanäle, blaue LEDs) | `compliance`, `shadow-it`, `vendor-lock` | `b-hydra` „Integrations-Hydra“ |
| `portfolio` | Portfolio: Lean Portfolio Management | `boardroom` (Vorstandsetage, Glas, Marmor, Teppich, Skyline-Licht) | `epic` | `b-lbc` „Lean Business Case Q4“ |

Je Kampagne 3 Karten (4 bestehende + 8 neue Wegverläufe), jede Karte trägt 2 Level mit anderem Gegner-Mix/Modifikator.
Level 6 jeder Kampagne ist der Boss-Level. Kampagne 1 ist Tutorial-geführt (Level 1–2) und schaltet Rollen schrittweise frei.

### Neue Gegner (Startwerte, Endwerte per Bot-Tuning)
| Typ | Name | HP | Tempo | Belohnung | Mechanik |
|---|---|---|---|---|---|
| `impediment` | Impediment | 90 | 40 | 10 | bleibt alle 4 s für 1,2 s stehen; während des Stehens −40 % Schaden |
| `spike` | Spike | 20 | 80 | 4 | alle 3 s 0,8 s Sprint mit Tempo ×2,2 |
| `dependency` | Abhängigkeit | 45 | 58 | 7 | spawnt als Paar (gekoppelt); Schaden am einen wird 50/50 geteilt, solange beide leben |
| `enabler` | Enabler Story | 50 | 52 | 9 | heilt Gegner im Umkreis 70 px um 4 % Max-HP/s (nicht sich selbst, nicht Bosse) |
| `compliance` | Compliance-Audit | 140 | 36 | 14 | Panzer: −50 % Schaden, außer im RTA-Runway |
| `shadow-it` | Schatten-IT | 40 | 75 | 9 | nicht anvisierbar, außer in Reichweite eines Business Analyst oder RTA (Entdeckung) |
| `vendor-lock` | Vendor Lock-in | 80 | 44 | 12 | Rollen im Umkreis 75 px feuern 40 % langsamer |
| `epic` | Epic | 320 | 30 | 30 | zerfällt beim Erledigen in 3 Features |
| `b-scope` | Sprint-Scope-Explosion | 1400 | 26 | 160 | wächst wie Scope Creep; spawnt alle 5 s eine User Story |
| `b-pi` | Big-Room-Chaos | 1800 | 24 | 180 | alle 6 s Meeting-Störung Umkreis 110 px, 1,5 s |
| `b-hydra` | Integrations-Hydra | 2200 | 24 | 200 | bei 66 % und 33 % HP spawnt sie 2 Dependencies; gepanzert wie Compliance |
| `b-lbc` | Lean Business Case Q4 | 2800 | 22 | 250 | alle 8 s „Budget-Kürzung“: −10 % aktuelle Kapazität (min. 0); gepanzert |

### Zielmodi und Upgrade-Zweige
- Zielmodus je angreifender Rolle: `first` (Standard, weitester Fortschritt), `last`, `strong` (meiste HP), `near`.
- Upgrade-Zweig beim Schritt auf Stufe 3 (Stufen 3–5 folgen dem Zweig), je Rolle zwei Zweige, z. B. Entwickler
  *Full-Stack* (Reichweite) vs. *10x-Dev* (DPS); Scrum Master *Coach* (Rückstoß) vs. *Agile Coach* (Verlangsamung im Umkreis);
  Werte in `src/sim/data/towers.ts` (`BRANCHES`).

### Progression (serverseitig)
- **XP** pro gewertetem Lauf, berechnet vom Server aus dem nachgerechneten Replay (`src/sim/data/progression.ts`,
  gleiche Funktion im Client für die Vorschau): `kills × 1 + Wellen × 5 + Sterne × 40 + Erstabschluss 100 + Sieg 50`.
  Pro Kill sieht der Spieler „+1 XP“ (Vorschau), gutgeschrieben wird erst nach Prüfung.
- **Account-Level** 1–50: XP-Bedarf `xpForLevel(l) = 100 · l + 25 · l · (l − 1)` (kumulativ, ganzzahlig).
  Je Level 1 Skillpunkt.
- **Skilltree** `src/sim/data/skills.ts`: 3 Äste (`team`, `process`, `leadership`) à 8 Knoten + Kapstein, Ränge 1–3,
  Voraussetzungen; Effekte als `Modifiers` (Sim). `SkillLoadout = Record<SkillId, rank>`. Respec kostenlos.
- **Freischaltung**: Level n+1 einer Kampagne nach ≥ 1 Stern in Level n; Kampagne k+1 nach Boss-Level von k.
- Server speichert `profiles.xp`, `level_results(user, level_id, best_stars, best_score)`, `skill_alloc(user, skill, rank)`;
  Skill-Zuteilung nur per RPC mit Prüfung (Punkte, Voraussetzungen). `start-run` friert das Loadout des Nutzers in der
  Run-Session ein; `submit-run` verlangt Gleichheit mit dem Replay-Loadout.
- Anonyme Konten wie bisher; „Konto sichern“ per E-Mail + Passwort (Supabase `updateUser({ email, password })`, sofort aktiv, „Confirm email“ aus, kein Mailversand), auf anderen Geräten `signInWithPassword` (Nutzerentscheidung 2026-11-13).

### Ranglisten
- Board-IDs: `daily:<YYYY-MM-DD>` (wie bisher), `level:<LevelId>` (Bestwert je Nutzer), `map:<MapId>` (Challenge 30 auf
  dieser Karte, Bestwert je Nutzer). Zeitraum: gesamt / Woche / heute.
- Hauptmenü → „Ranglisten“: Tabs Daily · Karten · Level, eigener Rang hervorgehoben, Top 50 + eigene Umgebung.

### Oberfläche
- **Shell** (DOM, `src/ui/`): Hauptmenü (Logo, Spielen/Kampagne, Daily, Freies Spiel, Skilltree, Ranglisten, Erfolge,
  Einstellungen, Profil-Plakette mit Level + XP-Balken), Kampagnenkarte (SAFe-„Big Picture“ als illustrierter Pfad mit
  Level-Knoten, Sterne, Schlösser), Level-Briefing (Karten-Miniatur, Gegner-Vorschau, Sternziele, Bestwert, Rangliste),
  Ergebnis-Screen (Sterne-Animation, XP-Zähler, Level-Up, Belohnungen, Teilen, Nochmal/Weiter), Skilltree (Knoten-Graph,
  Tooltips, Punkte, Respec), Ranglisten, Erfolge. Hinter der Shell läuft eine animierte Büro-Kulisse (Phaser).
- Router `src/ui/router.ts` mit Zuständen `menu | campaign | briefing | play | results | skills | ranks | achievements`;
  Browser-Zurück funktioniert (Hash-Routen `#/…`).
- Im Spiel: Pause-Knopf (Leertaste bleibt Start; `P`/Knopf = Pause), Wellenvorschau neben dem Start-Button,
  Zielmodus + Zweigwahl in der Infobox.
- Design: bestehender heller Agile-Tool-Look, aufgewertet (Kenney UI Pack 2.0 / Board Game Icons / Game Icons für Icons
  und Rahmen, Caveat + Nunito), Übergänge zwischen Screens, Sound für UI.

### Erfolge (Achievements)
~20 Erfolge (z. B. „Erstes PI“, „Kein Leck“, „Combo 25“, „Alle Bosse“, „3 Sterne Portfolio“), serverseitig aus
gewerteten Läufen abgeleitet, offline lokal.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | 24 Level in 4 Kampagnen mit Daten wie oben; jedes Level ist mit dem starken Bot schaffbar (≥ 1 Stern in ≥ 80 % der Seeds), der Referenz-Bot schafft Kampagne 1 Level 1–3. | Vitest + `npm run balance -- --levels` |
| AC-2 | 8 neue Gegner + 4 Bosse verhalten sich wie in der Tabelle (Literalwerte nach Tuning). | Vitest `tests/sim/campaign-enemies.test.ts` |
| AC-3 | Zielmodi und Upgrade-Zweige wirken wie spezifiziert und sind replay-fest. | Vitest |
| AC-4 | Skills wirken als Modifikatoren; gleiches Replay + Loadout = gleiches Ergebnis; anderes Loadout → Abweichung erkannt. | Vitest (Determinismus, Replay v3) |
| AC-5 | Server: Level- und Map-Ranglisten, XP-Gutschrift nur aus verifizierten Läufen, Skill-RPC prüft Punkte/Voraussetzungen, `submit-run` lehnt fremde Loadouts ab. | Vitest `tests/server/**` + Integrationstests |
| AC-6 | Hauptmenü, Kampagnenkarte, Briefing, Ergebnis, Skilltree, Ranglisten, Erfolge sind per Maus, Tastatur und Touch bedienbar, auf 1366×768, 1920×1080, iPhone hoch/quer ohne Seitwärts-Scrollen. | Playwright |
| AC-7 | Jede Kampagne hat ein eigenes Theme (Boden, Deko, Licht, Musik) und jeder neue Gegner ein eigenes Monster mit Laufanimation. | Screenshot-Bogen |
| AC-8 | Wellenvorschau zeigt die nächste Welle korrekt (gleich der tatsächlichen Welle); Pause hält die Simulation an, ohne Ticks zu verändern. | Vitest + E2E |
| AC-9 | Offline ohne Supabase: Kampagne spielbar, Fortschritt lokal, keine Netzwerkaufrufe. | E2E |
| AC-10 | Budgets: Atlas+Schriften ≤ 8 MB, Audio ≤ 12 MB; `check:assets` grün; jede Datei in CREDITS. | `npm run check:assets` |
