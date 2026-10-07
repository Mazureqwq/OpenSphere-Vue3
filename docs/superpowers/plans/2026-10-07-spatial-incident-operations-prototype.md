# 空间事件处置前端原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有 Graphite Atlas GIS 工作台中交付一条可持久化、可按角色演示的“空间事件处置”闭环：导入/新建事件、地图研判、分派、处置、审核、撤销和复盘。

**Architecture:** 事件业务以纯 TypeScript 领域模型、状态机、权限策略和应用服务为核心，通过 Repository 接口持久化到 IndexedDB；Vue 只经由一个注入式 Incident Workspace 读取状态和触发命令。事件地图要素作为标记为 `system: 'incidents'` 的只读系统矢量层复用既有 MapFacade 的 2D/3D 渲染与选中能力，并从普通工作区快照和图层目录中排除。

**Tech Stack:** Vue 3、Pinia、TypeScript、Element Plus、OpenLayers、Cesium、原生 IndexedDB、Papa Parse、Node test runner；新增开发依赖 `fake-indexeddb` 用于 IndexedDB 回归测试。

**Spec:** `docs/superpowers/specs/2026-10-07-spatial-incident-operations-prototype-design.md`

## Global Constraints

- 本期是本地前端原型：不得新增真实后端、账号密码、SSO、跨浏览器同步、并发控制、文件上传或伪造的“在线协作”。
- 只允许管理员、调度员、主管三种**演示角色**；顶栏必须清楚标明这是本地角色切换，不得称为登录状态。
- 事件存储与未来接口传输统一使用 EPSG:4326 GeoJSON；地图适配器负责 OpenLayers/Cesium 投影和呈现。
- 事件状态只能为 `unassigned | assigned | in_progress | pending_review | closed | cancelled`，所有非法流转必须由领域服务拒绝。
- 事件系统层必须从普通图层列表、`workspace.ts` 快照和 `useWorkspacePersistence` 自动保存中排除，且在事件数据恢复后重新生成。
- 保留现有普通图层导入、绘制、查询、实时、回放、2D/3D 和启动按需加载行为；不得重新把 Cesium 引入首屏同步模块链。
- 所有新增用户可见文案使用中文；空状态、加载、失败、无权限和 IndexedDB 不可用必须可理解且可恢复。
- 用户明确要求不自动执行 commit、push 或部署。本计划中的“记录任务结果”替代 commit 步骤。

## Review Focus

1. **状态机绕过：** 非法转移或无权限动作不得写入事件、时间线或版本号；Task 1、Task 3 测试所有拒绝路径。
2. **部分导入：** CSV/GeoJSON 中无标题、无效经纬度或无效几何的记录必须在错误摘要中可见，合法记录可导入；Task 3 测试混合成功/失败批次。
3. **批次撤销：** 任一批次事件已离开 `unassigned` 时，撤销批次必须失败且不删除任何记录；Task 3 测试原子性。
4. **持久化边界：** IndexedDB 失败、模式升级或旧工作区恢复不得产生重复事件系统层；Task 2、Task 4 测试恢复与去重。
5. **工作台共存：** 打开事件队列与事件时间线不得卸载内容区，也不得破坏现有图层/时间/实时抽屉；Task 5、Task 7 扩展导航和布局回归测试。

---

## Planned File Structure

| 文件/目录 | 职责 |
| --- | --- |
| `src/incidents/domain/*` | 纯领域类型、状态机、权限策略和导入校验；无 Vue、Pinia、DOM 或 IndexedDB 依赖。 |
| `src/incidents/contracts/api.ts` | 未来 REST/WebSocket DTO 和事件名，仅定义契约，不发网络请求。 |
| `src/incidents/repositories/*` | Repository 契约、内存测试实现和 IndexedDB 适配器。 |
| `src/incidents/application/incidentService.ts` | 创建、导入、分派、处置、审核、撤销、批次撤销等用例，维护事件与时间线一致性。 |
| `src/incidents/presentation/*` | Incident Workspace、注入 key、系统事件图层、事件选择桥接和地图几何拾取协调。 |
| `src/incidents/components/*` | 事件队列、导入向导、事件表单、事件检查器和事件时间线的展示组件。 |
| `src/tools/components/IncidentTool.vue` | 事件一级工作区的唯一内容宿主，内部切换“事件队列 / 导入批次”。 |
| `src/layout/*`、`src/tools/*`、`src/composables/*` | 现有 TaskRail、工具注册、选择/检查器、底部抽屉和地图工作区的最小集成改动。 |
| `tests/incident*.test.mjs` | 领域、Repository、导入、工作区/地图映射和导航契约测试。 |

