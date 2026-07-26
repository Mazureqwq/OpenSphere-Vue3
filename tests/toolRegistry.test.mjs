import assert from 'node:assert/strict';
import test from 'node:test';

const toolIds = [
  'layers',
  'realtime',
  'visualization',
  'coordinate',
  'playback',
  'drawing',
  'query',
  'vectorStyle',
  'categoryStyle',
  'legend',
  'timeField',
  'timeline',
  'feature',
];

const toolTitles = {
  layers: '图层',
  realtime: '实时轨迹',
  visualization: '点位展示',
  coordinate: '坐标定位',
  playback: '轨迹回放',
  drawing: '绘制与量测',
  query: '空间属性查询',
  vectorStyle: '基础样式',
  categoryStyle: '分类样式',
  legend: '图例',
  timeField: '时间字段',
  timeline: '时间轴',
  feature: '要素信息',
};

test('tool registry covers all tool ids with titles', () => {
  for (const id of toolIds) {
    assert.equal(typeof toolTitles[id], 'string');
    assert.ok(toolTitles[id].length > 0);
  }
  assert.equal(toolIds.length, Object.keys(toolTitles).length);
});

test('map facade method names stay stable', () => {
  const methods = [
    'addLayer',
    'removeLayer',
    'clearLayers',
    'setBaseMap',
    'getViewState',
    'setViewState',
    'setDrawMode',
    'deleteSelectedDrawingFeatures',
    'startSpatialQuery',
    'focusFeature',
    'setPointVisualization',
    'clearPointVisualization',
    'syncRealtimeLayer',
    'setTrackPlayback',
    'clearTrackPlayback',
    'locateCoordinate',
    'focusCoordinate',
    'clearCoordinateLocation',
  ];
  assert.equal(methods.length, 18);
  assert.equal(new Set(methods).size, methods.length);
});
