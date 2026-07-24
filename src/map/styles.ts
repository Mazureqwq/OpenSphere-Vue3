import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Style, {type StyleFunction} from 'ol/style/Style';
import {intersects} from 'ol/extent';
import type BaseLayer from 'ol/layer/Base';
import type VectorSource from 'ol/source/Vector';
import type {CategoryStyleRule, FeatureQueryConfig, LineDash, TimeFilterConfig, TimeRange, VectorStyleConfig} from '@/types/gis';

export const defaultVectorStyle: VectorStyleConfig = {
  pointColor: '#14b8a6', pointRadius: 5, strokeColor: '#2dd4bf', strokeWidth: 2,
  lineDash: 'solid', fillColor: '#2dd4bf', fillOpacity: 0.24,
};

const dashPatterns: Record<LineDash, number[] | undefined> = {solid: undefined, dashed: [8, 6], dotted: [2, 6]};

function withOpacity(color: string, opacity: number) {
  const normalized = color.replace('#', '');
  const hex = normalized.length === 3 ? normalized.split('').map((value) => value + value).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function createVectorStyle(config: VectorStyleConfig, colorOverride?: string) {
  const color = colorOverride ?? config.fillColor;
  const strokeColor = colorOverride ?? config.strokeColor;
  return new Style({
    fill: new Fill({color: withOpacity(color, config.fillOpacity)}),
    stroke: new Stroke({color: strokeColor, width: config.strokeWidth, lineDash: dashPatterns[config.lineDash]}),
    image: new CircleStyle({radius: config.pointRadius, fill: new Fill({color: colorOverride ?? config.pointColor}), stroke: new Stroke({color: '#ecfeff', width: 1})}),
  });
}

export function getVectorFeatures(layer: BaseLayer) {
  const source = (layer as unknown as {getSource?: () => VectorSource | null}).getSource?.();
  return source?.getFeatures() ?? [];
}

export function getCategoryFields(layer: BaseLayer) {
  const fieldNames = new Set<string>();
  getVectorFeatures(layer).forEach((feature) => {
    Object.entries(feature.getProperties()).forEach(([key, value]) => {
      if (key !== 'geometry' && ['string', 'number', 'boolean'].includes(typeof value)) fieldNames.add(key);
    });
  });
  return [...fieldNames].sort((first, second) => first.localeCompare(second));
}

export function getCategoryValues(layer: BaseLayer, field: string) {
  const values = new Set<string>();
  getVectorFeatures(layer).forEach((feature) => values.add(normalizeCategory(feature.get(field))));
  return [...values].sort((first, second) => first.localeCompare(second));
}

export function getTimeFields(layer: BaseLayer) {
  return getCategoryFields(layer).filter((field) => getVectorFeatures(layer).some((feature) => parseTimeValue(feature.get(field)) !== undefined));
}

export function getTimeBounds(layer: BaseLayer, field: string): TimeRange | undefined {
  const values = getVectorFeatures(layer).map((feature) => parseTimeValue(feature.get(field))).filter((value): value is number => value !== undefined);
  if (!values.length) return undefined;
  return {start: Math.min(...values), end: Math.max(...values)};
}

export function parseTimeValue(value: unknown): number | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value < 100000000000 ? value * 1000 : value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && value.trim() !== '') return numeric < 100000000000 ? numeric * 1000 : numeric;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function normalizeCategory(value: unknown) {
  if (value === null || value === undefined || value === '') return '未设置';
  return String(value);
}

function isWithinTimeRange(value: unknown, timeFilter?: TimeFilterConfig, timeRange?: TimeRange) {
  if (!timeFilter || !timeRange) return true;
  const timestamp = parseTimeValue(value);
  return timestamp !== undefined && timestamp >= timeRange.start && timestamp <= timeRange.end;
}

export function matchesFeatureQuery(feature: {get: (key: string) => unknown; getGeometry: () => unknown}, query?: FeatureQueryConfig) {
  if (!query) return true;
  const rawValue = feature.get(query.field);
  const textValue = rawValue == null ? '' : String(rawValue);
  const matchesAttribute = query.operator === 'contains' ? textValue.toLowerCase().includes(query.value.toLowerCase()) : query.operator === 'equals' ? textValue === query.value : query.operator === 'greaterThan' ? Number(rawValue) > Number(query.value) : Number(rawValue) < Number(query.value);
  if (!matchesAttribute) return false;
  if (!query.spatialExtent) return true;
  const geometry = feature.getGeometry() as {intersectsExtent?: (extent: [number, number, number, number]) => boolean; getExtent?: () => [number, number, number, number]} | undefined;
  if (!geometry) return false;
  if (geometry.intersectsExtent) return geometry.intersectsExtent(query.spatialExtent);
  return geometry.getExtent ? intersects(geometry.getExtent(), query.spatialExtent) : false;
}
function createStyleFunction(config: VectorStyleConfig, categoryRule?: CategoryStyleRule, timeFilter?: TimeFilterConfig, timeRange?: TimeRange, query?: FeatureQueryConfig) {
  const cache = new Map<string, Style>();
  const styleFunction: StyleFunction = (feature) => {
    if (!isWithinTimeRange(feature.get(timeFilter?.field ?? ''), timeFilter, timeRange) || !matchesFeatureQuery(feature, query)) return undefined;
    const color = categoryRule ? categoryRule.colors[normalizeCategory(feature.get(categoryRule.field))] ?? categoryRule.fallbackColor : undefined;
    const cacheKey = color ?? '__default__';
    if (!cache.has(cacheKey)) cache.set(cacheKey, createVectorStyle(config, color));
    return cache.get(cacheKey)!;
  };
  return styleFunction;
}

export function applyVectorStyle(layer: BaseLayer, config: VectorStyleConfig, timeFilter?: TimeFilterConfig, timeRange?: TimeRange, query?: FeatureQueryConfig) {
  const vectorLayer = layer as unknown as {setStyle: (style: StyleFunction) => void};
  vectorLayer.setStyle(createStyleFunction(config, undefined, timeFilter, timeRange, query));
}

export function applyCategoryStyle(layer: BaseLayer, config: VectorStyleConfig, rule: CategoryStyleRule, timeFilter?: TimeFilterConfig, timeRange?: TimeRange, query?: FeatureQueryConfig) {
  const vectorLayer = layer as unknown as {setStyle: (style: StyleFunction) => void};
  vectorLayer.setStyle(createStyleFunction(config, rule, timeFilter, timeRange, query));
}



