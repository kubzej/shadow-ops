import type { LucideIcon } from 'lucide-react';
import { C } from '../../styles/tokens';

export function difficultyDots(n: number, color: string) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: i < n ? color : '#777777' }}
        />
      ))}
    </span>
  );
}

export function chanceColor(chance: number): string {
  if (chance >= 0.75) return '#4ade80';
  if (chance >= 0.5) return '#facc15';
  if (chance >= 0.3) return '#f97316';
  return '#ef4444';
}

export function rewardLine(Icon: LucideIcon, iconColor: string, value: number) {
  if (!value) return null;
  const sign = value > 0 ? '+' : '';
  const valueColor = value > 0 ? C.green : C.red;
  return (
    <span className="flex items-center gap-0.5 text-xs">
      <Icon size={10} color={iconColor} />
      <span style={{ color: valueColor }}>
        {sign}
        {value}
      </span>
    </span>
  );
}
