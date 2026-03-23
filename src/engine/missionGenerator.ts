import {
  TARGET_POOLS,
  COMPLICATIONS,
  FLAVOR_TEMPLATES,
  type MissionCategory,
  type MissionTarget,
  type MissionComplication,
} from '../data/missionTemplates';
import { REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import { createRng, pickRandom, pickWeighted, randFloat } from '../utils/rng';
import { randomId } from '../utils/rng';
import type { Mission, MissionRewards } from '../db/schema';
import type { DivisionId } from '../data/agentTypes';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Base mission duration in seconds per difficulty level. */
const BASE_DURATION: Record<number, number> = {
  1: 120,
  2: 240,
  3: 480,
  4: 600,
  5: 720,
};

/** Minimum duration regardless of agent speed bonuses. */
const MIN_DURATION = 60;

/** Minimum missions available per region. */
export const MIN_MISSIONS_PER_REGION = 3;
export const MAX_MISSIONS_PER_REGION = 4;

/** One new mission is added per region every this many ms (timed regen). */
export const MISSION_REGEN_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

/** Default mission expiry: 30 minutes. */
const MISSION_EXPIRY_MS = 30 * 60 * 1000;

/** Categories ordered from low to high danger. */
const CATEGORY_ORDER: MissionCategory[] = [
  'surveillance',
  'logistics',
  'cyber',
  'finance',
  'influence',
  'extraction',
  'sabotage',
  'blackops',
];

/** Primary stat that matters most per category (used for minStats requirements). */
type StatKey = 'stealth' | 'combat' | 'intel' | 'tech';

const CATEGORY_PRIMARY_STAT: Record<MissionCategory, StatKey> = {
  surveillance: 'stealth',
  cyber: 'tech',
  extraction: 'combat',
  sabotage: 'combat',
  influence: 'intel',
  finance: 'tech',
  logistics: 'intel',
  blackops: 'combat',
};

/** Minimum primary-stat threshold per difficulty (0 = no requirement). */
const MIN_STAT_BY_DIFFICULTY: Record<number, number> = {
  1: 0,
  2: 15, // recruits can qualify; success chance still punishes weak agents
  3: 40,
  4: 55,
  5: 65,
};

// ─────────────────────────────────────────────
// Category weight by alert level
// ─────────────────────────────────────────────

function categoryWeights(
  alertLevel: number,
  availableDivisions?: DivisionId[],
): number[] {
  // At low alert: more surveillance/logistics/cyber
  // At high alert: more sabotage/blackops
  const base = [10, 8, 8, 6, 6, 5, 4, 3];
  return base.map((w, i) => {
    const danger = i / (CATEGORY_ORDER.length - 1); // 0–1
    let weight = Math.max(1, w + (alertLevel * 2 - 3) * danger);
    // If specific divisions are available in this city, strongly prefer their categories
    if (availableDivisions && availableDivisions.length > 0) {
      const cat = CATEGORY_ORDER[i] as unknown as DivisionId;
      weight *= availableDivisions.includes(cat) ? 4.0 : 0.15;
    }
    return weight;
  });
}

// ─────────────────────────────────────────────
// Flavor interpolation
// ─────────────────────────────────────────────

export function interpolateFlavor(
  template: string,
  target: MissionTarget,
  regionId: string,
): string {
  const region = REGION_MAP.get(regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  return template
    .replace('{target}', target.name)
    .replace('{region}', region?.name ?? regionId)
    .replace('{country}', country?.name ?? '');
}

// ─────────────────────────────────────────────
// Single mission generation
// ─────────────────────────────────────────────

export function generateMission(
  regionId: string,
  alertLevel: number,
  _existingMissionIds: Set<string> = new Set(),
  availableDivisions?: DivisionId[],
  maxDifficulty?: number,
): Mission {
  const rng = createRng();
  const region = REGION_MAP.get(regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const countryAlertBonus = country?.baseAlertLevel ?? 0;
  const effectiveAlert = Math.min(3, alertLevel + countryAlertBonus * 0.3);

  // 1. Pick category
  const weights = categoryWeights(effectiveAlert, availableDivisions);
  const category = pickWeighted(CATEGORY_ORDER, weights, rng);

  // 2. Pick target from category
  const targets = TARGET_POOLS.filter((t) => t.category === category);
  const target = pickRandom(targets, rng);

  // 3. Difficulty: driven by alert + distance + random spread
  const baseDiff =
    1 + Math.round(effectiveAlert * 1.2 + randFloat(-0.5, 0.5, rng));
  const difficulty = Math.max(
    1,
    Math.min(maxDifficulty ?? 5, Math.min(5, baseDiff)),
  ) as 1 | 2 | 3 | 4 | 5;

  // 4. Optional complication (higher difficulty = more likely)
  const complicationChance = 0.2 + difficulty * 0.1;
  let complication: MissionComplication | undefined;
  if (rng() < complicationChance) {
    complication = pickRandom(COMPLICATIONS, rng);
  }

  // 5. Min/max agents
  const minAgents = difficulty <= 2 ? 1 : difficulty <= 4 ? 2 : 3;
  const maxAgents = Math.min(6, minAgents + Math.floor(difficulty * 0.8));

  // 6. Base success chance
  const baseSuccessChance = Math.max(0.1, 0.85 - (difficulty - 1) * 0.12);

  // 7. Duration
  const baseDuration = BASE_DURATION[difficulty];
  const durationWithComp = complication
    ? Math.max(
        MIN_DURATION,
        Math.round(baseDuration * complication.durationMod),
      )
    : Math.max(MIN_DURATION, baseDuration);

  // 8. Rewards (scaled by difficulty + target)
  const diffMult = [0, 1.0, 1.5, 2.5, 3.8, 5.5][difficulty] ?? 1.0;
  const rewards: MissionRewards = {
    money: Math.round(
      target.baseRewardMoney * diffMult * randFloat(0.85, 1.15, rng),
    ),
    intel: Math.round(target.baseRewardIntel * diffMult),
    shadow: Math.round(target.baseRewardShadow * diffMult),
    influence: Math.round(target.baseRewardInfluence * diffMult),
    xp: Math.round(30 + difficulty * 20 + (complication ? 15 : 0)),
  };

  // 9. Failure penalties (proportional to mission risk)
  const failurePenalty: MissionRewards = {
    money: 0,
    intel: -Math.round(rewards.intel * 0.5),
    shadow: 0,
    influence: -Math.round(rewards.influence * 0.3),
    xp: Math.round(10 + difficulty * 5), // still get some xp on failure
  };

  // 10. Alert gain on success (higher for violent categories)
  const alertGain = target.alertGain + (complication ? 0.1 : 0);

  // 11. Flavor text
  const flavorTemplates =
    FLAVOR_TEMPLATES.find((f) => f.category === category)?.templates ?? [];
  const flavorTemplate =
    flavorTemplates.length > 0
      ? pickRandom(flavorTemplates, rng)
      : '{target} v {region}.';
  const flavor = interpolateFlavor(flavorTemplate, target, regionId);

  // 12. Title
  const title = `${target.name} — ${region?.name ?? regionId}`;

  // 13. Expiry for non-trivial missions (difficulty 3+)
  const expiresAt =
    difficulty >= 3 ? Date.now() + MISSION_EXPIRY_MS * difficulty : undefined;

  const id = randomId();

  return {
    id,
    regionId,
    category,
    targetId: target.id,
    complicationId: complication?.id,
    title,
    flavor,
    difficulty,
    minAgents,
    maxAgents,
    // Difficulty 1 missions are open to any agent — no division lock
    requiredDivisions:
      difficulty === 1 ? [] : [category as unknown as DivisionId],
    minStats:
      MIN_STAT_BY_DIFFICULTY[difficulty] > 0
        ? {
            [CATEGORY_PRIMARY_STAT[category]]:
              MIN_STAT_BY_DIFFICULTY[difficulty],
          }
        : undefined,
    baseSuccessChance,
    baseDuration: durationWithComp,
    rewards,
    failurePenalty,
    alertGain,
    isRescue: false,
    expiresAt,
    createdAt: Date.now(),
  };
}

// ─────────────────────────────────────────────
// Batch generation
// ─────────────────────────────────────────────

export function generateMissionsForRegion(
  regionId: string,
  alertLevel: number,
  count: number,
  existingMissionIds: Set<string> = new Set(),
  availableDivisions?: DivisionId[],
  /** When true, the first generated mission is always difficulty 1. */
  guaranteeEasy = false,
): Mission[] {
  return Array.from({ length: count }, (_, i) =>
    generateMission(
      regionId,
      alertLevel,
      existingMissionIds,
      availableDivisions,
      i === 0 && guaranteeEasy ? 1 : undefined,
    ),
  );
}

// ─────────────────────────────────────────────
// Rescue mission generation
// ─────────────────────────────────────────────

export function generateRescueMission(
  regionId: string,
  capturedAgentId: string,
  agentName: string,
  alertLevel: number,
): Mission {
  const region = REGION_MAP.get(regionId);
  const difficulty = Math.min(
    5,
    Math.max(2, Math.round(alertLevel * 1.5 + 2)),
  ) as 1 | 2 | 3 | 4 | 5;

  const rewards: MissionRewards = {
    money: 0,
    intel: 5,
    shadow: 3,
    influence: 2,
    xp: 80 + difficulty * 20,
  };
  const failurePenalty: MissionRewards = {
    money: -100,
    intel: -3,
    shadow: 0,
    influence: -2,
    xp: 10,
  };

  return {
    id: randomId(),
    regionId,
    category: 'extraction',
    targetId: 't39', // "Zajatý agent"
    title: `Záchrana: ${agentName}`,
    flavor: `Agent ${agentName} byl zajat a je vězněn v ${region?.name ?? regionId}. Máte omezený čas ho dostat ven.`,
    difficulty,
    minAgents: 2,
    maxAgents: 4,
    baseSuccessChance: Math.max(0.1, 0.7 - (difficulty - 2) * 0.1),
    baseDuration: BASE_DURATION[difficulty],
    rewards,
    failurePenalty,
    alertGain: 0.5,
    isRescue: true,
    capturedAgentId,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    createdAt: Date.now(),
  };
}

// ─────────────────────────────────────────────
// How many missions to top up a region
// ─────────────────────────────────────────────

export function missionsNeeded(current: number): number {
  if (current >= MAX_MISSIONS_PER_REGION) return 0;
  if (current < MIN_MISSIONS_PER_REGION)
    return MIN_MISSIONS_PER_REGION - current;
  // Between MIN and MAX: caller should use timed regen (MISSION_REGEN_INTERVAL_MS)
  return 0;
}
