import type { Component } from 'vue';
import type { ToolId } from '@/tools/types';
import { toolTitles } from './toolMeta';
import LayersTool from '@/tools/components/LayersTool.vue';
import RealtimeTool from '@/tools/components/RealtimeTool.vue';
import VisualizationTool from '@/tools/components/VisualizationTool.vue';
import CoordinateTool from '@/tools/components/CoordinateTool.vue';
import PlaybackTool from '@/tools/components/PlaybackTool.vue';
import DrawingTool from '@/tools/components/DrawingTool.vue';
import QueryTool from '@/tools/components/QueryTool.vue';
import VectorStyleTool from '@/tools/components/VectorStyleTool.vue';
import CategoryStyleTool from '@/tools/components/CategoryStyleTool.vue';
import LegendTool from '@/tools/components/LegendTool.vue';
import TimeFieldTool from '@/tools/components/TimeFieldTool.vue';
import TimelineTool from '@/tools/components/TimelineTool.vue';
import FeatureTool from '@/tools/components/FeatureTool.vue';

export interface ToolDefinition {
  id: ToolId;
  title: string;
  component: Component;
}

export { toolTitles };

export const toolRegistry: Record<ToolId, ToolDefinition> = {
  layers: { id: 'layers', title: toolTitles.layers, component: LayersTool },
  realtime: { id: 'realtime', title: toolTitles.realtime, component: RealtimeTool },
  visualization: { id: 'visualization', title: toolTitles.visualization, component: VisualizationTool },
  coordinate: { id: 'coordinate', title: toolTitles.coordinate, component: CoordinateTool },
  playback: { id: 'playback', title: toolTitles.playback, component: PlaybackTool },
  drawing: { id: 'drawing', title: toolTitles.drawing, component: DrawingTool },
  query: { id: 'query', title: toolTitles.query, component: QueryTool },
  vectorStyle: { id: 'vectorStyle', title: toolTitles.vectorStyle, component: VectorStyleTool },
  categoryStyle: { id: 'categoryStyle', title: toolTitles.categoryStyle, component: CategoryStyleTool },
  legend: { id: 'legend', title: toolTitles.legend, component: LegendTool },
  timeField: { id: 'timeField', title: toolTitles.timeField, component: TimeFieldTool },
  timeline: { id: 'timeline', title: toolTitles.timeline, component: TimelineTool },
  feature: { id: 'feature', title: toolTitles.feature, component: FeatureTool },
};

export function getToolDefinition(id: ToolId): ToolDefinition {
  return toolRegistry[id];
}
