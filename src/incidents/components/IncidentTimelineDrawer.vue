<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IncidentAction, IncidentTimelineEntry } from '../domain/types';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';

const workspace = useIncidentWorkspaceContext();
const entries = ref<IncidentTimelineEntry[]>([]);
const loading = ref(false);
const error = ref<string>();
let requestId = 0;
const usersById = computed(() => new Map(workspace.users.value.map((user) => [user.id, user.name])));
const actionLabels: Record<IncidentTimelineEntry['action'], string> = {
  created: '创建事件', imported: '批量导入', view: '查看事件', create: '新建事件', import: '导入事件', assign: '分派事件', start: '开始处置', update: '更新处置', submit_review: '提交审核', approve: '通过审核', return: '退回处置', cancel: '撤销事件', manage_members: '管理成员', manage_categories: '管理分类', export_summary: '导出摘要', revoke_import_batch: '撤销导入批次',
};

function formatAt(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function actor(entry: IncidentTimelineEntry) { return usersById.value.get(entry.actorId) ?? entry.actorId; }
function actionLabel(action: IncidentTimelineEntry['action']) { return actionLabels[action] ?? (action as IncidentAction); }

async function loadTimeline(incidentId?: string) {
  const currentRequest = ++requestId;
  entries.value = [];
  error.value = undefined;
  if (!incidentId) return;
  loading.value = true;
  try {
    const result = await workspace.getTimeline(incidentId);
    if (currentRequest === requestId) entries.value = result.slice().sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  } catch (cause) {
    if (currentRequest === requestId) error.value = cause instanceof Error ? cause.message : '无法读取事件时间线。';
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

watch(() => workspace.selectedIncidentId.value, loadTimeline, { immediate: true });
</script>

<template>
  <section class="incident-timeline" aria-label="事件记录">
    <div v-if="!workspace.selectedIncident.value" class="incident-timeline__empty">选择一条事件后，在这里查看本地处置记录。</div>
    <template v-else>
      <div class="incident-timeline__context"><strong>{{ workspace.selectedIncident.value.title }}</strong><span>{{ workspace.selectedIncident.value.code }} · 本地时间线</span></div>
      <p v-if="error" class="incident-timeline__error" role="alert">{{ error }}</p>
      <div v-else-if="loading" class="incident-timeline__empty">正在读取事件记录…</div>
      <div v-else-if="!entries.length" class="incident-timeline__empty">这条事件尚无可显示的处置记录。</div>
      <ol v-else class="incident-timeline__list">
        <li v-for="entry in entries" :key="entry.id"><span class="incident-timeline__marker" aria-hidden="true"></span><div><strong>{{ actionLabel(entry.action) }}</strong><p>{{ actor(entry) }} · {{ formatAt(entry.at) }}</p><p v-if="entry.note">{{ entry.note }}</p><p v-if="entry.reason" class="is-reason">原因：{{ entry.reason }}</p><p v-if="entry.assignedTo">分派至：{{ usersById.get(entry.assignedTo) ?? entry.assignedTo }}</p><p v-if="entry.fromStatus || entry.toStatus" class="incident-timeline__state">{{ entry.fromStatus ?? '—' }} → {{ entry.toStatus ?? '—' }}</p></div></li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.incident-timeline { min-height: 0; height: 100%; overflow: auto; padding: 12px 16px 18px; }.incident-timeline__context { display: grid; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid var(--os-border-subtle); }.incident-timeline__context strong { color: var(--os-text-primary); font-size: 13px; }.incident-timeline__context span { color: var(--os-text-muted); font-size: 10px; }.incident-timeline__empty { padding: 28px 8px; color: var(--os-text-muted); font-size: 12px; text-align: center; }.incident-timeline__error { color: #ffadb6; font-size: 12px; }.incident-timeline__list { display: grid; gap: 0; margin: 14px 0 0; padding: 0; list-style: none; }.incident-timeline__list li { position: relative; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; padding: 0 0 14px; }.incident-timeline__list li::before { position: absolute; top: 14px; bottom: -3px; left: 5px; width: 1px; background: var(--os-border-strong); content: ''; }.incident-timeline__list li:last-child::before { display: none; }.incident-timeline__marker { z-index: 1; width: 11px; height: 11px; margin-top: 3px; border: 2px solid var(--os-accent); border-radius: 50%; background: var(--os-bg-surface); }.incident-timeline__list div { min-width: 0; }.incident-timeline__list strong { color: var(--os-text-primary); font-size: 12px; }.incident-timeline__list p { margin: 4px 0 0; color: var(--os-text-secondary); font-size: 11px; line-height: 1.5; }.incident-timeline__list p:first-of-type, .incident-timeline__state { color: var(--os-text-muted) !important; }.incident-timeline__list .is-reason { color: #ffc39d; }
</style>