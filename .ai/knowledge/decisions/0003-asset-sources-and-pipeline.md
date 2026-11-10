# ADR-0003: Asset-Quellen und Asset-Pipeline

**Status:** proposed
**Date:** 2026-11-10
**Authors:** Projektteam Backlog Defense
**References:** [Spec visual-overhaul](../../../specs/visual-overhaul/spec.md), ADR-0001

## Context

Spec 2a ersetzt Emojis und Formen durch Sprites. Vorgabe: CC0-Assets (Figuren aus CC0-Packs). Die Sandbox
erreicht kenney.nl nicht (HTTP 403), wohl aber OpenGameArt. Für Whiteboard-Requisiten (Post-it, Klebeband,
Magnet, Papierkugel) gibt es kein passendes CC0-Pack. Emojis und Systemschriften rendern je nach System
unterschiedlich oder gar nicht.

## Decision

1. **Figuren:** Kenney „Toon Characters 1“ (CC0, `License.txt` im Paket geprüft), bezogen über Kenneys
   OpenGameArt-Seite oder kenney.nl. Keine Drittanbieter-Spiegel.
2. **Requisiten und Typ-Symbole:** eigene SVGs im Repo (`assets-src/props/`), Lizenz „eigenes Werk“.
3. **Schrift:** `@fontsource/caveat` (OFL-1.1) über npm, gebündelt von Vite.
4. **Pipeline:** Rohdateien in `assets-src/`, Build-Skript `npm run assets` erzeugt einen Phaser-Multiatlas in
   `public/assets/`; `npm run check:assets` erzwingt `CREDITS.md`.

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| CC0-Packs + eigene Requisiten-SVGs | Lizenzsicher, schnell, Requisiten exakt passend | Stilmischung möglich | – (gewählt) |
| Nur eigene Grafiken | Einheitlicher Stil | Hoher Aufwand für Figuren | Nutzer wünscht CC0-Figuren |
| Grafiker | Bestes Ergebnis | Kosten, Zeit | Später möglich, Pipeline bleibt gleich |
| KI-generierte Grafik | Schnell | Lizenz-/Stilunsicherheit | Nicht CC0-gesichert |
| Drittanbieter-Spiegel (gamesounds.xyz u. ä.) | Erreichbar | Herkunft nicht verifizierbar (Supply Chain) | Ausgeschlossen |

## Consequences

**Positive**

- Einheitliche Darstellung auf allen Systemen; Lizenzen nachvollziehbar.
- Assets austauschbar, ohne Code zu ändern (Frame-Namen bleiben).

**Negative**

- Rohdateien vergrößern das Repo (nur genutzte Dateien einchecken).
- `free-tex-packer-core` ist alt (0.3.9); Fallback sind Einzelbilder.

## Verification

`npm run check:assets` in der Pipeline; Spec 2a AC-2 und AC-3.