## Task 1: 建立事件领域模型、状态机、权限与未来 API 契约

**Files:**
- Create: `src/incidents/domain/types.ts`
- Create: `src/incidents/domain/incidentMachine.ts`
- Create: `src/incidents/domain/permissions.ts`
- Create: `src/incidents/domain/importValidation.ts`
- Create: `src/incidents/contracts/api.ts`
- Create: `tests/incidentDomain.test.mjs`

**Interfaces:**
- Consumes: 无。
- Produces: `Incident`, `IncidentStatus`, `DemoRole`, `IncidentAction`, `IncidentTimelineEntry`, `ImportBatch`, `IncidentCategory`, `canIncidentAction()`, `transitionIncident()`, `validateIncidentDraft()`，供后续 Repository、应用服务、组件共同使用。

- [ ] **Step 1: 写入失败的领域行为测试**

在 `tests/incidentDomain.test.mjs` 中定义并断言：

```js
test('only permits the approved incident state transitions', () => {
  assert.equal(transitionIncident(unassigned, 'assign', actor).status, 'assigned');
  assert.equal(transitionIncident(pendingReview, 'approve', supervisor).status, 'closed');
  assert.throws(() => transitionIncident(closed, 'assign', dispatcher), /不允许/);
});

test('enforces permissions independently of visible UI', () => {
  assert.equal(canIncidentAction('dispatcher', 'review'), false);
  assert.equal(canIncidentAction('supervisor', 'review'), true);
  assert.equal(canIncidentAction('admin', 'manageTeam'), true);
});
```

同时覆盖：管理员可执行审核；撤销仅允许非终态；缺少标题或无效 EPSG:4326 Geometry 的草稿被拒绝。

- [ ] **Step 2: 运行领域测试，确认 RED**

Run: `pnpm exec node --test tests/incidentDomain.test.mjs`
Expected: FAIL，原因是 `src/incidents/domain/*` 尚不存在或导出缺失。

- [ ] **Step 3: 实现纯领域模块与 API DTO**

- 在 `types.ts` 定义唯一的 `DEFAULT_LOCAL_PROJECT_ID = 'local-demo'`、结构化 `Incident` 及附属实体；几何使用 `GeoJSON.Geometry`，持久化实体均有 `schemaVersion: 1`、ISO 时间和单调 `version`。
- 在 `incidentMachine.ts` 实现 `transitionIncident(incident, action, actor, payload)`；输出更新后的不可变事件和必写时间线条目所需元数据，拒绝非法状态与无理由的退回/撤销。
- 在 `permissions.ts` 实现只依赖 `DemoRole` 和 `IncidentAction` 的 `canIncidentAction()`，不读取 Vue 或组件状态。
- 在 `importValidation.ts` 校验标题和有限坐标/GeoJSON Geometry，补齐允许默认值的分类与严重等级。
- 在 `contracts/api.ts` 定义与规格一致的 REST DTO、`IncidentApiEventName` 和 WebSocket 载荷类型；不得导入 `fetch` 或建立连接。

- [ ] **Step 4: 运行领域测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentDomain.test.mjs`
Expected: PASS，覆盖状态、权限、撤销和草稿校验。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录新增模块、测试命令和通过结果；遵守用户约束，不执行 git commit、push 或部署。

## Task 2: 实现可测试的 IndexedDB Repository 与演示种子数据

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/incidents/repositories/contracts.ts`
- Create: `src/incidents/repositories/memoryIncidentRepository.ts`
- Create: `src/incidents/repositories/indexedDbIncidentRepository.ts`
- Create: `src/incidents/application/demoData.ts`
- Create: `tests/incidentRepository.test.mjs`

