# Roadmap Backlog Defense

| Spec | Inhalt | Status |
|---|---|---|
| 1 `foundation-phaser-port` | Phaser 4 + TS + Vite, deterministische Simulation, Replays, Tests | Done |
| 2a `visual-overhaul` | „Living Whiteboard 2.0“: CC0-Figuren (Kenney Toon Characters 1), eigene Requisiten-SVGs, Handschrift-Font, Atlas-Pipeline, Phaser-4-Filter (Glow, Schatten, Vignette), Partikel, Juice (Hitstop, Squash & Stretch) | umgesetzt, Host-Nachweis AC-8/AC-12 offen |
| 2b `audio-menu` | CC0-Sound-Assets (Kenney Interface/Impact Sounds, Music Jingles), Musik mit Intensitätsstufen, prozedurale Papier-/Marker-Geräusche, Menü-Szene, Einstellungen (Lautstärke, Effektstufe, reduzierte Bewegung) | geplant |
| 3a `balancing-challenge` | Challenge-Modus (30 Wellen, Sieg + Moral-Bonus), Endlos-Modus, exponentielle HP-Kurve, knappe Wirtschaft, zäher Boss; per Bot-Tuning (`npm run balance`); Spielversion 0.2.0, Replay-Format 2, gehärteter Parser | Done |
| 3b `leaderboard-supabase` | Supabase (Projekt vorhanden, Zugang in `supabase.txt`, nicht im Git): Anonymous Auth + Nickname (kein Captcha), Run-Sessions mit serverseitigem Seed, Daily Seed, asynchrone Replay-Prüfung, RLS, Rangliste „30 Wellen + Daily“ pro Spielversion, Live-Highscores im Ticker. Vorarbeit: `.ai/knowledge/requirements/anti-cheat.md` | Done |
| 4 `office-makeover` | Heller Cartoon-Büro-Look (Kenney-CC0 + eigene SVGs): erzeugte Böden, Kanban-Laufband, Teammitglieder mit Posen an Schreibtischen, Monster mit Tickets, Effekte und Bodenflecken, neue Oberfläche; Daily startet automatisch mit automatischem Teamnamen | Done |
| 4 `content` | Neue Karten, Upgrade-Zweige ab Stufe 3, Wellenvorschau, Zielmodi, Daily Challenge, Achievements, Menü | Done (`campaigns`) |
| 6 `campaigns` | Hauptmenü, 4 Kampagnen × 6 Level, 12 neue Gegner/Bosse, XP/Account-Level, Skilltree, Ranglisten je Karte/Level/Daily, Erfolge (Spielversion 0.4.0) | umgesetzt, Deploy offen |
| 5 `polish` | Mobile/Touch (umgesetzt: Layouts hoch/quer, Tippen mit Bestätigung, Web-App-Manifest, Vollbild), Barrierefreiheit, Performance, Hosting | teilweise |
