import type {
  Agent,
  Mission,
  ActiveMission,
  MissionRewards,
  MissionResult,
} from '../db/schema';
import type { MissionCategory } from '../data/missionTemplates';
import type { DivisionId } from '../data/agentTypes';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';
import { COMPLICATIONS } from '../data/missionTemplates';
import { teamAvgStats } from './agentGenerator';
import { clamp, createRng } from '../utils/rng';
import { randomId } from '../utils/rng';

// ─────────────────────────────────────────────
// Approach modifiers
// ─────────────────────────────────────────────

export type MissionApproach = 'standard' | 'aggressive' | 'covert';

export const APPROACH_MODS: Record<MissionApproach, { successMult: number; durationMult: number; alertMult: number }> = {
  standard:   { successMult: 1.00, durationMult: 1.00, alertMult: 1.00 },
  aggressive: { successMult: 1.15, durationMult: 0.75, alertMult: 1.50 },
  covert:     { successMult: 0.90, durationMult: 1.30, alertMult: 0.50 },
};

// ─────────────────────────────────────────────
// Eligibility checks
// ─────────────────────────────────────────────

type StatKey = 'stealth' | 'combat' | 'intel' | 'tech';

export interface AgentEligibility {
  eligible: boolean;
  missingDivision: boolean;
  missingStats: Array<{ stat: StatKey; required: number; actual: number }>;
}

/** Check whether a single agent meets the hard prerequisites of a mission. */
export function checkAgentEligibility(
  agent: Agent,
  mission: Mission,
): AgentEligibility {
  let missingDivision = false;
  const missingStats: Array<{
    stat: StatKey;
    required: number;
    actual: number;
  }> = [];

  // Difficulty-1 missions are open to any agent regardless of division
  if (
    mission.difficulty > 1 &&
    mission.requiredDivisions &&
    mission.requiredDivisions.length > 0
  ) {
    if (!mission.requiredDivisions.includes(agent.division as DivisionId)) {
      missingDivision = true;
    }
  }

  if (mission.minStats) {
    for (const [stat, minVal] of Object.entries(mission.minStats)) {
      const agentVal = agent.stats[stat as StatKey] ?? 0;
      if (agentVal < (minVal ?? 0)) {
        missingStats.push({
          stat: stat as StatKey,
          required: minVal ?? 0,
          actual: agentVal,
        });
      }
    }
  }

  return {
    eligible: !missingDivision && missingStats.length === 0,
    missingDivision,
    missingStats,
  };
}

/**
 * Returns true if the team as a whole meets prerequisites —
 * at least one agent must be fully eligible (right division + meets minStats).
 * If the mission has no requirements, any team passes.
 */
export function checkTeamEligibility(
  agents: Agent[],
  mission: Mission,
): boolean {
  if (!mission.requiredDivisions?.length && !mission.minStats) return true;
  return agents.some((a) => checkAgentEligibility(a, mission).eligible);
}

// ─────────────────────────────────────────────
// Stat weights per category
// ─────────────────────────────────────────────

const CATEGORY_STAT_WEIGHTS: Record<
  MissionCategory,
  Record<StatKey, number>
> = {
  surveillance: { stealth: 0.4, combat: 0.1, intel: 0.35, tech: 0.15 },
  cyber: { stealth: 0.2, combat: 0.05, intel: 0.3, tech: 0.45 },
  extraction: { stealth: 0.25, combat: 0.4, intel: 0.15, tech: 0.2 },
  sabotage: { stealth: 0.2, combat: 0.35, intel: 0.1, tech: 0.35 },
  influence: { stealth: 0.25, combat: 0.05, intel: 0.55, tech: 0.15 },
  finance: { stealth: 0.2, combat: 0.05, intel: 0.35, tech: 0.4 },
  logistics: { stealth: 0.3, combat: 0.2, intel: 0.25, tech: 0.25 },
  blackops: { stealth: 0.3, combat: 0.45, intel: 0.15, tech: 0.1 },
};

// ─────────────────────────────────────────────
// Success chance calculation
// ─────────────────────────────────────────────

/**
 * Calculate mission success probability [0.05, 1.0].
 *
 * Formula:
 *   leaderScore = best individual weighted-stat score among assigned agents (0–99)
 *   statBonus   = (leaderScore - 50) / 100 * 0.4   → recruit is neutral, veteran gives ~+0.14
 *   teamBonus   = 3 pp per additional agent beyond the first, capped at 12 pp
 *   equipBonus  = successBonus of the leader's equipped items only (3 slots max)
 *   Adding any agent never reduces the overall chance.
 */
