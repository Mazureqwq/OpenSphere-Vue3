<script setup lang="ts">
import {computed} from 'vue';
import type {SelectedFeatureInfo} from '@/types/gis';
import {formatDisplayValue, formatFieldLabel, formatGeometryType} from '@/ui/display';

const props = defineProps<{feature: SelectedFeatureInfo; position: {x: number; y: number}}>();
const emit = defineEmits<{close: []}>();
const properties = computed(() => Object.entries(props.feature.properties).slice(0, 6));
const hiddenPropertyCount = computed(() => Math.max(0, Object.keys(props.feature.properties).length - properties.value.length));
</script>

<template>
  <article class="map-feature-popup" :style="{left: position.x + 'px', top: position.y + 'px'}" @click.stop>
    <header class="map-feature-popup-header"><div><strong>{{ feature.layerName }}</strong><span>{{ formatGeometryType(feature.geometryType) }}</span></div><button type="button" aria-label="关闭要素信息" @click="emit('close')">×</button></header>
    <p v-if="feature.coordinate" class="map-feature-popup-coordinate">{{ feature.coordinate[0] }}, {{ feature.coordinate[1] }}</p>
    <dl v-if="properties.length" class="map-feature-popup-properties"><template v-for="[key, value] in properties" :key="key"><dt>{{ formatFieldLabel(key) }}</dt><dd>{{ formatDisplayValue(value) || '—' }}</dd></template></dl>
    <p v-if="hiddenPropertyCount" class="map-feature-popup-more">还有 {{ hiddenPropertyCount }} 个属性请在左侧要素信息中查看</p>
  </article>
</template>
