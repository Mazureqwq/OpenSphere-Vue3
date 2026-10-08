import type { SelectedFeatureInfo } from '@/types/gis';
import { INCIDENT_SYSTEM_LAYER_ID } from './incidentMapLayer.ts';

/**
 * Converts a map hit into the unified selection input without making the map
 * renderer own incident workflow state.
 */
export type MapFeatureSelectionInput =
  | { kind: 'incident'; incidentId: string }
  | { kind: 'feature'; feature: SelectedFeatureInfo };

export function selectionInputForMapFeature(feature?: SelectedFeatureInfo): MapFeatureSelectionInput | undefined {
  const incidentId = feature?.layerId === INCIDENT_SYSTEM_LAYER_ID ? feature.properties.incidentId?.trim() : undefined;
  return incidentId ? { kind: 'incident', incidentId } : feature ? { kind: 'feature', feature } : undefined;
}