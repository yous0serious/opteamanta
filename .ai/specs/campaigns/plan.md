# Plan: campaigns (Spec `specs/campaigns/spec.md`)

## Arbeitsweise
Parallele Subagents im selben Worktree mit **fester Datei-Zuständigkeit**. Kein Agent committet; der Orchestrator prüft
und committet nach jeder Welle. `npm run typecheck` prüft das ganze Projekt – Fehler in fremden Pfaden während einer
Welle sind erwartet; jeder Agent sorgt dafür, dass **seine** Pfade fehlerfrei sind. Nur Agent B führt `npm run assets` aus,
nur Agent A `npm run build:sim`. Keine neuen npm-Abhängigkeiten ohne Rückfrage. Keine E2E-Läufe in Welle 1 (Orchestrator).

## Welle 1 (parallel)
| Agent | Paket | Besitzt |
|---|---|---|
| A | Simulation: Typen, 8 Gegner + 4 Bosse, 8 neue Karten, 24 Level, Skilltree + Modifikatoren, Zielmodi, Upgrade-Zweige, `peekWave`, Replay v3, Progression-Funktionen, Bots/Balancing-Grundgerüst, Sim-Bündel | `src/sim/**`, `tests/sim/**`, `tools/{bot,bot-strong,balance,bench,replay-cli,build-sim}.ts`, `supabase/functions/_shared/sim.js` |
| B | Art/Audio: Themes je Kampagne (Boden, Deko, Licht), Monster für alle neuen Gegner/Bosse, Zweig-Optik der Rollen, Icons (Skills, Erfolge, Gegner-Vorschau), UI-Grafiken, Kampagnen-Musik, UI-Sounds | `assets-src/**`, `tools/{build-assets,monsters,characters,asset-variants,check-assets}.ts`, `public/assets/**`, `public/audio/**`, `src/view/render/**`, `src/view/PreloadScene.ts`, `src/view/audio.ts` |
| C | Shell-UI: Router, Hauptmenü, Kampagnenkarte, Briefing, Ergebnis, Skilltree, Ranglisten, Erfolge, Einstellungen; im Spiel Pause, Wellenvorschau, Zielmodus/Zweigwahl; Mobile-Layouts | `src/ui/**`, `index.html`, `src/view/style.css`, `src/view/hud.ts`, `src/view/input.ts`, `src/view/leaderboard.ts`, `src/view/nickname.ts`, `src/view/share.ts`, `tests/e2e/ui-*.spec.ts` |
| D | Backend: Migration (Boards, XP, Level-Ergebnisse, Skills, Erfolge, RPCs, RLS), Edge Functions (`start-run` Board/Level + Loadout-Snapshot, `submit-run` Replay v3, `verify-runs` XP/Erfolge), `src/online/**` API, Tests, CSP-Header | `supabase/migrations/**`, `supabase/functions/**` (außer `_shared/sim.js`), `src/online/**`, `tests/server/**`, `tests/integration/**`, `netlify.toml` |

## Welle 2 (Orchestrator + Agents)
- E Meta-Dienst `src/meta/**` (online über `src/online`, offline localStorage), Erfolge-Regeln.
- F Integration: `src/main.ts`, `src/view/GameScene.ts`, `src/view/controller.ts`, `src/view/fx.ts`, `src/view/params.ts` – Level/Theme laden, Pause, Ergebnis an Shell.
- G Balancing aller 24 Level (Bots), Sternziele, `GAME_VERSION` 0.4.0 final, Sim-Bündel.
- H Tests: E2E Menü → Level → Ergebnis → Skill, Mobile, Offline; Screenshot-Bogen.
- I Reviews: code-review, security-review (neue RPCs/Functions).

## Sim-API (Vertrag, Export aus `src/sim/index.ts`)
- Typen: `EnemyType` (+ `impediment|spike|dependency|enabler|compliance|shadow-it|vendor-lock|epic|b-scope|b-pi|b-hydra|b-lbc`),
  `MapId` (bestehende 4 + `open-plan|kanban-loop|retro-spiral|big-room|program-board|dependency-web|server-aisles|cable-maze|firewall|glass-tower|boardroom-table|stage-gate`),
  `GameMode` (+ `'level'`), `CampaignId`, `LevelId`, `ThemeId` (`open-office|big-room|server-room|boardroom`), `SkillId`,
  `SkillLoadout = Partial<Record<SkillId, number>>`, `TargetMode = 'first'|'last'|'strong'|'near'`, `Branch = 'a'|'b'`,
  `Modifiers`, `ReplayV3` (= `Replay`), `ReplayResult` (+ `kills`, `stars`, `leaks`).
- Daten: `CAMPAIGNS`, `LEVELS`, `levelById(id)`, `MAPS` (+ `theme` je Karte für freie Spiele), `SKILLS`, `BRANCHES`,
  `ENEMIES` (+ `boss?: true`, `campaign?`), `TOWER_ORDER`.
- `new Game({ seed, mapId?, mode?, levelId?, loadout? })`; `game.peekWave(n): EnemyType[]`; `game.state.kills`, `.leaks`;
  `game.stars(): 0|1|2|3`; Kommandos `{ type: 'target', towerId, mode }`, `{ type: 'upgrade', towerId, branch? }`.
- Replays: `parseReplay(input, opts)` (Format 3), `runReplay(r)` → `{ …result, matches, hash }`.
- Progression: `xpForRun(result, { firstClear, won }): number`, `xpForLevel(level): number` (kumulativ),
  `levelForXp(xp): { level, into, need }`, `skillPointsForLevel(level)`, `validateLoadout(loadout, points): string | null`,
  `modifiersFor(loadout): Modifiers`, `ACHIEVEMENTS` + `achievementsFor(stats)`.
- Neue SimEvents: `stalled`, `sprinted`, `healed`, `revealed`, `budgetCut`, `bossPhase`, `spawnedMinion`, `targetChanged`.