**Interfaces:**
- Consumes: Task 1 的领域实体与 `DEFAULT_LOCAL_PROJECT_ID`。
- Produces: `IncidentWorkspaceRepository`, `createMemoryIncidentRepository()`, `createIndexedDbIncidentRepository()`, `createDemoIncidentSeed()`；Task 3 的应用服务只通过该接口写入数据。

- [ ] **Step 1: 安装测试用 IndexedDB 实现并编写失败测试**

执行 `pnpm add -D fake-indexeddb`。在 `tests/incidentRepository.test.mjs` 中使用 `fake-indexeddb/auto` 编写：

```js
test('round-trips incidents, timeline, batches and demo settings through IndexedDB', async () => {
  const repo = createIndexedDbIncidentRepository({ indexedDB, dbName: 'incident-test' });
  await repo.initialize(createDemoIncidentSeed());
  await repo.saveIncidentWithTimeline(incident, entry);
  assert.deepEqual(await repo.getIncident(incident.id), incident);
  assert.deepEqual(await repo.listTimeline(incident.id), [entry]);
});

test('does not seed twice and reports schema migration failures', async () => { /* ... */ });
```

- [ ] **Step 2: 运行 Repository 测试，确认 RED**

Run: `pnpm exec node --test tests/incidentRepository.test.mjs`
Expected: FAIL，原因是 Repository 与 IndexedDB 适配器不存在。

- [ ] **Step 3: 实现 Repository 契约和 IndexedDB 适配器**

- `contracts.ts` 定义读取、写入、批量事务、删除、设置与初始化方法；保存事件状态改变时必须与时间线条目同一逻辑事务完成。
- 内存实现用于应用服务测试，不得成为生产默认。
- IndexedDB 使用命名数据库与显式 object store：`incidents`、`timeline`、`importBatches`、`settings`；升级路径根据 `schemaVersion` 处理。
- `initialize()` 只在数据库首次为空时写入管理员、调度员、主管、分类与少量演示事件，不覆盖用户保存数据。
- 对 IndexedDB 不可用、打开失败、升级失败提供可由 UI 捕获的结构化错误，而非静默回退到 localStorage。

- [ ] **Step 4: 运行 Repository 测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentRepository.test.mjs`
Expected: PASS，确认重新打开数据库可恢复记录、种子不重复、错误路径可识别。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录依赖变更、测试命令和通过结果；不执行 commit、push 或部署。

## Task 3: 实现事件用例服务与 CSV / GeoJSON 批量导入

**Files:**
- Create: `src/incidents/application/incidentService.ts`
- Create: `src/incidents/application/incidentImport.ts`
- Create: `tests/incidentService.test.mjs`
- Create: `tests/incidentImport.test.mjs`

**Interfaces:**
- Consumes: Task 1 的状态机/权限/校验和 Task 2 的 `IncidentWorkspaceRepository`。
- Produces: `IncidentService` 的 `create`, `assign`, `start`, `update`, `submitForReview`, `review`, `cancel`, `importFile`, `revokeBatch`；Task 4/6 使用这些命令，不直接写 Repository。

- [ ] **Step 1: 编写失败的命令与导入测试**

在 `tests/incidentService.test.mjs` 中覆盖：

```js
test('appends a timeline entry for every permitted command', async () => {
  await service.assign(incident.id, assignee.id, dispatcher);
  assert.equal((await repo.getIncident(incident.id)).status, 'assigned');
  assert.equal((await repo.listTimeline(incident.id)).at(-1).action, 'assigned');
});

