# Ledger: Saison 2 (5)

**Spec:** [spec.md](../../../specs/season-2/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (Regel-Commit) | Typen (`rte/rta/rto/board`, `meeting/hotfix`, `syncTime`, `phase`, `frozenTime`, Grund `limit`, Ereignisse `synced/businessValue/freeze/axed`), Daten + Konstanten (`RTE_SYNC`, `RTA_RUNWAY`, `RTO_VALUE`, `BOARD_ABILITY`), `supportAction`, `runwayFactor` in `hurt`, RTO beim Wellenende, Freeze in der Gegnerschleife, `jamTime`, Wellenmix, `stateHash`, Version 0.3.0; Sim-Bündel neu gebaut. Ruling: Unterstützungsrollen handeln nur während laufender Wellen (keine Effekte in der Planungsphase). |
| T02 | done | (Regel-Commit) | general: `roles2` (41), `enemies2` (12), `season2` (6) + Anpassung `data`, `waves`, `logic`; 242/242 grün, keine Abweichungen. Ruling: Vorstands-Phase wechselt auch, wenn kein Nicht-Boss zum Einstampfen da ist (per Test festgeschrieben). |
| T03 | done | (Regel-Commit) | Bots: starker Bot mit RTA (Abdeckung), RTE (meiste Teammitglieder in Reichweite), RTO/Vorstand (ruhige Felder), Vorstand ab Welle 6; Referenz-Bot-Rotation + RTO/RTA/RTE; `npm run balance` misst Rollennutzung. Tuning: Läufe enden fast immer in Boss-Wellen (16/21/26) → Boss-Faktor 2,6 trifft Median 21. Alle Ziele ✓ (Referenzwerte v0.3.0 in der Spec). |
| T04 | done | – | In T13 ausgeführt: `build:sim` aktuell, Edge Functions (start-run, submit-run, verify-runs) mit 0.3.0 deployt, Integrationstests 38/38, CPU längster Lauf 314 ms (< 1 500). |
| T05 | done | `d55670a` (+ Budget-Fix) | `tools/characters.ts`: Umfärben über Farbtonbereiche, Kopfposition je Pose per Alpha-Template-Matching, Zubehör an Kopf/Augen/Kinn (Gesichtszubehör nicht in der Rückenpose `hurt`); Rollen RTE (Schaffnermütze, Petrol), RTA (Brille, Indigo), RTO (Fliege, Rot), Vorstand (Sonnenbrille, Krawatte, graue Weste) mit Porträts; 4 Statisten mit 8 Laufposen; Monster Meeting/Hotfix; Requisiten Münze, Eis, Schredder, Lampe, Sprechblase, Bauplan, Glow (Rollenfarben). Atlas 650 Frames, 3,06 MB. Ruling: `check:assets`-Grenze 3 → 6 MB laut Spec 4/5 (Atlas + Schriften). |
| T06 | in_progress | `d55670a` | general: 27 CC0-Audiodateien (3 Loops, 4 Jingles, 20 SFX), Lizenzbelege `assets-src/audio/SOURCES.md`, `check:assets` prüft Audio (6,32 MB ≤ 8 MB). Offen: Audio-Engine. Hinweis: Jingles ohne Abhören ausgewählt → Nutzer prüft in der Vorschau. |
| T07 | done | `24fffcd` | `season2fx.ts`: Bauplan-Raster auf Laufband-Feldern im Runway (pulsierend, gedimmt bei Störung), PI-Sync-Welle + Leuchten unter geboosteten Arbeitsplätzen, Münzen beim Business Value, Eis-Overlay + angehaltene Animation bei Freeze, Schredder bei „Projekt eingestampft“, „Termin!“-Blasen bei Meeting-Störung; RTA zeigt alle ~1,6 s auf den Bauplan, solange Gegner im Runway sind. |
| T08 | done | `2bc96f5` | `juice.ts`: Combo-Zähler mit Titeln, Zeitlupe ab Combo 10 und beim Boss (nur Maximal, `Controller.timeScale` – nur Echtzeit-Tempo), SP-Münzen zur Kapazitätsanzeige (Chip hüpft), gebündelte Schadenszahlen, Boss-Auftritt mit Zoom/Pan + Namenskarte, Beförderungs-Lichtsäule; Drop-in beim Platzieren. Effektstufen `max/normal/calm` (live umschaltbar, gespeichert, URL `fx=high/low` kompatibel, reduced motion → Ruhig). |
| T09 | done | `2bc96f5` | `life.ts`: Statisten (4 umgefärbte Figuren, Laufanimation, max. 2), Kaffeedampf, Drucker-Papier beim Wellenende, Sprechblasen-Sprüche (≤ 1 je 4 Arbeitsplätze), Tageslicht (Morgen hell, Abend warm per Multiply), Schreibtischlampen ab Welle 20. Helligkeit Welle 25: 0,844. |
| T10 | done | (T10-Commit) | 9 Turmkarten (3 Spalten, Tasten 1–9, Vorstand „max. 1“ + Sperre), Einstellungen (Effektstufe, Musik-/Effekt-Lautstärke), „Saison 2“, Teilen (`share.ts`: Text + Karte 1200 × 630 mit Phaser-Snapshot, Web Share API oder Kopieren + Download). Layout 1366 × 768: Bestenliste endet bei 748 px; Liste passt ihre Höhe der Fensterhöhe an. |
| T11 | done | `4606119`, `5d5ce30` | general: `season2.spec.ts` (AC-5–AC-12) + `share.test.ts`; Popup-Test ergänzt; volle Suite 58/58 grün (8,7 min), Unit 246/246. |
| T12 | done | – | Vorschau `.tmp/evidence/season2/preview/` (01 Figuren/Monster, 02 Rollen im Einsatz, 03 Boss/Combos, 04 Abendlicht, 05 Teilen-Karte, 06 Popup, 07 Layout online) + Audio zum Abhören → Nutzer-Freigabe 2026-11-11 (AC-15). |
| T13 | done | `02317ce` | Bench (AC-13, 1366 × 768, Canvas, 299 Arbeitsplätze): Maximal 25,0 / 30,0 ms (×0,89 ggü. 28,1 / 35,0), Ruhig 22,3 / 25,0 ms (×0,84 ggü. 26,7 / 31,7) – erfüllt. Fund: Bench-Szenario blieb am Vorstand-Limit hängen (nur 17 Türme) → behoben. Hinweis: 4 der 9 Rollen schießen nicht, Szenario daher etwas leichter. Abschluss: Build, `check:assets` (Grafik 3,1 MB, Audio 6,3 MB), Lockfile-/Bündel-Test, Secret-/Hostname-Grep über alle Branch-Commits ohne Treffer; Functions deployt, Integration 38/38; Fast-Forward nach `main`, Push; Netlify live mit 0.3.0; Live-Test (Daily automatisch, Einreichen, „Geprüft · Tagesrang 1“, Nochmal = neue Daily, freies Spiel, Umbenennen, 0 Konsolenfehler, Testnutzer gelöscht). |

## Rulings

- **R-1** Pakete A (Optik, Sound, Teilen) und B (neue Rollen/Gegner) zusammen als Saison 2 (Nutzerentscheidung); RTO = Release Train Owner (Nutzer), Rollen RTE, RTA, RTO, Vorstand; Gegner Meeting-Einladung, Hotfix; Effekte „Maximal + Schalter“; Musik Warteschleife + Funk + Boss; Teilen Text + Bildkarte.
- **R-2** Audio-Mischlösung (ADR-0006) nach Recherche: CC0-Musik/-SFX, fehlende Büro-Geräusche prozedural.

- **R-3** (Nutzer) Kein „Saison 2“-Label: Version 0.3.0 startet die Bestenliste ohnehin leer; Label entfernt.
- **R-4** (Nutzer) Einstellungen als Popup mit Zahnrad in der Kopfleiste (Effektstufe, Musik/Effekte, Stumm, Tempo, Modus, Teamname); Tastatur ist bei offenem Dialog gesperrt.
- **R-5** Layout 1366 × 768 online: zehn Bestenlisten-Zeilen passen rechnerisch nicht neben das 618 px hohe Spielfeld. Seitenleiste ist so hoch wie das Spielfeld, die Liste scrollt in sich (≥ 3 Zeilen sichtbar); AC-12 entsprechend präzisiert, E2E-Test angepasst. Dazu: Unterzeile des Logos bricht um (Kopfleiste einzeilig), Kartennamen einzeilig („Analyst“), Tempo/Ton neben dem Start-Knopf, Zeitraum-Tabs in der Titelzeile der Bestenliste.
- **R-6** Fund beim Layout: Infobox zeigte für Unterstützungsrollen „Reichweite 0 · Schaden NaN“ → zeigt jetzt ihre Wirkung je Stufe.

## Open questions

- keine

## Log

- 2026-11-11: Spec 5 + ADR-0006 + Plan entworfen.
