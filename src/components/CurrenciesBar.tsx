import { Coins, Eye, Ghost, Radio } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { C, cardBase } from '../styles/tokens';

const CURRENCIES = [
  { key: 'money', Icon: Coins, color: C.green, label: 'Peníze' },
  { key: 'intel', Icon: Eye, color: C.blue, label: 'Intel' },
  { key: 'shadow', Icon: Ghost, color: C.bm, label: 'Stín' },
  { key: 'influence', Icon: Radio, color: C.divExtraction, label: 'Vliv' },
] as const;

export default function CurrenciesBar() {
  const currencies = useGameStore((s) => s.currencies);

  return (
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
  );
}
