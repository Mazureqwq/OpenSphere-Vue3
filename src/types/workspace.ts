import type {CategoryStyleRule, FeatureQueryConfig, TimeFilterConfig, TimeRange, VectorStyleConfig} from '@/types/gis';

export interface MapViewState { center: [number, number]; zoom: number; rotation: number; }

export interface WorkspaceVectorLayer {
  type: 'vector';
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  style: VectorStyleConfig;
  categoryStyle?: CategoryStyleRule;
  timeFilter?: TimeFilterConfig;
  drawing?: boolean;
  features: object;
}

export interface WorkspaceWmsLayer {
  type: 'wms';
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  url: string;
  layers: string;
  format: string;
  version: '1.1.1' | '1.3.0';
  transparent: boolean;
}

export interface WorkspaceSnapshot {
  version: 1;
  savedAt: string;
  baseMapId: string;
  selectedLayerId?: string;
  timeEnabled: boolean;
  timeCursor: number;
  timeRange?: TimeRange;
  query?: FeatureQueryConfig;
  view: MapViewState;
  layers: Array<WorkspaceVectorLayer | WorkspaceWmsLayer>;
}


