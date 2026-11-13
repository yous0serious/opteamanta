import type { Modifiers, RoleModifiers, SkillDef, SkillLoadout, SkillTreeBranch, TowerType } from '../types';

// Skilltree (Spec campaigns): 3 Äste à 8 Knoten (Ränge 1–3) + Kapstein (Rang 1). Effekte wirken als Modifiers
// in der Simulation und zählen in Ranglisten (das Loadout steht im Replay v3).
//
// Icon-Namen (Atlas `icon/<name>`, gezeichnet von der Art-Pipeline):
//   skill-pair, skill-dual, skill-tdd, skill-swarm, skill-dod, skill-cop, skill-mob, skill-tshape, skill-team-cap,
//   skill-wsjf, skill-kanban, skill-lbc, skill-ci, skill-refine, skill-flow, skill-devops, skill-rod, skill-proc-cap,
//   skill-servant, skill-ia, skill-pi, skill-sync, skill-runway, skill-coach, skill-gemba, skill-vision, skill-lead-cap

const ATTACKERS: readonly TowerType[] = ['dualo', 'analyst', 'dev', 'ppl', 'scrum'];
const SUPPORTERS: readonly TowerType[] = ['rte', 'rta', 'rto', 'board'];
const ALL_ROLES: readonly TowerType[] = [...ATTACKERS, ...SUPPORTERS];

export const SKILL_BRANCHES: ReadonlyArray<{ id: SkillTreeBranch; name: string; description: string }> = [
  { id: 'team', name: 'Team & Technik', description: 'Mehr Schlagkraft für die angreifenden Rollen.' },
  { id: 'process', name: 'Prozess & Flow', description: 'Kapazität, Belohnungen und günstigere Upgrades.' },
  { id: 'leadership', name: 'Führung & Kultur', description: 'Moral, Fähigkeiten und Unterstützungsrollen.' },
];

