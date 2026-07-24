import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Heatmap from 'ol/layer/Heatmap';
import VectorLayer from 'ol/layer/Vector';
import ClusterSource from 'ol/source/Cluster';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style, Text} from 'ol/style';
import type Geometry from 'ol/geom/Geometry';
import type {StyleFunction} from 'ol/style/Style';
import type BaseLayer from 'ol/layer/Base';
import type {PointVisualizationConfig} from '@/types/gis';

export function getPointFeatures(features: Feature<Geometry>[]) {
  return features.filter((feature) => feature.getGeometry()?.getType() === 'Point');
}

export function createPointVisualization(features: Feature<Geometry>[], config: PointVisualizationConfig): BaseLayer {
  const points = getPointFeatures(features).map((feature) => feature.clone());
  if (config.mode === 'heatmap') {
    return new Heatmap({
      source: new VectorSource({features: points}),
      radius: config.heatRadius,
      blur: config.heatBlur,
      weight: () => 1,
      opacity: 0.9,
      properties: {visualizationMode: 'heatmap'},
    });
  }
  return new VectorLayer({
    source: new ClusterSource({distance: config.clusterDistance, source: new VectorSource({features: points})}),
    style: createClusterStyle(),
    properties: {visualizationMode: 'cluster'},
  });
}

function createClusterStyle(): StyleFunction {
  const cache = new Map<number, Style>();
  return (feature) => {
    const count = ((feature as Feature).get('features') as Feature[] | undefined)?.length ?? 0;
    if (!cache.has(count)) {
      const radius = Math.min(34, Math.max(15, 12 + Math.sqrt(Math.max(count, 1)) * 4));
      const color = count > 50 ? '#ef4444' : count > 15 ? '#f59e0b' : '#0ea5e9';
      cache.set(count, new Style({
        image: new CircleStyle({radius, fill: new Fill({color}), stroke: new Stroke({color: '#eff6ff', width: 2})}),
        text: new Text({text: String(count), fill: new Fill({color: '#ffffff'}), font: 'bold 12px sans-serif'}),
      }));
    }
    return cache.get(count)!;
  };
}

export function getClusterFeatures(feature: Feature) {
  return feature.get('features') as Feature[] | undefined;
}

export function isClusterFeature(feature: Feature) {
  return Array.isArray(feature.get('features'));
}

export function getClusterPointFeatures(feature: Feature) {
  return getClusterFeatures(feature)?.filter((item) => item.getGeometry() instanceof Point) ?? [];
}


