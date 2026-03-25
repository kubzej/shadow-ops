import type { SafeHouse } from '../db/schema';
import type { DivisionId } from '../data/agentTypes';
import { AGENT_TYPES } from '../data/agentTypes';
import type { Agent } from '../db/schema';
import { SAFE_HOUSE_UPKEEP_PER_HOUR } from '../data/costs';
import type { AgentRank } from '../data/agentTypes';
import { REGION_MAP } from '../data/regions';
import type { CityType } from '../data/regions';

// ─────────────────────────────────────────────
// Region type income bonuses (applied once per safe house per tick)
// ─────────────────────────────────────────────

/**
 * Additive income bonus per region type per 30-second tick.
 * Both primaryType and secondaryType contribute (additive).
 */
export const REGION_TYPE_INCOME_BONUS: Record<
  CityType,
  { money: number; intel: number; shadow: number; influence: number }
> = {
  capital:    { money: 2.0, intel: 0,   shadow: 0,   influence: 0.5 },
  financial:  { money: 3.0, intel: 0,   shadow: 0,   influence: 0   },
  tech:       { money: 0,   intel: 2.0, shadow: 0,   influence: 0   },
  port:       { money: 1.5, intel: 0,   shadow: 0.5, influence: 0   },
  border:     { money: 0,   intel: 1.0, shadow: 1.0, influence: 0   },
  military:   { money: 0,   intel: 0,   shadow: 1.5, influence: 0   },
};

/**
 * Returns the combined additive income bonus for a region based on
 * its primaryType and optional secondaryType.
 */
export function getRegionTypeBonus(safeHouseId: string): {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
} {
  const region = REGION_MAP.get(safeHouseId);
  if (!region) return { money: 0, intel: 0, shadow: 0, influence: 0 };

  const primary = REGION_TYPE_INCOME_BONUS[region.type];
  const secondary = region.secondaryType
    ? REGION_TYPE_INCOME_BONUS[region.secondaryType]
    : null;

  return {
    money: primary.money + (secondary?.money ?? 0),
    intel: primary.intel + (secondary?.intel ?? 0),
    shadow: primary.shadow + (secondary?.shadow ?? 0),
    influence: primary.influence + (secondary?.influence ?? 0),
  };
}

/** Income bonus per tick from each module (modules without income effect are omitted). */
export const MODULE_INCOME_EFFECTS: Partial<
  Record<
    string,
    { money: number; intel: number; shadow: number; influence: number }
  >
> = {
  server_room: { money: 0, intel: 3, shadow: 0, influence: 0 },
  lab: { money: 0, intel: 2, shadow: 0, influence: 0 },
  armory: { money: 0, intel: 0, shadow: 0.1, influence: 0 },
  finance_hub: { money: 4, intel: 0, shadow: 0, influence: 0 },
  forgery_lab: { money: 0, intel: 0, shadow: 0, influence: 0.3 },
};