test('rejects a supervisor-only approval from a dispatcher without writes', async () => { /* ... */ });
```

在 `tests/incidentImport.test.mjs` 中覆盖 CSV 映射、GeoJSON 点/面、默认分类/严重等级、混合有效与无效记录、错误行摘要，以及批次撤销的原子拒绝。

- [ ] **Step 2: 运行用例测试，确认 RED**

Run: `pnpm exec node --test tests/incidentService.test.mjs tests/incidentImport.test.mjs`
Expected: FAIL，原因是 `IncidentService` 与导入解析器尚未实现。

- [ ] **Step 3: 实现命令服务与导入解析器**

- `IncidentService` 每个成功命令递增 `version`、更新 `updatedAt` 并创建不可变时间线条目；写入由 Repository 统一完成。
- `importFile(file, mapping, actor)` 只支持 `.csv`、`.geojson`、`.json`；CSV 支持标题、分类、严重等级、经纬度的显式字段映射，GeoJSON 使用 feature properties 与 geometry。
- 返回 `ImportPreview`（字段、前若干条预览、映射候选）和 `ImportResult`（批次、成功事件、行错误）；无效记录不能静默丢弃。
- `revokeBatch(batchId, actor)` 先读取该批次所有事件；仅全部仍为 `unassigned` 才删除事件及其时间线、将批次标记 `revokedAt`。任一事件非待分派时抛出可显示的原因，且不写入部分删除。

- [ ] **Step 4: 运行用例测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentService.test.mjs tests/incidentImport.test.mjs`
Expected: PASS，包含部分导入、权限拒绝和批次撤销原子性。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录通过的命令和测试；不执行 commit、push 或部署。

## Task 4: 构建事件 Workspace、系统地图层与旧工作区快照隔离

**Files:**
- Create: `src/incidents/presentation/incidentContext.ts`
- Create: `src/incidents/presentation/useIncidentWorkspace.ts`
- Create: `src/incidents/presentation/incidentMapLayer.ts`
- Modify: `src/types/gis.ts`
- Modify: `src/stores/map.ts`
- Modify: `src/workspace.ts`
- Modify: `src/composables/useWorkspacePersistence.ts`
- Create: `tests/incidentPresentation.test.mjs`

**Interfaces:**
- Consumes: Task 2 的生产 Repository、Task 3 的 `IncidentService`、现有 `MapFacade` 和 `useMapStore()`。
- Produces: `IncidentWorkspaceContext`、`incidentContextKey`、`createIncidentSystemLayer()` 和 `syncIncidentSystemLayer()`；Task 5/6 的布局和 UI 通过 injection 消费。

- [ ] **Step 1: 编写失败的工作区与系统层测试**

在 `tests/incidentPresentation.test.mjs` 中断言：

```js
test('maps each incident to a stable read-only system feature', () => {
  const layer = createIncidentSystemLayer([incident]);
  assert.equal(layer.system, 'incidents');
  assert.equal(feature.getId(), incident.id);
  assert.equal(feature.get('incidentId'), incident.id);
});

test('does not serialize incident system layers into the generic workspace snapshot', () => {
  assert.deepEqual(createSnapshot({ layers: [incidentLayer] }).layers, []);
});
```

增加一项恢复测试：多次 hydrate/sync 后 `mapStore.layers` 只有一个 `__incidents__` 系统层。

- [ ] **Step 2: 运行工作区测试，确认 RED**

Run: `pnpm exec node --test tests/incidentPresentation.test.mjs`
Expected: FAIL，原因是事件 Workspace 和系统层尚不存在。

- [ ] **Step 3: 实现 Presentation Context 与地图同步**

- 在 `LayerRecord` 添加可选 `system?: 'incidents'`；`dataLayers`、普通图层列表、`workspace.ts` 序列化和 `useWorkspacePersistence` 自动保存均排除 `system` 层。
- `incidentMapLayer.ts` 将 `Incident` 映射为 OpenLayers Feature，Feature ID 和 `incidentId` 均使用事件 ID，属性至少包含 `status`、`severity`、`title`；状态/严重等级通过既有矢量样式/分类机制保持 2D/3D 通用渲染。
- `useIncidentWorkspace.ts` 在 AppView 提供单例响应式事件状态；异步 hydrate 后创建或刷新名为“事件”的 `__incidents__` 系统层。更新时替换/同步该层，不能保留重复图层。
- 事件系统层添加/删除通过既有 `mapStore` 与 `MapFacade.addLayer/removeLayer` 成对进行；不把业务状态机写入 MapFacade。
- 现有“清空工作区”仅清理普通 GIS 工作区快照；事件 IndexedDB 数据保持，由 Incident Workspace 在清理后重建系统层。管理员专属的“重置本地演示数据”在 Task 7 提供。

