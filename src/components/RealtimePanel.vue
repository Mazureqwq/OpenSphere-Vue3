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
    <p class="realtime-note">接收单条对象、数组或 <code>{ data: ... }</code>，坐标字段兼容 <code>lon/lat</code>、<code>lng/lat</code>、<code>longitude/latitude</code>。</p>
  </section>
</template>
