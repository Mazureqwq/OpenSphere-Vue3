import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getVisibleIncidentActions } from '../src/incidents/presentation/incidentActionModel.ts';

const projectRoot = new URL('..', import.meta.url);
const pendingReview = {
  id: 'incident-pending',
  status: 'pending_review',
};
const assigned = {
  id: 'incident-assigned',
  status: 'assigned',
};

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, projectRoot), 'utf8');
}

test('shows only state-permitted workflow actions for each local demo role', () => {
  assert.deepEqual(getVisibleIncidentActions('dispatcher', pendingReview), ['view', 'cancel']);
  assert.deepEqual(getVisibleIncidentActions('supervisor', pendingReview), ['view', 'approve', 'return', 'cancel']);
  assert.deepEqual(getVisibleIncidentActions('dispatcher', assigned), ['view', 'assign', 'start', 'cancel']);
  assert.deepEqual(getVisibleIncidentActions('supervisor', assigned), ['view', 'cancel']);
});

test('wires local role switching, incident inspection, timeline review and local reset without a real session', async () => {
  const [topbar, roleSwitch, inspector, drawer, incidentTool, appView] = await Promise.all([
    readProjectFile('src/layout/AppTopbar.vue'),
    readProjectFile('src/incidents/components/DemoRoleSwitch.vue'),
    readProjectFile('src/layout/InspectorPanel.vue'),
    readProjectFile('src/layout/BottomDrawer.vue'),
    readProjectFile('src/tools/components/IncidentTool.vue'),
    readProjectFile('src/views/AppView.vue'),
  ]);

  assert.match(topbar, /DemoRoleSwitch/);
  assert.match(roleSwitch, /演示角色/);
  assert.match(roleSwitch, /本地/);
  assert.match(inspector, /IncidentInspector/);
  assert.match(inspector, /inspectorTarget\.value === 'incident'/);
  assert.match(drawer, /IncidentTimelineDrawer/);
  assert.match(drawer, /incidentTimeline/);
  assert.match(incidentTool, /resetDemoData/);
  assert.match(appView, /context\.closeBottomDrawer\(\)/);
});