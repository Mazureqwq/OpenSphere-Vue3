import * as Cesium from 'cesium';
import type { MapViewState } from '@/types/workspace';
import {
  TDT_MIN_ZOOM,
  TDT_MAX_ZOOM,
  WEB_MERCATOR_MAX_LATITUDE,
  WEB_MERCATOR_MAX_RESOLUTION,
} from '@/map/cesium/helpers';

export interface CesiumCameraHost {
  viewer: Cesium.Viewer;
  isTianDiTuBaseMap: boolean;
  synchronizedViewState?: MapViewState;
  synchronizedCameraPosition?: Cesium.Cartesian3;
}

export function setViewState(host: CesiumCameraHost, state: MapViewState) {
  const height = getCameraHeightForZoom(host, state.zoom, state.center[1]);
  host.viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(state.center[0], state.center[1], height),
    orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
  });
  updateCameraZoomLimits(host, state.center[1]);
  host.synchronizedViewState = { ...state };
  host.synchronizedCameraPosition = host.viewer.camera.position.clone();
}

export function getViewState(host: CesiumCameraHost, rotation = 0): MapViewState {
  const cartographic = host.viewer.camera.positionCartographic;
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const zoom = getZoomForCameraHeight(host, cartographic.height, latitude);
  return {
    center: [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))],
    zoom: Number(zoom.toFixed(2)),
    rotation,
  };
}

export function getViewportHeight(host: CesiumCameraHost) {
  return Math.max(host.viewer.canvas.clientHeight || host.viewer.scene.canvas.clientHeight || 1, 1);
}

export function getVerticalFov(host: CesiumCameraHost) {
  const frustum = host.viewer.camera.frustum as Cesium.PerspectiveFrustum;
  if (typeof frustum.fovy === 'number' && Number.isFinite(frustum.fovy) && frustum.fovy > 0) return frustum.fovy;
  return Cesium.Math.toRadians(60);
}

export function getLatitudeScale(latitude: number) {
  const clamped = Math.max(Math.min(latitude, WEB_MERCATOR_MAX_LATITUDE), -WEB_MERCATOR_MAX_LATITUDE);
  return Math.cos(Cesium.Math.toRadians(clamped));
}

export function getCameraHeightForZoom(host: CesiumCameraHost, zoom: number, latitude: number) {
  const resolution = WEB_MERCATOR_MAX_RESOLUTION / Math.pow(2, zoom);
  return (resolution * getViewportHeight(host)) / (2 * Math.tan(getVerticalFov(host) / 2)) / Math.max(getLatitudeScale(latitude), 1e-6);
}

export function getZoomForCameraHeight(host: CesiumCameraHost, height: number, latitude: number) {
  const resolution =
    (height * 2 * Math.tan(getVerticalFov(host) / 2) * Math.max(getLatitudeScale(latitude), 1e-6)) /
    getViewportHeight(host);
  return Math.log2(WEB_MERCATOR_MAX_RESOLUTION / Math.max(resolution, 1e-12));
}

export function updateCameraZoomLimits(
  host: CesiumCameraHost,
  latitude = Cesium.Math.toDegrees(host.viewer.camera.positionCartographic.latitude),
) {
  const controller = host.viewer.scene.screenSpaceCameraController;
  if (!host.isTianDiTuBaseMap) {
    controller.minimumZoomDistance = 1;
    controller.maximumZoomDistance = Number.POSITIVE_INFINITY;
    return;
  }
  controller.minimumZoomDistance = getCameraHeightForZoom(host, TDT_MAX_ZOOM, latitude);
  controller.maximumZoomDistance = getCameraHeightForZoom(host, TDT_MIN_ZOOM, latitude);
}
