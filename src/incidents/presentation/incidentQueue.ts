import type { Incident, IncidentSeverity, IncidentStatus } from '../domain/types.ts';

export interface IncidentQueueFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
}

/** Applies the visible queue filters before deriving a deterministic newest-first list. */
export function filterAndSortIncidentQueue(incidents: readonly Incident[], filters: IncidentQueueFilters = {}): Incident[] {
  return incidents
    .filter((incident) => (!filters.status || incident.status === filters.status) && (!filters.severity || incident.severity === filters.severity))
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id));
}