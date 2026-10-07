<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {getCategoryFields, getTimeFields} from '@/map/styles';
import {useMapStore} from '@/stores/map';
import {formatFieldLabel} from '@/ui/display';
import type BaseLayer from 'ol/layer/Base';
import type {PlaybackTrack, TrackPlaybackState} from '@/map/trackPlayback';

const props = defineProps<{tracks: PlaybackTrack[]; state: TrackPlaybackState; follow: boolean}>();
const emit = defineEmits<{load: [layerId: string, idField: string, timeField: string]; selectTrack: [id: string]; play: []; pause: []; seek: [timestamp: number]; speed: [value: number]; follow: [value: boolean]; clear: []}>();
const mapStore = useMapStore();
const sourceLayerId = ref('');
const idField = ref('');
const timeField = ref('');
const layers = computed(() => mapStore.layers.filter((layer) => Boolean(layer.vectorStyle)));
const selectedLayer = computed(() => layers.value.find((layer) => layer.id === sourceLayerId.value));
const fields = computed(() => selectedLayer.value ? getCategoryFields(selectedLayer.value.source as unknown as BaseLayer) : []);
const timeFields = computed(() => selectedLayer.value ? getTimeFields(selectedLayer.value.source as unknown as BaseLayer) : []);
const progress = computed<number>({
  get() {
    if (props.state.currentTime === undefined || props.state.start === undefined || props.state.end === undefined) return 0;
    return ((props.state.currentTime - props.state.start) / Math.max(props.state.end - props.state.start, 1)) * 100;
  },
  set(value) {
    if (props.state.start === undefined || props.state.end === undefined) return;
    emit('seek', props.state.start + (props.state.end - props.state.start) * value / 100);
  },
});

watch([layers, () => mapStore.selectedLayerId], () => {
  const selected = layers.value.find((layer) => layer.id === mapStore.selectedLayerId);
  if (selected) sourceLayerId.value = selected.id;
  else if (!layers.value.some((layer) => layer.id === sourceLayerId.value)) sourceLayerId.value = layers.value[0]?.id ?? '';
}, {immediate: true});
function preferredIdField() {
  return fields.value.find((field) => /track.?id|trajectory|轨迹/i.test(field))
    ?? fields.value.find((field) => !timeFields.value.includes(field))
    ?? '';
}
function preferredTimeField(layer: typeof selectedLayer.value) {
  return timeFields.value.find((field) => /time|date|timestamp|时间|日期/i.test(field))
    ?? layer?.timeFilter?.field
    ?? timeFields.value[0]
    ?? '';
}

watch(selectedLayer, (layer) => {
  if (!layer) return;
  if (!fields.value.includes(idField.value)) idField.value = preferredIdField();
  if (!timeFields.value.includes(timeField.value)) timeField.value = preferredTimeField(layer);
}, {immediate: true});

function load() {
  if (!sourceLayerId.value || !idField.value || !timeField.value) { ElMessage.warning('请选择轨迹标识字段和时间字段'); return; }
  emit('load', sourceLayerId.value, idField.value, timeField.value);
}
function formatTime(value?: number) { return value === undefined ? '—' : new Date(value).toLocaleString('zh-CN', {hour12: false}); }
</script>

<template>
  <section class="panel track-playback-panel">
    <div class="panel-title"><span>轨迹回放</span><button v-if="tracks.length" class="clear-button" @click="emit('clear')">关闭</button></div>
    <div v-if="!layers.length" class="empty-state feature-empty">暂无可用矢量图层<br /><small>导入含轨迹标识、时间和点位的数据</small></div>
    <template v-else>
      <div class="playback-config"><el-select v-model="sourceLayerId" size="small" placeholder="选择点位图层"><el-option v-for="layer in layers" :key="layer.id" :label="layer.name" :value="layer.id" /></el-select><el-select v-model="idField" size="small" placeholder="轨迹标识字段"><el-option v-for="field in fields" :key="field" :label="formatFieldLabel(field)" :value="field" /></el-select><el-select v-model="timeField" size="small" placeholder="时间字段"><el-option v-for="field in timeFields" :key="field" :label="formatFieldLabel(field)" :value="field" /></el-select></div>
      <el-button class="playback-load" size="small" type="primary" @click="load">解析轨迹</el-button>
      <template v-if="tracks.length">
        <el-select :model-value="state.trackId" size="small" class="playback-track-select" @change="(id: string) => emit('selectTrack', id)"><el-option v-for="track in tracks" :key="track.id" :label="`${track.name} · ${new Date(track.start).toLocaleString()}`" :value="track.id" /></el-select>
        <div class="playback-actions"><el-button size="small" type="primary" @click="state.playing ? emit('pause') : emit('play')">{{ state.playing ? '暂停' : '播放' }}</el-button><el-select :model-value="state.speed" size="small" @change="(value: number) => emit('speed', value)"><el-option :value="1" label="1×" /><el-option :value="2" label="2×" /><el-option :value="5" label="5×" /><el-option :value="10" label="10×" /></el-select><el-switch :model-value="follow" active-text="跟随" @change="(value: boolean | string | number) => emit('follow', Boolean(value))" /></div>
        <el-slider v-model="progress" :show-tooltip="false" />
        <div class="playback-time"><span>{{ formatTime(state.currentTime) }}</span><small>{{ formatTime(state.end) }}</small></div>
      </template>
      <p class="playback-note">按轨迹标识与时间字段自动分组，回放位置平滑插值。</p>
    </template>
  </section>
</template>



<style scoped>
.track-playback-panel :deep(.el-select) {
  width: 100%;
}
.playback-config {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.playback-load {
  width: 100%;
  margin-top: 9px;
}
.playback-track-select {
  margin-top: 12px;
}
.playback-actions {
  display: grid;
  grid-template-columns: 1fr 72px 76px;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}
.playback-actions :deep(.el-button) {
  margin: 0;
}
.playback-actions :deep(.el-switch) {
  justify-self: end;
}
.playback-time {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 5px;
  color: #90a9c1;
  font-family: Consolas, monospace;
  font-size: 10px;
}
.playback-time small {
  color: #617d99;
  font-size: 10px;
}
.playback-note {
  margin: 10px 0 0;
  color: #7189a3;
  font-size: 10px;
  line-height: 1.55;
}
</style>
