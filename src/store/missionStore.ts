import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { db } from '../db/db';
import type {
  Mission,
  ActiveMission,
  Agent,
  MissionLogEntry,
} from '../db/schema';
import type { MissionResult } from '../db/schema';
import {
  dispatchMission as engineDispatch,
  resolveMission,
  distributeXp,
  rollInjury,
  rollInjuryDescription,
  healingDuration,
  type MissionApproach,
} from '../engine/missionResolver';
import { canRankUp, rankUp } from '../engine/agentGenerator';
import {
  generateMissionsForRegion,
  missionsNeeded,
  generateRescueMission,
  generateChainMission,
  generateFlashMission,
  MISSION_REGEN_INTERVAL_MS,
  MAX_MISSIONS_PER_REGION,
  FLASH_MISSION_INTERVAL_MIN_MS,
  FLASH_MISSION_INTERVAL_MAX_MS,
  FLASH_MISSION_MIN_TIER,
  FLASH_MISSION_SHADOW_BONUS,
} from '../engine/missionGenerator';
import {
  applyRivalOperation,
  notifyRival,
  RIVAL_EVENT_META,
} from '../engine/rival';
import { createRng } from '../utils/rng';
import { useGameStore } from './gameStore';
import { useUIStore } from './uiStore';
import {
  applyEventRewards,
  getEventAlertGainMult,
  getEventSuccessChancePenalty,
  isCategoryBlockedByEvent,
  getEventDef,
} from '../engine/worldEvents';
import { randomId } from '../utils/rng';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';

const RESCUE_EQUIPMENT_SELL_REFUND = 0.3;

// Debounce flash spawn checks to run at most every 30s inside the 1s tick
let _lastFlashCheck = 0;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface InjuredAgentInfo {
  id: string;
  name: string;
  severity: string;
  description?: string;
  healsAt: number;
}

export interface CompletedMissionResult {
  activeMission: ActiveMission;
  mission: Mission;
  result: MissionResult;
  rewards: import('../db/schema').MissionRewards;
  alertGain: number;
  affectedAgentIds: string[];
  injuredAgents: InjuredAgentInfo[];
  rankedUpAgents: Array<{
    id: string;
    name: string;
    newRank: string;
    nickname?: string;
  }>;
  killedAgent?: { id: string; name: string };
  lostEquipment?: Array<{ id: string; name: string }>;
  rivalOutcome?: { neutralized: boolean; eventLabel: string; summary: string };
}

interface MissionStore {
  // ── State ─────────────────────────────────
  availableMissions: Mission[];
  activeMissions: ActiveMission[];
  completedQueue: CompletedMissionResult[]; // waiting to be shown to user

  // ── Loading ───────────────────────────────
  loading: boolean;

  // ── Actions ───────────────────────────────
  loadMissions: (regionId: string) => Promise<void>;
  loadActiveMissions: () => Promise<void>;

  dispatch: (
    mission: Mission,
    agents: Agent[],
    equippedIds?: string[],
    approach?: MissionApproach,
  ) => Promise<void>;
  collectResult: (
    activeMissionId: string,
  ) => Promise<CompletedMissionResult | null>;
  dismissResult: (activeMissionId: string) => void;

  /** Called every second by useMissionTimer — moves completed missions into queue. */
  tickMissions: () => Promise<void>;

  /** Check for and remove expired missions, top up region missions if needed. */
  checkExpirations: (regionId: string) => Promise<void>;

  /** Clear non-rescue missions for a region and immediately regenerate with current divisions. */
  invalidateRegionMissions: (regionId: string) => Promise<void>;

  /** Forcefully refresh active missions from DB (e.g. after reopening app). */
  refreshActive: () => Promise<void>;
}

// ─────────────────────────────────────────────
// Flash Operation spawn helper (called from tickMissions, debounced to 30s)
// ─────────────────────────────────────────────

