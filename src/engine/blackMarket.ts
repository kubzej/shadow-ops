import { EQUIPMENT_CATALOG, type Equipment } from '../data/equipmentCatalog';
import { type DivisionId } from '../data/agentTypes';
import { createRng, pickRandom, pickRandomN } from '../utils/rng';
import type { BlackMarket, BlackMarketListing } from '../db/schema';

// ─────────────────────────────────────────────
// Black market offer generation
// ─────────────────────────────────────────────

/** Refresh interval: 5 minutes. */
export const BLACK_MARKET_REFRESH_MS = 5 * 60 * 1000;

/** Number of standard listings per refresh. */
const LISTING_COUNT = 4;

/**
 * Generate a fresh black market offer.
 * Includes rare + legendary equipment and occasionally a special agent.
 */
export function generateBlackMarketOffer(): BlackMarket {
  const rng = createRng();

  // Pull from rare + legendary black-market items
  const eligibleEquipment = EQUIPMENT_CATALOG.filter(
    (e) => e.isBlackMarket || e.rarity === 'rare' || e.rarity === 'legendary',
  );

  const selected: Equipment[] = pickRandomN(
    eligibleEquipment,
    LISTING_COUNT,
    rng,
  );

  const listings: BlackMarketListing[] = selected.map((eq) => ({
    equipmentId: eq.id,
    costShadow: eq.costShadow ?? Math.round((eq.costMoney ?? 0) / 20),
    costInfluence: eq.costInfluence ?? 0,
    costMoney: eq.isBlackMarket ? 0 : Math.round((eq.costMoney ?? 0) * 1.4),
  }));

  // 30% chance to include a special high-rank agent offer
  if (rng() < 0.3) {
    listings.push(_specialAgentListing(rng));
  }

  // 20% chance for a fast-expansion shortcut listing
  if (rng() < 0.2) {
    listings.push(_expansionShortcutListing());
  }

  return {
    id: 1,
    listings,
    refreshesAt: Date.now() + BLACK_MARKET_REFRESH_MS,
  };
}

// ─────────────────────────────────────────────
// Special listing types
// ─────────────────────────────────────────────

/** A rare agent of a random blackops or extraction division. */
function _specialAgentListing(rng: () => number): BlackMarketListing {
  const eliteDivisions: DivisionId[] = [
    'blackops',
    'extraction',
    'cyber',
    'sabotage',
  ];
  const division = pickRandom(eliteDivisions, rng);
  const rank = rng() < 0.3 ? 'veteran' : 'specialist';
  // Represent as a sentinel equipment id (handled specially by the UI)
  return {
    equipmentId: `__agent__${division}__${rank}`,
    costShadow: rank === 'veteran' ? 40 : 25,
    costInfluence: rank === 'veteran' ? 25 : 15,
    costMoney: 0,
  };
}

/** A shortcut expansion — skip build time for one region. */
function _expansionShortcutListing(): BlackMarketListing {
  return {
    equipmentId: '__expansion_skip__',
    costShadow: 30,
    costInfluence: 20,
    costMoney: 0,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function isSpecialAgentListing(equipmentId: string): boolean {
  return equipmentId.startsWith('__agent__');
}

export function isExpansionSkipListing(equipmentId: string): boolean {
  return equipmentId === '__expansion_skip__';
}

export function parseSpecialAgentListing(equipmentId: string): {
  division: DivisionId;
  rank: 'specialist' | 'veteran';
} | null {
  const match = equipmentId.match(/^__agent__(.+)__(specialist|veteran)$/);
  if (!match) return null;
  return {
    division: match[1] as DivisionId,
    rank: match[2] as 'specialist' | 'veteran',
  };
}

/** Whether the black market needs a refresh. */
export function needsRefresh(bm: BlackMarket): boolean {
  return Date.now() >= bm.refreshesAt;
}
