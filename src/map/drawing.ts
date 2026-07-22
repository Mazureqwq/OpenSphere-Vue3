import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {createVectorStyle, defaultVectorStyle} from '@/map/styles';
import type {LayerRecord} from '@/types/gis';

export type DrawMode = 'Point' | 'LineString' | 'Polygon' | 'modify';

export function createDrawingLayer(): LayerRecord {
  const id = `drawing-${Date.now()}`;
  const vectorStyle = {...defaultVectorStyle, pointColor: '#f97316', strokeColor: '#fb923c', fillColor: '#fb923c'};
  const layer = new VectorLayer({source: new VectorSource(), style: createVectorStyle(vectorStyle), properties: {id}});
  return {id, name: '绘制图层', kind: 'vector', visible: true, opacity: 1, source: layer, featureCount: 0, vectorStyle, drawing: true};
}
