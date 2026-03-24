import type { MissionResult } from '../../db/schema';

export const CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  surveillance: { label: 'Sledování', color: '#4ade80', icon: '👁' },
  cyber: { label: 'Kyber', color: '#60a5fa', icon: '💻' },
  extraction: { label: 'Extrakce', color: '#f97316', icon: '🚁' },
  sabotage: { label: 'Sabotáž', color: '#ef4444', icon: '💥' },
  influence: { label: 'Vliv', color: '#a78bfa', icon: '✦' },
  finance: { label: 'Finance', color: '#facc15', icon: '💰' },
  logistics: { label: 'Logistika', color: '#94a3b8', icon: '📦' },
  blackops: { label: 'Black Ops', color: '#f43f5e', icon: '🎯' },
};

export const RESULT_META: Record<
  MissionResult,
  { label: string; color: string; bg: string }
> = {
  success: { label: 'Úspěch', color: '#4ade80', bg: '#0f2e1a' },
  partial: { label: 'Částečně', color: '#facc15', bg: '#2e2800' },
  failure: { label: 'Selhání', color: '#ef4444', bg: '#2e0f0f' },
  catastrophe: { label: 'Katastrofa', color: '#f43f5e', bg: '#3e0a0a' },
};

export const STAT_LABELS: Record<string, string> = {
  stealth: 'Stealth',
  combat: 'Combat',
  intel: 'Intel',
  tech: 'Tech',
};
