import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { C, activeTab, btn, chipStyle } from '../../styles/tokens';
import type { MissionSortMode } from './missionFilters';
import type { SortDirection } from './missionFilters';

interface MissionFiltersToolbarProps {
  availableDifficultyCount: number;
  quickDifficulty: number | null;
  sortMode: MissionSortMode;
  sortDirection: SortDirection;
  onSetQuickDifficulty: (difficulty: number | null) => void;
  onClearQuickDifficulty: () => void;
  onSetSortMode: (mode: MissionSortMode) => void;
  onToggleSortDirection: () => void;
}

export function MissionFiltersToolbar({
  availableDifficultyCount,
  quickDifficulty,
  sortMode,
  sortDirection,
  onSetQuickDifficulty,
  onClearQuickDifficulty,
  onSetSortMode,
  onToggleSortDirection,
}: MissionFiltersToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[1, 2, 3, 4, 5].map((diff) => (
          <button
            key={diff}
            onClick={() =>
              onSetQuickDifficulty(diff === quickDifficulty ? null : diff)
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={
              quickDifficulty === diff
                ? chipStyle(C.yellow)
                : btn.secondary(false)
            }
          >
            {diff}★
          </button>
        ))}
        {quickDifficulty !== null && (
          <button
            onClick={onClearQuickDifficulty}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={btn.ghost}
          >
            Vše
          </button>
        )}
      </div>

      <p className="text-[11px]" style={{ color: C.textMuted }}>
        Aktivní obtížnosti v regionu: {availableDifficultyCount}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSetSortMode('recommended')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={
            sortMode === 'recommended' ? activeTab.active : activeTab.inactive
          }
        >
          Doporučené
        </button>
        <button
          onClick={() => onSetSortMode('reward')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={sortMode === 'reward' ? activeTab.active : activeTab.inactive}
        >
          Odměna
        </button>

        <button
          onClick={onToggleSortDirection}
          className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
          style={btn.secondary(false)}
        >
          {sortDirection === 'desc' ? (
            <ArrowDownAZ size={13} />
          ) : (
            <ArrowUpAZ size={13} />
          )}
          {sortDirection === 'desc' ? 'Nejlepší nahoře' : 'Nejhorší nahoře'}
        </button>
      </div>
    </div>
  );
}
