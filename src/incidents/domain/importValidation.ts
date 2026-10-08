import { incidentSeverities, type IncidentDraft, type IncidentDraftValidationResult, type IncidentGeometry, type IncidentSeverity } from './types.ts';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPosition(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 2
    && value.every(isFiniteNumber)
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -90
    && value[1] <= 90;
}

function hasValidCoordinates(value: unknown): boolean {
  if (isPosition(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.every(hasValidCoordinates);
}

function isValidGeometry(value: unknown): value is IncidentGeometry {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as { type?: unknown; coordinates?: unknown; geometries?: unknown };
  if (geometry.type === 'GeometryCollection') {
    return Array.isArray(geometry.geometries) && geometry.geometries.length > 0 && geometry.geometries.every(isValidGeometry);
  }
  const supportedTypes = new Set([
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
  ]);
  return typeof geometry.type === 'string' && supportedTypes.has(geometry.type) && hasValidCoordinates(geometry.coordinates);
}

function normalizeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSeverity(value: unknown): value is IncidentSeverity {
  return typeof value === 'string' && (incidentSeverities as readonly string[]).includes(value);
}

export function validateIncidentDraft(draft: IncidentDraft): IncidentDraftValidationResult {
  const errors: IncidentDraftValidationResult['errors'] = {};
  const title = normalizeText(draft.title);
  const categoryId = normalizeText(draft.categoryId) ?? 'other';
  const severityCandidate = draft.severity == null || draft.severity === '' ? 'medium' : draft.severity;
  const severity = isSeverity(severityCandidate) ? severityCandidate : undefined;
  const description = normalizeText(draft.description);

  if (!title) errors.title = '标题不能为空';
  if (!categoryId) errors.categoryId = '分类不能为空';
  if (!severity) errors.severity = '严重等级无效';
  if (!isValidGeometry(draft.geometry)) errors.geometry = '位置或 GeoJSON 几何无效';

  if (Object.keys(errors).length) return { valid: false, errors };

  return {
    valid: true,
    errors: {},
    normalized: {
      title: title!,
      categoryId,
      severity: severity!,
      geometry: draft.geometry as IncidentGeometry,
      ...(description ? { description } : {}),
    },
  };
}
