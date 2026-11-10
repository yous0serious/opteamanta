# Spec: Grafik-Overhaul „Living Whiteboard 2.0“ (Teil 2a)

**Status:** Approved
**Size:** L
**Ticket:** –
**Plan:** `.ai/specs/visual-overhaul/plan.md` (nach Freigabe der Spec) · **Ledger:** `.ai/specs/visual-overhaul/ledger.md`
**Baut auf:** [foundation-phaser-port](../foundation-phaser-port/spec.md) (Commit `6bd19c8`)

## Ziel

Das Spiel sieht heute aus wie ein Prototyp: Emojis (je nach Betriebssystem anders oder als Kästchen),
Systemschriften und einfache Formen. Teil 2a macht daraus ein zeitgemäßes, geschlossenes Erscheinungsbild im
Stil „Living Whiteboard“: echte Figuren als Magnet-Pins, Post-its mit Papier-Physik, eingebettete Handschrift,
GPU-Partikel, Phaser-4-Filter (Glow, Schatten, Vignette, Entsättigung) und „Juice“ (Hitstop, Squash & Stretch,
animierte Banner). Spiellogik und Balancing bleiben unberührt – die Grafik ersetzt ausschließlich `src/view/`.

## Nicht-Ziele

- Sound-Assets, Musik, Menü-Szene, Einstellungsdialog (→ Spec 2b `audio-menu`). 2a behält den prozeduralen Sound.
- Licht mit Normal Maps (Phaser `Lighting`): Für die CC0-Figuren gibt es keine Normal Maps; Nutzen/Aufwand zu gering.
- Änderungen an `src/sim/`, Balancing, neue Türme/Gegner/Karten (→ Spec 4).
- Mobile/Touch-Optimierung (→ Spec 5).

## Randbedingungen

- `src/sim/` bleibt unverändert; Bench-Lauf Seed 12345 behält Hash `088db987`, Score 287 780.
- Nur Assets mit CC0-Lizenz, Schriften mit OFL-1.1 oder eigene Werke des Projekts. Jede Datei unter
  `public/assets/` steht mit Quelle, Autor und Lizenz in `public/assets/CREDITS.md`.
- Keine externen Requests zur Laufzeit (wie Spec 1 AC-1); alle Assets werden mitgeliefert.
- Grafik-Assets (ohne Audio) zusammen ≤ 3 MB.
- Bezugsquellen nur offiziell bzw. vom Autor selbst hochgeladen (kenney.nl nach Freigabe, sonst OpenGameArt-Seite von Kenney);
  keine Drittanbieter-Spiegel.
- Die DOM-IDs und Tastenbelegung aus Spec 1 bleiben (der Playwright-Smoke-Test muss weiter grün sein).
- `prefers-reduced-motion: reduce` schaltet Wackeln, Hitstop und Bannerbewegung ab.

## Entscheidungen

- Figuren: Kenney „Toon Characters 1“ (CC0, 6 Figuren × 45 Posen, Kopf-Varianten normal/Fokus/Schock) → [ADR-0003](../../.ai/knowledge/decisions/0003-asset-sources-and-pipeline.md)
- Whiteboard-Requisiten (Post-it, Klebeband, Magnet, Papierkugel, Marker-Symbole): eigene SVGs im Repo, da es dafür kein CC0-Pack gibt → ADR-0003
- Schrift: `@fontsource/caveat` (OFL-1.1), selbst gehostet über das npm-Paket → ADR-0003
- Atlas: Build-Skript packt alle Sprites mit `free-tex-packer-core` in einen Phaser-Multiatlas → ADR-0003
- Effektstufe per URL `?fx=high|low` (Standard `high`); `low` schaltet alle Filter ab und halbiert Partikel. Die Einstellungs-UI kommt in 2b.

### Rollen → Figuren (Vorschlag)

| Turm | Figur (Toon Characters 1) | Begründung |
|---|---|---|
| Dualo | Male adventurer | jung, Rucksack-Look, „Student“ |
| Business Analyst | Female adventurer | neugierig, „fragt nach“ |
| Entwickler | Female person | Original-Emoji war 👩‍💻 |
| PPL | Male person | Schnurrbart + Weste, „Lead“ |
| Scrum Master | Robot | „folgt dem Prozess“ – passt zum Humor (SAFe-Bot) |

Zombie bleibt Reserve (z. B. Tech-Debt-Easter-Egg in Spec 4).

## Design

**Ebenen (von unten nach oben):** Whiteboard-Textur → Raster/Spalten → Klebeband-Pfad → DONE-Haufen → Auren/Vorschau →
Türme (Schatten-Filter auf Ebene) → Gegner (Schatten-Filter auf Ebene) → Projektile/Strahlen (Glow) → Partikel → Texte →
Overlays (Vignette und Entsättigung als Kamera-Filter).
Filter werden pro **Ebene** gesetzt, nicht pro Objekt, damit die Draw-Calls bei 299 Türmen konstant bleiben.

