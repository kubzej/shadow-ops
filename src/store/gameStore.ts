import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DivisionId } from '../data/agentTypes';
import type {
  ActiveRivalOperation,
  ActiveWorldEvent,
  AchievementCounters,
} from '../db/schema';
import { db } from '../db/db';
import { metaDb } from '../db/saveSlots';

export const DEFAULT_ACHIEVEMENT_COUNTERS: AchievementCounters = {
  totalAgentsRecruited: 0,
  totalFlashMissionsCompleted: 0,
  totalChainMissionsCompleted: 0,
  totalCovertMissionsCompleted: 0,
  totalAggressiveMissionsCompleted: 0,
  totalRescueMissionsCompleted: 0,
  totalCounterOpMissionsCompleted: 0,
  totalNoAlertMissionsCompleted: 0,
  totalModulesInstalled: 0,
  totalRivalOperationsEncountered: 0,
  totalRivalOperationsBlocked: 0,
  totalWorldEventMissionsCompleted: 0,
  missionsWithoutLoss: 0,
  totalDirectorsRaised: 0,
  lifetimeMoneyEarned: 0,
  lifetimeMoneySpent: 0,
  lifetimeIntelEarned: 0,
  agentsHealed: 0,
  rivalOpsLetThrough: 0,
  rivalOpsTodayCount: 0,
  loginStreak: 0,
  missionsCompletedTimestamps: undefined,
};

// Session-level play time tracking
let _loadedPlayTime = 0;
let _sessionStartedAt = Date.now();

export interface Currencies {
  money: number; // $
  intel: number; // ◈
  shadow: number; // ◆
  influence: number; // ✦
}

interface GameStore {
  // ── Meta ──────────────────────────────────────
  loaded: boolean;
  agencyName: string;
  bossName: string;
  startCityId: string;
  logoId: string;
  createdAt: number;

  // ── Currencies ────────────────────────────────
  currencies: Currencies;

  // ── Divisions ─────────────────────────────────
  unlockedDivisions: DivisionId[];
  divisionLevels: Record<DivisionId, number>;
  blackMarketUnlocked: boolean;

  // ── Stats ─────────────────────────────────────
  totalMissionsCompleted: number;
  totalMissionsAttempted: number;
  totalAgentsLost: number;
  totalExpansions: number;

  // ── World Events ──────────────────────────────
  activeWorldEvent: ActiveWorldEvent | null;
  nextWorldEventAt: number;

  // ── Rival ─────────────────────────────────────
  rivalName: string;
  nextRivalOperationAt: number;
  activeRivalOperation: ActiveRivalOperation | null;
  rivalAggressionLevel: number;

  // ── Director ──────────────────────────────────
  directorAgentId: string | null;

  // ── Achievements ──────────────────────────────
  unlockedAchievements: string[];
  achievementCounters: AchievementCounters;

  // ── Actions ───────────────────────────────────
  setLoaded: (meta: {
    agencyName: string;
    bossName: string;
    startCityId: string;
    logoId: string;
    createdAt: number;
    totalPlayTime: number;
    currencies: Currencies;
    unlockedDivisions: DivisionId[];
    divisionLevels: Record<DivisionId, number>;
    blackMarketUnlocked: boolean;
    totalMissionsCompleted: number;
    totalMissionsAttempted: number;
    totalAgentsLost: number;
    totalExpansions: number;
    activeWorldEvent?: ActiveWorldEvent | null;
    nextWorldEventAt?: number;
    rivalName?: string;
    nextRivalOperationAt?: number;
    activeRivalOperation?: ActiveRivalOperation | null;
    rivalAggressionLevel?: number;
    directorAgentId?: string | null;
    unlockedAchievements?: string[];
    achievementCounters?: AchievementCounters;
  }) => void;

  addCurrencies: (delta: Partial<Currencies>) => void;
  spendCurrencies: (cost: Partial<Currencies>) => boolean; // returns false if not enough
  canAfford: (cost: Partial<Currencies>) => boolean;

