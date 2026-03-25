import type { Agent, ActiveWorldEvent, Mission } from '../../db/schema';
import { checkAgentEligibility } from '../../engine/missionResolver';
import { isCategoryBlockedByEvent } from '../../engine/worldEvents';

export type MissionSortMode =
  | 'recommended'
  | 'reward'
  | 'reward_per_min'
  | 'time'
  | 'difficulty';

export type SortDirection = 'desc' | 'asc';

export const SORT_OPTIONS: Array<{ id: MissionSortMode; label: string }> = [
  { id: 'recommended', label: 'Doporučené' },
  { id: 'reward', label: 'Odměna' },
  { id: 'reward_per_min', label: 'Odměna/min' },
  { id: 'time', label: 'Krátké' },
  { id: 'difficulty', label: 'Obtížnost' },
];

export function missionRewardValue(mission: Mission): number {
  return (
    mission.rewards.money +
    mission.rewards.intel * 30 +
    mission.rewards.shadow * 80 +
    mission.rewards.influence * 70 +
    mission.rewards.xp * 10
  );
}

export function missionRewardPerMinute(mission: Mission): number {
  const mins = Math.max(1, mission.baseDuration / 60);
  return missionRewardValue(mission) / mins;
}

export function isMissionDispatchable(
  mission: Mission,
  regionAgents: Agent[],
  activeWorldEvent: ActiveWorldEvent | null,
): boolean {
  if (mission.lockedByDivision) return false;
  if (isCategoryBlockedByEvent(mission.category, activeWorldEvent)) {
    return false;
  }
  const availableAgents = regionAgents.filter((a) => a.status === 'available');
  if (availableAgents.length === 0) return false;
  return availableAgents.some(
    (a) => checkAgentEligibility(a, mission).eligible,
  );
}

export function sortMissions(
  missions: Mission[],
  sortMode: MissionSortMode,
  regionAgents: Agent[],
  activeWorldEvent: ActiveWorldEvent | null,
  direction: SortDirection = 'desc',
): Mission[] {
  return [...missions].sort((a, b) => {
    let cmp = 0;

    if (sortMode === 'reward') {
      cmp = missionRewardValue(b) - missionRewardValue(a);
      return direction === 'asc' ? -cmp : cmp;
    }
    if (sortMode === 'reward_per_min') {
      cmp = missionRewardPerMinute(b) - missionRewardPerMinute(a);
      return direction === 'asc' ? -cmp : cmp;
    }
    if (sortMode === 'time') {
      cmp = a.baseDuration - b.baseDuration;
      return direction === 'asc' ? -cmp : cmp;
    }
    if (sortMode === 'difficulty') {
      cmp = b.difficulty - a.difficulty;
      return direction === 'asc' ? -cmp : cmp;
    }

    const scoreA =
      missionRewardPerMinute(a) * 1.1 -
      a.alertGain * 140 -
      a.baseDuration * 0.08 +
      a.difficulty * 18 +
      (isMissionDispatchable(a, regionAgents, activeWorldEvent) ? 200 : 0);
    const scoreB =
      missionRewardPerMinute(b) * 1.1 -
      b.alertGain * 140 -
      b.baseDuration * 0.08 +
      b.difficulty * 18 +
      (isMissionDispatchable(b, regionAgents, activeWorldEvent) ? 200 : 0);
    cmp = scoreB - scoreA;
    return direction === 'asc' ? -cmp : cmp;
  });
}
