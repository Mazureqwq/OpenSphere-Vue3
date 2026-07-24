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
const showResults = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function search() {
  if (!term.value.trim()) {
    clear();
    return;
  }
  showResults.value = true;
  emit("search", term.value);
}
function handleInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!term.value.trim()) {
    clear();
    return;
  }
  showResults.value = true;
  debounceTimer = setTimeout(search, 300);
}
function handleFocus() {
  if (term.value.trim()) search();
}
function selectResult(result: SearchResult) {
  showResults.value = false;
  emit("select", result);
}
function clear() {
  if (debounceTimer) clearTimeout(debounceTimer);
  term.value = "";
  showResults.value = false;
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
    <div v-if="showResults && loading" class="search-state">正在搜索...</div>
    <div v-else-if="showResults && term && !results.length" class="search-state">
      未找到匹配结果
    </div>
    <div v-else-if="showResults && results.length" class="search-results">
      <button
        v-for="result in results"
        :key="result.id"
        class="search-result"
        @click="selectResult(result)">
        <span class="search-result-provider">{{ result.providerName }}</span
        ><strong>{{ result.title }}</strong
        ><small v-if="result.subtitle">{{ result.subtitle }}</small>
      </button>
    </div>
  </section>
</template>



<style scoped>
.search-panel :deep(.el-input) {
  margin-top: 12px;
}
.search-panel-toolbar :deep(.el-input) {
  margin-top: 0;
}
.search-note,
.search-state {
  margin: 9px 0 0;
  color: #7189a3;
  font-size: 10px;
  line-height: 1.5;
}
.search-panel-toolbar .search-results,
.search-panel-toolbar .search-state {
  position: absolute;
  z-index: 10;
  top: 34px;
  right: 0;
  width: min(360px, calc(100vw - 24px));
  margin: 0;
  padding: 7px 10px;
  border: 1px solid #46515c;
  border-radius: 4px;
  background: #242a30;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.42);
}
.search-panel-toolbar .search-results {
  max-height: min(320px, calc(100vh - 72px));
  overflow: auto;
  padding-top: 0;
}
.search-panel-toolbar .search-state {
  color: #b7c2cc;
  font-size: 11px;
}
.search-results {
  max-height: 240px;
  margin-top: 11px;
  overflow: auto;
  border-top: 1px solid #1e3853;
}
.search-result {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 7px;
  padding: 9px 0;
  border: 0;
  border-bottom: 1px solid #1a3049;
  color: #d7e5f3;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.search-result:hover strong {
  color: #5eead4;
}
.search-result-provider {
  grid-row: span 2;
  align-self: center;
  padding: 2px 5px;
  color: #7dd3fc;
  border-radius: 3px;
  background: #153a43;
  font-size: 9px;
}
.search-result strong,
.search-result small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-result strong {
  color: #dce9f5;
  font-size: 11px;
  font-weight: 600;
}
.search-result small {
  color: #7189a3;
  font-size: 10px;
}
</style>
