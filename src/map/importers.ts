import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import GPX from 'ol/format/GPX';
import KML from 'ol/format/KML';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {fromLonLat} from 'ol/proj';
import Papa from 'papaparse';
import {createVectorStyle, defaultVectorStyle} from '@/map/styles';
import type {LayerRecord} from '@/types/gis';

type WorkerResult = {kml?: string; type?: 'FeatureCollection'; features?: object[]};

function idFromName(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

function createVectorLayer(name: string, features: Feature[]): LayerRecord {
  const id = idFromName(name);
  const vectorStyle = {...defaultVectorStyle};
  features.forEach((feature, index) => { if (feature.getId() == null) feature.setId(`${id}-${index}`); });
  const layer = new VectorLayer({source: new VectorSource({features}), style: createVectorStyle(vectorStyle), properties: {id}});
  return {id, name, kind: 'vector', visible: true, opacity: 1, source: layer, featureCount: features.length, vectorStyle};
}

function assertFeatures(name: string, features: Feature[]) {
  if (!features.length) throw new Error(`${name} 中未解析到可显示的空间要素`);
}

async function parseInWorker(file: File, kind: 'shapefile' | 'kmz') {
  const worker = new Worker(new URL('../workers/spatialFile.worker.ts', import.meta.url), {type: 'module'});
  const buffer = await file.arrayBuffer();
  return new Promise<WorkerResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ok: boolean; result?: WorkerResult; error?: string}>) => {
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? '空间文件解析失败'));
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('空间文件解析线程发生错误')); };
    worker.postMessage({kind, buffer}, [buffer]);
  });
}

export async function importGeoJson(file: File): Promise<LayerRecord> {
  const features = new GeoJSON().readFeatures(await file.text(), {featureProjection: 'EPSG:3857'});
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importKml(file: File): Promise<LayerRecord> {
  const features = new KML({extractStyles: true, showPointNames: false}).readFeatures(await file.text(), {featureProjection: 'EPSG:3857'});
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importKmz(file: File): Promise<LayerRecord> {
  const result = await parseInWorker(file, 'kmz');
  const features = new KML({extractStyles: true, showPointNames: false}).readFeatures(result.kml ?? '', {featureProjection: 'EPSG:3857'});
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importGpx(file: File): Promise<LayerRecord> {
  const features = new GPX().readFeatures(await file.text(), {featureProjection: 'EPSG:3857'});
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importShapefile(file: File): Promise<LayerRecord> {
  const result = await parseInWorker(file, 'shapefile');
  const features = new GeoJSON().readFeatures({type: 'FeatureCollection', features: result.features ?? []}, {featureProjection: 'EPSG:3857'});
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importCsv(file: File): Promise<LayerRecord> {
  const result = Papa.parse<Record<string, string>>(await file.text(), {header: true, skipEmptyLines: true});
  const rows = result.data;
  const lonKey = Object.keys(rows[0] ?? {}).find((key) => /^(lon|lng|longitude|x)$/i.test(key));
  const latKey = Object.keys(rows[0] ?? {}).find((key) => /^(lat|latitude|y)$/i.test(key));
  if (!lonKey || !latKey) throw new Error('CSV 必须包含 longitude/lon/lng/x 和 latitude/lat/y 字段');

  const features = rows.flatMap((row) => {
    const lon = Number(row[lonKey]);
    const lat = Number(row[latKey]);
    return Number.isFinite(lon) && Number.isFinite(lat) ? [new Feature({geometry: new Point(fromLonLat([lon, lat])), ...row})] : [];
  });
  assertFeatures(file.name, features);
  return createVectorLayer(file.name, features);
}

export async function importGeoJsonFromUrl(url: string, name = '示例空间数据'): Promise<LayerRecord> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`示例数据加载失败：HTTP ${response.status}`);
  const features = new GeoJSON().readFeatures(await response.text(), {featureProjection: 'EPSG:3857'});
  assertFeatures(name, features);
  return createVectorLayer(name, features);
}


