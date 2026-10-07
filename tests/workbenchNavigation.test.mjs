import assert from 'node:assert/strict';
import test from 'node:test';
import { toolIds } from '../src/tools/toolMeta.ts';
import {
  getBottomDrawerTabForTool,
  getContentTabForSection,
  getDefaultTool,
  getSectionForTool,
  getToolHost,
  isInspectorTool,
  workbenchSections,
} from '../src/layout/workbenchNavigation.ts';

test('defaults professional GIS workspace sections to their primary tools', () => {
  assert.deepEqual(workbenchSections.map((section) => section.id), [
    'content',
    'data',
    'edit',
    'analysis',
    'time',
    'monitor',
  ]);
  assert.equal(getDefaultTool('content'), 'layers');
  assert.equal(getDefaultTool('data'), 'layers');
  assert.equal(getDefaultTool('edit'), 'drawing');
  assert.equal(getDefaultTool('analysis'), 'query');
  assert.equal(getDefaultTool('time'), 'timeline');
  assert.equal(getDefaultTool('monitor'), 'realtime');
  assert.equal(getContentTabForSection('content'), 'layers');
  assert.equal(getContentTabForSection('data'), 'data');
});

test('routes every existing tool to one semantic section and visual host', () => {
  const expectedSections = {
    layers: 'content',
    legend: 'content',
    feature: 'content',
    drawing: 'edit',
    vectorStyle: 'edit',
    categoryStyle: 'edit',
    query: 'analysis',
    visualization: 'analysis',
    coordinate: 'analysis',
    timeField: 'time',
    timeline: 'time',
    playback: 'time',
    realtime: 'monitor',
  };

  assert.deepEqual(Object.keys(expectedSections).sort(), [...toolIds].sort());
  for (const tool of toolIds) {
    assert.equal(getSectionForTool(tool), expectedSections[tool]);
    assert.ok(['content', 'inspector', 'bottomDrawer'].includes(getToolHost(tool)));
  }
  assert.equal(getToolHost('drawing'), 'content');
  assert.equal(getToolHost('vectorStyle'), 'inspector');
  assert.equal(getToolHost('timeline'), 'bottomDrawer');
  assert.equal(isInspectorTool('vectorStyle'), true);
  assert.equal(isInspectorTool('realtime'), false);
});

test('routes temporal tools to one bottom drawer tab only', () => {
  assert.equal(getBottomDrawerTabForTool('timeline'), 'timeline');
  assert.equal(getBottomDrawerTabForTool('playback'), 'playback');
  assert.equal(getBottomDrawerTabForTool('realtime'), 'realtime');
  assert.equal(getBottomDrawerTabForTool('query'), undefined);
});
