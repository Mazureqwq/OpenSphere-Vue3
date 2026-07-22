import type {FeatureQueryConfig} from '@/types/gis';

export interface SavedArea {id: string; name: string; extent: [number, number, number, number]; savedAt: string;}
export interface SavedFilter {id: string; name: string; query: FeatureQueryConfig; savedAt: string;}
export interface SavedPlace {id: string; name: string; coordinate: [number, number]; folder?: string; savedAt: string;}
export interface WorkspaceLibrary {areas: SavedArea[]; filters: SavedFilter[]; places: SavedPlace[]; folders: string[];}

const storageKey = 'opensphere-vue3-library-v1';
const emptyLibrary = (): WorkspaceLibrary => ({areas: [], filters: [], places: [], folders: []});

export function loadWorkspaceLibrary(): WorkspaceLibrary {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<WorkspaceLibrary>;
    return {
      areas: Array.isArray(stored.areas) ? stored.areas.filter(isArea) : [],
      filters: Array.isArray(stored.filters) ? stored.filters.filter(isFilter) : [],
      places: Array.isArray(stored.places) ? stored.places.filter(isPlace) : [],
      folders: Array.isArray(stored.folders) ? stored.folders.filter((folder): folder is string => typeof folder === 'string' && Boolean(folder.trim())) : [],
    };
  } catch { return emptyLibrary(); }
}

export function saveWorkspaceLibrary(library: WorkspaceLibrary) { localStorage.setItem(storageKey, JSON.stringify(library)); }

function isExtent(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}
function isArea(value: unknown): value is SavedArea {
  const item = value as Partial<SavedArea>;
  return Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && isExtent(item.extent));
}
function isFilter(value: unknown): value is SavedFilter {
  const item = value as Partial<SavedFilter>;
  return Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && item.query && typeof item.query.layerId === 'string' && typeof item.query.field === 'string' && typeof item.query.value === 'string');
}
function isPlace(value: unknown): value is SavedPlace {
  const item = value as Partial<SavedPlace>;
  return Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.coordinate) && item.coordinate.length === 2 && item.coordinate.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)));
}
