import * as Cesium from 'cesium';
import {getCenter} from 'ol/extent';
import {fromLonLat, toLonLat} from 'ol/proj';
import OlFeature from 'ol/Feature';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlPolygon from 'ol/geom/Polygon';
import OlMultiPoint from 'ol/geom/MultiPoint';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlMultiPolygon from 'ol/geom/MultiPolygon';
import type {BaseMapLayerOption, BaseMapOption, LayerRecord, QueryResult, SelectedFeatureInfo} from '@/types/gis';
import type {MapViewState} from '@/types/workspace';
import type {PlaybackPosition, PlaybackTrack} from '@/map/trackPlayback';
import type {DrawMode} from '@/map/drawing';

interface EntityInfo extends SelectedFeatureInfo {}
interface RealtimeEntities {marker?: Cesium.Entity; trail?: Cesium.Entity;}
interface DrawingSource {addFeature: (feature: Feature<Geometry>) => void; removeFeature: (feature: Feature<Geometry>) => void;}
type CesiumDrawMode = Exclude<DrawMode, 'modify'>;

const TDT_MIN_ZOOM = 1;
const TDT_MAX_ZOOM = 18;
const WEB_MERCATOR_MAX_RESOLUTION = 156543.03392804097;
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;

export class CesiumManager {
  private readonly viewer: Cesium.Viewer;
  private readonly interactionHandler: Cesium.ScreenSpaceEventHandler;
  private readonly entitiesByLayer = new Map<string, Cesium.Entity[]>();
  private readonly entityInfo = new Map<string, EntityInfo>();
  private locationEntity?: Cesium.Entity;
  private readonly realtimeEntities = new Map<string, RealtimeEntities>();
  private playbackMarkerEntity?: Cesium.Entity;
  private playbackHistoryEntity?: Cesium.Entity;
  private synchronizedViewState?: MapViewState;
  private synchronizedCameraPosition?: Cesium.Cartesian3;
  private isTianDiTuBaseMap = false;
  private readonly drawingFeatureByEntityId = new Map<string, Feature<Geometry>>();
  private selectedDrawingFeature?: Feature<Geometry>;
  private drawingMode?: CesiumDrawMode;
  private drawingLayer?: LayerRecord;
  private drawingPositions: Cesium.Cartesian3[] = [];
  private drawingCursor?: Cesium.Cartesian3;
  private readonly drawingPreviewEntities: Cesium.Entity[] = [];
  private syncedLayers: LayerRecord[] = [];
  private readonly queryResultKeys = new Set<string>();
  private spatialQueryStart?: Cesium.Cartesian2;
  private spatialQueryEnd?: Cesium.Cartesian2;
  private spatialQueryPreview?: Cesium.Entity;
  private spatialQueryCallback?: (extent: [number, number, number, number]) => void;

  constructor(target: HTMLElement, baseMap: BaseMapOption, private readonly onFeatureSelected: (feature?: SelectedFeatureInfo, screenPosition?: number[]) => void, private readonly onMeasurementChange: (value?: string) => void, private readonly onDrawingChange: () => void) {
    this.viewer = new Cesium.Viewer(target, {
      baseLayer: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      fullscreenButton: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });
    this.viewer.scene.globe.depthTestAgainstTerrain = false;
    this.setBaseMap(baseMap);
    this.viewer.camera.changed.addEventListener(() => this.updateCameraZoomLimits());
    this.interactionHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.restorePickInteraction();
  }

  setBaseMap(baseMap: BaseMapOption) {
    this.isTianDiTuBaseMap = baseMap.layers.some((layer) => /tianditu\.gov\.cn\/.*\/wmts\?SERVICE=WMTS/i.test(layer.url));
    this.updateCameraZoomLimits();
    this.viewer.imageryLayers.removeAll();
    baseMap.layers.forEach((layer) => {
      const provider = createImageryProvider(layer);
      this.viewer.imageryLayers.addImageryProvider(provider);
    });
  }

