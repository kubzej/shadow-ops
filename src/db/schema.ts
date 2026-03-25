import type { DivisionId, AgentRank } from '../data/agentTypes';
import type { WorldEventId } from '../data/worldEvents';

export type RivalEventType =
  | 'asset_compromise'
  | 'intel_theft'
  | 'sabotage'
  | 'agent_recruitment'
  | 'disinformation'
  | 'rival_leak'
  | 'burned_contracts'
  | 'safe_house_swap';

export interface ActiveRivalOperation {
  id: string;
  regionId: string;
  eventType: RivalEventType;
  createdAt: number;
  expiresAt: number;
  blockedByCounterMissionId?: string;
}

// ============ CORE GAME STATE ============
export interface GameState {
  id: 1; // singleton
  agencyName: string;
  bossName: string;
  startCityId: string;
  createdAt: number;
  lastSavedAt: number;
  totalPlayTime: number; // seconds
  // Currencies
  money: number; // $
  intel: number; // ◈
  shadow: number; // ◆
  influence: number; // ✦
  // Flags
  blackMarketUnlocked: boolean;
  // Unlocked divisions
  unlockedDivisions: DivisionId[];
  divisionLevels: Record<DivisionId, number>;
  // Cosmetic
  logoId: string;
  // Global stats
  totalMissionsCompleted: number;
  totalMissionsAttempted: number;
  totalAgentsLost: number;
  totalExpansions: number;
  // World Events
  activeWorldEvent?: ActiveWorldEvent;
  nextWorldEventAt?: number;
  // Rival
  rivalName?: string;
  nextRivalOperationAt?: number;
  activeRivalOperation?: ActiveRivalOperation;
  rivalAggressionLevel?: number;
}

// ============ SAFE HOUSE ============
export interface SafeHouse {
  id: string; // regionId
  regionId: string;
  level: number; // 1–5
  index?: number; // order of creation (1 = home base, 2 = 1st expansion, …)
  assignedDivisions: DivisionId[];
  modules: string[]; // module ids from costs.ts
  // Build/upgrade state
  upgradeInProgress?: boolean;
  upgradeCompletesAt?: number; // timestamp
  constructionInProgress?: boolean;
  constructionCompletesAt?: number; // timestamp (for new safe houses)
  disabledModules?: Array<{
    moduleId: string;
    until: number;
    reason: 'rival_sabotage';
  }>;
  createdAt: number;
}

// ============ AGENT ============
export type AgentStatus =
  | 'available'
  | 'on_mission'
  | 'injured'
  | 'captured'
  | 'traveling'
  | 'dead';

export interface AgentStats {
  stealth: number;
  combat: number;
  intel: number;
  tech: number;
}

export interface AgentEquipmentSlot {
  equipmentId: string | null;
}

export interface Agent {
  id: string;
  name: string;
  typeId: string; // AgentType.id
  division: DivisionId;
  rank: AgentRank;
  stats: AgentStats;
  baseStats: AgentStats; // before equipment bonuses
  xp: number;
  xpToNextRank: number;
  status: AgentStatus;
  safeHouseId: string;
  equipment: AgentEquipmentSlot[];
  // Injury
  injuredAt?: number;
  healsAt?: number;
  injuryDescription?: string;
  // Travel
  travelDestinationId?: string;
  arrivesAt?: number;
  // Mission stats
  missionsCompleted: number;
  missionsAttempted: number;
  missionStreak: number; // consecutive successes without injury or failure
  // Capture
  capturedAt?: number;
  rescueMissionId?: string;
  // Meta
  recruitedAt: number;
  nickname?: string; // awarded on promotion to veteran rank
}

// ============ REGION STATE ============
export interface RegionState {
  id: string; // region id
  owned: boolean;
  alertLevel: number; // 0–3, float
  distanceFromStart: number;
  safeHouseId?: string; // if owned
  availableMissionIds: string[];
  lastMissionGeneratedAt?: number;
  constructionInProgress?: boolean;
  constructionCompletesAt?: number;
  /** Persistent minimum difficulty floor (0–4). Increases as missions are completed here, never decreases. */
  missionTier?: number;
  /** Timestamp when the next Flash Operation should spawn for this region. */
  nextFlashMissionAt?: number;
  rivalLeakUntil?: number;
  burnedContractsUntil?: number;
}

// ============ MISSION ============
export type MissionResult = 'success' | 'partial' | 'failure' | 'catastrophe';

export interface MissionRewards {
  money: number;
  intel: number;
  shadow: number;
  influence: number;
  xp: number;
}

export interface Mission {
  id: string;
  regionId: string;
  category: string; // MissionCategory
  targetId: string; // MissionTarget.id
  complicationId?: string;
  intelCost?: number; // intel required to dispatch
  chainNextTargetId?: string; // on success, auto-generate follow-up with this target
  chainStep?: number; // 1-based position in tc chain (e.g. 2)
  chainTotal?: number; // total tc steps in this chain (e.g. 3)
  lockedByDivision?: string; // chain mission blocked until this division is assigned
  title: string;
  flavor: string;
  difficulty: number; // 1–5
  minAgents: number;
  maxAgents: number;
  requiredDivisions?: DivisionId[];
  minStats?: Partial<AgentStats>; // minimum stat thresholds – at least one agent must meet them
  baseSuccessChance: number;
  baseDuration: number; // seconds
  rewards: MissionRewards;
  failurePenalty: MissionRewards; // negative values = penalties
  alertGain: number;
  isRescue?: boolean;
  capturedAgentId?: string; // set on rescue missions — agent to free on success/partial
  isFlash?: boolean; // Flash Operation — 5 min dispatch window, ×1.5 rewards + guaranteed shadow bonus
  isCounterOp?: boolean;
  rivalOperationId?: string;
  expiresAt?: number; // timestamp
  createdAt: number;
}

// ============ ACTIVE MISSION ============
export interface ActiveMission {
  id: string;
  missionId: string;
  agentIds: string[];
  equipmentIds: string[];
  startedAt: number;
  completesAt: number; // timestamp
  successChance: number;
  approach: 'standard' | 'aggressive' | 'covert';
  result?: MissionResult; // set when complete, pending collection
  collected?: boolean;
}

// ============ RECRUITMENT POOL ============
export interface RecruitmentOffer {
  id: string;
  agentTypeId: string;
  name: string;
  rank: AgentRank;
  stats: AgentStats;
  cost: number;
  expiresAt: number;
}

export interface RecruitmentPool {
  id: string; // safeHouseId
  safeHouseId: string;
  offers: RecruitmentOffer[];
  refreshesAt: number;
}

// ============ BLACK MARKET ============
export interface BlackMarketListing {
  equipmentId: string;
  costShadow: number;
  costInfluence: number;
  costMoney?: number;
}

export interface BlackMarket {
  id: 1;
  listings: BlackMarketListing[];
  refreshesAt: number;
}

// ============ WORLD EVENTS ============
export interface ActiveWorldEvent {
  eventId: WorldEventId;
  startedAt: number;
  expiresAt: number;
}

// ============ MISSION LOG ============
export interface MissionLogEntry {
  id: string;
  missionId: string;
  activeMissionId: string;
  agentIds: string[];
  regionId: string;
  result: MissionResult;
  rewards: MissionRewards;
  completedAt: number;
  alertGain: number;
}
