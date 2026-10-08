import Feature from 'ol/Feature.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';
import { withOpacity } from '../../map/styleColor.ts';
import type { StyleFunction } from 'ol/style/Style.js';
import type { LayerRecord } from '../../types/gis.ts';
import type { Incident, IncidentSeverity, IncidentStatus } from '../domain/types.ts';

export const INCIDENT_SYSTEM_LAYER_ID = '__incidents__';

const severityColors: Record<IncidentSeverity, string> = {
  low: '#4f9cff',
  medium: '#e6b85c',
  high: '#f28b54',
  critical: '#e05263',
};

const severityRadius: Record<IncidentSeverity, number> = {
  low: 6,
  medium: 7,
  high: 8,
  critical: 10,
};

const statusStroke: Record<IncidentStatus, string> = {
  unassigned: '#f8fafc',
  assigned: '#cbd5e1',
  in_progress: '#2dd4bf',
  pending_review: '#a78bfa',
  closed: '#64748b',
  cancelled: '#94a3b8',
};

const recordStyle = {
  pointColor: severityColors.medium,
  pointRadius: 7,
  strokeColor: '#f8fafc',
  strokeWidth: 2,
  lineDash: 'solid' as const,
  fillColor: '#e6b85c',
  fillOpacity: 0.38,
};

const geoJson = new GeoJSON();

function featureForIncident(incident: Incident): Feature<Geometry> {
  const geometry = geoJson.readGeometry(incident.geometry, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
  });
  const feature = new Feature<Geometry>({ geometry });
  feature.setId(incident.id);
  feature.setProperties({
    incidentId: incident.id,
    code: incident.code,
    title: incident.title,
    categoryId: incident.categoryId,
    severity: incident.severity,
    status: incident.status,
    assignedTo: incident.assignedTo ?? '',
    updatedAt: incident.updatedAt,
  });
  return feature;
}

const styleForIncident: StyleFunction = (feature): Style => {
  const incidentFeature = feature as unknown as Feature<Geometry>;
  const severity = String(incidentFeature.get('severity')) as IncidentSeverity;
  const status = String(incidentFeature.get('status')) as IncidentStatus;
  return new Style({
    image: new CircleStyle({
      radius: severityRadius[severity] ?? recordStyle.pointRadius,
      fill: new Fill({ color: severityColors[severity] ?? recordStyle.pointColor }),
      stroke: new Stroke({ color: statusStroke[status] ?? recordStyle.strokeColor, width: recordStyle.strokeWidth }),
    }),
    stroke: new Stroke({ color: severityColors[severity] ?? recordStyle.strokeColor, width: 2 }),
    fill: new Fill({ color: withOpacity(severityColors[severity] ?? recordStyle.fillColor, recordStyle.fillOpacity) }),
  });
};

export function createIncidentSystemLayer(incidents: Incident[]): LayerRecord {
  const features = incidents.map(featureForIncident);
  const source = new VectorSource({ features });
  const layer = new VectorLayer({
    source,
    style: styleForIncident,
    properties: { id: INCIDENT_SYSTEM_LAYER_ID },
  });
  layer.setVisible(true);
  layer.setOpacity(1);
  return {
    id: INCIDENT_SYSTEM_LAYER_ID,
    name: '事件',
    kind: 'vector',
    system: 'incidents',
    visible: true,
    opacity: 1,
    source: layer,
    featureCount: features.length,
    vectorStyle: recordStyle,
    categoryStyle: {
      field: 'severity',
      colors: severityColors,
      fallbackColor: severityColors.medium,
    },
  };
}

export function replaceIncidentSystemLayer(layers: LayerRecord[], incidents: Incident[]): LayerRecord[] {
  return [...layers.filter((layer) => layer.system !== 'incidents'), createIncidentSystemLayer(incidents)];
}


export interface IncidentSystemProjectionHost {
  readonly layers: LayerRecord[];
  addSystemLayer(layer: LayerRecord): void;
  removeSystemLayer(id: string): void;
}

export interface IncidentProjectionFacade {
  addLayer(layer: LayerRecord): void;
  removeLayer(id: string): void;
}

export function syncIncidentSystemProjection(
  host: IncidentSystemProjectionHost,
  incidents: Incident[],
  facade?: IncidentProjectionFacade,
): LayerRecord {
  const previous = host.layers.find((layer) => layer.id === INCIDENT_SYSTEM_LAYER_ID);
  if (previous) {
    facade?.removeLayer(previous.id);
    host.removeSystemLayer(previous.id);
  }
  const projection = createIncidentSystemLayer(incidents);
  host.addSystemLayer(projection);
  facade?.addLayer(projection);
  return projection;
}
