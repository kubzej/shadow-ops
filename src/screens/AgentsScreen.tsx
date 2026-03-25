import { useEffect, useState, useCallback } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import { C, activeTab } from '../styles/tokens';
import { Clock, Users } from 'lucide-react';
import { db } from '../db/db';
import type { Agent, AgentStatus } from '../db/schema';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { AgentCard } from './agents/AgentCard';
import { AgentDetailModal } from './agents/AgentDetailModal';
import { HealingCountdown } from './agents/CountdownTimers';

type FilterTab = 'all' | 'available' | 'on_mission' | 'injured';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Všichni' },
  { id: 'available', label: 'Volní' },
  { id: 'on_mission', label: 'Na misi' },
  { id: 'injured', label: 'Zranění' },
];

export default function AgentsScreen() {
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);
  const startCityId = useGameStore((s) => s.startCityId);
  const currentRegionId = selectedRegionId ?? startCityId;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selected, setSelected] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    const all = await db.agents
      .filter((a) => a.safeHouseId === currentRegionId && a.status !== 'dead')
      .toArray();
    setAgents(all);
    setLoading(false);
  }, [currentRegionId]);

  useEffect(() => {
    loadAgents();
    const interval = setInterval(loadAgents, 5000);
    return () => clearInterval(interval);
  }, [loadAgents]);

  // Sync selected agent when agents list refreshes (to avoid stale modal data)
  useEffect(() => {
    if (!selected) return;
    const fresh = agents.find((a) => a.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [agents]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts: Record<FilterTab, number> = {
    all: agents.length,
    available: agents.filter((a) => a.status === 'available').length,
    on_mission: agents.filter((a) => a.status === 'on_mission').length,
    injured: agents.filter(
      (a) => a.status === 'injured' || a.status === 'captured',
    ).length,
  };

  const filtered =
    filter === 'all'
      ? agents
      : filter === 'injured'
        ? agents.filter(
            (a) => a.status === 'injured' || a.status === 'captured',
          )
        : agents.filter((a) => a.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    const order: Record<AgentStatus, number> = {
      captured: 0,
      injured: 1,
      traveling: 2,
      on_mission: 3,
      available: 4,
      dead: 5,
    };
    return order[a.status] - order[b.status];
  });

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold tracking-tight">Agenti</h1>
          <div
            className="flex items-center gap-1.5 text-sm"
            style={{ color: '#888' }}
          >
            <Users size={16} />
            <span>{agents.length}</span>
          </div>
        </div>

        <div className="mb-3">
          <CurrenciesBar />
        </div>

        <CityBar />

        {/* Healing timers for injured agents */}
        {agents.some((a) => a.status === 'injured' && a.healsAt) && (
          <div className="flex flex-col gap-1 mb-2">
            {agents
              .filter((a) => a.status === 'injured' && a.healsAt)
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs"
                  style={{ background: '#1a1208' }}
                >
                  <Clock size={11} color="#f97316" />
                  <span style={{ color: '#f97316' }}>{a.name}</span>
                  <span style={{ color: '#999' }}>se léčí —</span>
                  <HealingCountdown healsAt={a.healsAt!} />
                </div>
              ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            const count = counts[tab.id];
            if (tab.id !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  ...(active ? activeTab.active : activeTab.inactive),
                  padding: '6px 12px',
                  flexShrink: 0,
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="px-1 min-w-4 text-center rounded text-[10px]"
                    style={{
                      background: active ? `${C.green}20` : C.bgSurface2,
                      color: active ? C.green : C.textMuted,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent list */}
      <div className="flex-1 px-4 flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl h-16 animate-pulse"
              style={{ background: C.bgSurface }}
            />
          ))
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users size={48} style={{ color: '#666666' }} />
            <p className="text-sm" style={{ color: '#888' }}>
              {filter === 'all'
                ? 'Žádní agenti'
                : 'Žádní agenti v této kategorii'}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-center px-8" style={{ color: '#777' }}>
                Najmi prvního agenta na Základně.
              </p>
            )}
          </div>
        ) : (
          sorted.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onTap={setSelected} />
          ))
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <AgentDetailModal
          agent={selected}
          onClose={() => setSelected(null)}
          onAgentUpdated={() => {
            loadAgents();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
