import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Coins,
  Eye,
  Ghost,
  Radio,
  Skull,
  Star,
  XCircle,
  Zap,
} from 'lucide-react';
import { C, modalSheet, modalOverlay } from '../../styles/tokens';
import type { CompletedMissionResult } from '../../store/missionStore';
import { CATEGORY_META, RESULT_META } from './missionConstants';
import { RANK_LABEL } from '../shared/constants';
import { difficultyDots } from './missionHelpers';

export function ResultModal({
  result,
  onDismiss,
}: {
  result: CompletedMissionResult;
  onDismiss: () => void;
}) {
  const rm = RESULT_META[result.result];
  const meta =
    CATEGORY_META[result.mission.category] ?? CATEGORY_META.surveillance;
  const [renderNow] = useState(() => Date.now());

  const resultIcon =
    result.result === 'success' ? (
      <CheckCircle size={40} color={rm.color} />
    ) : result.result === 'partial' ? (
      <AlertTriangle size={40} color={rm.color} />
    ) : result.result === 'failure' ? (
      <XCircle size={40} color={rm.color} />
    ) : (
      <Skull size={40} color={rm.color} />
    );

  const hasPositive =
    result.rewards.money > 0 ||
    result.rewards.intel > 0 ||
    result.rewards.shadow > 0 ||
    result.rewards.influence > 0;
  const hasNegative =
    result.rewards.money < 0 ||
    result.rewards.intel < 0 ||
    result.rewards.shadow < 0 ||
    result.rewards.influence < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={modalOverlay}
    >
      <div
        className="w-full rounded-t-2xl flex flex-col max-h-[80vh] overflow-y-auto"
        style={modalSheet}
      >
        <div className="p-5 flex flex-col gap-4">
          {/* Result hero */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: rm.bg }}
            >
              {resultIcon}
            </div>
            <h2
              className="text-xl font-bold tracking-tight"
              style={{ color: rm.color }}
            >
              {rm.label}
            </h2>
            <p className="text-sm text-center" style={{ color: '#999' }}>
              {result.mission.title}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: `${meta.color}22`, color: meta.color }}
              >
                {meta.label}
              </span>
              {difficultyDots(result.mission.difficulty, meta.color)}
            </div>
            {result.mission.flavor && (
              <p
                className="text-xs text-center italic px-2"
                style={{ color: '#666' }}
              >
                {result.mission.flavor}
              </p>
            )}
          </div>

          {/* Rewards */}
          {(hasPositive || hasNegative) && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: C.bgSurface2 }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#888' }}
              >
                Výsledek operace
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    Icon: Coins,
                    color: C.green,
                    key: 'money' as const,
                    label: 'Peníze',
                  },
                  {
                    Icon: Eye,
                    color: C.blue,
                    key: 'intel' as const,
                    label: 'Intel',
                  },
                  {
                    Icon: Ghost,
                    color: C.bm,
                    key: 'shadow' as const,
                    label: 'Shadow',
                  },
                  {
                    Icon: Radio,
                    color: C.divExtraction,
                    key: 'influence' as const,
                    label: 'Vliv',
                  },
                  {
                    Icon: Star,
                    color: C.yellow,
                    key: 'xp' as const,
                    label: 'XP',
                  },
                ].map(({ Icon, color: iconColor, key, label }) => {
                  const val = result.rewards[key];
                  if (!val) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Icon size={13} color={iconColor} />
                      <div>
                        <p className="text-xs" style={{ color: '#888' }}>
                          {label}
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{ color: val > 0 ? '#4ade80' : '#ef4444' }}
                        >
                          {val > 0 ? '+' : ''}
                          {val}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alert penalty */}
          {result.alertGain > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: C.bgSurface2 }}
            >
              <Zap size={14} color="#f97316" />
              <span className="text-xs" style={{ color: '#888' }}>
                Alert Level +{result.alertGain.toFixed(1)} v regionu
              </span>
            </div>
          )}

          {/* Rank-up notifications */}
          {result.rankedUpAgents?.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#1a1500' }}
            >
              <p
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#facc15' }}
              >
                ⭐ Postup v hodnosti
              </p>
              {result.rankedUpAgents.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: '#e8e8e8' }}
                  >
                    {a.name}
                  </span>
                  <span className="text-xs" style={{ color: '#facc15' }}>
                    →{' '}
                    {RANK_LABEL[a.newRank as keyof typeof RANK_LABEL] ??
                      a.newRank}
                  </span>
                  {a.nickname && (
                    <span className="text-xs italic" style={{ color: '#aaa' }}>
                      {a.nickname}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Affected agents */}
          {result.affectedAgentIds.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#2e0f0f' }}
            >
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
                {result.result === 'catastrophe'
                  ? '⚠ Agent zajat'
                  : '⚠ Agenti zranění'}
              </p>
              {result.injuredAgents.length > 0 ? (
                result.injuredAgents.map((ia) => {
                  const severityColor =
                    ia.severity === 'critical'
                      ? '#ef4444'
                      : ia.severity === 'serious'
                        ? '#f97316'
                        : '#facc15';
                  const severityLabel =
                    ia.severity === 'critical'
                      ? 'Kritické'
                      : ia.severity === 'serious'
                        ? 'Vážné'
                        : 'Lehké';
                  const healsIn = Math.ceil((ia.healsAt - renderNow) / 60000);
                  return (
                    <div key={ia.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: '#e8e8e8' }}>
                          {ia.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: severityColor }}
                          >
                            {severityLabel}
                          </span>
                          <span className="text-xs" style={{ color: '#888' }}>
                            ~{healsIn} min
                          </span>
                        </div>
                      </div>
                      {ia.description && (
                        <p className="text-xs italic" style={{ color: '#888' }}>
                          {ia.description}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs" style={{ color: '#888' }}>
                  {result.affectedAgentIds.length} agent(ů) zajat(o).
                </p>
              )}
            </div>
          )}

          {/* Killed agent */}
          {result.killedAgent && (
            <div
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: '#1a0a0a' }}
            >
              <Skull size={16} color="#ef4444" />
              <div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: '#ef4444' }}
                >
                  Agent zabit
                </p>
                <p className="text-sm" style={{ color: '#e8e8e8' }}>
                  {result.killedAgent.name}
                </p>
              </div>
            </div>
          )}

          {/* Lost equipment */}
          {result.lostEquipment && result.lostEquipment.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: '#1a1208' }}
            >
              <p className="text-xs font-medium" style={{ color: '#f97316' }}>
                Ztracené vybavení
              </p>
              {result.lostEquipment.map((eq) => (
                <div key={eq.id} className="flex items-center gap-2">
                  <span
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: '#f97316' }}
                  />
                  <span className="text-sm" style={{ color: '#e8e8e8' }}>
                    {eq.name}
                  </span>
                </div>
              ))}
              <p className="text-xs" style={{ color: '#888' }}>
                Prodáno za 30 % hodnoty.
              </p>
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full py-3.5 rounded-xl font-bold text-sm"
            style={{ background: rm.color, color: '#141414' }}
          >
            Potvrdit
          </button>
        </div>
      </div>
    </div>
  );
}
