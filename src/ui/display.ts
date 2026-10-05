const fieldLabels: Record<string, string> = {
  name: '名称', category: '分类', district: '区域', status: '状态', priority: '优先级', capacity: '容量',
  id: '标识', trackId: '轨迹标识', deviceId: '设备标识', vehicleId: '车辆标识',
  timestamp: '时间', time: '时间', longitude: '经度', latitude: '纬度', lon: '经度', lat: '纬度', lng: '经度',
  sequence: '序号', speed: '速度', type: '类型', address: '地址', description: '描述',
  realtimeRole: '实时类型', sourceType: '数据来源',
};

const valueLabels: Record<string, string> = {
  Point: '点', MultiPoint: '多点', LineString: '线', MultiLineString: '多线', Polygon: '面', MultiPolygon: '多面',
  active: '已启用', planned: '规划中', hospital: '医院', school: '学校', park: '公园', station: '场站', market: '市场', route: '路线', 'response-zone': '应急响应区',
  position: '实时位置', trail: '运动轨迹',
};

export function formatFieldLabel(value: string) { return fieldLabels[value] ?? value; }
export function formatDisplayValue(value: unknown) {
  const text = value == null || value === '' ? '—' : String(value);
  return valueLabels[text] ?? text;
}
export function formatGeometryType(value: string) { return valueLabels[value] ?? value; }
