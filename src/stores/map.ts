import {computed, markRaw, ref, toRaw} from 'vue';
import {defineStore} from 'pinia';
import {applyCategoryStyle, applyVectorStyle, getTimeBounds, getVectorFeatures, matchesFeatureQuery} from '@/map/styles';
import type BaseLayer from 'ol/layer/Base';
import type {BaseMapOption, CategoryStyleRule, FeatureQueryConfig, LayerRecord, MapEngine, QueryResult, SelectedFeatureInfo, TimeFilterConfig, TimeRange, VectorStyleConfig} from '@/types/gis';

const tiandituToken = import.meta.env.VITE_TDT_TOKEN?.trim();
const tdtUrl = (layer: 'vec' | 'img' | 'cva' | 'cia') => `https://t{0-7}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituToken}`;
const baseMaps: BaseMapOption[] = [
  ...(tiandituToken ? [
    {id: 'tdt-vector', name: '天地图矢量', region: 'china' as const, layers: [{id: 'tdt-vector-base', url: tdtUrl('vec'), attribution: '© 天地图'}, {id: 'tdt-vector-label', url: tdtUrl('cva'), attribution: '© 天地图'}]},
    {id: 'tdt-imagery', name: '天地图影像', region: 'china' as const, layers: [{id: 'tdt-imagery-base', url: tdtUrl('img'), attribution: '© 天地图'}, {id: 'tdt-imagery-label', url: tdtUrl('cia'), attribution: '© 天地图'}]},
  ] : []),
  {id: 'osm', name: '开放街道地图', region: 'global', layers: [{id: 'osm-base', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors'}]},
  {id: 'arcgis-imagery', name: 'ArcGIS 卫星影像', region: 'global', layers: [{id: 'arcgis-imagery-base', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Esri'}]},
];

export const useMapStore = defineStore('map', () => {
  const layers = ref<LayerRecord[]>([]);
  const selectedLayerId = ref<string>();
  const selectedFeature = ref<SelectedFeatureInfo>();
  const activeBaseMapId = ref(tiandituToken ? 'tdt-vector' : 'osm');
  const mapEngine = ref<MapEngine>('2d');
  const timeEnabled = ref(false);
  const timeRange = ref<TimeRange>();
  const timeCursor = ref(0.5);
  const query = ref<FeatureQueryConfig>();
  const activeBaseMap = computed(() => baseMaps.find((item) => item.id === activeBaseMapId.value) ?? baseMaps[0]);
  const dataLayers = computed(() => layers.value.filter((layer) => layer.kind !== 'base'));
  const timeBounds = computed<TimeRange | undefined>(() => {
    const bounds = layers.value.flatMap((layer) => {
      if (!layer.timeFilter) return [];
      const range = getTimeBounds(toRaw(layer.source) as unknown as BaseLayer, layer.timeFilter.field);
      return range ? [range] : [];
    });
    return bounds.length ? {start: Math.min(...bounds.map((range) => range.start)), end: Math.max(...bounds.map((range) => range.end))} : undefined;
  });
  const queryResults = computed<QueryResult[]>(() => {
    const config = query.value;
    if (!config) return [];
    const layer = layers.value.find((item) => item.id === config.layerId);
    if (!layer?.vectorStyle) return [];
    return getVectorFeatures(toRaw(layer.source) as unknown as BaseLayer)
      .filter((feature) => matchesFeatureQuery(feature, config))
      .map((feature, index) => ({id: String(feature.getId() ?? index), layerId: config.layerId, properties: Object.entries(feature.getProperties()).filter(([key]) => key !== 'geometry').reduce<Record<string, string>>((result, [key, value]) => ({...result, [key]: value == null ? '' : String(value)}), {})}));
  });

  function renderLayer(layer: LayerRecord) {
    if (!layer.vectorStyle) return;
    const source = toRaw(layer.source) as unknown as BaseLayer;
    const filter = timeEnabled.value && timeRange.value ? layer.timeFilter : undefined;
    const range = filter ? timeRange.value : undefined;
    const layerQuery = query.value?.layerId === layer.id ? query.value : undefined;
    if (layer.categoryStyle) applyCategoryStyle(source, layer.vectorStyle, layer.categoryStyle, filter, range, layerQuery);
    else applyVectorStyle(source, layer.vectorStyle, filter, range, layerQuery);
  }

  function addLayer(layer: LayerRecord) { layers.value.push({...layer, source: markRaw(layer.source)}); selectedLayerId.value = layer.id; }
  function replaceLayers(nextLayers: LayerRecord[]) { layers.value = nextLayers.map((layer) => ({...layer, source: markRaw(layer.source)})); }
  function clearLayers() { layers.value = []; selectedLayerId.value = undefined; selectedFeature.value = undefined; query.value = undefined; }
  function refreshFeatureCount(id: string) {
    const layer = layers.value.find((item) => item.id === id);
    if (!layer?.vectorStyle && !layer?.realtime) return;
    const features = getVectorFeatures(toRaw(layer.source) as unknown as BaseLayer);
    layer.featureCount = layer.realtime ? features.filter((feature) => feature.get('realtimeRole') === 'position').length : features.length;
  }
  function setBaseMap(id: string) { activeBaseMapId.value = baseMaps.some((item) => item.id === id) ? id : baseMaps[0].id; }
  function setMapEngine(engine: MapEngine) { mapEngine.value = engine; }
  function removeLayer(id: string) { layers.value = layers.value.filter((layer) => layer.id !== id); if (selectedLayerId.value === id) selectedLayerId.value = layers.value.at(-1)?.id; if (selectedFeature.value?.layerId === id) selectedFeature.value = undefined; if (query.value?.layerId === id) query.value = undefined; }
  function setLayerVisible(id: string, visible: boolean) { const layer = layers.value.find((item) => item.id === id); if (layer) { layer.visible = visible; layer.source.setVisible(visible); } }
  function setLayerOpacity(id: string, opacity: number) { const layer = layers.value.find((item) => item.id === id); if (layer) { layer.opacity = opacity; layer.source.setOpacity(opacity); } }
  function setVectorStyle(id: string, style: VectorStyleConfig) { const layer = layers.value.find((item) => item.id === id); if (!layer?.vectorStyle) return; layer.vectorStyle = {...style}; renderLayer(toRaw(layer) as unknown as LayerRecord); }
  function setCategoryStyle(id: string, rule: CategoryStyleRule) { const layer = layers.value.find((item) => item.id === id); if (!layer?.vectorStyle) return; layer.categoryStyle = {...rule, colors: {...rule.colors}}; renderLayer(toRaw(layer) as unknown as LayerRecord); }
  function clearCategoryStyle(id: string) { const layer = layers.value.find((item) => item.id === id); if (!layer?.vectorStyle) return; layer.categoryStyle = undefined; renderLayer(toRaw(layer) as unknown as LayerRecord); }
  function setTimeFilter(id: string, filter: TimeFilterConfig) { const layer = layers.value.find((item) => item.id === id); if (!layer?.vectorStyle) return; layer.timeFilter = {...filter}; renderLayer(toRaw(layer) as unknown as LayerRecord); }
  function clearTimeFilter(id: string) { const layer = layers.value.find((item) => item.id === id); if (!layer?.vectorStyle) return; layer.timeFilter = undefined; renderLayer(toRaw(layer) as unknown as LayerRecord); }
  function setTimeEnabled(enabled: boolean) { timeEnabled.value = enabled; refreshFilters(); }
  function setTimeRange(range?: TimeRange) { timeRange.value = range && range.start <= range.end ? {...range} : undefined; refreshFilters(); }
  function setQuery(config?: FeatureQueryConfig) { query.value = config ? {...config} : undefined; refreshFilters(); }
  function setQueryExtent(extent?: [number, number, number, number]) { if (!query.value) return; query.value = {...query.value, spatialExtent: extent}; refreshFilters(); }
  function refreshFilters() { layers.value.forEach((layer) => renderLayer(toRaw(layer) as unknown as LayerRecord)); }
  function setSelectedFeature(feature?: SelectedFeatureInfo) { selectedFeature.value = feature; if (feature) selectedLayerId.value = feature.layerId; }

  return {baseMaps, layers, dataLayers, mapEngine, selectedLayerId, selectedFeature, activeBaseMapId, activeBaseMap, timeEnabled, timeRange, timeCursor, timeBounds, query, queryResults, tiandituEnabled: Boolean(tiandituToken), addLayer, replaceLayers, clearLayers, refreshFeatureCount, setBaseMap, setMapEngine, removeLayer, setLayerVisible, setLayerOpacity, setVectorStyle, setCategoryStyle, clearCategoryStyle, setTimeFilter, clearTimeFilter, setTimeEnabled, setTimeRange, setQuery, setQueryExtent, refreshFilters, setSelectedFeature};
});


