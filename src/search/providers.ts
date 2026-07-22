import {getCenter} from 'ol/extent';
import {toLonLat} from 'ol/proj';
import type {LayerRecord} from '@/types/gis';
import {getVectorFeatures} from '@/map/styles';
import type {SearchContext, SearchProvider, SearchResult} from '@/search/types';

const coordinatePattern = /^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,，\s]+\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$/;

function getCoordinate(term: string): [number, number] | undefined {
  const match = term.match(coordinatePattern);
  if (!match) return undefined;
  let first = Number(match[1]);
  let second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;
  if (Math.abs(first) <= 90 && Math.abs(second) > 90) [first, second] = [second, first];
  if (Math.abs(first) > 180 || Math.abs(second) > 90) return undefined;
  return [first, second];
}

export class CoordinateSearchProvider implements SearchProvider {
  readonly id = 'coordinate';
  readonly name = '坐标定位';

  async search(term: string): Promise<SearchResult[]> {
    const coordinate = getCoordinate(term);
    if (!coordinate) return [];
    return [{
      id: `coordinate:${coordinate.join(',')}`,
      providerId: this.id,
      providerName: this.name,
      kind: 'coordinate',
      title: `定位至 ${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`,
      subtitle: '经度、纬度',
      coordinate,
      score: 100,
    }];
  }
}

