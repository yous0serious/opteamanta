# Spec: Saison 2 – neue Rollen, neue Gegner, mehr Bums (Teil 5)

**Status:** Approved
**Size:** L
**Ticket:** –
**Plan:** `.ai/specs/season-2/plan.md` (nach Freigabe) · **Ledger:** `.ai/specs/season-2/ledger.md`
**Baut auf:** [office-makeover](../office-makeover/spec.md), [balancing-challenge](../balancing-challenge/spec.md), [leaderboard-supabase](../leaderboard-supabase/spec.md) · **ADR:** [0006](../../.ai/knowledge/decisions/0006-audio-sources.md)

## Ziel

Saison 2 bringt **vier neue Rollen** (RTE, RTA, RTO, Vorstand) und **zwei neue Gegner** (Meeting-Einladung, Hotfix) mit eigenen
Mechaniken, eine deutlich **übertriebenere Präsentation** (Combos, fliegende Münzen, Schadenszahlen, Boss-Auftritt, Beförderung,
Tageslicht, Büroleben), **Musik und Soundeffekte** sowie das **Teilen** des Ergebnisses als Text und Bildkarte. Weil sich die
Spielregeln ändern, steigt die Spielversion auf 0.3.0; die Bestenliste beginnt als „Saison 2“ neu.

## Nicht-Ziele

- Neue Karten oder geänderte Wegverläufe; Änderungen an den fünf bestehenden Rollen außer Balancing-Werten.
- Kostenpflichtige Assets, CC-BY-Assets, KI-generierte Grafik oder Musik.
- Migration alter Bestenlisten-Einträge (Saison 1 bleibt in der Datenbank, wird aber nicht mehr angezeigt).
- Mobile-/Touch-Optimierung.

## Randbedingungen

- Simulation bleibt deterministisch (ADR-0002); neue Mechaniken nur über Seed-RNG bzw. deterministische Auswahl.
- Grafik nur CC0 (Kenney über OpenGameArt) und eigene Werke; Audio nur CC0 und eigene Werke (ADR-0006).
- Atlas + Schriften ≤ 6 MB; Audio ≤ 8 MB, Musik wird erst nach der ersten Interaktion nachgeladen.
- Canvas-Renderer bleibt voll unterstützt (Effekte ohne WebGL-Filter).

## Entscheidungen

- **Rollen (Startwerte, Feinwerte per Bot-Tuning, Endwerte in „Referenzwerte v0.3.0“):**

  | Rolle | Kosten | Wirkung |
  |---|---|---|
  | RTE – Release Train Engineer | 140 | Alle 10 s „PI-Sync“: Teammitglieder in Reichweite 130 (+10 %/Stufe) feuern 4 s (+0,5 s/Stufe) um Faktor 1,3 schneller (Entwickler: Strahl-DPS ×1,3); laufende Tech-Debt-Störungen in Reichweite enden sofort |
  | RTA – Release Train Architect | 130 | „Architektur-Runway“: Gegner in Reichweite 110 (+10 %/Stufe) erleiden Schaden × (1,25 + 0,05 · (Stufe − 1)); Tech Debt zusätzlich ×2; mehrere RTA wirken nicht kumulativ (höchster Faktor zählt) |
  | RTO – Release Train Owner | 100 | Greift nicht an; bei jedem Wellenende „Business Value“: 15 + 10 · (Stufe − 1) SP je RTO |
  | Vorstand | 500 | Höchstens einer im Spiel; alle 20 s (−1 s je Stufe über 1) abwechselnd „Budget-Freeze“ (alle Gegner stehen 2 s, Boss 1 s) und „Projekt eingestampft“ (der Nicht-Boss-Gegner mit den meisten HP wird erledigt, Belohnung wie üblich; Gleichstand: zuerst gespawnt) |
