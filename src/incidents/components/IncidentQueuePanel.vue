<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSelectionStore } from '@/stores/selection';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';
import { filterAndSortIncidentQueue } from '../presentation/incidentQueue';
import type { Incident, IncidentSeverity, IncidentStatus } from '../domain/types';

const emit = defineEmits<{ create: []; import: [] }>();
const workspace = useIncidentWorkspaceContext();
const selection = useSelectionStore();
const statusFilter = ref<IncidentStatus>();
const severityFilter = ref<IncidentSeverity>();

const statusOptions: Array<{ value: IncidentStatus; label: string }> = [
  { value: 'unassigned', label: '待分派' },
  { value: 'assigned', label: '已分派' },
  { value: 'in_progress', label: '处置中' },
  { value: 'pending_review', label: '待审核' },
  { value: 'closed', label: '已关闭' },
  { value: 'cancelled', label: '已取消' },
];
const severityOptions: Array<{ value: IncidentSeverity; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '严重' },
];
const queue = computed(() => filterAndSortIncidentQueue(workspace.incidents.value, {
  status: statusFilter.value,
  severity: severityFilter.value,
}));
const usersById = computed(() => new Map(workspace.users.value.map((user) => [user.id, user.name])));

function statusLabel(status: IncidentStatus) { return statusOptions.find((item) => item.value === status)?.label ?? status; }
function severityLabel(severity: IncidentSeverity) { return severityOptions.find((item) => item.value === severity)?.label ?? severity; }
function assignee(incident: Incident) { return incident.assignedTo ? usersById.value.get(incident.assignedTo) ?? incident.assignedTo : '未分派'; }
function updatedAt(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function selectIncident(incident: Incident) {
  workspace.focusIncident(incident.id);
  selection.select({ kind: 'incident', incidentId: incident.id });
}
</script>

<template>
  <section class="incident-queue" aria-label="事件队列">
    <div class="incident-toolbar">
      <div class="incident-toolbar__filters">
        <el-select v-model="statusFilter" clearable size="small" placeholder="全部状态" aria-label="按状态筛选">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="severityFilter" clearable size="small" placeholder="全部等级" aria-label="按严重等级筛选">
          <el-option v-for="option in severityOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </div>
      <span class="incident-toolbar__count">{{ queue.length }} 条</span>
    </div>

    <p v-if="workspace.error.value" class="incident-inline-error" role="alert">{{ workspace.error.value }}</p>
    <div v-if="!workspace.ready.value" class="incident-empty-state">正在准备本地事件数据…</div>
    <div v-else-if="!queue.length" class="incident-empty-state">没有匹配的事件。调整筛选条件，或新建一条事件。</div>
    <div v-else class="incident-queue__list" role="list">
      <button
        v-for="incident in queue"
        :key="incident.id"
        type="button"
        class="incident-queue__item"
        :class="{ 'is-selected': workspace.selectedIncidentId.value === incident.id }"
        role="listitem"
        @click="selectIncident(incident)"
      >
        <span class="incident-queue__title-row">
          <strong>{{ incident.title }}</strong>
          <span class="incident-severity" :class="`is-${incident.severity}`">{{ severityLabel(incident.severity) }}</span>
        </span>
        <span class="incident-queue__meta">
          <span>{{ incident.code }}</span><span>{{ statusLabel(incident.status) }}</span><span>{{ assignee(incident) }}</span>
        </span>
        <span class="incident-queue__updated">更新于 {{ updatedAt(incident.updatedAt) }}</span>
      </button>
    </div>

    <footer class="incident-queue__footer">
      <button type="button" class="incident-link-button" @click="emit('create')">新建事件</button>
      <button type="button" class="incident-link-button" @click="emit('import')">导入事件文件</button>
    </footer>
  </section>
</template>