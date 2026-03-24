import { useEffect, useMemo, useState } from 'react';
import { C, cardBase } from '../../styles/tokens';
import type { Agent, ActiveMission, Mission } from '../../db/schema';
import { EQUIPMENT_CATALOG } from '../../data/equipmentCatalog';
import type { Equipment } from '../../data/equipmentCatalog';
import { db } from '../../db/db';
import { CATEGORY_META } from './missionConstants';
import { RARITY_COLOR } from '../shared/constants';
import { Countdown } from './Countdown';
import { chanceColor } from './missionHelpers';

export function ActiveMissionCard({
  active,
  mission,
}: {
  active: ActiveMission;
  mission: Mission;
}) {
  const meta = CATEGORY_META[mission.category] ?? CATEGORY_META.surveillance;
  const total = mission.baseDuration * 1000;
  const [pct, setPct] = useState(() =>
    Math.min(1, (Date.now() - active.startedAt) / total),
  );
  const [isComplete, setIsComplete] = useState(
    () => Date.now() >= active.completesAt,
  );
  const [agentDetails, setAgentDetails] = useState<Agent[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setPct(Math.min(1, (now - active.startedAt) / total));
      setIsComplete(now >= active.completesAt);
    }, 500);
    return () => clearInterval(id);
  }, [active.startedAt, active.completesAt, total]);

  useEffect(() => {
    db.agents.bulkGet(active.agentIds).then((results) => {
      setAgentDetails(results.filter(Boolean) as Agent[]);
    });
  }, [active.agentIds]);

  const equippedItems = useMemo(() => {
    const ids = agentDetails
      .flatMap((a) => a.equipment.map((s) => s.equipmentId))
      .filter(Boolean) as string[];
    return Array.from(new Set(ids))
      .map((id) => EQUIPMENT_CATALOG.find((e) => e.id === id))
      .filter(Boolean) as Equipment[];
  }, [agentDetails]);

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2" style={cardBase}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: `${meta.color}22` }}
          >
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: '#e8e8e8' }}
            >
              {mission.title}
            </p>
            <p className="text-xs" style={{ color: '#999' }}>
              {meta.label} · {active.agentIds.length} agentů
              {active.approach && active.approach !== 'standard' && (
                <span
                  className="ml-1.5 px-1 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    background:
                      active.approach === 'aggressive'
                        ? '#2a140044'
                        : '#001a2a44',
                    color:
                      active.approach === 'aggressive' ? '#f97316' : '#22d3ee',
                  }}
                >
                  {active.approach === 'aggressive' ? 'Agresivní' : 'Skrytá'}
                </span>
              )}
            </p>
          </div>
        </div>
        <div
          className="text-xs font-mono flex-shrink-0"
          style={{ color: isComplete ? meta.color : '#888' }}
        >
          {isComplete ? (
            'Hotovo'
          ) : (
            <Countdown completesAt={active.completesAt} />
          )}
        </div>
      </div>

      {/* Agent list */}
      {agentDetails.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agentDetails.map((a) => (
            <span
              key={a.id}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: C.bgSurface2,
                color: '#aaa',
              }}
            >
              {a.name}
            </span>
          ))}
        </div>
      )}

      {/* Equipped items */}
      {equippedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {equippedItems.map((eq) => (
            <span
              key={eq.id}
              className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{
                background: `${RARITY_COLOR[eq.rarity] ?? '#888'}22`,
                color: RARITY_COLOR[eq.rarity] ?? '#888',
              }}
            >
              {eq.name}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: '#777777' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct * 100}%`,
            background: isComplete ? meta.color : '#4a4a4a',
          }}
        />
      </div>

      {/* Success chance */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#888' }}>
          Šance na úspěch
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: chanceColor(active.successChance) }}
        >
          {Math.round(active.successChance * 100)} %
        </span>
      </div>
    </div>
  );
}
