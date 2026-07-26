import * as Cesium from 'cesium';

export interface CesiumLocateHost {
  viewer: Cesium.Viewer;
  locationEntity?: Cesium.Entity;
}

export function locateCoordinate(host: CesiumLocateHost, coordinate: [number, number]) {
  if (host.locationEntity) host.viewer.entities.remove(host.locationEntity);
  host.locationEntity = host.viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1]),
    point: {
      pixelSize: 13,
      color: Cesium.Color.HOTPINK,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
    },
    label: {
      text: `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`,
      pixelOffset: new Cesium.Cartesian2(0, -26),
      fillColor: Cesium.Color.fromCssColorString('#fce7f3'),
      outlineColor: Cesium.Color.fromCssColorString('#1f2937'),
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      font: '12px sans-serif',
    },
  });
  host.viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1], 1800),
    duration: 0.45,
  });
}

export function focusCoordinate(host: CesiumLocateHost, coordinate: [number, number]) {
  if (host.locationEntity) {
    host.viewer.entities.remove(host.locationEntity);
    host.locationEntity = undefined;
  }
  host.viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1], 1800),
    duration: 0.45,
  });
}
