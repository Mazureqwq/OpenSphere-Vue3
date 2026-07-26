import type { Ref } from 'vue';
import type { MapFacade } from '@/map/facade';
import {
  importCsv,
  importGeoJson,
  importGpx,
  importKml,
  importKmz,
  importShapefile,
} from '@/map/importers';
import { useLayerActions, type LayerImportHandler } from '@/composables/useLayerActions';
import { useMapStore } from '@/stores/map';
import type { LayerRecord } from '@/types/gis';

const importers: Record<string, LayerImportHandler> = {
  csv: importCsv,
  geojson: importGeoJson,
  json: importGeoJson,
  kml: importKml,
  kmz: importKmz,
  gpx: importGpx,
  zip: importShapefile,
};

export function useLayerWorkspace(options: {
  mapFacade: Ref<MapFacade | undefined>;
  onBeforeRemove?: (layer: LayerRecord) => void;
  onEdit?: (layer: LayerRecord) => void;
}) {
  const mapStore = useMapStore();
  return useLayerActions({
    mapStore,
    mapView: options.mapFacade,
    importers,
    onBeforeRemove: options.onBeforeRemove,
    onEdit: options.onEdit,
  });
}
