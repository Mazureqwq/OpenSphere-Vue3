import JSZip from 'jszip';
import shp from 'shpjs';

type WorkerRequest = {kind: 'shapefile' | 'kmz'; buffer: ArrayBuffer};
type GeoJsonFeatureCollection = {type: 'FeatureCollection'; features: object[]};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const result = event.data.kind === 'shapefile' ? await parseShapefile(event.data.buffer) : await parseKmz(event.data.buffer);
    self.postMessage({ok: true, result});
  } catch (error) {
    self.postMessage({ok: false, error: error instanceof Error ? error.message : '空间文件解析失败'});
  }
};

async function parseShapefile(buffer: ArrayBuffer): Promise<GeoJsonFeatureCollection> {
  const parsed = await shp(buffer);
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  const features = collections.flatMap((collection) => collection.features ?? []);
  if (!features.length) throw new Error('压缩包中未解析到 Shapefile 要素，请确认包含 .shp、.shx、.dbf 文件');
  return {type: 'FeatureCollection', features: features as object[]};
}

async function parseKmz(buffer: ArrayBuffer) {
  const archive = await JSZip.loadAsync(buffer);
  const kmlFile = Object.values(archive.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.kml'));
  if (!kmlFile) throw new Error('KMZ 压缩包中未找到 KML 文件');
  return {kml: await kmlFile.async('text')};
}
