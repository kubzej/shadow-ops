import { REGION_MAP } from '../../data/regions';

/** Cost per 100 map-units of distance */
const TRAVEL_COST_PER_100 = 20;
/** Base travel cost */
const TRAVEL_BASE_COST = 50;
/** Travel time in ms per 100 map-units */
const TRAVEL_MS_PER_100 = 30 * 60 * 1000; // 30 min
/** Base travel time in ms */
const TRAVEL_BASE_MS = 60 * 60 * 1000; // 1 hour

function travelDistance(fromId: string, toId: string): number {
  const a = REGION_MAP.get(fromId);
  const b = REGION_MAP.get(toId);
  if (!a || !b) return 0;
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function travelCost(fromId: string, toId: string): number {
  return (
    TRAVEL_BASE_COST +
    Math.round((travelDistance(fromId, toId) / 100) * TRAVEL_COST_PER_100)
  );
}

export function travelDuration(fromId: string, toId: string): number {
  return (
    TRAVEL_BASE_MS +
    Math.round((travelDistance(fromId, toId) / 100) * TRAVEL_MS_PER_100)
  );
}
