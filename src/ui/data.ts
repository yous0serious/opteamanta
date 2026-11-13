// Katalog für die Shell: liest die echten Daten der Simulation (src/sim/data/*) und bereitet sie für die Anzeige auf.
import {
  ACHIEVEMENTS,
  BRANCHES,
  CAMPAIGNS,
  ENEMIES,
  ENEMY_ORDER,
  FREE_MAPS,
  LEVELS,
  MAPS,
  SKILLS,
  SKILL_BRANCHES as SIM_SKILL_BRANCHES,
  TARGET_MODES,
  TARGET_MODE_NAMES,
  THEMES,
  TOWERS,
  TOWER_ORDER,
  levelById,
  mapById,
  xpForLevel as simXpForLevel,
  type CampaignDef,
  type EnemyType,
  type LevelDef,
  type MapDef,
  type MapId,
  type SkillDef,
  type SkillEffect,
  type SkillTreeBranch,
  type TargetMode,
  type TowerType,
} from '../sim/index';

export type CampaignInfo = CampaignDef;
export type LevelInfo = LevelDef;
export type MapInfo = MapDef;
export type SkillBranch = SkillTreeBranch;

export interface SkillInfo extends Omit<SkillDef, 'id' | 'requires'> {
  id: string;
  requires: readonly string[];
  /** Wirkung je Rang als Text (Index 0 = Rang 1). */
  rankTexts: string[];
}

export interface BranchInfo {
  key: 'a' | 'b';
  name: string;
  description: string;
}

export interface EnemyInfo {
  id: string;
  name: string;
  color: string;
  boss: boolean;
}

export const CAMPAIGN_LIST: readonly CampaignInfo[] = CAMPAIGNS;
export const LEVEL_LIST: readonly LevelInfo[] = LEVELS;
export const ALL_ROLES: readonly TowerType[] = TOWER_ORDER;
export const ATTACK_ROLES: readonly TowerType[] = TOWER_ORDER.filter((t) => !TOWERS[t].support);
export { ACHIEVEMENTS, ENEMY_ORDER, TARGET_MODES, TARGET_MODE_NAMES, type TargetMode };

/** Erklärung der Zielmodi (Tooltip in der Infobox). */
export const TARGET_MODE_HINTS: Readonly<Record<TargetMode, string>> = {
  first: 'Ticket mit dem weitesten Fortschritt',
  last: 'Ticket mit dem geringsten Fortschritt',
  strong: 'Ticket mit den meisten HP',
  near: 'Nächstgelegenes Ticket',
};

export const SKILL_BRANCHES: ReadonlyArray<{ id: SkillBranch; name: string; tagline: string }> = SIM_SKILL_BRANCHES.map((b) => ({
  id: b.id,
  name: b.name,
  tagline: b.description,
}));

const STAT_LABEL: Record<string, [label: string, unit: string]> = {
  cost: ['Kosten', ' %'],
  damage: ['Schaden', ' %'],
  range: ['Reichweite', ' %'],
  rate: ['Feuerrate', ' %'],
  startMoney: ['SP zu Beginn', ''],
  startLives: ['Moral zu Beginn', ''],
  waveBonus: ['SP Wellenbonus', ''],
  killReward: ['Abschuss-Belohnung', ' %'],
  sellRefund: ['Verkaufswert', ' Pp.'],
  upgradeCost: ['Upgrade-Kosten', ' %'],
  bossDamage: ['Schaden gegen Bosse', ' %'],
  slowDuration: ['Verlangsamung', ' %'],
  jamTime: ['Störungsdauer', ' %'],
  abilityCooldown: ['Fähigkeits-Intervall', ' %'],
  leakDamage: ['Moralverlust bei Lecks', ' %'],
  businessValue: ['RTO-Ertrag', ' %'],
};

function rolesLabel(roles: readonly TowerType[]): string {
  if (roles.length === TOWER_ORDER.length) return 'Alle Rollen';
  if (roles.length === ATTACK_ROLES.length && ATTACK_ROLES.every((r) => roles.includes(r))) return 'Angreifende Rollen';
  return roles.map((r) => TOWERS[r].name).join(' + ');
}

