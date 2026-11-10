# Ledger: Balancing & Challenge-Modus (3a)

**Spec:** [spec.md](../../../specs/balancing-challenge/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commit) | Rauchtest: Challenge-Sieg nach Welle 30 (Bonus 100 × 100), Replay Format 2 `matches`, `startWave` nach Sieg → `gameOver`; Endlos läuft über Welle 30. Parser lehnt Format 1, Version 0.1.0, Turmtyp als Array, `cx = 24`, Tick `1e300`, Modus `hard` ab; `maxTicks` greift. Ruling: nach dem Sieg endet der Tick sofort (Zustand eingefroren wie bei Game Over). 2 Replay-Tests (Format 1) rot bis T05. |
| T02 | done | (T02–T04-Commit) | `BalanceConfig` + `BALANCE` in `src/sim/data/balance.ts`; HP-Faktor je Welle per Schleife in `state.waveHpScale` (im Hash); Belohnung entkoppelt. Ruling: zusätzlicher Hebel `rewardFactor` (Faktor auf Grundbelohnung), weil `rewardGrowth` allein die Wirtschaft nicht knapp genug macht. Ruling: Perf ohne Verhaltensänderung – Schuss-Türme suchen nur ein Ziel, wenn sie feuern könnten; exakter Vorfilter in `findTarget` (Score/Ticks identisch). |
| T03 | done | (T02–T04-Commit) | `tools/bot-strong.ts`, `tools/balance.ts` (Worker-Threads, 12 Kerne, `--sweep`/`--balance`/`--json`), `runReplay(r, { balance })` nur für Tools. Ruling: erste Heuristik (reiner Wert pro SP) war schwächer als der Referenz-Bot (15 % vs. 90 % Siege, fast nur Entwickler) → neu: gleicher Turm-Mix wie Referenz, Platzierung nach Pfadabdeckung, Upgrades nach Nutzen/SP, Nachkauf alle 60 Ticks. |
| T04 | done | (T02–T04-Commit) | Sweeps: starkes exponentielles Wachstum (≥ 1,22) erzeugt eine „Wand“ (beide Bots sterben gleichzeitig); flaches Wachstum + knappe Wirtschaft + zäher Boss trennt gute von mittelmäßiger Spielweise. Gewählt: hpGrowth 1.115, rewardFactor 0.25, rewardGrowth 0, Wellenbonus 40+5w, bossHpFactor 2.5, startMoney 300. `npm run balance`: alle AC-3–AC-7 ✓ (Ref Median 21 / 0 % Siege, Stark 80 % Siege, Einstieg 100 %, Endlos max. 36, Prüfzeit 301 ms). Bench (Seed 12345, starker Bot): Welle 26 verloren, 67 ms Prüfzeit. |
| T05 | todo | – | |
| T06 | todo | – | |
| T07 | todo | – | |

## Rulings

- **R-1** Ist-Messung (2026-11-10): Referenz-Bot verliert auf allen 4 Karten bis Welle 40 keine Moral; nur exponentielles HP-Wachstum (×1,2 pro Welle) bringt den Median auf Welle 29, Abbrüche fast immer in Boss-Wellen. Das Balancing braucht deshalb auch Wirtschafts-Hebel (Planung).
- **R-2** Parser-Härtung aus der Anti-Cheat-Analyse (Befunde 1–5) wird in T01 mit umgesetzt, weil `replay.ts` ohnehin für Format 2 angepasst wird (Planung).

## Open questions

- keine

## Log

- 2026-11-10: Spec 3a freigegeben (Schwierigkeit „schwer, aber schaffbar“, Sieg-Bonus Moral × 100). Plan + 7 Briefs geschrieben, wartet auf Freigabe.
