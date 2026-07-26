import * as Cesium from 'cesium';
import { getCenter } from 'ol/extent';
import { toLonLat } from 'ol/proj';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlPolygon from 'ol/geom/Polygon';
import OlMultiPoint from 'ol/geom/MultiPoint';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlMultiPolygon from 'ol/geom/MultiPolygon';
import type { LayerRecord, QueryResult, SelectedFeatureInfo } from '@/types/gis';
import { serializeValue } from '@/map/cesium/helpers';

export interface CesiumLayerHost {
  viewer: Cesium.Viewer;
  entitiesByLayer: Map<string, Cesium.Entity[]>;
  entityInfo: Map<string, SelectedFeatureInfo>;
  drawingFeatureByEntityId: Map<string, Feature<Geometry>>;
  selectedDrawingFeature?: Feature<Geometry>;
  syncedLayers: LayerRecord[];
  queryResultKeys: Set<string>;
  onFeatureSelected: (feature?: SelectedFeatureInfo, screenPosition?: number[]) => void;
}

export function syncLayers(host: CesiumLayerHost, layers: LayerRecord[]) {
  host.syncedLayers = layers;
  host.entitiesByLayer.forEach((entities) => entities.forEach((entity) => host.viewer.entities.remove(entity)));
  host.entitiesByLayer.clear();
  host.entityInfo.clear();
  host.drawingFeatureByEntityId.clear();
  host.selectedDrawingFeature = undefined;
  layers
    .filter((layer) => layer.kind === 'vector' && !layer.realtime)
    .forEach((layer) => addLayer(host, layer));
}

export function setQueryResults(host: CesiumLayerHost, results: QueryResult[]) {
  const nextKeys = new Set(results.map((result) => result.layerId + ':' + result.id));
  let changed = nextKeys.size !== host.queryResultKeys.size;
  if (!changed) {
    for (const key of nextKeys) {
      if (!host.queryResultKeys.has(key)) {
        changed = true;
        break;
      }
    }
  }
  host.queryResultKeys.clear();
  nextKeys.forEach((key) => host.queryResultKeys.add(key));
  if (changed) syncLayers(host, host.syncedLayers);
}

export function addLayer(host: CesiumLayerHost, layer: LayerRecord) {
  const source = (
    layer.source as unknown as { getSource?: () => { getFeatures: () => Feature<Geometry>[] } | null }
  ).getSource?.();
  if (!source) return;
  const entities = source.getFeatures().flatMap((feature, index) => createEntities(host, layer, feature, index));
  entities.forEach((entity) => {
    entity.show = layer.visible;
  });
  host.entitiesByLayer.set(layer.id, entities);
}