export const SKILLS: readonly SkillDef[] = [
  // ----- Team & Technik -----
  {
    id: 'team-pair', branch: 'team', tier: 1, col: 0, name: 'Pair Programming', icon: 'skill-pair', maxRank: 3, requires: [],
    description: 'Zwei Köpfe, ein Bug weniger: Entwickler +5 % Schaden je Rang.',
    effects: [{ stat: 'damage', roles: ['dev'], perRank: 5 }],
  },
  {
    id: 'team-dual', branch: 'team', tier: 1, col: 1, name: 'Duales Studium', icon: 'skill-dual', maxRank: 3, requires: [],
    description: 'Dualos kosten 5 % weniger und machen 5 % mehr Schaden je Rang.',
    effects: [{ stat: 'cost', roles: ['dualo'], perRank: -5 }, { stat: 'damage', roles: ['dualo'], perRank: 5 }],
  },
  {
    id: 'team-tdd', branch: 'team', tier: 2, col: 0, name: 'Test-Driven Development', icon: 'skill-tdd', maxRank: 3, requires: ['team-pair'],
    description: 'Erst der Test, dann der Treffer: Entwickler +4 % Reichweite je Rang.',
    effects: [{ stat: 'range', roles: ['dev'], perRank: 4 }],
  },
  {
    id: 'team-swarm', branch: 'team', tier: 2, col: 1, name: 'Swarming', icon: 'skill-swarm', maxRank: 3, requires: ['team-dual'],
    description: 'Alle stürzen sich auf das Ticket: angreifende Rollen feuern 3 % schneller je Rang.',
    effects: [{ stat: 'rate', roles: ATTACKERS, perRank: 3 }],
  },
  {
    id: 'team-dod', branch: 'team', tier: 3, col: 0, name: 'Definition of Done', icon: 'skill-dod', maxRank: 3, requires: ['team-tdd'],
    description: 'Fertig heißt fertig: +6 % Schaden gegen Bosse je Rang.',
    effects: [{ stat: 'bossDamage', perRank: 6 }],
  },
  {
    id: 'team-cop', branch: 'team', tier: 3, col: 1, name: 'Community of Practice', icon: 'skill-cop', maxRank: 3, requires: ['team-swarm'],
    description: 'Business Analyst und Scrum Master lernen voneinander: +8 % Schaden je Rang.',
    effects: [{ stat: 'damage', roles: ['analyst', 'scrum'], perRank: 8 }],
  },
  {
    id: 'team-mob', branch: 'team', tier: 4, col: 0, name: 'Mob Programming', icon: 'skill-mob', maxRank: 3, requires: ['team-dod'],
    description: 'Alle an einem Bildschirm: PPL +5 % Schaden und +3 % Reichweite je Rang.',
    effects: [{ stat: 'damage', roles: ['ppl'], perRank: 5 }, { stat: 'range', roles: ['ppl'], perRank: 3 }],
  },
  {
    id: 'team-tshape', branch: 'team', tier: 4, col: 1, name: 'T-Shaped Skills', icon: 'skill-tshape', maxRank: 3, requires: ['team-cop'],
    description: 'Breit aufgestellt: angreifende Rollen +2 % Reichweite je Rang.',
    effects: [{ stat: 'range', roles: ATTACKERS, perRank: 2 }],
  },
  {
    id: 'team-cap', branch: 'team', tier: 5, col: 0, name: 'Hochleistungsteam', icon: 'skill-team-cap', maxRank: 1, capstone: true,
    requires: ['team-mob', 'team-tshape'],
    description: 'Kapstein: alle angreifenden Rollen +10 % Schaden.',
    effects: [{ stat: 'damage', roles: ATTACKERS, perRank: 10 }],
  },
  // ----- Prozess & Flow -----
  {
    id: 'proc-wsjf', branch: 'process', tier: 1, col: 0, name: 'WSJF', icon: 'skill-wsjf', maxRank: 3, requires: [],
    description: 'Weighted Shortest Job First: +4 % Abschuss-Belohnung je Rang.',
    effects: [{ stat: 'killReward', perRank: 4 }],
  },
  {
    id: 'proc-kanban', branch: 'process', tier: 1, col: 1, name: 'Kanban-Board', icon: 'skill-kanban', maxRank: 3, requires: [],
    description: 'Sichtbare Arbeit: +5 SP Wellenbonus je Rang.',
    effects: [{ stat: 'waveBonus', perRank: 5 }],
  },
  {
    id: 'proc-lbc', branch: 'process', tier: 2, col: 0, name: 'Lean Business Case', icon: 'skill-lbc', maxRank: 3, requires: ['proc-wsjf'],
    description: 'Gut begründet, früh finanziert: +25 SP Startkapazität je Rang.',
    effects: [{ stat: 'startMoney', perRank: 25 }],
  },
  {
    id: 'proc-ci', branch: 'process', tier: 2, col: 1, name: 'Continuous Integration', icon: 'skill-ci', maxRank: 3, requires: ['proc-kanban'],
    description: 'Kleine Schritte, oft integriert: Upgrades 4 % günstiger je Rang.',
    effects: [{ stat: 'upgradeCost', perRank: -4 }],
  },
  {
    id: 'proc-refine', branch: 'process', tier: 3, col: 0, name: 'Backlog Refinement', icon: 'skill-refine', maxRank: 3, requires: ['proc-lbc'],
    description: 'Weniger Verschwendung: Verkaufswert +5 Prozentpunkte je Rang.',
    effects: [{ stat: 'sellRefund', perRank: 5 }],
  },
  {
    id: 'proc-flow', branch: 'process', tier: 3, col: 1, name: 'Flow-Metriken', icon: 'skill-flow', maxRank: 3, requires: ['proc-ci'],
    description: 'Was man misst, wird besser: RTO-Ertrag +15 % je Rang.',
    effects: [{ stat: 'businessValue', perRank: 15 }],
  },
  {
    id: 'proc-devops', branch: 'process', tier: 4, col: 0, name: 'DevOps', icon: 'skill-devops', maxRank: 3, requires: ['proc-refine'],
    description: 'You build it, you run it: alle Rollen 3 % günstiger je Rang.',
    effects: [{ stat: 'cost', roles: ALL_ROLES, perRank: -3 }],
  },
  {
    id: 'proc-rod', branch: 'process', tier: 4, col: 1, name: 'Release on Demand', icon: 'skill-rod', maxRank: 3, requires: ['proc-flow'],
    description: 'Ausliefern, wenn es Wert stiftet: +3 % Abschuss-Belohnung und +3 SP Wellenbonus je Rang.',
    effects: [{ stat: 'killReward', perRank: 3 }, { stat: 'waveBonus', perRank: 3 }],
  },
  {
    id: 'proc-cap', branch: 'process', tier: 5, col: 0, name: 'Portfolio-Kanban', icon: 'skill-proc-cap', maxRank: 1, capstone: true,
    requires: ['proc-devops', 'proc-rod'],
    description: 'Kapstein: +100 SP Startkapazität und +10 SP Wellenbonus.',
    effects: [{ stat: 'startMoney', perRank: 100 }, { stat: 'waveBonus', perRank: 10 }],
  },
  // ----- Führung & Kultur -----
  {
    id: 'lead-servant', branch: 'leadership', tier: 1, col: 0, name: 'Servant Leadership', icon: 'skill-servant', maxRank: 3, requires: [],
    description: 'Das Team zuerst: +5 Moral zu Spielbeginn je Rang.',
    effects: [{ stat: 'startLives', perRank: 5 }],
  },
  {
    id: 'lead-ia', branch: 'leadership', tier: 1, col: 1, name: 'Inspect & Adapt', icon: 'skill-ia', maxRank: 3, requires: [],
    description: 'Aus Fehlern lernen: Lecks kosten 6 % weniger Moral je Rang.',
    effects: [{ stat: 'leakDamage', perRank: -6 }],
  },
  {
    id: 'lead-pi', branch: 'leadership', tier: 2, col: 0, name: 'PI Planning', icon: 'skill-pi', maxRank: 3, requires: ['lead-servant'],
    description: 'Alle in einem Raum: RTE und Vorstand nutzen ihre Fähigkeiten 6 % häufiger je Rang.',
    effects: [{ stat: 'abilityCooldown', perRank: -6 }],
  },
  {
    id: 'lead-sync', branch: 'leadership', tier: 2, col: 1, name: 'ART Sync', icon: 'skill-sync', maxRank: 3, requires: ['lead-ia'],
    description: 'Blocker früh klären: Störungen durch Gegner 10 % kürzer je Rang.',
    effects: [{ stat: 'jamTime', perRank: -10 }],
  },
  {
    id: 'lead-runway', branch: 'leadership', tier: 3, col: 0, name: 'Architectural Runway', icon: 'skill-runway', maxRank: 3, requires: ['lead-pi'],
    description: 'Vorausschauend bauen: RTA +6 % Reichweite je Rang.',
    effects: [{ stat: 'range', roles: ['rta'], perRank: 6 }],
  },
  {
    id: 'lead-coach', branch: 'leadership', tier: 3, col: 1, name: 'SAFe Program Consultant', icon: 'skill-coach', maxRank: 3, requires: ['lead-sync'],
    description: 'Coaching wirkt: Verlangsamung 10 % länger, Scrum Master +5 % Reichweite je Rang.',
    effects: [{ stat: 'slowDuration', perRank: 10 }, { stat: 'range', roles: ['scrum'], perRank: 5 }],
  },
  {
    id: 'lead-gemba', branch: 'leadership', tier: 4, col: 0, name: 'Go See (Gemba)', icon: 'skill-gemba', maxRank: 3, requires: ['lead-runway'],
    description: 'Hingehen, wo die Arbeit passiert: Unterstützungsrollen 6 % günstiger je Rang.',
    effects: [{ stat: 'cost', roles: SUPPORTERS, perRank: -6 }],
  },
  {
    id: 'lead-vision', branch: 'leadership', tier: 4, col: 1, name: 'Vision & Roadmap', icon: 'skill-vision', maxRank: 3, requires: ['lead-coach'],
    description: 'Alle wissen, wohin: +5 % Schaden gegen Bosse und +3 Moral je Rang.',
    effects: [{ stat: 'bossDamage', perRank: 5 }, { stat: 'startLives', perRank: 3 }],
  },
  {
    id: 'lead-cap', branch: 'leadership', tier: 5, col: 0, name: 'Lean-Agile Leadership', icon: 'skill-lead-cap', maxRank: 1, capstone: true,
    requires: ['lead-gemba', 'lead-vision'],
    description: 'Kapstein: Fähigkeiten 15 % häufiger, Lecks kosten 15 % weniger Moral, +10 Moral.',
    effects: [{ stat: 'abilityCooldown', perRank: -15 }, { stat: 'leakDamage', perRank: -15 }, { stat: 'startLives', perRank: 10 }],
  },
];

