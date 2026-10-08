import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readProjectFile(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('keeps Cesium outside the default 2D startup module chain', async () => {
  const [main, mapView] = await Promise.all([
    readProjectFile('src/main.ts'),
    readProjectFile('src/components/MapView.vue'),
  ]);

  assert.doesNotMatch(main, /cesium\/Build\/Cesium\/Widgets\/widgets\.css/);
  assert.doesNotMatch(mapView, /import\s+\{\s*CesiumManager\s*\}\s+from/);
  assert.match(mapView, /import\(['"]@\/map\/CesiumManager['"]\)/);
  assert.match(mapView, /import\(['"]cesium\/Build\/Cesium\/Widgets\/widgets\.css['"]\)/);
});

test('loads the map component after the workspace chrome can render', async () => {
  const appView = await readProjectFile('src/views/AppView.vue');

  assert.doesNotMatch(appView, /import\s+MapView\s+from/);
  assert.match(appView, /defineAsyncComponent\(\(\) => import\(['"]@\/components\/MapView\.vue['"]\)\)/);
});

test('provides visible boot and map-engine loading feedback', async () => {
  const [index, appView, mapView] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('src/views/AppView.vue'),
    readProjectFile('src/components/MapView.vue'),
  ]);

  assert.match(index, /class="atlas-boot-shell"/);
  assert.match(appView, /v-if="!mapReady"/);
  assert.match(mapView, /v-if="isEngineLoading"/);
});

test('keeps incident initialization after async map workspace recovery without a synchronous Cesium path', async () => {
  const [main, appView] = await Promise.all([
    readProjectFile('src/main.ts'),
    readProjectFile('src/views/AppView.vue'),
  ]);

  assert.doesNotMatch(main, /incidents\/presentation|CesiumManager|from\s+['"]cesium/);
  assert.doesNotMatch(appView, /import\s+\{\s*CesiumManager\s*\}\s+from|from\s+['"]cesium/);
  assert.match(appView, /provide\(incidentContextKey, incidentWorkspace\)/);
  assert.ok(appView.indexOf('await context.loadDemoData();') < appView.indexOf('await incidentWorkspace.hydrate();'));
});

test('documents the local event workspace boundary and reset path', async () => {
  const readme = await readProjectFile('README.md');

  assert.match(readme, /空间事件处置/);
  assert.match(readme, /IndexedDB/);
  assert.match(readme, /演示角色/);
  assert.match(readme, /不提供真实登录/);
  assert.match(readme, /不提供跨浏览器同步/);
  assert.match(readme, /重置本地事件演示数据/);
});
