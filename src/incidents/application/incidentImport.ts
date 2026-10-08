import Papa from 'papaparse';
import type { IncidentDraft } from '../domain/types.ts';

export type IncidentImportFormat = 'csv' | 'geojson';

export interface IncidentImportSource {
  fileName: string;
  text: string;
}

export interface IncidentImportFieldMapping {
  title?: string;
  categoryId?: string;
  severity?: string;
  longitude?: string;
  latitude?: string;
  geometry?: string;
  description?: string;
}

export interface IncidentImportError {
  row: number;
  message: string;
  raw?: Record<string, unknown>;
}

export interface IncidentImportRow {
  row: number;
  raw: Record<string, unknown>;
  draft: IncidentDraft;
}

export interface IncidentImportPreview {
  fileName: string;
  format: IncidentImportFormat;
  fields: string[];
  suggestedMapping: IncidentImportFieldMapping;
  rows: IncidentImportRow[];
  errors: IncidentImportError[];
}

const fieldAliases: Record<keyof IncidentImportFieldMapping, readonly string[]> = {
  title: ['title', 'name', '事件名称', '事件标题', '名称'],
  categoryId: ['categoryid', 'category', '类别', '分类'],
  severity: ['severity', 'level', '严重等级', '等级'],
  longitude: ['longitude', 'lon', 'lng', 'x', '经度'],
  latitude: ['latitude', 'lat', 'y', '纬度'],
  geometry: ['geometry', 'geojson', 'geom', '几何'],
  description: ['description', 'detail', 'note', '说明', '描述'],
};

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '');
}

function inferMapping(fields: string[]): IncidentImportFieldMapping {
  const normalized = new Map(fields.map((field) => [normalizeFieldName(field), field]));
  return Object.fromEntries(
    Object.entries(fieldAliases)
      .map(([key, aliases]) => [key, aliases.map(normalizeFieldName).map((alias) => normalized.get(alias)).find(Boolean)])
      .filter(([, value]) => Boolean(value)),
  ) as IncidentImportFieldMapping;
}

function formatForFile(fileName: string): IncidentImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';
  throw new Error('事件导入仅支持 CSV 或 GeoJSON 文件');
}

function toCoordinate(raw: unknown): number | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function parseGeometry(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function valueAt(row: Record<string, unknown>, field?: string): unknown {
  return field ? row[field] : undefined;
}

function csvDraft(row: Record<string, unknown>, mapping: IncidentImportFieldMapping): IncidentDraft {
  const longitude = toCoordinate(valueAt(row, mapping.longitude));
  const latitude = toCoordinate(valueAt(row, mapping.latitude));
  const geometry = mapping.geometry ? parseGeometry(valueAt(row, mapping.geometry)) : longitude !== undefined && latitude !== undefined
    ? { type: 'Point', coordinates: [longitude, latitude] }
    : undefined;
  return {
    title: valueAt(row, mapping.title),
    categoryId: valueAt(row, mapping.categoryId),
    severity: valueAt(row, mapping.severity),
    description: valueAt(row, mapping.description),
    geometry,
  };
}

function parseCsv(source: IncidentImportSource, mapping?: IncidentImportFieldMapping): IncidentImportPreview {
  const result = Papa.parse<Record<string, string>>(source.text, { header: true, skipEmptyLines: 'greedy' });
  const fields = result.meta.fields ?? [];
  const resolvedMapping = { ...inferMapping(fields), ...mapping };
  const rows = result.data.map((raw, index) => ({ row: index + 2, raw, draft: csvDraft(raw, resolvedMapping) }));
  const errors = result.errors.map((error) => ({ row: error.row == null ? 0 : error.row + 1, message: error.message }));
  return { fileName: source.fileName, format: 'csv', fields, suggestedMapping: resolvedMapping, rows, errors };
}

function propertiesFor(feature: Record<string, unknown>): Record<string, unknown> {
  const properties = feature.properties;
  return properties && typeof properties === 'object' && !Array.isArray(properties) ? properties as Record<string, unknown> : {};
}

function parseGeoJson(source: IncidentImportSource, mapping?: IncidentImportFieldMapping): IncidentImportPreview {
  let document: unknown;
  try {
    document = JSON.parse(source.text);
  } catch {
    return { fileName: source.fileName, format: 'geojson', fields: [], suggestedMapping: mapping ?? {}, rows: [], errors: [{ row: 0, message: 'GeoJSON 不是有效 JSON' }] };
  }
  const root = document && typeof document === 'object' ? document as Record<string, unknown> : undefined;
  const features = root?.type === 'FeatureCollection' && Array.isArray(root.features)
    ? root.features
    : root?.type === 'Feature'
      ? [root]
      : [];
  if (!features.length) {
    return { fileName: source.fileName, format: 'geojson', fields: [], suggestedMapping: mapping ?? {}, rows: [], errors: [{ row: 0, message: 'GeoJSON 必须包含 Feature 或 FeatureCollection' }] };
  }
  const fields = [...new Set(features.flatMap((feature) => feature && typeof feature === 'object' ? Object.keys(propertiesFor(feature as Record<string, unknown>)) : []))];
  const resolvedMapping = { ...inferMapping(fields), ...mapping };
  const rows: IncidentImportRow[] = [];
  const errors: IncidentImportError[] = [];
  features.forEach((feature, index) => {
    if (!feature || typeof feature !== 'object') {
      errors.push({ row: index + 1, message: 'GeoJSON 要素无效' });
      return;
    }
    const rawFeature = feature as Record<string, unknown>;
    const properties = propertiesFor(rawFeature);
    rows.push({
      row: index + 1,
      raw: properties,
      draft: {
        title: valueAt(properties, resolvedMapping.title),
        categoryId: valueAt(properties, resolvedMapping.categoryId),
        severity: valueAt(properties, resolvedMapping.severity),
        description: valueAt(properties, resolvedMapping.description),
        geometry: rawFeature.geometry,
      },
    });
  });
  return { fileName: source.fileName, format: 'geojson', fields, suggestedMapping: resolvedMapping, rows, errors };
}

export function previewIncidentImport(source: IncidentImportSource, mapping?: IncidentImportFieldMapping): IncidentImportPreview {
  return formatForFile(source.fileName) === 'csv' ? parseCsv(source, mapping) : parseGeoJson(source, mapping);
}

export function parseIncidentImport(source: IncidentImportSource, mapping?: IncidentImportFieldMapping): IncidentImportPreview {
  return previewIncidentImport(source, mapping);
}
