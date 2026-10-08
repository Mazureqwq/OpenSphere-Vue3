<script setup lang="ts">
import { computed } from 'vue';
import type { DemoRole } from '../domain/types';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';

const workspace = useIncidentWorkspaceContext();
const roles: Array<{ value: DemoRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'dispatcher', label: '调度员' },
  { value: 'supervisor', label: '主管' },
];
const currentLabel = computed(() => roles.find((role) => role.value === workspace.currentRole.value)?.label ?? workspace.currentRole.value);
function setRole(role: DemoRole) { workspace.setRole(role); }
</script>

<template>
  <div class="demo-role-switch" aria-label="演示角色（本地）">
    <span class="demo-role-switch__label">演示角色</span>
    <el-select class="demo-role-switch__select" size="small" :model-value="workspace.currentRole.value" aria-label="演示角色（本地）" @update:model-value="setRole">
      <el-option v-for="role in roles" :key="role.value" :label="role.label" :value="role.value" />
    </el-select>
    <small>本地 · {{ currentLabel }}</small>
  </div>
</template>

<style scoped>
.demo-role-switch { min-width: 0; display: inline-flex; align-items: center; gap: 5px; color: var(--os-text-muted); font-size: 10px; white-space: nowrap; }
.demo-role-switch__label { color: var(--os-text-secondary); }.demo-role-switch__select { width: 88px; }.demo-role-switch small { color: var(--os-text-muted); font-size: 10px; }
@media (max-width: 1100px) { .demo-role-switch__label, .demo-role-switch small { display: none; }.demo-role-switch__select { width: 76px; } }
@media (max-width: 800px) { .demo-role-switch__select { width: 68px; } }
</style>