<script setup lang="ts">
import {computed} from 'vue';
import {useMapStore} from '@/stores/map';
import {formatDisplayValue, formatFieldLabel} from '@/ui/display';

const mapStore = useMapStore();
const layer = computed(() => mapStore.layers.find((item) => item.id === mapStore.selectedLayerId));
const entries = computed(() => Object.entries(layer.value?.categoryStyle?.colors ?? {}));
</script>

<template>
  <section v-if="layer?.categoryStyle" class="panel legend-panel">
    <div class="panel-title"><span>图例</span><span class="style-badge">{{ formatFieldLabel(layer.categoryStyle.field) }}</span></div>
    <div class="legend-list"><div v-for="[label, color] in entries" :key="label" class="legend-row"><i :style="{backgroundColor: color}" /><span>{{ formatDisplayValue(label) }}</span></div></div>
  </section>
</template>
