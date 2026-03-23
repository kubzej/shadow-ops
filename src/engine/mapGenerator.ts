import { REGIONS, REGION_MAP } from '../data/regions';
import { COUNTRY_MAP } from '../data/countries';
import {
  EXPANSION_BASE_COST,
  EXPANSION_COST_PER_DISTANCE,
  EXPANSION_COST_SCALE,
  EXPANSION_BUILD_TIME_BASE,
  EXPANSION_BUILD_TIME_PER_DISTANCE,
} from '../data/costs';
import type { RegionState } from '../db/schema';

// ─────────────────────────────────────────────
// BFS distance map
// ─────────────────────────────────────────────

/**
 * Run BFS from startCityId across the neighbor graph.
 * Returns a Map<regionId, distanceFromStart>.
 */
export function computeDistances(startCityId: string): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: string[] = [startCityId];
  distances.set(startCityId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const region = REGION_MAP.get(current);
    if (!region) continue;

    const dist = distances.get(current)!;
    for (const neighborId of region.neighbors) {
      if (!distances.has(neighborId)) {
        distances.set(neighborId, dist + 1);
        queue.push(neighborId);
      }
    }
  }

  return distances;
}

// ─────────────────────────────────────────────
// Full map initialisation
// ─────────────────────────────────────────────

/**
 * Generate initial RegionState[] for all regions.
 * Only startCityId is owned; everything else is locked/available by distance.
 */
export function generateMap(startCityId: string): RegionState[] {
  const distances = computeDistances(startCityId);

  return REGIONS.map((region) => {
    const dist = distances.get(region.id) ?? 999;
    const isStart = region.id === startCityId;

    return {
      id: region.id,
      owned: isStart,
      alertLevel: 0,
      distanceFromStart: dist,
      safeHouseId: isStart ? region.id : undefined,
      availableMissionIds: [],
    } satisfies RegionState;
  });
}

// ─────────────────────────────────────────────
// Expansion helpers
// ─────────────────────────────────────────────

/**
 * Returns ids of regions that are adjacent to any owned region
 * and are not yet owned or under construction.
 */
export function getAvailableExpansions(
  ownedRegionIds: string[],
  allRegionStates: RegionState[],
): string[] {
  const ownedSet = new Set(ownedRegionIds);
  const stateMap = new Map(allRegionStates.map((r) => [r.id, r]));
  const available = new Set<string>();

  for (const ownedId of ownedSet) {
    const region = REGION_MAP.get(ownedId);
    if (!region) continue;
    for (const neighborId of region.neighbors) {
      if (!ownedSet.has(neighborId)) {
        const state = stateMap.get(neighborId);
        // Only show if not already under construction
        if (state && !state.constructionInProgress) {
          available.add(neighborId);
        }
      }
    }
  }

  return [...available];
}

/** Cost to expand to a region.
 *  Scales with how many expansions the player has already done.
 */
export function expansionCost(
  regionId: string,
  distanceFromStart: number,
  totalExpansions = 0,
): {
  money: number;
  intel: number;
} {
  const region = REGION_MAP.get(regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const alertMod = country ? country.baseAlertLevel : 0;
  // Cap the scale multiplier so costs don't grow unboundedly (max ×3)
  const scaleMult = Math.min(3.0, 1 + EXPANSION_COST_SCALE * totalExpansions);

  return {
    money: Math.round(
      (EXPANSION_BASE_COST.money +
        EXPANSION_COST_PER_DISTANCE.money * distanceFromStart +
        alertMod * 50) *
        scaleMult,
    ),
    intel: Math.round(
      (EXPANSION_BASE_COST.intel +
        EXPANSION_COST_PER_DISTANCE.intel * distanceFromStart +
        alertMod * 2) *
        scaleMult,
    ),
  };
}

/** Build time (ms) to expand to a region. */
export function expansionBuildTime(distanceFromStart: number): number {
  return (
    (EXPANSION_BUILD_TIME_BASE +
      EXPANSION_BUILD_TIME_PER_DISTANCE * distanceFromStart) *
    1000
  );
}

// ─────────────────────────────────────────────
// Map query helpers
// ─────────────────────────────────────────────

/** All regions owned by the player. */
export function getOwnedRegions(states: RegionState[]): RegionState[] {
  return states.filter((r) => r.owned);
}

/** All regions available for expansion. */
export function getAvailableRegions(
  states: RegionState[],
  ownedIds: string[],
): RegionState[] {
  const available = getAvailableExpansions(ownedIds, states);
  const stateMap = new Map(states.map((r) => [r.id, r]));
  return available.map((id) => stateMap.get(id)!).filter(Boolean);
}

/** Region display info: combine RegionState with static Region data. */
export function getRegionDisplayInfo(regionId: string, states: RegionState[]) {
  const region = REGION_MAP.get(regionId);
  const state = states.find((s) => s.id === regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;

  return { region, state, country };
}

/** Whether a region is reachable (distance ≤ threshold). Default: all reachable. */
export function isReachable(
  regionId: string,
  distances: Map<string, number>,
): boolean {
  return distances.has(regionId);
}

/** Regions grouped by country id. */
export function groupRegionsByCountry(
  states: RegionState[],
): Map<string, RegionState[]> {
  const map = new Map<string, RegionState[]>();
  for (const state of states) {
    const region = REGION_MAP.get(state.id);
    if (!region) continue;
    const list = map.get(region.countryId) ?? [];
    list.push(state);
    map.set(region.countryId, list);
  }
  return map;
}
