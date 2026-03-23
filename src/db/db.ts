import Dexie, { type Table } from 'dexie';
import type {
  GameState,
  SafeHouse,
  Agent,
  RegionState,
  Mission,
  ActiveMission,
  RecruitmentPool,
  BlackMarket,
  MissionLogEntry,
} from './schema';

class ShadowOpsDB extends Dexie {
  gameState!: Table<GameState, number>;
  safeHouses!: Table<SafeHouse, string>;
  agents!: Table<Agent, string>;
  regions!: Table<RegionState, string>;
  missions!: Table<Mission, string>;
  activeMissions!: Table<ActiveMission, string>;
  recruitmentPools!: Table<RecruitmentPool, string>;
  blackMarket!: Table<BlackMarket, number>;
  missionLog!: Table<MissionLogEntry, string>;

  constructor(slotId: string) {
    super(`shadow-ops-save-${slotId}`);
    this.version(1).stores({
      gameState: '&id',
      safeHouses: '&id, regionId',
      agents: '&id, division, status, safeHouseId',
      regions: '&id, owned, distanceFromStart',
      missions: '&id, regionId, category, difficulty, expiresAt',
      activeMissions: '&id, missionId, completesAt, collected',
      recruitmentPools: '&id, safeHouseId',
      blackMarket: '&id',
      missionLog: '&id, regionId, result, completedAt',
    });
  }
}

let _activeDb: ShadowOpsDB | null = null;

/** Open (or reuse) the Dexie DB for a given save slot. */
export function activateSlot(slotId: string): void {
  if (_activeDb?.name === `shadow-ops-save-${slotId}`) return;
  _activeDb = new ShadowOpsDB(slotId);
}

/**
 * Proxy forwarding all property accesses to the currently active slot DB.
 * Always call activateSlot() before any DB operations.
 */
export const db = new Proxy({} as ShadowOpsDB, {
  get(_target, prop: string | symbol) {
    if (!_activeDb) {
      throw new Error('No active save slot. Call activateSlot() first.');
    }
    const value = Reflect.get(_activeDb, prop);
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(_activeDb)
      : value;
  },
});
