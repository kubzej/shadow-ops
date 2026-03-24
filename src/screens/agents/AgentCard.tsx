import { ChevronRight, Flame } from 'lucide-react';
import { cardBase } from '../../styles/tokens';
import type { Agent } from '../../db/schema';
import { AGENT_TYPES } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { canRankUp } from '../../engine/agentGenerator';
import { RANK_LABEL, STATUS_META } from '../shared/constants';
import { divisionColor, divisionName } from './agentHelpers';

export function AgentCard({
  agent,
  onTap,
}: {
  agent: Agent;
  onTap: (a: Agent) => void;
}) {
  const color = divisionColor(agent.division);
  const statusMeta = STATUS_META[agent.status];
  const avg = Math.round(
    (agent.stats.stealth +
      agent.stats.combat +
      agent.stats.intel +
      agent.stats.tech) /
      4,
  );

  return (
    <button
      onClick={() => onTap(agent)}
      className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition-all"
      style={cardBase}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: `${color}22`, color }}
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-sm font-medium truncate"
            style={{ color: '#e8e8e8' }}
          >
            {agent.name}
          </span>
          {agent.nickname && (
            <span
              className="text-xs italic flex-shrink-0"
              style={{ color: '#666' }}
            >
              {agent.nickname}
            </span>
          )}
          {canRankUp(agent) && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
              style={{ background: '#facc1522', color: '#facc15' }}
            >
              RANK UP
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: `${color}22`, color }}
          >
            {divisionName(agent.division)}
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            {AGENT_TYPES.find((t) => t.id === agent.typeId)?.name ??
              agent.typeId}
          </span>
          <span className="text-xs" style={{ color: '#777' }}>
            ·
          </span>
          <span className="text-xs" style={{ color: '#888' }}>
            {RANK_LABEL[agent.rank]}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs" style={{ color: '#777' }}>
            📍 {REGION_MAP.get(agent.safeHouseId)?.name ?? agent.safeHouseId}
          </span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span
          className="text-xs font-semibold"
          style={{ color: statusMeta.color }}
        >
          {statusMeta.label}
        </span>
        <div className="flex items-center gap-1.5">
          {(agent.missionStreak ?? 0) >= 5 && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: '#f9731622', color: '#f97316' }}
            >
              <Flame size={10} />
              {agent.missionStreak}
            </span>
          )}
          <span className="text-xs font-mono" style={{ color: '#888' }}>
            avg {avg}
          </span>
        </div>
      </div>

      <ChevronRight size={16} style={{ color: '#999', flexShrink: 0 }} />
    </button>
  );
}
