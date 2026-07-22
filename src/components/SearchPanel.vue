<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Search } from "@element-plus/icons-vue";
import type { SearchResult } from "@/search/types";

const props = withDefaults(
  defineProps<{
    results: SearchResult[];
    loading: boolean;
    providers: string[];
    variant?: "dock" | "toolbar";
  }>(),
  { variant: "dock" },
);
const emit = defineEmits<{
  search: [term: string];
  select: [result: SearchResult];
  clear: [];
}>();
const term = ref("");
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function search() {
  if (!term.value.trim()) {
    clear();
    return;
  }
  emit("search", term.value);
}
function handleInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!term.value.trim()) {
    clear();
    return;
  }
  debounceTimer = setTimeout(search, 300);
}
function clear() {
  if (debounceTimer) clearTimeout(debounceTimer);
  term.value = "";
  emit("clear");
}
onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <section
    :class="[
      'search-panel',
      {
        panel: variant === 'dock',
        'search-panel-toolbar': variant === 'toolbar',
      },
    ]">
    <div v-if="variant === 'dock'" class="panel-title">
      <span>搜索服务</span
      ><button
        v-if="term || results.length"
        class="clear-button"
        @click="clear">
        清除
      </button>
    </div>
    <el-input
      v-model="term"
      size="small"
      placeholder="搜索天地图地点、图层要素或输入经纬度"
      :prefix-icon="Search"
      clearable
      @input="handleInput"
      @keyup.enter="search"
      @clear="clear" />
    <p v-if="variant === 'dock'" class="search-note">
      已启用：{{
        providers.join("、")
      }}。天地图地名搜索覆盖全国地点；坐标格式：经度, 纬度
    </p>
    <div v-if="loading" class="search-state">正在搜索...</div>
    <div v-else-if="term && !results.length" class="search-state">
      未找到匹配结果
    </div>
    <div v-else-if="results.length" class="search-results">
      <button
        v-for="result in results"
        :key="result.id"
        class="search-result"
        @click="emit('select', result)">
        <span class="search-result-provider">{{ result.providerName }}</span
        ><strong>{{ result.title }}</strong
        ><small v-if="result.subtitle">{{ result.subtitle }}</small>
      </button>
    </div>
  </section>
</template>
