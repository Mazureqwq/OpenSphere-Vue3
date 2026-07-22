import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type BaseLayer from 'ol/layer/Base';
import type {VectorStyleConfig} from '@/types/gis';
import {applyCategoryStyle, createVectorStyle, defaultVectorStyle} from '@/map/styles';
import {createWmsLayer} from '@/map/ogc';
import type {LayerRecord} from '@/types/gis';
import type {MapViewState, WorkspaceSnapshot, WorkspaceVectorLayer, WorkspaceWmsLayer} from '@/types/workspace';

const storageKey = 'opensphere-vue-workspace-v1';
const geoJson = new GeoJSON();

type SourceLayer = BaseLayer & {getSource?: () => VectorSource | null};
type WmsLayerProperties = {serviceUrl?: string; serviceLayerName?: string};

export function saveWorkspace(snapshot: WorkspaceSnapshot) {
  localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

export function loadWorkspace(): WorkspaceSnapshot | undefined {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return undefined;
  try {
    const snapshot = JSON.parse(raw) as WorkspaceSnapshot;
    return snapshot.version === 1 && Array.isArray(snapshot.layers) ? snapshot : undefined;
  } catch {
    return undefined;
  }
}

export function clearWorkspace() {
  localStorage.removeItem(storageKey);
}

export function createSnapshot(input: {
  baseMapId: string;
  selectedLayerId?: string;
  timeEnabled: boolean;
  timeCursor: number;
  timeRange?: import('@/types/gis').TimeRange;
  query?: import('@/types/gis').FeatureQueryConfig;
  view: MapViewState;
  layers: LayerRecord[];
}): WorkspaceSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    baseMapId: input.baseMapId,
    selectedLayerId: input.selectedLayerId,
    timeEnabled: input.timeEnabled,
    timeCursor: input.timeCursor,
    timeRange: input.timeRange,
    query: input.query,
    view: input.view,
    layers: input.layers.flatMap(serializeLayer),
  };
}

function serializeLayer(layer: LayerRecord): Array<WorkspaceVectorLayer | WorkspaceWmsLayer> {
  if (layer.realtime) return [];
  if (layer.kind === 'vector' && layer.vectorStyle) {
    const source = (layer.source as SourceLayer).getSource?.();
    if (!source) return [];
    return [{
      type: 'vector', id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity,
      style: layer.vectorStyle,
      categoryStyle: layer.categoryStyle,
      timeFilter: layer.timeFilter,
      drawing: layer.drawing,
      features: geoJson.writeFeaturesObject(source.getFeatures(), {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'}) as object,
    }];
  }

  if (layer.kind === 'wms') {
    const properties = layer.source.getProperties() as WmsLayerProperties;
    const source = (layer.source as unknown as {getSource?: () => {getParams?: () => Record<string, unknown>} | null}).getSource?.();
    const params = source?.getParams?.() ?? {};
    if (!properties.serviceUrl || !properties.serviceLayerName) return [];
    return [{
      type: 'wms', id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity,
      url: properties.serviceUrl, layers: properties.serviceLayerName, format: String(params.FORMAT ?? 'image/png'),
      version: params.VERSION === '1.1.1' ? '1.1.1' : '1.3.0', transparent: params.TRANSPARENT !== false,
    }];
  }

  return [];
}

export function restoreLayers(snapshot: WorkspaceSnapshot): LayerRecord[] {
  return snapshot.layers.map((layer) => layer.type === 'vector' ? restoreVectorLayer(layer) : restoreWmsLayer(layer));
}

function restoreVectorLayer(saved: WorkspaceVectorLayer): LayerRecord {
  const features = geoJson.readFeatures(saved.features as object, {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
  const source = new VectorSource({features});
  const layer = new VectorLayer({source, style: createVectorStyle(saved.style), properties: {id: saved.id}});
  if (saved.categoryStyle) applyCategoryStyle(layer, saved.style, saved.categoryStyle);
  layer.setVisible(saved.visible);
  layer.setOpacity(saved.opacity);
  return {id: saved.id, name: saved.name, kind: 'vector', visible: saved.visible, opacity: saved.opacity, source: layer, featureCount: features.length, vectorStyle: saved.style ?? {...defaultVectorStyle}, categoryStyle: saved.categoryStyle, timeFilter: saved.timeFilter, drawing: saved.drawing};
}

function restoreWmsLayer(saved: WorkspaceWmsLayer): LayerRecord {
  const record = createWmsLayer({name: saved.name, url: saved.url, layers: saved.layers, format: saved.format, version: saved.version, transparent: saved.transparent});
  record.id = saved.id;
  record.visible = saved.visible;
  record.opacity = saved.opacity;
  record.source.setProperties({id: saved.id}, true);
  record.source.setVisible(saved.visible);
  record.source.setOpacity(saved.opacity);
  return record;
}