  syncLayers(layers: LayerRecord[]) {
    this.syncedLayers = layers;
    this.entitiesByLayer.forEach((entities) => entities.forEach((entity) => this.viewer.entities.remove(entity)));
    this.entitiesByLayer.clear();
    this.entityInfo.clear();
    this.drawingFeatureByEntityId.clear();
    this.selectedDrawingFeature = undefined;
    layers.filter((layer) => layer.kind === 'vector' && !layer.realtime).forEach((layer) => this.addLayer(layer));
  }

  setQueryResults(results: QueryResult[]) {
    const nextKeys = new Set(results.map((result) => result.layerId + ':' + result.id));
    if (nextKeys.size === this.queryResultKeys.size && [...nextKeys].every((key) => this.queryResultKeys.has(key))) return;
    this.queryResultKeys.clear();
    nextKeys.forEach((key) => this.queryResultKeys.add(key));
    if (this.syncedLayers.length) this.syncLayers(this.syncedLayers);
  }

  startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void) {
    this.clearDrawingInteraction();
    this.clearSpatialQuery();
    this.spatialQueryCallback = onExtent;
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.interactionHandler.setInputAction((event: {position: Cesium.Cartesian2}) => this.beginSpatialQuery(event.position), Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.setInputAction((event: {endPosition: Cesium.Cartesian2}) => this.updateSpatialQuery(event.endPosition), Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.setInputAction((event: {position: Cesium.Cartesian2}) => this.completeSpatialQuery(event.position), Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);
  }

  stopSpatialQuery() { this.clearSpatialQuery(); }

  syncRealtimeLayer(layer?: LayerRecord) {
    if (!layer) {
      this.clearRealtimeLayer();
      return;
    }
    const source = (layer.source as unknown as {getSource?: () => {getFeatures: () => Feature<Geometry>[]} | null}).getSource?.();
    if (!source) {
      this.clearRealtimeLayer();
      return;
    }
    const tracks = new Map<string, {marker?: Feature<Geometry>; trail?: Feature<Geometry>}>();
    source.getFeatures().forEach((feature) => {
      const trackId = feature.get('trackId');
      const role = feature.get('realtimeRole');
      if (trackId == null || (role !== 'position' && role !== 'trail')) return;
      const entry = tracks.get(String(trackId)) ?? {};
      if (role === 'position') entry.marker = feature;
      else entry.trail = feature;
      tracks.set(String(trackId), entry);
    });
    tracks.forEach((features, trackId) => {
      const entities = this.realtimeEntities.get(trackId) ?? {};
      const color = Cesium.Color.fromCssColorString(String(features.marker?.get('color') ?? features.trail?.get('color') ?? '#38bdf8')).withAlpha(layer.opacity);
      if (features.marker?.getGeometry() instanceof OlPoint) {
        const coordinate = toLonLat((features.marker.getGeometry() as OlPoint).getCoordinates());
        const id = `cesium-realtime-marker-${trackId}`;
        if (!entities.marker) entities.marker = this.viewer.entities.add({id, point: {pixelSize: 12, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2}, label: {pixelOffset: new Cesium.Cartesian2(0, -22), fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString('#0f1d2d'), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '12px sans-serif'}});
        entities.marker.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1]));
        entities.marker.show = layer.visible;
        if (entities.marker.point) entities.marker.point.color = new Cesium.ConstantProperty(color);
        if (entities.marker.label) entities.marker.label.text = new Cesium.ConstantProperty(String(features.marker.get('name') ?? trackId));
        this.entityInfo.set(id, this.serializeFeature(features.marker, layer));
      }
      if (features.trail?.getGeometry() instanceof OlLineString) {
        const id = `cesium-realtime-trail-${trackId}`;
        if (!entities.trail) entities.trail = this.viewer.entities.add({id, polyline: {width: 4, material: color}});
        const trailPositions = (features.trail.getGeometry() as OlLineString).getCoordinates().map((coordinate) => {
          const lonLat = toLonLat(coordinate);
          return Cesium.Cartesian3.fromDegrees(lonLat[0], lonLat[1]);
        });
        entities.trail.polyline!.positions = new Cesium.ConstantProperty(trailPositions);
        entities.trail.show = layer.visible;
        if (entities.trail.polyline) entities.trail.polyline.material = new Cesium.ColorMaterialProperty(color);
        this.entityInfo.set(id, this.serializeFeature(features.trail, layer));
      }
      this.realtimeEntities.set(trackId, entities);
    });
    [...this.realtimeEntities.entries()].filter(([trackId]) => !tracks.has(trackId)).forEach(([trackId, entities]) => {
      if (entities.marker) { this.entityInfo.delete(String(entities.marker.id)); this.viewer.entities.remove(entities.marker); }
      if (entities.trail) { this.entityInfo.delete(String(entities.trail.id)); this.viewer.entities.remove(entities.trail); }
      this.realtimeEntities.delete(trackId);
    });
  }

  clearRealtimeLayer() {
    this.realtimeEntities.forEach((entities) => {
      if (entities.marker) { this.entityInfo.delete(String(entities.marker.id)); this.viewer.entities.remove(entities.marker); }
      if (entities.trail) { this.entityInfo.delete(String(entities.trail.id)); this.viewer.entities.remove(entities.trail); }
    });
    this.realtimeEntities.clear();
  }

  setTrackPlayback(track: PlaybackTrack, position: PlaybackPosition, follow: boolean) {
    const history = position.history.map((coordinate) => {
      const lonLat = toLonLat(coordinate);
      return Cesium.Cartesian3.fromDegrees(lonLat[0], lonLat[1]);
    });
    const markerLonLat = toLonLat(position.coordinate);
    if (!this.playbackHistoryEntity) this.playbackHistoryEntity = this.viewer.entities.add({id: 'cesium-track-playback-history', polyline: {width: 5, material: Cesium.Color.fromCssColorString('#38bdf8')}});
    if (!this.playbackMarkerEntity) this.playbackMarkerEntity = this.viewer.entities.add({id: 'cesium-track-playback-marker', point: {pixelSize: 14, color: Cesium.Color.fromCssColorString('#f97316'), outlineColor: Cesium.Color.fromCssColorString('#fff7ed'), outlineWidth: 3}, label: {pixelOffset: new Cesium.Cartesian2(0, -24), fillColor: Cesium.Color.fromCssColorString('#fed7aa'), outlineColor: Cesium.Color.fromCssColorString('#111827'), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '12px sans-serif'}});
    this.playbackHistoryEntity.polyline!.positions = new Cesium.ConstantProperty(history);
    this.playbackMarkerEntity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(markerLonLat[0], markerLonLat[1]));
    if (this.playbackMarkerEntity.label) this.playbackMarkerEntity.label.text = new Cesium.ConstantProperty(`回放 · ${track.name}`);
    const info: EntityInfo = {layerId: 'track-playback', layerName: `轨迹回放 · ${track.name}`, geometryType: 'Point', coordinate: [Number(markerLonLat[0].toFixed(6)), Number(markerLonLat[1].toFixed(6))], properties: Object.entries(position.properties).reduce<Record<string, string>>((result, [key, value]) => ({...result, [key]: serializeValue(value)}), {})};
    this.entityInfo.set(String(this.playbackHistoryEntity.id), {...info, geometryType: 'LineString'});
    this.entityInfo.set(String(this.playbackMarkerEntity.id), info);
    if (follow) this.viewer.camera.setView({destination: Cesium.Cartesian3.fromDegrees(markerLonLat[0], markerLonLat[1], 1800)});
  }

  clearTrackPlayback() {
    if (this.playbackHistoryEntity) { this.entityInfo.delete(String(this.playbackHistoryEntity.id)); this.viewer.entities.remove(this.playbackHistoryEntity); }
    if (this.playbackMarkerEntity) { this.entityInfo.delete(String(this.playbackMarkerEntity.id)); this.viewer.entities.remove(this.playbackMarkerEntity); }
    this.playbackHistoryEntity = undefined;
    this.playbackMarkerEntity = undefined;
  }
  setViewState(state: MapViewState) {
    const height = this.getCameraHeightForZoom(state.zoom, state.center[1]);
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(state.center[0], state.center[1], height),
      orientation: {heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0},
    });
    this.updateCameraZoomLimits(state.center[1]);
    this.synchronizedViewState = {...state, center: [...state.center] as [number, number]};
    this.synchronizedCameraPosition = Cesium.Cartesian3.clone(this.viewer.camera.position);
    this.viewer.scene.requestRender();
  }

  getViewState(rotation = 0): MapViewState {
    if (this.synchronizedViewState && this.synchronizedCameraPosition && Cesium.Cartesian3.equalsEpsilon(this.viewer.camera.position, this.synchronizedCameraPosition, 0, 0.1)) {
      return {...this.synchronizedViewState, center: [...this.synchronizedViewState.center] as [number, number], rotation};
    }
    const canvas = this.viewer.scene.canvas;
    const center = this.viewer.camera.pickEllipsoid(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2), this.viewer.scene.globe.ellipsoid);
    const centerCartographic = center ? Cesium.Cartographic.fromCartesian(center) : this.viewer.camera.positionCartographic;
    const height = Math.max(1, this.viewer.camera.positionCartographic.height);
    const latitude = Cesium.Math.toDegrees(centerCartographic.latitude);
    const zoom = Math.max(0, Math.min(22, this.getZoomForCameraHeight(height, latitude)));
    const state: MapViewState = {
      center: [Number(Cesium.Math.toDegrees(centerCartographic.longitude).toFixed(6)), Number(Cesium.Math.toDegrees(centerCartographic.latitude).toFixed(6))],
      zoom,
      rotation,
    };
    this.synchronizedViewState = {...state, center: [...state.center] as [number, number]};
    this.synchronizedCameraPosition = Cesium.Cartesian3.clone(this.viewer.camera.position);
    return state;
  }

  setDrawMode(mode?: DrawMode, layer?: LayerRecord) {
    this.clearSpatialQuery();
    this.clearDrawingInteraction();
    if (!mode || !layer?.drawing || mode === 'modify') return mode !== 'modify';
    this.drawingMode = mode;
    this.drawingLayer = layer;
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.interactionHandler.setInputAction((event: {position: Cesium.Cartesian2}) => this.addDrawingPosition(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
    this.interactionHandler.setInputAction((event: {endPosition: Cesium.Cartesian2}) => this.updateDrawingCursor(event.endPosition), Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    this.interactionHandler.setInputAction(() => this.finishDrawing(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    this.interactionHandler.setInputAction(() => this.finishDrawing(), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    return true;
  }

  deleteSelectedDrawingFeatures(layer?: LayerRecord) {
    if (!layer?.drawing || !this.selectedDrawingFeature) return 0;
    const source = this.getDrawingSource(layer);
    if (!source) return 0;
    source.removeFeature(this.selectedDrawingFeature);
    this.selectedDrawingFeature = undefined;
    this.onFeatureSelected();
    this.onDrawingChange();
    return 1;
  }

  locateCoordinate(coordinate: [number, number]) {
    if (this.locationEntity) this.viewer.entities.remove(this.locationEntity);
    this.locationEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1]),
      point: {pixelSize: 13, color: Cesium.Color.HOTPINK, outlineColor: Cesium.Color.WHITE, outlineWidth: 3},
      label: {text: `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`, pixelOffset: new Cesium.Cartesian2(0, -26), fillColor: Cesium.Color.fromCssColorString('#fce7f3'), outlineColor: Cesium.Color.fromCssColorString('#1f2937'), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, font: '12px sans-serif'},
    });
    this.viewer.camera.flyTo({destination: Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1], 1800), duration: 0.45});
  }

  resize() { this.viewer.resize(); this.updateCameraZoomLimits(); }
  getScreenPosition(coordinate: [number, number]) {
    const position = Cesium.SceneTransforms.worldToWindowCoordinates(this.viewer.scene, Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1]));
    return position ? [position.x, position.y] : undefined;
  }
  onSceneRender(listener: () => void) {
    this.viewer.scene.postRender.addEventListener(listener);
    return () => this.viewer.scene.postRender.removeEventListener(listener);
  }
  destroy() { this.clearSpatialQuery(); this.clearDrawingInteraction(); this.interactionHandler.destroy(); this.viewer.destroy(); }

  private restorePickInteraction() {
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    this.interactionHandler.setInputAction((event: {position: Cesium.Cartesian2}) => this.handlePick(event.position), Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  private clearSpatialQuery() {
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);
    if (this.spatialQueryPreview) this.viewer.entities.remove(this.spatialQueryPreview);
    this.spatialQueryPreview = undefined;
    this.spatialQueryStart = undefined;
    this.spatialQueryEnd = undefined;
    this.spatialQueryCallback = undefined;
    this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    this.restorePickInteraction();
  }

  private beginSpatialQuery(position: Cesium.Cartesian2) {
    this.spatialQueryStart = Cesium.Cartesian2.clone(position);
    this.spatialQueryEnd = Cesium.Cartesian2.clone(position);
    this.ensureSpatialQueryPreview();
  }

  private updateSpatialQuery(position: Cesium.Cartesian2) {
    if (!this.spatialQueryStart) return;
    this.spatialQueryEnd = Cesium.Cartesian2.clone(position);
    this.ensureSpatialQueryPreview();
  }

  private completeSpatialQuery(position: Cesium.Cartesian2) {
    if (!this.spatialQueryStart || !this.spatialQueryCallback) { this.clearSpatialQuery(); return; }
    this.spatialQueryEnd = Cesium.Cartesian2.clone(position);
    const coordinates = this.getSpatialQueryPositions().map((item) => this.toMapCoordinate(item));
    if (coordinates.length === 4) {
      const longitudes = coordinates.map((coordinate) => coordinate[0]);
      const latitudes = coordinates.map((coordinate) => coordinate[1]);
      this.spatialQueryCallback([Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]);
    }
    this.clearSpatialQuery();
  }

  private ensureSpatialQueryPreview() {
    if (this.spatialQueryPreview) return;
    this.spatialQueryPreview = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const positions = this.getSpatialQueryPositions();
          return positions.length === 4 ? [...positions, positions[0]] : positions;
        }, false),
        width: 2,
        material: Cesium.Color.fromCssColorString('#38bdf8'),
      },
    });
  }

  private getSpatialQueryPositions() {
    if (!this.spatialQueryStart || !this.spatialQueryEnd) return [];
    const {x: startX, y: startY} = this.spatialQueryStart;
    const {x: endX, y: endY} = this.spatialQueryEnd;
    return [
      new Cesium.Cartesian2(startX, startY),
      new Cesium.Cartesian2(endX, startY),
      new Cesium.Cartesian2(endX, endY),
      new Cesium.Cartesian2(startX, endY),
    ].map((position) => this.pickDrawingPosition(position)).filter((position): position is Cesium.Cartesian3 => Boolean(position));
  }

  private clearDrawingInteraction(clearMeasurement = true) {
    this.drawingPreviewEntities.forEach((entity) => this.viewer.entities.remove(entity));
    this.drawingPreviewEntities.length = 0;
    this.drawingMode = undefined;
    this.drawingLayer = undefined;
    this.drawingPositions = [];
    this.drawingCursor = undefined;
    this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    this.restorePickInteraction();
    if (clearMeasurement) this.onMeasurementChange();
  }

  private addDrawingPosition(screenPosition: Cesium.Cartesian2) {
    const position = this.pickDrawingPosition(screenPosition);
    if (!position || !this.drawingMode) return;
    const previous = this.drawingPositions[this.drawingPositions.length - 1];
    if (previous && Cesium.Cartesian3.distance(previous, position) < 0.01) return;
    this.drawingPositions.push(Cesium.Cartesian3.clone(position));
    if (this.drawingMode === 'Point') { this.finishDrawing(); return; }
    this.ensureDrawingPreview();
    this.updateDrawingMeasurement();
  }

  private updateDrawingCursor(screenPosition: Cesium.Cartesian2) {
    if (!this.drawingMode || this.drawingMode === 'Point' || !this.drawingPositions.length) return;
    const position = this.pickDrawingPosition(screenPosition);
    if (!position) return;
    this.drawingCursor = position;
    this.ensureDrawingPreview();
    this.updateDrawingMeasurement();
  }

  private finishDrawing() {
    if (!this.drawingMode || !this.drawingLayer) return;
    const minimumPositions = this.drawingMode === 'Point' ? 1 : this.drawingMode === 'LineString' ? 2 : 3;
    if (this.drawingPositions.length < minimumPositions) return;
    const source = this.getDrawingSource(this.drawingLayer);
    if (!source) { this.clearDrawingInteraction(); return; }
    const coordinates = this.drawingPositions.map((position) => this.toMapCoordinate(position));
    const geometry = this.drawingMode === 'Point'
      ? new OlPoint(coordinates[0])
      : this.drawingMode === 'LineString'
        ? new OlLineString(coordinates)
        : new OlPolygon([[...coordinates, coordinates[0]]]);
    const feature = new OlFeature<Geometry>({geometry});
    feature.setId(`${this.drawingLayer.id}-${Date.now()}`);
    source.addFeature(feature);
    this.onMeasurementChange(this.formatDrawingMeasurement(this.drawingMode, this.drawingPositions));
    this.clearDrawingInteraction(false);
    this.onDrawingChange();
  }

  private ensureDrawingPreview() {
    if (!this.drawingMode || this.drawingMode === 'Point' || this.drawingPreviewEntities.length) return;
    const previewPositions = () => this.getDrawingPreviewPositions();
    this.drawingPreviewEntities.push(this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const positions = previewPositions();
          return this.drawingMode === 'Polygon' && positions.length > 2 ? [...positions, positions[0]] : positions;
        }, false),
        width: 3,
        material: Cesium.Color.fromCssColorString('#fbbf24'),
      },
    }));
    if (this.drawingMode === 'Polygon') {
      this.drawingPreviewEntities.push(this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const positions = previewPositions();
            return positions.length >= 3 ? new Cesium.PolygonHierarchy(positions) : undefined;
          }, false),
          material: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.22),
        },
      }));
    }
  }

  private getDrawingPreviewPositions() {
    return this.drawingCursor ? [...this.drawingPositions, this.drawingCursor] : this.drawingPositions;
  }

  private updateDrawingMeasurement() {
    if (this.drawingMode) this.onMeasurementChange(this.formatDrawingMeasurement(this.drawingMode, this.getDrawingPreviewPositions()));
  }

  private formatDrawingMeasurement(mode: CesiumDrawMode, positions: Cesium.Cartesian3[]) {
    if (mode === 'Point') return '点位已添加';
    if (mode === 'LineString') {
      const distance = this.getGeodesicDistance(positions);
      return distance >= 1000
        ? '距离：' + (distance / 1000).toFixed(2) + ' km'
        : '距离：' + distance.toFixed(1) + ' m';
    }
    const area = this.getGeodesicArea(positions);
    return area >= 1000000
      ? '面积：' + (area / 1000000).toFixed(2) + ' km²'
      : '面积：' + area.toFixed(1) + ' m²';
  }

  private getGeodesicDistance(positions: Cesium.Cartesian3[]) {
    return positions.slice(1).reduce((total, position, index) => {
      const start = Cesium.Cartographic.fromCartesian(positions[index]);
      const end = Cesium.Cartographic.fromCartesian(position);
      return total + new Cesium.EllipsoidGeodesic(start, end).surfaceDistance;
    }, 0);
  }

  private getGeodesicArea(positions: Cesium.Cartesian3[]) {
    if (positions.length < 3) return 0;
    const cartographics = positions.map((position) => Cesium.Cartographic.fromCartesian(position));
    const radius = Cesium.Ellipsoid.WGS84.maximumRadius;
    const total = cartographics.reduce((sum, current, index) => {
      const next = cartographics[(index + 1) % cartographics.length];
      return sum + (next.longitude - current.longitude) * (2 + Math.sin(current.latitude) + Math.sin(next.latitude));
    }, 0);
    return Math.abs(total) * radius ** 2 / 2;
  }

  private pickDrawingPosition(screenPosition: Cesium.Cartesian2) {
    return this.viewer.camera.pickEllipsoid(screenPosition, this.viewer.scene.globe.ellipsoid);
  }

  private toMapCoordinate(position: Cesium.Cartesian3) {
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    return fromLonLat([Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)]);
  }

  private getDrawingSource(record: LayerRecord) {
    return (record.source as unknown as {getSource?: () => DrawingSource | null}).getSource?.();
  }

  private getViewportHeight() {
    const canvas = this.viewer.scene.canvas;
    return Math.max(1, canvas.clientHeight || canvas.height || 1);
  }

  private getVerticalFov() {
    const frustum = this.viewer.camera.frustum;
    return frustum instanceof Cesium.PerspectiveFrustum ? (frustum.fovy ?? Cesium.Math.toRadians(60)) : Cesium.Math.toRadians(60);
  }

  private getLatitudeScale(latitude: number) {
    const boundedLatitude = Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude));
    return Math.max(0.01, Math.cos(Cesium.Math.toRadians(boundedLatitude)));
  }

  private getCameraHeightForZoom(zoom: number, latitude: number) {
    const resolution = WEB_MERCATOR_MAX_RESOLUTION / 2 ** Math.max(zoom, 0);
    return Math.max(1, resolution * this.getLatitudeScale(latitude) * this.getViewportHeight() / (2 * Math.tan(this.getVerticalFov() / 2)));
  }

  private getZoomForCameraHeight(height: number, latitude: number) {
    const resolution = 2 * height * Math.tan(this.getVerticalFov() / 2) / (this.getViewportHeight() * this.getLatitudeScale(latitude));
    return Math.log2(WEB_MERCATOR_MAX_RESOLUTION / resolution);
  }

  private updateCameraZoomLimits(latitude = Cesium.Math.toDegrees(this.viewer.camera.positionCartographic.latitude)) {
    const controller = this.viewer.scene.screenSpaceCameraController;
    if (!this.isTianDiTuBaseMap) {
      controller.minimumZoomDistance = 1;
      controller.maximumZoomDistance = Number.POSITIVE_INFINITY;
      return;
    }
    controller.minimumZoomDistance = this.getCameraHeightForZoom(TDT_MAX_ZOOM, latitude);
    controller.maximumZoomDistance = this.getCameraHeightForZoom(TDT_MIN_ZOOM, latitude);
  }

  private addLayer(layer: LayerRecord) {
    const source = (layer.source as unknown as {getSource?: () => {getFeatures: () => Feature<Geometry>[]} | null}).getSource?.();
    if (!source) return;
    const entities = source.getFeatures().flatMap((feature, index) => this.createEntities(layer, feature, index));
    entities.forEach((entity) => { entity.show = layer.visible; });
    this.entitiesByLayer.set(layer.id, entities);
  }

  private createEntities(layer: LayerRecord, feature: Feature<Geometry>, index: number): Cesium.Entity[] {
    const geometry = feature.getGeometry();
    if (!geometry) return [];
    const style = layer.vectorStyle;
    const opacity = layer.opacity;
    const featureId = String(feature.getId() ?? index);
    const isQueryResult = this.queryResultKeys.has(layer.id + ':' + featureId);
    const pointColor = Cesium.Color.fromCssColorString(isQueryResult ? '#facc15' : style?.pointColor ?? '#14b8a6').withAlpha(opacity);
    const strokeColor = Cesium.Color.fromCssColorString(isQueryResult ? '#f59e0b' : style?.strokeColor ?? '#2dd4bf').withAlpha(opacity);
    const fillColor = Cesium.Color.fromCssColorString(isQueryResult ? '#facc15' : style?.fillColor ?? '#2dd4bf').withAlpha((style?.fillOpacity ?? 0.24) * opacity);
    const id = `cesium-${layer.id}-${featureId}`;
    const info = this.serializeFeature(feature, layer);
    const register = (entity: Cesium.Entity) => {
      const entityId = String(entity.id);
      this.entityInfo.set(entityId, info);
      if (layer.drawing) this.drawingFeatureByEntityId.set(entityId, feature);
      return entity;
    };
    const toCartesian = (coordinate: number[]) => {
      const [longitude, latitude] = toLonLat(coordinate);
      return Cesium.Cartesian3.fromDegrees(longitude, latitude);
    };
    if (geometry instanceof OlPoint) return [register(this.viewer.entities.add({id, position: toCartesian(geometry.getCoordinates()), point: {pixelSize: Math.max(5, (style?.pointRadius ?? 5) * 2), color: pointColor, outlineColor: strokeColor, outlineWidth: 1}}))];
    if (geometry instanceof OlLineString) return [register(this.viewer.entities.add({id, polyline: {positions: geometry.getCoordinates().map(toCartesian), width: Math.max(2, style?.strokeWidth ?? 2), material: strokeColor}}))];
    if (geometry instanceof OlPolygon) return [register(this.viewer.entities.add({id, polygon: {hierarchy: geometry.getCoordinates()[0].map(toCartesian), material: fillColor, outline: true, outlineColor: strokeColor}}))];
    if (geometry instanceof OlMultiPoint) return geometry.getCoordinates().map((coordinate, part) => register(this.viewer.entities.add({id: `${id}-${part}`, position: toCartesian(coordinate), point: {pixelSize: Math.max(5, (style?.pointRadius ?? 5) * 2), color: pointColor, outlineColor: strokeColor, outlineWidth: 1}})));
    if (geometry instanceof OlMultiLineString) return geometry.getCoordinates().map((coordinates, part) => register(this.viewer.entities.add({id: `${id}-${part}`, polyline: {positions: coordinates.map(toCartesian), width: Math.max(2, style?.strokeWidth ?? 2), material: strokeColor}})));
    if (geometry instanceof OlMultiPolygon) return geometry.getCoordinates().map((coordinates, part) => register(this.viewer.entities.add({id: `${id}-${part}`, polygon: {hierarchy: coordinates[0].map(toCartesian), material: fillColor, outline: true, outlineColor: strokeColor}})));
    return [];
  }

  private handlePick(position: Cesium.Cartesian2) {
    const picked = this.viewer.scene.pick(position);
    const entity = picked?.id as Cesium.Entity | undefined;
    const entityId = entity ? String(entity.id) : undefined;
    this.selectedDrawingFeature = entityId ? this.drawingFeatureByEntityId.get(entityId) : undefined;
    const info = entityId ? this.entityInfo.get(entityId) : undefined;
    this.onFeatureSelected(info, info ? [position.x, position.y] : undefined);
  }

  private serializeFeature(feature: Feature<Geometry>, layer: LayerRecord): SelectedFeatureInfo {
    const geometry = feature.getGeometry();
    const properties = Object.entries(feature.getProperties()).filter(([key]) => key !== 'geometry').reduce<Record<string, string>>((result, [key, value]) => ({...result, [key]: serializeValue(value)}), {});
    const center = geometry ? toLonLat(getCenter(geometry.getExtent())) : undefined;
    return {layerId: layer.id, layerName: layer.name, geometryType: geometry?.getType() ?? '未知几何', coordinate: center ? [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))] : undefined, properties};
  }
}

function createImageryProvider(layer: BaseMapLayerOption) {
  const subdomains = layer.url.includes('t{0-7}') ? ['0', '1', '2', '3', '4', '5', '6', '7'] : undefined;
  if (/SERVICE=WMTS/i.test(layer.url)) {
    return new Cesium.UrlTemplateImageryProvider({
      url: normalizeTemplateUrl(layer.url).replace('{z}', '{tdtZ}'),
      tilingScheme: new Cesium.WebMercatorTilingScheme({numberOfLevelZeroTilesX: 2, numberOfLevelZeroTilesY: 2}),
      minimumLevel: 0,
      maximumLevel: 17,
      subdomains,
      credit: layer.attribution,
      customTags: {
        tdtZ: (_provider: unknown, _x: number, _y: number, level: number) => String(level + 1),
      },
    });
  }
  return new Cesium.UrlTemplateImageryProvider({url: normalizeTemplateUrl(layer.url), subdomains, credit: layer.attribution});
}

function normalizeTemplateUrl(url: string) {
  return url.replace('https://t{0-7}.tianditu.gov.cn', 'https://t{s}.tianditu.gov.cn');
}

function serializeValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}




