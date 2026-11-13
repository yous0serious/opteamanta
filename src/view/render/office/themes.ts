import type { MapId, ThemeId } from '../../../sim/index';

// Kampagnen-Themes (Spec campaigns „Kampagnen und Themes“, AC-7): Boden, Deko, Licht, Laufband, Beschilderung und
// Musik je Kampagne. Alles bleibt hell (Spec office-makeover AC-3: Spielfeld-Helligkeit ≥ 0,70, auch im Serverraum).

/** Bodenbelag (beim Start erzeugt, `floor.ts`). */
export type FloorStyle = 'oak' | 'birch' | 'carpet' | 'tiles' | 'hall' | 'server' | 'marble';

/** Lichtstimmung (`lighting.ts`). */
export type LightStyle = 'window' | 'spots' | 'cool' | 'skyline';

/** Laufband-Optik: Farben (0xRRGGBB) und Zusätze. */
export interface BeltStyle {
  rim: number;
  band: number;
  inner: number;
  chevron: number;
  /** Querschwellen wie bei Gleisen (Release Train). */
  sleepers?: number;
  /** Leuchtkante (Serverraum). */
  glow?: number;
}

/** Deko-Requisit: Atlas-Frame, Anzeigebreite (px), belegte Zellen nebeneinander, Ziehungsgewicht. */
export interface DecorDef {
  frame: string;
  w: number;
  cells?: number;
  weight?: number;
  /** LED-Positionen (u, v ∈ 0…1 im Bild) für blinkende Lämpchen (Serverraum). */
  leds?: ReadonlyArray<readonly [number, number]>;
  /** Wechselbild für Umblätter-Animation (Flipchart). */
  flip?: string;
}

export interface Sign {
  label: string;
  color: string;
  icon: string;
}

export interface OfficeTheme {
  id: ThemeId;
  name: string;
  /** Bodenbeläge; Karten ohne festen Belag wählen deterministisch nach Karten-ID. */
  floors: readonly FloorStyle[];
  light: LightStyle;
  belt: BeltStyle;
  /** Spaltenbeschriftung auf dem Boden (4 Spalten). */
  lanes: readonly [string, string, string, string];
  laneColor: string;
  start: Sign;
  end: Sign;
  decor: readonly DecorDef[];
  /** Zusätzliche Deko nach der Grundausstattung (ändert die bisherige Verteilung nicht). */
  extraDecor?: readonly DecorDef[];
  decorCount: number;
  /** Glaswand-Leiste am oberen Rand (Vorstandsetage). */
  glassWall?: boolean;
  /** Kabeltrassen im Boden (Serverraum). */
  cableTrays?: boolean;
}

const RACK_LEDS: ReadonlyArray<readonly [number, number]> = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [
  [0.68, (23.5 + 12 * i) / 116] as const,
  [0.76, (23.5 + 12 * i) / 116] as const,
]);
/** LEDs der Schrankreihe (drei Schränke à 48 px in 156 px Breite). */
const RACK_ROW_LEDS: ReadonlyArray<readonly [number, number]> = [0, 1, 2].flatMap((r) =>
  [0, 2, 3, 5, 6].flatMap((i) => [[(40.8 + 48 * r) / 156, (23.5 + 12 * i) / 116] as const, [(45.6 + 48 * r) / 156, (23.5 + 12 * i) / 116] as const]),
);

