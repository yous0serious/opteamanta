// Öffentliche API der deterministischen Simulation (ADR-0002).
export * from './constants';
export * from './types';
export { GAME_VERSION } from './version';
export {
  TOWERS, TOWER_ORDER, BRANCHES, BRANCH_LEVEL, TARGET_MODES, TARGET_MODE_NAMES, RTE_SYNC, RTA_RUNWAY, RTO_VALUE, BOARD_ABILITY,
} from './data/towers';
export { ENEMIES, ENEMY_ORDER, PAIR_GAP } from './data/enemies';
export { BALANCE, hpScaleForWave, rewardForWave, type BalanceConfig } from './data/balance';
export { MAPS, FREE_MAPS, FREE_MAP_COUNT, THEMES, mapById } from './data/maps';
export { CAMPAIGNS, LEVELS, levelById, campaignById, levelsOfCampaign, nextLevel } from './data/campaigns';
export {
  SKILLS, SKILL_BRANCHES, skillById, emptyModifiers, modifiersFor, validateLoadout, loadoutPoints, normalizeLoadout, sameLoadout,
} from './data/skills';
export {
  XP, MAX_ACCOUNT_LEVEL, xpForRun, xpForLevel, levelForXp, skillPointsForLevel, ACHIEVEMENTS, achievementsFor, achievementProgress, addRunToStats, emptyStats,
  type AchievementDef, type AchievementProgress, type AchievementStats, type RunRecord,
} from './data/progression';
export { createRng, mixSeed, type Rng } from './rng';
export { Game, type GameOptions } from './game';
export { parseReplay, runReplay, type ParseOptions, type ReplayCheck } from './replay';