/** Salary multiplier per rank — senior agents cost more to maintain, but not overwhelmingly so. */
const RANK_SALARY_MULT: Record<AgentRank, number> = {
  recruit: 1.0,
  operative: 1.3,
  specialist: 1.7,
  veteran: 2.2,
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

/** Division level multiplier — kept modest to avoid multiplicative explosion with many houses + slots. */
const LEVEL_MULT: Record<number, number> = {
  1: 1.0,
  2: 1.4,
  3: 2.0,
};

/**
 * Diminishing returns per additional division in the same safe house.
 * 1st div = 100%, 2nd = 80%, 3rd = 65%, 4th+ = 50%.
 */
function divisionSlotMult(index: number): number {
  if (index === 0) return 1.0;
  if (index === 1) return 0.8;
  if (index === 2) return 0.65;
  return 0.5;
}

// ─────────────────────────────────────────────
// Safe house passive tick
// ─────────────────────────────────────────────

export interface IncomeResult {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
}

// ─────────────────────────────────────────────
// Detailed income breakdown (for UI display)
// ─────────────────────────────────────────────

export interface IncomeLineItem {
  label: string;
  money: number;
  intel: number;
  shadow: number;
  influence: number;
}

export interface IncomeBreakdown {
  /** Per-division income lines */
  divisions: IncomeLineItem[];
  /** Per-module bonus lines */
  modules: IncomeLineItem[];
  /** Per-agent salary lines */
  salaries: IncomeLineItem[];
  /** Fixed upkeep */
  upkeep: IncomeLineItem;
  /** Region type bonus (primary + secondary type combined) */
  regionTypeBonus?: IncomeLineItem;
}

/**
 * Returns a full itemised breakdown of all income and expense components
 * for a single safe house per 30-second tick.
 */
export function calculateSafeHouseBreakdown(
  safeHouse: SafeHouse,
  divisionLevels: Record<DivisionId, number>,
  agents: Agent[],
): IncomeBreakdown {
  const DIVISION_NAMES: Record<DivisionId, string> = {
    surveillance: 'Sledování',
    cyber: 'Kyber',
    extraction: 'Extrakce',
    sabotage: 'Sabotáž',
    influence: 'Vliv',
    finance: 'Finance',
    logistics: 'Logistika',
    medical: 'Medical',
    blackops: 'Black Ops',
  };

  const MODULE_NAMES: Record<string, string> = {
    server_room: 'Server Room',
    lab: 'Lab',
    armory: 'Zbrojnice',
    finance_hub: 'Finance Hub',
    forgery_lab: 'Padělatelna',
    signal_jammer: 'Signal Jammer',
    med_bay: 'Med Bay',
    training_center: 'Výcvikové centrum',
    black_site: 'Black Site',
  };

  const divisions: IncomeLineItem[] = [];
  safeHouse.assignedDivisions.forEach((divId, slotIndex) => {
    const base = DIVISION_INCOME[divId];
    const level = divisionLevels[divId] ?? 1;
    const mult = LEVEL_MULT[Math.min(level, 3)] ?? 1;
    const slotMult = divisionSlotMult(slotIndex);
    const lv = `Lv${level}`;
    const suffix = slotIndex > 0 ? ` (×${slotMult})` : '';
    divisions.push({
      label: `${DIVISION_NAMES[divId] ?? divId} ${lv}${suffix}`,
      money: base.money * mult * slotMult,
      intel: base.intel * mult * slotMult,
      shadow: base.shadow * mult * slotMult,
      influence: base.influence * mult * slotMult,
    });
  });

  const modules: IncomeLineItem[] = [];
  for (const modId of safeHouse.modules) {
    const effect = MODULE_INCOME_EFFECTS[modId];
    if (!effect) continue;
    const hasEffect =
      effect.money !== 0 ||
      effect.intel !== 0 ||
      effect.shadow !== 0 ||
      effect.influence !== 0;
    if (hasEffect) {
      modules.push({ label: MODULE_NAMES[modId] ?? modId, ...effect });
    }
  }

  const agentsHere = agents.filter((a) => a.safeHouseId === safeHouse.id);
  const salaries: IncomeLineItem[] = agentsHere.map((agent) => {
    const agentType = AGENT_TYPES.find((t) => t.id === agent.typeId);
    const baseSalary = agentType?.salary ?? 2;
    const rankMult = RANK_SALARY_MULT[agent.rank] ?? 1;
    return {
      label: agent.name,
      money: -(baseSalary * rankMult),
      intel: 0,
      shadow: 0,
      influence: 0,
    };
  });

  const upkeepPerHour = SAFE_HOUSE_UPKEEP_PER_HOUR[safeHouse.level] ?? 40;
  const upkeep: IncomeLineItem = {
    label: `Upkeep Lv${safeHouse.level}`,
    money: -(upkeepPerHour / 120),
    intel: 0,
    shadow: 0,
    influence: 0,
  };

  const region = REGION_MAP.get(safeHouse.id);
  let regionTypeBonus: IncomeLineItem | undefined;
  if (region) {
    const bonus = getRegionTypeBonus(safeHouse.id);
    const hasBonus =
      bonus.money !== 0 ||
      bonus.intel !== 0 ||
      bonus.shadow !== 0 ||
      bonus.influence !== 0;
    if (hasBonus) {
      const typeLabel = region.secondaryType
        ? `${region.type} + ${region.secondaryType}`
        : region.type;
      regionTypeBonus = { label: typeLabel, ...bonus };
    }
  }

  return { divisions, modules, salaries, upkeep, regionTypeBonus };
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

  // Division income — with diminishing returns per additional slot
  safeHouse.assignedDivisions.forEach((divId, slotIndex) => {
    const base = DIVISION_INCOME[divId];
    const level = divisionLevels[divId] ?? 1;
    const mult = LEVEL_MULT[Math.min(level, 3)] ?? 1;
    const slotMult = divisionSlotMult(slotIndex);

    income.money += base.money * mult * slotMult;
    income.intel += base.intel * mult * slotMult;
    income.shadow += base.shadow * mult * slotMult;
    income.influence += base.influence * mult * slotMult;
  });

  // Module bonuses
  const now = Date.now();
  const disabledModuleIds = new Set(
    (safeHouse.disabledModules ?? [])
      .filter((m) => m.until > now)
      .map((m) => m.moduleId),
  );
  for (const modId of safeHouse.modules) {
    if (disabledModuleIds.has(modId)) continue;
    const effect = MODULE_INCOME_EFFECTS[modId];
    if (!effect) continue;
    income.money += effect.money;
    income.intel += effect.intel;
    income.shadow += effect.shadow;
    income.influence += effect.influence;
  }

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

  // Region type bonus — additive flat bonus from primaryType + secondaryType
  const typeBonus = getRegionTypeBonus(safeHouse.id);
  income.money += typeBonus.money;
  income.intel += typeBonus.intel;
  income.shadow += typeBonus.shadow;
  income.influence += typeBonus.influence;

  return income;
}

/** Returns the network bonus multiplier based on active safe house count.
 * 1 SH → ×1.0 | 3 SH → ×1.2 | 6+ SH → ×1.5 (cap)
 */
export function getCityBonus(activeSafeHouseCount: number): number {
  return Math.min(1.5, 1 + 0.1 * Math.max(0, activeSafeHouseCount - 1));
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

  // +10% income per additional owned city beyond the first, capped at +50%
  const activeSafeHouses = safeHouses.filter(
    (sh) => !sh.constructionInProgress,
  );
  const cityBonus = getCityBonus(activeSafeHouses.length);

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
 * signal_jammer module adds an additional +0.1 to the decay rate.
 */
export function decayAlertLevel(
  currentAlert: number,
  hasSurveillanceDivision: boolean,
  hasSignalJammer = false,
): number {
  if (currentAlert <= 0) return 0;
  const decayRate =
    (hasSurveillanceDivision ? 0.2 : 0.08) + (hasSignalJammer ? 0.1 : 0);
  return Math.max(0, currentAlert - decayRate);
}
