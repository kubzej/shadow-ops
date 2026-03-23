import { useEffect, useRef } from 'react';
import { db } from '../db/db';
import { calculatePassiveIncome, decayAlertLevel } from '../engine/passiveIncome';
import { useGameStore } from '../store/gameStore';
import type { DivisionId } from '../data/agentTypes';

const TICK_INTERVAL = 30_000; // 30 seconds

/**
 * Runs a passive income tick every 30 seconds.
 * Adds currencies from all safe houses and decays alert levels.
 * Mount once in App.tsx when the game is loaded.
 */
export function usePassiveIncome() {
  const divisionLevels = useGameStore((s) => s.divisionLevels);
  const addCurrencies = useGameStore((s) => s.addCurrencies);
  const loaded = useGameStore((s) => s.loaded);

  const divLevelsRef = useRef(divisionLevels);
  divLevelsRef.current = divisionLevels;

  useEffect(() => {
    if (!loaded) return;

    async function tick() {
      const [safeHouses, agents] = await Promise.all([
        db.safeHouses.toArray(),
        db.agents.toArray(),
      ]);

      // Calculate + apply income
      const income = calculatePassiveIncome(safeHouses, divLevelsRef.current, agents);
      if (income.money || income.intel || income.shadow || income.influence) {
        addCurrencies({
          money: Math.round(income.money),
          intel: Math.round(income.intel),
          shadow: Math.round(income.shadow),
          influence: Math.round(income.influence),
        });
      }

      // Decay alert levels for owned regions
      const ownedRegions = await db.regions.filter((r) => r.owned).toArray();
      for (const region of ownedRegions) {
        if (region.alertLevel <= 0) continue;
        const sh = safeHouses.find((s) => s.id === region.id);
        const hasSurv = sh?.assignedDivisions.includes('surveillance' as DivisionId) ?? false;
        const newAlert = decayAlertLevel(region.alertLevel, hasSurv);
        if (Math.abs(newAlert - region.alertLevel) > 0.001) {
          await db.regions.update(region.id, { alertLevel: newAlert });
        }
      }
    }

    // First tick after 30s delay
    const id = setInterval(tick, TICK_INTERVAL);
    return () => clearInterval(id);
  }, [loaded, addCurrencies]);
}
