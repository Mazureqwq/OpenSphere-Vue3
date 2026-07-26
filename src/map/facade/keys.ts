import type { InjectionKey, Ref } from 'vue';
import type { MapFacade } from '@/map/facade/types';

export const mapFacadeKey: InjectionKey<Ref<MapFacade | undefined>> = Symbol('mapFacade');