- [ ] **Step 4: 运行工作区测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentPresentation.test.mjs`
Expected: PASS，确认稳定 feature ID、系统层去重、快照隔离。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录系统层与持久化边界的验证结果；不执行 commit、push 或部署。

## Task 5: 扩展地图拾取、统一选择与工作台导航契约

**Files:**
- Modify: `src/map/facade/types.ts`
- Modify: `src/components/MapView.vue`
- Modify: `src/map/MapManager.ts`
- Modify: `src/map/CesiumManager.ts`
- Modify: `src/stores/selection.ts`
- Modify: `src/composables/useWorkbenchLayout.ts`
- Modify: `src/layout/workbenchNavigation.ts`
- Modify: `src/tools/toolMeta.ts`
- Modify: `src/tools/toolRegistry.ts`
- Modify: `src/layout/TaskRail.vue`
- Modify: `tests/workbenchLayout.test.mjs`
- Modify: `tests/workbenchNavigation.test.mjs`
- Create: `tests/incidentMapSelection.test.mjs`

**Interfaces:**
- Consumes: Task 4 的 `incidentContextKey`、系统层 ID 与事件 Feature 属性。
- Produces: `MapFacade.captureGeometry(kind)`, `MapFacade.cancelGeometryCapture()`, `SelectionTarget` 的 `incident` 分支、`WorkbenchSection = 'incidents'`、`ToolId = 'incidents'`、`BottomDrawerTab = 'incidentTimeline'`。

- [ ] **Step 1: 编写失败的导航、选择与拾取契约测试**

扩展导航测试：

```js
test('routes incidents to its dedicated content workspace', () => {
  assert.equal(getDefaultTool('incidents'), 'incidents');
  assert.equal(getToolHost('incidents'), 'content');
});

