// All in-game costs for upgrades, expansions, and purchases

export const SAFE_HOUSE_UPGRADE_COSTS: Record<
  number,
  { money: number; intel: number }
> = {
  2: { money: 2000, intel: 20 },
  3: { money: 6000, intel: 50 },
  4: { money: 16000, intel: 100 },
  5: { money: 40000, intel: 200 },
};

/** Fixed hourly upkeep per safe house level (deducted each 30s tick = value / 120). */
export const SAFE_HOUSE_UPKEEP_PER_HOUR: Record<number, number> = {
  1: 40,
  2: 90,
  3: 180,
  4: 300,
  5: 450,
};

export const SAFE_HOUSE_UPGRADE_DURATION: Record<number, number> = {
  // seconds to complete upgrade
  2: 120,
  3: 300,
  4: 600,
  5: 1200,
};

// Max agents per safe house level
export const SAFE_HOUSE_CAPACITY: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
  4: 12,
  5: 18,
};

// Max divisions assignable per safe house level
export const SAFE_HOUSE_DIVISION_SLOTS: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 6,
  5: 9,
};

// Division unlock costs (pay once to unlock for all safe houses)
export const DIVISION_UNLOCK_COSTS: Record<
  string,
  { money: number; intel: number; shadow: number }
> = {
  surveillance: { money: 0, intel: 0, shadow: 0 }, // starter
  cyber: { money: 0, intel: 0, shadow: 0 }, // starter
  extraction: { money: 1200, intel: 15, shadow: 0 },
  sabotage: { money: 1500, intel: 20, shadow: 10 },
  influence: { money: 2000, intel: 25, shadow: 0 },
  finance: { money: 2000, intel: 25, shadow: 0 },
  logistics: { money: 1200, intel: 15, shadow: 0 },
  medical: { money: 1500, intel: 20, shadow: 0 },
  blackops: { money: 5000, intel: 60, shadow: 60 },
};

// Division level upgrade costs (per level 1→2, 2→3)
// High cost is intentional — upgrades are global and apply to every safe house.
export const DIVISION_LEVEL_COSTS: Record<
  number,
  { money: number; intel: number; influence?: number }
> = {
  2: { money: 4000, intel: 60 },
  3: { money: 12000, intel: 150, influence: 20 },
};

// Cost to assign an additional division to a safe house (multiplied by safehouse index)
export const DIVISION_ASSIGN_BASE_COST = 200;

// Expansion costs (expanding to a new city)
export const EXPANSION_BASE_COST = { money: 1000, intel: 15 };
export const EXPANSION_COST_PER_DISTANCE = { money: 200, intel: 6 };
/** Each previously completed expansion adds this fraction to the total cost.
 *  e.g. 0.4 means 3rd expansion costs 80% more than the 1st. */
export const EXPANSION_COST_SCALE = 0.4;
export const EXPANSION_BUILD_TIME_BASE = 60; // seconds
export const EXPANSION_BUILD_TIME_PER_DISTANCE = 30; // seconds per distance unit

// Recruitment refresh cost (manual refresh of recruitment pool)
export const RECRUITMENT_REFRESH_COST = { money: 100 };
