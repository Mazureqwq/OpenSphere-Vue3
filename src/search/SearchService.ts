import {AmapPlaceSearchProvider, CoordinateSearchProvider, LayerFeatureSearchProvider, TianDiTuPlaceSearchProvider} from '@/search/providers';
import type {SearchContext, SearchProvider, SearchResult} from '@/search/types';

export class SearchService {
  private readonly providers: SearchProvider[];
  private controller?: AbortController;

  constructor() {
    this.providers = [new CoordinateSearchProvider(), new LayerFeatureSearchProvider()];
    const tianDiTuToken = import.meta.env.VITE_TDT_TOKEN?.trim();
    if (tianDiTuToken) this.providers.push(new TianDiTuPlaceSearchProvider(tianDiTuToken));
    const amapKey = import.meta.env.VITE_AMAP_WEB_KEY?.trim();
    if (amapKey) this.providers.push(new AmapPlaceSearchProvider(amapKey));
  }

  getProviderNames() { return this.providers.map((provider) => provider.name); }

  async search(term: string, context: SearchContext) {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const keyword = term.trim();
    if (!keyword) return {results: [] as SearchResult[], errors: [] as string[]};
    const responses = await Promise.allSettled(this.providers.map((provider) => provider.search(keyword, context, controller.signal)));
    if (controller.signal.aborted) return {results: [] as SearchResult[], errors: [] as string[]};
    const results = responses.flatMap((response) => response.status === 'fulfilled' ? response.value : []);
    const errors = responses.flatMap((response) => response.status === 'rejected' && response.reason?.name !== 'AbortError' ? [response.reason instanceof Error ? response.reason.message : '搜索服务异常'] : []);
    return {results: results.sort((left, right) => right.score - left.score).slice(0, context.limit), errors};
  }

  dispose() { this.controller?.abort(); }
}
