<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { incidentActionLabels, getVisibleIncidentActions, type IncidentInspectorAction } from '../presentation/incidentActionModel';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';
import { useWorkspaceContext } from '@/tools/workspaceContext';
import type { IncidentSeverity, IncidentStatus } from '../domain/types';

const workspace = useIncidentWorkspaceContext();
const workbench = useWorkspaceContext();
const actionInput = ref('');
const assigneeId = ref('');
const busyAction = ref<IncidentInspectorAction>();
const localError = ref<string>();
const incident = computed(() => workspace.selectedIncident.value);
const visibleActions = computed(() => incident.value ? getVisibleIncidentActions(workspace.currentRole.value, incident.value) : []);
const usersById = computed(() => new Map(workspace.users.value.map((user) => [user.id, user.name])));
const categoriesById = computed(() => new Map(workspace.categories.value.map((category) => [category.id, category.name])));
const statusLabels: Record<IncidentStatus, string> = { unassigned: '待分派', assigned: '已分派', in_progress: '处置中', pending_review: '待审核', closed: '已关闭', cancelled: '已撤销' };
const severityLabels: Record<IncidentSeverity, string> = { low: '低', medium: '中', high: '高', critical: '严重' };
const supportsActionInput = computed(() => ['update', 'submit_review', 'approve', 'return', 'cancel'].some((action) => visibleActions.value.includes(action as IncidentInspectorAction)));
const actionInputHint = computed(() => {
  if (visibleActions.value.includes('return')) return '填写退回原因；退回操作需要明确原因';
  if (visibleActions.value.includes('cancel')) return '填写处置记录、审核说明或撤销原因';
  return '填写处置记录或审核说明';
});

