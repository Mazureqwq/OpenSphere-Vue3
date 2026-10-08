<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { mapFacadeKey } from '@/map/facade';
import { canIncidentAction } from '../domain/permissions';
import { submitIncidentDraft } from '../presentation/incidentFormModel';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';
import { useIncidentCreateDraft } from '../presentation/useIncidentCreateDraft';
import { useIncidentGeometryCaptureTask } from '../presentation/useIncidentGeometryCaptureTask';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [incidentId: string] }>();
const workspace = useIncidentWorkspaceContext();
const mapFacade = inject(mapFacadeKey, undefined);
const { draft, clearGeometry, resetAfterCreated } = useIncidentCreateDraft();
const task = useIncidentGeometryCaptureTask();
const saving = ref(false);
const localError = ref<string>();

const canCreate = computed(() => canIncidentAction(workspace.currentRole.value, 'create'));
const activeCategories = computed(() => workspace.categories.value.filter((category) => category.active));
const geometryLabel = computed(() => draft.geometry?.type === 'Polygon' ? '已圈定影响范围' : draft.geometry ? '已标注地点' : '尚未标注事件位置');
const geometryActionLabel = computed(() => draft.geometry ? '调整标注' : '在地图上标注');

function focusGeometryTrigger(): void {
  void nextTick(() => document.querySelector<HTMLButtonElement>('[data-incident-geometry-trigger]')?.focus());
}

function close() {
  if (task.active.value) return;
  emit('update:modelValue', false);
}

function beginGeometryTask() {
  const facade = mapFacade?.value;
  if (!facade) {
    localError.value = '地图尚未就绪，暂时不能标注事件位置。';
    return;
  }
  localError.value = undefined;
  task.begin(facade);
}

function removeGeometry() {
  clearGeometry();
  localError.value = undefined;
  focusGeometryTrigger();
}

async function submit() {
  if (!canCreate.value) {
    localError.value = '当前演示角色没有新建事件权限。';
    return;
  }
  saving.value = true;
  localError.value = undefined;
  try {
    const assignedTo = draft.assignedTo;
    const incident = await submitIncidentDraft({
      title: draft.title,
      categoryId: draft.categoryId,
      severity: draft.severity,
      description: draft.description,
      geometry: draft.geometry,
    }, workspace.create);
    if (!incident) {
      localError.value = '请先在地图上标注事件位置。';
      return;
    }
    if (assignedTo) await workspace.assign(incident.id, assignedTo);
    emit('created', incident.id);
    ElMessage.success('事件已创建');
    resetAfterCreated();
    emit('update:modelValue', false);
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '创建事件失败，请稍后重试。';
  } finally {
    saving.value = false;
  }
}

watch(() => props.modelValue, (visible) => {
  if (visible && !task.active.value) focusGeometryTrigger();
});
watch(task.returnFocusToken, focusGeometryTrigger);
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="新建事件"
    width="min(620px, calc(100vw - 32px))"
    align-center
    append-to-body
    destroy-on-close
    :modal="false"
    :lock-scroll="false"
    :close-on-click-modal="false"
    @close="close"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <div class="incident-form-grid">
        <el-form-item label="事件标题" required><el-input v-model="draft.title" maxlength="100" show-word-limit placeholder="例如：道路积水" /></el-form-item>
        <el-form-item label="事件分类" required>
          <el-select v-model="draft.categoryId"><el-option v-for="category in activeCategories" :key="category.id" :label="category.name" :value="category.id" /></el-select>
        </el-form-item>
        <el-form-item label="严重等级" required>
          <el-select v-model="draft.severity"><el-option label="低" value="low" /><el-option label="中" value="medium" /><el-option label="高" value="high" /><el-option label="严重" value="critical" /></el-select>
        </el-form-item>
        <el-form-item label="分派给"><el-select v-model="draft.assignedTo" clearable placeholder="暂不分派"><el-option v-for="user in workspace.users.value" :key="user.id" :label="`${user.name} · ${user.role}`" :value="user.id" /></el-select></el-form-item>
      </div>
      <el-form-item label="处置说明"><el-input v-model="draft.description" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="补充现场情况、影响范围或处置要求" /></el-form-item>
      <el-form-item label="事件位置" required>
        <div class="incident-geometry-actions">
          <div class="incident-geometry-actions__copy"><strong>{{ geometryLabel }}</strong><span>仅保存本事件的 EPSG:4326 GeoJSON 标注，不会创建普通 GIS 图层。</span></div>
          <div>
            <el-button data-incident-geometry-trigger size="small" type="primary" @click="beginGeometryTask">{{ geometryActionLabel }}</el-button>
            <el-button v-if="draft.geometry" size="small" text @click="removeGeometry">清除</el-button>
          </div>
        </div>
      </el-form-item>
      <p v-if="localError" class="incident-inline-error" role="alert">{{ localError }}</p>
    </el-form>
    <template #footer><el-button @click="close">关闭</el-button><el-button type="primary" :loading="saving" :disabled="!canCreate" @click="submit">创建事件</el-button></template>
  </el-dialog>
</template>
