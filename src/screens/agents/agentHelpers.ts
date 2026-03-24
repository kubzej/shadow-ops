import { DIVISIONS } from '../../data/agentTypes';

/** Fraction of buy price refunded when selling equipment */
export const SELL_REFUND = 0.3;

/** Cost in $ to instantly heal (per remaining second) */
export const INSTANT_HEAL_COST_PER_SEC = 0.15;

export function divisionColor(div: string): string {
  return DIVISIONS.find((d) => d.id === div)?.color ?? '#4ade80';
}

export function divisionName(div: string): string {
  return DIVISIONS.find((d) => d.id === div)?.name ?? div;
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