test('opens an incident timeline drawer without replacing the active incident content tool', () => { /* ... */ });
```

在 `tests/incidentMapSelection.test.mjs` 中以纯 mapper/selection bridge 测试断言：系统层 Feature 的 `incidentId` 会选择对应事件，非系统要素保持现有图层/要素选择行为。

- [ ] **Step 2: 运行导航与选择测试，确认 RED**

Run: `pnpm exec node --test tests/workbenchLayout.test.mjs tests/workbenchNavigation.test.mjs tests/incidentMapSelection.test.mjs`
Expected: FAIL，原因是 `incidents` 区域、`incidentTimeline` 和 incident 选择目标尚未定义。

- [ ] **Step 3: 实现地图几何拾取与选择桥接**

- 扩展 `MapFacade` 为通用的 `captureGeometry(kind: 'Point' | 'Polygon'): Promise<GeoJSON.Geometry | undefined>` 与 `cancelGeometryCapture()`；不得以事件业务名称污染基础地图接口。
- 2D 通过 `MapManager` 的临时点击/绘制交互捕获一次 Geometry；3D 复用 `CesiumManager` 的现有绘制/拾取机制捕获等价 EPSG:4326 Geometry。取消、引擎切换、组件卸载必须解除临时交互并 resolve `undefined`。
- `MapView` 仅转发 facade 操作；保持当前 Cesium 按需加载边界，不能重新静态 import Cesium。
- 扩展 `selection.ts` 让 `incidentId` 成为统一选择源的一部分；选择普通图层或普通要素时清除 incident，选择 incident 时清除普通图层/要素详情冲突。
- `useWorkbenchLayout` 将 `SelectionTarget.kind === 'incident'` 映射为 `InspectorTarget = 'incident'`；关闭检查器调用统一 `selection.clear()`。

- [ ] **Step 4: 实现事件导航契约**

- 将 `incidents` 加到 `ToolId`、`toolTitles`、`toolRegistry` 与 `WorkbenchSection`；注册内容区的 `IncidentTool` 占位组件。
- 在 `workbenchSections` 添加标签“事件”、默认工具 `incidents`；在 `TaskRail` 加对应字形并保留既有唯一一级导航结构。
- 将 `incidentTimeline` 加入 `BottomDrawerTab`，但不要把它作为 `ToolId`：它由 `openBottomDrawer('incidentTimeline')` 打开，因此不会卸载 `incidents` 内容工作区。

- [ ] **Step 5: 运行导航与选择测试，确认 GREEN**

Run: `pnpm exec node --test tests/workbenchLayout.test.mjs tests/workbenchNavigation.test.mjs tests/incidentMapSelection.test.mjs`
Expected: PASS；现有内容/数据/时间/监测路由测试保持通过。

- [ ] **Step 6: 记录任务结果，不执行提交**

记录 2D/3D 拾取接口、选择桥接和导航契约结果；不执行 commit、push 或部署。

## Task 6: 实现事件队列、人工新建和导入批次工作区

**Files:**
- Create: `src/tools/components/IncidentTool.vue`
- Create: `src/incidents/components/IncidentQueuePanel.vue`
- Create: `src/incidents/components/IncidentFormDialog.vue`
- Create: `src/incidents/components/IncidentImportDialog.vue`
- Create: `src/incidents/components/ImportBatchPanel.vue`
- Create: `src/incidents/components/incident-workspace.css`
- Modify: `src/layout/ContentPanel.vue`
- Modify: `src/layout/AppTopbar.vue`
- Modify: `src/tools/workspaceContext.ts` (仅在需要暴露通用抽屉开关时；事件业务数据仍使用独立 Incident Context)
- Create: `tests/incidentWorkspaceUi.test.mjs`

**Interfaces:**
- Consumes: Task 3 的应用服务、Task 4 的 `IncidentWorkspaceContext`、Task 5 的导航和 `captureGeometry()`。
- Produces: 可由 `incidents` 工具加载的队列/导入批次界面、人工创建表单和事件导入向导。

- [ ] **Step 1: 编写失败的 UI 契约测试**

在 `tests/incidentWorkspaceUi.test.mjs` 复用 `tests/startupLoading.test.mjs` 的 `node:fs/promises` + `readProjectFile()` helper，并使用源文件/纯视图模型断言：

```js
test('event tool exposes queue and import batch workspaces without content/data duplicate navigation', async () => {
  assert.match(await readProjectFile('src/tools/components/IncidentTool.vue'), /事件队列/);
  assert.match(await readProjectFile('src/tools/components/IncidentTool.vue'), /导入批次/);
  assert.doesNotMatch(await readProjectFile('src/layout/ContentPanel.vue'), /事件.*数据.*tablist/);
});
```

同时为队列视图模型测试状态/严重等级筛选和按更新时间排序；对表单模型测试“地图拾取返回 undefined 时不创建事件”。

- [ ] **Step 2: 运行 UI 契约测试，确认 RED**

Run: `pnpm exec node --test tests/incidentWorkspaceUi.test.mjs`
Expected: FAIL，原因是事件组件和表单模型不存在。

- [ ] **Step 3: 实现队列、创建与导入组件**

- `IncidentTool.vue` 在内部用二级 tabs 承载“事件队列 / 导入批次”，不改造 ContentPanel 为第二套顶级导航。
- 队列显示状态、严重等级、标题、分派人、更新时间；支持状态筛选、严重等级筛选和点击选择/定位。
- `IncidentFormDialog` 提供标题、分类、严重等级、说明、分派对象、点位/影响范围采集；“从地图拾取点位”和“绘制影响范围”调用 Task 5 的基础地图 capture API。取消或拾取失败时不提交。
- `IncidentImportDialog` 完成 CSV 字段映射预览、GeoJSON 预览、错误摘要和确认导入；只接受 `.csv,.geojson,.json`。不要改动顶栏现有通用 GIS 导入行为。
- `ImportBatchPanel` 显示来源、成功/失败数、错误摘要和撤销按钮；不满足撤销条件时显示领域服务返回的明确原因。
- 顶栏新增轻量“新建事件”快捷入口，只有管理员/调度员可用；普通图层导入按钮保持现状。

- [ ] **Step 4: 运行 UI 契约测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentWorkspaceUi.test.mjs`
Expected: PASS，队列、二级 tabs、导入限制、取消拾取和筛选视图模型均被覆盖。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录 P1 数据工作流可见界面的验证结果；不执行 commit、push 或部署。

