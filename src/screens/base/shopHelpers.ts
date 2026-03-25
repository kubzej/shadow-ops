import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import type { Equipment } from '../../data/equipmentCatalog';
import { mulberry32 } from '../../utils/rng';

export const SHOP_ROTATION_MS = 60 * 60 * 1000; // 1 hour

export function currentShopSeed(): number {
  return Math.floor(Date.now() / SHOP_ROTATION_MS);
}

export function msToNextRotation(): number {
  return SHOP_ROTATION_MS - (Date.now() % SHOP_ROTATION_MS);
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate 6 shop items deterministically from an hourly seed.
 * Rarity tiers unlock with totalMissionsCompleted:
 *   0–9:  common + uncommon
 *  10–29: +rare (25% chance per slot)
 *  30+:  +legendary via black market (8% per slot, only if bm unlocked)
 */
export function generateShopItems(
  seed: number,
  totalMissions: number,
  blackMarketUnlocked: boolean,
): Equipment[] {
  const rng = mulberry32(seed);
  const pools = {
    common: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'common' && !e.isBlackMarket,
    ),
    uncommon: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'uncommon' && !e.isBlackMarket,
    ),
    rare: EQUIPMENT_CATALOG.filter(
      (e) => e.rarity === 'rare' && !e.isBlackMarket,
    ),
    legendary: EQUIPMENT_CATALOG.filter((e) => e.rarity === 'legendary'),
  };
  const used = new Set<string>();
  const result: Equipment[] = [];

  for (let i = 0; i < 6; i++) {
    const r = rng();
    let pool: Equipment[];

    if (blackMarketUnlocked && totalMissions >= 30 && r < 0.08) {
      pool = pools.legendary.filter((e) => !used.has(e.id));
    } else if (totalMissions >= 10 && r < 0.25) {
      pool = pools.rare.filter((e) => !used.has(e.id));
    } else if (r < 0.55) {
      pool = pools.uncommon.filter((e) => !used.has(e.id));
    } else {
      pool = pools.common.filter((e) => !used.has(e.id));
    }

    if (pool.length === 0)
      pool = [...pools.common, ...pools.uncommon].filter(
        (e) => !used.has(e.id),
      );

    if (pool.length > 0) {
      const item = pool[Math.floor(rng() * pool.length)];
      result.push(item);
      used.add(item.id);
    }
  }
  return result;
}
