import type { MapDef } from '../types';

// Wegpunkte 1:1 aus dem Original (MAPS, Zeilen 66–70), in Zellen.
export const MAPS: readonly MapDef[] = [
  {
    id: 'spaghetti',
    name: 'Spaghetti-Prozess',
    hue: 300,
    waypoints: [[-1, 2], [6, 2], [6, 7], [2, 7], [2, 12], [12, 12], [12, 3], [18, 3], [18, 11], [24, 11]],
  },
  {
    id: 'waterfall',
    name: 'Wasserfall-Modell',
    hue: 190,
    waypoints: [[-1, 2], [21, 2], [21, 7], [2, 7], [2, 12], [24, 12]],
  },
  {
    id: 'release-train',
    name: 'Release-Train',
    hue: 40,
    waypoints: [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 4], [21, 4], [21, 9], [24, 9]],
  },
  {
    id: 'matrix',
    name: 'Matrix-Organisation',
    hue: 120,
    waypoints: [[-1, 12], [4, 12], [4, 2], [9, 2], [9, 9], [14, 9], [14, 1], [20, 1], [20, 13], [24, 13]],
  },
];
