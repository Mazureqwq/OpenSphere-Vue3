<script setup lang="ts">
import {reactive, ref, watch} from 'vue';
import {ElMessage} from 'element-plus';
import type {WmsLayerInput} from '@/map/ogc';

const props = defineProps<{modelValue: boolean}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [value: WmsLayerInput] }>();
const form = reactive<WmsLayerInput>({
  name: '',
  url: '',
  layers: '',
  format: 'image/png',
  version: '1.3.0',
  transparent: true,
});
const loading = ref(false);

watch(() => props.modelValue, (visible) => {
  if (!visible) return;
  form.name = '';
  form.url = '';
  form.layers = '';
  form.format = 'image/png';
  form.version = '1.3.0';
  form.transparent = true;
});

function close() { emit('update:modelValue', false); }

function submit() {
  if (!form.name.trim() || !form.url.trim() || !form.layers.trim()) {
    ElMessage.warning('请填写图层名称、WMS 服务地址和服务图层名');
    return;
  }

  try {
    new URL(form.url);
  } catch {
    ElMessage.warning('WMS 服务地址必须是完整的 http(s) 地址');
    return;
  }

  loading.value = true;
  emit('submit', {...form});
  loading.value = false;
  close();
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="添加 WMS 图层" width="500px" :close-on-click-modal="false" @close="close">
    <el-form label-position="top">
      <el-form-item label="图层名称"><el-input v-model="form.name" placeholder="例如：行政区边界" /></el-form-item>
      <el-form-item label="WMS 服务地址"><el-input v-model="form.url" placeholder="https://example.com/geoserver/wms" /></el-form-item>
      <el-form-item label="服务图层名"><el-input v-model="form.layers" placeholder="workspace:layer_name" /></el-form-item>
      <div class="form-grid">
        <el-form-item label="WMS 版本"><el-select v-model="form.version"><el-option label="1.3.0" value="1.3.0" /><el-option label="1.1.1" value="1.1.1" /></el-select></el-form-item>
        <el-form-item label="图片格式"><el-select v-model="form.format"><el-option label="PNG（透明）" value="image/png" /><el-option label="JPEG" value="image/jpeg" /></el-select></el-form-item>
      </div>
      <el-form-item><el-checkbox v-model="form.transparent">请求透明背景</el-checkbox></el-form-item>
    </el-form>
    <p class="wms-note">服务必须允许浏览器访问。受 CORS、鉴权或内网限制的服务需通过项目后端代理转发。</p>
    <template #footer><el-button @click="close">取消</el-button><el-button type="primary" :loading="loading" @click="submit">添加图层</el-button></template>
  </el-dialog>
</template>

