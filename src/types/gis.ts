import type BaseLayer from 'ol/layer/Base';
import type Layer from 'ol/layer/Layer';
import type VectorSource from 'ol/source/Vector';

export type LayerKind = 'base' | 'vector' | 'tile' | 'wms';
export type MapEngine = '2d' | '3d';
export type LineDash = 'solid' | 'dashed' | 'dotted';
export type QueryOperator = 'contains' | 'equals' | 'greaterThan' | 'lessThan';
export type PointVisualizationMode = 'heatmap' | 'cluster';
export interface PointVisualizationConfig { mode: PointVisualizationMode; heatRadius: number; heatBlur: number; clusterDistance: number; }

export interface VectorStyleConfig { pointColor: string; pointRadius: number; strokeColor: string; strokeWidth: number; lineDash: LineDash; fillColor: string; fillOpacity: number; }
export interface CategoryStyleRule { field: string; colors: Record<string, string>; fallbackColor: string; }
export interface TimeFilterConfig { field: string; }
export interface TimeRange { start: number; end: number; }
export interface FeatureQueryConfig { layerId: string; field: string; operator: QueryOperator; value: string; spatialExtent?: [number, number, number, number]; }

export interface LayerRecord {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number;
  source: BaseLayer;
  featureCount?: number;
  vectorStyle?: VectorStyleConfig;
  categoryStyle?: CategoryStyleRule;
  timeFilter?: TimeFilterConfig;
  drawing?: boolean;
  realtime?: boolean;
}

export interface QueryResult { id: string; layerId: string; properties: Record<string, string>; }
export interface SelectedFeatureInfo { layerId: string; layerName: string; geometryType: string; coordinate?: [number, number]; properties: Record<string, string>; }
export interface BaseMapLayerOption { id: string; url: string; attribution: string; }
export interface BaseMapOption { id: string; name: string; layers: BaseMapLayerOption[]; region: 'china' | 'global'; }
export type VectorLayer = Layer<VectorSource>;





