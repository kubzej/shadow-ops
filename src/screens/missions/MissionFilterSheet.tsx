import { ChevronDown, Star, X } from 'lucide-react';
import {
  C,
  activeTab,
  btn,
  cardBase,
  chipStyle,
  modalOverlay,
  modalSheet,
} from '../../styles/tokens';
import type { MissionSortMode } from './missionFilters';
import { SORT_OPTIONS } from './missionFilters';

interface MissionFilterSheetProps {
  open: boolean;
  minDifficulty: number;
  maxDifficulty: number;
  sortMode: MissionSortMode;
  onClose: () => void;
  onSetMinDifficulty: (n: number) => void;
  onSetMaxDifficulty: (n: number) => void;
  onSetSortMode: (mode: MissionSortMode) => void;
  onReset: () => void;
}

export function MissionFilterSheet({
  open,
  minDifficulty,
  maxDifficulty,
  sortMode,
  onClose,
  onSetMinDifficulty,
  onSetMaxDifficulty,
  onSetSortMode,
  onReset,
}: MissionFilterSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={modalOverlay}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl p-4 flex flex-col gap-4"
        style={modalSheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: C.textPrimary }}>
            Filtry misí
          </p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={btn.ghost}
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl p-3 flex flex-col gap-2" style={cardBase}>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: C.textSecondary }}
          >
            Obtížnost
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: C.textMuted }}>
              Min
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={`min_${n}`}
                  onClick={() => onSetMinDifficulty(n)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={
                    n <= minDifficulty
                      ? chipStyle(C.yellow)
                      : btn.secondary(false)
                  }
                >
                  <Star
                    size={12}
                    fill={n <= minDifficulty ? C.yellow : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: C.textMuted }}>
              Max
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={`max_${n}`}
                  onClick={() => onSetMaxDifficulty(n)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={
                    n <= maxDifficulty
                      ? chipStyle(C.blue)
                      : btn.secondary(false)
                  }
                >
                  <Star size={12} fill={n <= maxDifficulty ? C.blue : 'none'} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-3 flex flex-col gap-2" style={cardBase}>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: C.textSecondary }}
          >
            Řazení
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSetSortMode(opt.id)}
                className="px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between"
                style={
                  sortMode === opt.id ? activeTab.active : activeTab.inactive
                }
              >
                <span>{opt.label}</span>
                {sortMode === opt.id && <ChevronDown size={12} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={btn.secondary(false)}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={btn.primary(false)}
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
}