function statusLabel(status: IncidentStatus) { return statusLabels[status]; }
function severityLabel(severity: IncidentSeverity) { return severityLabels[severity]; }
function hasAction(action: IncidentInspectorAction) { return visibleActions.value.includes(action); }
function formatAt(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function clearMessage() { localError.value = undefined; }
function requireText(message: string): string | undefined {
  const value = actionInput.value.trim();
  if (!value) localError.value = message;
  return value || undefined;
}

async function run(action: IncidentInspectorAction) {
  const target = incident.value;
  if (!target || action === 'view' || !hasAction(action)) return;
  clearMessage();
  busyAction.value = action;
  try {
    switch (action) {
      case 'assign':
        if (!assigneeId.value) { localError.value = '请选择分派对象。'; return; }
        await workspace.assign(target.id, assigneeId.value);
        break;
      case 'start':
        await workspace.start(target.id);
        break;
      case 'update': {
        const note = requireText('请填写处置更新。');
        if (!note) return;
        await workspace.update(target.id, note);
        break;
      }
      case 'submit_review':
        await workspace.submitForReview(target.id, actionInput.value.trim() || '提交审核');
        break;
      case 'approve':
        await workspace.approve(target.id, actionInput.value.trim() || undefined);
        break;
      case 'return': {
        const reason = requireText('退回处置需要填写原因。');
        if (!reason) return;
        await workspace.returnForRework(target.id, reason);
        break;
      }
      case 'cancel': {
        const reason = requireText('撤销事件需要填写原因。');
        if (!reason) return;
        await workspace.cancel(target.id, reason);
        break;
      }
      default:
        return;
    }
    actionInput.value = '';
    ElMessage.success(`${incidentActionLabels[action]}已完成`);
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '无法完成此事件操作。';
  } finally {
    busyAction.value = undefined;
  }
}

function openTimeline() { workbench.openBottomDrawer('incidentTimeline'); }

watch(incident, (next) => {
  assigneeId.value = next?.assignedTo ?? '';
  actionInput.value = '';
  localError.value = undefined;
}, { immediate: true });
</script>

<template>
  <section class="incident-inspector" aria-label="事件详情">
    <div v-if="!incident" class="incident-inspector__empty">请选择地图上的事件或事件队列中的一条记录。</div>
    <template v-else>
      <header class="incident-inspector__identity">
        <div><p>{{ incident.code }}</p><h3>{{ incident.title }}</h3></div>
        <span class="incident-inspector__severity" :class="`is-${incident.severity}`">{{ severityLabel(incident.severity) }}</span>
      </header>
      <div class="incident-inspector__status"><span>状态</span><strong>{{ statusLabel(incident.status) }}</strong><time>更新于 {{ formatAt(incident.updatedAt) }}</time></div>
      <dl class="incident-inspector__facts"><div><dt>分类</dt><dd>{{ categoriesById.get(incident.categoryId) ?? incident.categoryId }}</dd></div><div><dt>分派对象</dt><dd>{{ incident.assignedTo ? usersById.get(incident.assignedTo) ?? incident.assignedTo : '未分派' }}</dd></div><div><dt>创建时间</dt><dd>{{ formatAt(incident.createdAt) }}</dd></div></dl>
      <section class="incident-inspector__section"><h4>处置说明</h4><p>{{ incident.description || '暂无处置说明。' }}</p></section>
      <section v-if="hasAction('assign')" class="incident-inspector__section"><h4>分派 / 改派</h4><div class="incident-inspector__assignment"><el-select v-model="assigneeId" size="small" placeholder="选择处置对象"><el-option v-for="user in workspace.users.value" :key="user.id" :label="`${user.name} · ${user.role}`" :value="user.id" /></el-select><el-button size="small" :loading="busyAction === 'assign'" @click="run('assign')">{{ incident.assignedTo ? '改派' : '确认分派' }}</el-button></div></section>
      <section v-if="supportsActionInput" class="incident-inspector__section"><h4>处置 / 审核说明</h4><el-input v-model="actionInput" type="textarea" :rows="3" maxlength="500" show-word-limit :placeholder="actionInputHint" /></section>
      <p v-if="localError" class="incident-inspector__error" role="alert">{{ localError }}</p>
      <section class="incident-inspector__section incident-inspector__workflow"><h4>允许的操作</h4><div class="incident-inspector__actions"><el-button v-if="hasAction('start')" size="small" type="primary" :loading="busyAction === 'start'" @click="run('start')">{{ incidentActionLabels.start }}</el-button><el-button v-if="hasAction('update')" size="small" :loading="busyAction === 'update'" @click="run('update')">{{ incidentActionLabels.update }}</el-button><el-button v-if="hasAction('submit_review')" size="small" type="primary" :loading="busyAction === 'submit_review'" @click="run('submit_review')">{{ incidentActionLabels.submit_review }}</el-button><el-button v-if="hasAction('approve')" size="small" type="success" :loading="busyAction === 'approve'" @click="run('approve')">{{ incidentActionLabels.approve }}</el-button><el-button v-if="hasAction('return')" size="small" :loading="busyAction === 'return'" @click="run('return')">{{ incidentActionLabels.return }}</el-button><el-button v-if="hasAction('cancel')" size="small" type="danger" plain :loading="busyAction === 'cancel'" @click="run('cancel')">{{ incidentActionLabels.cancel }}</el-button><el-button size="small" text @click="openTimeline">查看事件记录</el-button></div></section>
      <p class="incident-inspector__permission-note">当前为本地演示角色；服务层会再次校验每项操作。</p>
    </template>
  </section>
</template>

<style scoped>
.incident-inspector { min-height: 100%; color: var(--os-text-secondary); }.incident-inspector__empty { padding: 30px 16px; color: var(--os-text-muted); font-size: 12px; line-height: 1.6; text-align: center; }.incident-inspector__identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 9px; padding: 14px 16px 12px; border-bottom: 1px solid var(--os-border-subtle); }.incident-inspector__identity p { margin: 0 0 4px; color: var(--os-text-muted); font-size: 10px; letter-spacing: .04em; }.incident-inspector__identity h3 { margin: 0; color: var(--os-text-primary); font-size: 15px; line-height: 1.4; }.incident-inspector__severity { padding: 3px 6px; border-radius: 3px; font-size: 10px; white-space: nowrap; }.incident-inspector__severity.is-low { color: #a8cdfb; background: rgb(79 156 255 / 16%); }.incident-inspector__severity.is-medium { color: #f2d28d; background: rgb(230 184 92 / 16%); }.incident-inspector__severity.is-high { color: #ffc09a; background: rgb(242 139 84 / 16%); }.incident-inspector__severity.is-critical { color: #ffabb4; background: rgb(224 82 99 / 17%); }.incident-inspector__status { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; padding: 10px 16px; border-bottom: 1px solid var(--os-border-subtle); font-size: 11px; }.incident-inspector__status span, .incident-inspector__status time { color: var(--os-text-muted); }.incident-inspector__status strong { color: var(--os-accent-strong); }.incident-inspector__status time { grid-column: 1 / -1; }.incident-inspector__facts { margin: 0; padding: 0 16px; }.incident-inspector__facts div { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--os-border-subtle); font-size: 11px; }.incident-inspector__facts dt { color: var(--os-text-muted); }.incident-inspector__facts dd { margin: 0; color: var(--os-text-secondary); text-align: right; }.incident-inspector__section { padding: 12px 16px; border-bottom: 1px solid var(--os-border-subtle); }.incident-inspector__section h4 { margin: 0 0 8px; color: var(--os-text-primary); font-size: 11px; }.incident-inspector__section > p { margin: 0; color: var(--os-text-secondary); font-size: 12px; line-height: 1.55; white-space: pre-wrap; }.incident-inspector__assignment { display: flex; gap: 7px; }.incident-inspector__assignment .el-select { min-width: 0; flex: 1; }.incident-inspector__actions { display: flex; flex-wrap: wrap; gap: 7px; }.incident-inspector__error { margin: 10px 16px 0; color: #ff9ca7; font-size: 11px; line-height: 1.5; }.incident-inspector__workflow { padding-bottom: 14px; }.incident-inspector__permission-note { margin: 0; padding: 9px 16px 14px; color: var(--os-text-muted); font-size: 10px; line-height: 1.5; }
</style>