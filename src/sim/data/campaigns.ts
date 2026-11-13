import type { CampaignDef, CampaignId, EnemyType, LevelDef, LevelId, TowerType, WaveBand } from '../types';

// Kampagnen und Level (Spec campaigns). 4 Kampagnen à 6 Level, Level 6 = Boss-Level.
// Wellen werden aus den Gewichten des passenden Bands per Wellen-RNG gezogen (Game.peekWave), Bosse kommen fest
// am Ende ihrer Welle dazu. Werte per Bot-Tuning (npm run balance -- --levels).

const ATTACK: readonly TowerType[] = ['dualo', 'analyst', 'dev', 'ppl', 'scrum'];
const ART_ROLES: readonly TowerType[] = [...ATTACK, 'rte', 'rta', 'rto'];
const ALL_ROLES: readonly TowerType[] = [...ART_ROLES, 'board'];

function band(from: number, to: number, base: number, perWave: number, weights: Partial<Record<EnemyType, number>>): WaveBand {
  return { from, to, size: [base, perWave], weights };
}

export const CAMPAIGNS: readonly CampaignDef[] = [
  {
    id: 'team',
    name: 'Team-Ebene: Das erste PI',
    tagline: 'Ein frisches agiles Team, ein Backlog voller Überraschungen.',
    theme: 'open-office',
    levels: ['team-1', 'team-2', 'team-3', 'team-4', 'team-5', 'team-6'],
    boss: 'b-scope',
  },
  {
    id: 'art',
    name: 'ART: Der Release Train fährt ein',
    tagline: 'Zehn Teams, ein Takt – und überall rote Fäden auf dem Program Board.',
    theme: 'big-room',
    levels: ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6'],
    boss: 'b-pi',
  },
  {
    id: 'solution',
    name: 'Large Solution: Abhängigkeitshölle',
    tagline: 'Mehrere Züge, ein Produkt – und Lieferanten, die nicht ans Telefon gehen.',
    theme: 'server-room',
    levels: ['solution-1', 'solution-2', 'solution-3', 'solution-4', 'solution-5', 'solution-6'],
    boss: 'b-hydra',
  },
  {
    id: 'portfolio',
    name: 'Portfolio: Lean Portfolio Management',
    tagline: 'Strategie trifft Budget – im 40. Stock wird über Epics entschieden.',
    theme: 'boardroom',
    levels: ['portfolio-1', 'portfolio-2', 'portfolio-3', 'portfolio-4', 'portfolio-5', 'portfolio-6'],
    boss: 'b-lbc',
  },
];

