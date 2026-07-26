import type { Ref } from 'vue';
import type { MapFacade } from '@/map/facade';
import { usePointVisualization } from '@/composables/usePointVisualization';
import { useRealtimeTracking } from '@/composables/useRealtimeTracking';
import { useTrackPlayback } from '@/composables/useTrackPlayback';
import { useMapStore } from '@/stores/map';
import type { LayerRecord } from '@/types/gis';

export function useTrackingWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
  addLayer: (layer: LayerRecord, zoomToLayer?: boolean) => void;
}) {
  const mapStore = useMapStore();

  const realtime = useRealtimeTracking({
    mapStore,
    mapView: options.mapFacade,
    addLayer: options.addLayer,
  });

  const playback = useTrackPlayback({
    mapStore,
    mapView: options.mapFacade,
  });

  const visualization = usePointVisualization({
    mapStore,
    mapView: options.mapFacade,
  });

  function stopAllTracking() {
    realtime.stop();
    playback.clear();
  }

  return {
    realtime,
    playback,
    visualization,
    stopAllTracking,
  };
}
