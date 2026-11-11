# Plan: Saison 2 (5)

**Spec:** [spec.md](../../../specs/season-2/spec.md) · **Ledger:** [ledger.md](ledger.md) · **ADR:** [0006](../../knowledge/decisions/0006-audio-sources.md)
**Branch:** `feature/season-2` · **Size:** L (13 Tasks in 5 Phasen)

## Phasen und Gates

| Phase | Tasks | Exit-Gate |
|---|---|---|
| 1 Regeln | T01, T02 ∥, T03 | Sim-Tests grün, `npm run balance` erfüllt AC-4, Referenzwerte v0.3.0 in der Spec |
| 2 Server | T04 | Bündel deployt (noch nicht live geschaltet: Client bleibt bis zum Push auf 0.2.0), Integrationstests grün, CPU < 1 500 ms |
| 3 Assets + Audio | T05 ∥ T06 | Atlas mit neuen Figuren/Monstern/Requisiten; Audio importiert, Lizenzen geprüft, Budget eingehalten |
| 4 Darstellung | T07, T08, T09, T10; T11 (background) | Alle Effekte, Büroleben, Effektstufen, Teilen, 9 Turmkarten; E2E grün |
| 5 Nachweis | T12 (Vorschau-Gate), T13 | Nutzer-Freigabe; alle ACs mit Nachweis; Push, Live-Test |

## Task-Liste

| ID | Task | Depends on | Who | Parallel with | ACs |
|---|---|---|---|---|---|
| T01 | Sim: Rollen RTE/RTA/RTO/Vorstand, Gegner Meeting/Hotfix, Wellen, `limit`, Version 0.3.0 | – | hannibal | T02 | AC-1–AC-3 |
| T02 | Sim-AC-Tests (Literalwerte) | T01-Schnittstellen | general (background) | T01 | AC-1–AC-3 |
| T03 | Bots um neue Rollen erweitern, Balancing-Tuning, Referenzwerte v0.3.0 | T01 | hannibal | – | AC-4 |
| T04 | `build:sim`, Function-Deploy, Integrationstests, CPU-Messung, Saison-Anzeige vorbereiten | T03 | hannibal | T05/T06 | AC-3, AC-4 |
| T05 | Assets: Figuren-Baukasten (Umfärben + Zubehör), Monster Meeting/Hotfix, Requisiten (Schredder, Lampe, Münze, Eis, Bauplan, Uhr), NPC-Laufposen | – | hannibal | T06 | AC-5, AC-6, AC-14 |
| T06 | Audio: CC0-Import mit Lizenzprüfung, MP3-Transcode, prozedurale Büro-Geräusche, Audio-Engine (Phasen, Überblendung, Lautstärken) | – | hannibal | T05 | AC-10, AC-14 |
| T07 | Darstellung neue Rollen/Gegner + ihre Effekte | T01, T05 | hannibal | – | AC-5, AC-6 |
| T08 | Spielgefühl (Combos, Münzen, Schadenszahlen, Boss-Auftritt, Beförderung, Drop-in) + Effektstufen-Schalter | T07 | hannibal | T09 | AC-7, AC-9 |
| T09 | Büroleben + Tageslicht + Lampen | T07 | hannibal | T08 | AC-8 |
| T10 | Oberfläche: 9 Turmkarten, Vorstand-Limit, Saison-Label, Audio-Regler, Teilen (Text + Bildkarte) | T06, T08 | hannibal | – | AC-10–AC-12 |
| T11 | E2E-AC-Tests (Darstellung, Audio-Status, Teilen, Layout) | T10 | general (background) | T12 | AC-5–AC-12 |
| T12 | Vorschau-Screenshots → Nutzer-Gate | T10 | hannibal | T11 | AC-15 |
| T13 | Gesamtverifikation, Bench, Secret-Grep, Lizenzen, Push, Live-Test Saison 2 | T11, T12 | hannibal | – | AC-13, AC-14, AC-16 |

## Arbeitsregeln

- Server-Deploy der Edge Functions erst unmittelbar vor dem Push (T13), sonst prüft der Server 0.2.0-Läufe der Live-Version mit dem 0.3.0-Bündel und lehnt sie ab. T04 deployt nur, wenn die Functions beide Versionen unterstützen – sonst Deploy in T13.
- Lockfile nur mit `registry.npmjs.org`; Commits als `yous0serious`.
