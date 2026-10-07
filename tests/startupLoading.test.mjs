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