  unlockDivision: (id: DivisionId) => void;
  upgradeDivision: (id: DivisionId) => void;
  unlockBlackMarket: () => void;

  incrementStat: (stat: 'missions' | 'agents' | 'expansions') => void;
  incrementMissionAttempted: () => void;
  incrementMissionCompleted: () => void;
  getPlayTimeSecs: () => number;
  /** Set (or clear) the active world event and optionally schedule the next one. */
  setWorldEvent: (event: ActiveWorldEvent | null, nextAt?: number) => void;
  setRivalOperation: (op: ActiveRivalOperation | null, nextAt?: number) => void;
  /** Register or clear the global Director agent. */
  setDirectorAgent: (agentId: string | null) => void;
  /** Odemkne achievement (idempotentní). Vrátí true pokud byl achievement nově odemčen. */
  unlockAchievement: (id: string) => boolean;
  /** Inkrementuje konkrétní achievement counter a persistuje. */
  incrementAchievementCounter: (
    key: keyof AchievementCounters,
    by?: number,
  ) => void;
  /** Nastaví string hodnotu v achievement counterech (pro rivalOpsTodayDate, lastLoginDate). */
  setAchievementCounterString: (
    key: 'rivalOpsTodayDate' | 'lastLoginDate',
    value: string,
  ) => void;
  /** Přidá timestamp dokončené mise do missionsCompletedTimestamps (max 20). */
  pushMissionTimestamp: (ts: number) => void;
  reset: () => void;
  _persist: () => void;
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    // ── Initial state ──────────────────────────
    loaded: false,
    agencyName: '',
    bossName: '',
    startCityId: '',
    logoId: '',
    createdAt: 0,
    currencies: { money: 0, intel: 0, shadow: 0, influence: 0 },
    unlockedDivisions: [],
    divisionLevels: {} as Record<DivisionId, number>,
    blackMarketUnlocked: false,
    totalMissionsCompleted: 0,
    totalMissionsAttempted: 0,
    totalAgentsLost: 0,
    totalExpansions: 0,
    activeWorldEvent: null,
    nextWorldEventAt: 0,
    rivalName: '',
    nextRivalOperationAt: 0,
    activeRivalOperation: null,
    rivalAggressionLevel: 0,
    directorAgentId: null,
    unlockedAchievements: [],
    achievementCounters: { ...DEFAULT_ACHIEVEMENT_COUNTERS },

    // ── Actions ────────────────────────────────
    setLoaded: (meta) =>
      set((state) => {
        state.loaded = true;
        state.agencyName = meta.agencyName;
        state.bossName = meta.bossName;
        state.startCityId = meta.startCityId;
        state.logoId = meta.logoId;
        state.createdAt = meta.createdAt;
        state.currencies = meta.currencies;
        state.unlockedDivisions = meta.unlockedDivisions;
        state.divisionLevels = meta.divisionLevels;
        state.blackMarketUnlocked = meta.blackMarketUnlocked;
        state.totalMissionsCompleted = meta.totalMissionsCompleted;
        state.totalMissionsAttempted = meta.totalMissionsAttempted;
        state.totalAgentsLost = meta.totalAgentsLost;
        state.totalExpansions = meta.totalExpansions;
        state.activeWorldEvent = meta.activeWorldEvent ?? null;
        state.nextWorldEventAt = meta.nextWorldEventAt ?? 0;
        state.rivalName = meta.rivalName ?? '';
        state.nextRivalOperationAt = meta.nextRivalOperationAt ?? 0;
        state.activeRivalOperation = meta.activeRivalOperation ?? null;
        state.rivalAggressionLevel =
          meta.rivalAggressionLevel ??
          Math.floor((meta.totalMissionsCompleted ?? 0) / 25);
        state.directorAgentId = meta.directorAgentId ?? null;
        state.unlockedAchievements = meta.unlockedAchievements ?? [];
        state.achievementCounters = meta.achievementCounters ?? {
          ...DEFAULT_ACHIEVEMENT_COUNTERS,
        };
        // Reset session tracking for this load
        _loadedPlayTime = meta.totalPlayTime ?? 0;
        _sessionStartedAt = Date.now();
      }),

