import {
  AlertTriangle,
  Clock,
  Coins,
  Eye,
  Ghost,
  Link,
  Lock,
  Radio,
  Star,
  TriangleAlert,
  Users,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { C, cardBase } from '../../styles/tokens';
import type { Agent, Mission } from '../../db/schema';
import { DIVISIONS } from '../../data/agentTypes';
import { COMPLICATIONS } from '../../data/missionTemplates';
import { checkAgentEligibility } from '../../engine/missionResolver';
import { formatDuration } from '../../hooks/useMissionTimer';
import { CATEGORY_META, STAT_LABELS } from './missionConstants';
import { Countdown, FlashCountdown } from './Countdown';
import { difficultyDots, rewardLine } from './missionHelpers';
import { useGameStore } from '../../store/gameStore';
import {
  isCategoryBlockedByEvent,
  getEventDef,
} from '../../engine/worldEvents';
import { RIVAL_EVENT_META } from '../../engine/rival';

export function MissionCard({
  mission,
  onStart,
  regionAgents,
}: {
  mission: Mission;
  onStart: (m: Mission) => void;
  regionAgents: Agent[];
}) {
  const meta = CATEGORY_META[mission.category] ?? CATEGORY_META.surveillance;
  const isLocked = !!mission.lockedByDivision;
  const activeWorldEvent = useGameStore((s) => s.activeWorldEvent);
  const activeRivalOperation = useGameStore((s) => s.activeRivalOperation);
  const isEventBlocked =
    !isLocked && isCategoryBlockedByEvent(mission.category, activeWorldEvent);
  const eventDef = getEventDef(activeWorldEvent);
  const linkedRivalEvent =
    mission.isCounterOp &&
    mission.rivalOperationId &&
    activeRivalOperation?.id === mission.rivalOperationId
      ? RIVAL_EVENT_META[activeRivalOperation.eventType]
      : null;

  // Build reward modifier label for this mission's category
  let eventRewardLabel: string | null = null;
  if (eventDef && activeWorldEvent) {
    if (eventDef.influenceRewardMult !== undefined)
      eventRewardLabel = `Vliv ×${eventDef.influenceRewardMult}`;
    else if (eventDef.intelRewardMult !== undefined)
      eventRewardLabel = `Intel ×${eventDef.intelRewardMult}`;
    else if (eventDef.moneyRewardMult !== undefined)
      eventRewardLabel = `Peníze ×${eventDef.moneyRewardMult}`;
    else if (
      eventDef.financeRewardMult !== undefined &&
      mission.category === 'finance'
    )
      eventRewardLabel = `Finance ×${eventDef.financeRewardMult}`;
    else if (
      eventDef.armsDealShadowMult !== undefined &&
      (mission.category === 'extraction' || mission.category === 'blackops')
    )
      eventRewardLabel = `Shadow ×${eventDef.armsDealShadowMult}`;
    else if (eventDef.allRewardsMult !== undefined)
      eventRewardLabel = `Odměny ×${eventDef.allRewardsMult}`;
    else if (eventDef.successChancePenalty !== undefined)
      eventRewardLabel = `Úspěch −${Math.round(eventDef.successChancePenalty * 100)} %`;
    else if (eventDef.alertGainMult !== undefined)
      eventRewardLabel = `Alert ×${eventDef.alertGainMult}`;
  }

  const eligibleCount = regionAgents.filter(
    (a) =>
      a.status === 'available' && checkAgentEligibility(a, mission).eligible,
  ).length;
  const freeCount = regionAgents.filter((a) => a.status === 'available').length;
  const canStart = !isLocked && !isEventBlocked && eligibleCount > 0;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2.5"
      style={{ ...cardBase, opacity: isLocked || isEventBlocked ? 0.7 : 1 }}
    >
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5"
          style={{ background: `${meta.color}22` }}
        >
          {meta.icon}
        </span>
        <div className="flex-1 min-w-0">
          {/* Rescue badge */}
          {mission.isRescue && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1"
              style={{
                background: `${C.red}22`,
                color: C.red,
              }}
            >
              🚨 ZÁCHRANNÁ MISE
            </div>
          )}
          {mission.isFlash && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 ml-1"
              style={{
                background: `${C.yellow}22`,
                color: C.yellow,
              }}
            >
              <Zap size={9} />
              URGENTNÍ MISE
            </div>
          )}
          {mission.isCounterOp && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1"
              style={{
                background: `${C.yellow}22`,
                color: C.yellow,
              }}
            >
              🛡 COUNTER-OP
            </div>
          )}
          {mission.isCounterOp && mission.rivalOperationId && (
            <div
              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 ml-1"
              style={{
                background: `${C.divExtraction}22`,
                color: C.divExtraction,
              }}
            >
              Rival hrozba
              {linkedRivalEvent ? `: ${linkedRivalEvent.label}` : ''}
            </div>
          )}
          {linkedRivalEvent && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: C.textSecondary }}
            >
              {linkedRivalEvent.description}
            </p>
          )}
          <p
            className="text-sm font-medium leading-tight"
            style={{ color: '#e8e8e8' }}
          >
            {mission.title}
          </p>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#999' }}>
            {mission.flavor}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </span>
        {difficultyDots(mission.difficulty, meta.color)}
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#888' }}
        >
          <Clock size={11} />
          {formatDuration(mission.baseDuration)}
        </span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: '#888' }}
        >
          <Users size={11} />
          {mission.minAgents}–{mission.maxAgents}
        </span>
        {mission.intelCost && mission.intelCost > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5"
            style={{
              background: '#1e3a5f',
              color: '#60a5fa',
            }}
          >
            <Eye size={10} />
            {mission.intelCost}
          </span>
        )}
        {(mission.chainStep || mission.chainNextTargetId) && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-1"
            style={{
              background: '#2a200a',
              color: '#facc15',
            }}
          >
            <Link size={10} />
            {mission.chainStep && mission.chainTotal
              ? `Část ${mission.chainStep}/${mission.chainTotal}`
              : 'pokračování'}
          </span>
        )}
      </div>

      {/* Rewards */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rewardLine(Coins, C.green, mission.rewards.money)}
        {rewardLine(Eye, C.blue, mission.rewards.intel)}
        {rewardLine(Ghost, C.bm, mission.rewards.shadow)}
        {rewardLine(Radio, C.divExtraction, mission.rewards.influence)}
        {rewardLine(Star, C.yellow, mission.rewards.xp)}
      </div>

      {/* Requirements */}
      {(mission.requiredDivisions?.length || mission.minStats) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {mission.requiredDivisions?.map((div) => {
            const divInfo = DIVISIONS.find((d) => d.id === div);
            return (
              <span
                key={div}
                className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{
                  background: `${divInfo?.color ?? '#4ade80'}18`,
                  color: divInfo?.color ?? '#4ade80',
                }}
              >
                🏢 {divInfo?.name ?? div}
              </span>
            );
          })}
          {mission.minStats &&
            Object.entries(mission.minStats).map(([stat, val]) => (
              <span
                key={stat}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: C.bgSurface2,
                  color: C.textMuted,
                }}
              >
                {STAT_LABELS[stat] ?? stat} ≥ {val}
              </span>
            ))}
          <span
            className="text-xs ml-auto"
            style={{ color: canStart ? '#4ade80' : '#888' }}
          >
            {eligibleCount}/{freeCount} kompetentních
          </span>
        </div>
      )}

      {/* Complication warning */}
      {mission.complicationId &&
        (() => {
          const comp = COMPLICATIONS.find(
            (c) => c.id === mission.complicationId,
          );
          return comp ? (
            <div
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
              style={{
                background: '#2a1a00',
                color: '#f97316',
              }}
            >
              <TriangleAlert size={11} />
              <span className="font-medium">Komplikace:</span>{' '}
              {comp.description}
            </div>
          ) : null;
        })()}

      {/* Event reward badge */}
      {eventRewardLabel && !isEventBlocked && (
        <div
          className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded self-start"
          style={{
            background: `${eventDef!.positive ? C.green : C.red}18`,
            color: eventDef!.positive ? C.green : C.red,
          }}
        >
          <Zap size={9} />
          {eventRewardLabel}
        </div>
      )}

      {/* Flash expiry */}
      {mission.isFlash && mission.expiresAt && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: C.yellow }}
        >
          <Zap size={11} />
          Okno zavírá za <FlashCountdown expiresAt={mission.expiresAt} />
        </div>
      )}

      {/* Normal expiry warning (non-flash) */}
      {!mission.isFlash && mission.expiresAt && (
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: '#f97316' }}
        >
          <AlertTriangle size={11} />
          Vyprší za <Countdown completesAt={mission.expiresAt} />
        </div>
      )}

      {/* Start button */}
      {isEventBlocked ? (
        <div
          className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ background: C.bgSurface2, color: '#888' }}
        >
          <Lock size={12} />
          Blokováno:{' '}
          <span style={{ color: '#aaa', fontWeight: 600 }}>
            {eventDef?.name ?? 'Globální událost'}
          </span>
        </div>
      ) : isLocked ? (
        <div
          className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
          style={{ background: C.bgSurface2, color: '#888' }}
        >
          <Lock size={12} />
          Vyžaduje divizi{' '}
          <span style={{ color: '#aaa', fontWeight: 600 }}>
            {DIVISIONS.find((d) => d.id === mission.lockedByDivision)?.name ??
              mission.lockedByDivision}
          </span>
        </div>
      ) : (
        <button
          onClick={() => onStart(mission)}
          disabled={!canStart}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: canStart ? meta.color : C.bgSurface2,
            color: canStart ? '#141414' : C.textDisabled,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          {canStart ? (
            <>
              Zahájit <ChevronRight size={14} />
            </>
          ) : freeCount > 0 ? (
            'Žádní kompetentní agenti'
          ) : (
            'Žádní volní agenti'
          )}
        </button>
      )}
    </div>
  );
}
