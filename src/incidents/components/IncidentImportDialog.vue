<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { canIncidentAction } from '../domain/permissions';
import { previewIncidentImport, type IncidentImportFieldMapping, type IncidentImportPreview, type IncidentImportSource } from '../application/incidentImport';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; imported: [batchId: string] }>();
const workspace = useIncidentWorkspaceContext();
const source = ref<IncidentImportSource>();
const preview = ref<IncidentImportPreview>();
const importing = ref(false);
const localError = ref<string>();
const importErrors = ref<string[]>([]);
const mapping = reactive<IncidentImportFieldMapping>({});
const mappingFields: Array<{ key: keyof IncidentImportFieldMapping; label: string }> = [
  { key: 'title', label: '事件标题' }, { key: 'categoryId', label: '分类' }, { key: 'severity', label: '严重等级' },
  { key: 'longitude', label: '经度' }, { key: 'latitude', label: '纬度' }, { key: 'geometry', label: 'GeoJSON 几何' }, { key: 'description', label: '说明' },
];
const canImport = computed(() => canIncidentAction(workspace.currentRole.value, 'import'));

function reset() {
  source.value = undefined;
  preview.value = undefined;
  localError.value = undefined;
  importErrors.value = [];
  for (const key of Object.keys(mapping) as Array<keyof IncidentImportFieldMapping>) delete mapping[key];
}
function close() { reset(); emit('update:modelValue', false); }
function refreshPreview() {
  if (!source.value) return;
  try {
    preview.value = previewIncidentImport(source.value, { ...mapping });
    localError.value = undefined;
  } catch (error) {
    preview.value = undefined;
    localError.value = error instanceof Error ? error.message : '无法解析事件导入文件。';
  }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!/\.(csv|geojson|json)$/i.test(file.name)) {
    localError.value = '事件导入仅支持 .csv、.geojson 或 .json 文件。';
    return;
  }
  source.value = { fileName: file.name, text: await file.text() };
  const initial = previewIncidentImport(source.value);
  for (const key of Object.keys(mapping) as Array<keyof IncidentImportFieldMapping>) delete mapping[key];
  Object.assign(mapping, initial.suggestedMapping);
  preview.value = initial;
  importErrors.value = initial.errors.map((error) => `第 ${error.row || '—'} 行：${error.message}`);
}
async function submit() {
  if (!source.value || !canImport.value) {
    localError.value = canImport.value ? '请先选择事件导入文件。' : '当前演示角色没有导入权限。';
    return;
  }
  importing.value = true;
  localError.value = undefined;
  try {
    const result = await workspace.importText(source.value, { ...mapping });
    importErrors.value = result.errors.map((error) => `第 ${error.row || '—'} 行：${error.message}`);
    ElMessage.success(`已导入 ${result.incidents.length} 条事件`);
    emit('imported', result.batch.id);
    close();
  } catch (error) {
    localError.value = error instanceof Error ? error.message : '导入失败，请检查文件与字段映射。';
  } finally {
    importing.value = false;
  }
}
watch(mapping, refreshPreview, { deep: true });
watch(() => props.modelValue, (visible) => { if (visible) reset(); });
</script>

<template>
  <el-dialog :model-value="modelValue" title="导入事件" width="min(720px, calc(100vw - 32px))" align-center append-to-body destroy-on-close :close-on-click-modal="false" @close="close">
    <section class="incident-import-dialog">
      <label class="incident-file-picker">选择 CSV / GeoJSON<input type="file" accept=".csv,.geojson,.json" @change="chooseFile" /></label>
      <p v-if="source" class="incident-import-dialog__file">{{ source.fileName }} · {{ preview?.format.toUpperCase() }}</p>
      <p v-if="localError" class="incident-inline-error" role="alert">{{ localError }}</p>
      <template v-if="preview">
        <div v-if="preview.fields.length" class="incident-mapping-grid" aria-label="字段映射">
          <label v-for="field in mappingFields" :key="field.key"><span>{{ field.label }}</span><el-select v-model="mapping[field.key]" clearable size="small" placeholder="不映射"><el-option v-for="sourceField in preview.fields" :key="sourceField" :label="sourceField" :value="sourceField" /></el-select></label>
        </div>
        <div class="incident-import-summary"><span>{{ preview.rows.length }} 条待校验记录</span><span>{{ preview.errors.length }} 条解析错误</span></div>
        <div v-if="preview.rows.length" class="incident-import-preview"><strong>预览前 {{ Math.min(preview.rows.length, 3) }} 条</strong><p v-for="row in preview.rows.slice(0, 3)" :key="row.row">第 {{ row.row }} 行：{{ String(row.draft.title ?? '未命名') }} · {{ String(row.draft.categoryId ?? 'other') }}</p></div>
        <details v-if="importErrors.length || preview.errors.length" class="incident-import-errors"><summary>错误摘要（{{ importErrors.length || preview.errors.length }}）</summary><ul><li v-for="error in (importErrors.length ? importErrors : preview.errors.map((item) => `第 ${item.row || '—'} 行：${item.message}`))" :key="error">{{ error }}</li></ul></details>
      </template>
    </section>
    <template #footer><el-button @click="close">取消</el-button><el-button type="primary" :disabled="!source || !canImport" :loading="importing" @click="submit">确认导入</el-button></template>
  </el-dialog>
</template>