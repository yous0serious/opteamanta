import type { MapDef, MapId, ThemeDef, ThemeId } from '../types';

// Wegpunkte in Zellen (24 × 15). Jeder Weg beginnt links außerhalb (x = −1) und endet rechts außerhalb (x = 24).
// Die ersten vier Karten (1:1 aus dem Original, MAPS Zeilen 66–70) bleiben in dieser Reihenfolge vorne:
// Freies Spiel und Daily ziehen ihre Karte nur aus FREE_MAPS (D-2), damit alte Seeds dieselbe Karte ergeben.
export const MAPS: readonly MapDef[] = [
  {
    id: 'spaghetti',
    name: 'Spaghetti-Prozess',
    hue: 300,
    theme: 'open-office',
    waypoints: [[-1, 2], [6, 2], [6, 7], [2, 7], [2, 12], [12, 12], [12, 3], [18, 3], [18, 11], [24, 11]],
  },
  {
    id: 'waterfall',
    name: 'Wasserfall-Modell',
    hue: 190,
    theme: 'open-office',
    waypoints: [[-1, 2], [21, 2], [21, 7], [2, 7], [2, 12], [24, 12]],
  },
  {
    id: 'release-train',
    name: 'Release-Train',
    hue: 40,
    theme: 'big-room',
    waypoints: [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 4], [21, 4], [21, 9], [24, 9]],
  },
  {
    id: 'matrix',
    name: 'Matrix-Organisation',
    hue: 120,
    theme: 'server-room',
    waypoints: [[-1, 12], [4, 12], [4, 2], [9, 2], [9, 9], [14, 9], [14, 1], [20, 1], [20, 13], [24, 13]],
  },
  // Kampagne „Team“ – Großraumbüro
  {
    id: 'open-plan',
    name: 'Großraumbüro',
    hue: 30,
    theme: 'open-office',
    waypoints: [[-1, 2], [4, 2], [4, 12], [10, 12], [10, 2], [16, 2], [16, 12], [20, 12], [20, 6], [24, 6]],
  },
  {
    id: 'kanban-loop',
    name: 'Kanban-Schleife',
    hue: 160,
    theme: 'open-office',
    waypoints: [[-1, 7], [6, 7], [6, 2], [18, 2], [18, 12], [10, 12], [10, 5], [14, 5], [14, 9], [24, 9]],
  },
  {
    id: 'retro-spiral',
    name: 'Retro-Spirale',
    hue: 260,
    theme: 'open-office',
    waypoints: [[-1, 2], [20, 2], [20, 12], [4, 12], [4, 6], [15, 6], [15, 9], [24, 9]],
  },
  // Kampagne „ART“ – PI-Planning-Halle
  {
    id: 'big-room',
    name: 'Big Room Planning',
    hue: 15,
    theme: 'big-room',
    waypoints: [[-1, 11], [3, 11], [3, 3], [9, 3], [9, 11], [15, 11], [15, 3], [21, 3], [21, 11], [24, 11]],
  },
  {
    id: 'program-board',
    name: 'Program Board',
    hue: 345,
    theme: 'big-room',
    waypoints: [[-1, 1], [11, 1], [11, 5], [2, 5], [2, 9], [20, 9], [20, 13], [24, 13]],
  },
  {
    id: 'dependency-web',
    name: 'Abhängigkeitsnetz',
    hue: 280,
    theme: 'big-room',
    waypoints: [[-1, 4], [8, 4], [8, 11], [14, 11], [14, 2], [20, 2], [20, 7], [5, 7], [5, 13], [24, 13]],
  },
  // Kampagne „Large Solution“ – Serverraum
  {
    id: 'server-aisles',
    name: 'Rack-Gänge',
    hue: 200,
    theme: 'server-room',
    waypoints: [[-1, 13], [3, 13], [3, 1], [8, 1], [8, 13], [13, 13], [13, 1], [18, 1], [18, 13], [22, 13], [22, 6], [24, 6]],
  },
  {
    id: 'cable-maze',
    name: 'Kabelsalat',
    hue: 220,
    theme: 'server-room',
    waypoints: [[-1, 6], [4, 6], [4, 1], [10, 1], [10, 10], [2, 10], [2, 13], [16, 13], [16, 4], [21, 4], [21, 9], [24, 9]],
  },
  {
    id: 'firewall',
    name: 'Firewall',
    hue: 5,
    theme: 'server-room',
    waypoints: [[-1, 7], [6, 7], [6, 2], [12, 2], [12, 12], [18, 12], [18, 7], [24, 7]],
  },
  // Kampagne „Portfolio“ – Vorstandsetage
  {
    id: 'glass-tower',
    name: 'Glasturm',
    hue: 190,
    theme: 'boardroom',
    waypoints: [[-1, 13], [5, 13], [5, 10], [2, 10], [2, 6], [8, 6], [8, 2], [16, 2], [16, 8], [22, 8], [22, 12], [24, 12]],
  },
  {
    id: 'boardroom-table',
    name: 'Vorstandstisch',
    hue: 45,
    theme: 'boardroom',
    waypoints: [[-1, 2], [19, 2], [19, 12], [5, 12], [5, 6], [24, 6]],
  },
  {
    id: 'stage-gate',
    name: 'Stage-Gate',
    hue: 0,
    theme: 'boardroom',
    waypoints: [[-1, 10], [4, 10], [4, 4], [8, 4], [8, 10], [12, 10], [12, 4], [16, 4], [16, 10], [20, 10], [20, 4], [24, 4]],
  },
];

/** Karten für freies Spiel/Daily ohne mapId (D-2: der erste RNG-Zug wählt hieraus). */
export const FREE_MAP_COUNT = 4;
export const FREE_MAPS: readonly MapDef[] = MAPS.slice(0, FREE_MAP_COUNT);

export function mapById(id: MapId): MapDef | undefined {
  return MAPS.find((m) => m.id === id);
}

export const THEMES: Readonly<Record<ThemeId, ThemeDef>> = {
  'open-office': { id: 'open-office', name: 'Großraumbüro' },
  'big-room': { id: 'big-room', name: 'PI-Planning-Halle' },
  'server-room': { id: 'server-room', name: 'Serverraum' },
  boardroom: { id: 'boardroom', name: 'Vorstandsetage' },
};
