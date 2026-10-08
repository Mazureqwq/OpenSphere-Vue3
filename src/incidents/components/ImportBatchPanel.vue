<script setup lang="ts">
import { computed, ref } from 'vue';
import { canIncidentAction } from '../domain/permissions';
import type { ImportBatch } from '../domain/types';
import { useIncidentWorkspaceContext } from '../presentation/incidentContext';

const workspace = useIncidentWorkspaceContext();
const revokeErrors = ref<Record<string, string>>({});
const batches = computed(() => workspace.importBatches.value.slice().sort((left, right) => Date.parse(right.importedAt) - Date.parse(left.importedAt)));
const usersById = computed(() => new Map(workspace.users.value.map((user) => [user.id, user.name])));
const canRevoke = computed(() => canIncidentAction(workspace.currentRole.value, 'revoke_import_batch'));
function importedAt(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function importer(batch: ImportBatch) { return usersById.value.get(batch.importedBy) ?? batch.importedBy; }
async function revoke(batch: ImportBatch) {
  revokeErrors.value[batch.id] = '';
  try {
    await workspace.revokeImportBatch(batch.id);
  } catch (error) {
    revokeErrors.value[batch.id] = error instanceof Error ? error.message : '无法撤销此导入批次。';
  }
}
</script>

<template>
  <section class="import-batches" aria-label="导入批次">
    <div v-if="!workspace.ready.value" class="incident-empty-state">正在读取导入批次…</div>
    <div v-else-if="!batches.length" class="incident-empty-state">尚无事件导入批次。</div>
    <article v-for="batch in batches" :key="batch.id" class="import-batch-card" :class="{ 'is-revoked': batch.revokedAt }">
      <header><div><strong>{{ batch.fileName }}</strong><span>{{ batch.format.toUpperCase() }} · {{ importer(batch) }}</span></div><span class="import-batch-card__state">{{ batch.revokedAt ? '已撤销' : '已导入' }}</span></header>
      <dl><div><dt>成功</dt><dd>{{ batch.successCount }}</dd></div><div><dt>失败</dt><dd>{{ batch.failureCount }}</dd></div><div><dt>总计</dt><dd>{{ batch.totalCount }}</dd></div></dl>
      <p>导入于 {{ importedAt(batch.importedAt) }}</p>
      <details v-if="batch.errors.length"><summary>错误摘要（{{ batch.errors.length }}）</summary><ul><li v-for="error in batch.errors" :key="`${error.row}-${error.message}`">第 {{ error.row || '—' }} 行：{{ error.message }}</li></ul></details>
      <p v-if="revokeErrors[batch.id]" class="incident-inline-error" role="alert">{{ revokeErrors[batch.id] }}</p>
      <button v-if="!batch.revokedAt && canRevoke" type="button" class="incident-secondary-button" @click="revoke(batch)">撤销此批次</button>
      <p v-else-if="!batch.revokedAt" class="incident-muted-note">当前演示角色没有撤销导入批次权限。</p>
    </article>
  </section>
</template>