function effectText(e: SkillEffect, rank: number): string {
  const [label, unit] = STAT_LABEL[e.stat] ?? [e.stat, ''];
  const v = e.perRank * rank;
  const val = `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('de-DE')}${unit}`;
  return 'roles' in e ? `${rolesLabel(e.roles)}: ${val} ${label}` : `${val} ${label}`;
}

export const SKILL_LIST: readonly SkillInfo[] = SKILLS.map((s) => ({
  ...s,
  rankTexts: Array.from({ length: s.maxRank }, (_, i) => s.effects.map((e) => effectText(e, i + 1)).join(' · ')),
}));

export function levelInfo(id: string | null | undefined): LevelInfo | undefined {
  return id ? levelById(id) : undefined;
}

export function campaignInfo(id: string | null | undefined): CampaignInfo | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

export const CAMPAIGN_SHORT: Record<string, string> = { team: 'Team', art: 'ART', solution: 'Solution', portfolio: 'Portfolio' };

/** Kurzbezeichnung „Team 3“, „ART 6“ … */
export function levelLabel(l: LevelInfo): string {
  return `${CAMPAIGN_SHORT[l.campaign] ?? l.campaign} ${l.index}`;
}

/** Etage im NEON-KFZ-Hauptsitz je Kampagne. */
export const CAMPAIGN_FLOOR: Record<string, { label: string; room: string }> = {
  team: { label: 'EG', room: 'Team-Fläche' },
  art: { label: '1. OG', room: 'PI-Planning-Halle' },
  solution: { label: '2. OG', room: 'Serverraum' },
  portfolio: { label: '3. OG', room: 'Vorstandsetage' },
};

export function themeName(id: string | null | undefined): string {
  return (id && THEMES[id as keyof typeof THEMES]?.name) || 'Klassik';
}

export function mapInfo(id: string): MapInfo | undefined {
  return mapById(id as MapId);
}

/** Alle Karten (Ranglisten, Briefings). */
export const ALL_MAPS: readonly MapInfo[] = MAPS;

/** Karten für das freie Spiel und die Karten-Ranglisten (Challenge 30). */
export function freeMaps(): MapInfo[] {
  return [...FREE_MAPS];
}

export function enemyInfo(id: string): EnemyInfo {
  const e = ENEMIES[id as EnemyType] as (typeof ENEMIES)[EnemyType] | undefined;
  return { id, name: e?.name ?? id, color: e?.color ?? '#cfd8dc', boss: e?.boss === true };
}

export function towerInfo(id: string): { id: string; name: string; color: string; cost: number } {
  const t = TOWERS[id as TowerType] as (typeof TOWERS)[TowerType] | undefined;
  return { id, name: t?.name ?? id, color: t?.color ?? '#90a4ae', cost: t?.cost ?? 0 };
}

/** Upgrade-Zweige einer Rolle (Stufe 2 → 3). */
export function branchesFor(type: string): BranchInfo[] {
  const b = BRANCHES[type as TowerType] as (typeof BRANCHES)[TowerType] | undefined;
  if (!b) return [];
  return (['a', 'b'] as const).map((k) => ({ key: k, name: b[k].name, description: b[k].description }));
}

/** Gegnertypen eines Levels, sortiert nach Gewicht; Bosse am Ende. */
export function levelEnemies(l: LevelInfo): Array<{ id: string; boss: boolean }> {
  const w = new Map<string, number>();
  for (const b of l.pool) for (const [k, v] of Object.entries(b.weights)) w.set(k, (w.get(k) ?? 0) + (v ?? 0));
  const list = [...w.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ id, boss: enemyInfo(id).boss }));
  for (const b of l.bossWaves) if (!list.some((e) => e.id === b.boss)) list.push({ id: b.boss, boss: true });
  return list;
}

/** XP-Bedarf (kumulativ) bis Level `l`. */
export const xpForLevel = simXpForLevel;

/** Atlas-Name des Icons (`icon/<name>`). */
export const iconFrame = (name: string): string => `icon/${name}`;
