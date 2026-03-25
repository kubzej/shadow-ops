import { REGION_MAP } from '../../data/regions';

/** Cost per 100 map-units of distance */
const TRAVEL_COST_PER_100 = 20;
/** Base travel cost */
const TRAVEL_BASE_COST = 50;
/** Travel time in ms per 100 map-units */
const TRAVEL_MS_PER_100 = 30 * 60 * 1000; // 30 min
/** Base travel time in ms */
const TRAVEL_BASE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Border regions grant a 20 % cost discount on travel.
 * Applies when either the source or the destination is a border city.
 */
const BORDER_TRAVEL_DISCOUNT = 0.8;

function travelDistance(fromId: string, toId: string): number {
  const a = REGION_MAP.get(fromId);
  const b = REGION_MAP.get(toId);
  if (!a || !b) return 0;
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function hasBorderType(regionId: string): boolean {
  const r = REGION_MAP.get(regionId);
  if (!r) return false;
  return r.type === 'border' || r.secondaryType === 'border';
}

export function travelCost(fromId: string, toId: string): number {
  const base =
    TRAVEL_BASE_COST +
    Math.round((travelDistance(fromId, toId) / 100) * TRAVEL_COST_PER_100);
  const discount =
    hasBorderType(fromId) || hasBorderType(toId)
      ? BORDER_TRAVEL_DISCOUNT
      : 1.0;
  return Math.round(base * discount);
}

export function travelDuration(fromId: string, toId: string): number {
  return (
    TRAVEL_BASE_MS +
    Math.round((travelDistance(fromId, toId) / 100) * TRAVEL_MS_PER_100)
  );
}

/** Returns true if travel between these two regions qualifies for a border discount. */
export function hasBorderDiscount(fromId: string, toId: string): boolean {
  return hasBorderType(fromId) || hasBorderType(toId);
}