function getFeatureSearchText(layer: LayerRecord, feature: ReturnType<typeof getVectorFeatures>[number]) {
  return [layer.name, ...Object.values(feature.getProperties()).filter((value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean').map(String)].join(' ').toLocaleLowerCase();
}

function getFeatureTitle(layer: LayerRecord, feature: ReturnType<typeof getVectorFeatures>[number], fallback: number) {
  const properties = feature.getProperties();
  const preferred = properties.name ?? properties.title ?? properties.label ?? properties.名称 ?? properties.标题;
  return preferred == null || preferred === '' ? `${layer.name} 要素 ${fallback + 1}` : String(preferred);
}

export class LayerFeatureSearchProvider implements SearchProvider {
  readonly id = 'layer-feature';
  readonly name = '图层要素';

  async search(term: string, context: SearchContext): Promise<SearchResult[]> {
    const keyword = term.trim().toLocaleLowerCase();
    if (!keyword) return [];
    const results: SearchResult[] = [];
    context.layers.filter((layer) => layer.vectorStyle && layer.visible).some((layer) => {
      const features = getVectorFeatures(layer.source);
      return features.some((feature, index) => {
        if (!getFeatureSearchText(layer, feature).includes(keyword)) return false;
        const geometry = feature.getGeometry();
        if (!geometry) return false;
        const coordinate = toLonLat(getCenter(geometry.getExtent()));
        const title = getFeatureTitle(layer, feature, index);
        results.push({
          id: `${layer.id}:${String(feature.getId() ?? index)}`,
          providerId: this.id,
          providerName: this.name,
          kind: 'feature',
          title,
          subtitle: layer.name,
          coordinate: [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))],
          layerId: layer.id,
          featureId: String(feature.getId() ?? index),
          score: title.toLocaleLowerCase() === keyword ? 90 : title.toLocaleLowerCase().startsWith(keyword) ? 80 : 70,
        });
        return results.length >= context.limit;
      });
    });
    return results;
  }
}

interface TianDiTuPlace {
  name?: string;
  address?: string;
  type?: string;
  poiType?: string;
  x?: string | number;
  y?: string | number;
  lon?: string | number;
  lat?: string | number;
  longitude?: string | number;
  latitude?: string | number;
  lonlat?: string;
  location?: string;
}
interface TianDiTuArea {name?: string; bound?: string; adminCode?: string | number; lonlat?: string;}
interface TianDiTuResponse {status?: string | number; msg?: string; pois?: TianDiTuPlace[]; area?: TianDiTuArea;}

function parseTianDiTuCoordinate(place: TianDiTuPlace): [number, number] | undefined {
  const pairs: Array<[unknown, unknown]> = [[place.x, place.y], [place.lon, place.lat], [place.longitude, place.latitude]];
  const textCoordinate = place.lonlat ?? place.location;
  if (textCoordinate) {
    const [longitude, latitude] = textCoordinate.split(/[\s,，]+/);
    pairs.push([longitude, latitude]);
  }
  for (const [longitudeValue, latitudeValue] of pairs) {
    const longitude = Number(longitudeValue);
    const latitude = Number(latitudeValue);
    if (Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90) return [longitude, latitude];
  }
  return undefined;
}

function parseTianDiTuArea(area?: TianDiTuArea): SearchResult[] {
  if (!area?.lonlat) return [];
  const [longitude, latitude] = area.lonlat.split(/[\s,，]+/).map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
  return [{
    id: `tianditu-area:${area.adminCode ?? area.lonlat}`,
    providerId: 'tianditu-place',
    providerName: '天地图地名',
    kind: 'place',
    title: area.name || '未命名行政区',
    subtitle: '行政区',
    coordinate: [longitude, latitude],
    score: 75,
  }];
}

export class TianDiTuPlaceSearchProvider implements SearchProvider {
  readonly id = 'tianditu-place';
  readonly name = '天地图地名';

  constructor(private readonly token: string) {}

  async search(term: string, context: SearchContext, signal: AbortSignal): Promise<SearchResult[]> {
    const postStr = JSON.stringify({keyWord: term, level: '11', mapBound: '73.33,3.51,135.05,53.33', queryType: '1', count: String(context.limit), start: '0'});
    const params = new URLSearchParams({postStr, type: 'query', tk: this.token});
    const response = await fetch(`https://api.tianditu.gov.cn/v2/search?${params}`, {signal});
    if (!response.ok) throw new Error('天地图地点搜索请求失败');
    const payload = await response.json() as TianDiTuResponse;
    if (payload.msg && payload.msg !== 'ok') throw new Error(payload.msg);
    const places = (payload.pois ?? []).flatMap((place, index) => {
      const coordinate = parseTianDiTuCoordinate(place);
      if (!coordinate) return [];
      return [{
        id: `tianditu:${coordinate.join(',')}:${index}`,
        providerId: this.id,
        providerName: this.name,
        kind: 'place' as const,
        title: place.name || '未命名地点',
        subtitle: [place.address, place.poiType ?? place.type].filter(Boolean).join(' · '),
        coordinate,
        score: 65 - index,
      }];
    });
    return [...parseTianDiTuArea(payload.area), ...places].slice(0, context.limit);
  }
}

interface AmapPoi {id?: string; name?: string; address?: string; location?: string; type?: string; cityname?: string; adname?: string;}
interface AmapResponse {status?: string; info?: string; pois?: AmapPoi[];}

export class AmapPlaceSearchProvider implements SearchProvider {
  readonly id = 'amap-place';
  readonly name = '高德地点';

  constructor(private readonly key: string) {}

  async search(term: string, context: SearchContext, signal: AbortSignal): Promise<SearchResult[]> {
    const params = new URLSearchParams({key: this.key, keywords: term, offset: String(context.limit), page: '1', extensions: 'base'});
    if (context.view) params.set('location', context.view.center.join(','));
    const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`, {signal});
    if (!response.ok) throw new Error('地点搜索服务请求失败');
    const payload = await response.json() as AmapResponse;
    if (payload.status !== '1') throw new Error(payload.info || '地点搜索服务返回异常');
    return (payload.pois ?? []).flatMap((poi, index) => {
      const coordinate = poi.location?.split(',').map(Number);
      if (!coordinate || coordinate.length !== 2 || !coordinate.every(Number.isFinite)) return [];
      const subtitle = [poi.address, poi.adname || poi.cityname, poi.type].filter(Boolean).join(' · ');
      return [{
        id: `amap:${poi.id ?? `${coordinate.join(',')}:${index}`}`,
        providerId: this.id,
        providerName: this.name,
        kind: 'place' as const,
        title: poi.name || '未命名地点',
        subtitle,
        coordinate: [coordinate[0], coordinate[1]] as [number, number],
        score: 60 - index,
      }];
    });
  }
}
