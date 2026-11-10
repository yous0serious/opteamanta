# Ledger: Fundament – Port auf Phaser 4 mit deterministischer Simulation

**Spec:** [spec.md](../../../specs/foundation-phaser-port/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | d024b24 | Ruling: `.env.example` entfällt (Sandbox-Policy blockiert `.env*`-Dateien); Variablen werden in der README dokumentiert. `@types/node@22` ergänzt. Lint-Probe: 5/5 Verstöße erkannt. |
| T02 | done | 8c0260f | Rauchtest: 3 Wellen, Replay `matches: true`, Hash identisch. Ruling: `spawnEnemy` skaliert mit `max(1, wave)`, damit Tests vor Welle 1 Gegner mit hpS = 1 erzeugen (im Spiel nie Welle 0). Ruling: Gegner mit `hp ≤ 0` werden zusätzlich am Tickende entfernt (ohne Verhaltensänderung). |
| T03 | done | 4d1c028 | Bench Seed 12345: 30 Wellen, 74 678 Ticks, 299 Türme, Nachrechnen 691 ms (vor Stats-Cache 1 187 ms), Hash `27f5c064` unverändert. Replay-CLI: Exit 0 / 1 (manipuliert) / 2 (format 2). Ruling: `towerStats` wird pro Turm gecacht (invalidiert bei place/sell/upgrade), verhaltensneutral. |
| T04 | done | 5137f41 | general: 129 Tests in 8 Suites (AC-3…AC-10), alle grün. Ruling: Scope-Creep-Wachstum wird auf exakt 2× Start-Max-HP gekappt (Spec-Wortlaut; Original überschoss im letzten Tick um < 0,1 %). Ein Test bekam eine Gleitkomma-Toleranz (+1e-9). D-3 nachgezogen in `tests/sim/deviations.test.ts` (Mutationsprobe: Test schlägt ohne Fix fehl). |
| T05 | done | e162ca9 | Phaser-Szene mit Weltcontainer (Wackeln) und Overlay. Ruling: kein eigenes `loop.ts`, der Fixed-Step steckt in `Controller.advance` (wie im Brief-Interface). Ruling: Effekte laufen in Echtzeit (nicht mit Tempo skaliert), nach Game Over mit 30 %. Sandbox-Chromium hat keine Emoji-/Handschrift-Fonts (Kästchen/Serif) – Umgebungsthema, betrifft das Original gleich. |
| T06 | done | e162ca9 | Browser-Replay (Seed 1, Game Over Welle 2, Tick 5202) → `npm run replay` Exit 0, `matches=true`. Ruling: Tasten 1–5 wählen immer aus, Buttons schalten um (wie Original). |
| T07 | done | (T07/T08-Commit) | general: 9 Playwright-Tests grün (7 Smoke + 2 Evidence), 2,8 min; Screenshots `.tmp/evidence/{old,new}-{start,wave,over}.png`. Brief-Korrektur: „Sprint 2“ wird erst nach 3 Wellen angezeigt (Welle 1 = PIP). `@playwright/test` 1.63.0 exakt (passend zum installierten Browser). |
| T08 | done | (T07/T08-Commit) | README vollständig; Gesamtverifikation siehe „AC-Nachweise“; Trivy-Baseline `.trivy-baseline.json` angelegt. |

## AC-Nachweise

| AC | Ergebnis | Nachweis |
|---|---|---|
| AC-1 | erfüllt | `npm run build` grün; Requests zur Laufzeit nur an `localhost:4173` (`.tmp/netcheck.mjs`). Im Bundle stehen 2 `phaser.io`-Zeichenketten (Phaser-Standard-URL und Konsolen-Banner, Banner abgeschaltet) – Metadaten, keine Ladeverweise. |
| AC-2 | erfüllt | `npm run typecheck`, `npm run lint`, `npm test` (130 Tests in 9 Suites) mit Exit 0 |
| AC-3 | erfüllt | `tests/sim/data.test.ts` (28 Tests) |
| AC-4 | erfüllt | `tests/sim/economy.test.ts` (20 Tests) |
| AC-5 | erfüllt | `tests/sim/waves.test.ts` (18 Tests) |
| AC-6 | erfüllt | `tests/sim/towers.test.ts` (24 Tests), D-3 in `tests/sim/deviations.test.ts` |
| AC-7 | erfüllt | `tests/sim/enemies.test.ts` (8 Tests) |
| AC-8 | erfüllt | `tests/sim/determinism.test.ts` (6 Tests) |
| AC-9 | erfüllt | ESLint-Regel + `tests/sim/purity.test.ts` (25 Tests, 5 Lint-Proben) |
| AC-10 | erfüllt | `tests/sim/replay.test.ts` (10 Tests); E2E-Fall 5 (Browser-Replay → Node `runReplay` → `matches`); manuell: Browser-Replay per CLI Exit 0, manipuliert Exit 1, ungültig Exit 2 |
| AC-11 | erfüllt | `tests/e2e/smoke.spec.ts` Fälle 1–7, keine Konsolenfehler |
| AC-12 | erfüllt | Screenshots alt/neu in `.tmp/evidence/` (Start, Welle, Game Over), Sichtvergleich gleichwertig |
| AC-13 | erfüllt | `npm run bench`: Seed 12345, Karte matrix, 30 Wellen, 74 690 Ticks, Score 287 780, 299 Türme, Spiel 849 ms, Nachrechnen 681 ms (9,1 ms / 1 000 Ticks), `matches=true` |

**SCA (Quality Gate: keine neuen CRITICAL/HIGH):** Trivy-DB vom 2026-11-10; Laufzeit-Abhängigkeiten 0 Befunde; Dev-Abhängigkeiten 1 × MEDIUM (`minimatch` 10.2.6, CVE-2026-118764, Fix in 11.0.1, transitiv über ESLint) → Warnung, kein Block. Baseline `.trivy-baseline.json`.

## Rulings

- **R-1** TypeScript 6.0.3 statt 7.0.2, weil `typescript-eslint` 8.72 nur `typescript <6.1` unterstützt (Planung).
- **R-2** Sim-Tickrate 60 Hz für maximale Nähe zum Original; ob die Edge Function in Spec 3 schnell genug nachrechnet, entscheidet `npm run bench` (Planung).
- **R-3** Im Replay werden nur angenommene Kommandos aufgezeichnet; ein abgelehntes Kommando beim Nachspielen gilt als Manipulation (Planung).
- **R-4** `npm test` = alle Vitest-Suites; Playwright separat über `npm run test:e2e`, weil es einen Browser braucht (Planung).
- **R-5** `supabase.txt` (URL + Publishable Key) bleibt außerhalb von Git (`.gitignore`); Nutzung erst in Spec 3 über `.env.local` (Planung).
- **R-6** Scope Creep wird auf exakt 2× Start-Max-HP gekappt (T04).

## Open questions

- **O-1** (Nutzer, vor Spec 3) Balancing des Originals: Der Bot verliert bis Welle 200 keine Moral (Seeds 1, 2, 12345; ~750 000 Ticks, ~11 s Nachrechnen). Ein Endlos-Lauf endet damit praktisch nie – für eine Bestenliste braucht es eine Schwierigkeitskurve oder ein Laufende (z. B. feste Wellenzahl, stärkere HP-Skalierung, Zeitlimit). Außerhalb des Scopes von Spec 1 (1:1-Werte).

## Log

- 2026-11-10: Repo angelegt, Referenzstand committet (`007e411`). Spec, Plan, 8 Briefs, ADR-0001/0002 (proposed) geschrieben. Freigabe erteilt.
- 2026-11-10: T01–T08 erledigt. 130 Vitest-Tests, 9 Playwright-Tests grün; alle 13 ACs mit Nachweis. Nächster Schritt: Spec 2 `visual-overhaul` (Entwurf), danach O-1 vor Spec 3 klären.
