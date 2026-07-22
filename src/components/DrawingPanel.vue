<script setup lang="ts">
import {computed} from 'vue';
import type {DrawMode} from '@/map/drawing';
import {useMapStore} from '@/stores/map';

const emit = defineEmits<{create: []; mode: [mode: DrawMode]; stop: []; removeSelected: []}>();
const mapStore = useMapStore();
const drawingLayer = computed(() => mapStore.layers.find((layer) => layer.drawing));
</script>

<template>
  <section class="panel drawing-panel">
    <div class="panel-title"><span>绘制与量测</span><span v-if="drawingLayer" class="count">{{ drawingLayer.featureCount ?? 0 }}</span></div>
    <div v-if="!drawingLayer" class="empty-state feature-empty">创建绘制图层后<br /><small>可标注点、线、面并量测距离/面积</small></div>
    <template v-else>
      <div class="draw-tools"><el-button size="small" @click="emit('mode', 'Point')">点</el-button><el-button size="small" @click="emit('mode', 'LineString')">量距离</el-button><el-button size="small" @click="emit('mode', 'Polygon')">量面积</el-button></div>
      <div class="draw-tools"><el-button size="small" :disabled="mapStore.mapEngine === '3d'" @click="emit('mode', 'modify')">编辑</el-button><el-button size="small" type="danger" plain @click="emit('removeSelected')">删除选中</el-button><el-button size="small" plain @click="emit('stop')">结束工具</el-button></div>
      <p class="category-note">{{ mapStore.mapEngine === '3d' ? '3D 中单击添加节点，右键或双击完成；选中要素后可删除，顶点编辑请切回 2D。' : '绘制线、面时双击结束；编辑状态可拖动节点，点击后可删除绘制要素。' }}</p>
    </template>
    <el-button v-if="!drawingLayer" class="drawing-create" type="primary" @click="emit('create')">创建绘制图层</el-button>
  </section>
</template>
