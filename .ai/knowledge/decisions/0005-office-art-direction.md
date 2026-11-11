# ADR-0005: Grafikrichtung „Cartoon-Büro“

**Status:** proposed
**Date:** 2026-11-11
**Authors:** Projektteam Backlog Defense
**References:** [Spec office-makeover](../../../specs/office-makeover/spec.md), ADR-0003 (Asset-Pipeline bleibt), ADR-0002

## Context

Der Whiteboard-Look aus Spec 2a (Köpfe in Magnet-Kreisen, Post-its, Marker-Pfad) unterscheidet sich zu wenig vom
Original und wirkt durch die Vignette dunkel. Der Nutzer wünscht einen hochwertigen, lebendigen 2D-Look mit Sprites,
Animationen und Partikeln – ausschließlich kostenlos. Recherche (2026-11-11): Es gibt kein freies, hochwertiges
Büro-Komplettpaket; Kenney hat kein Büro-Set, freie Büro-Pakete auf itch.io sind meist 16-px-Pixelart oder ohne
klare Lizenz. Kenneys CC0-Pakete sind über dessen eigene OpenGameArt-Uploads aus der Sandbox erreichbar
(kenney.nl liefert 403).

## Decision

Helles **Cartoon-Büro in Draufsicht mit stehenden Figuren**, ausschließlich aus Kenney-CC0-Paketen plus eigenen SVGs:

| Bereich | Quelle |
|---|---|
| Türme (5 Rollen) | *Toon Characters 1* – Ganzkörper-Posen (6 Figuren × 45 Posen) |
| Gegner (8 Typen) | *Monster Builder Pack* – beim Asset-Build zusammengesetzt, je Typ Farbe/Form/Gesicht + Ticket-Symbol |
| Boden, Möbel, Deko | *Topdown Shooter* (Parkett, Fliesen, Teppiche, Sofas, Tische, Pflanzen, Küche) + eigene SVGs (Kanban-Laufband, Arbeitsplatz-Ergänzungen) |
| Geschosse, Requisiten | *Generic Items* (Kaffeebecher, Dokumente u. a.) |
| Effekte | *Particle Pack*, *Smoke Particles*, *Splat Pack* (Bodendecals), *Emotes Pack* (Sprechblasen) |
| UI | *UI Pack* (Formen/Icons) + eigene SVG-Icons; Schriften Caveat + Nunito (OFL) |

Die Pipeline aus ADR-0003 bleibt (Rohdateien in `assets-src/`, Atlas per `npm run assets`, `CREDITS.md`-Pflicht).
Keine abdunkelnden Kamerafilter im laufenden Spiel.

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Cartoon-Büro aus Kenney-CC0 + eigene SVGs | Einheitlicher Kenney-Stil, hohe Auflösung, viele Posen, Lizenz klar | Perspektivmix (frontale Figuren auf Draufsicht-Boden), keine fertigen Animationen | – (gewählt) |
| Pixelart-Büro (Kenney Roguelike + 2dPig Pixel Office) | Sehr stimmig, Retro-Charme | 16-px-Raster passt nicht sauber auf 40-px-Zellen, wenig Büro-Vokabular | Nutzerwahl |
| Whiteboard aufwerten | Wenig Aufwand | Bleibt zu nah am Original | Nutzer will deutlichen Unterschied |
| Kaufpakete (LimeZu Modern Office/Interiors) | Bestes Büro-Vokabular | Kosten, Lizenz mit Weitergabeverbot | Nutzer: nur kostenlos |

## Consequences

**Positive**

- Deutlich eigenständiger Look; alle Assets CC0, Herkunft nachvollziehbar.
- Viele Posen erlauben Animationen ohne Zeichenaufwand.

**Negative**

- Animationen entstehen aus Posenwechsel und Tweens, nicht aus Frame-für-Frame-Zeichnungen.
- Mehr Sprites pro Turm/Gegner – Leistung muss gemessen werden (Spec AC-8).

## Verification

Prototyp-Gate (Spec AC-12), Screenshot-Bögen (AC-4/AC-5), `npm run check:assets` (AC-9), Bench-Vergleich (AC-8).
