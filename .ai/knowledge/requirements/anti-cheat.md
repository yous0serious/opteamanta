# Anti-Cheat-Analyse für die Bestenliste (Vorarbeit Spec 3)

**Stand:** 2026-11-10 · **Quelle:** Recherche-Agent (Code-Review `src/sim/`, Supabase-Doku) · **Status:** Vorschlag, noch nicht entschieden

## Bedrohungen und Gegenmaßnahmen

| Bedrohung | Schwere | Gegenmaßnahme | Aufwand |
|---|---|---|---|
| Gefälschter Score (nur `result` geändert) | niedrig | Server re-simuliert und übernimmt nur den selbst berechneten Score | gering |
| Bot-/TAS-Replay (optimierte Eingaben) | hoch, technisch nicht verhinderbar | Fester Modus (z. B. 30 Wellen) + Daily Seed; offen kommunizieren; optional Top-10 manuell prüfen | mittel |
| Seed-Shopping (Seed/Karte frei wählbar) | hoch | `start-run` vergibt Seed + Karte serverseitig; `submit-run` akzeptiert nur Seed der Session | gering |
| Fremdes Replay einreichen | mittel | Replay an `user_id` + Session binden; Replays erst nach Verifikation öffentlich | gering |
| Duplikate / Mehrfacheinreichung | niedrig | `sha256(kanonisches Replay)` unique; Session single-use; Bestwert pro User/Modus/Zeitraum | gering |
| Manipulierter Client-Code | niedrig | Irrelevant, Server re-simuliert | – |
| Zeit-Betrug (Replay offline in Sekunden gebaut) | mittel | Serverzeit seit `start-run` ≥ `endTick/60/maxSpeed` (mit Toleranz); Session-Ablauf (z. B. 3 h). Hilft nicht gegen Echtzeit-Bots | gering |
| DoS durch teure Replays | hoch | Modus-Cap (30 Wellen ≈ 75 000 Ticks) statt Parser-Grenze 432 000; Tick-Budget im Verifier; Limits für offene Sessions/Einreichungen | mittel |
| Massenhaft anonyme Accounts | mittel | Cloudflare Turnstile/hCaptcha beim `signInAnonymously`; Supabase-Standard 30 anonyme Sign-ins/h/IP; alte anonyme User per SQL aufräumen | gering |
| Anstößige Nicknames | niedrig–mittel | DB-Constraint (Länge, Zeichen), Blockliste, `unique(lower(nick))`, Meldefunktion | gering |
| Direkter REST-Zugriff mit Publishable Key | hoch, falls RLS falsch | RLS überall an; kein INSERT/UPDATE/DELETE auf `runs`/`scores` für `anon`/`authenticated`; Lesen nur über View (`security_invoker`); anonyme User sind `authenticated` → `is_anonymous` beachten | gering |
| Alte Spielversion einreichen | mittel | `gameVersion` muss `GAME_VERSION` entsprechen (fehlt heute im Parser) | gering |

## Architektur-Vorschlag Spec 3

- Tabellen: `profiles(user_id, nick)`, `run_sessions(id, user_id, mode, seed, map_id, game_version, issued_at, expires_at, used_at)`, `submissions(id, session_id, replay_hash unique, replay jsonb, status pending|verified|rejected, score, wave, end_tick)`, View `leaderboard` (read-only).
- Edge Function `start-run`: Auth (+ Captcha beim Sign-in), Seed aus Daily Seed oder serverseitig zufällig, Limit offener Sessions.
- Edge Function `submit-run`: Session prüfen (Eigentümer, unbenutzt, nicht abgelaufen, Version), `parseReplay` mit strengem Cap, Zeitprüfung, Hash-Dedupe, Insert `pending`, schnelle Antwort.
- Verifikation asynchron: Worker holt `pending` mit `FOR UPDATE SKIP LOCKED`, genau ein Replay pro Aufruf; Client fragt Status ab.
- Modus: „30-Wellen-Challenge“ + Daily Seed als Rangliste; Endlos nicht ranken, bis O-1 (Balancing) gelöst ist.
- Ranglisten pro `game_version` (Saisons); Admin-Funktion zum Verwerfen von Runs.

## Code-Befunde (umzusetzen in Spec 3, `src/sim/` bleibt in Spec 2a unverändert)

1. `src/sim/replay.ts` (`parseReplay`): `gameVersion` nur auf Typ geprüft → gegen `GAME_VERSION` prüfen (Option `{ version }`).
2. `replay.ts` (Kommando-Prüfung `place`): `Object.hasOwn(TOWERS, c[2])` akzeptiert Nicht-Strings (Array wird zu String) → `typeof c[2] === 'string'`.
3. `replay.ts` (`isInt`): lässt `1e300`/`-0` zu (folgenlos, da später abgelehnt) → `Number.isSafeInteger` + Grenzen (`cx < 24`, `cy < 15`, `towerId ≤ 2^31`).
4. `replay.ts` (`result.lives`): nur `typeof number` → `isInt`.
5. DoS: Parser erlaubt 432 000 Ticks → zusätzlicher `maxTicks`-Parameter je Modus im Verifier.
6. Determinismus über Engines (V8/SpiderMonkey/JSC): kein Befund (`Math.sqrt`, `Math.round`, `JSON.stringify` sind spezifiziert; keine Sortierung, Map/Set nur für Lookups).

## Supabase-Grenzen (abgerufen 2026-11-10)

- https://supabase.com/docs/guides/functions/limits – CPU 2 s pro Request (ohne Async-I/O), Wall Clock 150 s (Free) / 400 s (Paid), 256 MB RAM.
- https://supabase.com/docs/guides/functions/background-tasks – `EdgeRuntime.waitUntil` unterliegt denselben Grenzen.
- https://supabase.com/docs/guides/auth/auth-anonymous – 30 anonyme Sign-ins/h/IP, Captcha empfohlen, kein automatisches Aufräumen.
- Einschätzung: 30-Wellen-Lauf (≈ 0,7 s in Node) passt vermutlich unter 2 s CPU – **in der Edge-Runtime vorher messen**; Endlos-Läufe (≈ 11 s) passen nicht.

## Offene Entscheidungen (Nutzer, vor Spec 3)

1. Ranglisten-Modus – Empfehlung: 30-Wellen-Challenge + Daily Seed; Endlos ohne Rangliste.
2. Verifikation – Empfehlung: asynchron per Queue; inline nur, wenn gemessene Deno-CPU < 1 s.
3. Bots/TAS – Empfehlung: akzeptieren und offen kommunizieren (fester Modus begrenzt den Vorteil); optional Top-10 manuell prüfen.
4. Captcha – Empfehlung: Cloudflare Turnstile von Anfang an.