export function calculateSuccessChance(
  agents: Agent[],
  mission: Mission,
  alertLevel = 0,
  approach: MissionApproach = 'standard',
): number {
  if (agents.length === 0) return 0.05;

  const weights =
    CATEGORY_STAT_WEIGHTS[mission.category as MissionCategory] ??
    CATEGORY_STAT_WEIGHTS.surveillance;

  // Score each agent individually; best one leads the mission
  let leaderIdx = 0;
  let leaderScore = -Infinity;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const score =
      a.stats.stealth * weights.stealth +
      a.stats.combat * weights.combat +
      a.stats.intel * weights.intel +
      a.stats.tech * weights.tech;
    if (score > leaderScore) {
      leaderScore = score;
      leaderIdx = i;
    }
  }

  const statBonus = ((leaderScore - 50) / 100) * 0.4;

  // Team bonus scales by fill ratio AND difficulty.
  // Full team on diff 1 = +4 pp, diff 5 = +12 pp (linearly).
  const MAX_TEAM_BONUS_BY_DIFF: Record<number, number> = { 1: 0.06, 2: 0.07, 3: 0.08, 4: 0.10, 5: 0.12 };
  const maxTeamBonus = MAX_TEAM_BONUS_BY_DIFF[mission.difficulty] ?? 0.08;
  const maxAgents = mission.maxAgents ?? agents.length;
  const fillRatio =
    maxAgents > 1 ? (agents.length - 1) / (maxAgents - 1) : 0;
  const teamBonus = fillRatio * maxTeamBonus;

  // Equipment success bonuses — only the leader's 3 slots count
  let equipBonus = 0;
  const leaderEquipIds = agents[leaderIdx].equipment
    .map((s) => s.equipmentId)
    .filter((id): id is string => id !== null);
  for (const eqId of leaderEquipIds) {
    const eq = EQUIPMENT_CATALOG.find((e) => e.id === eqId);
    if (eq?.successBonus) equipBonus += eq.successBonus / 100;
  }

  // Complication penalty
  let compPenalty = 0;
  if (mission.complicationId) {
    const comp = COMPLICATIONS.find((c) => c.id === mission.complicationId);
    if (comp) compPenalty = comp.difficultyMod * 0.06; // 6 pp per difficulty mod
  }

  // Alert level penalty: up to -20 pp at max alert (3.0)
  const alertPenalty = (alertLevel / 3) * 0.2;

  const raw =
    mission.baseSuccessChance +
    statBonus +
    teamBonus +
    equipBonus -
    compPenalty -
    alertPenalty;
  return clamp(raw * APPROACH_MODS[approach].successMult, 0.05, 1.0);
}

// ─────────────────────────────────────────────
// Duration calculation
// ─────────────────────────────────────────────

/**
 * Actual mission duration in seconds.
 * Faster agents (high avg stat for category) reduce duration.
 * Equipment durationMult stacks multiplicatively.
 */
export function calculateDuration(
  mission: Mission,
  agents: Agent[],
  equippedIds: string[] = [],
  approach: MissionApproach = 'standard',
): number {
  if (agents.length === 0) return mission.baseDuration;

  const avg = teamAvgStats(agents);
  const weights =
    CATEGORY_STAT_WEIGHTS[mission.category as MissionCategory] ??
    CATEGORY_STAT_WEIGHTS.surveillance;

  const agentScore =
    avg.stealth * weights.stealth +
    avg.combat * weights.combat +
    avg.intel * weights.intel +
    avg.tech * weights.tech;

  // Up to -30% for very skilled team (100 score vs 50 neutral)
  const speedFactor = 1 - ((agentScore - 50) / 100) * 0.3;

  // Equipment duration multipliers
  let equipMult = 1;
  for (const eqId of equippedIds) {
    const eq = EQUIPMENT_CATALOG.find((e) => e.id === eqId);
    if (eq?.durationMult) equipMult *= eq.durationMult;
  }

  const duration = Math.round(mission.baseDuration * speedFactor * equipMult * APPROACH_MODS[approach].durationMult);
  return Math.max(30, duration); // minimum 30 seconds
}

// ─────────────────────────────────────────────
// Dispatch active mission
// ─────────────────────────────────────────────

export function dispatchMission(
  mission: Mission,
  agents: Agent[],
  equippedIds: string[] = [],
  alertLevel = 0,
  approach: MissionApproach = 'standard',
): ActiveMission {
  const successChance = calculateSuccessChance(agents, mission, alertLevel, approach);
  const duration = calculateDuration(mission, agents, equippedIds, approach);

  return {
    id: randomId(),
    missionId: mission.id,
    agentIds: agents.map((a) => a.id),
    equipmentIds: equippedIds,
    startedAt: Date.now(),
    completesAt: Date.now() + duration * 1000,
    successChance,
    approach,
    collected: false,
  };
}

// ─────────────────────────────────────────────
// Mission resolution
// ─────────────────────────────────────────────

/**
 * Resolve a completed mission.
 * Returns the result type and the effective rewards/penalties.
 */