- **Gegner:** Meeting-Einladung (HP 35, Tempo 70, Belohnung 7, legt alle 3 s Arbeitsplätze im Umkreis 60 px für 1,2 s lahm; ab Welle 4), Hotfix (HP 12, Tempo 150, Belohnung 3; ab Welle 3).
- **Spielversion 0.3.0**, Replay-Format 2 bleibt (neue Typnamen); Server-Bündel und Edge Functions werden neu deployt; die Bestenliste filtert ohnehin nach Version → Saison 2 startet leer. Anzeige „Saison 2“.
- **Neue Figuren:** aus vorhandenen Kenney-Figuren beim Asset-Build umgefärbt und mit eigenem Zubehör (SVG) ergänzt – RTE mit Schaffnermütze und Pfeife, RTA mit Brille und Bauplanrolle, RTO mit Blazer und Geldbündel, Vorstand mit grauem Haar, Anzug, Krawatte und Goldlaptop im Chefsessel.
- **Effektstufen:** Schalter „Effekte: Maximal / Normal / Ruhig“ (gespeichert); `?fx=high` → Maximal, `?fx=low` → Ruhig; `prefers-reduced-motion` startet mit Ruhig.
- **Audio:** CC0-Musik (Planung: Bossa-Warteschleife, Welle: Funk, Boss: Boss-Thema; Jingles für Sieg/Burnout), Soundeffekte aus CC0-Paketen, fehlende Büro-Geräusche prozedural (WebAudio) → [ADR-0006](../../.ai/knowledge/decisions/0006-audio-sources.md).
- **Teilen:** nach jedem Spielende Knopf „Teilen“: Text + Bildkarte 1200 × 630; Web Share API mit Datei, sonst Text in die Zwischenablage und Bild herunterladen.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | Die vier Rollen verhalten sich in der Simulation wie in der Rollentabelle (mit den Endwerten aus „Referenzwerte v0.3.0“): PI-Sync (Intervall, Dauer, Faktor, Störungsende), Runway-Faktor inkl. Tech Debt ×2 und Nicht-Kumulation, Business Value je Wellenende, Vorstand-Limit (zweiter wird mit Grund `limit` abgelehnt) und abwechselnde Fähigkeiten mit deterministischer Zielwahl. | Vitest `tests/sim/roles2.test.ts` (Literalwerte) |
| AC-2 | Meeting-Einladung und Hotfix haben die Werte aus den Entscheidungen bzw. Endwerten, erscheinen ab den genannten Wellen und die Meeting-Störung legt Arbeitsplätze im Umkreis für die genannte Dauer lahm. | Vitest `tests/sim/enemies2.test.ts` |
| AC-3 | `GAME_VERSION` = `0.3.0`; Replays mit 0.2.0 werden abgelehnt; Determinismus und Replay-Roundtrip gelten auch mit allen neuen Rollen/Gegnern; das Sim-Bündel ist aktuell und deployt; die Bestenliste zeigt „Saison 2“ und nur 0.3.0-Läufe. | Vitest (Determinismus, Replay, Bündel) + Integrationstests gegen Supabase + Live-Test |
| AC-4 | Balancing mit den Zielen aus Spec balancing-challenge (Referenz-Bot Median Welle 18–25 und ≤ 10 % Siege; starker Bot ≥ 50 % Siege; Einstieg ohne Moralverlust ≥ 90 %; Endlos endet ≤ 45; Nachrechnen ≤ 1,0 s in Node); beide Bots nutzen mindestens RTE, RTA und RTO, der starke Bot zusätzlich den Vorstand. Längster Lauf in der Edge-Runtime < 1 500 ms CPU. | `npm run balance`, Integrationstest `cpu.test.ts`, Ledger |
| AC-5 | Die vier neuen Rollen sind als unterscheidbare Figuren mit Zubehör an Arbeitsplätzen dargestellt, haben Ruhe-, Aktions- und Jubelpose und sichtbare Effekte: PI-Sync-Welle mit Leuchten der betroffenen Teammitglieder, Bauplan-Raster auf dem Laufband im Runway, aufsteigende Münzen beim Business Value, Budget-Freeze (Eis-Effekt + Banner) und „Projekt eingestampft“ (Schredder-Effekt). | Screenshot-Bogen + E2E (Debug-Effektzähler) |
| AC-6 | Meeting-Einladung (Kalender-Ticket) und Hotfix (Flammen-Ticket, kleiner und schneller animiert) sind als eigene Monster erkennbar; die Meeting-Störung zeigt „Termin!“-Sprechblasen über betroffenen Arbeitsplätzen. | Screenshot-Bogen + E2E |
| AC-7 | Spielgefühl (Effektstufe Maximal): Combo-Zähler ab 3 Erledigungen innerhalb 1,5 s („Combo xN“), Zeitlupe 0,6 s ab Combo 10; SP-Münzen fliegen bei Erledigungen zur Kapazitätsanzeige und diese hüpft; Schadenszahlen; Boss-Auftritt mit Kamerazoom und Namenskarte (≥ 1,2 s); Beförderung mit Lichtsäule beim Upgrade; Platzieren als „Drop-in“ mit Staubwolke. Zeitlupe und Zoom ändern keine Simulationsergebnisse. | E2E (Debug-Zähler, Replay-Hash vor/nach) + Screenshots |
| AC-8 | Büroleben: gelegentlich laufen Kolleginnen/Kollegen durchs Bild, die Kaffeemaschine dampft, der Drucker druckt beim Wellenende, Teammitglieder sagen Sprechblasen-Sprüche (höchstens eine gleichzeitig je 4 Arbeitsplätze), das Tageslicht wandert von Morgen (Welle 1) bis Abend (Welle 30), ab Welle 20 leuchten Schreibtischlampen. Die Helligkeit bleibt auch in Welle 30 ≥ 0,70. | E2E (Debug-Zähler, Helligkeitsmessung bei Welle 30) + Screenshots |
| AC-9 | Effektstufen: Schalter Maximal/Normal/Ruhig in der Oberfläche, Auswahl bleibt nach Neuladen erhalten; Normal ohne Zeitlupe und Kamerazoom; Ruhig zusätzlich ohne Wackeln, Hitstop, Combo-Effekte, Lauf-/Atemanimationen und mit halben Partikeln; URL-Parameter und `prefers-reduced-motion` wie in den Entscheidungen. | E2E |
| AC-10 | Audio: Musik je Phase (Planung/Welle/Boss) mit Überblendung, Jingles bei Sieg und Burnout, mindestens 12 unterschiedliche Soundeffekte an Ereignissen, getrennte Lautstärke für Musik und Effekte plus Stumm (gespeichert); Musik lädt erst nach der ersten Interaktion; Fehler beim Laden erzeugen keine Konsolenfehler; Audio gesamt ≤ 8 MB. | E2E (Debug-Audio-Status) + `du` |
| AC-11 | Teilen: nach jedem Spielende Knopf „Teilen“; der Text folgt dem Format `Backlog Defense 3000 · <Daily TT.MM. \| Freies Spiel> · Welle <n>/30 · Moral <m> % · Score <s>[ · Rang <r>] – https://opteamanta.netlify.app`; die Bildkarte ist ein PNG 1200 × 630 mit Teamname, Karte, Welle, Score (und Rang) und einem Bild des Spielfelds; mit Web Share API wird Text + Datei geteilt, sonst Text kopiert und Bild heruntergeladen. | Unit-Test (Textformat) + E2E (Bildmaße, Fallback) |
| AC-12 | Oberfläche: 9 Turmkarten (Tasten 1–9) sind bei 1366 × 768 zusammen mit Spielfeld, Steuerung und Bestenliste ohne Scrollen sichtbar; die Vorstandskarte zeigt „max. 1“ und ist gesperrt, solange einer im Spiel ist; keine Emojis im DOM. | E2E |
| AC-13 | Leistung: `?bench=1` (Effektstufe Maximal und Ruhig) höchstens 1,5× langsamer als die Werte nach Spec office-makeover (28,1 / 35,0 ms bzw. 26,7 / 31,7 ms) in derselben Sandbox. | Bench im Ledger |
| AC-14 | Lizenzen und Budget: alle neuen Grafik- und Audiodateien in `CREDITS.md` mit Quelle und CC0 bzw. eigenem Werk; `npm run check:assets` prüft auch Audio; Atlas + Schriften ≤ 6 MB, Audio ≤ 8 MB. | `npm run check:assets`, `du` |
| AC-15 | Vorschau-Gate: Vor dem Push zeigt ein Screenshot-Set (neue Rollen, neue Gegner, Combos/Boss-Auftritt, Abendlicht, Teilen-Karte) dem Nutzer den Stand; Push erst nach Freigabe. | Freigabe im Ledger |
| AC-16 | Regression: `npm test`, `npm run test:e2e`, `npm run test:integration` grün; Live-Test auf Netlify mit Daily, Einreichen und „Geprüft“ in Saison 2. | Befehle + Live-Test |

