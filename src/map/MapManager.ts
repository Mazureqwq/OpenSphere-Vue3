import Map from 'ol/Map';
import View from 'ol/View';
import Group from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import DragBox from 'ol/interaction/DragBox';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Select from 'ol/interaction/Select';
import Snap from 'ol/interaction/Snap';
import Overlay from 'ol/Overlay';
import Collection from 'ol/Collection';
import XYZ from 'ol/source/XYZ';
import {click, shiftKeyOnly} from 'ol/events/condition';
import {createEmpty, extend, getCenter} from 'ol/extent';
import {unByKey} from 'ol/Observable';
import {fromLonLat, toLonLat} from 'ol/proj';
import {getArea, getLength} from 'ol/sphere';
import {defaults as defaultControls} from 'ol/control/defaults';
import type {Extent} from 'ol/extent';
import type {EventsKey} from 'ol/events';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import type Geometry from 'ol/geom/Geometry';
import type Polygon from 'ol/geom/Polygon';
import type {BaseMapOption, LayerRecord, PointVisualizationConfig, SelectedFeatureInfo} from '@/types/gis';
import {createPointVisualization, getClusterPointFeatures, getPointFeatures} from '@/map/pointVisualization';
import type {PlaybackPosition, PlaybackTrack} from '@/map/trackPlayback';
import type {DrawMode} from '@/map/drawing';
import type {MapViewState} from '@/types/workspace';

const TDT_MIN_ZOOM = 1;
const TDT_MAX_ZOOM = 18;

function isTianDiTuBaseMap(baseMap: BaseMapOption) {
  return baseMap.layers.some((layer) => /tianditu\.gov\.cn\/.*\/wmts\?SERVICE=WMTS/i.test(layer.url));
}

function getBaseMapZoomRange(baseMap: BaseMapOption) {
  return isTianDiTuBaseMap(baseMap) ? {minZoom: TDT_MIN_ZOOM, maxZoom: TDT_MAX_ZOOM} : {minZoom: 0, maxZoom: 28};
}

export class MapManager {
  readonly map: Map;
  private baseLayer: Group;
  private readonly onFeatureSelected: (feature?: SelectedFeatureInfo, pixel?: number[]) => void;
  private readonly onMeasurementChange: (value?: string) => void;
  private readonly onDrawingChange: () => void;
  private readonly select: Select;
  private draw?: Draw;
  private modify?: Modify;
  private readonly modifyCollection = new Collection<Feature>();
  private snap?: Snap;
  private geometryListener?: EventsKey;
  private spatialQueryBox?: DragBox;
  private pointVisualizationLayer?: import('ol/layer/Base').default;
  private visualizedRecord?: LayerRecord;
  private playbackLayer?: VectorLayer<VectorSource>;
  private playbackMarker?: Feature<Point>;
  private playbackLine?: Feature<LineString>;
  private playbackSourceLayerId?: string;
  private coordinateLocationLayer?: VectorLayer<VectorSource>;
  private measureSource?: VectorSource;
  private measureOverlay?: Overlay;
  private measureElement?: HTMLElement;
  private measurePointerKey?: EventsKey;
  private userInteractHandler?: () => void;

  constructor(target: HTMLElement, baseMap: BaseMapOption, onFeatureSelected: (feature?: SelectedFeatureInfo, pixel?: number[]) => void, onMeasurementChange: (value?: string) => void, onDrawingChange: () => void) {
    this.baseLayer = this.createBaseLayer(baseMap);
    this.onFeatureSelected = onFeatureSelected;
    this.onMeasurementChange = onMeasurementChange;
    this.onDrawingChange = onDrawingChange;
    this.map = new Map({target, layers: [this.baseLayer], controls: defaultControls({zoom: false, rotate: false}), view: new View({center: fromLonLat([113.6254, 34.7466]), zoom: 5, ...getBaseMapZoomRange(baseMap)})});
    this.modify = new Modify({features: this.modifyCollection});
    this.map.addInteraction(this.modify);
    this.modify.on('modifyend', () => this.onDrawingChange());
    this.select = new Select({condition: click, hitTolerance: 6, layers: (layer) => layer.get('sourceType') !== 'wms' && layer.get('sourceType') !== 'playback' && layer.get('sourceType') !== 'coordinate-location' && layer.get('id') !== 'base-map' && !layer.get('visualizationMode')});
    this.map.addInteraction(this.select);
    this.select.on('select', (event) => {
      this.modifyCollection.clear();
      event.selected.forEach((feature) => this.modifyCollection.push(feature));
    });
    this.map.on('singleclick', (event) => this.handleFeatureClick(event.pixel));
    this.map.on('pointerdrag', () => this.userInteractHandler?.());
  }

