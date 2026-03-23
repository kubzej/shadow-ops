import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DivisionId } from '../data/agentTypes';
import { db } from '../db/db';
import { metaDb } from '../db/saveSlots';

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

  // ── Actions ───────────────────────────────────
  setLoaded: (meta: {
    agencyName: string;
    bossName: string;
    startCityId: string;
    logoId: string;
    createdAt: number;
    currencies: Currencies;
    unlockedDivisions: DivisionId[];
    divisionLevels: Record<DivisionId, number>;
    blackMarketUnlocked: boolean;
    totalMissionsCompleted: number;
    totalMissionsAttempted: number;
    totalAgentsLost: number;
    totalExpansions: number;
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
      }),

    addCurrencies: (delta) => {
      set((state) => {
        if (delta.money !== undefined) state.currencies.money += delta.money;
        if (delta.intel !== undefined) state.currencies.intel += delta.intel;
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
        if (cost.money !== undefined) state.currencies.money -= cost.money;
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
        if (stat === 'missions') {
          state.totalMissionsCompleted++;
          state.totalMissionsAttempted++;
        } else if (stat === 'agents') {
          state.totalAgentsLost++;
        } else {
          state.totalExpansions++;
        }
      });
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
      });
      get()._persist();
    },
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
      });
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
        totalPlayTime: 0,
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
