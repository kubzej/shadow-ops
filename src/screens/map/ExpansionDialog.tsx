import { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Globe,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  C,
  cardBase,
  cardActive,
  btn,
  modalSheet,
  modalOverlay,
} from '../../styles/tokens';
import type { DivisionId } from '../../data/agentTypes';
import { DIVISIONS } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';
import { expansionCost, expansionBuildTime } from '../../engine/mapGenerator';
import { useGameStore } from '../../store/gameStore';

export function ExpansionDialog({
  regionId,
  distanceFromStart,
  onConfirm,
  onClose,
}: {
  regionId: string;
  distanceFromStart: number;
  onConfirm: (divId: DivisionId) => void;
  onClose: () => void;
}) {
  const region = REGION_MAP.get(regionId);
  const country = region ? COUNTRY_MAP.get(region.countryId) : undefined;
  const currencies = useGameStore((s) => s.currencies);
  const totalExpansions = useGameStore((s) => s.totalExpansions);
  const unlocked = useGameStore((s) => s.unlockedDivisions);
  const cost = expansionCost(regionId, distanceFromStart, totalExpansions);
  const buildSec = Math.round(expansionBuildTime(distanceFromStart) / 1000);
  const canAfford =
    currencies.money >= cost.money && currencies.intel >= cost.intel;

  const [step, setStep] = useState<'confirm' | 'pick'>('confirm');
  const [picked, setPicked] = useState<DivisionId | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={modalOverlay}
    >
      <div className="rounded-t-2xl" style={modalSheet}>
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: '#999' }}
          />
        </div>

        <div className="px-4 pt-2 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-xs font-medium tracking-widest uppercase mb-0.5"
                style={{ color: '#facc15' }}
              >
                {step === 'confirm' ? 'Expanze' : 'Startovní divize'}
              </p>
              <h3 className="text-xl font-bold" style={{ color: '#e8e8e8' }}>
                {region?.name ?? regionId}
              </h3>
              <p className="text-sm mt-0.5" style={{ color: '#999' }}>
                {country?.name ?? ''} · vzdálenost {distanceFromStart}
              </p>
            </div>
            <button onClick={onClose} style={{ color: '#888' }}>
              <XCircle size={22} />
            </button>
          </div>

          {step === 'confirm' ? (
            <>
              <div
                className="rounded-xl p-3 mb-3 flex gap-6"
                style={{ background: C.bgSurface2 }}
              >
                {[
                  {
                    Icon: Coins,
                    color: C.green,
                    val: cost.money,
                    have: currencies.money,
                  },
                  {
                    Icon: Eye,
                    color: C.blue,
                    val: cost.intel,
                    have: currencies.intel,
                  },
                ].map(({ Icon, color: iconColor, val, have }) => (
                  <div key={iconColor} className="flex items-center gap-2">
                    <Icon size={14} color={iconColor} />
                    <span
                      className="text-base font-bold"
                      style={{ color: have >= val ? '#4ade80' : '#ef4444' }}
                    >
                      {val}
                    </span>
                    <span className="text-xs" style={{ color: '#888' }}>
                      / {have}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-3 mb-4 flex items-center gap-2"
                style={{ background: C.bgSurface2 }}
              >
                <Clock size={13} color="#888" />
                <span className="text-sm" style={{ color: '#888' }}>
                  Čas výstavby:{' '}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#e8e8e8' }}
                >
                  {Math.floor(buildSec / 60)}m {buildSec % 60}s
                </span>
              </div>

              {!canAfford && (
                <div
                  className="flex items-center gap-2 mb-3 text-sm"
                  style={{ color: '#ef4444' }}
                >
                  <AlertTriangle size={13} /> Nedostatek zdrojů.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={btn.secondary()}
                >
                  Zrušit
                </button>
                <button
                  onClick={() => setStep('pick')}
                  disabled={!canAfford}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                  style={btn.action(C.yellow, !canAfford)}
                >
                  <Globe size={15} /> Expandovat <ChevronRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: '#888' }}>
                Zvol startovní divizi. Další lze přidat za poplatek v Base.
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {(unlocked as DivisionId[]).map((divId) => {
                  const div = DIVISIONS.find((d) => d.id === divId);
                  if (!div) return null;
                  const sel = picked === divId;
                  return (
                    <button
                      key={divId}
                      onClick={() => setPicked(divId)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left w-full"
                      style={sel ? cardActive : cardBase}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${div.color}22` }}
                      >
                        <ShieldCheck size={14} color={div.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium"
                          style={{ color: sel ? div.color : '#e8e8e8' }}
                        >
                          {div.name}
                        </p>
                        <p
                          className="text-xs truncate"
                          style={{ color: '#888' }}
                        >
                          {div.description}
                        </p>
                      </div>
                      {sel && <span style={{ color: div.color }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={btn.secondary()}
                >
                  Zpět
                </button>
                <button
                  onClick={() => {
                    if (picked) onConfirm(picked);
                  }}
                  disabled={!picked}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
                  style={btn.action(C.yellow, !picked)}
                >
                  Potvrdit <ChevronRight size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
