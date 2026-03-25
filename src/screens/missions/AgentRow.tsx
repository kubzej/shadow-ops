import { C, cardBase, cardActive } from '../../styles/tokens';
import type { Agent } from '../../db/schema';
import { DIVISIONS } from '../../data/agentTypes';
import type { AgentEligibility } from '../../engine/missionResolver';
import { STAT_LABELS } from './missionConstants';

const GOLD = '#eab308';

export function AgentRow({
  agent,
  selected,
  disabled,
  onToggle,
  eligibility,
}: {
  agent: Agent;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  eligibility: AgentEligibility;
}) {
  const isDirector = agent.rank === 'director';
  const divInfo = DIVISIONS.find((d) => d.id === agent.division);
  const eligColor = eligibility.eligible
    ? isDirector ? GOLD : '#4ade80'
    : eligibility.missingDivision && eligibility.missingStats.length === 0
      ? '#f97316'
      : '#ef4444';

  const rowStyle = isDirector
    ? {
        ...(selected ? cardActive : cardBase),
        background: selected ? '#2a1e00' : '#1a1400',
        border: `1px solid ${GOLD}${selected ? '88' : '44'}`,
        opacity: disabled && !selected ? 0.4 : 1,
      }
    : {
        ...(selected ? cardActive : cardBase),
        opacity: disabled && !selected ? 0.4 : 1,
      };

  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left"
      style={rowStyle}
    >
      {/* Eligibility indicator */}
      <div
        className="w-1.5 self-stretch rounded-full flex-shrink-0"
        style={{ background: eligColor }}
      />

      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={
          isDirector
            ? { background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }
            : { background: selected ? `${C.green}20` : C.bgSurface2, color: selected ? C.green : C.textMuted }
        }
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p
            className="text-sm font-medium truncate"
            style={{ color: isDirector ? GOLD : selected ? '#4ade80' : '#e8e8e8' }}
          >
            {agent.name}
          </p>
          {isDirector && (
            <span
              className="text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0"
              style={{ background: `${GOLD}22`, color: GOLD }}
            >
              ★ ŘEDITEL
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-xs px-1 py-0.5 rounded"
            style={{
              background: `${isDirector ? GOLD : divInfo?.color ?? '#4ade80'}18`,
              color: isDirector ? GOLD : divInfo?.color ?? '#4ade80',
            }}
          >
            {divInfo?.name ?? agent.division}
          </span>
          {!eligibility.eligible && (
            <span className="text-xs" style={{ color: eligColor }}>
              {eligibility.missingDivision ? '✗ divize' : ''}
              {eligibility.missingStats
                .map(
                  (s) =>
                    `✗ ${STAT_LABELS[s.stat] ?? s.stat} ${s.actual}/${s.required}`,
                )
                .join(' ')}
            </span>
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-4 gap-1 text-xs flex-shrink-0"
        style={{ color: '#999' }}
      >
        {(['stealth', 'combat', 'intel', 'tech'] as const).map((s) => (
          <div key={s} className="flex flex-col items-center">
            <span
              className="text-xs font-semibold"
              style={{ color: isDirector ? GOLD : '#aaa' }}
            >
              {agent.stats[s]}
            </span>
            <span className="text-[9px] uppercase tracking-wide">
              {s.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}