**Asset-Pipeline:** `assets-src/` (Rohdateien, eingecheckt, nur genutzte PNGs/SVGs) → `npm run assets` (`tools/build-atlas.ts`:
SVG rendern, PNGs zuschneiden, Atlas packen) → `public/assets/atlas*.png|json`. `npm run check:assets` prüft CREDITS-Vollständigkeit.

**Darstellungsregeln:** Turm = Magnet-Badge (Rollenfarbe als Ring, Glanzlicht) mit Kopf der Figur; Feuern = kurzer Squash + Fokus-Gesicht;
außer Betrieb = Schock-Gesicht, entsättigt, Z-Partikel. Gegner = Post-it-Sprite, mit Typfarbe eingefärbt, Marker-Symbol je Typ.
Kill = Zerknüllen (Tween auf Papierkugel-Frame) und Bogenflug in die DONE-Spalte (Haufen, max. 60 Kugeln).

**Risiken:** Filter auf großen Ebenen kosten Füllrate (Gegenmittel: `fx=low`, Messung AC-12); Figurenstil wirkt neben handgezeichneten
Requisiten evtl. uneinheitlich (Gegenmittel: dicke Kontur und Marker-Optik auch für die Badges); `free-tex-packer-core` ist alt (0.3.9) →
Fallback: Phaser-Loader mit Einzelbildern.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | `src/sim/` ist gegenüber `6bd19c8` unverändert; `npm test` grün; `npm run bench` liefert Hash `088db987` und Score 287 780. | `git diff 6bd19c8 -- src/sim` leer, Befehlsausgaben |
| AC-2 | Jede Datei unter `public/assets/` ist in `CREDITS.md` mit Quelle, Autor und Lizenz (CC0, OFL-1.1 oder „eigenes Werk“) aufgeführt; `npm run check:assets` schlägt bei einer fehlenden Datei fehl. | `check:assets` + Gegenprobe |
| AC-3 | Auf dem Spielfeld werden keine Emojis und keine Systemschriften gerendert: Türme, Gegner, Projektile sind Sprites; alle Canvas-Texte nutzen die eingebettete Handschrift. | Screenshot im Sandbox-Chromium ohne Emoji-Fonts zeigt keine Ersatzkästchen; Test: `src/view/` liest kein `.emoji` |
| AC-4 | Türme: Magnet-Badge mit Rollenfigur laut Tabelle, Idle-Animation, Feuer-Animation, Upgrade-Animation mit Stufenanzeige, Außer-Betrieb-Zustand. | Screenshots + Checkliste |
| AC-5 | Gegner: Post-it pro Typ (Farbe + Marker-Symbol), Wackeln, Treffer-Aufblitzen, Verlangsamt-Markierung, Lebensbalken, Boss mit pulsierendem Glow und Namensschild. | Screenshots + Checkliste |
| AC-6 | Besiegte Gegner werden zerknüllt und fliegen in die DONE-Spalte; der Haufen enthält höchstens 60 Kugeln. | Screenshot + Unit-Test der Haufen-Logik |
| AC-7 | Jeder Turmtyp hat ein eigenes Projektil bzw. einen eigenen Strahl; Partikel laufen über Phaser-Partikel-Emitter. | Screenshots + Code-Review |
| AC-8 | Bei `fx=high` sind aktiv: Glow (Entwickler-Strahl, Boss), Schatten (Ebenen Türme/Gegner), Kamera-Vignette, Entsättigung bei Game Over; bei `fx=low` ist kein Filter aktiv. | E2E-Prüfung der Filterlisten über `window.__bd` + Screenshots |
| AC-9 | Juice: 60 ms Hitstop bei Boss-Kill, Squash & Stretch beim Feuern, animiertes Wellen-Banner; mit `prefers-reduced-motion: reduce` kein Wackeln, kein Hitstop, statisches Banner. | E2E mit `reducedMotion: 'reduce'` + manuell |
| AC-10 | Whiteboard mit Textur, Klebeband-Textur, Marker-Strich, der zu Wellenbeginn den Pfad nachzeichnet. | Screenshots |
| AC-11 | Ladebildschirm mit Fortschrittsbalken; zur Laufzeit gehen keine Requests an fremde Hosts. | E2E (Request-Liste) |
| AC-12 | `?bench=1` erzeugt ein Szenario mit 299 Türmen und 150 Gegnern und protokolliert mittlere und p95-Frame-Zeit; auf dem Host mit GPU liegt der Mittelwert bei `fx=high` ≤ 16,7 ms. | Messwerte im Ledger (Host manuell, Sandbox protokolliert) |
| AC-13 | Spec-1-Smoke-Test (`npm run test:e2e`) bleibt grün; Screenshots vorher/nachher liegen in `.tmp/evidence/visual/`. | E2E-Log + Screenshots |
