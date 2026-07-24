<script setup lang="ts">
import {computed, ref, toRaw, watch} from 'vue';
import type BaseLayer from 'ol/layer/Base';
import {ElMessage} from 'element-plus';
import {getCategoryFields, getCategoryValues} from '@/map/styles';
import {useMapStore} from '@/stores/map';
import {formatDisplayValue, formatFieldLabel} from '@/ui/display';

const palette = ['#14b8a6', '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#fb923c', '#facc15', '#84cc16', '#22c55e'];
const mapStore = useMapStore();
const layer = computed(() => mapStore.layers.find((item) => item.id === mapStore.selectedLayerId));
const field = ref('');
const colors = ref<Record<string, string>>({});
const fields = computed(() => layer.value?.vectorStyle ? getCategoryFields(toRaw(layer.value.source) as unknown as BaseLayer) : []);
const values = computed(() => layer.value?.vectorStyle && field.value ? getCategoryValues(toRaw(layer.value.source) as unknown as BaseLayer, field.value) : []);

watch(layer, (selectedLayer) => {
  field.value = selectedLayer?.categoryStyle?.field ?? '';
  colors.value = {...(selectedLayer?.categoryStyle?.colors ?? {})};
}, {immediate: true});

watch(values, (nextValues) => {
  const nextColors = {...colors.value};
  nextValues.forEach((value, index) => { nextColors[value] ??= palette[index % palette.length]; });
  colors.value = nextColors;
});

function apply() {
  if (!layer.value?.vectorStyle || !field.value) {
    ElMessage.warning('请选择用于分类渲染的属性字段');
    return;
  }
  mapStore.setCategoryStyle(layer.value.id, {field: field.value, colors: {...colors.value}, fallbackColor: layer.value.vectorStyle.fillColor});
}

function clear() {
  if (!layer.value?.vectorStyle) return;
  mapStore.clearCategoryStyle(layer.value.id);
  field.value = '';
  colors.value = {};
}
</script>

<template>
  <section class="panel category-panel">
    <div class="panel-title"><span>分类渲染</span><button v-if="layer?.categoryStyle" class="clear-button" @click="clear">取消</button></div>
    <div v-if="!layer?.vectorStyle" class="empty-state feature-empty">选择一个矢量图层<br /><small>按属性字段自动分配颜色</small></div>
    <template v-else>
      <div class="category-actions">
        <el-select v-model="field" placeholder="选择分类字段" @change="apply"><el-option v-for="item in fields" :key="item" :label="formatFieldLabel(item)" :value="item" /></el-select>
        <el-button type="primary" :disabled="!field" @click="apply">应用</el-button>
      </div>
      <p v-if="!fields.length" class="category-note">当前图层没有可用于分类的基础属性字段。</p>
      <div v-else-if="field && values.length" class="category-values">
        <div v-for="value in values" :key="value" class="category-row"><span>{{ formatDisplayValue(value) }}</span><el-color-picker v-model="colors[value]" size="small" @change="apply" /></div>
      </div>
      <p v-if="field && !values.length" class="category-note">该字段没有可分类的值。</p>
    </template>
  </section>
</template>
