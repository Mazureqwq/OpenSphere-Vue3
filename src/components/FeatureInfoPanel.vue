<script setup lang="ts">
import {computed} from 'vue';
import {useMapStore} from '@/stores/map';
import {formatDisplayValue, formatFieldLabel, formatGeometryType} from '@/ui/display';

const mapStore = useMapStore();
const properties = computed(() => Object.entries(mapStore.selectedFeature?.properties ?? {}));
</script>

<template>
  <section class="panel feature-panel">
    <div class="panel-title"><span>要素信息</span><button v-if="mapStore.selectedFeature" class="clear-button" @click="mapStore.setSelectedFeature()">清除</button></div>
    <div v-if="!mapStore.selectedFeature" class="empty-state feature-empty">点击地图上的矢量要素<br /><small>查看属性和空间位置</small></div>
    <template v-else>
      <div class="feature-summary">
        <strong>{{ mapStore.selectedFeature.layerName }}</strong>
        <span>{{ formatGeometryType(mapStore.selectedFeature.geometryType) }}</span>
      </div>
      <div v-if="mapStore.selectedFeature.coordinate" class="feature-coordinate">{{ mapStore.selectedFeature.coordinate[0] }}, {{ mapStore.selectedFeature.coordinate[1] }}</div>
      <div v-if="properties.length" class="property-list">
        <div v-for="[key, value] in properties" :key="key" class="property-row"><span>{{ key }}</span><strong>{{ value || '—' }}</strong></div>
      </div>
      <div v-else class="empty-state feature-empty">该要素未包含自定义属性</div>
    </template>
  </section>
</template>
