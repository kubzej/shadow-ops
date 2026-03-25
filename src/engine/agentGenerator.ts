import {
  AGENT_TYPES,
  DIVISIONS,
  type DivisionId,
  type AgentRank,
} from '../data/agentTypes';
import { FIRST_NAMES, LAST_NAMES, AGENT_NICKNAMES } from '../data/names';
import {
  mulberry32,
  createRng,
  pickRandom,
  randInt,
  clamp,
} from '../utils/rng';
import type { Agent, AgentStats } from '../db/schema';
import { randomId } from '../utils/rng';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';

export const RANK_ORDER: AgentRank[] = [
  'recruit',
  'operative',
  'specialist',
  'veteran',
  'director',
];

/** XP required to rank up from each rank.
 *  With ~50-130 XP/mission: recruit→op ~8 missions, op→spec ~20, spec→vet ~30
 */
export const XP_TO_RANK: Record<AgentRank, number> = {
  recruit: 400,
  operative: 1000,
  specialist: 2000,
  veteran: 4000,
  director: Infinity, // max rank
};

/** Healing time in seconds per injury severity level. */
export const HEALING_TIME_BASE = 120; // 2 minutes for minor injury
export const HEALING_TIME_PER_MISSION = 30; // +30s per completed mission (wear)

// ─────────────────────────────────────────────
// Name generation
// ─────────────────────────────────────────────

/** Hash an agent ID string to a stable 32-bit integer for seeding. */
function hashAgentId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Generate a deterministic nickname from agent ID — always "the X". */
export function generateNickname(agentId: string): string {
  const rng = mulberry32(hashAgentId(agentId));
  const word = pickRandom(AGENT_NICKNAMES, rng);
  return `the ${word}`;
}

export function generateAgentName(): string {
  const rng = createRng();
  const first = pickRandom(FIRST_NAMES, rng);
  const last = pickRandom(LAST_NAMES, rng);
  return `${first} ${last}`;
}

// ─────────────────────────────────────────────
// Stat generation
// ─────────────────────────────────────────────

export function generateAgentStats(
  agentTypeId: string,
  rank: AgentRank,
): AgentStats {
  const agentType = AGENT_TYPES.find((t) => t.id === agentTypeId);
  if (!agentType) throw new Error(`Unknown agent type: ${agentTypeId}`);

  const rng = createRng();
  const mult = agentType.rankMultiplier[rank];

  const rollStat = ([base, variance]: [number, number]) =>
    clamp(Math.round((base + randInt(-variance, variance, rng)) * mult), 1, 99);

  return {
    stealth: rollStat(agentType.baseStats.stealth),
    combat: rollStat(agentType.baseStats.combat),
    intel: rollStat(agentType.baseStats.intel),
    tech: rollStat(agentType.baseStats.tech),
  };
}

// ─────────────────────────────────────────────
// Full agent creation (for new recruit)
// ─────────────────────────────────────────────

