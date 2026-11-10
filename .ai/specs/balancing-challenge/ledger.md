# Ledger: Balancing & Challenge-Modus (3a)

**Spec:** [spec.md](../../../specs/balancing-challenge/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commit) | Rauchtest: Challenge-Sieg nach Welle 30 (Bonus 100 × 100), Replay Format 2 `matches`, `startWave` nach Sieg → `gameOver`; Endlos läuft über Welle 30. Parser lehnt Format 1, Version 0.1.0, Turmtyp als Array, `cx = 24`, Tick `1e300`, Modus `hard` ab; `maxTicks` greift. Ruling: nach dem Sieg endet der Tick sofort (Zustand eingefroren wie bei Game Over). 2 Replay-Tests (Format 1) rot bis T05. |
| T02 | done | (T02–T04-Commit) | `BalanceConfig` + `BALANCE` in `src/sim/data/balance.ts`; HP-Faktor je Welle per Schleife in `state.waveHpScale` (im Hash); Belohnung entkoppelt. Ruling: zusätzlicher Hebel `rewardFactor` (Faktor auf Grundbelohnung), weil `rewardGrowth` allein die Wirtschaft nicht knapp genug macht. Ruling: Perf ohne Verhaltensänderung – Schuss-Türme suchen nur ein Ziel, wenn sie feuern könnten; exakter Vorfilter in `findTarget` (Score/Ticks identisch). |
| T03 | done | (T02–T04-Commit) | `tools/bot-strong.ts`, `tools/balance.ts` (Worker-Threads, 12 Kerne, `--sweep`/`--balance`/`--json`), `runReplay(r, { balance })` nur für Tools. Ruling: erste Heuristik (reiner Wert pro SP) war schwächer als der Referenz-Bot (15 % vs. 90 % Siege, fast nur Entwickler) → neu: gleicher Turm-Mix wie Referenz, Platzierung nach Pfadabdeckung, Upgrades nach Nutzen/SP, Nachkauf alle 60 Ticks. |
| T04 | done | (T02–T04-Commit) | Sweeps: starkes exponentielles Wachstum (≥ 1,22) erzeugt eine „Wand“ (beide Bots sterben gleichzeitig); flaches Wachstum + knappe Wirtschaft + zäher Boss trennt gute von mittelmäßiger Spielweise. Gewählt: hpGrowth 1.115, rewardFactor 0.25, rewardGrowth 0, Wellenbonus 40+5w, bossHpFactor 2.5, startMoney 300. `npm run balance`: alle AC-3–AC-7 ✓ (Ref Median 21 / 0 % Siege, Stark 80 % Siege, Einstieg 100 %, Endlos max. 36, Prüfzeit 301 ms). Bench (Seed 12345, starker Bot): Welle 26 verloren, 67 ms Prüfzeit. |
| T05 | done | (T05/T06-Commit) | general: 16 veraltete Tests auf v0.2.0 umgestellt, neu `modes.test.ts` (4, AC-1/AC-2) und `balance.test.ts` (15, AC-8), Replay-Tests +7 (Format 2, Version, Härtung, `maxTicks`); 160/160 grün, keine Abweichungen. |
| T06 | done | (T05/T06-Commit) | Moduswahl in der Seitenleiste (nur vor dem ersten Sprint, gleicher Seed), `?mode=`, „Welle n/30“, Sieg-Overlay „RELEASE ERFOLGREICH!“ mit Score/Moral-Bonus, Konfetti, Sieg-Jingle; Neustart behält den Modus. Smoke 9/9 grün inkl. neuer Fälle 8 (Moduswahl) und 9 (Sieg; per Debug manipulierter Lauf wird beim Nachrechnen als Abweichung erkannt). Smoke-Werte auf 300 SP umgestellt (Fall 3 mit zwei Entwicklern, damit das Upgrade weiter abgelehnt wird). |
| T07 | done | (T07-Commit) | `npm run typecheck`, `lint`, `test` (160/160), `balance` (alle ✓), `bench`, `build`, `test:e2e` (17/17) grün; README (Modi, `npm run balance`, Replay-Format 2). Push nach `main` (Netlify). |

## AC-Nachweise

| AC | Ergebnis | Nachweis |
|---|---|---|
| AC-1 | erfüllt | `tests/sim/replay.test.ts` (Format 2, Format-1-/Versions-Ablehnung, Härtung), `tests/sim/modes.test.ts` (Standardmodus, Hash je Modus) |
| AC-2 | erfüllt | `tests/sim/modes.test.ts` (Sieg nach Welle 30, Bonus Moral × 100, `startWave` → `gameOver`; Endlos läuft weiter) |
| AC-3 | erfüllt | `npm run balance`: Referenz-Bot Median 21 (11–26), 0 % Siege |
| AC-4 | erfüllt | `npm run balance`: starker Bot 80 % Siege (min. Welle 26) |
| AC-5 | erfüllt | `npm run balance`: Einstieg ohne Moralverlust 100 % |
| AC-6 | erfüllt | `npm run balance`: starker Bot Endlos alle Läufe Game Over, max. Welle 36 |
| AC-7 | erfüllt | `npm run balance`: längster Challenge-Lauf 103 085 Ticks in 301 ms nachgerechnet; `npm run bench` 67 ms |
| AC-8 | erfüllt | Tabelle „Referenzwerte v0.2.0“ in der Spec; `tests/sim/balance.test.ts` (15 Literal-Tests); `npm test` 160/160 |
| AC-9 | erfüllt | Smoke-Fälle 8 (Moduswahl/Sperre, „Welle 1/30“) und 9 (Sieg-Overlay, „NEUES PROGRAMM“, Replay-Button); Screenshot `.tmp/evidence/victory.png` |

## Rulings

- **R-1** Ist-Messung (2026-11-10): Referenz-Bot verliert auf allen 4 Karten bis Welle 40 keine Moral; nur exponentielles HP-Wachstum (×1,2 pro Welle) bringt den Median auf Welle 29, Abbrüche fast immer in Boss-Wellen. Das Balancing braucht deshalb auch Wirtschafts-Hebel (Planung).
- **R-2** Parser-Härtung aus der Anti-Cheat-Analyse (Befunde 1–5) wird in T01 mit umgesetzt, weil `replay.ts` ohnehin für Format 2 angepasst wird (Planung).
- **R-3** Der HP-Faktor wird bei jedem Spawn aus der aktuellen Welle berechnet statt im Zustand zwischengespeichert (robust gegen direkt gesetzte `state.wave` in Tests/Werkzeugen; Ergebnisse unverändert).
- **R-4** Erkenntnis aus dem Tuning: Fast alle Läufe enden in Boss-Wellen (PIP alle 5 Wellen); der Boss-HP-Faktor ist der wirksamste Hebel, um konzentrierte von breiter Verteidigung zu trennen.

## Open questions

- **O-1** (Nutzer) Manuelle Testrunde Challenge-Modus: fühlt sich die Kurve fair an (v. a. der Boss in Welle 11 und 21)? Danach ggf. Feintuning als v0.2.1.

## Log

- 2026-11-10: Spec 3a freigegeben (Schwierigkeit „schwer, aber schaffbar“, Sieg-Bonus Moral × 100). Plan + 7 Briefs geschrieben, wartet auf Freigabe.
