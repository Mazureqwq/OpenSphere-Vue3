import * as Cesium from 'cesium';
import type { BaseMapLayerOption } from '@/types/gis';

export const TDT_MIN_ZOOM = 1;
export const TDT_MAX_ZOOM = 18;
export const WEB_MERCATOR_MAX_RESOLUTION = 156543.03392804097;
export const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;


export function createImageryProvider(layer: BaseMapLayerOption) {
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

export function normalizeTemplateUrl(url: string) {
  return url.replace('https://t{0-7}.tianditu.gov.cn', 'https://t{s}.tianditu.gov.cn');
}

export function serializeValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}