export function createAgent(
  agentTypeId: string,
  rank: AgentRank,
  safeHouseId: string,
): Agent {
  const agentType = AGENT_TYPES.find((t) => t.id === agentTypeId);
  if (!agentType) throw new Error(`Unknown agent type: ${agentTypeId}`);

  const stats = generateAgentStats(agentTypeId, rank);

  return {
    id: randomId(),
    name: generateAgentName(),
    typeId: agentTypeId,
    division: agentType.division,
    rank,
    stats,
    baseStats: { ...stats },
    xp: 0,
    xpToNextRank: XP_TO_RANK[rank],
    status: 'available',
    safeHouseId,
    equipment: [
      { equipmentId: null },
      { equipmentId: null },
      { equipmentId: null },
    ],
    missionsCompleted: 0,
    missionsAttempted: 0,
    missionStreak: 0,
    recruitedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────
// Recruitment offer generation
// ─────────────────────────────────────────────

/**
 * Generate a recruitment offer for a given division and safe house level.
 * Higher safe house level = better rank + stats available.
 */
export function generateRecruitmentOffer(
  division: DivisionId,
  safeHouseLevel: number,
): ReturnType<typeof _buildOffer> {
  const rng = createRng();

  // Filter agent types by division
  const types = AGENT_TYPES.filter((t) => t.division === division);
  if (types.length === 0)
    throw new Error(`No agent types for division: ${division}`);

  const agentType = pickRandom(types, rng);

  // Rank availability by SH level
  const rankPool: AgentRank[] = ['recruit'];
  if (safeHouseLevel >= 2) rankPool.push('operative');
  if (safeHouseLevel >= 3) rankPool.push('operative', 'specialist');
  if (safeHouseLevel >= 4) rankPool.push('specialist', 'veteran');
  if (safeHouseLevel >= 5) rankPool.push('veteran');

  const rank = pickRandom(rankPool, rng);
  return _buildOffer(agentType.id, rank);
}

/**
 * Generate N offers for a safe house across its active divisions.
 */
export function generateRecruitmentPool(
  safeHouseId: string,
  activeDivisions: DivisionId[],
  safeHouseLevel: number,
  count = 3,
): import('../db/schema').RecruitmentPool {
  const rng = createRng();
  const divisionPool =
    activeDivisions.length > 0
      ? activeDivisions
      : (['surveillance', 'cyber'] as DivisionId[]);

  const offers = Array.from({ length: count }, () => {
    const division = pickRandom(divisionPool, rng);
    return generateRecruitmentOffer(division, safeHouseLevel);
  });

  return {
    id: safeHouseId,
    safeHouseId,
    offers,
    refreshesAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
}

function _buildOffer(
  agentTypeId: string,
  rank: AgentRank,
): import('../db/schema').RecruitmentOffer {
  const agentType = AGENT_TYPES.find((t) => t.id === agentTypeId)!;
  const stats = generateAgentStats(agentTypeId, rank);

  const rankCostMult: Record<AgentRank, number> = {
    recruit: 1,
    operative: 1.6,
    specialist: 2.4,
    veteran: 3.5,
    director: 5.0,
  };

  return {
    id: randomId(),
    agentTypeId,
    name: generateAgentName(),
    rank,
    stats,
    cost: Math.round(agentType.recruitCost * rankCostMult[rank]),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}

// ─────────────────────────────────────────────
// Rank-up helpers
// ─────────────────────────────────────────────

/**
 * Returns true if the agent can rank up.
 * For the Director rank, `currentDirectorCount` must be 0 — only 1 Director globally.
 */
export function canRankUp(agent: Agent, currentDirectorCount = 0): boolean {
  const currentIdx = RANK_ORDER.indexOf(agent.rank);
  if (currentIdx >= RANK_ORDER.length - 1) return false;
  if (agent.xp < agent.xpToNextRank) return false;
  const nextRank = RANK_ORDER[currentIdx + 1];
  if (nextRank === 'director' && currentDirectorCount > 0) return false;
  return true;
}

export function rankUp(agent: Agent, currentDirectorCount = 0): Agent {
  if (!canRankUp(agent, currentDirectorCount)) return agent;

  const currentIdx = RANK_ORDER.indexOf(agent.rank);
  const newRank = RANK_ORDER[currentIdx + 1];
  const newStats = generateAgentStats(agent.typeId, newRank);

  return {
    ...agent,
    rank: newRank,
    xp: 0,
    xpToNextRank: XP_TO_RANK[newRank],
    baseStats: newStats,
    stats: applyEquipmentBonuses(newStats, agent.equipment, newRank),
    nickname:
      newRank === 'veteran' || newRank === 'director'
        ? generateNickname(agent.id)
        : agent.nickname,
  };
}

export function demoteRank(agent: Agent): Agent {
  const currentIdx = RANK_ORDER.indexOf(agent.rank);
  const newRank = currentIdx > 0 ? RANK_ORDER[currentIdx - 1] : 'recruit';
  return {
    ...agent,
    rank: newRank,
    xp: 0,
    xpToNextRank: XP_TO_RANK[newRank],
  };
}

const RANK_NUM: Record<AgentRank, number> = {
  recruit: 0,
  operative: 1,
  specialist: 2,
  veteran: 3,
  director: 4,
};

/** Recalculate effective stats by adding equipment bonuses on top of baseStats.
 *  Items with minRank higher than agentRank are held but inactive. */
export function applyEquipmentBonuses(
  baseStats: AgentStats,
  equipment: Agent['equipment'],
  agentRank: AgentRank = 'recruit',
): AgentStats {
  const result = { ...baseStats };
  for (const slot of equipment) {
    if (!slot.equipmentId) continue;
    const eq = EQUIPMENT_CATALOG.find((e) => e.id === slot.equipmentId);
    if (!eq) continue;
    // Skip bonuses if agent rank is too low — item held but inactive
    if (eq.minRank && RANK_NUM[agentRank] < RANK_NUM[eq.minRank]) continue;
    if (eq.bonusStealth)
      result.stealth = clamp(result.stealth + eq.bonusStealth, 0, 99);
    if (eq.bonusCombat)
      result.combat = clamp(result.combat + eq.bonusCombat, 0, 99);
    if (eq.bonusIntel)
      result.intel = clamp(result.intel + eq.bonusIntel, 0, 99);
    if (eq.bonusTech) result.tech = clamp(result.tech + eq.bonusTech, 0, 99);
  }
  return result;
}

/** Stat average for a team of agents. */
export function teamAvgStats(agents: Agent[]): AgentStats {
  if (agents.length === 0) return { stealth: 0, combat: 0, intel: 0, tech: 0 };
  const sum = agents.reduce(
    (acc, a) => ({
      stealth: acc.stealth + a.stats.stealth,
      combat: acc.combat + a.stats.combat,
      intel: acc.intel + a.stats.intel,
      tech: acc.tech + a.stats.tech,
    }),
    { stealth: 0, combat: 0, intel: 0, tech: 0 },
  );
  const n = agents.length;
  return {
    stealth: Math.round(sum.stealth / n),
    combat: Math.round(sum.combat / n),
    intel: Math.round(sum.intel / n),
    tech: Math.round(sum.tech / n),
  };
}

/** Division info lookup. */
export function getDivisionInfo(id: DivisionId) {
  return DIVISIONS.find((d) => d.id === id)!;
}
