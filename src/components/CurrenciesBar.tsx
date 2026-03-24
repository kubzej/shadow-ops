import { useGameStore } from '../store/gameStore';

export default function CurrenciesBar() {
  const { money, intel, shadow, influence } = useGameStore((s) => s.currencies);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {[
        { icon: '$', color: '#4ade80', val: money },
        { icon: '◈', color: '#60a5fa', val: intel },
        { icon: '◆', color: '#a78bfa', val: shadow },
        { icon: '✦', color: '#f97316', val: influence },
      ].map(({ icon, color, val }) => (
        <div
          key={icon}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: '#2b2b2b', border: '1px solid #1a1a1a' }}
        >
          <span className="text-sm" style={{ color }}>
            {icon}
          </span>
          <span className="text-sm font-semibold">{val}</span>
        </div>
      ))}
    </div>
  );
}