export const THEMES: Readonly<Record<ThemeId, OfficeTheme>> = {
  'open-office': {
    id: 'open-office',
    name: 'Großraumbüro',
    floors: ['oak', 'birch'],
    light: 'window',
    belt: { rim: 0x90a4ae, band: 0xeef3f6, inner: 0xdde6eb, chevron: 0x26a69a },
    lanes: ['BACKLOG', 'IN ARBEIT', 'REVIEW', 'DONE'],
    laneColor: '#90a4ae',
    start: { label: 'FACHBEREICH', color: '#1565c0', icon: 'item/folder' },
    end: { label: 'DEADLINE', color: '#c62828', icon: 'item/hourglass' },
    decor: [
      { frame: 'deco/plant', w: 30 },
      { frame: 'deco/plant', w: 26 },
      { frame: 'deco/cooler', w: 24 },
      { frame: 'deco/coffee', w: 38 },
      { frame: 'deco/printer', w: 34 },
      { frame: 'deco/cabinet', w: 26 },
    ],
    extraDecor: [
      { frame: 'deco/ficus', w: 30 },
      { frame: 'deco/bookshelf', w: 28 },
      { frame: 'deco/ficus', w: 26 },
    ],
    decorCount: 14,
  },
  'big-room': {
    id: 'big-room',
    name: 'PI-Planning-Halle',
    floors: ['hall'],
    light: 'spots',
    belt: { rim: 0x8d9ba5, band: 0xf6efe6, inner: 0xece2d4, chevron: 0xef6c00, sleepers: 0xbcaaa4 },
    lanes: ['ITERATION 1', 'ITERATION 2', 'ITERATION 3', 'IP-ITERATION'],
    laneColor: '#8d9ba5',
    start: { label: 'ART-BACKLOG', color: '#1565c0', icon: 'item/folder' },
    end: { label: 'SYSTEM-DEMO', color: '#c62828', icon: 'item/hourglass' },
    decor: [
      { frame: 'deco/program-board', w: 112, cells: 3, weight: 1.2 },
      { frame: 'deco/sticky-wall', w: 74, cells: 2, weight: 1.4 },
      { frame: 'deco/table-long', w: 74, cells: 2, weight: 1.6 },
      { frame: 'deco/flipchart-a', w: 28, weight: 1.6, flip: 'deco/flipchart-b' },
      { frame: 'deco/pizza', w: 26, weight: 0.7 },
      { frame: 'deco/chairs', w: 22, weight: 0.8 },
      { frame: 'deco/coffee', w: 38, weight: 0.6 },
      { frame: 'deco/plant', w: 26, weight: 0.6 },
    ],
    decorCount: 17,
  },
  'server-room': {
    id: 'server-room',
    name: 'Serverraum',
    floors: ['server'],
    light: 'cool',
    belt: { rim: 0x78909c, band: 0xeef5fb, inner: 0xd8e8f5, chevron: 0x1e88e5, glow: 0x4fc3f7 },
    lanes: ['DEV', 'TEST', 'STAGING', 'PROD'],
    laneColor: '#7fa3bf',
    start: { label: 'INTEGRATION', color: '#1565c0', icon: 'item/laptop' },
    end: { label: 'GO-LIVE', color: '#c62828', icon: 'item/hourglass' },
    decor: [
      { frame: 'deco/rack-row', w: 92, cells: 2, weight: 1.6, leds: RACK_ROW_LEDS },
      { frame: 'deco/rack', w: 32, weight: 2, leds: RACK_LEDS },
      { frame: 'deco/ups', w: 28, weight: 0.8, leds: [[0.7, 0.36]] },
      { frame: 'deco/crac', w: 32, weight: 0.8, leds: [[0.42, 0.6]] },
      { frame: 'deco/extinguisher', w: 15, weight: 0.6 },
      { frame: 'deco/cable-coil', w: 28, weight: 0.8 },
      { frame: 'deco/cabinet', w: 24, weight: 0.4 },
    ],
    decorCount: 22,
    cableTrays: true,
  },
  boardroom: {
    id: 'boardroom',
    name: 'Vorstandsetage',
    floors: ['marble'],
    light: 'skyline',
    belt: { rim: 0xc9a227, band: 0xe57373, inner: 0xd95f5f, chevron: 0xffe082 },
    lanes: ['FUNNEL', 'ANALYSE', 'PORTFOLIO-BACKLOG', 'UMSETZUNG'],
    laneColor: '#b0a089',
    start: { label: 'STRATEGIE', color: '#1565c0', icon: 'item/clipboard' },
    end: { label: 'Q4-REVIEW', color: '#c62828', icon: 'item/hourglass' },
    decor: [
      { frame: 'deco/table-board', w: 112, cells: 3, weight: 1 },
      { frame: 'deco/trophy-cabinet', w: 56, cells: 2, weight: 0.6 },
      { frame: 'deco/sofa-leather', w: 68, cells: 2, weight: 1 },
      { frame: 'deco/chair-leather', w: 24, weight: 1.4 },
      { frame: 'deco/orchid', w: 18, weight: 1 },
      { frame: 'deco/globe', w: 24, weight: 0.8 },
      { frame: 'deco/plant', w: 30, weight: 0.8 },
      { frame: 'deco/coffee', w: 36, weight: 0.5 },
    ],
    decorCount: 16,
    glassWall: true,
  },
};

/** Ersatz-Zuordnung für Karten ohne `theme` (ältere Sim-Stände). */
const THEME_BY_MAP: Partial<Record<MapId, ThemeId>> = {
  'release-train': 'big-room', matrix: 'server-room',
  'big-room': 'big-room', 'program-board': 'big-room', 'dependency-web': 'big-room',
  'server-aisles': 'server-room', 'cable-maze': 'server-room', firewall: 'server-room',
  'glass-tower': 'boardroom', 'boardroom-table': 'boardroom', 'stage-gate': 'boardroom',
};

/** Feste Bodenbeläge der vier Ursprungskarten (bisheriger Look bleibt). */
const LEGACY_FLOOR: Partial<Record<MapId, FloorStyle>> = { waterfall: 'oak', spaghetti: 'birch', 'release-train': 'carpet', matrix: 'tiles' };

/** Theme einer Karte (`MapDef.theme`, sonst Ersatz-Zuordnung, sonst Großraumbüro). */
export function themeOf(map: { id: MapId; theme?: ThemeId }): ThemeId {
  return map.theme && map.theme in THEMES ? map.theme : (THEME_BY_MAP[map.id] ?? 'open-office');
}

/** Bodenbelag einer Karte im Theme (Ursprungskarten behalten ihren Belag). */
export function floorOf(mapId: MapId, theme: ThemeId): FloorStyle {
  const legacy = LEGACY_FLOOR[mapId];
  if (legacy) return legacy;
  const floors = THEMES[theme].floors;
  let h = 0;
  for (const ch of mapId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return floors[h % floors.length]!;
}
