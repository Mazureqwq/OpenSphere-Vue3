import * as Cesium from 'cesium';
import { toLonLat } from 'ol/proj';
import type { SelectedFeatureInfo } from '@/types/gis';
import type { PlaybackPosition, PlaybackTrack } from '@/map/trackPlayback';
import { serializeValue } from '@/map/cesium/helpers';

export interface CesiumPlaybackHost {
  viewer: Cesium.Viewer;
  entityInfo: { set(id: string, info: SelectedFeatureInfo): void; delete(id: string): void };
  playbackMarkerEntity?: Cesium.Entity;
  playbackHistoryEntity?: Cesium.Entity;
}

export function setTrackPlayback(
  host: CesiumPlaybackHost,
  track: PlaybackTrack,
  position: PlaybackPosition,
  follow: boolean,
) {
  const history = position.history.map((coordinate) => {
    const lonLat = toLonLat(coordinate);
    return Cesium.Cartesian3.fromDegrees(lonLat[0], lonLat[1]);
  });
  const markerLonLat = toLonLat(position.coordinate);
  if (!host.playbackHistoryEntity) {
    host.playbackHistoryEntity = host.viewer.entities.add({
      id: 'cesium-track-playback-history',
      polyline: { width: 5, material: Cesium.Color.fromCssColorString('#38bdf8') },
    });
  }
  if (!host.playbackMarkerEntity) {
    host.playbackMarkerEntity = host.viewer.entities.add({
      id: 'cesium-track-playback-marker',
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#f97316'),
        outlineColor: Cesium.Color.fromCssColorString('#fff7ed'),
        outlineWidth: 3,
      },
      label: {
        pixelOffset: new Cesium.Cartesian2(0, -24),
        fillColor: Cesium.Color.fromCssColorString('#fed7aa'),
        outlineColor: Cesium.Color.fromCssColorString('#111827'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        font: '12px sans-serif',
      },
    });
  }
  host.playbackHistoryEntity.polyline!.positions = new Cesium.ConstantProperty(history);
  host.playbackMarkerEntity.position = new Cesium.ConstantPositionProperty(
    Cesium.Cartesian3.fromDegrees(markerLonLat[0], markerLonLat[1]),
  );
  if (host.playbackMarkerEntity.label) {
    host.playbackMarkerEntity.label.text = new Cesium.ConstantProperty(`回放 · ${track.name}`);
  }
  const info: SelectedFeatureInfo = {
    layerId: 'track-playback',
    layerName: `轨迹回放 · ${track.name}`,
    geometryType: 'Point',
    coordinate: [Number(markerLonLat[0].toFixed(6)), Number(markerLonLat[1].toFixed(6))],
    properties: Object.entries(position.properties).reduce<Record<string, string>>(
      (result, [key, value]) => ({ ...result, [key]: serializeValue(value) }),
      {},
    ),
  };
  host.entityInfo.set(String(host.playbackHistoryEntity.id), { ...info, geometryType: 'LineString' });
  host.entityInfo.set(String(host.playbackMarkerEntity.id), info);
  if (follow) {
    host.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(markerLonLat[0], markerLonLat[1], 1800),
    });
  }
}

export function clearTrackPlayback(host: CesiumPlaybackHost) {
  if (host.playbackHistoryEntity) {
    host.entityInfo.delete(String(host.playbackHistoryEntity.id));
    host.viewer.entities.remove(host.playbackHistoryEntity);
  }
  if (host.playbackMarkerEntity) {
    host.entityInfo.delete(String(host.playbackMarkerEntity.id));
    host.viewer.entities.remove(host.playbackMarkerEntity);
  }
  host.playbackHistoryEntity = undefined;
  host.playbackMarkerEntity = undefined;
}