  getScreenPosition(coordinate: [number, number]) {
    const pixel = this.map.getPixelFromCoordinate(fromLonLat(coordinate));
    return pixel ? [pixel[0], pixel[1]] : undefined;
  }

  getCoordinateFromPixel(pixel: number[]) {
    const coordinate = this.map.getCoordinateFromPixel(pixel);
    if (!coordinate) return undefined;
    const lonLat = toLonLat(coordinate);
    return [Number(lonLat[0].toFixed(6)), Number(lonLat[1].toFixed(6))] as [number, number];
  }

  private createBaseLayer(baseMap: BaseMapOption) {
    const zoomRange = isTianDiTuBaseMap(baseMap) ? {minZoom: TDT_MIN_ZOOM, maxZoom: TDT_MAX_ZOOM} : {};
    return new Group({properties: {id: 'base-map'}, layers: baseMap.layers.map((item) => new TileLayer({properties: {id: item.id}, source: new XYZ({url: item.url, attributions: item.attribution, crossOrigin: 'anonymous', ...zoomRange})}))});
  }

  private handleFeatureClick(pixel: number[]) {
    const clickCoordinate = this.getCoordinateFromPixel(pixel);
    let clusterSelection: SelectedFeatureInfo | undefined;
    let expandedCluster = false;
    this.map.forEachFeatureAtPixel(pixel, (feature, layer) => {
      if (!layer || layer.get('visualizationMode') !== 'cluster') return undefined;
      clusterSelection = this.expandCluster(feature as Feature<Geometry>, clickCoordinate);
      expandedCluster = true;
      return feature;
    }, {hitTolerance: 6});
    if (expandedCluster) { this.onFeatureSelected(clusterSelection, clusterSelection ? pixel : undefined); return; }

    let selected: SelectedFeatureInfo | undefined;
    this.map.forEachFeatureAtPixel(pixel, (feature, layer) => {
      if (!layer || layer.get('sourceType') === 'wms' || layer.get('sourceType') === 'playback' || layer.get('sourceType') === 'coordinate-location' || layer.get('visualizationMode')) return undefined;
      selected = this.serializeFeature(feature as Feature<Geometry>, layer.get('id'), layer.get('displayName'), clickCoordinate);
      return feature;
    }, {hitTolerance: 6});
    this.onFeatureSelected(selected, selected ? pixel : undefined);
  }

  private expandCluster(feature: Feature<Geometry>, clickCoordinate?: [number, number]) {
    const children = getClusterPointFeatures(feature);
    if (children.length === 1) {
      const item = children[0] as Feature<Geometry>;
      return this.serializeFeature(item, this.visualizedRecord?.id, this.visualizedRecord?.name, clickCoordinate);
    }
    if (children.length < 2) return undefined;
    const extent = createEmpty();
    children.forEach((item) => {
      const geometry = item.getGeometry();
      if (geometry) extend(extent, geometry.getExtent());
    });
    this.map.getView().fit(extent, {padding: [72, 72, 72, 340], maxZoom: 18, duration: 350});
    return undefined;
  }

