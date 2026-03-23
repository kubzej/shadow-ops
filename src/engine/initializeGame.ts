import { db, activateSlot } from '../db/db';
import { metaDb } from '../db/saveSlots';
import type { GameState, SafeHouse } from '../db/schema';
import { generateMap } from './mapGenerator';
import { createAgent, generateRecruitmentPool } from './agentGenerator';
import { generateMissionsForRegion } from './missionGenerator';
import { generateBlackMarketOffer } from './blackMarket';
import type { DivisionId } from '../data/agentTypes';
import { useGameStore } from '../store/gameStore';
import { DEFAULT_LOGO_ID } from '../data/orgLogos';
// ─────────────────────────────────────────────
// Starting values
// ─────────────────────────────────────────────

const STARTING_CURRENCIES = { money: 1500, intel: 30, shadow: 0, influence: 0 };
const STARTING_DIVISIONS: DivisionId[] = ['surveillance', 'cyber'];
const STARTING_DIVISION_LEVELS: Record<DivisionId, number> = {
  surveillance: 1,
  cyber: 1,
  extraction: 0,
  sabotage: 0,
  influence: 0,
  finance: 0,
  logistics: 0,
  medical: 0,
  blackops: 0,
};
const STARTING_AGENT_TYPES = ['shadow', 'hacker']; // one per starting division
const STARTING_MISSIONS_COUNT = 4;

// ─────────────────────────────────────────────
// Main init function
// ─────────────────────────────────────────────

export async function initializeGame(
  agencyName: string,
  bossName: string,
  startCityId: string,
  logoId: string,
  slotId: string,
): Promise<void> {
  // Activate the DB for this slot before any DB operations
  activateSlot(slotId);
  localStorage.setItem('shadow-ops-active-slot', slotId);

  const now = Date.now();

  // 1. Clear any existing data
  await db.transaction(
    'rw',
    [
      db.gameState,
      db.safeHouses,
      db.agents,
      db.regions,
      db.missions,
      db.activeMissions,
      db.recruitmentPools,
      db.blackMarket,
      db.missionLog,
    ],
    async () => {
      await Promise.all([
        db.gameState.clear(),
        db.safeHouses.clear(),
        db.agents.clear(),
        db.regions.clear(),
        db.missions.clear(),
        db.activeMissions.clear(),
        db.recruitmentPools.clear(),
        db.blackMarket.clear(),
        db.missionLog.clear(),
      ]);

      // 2. Save GameState
      const gameState: GameState = {
        id: 1,
        agencyName,
        bossName,
        startCityId,
        createdAt: now,
        lastSavedAt: now,
        totalPlayTime: 0,
        money: STARTING_CURRENCIES.money,
        intel: STARTING_CURRENCIES.intel,
        shadow: STARTING_CURRENCIES.shadow,
        influence: STARTING_CURRENCIES.influence,
        blackMarketUnlocked: false,
        unlockedDivisions: STARTING_DIVISIONS,
        divisionLevels: STARTING_DIVISION_LEVELS,
        logoId,
        totalMissionsCompleted: 0,
        totalMissionsAttempted: 0,
        totalAgentsLost: 0,
        totalExpansions: 0,
      };
      await db.gameState.add(gameState);

      // 3. Generate all region states (BFS distances)
      const regionStates = generateMap(startCityId);
      await db.regions.bulkAdd(regionStates);

      // 4. Create starting safe house
      const safeHouse: SafeHouse = {
        id: startCityId,
        regionId: startCityId,
        level: 1,
        index: 1,
        assignedDivisions: STARTING_DIVISIONS,
        modules: [],
        createdAt: now,
      };
      await db.safeHouses.add(safeHouse);

      // 5. Create starting agents
      const agents = STARTING_AGENT_TYPES.map((typeId) =>
        createAgent(typeId, 'recruit', startCityId),
      );
      await db.agents.bulkAdd(agents);

      // 6. Generate starting missions (biased toward starting divisions)
      const missions = generateMissionsForRegion(
        startCityId,
        0,
        STARTING_MISSIONS_COUNT,
        new Set(),
        STARTING_DIVISIONS,
        true, // always include at least one difficulty-1 mission at start
      );
      await db.missions.bulkAdd(missions);

      // Mark region as having missions
      await db.regions.update(startCityId, {
        availableMissionIds: missions.map((m) => m.id),
        lastMissionGeneratedAt: now,
      });

      // 7. Generate recruitment pool for starting safe house
      const pool = generateRecruitmentPool(
        startCityId,
        STARTING_DIVISIONS,
        1,
        3,
      );
      await db.recruitmentPools.add(pool);

      // 8. Pre-generate black market (locked, but ready for when player unlocks it)
      const bm = generateBlackMarketOffer();
      await db.blackMarket.add(bm);
    },
  );

  // 9. Populate Zustand store
  useGameStore.getState().setLoaded({
    agencyName,
    bossName,
    startCityId,
    logoId,
    createdAt: now,
    currencies: STARTING_CURRENCIES,
    unlockedDivisions: STARTING_DIVISIONS,
    divisionLevels: STARTING_DIVISION_LEVELS,
    blackMarketUnlocked: false,
    totalMissionsCompleted: 0,
    totalMissionsAttempted: 0,
    totalAgentsLost: 0,
    totalExpansions: 0,
  });

  // Write slot metadata for the save picker
  await metaDb.slots.put({
    id: slotId,
    agencyName,
    bossName,
    logoId,
    createdAt: now,
    lastSavedAt: now,
    money: STARTING_CURRENCIES.money,
    intel: STARTING_CURRENCIES.intel,
    totalMissionsCompleted: 0,
  });
}

// ─────────────────────────────────────────────
// Load existing game into Zustand store
// ─────────────────────────────────────────────

export async function loadGame(): Promise<boolean> {
  const state = await db.gameState.get(1);
  if (!state) return false;

  useGameStore.getState().setLoaded({
    agencyName: state.agencyName,
    bossName: state.bossName,
    startCityId: state.startCityId,
    logoId: state.logoId ?? DEFAULT_LOGO_ID,
    createdAt: state.createdAt,
    currencies: {
      money: state.money,
      intel: state.intel,
      shadow: state.shadow,
      influence: state.influence,
    },
    unlockedDivisions: state.unlockedDivisions,
    divisionLevels: state.divisionLevels,
    blackMarketUnlocked: state.blackMarketUnlocked,
    totalMissionsCompleted: state.totalMissionsCompleted,
    totalMissionsAttempted: state.totalMissionsAttempted,
    totalAgentsLost: state.totalAgentsLost,
    totalExpansions: state.totalExpansions,
  });

  return true;
}
