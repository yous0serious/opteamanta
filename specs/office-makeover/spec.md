# Spec: Büro-Neuauftritt und automatische Daily (Teil 4)

**Status:** Approved
**Size:** L
**Ticket:** –
**Plan:** `.ai/specs/office-makeover/plan.md` (nach Freigabe) · **Ledger:** `.ai/specs/office-makeover/ledger.md`
**Baut auf:** [visual-overhaul](../visual-overhaul/spec.md), [leaderboard-supabase](../leaderboard-supabase/spec.md) · **ADR:** [0005](../../.ai/knowledge/decisions/0005-office-art-direction.md)

## Ziel

Das Spiel bekommt einen eigenständigen, hochwertigen Look: ein **helles Cartoon-Büro von oben** statt des
Whiteboards aus dem Original. Teammitglieder stehen als animierte Ganzkörperfiguren an ihren Arbeitsplätzen. Die
Arbeitspakete laufen als niedliche Monster mit Ticket über ein Kanban-Laufband. Jede Aktion hat sichtbares Feedback:
Partikel, Bodenflecken, Treffer- und Siegeffekte. Die Oberfläche wird komplett neu gestaltet, bleibt aber beim Thema
„agiles Büro“.

Außerdem ist die **Daily automatisch aktiv**: Wer die Seite öffnet, spielt den Tageslauf. Jeder bekommt einen
automatischen Teamnamen, und Ergebnisse landen ohne Zutun in der Bestenliste.

## Nicht-Ziele

- Änderungen an Spielregeln, Balancing oder `src/sim` (Determinismus, Replays und Bestenliste bleiben gültig).
- Kostenpflichtige Assets, KI-generierte Grafik, Drittanbieter-Spiegel (ADR-0003/0005).
- Neue Karten oder Wegverläufe (die vier Karten behalten ihre Pfade; nur die Darstellung ändert sich).
- Mobile/Touch-Optimierung über das heutige Maß hinaus.

## Randbedingungen

- Nur CC0-Assets (Kenney über dessen OpenGameArt-Uploads, `License.txt` je Paket im Repo) plus eigene SVGs.
- Feldraster bleibt 24 × 15 Zellen à 40 px (960 × 600); Türme belegen weiterhin genau eine Zelle.
- WebGL mit Canvas-Fallback; Filter nur WebGL. `fx=low` und `prefers-reduced-motion` bleiben unterstützt.
- Ohne Supabase-Variablen läuft das Spiel offline (freies Spiel, keine Netzwerkaufrufe).
- Ausgeliefertes Asset-Volumen (Atlas + Schriften) ≤ 6 MB.

## Entscheidungen

- Grafikrichtung „Cartoon-Büro“, Asset-Quellen und Perspektive → [ADR-0005](../../.ai/knowledge/decisions/0005-office-art-direction.md)
- Türme: Kenney *Toon Characters 1* (Ganzkörper, Posen `idle`, `attack0–2`, `interact`, `talk`, `think`, `cheer0–1`, `hold`, `show`, `hurt`) an eigenen Arbeitsplätzen (Schreibtisch/Möbel aus *Topdown Shooter*, eigene SVG-Ergänzungen). Stufe 1–5 sichtbar am Arbeitsplatz (Ausstattung) und als Abzeichen.
- Gegner: aus *Monster Builder Pack* beim Asset-Build zusammengesetzte Monster (Körper, Augen, Mund, Arme, Beine) mit Ticket-Symbol; Laufanimation über Bauteil-Tweens bzw. 2–4 Frames.
- Boden: helles Parkett bzw. helle Fliesen (*Topdown Shooter*), Pfad als Kanban-Laufband (eigenes SVG, Laufrichtungspfeile), Deko (Pflanzen, Sofas, Kaffeeküche) nur auf Zellen, die nicht bebaut werden können, oder als flache Bodendeko unter Türmen.
- Effekte: *Particle Pack*, *Smoke Particles*, *Splat Pack* (Flecken als Bodendecals in einer RenderTexture, verblassen), *Emotes Pack* (Sprechblasen), *Generic Items* (Geschosse: Kaffeebecher, Dokumente, Papierflieger). Keine abdunkelnden Kamerafilter (keine Vignette, keine Entsättigung außer im Game-Over-Bild).
- UI: neue DOM-Oberfläche im Stil eines Agile-Tools (Karten, Chips, klare Icons aus *UI Pack*/eigenen SVGs statt Emojis), Schriften Caveat (Überschriften) + Nunito (OFL, `@fontsource/nunito`) für Text.
- Daily: Online startet die Seite automatisch einen Daily-Lauf; nach Spielende wird automatisch eingereicht; „Nochmal“ startet einen neuen Daily-Versuch. Ein Schalter „Freies Spiel“ (Challenge/Endlos) bleibt verfügbar. Teamname wird automatisch erzeugt („<Adjektiv> <Tier> <4 Ziffern>“, ≤ 16 Zeichen, DB-Regel) und ist per Klick änderbar.

## Akzeptanzkriterien

