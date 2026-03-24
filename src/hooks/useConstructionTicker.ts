import { useEffect } from 'react';
import { db } from '../db/db';
import { generateMissionsForRegion } from '../engine/missionGenerator';
import { generateRecruitmentPool } from '../engine/agentGenerator';
import { REGION_MAP } from '../data/regions';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { DivisionId } from '../data/agentTypes';

const TICK_MS = 5_000;

/**
 * Global ticker that finalizes:
 * - Completed region constructions (expansion build timers)
 * - Completed safe house upgrades
 *
 * Mount once in GameShell. Individual screens can still poll their own
 * data with setInterval/load() for display refresh.
 */
export function useConstructionTicker() {
  const incrementStat = useGameStore((s) => s.incrementStat);
  const showToast = useUIStore((s) => s.showToast);
  useEffect(() => {
    async function tick() {
      const now = Date.now();

      // 1. Finalize completed region constructions
      const doneRegions = await db.regions
        .filter(
          (r) =>
            !!r.constructionInProgress &&
            !!r.constructionCompletesAt &&
            r.constructionCompletesAt <= now,
        )
        .toArray();

      for (const r of doneRegions) {
        const sh = await db.safeHouses.get(r.id);
        const divisions = (sh?.assignedDivisions ?? []) as DivisionId[];
        const missions = generateMissionsForRegion(
          r.id,
          r.alertLevel,
          3,
          new Set(),
          divisions.length > 0 ? divisions : undefined,
        );
        await db.missions.bulkAdd(missions);
        await db.safeHouses.update(r.id, {
          constructionInProgress: false,
          constructionCompletesAt: undefined,
        });
        await db.regions.update(r.id, {
          owned: true,
          constructionInProgress: false,
          constructionCompletesAt: undefined,
          safeHouseId: r.id,
          availableMissionIds: missions.map((m) => m.id),
        });
        // Generate initial recruitment pool using all globally unlocked divisions
        const unlockedDivisions = useGameStore.getState()
          .unlockedDivisions as DivisionId[];
        const recruitPool = generateRecruitmentPool(
          r.id,
          unlockedDivisions,
          1,
          3,
        );
        await db.recruitmentPools.put(recruitPool);
        incrementStat('expansions');
        const regionName = REGION_MAP.get(r.id)?.name ?? r.id;
        showToast('success', `Expanze dokončena: ${regionName}`);
      }

      // 2. Finalize completed safe house upgrades
      const doneUpgrades = await db.safeHouses
        .filter(
          (sh) =>
            !!sh.upgradeInProgress &&
            !!sh.upgradeCompletesAt &&
            sh.upgradeCompletesAt <= now,
        )
        .toArray();

      for (const sh of doneUpgrades) {
        await db.safeHouses.update(sh.id, {
          level: sh.level + 1,
          upgradeInProgress: false,
          upgradeCompletesAt: undefined,
        });
      }
    }

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [incrementStat, showToast]);
}