## Task 7: 实现演示角色、事件检查器、时间线与端到端工作台联动

**Files:**
- Create: `src/incidents/components/DemoRoleSwitch.vue`
- Create: `src/incidents/components/IncidentInspector.vue`
- Create: `src/incidents/components/IncidentTimelineDrawer.vue`
- Modify: `src/layout/AppTopbar.vue`
- Modify: `src/layout/InspectorPanel.vue`
- Modify: `src/layout/BottomDrawer.vue`
- Modify: `src/views/AppView.vue`
- Modify: `src/composables/useMapWorkspace.ts`
- Modify: `src/tools/workspaceContext.ts`（仅增加关闭专用抽屉所需最小接口）
- Create: `tests/incidentRoleWorkflow.test.mjs`
- Modify: `tests/workbenchLayout.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6 的 Incident Context、`InspectorTarget = 'incident'`、`BottomDrawerTab = 'incidentTimeline'`。
- Produces: 顶栏“演示角色”切换、角色限制的检查器动作、可关闭且不卸载内容区的事件时间线、AppView 中的 Incident Context Provider。

- [ ] **Step 1: 编写失败的角色工作流测试**

在 `tests/incidentRoleWorkflow.test.mjs` 中测试：

```js
test('shows only permitted workflow actions for each demo role', () => {
  assert.deepEqual(getVisibleIncidentActions('dispatcher', pendingReview), ['view']);
  assert.ok(getVisibleIncidentActions('supervisor', pendingReview).includes('approve'));
});

