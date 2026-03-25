import { db } from '../db/db';
import type { ActiveRivalOperation, RivalEventType } from '../db/schema';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { randomId } from '../utils/rng';
import { demoteRank, generateRecruitmentPool } from './agentGenerator';
import type { DivisionId } from '../data/agentTypes';
import { REGION_MAP } from '../data/regions';
import { MODULE_CATALOG } from '../data/costs';

export const RIVAL_OPERATION_INTERVAL_MIN_MS = 30 * 60 * 1000;
export const RIVAL_OPERATION_INTERVAL_MAX_MS = 45 * 60 * 1000;

export const RIVAL_EVENT_META: Record<
  RivalEventType,
  { label: string; description: string }
> = {
  asset_compromise: {
    label: 'Kompromitace aktiva',
    description: 'Degradace náhodného agenta o 1 rank.',
  },
  intel_theft: {
    label: 'Krádež intel',
    description: 'Okamžitá ztráta části intel zásob.',
  },
  sabotage: {
    label: 'Sabotáž modulu',
    description: 'Náhodný modul safe housu je dočasně nefunkční.',
  },
  agent_recruitment: {
    label: 'Přetáhnutí agenta',
    description: 'Nejslabší agent v regionu je ztracen.',
  },
  disinformation: {
    label: 'Dezinformace',
    description: 'Alert v regionu se zvýší o +0.5.',
  },
  rival_leak: {
    label: 'Únik intelu',
    description: 'Mise v regionu mají dočasně +3 intel cost.',
  },
  burned_contracts: {
    label: 'Spálené kontrakty',
    description: 'Nábor v regionu je dočasně oslaben.',
  },
  safe_house_swap: {
    label: 'Přesun agenta',
    description: 'Náhodný dostupný agent je přesunut do jiného safe housu.',
  },
};

export const RIVAL_EVENT_LABEL: Record<RivalEventType, string> = {
  asset_compromise: RIVAL_EVENT_META.asset_compromise.label,
  intel_theft: RIVAL_EVENT_META.intel_theft.label,
  sabotage: RIVAL_EVENT_META.sabotage.label,
  agent_recruitment: RIVAL_EVENT_META.agent_recruitment.label,
  disinformation: RIVAL_EVENT_META.disinformation.label,
  rival_leak: RIVAL_EVENT_META.rival_leak.label,
  burned_contracts: RIVAL_EVENT_META.burned_contracts.label,
  safe_house_swap: RIVAL_EVENT_META.safe_house_swap.label,
};

const RIVAL_EVENT_TYPES: RivalEventType[] = [
  'asset_compromise',
  'intel_theft',
  'sabotage',
  'agent_recruitment',
  'disinformation',
  'rival_leak',
  'burned_contracts',
  'safe_house_swap',
];

export function nextRivalOperationAt(from = Date.now()): number {
  const min = RIVAL_OPERATION_INTERVAL_MIN_MS;
  const max = RIVAL_OPERATION_INTERVAL_MAX_MS;
  return from + min + Math.floor(Math.random() * (max - min + 1));
}

export function pickRivalEventType(): RivalEventType {
  return RIVAL_EVENT_TYPES[
    Math.floor(Math.random() * RIVAL_EVENT_TYPES.length)
  ];
}

export function createRivalOperation(
  regionId: string,
  eventType: RivalEventType,
  now = Date.now(),
): ActiveRivalOperation {
  return {
    id: randomId(),
    regionId,
    eventType,
    createdAt: now,
    expiresAt: now + 20 * 60 * 1000,
  };
}

