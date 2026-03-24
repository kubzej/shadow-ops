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
  MISSION_REGEN_INTERVAL_MS,
  MAX_MISSIONS_PER_REGION,
} from '../engine/missionGenerator';
import { useGameStore } from './gameStore';
import { useUIStore } from './uiStore';
import { randomId } from '../utils/rng';
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog';

const RESCUE_EQUIPMENT_SELL_REFUND = 0.3;

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
      // Check intel affordability before touching DB
      if (
        mission.intelCost &&
        mission.intelCost > 0 &&
        !useGameStore.getState().canAfford({ intel: mission.intelCost })
      ) {
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
      if (mission.intelCost && mission.intelCost > 0) {
        useGameStore.getState().spendCurrencies({ intel: mission.intelCost });
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

      const { result, rewards, alertGain } = resolveMission(
        activeMission,
        mission,
      );

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

      // Apply module adjustments
      const basePerAgentXp = distributeXp(result, rewards.xp, agents.length);
      const perAgentXp = hasTrainingCenter
        ? Math.round(basePerAgentXp * 1.25)
        : basePerAgentXp;
      const effectiveAlertGain = hasBlackSite ? alertGain * 0.8 : alertGain;

      const affectedAgentIds: string[] = [];
      const injuredAgents: InjuredAgentInfo[] = [];
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
              updatedAgent.status = 'captured';
              updatedAgent.capturedAt = Date.now();
              if (catastropheRescueMission) {
                updatedAgent.rescueMissionId = catastropheRescueMission.id;
              }
              affectedAgentIds.push(agent.id);
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
          if (catastropheRescueMission) {
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
            // Each tier requires progressively more missions: tier 1 after 3, tier 2 after 8, tier 3 after 18, tier 4 after 35
            if (result === 'success' || result === 'partial') {
              const currentTier = region.missionTier ?? 0;
              const missionsDone =
                (await db.missionLog
                  .where('regionId')
                  .equals(mission.regionId)
                  .count()) + 1;
              const TIER_THRESHOLDS = [0, 3, 8, 18, 35];
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

      // Apply currency rewards to gameStore
      const gameStore = useGameStore.getState();
      if (
        rewards.money ||
        rewards.intel ||
        rewards.shadow ||
        rewards.influence
      ) {
        gameStore.addCurrencies({
          money: rewards.money,
          intel: rewards.intel,
          shadow: rewards.shadow,
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
      if (result === 'catastrophe') {
        gameStore.incrementStat('agents');
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
      const expired = missions.filter((m) => m.expiresAt && m.expiresAt < now);
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
        // If at max capacity, drop the newest non-rescue mission to make room
        if (workingValid.length >= MAX_MISSIONS_PER_REGION) {
          const dropTarget = [...workingValid]
            .reverse()
            .find((m) => !m.isRescue);
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
      // Keep rescue missions and locked chain missions intact, delete everything else
      const toDelete = missions.filter(
        (m) => !m.isRescue && !m.lockedByDivision,
      );
      const toKeep = missions.filter((m) => m.isRescue || !!m.lockedByDivision);
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
