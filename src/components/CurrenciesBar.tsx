import { useState, useEffect } from 'react';
import { Coins, Eye, Ghost, Radio } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { C, cardBase } from '../styles/tokens';
import { WORLD_EVENTS } from '../data/worldEvents';
import type { ActiveWorldEvent } from '../db/schema';

const CURRENCIES = [
  { key: 'money', Icon: Coins, color: C.green, label: 'Peníze' },
  { key: 'intel', Icon: Eye, color: C.blue, label: 'Intel' },
  { key: 'shadow', Icon: Ghost, color: C.bm, label: 'Stín' },
  { key: 'influence', Icon: Radio, color: C.divExtraction, label: 'Vliv' },
] as const;

function WorldEventBadge({ event }: { event: ActiveWorldEvent }) {
  const def = WORLD_EVENTS.find((e) => e.id === event.eventId);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, event.expiresAt - Date.now()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, event.expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [event.expiresAt]);

  if (!def || remaining <= 0) return null;

  const color = def.positive ? C.green : C.red;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const countdown = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: `${color}14` }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
        style={{ background: color }}
      />
      <span className="text-xs font-semibold flex-1 truncate" style={{ color }}>
        {def.name}
      </span>
      <span className="text-xs font-mono flex-shrink-0" style={{ color }}>
        {countdown}
      </span>
    </div>
  );
}

export default function CurrenciesBar() {
  const currencies = useGameStore((s) => s.currencies);
  const activeWorldEvent = useGameStore((s) => s.activeWorldEvent);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {CURRENCIES.map(({ key, Icon, color, label }) => (
          <div
            key={key}
            className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl"
            style={{ ...cardBase }}
          >
            <Icon size={14} color={color} strokeWidth={2} />
            <div className="flex flex-col min-w-0">
              <span
                className="text-sm font-semibold font-mono leading-none"
                style={{ color: C.textPrimary }}
              >
                {currencies[key]}
              </span>
              <span
                className="text-[10px] leading-none mt-0.5"
                style={{ color: C.textMuted }}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
      {activeWorldEvent && <WorldEventBadge event={activeWorldEvent} />}
    </div>
  );
}
