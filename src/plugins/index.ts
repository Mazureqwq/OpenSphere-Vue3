export interface OpenSpherePlugin { readonly id: string; readonly name: string; install(): void; }
const installedPlugins: OpenSpherePlugin[] = [];
export function registerPlugin(plugin: OpenSpherePlugin) { if (!installedPlugins.some((item) => item.id === plugin.id)) { plugin.install(); installedPlugins.push(plugin); } }
export function getInstalledPlugins() { return [...installedPlugins]; }
const builtIns: OpenSpherePlugin[] = [
  {id: 'base-map', name: '底图切换', install: () => undefined},
  {id: 'geojson', name: 'GeoJSON 导入', install: () => undefined},
  {id: 'csv', name: 'CSV 点数据导入', install: () => undefined},
  {id: 'layer-tools', name: '图层管理', install: () => undefined},
  {id: 'timeline', name: '时序控制', install: () => undefined},
];
export function registerBuiltInPlugins() { builtIns.forEach(registerPlugin); }