| ID | Kriterium | Nachweis |
|---|---|---|
| AC-1 | Online: Nach dem Laden startet ohne Klick genau ein Daily-Lauf (`start-run` 1×), die Oberfläche kennzeichnet ihn als Daily. Nach Spielende wird das Replay ohne Dialog eingereicht und der Status bis „geprüft“ angezeigt. „Nochmal“ startet einen neuen Daily-Versuch. Der Schalter „Freies Spiel“ startet ein lokales Spiel (Challenge oder Endlos) ohne Einreichung. Offline startet direkt ein freies Spiel. | E2E (gemockt) + Live-Test |
| AC-2 | Beim ersten Online-Besuch wird automatisch ein Profil mit erzeugtem Namen angelegt (Muster `<Adjektiv> <Tier> <4 Ziffern>`, ≤ 16 Zeichen, gültig laut DB-Regel); bei Namenskollision wird mit neuer Zahl wiederholt. Der Name steht sichtbar in der Oberfläche und ist per Klick änderbar (Validierung, „schon vergeben“). | Unit-Test Namensgenerator + E2E |
| AC-3 | Die Karte ist hell: Während des Spiels ist kein abdunkelnder Kamerafilter aktiv (keine Vignette/Entsättigung), und die mittlere relative Helligkeit des Spielfeld-Screenshots zu Spielbeginn beträgt ≥ 0,70 auf allen vier Karten. | E2E (Debug-API + Pixelmessung) |
| AC-4 | Türme: Alle 5 Rollen erscheinen als unterscheidbare Ganzkörperfiguren an einem Arbeitsplatz; je Rolle mindestens drei Zustände (Ruhe-Animation, Angriffspose beim Feuern, Jubeln bei Upgrade/Wellenende); Stufe 1–5 ist ohne Auswahl erkennbar. | Screenshot-Bogen aller Rollen × Stufen + E2E-Debug-Abfrage der Pose |
| AC-5 | Gegner: Alle 8 Typen sind als unterschiedliche Monster erkennbar (Silhouette/Farbe/Symbol), laufen animiert, blinken bei Treffern und hinterlassen beim Erledigen einen Effekt (Partikel + verblassender Bodenfleck). Der Boss ist mindestens doppelt so groß und zeigt eine Lebensleiste. Feature-Zerfall und Scope-Creep-Wachstum sind sichtbar. | Screenshot-Bogen + E2E |
| AC-6 | Effekte: jede Turmrolle hat ein eigenes Geschoss bzw. einen eigenen Effekt (Kaffeebecher, Rückfrage-Papier, Code-Strahl mit Glow, PPL-Aura-Puls, Scrum-Stoßwelle); dazu Effekte für Platzieren, Upgrade, Verkauf, Leck, Wellenende, Sieg und Burnout. Bei `fx=low` halbierte Partikel, ohne Filter; bei `prefers-reduced-motion` kein Wackeln/Hitstop/Wippen. | E2E (Debug-API zählt Effekttypen) + Screenshots |
| AC-7 | Oberfläche: neues Layout mit Kopfleiste (Kapazität, Moral, Sprint n/30, Score, Teamname), Turmkarten mit Porträt, Kosten und Taste, Bestenliste und Daily-Status; keine Emojis in der DOM-Oberfläche (Icons aus Assets). Bei 1366 × 768 sind Spielfeld, alle Turmkarten und die Bestenliste ohne Scrollen sichtbar. Alle bisherigen Bedienwege (Tasten 1–5, U, S, Leertaste, Esc, Rechtsklick, Tempo, Ton, Replay) funktionieren. | E2E (Smoke + Layout-Messung) + Screenshots 1366 × 768 und 1920 × 1080 |
| AC-8 | Leistung: Das Benchmark-Szenario (`?bench=1`, 300 Türme) ist in derselben Sandbox höchstens 1,5× langsamer als der Stand vor dieser Spec (Mittel und p95 der Framezeit, fx=high und fx=low). | `bench`-Messung vorher/nachher im Ledger |
| AC-9 | Lizenzen: Jede ausgelieferte Grafik stammt aus CC0-Paketen (Lizenzdatei unter `assets-src/kenney/<paket>/`) oder eigenen SVGs und steht in `CREDITS.md`; `npm run check:assets` grün; Atlas + Schriften ≤ 6 MB. | `npm run check:assets`, `du` |
| AC-10 | Robustheit: Canvas-Renderer (`?renderer=canvas` bzw. ohne WebGL) und `fx=low` laufen ohne Konsolenfehler durch drei Wellen. | E2E |
| AC-11 | Keine Regeländerung: `git diff main -- src/sim` ist leer; `npm test`, Replay-Prüfung des Referenz-Bots (Hash `aee8c823`) und alle Bestenlisten-Tests bleiben grün. | `npm test`, `npm run replay`, `npm run test:e2e` |
| AC-12 | Prototyp-Gate: Eine Prototyp-Szene (eine Karte, 2 Turmrollen, 2 Gegnertypen, Effekte, neue Oberfläche) wird dem Nutzer per Screenshots vorgelegt und freigegeben, bevor die übrigen Rollen, Gegner und Karten umgesetzt werden. | Freigabe im Ledger |

## Risiken

- Perspektivmix: Figuren und Monster sind frontal gezeichnet, Boden und Möbel von oben. Gegenmaßnahme: einheitliche
  „Draufsicht mit stehenden Figuren“ (wie in vielen Tower-Defense-Spielen), Schlagschatten unter allen Figuren,
  Möbel nur als flache Bodenelemente; der Prototyp zeigt früh, ob es trägt.
- Eigene SVGs (Laufband, Arbeitsplatz-Ergänzungen, Icons) müssen die Kenney-Qualität erreichen.
- 300 Türme mit Animationen: Ruhe-Animationen als günstige Tweens bzw. gestaffelt; Leistung per AC-8 abgesichert.