  private serializeFeature(feature: Feature<Geometry>, layerId?: string, layerName?: string, clickCoordinate?: [number, number]): SelectedFeatureInfo {
    const geometry = feature.getGeometry();
    const properties = Object.entries(feature.getProperties()).filter(([key]) => key !== 'geometry').reduce<Record<string, string>>((result, [key, value]) => ({...result, [key]: this.serializeValue(value)}), {});
    const metrics = this.computeMetrics(geometry);
    if (geometry && geometry.getType() === 'Point') {
      const point = toLonLat((geometry as import('ol/geom/Point').default).getCoordinates());
      return {
        featureId: feature.getId() == null ? undefined : String(feature.getId()),
        layerId: layerId ?? '',
        layerName: layerName ?? '?????',
        geometryType: 'Point',
        coordinate: [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))],
        properties,
        metrics,
      };
    }
    // Prefer click position for line/polygon so popup anchors where the user clicked.
    if (clickCoordinate) {
      return {
        featureId: feature.getId() == null ? undefined : String(feature.getId()),
        layerId: layerId ?? '',
        layerName: layerName ?? '?????',
        geometryType: geometry?.getType() ?? '????',
        coordinate: [Number(clickCoordinate[0].toFixed(6)), Number(clickCoordinate[1].toFixed(6))],
        properties,
        metrics,
      };
    }
    const center = geometry ? toLonLat(getCenter(geometry.getExtent())) : undefined;
    return {
      featureId: feature.getId() == null ? undefined : String(feature.getId()),
      layerId: layerId ?? '',
      layerName: layerName ?? '?????',
      geometryType: geometry?.getType() ?? '????',
      coordinate: center ? [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))] : undefined,
      properties,
      metrics,
    };
  }

  private computeMetrics(geometry?: Geometry) {
    if (!geometry) return undefined;
    const type = geometry.getType();
    if (type === 'LineString') {
      const line = geometry as LineString;
      return {length: getLength(line, {projection: 'EPSG:3857'}), vertexCount: line.getCoordinates().length};
    }
    if (type === 'Polygon') {
      const polygon = geometry as Polygon;
      return {
        area: getArea(polygon, {projection: 'EPSG:3857'}),
        perimeter: getLength(polygon, {projection: 'EPSG:3857'}),
        vertexCount: polygon.getCoordinates()[0]?.length ?? 0,
      };
    }
    return undefined;
  }

  private serializeValue(value: unknown) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
  }

  private getVectorSource(record: LayerRecord) {
    return (record.source as unknown as {getSource?: () => VectorSource | null}).getSource?.() ?? undefined;
  }

  private clearSpatialQuery() {
    if (this.spatialQueryBox) this.map.removeInteraction(this.spatialQueryBox);
    this.spatialQueryBox = undefined;
  }

  startSpatialQuery(onExtent: (extent: [number, number, number, number]) => void) {
    this.clearSpatialQuery();
    this.spatialQueryBox = new DragBox({condition: shiftKeyOnly});
    this.map.addInteraction(this.spatialQueryBox);
    this.spatialQueryBox.on('boxend', () => {
      const extent = this.spatialQueryBox?.getGeometry().getExtent();
      if (extent) onExtent([extent[0], extent[1], extent[2], extent[3]]);
      this.clearSpatialQuery();
    });
  }

  stopSpatialQuery() { this.clearSpatialQuery(); }

  private clearDrawingInteractions() {
    if (this.geometryListener) unByKey(this.geometryListener);
    this.geometryListener = undefined;
    [this.draw, this.snap].forEach((interaction) => { if (interaction) this.map.removeInteraction(interaction); });
    this.draw = undefined;
    this.snap = undefined;
    this.modifyCollection.clear();
    this.modify?.setActive(true);
    this.stopMeasure();
    this.select.setActive(true);
    this.onMeasurementChange();
  }

  private formatMeasurement(geometry: Geometry) {
    if (geometry.getType() === 'LineString') {
      const length = getLength(geometry, {projection: 'EPSG:3857'});
      return length >= 1000 ? `距离：${(length / 1000).toFixed(2)} km` : `距离：${length.toFixed(1)} m`;
    }
    if (geometry.getType() === 'Polygon') {
      const area = getArea(geometry, {projection: 'EPSG:3857'});
      return area >= 1000000 ? `面积：${(area / 1000000).toFixed(2)} km²` : `面积：${area.toFixed(1)} m²`;
    }
    if (geometry.getType() === 'Point') return '点位已添加';
    return undefined;
  }

  setDrawMode(mode?: DrawMode, record?: LayerRecord) {
    this.clearDrawingInteractions();
    if (!mode) return;
    if (mode === 'measureLine' || mode === 'measureArea') {
      this.startMeasure(mode);
      return;
    }
    if (!record || record.kind !== 'vector') return;
    const source = this.getVectorSource(record);
    if (!source) return;

    if (mode === 'modify') {
      this.modifyCollection.clear();
      source.getFeatures().forEach((feature) => this.modifyCollection.push(feature));
      return;
    }

    if (!record.drawing) return;

    this.select.setActive(false);
    this.modify?.setActive(false);
    this.draw = new Draw({source, type: mode, stopClick: true});
    this.snap = new Snap({source});
    this.map.addInteraction(this.draw);
    this.map.addInteraction(this.snap);
    this.draw.on('drawstart', (event) => {
      const geometry = event.feature.getGeometry();
      if (geometry) this.geometryListener = geometry.on('change', () => this.onMeasurementChange(this.formatMeasurement(geometry)));
    });
    this.draw.on('drawend', (event) => {
      if (event.feature.getId() == null) event.feature.setId(record.id + '-' + Date.now());
      if (this.geometryListener) unByKey(this.geometryListener);
      this.geometryListener = undefined;
      const geometry = event.feature.getGeometry();
      this.onMeasurementChange(geometry ? this.formatMeasurement(geometry) : undefined);
      this.onDrawingChange();
    });
  }

  private startMeasure(mode: 'measureLine' | 'measureArea') {
    this.ensureMeasureOverlay();
    this.measureSource = new VectorSource();
    this.select.setActive(false);
    this.draw = new Draw({source: this.measureSource, type: mode === 'measureLine' ? 'LineString' : 'Polygon', stopClick: true});
    this.map.addInteraction(this.draw);
    this.measurePointerKey = this.map.on('pointermove', (event) => { this.measureOverlay?.setPosition(event.coordinate); });
    this.draw.on('drawstart', (event) => {
      const geometry = event.feature.getGeometry();
      if (geometry) this.geometryListener = geometry.on('change', () => this.updateMeasureOverlay(geometry));
    });
    this.draw.on('drawend', (event) => {
      if (this.geometryListener) unByKey(this.geometryListener);
      this.geometryListener = undefined;
      this.updateMeasureOverlay(event.feature.getGeometry());
      this.measureSource?.clear();
    });
  }

  private stopMeasure() {
    if (this.measurePointerKey) unByKey(this.measurePointerKey);
    this.measurePointerKey = undefined;
    if (this.measureOverlay) this.map.removeOverlay(this.measureOverlay);
    this.measureOverlay = undefined;
    this.measureElement = undefined;
    this.measureSource = undefined;
  }

  private ensureMeasureOverlay() {
    if (this.measureOverlay) return;
    const element = document.createElement('div');
    element.className = 'map-measure-tooltip';
    element.style.display = 'none';
    this.measureElement = element;
    this.measureOverlay = new Overlay({element, positioning: 'top-left', offset: [14, -46], stopEvent: false});
    this.map.addOverlay(this.measureOverlay);
  }

  private updateMeasureOverlay(geometry?: Geometry) {
    if (!this.measureElement) return;
    const text = geometry ? this.formatMeasurement(geometry) : undefined;
    if (text) {
      this.measureElement.textContent = text;
      this.measureElement.style.display = 'block';
    } else {
      this.measureElement.style.display = 'none';
    }
  }

  clearDrawingFeatures(record: LayerRecord) {
    const source = this.getVectorSource(record);
    if (!source) return;
    source.clear();
    this.select.getFeatures().clear();
    this.onDrawingChange();
  }

  finishDrawing() { this.draw?.finishDrawing(); }
  abortDrawing() { this.draw?.abortDrawing(); }

  deleteFeature(record: LayerRecord, featureId?: string) {
    const source = this.getVectorSource(record);
    if (!source) return 0;
    const feature = featureId ? source.getFeatureById(featureId) : undefined;
    if (!feature) return this.deleteSelectedDrawingFeatures(record);
    source.removeFeature(feature);
    this.select.getFeatures().clear();
    this.onDrawingChange();
    return 1;
  }

  deleteSelectedDrawingFeatures(record?: LayerRecord) {
    if (!record || record.kind !== 'vector') return 0;
    const source = this.getVectorSource(record);
    if (!source) return 0;
    const selected = [...this.select.getFeatures().getArray()];
    const drawnFeatures = source.getFeatures();
    selected.filter((feature) => drawnFeatures.includes(feature)).forEach((feature) => source.removeFeature(feature));
    this.select.getFeatures().clear();
    if (selected.length) this.onDrawingChange();
    return selected.length;
  }

  setBaseMap(baseMap: BaseMapOption) {
    const next = this.createBaseLayer(baseMap);
    const range = getBaseMapZoomRange(baseMap);
    const view = this.map.getView();
    this.map.getLayers().setAt(0, next);
    this.baseLayer = next;
    view.setMinZoom(range.minZoom);
    view.setMaxZoom(range.maxZoom);
    const zoom = view.getZoom();
    if (zoom !== undefined) view.setZoom(Math.max(range.minZoom, Math.min(range.maxZoom, zoom)));
  }
  addLayer(record: LayerRecord) { record.source.setProperties({id: record.id, displayName: record.name}, true); this.map.addLayer(record.source); }

  setPointVisualization(record: LayerRecord, config: PointVisualizationConfig) {
    const source = this.getVectorSource(record);
    if (!source) return false;
    const features = getPointFeatures(source.getFeatures() as Feature<Geometry>[]);
    if (!features.length) return false;
    this.clearPointVisualization();
    const layer = createPointVisualization(features, config);
    layer.setProperties({visualizationMode: config.mode, visualizationOf: record.id, displayName: `${record.name} ${config.mode === 'heatmap' ? '热力图' : '聚合图'}`}, true);
    layer.setVisible(record.visible);
    this.pointVisualizationLayer = layer;
    this.visualizedRecord = record;
    record.source.setOpacity(config.mode === 'heatmap' ? Math.min(record.opacity, 0.22) : 0);
    this.map.addLayer(layer);
    return true;
  }

  clearPointVisualization() {
    if (this.pointVisualizationLayer) this.map.removeLayer(this.pointVisualizationLayer);
    if (this.visualizedRecord) this.visualizedRecord.source.setOpacity(this.visualizedRecord.opacity);
    this.pointVisualizationLayer = undefined;
    this.visualizedRecord = undefined;
  }

  setTrackPlayback(sourceLayerId: string, track: PlaybackTrack, position: PlaybackPosition, follow: boolean) {
    this.ensureTrackPlaybackLayer();
    this.playbackSourceLayerId = sourceLayerId;
    this.playbackLine?.getGeometry()?.setCoordinates(position.history);
    this.playbackMarker?.getGeometry()?.setCoordinates(position.coordinate);
    this.playbackMarker?.setProperties({trackId: track.id, timestamp: new Date(track.start).toISOString(), ...position.properties}, false);
    this.playbackLayer?.setProperties({displayName: `轨迹回放 · ${track.name}`}, true);
    if (follow) this.map.getView().setCenter(position.coordinate);
  }

  clearTrackPlayback() {
    if (this.playbackLayer) this.map.removeLayer(this.playbackLayer);
    this.playbackLayer = undefined;
    this.playbackLine = undefined;
    this.playbackMarker = undefined;
    this.playbackSourceLayerId = undefined;
  }

  setUserInteractHandler(handler?: () => void) { this.userInteractHandler = handler; }

  private ensureTrackPlaybackLayer() {
    if (this.playbackLayer && this.playbackMarker && this.playbackLine) return;
    const line = new Feature<LineString>({geometry: new LineString([]), playbackRole: 'history'});
    const marker = new Feature<Point>({geometry: new Point([0, 0]), playbackRole: 'position'});
    const source = new VectorSource({features: [line, marker]});
    const layer = new VectorLayer({source, properties: {id: 'track-playback', sourceType: 'playback', displayName: '轨迹回放'}});
    layer.setStyle((feature) => feature.get('playbackRole') === 'history'
      ? new Style({stroke: new Stroke({color: '#38bdf8', width: 4})})
      : new Style({image: new CircleStyle({radius: 8, fill: new Fill({color: '#f97316'}), stroke: new Stroke({color: '#fff7ed', width: 2})}), text: new Text({text: '当前', offsetY: -18, fill: new Fill({color: '#fed7aa'}), stroke: new Stroke({color: '#111827', width: 3}), font: '12px sans-serif'})}));
    this.playbackLayer = layer;
    this.playbackLine = line;
    this.playbackMarker = marker;
    this.map.addLayer(layer);
  }

  locateCoordinate(coordinate: [number, number]) {
    this.clearCoordinateLocation();
    const marker = new Feature<Point>({geometry: new Point(fromLonLat(coordinate))});
    const layer = new VectorLayer({source: new VectorSource({features: [marker]}), properties: {id: 'coordinate-location', sourceType: 'coordinate-location', displayName: '坐标定位'}});
    layer.setStyle(new Style({image: new CircleStyle({radius: 9, fill: new Fill({color: '#ec4899'}), stroke: new Stroke({color: '#ffffff', width: 3})}), text: new Text({text: `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`, offsetY: -20, fill: new Fill({color: '#fce7f3'}), stroke: new Stroke({color: '#1f2937', width: 3}), font: '12px sans-serif'})}));
    this.coordinateLocationLayer = layer;
    this.map.addLayer(layer);
    const view = this.map.getView();
    view.animate({center: fromLonLat(coordinate), zoom: Math.max(view.getZoom() ?? 5, 14), duration: 450});
  }

  focusCoordinate(coordinate: [number, number]) {
    const view = this.map.getView();
    view.animate({center: fromLonLat(coordinate), zoom: 16, duration: 450});
  }

  clearCoordinateLocation() {
    if (this.coordinateLocationLayer) this.map.removeLayer(this.coordinateLocationLayer);
    this.coordinateLocationLayer = undefined;
  }

  zoomToLayer(record: LayerRecord) {
    const source = (record.source as unknown as {getSource?: () => {getExtent?: () => Extent} | null}).getSource?.();
    const extent = source?.getExtent?.();
    if (!extent || extent.some((value: number) => !Number.isFinite(value))) return;
    this.map.getView().fit(extent, {padding: [72, 72, 72, 340], maxZoom: 16, duration: 450});
  }

  getViewState(): MapViewState { const view = this.map.getView(); const center = toLonLat(view.getCenter() ?? fromLonLat([113.6254, 34.7466])); return {center: [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))], zoom: view.getZoom() ?? 5, rotation: view.getRotation()}; }
  setViewState(state: MapViewState) { const view = this.map.getView(); view.setCenter(fromLonLat(state.center)); view.setZoom(state.zoom); view.setRotation(state.rotation); }
  clearDataLayers() { this.clearDrawingInteractions(); this.clearPointVisualization(); this.clearTrackPlayback(); this.clearCoordinateLocation(); this.map.getLayers().getArray().filter((layer) => layer.get('id') !== 'base-map').forEach((layer) => this.map.removeLayer(layer)); }
  focusFeature(record: LayerRecord, featureId: string) {
    const source = this.getVectorSource(record);
    const feature = source?.getFeatureById(featureId);
    const geometry = feature?.getGeometry();
    if (geometry) this.map.getView().fit(geometry.getExtent(), {padding: [72, 72, 72, 340], maxZoom: 17, duration: 350});
  }
  removeLayerById(id: string) { if (this.visualizedRecord?.id === id) this.clearPointVisualization(); if (this.playbackSourceLayerId === id) this.clearTrackPlayback(); const layer = this.map.getLayers().getArray().find((item) => item.get('id') === id); if (layer) this.map.removeLayer(layer); }
  dispose() { this.clearDrawingInteractions(); this.clearSpatialQuery(); this.clearPointVisualization(); this.clearTrackPlayback(); this.clearCoordinateLocation(); this.map.setTarget(undefined); }
}