    addCurrencies: (delta) => {
      set((state) => {
        if (delta.money !== undefined) {
          if (delta.money > 0) {
            state.achievementCounters.lifetimeMoneyEarned += delta.money;
          }
          state.currencies.money += delta.money;
        }
        if (delta.intel !== undefined) {
          if (delta.intel > 0) {
            state.achievementCounters.lifetimeIntelEarned += delta.intel;
          }
          state.currencies.intel += delta.intel;
        }
        if (delta.shadow !== undefined) state.currencies.shadow += delta.shadow;
        if (delta.influence !== undefined)
          state.currencies.influence += delta.influence;
        // Floor at 0
        state.currencies.money = Math.max(0, state.currencies.money);
        state.currencies.intel = Math.max(0, state.currencies.intel);
        state.currencies.shadow = Math.max(0, state.currencies.shadow);
        state.currencies.influence = Math.max(0, state.currencies.influence);
      });
      get()._persist();
    },

    canAfford: (cost) => {
      const c = get().currencies;
      return (
        (cost.money === undefined || c.money >= cost.money) &&
        (cost.intel === undefined || c.intel >= cost.intel) &&
        (cost.shadow === undefined || c.shadow >= cost.shadow) &&
        (cost.influence === undefined || c.influence >= cost.influence)
      );
    },

    spendCurrencies: (cost) => {
      if (!get().canAfford(cost)) return false;
      set((state) => {
        if (cost.money !== undefined) {
          state.achievementCounters.lifetimeMoneySpent += cost.money;
          state.currencies.money -= cost.money;
        }
        if (cost.intel !== undefined) state.currencies.intel -= cost.intel;
        if (cost.shadow !== undefined) state.currencies.shadow -= cost.shadow;
        if (cost.influence !== undefined)
          state.currencies.influence -= cost.influence;
      });
      get()._persist();
      return true;
    },

    unlockDivision: (id) => {
      set((state) => {
        if (!state.unlockedDivisions.includes(id)) {
          state.unlockedDivisions.push(id);
          state.divisionLevels[id] = 1;
        }
      });
      get()._persist();
    },

    upgradeDivision: (id) => {
      set((state) => {
        const current = state.divisionLevels[id] ?? 1;
        if (current < 3) state.divisionLevels[id] = current + 1;
      });
      get()._persist();
    },

    unlockBlackMarket: () => {
      set((state) => {
        state.blackMarketUnlocked = true;
      });
      get()._persist();
    },

