<script setup lang="ts">
import { computed } from 'vue';
import type { ToolId } from '@/tools/types';
import { getToolDefinition } from '@/tools/toolRegistry';

const props = withDefaults(defineProps<{
  tool: ToolId;
  contentMode?: 'content' | 'data';
}>(), {
  contentMode: 'content',
});
const definition = computed(() => getToolDefinition(props.tool));
</script>

<template>
  <component v-if="definition.id === 'layers'" :is="definition.component" :mode="contentMode" />
  <component v-else :is="definition.component" />
</template>
