import { useEffect, useRef } from 'react';
import { db } from '../db/db';
import {
  calculatePassiveIncome,
  decayAlertLevel,
} from '../engine/passiveIncome';
import { generateCounterOp } from '../engine/missionGenerator';
import {
  pickRandomEvent,
  getEventDef,
  getEventAlertDecayMult,
} from '../engine/worldEvents';
import {
  applyRivalOperation,
  createRivalOperation,
  nextRivalOperationAt,
  notifyRival,
  pickRivalEventType,
  RIVAL_EVENT_META,
} from '../engine/rival';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { DivisionId } from '../data/agentTypes';
import type { ActiveWorldEvent, Mission } from '../db/schema';
import { REGION_MAP } from '../data/regions';

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

    async function hasActiveCounter(regionId: string): Promise<boolean> {
      const region = await db.regions.get(regionId);
      const ids = region?.availableMissionIds ?? [];
      if (ids.length > 0) {
        const missions = (await db.missions.bulkGet(ids)).filter(
          Boolean,
        ) as Mission[];
        if (
          missions.some(
            (m) => m.isCounterOp && (!m.expiresAt || m.expiresAt > Date.now()),
          )
        ) {
          return true;
        }
      }
      const active = await db.activeMissions.toArray();
      if (!active.length) return false;
      const activeDefs = (
        await db.missions.bulkGet(active.map((a) => a.missionId))
      ).filter(Boolean) as Mission[];
      return activeDefs.some((m) => m.regionId === regionId && m.isCounterOp);
    }

    async function ensureCounterOp(
      regionId: string,
      alertLevel: number,
      rivalOperationId?: string,
    ): Promise<void> {
      if (await hasActiveCounter(regionId)) return;
      const counter = generateCounterOp(regionId, alertLevel, rivalOperationId);
      await db.missions.add(counter);
      const region = await db.regions.get(regionId);
      if (!region) return;
      await db.regions.update(regionId, {
        availableMissionIds: [...region.availableMissionIds, counter.id],
      });
      const regionName = REGION_MAP.get(regionId)?.name ?? 'neznámém regionu';
      notifyRival('warning', `Counter-Op dostupná v ${regionName}.`);
    }

    async function tick() {
      const now = Date.now();
      const gameStore = useGameStore.getState();
      const {
        activeWorldEvent,
        nextWorldEventAt,
        activeRivalOperation,
        nextRivalOperationAt: nextRivalAt,
      } = gameStore;

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

      // ── Rival scheduler ──────────────────────────────────────────────────
      if (activeRivalOperation && activeRivalOperation.expiresAt <= now) {
        const summary = await applyRivalOperation(activeRivalOperation);
        gameStore.setRivalOperation(null, nextRivalOperationAt(now));
        notifyRival('error', summary);
      }

      const freshRival = useGameStore.getState().activeRivalOperation;
      if (!freshRival && (!nextRivalAt || nextRivalAt <= 0)) {
        gameStore.setRivalOperation(null, nextRivalOperationAt(now));
      }
      if (!freshRival && nextRivalAt > 0 && nextRivalAt <= now) {
        const owned = await db.regions
          .filter((r) => r.owned && r.alertLevel >= 1.5)
          .toArray();
        if (owned.length > 0) {
          const target = owned[Math.floor(Math.random() * owned.length)];
          const eventType = pickRivalEventType();
          const op = createRivalOperation(target.id, eventType, now);
          gameStore.setRivalOperation(op, nextRivalOperationAt(now));
          const targetName =
            REGION_MAP.get(target.id)?.name ?? 'neznámém regionu';
          notifyRival(
            'warning',
            `Rival operace: ${RIVAL_EVENT_META[eventType].label} v ${targetName}.`,
          );
          await ensureCounterOp(target.id, target.alertLevel, op.id);
        } else {
          gameStore.setRivalOperation(null, nextRivalOperationAt(now));
        }
      }

      // Counter-op auto-generation from alert thresholds
      const ownedNow = await db.regions.filter((r) => r.owned).toArray();
      for (const region of ownedNow) {
        const mustSpawn = region.alertLevel >= 2.5;
        const chanceSpawn = region.alertLevel >= 2.0 && Math.random() < 0.1;
        if (mustSpawn || chanceSpawn) {
          await ensureCounterOp(region.id, region.alertLevel);
        }
      }

      const [safeHouses, agents] = await Promise.all([
        db.safeHouses.toArray(),
        db.agents.toArray(),
      ]);

      // Remove expired temporary module sabotage effects
      for (const sh of safeHouses) {
        const activeDisabled = (sh.disabledModules ?? []).filter(
          (m) => m.until > now,
        );
        if (activeDisabled.length !== (sh.disabledModules ?? []).length) {
          await db.safeHouses.update(sh.id, {
            disabledModules: activeDisabled,
          });
        }
      }

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
        if (region.rivalLeakUntil && region.rivalLeakUntil <= now) {
          await db.regions.update(region.id, { rivalLeakUntil: undefined });
        }
        if (region.burnedContractsUntil && region.burnedContractsUntil <= now) {
          await db.regions.update(region.id, {
            burnedContractsUntil: undefined,
          });
        }
        const sh = safeHouses.find((s) => s.id === region.id);
        const hasSurv =
          sh?.assignedDivisions.includes('surveillance' as DivisionId) ?? false;
        const jammerDisabled = (sh?.disabledModules ?? []).some(
          (m) => m.moduleId === 'signal_jammer' && m.until > now,
        );
        const hasJammer =
          (sh?.modules.includes('signal_jammer') ?? false) && !jammerDisabled;
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