const BY_ID = new Map<string, SkillDef>(SKILLS.map((s) => [s.id, s]));

export function skillById(id: string): SkillDef | undefined {
  return BY_ID.get(id);
}

export function emptyModifiers(): Modifiers {
  const role = {} as Record<TowerType, RoleModifiers>;
  for (const r of ALL_ROLES) role[r] = { cost: 0, damage: 0, range: 0, rate: 0 };
  return {
    startMoney: 0, startLives: 0, waveBonus: 0, killReward: 0, sellRefund: 0, upgradeCost: 0, bossDamage: 0,
    slowDuration: 0, jamTime: 0, abilityCooldown: 0, leakDamage: 0, businessValue: 0, role,
  };
}

/** Summe der Effekte aller gelernten Ränge (unbekannte IDs werden ignoriert, Ränge auf 0…maxRank begrenzt). */
export function modifiersFor(loadout: SkillLoadout): Modifiers {
  const m = emptyModifiers();
  for (const s of SKILLS) {
    const raw = loadout[s.id];
    const rank = typeof raw === 'number' && Number.isInteger(raw) ? Math.max(0, Math.min(s.maxRank, raw)) : 0;
    if (!rank) continue;
    for (const e of s.effects) {
      if ('roles' in e) for (const r of e.roles) m.role[r][e.stat] += e.perRank * rank;
      else m[e.stat] += e.perRank * rank;
    }
  }
  return m;
}

