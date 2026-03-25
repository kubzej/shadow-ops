import { useEffect, useRef } from 'react';
import { db } from '../db/db';
import {
  calculatePassiveIncome,
  decayAlertLevel,
} from '../engine/passiveIncome';
import {
  pickRandomEvent,
  getEventDef,
  getEventAlertDecayMult,
} from '../engine/worldEvents';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { DivisionId } from '../data/agentTypes';
import type { ActiveWorldEvent } from '../db/schema';

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
      const now = Date.now();
      const gameStore = useGameStore.getState();
      const { activeWorldEvent, nextWorldEventAt } = gameStore;

      // ── World Event scheduler ────────────────────────────────────────────
      // 1. Clear expired event
      if (activeWorldEvent && activeWorldEvent.expiresAt <= now) {
        const def = getEventDef(activeWorldEvent);
        gameStore.setWorldEvent(null, now + 20 * 60 * 1000);
        useUIStore
          .getState()
          .showToast('info', `Událost "${def?.name ?? ''}" skončila.`);
      }

      // 2. Activate new event if scheduled
      const fresh = useGameStore.getState()
        .activeWorldEvent as ActiveWorldEvent | null;
      const effectiveNext = nextWorldEventAt || 0;
      if (!fresh) {
        if (!nextWorldEventAt) {
          // First boot — initialise schedule
          gameStore.setWorldEvent(null, now + 5 * 60 * 1000);
        } else if (effectiveNext <= now) {
          const eventDef = pickRandomEvent();
          const expiresAt = now + eventDef.durationMs;
          // Apply immediate activation effects
          if (eventDef.onActivateAlertBonus) {
            const owned = await db.regions.filter((r) => r.owned).toArray();
            for (const r of owned) {
              await db.regions.update(r.id, {
                alertLevel: Math.min(
                  3,
                  (r.alertLevel ?? 0) + eventDef.onActivateAlertBonus!,
                ),
              });
            }
          }
          gameStore.setWorldEvent(
            { eventId: eventDef.id, startedAt: now, expiresAt },
            expiresAt + 20 * 60 * 1000,
          );
          useUIStore
            .getState()
            .showToast(
              eventDef.positive ? 'success' : 'warning',
              `${eventDef.name}: ${eventDef.description}`,
            );
        }
      }

      // Current event after scheduling (may have just been set)
      const currentEvent = useGameStore.getState()
        .activeWorldEvent as ActiveWorldEvent | null;
      const alertDecayMult = getEventAlertDecayMult(currentEvent);
      // ────────────────────────────────────────────────────────────────────

      const [safeHouses, agents] = await Promise.all([
        db.safeHouses.toArray(),
        db.agents.toArray(),
      ]);

      // Calculate + apply income
      const income = calculatePassiveIncome(
        safeHouses,
        divLevelsRef.current,
        agents,
      );
      if (income.money || income.intel || income.shadow || income.influence) {
        addCurrencies({
          money: Math.round(income.money),
          intel: Math.round(income.intel),
          shadow: Math.round(income.shadow),
          influence: Math.round(income.influence),
        });
      }

      // Decay alert levels for all regions with elevated alert
      const alertedRegions = await db.regions
        .filter((r) => r.alertLevel > 0)
        .toArray();
      for (const region of alertedRegions) {
        const sh = safeHouses.find((s) => s.id === region.id);
        const hasSurv =
          sh?.assignedDivisions.includes('surveillance' as DivisionId) ?? false;
        const hasJammer = sh?.modules.includes('signal_jammer') ?? false;
        const stdAlert = decayAlertLevel(region.alertLevel, hasSurv, hasJammer);
        // Amplify decay when Media Frenzy is active
        const decay = region.alertLevel - stdAlert;
        const newAlert = Math.max(
          0,
          region.alertLevel - decay * alertDecayMult,
        );
        if (Math.abs(newAlert - region.alertLevel) > 0.001) {
          await db.regions.update(region.id, { alertLevel: newAlert });
        }
      }
    }

    tick(); // run once immediately on mount, then every 30s
    const id = setInterval(tick, TICK_INTERVAL);
    return () => clearInterval(id);
  }, [loaded, addCurrencies]);
}
