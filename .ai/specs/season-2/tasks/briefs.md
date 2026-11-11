# T01–T13: Briefs (Saison 2)

Gemeinsame Quellen: [Spec](../../../../specs/season-2/spec.md), [Plan](../plan.md). Werte siehe Spec „Entscheidungen“; Endwerte nach T03 in „Referenzwerte v0.3.0“.

## T01 – Sim (hannibal)
Files: `src/sim/types.ts` (TowerType + `rte|rta|rto|board`, EnemyType + `meeting|hotfix`, Tower `syncTime`, Enemy `frozenTime`, RejectReason `limit`, Events `synced`, `businessValue`, `freeze`, `axed`), `src/sim/data/towers.ts`, `src/sim/data/enemies.ts` (`jamTime`), `src/sim/game.ts` (Turm-Schleife, `hurt`-Faktor, Wellenende, Wellenzusammensetzung, `canPlace`), `src/sim/version.ts` (0.3.0), `stateHash` (neue Felder). Verify: `npm test`, `npm run bench`, Replay-Roundtrip.

## T02 – Sim-AC-Tests (general, background)
Files: `tests/sim/roles2.test.ts`, `tests/sim/enemies2.test.ts`, Anpassungen bestehender Tests an 0.3.0. Literalwerte aus der Spec. Verify: `npm test`.

## T03 – Bots + Balancing (hannibal)
Files: `tools/bot.ts`, `tools/bot-strong.ts`, `tools/balance.ts`, `src/sim/data/balance.ts` (+ ggf. Rollenwerte), Spec-Abschnitt „Referenzwerte v0.3.0“. Verify: `npm run balance` alle ✓.

## T04 – Server (hannibal)
`npm run build:sim`, `tests/integration` (Version 0.3.0), CPU-Messung; Deploy-Zeitpunkt laut Plan-Regel.

## T05 – Assets (hannibal)
`tools/characters.ts` (Umfärben per Farbtabelle, Zubehör je Pose an Kopf-/Rumpfanker), Zubehör-SVGs in `assets-src/props/`, Monster-Rezepte `enemy/meeting`, `enemy/hotfix`, Requisiten, NPC-Laufposen; `CREDITS.md`. Verify: `npm run assets && npm run check:assets`, Screenshot-Bogen.

## T06 – Audio (hannibal)
`assets-src/audio/` (Quellen + Lizenzdateien), MP3 nach `public/audio/`, `tools/check-assets.ts` um Audio erweitern, `src/view/audio.ts` (Musikphasen, Überblendung, SFX-Map, prozedurale Büro-Geräusche, Lautstärken). Verify: Budget, Lizenzen, manuelles Abhören in der Sandbox nicht möglich → Pegel/Längen per `ffprobe`, Nutzer hört in der Vorschau.

## T07–T10 – Darstellung (hannibal)
Rollen/Gegner-Effekte (T07), Spielgefühl + Effektstufen (T08), Büroleben + Tageslicht (T09), Oberfläche + Teilen (T10). Verify je Task: Typecheck, Lint, Build, Screenshots, Smoke-E2E.

## T11 – E2E-AC-Tests (general, background)
`tests/e2e/season2.spec.ts` + Anpassungen. Verify: `npx playwright test`.

## T12 – Vorschau-Gate (hannibal)
Screenshot-Set nach `.tmp/evidence/season2/`, Nutzerfrage.

## T13 – Abschluss (hannibal)
Alle Checks, Bench, `check:assets`, Secret-Grep, Lockfile, Function-Deploy, Push, Live-Test Saison 2.
