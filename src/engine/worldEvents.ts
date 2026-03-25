// Shadow Ops — World Events engine helpers
import { WORLD_EVENTS } from '../data/worldEvents';
import type { WorldEventDef } from '../data/worldEvents';
import type { ActiveWorldEvent, MissionRewards } from '../db/schema';

/** Pick a random event from the catalog (equal weight, no repeat detection). */
export function pickRandomEvent(): WorldEventDef {
  return WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
}

/** Resolve the catalog definition for an active event. Returns null if none. */
export function getEventDef(
  event: ActiveWorldEvent | null | undefined,
): WorldEventDef | null {
  if (!event) return null;
  return WORLD_EVENTS.find((e) => e.id === event.eventId) ?? null;
}

/** Alert decay multiplier for the current event. 1.0 if none. (Media Frenzy = 2.0) */
export function getEventAlertDecayMult(
  event: ActiveWorldEvent | null | undefined,
): number {
  return getEventDef(event)?.alertDecayMult ?? 1.0;
}

/** Alert gain multiplier from missions under the current event. 1.0 if none. (Interpol Sweep = 2.0) */
export function getEventAlertGainMult(
  event: ActiveWorldEvent | null | undefined,
): number {
  return getEventDef(event)?.alertGainMult ?? 1.0;
}

/** Flat success chance penalty for the current event. 0 if none. (Mole Alert = 0.15) */
export function getEventSuccessChancePenalty(
  event: ActiveWorldEvent | null | undefined,
): number {
  return getEventDef(event)?.successChancePenalty ?? 0;
}

/** Returns true if the event blocks dispatching missions of the given category. */
export function isCategoryBlockedByEvent(
  category: string,
  event: ActiveWorldEvent | null | undefined,
): boolean {
  return getEventDef(event)?.blockedCategory === category;
}

/**
 * Apply active world event reward multipliers to mission rewards.
 * Returns a new rewards object — does not mutate the input.
 */
export function applyEventRewards(
  rewards: MissionRewards,
  category: string,
  event: ActiveWorldEvent | null | undefined,
): MissionRewards {
  const def = getEventDef(event);
  if (!def) return rewards;

  let { money, intel, shadow, influence } = rewards;
  const xp = rewards.xp;

  // G8 Summit — influence +50 % for influence missions
  if (def.influenceRewardMult !== undefined) {
    influence = Math.round(influence * def.influenceRewardMult);
  }

  // Whistleblower — intel ×2 on all missions
  if (def.intelRewardMult !== undefined) {
    intel = Math.round(intel * def.intelRewardMult);
  }

  // Economic Boom — money +30 % on all missions
  if (def.moneyRewardMult !== undefined) {
    money = Math.round(money * def.moneyRewardMult);
  }

  // Market Crash — all rewards ×0.5 for finance missions only
  if (def.financeRewardMult !== undefined && category === 'finance') {
    money = Math.round(money * def.financeRewardMult);
    intel = Math.round(intel * def.financeRewardMult);
    shadow = Math.round(shadow * def.financeRewardMult);
    influence = Math.round(influence * def.financeRewardMult);
  }

  // Arms Deal — shadow ×1.8 for extraction + blackops only
  if (
    def.armsDealShadowMult !== undefined &&
    (category === 'extraction' || category === 'blackops')
  ) {
    shadow = Math.round(shadow * def.armsDealShadowMult);
  }

  // Sanctions — money, shadow, influence ×0.7 (intel untouched)
  if (def.allRewardsMult !== undefined) {
    money = Math.round(money * def.allRewardsMult);
    shadow = Math.round(shadow * def.allRewardsMult);
    influence = Math.round(influence * def.allRewardsMult);
  }

  return { money, intel, shadow, influence, xp };
}
