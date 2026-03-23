import type { SafeHouse } from '../db/schema';
import type { DivisionId } from '../data/agentTypes';
import { AGENT_TYPES } from '../data/agentTypes';
import type { Agent } from '../db/schema';
import { SAFE_HOUSE_UPKEEP_PER_HOUR } from '../data/costs';
import type { AgentRank } from '../data/agentTypes';

/** Salary multiplier per rank — senior agents cost more to maintain. */
const RANK_SALARY_MULT: Record<AgentRank, number> = {
  recruit: 1.0,
  operative: 1.5,
  specialist: 2.2,
  veteran: 3.0,
};

// ─────────────────────────────────────────────
// Income per division level per 30-second tick
// ─────────────────────────────────────────────

interface DivisionIncome {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
}

const DIVISION_INCOME: Record<DivisionId, DivisionIncome> = {
  surveillance: { money: 1.5, intel: 2, shadow: 0, influence: 0 },
  cyber: { money: 2.0, intel: 1.5, shadow: 0, influence: 0 },
  extraction: { money: 1.5, intel: 0.5, shadow: 0.5, influence: 0 },
  sabotage: { money: 1.5, intel: 0, shadow: 1, influence: 0 },
  influence: { money: 1.0, intel: 0.5, shadow: 0, influence: 1.5 },
  finance: { money: 3.0, intel: 0, shadow: 0.5, influence: 0 },
  logistics: { money: 1.5, intel: 0.5, shadow: 0, influence: 0.5 },
  medical: { money: 1.0, intel: 0.5, shadow: 0, influence: 0 },
  blackops: { money: 1.0, intel: 0, shadow: 1, influence: 0 },
};

/** Division level multiplier. */
const LEVEL_MULT: Record<number, number> = {
  1: 1.0,
  2: 1.6,
  3: 2.5,
};

// ─────────────────────────────────────────────
// Safe house passive tick
// ─────────────────────────────────────────────

export interface IncomeResult {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
}

/**
 * Calculate income per 30-second tick for a single safe house.
 * - Each assigned division contributes base income × level multiplier
 * - Agents in the safe house contribute their salary as a cost
 */
export function calculateSafeHouseIncome(
  safeHouse: SafeHouse,
  divisionLevels: Record<DivisionId, number>,
  agents: Agent[],
): IncomeResult {
  const income: IncomeResult = { money: 0, intel: 0, shadow: 0, influence: 0 };

  // Division income
  for (const divId of safeHouse.assignedDivisions) {
    const base = DIVISION_INCOME[divId];
    const level = divisionLevels[divId] ?? 1;
    const mult = LEVEL_MULT[Math.min(level, 3)] ?? 1;

    income.money += base.money * mult;
    income.intel += base.intel * mult;
    income.shadow += base.shadow * mult;
    income.influence += base.influence * mult;
  }

  // Module bonuses
  if (safeHouse.modules.includes('server_room')) income.intel += 3;
  if (safeHouse.modules.includes('lab')) income.intel += 2;

  // Agent salary cost
  const agentsHere = agents.filter((a) => a.safeHouseId === safeHouse.id);
  for (const agent of agentsHere) {
    const agentType = AGENT_TYPES.find((t) => t.id === agent.typeId);
    const baseSalary = agentType?.salary ?? 2;
    const rankMult = RANK_SALARY_MULT[agent.rank] ?? 1;
    income.money -= baseSalary * rankMult;
  }

  // Safe house upkeep (fixed hourly cost, divided across 120 ticks/hour)
  const upkeepPerHour = SAFE_HOUSE_UPKEEP_PER_HOUR[safeHouse.level] ?? 40;
  income.money -= upkeepPerHour / 120;

  return income;
}

/**
 * Calculate total passive income per tick across all safe houses.
 * Each additional safe house adds a small bonus multiplier to every
 * safe house's income (more territory = richer operations).
 */
export function calculatePassiveIncome(
  safeHouses: SafeHouse[],
  divisionLevels: Record<DivisionId, number>,
  agents: Agent[],
): IncomeResult {
  const total: IncomeResult = { money: 0, intel: 0, shadow: 0, influence: 0 };

  // +10% income per additional owned city beyond the first
  const activeSafeHouses = safeHouses.filter(
    (sh) => !sh.constructionInProgress,
  );
  const cityBonus = 1 + 0.1 * Math.max(0, activeSafeHouses.length - 1);

  for (const sh of activeSafeHouses) {
    const shIncome = calculateSafeHouseIncome(sh, divisionLevels, agents);
    total.money += shIncome.money * cityBonus;
    total.intel += shIncome.intel * cityBonus;
    total.shadow += shIncome.shadow * cityBonus;
    total.influence += shIncome.influence * cityBonus;
  }

  // Floor to integers
  total.money = Math.floor(total.money);
  total.intel = Math.floor(total.intel);
  total.shadow = Math.floor(total.shadow);
  total.influence = Math.floor(total.influence);

  return total;
}

// ─────────────────────────────────────────────
// Alert level decay (per tick, per region)
// ─────────────────────────────────────────────

/**
 * Naturally reduce alert level each tick.
 * Owned regions with surveillance division decay faster.
 */
export function decayAlertLevel(
  currentAlert: number,
  hasSurveillanceDivision: boolean,
): number {
  if (currentAlert <= 0) return 0;
  const decayRate = hasSurveillanceDivision ? 0.05 : 0.02;
  return Math.max(0, currentAlert - decayRate);
}