async function _spawnFlashMissionsIfDue(now: number): Promise<void> {
  // Find all owned regions with missionTier >= FLASH_MISSION_MIN_TIER
  const eligibleRegions = await db.regions
    .filter((r) => r.owned && (r.missionTier ?? 0) >= FLASH_MISSION_MIN_TIER)
    .toArray();

  for (const region of eligibleRegions) {
    const nextAt = region.nextFlashMissionAt ?? 0;
    if (now < nextAt) continue;

    // Skip if there is already an active flash mission for this region
    const ids = region.availableMissionIds;
    const existing = (await db.missions.bulkGet(ids)).filter(
      Boolean,
    ) as import('../db/schema').Mission[];
    const alreadyHasFlash = existing.some((m) => m.isFlash);
    if (alreadyHasFlash) {
      // Still schedule the next check even if we skip spawning this cycle
      const nextInterval =
        FLASH_MISSION_INTERVAL_MIN_MS +
        Math.random() *
          (FLASH_MISSION_INTERVAL_MAX_MS - FLASH_MISSION_INTERVAL_MIN_MS);
      await db.regions.update(region.id, {
        nextFlashMissionAt: now + nextInterval,
      });
      continue;
    }

    // Spawn the flash mission
    const safehouse = await db.safeHouses.get(region.id);
    const assignedDivisions = safehouse?.assignedDivisions?.filter(
      (d) => d !== 'medical',
    );
    const flash = generateFlashMission(
      region.id,
      region.alertLevel ?? 0,
      assignedDivisions,
    );

    await db.missions.add(flash);
    const nextInterval =
      FLASH_MISSION_INTERVAL_MIN_MS +
      Math.random() *
        (FLASH_MISSION_INTERVAL_MAX_MS - FLASH_MISSION_INTERVAL_MIN_MS);
    await db.regions.update(region.id, {
      availableMissionIds: [...ids, flash.id],
      nextFlashMissionAt: now + nextInterval,
    });

    useUIStore
      .getState()
      .showToast(
        'info',
        `⚡ Urgentní mise v ${region.id} — 5 minut na odeslání!`,
      );
  }
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

let _ticking = false;

export const useMissionStore = create<MissionStore>()(
  immer((set, get) => ({
    availableMissions: [],
    activeMissions: [],
    completedQueue: [],
    loading: false,

    // ── Load available missions for a region ───
    loadMissions: async (regionId) => {
      set((s) => {
        s.loading = true;
      });
      const region = await db.regions.get(regionId);
      const ids = region?.availableMissionIds ?? [];
      const missions =
        ids.length > 0
          ? await db.missions
              .bulkGet(ids)
              .then((ms) => ms.filter(Boolean) as Mission[])
          : [];
      set((s) => {
        s.availableMissions = missions;
        s.loading = false;
      });
    },

    // ── Load active missions from DB ───────────
    loadActiveMissions: async () => {
      // Use filter() so records with collected=undefined are also matched
      const active = await db.activeMissions
        .filter((a) => !a.collected)
        .toArray();
      set((s) => {
        s.activeMissions = active;
      });
    },

    // ── Dispatch a mission ─────────────────────
    dispatch: async (
      mission,
      agents,
      equippedIds = [],
      approach = 'standard',
    ) => {
      const regionForCost = await db.regions.get(mission.regionId);
      const rivalLeakExtraCost =
        regionForCost?.rivalLeakUntil &&
        regionForCost.rivalLeakUntil > Date.now()
          ? 3
          : 0;
      const effectiveIntelCost = (mission.intelCost ?? 0) + rivalLeakExtraCost;

      // Check intel affordability before touching DB
      if (
        effectiveIntelCost > 0 &&
        !useGameStore.getState().canAfford({ intel: effectiveIntelCost })
      ) {
        return;
      }

      // Check if a world event is blocking this mission category
      const currentEvent = useGameStore.getState().activeWorldEvent;
      if (isCategoryBlockedByEvent(mission.category, currentEvent)) {
        const eventDef = getEventDef(currentEvent);
        useUIStore
          .getState()
          .showToast(
            'warning',
            `${eventDef?.name ?? 'Globální událost'}: kategorie mise není dostupná`,
          );
        return;
      }

      // Read current alert level for the region before dispatching
      const region = await db.regions.get(mission.regionId);
      const alertLevel = region?.alertLevel ?? 0;
      const activeMission = engineDispatch(
        mission,
        agents,
        equippedIds,
        alertLevel,
        approach,
      );

      // Persist — intel is deducted only after the transaction succeeds
      await db.transaction(
        'rw',
        [db.activeMissions, db.agents, db.missions, db.regions],
        async () => {
          await db.activeMissions.add(activeMission);

          // Mark agents as on_mission
          for (const agent of agents) {
            await db.agents.update(agent.id, { status: 'on_mission' });
          }

          // Remove mission from region's available list
          const regionInTx = await db.regions.get(mission.regionId);
          if (regionInTx) {
            const newIds = regionInTx.availableMissionIds.filter(
              (id) => id !== mission.id,
            );
            await db.regions.update(mission.regionId, {
              availableMissionIds: newIds,
            });
          }
        },
      );

      // Deduct intel only after DB transaction succeeded
      if (effectiveIntelCost > 0) {
        useGameStore.getState().spendCurrencies({ intel: effectiveIntelCost });
      }

      // Update store
      set((s) => {
        s.activeMissions.push(activeMission);
        s.availableMissions = s.availableMissions.filter(
          (m) => m.id !== mission.id,
        );
      });

      // Track attempt
      useGameStore.getState().incrementMissionAttempted();
    },

    // ── Collect (resolve) a result ─────────────
    collectResult: async (activeMissionId) => {
      const activeMission = await db.activeMissions.get(activeMissionId);
      if (!activeMission) return null;
      if (activeMission.collected) return null; // idempotency guard

      const mission = await db.missions.get(activeMission.missionId);
      if (!mission) return null;

      // Apply world event modifiers
      const activeEvent = useGameStore.getState().activeWorldEvent;
      const scPenalty = getEventSuccessChancePenalty(activeEvent);
      const missionToResolve =
        scPenalty > 0
          ? {
              ...activeMission,
              successChance: Math.max(
                0.05,
                activeMission.successChance - scPenalty,
              ),
            }
          : activeMission;

      const {
        result,
        rewards: rawRewards,
        alertGain: rawAlertGain,
      } = resolveMission(missionToResolve, mission);

      // Apply event reward multipliers and alert gain multiplier
      const rewards = applyEventRewards(
        rawRewards,
        mission.category,
        activeEvent,
      );
      const alertGain = rawAlertGain * getEventAlertGainMult(activeEvent);

      // Fetch agents — if none found (DB corruption), abort to avoid stuck on_mission state
      const agents = (await db.agents.bulkGet(activeMission.agentIds)).filter(
        Boolean,
      ) as Agent[];
      if (agents.length === 0) return null;

      // Fetch safe house modules for this region
      const missionSafeHouse = await db.safeHouses.get(mission.regionId);
      const shModules = missionSafeHouse?.modules ?? [];
      const hasTrainingCenter = shModules.includes('training_center');
      const hasBlackSite = shModules.includes('black_site');
      const hasMedBay = shModules.includes('med_bay');
      const hasSaferoom = shModules.includes('saferoom');

      // Apply module adjustments
      const basePerAgentXp = distributeXp(result, rewards.xp, agents.length);
      const perAgentXp = hasTrainingCenter
        ? Math.round(basePerAgentXp * 1.25)
        : basePerAgentXp;
      const effectiveAlertGain = hasBlackSite ? alertGain * 0.8 : alertGain;

      const affectedAgentIds: string[] = [];
      const injuredAgents: InjuredAgentInfo[] = [];
      let saferoomPreventedCapture = false;
      const rankedUpAgents: Array<{
        id: string;
        name: string;
        newRank: string;
        nickname?: string;
      }> = [];
      let killedAgent: { id: string; name: string } | undefined;
      let lostEquipment: Array<{ id: string; name: string }> | undefined;

      // Pre-generate rescue mission for catastrophe so captured agent always
      // gets rescueMissionId in the same update that sets status: 'captured'
      let catastropheRescueMission: Mission | null = null;
      if (result === 'catastrophe' && agents.length > 0) {
        const captureRegion = await db.regions.get(mission.regionId);
        catastropheRescueMission = generateRescueMission(
          mission.regionId,
          agents[0].id,
          agents[0].name,
          captureRegion?.alertLevel ?? 0,
        );
      }

      await db.transaction(
        'rw',
        [db.activeMissions, db.agents, db.regions, db.missions, db.missionLog],
        async () => {
          // Mark mission collected
          await db.activeMissions.update(activeMissionId, {
            result,
            collected: true,
          });

          // Apply to each agent
          for (const agent of agents) {
            const injury = rollInjury(result, mission.difficulty);
            let healTime = healingDuration(injury);
            if (hasMedBay && healTime > 0) healTime = Math.ceil(healTime / 2);

            const updatedAgent: Partial<Agent> = {
              status: 'available',
              xp: agent.xp + perAgentXp,
              missionsAttempted: agent.missionsAttempted + 1,
            };

            if (result === 'success' || result === 'partial') {
              updatedAgent.missionsCompleted =
                (agent.missionsCompleted ?? 0) + 1;
            }

            // Streak: increment only on clean success (no injury), reset otherwise
            updatedAgent.missionStreak =
              result === 'success' && injury === 'none'
                ? (agent.missionStreak ?? 0) + 1
                : 0;

            if (injury !== 'none') {
              const injuryDesc = rollInjuryDescription(
                mission.category,
                injury,
                createRng(),
              );
              updatedAgent.status = 'injured';
              updatedAgent.injuredAt = Date.now();
              updatedAgent.healsAt = Date.now() + healTime * 1000;
              updatedAgent.injuryDescription = injuryDesc;
              affectedAgentIds.push(agent.id);
              injuredAgents.push({
                id: agent.id,
                name: agent.name,
                severity: injury,
                description: injuryDesc,
                healsAt: Date.now() + healTime * 1000,
              });
            }

            // Catastrophe: capture one agent (first in list)
            // rescueMissionId is set atomically here to avoid stuck captured state
            if (result === 'catastrophe' && agent.id === agents[0].id) {
              const saferoomSave = hasSaferoom && createRng()() < 0.3;
              if (saferoomSave) {
                // Saferoom: agent evades capture, suffers serious injury instead
                saferoomPreventedCapture = true;
                const injuryDesc = rollInjuryDescription(
                  mission.category,
                  'serious',
                  createRng(),
                );
                const seriousHealTime = hasMedBay
                  ? Math.ceil(healingDuration('serious') / 2)
                  : healingDuration('serious');
                updatedAgent.status = 'injured';
                updatedAgent.injuredAt = Date.now();
                updatedAgent.healsAt = Date.now() + seriousHealTime * 1000;
                updatedAgent.injuryDescription = injuryDesc;
                const existingIdx = injuredAgents.findIndex(
                  (ia) => ia.id === agent.id,
                );
                const saferoomInjury: InjuredAgentInfo = {
                  id: agent.id,
                  name: agent.name,
                  severity: 'serious',
                  description: injuryDesc,
                  healsAt: Date.now() + seriousHealTime * 1000,
                };
                if (existingIdx >= 0) {
                  injuredAgents[existingIdx] = saferoomInjury;
                } else {
                  injuredAgents.push(saferoomInjury);
                }
                if (!affectedAgentIds.includes(agent.id))
                  affectedAgentIds.push(agent.id);
              } else {
                updatedAgent.status = 'captured';
                updatedAgent.capturedAt = Date.now();
                if (catastropheRescueMission) {
                  updatedAgent.rescueMissionId = catastropheRescueMission.id;
                }
                affectedAgentIds.push(agent.id);
              }
            }

            const merged = { ...agent, ...updatedAgent };

            // Rank up if eligible
            if (canRankUp(merged as Agent)) {
              const ranked = rankUp(merged as Agent);
              await db.agents.put(ranked);
              rankedUpAgents.push({
                id: agent.id,
                name: agent.name,
                newRank: ranked.rank,
                nickname: ranked.nickname,
              });
            } else {
              await db.agents.update(agent.id, updatedAgent);
            }
          }

          // ── Rescue mission outcomes ──────────────────────────────────────
          if (mission.isRescue && mission.capturedAgentId) {
            const capturedAgent = await db.agents.get(mission.capturedAgentId);

            if (result === 'success') {
              // Agent freed, all equipment intact
              await db.agents.update(mission.capturedAgentId, {
                status: 'available',
                capturedAt: undefined,
                rescueMissionId: undefined,
              });
            } else if (result === 'partial') {
              // Agent freed, but all equipment is lost — sold at 30% refund
              if (capturedAgent) {
                let refund = 0;
                const lost: Array<{ id: string; name: string }> = [];
                for (const slot of capturedAgent.equipment) {
                  if (!slot.equipmentId) continue;
                  const eq = EQUIPMENT_CATALOG.find(
                    (e) => e.id === slot.equipmentId,
                  );
                  if (eq) {
                    refund += Math.ceil(
                      (eq.costMoney ?? 0) * RESCUE_EQUIPMENT_SELL_REFUND,
                    );
                    lost.push({ id: eq.id, name: eq.name });
                  }
                }
                if (lost.length > 0) lostEquipment = lost;
                const cleared = capturedAgent.equipment.map(() => ({
                  equipmentId: null,
                }));
                await db.agents.update(mission.capturedAgentId, {
                  status: 'available',
                  capturedAt: undefined,
                  rescueMissionId: undefined,
                  equipment: cleared,
                  stats: capturedAgent.baseStats,
                });
                if (refund > 0) {
                  useGameStore.getState().addCurrencies({ money: refund });
                }
              } else {
                await db.agents.update(mission.capturedAgentId, {
                  status: 'available',
                  capturedAt: undefined,
                  rescueMissionId: undefined,
                });
              }
            } else {
              // failure or catastrophe — escalate or kill
              if (capturedAgent) {
                const nextDiff = Math.min(
                  5,
                  (mission.difficulty as number) + 1,
                ) as 1 | 2 | 3 | 4 | 5;
                if ((mission.difficulty as number) >= 5) {
                  // No escape — agent dies, equipment lost
                  killedAgent = {
                    id: capturedAgent.id,
                    name: capturedAgent.name,
                  };
                  await db.agents.update(mission.capturedAgentId, {
                    status: 'dead',
                  });
                  useGameStore.getState().incrementStat('agents');
                } else {
                  // Escalate: generate harder rescue mission
                  const escalated = generateRescueMission(
                    mission.regionId,
                    mission.capturedAgentId,
                    capturedAgent.name,
                    Math.min(
                      3,
                      (await db.regions.get(mission.regionId))?.alertLevel ?? 0,
                    ),
                  );
                  // Force difficulty to escalated level (overrides alert-based calc)
                  const escalatedMission = {
                    ...escalated,
                    difficulty: nextDiff,
                    baseSuccessChance: Math.max(
                      0.05,
                      0.7 - (nextDiff - 2) * 0.1,
                    ),
                    expiresAt: Date.now() + 15 * 60 * 1000,
                  };
                  await db.missions.add(escalatedMission);
                  const r = await db.regions.get(mission.regionId);
                  if (r) {
                    await db.regions.update(mission.regionId, {
                      availableMissionIds: [
                        ...r.availableMissionIds,
                        escalatedMission.id,
                      ],
                    });
                  }
                  await db.agents.update(mission.capturedAgentId, {
                    rescueMissionId: escalatedMission.id,
                  });
                }
              }
            }
          }

          // Persist the pre-generated rescue mission (agent already has rescueMissionId set above)
          if (catastropheRescueMission && !saferoomPreventedCapture) {
            await db.missions.add(catastropheRescueMission);
            const captureRegion = await db.regions.get(mission.regionId);
            const regionIds = captureRegion?.availableMissionIds ?? [];
            await db.regions.update(mission.regionId, {
              availableMissionIds: [...regionIds, catastropheRescueMission.id],
            });
          }

          // Update region alert level + missionTier
          const region = await db.regions.get(mission.regionId);
          if (region) {
            const newAlert = Math.min(
              3,
              (region.alertLevel ?? 0) + effectiveAlertGain,
            );
            const regionUpdates: Partial<typeof region> = {
              alertLevel: newAlert,
            };
            // missionTier increases after success/partial — never decreases
            // Each tier requires progressively more missions: tier 1 after 8, tier 2 after 20, tier 3 after 45, tier 4 after 80
            if (result === 'success' || result === 'partial') {
              const currentTier = region.missionTier ?? 0;
              const missionsDone =
                (await db.missionLog
                  .where('regionId')
                  .equals(mission.regionId)
                  .count()) + 1;
              const TIER_THRESHOLDS = [0, 8, 20, 45, 80];
              const newTier = TIER_THRESHOLDS.reduce(
                (t, threshold, i) => (missionsDone >= threshold ? i : t),
                0,
              );
              if (newTier > currentTier) regionUpdates.missionTier = newTier;
            }
            await db.regions.update(mission.regionId, regionUpdates);
          }

          // Mission log
          const logEntry: MissionLogEntry = {
            id: randomId(),
            missionId: mission.id,
            activeMissionId,
            agentIds: activeMission.agentIds,
            regionId: mission.regionId,
            result,
            rewards,
            completedAt: Date.now(),
            alertGain: effectiveAlertGain,
          };
          await db.missionLog.add(logEntry);
        },
      );

      // Chain follow-up on success
      if (result === 'success' && mission.chainNextTargetId) {
        const chainRegion = await db.regions.get(mission.regionId);
        const chainSafehouse = await db.safeHouses.get(mission.regionId);
        const chainAssignedDivisions =
          chainSafehouse?.assignedDivisions?.filter((d) => d !== 'medical');
        const currentIds = chainRegion?.availableMissionIds ?? [];
        if (currentIds.length < MAX_MISSIONS_PER_REGION) {
          const followUp = generateChainMission(
            mission.regionId,
            chainRegion?.alertLevel ?? 0,
            mission.chainNextTargetId,
            (mission.chainStep ?? 0) + 1,
            mission.chainTotal,
            chainAssignedDivisions,
          );
          if (followUp) {
            await db.missions.add(followUp);
            await db.regions.update(mission.regionId, {
              availableMissionIds: [...currentIds, followUp.id],
            });
          }
        }
      }

      // Apply currency rewards to gameStore (flash missions get +8 shadow bonus)
      const gameStore = useGameStore.getState();
      const flashShadowBonus = mission.isFlash ? FLASH_MISSION_SHADOW_BONUS : 0;
      if (
        rewards.money ||
        rewards.intel ||
        rewards.shadow ||
        rewards.influence ||
        flashShadowBonus
      ) {
        gameStore.addCurrencies({
          money: rewards.money,
          intel: rewards.intel,
          shadow: rewards.shadow + flashShadowBonus,
          influence: rewards.influence,
        });
      }
      if (result === 'success') {
        gameStore.incrementMissionCompleted();
        // Unlock black market at 15 completed missions
        const freshState = useGameStore.getState();
        if (
          !freshState.blackMarketUnlocked &&
          freshState.totalMissionsCompleted >= 15
        ) {
          freshState.unlockBlackMarket();
        }
      }
      if (result === 'catastrophe' && !saferoomPreventedCapture) {
        gameStore.incrementStat('agents');
      }

      let rivalOutcome: CompletedMissionResult['rivalOutcome'];

      if (mission.isCounterOp && mission.rivalOperationId) {
        const rival = useGameStore.getState().activeRivalOperation;
        if (rival && rival.id === mission.rivalOperationId) {
          const eventMeta = RIVAL_EVENT_META[rival.eventType];
          if (result === 'success') {
            rivalOutcome = {
              neutralized: true,
              eventLabel: eventMeta.label,
              summary: 'Rival operace byla zablokována.',
            };
            useGameStore
              .getState()
              .setRivalOperation(
                null,
                useGameStore.getState().nextRivalOperationAt,
              );
            notifyRival(
              'success',
              'Counter-Op úspěšná. Rival operace byla zablokována.',
            );
          } else {
            const summary = await applyRivalOperation(rival);
            rivalOutcome = {
              neutralized: false,
              eventLabel: eventMeta.label,
              summary,
            };
            useGameStore
              .getState()
              .setRivalOperation(
                null,
                useGameStore.getState().nextRivalOperationAt,
              );
            notifyRival('error', summary);
          }
        }
      }

      const completedResult: CompletedMissionResult = {
        activeMission,
        mission,
        result,
        rewards,
        alertGain: effectiveAlertGain,
        affectedAgentIds,
        injuredAgents,
        rankedUpAgents,
        killedAgent,
        lostEquipment,
        rivalOutcome,
      };

      set((s) => {
        s.activeMissions = s.activeMissions.filter(
          (a) => a.id !== activeMissionId,
        );
        s.completedQueue.push(completedResult);
      });

      return completedResult;
    },

    // ── Dismiss result from queue ──────────────
    dismissResult: (activeMissionId) => {
      set((s) => {
        s.completedQueue = s.completedQueue.filter(
          (r) => r.activeMission.id !== activeMissionId,
        );
      });
    },

    // ── Tick: detect completed missions ────────
    tickMissions: async () => {
      if (_ticking) return;
      _ticking = true;
      try {
        const now = Date.now();

        // Auto-heal injured agents whose timer has expired
        const healed = await db.agents
          .filter(
            (a) => a.status === 'injured' && !!a.healsAt && a.healsAt <= now,
          )
          .toArray();
        for (const agent of healed) {
          await db.agents.update(agent.id, {
            status: 'available',
            healsAt: undefined,
            injuredAt: undefined,
            injuryDescription: undefined,
          });
        }

        // Kill captured agents whose rescue mission has expired
        const capturedAgents = await db.agents
          .filter((a) => a.status === 'captured' && !!a.rescueMissionId)
          .toArray();
        for (const agent of capturedAgents) {
          const rescueMission = await db.missions.get(agent.rescueMissionId!);
          if (
            !rescueMission ||
            (rescueMission.expiresAt && rescueMission.expiresAt < now)
          ) {
            // Rescue expired or mission gone — agent dies, equipment lost
            await db.agents.update(agent.id, {
              status: 'dead',
              rescueMissionId: undefined,
            });
            useGameStore.getState().incrementStat('agents');
            useUIStore
              .getState()
              .showToast(
                'error',
                `${agent.name} byl zabit — záchranná mise vypršela.`,
              );
          }
        }

        // Collect completed active missions
        const active = get().activeMissions;
        for (const am of active) {
          if (!am.result && am.completesAt <= now) {
            await get().collectResult(am.id);
          }
        }

        // Resolve completed travel
        const traveling = await db.agents
          .filter(
            (a) =>
              a.status === 'traveling' && !!a.arrivesAt && a.arrivesAt <= now,
          )
          .toArray();
        for (const agent of traveling) {
          await db.agents.update(agent.id, {
            status: 'available',
            safeHouseId: agent.travelDestinationId ?? agent.safeHouseId,
            travelDestinationId: undefined,
            arrivesAt: undefined,
          });
        }

        // Resolve expired Counter-Ops and apply consequences
        const expiredCounterMissions = await db.missions
          .filter((m) => !!m.isCounterOp && !!m.expiresAt && m.expiresAt <= now)
          .toArray();
        for (const mission of expiredCounterMissions) {
          const inProgress = await db.activeMissions
            .filter((a) => a.missionId === mission.id && !a.collected)
            .first();
          if (inProgress) continue;

          const region = await db.regions.get(mission.regionId);
          if (region) {
            const nextIds = region.availableMissionIds.filter(
              (id) => id !== mission.id,
            );
            await db.regions.update(region.id, {
              availableMissionIds: nextIds,
            });
          }

          const sh = await db.safeHouses.get(mission.regionId);
          if (sh && sh.modules.length > 0) {
            const removed =
              sh.modules[Math.floor(Math.random() * sh.modules.length)];
            await db.safeHouses.update(sh.id, {
              modules: sh.modules.filter((m) => m !== removed),
            });
            useUIStore
              .getState()
              .showToast(
                'error',
                `Counter-Op vypršela: ztracen modul ${removed}.`,
              );
          } else {
            useUIStore
              .getState()
              .showToast(
                'warning',
                'Counter-Op vypršela: žádný modul ke ztrátě.',
              );
          }

          if (mission.rivalOperationId) {
            const rival = useGameStore.getState().activeRivalOperation;
            if (rival && rival.id === mission.rivalOperationId) {
              const summary = await applyRivalOperation(rival);
              useGameStore
                .getState()
                .setRivalOperation(
                  null,
                  useGameStore.getState().nextRivalOperationAt,
                );
              notifyRival('error', summary);
            }
          }

          await db.missions.delete(mission.id);
        }

        // Global cleanup for expired non-counter missions (incl. Flash/Quick)
        // so they disappear even when region-specific checkExpirations is not running.
        const expiredRegularMissions = await db.missions
          .filter((m) => !m.isCounterOp && !!m.expiresAt && m.expiresAt <= now)
          .toArray();
        if (expiredRegularMissions.length > 0) {
          const missionIdsInProgress = new Set(
            (await db.activeMissions.filter((a) => !a.collected).toArray()).map(
              (a) => a.missionId,
            ),
          );

          for (const mission of expiredRegularMissions) {
            // Keep mission definition while active mission is still running/collectable
            if (missionIdsInProgress.has(mission.id)) continue;

            const region = await db.regions.get(mission.regionId);
            if (region) {
              await db.regions.update(region.id, {
                availableMissionIds: region.availableMissionIds.filter(
                  (id) => id !== mission.id,
                ),
              });
            }
            await db.missions.delete(mission.id);
          }
        }

        // Flash Operation spawn (debounced to 30s)
        if (now - _lastFlashCheck >= 30_000) {
          _lastFlashCheck = now;
          void _spawnFlashMissionsIfDue(now);
        }

        // Recover stuck agents: on_mission but no matching active mission in DB
        const onMissionAgents = await db.agents
          .filter((a) => a.status === 'on_mission')
          .toArray();
        if (onMissionAgents.length > 0) {
          const activeMissions = await db.activeMissions.toArray();
          const assignedAgentIds = new Set(
            activeMissions.flatMap((am) => am.agentIds),
          );
          for (const agent of onMissionAgents) {
            if (!assignedAgentIds.has(agent.id)) {
              await db.agents.update(agent.id, { status: 'available' });
            }
          }
        }
      } finally {
        _ticking = false;
      }
    },

    // ── Check expirations & top up missions ────
    checkExpirations: async (regionId) => {
      const now = Date.now();
      const region = await db.regions.get(regionId);
      if (!region) return;

      const ids = region.availableMissionIds;
      const missions = (await db.missions.bulkGet(ids)).filter(
        Boolean,
      ) as Mission[];

      // Remove expired
      const expired = missions.filter(
        (m) => !m.isCounterOp && m.expiresAt && m.expiresAt < now,
      );
      const valid = missions.filter((m) => !m.expiresAt || m.expiresAt >= now);

      if (expired.length > 0) {
        await db.missions.bulkDelete(expired.map((m) => m.id));
        await db.regions.update(regionId, {
          availableMissionIds: valid.map((m) => m.id),
        });
      }

      // Get safehouse divisions once — used for both topup and emergency easy
      const safehouse = await db.safeHouses.get(regionId);
      const availableDivisions = safehouse?.assignedDivisions?.filter(
        (d) => d !== 'medical',
      );
      const missionTier = region.missionTier ?? 0;

      // Emergency: if no diff-1 mission exists, inject one immediately by
      // replacing the most recently added non-diff-1 mission (or adding if under MAX).
      const hasDiff1 = valid.some((m) => m.difficulty === 1);
      let workingValid = valid;
      if (!hasDiff1) {
        const easyMission = generateMissionsForRegion(
          regionId,
          0,
          1,
          new Set(valid.map((m) => m.id)),
          availableDivisions,
          true,
          undefined, // guaranteeEasy overrides minDifficulty
        )[0];
        // If at max capacity, drop the newest non-rescue, non-flash mission to make room
        if (workingValid.length >= MAX_MISSIONS_PER_REGION) {
          const dropTarget = [...workingValid]
            .reverse()
            .find((m) => !m.isRescue && !m.isFlash);
          if (dropTarget) {
            await db.missions.delete(dropTarget.id);
            workingValid = workingValid.filter((m) => m.id !== dropTarget.id);
          }
        }
        await db.missions.add(easyMission);
        workingValid = [...workingValid, easyMission];
        await db.regions.update(regionId, {
          availableMissionIds: workingValid.map((m) => m.id),
          lastMissionGeneratedAt: now,
        });
        set((s) => {
          s.availableMissions = workingValid;
        });
        return; // pool is now fixed; skip regular topup this tick
      }

      // Top up to minimum if below MIN, or add 1 via timed regen if interval elapsed
      const needed = missionsNeeded(workingValid.length);
      const timedRegen =
        needed === 0 &&
        workingValid.length < MAX_MISSIONS_PER_REGION &&
        (region.lastMissionGeneratedAt === undefined ||
          now - region.lastMissionGeneratedAt >= MISSION_REGEN_INTERVAL_MS);
      const generateCount = needed > 0 ? needed : timedRegen ? 1 : 0;

      if (generateCount > 0) {
        const newMissions = generateMissionsForRegion(
          regionId,
          region.alertLevel ?? 0,
          generateCount,
          new Set(workingValid.map((m) => m.id)),
          availableDivisions,
          false,
          missionTier,
        );
        await db.missions.bulkAdd(newMissions);
        await db.regions.update(regionId, {
          availableMissionIds: [
            ...workingValid.map((m) => m.id),
            ...newMissions.map((m) => m.id),
          ],
          lastMissionGeneratedAt: now,
        });

        set((s) => {
          s.availableMissions = [...workingValid, ...newMissions];
        });
      } else {
        set((s) => {
          s.availableMissions = workingValid;
        });
      }
    },

    // ── Invalidate & regenerate missions for a region ──
    invalidateRegionMissions: async (regionId) => {
      const region = await db.regions.get(regionId);
      if (!region) return;
      const ids = region.availableMissionIds ?? [];
      const missions = (await db.missions.bulkGet(ids)).filter(
        Boolean,
      ) as Mission[];
      // Keep rescue missions, flash missions, and locked chain missions intact
      const toDelete = missions.filter(
        (m) => !m.isRescue && !m.isFlash && !m.lockedByDivision,
      );
      const toKeep = missions.filter(
        (m) => m.isRescue || m.isFlash || !!m.lockedByDivision,
      );
      if (toDelete.length > 0) {
        await db.missions.bulkDelete(toDelete.map((m) => m.id));
      }
      await db.regions.update(regionId, {
        availableMissionIds: toKeep.map((m) => m.id),
        lastMissionGeneratedAt: undefined, // reset so checkExpirations fires immediately
      });
      await get().checkExpirations(regionId);
    },

    // ── Refresh active from DB ─────────────────
    refreshActive: async () => {
      const active = await db.activeMissions
        .filter((a) => !a.collected)
        .toArray();
      set((s) => {
        s.activeMissions = active;
      });
    },
  })),
);