export function resolveMission(
  activeMission: ActiveMission,
  mission: Mission,
): { result: MissionResult; rewards: MissionRewards; alertGain: number } {
  const rng = createRng();
  const roll = rng();
  const sc = activeMission.successChance;
  const approach: MissionApproach = activeMission.approach ?? 'standard';
  const alertMult = APPROACH_MODS[approach].alertMult;

  let result: MissionResult;
  let rewards: MissionRewards;
  let alertGain: number;

  if (roll < sc * 0.15) {
    // Critical success (top 15% of success window) — bonus rewards
    result = 'success';
    rewards = scaleRewards(mission.rewards, 1.3);
    alertGain = mission.alertGain * 0.2 * alertMult; // very discreet
  } else if (roll < sc) {
    // Normal success
    result = 'success';
    rewards = { ...mission.rewards };
    alertGain = mission.alertGain * 0.5 * alertMult;
  } else if (roll < sc + (1 - sc) * 0.4) {
    // Partial failure (40% of failure window) — partial rewards
    result = 'partial';
    rewards = scaleRewards(mission.rewards, 0.4);
    alertGain = mission.alertGain * 1.0 * alertMult;
  } else {
    // Catastrophe chance scales with difficulty: 0% on diff 1, up to 16% on diff 5
    // This prevents agent capture on easy missions (death-spiral protection)
    const catastropheShare = (mission.difficulty - 1) * 0.04;
    if (
      catastropheShare > 0 &&
      roll >= sc + (1 - sc) * (1 - catastropheShare)
    ) {
      result = 'catastrophe';
      rewards = scaleRewards(mission.failurePenalty, 1.5);
      alertGain = mission.alertGain * 2.0 * alertMult;
    } else {
      // Full failure
      result = 'failure';
      rewards = mission.failurePenalty;
      alertGain = mission.alertGain * 1.5 * alertMult;
    }
  }

  // Difficulty ≥ 2 success earns +1 shadow (harder missions leave a footprint)
  if (result === 'success' && mission.difficulty >= 2) {
    rewards = { ...rewards!, shadow: (rewards!.shadow ?? 0) + 1 };
  }

  return { result, rewards, alertGain };
}

function scaleRewards(base: MissionRewards, mult: number): MissionRewards {
  return {
    money: Math.round(base.money * mult),
    intel: Math.round(base.intel * mult),
    shadow: Math.round(base.shadow * mult),
    influence: Math.round(base.influence * mult),
    xp: Math.round(base.xp * mult),
  };
}

// ─────────────────────────────────────────────
// XP distribution after mission
// ─────────────────────────────────────────────

/**
 * How much XP each agent receives.
 * Agents who participated in failed missions still get partial XP.
 */
export function distributeXp(
  result: MissionResult,
  baseXp: number,
  agentCount: number,
): number {
  const resultMult: Record<MissionResult, number> = {
    success: 1.0,
    partial: 0.5,
    failure: 0.25,
    catastrophe: 0.1,
  };
  // XP per agent (split evenly, slightly diminished for large teams)
  const teamSplit = Math.max(0.4, 1 - (agentCount - 1) * 0.1);
  return Math.round(baseXp * resultMult[result] * teamSplit);
}

// ─────────────────────────────────────────────
// Injury determination
// ─────────────────────────────────────────────

export type InjurySeverity = 'none' | 'light' | 'serious' | 'critical';

/**
 * Determine if an agent was injured during a mission.
 * Returns severity based on result and mission difficulty.
 */
export function rollInjury(
  result: MissionResult,
  difficulty: number,
): InjurySeverity {
  const rng = createRng();
  const roll = rng();

  const baseChance: Record<MissionResult, number> = {
    success: 0.03,
    partial: 0.15,
    failure: 0.3,
    catastrophe: 0.8,
  };

  const chance = baseChance[result] + (difficulty - 1) * 0.02;

  if (roll > chance) return 'none';

  // Severity shifts toward serious/critical at higher difficulty.
  // lightMult = lower bound of light zone as fraction of chance:
  //   diff 1: light 50% / serious 30% / critical 20%
  //   diff 3: light 38% / serious 34% / critical 28%
  //   diff 5: light 26% / serious 38% / critical 36%
  const lightMult = 0.5 + (difficulty - 1) * 0.06;   // 0.50 → 0.74
  const seriousMult = 0.2 + (difficulty - 1) * 0.04; // 0.20 → 0.36

  if (roll > chance * lightMult) return 'light';
  if (roll > chance * seriousMult) return 'serious';
  return 'critical';
}

/** Healing duration in seconds for a given severity. */
export function healingDuration(severity: InjurySeverity): number {
  switch (severity) {
    case 'none':
      return 0;
    case 'light':
      return 60; // 1 min
    case 'serious':
      return 5 * 60; // 5 min
    case 'critical':
      return 20 * 60; // 20 min
  }
}