    incrementStat: (stat) => {
      set((state) => {
        if (stat === 'agents') {
          state.totalAgentsLost++;
        } else {
          state.totalExpansions++;
        }
      });
      get()._persist();
    },
    incrementMissionAttempted: () => {
      set((state) => {
        state.totalMissionsAttempted++;
      });
      get()._persist();
    },
    incrementMissionCompleted: () => {
      set((state) => {
        state.totalMissionsCompleted++;
        state.rivalAggressionLevel = Math.floor(
          state.totalMissionsCompleted / 25,
        );
      });
      get()._persist();
    },
    getPlayTimeSecs: () =>
      _loadedPlayTime + Math.round((Date.now() - _sessionStartedAt) / 1000),
    reset: () => {
      set((state) => {
        state.loaded = false;
        state.agencyName = '';
        state.bossName = '';
        state.startCityId = '';
        state.logoId = '';
        state.createdAt = 0;
        state.currencies = { money: 0, intel: 0, shadow: 0, influence: 0 };
        state.unlockedDivisions = [];
        state.divisionLevels = {} as Record<DivisionId, number>;
        state.blackMarketUnlocked = false;
        state.totalMissionsCompleted = 0;
        state.totalMissionsAttempted = 0;
        state.totalAgentsLost = 0;
        state.totalExpansions = 0;
        state.activeWorldEvent = null;
        state.nextWorldEventAt = 0;
        state.rivalName = '';
        state.nextRivalOperationAt = 0;
        state.activeRivalOperation = null;
        state.rivalAggressionLevel = 0;
        state.directorAgentId = null;
        state.unlockedAchievements = [];
        state.achievementCounters = { ...DEFAULT_ACHIEVEMENT_COUNTERS };
      });
    },
    unlockAchievement: (id) => {
      const already = get().unlockedAchievements.includes(id);
      if (already) return false;
      set((state) => {
        state.unlockedAchievements.push(id);
      });
      get()._persist();
      return true;
    },
    incrementAchievementCounter: (key, by = 1) => {
      set((state) => {
        (state.achievementCounters[key] as number) += by;
      });
      get()._persist();
    },
    setAchievementCounterString: (key, value) => {
      set((state) => {
        (state.achievementCounters[key] as string) = value;
      });
      get()._persist();
    },
    pushMissionTimestamp: (ts) => {
      set((state) => {
        const existing = state.achievementCounters.missionsCompletedTimestamps ?? [];
        const updated = [...existing, ts].slice(-20);
        state.achievementCounters.missionsCompletedTimestamps = updated;
      });
      get()._persist();
    },
    setWorldEvent: (event, nextAt) => {
      set((state) => {
        state.activeWorldEvent = event;
        if (nextAt !== undefined) state.nextWorldEventAt = nextAt;
      });
      get()._persist();
    },
    setRivalOperation: (op, nextAt) => {
      set((state) => {
        state.activeRivalOperation = op;
        if (nextAt !== undefined) state.nextRivalOperationAt = nextAt;
      });
      get()._persist();
    },
    setDirectorAgent: (agentId) => {
      set((state) => {
        state.directorAgentId = agentId;
      });
      get()._persist();
    },
    _persist: () => {
      const s = get();
      if (!s.loaded) return;
      db.gameState.put({
        id: 1,
        agencyName: s.agencyName,
        bossName: s.bossName,
        startCityId: s.startCityId,
        logoId: s.logoId,
        createdAt: s.createdAt,
        lastSavedAt: Date.now(),
        totalPlayTime:
          _loadedPlayTime + Math.round((Date.now() - _sessionStartedAt) / 1000),
        money: s.currencies.money,
        intel: s.currencies.intel,
        shadow: s.currencies.shadow,
        influence: s.currencies.influence,
        blackMarketUnlocked: s.blackMarketUnlocked,
        unlockedDivisions: s.unlockedDivisions,
        divisionLevels: s.divisionLevels,
        totalMissionsCompleted: s.totalMissionsCompleted,
        totalMissionsAttempted: s.totalMissionsAttempted,
        totalAgentsLost: s.totalAgentsLost,
        totalExpansions: s.totalExpansions,
        activeWorldEvent: s.activeWorldEvent ?? undefined,
        nextWorldEventAt: s.nextWorldEventAt,
        rivalName: s.rivalName,
        nextRivalOperationAt: s.nextRivalOperationAt,
        activeRivalOperation: s.activeRivalOperation ?? undefined,
        rivalAggressionLevel: s.rivalAggressionLevel,
        directorAgentId: s.directorAgentId ?? undefined,
        unlockedAchievements: s.unlockedAchievements,
        achievementCounters: s.achievementCounters,
      });
      // Keep meta snapshot in sync for the slot picker display
      const slotId = localStorage.getItem('shadow-ops-active-slot');
      if (slotId) {
        metaDb.slots.update(slotId, {
          lastSavedAt: Date.now(),
          money: s.currencies.money,
          intel: s.currencies.intel,
          totalMissionsCompleted: s.totalMissionsCompleted,
        });
      }
    },
  })),
);
