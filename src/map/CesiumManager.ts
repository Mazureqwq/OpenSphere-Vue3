import * as Cesium from 'cesium';
import type Feature from 'ol/Feature';
import type Geometry from 'ol/geom/Geometry';
import type { BaseMapOption, LayerRecord, QueryResult, SelectedFeatureInfo } from '@/types/gis';
import type { MapViewState } from '@/types/workspace';
import type { PlaybackPosition, PlaybackTrack } from '@/map/trackPlayback';
import type { DrawMode } from '@/map/drawing';
import { createImageryProvider } from '@/map/cesium/helpers';
import {
  clearRealtimeLayer as clearRealtimeLayerModule,
  syncRealtimeLayer as syncRealtimeLayerModule,
  type RealtimeEntities,
} from '@/map/cesium/realtime';
import {
  clearTrackPlayback as clearTrackPlaybackModule,
  setTrackPlayback as setTrackPlaybackModule,
} from '@/map/cesium/playback';
import {
  beginSpatialQuery,
  clearSpatialQuery as clearSpatialQueryModule,
  completeSpatialQuery,
  startSpatialQuery as startSpatialQueryModule,
  stopSpatialQuery as stopSpatialQueryModule,
  updateSpatialQuery,
  type CesiumSpatialQueryHost,
} from '@/map/cesium/spatialQuery';
import {
  getViewState as getViewStateModule,
  setViewState as setViewStateModule,
  updateCameraZoomLimits,
  type CesiumCameraHost,
} from '@/map/cesium/camera';
import {
  focusCoordinate as focusCoordinateModule,
  locateCoordinate as locateCoordinateModule,
  type CesiumLocateHost,
} from '@/map/cesium/locate';
import {
  handlePick,
  serializeFeature,
  setQueryResults as setQueryResultsModule,
  syncLayers as syncLayersModule,
  type CesiumLayerHost,
} from '@/map/cesium/layers';
import {
  clearDrawingInteraction as clearDrawingInteractionModule,
  deleteSelectedDrawingFeatures as deleteSelectedDrawingFeaturesModule,
  pickDrawingPosition,
  setDrawMode as setDrawModeModule,
  type CesiumDrawMode,
  type CesiumDrawingHost,
} from '@/map/cesium/drawing';
import type { CesiumPlaybackHost } from '@/map/cesium/playback';
import type { CesiumRealtimeHost } from '@/map/cesium/realtime';

export class CesiumManager {
  private readonly viewer: Cesium.Viewer;
  private readonly interactionHandler: Cesium.ScreenSpaceEventHandler;
  private readonly entitiesByLayer = new Map<string, Cesium.Entity[]>();
  private readonly entityInfo = new Map<string, SelectedFeatureInfo>();
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

  constructor(
    target: HTMLElement,
    baseMap: BaseMapOption,
    private readonly onFeatureSelected: (feature?: SelectedFeatureInfo, screenPosition?: number[]) => void,
    private readonly onMeasurementChange: (value?: string) => void,
    private readonly onDrawingChange: () => void,
  ) {
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
    this.isTianDiTuBaseMap = baseMap.layers.some((layer) =>
      /tianditu\.gov\.cn\/.*\/wmts\?SERVICE=WMTS/i.test(layer.url),
    );
    this.updateCameraZoomLimits();
    this.viewer.imageryLayers.removeAll();
    baseMap.layers.forEach((layer) => {
      this.viewer.imageryLayers.addImageryProvider(createImageryProvider(layer));
    });
  }

  syncLayers(layers: LayerRecord[]) {
    syncLayersModule(this.layerHost, layers);
  }

  setQueryResults(results: QueryResult[]) {
    setQueryResultsModule(this.layerHost, results);
  }

  startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void) {
    startSpatialQueryModule(this.spatialHost, onExtent, () => {
      this.interactionHandler.setInputAction(
        (event: { position: Cesium.Cartesian2 }) => beginSpatialQuery(this.spatialHost, event.position),
        Cesium.ScreenSpaceEventType.LEFT_DOWN,
        Cesium.KeyboardEventModifier.SHIFT,
      );
      this.interactionHandler.setInputAction(
        (event: { endPosition: Cesium.Cartesian2 }) => updateSpatialQuery(this.spatialHost, event.endPosition),
        Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        Cesium.KeyboardEventModifier.SHIFT,
      );
      this.interactionHandler.setInputAction(
        (event: { position: Cesium.Cartesian2 }) => completeSpatialQuery(this.spatialHost, event.position),
        Cesium.ScreenSpaceEventType.LEFT_UP,
        Cesium.KeyboardEventModifier.SHIFT,
      );
    });
  }

  stopSpatialQuery() {
    stopSpatialQueryModule(this.spatialHost);
  }

  syncRealtimeLayer(layer?: LayerRecord) {
    syncRealtimeLayerModule(this.realtimeHost, layer);
  }

  clearRealtimeLayer() {
    clearRealtimeLayerModule(this.realtimeHost);
  }

  setTrackPlayback(track: PlaybackTrack, position: PlaybackPosition, follow: boolean) {
    setTrackPlaybackModule(this.playbackHost, track, position, follow);
  }

  clearTrackPlayback() {
    clearTrackPlaybackModule(this.playbackHost);
  }

  setViewState(state: MapViewState) {
    setViewStateModule(this.cameraHost, state);
  }

  getViewState(rotation = 0): MapViewState {
    return getViewStateModule(this.cameraHost, rotation);
  }

  setDrawMode(mode?: DrawMode, layer?: LayerRecord) {
    return setDrawModeModule(this.drawingHost, mode, layer);
  }

  deleteSelectedDrawingFeatures(layer?: LayerRecord) {
    return deleteSelectedDrawingFeaturesModule(this.drawingHost, layer);
  }

  locateCoordinate(coordinate: [number, number]) {
    locateCoordinateModule(this.locateHost, coordinate);
  }

  focusCoordinate(coordinate: [number, number]) {
    focusCoordinateModule(this.locateHost, coordinate);
  }

  resize() {
    this.viewer.resize();
    this.updateCameraZoomLimits();
  }

  getCoordinateFromScreen(pixel: [number, number]) {
    const cartesian = this.viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(pixel[0], pixel[1]),
      this.viewer.scene.globe.ellipsoid,
    );
    if (!cartesian) return undefined;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return [
      Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)),
      Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)),
    ] as [number, number];
  }

  getScreenPosition(coordinate: [number, number]) {
    const position = Cesium.SceneTransforms.worldToWindowCoordinates(
      this.viewer.scene,
      Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1]),
    );
    return position ? [position.x, position.y] : undefined;
  }

  onSceneRender(listener: () => void) {
    this.viewer.scene.postRender.addEventListener(listener);
    return () => this.viewer.scene.postRender.removeEventListener(listener);
  }

  destroy() {
    this.clearSpatialQuery();
    this.clearDrawingInteraction();
    this.interactionHandler.destroy();
    this.viewer.destroy();
  }

  private restorePickInteraction() {
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    this.interactionHandler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    this.interactionHandler.setInputAction(
      (event: { position: Cesium.Cartesian2 }) => handlePick(this.layerHost, event.position),
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  private clearSpatialQuery() {
    clearSpatialQueryModule(this.spatialHost);
  }

  private clearDrawingInteraction(clearMeasurement = true) {
    clearDrawingInteractionModule(this.drawingHost, clearMeasurement);
  }

  private updateCameraZoomLimits(latitude?: number) {
    updateCameraZoomLimits(this.cameraHost, latitude);
  }

  private get realtimeHost(): CesiumRealtimeHost {
    return {
      viewer: this.viewer,
      realtimeEntities: this.realtimeEntities,
      entityInfo: this.entityInfo,
      serializeFeature: (feature, layer) => serializeFeature(feature, layer),
    };
  }

  private get playbackHost(): CesiumPlaybackHost {
    const self = this;
    return {
      viewer: this.viewer,
      entityInfo: this.entityInfo,
      get playbackMarkerEntity() {
        return self.playbackMarkerEntity;
      },
      set playbackMarkerEntity(value) {
        self.playbackMarkerEntity = value;
      },
      get playbackHistoryEntity() {
        return self.playbackHistoryEntity;
      },
      set playbackHistoryEntity(value) {
        self.playbackHistoryEntity = value;
      },
    };
  }

  private get cameraHost(): CesiumCameraHost {
    const self = this;
    return {
      viewer: this.viewer,
      get isTianDiTuBaseMap() {
        return self.isTianDiTuBaseMap;
      },
      get synchronizedViewState() {
        return self.synchronizedViewState;
      },
      set synchronizedViewState(value) {
        self.synchronizedViewState = value;
      },
      get synchronizedCameraPosition() {
        return self.synchronizedCameraPosition;
      },
      set synchronizedCameraPosition(value) {
        self.synchronizedCameraPosition = value;
      },
    };
  }

  private get locateHost(): CesiumLocateHost {
    const self = this;
    return {
      viewer: this.viewer,
      get locationEntity() {
        return self.locationEntity;
      },
      set locationEntity(value) {
        self.locationEntity = value;
      },
    };
  }

  private get layerHost(): CesiumLayerHost {
    const self = this;
    return {
      viewer: this.viewer,
      entitiesByLayer: this.entitiesByLayer,
      entityInfo: this.entityInfo,
      drawingFeatureByEntityId: this.drawingFeatureByEntityId,
      get selectedDrawingFeature() {
        return self.selectedDrawingFeature;
      },
      set selectedDrawingFeature(value) {
        self.selectedDrawingFeature = value;
      },
      get syncedLayers() {
        return self.syncedLayers;
      },
      set syncedLayers(value) {
        self.syncedLayers = value;
      },
      queryResultKeys: this.queryResultKeys,
      onFeatureSelected: this.onFeatureSelected,
    };
  }

  private get spatialHost(): CesiumSpatialQueryHost {
    const self = this;
    return {
      viewer: this.viewer,
      interactionHandler: this.interactionHandler,
      get spatialQueryStart() {
        return self.spatialQueryStart;
      },
      set spatialQueryStart(value) {
        self.spatialQueryStart = value;
      },
      get spatialQueryEnd() {
        return self.spatialQueryEnd;
      },
      set spatialQueryEnd(value) {
        self.spatialQueryEnd = value;
      },
      get spatialQueryPreview() {
        return self.spatialQueryPreview;
      },
      set spatialQueryPreview(value) {
        self.spatialQueryPreview = value;
      },
      get spatialQueryCallback() {
        return self.spatialQueryCallback;
      },
      set spatialQueryCallback(value) {
        self.spatialQueryCallback = value;
      },
      restorePickInteraction: () => this.restorePickInteraction(),
      pickDrawingPosition: (screenPosition) => pickDrawingPosition(this.drawingHost, screenPosition),
      toMapCoordinate: (position) => {
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        return [
          Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)),
          Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)),
        ];
      },
    };
  }

  private get drawingHost(): CesiumDrawingHost {
    const self = this;
    return {
      viewer: this.viewer,
      interactionHandler: this.interactionHandler,
      get selectedDrawingFeature() {
        return self.selectedDrawingFeature;
      },
      set selectedDrawingFeature(value) {
        self.selectedDrawingFeature = value;
      },
      get drawingMode() {
        return self.drawingMode;
      },
      set drawingMode(value) {
        self.drawingMode = value;
      },
      get drawingLayer() {
        return self.drawingLayer;
      },
      set drawingLayer(value) {
        self.drawingLayer = value;
      },
      get drawingPositions() {
        return self.drawingPositions;
      },
      set drawingPositions(value) {
        self.drawingPositions = value;
      },
      get drawingCursor() {
        return self.drawingCursor;
      },
      set drawingCursor(value) {
        self.drawingCursor = value;
      },
      drawingPreviewEntities: this.drawingPreviewEntities,
      onFeatureSelected: this.onFeatureSelected,
      onMeasurementChange: this.onMeasurementChange,
      onDrawingChange: this.onDrawingChange,
      clearSpatialQuery: () => this.clearSpatialQuery(),
      restorePickInteraction: () => this.restorePickInteraction(),
    };
  }
}
