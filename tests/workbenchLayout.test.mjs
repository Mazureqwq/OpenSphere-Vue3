import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, ref } from 'vue';
import { useWorkbenchLayout } from '../src/composables/useWorkbenchLayout.ts';

function createToolController(initialTool = 'layers') {
  const activeTool = ref(initialTool);
  const opened = [];
  let closed = 0;
  return {
    activeTool,
    opened,
    get closed() { return closed; },
    openTool(tool) { opened.push(tool); activeTool.value = tool; },
    toggleTool(tool) { activeTool.value = activeTool.value === tool ? undefined : tool; },
    closeTool() { closed += 1; activeTool.value = undefined; },
  };
}

function createSelectionController(initial = null) {
  const current = ref(initial);
  let cleared = 0;
  return {
    current,
    get cleared() { return cleared; },
    clear() { cleared += 1; current.value = null; },
  };
}

test('opens data as a layers workspace with the data tab visible', async () => {
  const controller = createToolController();
  const layout = useWorkbenchLayout({ ...controller, selection: createSelectionController() });

  layout.openSection('data');
  await nextTick();

  assert.equal(controller.opened.at(-1), 'layers');
  assert.equal(layout.activeSection.value, 'data');
  assert.equal(layout.contentTab.value, 'data');
  assert.equal(layout.contentPanelOpen.value, true);
  assert.equal(layout.bottomDrawerTab.value, undefined);
});

test('routes specialist tools to exactly one active visual region', () => {
  const controller = createToolController();
  const layout = useWorkbenchLayout({ ...controller, selection: createSelectionController() });

  layout.openWorkbenchTool('vectorStyle');
  assert.equal(layout.activeSection.value, 'edit');
  assert.equal(layout.inspectorTarget.value, 'tool');
  assert.equal(layout.bottomDrawerTab.value, undefined);

  layout.openWorkbenchTool('timeline');
  assert.equal(layout.activeSection.value, 'time');
  assert.equal(layout.inspectorTarget.value, undefined);
  assert.equal(layout.bottomDrawerTab.value, 'timeline');
});

test('derives inspector target from unified selection with feature priority', async () => {
  const controller = createToolController();
  const selection = createSelectionController();
  const layout = useWorkbenchLayout({ ...controller, selection });

  controller.activeTool.value = 'query';
  await nextTick();
  assert.equal(layout.activeSection.value, 'analysis');
  assert.equal(layout.inspectorTarget.value, undefined);

  selection.current.value = { kind: 'layer', layerId: 'l1' };
  await nextTick();
  assert.equal(layout.inspectorTarget.value, 'layer');

  selection.current.value = { kind: 'feature', layerId: 'l1', featureId: 'f1' };
  await nextTick();
  assert.equal(layout.inspectorTarget.value, 'feature');

  layout.closeInspector();
  assert.equal(layout.inspectorTarget.value, undefined);
  assert.equal(selection.cleared, 1);
});

test('clears inspector automatically when selection is cleared', async () => {
  const controller = createToolController();
  const selection = createSelectionController({ kind: 'layer', layerId: 'l1' });
  const layout = useWorkbenchLayout({ ...controller, selection });

  await nextTick();
  assert.equal(layout.inspectorTarget.value, 'layer');

  selection.current.value = null;
  await nextTick();
  assert.equal(layout.inspectorTarget.value, undefined);
});

test('keeps bottom drawer data flow alive when switching left-side tools', () => {
  const controller = createToolController();
  const layout = useWorkbenchLayout({ ...controller, selection: createSelectionController() });

  layout.openWorkbenchTool('playback');
  assert.equal(layout.bottomDrawerTab.value, 'playback');

  layout.openWorkbenchTool('query');
  assert.equal(layout.bottomDrawerTab.value, 'playback');

  layout.openWorkbenchTool('timeline');
  assert.equal(layout.bottomDrawerTab.value, 'timeline');
});

test('releases inspector occupation when tool closes and falls back to selection', () => {
  const controller = createToolController();
  const selection = createSelectionController({ kind: 'layer', layerId: 'l1' });
  const layout = useWorkbenchLayout({ ...controller, selection });

  layout.openWorkbenchTool('vectorStyle');
  assert.equal(layout.inspectorTarget.value, 'tool');

  layout.toggleWorkbenchTool('vectorStyle');
  assert.equal(layout.inspectorTarget.value, 'layer');
  assert.equal(selection.cleared, 0);
});
