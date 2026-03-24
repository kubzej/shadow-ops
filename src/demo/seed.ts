import { db, activateSlot } from '../db/db';
import { initializeGame, loadGame } from '../engine/initializeGame';
import { createAgent, generateRecruitmentPool } from '../engine/agentGenerator';
import {
  generateMissionsForRegion,
  generateFlashMission,
} from '../engine/missionGenerator';
import type { DivisionId } from '../data/agentTypes';
import type { Mission, ActiveMission } from '../db/schema';

export const DEMO_SLOT_ID = '__demo__';

/**
 * Seeds the demo DB.
 * If the demo DB already has game state (previous session), skips seeding and
 * just loads the existing state — so demo progress is preserved across sessions.
 * Pass `force=true` to always re-seed from scratch.
 */
export async function seedDemoDb(force = false): Promise<void> {
  try {
    const now = Date.now();

    // ── 0. Check if demo DB already exists ───────────────────────────────────
    activateSlot(DEMO_SLOT_ID);
    if (!force) {
      const existing = await db.gameState.get(1);
      if (existing) {
        // Resume existing demo session
        await loadGame();
        return;
      }
    }

    // ── 1. Base init ──────────────────────────────────────────────────────────
    await initializeGame(
      'PHANTOM NETWORK',
      'Director Wolf',
      'london',
      'eye',
      DEMO_SLOT_ID,
    );

    // ── 2. Upgrade game state ─────────────────────────────────────────────────
    const allDivisions: DivisionId[] = [
      'surveillance',
      'cyber',
      'extraction',
      'sabotage',
      'influence',
      'finance',
      'logistics',
      'medical',
      'blackops',
    ];
    const divisionLevels: Record<DivisionId, number> = {
      surveillance: 2,
      cyber: 2,
      extraction: 1,
      sabotage: 1,
      influence: 1,
      finance: 1,
      logistics: 1,
      medical: 1,
      blackops: 1,
    };

    await db.gameState.update(1, {
      money: 999999,
      intel: 9999,
      shadow: 999,
      influence: 999,
      blackMarketUnlocked: true,
      unlockedDivisions: allDivisions,
      divisionLevels,
      totalMissionsCompleted: 47,
      totalMissionsAttempted: 55,
    });

    // ── 3. Upgrade London safe house ──────────────────────────────────────────
    await db.safeHouses.update('london', {
      level: 3,
      assignedDivisions: [
        'surveillance',
        'cyber',
        'extraction',
      ] as DivisionId[],
      modules: ['training_center', 'black_site', 'med_bay'],
    });

    // ── 4. Add Amsterdam safe house ───────────────────────────────────────────
    await db.safeHouses.put({
      id: 'amsterdam',
      regionId: 'amsterdam',
      level: 2,
      index: 2,
      assignedDivisions: ['blackops', 'sabotage'] as DivisionId[],
      modules: ['med_bay'],
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
    });

    // Mark amsterdam region owned
    await db.regions.update('amsterdam', {
      owned: true,
      safeHouseId: 'amsterdam',
      alertLevel: 1.2,
      // missionTier 2 = eligible for Flash Operations
      missionTier: 2,
      // Schedule next flash spawn 12 min from now (demo: first one is seeded manually)
      nextFlashMissionAt: now + 12 * 60 * 1000,
    });

    // ── 5. Add Berlin safe house (under construction) ─────────────────────────
    const berlinConstructionAt = now + 10 * 60 * 1000;
    await db.safeHouses.put({
      id: 'berlin',
      regionId: 'berlin',
      level: 1,
      index: 3,
      assignedDivisions: ['influence', 'logistics'] as DivisionId[],
      modules: [],
      constructionInProgress: true,
      constructionCompletesAt: berlinConstructionAt,
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
    });

    // Mark berlin region owned + under construction
    await db.regions.update('berlin', {
      owned: true,
      safeHouseId: 'berlin',
      alertLevel: 0.3,
      constructionInProgress: true,
      constructionCompletesAt: berlinConstructionAt,
    });

    // ── 6. Clear all existing agents ─────────────────────────────────────────
    await db.agents.clear();

    // ── 7. Create agents ──────────────────────────────────────────────────────

    // London agent 1: shadow recruit available
    const agent1 = createAgent('shadow', 'recruit', 'london');
    const agent1Id = await db.agents.add({
      ...agent1,
      missionStreak: 0,
      status: 'available',
      missionsCompleted: 2,
      missionsAttempted: 3,
    });

    // London agent 2: watcher recruit injured
    const agent2 = createAgent('watcher', 'recruit', 'london');
    const agent2Id = await db.agents.add({
      ...agent2,
      missionStreak: 0,
      status: 'injured',
      injuredAt: now - 30000,
      healsAt: now + 90000,
      injuryDescription: 'Odřeniny při úniku přes střechy',
      missionsCompleted: 1,
      missionsAttempted: 2,
    });

    // London agent 3: hacker operative available
    const agent3 = createAgent('hacker', 'operative', 'london');
    const agent3Id = await db.agents.add({
      ...agent3,
      missionStreak: 3,
      status: 'available',
      missionsCompleted: 8,
      missionsAttempted: 10,
    });

    // London agent 4: analyst_surv operative on_mission (for active mission 1)
    const agent4 = createAgent('analyst_surv', 'operative', 'london');
    const agent4Id = await db.agents.add({
      ...agent4,
      missionStreak: 7,
      status: 'on_mission',
      missionsCompleted: 5,
      missionsAttempted: 7,
    });

    // London agent 5: ghost_net specialist available with equipment
    const agent5 = createAgent('ghost_net', 'specialist', 'london');
    const agent5Id = await db.agents.add({
      ...agent5,
      missionStreak: 0,
      status: 'available',
      missionsCompleted: 15,
      missionsAttempted: 18,
      equipment: [
        { equipmentId: 'hacking_rig' },
        { equipmentId: 'encrypted_radio' },
        { equipmentId: 'stealth_suit' },
      ],
    });

    // London agent 6: shadow veteran "the Ghost"
    const agent6 = createAgent('shadow', 'veteran', 'london');
    const agent6Id = await db.agents.add({
      ...agent6,
      missionStreak: 15,
      status: 'available',
      missionsCompleted: 28,
      missionsAttempted: 30,
      nickname: 'the Ghost',
      equipment: [
        { equipmentId: 'night_vision' },
        { equipmentId: 'silenced_pistol' },
        { equipmentId: null },
      ],
    });

    // Amsterdam agent 7: cleaner specialist injured
    const agent7 = createAgent('cleaner', 'specialist', 'amsterdam');
    const agent7Id = await db.agents.add({
      ...agent7,
      missionStreak: 0,
      status: 'injured',
      injuredAt: now - 120000,
      healsAt: now + 480000,
      injuryDescription: 'Střelná rána do stehna — průstřel',
      missionsCompleted: 11,
      missionsAttempted: 14,
    });

    // Amsterdam agent 8: demo_expert operative captured
    const agent8 = createAgent('demo_expert', 'operative', 'amsterdam');
    const agent8Id = await db.agents.add({
      ...agent8,
      missionStreak: 0,
      status: 'captured',
      capturedAt: now - 600000,
      rescueMissionId: 'demo_rescue_mission_id',
      missionsCompleted: 4,
      missionsAttempted: 6,
    });

    // Amsterdam agent 9: handler veteran "the Butcher"
    const agent9 = createAgent('handler', 'veteran', 'amsterdam');
    const agent9Id = await db.agents.add({
      ...agent9,
      missionStreak: 0,
      status: 'available',
      missionsCompleted: 22,
      missionsAttempted: 24,
      nickname: 'the Butcher',
      equipment: [
        { equipmentId: 'suppressed_smg' },
        { equipmentId: 'body_armor' },
        { equipmentId: 'smoke_grenades' },
      ],
    });

    // Amsterdam agent 10: courier operative traveling to london
    const agent10 = createAgent('courier', 'operative', 'amsterdam');
    const agent10Id = await db.agents.add({
      ...agent10,
      missionStreak: 0,
      status: 'traveling',
      travelDestinationId: 'london',
      arrivesAt: now + 25 * 60 * 1000,
      missionsCompleted: 4,
      missionsAttempted: 5,
    });

    // Berlin agent 11: disruptor recruit rank-up ready
    const agent11 = createAgent('disruptor', 'recruit', 'berlin');
    const agent11Id = await db.agents.add({
      ...agent11,
      missionStreak: 0,
      status: 'available',
      xp: 400,
      xpToNextRank: 400,
      missionsCompleted: 3,
      missionsAttempted: 4,
    });

    // Berlin agent 12: diplomat specialist available
    const agent12 = createAgent('diplomat', 'specialist', 'berlin');
    const agent12Id = await db.agents.add({
      ...agent12,
      missionStreak: 0,
      status: 'available',
      missionsCompleted: 9,
      missionsAttempted: 11,
    });

    // Dead agent 13: arsonist veteran dead
    const agent13 = createAgent('arsonist', 'veteran', 'amsterdam');
    await db.agents.add({
      ...agent13,
      missionStreak: 0,
      status: 'dead',
      missionsCompleted: 18,
      missionsAttempted: 20,
      nickname: 'the Phantom',
    });

    // Suppress unused variable warnings by referencing them
    void agent1Id;
    void agent2Id;
    void agent3Id;
    void agent5Id;
    void agent6Id;
    void agent7Id;
    void agent10Id;
    void agent11Id;
    void agent12Id;

    // ── 8. Generate and set London missions ───────────────────────────────────
    // Clear existing london missions first
    const existingLondonMissions = await db.missions
      .where('regionId')
      .equals('london')
      .toArray();
    const existingLondonIds = existingLondonMissions.map((m) => m.id);
    await db.missions.bulkDelete(existingLondonIds);

    // Generate 6 fresh missions for London
    const londonMissions = generateMissionsForRegion(
      'london',
      0.8,
      6,
      new Set(),
      ['surveillance', 'cyber', 'extraction'] as DivisionId[],
      false,
      1,
    );
    await db.missions.bulkAdd(londonMissions);

    // Create rescue mission manually (capturedAgentId = agent8's actual ID)
    const rescueMission: Mission = {
      id: 'demo_rescue_mission_id',
      regionId: 'london',
      category: 'extraction',
      targetId: 't39',
      title: 'Záchranná operace: WOLF',
      flavor: 'Agent byl zajat. Čas se krátí.',
      difficulty: 3,
      minAgents: 2,
      maxAgents: 3,
      requiredDivisions: ['extraction'] as DivisionId[],
      baseSuccessChance: 0.65,
      baseDuration: 180,
      rewards: { money: 500, intel: 5, shadow: 2, influence: 0, xp: 120 },
      failurePenalty: {
        money: -200,
        intel: -5,
        shadow: -3,
        influence: 0,
        xp: 0,
      },
      alertGain: 0.4,
      isRescue: true,
      capturedAgentId: agent8Id as string,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
    };
    await db.missions.add(rescueMission);

    // Update rescue mission reference on captured agent to use the actual agent ID
    await db.agents.update(agent8Id as string, {
      rescueMissionId: 'demo_rescue_mission_id',
    });

    // Set london region available missions
    await db.regions.update('london', {
      availableMissionIds: [
        ...londonMissions.map((m) => m.id),
        'demo_rescue_mission_id',
      ],
      missionTier: 1,
    });

    // ── 9. Generate Amsterdam missions ────────────────────────────────────────
    const amsterdamMissions = generateMissionsForRegion(
      'amsterdam',
      1.2,
      5,
      new Set(),
      ['blackops', 'sabotage'] as DivisionId[],
      false,
      1,
    );
    await db.missions.bulkAdd(amsterdamMissions);

    // Demo flash mission for Amsterdam — ends in ~3.5 min so blinking timer is visible
    const demoFlash = generateFlashMission('amsterdam', 1.2, [
      'blackops',
      'sabotage',
    ] as DivisionId[]);
    const demoFlashWithExpiry: Mission = {
      ...demoFlash,
      title: demoFlash.title,
      expiresAt: now + 3.5 * 60 * 1000,
    };
    await db.missions.add(demoFlashWithExpiry);

    await db.regions.update('amsterdam', {
      availableMissionIds: [
        ...amsterdamMissions.map((m) => m.id),
        demoFlashWithExpiry.id,
      ],
    });

    // ── 10. Active missions ───────────────────────────────────────────────────
    await db.activeMissions.clear();

    // Active mission 1: london, analyst_surv, completes in 30s
    const activeMission1: ActiveMission = {
      id: 'demo_active_1',
      missionId: londonMissions[0].id,
      agentIds: [agent4Id as string],
      equipmentIds: [],
      startedAt: now - 60000,
      completesAt: now + 30000,
      successChance: 0.78,
      approach: 'standard',
      collected: false,
    };

    // Active mission 2: amsterdam, handler veteran
    const activeMission2: ActiveMission = {
      id: 'demo_active_2',
      missionId: amsterdamMissions[0].id,
      agentIds: [agent9Id as string],
      equipmentIds: ['suppressed_smg', 'body_armor', 'smoke_grenades'],
      startedAt: now - 120000,
      completesAt: now + 180000,
      successChance: 0.85,
      approach: 'aggressive',
      collected: false,
    };

    await db.activeMissions.bulkAdd([activeMission1, activeMission2]);

    // ── 11. Recruitment pools ─────────────────────────────────────────────────
    await db.recruitmentPools.clear();

    const londonPool = generateRecruitmentPool(
      'london',
      ['surveillance', 'cyber', 'extraction'] as DivisionId[],
      3,
      5,
    );
    const amsterdamPool = generateRecruitmentPool(
      'amsterdam',
      ['blackops', 'sabotage'] as DivisionId[],
      2,
      3,
    );
    const berlinPool = generateRecruitmentPool(
      'berlin',
      ['influence', 'logistics'] as DivisionId[],
      1,
      3,
    );
    await db.recruitmentPools.bulkAdd([londonPool, amsterdamPool, berlinPool]);

    // ── 12. Refresh game store ────────────────────────────────────────────────
    await loadGame();
  } catch (err) {
    console.error('[seedDemoDb] Failed to seed demo database:', err);
    throw err;
  }
}