## Referenzwerte v0.3.0

Ermittelt per Bot-Tuning (`npm run balance`, 2026-11-11). Rollen- und Gegnerwerte wie in „Entscheidungen“ (unverändert);
geändert gegenüber v0.2.0: Boss-HP-Faktor **2,6** (statt 2,5) und die Wellenzusammensetzung (Hotfix ab Welle 3, Meeting ab Welle 4).

| Wert | v0.2.0 | v0.3.0 |
|---|---|---|
| Boss-HP | Grund-HP × Skalierung × 2,5 | **× 2,6** (Welle 1: 2340) |
| Wellenmix (ohne PIP) | cr 25, obj 12, feat 12, creep 13, debt 10, req Rest | zusätzlich **hotfix 8 %** (Welle 3: 18 %), **meeting 6 %** ab Welle 4; req Rest |
| Übrige Werte | – | unverändert (`hpGrowth` 1,115, `rewardFactor` 0,25, Wellenbonus 40 + 5·w, Start 300 SP) |

Messwerte (20 Läufe je Gruppe, Seeds 1–5 × 4 Karten):

| Gruppe | Median Welle | Min–Max | Siege | Einstieg ohne Moralverlust | Neue Rollen im Team |
|---|---|---|---|---|---|
| Referenz-Bot, Challenge | 21 | 7–26 | 0 % | 95 % | RTE/RTA/RTO je 95 % |
| Starker Bot, Challenge | 30 | 21–30 | 80 % | – | RTE/RTA/RTO 100 %, Vorstand 80 % |
| Starker Bot, Endlos | 31 | max. 35 | – | – | – |

Nachrechnen des längsten Challenge-Laufs (104 028 Ticks): 404 ms (Node).

## Risiken

- **Balancing:** Neun Rollen und Wirtschaftsrolle (RTO) können das Gleichgewicht stark verschieben; Bot-Heuristiken müssen
  die neuen Rollen sinnvoll nutzen, sonst sind die Messwerte wenig aussagekräftig.
- **Zeitlupe/Zoom** wirken nur auf die Darstellung bzw. das Echtzeit-Tempo; Replays zählen Ticks, daher keine Auswirkung auf
  Ergebnisse – per Test abgesichert.
- **Audio auf Safari:** nur MP3 verwenden; Autoplay erst nach Interaktion.
- **Umfang:** größte Spec bisher; Vorschau-Gate vor dem Push.
