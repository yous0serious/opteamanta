# Ledger: Büro-Neuauftritt und automatische Daily (4)

**Spec:** [spec.md](../../../specs/office-makeover/spec.md) · **Plan:** [plan.md](plan.md)

## Status

| Task | Status | Commit | Note |
|---|---|---|---|
| T01 | done | (T01-Commits) | `src/online/names.ts` (Generator, alle 400 Kombinationen ≤ 16 Zeichen und DB-gültig, Test), `ensureProfile` mit bis zu 5 Versuchen, `DailyFlow.boot/start/playFree/rename`, `Controller.restartOverride/startFree`; Schalter Daily/Freies Spiel, Teamname-Chip mit Umbenennen-Dialog. Live gegen Supabase: Daily ohne Klick (start-run 1×), Name „Quick Sloth 7478“, Auto-Einreichen → „Geprüft · Tagesrang 1“, Nochmal → neue Daily, Freies Spiel ohne Daily, Umbenennen ok, 0 Konsolenfehler. general: `tests/e2e/leaderboard.spec.ts` 13 Fälle, Gesamtsuite 30/30. Ruling: Kommt die Session erst, nachdem der Spieler losgelegt hat, wird sie für den nächsten Neustart aufgehoben (spart einen start-run). |
| T02 | done | (Asset-Commit `31de7cf`) | 15 Kenney-Pakete gesichtet (alle CC0 laut `License.txt`); übernommen: Posen (5 Rollen × 14), Monster-Baukasten, Topdown-Shooter-Kacheln, Generic Items, Splats, Rauch; `tools/monsters.ts` setzt 8 Monster aus Teilen zusammen (walk0–3 + weiße Treffer-Silhouette, Farben aus `PALETTES.monsters`). Build-Optionen `lighten`, `crop`, `trim`. Atlas 2,0 MB. Nunito (OFL) aus dem öffentlichen Registry. Bench vorher (Sandbox, nur Canvas – WebGL in der Sandbox nicht aktivierbar, 15 Flag-Kombinationen geprüft): fx=high avg 25,0 / p95 31,7 ms, fx=low avg 23,6 / p95 28,3 ms. Ruling: Look darf nicht von WebGL-Filtern abhängen (Glow als additive Grafik, Treffer als vorgerenderte Silhouette). |
| T03 | done | `82de8c9` | Prototyp: `src/view/render/office/` (floor: erzeugte Dielen/Teppich/Fliesen + animiertes Laufband + Schrägsicht-Deko, die bei Bebauung ausblendet; workstation: Figur hinter Schreibtisch, Posen-Zustandsmaschine, Gegenstände je Rolle/Stufe; monster: Laufanimation, Blickrichtung, Treffer, Lebensleiste, „?“ bei Verlangsamung, Wachstum; decals), Tiefensortierung nach Fußpunkt, Vignette entfernt, neue Oberfläche (Kopfleiste, Turmkarten mit Porträts aus dem Atlas, Karten). Helligkeit Spielbeginn: waterfall 0,881, matrix 0,940, release-train 0,908, spaghetti 0,904. Rulings: Kenney-Parkett zu dunkel (0,40) und wirkt in 40-px-Kacheln wie Ziegel → Böden werden beim Start erzeugt; Kenney-Möbel in Draufsicht passen nicht zu den schräg gesehenen Figuren → eigene Schrägsicht-SVGs (Pflanze, Wasserspender, Kaffeemaschine, Drucker, Aktenschrank, Schreibtisch, Schild, Krone). **Gate AC-12: Nutzer hat den Prototyp am 2026-11-11 freigegeben.** |
| T04 | done | `df6b5b8` | Posen je Rolle (Ruhe/Angriff/Tippen/Jubeln/Burnout), Geschosse als Büro-Gegenstände (Tasse, Notizblock, Ordner, Tischglocke), Code-Strahl additiv (auch Canvas), PPL-Aura pulsierend, Boost-Ring, Stufen über Ausstattung + Sterne. |
| T05 | done | `df6b5b8` | 8 Monster, Laufanimation (Tempo nach Gegnergeschwindigkeit), Treffer-Silhouette, Lebensleiste, „?“ bei Verlangsamung, Wachstum (Scope Creep, Faktor √(maxHp/baseMaxHp)), Boss 84 px mit Krone + Namensschild; Tod: Rauch + Konfetti + verblassender Bodenfleck; Feature-Zerfall mit Puff. |
| T06 | done | `82de8c9` | Bodenarten je Karte (waterfall Eiche, spaghetti Birke, release-train Teppich, matrix Fliesen), deterministische Deko (keine gleiche Deko benachbart), Schilder FACHBEREICH/DEADLINE abseits des Laufbands. |
| T07 | done | `82de8c9` | Kopfleiste mit Chips (Kapazität, Moral mit Balken, Sprint, Score, Karte, Teamname), Turmkarten mit Porträt aus dem Atlas (`src/view/sprite.ts`), Steuerkarte, Bestenlisten-Karte; Statussymbole per CSS statt Emoji; Spielfeld skaliert mit dem Fenster (bis 1320 px). |
| T08 | done | `df6b5b8` | Effekte für Platzieren, Verkauf, Leck, Jam, Rückstoß, Burnout (alle verzweifeln), Sieg (alle jubeln); Bench nachher: fx=high avg 28,1 / p95 35,0 ms (×1,12/×1,11), fx=low 26,7 / 31,7 ms (×1,13/×1,12) – AC-8 ✓. |
| T09 | todo | – | |
| T10 | todo | – | |

## Rulings

- **R-1** Nur kostenlose Assets (Nutzer); Stil „Cartoon-Büro“ (Nutzerwahl, ADR-0005); Prototyp-Gate vor dem Ausbau.
- **R-2** Daily immer automatisch, freies Spiel optional; Teamname automatisch und änderbar (Nutzerentscheidungen).
- **R-3** Kenney-Pakete über Kenneys OpenGameArt-Uploads bezogen (kenney.nl aus der Sandbox 403); Lizenz je Zip geprüft: alle 15 gesichteten Pakete CC0.

## Open questions

- keine

## Log

- 2026-11-11: Recherche (frei/kostenpflichtig/Phaser-4-Effekte), Pakete gesichtet, Spec 4 + ADR-0005 + Plan entworfen.
