// Texte 1:1 aus dem Original (Zeilen 81–98, 140–141, 196, 223, 238).
import type { TowerType } from '../sim/index';

export const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';

export const JOKES = [
  "+++ EILMELDUNG: Beim PIP wurden 47 Objectives committed. Kapazität reicht für 4. Stimmung: optimistisch +++",
  "+++ PPL fragt im 1:1 'Wie geht's dir?' – Entwickler antwortet mit Burndown-Chart +++",
  '+++ Dualo seit 3 Wochen im Team, hat bereits das Wiki aufgeräumt. Wurde sofort zum Wiki-Owner ernannt. Für immer +++',
  "+++ BA fragt Fachbereich nach den Anforderungen. Fachbereich: 'So wie im Altsystem, nur besser.' Niemand weiß, was das Altsystem macht +++",
  "+++ Entwickler schätzt Story auf 3 Punkte. BA ergänzt 'nur noch eine Kleinigkeit'. Neue Schätzung: Epic +++",
  "+++ Change Request eingegangen: 'Der Button soll grüner sein, aber nicht so grün' +++",
  '+++ 30.11. naht: Kfz-Wechselsaison! IT wird gebeten, bis Januar nichts zu deployen. Oder zu atmen +++',
  '+++ PIP-Tag 2: Programm-Board sieht aus wie eine Wollknäuel-Explosion. Rote Fäden: 112 +++',
  "+++ Kunde schildert Unfall: 'Der Laternenmast kam plötzlich von rechts' – Fachbereich fordert Pflichtfeld 'Laternen-Vorfahrt' +++",
  '+++ Confidence Vote im PIP: Alle Daumen hoch. Unter dem Tisch: alle Finger gekreuzt +++',
  "+++ Feature 'Online-Schadenmeldung' zerfällt beim Refinement in 38 User Stories und eine Existenzkrise +++",
  "+++ Definition of Done erweitert um 'Fachbereich hat es angeschaut (ehrlich jetzt)' +++",
  '+++ Retro-Ergebnis: Wir sollten mehr Retros machen. Action Item: Retro über die Retro +++',
  '+++ Business Owner priorisiert: Alles ist Prio 1. Einiges ist Prio 1+ +++',
];

export const KILL = [
  'Done ✓', 'Abgenommen!', 'In Prod ✓', 'Refined!', 'Geschätzt: 3 SP', 'Merged!', 'Green Build ✓', 'Demo bestanden!',
  'Out of Scope!', 'Closed as Duplicate', "Won't fix", 'Ins nächste PI!', 'Akzeptiert ✓', 'Ab ins Review!',
];
export const LEAK = ['Deadline gerissen!', 'Spillover!', 'Eskalation!', 'Überstunden!', 'Prod-Incident!', 'Fachbereich sauer!', 'Rote Ampel im Board!'];
export const JAM = ['Legacy-Code!', 'Workaround von 2009!', 'Keine Doku!', 'Läuft nur auf Prod!'];
export const ABSENT = ['Klausurphase!', 'Uni-Woche!', 'Bachelorarbeit…', 'Mensa!'];
export const SPRINTS = ['Typklassen-Update', 'Wechselsaison (30.11.!)', 'Hagelsaison', 'Regionalklassen-Chaos', 'Tarifreform', 'Glatteis-Montag', 'Audit-Vorbereitung'];

export const UPGRADE_TITLES: Record<TowerType, readonly string[]> = {
  dualo: ['', '', '2. Semester!', 'Bachelor!', 'Übernommen!', 'JUNIOR-DEV!!!'],
  analyst: ['', '', 'Senior BA!', 'Lead BA!', 'Requirements-Guru!', 'ORAKEL!!!'],
  dev: ['', '', 'Senior Dev!', 'Tech Lead!', 'Principal!', '10x-DEV!!!'],
  ppl: ['', '', 'Mehr Team!', 'Zwei Teams!', 'Ganzer Zug!', 'RTE-LEGENDE!!!'],
  scrum: ['', '', 'Zertifiziert!', 'Agile Coach!', 'Lean-Portfolio!', 'SAFe-GURU!!!'],
  rte: ['', '', 'Pünktlich!', 'Fahrplan steht!', 'Solution Train!', 'ZUGCHEF!!!'],
  rta: ['', '', 'Diagramme!', 'Enterprise-Architekt!', 'Zielbild 2030!', 'CHEF-ARCHITEKT!!!'],
  rto: ['', '', 'Roadmap!', 'Business Case!', 'Portfolio-Board!', 'VALUE-STREAM-KÖNIG!!!'],
  board: ['', '', 'Strategiepapier!', 'Neue Vision!', 'Reorganisation!', 'CEO!!!'],
};

export const TOWER_BLURBS: Record<TowerType, string> = {
  dualo: 'Billig, motiviert, macht alles. Fehlt manchmal wegen Klausurphase.',
  analyst: 'Bremst Anforderungen mit Rückfragen aus. „Was genau meint ihr mit ‚schnell‘?“',
  dev: 'Dauerstrahl aus Code. Braucht Kaffee, Kopfhörer und keine Meetings.',
  ppl: 'Product & People Lead: priorisiert mit Flächenwirkung und pusht Teammitglieder in Reichweite (+25%).',
  scrum: 'Schickt Tickets zurück ins Refinement. Beim Mega-Objective nur bedingt wirksam.',
  rte: 'Release Train Engineer: Alle 10 s PI-Sync – Teammitglieder in Reichweite arbeiten 4 s lang 30 % schneller, Tech-Debt-Störungen enden sofort.',
  rta: 'Release Train Architect: Architektur-Runway – Tickets in Reichweite nehmen 25 % mehr Schaden, Tech Debt doppelt so viel.',
  rto: 'Release Train Owner: Greift nicht an, bringt aber bei jedem Sprint-Ende Business Value (15 SP, +10 je Stufe).',
  board: 'Vorstand (max. 1): Alle 20 s abwechselnd Budget-Freeze (alles steht still) und „Projekt eingestampft“ (dickstes Ticket weg).',
};

/** Lesbare Stiftfarben (Original INK): Signalfarbe → Whiteboard-Marker. */
export const INK = {
  yellow: '#e65100',
  cyan: '#1565c0',
  green: '#2e7d32',
  pink: '#ad1457',
  red: '#c62828',
  purple: '#6a1b9a',
  grey: '#455a64',
  neutral: '#37474f',
} as const;

export function piLabel(wave: number): string {
  if (wave < 1) return 'PI 1 · Start';
  const sprint = (wave - 1) % 5;
  return `PI ${Math.ceil(wave / 5)} · ${sprint === 0 ? 'PIP' : `Sprint ${sprint}`}`;
}

export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
