// ─────────────────────────────────────────────────────────────────────────────
// Shadow Ops — Achievement Engine
// Centrální místo pro evaluaci achievementů.
// Volá useGameStore.unlockAchievement() pro každý nově splněný achievement.
// Žádné herní bonusy — čistě display/tracking.
// ─────────────────────────────────────────────────────────────────────────────

import { useGameStore } from '../store/gameStore';
import { db } from '../db/db';

// ─────────────────────────────────────────────────────────────────────────────
// Pomocná funkce: odemkni achievement + zobraz toast pokud byl nový
// ─────────────────────────────────────────────────────────────────────────────

function tryUnlock(id: string, label: string): void {
  const wasNew = useGameStore.getState().unlockAchievement(id);
  if (wasNew) {
    // Lazy import aby nevznikla cyklická závislost
    import('../store/uiStore').then(({ useUIStore }) => {
      useUIStore.getState().showToast('info', `Achievement: ${label}`);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: po dokončení mise (úspěch/partial)
// Voláno z missionStore.collectResult() po každé dokončené misi
// ─────────────────────────────────────────────────────────────────────────────

export interface MissionCompletedPayload {
  result: 'success' | 'partial' | 'failure' | 'catastrophe';
  difficulty: number;
  approach: 'standard' | 'aggressive' | 'covert';
  alertGain: number;
  isRescue: boolean;
  isFlash: boolean;
  isCounterOp: boolean;
  isChain: boolean;
  activeWorldEvent: boolean;
  wasCounterOpBlocked: boolean; // true = counter-op zablokovala rival operaci
  category: string;
  agentMissionStreaks: number[]; // streak každého agenta po misi
  hadInjuredAgent?: boolean;
  successChance?: number;
  agentIds?: string[]; // pro async check agenta rank
}

export async function onMissionCompleted(
  payload: MissionCompletedPayload,
): Promise<void> {
  const store = useGameStore.getState();
  const {
    totalMissionsCompleted,
    totalAgentsLost,
    currencies,
    unlockedAchievements,
    achievementCounters,
  } = store;

  const unlocked = new Set(unlockedAchievements);
  const counters = achievementCounters;

  const isSuccess = payload.result === 'success';
  const isSuccessOrPartial =
    payload.result === 'success' || payload.result === 'partial';

  // ── Mise: první selhání ────────────────────────────────────────────────────
  if (payload.result === 'failure' && totalMissionsCompleted === 0 && !unlocked.has('missions_fail_first'))
    tryUnlock('missions_fail_first', 'Křest ohněm');

  // ── Mise: počty ────────────────────────────────────────────────────────────
  if (isSuccess || isSuccessOrPartial) {
    if (!unlocked.has('missions_first')) tryUnlock('missions_first', 'První krok do tmy');
    if (totalMissionsCompleted >= 10 && !unlocked.has('missions_10'))
      tryUnlock('missions_10', 'Terénní operátor');
    if (totalMissionsCompleted >= 50 && !unlocked.has('missions_50'))
      tryUnlock('missions_50', 'Veterán operací');
    if (totalMissionsCompleted >= 100 && !unlocked.has('missions_100'))
      tryUnlock('missions_100', 'Centurion');
    if (totalMissionsCompleted >= 250 && !unlocked.has('missions_250'))
      tryUnlock('missions_250', 'Nekompromisní agentura');
    if (totalMissionsCompleted >= 500 && !unlocked.has('missions_500'))
      tryUnlock('missions_500', 'Strojovna světa');
    if (totalMissionsCompleted >= 1000 && !unlocked.has('missions_1000'))
      tryUnlock('missions_1000', 'Průmyslový komplex');
  }

  // ── Mise: nízká šance úspěchu ─────────────────────────────────────────────
  if (isSuccess && payload.successChance !== undefined) {
    if (payload.successChance < 10 && !unlocked.has('missions_low_chance'))
      tryUnlock('missions_low_chance', 'Zázrak v terénu');
    if (payload.successChance === 5 && !unlocked.has('secret_exactly_5_percent'))
      tryUnlock('secret_exactly_5_percent', 'Přesně 5%');
  }

  // ── Mise: zraněný agent v týmu ────────────────────────────────────────────
  if (isSuccess && payload.hadInjuredAgent && !unlocked.has('missions_injured_agent'))
    tryUnlock('missions_injured_agent', 'Přes bolest');

  // ── Mise: 5 misí za hodinu ────────────────────────────────────────────────
  if (isSuccessOrPartial) {
    const now = Date.now();
    store.pushMissionTimestamp(now);
    const timestamps = store.achievementCounters.missionsCompletedTimestamps ?? [];
    const updatedTimestamps = [...timestamps, now];
    const inLastHour = updatedTimestamps.filter((t) => now - t <= 60 * 60 * 1000);
    if (inLastHour.length >= 5 && !unlocked.has('missions_5_in_hour'))
      tryUnlock('missions_5_in_hour', 'Horká hodina');
  }

  // ── Mise: obtížnost 5 ──────────────────────────────────────────────────────
  if (isSuccess && payload.difficulty === 5) {
    if (!unlocked.has('mission_diff5_first'))
      tryUnlock('mission_diff5_first', 'Přes hranu');
  }

  // ── Mise: katastrofa přežita ────────────────────────────────────────────────
  if (payload.result === 'catastrophe' && !unlocked.has('mission_catastrophe_survived'))
    tryUnlock('mission_catastrophe_survived', 'Z popela');

  // ── Mise: streak ───────────────────────────────────────────────────────────
  for (const streak of payload.agentMissionStreaks) {
    if (streak >= 5 && !unlocked.has('mission_streak_5'))
      tryUnlock('mission_streak_5', 'Série úspěchů');
    if (streak >= 10 && !unlocked.has('mission_streak_10'))
      tryUnlock('mission_streak_10', 'Nezastavitelný');
  }

  // ── Mise: flash ─────────────────────────────────────────────────────────────
  if (payload.isFlash && isSuccess) {
    const newCount = counters.totalFlashMissionsCompleted + 1;
    store.incrementAchievementCounter('totalFlashMissionsCompleted');
    if (newCount >= 3 && !unlocked.has('mission_flash_3'))
      tryUnlock('mission_flash_3', 'Bleskový reflex');
  }

  // ── Mise: chain ─────────────────────────────────────────────────────────────
  if (payload.isChain && isSuccess) {
    store.incrementAchievementCounter('totalChainMissionsCompleted');
    const newChainCount = counters.totalChainMissionsCompleted + 1;
    if (!unlocked.has('mission_chain_complete'))
      tryUnlock('mission_chain_complete', 'Celý řetězec');
    if (newChainCount >= 3 && !unlocked.has('missions_chain_3'))
      tryUnlock('missions_chain_3', 'Mistr řetězce');
  }

  // ── Mise: přístupy ──────────────────────────────────────────────────────────
  if (payload.approach === 'covert' && isSuccessOrPartial) {
    const newCount = counters.totalCovertMissionsCompleted + 1;
    store.incrementAchievementCounter('totalCovertMissionsCompleted');
    if (newCount >= 10 && !unlocked.has('mission_covert_10'))
      tryUnlock('mission_covert_10', 'Stín v noci');
    if (newCount >= 50 && !unlocked.has('missions_covert_50'))
      tryUnlock('missions_covert_50', 'Přízrak');
    if (newCount >= 100 && !unlocked.has('missions_covert_100'))
      tryUnlock('missions_covert_100', 'Neviditelný');
  }
  if (payload.approach === 'aggressive' && isSuccessOrPartial) {
    const newCount = counters.totalAggressiveMissionsCompleted + 1;
    store.incrementAchievementCounter('totalAggressiveMissionsCompleted');
    if (newCount >= 10 && !unlocked.has('mission_aggressive_10'))
      tryUnlock('mission_aggressive_10', 'Tvrdý kurz');
  }

  // ── Mise: rescue ────────────────────────────────────────────────────────────
  if (payload.isRescue && isSuccessOrPartial) {
    store.incrementAchievementCounter('totalRescueMissionsCompleted');
    if (!unlocked.has('mission_rescue_success'))
      tryUnlock('mission_rescue_success', 'Nikdo nezůstal pozadu');
    if (!unlocked.has('agents_survived_capture'))
      tryUnlock('agents_survived_capture', 'Nepolapitelný');
  }

  // ── Mise: counter-op ────────────────────────────────────────────────────────
  if (payload.isCounterOp) {
    store.incrementAchievementCounter('totalCounterOpMissionsCompleted');
    const newCounterOpCount = counters.totalCounterOpMissionsCompleted + 1;
    if (isSuccess && !unlocked.has('mission_counter_op_success'))
      tryUnlock('mission_counter_op_success', 'Protiúder');
    if (isSuccess && newCounterOpCount >= 5 && !unlocked.has('missions_counter_op_5'))
      tryUnlock('missions_counter_op_5', 'Protiúderová specializace');
  }

  // ── Mise: bez alert gain ─────────────────────────────────────────────────────
  if (payload.alertGain === 0 && isSuccessOrPartial) {
    store.incrementAchievementCounter('totalNoAlertMissionsCompleted');
    if (!unlocked.has('mission_no_alert'))
      tryUnlock('mission_no_alert', 'Čistý profil');
  }

  // ── Mise: world event ────────────────────────────────────────────────────────
  if (payload.activeWorldEvent && isSuccessOrPartial) {
    const newCount = counters.totalWorldEventMissionsCompleted + 1;
    store.incrementAchievementCounter('totalWorldEventMissionsCompleted');
    if (newCount >= 1 && !unlocked.has('milestone_world_event_survived'))
      tryUnlock('milestone_world_event_survived', 'Přežil globální krizi');
  }

  // ── Milestone: counter-op rival blocked ─────────────────────────────────────
  if (payload.wasCounterOpBlocked) {
    store.incrementAchievementCounter('totalRivalOperationsBlocked');
    const newCount = counters.totalRivalOperationsBlocked + 1;
    if (newCount >= 1 && !unlocked.has('milestone_rival_first_counter'))
      tryUnlock('milestone_rival_first_counter', 'Zpátky do hry');
    if (newCount >= 10 && !unlocked.has('rivals_blocked_10'))
      tryUnlock('rivals_blocked_10', 'Nezdolný obránce');
  }

  // ── Milestone: no agents lost ────────────────────────────────────────────────
  // Počítáme až při splněné misi bez ztráty agenta
  if (isSuccessOrPartial && totalAgentsLost === 0) {
    const newCount = counters.missionsWithoutLoss + 1;
    store.incrementAchievementCounter('missionsWithoutLoss');
    if (newCount >= 50 && !unlocked.has('secret_no_agents_lost'))
      tryUnlock('secret_no_agents_lost', 'Bez ztrát');
  }

  // ── Milestone: 100% success rate ────────────────────────────────────────────
  const attempted = store.totalMissionsAttempted;
  const completed = store.totalMissionsCompleted;
  if (
    attempted >= 10 &&
    completed === attempted &&
    !unlocked.has('milestone_100_success_rate')
  ) {
    tryUnlock('milestone_100_success_rate', 'Neomylní');
  }

  // ── Mise: divisions ──────────────────────────────────────────────────────────
  // Zkontroluje se asynchronně přes log
  if (isSuccessOrPartial && !unlocked.has('missions_all_divisions')) {
    await checkAllDivisionsAchievement(unlocked);
  }

  // ── Mise: diff5 counter ──────────────────────────────────────────────────────
  if (isSuccess && payload.difficulty === 5 && !unlocked.has('mission_diff5_10')) {
    await checkDiff5Achievement(unlocked);
  }

  // ── Měny: snapshots ──────────────────────────────────────────────────────────
  // Tyto se kontrolují po každé misi pro jednoduchost
  if (currencies.money >= 10000 && !unlocked.has('milestone_10k_money'))
    tryUnlock('milestone_10k_money', 'Plné kasy');
  if (currencies.money >= 50000 && !unlocked.has('milestone_50k_money'))
    tryUnlock('milestone_50k_money', 'Zlatý rezervoár');
  if (currencies.intel >= 100 && !unlocked.has('milestone_100_intel'))
    tryUnlock('milestone_100_intel', 'Zásobník dat');
  if (currencies.shadow >= 50 && !unlocked.has('milestone_shadow_50'))
    tryUnlock('milestone_shadow_50', 'Stínová ekonomika');

  // ── Mise: diff5 s nováčkem (secret) ─────────────────────────────────────
  if (isSuccess && payload.difficulty >= 5 && payload.agentIds && payload.agentIds.length > 0) {
    if (!unlocked.has('secret_recruit_diff5')) {
      const missionAgents = await db.agents.bulkGet(payload.agentIds);
      const hasRecruit = missionAgents.some((a) => a && a.rank === 'recruit');
      if (hasRecruit) tryUnlock('secret_recruit_diff5', 'Nováček na diff-5');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent rankup
// ─────────────────────────────────────────────────────────────────────────────

export function onAgentRankUp(newRank: string): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  if (newRank === 'operative' && !unlocked.has('agents_first_operative'))
    tryUnlock('agents_first_operative', 'Kariérní postup');
  if (newRank === 'specialist' && !unlocked.has('agents_first_specialist'))
    tryUnlock('agents_first_specialist', 'Elitní kadra');
  if (newRank === 'veteran' && !unlocked.has('agents_first_veteran'))
    tryUnlock('agents_first_veteran', 'Ostřílený borec');
  if (newRank === 'director') {
    if (!unlocked.has('agents_first_director'))
      tryUnlock('agents_first_director', 'Ředitel v terénu');
    store.incrementAchievementCounter('totalDirectorsRaised');
    const newCount = store.achievementCounters.totalDirectorsRaised + 1;
    if (newCount >= 5 && !unlocked.has('agents_5_directors'))
      tryUnlock('agents_5_directors', 'Sbor ředitelů');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent nábor
// ─────────────────────────────────────────────────────────────────────────────

export async function onAgentRecruited(): Promise<void> {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  store.incrementAchievementCounter('totalAgentsRecruited');
  const newCount = store.achievementCounters.totalAgentsRecruited + 1;
  if (newCount >= 5 && !unlocked.has('agents_recruit_5'))
    tryUnlock('agents_recruit_5', 'Rozrůstáme se');
  if (newCount >= 15 && !unlocked.has('agents_recruit_15'))
    tryUnlock('agents_recruit_15', 'Plný stav');
  if (newCount >= 30 && !unlocked.has('agents_recruit_30'))
    tryUnlock('agents_recruit_30', 'Armáda ve stínu');
  if (newCount >= 50 && !unlocked.has('agents_recruit_50'))
    tryUnlock('agents_recruit_50', 'Velká armáda');

  // Async: počet živých agentů
  if (!unlocked.has('agents_full_roster') || !unlocked.has('agents_all_divisions_represented')) {
    const aliveAgents = await db.agents
      .filter((a) => a.status !== 'dead')
      .toArray();
    if (aliveAgents.length >= 20 && !unlocked.has('agents_full_roster'))
      tryUnlock('agents_full_roster', 'Plné kapacity');
    if (!unlocked.has('agents_all_divisions_represented')) {
      const ALL_DIVISIONS = [
        'surveillance', 'cyber', 'extraction', 'sabotage', 'influence',
        'finance', 'logistics', 'blackops', 'medical',
      ];
      const divisions = new Set(aliveAgents.map((a) => a.division));
      if (ALL_DIVISIONS.every((d) => divisions.has(d as typeof aliveAgents[0]['division'])))
        tryUnlock('agents_all_divisions_represented', 'Diverzifikovaný tým');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent vyléčen (instant heal)
// ─────────────────────────────────────────────────────────────────────────────

export function onAgentHealed(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  store.incrementAchievementCounter('agentsHealed');
  const newCount = store.achievementCounters.agentsHealed + 1;
  if (newCount >= 10 && !unlocked.has('agents_healed_10'))
    tryUnlock('agents_healed_10', 'Záchranář');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent ztráta
// ─────────────────────────────────────────────────────────────────────────────

export function onAgentLost(totalLost: number): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  // Reset missionsWithoutLoss
  if (store.achievementCounters.missionsWithoutLoss > 0) {
    store.incrementAchievementCounter(
      'missionsWithoutLoss',
      -store.achievementCounters.missionsWithoutLoss,
    );
  }
  if (totalLost >= 1 && !unlocked.has('agents_lost_first'))
    tryUnlock('agents_lost_first', 'Daň za stíny');
  if (totalLost >= 5 && !unlocked.has('agents_lost_5'))
    tryUnlock('agents_lost_5', 'Nevyhnutelné ztráty');
  if (totalLost >= 10 && !unlocked.has('agents_lost_10'))
    tryUnlock('agents_lost_10', 'Krvavá daň');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: modul nainstalován
// ─────────────────────────────────────────────────────────────────────────────

export function onModuleInstalled(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  store.incrementAchievementCounter('totalModulesInstalled');
  const newCount = store.achievementCounters.totalModulesInstalled + 1;
  if (newCount >= 1 && !unlocked.has('base_module_installed'))
    tryUnlock('base_module_installed', 'Vybavená základna');
  if (newCount >= 5 && !unlocked.has('base_5_modules'))
    tryUnlock('base_5_modules', 'Plně vybavení');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: rival operace
// ─────────────────────────────────────────────────────────────────────────────

export function onRivalOperationEncountered(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  store.incrementAchievementCounter('totalRivalOperationsEncountered');
  const newCount = store.achievementCounters.totalRivalOperationsEncountered + 1;
  if (newCount >= 3 && !unlocked.has('milestone_rival_ops_3'))
    tryUnlock('milestone_rival_ops_3', 'Pod tlakem');

  // Daily counter
  const today = new Date().toISOString().slice(0, 10);
  const counters = store.achievementCounters;
  if (counters.rivalOpsTodayDate !== today) {
    // Reset daily counter
    store.setAchievementCounterString('rivalOpsTodayDate', today);
    store.incrementAchievementCounter(
      'rivalOpsTodayCount',
      -(counters.rivalOpsTodayCount ?? 0),
    );
  }
  store.incrementAchievementCounter('rivalOpsTodayCount');
  const dailyCount = (counters.rivalOpsTodayCount ?? 0) + 1;
  if (dailyCount >= 5 && !unlocked.has('rivals_5_in_day'))
    tryUnlock('rivals_5_in_day', 'Den pod palbou');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: rival operace propuštěna (nebyla zablokována)
// ─────────────────────────────────────────────────────────────────────────────

export function onRivalOpLetThrough(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  store.incrementAchievementCounter('rivalOpsLetThrough');
  const newCount = store.achievementCounters.rivalOpsLetThrough + 1;
  if (newCount >= 10 && !unlocked.has('rivals_let_10_through'))
    tryUnlock('rivals_let_10_through', 'Lehkomyslný');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: expanze dokončena
// ─────────────────────────────────────────────────────────────────────────────

export async function onExpansionCompleted(): Promise<void> {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  const totalExpansions = store.totalExpansions;
  if (totalExpansions >= 1 && !unlocked.has('map_first_expansion'))
    tryUnlock('map_first_expansion', 'Za hranice');
  // Počet vlastněných regionů
  const ownedCount = await db.regions.filter((r) => r.owned).count();
  if (ownedCount >= 5 && !unlocked.has('map_5_regions'))
    tryUnlock('map_5_regions', 'Globální dosah');
  if (ownedCount >= 10 && !unlocked.has('map_10_regions'))
    tryUnlock('map_10_regions', 'Světová síť');
  if (ownedCount >= 20 && !unlocked.has('map_20_regions'))
    tryUnlock('map_20_regions', 'Superagentúra');
  if (ownedCount >= 295 && !unlocked.has('secret_all_regions'))
    tryUnlock('secret_all_regions', 'Globální dominance');
  // Safe houses
  const shCount = await db.safeHouses
    .filter((sh) => !sh.constructionInProgress)
    .count();
  if (shCount >= 3 && !unlocked.has('base_3_safehouses'))
    tryUnlock('base_3_safehouses', 'Síť základen');

  // Mapa: 3 regiony s Mission Tier 4+
  if (!unlocked.has('map_tier4_three_regions')) {
    const tier4Count = await db.regions
      .filter((r) => r.owned && (r.missionTier ?? 0) >= 4)
      .count();
    if (tier4Count >= 3)
      tryUnlock('map_tier4_three_regions', 'Válečná zóna');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: safe house upgrade dokončen
// ─────────────────────────────────────────────────────────────────────────────

export function onSafeHouseUpgraded(newLevel: number): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (newLevel >= 3 && !unlocked.has('base_safehouse_lv3'))
    tryUnlock('base_safehouse_lv3', 'Solidní zázemí');
  if (newLevel >= 5 && !unlocked.has('base_safehouse_lv5'))
    tryUnlock('base_safehouse_lv5', 'Pevnost');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: divize odemčena / upgradována
// ─────────────────────────────────────────────────────────────────────────────

export function onDivisionChanged(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  const unlockedDivisions = store.unlockedDivisions;
  if (unlockedDivisions.length >= 9 && !unlocked.has('base_all_divisions'))
    tryUnlock('base_all_divisions', 'Plné spektrum');
  // Zkontroluj lv3 divizi
  const levels = store.divisionLevels;
  const hasLv3 = Object.values(levels).some((lv) => lv >= 3);
  if (hasLv3 && !unlocked.has('base_division_lv3'))
    tryUnlock('base_division_lv3', 'Specializace');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: black market odemčen
// ─────────────────────────────────────────────────────────────────────────────

export function onBlackMarketUnlocked(): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (!unlocked.has('base_black_market'))
    tryUnlock('base_black_market', 'Podsvětní kontakty');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: expansion skip koupena na černém trhu
// ─────────────────────────────────────────────────────────────────────────────

export function onExpansionSkipBought(): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (!unlocked.has('secret_bm_expansion_skip'))
    tryUnlock('secret_bm_expansion_skip', 'Zkratka');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent má plnou výzbroj
// ─────────────────────────────────────────────────────────────────────────────

export function onAgentFullyEquipped(): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (!unlocked.has('agents_full_equipment'))
    tryUnlock('agents_full_equipment', 'Plná výzbroj');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: legendary item koupen
// ─────────────────────────────────────────────────────────────────────────────

export function onLegendaryItemAcquired(): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (!unlocked.has('agents_legendary_item'))
    tryUnlock('agents_legendary_item', 'Legendární nálezeček');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: pasivní příjem (první tick)
// ─────────────────────────────────────────────────────────────────────────────

export async function onPassiveIncomeTick(): Promise<void> {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  const { currencies, achievementCounters: counters } = store;

  if (!unlocked.has('milestone_first_income'))
    tryUnlock('milestone_first_income', 'První výdělek');

  // Ekonomika
  if (counters.lifetimeMoneyEarned >= 1000000 && !unlocked.has('economy_1m_lifetime'))
    tryUnlock('economy_1m_lifetime', 'Milionář ze stínů');
  if (counters.lifetimeMoneySpent >= 500000 && !unlocked.has('economy_spent_500k'))
    tryUnlock('economy_spent_500k', 'Velký investor');
  if (counters.lifetimeIntelEarned >= 1000 && !unlocked.has('economy_1000_intel_lifetime'))
    tryUnlock('economy_1000_intel_lifetime', 'Informační broker');
  if (
    currencies.money >= 10000 &&
    currencies.intel >= 200 &&
    currencies.shadow >= 100 &&
    !unlocked.has('economy_all_currencies')
  )
    tryUnlock('economy_all_currencies', 'Trifekta');

  // Secret: 666 shadow
  if (currencies.shadow === 666 && !unlocked.has('secret_666_shadow'))
    tryUnlock('secret_666_shadow', '666');

  // Mapa: 5 regionů s nulový alert
  if (!unlocked.has('map_5_zero_alert')) {
    const zeroAlertCount = await db.regions
      .filter((r) => r.owned && r.alertLevel <= 0.1)
      .count();
    if (zeroAlertCount >= 5)
      tryUnlock('map_5_zero_alert', 'Čistý svět');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: playtime check (voláno z usePassiveIncome každých 30s)
// ─────────────────────────────────────────────────────────────────────────────

export function onPlayTimeTick(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  const secs = store.getPlayTimeSecs();
  if (secs >= 1800 && !unlocked.has('playtime_30m'))
    tryUnlock('playtime_30m', 'Zasvěcený');
  if (secs >= 7200 && !unlocked.has('playtime_2h'))
    tryUnlock('playtime_2h', 'Zapálený operátor');
  if (secs >= 36000 && !unlocked.has('playtime_10h'))
    tryUnlock('playtime_10h', 'Oddaný agentuře');
  if (secs >= 86400 && !unlocked.has('playtime_24h'))
    tryUnlock('playtime_24h', 'Nikdy nespí');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: secret — noční sova (při startu hry)
// ─────────────────────────────────────────────────────────────────────────────

export function onGameLoaded(): void {
  const store = useGameStore.getState();
  const unlocked = new Set(store.unlockedAchievements);
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 0 && hour < 4 && !unlocked.has('secret_night_owl'))
    tryUnlock('secret_night_owl', 'Noční sova');

  // Login streak
  const todayStr = now.toISOString().slice(0, 10);
  const counters = store.achievementCounters;
  const last = counters.lastLoginDate;
  if (last) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === yesterday) {
      store.incrementAchievementCounter('loginStreak');
    } else if (last !== todayStr) {
      // Streak zlomen — resetuj na 1
      store.incrementAchievementCounter(
        'loginStreak',
        1 - (counters.loginStreak ?? 0),
      );
    }
    // Pokud last === todayStr, nic neměníme (již přihlášen dnes)
  } else {
    store.incrementAchievementCounter('loginStreak', 1 - (counters.loginStreak ?? 0));
  }
  store.setAchievementCounterString('lastLoginDate', todayStr);

  const currentStreak = useGameStore.getState().achievementCounters.loginStreak ?? 0;
  if (currentStreak >= 7 && !unlocked.has('secret_7_day_streak'))
    tryUnlock('secret_7_day_streak', '7 dní v řadě');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: agent mission stats (missionsCompleted pro jednotlivého agenta)
// ─────────────────────────────────────────────────────────────────────────────

export function onAgentMissionCompleted(
  agentMissionsCompleted: number,
): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (agentMissionsCompleted >= 10 && !unlocked.has('agents_10_missions_one'))
    tryUnlock('agents_10_missions_one', 'Spolehlivý');
  if (agentMissionsCompleted >= 25 && !unlocked.has('agents_25_missions_one'))
    tryUnlock('agents_25_missions_one', 'Legenda agentury');
  if (agentMissionsCompleted >= 50 && !unlocked.has('agents_one_agent_50_missions'))
    tryUnlock('agents_one_agent_50_missions', 'Žijící legenda');
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger: region alert level dosáhl maxima
// ─────────────────────────────────────────────────────────────────────────────

export async function onAlertLevelChanged(
  regionId: string,
  newLevel: number,
  oldLevel: number,
): Promise<void> {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (newLevel >= 3.0 && !unlocked.has('map_high_alert'))
    tryUnlock('map_high_alert', 'Horká zona');
  // Alert cleared: z 2.5+ na 0.5 nebo méně
  if (oldLevel >= 2.5 && newLevel <= 0.5 && !unlocked.has('map_alert_cleared'))
    tryUnlock('map_alert_cleared', 'Čistě stopy');
  // Mission tier 4
  const region = await db.regions.get(regionId);
  if (region?.missionTier && region.missionTier >= 4 && !unlocked.has('map_mission_tier4'))
    tryUnlock('map_mission_tier4', 'Prokleté území');
}

// ─────────────────────────────────────────────────────────────────────────────
// Secret: speed dispatch 5 misí za 60 sekund
// Sleduje timestampy dispatchů v sessionStorage
// ─────────────────────────────────────────────────────────────────────────────

export async function onMissionDispatched(): Promise<void> {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);

  // Secret: speed dispatch 5 misí za 60 sekund
  if (!unlocked.has('secret_speed_5')) {
    const now = Date.now();
    const key = 'so-dispatch-times';
    const raw = sessionStorage.getItem(key);
    const times: number[] = raw ? JSON.parse(raw) : [];
    times.push(now);
    const recent = times.filter((t) => now - t <= 60000).slice(-10);
    sessionStorage.setItem(key, JSON.stringify(recent));
    if (recent.length >= 5) tryUnlock('secret_speed_5', 'Bleskový operátor');
  }

  // Secret: půlnoční dispatch
  if (!unlocked.has('secret_midnight_dispatch')) {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() <= 4)
      tryUnlock('secret_midnight_dispatch', 'Půlnoční operace');
  }

  // Všichni agenti na misi (10+)
  if (!unlocked.has('missions_full_roster_deployed')) {
    const onMissionCount = await db.agents
      .filter((a) => a.status === 'on_mission')
      .count();
    if (onMissionCount >= 10)
      tryUnlock('missions_full_roster_deployed', 'Všechno na stůl');
  }

  // Aktivní mise v 5+ různých regionech
  if (!unlocked.has('map_missions_5_regions')) {
    const activeMissions = await db.activeMissions
      .filter((am) => !am.result)
      .toArray();
    const missionIds = activeMissions.map((am) => am.missionId);
    const missions = await db.missions.bulkGet(missionIds);
    const uniqueRegions = new Set(missions.filter(Boolean).map((m) => m!.regionId));
    if (uniqueRegions.size >= 5)
      tryUnlock('map_missions_5_regions', 'Simultánní operace');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secret: all catastrophe (4 mise zároveň katastrofa)
// ─────────────────────────────────────────────────────────────────────────────

export function onAllCatastrophe(): void {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (!unlocked.has('secret_all_catastrophe'))
    tryUnlock('secret_all_catastrophe', 'Totální kolaps');
}

// ─────────────────────────────────────────────────────────────────────────────
// Secret: 3 regiony s max alertem najednou
// ─────────────────────────────────────────────────────────────────────────────

export async function checkMaxAlertRegions(): Promise<void> {
  const unlocked = new Set(useGameStore.getState().unlockedAchievements);
  if (unlocked.has('secret_max_alert')) return;
  const maxAlertRegions = await db.regions
    .filter((r) => r.owned && r.alertLevel >= 3.0)
    .count();
  if (maxAlertRegions >= 3) tryUnlock('secret_max_alert', 'Globální panika');
}

// ─────────────────────────────────────────────────────────────────────────────
// Async helpers
// ─────────────────────────────────────────────────────────────────────────────

async function checkAllDivisionsAchievement(
  unlocked: Set<string>,
): Promise<void> {
  if (unlocked.has('missions_all_divisions')) return;
  const ALL_DIVISIONS = [
    'surveillance',
    'cyber',
    'extraction',
    'sabotage',
    'influence',
    'finance',
    'logistics',
    'blackops',
    'medical',
  ];
  const log = await db.missionLog.toArray();
  const completedMissions = await db.missions
    .bulkGet(log.map((e) => e.missionId))
    .then((ms) => ms.filter(Boolean));
  const divisionsInLog = new Set(completedMissions.map((m) => m!.category));
  const allDone = ALL_DIVISIONS.every((d) => divisionsInLog.has(d));
  if (allDone) tryUnlock('missions_all_divisions', 'Multispecialista');
}

async function checkDiff5Achievement(unlocked: Set<string>): Promise<void> {
  if (unlocked.has('mission_diff5_10')) return;
  const log = await db.missionLog
    .filter((e) => e.result === 'success')
    .toArray();
  const missionIds = log.map((e) => e.missionId);
  const missions = await db.missions.bulkGet(missionIds);
  const diff5Count = missions.filter((m) => m && m.difficulty === 5).length;
  if (diff5Count >= 10) tryUnlock('mission_diff5_10', 'Dravec');
}
