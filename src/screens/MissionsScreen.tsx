import { useEffect, useState } from 'react';
import CityBar from '../components/CityBar';
import CurrenciesBar from '../components/CurrenciesBar';
import { C } from '../styles/tokens';
import { Shield } from 'lucide-react';
import { useMissionStore } from '../store/missionStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { db } from '../db/db';
import type { Agent, Mission } from '../db/schema';
import { REGION_MAP } from '../data/regions';
import type { MissionApproach } from '../engine/missionResolver';
import type { CompletedMissionResult } from '../store/missionStore';
import { ActiveMissionCard } from './missions/ActiveMissionCard';
import { MissionCard } from './missions/MissionCard';
import { AgentSelectorModal } from './missions/AgentSelectorModal';
import { ResultModal } from './missions/ResultModal';

export default function MissionsScreen() {
  const startCityId = useGameStore((s) => s.startCityId);
  const selectedRegionId = useUIStore((s) => s.selectedRegionId);

  const [, setOwnedRegions] = useState<Array<{ id: string; name: string }>>([]);
  const currentRegionId = selectedRegionId ?? startCityId;

  const availableMissions = useMissionStore((s) => s.availableMissions);
  const activeMissions = useMissionStore((s) => s.activeMissions);
  const completedQueue = useMissionStore((s) => s.completedQueue);
  const loading = useMissionStore((s) => s.loading);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const loadActiveMissions = useMissionStore((s) => s.loadActiveMissions);
  const tickMissions = useMissionStore((s) => s.tickMissions);
  const checkExpirations = useMissionStore((s) => s.checkExpirations);
  const dispatch = useMissionStore((s) => s.dispatch);
  const dismissResult = useMissionStore((s) => s.dismissResult);

  const [activeMissionData, setActiveMissionData] = useState<
    Map<string, Mission>
  >(new Map());
  const [regionAgents, setRegionAgents] = useState<Agent[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [dispatching, setDispatching] = useState(false);

  // Load owned regions for the picker
  useEffect(() => {
    db.regions
      .where('owned')
      .equals(1)
      .toArray()
      .then((rs) => {
        setOwnedRegions(
          rs.map((r) => ({
            id: r.id,
            name: REGION_MAP.get(r.id)?.name ?? r.id,
          })),
        );
      });
  }, [activeMissions, completedQueue]);

  // Load missions on mount / when region changes
  useEffect(() => {
    if (!currentRegionId) return;
    loadActiveMissions().then(() => tickMissions());
    loadMissions(currentRegionId);
    checkExpirations(currentRegionId);

    const refresh = setInterval(
      () => checkExpirations(currentRegionId),
      60_000,
    );
    return () => clearInterval(refresh);
  }, [
    currentRegionId,
    loadMissions,
    loadActiveMissions,
    tickMissions,
    checkExpirations,
  ]);

  // Load mission data for active missions
  useEffect(() => {
    if (activeMissions.length === 0) return;
    const ids = activeMissions.map((a) => a.missionId);
    db.missions.bulkGet(ids).then((ms) => {
      const map = new Map<string, Mission>();
      ms.forEach((m) => {
        if (m) map.set(m.id, m);
      });
      setActiveMissionData(map);
    });
  }, [activeMissions]);

  // Count free agents in the current region
  useEffect(() => {
    if (!currentRegionId) return;
    db.agents
      .where('status')
      .equals('available')
      .filter((a) => a.safeHouseId === currentRegionId)
      .toArray()
      .then(setRegionAgents);
  }, [currentRegionId, activeMissions, completedQueue]);

  async function handleDispatch(
    agents: Agent[],
    approach: MissionApproach = 'standard',
  ) {
    if (!selectedMission || dispatching) return;
    setDispatching(true);
    setSelectedMission(null);
    try {
      const equippedIds = agents.flatMap((a) =>
        a.equipment.map((s) => s.equipmentId).filter(Boolean),
      ) as string[];
      await dispatch(selectedMission, agents, equippedIds, approach);
      if (currentRegionId) {
        db.agents
          .where('status')
          .equals('available')
          .filter((a) => a.safeHouseId === currentRegionId)
          .toArray()
          .then(setRegionAgents);
      }
    } finally {
      setDispatching(false);
    }
  }

  const pendingResult = completedQueue[0] ?? null;

  return (
    <div
      className="flex flex-col min-h-full pb-20"
      style={{ background: C.bgBase, color: C.textPrimary }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <h1 className="text-lg font-bold tracking-tight mb-3">Operace</h1>
        <div className="mb-3">
          <CurrenciesBar />
        </div>
        <CityBar />
      </div>

      <div className="flex-1 px-4 flex flex-col gap-5">
        {/* Active missions */}
        {activeMissions.some((am) => {
          const m = activeMissionData.get(am.missionId);
          return m?.regionId === currentRegionId;
        }) && (
          <section>
            <p
              className="text-xs font-medium tracking-widest uppercase mb-2"
              style={{ color: '#888' }}
            >
              Probíhající (
              {
                activeMissions.filter(
                  (am) =>
                    activeMissionData.get(am.missionId)?.regionId ===
                    currentRegionId,
                ).length
              }
              )
            </p>
            <div className="flex flex-col gap-2">
              {activeMissions.map((am) => {
                const m = activeMissionData.get(am.missionId);
                if (!m || m.regionId !== currentRegionId) return null;
                return (
                  <ActiveMissionCard key={am.id} active={am} mission={m} />
                );
              })}
            </div>
          </section>
        )}

        {/* Available missions */}
        <section>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: '#888' }}
          >
            Dostupné mise
          </p>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl h-36 animate-pulse"
                  style={{ background: C.bgSurface }}
                />
              ))}
            </div>
          ) : availableMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Shield size={40} style={{ color: '#777777' }} />
              <p className="text-sm" style={{ color: '#888' }}>
                Momentálně žádné mise
              </p>
              <p className="text-xs text-center" style={{ color: '#777' }}>
                Mise se obnoví automaticky.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {availableMissions.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  onStart={setSelectedMission}
                  regionAgents={regionAgents}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Agent selector modal */}
      {selectedMission && (
        <AgentSelectorModal
          mission={selectedMission}
          onConfirm={handleDispatch}
          onClose={() => setSelectedMission(null)}
        />
      )}

      {/* Mission result modal */}
      {pendingResult && (
        <ResultModal
          result={pendingResult as CompletedMissionResult}
          onDismiss={() => {
            dismissResult(pendingResult.activeMission.id);
            if (currentRegionId) {
              loadMissions(currentRegionId);
              checkExpirations(currentRegionId);
              db.agents
                .where('status')
                .equals('available')
                .filter((a) => a.safeHouseId === currentRegionId)
                .toArray()
                .then(setRegionAgents);
            }
          }}
        />
      )}
    </div>
  );
}