/** Summe der vergebenen Punkte (1 Punkt je Rang). */
export function loadoutPoints(loadout: SkillLoadout): number {
  let n = 0;
  for (const v of Object.values(loadout)) if (typeof v === 'number') n += v;
  return n;
}

/** Kanonische Form: nur Ränge ≥ 1, Schlüssel in SKILLS-Reihenfolge (für Vergleiche Server ↔ Replay). */
export function normalizeLoadout(loadout: SkillLoadout): SkillLoadout {
  const out: SkillLoadout = {};
  for (const s of SKILLS) {
    const v = loadout[s.id];
    if (typeof v === 'number' && v > 0) out[s.id] = v;
  }
  return out;
}

/** true, wenn beide Loadouts dieselben Ränge vergeben (0/fehlend gleichwertig). */
export function sameLoadout(a: SkillLoadout, b: SkillLoadout): boolean {
  return SKILLS.every((s) => (a[s.id] ?? 0) === (b[s.id] ?? 0));
}

/**
 * Prüft ein Loadout: null = gültig, sonst Fehlercode
 * `invalid` | `unknown:<id>` | `rank:<id>` | `requires:<id>` | `points`.
 */
export function validateLoadout(loadout: unknown, points: number): string | null {
  if (!loadout || typeof loadout !== 'object' || Array.isArray(loadout)) return 'invalid';
  const l = loadout as Record<string, unknown>;
  let total = 0;
  for (const [id, rank] of Object.entries(l)) {
    const def = BY_ID.get(id);
    if (!def) return `unknown:${id}`;
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 0 || rank > def.maxRank) return `rank:${id}`;
    total += rank;
  }
  for (const [id, rank] of Object.entries(l)) {
    if (!rank) continue;
    for (const req of BY_ID.get(id)!.requires) {
      const r = l[req];
      if (typeof r !== 'number' || r < 1) return `requires:${id}`;
    }
  }
  if (total > points) return 'points';
  return null;
}
