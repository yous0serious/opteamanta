# Spec: Balancing & Challenge-Modus (Teil 3a)

**Status:** Done
**Size:** M
**Ticket:** –
**Plan:** `.ai/specs/balancing-challenge/plan.md` (nach Freigabe) · **Ledger:** `.ai/specs/balancing-challenge/ledger.md`
**Baut auf:** [foundation-phaser-port](../foundation-phaser-port/spec.md), [visual-overhaul](../visual-overhaul/spec.md)

## Ziel

Das Original-Balancing hat keinen Schwierigkeitsgrad: Der Referenz-Bot (`tools/bot.ts`) verliert auf allen vier Karten bis
Welle 40 keinen einzigen Moralpunkt (Messung 2026-11-10, Seeds 1–3). Für eine faire Bestenliste (Spec 3b) braucht das Spiel
eine echte Schwierigkeitskurve und einen Modus mit festem Ende. Diese Spec führt den **Challenge-Modus (30 Wellen, Sieg nach
Welle 30)** ein und stimmt die Spielwerte per Bot-Simulation so ab, dass der Modus schwer, aber schaffbar ist. Der Endlos-Modus
bleibt erhalten, endet aber durch dieselbe Kurve verlässlich.

## Nicht-Ziele

- Bestenliste, Supabase, Daily Seed, Server-Prüfung (→ Spec 3b).
- Neue Türme, Gegner, Karten, Upgrade-Zweige (→ Spec 4).
- Menü-Szene und Einstellungen (→ Spec 2b); die Modus-Wahl in dieser Spec ist minimal (Seitenleiste + URL).
- Änderungen an der Optik außer Modus-Anzeige und Sieg-Bildschirm.

## Randbedingungen

- Determinismus-Regeln aus ADR-0002 gelten weiter: exponentielles Wachstum nur per Multiplikationsschleife oder Tabelle, nie `Math.pow`/`**`.
- Turmwerte (Kosten, Reichweite, Schaden, Stufen) bleiben unverändert – abgestimmt werden Gegner, Wellen und Wirtschaft.
- `GAME_VERSION` wird `0.2.0`; Replays der Version 0.1.0 werden mit klarer Meldung abgelehnt.
- Die Tests aus Spec 1 für geänderte Werte werden auf die neuen Literalwerte dieser Spec umgestellt (Spec 1 AC-3–AC-5 gelten für v0.1.0).
- Nachrechnen eines Challenge-Laufs ≤ 1,0 s in Node (Reserve für das 2-s-CPU-Limit der Supabase Edge Functions, Spec 3b).

## Entscheidungen

- Zwei Modi: `challenge` (Standard) und `endless`. Challenge endet mit **Sieg**, sobald Welle 30 abgeschlossen ist; Moral ≤ 0 ist weiterhin Game Over.
- Sieg-Bonus auf den Score: **Moral × 100** (belohnt fehlerfreie Läufe, Tiebreaker bei gleichem Kill-Score).
- Hebel für das Balancing (Werte werden beim Tuning festgelegt und vor Abschluss als Tabelle „Referenzwerte v0.2.0“ in diese Spec übernommen):
  HP-Wachstum pro Welle (exponentiell), Belohnung pro Kill (nicht mehr mit √HP gekoppelt), Wellenbonus, Gegnerzahl und -mischung pro Welle, Boss-HP.
