# ADR-0006: Audio-Quellen

**Status:** proposed
**Date:** 2026-11-11
**Authors:** Projektteam Backlog Defense
**References:** [Spec season-2](../../../specs/season-2/spec.md), ADR-0003, ADR-0005

## Context

Bisher erzeugt `src/view/audio.ts` alle Klänge prozedural (einfache Piepser). Saison 2 soll Musik je Spielphase
(Warteschleife, Funk, Boss), Jingles und echte Soundeffekte bekommen – ausschließlich kostenlos und lizenzsicher (CC0 oder
eigenes Werk, keine CC-BY-Pflichten). Recherche (2026-11-11): Kenney bietet mehrere CC0-Soundpakete (über OpenGameArt),
OpenGameArt hat CC0-Musik passender Stile; für Telefon, Drucker, Kaffeetasse und Cartoon-Quieken fand sich kein
verifiziertes CC0-Material. Rein prozedurale Musik klingt für Bossa brauchbar, für Funk und Boss dünn.

## Decision

Mischlösung:

1. **Musik:** CC0-Stücke von OpenGameArt (je Phase ein Loop), Jingles aus Kenneys „85 Short music jingles“ (CC0);
   Lizenz je Seite beim Import geprüft und in `CREDITS.md` vermerkt.
2. **Soundeffekte:** CC0-Pakete (Kenney u. a.); fehlende Büro-Geräusche prozedural per WebAudio (eigenes Werk).
3. **Format:** MP3 (alle Browser inkl. Safari), Musik ≤ 128 kbit/s; Musik wird erst nach der ersten Interaktion geladen.
4. **Keine Bibliothek** für die Wiedergabe: Phaser-Sound bzw. WebAudio direkt.

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| CC0-Musik/-SFX + prozedurale Lücken | Klangqualität, Lizenz klar | Größere Downloads, Loop-Nähte prüfen | – (gewählt) |
| Alles prozedural (Tone.js o. ä.) | Winzige Dateien, eigenes Werk | Funk/Boss klingen dünn | Qualität |
| CC-BY-Musik (große Auswahl) | Bessere Auswahl | Namensnennungspflicht, Policy | Policy (nur CC0) |
| Pixabay/Uppbeat | Große Auswahl | Eigene Lizenzen, Weitergabe unklar | Policy |

## Consequences

**Positive**

- Echte Musik und Geräusche passend zum Büro-Thema, lizenzsicher.

**Negative**

- Bis zu ~8 MB zusätzlicher Download (nachgeladen); Loop-Übergänge müssen geprüft werden.

## Verification

Spec season-2 AC-10 und AC-14 (`check:assets` prüft Audio-Einträge, Budget ≤ 8 MB).
