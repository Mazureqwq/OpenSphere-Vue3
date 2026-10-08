import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('new event form exposes one business-level map entry instead of parallel geometry buttons', async () => {
  const form = await readProjectFile('src/incidents/components/IncidentFormDialog.vue');

  assert.match(form, /useIncidentCreateDraft/);
  assert.match(form, /useIncidentGeometryCaptureTask/);
  assert.match(form, /在地图上标注/);
  assert.match(form, /调整标注/);
  assert.match(form, /清除/);
  assert.doesNotMatch(form, /从地图拾取点位/);
  assert.doesNotMatch(form, /绘制影响范围/);
  assert.doesNotMatch(form, /取消地图拾取/);
  assert.doesNotMatch(form, /captureGeometry\(/);
});

test('map task card is teleported into the canvas with explicit range controls', async () => {
  const [task, tool, css] = await Promise.all([
    readProjectFile('src/incidents/components/IncidentMapCaptureTask.vue'),
    readProjectFile('src/tools/components/IncidentTool.vue'),
    readProjectFile('src/incidents/components/incident-workspace.css'),
  ]);

  assert.match(task, /<Teleport to="\.atlas-map-stage">/);
  assert.match(task, /地点/);
  assert.match(task, /圈定范围/);
  assert.match(task, /撤销上一点/);
  assert.match(task, /完成绘制/);
  assert.match(task, /双击、右键或 Enter 完成；Esc 取消/);
  assert.match(task, /role="region"/);
  assert.match(tool, /IncidentMapCaptureTask/);
  assert.match(css, /incident-geometry-actions/);
  assert.match(css, /incident-map-capture-task/);
});

test('active event capture takes keyboard priority before normal workspace escape handling', async () => {
  const [appView, uiState, taskController] = await Promise.all([
    readProjectFile('src/views/AppView.vue'),
    readProjectFile('src/incidents/presentation/incidentUiState.ts'),
    readProjectFile('src/incidents/presentation/useIncidentGeometryCaptureTask.ts'),
  ]);

  assert.match(appView, /const incidentGeometryCaptureTask = useIncidentGeometryCaptureTask\(\)/);
  assert.match(appView, /if \(incidentGeometryCaptureTask\.active\.value\)/);
  assert.match(appView, /event\.key === 'Enter'/);
  assert.match(appView, /incidentGeometryCaptureTask\.cancel\(\)/);
  assert.match(uiState, /mapTaskActive/);
  assert.match(taskController, /facade\.startIncidentGeometryCapture/);
  assert.match(taskController, /facade\.cancelIncidentGeometryCapture/);
  assert.match(taskController, /draft\.geometry = geometry/);
});