test('keeps active incidents content open when opening and closing incident timeline', () => { /* layout harness */ });
```

覆盖：管理员能编辑成员/分类；调度员无法审核；主管无法新建/导入；关闭事件时间线不清空事件选择；Escape 在事件抽屉打开时关闭抽屉而非关闭内容工具。

- [ ] **Step 2: 运行角色工作流测试，确认 RED**

Run: `pnpm exec node --test tests/incidentRoleWorkflow.test.mjs tests/workbenchLayout.test.mjs`
Expected: FAIL，原因是演示角色组件、事件检查器和事件抽屉尚不存在。

- [ ] **Step 3: 接入角色、检查器和时间线 UI**

- `AppTopbar` 使用 `DemoRoleSwitch` 显示“演示角色：管理员/调度员/主管（本地）”；角色来自 Incident Context，禁止复用或伪造真实用户会话。
- `AppView` 创建并 `provide(incidentContextKey, incidentWorkspace)`；地图 ready 后先恢复普通 GIS 工作区，再 hydrate 事件数据并同步事件系统层，避免恢复顺序造成重复系统层。
- `InspectorPanel` 在 `inspectorTarget === 'incident'` 时渲染 `IncidentInspector`；其他 layer/feature/tool 分支保持不变。
- `IncidentInspector` 显示事件详情、状态、分派、处置说明、审核理由和领域允许的动作；按钮状态必须由 Task 1 权限/状态机结果驱动。
- `BottomDrawer` 在 `incidentTimeline` 分支直接渲染 `IncidentTimelineDrawer`，并把“事件记录”作为与时间轴/回放/实时并存的 tab。该 tab 不经 `activeTool` 打开。
- 在 AppView 的 Escape 处理和/或工作台上下文中区分“工具驱动抽屉”与 `incidentTimeline`：前者沿用关闭 active tool，后者只调用 `closeBottomDrawer()`。
- 为管理员在事件工作区提供“重置本地演示数据”确认操作，调用 Repository 清空后重新写入种子数据；不得影响普通 GIS 图层工作区。

- [ ] **Step 4: 运行角色工作流测试，确认 GREEN**

Run: `pnpm exec node --test tests/incidentRoleWorkflow.test.mjs tests/workbenchLayout.test.mjs`
Expected: PASS，现有工作台抽屉/检查器回归仍通过，角色边界和 Escape 行为通过。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录 P2 演示角色和复盘闭环结果；不执行 commit、push 或部署。

## Task 8: 端到端回归、性能保护与可用性收束

**Files:**
- Modify: `tests/startupLoading.test.mjs`
- Modify: `tests/toolRegistry.test.mjs`
- Modify: `README.md`（增加“本地事件演示工作区”数据边界与浏览器存储说明）
- Modify: `docs/superpowers/specs/2026-10-07-spatial-incident-operations-prototype-design.md`（仅当实现中出现经批准的事实性澄清）

**Interfaces:**
- Consumes: Tasks 1–7 的全部公开接口。
- Produces: 最终回归证据、使用边界说明和性能保护测试。

- [ ] **Step 1: 写入最终失败回归测试**

扩展 `tests/startupLoading.test.mjs`：事件工作区只能在异步 `MapView` 路径后接入，禁止 `src/main.ts` 或 `AppView.vue` 新增 Cesium 同步 import。扩展 `tests/toolRegistry.test.mjs`：`incidents` 必须具有单一内容宿主，`incidentTimeline` 不是 ToolId 且不会破坏工具注册唯一性。

- [ ] **Step 2: 运行新增回归，确认 RED（在保护代码写入前）**

Run: `pnpm exec node --test tests/startupLoading.test.mjs tests/toolRegistry.test.mjs`
Expected: FAIL，直到事件工具及抽屉契约被正确实现并更新断言。

- [ ] **Step 3: 补齐回归保护与本地使用说明**

- 只在测试需要时调整实现，保持事件模块不触碰 `main.ts` 的同步 Cesium 入口；
- README 说明 IndexedDB 浏览器边界、演示角色不是登录、无跨浏览器同步、如何重置本地事件演示数据；
- 审查所有新建 UI 的空状态、加载、导入错误、权限提示、缩窄屏幕和 `prefers-reduced-motion` 行为。

- [ ] **Step 4: 运行完整验证**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check -- src tests README.md docs/superpowers
```

Expected: 所有测试通过、`vue-tsc --noEmit` 通过、生产构建退出码 0、差异格式检查无输出。构建后检查 `dist/assets`，确认 `CesiumManager-*.js` 仍为独立异步资源，`src/main.ts` 不同步引入 Cesium Widgets CSS。

- [ ] **Step 5: 记录任务结果，不执行提交**

记录测试数、类型检查、构建、分包和差异检查结果；遵守用户约束，不执行 commit、push 或部署。

## Plan Self-Review

- **规格覆盖：** Tasks 1–3 实现领域、导入、时间线和批次撤销；Tasks 4–5 实现 IndexedDB/地图/选择/导航边界；Tasks 6–7 实现事件队列、导入、角色、检查器、时间线和复盘；Task 8 覆盖性能、说明与完整验证。真实后端、真实身份、跨浏览器同步、附件和 SLA 均仍明确排除。
- **接口一致性：** 所有 UI 命令汇聚到 `IncidentService`；所有持久化通过 `IncidentWorkspaceRepository`；地图只消费系统 `LayerRecord`；`incidents` 是内容 ToolId，`incidentTimeline` 只是一种 BottomDrawerTab。
- **风险覆盖：** Review Focus 的五类风险分别被 Tasks 1/3、2/4、5/7 的测试覆盖。
- **范围比例：** 八个任务以可独立测试的业务边界划分；没有引入服务端、账号或真实协同子项目。
- **用户约束：** 所有任务明确省略 commit、push、部署步骤。
