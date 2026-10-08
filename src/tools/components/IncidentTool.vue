<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useSelectionStore } from '@/stores/selection';
import { canIncidentAction } from '@/incidents/domain/permissions';
import IncidentQueuePanel from '@/incidents/components/IncidentQueuePanel.vue';
import IncidentFormDialog from '@/incidents/components/IncidentFormDialog.vue';
import IncidentMapCaptureTask from '@/incidents/components/IncidentMapCaptureTask.vue';
import IncidentImportDialog from '@/incidents/components/IncidentImportDialog.vue';
import ImportBatchPanel from '@/incidents/components/ImportBatchPanel.vue';
import { useIncidentWorkspaceContext } from '@/incidents/presentation/incidentContext';
import { useIncidentUiState } from '@/incidents/presentation/incidentUiState';
import '@/incidents/components/incident-workspace.css';

const workspace = useIncidentWorkspaceContext();
const selection = useSelectionStore();
const { createDialogVisible, importDialogVisible, openCreateDialog, openImportDialog } = useIncidentUiState();
const activeTab = ref<'queue' | 'batches'>('queue');
const resettingDemo = ref(false);
const canCreate = computed(() => canIncidentAction(workspace.currentRole.value, 'create'));
const canImport = computed(() => canIncidentAction(workspace.currentRole.value, 'import'));
const canResetDemo = computed(() => canIncidentAction(workspace.currentRole.value, 'manage_members'));

function created(incidentId: string) {
  workspace.focusIncident(incidentId);
  selection.select({ kind: 'incident', incidentId });
}
function imported() { activeTab.value = 'batches'; }
async function resetDemoData() {
  try {
    await ElMessageBox.confirm('这会仅重置当前浏览器中的事件、时间线和导入批次；普通 GIS 图层不会受影响。', '重置本地演示数据', {
      confirmButtonText: '确认重置',
      cancelButtonText: '取消',
      type: 'warning',
    });
    resettingDemo.value = true;
    await workspace.resetDemoData();
    selection.clear();
    ElMessage.success('本地事件演示数据已重置');
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return;
    ElMessage.error(cause instanceof Error ? cause.message : '无法重置本地演示数据。');
  } finally {
    resettingDemo.value = false;
  }
}
</script>

<template>
  <section class="incident-workspace" aria-label="事件工作区">
    <header class="incident-workspace__header">
      <div><p>空间事件处置</p><h3>事件</h3></div>
      <div class="incident-workspace__actions">
        <el-button v-if="canCreate" size="small" type="primary" @click="openCreateDialog">新建事件</el-button>
        <el-button v-if="canImport" size="small" @click="openImportDialog">导入事件</el-button>
        <el-button v-if="canResetDemo" size="small" text :loading="resettingDemo" @click="resetDemoData">重置本地演示</el-button>
      </div>
    </header>
    <p v-if="!canCreate && !canImport" class="incident-muted-note">当前演示角色为只读处置审核角色。</p>
    <el-tabs v-model="activeTab" class="incident-workspace__tabs" stretch>
      <el-tab-pane label="事件队列" name="queue"><IncidentQueuePanel @create="openCreateDialog" @import="openImportDialog" /></el-tab-pane>
      <el-tab-pane label="导入批次" name="batches"><ImportBatchPanel /></el-tab-pane>
    </el-tabs>
    <IncidentFormDialog v-model="createDialogVisible" @created="created" />
    <IncidentMapCaptureTask />
    <IncidentImportDialog v-model="importDialogVisible" @imported="imported" />
  </section>
</template>
