import { reactive } from 'vue';
import type { IncidentSeverity } from '../domain/types.ts';

export interface IncidentCreateDraftState {
  title: string;
  categoryId: string;
  severity: IncidentSeverity;
  description: string;
  assignedTo: string;
  geometry?: GeoJSON.Geometry;
}

function createDefaultDraft(): IncidentCreateDraftState {
  return {
    title: '',
    categoryId: 'other',
    severity: 'medium',
    description: '',
    assignedTo: '',
    geometry: undefined,
  };
}

const draft = reactive<IncidentCreateDraftState>(createDefaultDraft());

function resetAfterCreated(): void {
  Object.assign(draft, createDefaultDraft());
}

function clearGeometry(): void {
  draft.geometry = undefined;
}

/**
 * The create-event draft intentionally outlives dialog visibility and capture-task teardown.
 * It is reset only after a successful event create or an explicit future discard action.
 */
export function useIncidentCreateDraft() {
  return {
    draft,
    resetAfterCreated,
    clearGeometry,
  };
}
