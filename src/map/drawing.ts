import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {createVectorStyle, defaultVectorStyle} from '@/map/styles';
import type {LayerRecord} from '@/types/gis';

export type DrawMode = 'Point' | 'LineString' | 'Polygon' | 'modify';

export function createVectorLayer(name: string, drawing = false): LayerRecord {
  const id = `vector-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const vectorStyle = drawing
    ? {...defaultVectorStyle, pointColor: '#f97316', strokeColor: '#fb923c', fillColor: '#fb923c'}
    : {...defaultVectorStyle};
  const layer = new VectorLayer({source: new VectorSource(), style: createVectorStyle(vectorStyle), properties: {id}});
  return {id, name, kind: 'vector', visible: true, opacity: 1, source: layer, featureCount: 0, vectorStyle, ...(drawing ? {drawing: true} : {})};
}

export function createDrawingLayer(): LayerRecord {
  return createVectorLayer('绘制图层', true);
}
