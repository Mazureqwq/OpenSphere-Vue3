import { inject, type Ref } from 'vue';
import { mapFacadeKey, type MapFacade } from '@/map/facade';

export function useMapFacade(): Ref<MapFacade | undefined> {
  const facade = inject(mapFacadeKey, undefined);
  if (!facade) {
    throw new Error('MapFacade 未提供，请确认 MapView 已挂载');
  }
  return facade;
}

export function useOptionalMapFacade(): Ref<MapFacade | undefined> | undefined {
  return inject(mapFacadeKey, undefined);
}
