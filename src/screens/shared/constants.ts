import type { AgentRank } from '../../data/agentTypes';
import type { AgentStatus } from '../../db/schema';

export const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  legendary: '#f59e0b',
};

export const RARITY_LABEL: Record<string, string> = {
  common: 'Běžný',
  uncommon: 'Neobvyklý',
  rare: 'Vzácný',
  legendary: 'Legendární',
};

export const RANK_LABEL: Record<AgentRank, string> = {
  recruit: 'Rekrut',
  operative: 'Agent',
  specialist: 'Specialista',
  veteran: 'Veterán',
  director: 'Ředitel',
};

export const RANK_STARS: Record<AgentRank, number> = {
  recruit: 1,
  operative: 2,
  specialist: 3,
  veteran: 4,
  director: 5,
};

export const RANK_NUM: Record<AgentRank, number> = {
  recruit: 0,
  operative: 1,
  specialist: 2,
  veteran: 3,
  director: 4,
};

export const STATUS_META: Record<
  AgentStatus,
  { label: string; color: string }
> = {
  available: { label: 'Volný', color: '#4ade80' },
  on_mission: { label: 'Na misi', color: '#60a5fa' },
  injured: { label: 'Zraněný', color: '#f97316' },
  captured: { label: 'Zajat', color: '#ef4444' },
  traveling: { label: 'Cestuje', color: '#a78bfa' },
  dead: { label: 'Mrtev', color: '#6b7280' },
};