export const LEVELS: readonly LevelDef[] = [
  // ===================== Team =====================
  {
    id: 'team-1', campaign: 'team', index: 1, name: 'Sprint 1: Das Team formiert sich', mapId: 'waterfall',
    briefing: 'Willkommen im Team! Stell Dualos und Entwickler an den Wasserfall und arbeite die ersten Anforderungen ab.',
    waves: 8, startMoney: 300, roles: ['dualo', 'dev'], mods: { hp: 2.4 }, tutorial: true,
    pool: [band(1, 3, 6, 2, { req: 8, cr: 2 }), band(4, 8, 6, 2, { req: 6, cr: 3, story: 2, impediment: 1 })],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'team-2', campaign: 'team', index: 2, name: 'Daily Stand-up', mapId: 'open-plan',
    briefing: 'Impediments blockieren den Gang. Der Business Analyst verlangsamt sie, bis das Team sie aus dem Weg räumt.',
    waves: 10, startMoney: 300, roles: ['dualo', 'dev', 'analyst'], mods: { hp: 2.6 }, tutorial: true,
    pool: [band(1, 4, 6, 2, { req: 6, cr: 3, impediment: 2 }), band(5, 10, 6, 2, { req: 5, cr: 3, impediment: 3, spike: 2, story: 1 })],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'team-3', campaign: 'team', index: 3, name: 'Spikes im Sprint', mapId: 'spaghetti',
    briefing: 'Spikes sprinten plötzlich los. Der Scrum Master schiebt sie zurück in die Timebox.',
    waves: 10, startMoney: 320, roles: ['dualo', 'dev', 'analyst', 'scrum'], mods: { hp: 2.6 },
    pool: [band(1, 4, 6, 2, { req: 5, cr: 3, spike: 3 }), band(5, 10, 6, 2, { req: 4, cr: 2, spike: 4, impediment: 2, obj: 1 })],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'team-4', campaign: 'team', index: 4, name: 'Sprint Review', mapId: 'kanban-loop',
    briefing: 'Features zerfallen in Stories, Scope Creep wächst. Die PPL trifft ganze Gruppen und motiviert das Team.',
    waves: 12, startMoney: 350, roles: ATTACK, mods: { hp: 2.7 },
    pool: [
      band(1, 4, 6, 2, { req: 5, cr: 3, spike: 2, feat: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, spike: 2, impediment: 2, feat: 2, creep: 2, obj: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'team-5', campaign: 'team', index: 5, name: 'Retrospektive', mapId: 'retro-spiral',
    briefing: 'Tech Debt legt Arbeitsplätze lahm, Hotfixes rasen vorbei. Der RTO bringt nach jeder Welle Business Value.',
    waves: 12, startMoney: 350, roles: [...ATTACK, 'rto'], mods: { hp: 4.1 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, hotfix: 2, impediment: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, hotfix: 2, spike: 2, impediment: 2, debt: 2, feat: 1, creep: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'team-6', campaign: 'team', index: 6, name: 'Boss: Sprint-Scope-Explosion', mapId: 'waterfall',
    briefing: 'Kurz vor dem Sprint-Ende explodiert der Scope. Der Boss wächst und spuckt ständig neue User Stories aus.',
    waves: 12, startMoney: 380, roles: [...ATTACK, 'rto'], mods: { hp: 1.45 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, spike: 2, impediment: 2, story: 1 }),
      band(7, 12, 6, 2, { req: 3, cr: 2, spike: 3, impediment: 2, creep: 2, feat: 1, hotfix: 1 }),
    ],
    bossWaves: [{ wave: 12, boss: 'b-scope' }], stars: { two: 60, three: 90 },
  },
  // ===================== ART =====================
  {
    id: 'art-1', campaign: 'art', index: 1, name: 'PI Planning, Tag 1', mapId: 'release-train',
    briefing: 'Abhängigkeiten kommen immer zu zweit. Treffer am einen schaden beiden – erledige sie gemeinsam.',
    waves: 12, startMoney: 400, roles: ART_ROLES, mods: { hp: 2.35 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, dependency: 2, story: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, dependency: 3, obj: 1, feat: 1, spike: 1, impediment: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'art-2', campaign: 'art', index: 2, name: 'Program Board', mapId: 'big-room',
    briefing: 'Enabler Stories halten andere Tickets am Leben. Schalte sie zuerst aus – Zielmodus „Stärkster“ hilft.',
    waves: 12, startMoney: 400, roles: ART_ROLES, mods: { hp: 1.9 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, enabler: 1, obj: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, enabler: 2, obj: 2, dependency: 2, creep: 1, hotfix: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'art-3', campaign: 'art', index: 3, name: 'ART Sync', mapId: 'program-board',
    briefing: 'Meeting-Einladungen und Tech Debt bremsen den Zug. Der RTE synchronisiert und hält alle im Takt.',
    waves: 14, startMoney: 420, roles: ART_ROLES, mods: { hp: 1.85 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, meeting: 2, dependency: 1 }),
      band(6, 14, 6, 2, { req: 3, cr: 2, meeting: 2, debt: 2, dependency: 2, enabler: 1, feat: 1, hotfix: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'art-4', campaign: 'art', index: 4, name: 'System Demo', mapId: 'dependency-web',
    briefing: 'Der Weg kreuzt sich zweimal – gute Plätze decken mehrere Abschnitte ab. Die Demo muss laufen!',
    waves: 14, startMoney: 420, roles: ART_ROLES, mods: { hp: 3.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, dependency: 2, spike: 1 }),
      band(6, 14, 6, 2, { req: 3, cr: 2, dependency: 3, enabler: 2, obj: 1, feat: 1, spike: 1, impediment: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'art-5', campaign: 'art', index: 5, name: 'Inspect & Adapt', mapId: 'big-room',
    briefing: 'Alles etwas schneller als geplant: Tickets laufen 10 % zügiger. Problem-Solving-Workshop inklusive.',
    waves: 15, startMoney: 450, roles: ART_ROLES, mods: { hp: 1.4, speed: 1.1 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, enabler: 1, dependency: 1, hotfix: 1 }),
      band(6, 15, 6, 2, { req: 2, cr: 2, enabler: 2, dependency: 2, obj: 2, creep: 1, debt: 1, meeting: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'art-6', campaign: 'art', index: 6, name: 'Boss: Big-Room-Chaos', mapId: 'program-board',
    briefing: 'Zwei Tage PI Planning, 150 Leute, ein Raum. Das Chaos legt alle 6 s die Arbeitsplätze im Umkreis lahm.',
    waves: 15, startMoney: 450, roles: ART_ROLES, mods: { hp: 1.8 },
    pool: [
      band(1, 7, 6, 2, { req: 4, cr: 3, dependency: 2, enabler: 1, meeting: 1 }),
      band(8, 15, 6, 2, { req: 3, cr: 2, dependency: 2, enabler: 2, obj: 1, meeting: 2, debt: 1 }),
    ],
    bossWaves: [{ wave: 15, boss: 'b-pi' }], stars: { two: 60, three: 90 },
  },
  // ===================== Large Solution =====================
  {
    id: 'solution-1', campaign: 'solution', index: 1, name: 'Solution Train', mapId: 'matrix',
    briefing: 'Compliance-Audits sind gepanzert. Nur im Architektur-Runway eines RTA wirkt der volle Schaden.',
    waves: 15, startMoney: 450, roles: ALL_ROLES, mods: { hp: 1.55 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, compliance: 1, dependency: 1 }),
      band(6, 15, 6, 2, { req: 3, cr: 2, compliance: 2, dependency: 2, obj: 1, enabler: 1, spike: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'solution-2', campaign: 'solution', index: 2, name: 'Schatten-IT', mapId: 'server-aisles',
    briefing: 'Irgendwer betreibt Server unter dem Schreibtisch. Nur Business Analyst oder RTA machen Schatten-IT sichtbar.',
    waves: 15, startMoney: 450, roles: ALL_ROLES, mods: { hp: 2.5 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, 'shadow-it': 2 }),
      band(6, 15, 6, 2, { req: 3, cr: 2, 'shadow-it': 3, compliance: 1, hotfix: 1, dependency: 1, creep: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'solution-3', campaign: 'solution', index: 3, name: 'Lieferanten-Sync', mapId: 'cable-maze',
    briefing: 'Vendor Lock-in macht alle Rollen in der Nähe träge. Halte Abstand oder baue mehr Feuerkraft.',
    waves: 16, startMoney: 480, roles: ALL_ROLES, mods: { hp: 2.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, 'vendor-lock': 1, dependency: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, 'vendor-lock': 2, compliance: 1, 'shadow-it': 1, dependency: 2, enabler: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'solution-4', campaign: 'solution', index: 4, name: 'Compliance-Gate', mapId: 'firewall',
    briefing: 'Ein kurzer Weg durch die Firewall – und alle wollen gleichzeitig durch. Jede Rolle zählt.',
    waves: 16, startMoney: 500, roles: ALL_ROLES, mods: { hp: 1 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, compliance: 1, 'shadow-it': 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, compliance: 2, 'shadow-it': 2, 'vendor-lock': 1, debt: 1, obj: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'solution-5', campaign: 'solution', index: 5, name: 'Pre-PI Planning', mapId: 'server-aisles',
    briefing: 'Alle Züge stimmen sich ab: robustere Tickets, dafür 15 % mehr Belohnung.',
    waves: 16, startMoney: 500, roles: ALL_ROLES, mods: { hp: 2.2, reward: 1.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, dependency: 1, 'vendor-lock': 1, enabler: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, dependency: 2, 'vendor-lock': 1, compliance: 1, 'shadow-it': 1, enabler: 1, feat: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'solution-6', campaign: 'solution', index: 6, name: 'Boss: Integrations-Hydra', mapId: 'cable-maze',
    briefing: 'Schlag ihr eine Schnittstelle ab, wachsen zwei neue Abhängigkeiten nach. Gepanzert – RTA nicht vergessen!',
    waves: 18, startMoney: 520, roles: ALL_ROLES, mods: { hp: 1.8 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, dependency: 2, compliance: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, dependency: 2, compliance: 1, 'shadow-it': 1, 'vendor-lock': 1, enabler: 1 }),
    ],
    bossWaves: [{ wave: 18, boss: 'b-hydra' }], stars: { two: 60, three: 90 },
  },
  // ===================== Portfolio =====================
  {
    id: 'portfolio-1', campaign: 'portfolio', index: 1, name: 'Strategische Themen', mapId: 'glass-tower',
    briefing: 'Epics sind riesig und zerfallen in drei Features – die wiederum in Stories. Splash-Schaden lohnt sich.',
    waves: 16, startMoney: 500, roles: ALL_ROLES, mods: { hp: 1.6 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, feat: 1, epic: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, epic: 1, feat: 1, obj: 1, dependency: 1, enabler: 1, hotfix: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'portfolio-2', campaign: 'portfolio', index: 2, name: 'Portfolio-Kanban', mapId: 'boardroom-table',
    briefing: 'Funnel, Reviewing, Analyzing – rund um den Vorstandstisch staut sich alles. WSJF entscheidet.',
    waves: 18, startMoney: 520, roles: ALL_ROLES, mods: { hp: 2.25 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, epic: 1, spike: 1, impediment: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, epic: 1, compliance: 1, 'vendor-lock': 1, spike: 1, impediment: 1, creep: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'portfolio-3', campaign: 'portfolio', index: 3, name: 'Lean Budgets', mapId: 'stage-gate',
    briefing: 'Stage-Gate trifft Lean Budgets: sechs Tore, wenig Kapazität. Jeder SP will gut investiert sein.',
    waves: 18, startMoney: 450, roles: ALL_ROLES, mods: { hp: 1.4 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, 'shadow-it': 1, dependency: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, epic: 1, 'shadow-it': 1, dependency: 1, enabler: 1, meeting: 1, debt: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'portfolio-4', campaign: 'portfolio', index: 4, name: 'Guardrails', mapId: 'glass-tower',
    briefing: 'Die Leitplanken sind eng und Compliance prüft jedes Stockwerk. Panzer knackt nur der Runway.',
    waves: 18, startMoney: 520, roles: ALL_ROLES, mods: { hp: 1.3 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, compliance: 1, epic: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, compliance: 2, epic: 1, 'vendor-lock': 1, 'shadow-it': 1, enabler: 1 }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'portfolio-5', campaign: 'portfolio', index: 5, name: 'Value Streams', mapId: 'boardroom-table',
    briefing: 'Alle Wertströme fließen durch den Vorstand. Alles, was du kennst, kommt jetzt zusammen.',
    waves: 20, startMoney: 550, roles: ALL_ROLES, mods: { hp: 2.15 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, dependency: 1, enabler: 1, spike: 1 }),
      band(7, 20, 6, 2, {
        req: 2, cr: 2, epic: 1, compliance: 1, 'shadow-it': 1, 'vendor-lock': 1, dependency: 1, enabler: 1, impediment: 1, spike: 1,
      }),
    ],
    bossWaves: [], stars: { two: 70, three: 95 },
  },
  {
    id: 'portfolio-6', campaign: 'portfolio', index: 6, name: 'Boss: Lean Business Case Q4', mapId: 'stage-gate',
    briefing: 'Der Business Case für Q4 rollt an – gepanzert und mit Budget-Kürzungen alle 8 s. Halte die Kapazität zusammen!',
    waves: 20, startMoney: 550, roles: ALL_ROLES, mods: { hp: 1.22 },
    pool: [
      band(1, 7, 6, 2, { req: 4, cr: 3, epic: 1, dependency: 1, compliance: 1 }),
      band(8, 20, 6, 2, { req: 3, cr: 2, epic: 1, compliance: 1, 'shadow-it': 1, 'vendor-lock': 1, enabler: 1, dependency: 1 }),
    ],
    bossWaves: [{ wave: 20, boss: 'b-lbc' }], stars: { two: 60, three: 90 },
  },
];

const LEVEL_BY_ID = new Map<string, LevelDef>(LEVELS.map((l) => [l.id, l]));

export function levelById(id: string): LevelDef | undefined {
  return LEVEL_BY_ID.get(id);
}

export function campaignById(id: string): CampaignDef | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

/** Level einer Kampagne in Reihenfolge. */
export function levelsOfCampaign(id: CampaignId): LevelDef[] {
  return LEVELS.filter((l) => l.campaign === id);
}

/** Nachfolger in der Kampagne (null nach dem Boss-Level). */
export function nextLevel(id: LevelId): LevelDef | null {
  const l = LEVEL_BY_ID.get(id);
  if (!l) return null;
  return LEVELS.find((x) => x.campaign === l.campaign && x.index === l.index + 1) ?? null;
}
