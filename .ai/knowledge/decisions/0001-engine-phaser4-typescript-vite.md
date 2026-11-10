# ADR-0001: Engine Phaser 4 mit TypeScript und Vite

**Status:** proposed
**Date:** 2026-11-10
**Authors:** Projektteam Backlog Defense
**References:** [Spec foundation-phaser-port](../../../specs/foundation-phaser-port/spec.md)

## Context

Das Spiel ist eine einzelne HTML-Datei mit handgeschriebenem Canvas-2D-Rendering (343 Zeilen).
Ziel ist eine deutlich hochwertigere Optik (Partikel, Licht, Filter, Animationen) und eine
wartbare Codebasis, die als statische Web-Seite ausgeliefert wird und später eine Bestenliste
(Supabase) anbindet. Das Spiel ist 2D und rasterbasiert.

## Decision

Wir bauen das Spiel mit **Phaser 4.2.1** (WebGL-Renderer), **TypeScript 6.0.3** und **Vite 8**.
Tests mit **Vitest 5**, Linting mit **ESLint 10 + typescript-eslint 8**.
TypeScript 7 (native) wird erst eingesetzt, wenn typescript-eslint es unterstützt (aktuell Peer `<6.1`).

## Alternatives

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Phaser 4 | Szenen, Partikel, Tweens, Kamera, Audio, Input und Filter (Glow, Bloom, Light) eingebaut; kleiner Web-Build; JS/TS wie heute | Seit April 2026 stabil, Community-Beispiele oft noch Phaser 3 | – (gewählt) |
| PixiJS v8 | Sehr schneller Renderer, flexibel | Nur Renderer: Szenen, Audio, Input, Tweens selbst bauen | Mehr Eigenbau ohne Mehrwert |
| Godot 4 Web-Export | Starker Editor, gute 2D-Tools | WASM-Bundle 30 MB+, lange Ladezeit, Neuschrieb in GDScript, Simulation nicht in einer Edge Function wiederverwendbar | Zu schwer für ein Browser-Casual-Spiel; blockiert Replay-Prüfung |
| Three.js / 3D | Spektakuläre Optik möglich | Asset-Aufwand vervielfacht sich, Spiel ist 2D-Raster | Unverhältnismäßig |
| Canvas 2D weiter von Hand | Kein Lernaufwand | Kein WebGL, keine Filter, wenig Struktur | Erreicht die Zielqualität nicht |

## Consequences

**Positive**

- Rendering-Features für Spec 2 (Filter, Partikel, Licht) ohne Eigenbau.
- Gleiche Sprache (TypeScript) im Client und in Supabase Edge Functions (Deno).

**Negative**

- Abhängigkeit von einer jungen Major-Version; Upgrades auf 4.x müssen getestet werden.
- TypeScript bleibt vorerst auf 6.0.x.

## Verification

`npm run build` erzeugt ein lauffähiges statisches Bundle; der Playwright-Smoke-Test läuft grün.
