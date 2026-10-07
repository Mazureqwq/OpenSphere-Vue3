<script setup lang="ts">
import { useWorkspaceContext } from '@/tools/workspaceContext';
import { workbenchSections, type WorkbenchSection } from './workbenchNavigation';

const ctx = useWorkspaceContext();

const sectionGlyphs: Record<WorkbenchSection, string> = {
  content: '▤',
  data: '◫',
  edit: '✎',
  analysis: '◇',
  time: '◷',
  monitor: '⌁',
};

function activate(section: WorkbenchSection) {
  if (ctx.activeSection.value === section && ctx.contentPanelOpen.value) {
    ctx.toggleContentPanel();
    return;
  }
  ctx.openSection(section);
}
</script>

<template>
  <nav class="task-rail" aria-label="功能导航">
    <button
      v-for="section in workbenchSections"
      :key="section.id"
      type="button"
      class="task-rail__item"
      :class="{ 'is-active': ctx.activeSection.value === section.id }"
      :aria-pressed="ctx.activeSection.value === section.id"
      :title="section.label"
      @click="activate(section.id)"
    >
      <span class="task-rail__glyph" aria-hidden="true">{{ sectionGlyphs[section.id] }}</span>
      <span class="task-rail__label">{{ section.shortLabel }}</span>
    </button>
  </nav>
</template>

<style scoped>
.task-rail {
  z-index: var(--os-z-panel);
  width: var(--os-rail-width);
  flex: 0 0 var(--os-rail-width);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 8px 6px;
  border-right: 1px solid var(--os-border-subtle);
  background: var(--os-bg-shell);
}
.task-rail__item {
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 5px 2px;
  border: 1px solid transparent;
  border-radius: var(--os-radius-sm);
  color: var(--os-text-muted);
  background: transparent;
  cursor: pointer;
  transition: color var(--os-motion-fast), border-color var(--os-motion-fast), background var(--os-motion-fast);
}
.task-rail__item:hover { color: var(--os-text-primary); background: var(--os-bg-hover); }
.task-rail__item.is-active { color: var(--os-accent-strong); border-color: rgb(94 165 255 / 35%); background: var(--os-accent-soft); }
.task-rail__glyph { height: 18px; line-height: 18px; font-size: 17px; font-weight: 600; }
.task-rail__label { font-size: 10px; line-height: 1; white-space: nowrap; }
@media (max-width: 767px) {
  .task-rail { padding-inline: 3px; }
  .task-rail__item { min-height: 47px; }
  .task-rail__label { display: none; }
}
</style>