export async function applyRivalOperation(
  op: ActiveRivalOperation,
): Promise<string> {
  const game = useGameStore.getState();
  const region = await db.regions.get(op.regionId);
  if (!region) return 'Rival operace selhala: region neexistuje.';

  if (op.eventType === 'asset_compromise') {
    const agents = await db.agents
      .filter(
        (a) =>
          a.safeHouseId === op.regionId &&
          a.status !== 'dead' &&
          a.status !== 'captured',
      )
      .toArray();
    if (!agents.length)
      return 'Rival: kompromitace aktiva — žádný vhodný agent.';
    const target = agents[Math.floor(Math.random() * agents.length)];
    await db.agents.put(demoteRank(target));
    if (target.rank === 'director' && game.directorAgentId === target.id) {
      game.setDirectorAgent(null);
    }
    return `Rival: kompromitace aktiva — ${target.name} byl degradován.`;
  }

  if (op.eventType === 'intel_theft') {
    const loss = 15 + Math.floor(Math.random() * 16);
    game.addCurrencies({ intel: -loss });
    return `Rival: krádež intel — ztráta ${loss} intel.`;
  }

  if (op.eventType === 'sabotage') {
    const sh = await db.safeHouses.get(op.regionId);
    if (!sh || !sh.modules.length) {
      return 'Rival: sabotáž — žádný modul k sabotáži.';
    }
    const moduleId = sh.modules[Math.floor(Math.random() * sh.modules.length)];
    const moduleName =
      MODULE_CATALOG.find((m) => m.id === moduleId)?.name ?? 'neznámý modul';
    const disabled = (sh.disabledModules ?? []).filter(
      (m) => m.until > Date.now() && m.moduleId !== moduleId,
    );
    disabled.push({
      moduleId,
      until: Date.now() + 10 * 60 * 1000,
      reason: 'rival_sabotage',
    });
    await db.safeHouses.update(sh.id, { disabledModules: disabled });
    return `Rival: sabotáž — modul ${moduleName} je nefunkční 10 min.`;
  }

  if (op.eventType === 'agent_recruitment') {
    const agents = await db.agents
      .filter(
        (a) =>
          a.safeHouseId === op.regionId &&
          a.status !== 'dead' &&
          a.status !== 'captured',
      )
      .toArray();
    if (!agents.length) return 'Rival: přetáhnutí agenta — žádný vhodný agent.';
    const weakest = [...agents].sort((a, b) => {
      const sa =
        a.stats.stealth + a.stats.combat + a.stats.intel + a.stats.tech;
      const sb =
        b.stats.stealth + b.stats.combat + b.stats.intel + b.stats.tech;
      return sa - sb;
    })[0];
    await db.agents.update(weakest.id, {
      status: 'dead',
      equipment: [
        { equipmentId: null },
        { equipmentId: null },
        { equipmentId: null },
      ],
    });
    game.incrementStat('agents');
    if (game.directorAgentId === weakest.id) {
      game.setDirectorAgent(null);
    }
    return `Rival: přetáhnutí agenta — ${weakest.name} byl ztracen.`;
  }

  if (op.eventType === 'disinformation') {
    await db.regions.update(op.regionId, {
      alertLevel: Math.min(3, (region.alertLevel ?? 0) + 0.5),
    });
    return 'Rival: dezinformace — alert v regionu +0.5.';
  }

  if (op.eventType === 'rival_leak') {
    await db.regions.update(op.regionId, {
      rivalLeakUntil: Date.now() + 15 * 60 * 1000,
    });
    return 'Rival: únik intelu — mise v regionu mají +3 intel cost na 15 min.';
  }

  if (op.eventType === 'burned_contracts') {
    await db.regions.update(op.regionId, {
      burnedContractsUntil: Date.now() + 10 * 60 * 1000,
    });
    const sh = await db.safeHouses.get(op.regionId);
    if (sh) {
      const divisions =
        sh.assignedDivisions.length > 0
          ? sh.assignedDivisions
          : (game.unlockedDivisions as DivisionId[]);
      const loweredLevel = Math.max(1, sh.level - 1);
      const pool = generateRecruitmentPool(
        op.regionId,
        divisions,
        loweredLevel,
        3,
      );
      await db.recruitmentPools.put(pool);
    }
    return 'Rival: spálené kontrakty — nábor je oslaben na 10 min.';
  }

  const allOwned = await db.safeHouses
    .filter((s) => s.id !== op.regionId && !s.constructionInProgress)
    .toArray();
  const agents = await db.agents
    .filter((a) => a.safeHouseId === op.regionId && a.status === 'available')
    .toArray();
  if (!allOwned.length || !agents.length) {
    return 'Rival: přesun agenta — žádný validní cíl.';
  }
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const target = allOwned[Math.floor(Math.random() * allOwned.length)];
  await db.agents.update(agent.id, { safeHouseId: target.id });
  const targetName = REGION_MAP.get(target.id)?.name ?? 'neznámého regionu';
  return `Rival: přesun agenta — ${agent.name} přesunut do ${targetName}.`;
}

export function notifyRival(
  type: 'info' | 'warning' | 'error' | 'success',
  text: string,
): void {
  useUIStore.getState().showToast(type, text);
}
