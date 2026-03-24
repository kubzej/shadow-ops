// All in-game costs for upgrades, expansions, and purchases

export const SAFE_HOUSE_UPGRADE_COSTS: Record<
  number,
  { money: number; intel: number }
> = {
  2: { money: 2000, intel: 20 },
  3: { money: 6000, intel: 50 },
  4: { money: 20000, intel: 120 },
  5: { money: 60000, intel: 250 },
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
  blackops: { money: 3000, intel: 40, shadow: 40 },
};

// Division level upgrade costs (per level 1→2, 2→3)
// Global upgrades benefit every safe house — lv3 should be a late-game milestone.
export const DIVISION_LEVEL_COSTS: Record<
  number,
  { money: number; intel: number; influence?: number }
> = {
  2: { money: 4000, intel: 60 },
  3: { money: 25000, intel: 200, influence: 30 },
};

// Cost to assign an additional division to a safe house (multiplied by safehouse index)
export const DIVISION_ASSIGN_BASE_COST = 500;

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

// ─────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────

/** Maximum modules active on any one safe house at a time. */
export const MODULE_MAX_PER_SAFEHOUSE = 2;

export interface ModuleDef {
  id: string;
  /** Display name */
  name: string;
  /** Short description shown in the UI */
  description: string;
  /** One-time purchase cost */
  cost: { money: number; intel?: number; shadow?: number; influence?: number };
}

export const MODULE_CATALOG: ModuleDef[] = [
  {
    id: 'server_room',
    name: 'Server Room',
    description: 'Dedikovaný serverový uzel pro zpracování dat z operací. Pasivně generuje +3 intel za každý 30s tick.',
    cost: { money: 3000, intel: 30 },
  },
  {
    id: 'lab',
    name: 'Výzkumná laboratoř',
    description: 'Analytické pracoviště pro vyhodnocování terénních zpráv. Generuje +2 intel za každý 30s tick.',
    cost: { money: 2000, intel: 20 },
  },
  {
    id: 'armory',
    name: 'Zbrojnice',
    description: 'Zabezpečený sklad zbraní a vybavení s nepřetržitým zásobováním. Generuje +0.1 shadow za každý 30s tick.',
    cost: { money: 6000, shadow: 40 },
  },
  {
    id: 'finance_hub',
    name: 'Finanční centrum',
    description: 'Síť krycích společností a offshore účtů pro praní operačních příjmů. Generuje +4 money za každý 30s tick.',
    cost: { money: 5000, intel: 40 },
  },
  {
    id: 'signal_jammer',
    name: 'Signal Jammer',
    description: 'Rušičky signálu a protisledovací systémy snižují viditelnost aktivit v regionu. Alert level klesá o +0.1 rychleji za každý 30s tick.',
    cost: { money: 3500, intel: 15, shadow: 10 },
  },
  {
    id: 'med_bay',
    name: 'Med Bay',
    description: 'Vybavené lékařské středisko s chirurgickým zázemím. Doba léčení zraněných agentů se zkracuje na polovinu.',
    cost: { money: 3000, intel: 20 },
  },
  {
    id: 'training_center',
    name: 'Výcvikové centrum',
    description: 'Taktický simulátor a instruktorský program pro terénní agenty. Všichni agenti získávají o 25 % více XP z misí prováděných z této základny.',
    cost: { money: 4000, intel: 30 },
  },
  {
    id: 'forgery_lab',
    name: 'Padělatelna',
    description: 'Dílna pro výrobu falešných dokladů, razítek a diplomatických průkazů. Generuje +0.3 influence za každý 30s tick.',
    cost: { money: 4500, intel: 30, influence: 10 },
  },
  {
    id: 'black_site',
    name: 'Black Site',
    description: 'Utajené operační centrum s protokoly pro čisté operace. Snižuje alert gain ze všech misí v tomto regionu o 20 %.',
    cost: { money: 5500, intel: 20, shadow: 15 },
  },
  {
    id: 'saferoom',
    name: 'Saferoom',
    description: 'Bezpečnostní trezorová místnost s únikovým protokolem. Při katastrofálním výsledku mise má agent 30% šanci vyhnout se zajetí — místo toho utrpí serious zranění.',
    cost: { money: 7000, intel: 30, shadow: 25 },
  },
];
