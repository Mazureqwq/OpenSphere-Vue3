<script setup lang="ts">
import {ref} from 'vue';
import {ElMessage} from 'element-plus';
import type {RealtimeStatus} from '@/map/realtime';

const props = defineProps<{status: RealtimeStatus; trackCount: number; lastUpdated?: string; error?: string}>();
const emit = defineEmits<{connect: [url: string]; disconnect: []; startSimulation: []; stopSimulation: []}>();
const url = ref('');
const labels: Record<RealtimeStatus, string> = {disconnected: '未连接', connecting: '连接中', connected: '已连接', reconnecting: '重连中', error: '连接异常', simulation: '本地模拟'};

function connect() {
  if (!url.value.trim()) { ElMessage.warning('请输入 WebSocket 服务地址'); return; }
  emit('connect', url.value);
}
function formatTime(value?: string) { return value ? new Date(value).toLocaleTimeString('zh-CN', {hour12: false}) : '暂无数据'; }
</script>

<template>
  <section class="panel realtime-panel">
    <div class="panel-title"><span>实时轨迹</span><span class="status-badge" :class="status">{{ labels[status] }}</span></div>
    <el-input v-model="url" size="small" placeholder="wss://example.com/positions" :disabled="status === 'connected' || status === 'connecting' || status === 'reconnecting' || status === 'simulation'" />
    <div class="realtime-actions">
      <el-button v-if="status !== 'connected' && status !== 'connecting' && status !== 'reconnecting' && status !== 'simulation'" size="small" type="primary" @click="connect">连接</el-button>
      <el-button v-if="status === 'connected' || status === 'connecting' || status === 'reconnecting'" size="small" @click="emit('disconnect')">断开</el-button>
      <el-button v-if="status !== 'simulation'" size="small" plain @click="emit('startSimulation')">本地模拟</el-button>
      <el-button v-else size="small" @click="emit('stopSimulation')">停止模拟</el-button>
    </div>
    <div class="realtime-meta"><span>活动目标</span><strong>{{ trackCount }}</strong></div>
    <div class="realtime-meta"><span>最近更新</span><strong>{{ formatTime(lastUpdated) }}</strong></div>
    <p v-if="error" class="realtime-error">{{ error }}</p>
    <p class="realtime-note">支持对象、数组或 { data } 结构；坐标字段兼容 lon/lat 与 longitude/latitude。</p>
  </section>
</template>



<style scoped>
.realtime-panel :deep(.el-input) {
  margin-top: 12px;
}
.realtime-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}
.realtime-actions :deep(.el-button) {
  margin: 0;
}
.status-badge {
  padding: 2px 6px;
  border-radius: 4px;
  background: #243a53;
  color: #a8bed2;
  font-size: 10px;
  font-weight: 500;
}
.status-badge.connected,
.status-badge.simulation {
  background: #123f3d;
  color: #5eead4;
}
.status-badge.connecting,
.status-badge.reconnecting {
  background: #3d3212;
  color: #fbbf24;
}
.status-badge.error {
  background: #4a2028;
  color: #fda4af;
}
.realtime-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid #1e3853;
  color: #7893ae;
  font-size: 11px;
}
.realtime-meta strong {
  color: #d6e6f5;
  font-family: Consolas, monospace;
  font-weight: 500;
}
.realtime-note,
.realtime-error {
  margin: 10px 0 0;
  font-size: 10px;
  line-height: 1.55;
}
.realtime-note {
  color: #7189a3;
}
.realtime-note code {
  color: #a5d8ff;
}
.realtime-error {
  color: #fda4af;
}
</style>
