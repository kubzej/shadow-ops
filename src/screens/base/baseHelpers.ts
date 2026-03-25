import { DIVISIONS, AGENT_TYPES } from '../../data/agentTypes';
import type { DivisionId } from '../../data/agentTypes';
import { REGION_MAP } from '../../data/regions';
import { COUNTRY_MAP } from '../../data/countries';

export function divColor(div: string): string {
  return DIVISIONS.find((d) => d.id === div)?.color ?? '#4ade80';
}

export function divName(div: string): string {
  return DIVISIONS.find((d) => d.id === div)?.name ?? div;
}

export function regionDisplayName(shId: string): string {
  const region = REGION_MAP.get(shId);
  if (!region) return shId;
  const country = COUNTRY_MAP.get(region.countryId);
  return `${region.name}${country ? `, ${country.name}` : ''}`;
}

export function inferDiv(typeId: string): DivisionId {
  return AGENT_TYPES.find((t) => t.id === typeId)?.division ?? 'surveillance';
}
