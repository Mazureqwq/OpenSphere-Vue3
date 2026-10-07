import type { ToolId } from '../tools/toolMeta.ts';

export type WorkbenchSection = 'content' | 'data' | 'edit' | 'analysis' | 'time' | 'monitor';
export type ContentTab = 'layers' | 'data' | 'areas' | 'filters' | 'places';
export type BottomDrawerTab = 'timeline' | 'playback' | 'realtime' | 'results';
export type InspectorTarget = 'layer' | 'feature' | 'tool' | undefined;
export type WorkbenchToolHost = 'content' | 'inspector' | 'bottomDrawer';

export interface WorkbenchSectionDefinition {
  id: WorkbenchSection;
  label: string;
  shortLabel: string;
  defaultTool: ToolId;
  contentTab?: ContentTab;
}

export interface WorkbenchSectionRoute {
  section: WorkbenchSection;
  tool: ToolId;
  host: WorkbenchToolHost;
  contentTab: ContentTab | undefined;
  bottomDrawerTab: BottomDrawerTab | undefined;
}

export const workbenchSections: readonly WorkbenchSectionDefinition[] = [
  { id: 'content', label: '内容', shortLabel: '内容', defaultTool: 'layers', contentTab: 'layers' },
  { id: 'data', label: '数据', shortLabel: '数据', defaultTool: 'layers', contentTab: 'data' },
  { id: 'edit', label: '编辑', shortLabel: '编辑', defaultTool: 'drawing' },
  { id: 'analysis', label: '分析', shortLabel: '分析', defaultTool: 'query' },
  { id: 'time', label: '时间', shortLabel: '时间', defaultTool: 'timeline' },
  { id: 'monitor', label: '监测', shortLabel: '监测', defaultTool: 'realtime' },
] as const satisfies readonly WorkbenchSectionDefinition[];

const sectionByTool = {
  layers: 'content',
  legend: 'content',
  feature: 'content',
  drawing: 'edit',
  vectorStyle: 'edit',
  categoryStyle: 'edit',
  query: 'analysis',
  visualization: 'analysis',
  coordinate: 'analysis',
  timeField: 'time',
  timeline: 'time',
  playback: 'time',
  realtime: 'monitor',
} as const satisfies Record<ToolId, Exclude<WorkbenchSection, 'data'>>;

const hostByTool = {
  layers: 'content',
  legend: 'inspector',
  feature: 'inspector',
  drawing: 'content',
  vectorStyle: 'inspector',
  categoryStyle: 'inspector',
  query: 'content',
  visualization: 'content',
  coordinate: 'content',
  timeField: 'inspector',
  timeline: 'bottomDrawer',
  playback: 'bottomDrawer',
  realtime: 'bottomDrawer',
} as const satisfies Record<ToolId, WorkbenchToolHost>;

const bottomDrawerTabByTool: Partial<Record<ToolId, BottomDrawerTab>> = {
  timeline: 'timeline',
  playback: 'playback',
  realtime: 'realtime',
} as const satisfies Partial<Record<ToolId, BottomDrawerTab>>;

export function getDefaultTool(section: WorkbenchSection): ToolId {
  const definition = workbenchSections.find((item) => item.id === section);
  if (!definition) throw new Error(`Unknown workbench section: ${section}`);
  return definition.defaultTool;
}

export function getSectionForTool(tool: ToolId): Exclude<WorkbenchSection, 'data'> {
  return sectionByTool[tool];
}

export function getContentTabForSection(section: WorkbenchSection): ContentTab | undefined {
  return workbenchSections.find((item) => item.id === section)?.contentTab;
}

export function getToolHost(tool: ToolId): WorkbenchToolHost {
  return hostByTool[tool];
}

export function getBottomDrawerTabForTool(tool: ToolId): BottomDrawerTab | undefined {
  return bottomDrawerTabByTool[tool];
}

export function isInspectorTool(tool: ToolId): boolean {
  return getToolHost(tool) === 'inspector';
}

export function getSectionRoute(section: WorkbenchSection): WorkbenchSectionRoute {
  const tool = getDefaultTool(section);
  return {
    section,
    tool,
    host: getToolHost(tool),
    contentTab: getContentTabForSection(section),
    bottomDrawerTab: getBottomDrawerTabForTool(tool),
  };
}
