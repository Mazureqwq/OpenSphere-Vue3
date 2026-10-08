import { canIncidentAction } from '../domain/permissions.ts';
import type { DemoRole, Incident, IncidentAction } from '../domain/types.ts';

/**
 * The inspector only presents workflow commands. Creation/import and reference-data
 * management remain in their dedicated workspaces, while every item below is still
 * checked again by the application service.
 */
export const inspectorWorkflowActions = [
  'view',
  'assign',
  'start',
  'update',
  'submit_review',
  'approve',
  'return',
  'cancel',
] as const satisfies readonly IncidentAction[];

export type IncidentInspectorAction = (typeof inspectorWorkflowActions)[number];

export const incidentActionLabels: Record<IncidentInspectorAction, string> = {
  view: '查看事件',
  assign: '分派 / 改派',
  start: '开始处置',
  update: '记录处置更新',
  submit_review: '提交审核',
  approve: '通过并关闭',
  return: '退回处置',
  cancel: '撤销事件',
};

export function getVisibleIncidentActions(role: DemoRole, incident: Incident): IncidentInspectorAction[] {
  return inspectorWorkflowActions.filter((action) => canIncidentAction(role, action, incident));
}