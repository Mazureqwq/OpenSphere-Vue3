import type {LayerRecord} from '@/types/gis';
import type {MapViewState} from '@/types/workspace';

export type SearchResultKind = 'coordinate' | 'feature' | 'place';

export interface SearchResult {
  id: string;
  providerId: string;
  providerName: string;
  kind: SearchResultKind;
  title: string;
  subtitle?: string;
  coordinate: [number, number];
  layerId?: string;
  featureId?: string;
  score: number;
}

export interface SearchContext {
  layers: LayerRecord[];
  view?: MapViewState;
  limit: number;
}

export interface SearchProvider {
  id: string;
  name: string;
  search(term: string, context: SearchContext, signal: AbortSignal): Promise<SearchResult[]>;
}
