import * as Cesium from 'cesium';
import { toLonLat } from 'ol/proj';
import OlLineString from 'ol/geom/LineString';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { LayerRecord, SelectedFeatureInfo } from '@/types/gis';

export interface RealtimeEntities {
  marker?: Cesium.Entity;
  trail?: Cesium.Entity;
}

export interface CesiumRealtimeHost {
  viewer: Cesium.Viewer;
  realtimeEntities: Map<string, RealtimeEntities>;
  entityInfo: { set(id: string, info: SelectedFeatureInfo): void; delete(id: string): void };
  serializeFeature(feature: Feature<Geometry>, layer: LayerRecord): SelectedFeatureInfo;
}

export function syncRealtimeLayer(host: CesiumRealtimeHost, layer?: LayerRecord) {
  if (!layer || layer.kind !== 'vector') {
    clearRealtimeLayer(host);
    return;
  }
  const source = (layer.source as { getSource?: () => { getFeatures?: () => Feature<Geometry>[] } | null }).getSource?.();
  const features = source?.getFeatures?.() ?? [];
  const tracks = new Map<string, { marker?: Feature<Geometry>; trail?: Feature<Geometry> }>();
  features.forEach((feature) => {
    const trackId = String(feature.get('trackId') ?? feature.getId() ?? '');
    if (!trackId) return;
    const current = tracks.get(trackId) ?? {};
    if (feature.get('kind') === 'trail' || feature.getGeometry() instanceof OlLineString) current.trail = feature;
    else current.marker = feature;
    tracks.set(trackId, current);
  });

  tracks.forEach((featuresForTrack, trackId) => {
    const entities = host.realtimeEntities.get(trackId) ?? {};
    const color = Cesium.Color.fromCssColorString(String(featuresForTrack.marker?.get('color') ?? '#22d3ee'));
    if (featuresForTrack.marker) {
      const id = `cesium-realtime-marker-${trackId}`;
      const geometry = featuresForTrack.marker.getGeometry();
      if (geometry && 'getCoordinates' in geometry) {
        const lonLat = toLonLat((geometry as any).getCoordinates());
        if (!entities.marker) {
          entities.marker = host.viewer.entities.add({
            id,
            point: {
              pixelSize: 12,
              color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
            },
            label: {
              text: String(featuresForTrack.marker.get('name') ?? trackId),
              pixelOffset: new Cesium.Cartesian2(0, -22),
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              font: '12px sans-serif',
            },
          });
        }
        entities.marker.position = new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(lonLat[0], lonLat[1]),
        );
        entities.marker.show = layer.visible;
        if (entities.marker.point) entities.marker.point.color = new Cesium.ConstantProperty(color);
        if (entities.marker.label) {
          entities.marker.label.text = new Cesium.ConstantProperty(
            String(featuresForTrack.marker.get('name') ?? trackId),
          );
        }
        host.entityInfo.set(id, host.serializeFeature(featuresForTrack.marker, layer));
      }
    }
    if (featuresForTrack.trail?.getGeometry() instanceof OlLineString) {
      const id = `cesium-realtime-trail-${trackId}`;
      if (!entities.trail) {
        entities.trail = host.viewer.entities.add({
          id,
          polyline: { width: 4, material: color },
        });
      }
      const trailPositions = (featuresForTrack.trail.getGeometry() as OlLineString)
        .getCoordinates()
        .map((coordinate) => {
          const lonLat = toLonLat(coordinate);
          return Cesium.Cartesian3.fromDegrees(lonLat[0], lonLat[1]);
        });
      entities.trail.polyline!.positions = new Cesium.ConstantProperty(trailPositions);
      entities.trail.show = layer.visible;
      if (entities.trail.polyline) entities.trail.polyline.material = new Cesium.ColorMaterialProperty(color);
      host.entityInfo.set(id, host.serializeFeature(featuresForTrack.trail, layer));
    }
    host.realtimeEntities.set(trackId, entities);
  });

  [...host.realtimeEntities.entries()]
    .filter(([trackId]) => !tracks.has(trackId))
    .forEach(([trackId, entities]) => {
      if (entities.marker) {
        host.entityInfo.delete(String(entities.marker.id));
        host.viewer.entities.remove(entities.marker);
      }
      if (entities.trail) {
        host.entityInfo.delete(String(entities.trail.id));
        host.viewer.entities.remove(entities.trail);
      }
      host.realtimeEntities.delete(trackId);
    });
}

export function clearRealtimeLayer(host: CesiumRealtimeHost) {
  host.realtimeEntities.forEach((entities) => {
    if (entities.marker) {
      host.entityInfo.delete(String(entities.marker.id));
      host.viewer.entities.remove(entities.marker);
    }
    if (entities.trail) {
      host.entityInfo.delete(String(entities.trail.id));
      host.viewer.entities.remove(entities.trail);
    }
  });
  host.realtimeEntities.clear();
}
