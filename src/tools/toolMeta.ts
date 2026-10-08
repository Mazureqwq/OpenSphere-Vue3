export const toolIds = [
  'layers',
  'incidents',
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
] as const;

export type ToolId = (typeof toolIds)[number];

export const toolTitles: Record<ToolId, string> = {
  layers: '图层',
  incidents: '事件',
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