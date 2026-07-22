import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import type {LayerRecord} from '@/types/gis';

export interface WmsLayerInput {
  name: string;
  url: string;
  layers: string;
  format?: string;
  version?: '1.1.1' | '1.3.0';
  transparent?: boolean;
}

function createId(name: string) {
  return `wms-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

export function createWmsLayer(input: WmsLayerInput): LayerRecord {
  const id = createId(input.name);
  const layer = new TileLayer({
    properties: {id, sourceType: 'wms', serviceUrl: input.url, serviceLayerName: input.layers},
    source: new TileWMS({
      url: input.url.trim(),
      params: {
        LAYERS: input.layers.trim(),
        TILED: true,
        FORMAT: input.format ?? 'image/png',
        TRANSPARENT: input.transparent ?? true,
        VERSION: input.version ?? '1.3.0',
      },
      transition: 0,
    }),
  });

  return {
    id,
    name: input.name.trim(),
    kind: 'wms',
    visible: true,
    opacity: 1,
    source: layer,
  };
}