export function createEntities(
  host: CesiumLayerHost,
  layer: LayerRecord,
  feature: Feature<Geometry>,
  index: number,
): Cesium.Entity[] {
  const geometry = feature.getGeometry();
  if (!geometry) return [];
  const style = layer.vectorStyle;
  const opacity = layer.opacity ?? 1;
  const featureId = String(feature.getId() ?? index);
  const isQueryResult = host.queryResultKeys.has(layer.id + ':' + featureId);
  const pointColor = Cesium.Color.fromCssColorString(isQueryResult ? '#facc15' : style?.pointColor ?? '#14b8a6').withAlpha(opacity);
  const strokeColor = Cesium.Color.fromCssColorString(isQueryResult ? '#f59e0b' : style?.strokeColor ?? '#2dd4bf').withAlpha(opacity);
  const fillColor = Cesium.Color.fromCssColorString(isQueryResult ? '#facc15' : style?.fillColor ?? '#2dd4bf').withAlpha((style?.fillOpacity ?? 0.24) * opacity);
  const id = `cesium-${layer.id}-${featureId}`;
  const info = serializeFeature(feature, layer);
  const register = (entity: Cesium.Entity) => {
    const entityId = String(entity.id);
    host.entityInfo.set(entityId, info);
    if (layer.drawing) host.drawingFeatureByEntityId.set(entityId, feature);
    return entity;
  };
  const toCartesian = (coordinate: number[]) => {
    const [longitude, latitude] = toLonLat(coordinate);
    return Cesium.Cartesian3.fromDegrees(longitude, latitude);
  };
  if (geometry instanceof OlPoint) {
    return [
      register(
        host.viewer.entities.add({
          id,
          position: toCartesian(geometry.getCoordinates()),
          point: {
            pixelSize: Math.max(5, (style?.pointRadius ?? 5) * 2),
            color: pointColor,
            outlineColor: strokeColor,
            outlineWidth: 1,
          },
        }),
      ),
    ];
  }
  if (geometry instanceof OlLineString) {
    return [
      register(
        host.viewer.entities.add({
          id,
          polyline: {
            positions: geometry.getCoordinates().map(toCartesian),
            width: Math.max(2, style?.strokeWidth ?? 2),
            material: strokeColor,
          },
        }),
      ),
    ];
  }
  if (geometry instanceof OlPolygon) {
    return [
      register(
        host.viewer.entities.add({
          id,
          polygon: {
            hierarchy: geometry.getCoordinates()[0].map(toCartesian),
            material: fillColor,
            outline: true,
            outlineColor: strokeColor,
          },
        }),
      ),
    ];
  }
  if (geometry instanceof OlMultiPoint) {
    return geometry.getCoordinates().map((coordinate, part) =>
      register(
        host.viewer.entities.add({
          id: `${id}-${part}`,
          position: toCartesian(coordinate),
          point: {
            pixelSize: Math.max(5, (style?.pointRadius ?? 5) * 2),
            color: pointColor,
            outlineColor: strokeColor,
            outlineWidth: 1,
          },
        }),
      ),
    );
  }
  if (geometry instanceof OlMultiLineString) {
    return geometry.getCoordinates().map((coordinates, part) =>
      register(
        host.viewer.entities.add({
          id: `${id}-${part}`,
          polyline: {
            positions: coordinates.map(toCartesian),
            width: Math.max(2, style?.strokeWidth ?? 2),
            material: strokeColor,
          },
        }),
      ),
    );
  }
  if (geometry instanceof OlMultiPolygon) {
    return geometry.getCoordinates().map((coordinates, part) =>
      register(
        host.viewer.entities.add({
          id: `${id}-${part}`,
          polygon: {
            hierarchy: coordinates[0].map(toCartesian),
            material: fillColor,
            outline: true,
            outlineColor: strokeColor,
          },
        }),
      ),
    );
  }
  return [];
}

export function handlePick(host: CesiumLayerHost, position: Cesium.Cartesian2) {
  const picked = host.viewer.scene.pick(position);
  const entity = picked?.id as Cesium.Entity | undefined;
  const entityId = entity ? String(entity.id) : undefined;
  host.selectedDrawingFeature = entityId ? host.drawingFeatureByEntityId.get(entityId) : undefined;
  const info = entityId ? host.entityInfo.get(entityId) : undefined;
  if (!info) {
    host.onFeatureSelected(undefined, undefined);
    return;
  }
  let coordinate = info.coordinate;
  if (info.geometryType !== 'Point') {
    const cartesian = host.viewer.camera.pickEllipsoid(position, host.viewer.scene.globe.ellipsoid);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      coordinate = [
        Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)),
        Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)),
      ];
    }
  }
  host.onFeatureSelected({ ...info, coordinate }, [position.x, position.y]);
}

export function serializeFeature(feature: Feature<Geometry>, layer: LayerRecord): SelectedFeatureInfo {
  const geometry = feature.getGeometry();
  const properties = Object.entries(feature.getProperties())
    .filter(([key]) => key !== 'geometry')
    .reduce<Record<string, string>>((result, [key, value]) => ({ ...result, [key]: serializeValue(value) }), {});
  const center = geometry ? toLonLat(getCenter(geometry.getExtent())) : undefined;
  return {
    layerId: layer.id,
    layerName: layer.name,
    geometryType: geometry?.getType() ?? '未知几何',
    coordinate: center ? [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))] : undefined,
    properties,
  };
}