- Zwei Bots als Messlatte: `tools/bot.ts` (Referenz, Strategie unverändert) und `tools/bot-strong.ts` (stärkere Heuristik: Pfadabdeckung, gezielte Upgrades).
- Replay-Format 2: zusätzliches Pflichtfeld `mode`; Format 1 wird abgelehnt.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | `GameOptions.mode` (`challenge` \| `endless`, Standard `challenge`) ist Teil des Zustands, des State-Hashes und des Replays (Format 2); Format-1-Replays und `gameVersion ≠ 0.2.0` werden von `parseReplay` mit Meldung abgelehnt. | `tests/sim/replay.test.ts` |
| AC-2 | Challenge: Nach Abschluss von Welle 30 ist der Lauf beendet (`over = true`, `won = true`, Event `victory`), Score += Moral × 100; `startWave` danach abgelehnt. Endlos: kein Sieg, Verhalten wie bisher. | `tests/sim/modes.test.ts` |
| AC-3 | Referenz-Bot im Challenge-Modus über 20 Läufe (Seeds 1–5 × 4 Karten): Median der erreichten Welle 18–25, Siegquote ≤ 10 %. | `npm run balance` + Ledger |
| AC-4 | Starker Bot im Challenge-Modus über dieselben 20 Läufe: Siegquote ≥ 50 % (Modus ist schaffbar). | `npm run balance` + Ledger |
| AC-5 | Einstieg bleibt zugänglich: Referenz-Bot verliert in den Wellen 1–5 in ≥ 90 % der 20 Läufe keine Moral. | `npm run balance` |
| AC-6 | Endlos endet: Starker Bot erreicht im Endlos-Modus in allen 20 Läufen Game Over spätestens in Welle 45. | `npm run balance` |
| AC-7 | Nachrechnen des längsten Challenge-Laufs des starken Bots dauert ≤ 1,0 s (`npm run bench`, Node). | Befehlsausgabe + Ledger |
| AC-8 | Die Werte stehen als Tabelle „Referenzwerte v0.2.0“ in dieser Spec, und Vitest prüft sie mit Literalwerten; alle Suites grün. | `npm test` |
| AC-9 | Browser: Modus wählbar (Seitenleiste vor dem ersten Sprint, `?mode=`), HUD zeigt im Challenge „Welle n / 30“, Sieg-Bildschirm „RELEASE ERFOLGREICH!“ mit Score und Replay-Download; Smoke-Tests grün. | `tests/e2e/smoke.spec.ts` + neuer E2E-Fall |

## Referenzwerte v0.2.0

Ermittelt per Bot-Tuning (`npm run balance`, 2026-11-10). Turmwerte unverändert gegenüber Spec 1.

| Wert | v0.1.0 (Original) | v0.2.0 |
|---|---|---|
| Startkapital | 200 SP | **300 SP** |
| HP-Skalierung in Welle w | `1 + 0.28·(w−1)` (linear) | **`1.115^(w−1)`** (exponentiell; w=1: 1, w=2: 1.115, w=10: 2.663629…, w=30: 23.494767…) |
| Boss-HP | Grund-HP × Skalierung | **× 2.5** zusätzlich |
| Kill-Belohnung | `round(Grundbelohnung · √hpS)` | **`round(Grundbelohnung · 0.25)`** (ohne Wellenwachstum; z. B. req 6 → 2, story 3 → 1, feat 15 → 4, boss 150 → 38) |
| Wellenbonus nach Welle w | `50 + 10·w` | **`40 + 5·w`** |
| Gegner pro Welle | `8 + 2·w` | unverändert `8 + 2·w` |
| Challenge-Länge | – | **30 Wellen**, danach Sieg |
| Sieg-Bonus | – | **Moral × 100** Score |
| Replay-Format / Spielversion | 1 / 0.1.0 | **2 / 0.2.0** |

Messwerte (20 Läufe je Gruppe, Seeds 1–5 × 4 Karten):

| Gruppe | Median Welle | Min–Max | Siege | Einstieg ohne Moralverlust (W1–5) |
|---|---|---|---|---|
| Referenz-Bot, Challenge | 21 | 11–26 | 0 % | 100 % |
| Starker Bot, Challenge | 30 | 26–30 | 80 % | – |
| Starker Bot, Endlos | 31 | max. 36 | – | – |

Nachrechnen des längsten Challenge-Laufs (starker Bot, 103 085 Ticks): 301 ms (Node).

## Risiken

- Ein „starker Bot“ ist selbst Heuristik: Erreicht er AC-4 nicht, wird erst die Heuristik verbessert, dann das Balancing gelockert (Ruling).
- Abstimmung auf Bots ≠ Spielgefühl für Menschen: Nach dem Tuning eine manuelle Testrunde durch den Nutzer.
