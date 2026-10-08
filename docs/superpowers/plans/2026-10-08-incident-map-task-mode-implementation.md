# 单一入口事件地图标注任务 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将新建事件的位置采集从表单内的两个几何按钮重构为一个地图优先、可控且可测试的地点/范围标注任务。

**Architecture:** 以纯状态机和独立的创建草稿 session 承担生命周期语义；事件表单只启动/接收任务结果，地图任务卡通过 Teleport 进入 `.atlas-map-stage`。MapFacade 由一次性 Promise API 升级为进度回调和显式 `switch / undo / finish / cancel` 控制；MapView 统一转发到 OpenLayers 或 Cesium，并保证引擎切换和卸载正常取消任务。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Element Plus、OpenLayers 10、Cesium、Node 内建 `node:test`、pnpm / vue-tsc / Vite。

**Spec:** `docs/superpowers/specs/2026-10-08-incident-map-task-mode-design.md`

## Global Constraints

- 只在 `E:\project\re-code\new-project` 的现有 `main` 分支工作；不得创建 worktree、分支或额外项目目录。
- 保留现有工作树改动；禁止 `reset`、`checkout`、清理无关文件、自动 Git commit、push 或部署。
- 每个事件继续只持久化一个 EPSG:4326 `GeoJSON.Geometry`；点位和范围互斥，不新增发生点加影响范围的双几何模型。
- 不改变事件状态机、仓储/IndexedDB、真实后端边界、普通 GIS 图层绘制或事件系统图层投影语义。
- 不新增 npm 依赖；使用现有 OpenLayers `Draw.removeLastPoint()` / `finishDrawing()` 与 Cesium 临时实体能力。
- 先写会失败的测试，再写最小实现；每个任务结束运行该任务测试。提交步骤由用户明确禁止，全部省略。
- 最终只在代码完成后运行 `pnpm test`、`pnpm typecheck`、`pnpm build` 与 `git diff --check`；不得将未提交 worktree 实现称为部署或可访问交付。

## Review Focus

1. **替换取消：** 已有 Point/Polygon 进入调整后按 Esc 或取消，新草图和参考叠加消失，旧草稿 geometry 原样保留；由任务 1 和任务 4 的测试覆盖。
2. **不完整范围：** 0–2 个顶点时“完成绘制”必须不可用，双击、右键、Enter 也不得提交 Polygon；由任务 1、2、3 覆盖。
3. **异步 3D 切换：** Cesium 懒加载、切到另一引擎或组件卸载后，过期回调不得写入 geometry，也不得留下相机/拾取拦截；由任务 3 覆盖。
4. **工作流隔离：** 事件临时采集不得写进 `mapStore.layers`、普通 Draw layer 或事件仓储；由任务 2、3 的 facade/源契约测试覆盖。
5. **关闭与键盘：** 对话框关闭再打开、任务 Esc、任务卡取消均保留标题和其他草稿字段；Esc 在活动任务时优先取消任务而非关闭抽屉/检查器；由任务 1、4 覆盖。

---

## 文件结构与责任

| 文件 | 变更 | 责任 |
| --- | --- | --- |
| `src/incidents/presentation/incidentGeometryCaptureTask.ts` | 新建 | 无 Vue/地图依赖的 capture phase、模式、顶点进度和完成资格状态转换。 |
| `src/incidents/presentation/useIncidentCreateDraft.ts` | 新建 | 独立于对话框可见性的单例新建事件草稿 session；只在成功创建或未来显式放弃时重置。 |
| `src/incidents/presentation/useIncidentGeometryCaptureTask.ts` | 新建 | 将状态机、草稿和 `MapFacade` 回调组装为 UI 控制器。 |
| `src/map/facade/types.ts` | 修改 | 定义事件采集请求、进度与显式控制 facade 契约，移除事件表单对 Promise capture 的依赖。 |
| `src/map/MapManager.ts` | 修改 | 实现 OpenLayers 临时任务 layer、参考 geometry、顶点进度、撤销、完成、取消。 |
| `src/map/CesiumManager.ts` | 修改 | 实现 Cesium 临时顶点/参考实体、进度、撤销、完成、正常清理。 |
| `src/components/MapView.vue` | 修改 | 统一跨 2D/3D 路由并以 generation 防止过期异步完成。 |
| `src/incidents/components/IncidentMapCaptureTask.vue` | 新建 | Teleport 到地图舞台的紧凑任务卡、显式按钮和焦点返回。 |
| `src/incidents/components/IncidentFormDialog.vue` | 修改 | 单一业务入口、草稿 geometry 摘要、调整/清除；不再直接等待 capture Promise。 |
| `src/incidents/presentation/incidentUiState.ts` | 修改 | 保持表单可见性和地图任务返回的协调，不把关闭当成草稿清空。 |
| `src/tools/components/IncidentTool.vue` | 修改 | 与表单同级挂载地图任务卡，使 Teleport 有稳定的事件上下文。 |
| `src/incidents/components/incident-workspace.css` | 修改 | 表单 geometry 摘要和任务卡响应式样式，沿用 Graphite Atlas token。 |
| `src/views/AppView.vue` | 修改 | 活动事件任务优先处理 Escape；不得破坏原有抽屉/检查器快捷行为。 |
| `tests/incidentGeometryCaptureTask.test.mjs` | 新建 | 状态机、草稿保存和替换取消的可执行单元测试。 |
| `tests/incidentMapCaptureFacade.test.mjs` | 新建 | facade、2D/3D、MapView 生命周期和普通绘制隔离的契约回归。 |
| `tests/incidentMapTaskUi.test.mjs` | 新建 | 表单单一入口、任务卡控制、Teleport、键盘优先级的 UI 源契约回归。 |
| `tests/incidentWorkspaceUi.test.mjs` | 修改 | 用新的地图任务语义替换旧的 `取消地图拾取` 断言。 |

### Task 1: 草稿 session 与纯地图任务状态机

**Files:**
- Create: `src/incidents/presentation/incidentGeometryCaptureTask.ts`
- Create: `src/incidents/presentation/useIncidentCreateDraft.ts`
- Create: `tests/incidentGeometryCaptureTask.test.mjs`

**Interfaces:**
- Produces `IncidentCaptureMode = 'Point' | 'Polygon'`、`IncidentCapturePhase = 'idle' | 'locating' | 'outlining'`。
- Produces `IncidentGeometryCaptureState`：`phase`、可选 `mode`、`vertexCount`、可选 `originalGeometry`。
- Produces pure helpers `startIncidentGeometryCapture(originalGeometry?)`、`setIncidentGeometryCaptureMode(state, mode)`、`setIncidentGeometryCaptureVertexCount(state, count)`、`canFinishIncidentGeometryCapture(state)`、`cancelIncidentGeometryCapture(state)`。
- Produces `useIncidentCreateDraft()`，返回一个稳定的响应式 draft 及 `resetAfterCreated()`、`clearGeometry()`；关闭/重新打开不调用 reset。

- [ ] **Step 1: 写入失败的状态机与草稿测试**

在 `tests/incidentGeometryCaptureTask.test.mjs` 导入上述纯 helpers 和草稿 session。覆盖：无 geometry 启动默认得到 `{ phase: 'locating', mode: 'Point', vertexCount: 0 }`；切换 Polygon 将顶点归零；`vertexCount < 3` 时 `canFinish... === false`；三个顶点时为 true；取消调整中的 Polygon 返回 idle 且原 Point geometry 未被替换；关闭/再次获取草稿 session 后标题、说明和 geometry 仍存在，而 `resetAfterCreated()` 才清空它们。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec node --test tests/incidentGeometryCaptureTask.test.mjs`  
Expected: FAIL，因为状态机和草稿 session 模块尚不存在。

- [ ] **Step 3: 实现纯状态机与草稿 session**

在 `incidentGeometryCaptureTask.ts` 中仅实现不可变状态转换和派生完成资格，不导入 Vue、OpenLayers 或 Cesium。`cancelIncidentGeometryCapture` 必须返回 `idle` 状态，并保留调用方可用于恢复的 `originalGeometry` 值。

在 `useIncidentCreateDraft.ts` 中用 Vue 的单例响应式对象保存 `title`、`categoryId`、`severity`、`description`、`assignedTo` 与可选 `geometry`；默认值必须与现有表单一致（`other` / `medium`）。不要把表单 `visible` 状态作为 reset 条件。

- [ ] **Step 4: 运行状态机测试确认通过**

Run: `pnpm exec node --test tests/incidentGeometryCaptureTask.test.mjs`  
Expected: PASS，且测试能证明取消替换和关闭重开均不丢草稿。

### Task 2: 事件采集 facade 与 OpenLayers 2D 受控会话

**Files:**
- Modify: `src/map/facade/types.ts:6-37`
- Modify: `src/map/MapManager.ts:73-75, 224-276, 528-536`
- Create: `tests/incidentMapCaptureFacade.test.mjs`

**Interfaces:**
- Consumes：任务 1 的 `IncidentCaptureMode` 语义，但地图 facade 使用无 Vue 的类型定义。
- Produces `IncidentGeometryCaptureProgress`：`mode`、`vertexCount`、`canUndo`、`canFinish`。
- Produces `IncidentGeometryCaptureRequest`：`mode`、可选 `referenceGeometry`、`onProgress(progress)`、`onComplete(geometry)`、`onCancel()`。
- Replaces事件采集入口为：
  - `startIncidentGeometryCapture(request: IncidentGeometryCaptureRequest): void`
  - `setIncidentGeometryCaptureMode(mode: IncidentCaptureMode): void`
  - `undoIncidentGeometryCapture(): void`
  - `finishIncidentGeometryCapture(): void`
  - `cancelIncidentGeometryCapture(): void`

- [ ] **Step 1: 写入失败的 facade/2D 契约测试**

在 `tests/incidentMapCaptureFacade.test.mjs` 读取 facade、`MapManager.ts` 与 `CesiumManager.ts` 源文件。断言 `MapFacade` 定义五个事件专用方法与 `referenceGeometry`/`onProgress`；断言 `MapManager` 使用 `Draw.removeLastPoint()` 和 `Draw.finishDrawing()`、有独立 reference layer/feature 清理路径，并不向 `mapStore.layers` 写入。为范围不足 3 点时不得完成写入明确源/纯逻辑断言。

- [ ] **Step 2: 运行 facade 测试确认失败**

Run: `pnpm exec node --test tests/incidentMapCaptureFacade.test.mjs`  
Expected: FAIL，因为现有 facade 只有 `captureGeometry(kind): Promise`，没有显式控制 API。

- [ ] **Step 3: 更新 `MapFacade` 并实现 2D 会话**

将 `captureGeometry` / `cancelGeometryCapture` 的事件表单接口替换为上面的 request/controller 契约；普通 `setDrawMode`、`finishDrawing`、`abortDrawing` 保持原样。

在 `MapManager` 中把 `geometryCaptureResolve` 替换为单个受控 session：保存 request、临时 Draw、临时任务 layer、可选参考 feature 和 geometry change listener。`start...` 创建不进入 `mapStore.layers` 的临时 layer，将 `referenceGeometry` 以 EPSG:4326 → EPSG:3857 转换并以非交互参考样式加入；Point 单击调用 `onComplete`；Polygon 在每次顶点变化时发送准确 `vertexCount` 和 `canFinish`。

`set...Mode` 只清空当前未完成顶点并保留 reference/request；`undo...` 调用 `Draw.removeLastPoint()` 并重新发进度；`finish...` 只在三个有效顶点后调用 `Draw.finishDrawing()`；`cancel...` 仅调用一次 `onCancel`，移除 interaction/layer/参考 feature 并恢复 Select/Modify。空间查询、普通绘制、清空数据层和 dispose 调用同一正常取消路径。

- [ ] **Step 4: 运行 facade 测试确认通过**

Run: `pnpm exec node --test tests/incidentMapCaptureFacade.test.mjs`  
Expected: PASS，2D 契约包含进度、撤销、完成、取消和普通图层隔离。

### Task 3: Cesium 3D 会话与 `MapView` 跨引擎生命周期

**Files:**
- Modify: `src/map/CesiumManager.ts:83-87, 139-218, 220-299, 345`
- Modify: `src/components/MapView.vue:28, 41-84, 142-157, 205-231`
- Modify: `tests/incidentMapCaptureFacade.test.mjs`

**Interfaces:**
- Consumes：任务 2 的 `IncidentGeometryCaptureRequest` 和五个 facade 命令。
- Produces：2D 与 3D 相同的 `onProgress` / `onComplete` / `onCancel` 语义；`MapView` 永远只把活动 generation 的结果转发给请求回调。

- [ ] **Step 1: 扩展失败的跨引擎测试**

在 `tests/incidentMapCaptureFacade.test.mjs` 增加断言：`CesiumManager` 有受控 start/switch/undo/finish/cancel 方法，Polygon 少于三点不调用 complete，撤销会缩减临时顶点，清理移除预览与参考实体并恢复 input/pick interaction。`MapView` 必须在 `switchEngine`、`clearLayers` 和 `onBeforeUnmount` 走事件任务取消，并以 generation/session guard 忽略过期 3D 加载结果。

- [ ] **Step 2: 运行扩展测试确认失败**

Run: `pnpm exec node --test tests/incidentMapCaptureFacade.test.mjs`  
Expected: FAIL，因为当前 3D 代码只解析 Promise，缺少 undo/progress/reference 和显式 finish facade。

- [ ] **Step 3: 实现 Cesium 会话与 MapView 路由**

将 Cesium 的 `geometryCaptureResolve` 改为 request callbacks；为 `referenceGeometry` 创建独立临时实体。范围点击后立刻更新 `vertexCount`，鼠标移动只更新预览，不增加顶点；`undo...` 删除最后一个位置并重绘；`finish...` 仅在 3 点以上生成闭合 WGS84 Polygon；双击、右键、Enter 调用同一个 finish 入口。所有完成、取消、模式切换和 destroy 必须清理预览/参考实体并恢复相机输入与默认 pick handler。

在 `MapView` 中以现有 `geometryCaptureGeneration` 演化成受控 session guard：向当前引擎转发五个 API；3D 懒加载期间若 session 已被取消或引擎已切换，只触发一次正常 cancel，绝不启动陈旧采集；`switchEngine`、`clearLayers`、卸载统一取消活动任务。不要让该逻辑修改事件草稿或创建事件。

- [ ] **Step 4: 运行跨引擎 facade 测试确认通过**

Run: `pnpm exec node --test tests/incidentMapCaptureFacade.test.mjs`  
Expected: PASS，2D/3D API 对齐且过期生命周期路径被覆盖。

### Task 4: 表单单一入口、地图任务卡与 Escape/focus 集成

**Files:**
- Create: `src/incidents/presentation/useIncidentGeometryCaptureTask.ts`
- Create: `src/incidents/components/IncidentMapCaptureTask.vue`
- Modify: `src/incidents/components/IncidentFormDialog.vue:1-143`
- Modify: `src/incidents/presentation/incidentUiState.ts:1-16`
- Modify: `src/tools/components/IncidentTool.vue:1-66`
- Modify: `src/incidents/components/incident-workspace.css:16-20`
- Modify: `src/views/AppView.vue:31-67, 76-98, 107-118`
- Create: `tests/incidentMapTaskUi.test.mjs`
- Modify: `tests/incidentWorkspaceUi.test.mjs:60-76`

**Interfaces:**
- Consumes：任务 1 的 draft/state、任务 2/3 的 `MapFacade` 控制方法。
- Produces `useIncidentGeometryCaptureTask()`：响应式 `state` / `active`、`begin(facade, originalGeometry?)`、`selectMode(mode)`、`undo()`、`finish()`、`cancel()`；完成只写回 draft.geometry，取消不写回。
- Produces `IncidentMapCaptureTask.vue`：当 `active` 时 `Teleport` 到 `.atlas-map-stage`，暴露地点/范围切换和任务 controls；不会创建事件。

- [ ] **Step 1: 写入失败的 UI/source 契约测试**

在 `tests/incidentMapTaskUi.test.mjs` 读取 `IncidentFormDialog.vue`、`IncidentMapCaptureTask.vue`、`IncidentTool.vue`、`AppView.vue` 与 CSS。断言表单只有“在地图上标注”/“调整标注”单一业务入口，不匹配旧的“从地图拾取点位”“绘制影响范围”“取消地图拾取”；任务卡包含 `Teleport`、`地点`、`圈定范围`、`撤销上一点`、`完成绘制`、`取消`、`Esc`、`Enter`；AppView 在通用抽屉处理之前检查活动任务。

更新 `incidentWorkspaceUi.test.mjs`：保留 `:modal="false"` 的地图可操作性断言，但改为检查单一入口与任务卡挂载，而不是旧 capture Promise/取消按钮文案。

- [ ] **Step 2: 运行 UI 测试确认失败**

Run: `pnpm exec node --test tests/incidentMapTaskUi.test.mjs tests/incidentWorkspaceUi.test.mjs`  
Expected: FAIL，因为任务卡组件和单一入口尚不存在，且旧按钮仍在表单中。

- [ ] **Step 3: 实现任务控制器与表单草稿流**

在 `useIncidentGeometryCaptureTask.ts` 中创建唯一控制器：开始时保存 `originalGeometry` 并请求默认 Point；进度更新任务状态；完成时将唯一 geometry 写入 `useIncidentCreateDraft()`，恢复表单可见性及触发元素焦点；取消/生命周期终止仅恢复表单，不改 draft.geometry。切换模式只调用 facade 并将顶点数归零。

改造 `IncidentFormDialog.vue` 以使用共享草稿：删除 `capturing`、`captureKind`、`capture()`、`cancelCapture()` 和 `watch(... reset())`。关闭 dialog 只隐藏，不重置草稿；创建成功后调用 `resetAfterCreated()`。未标注状态提供 `在地图上标注`；已有 Point/Polygon 提供 `调整标注` 与 `清除`；未 geometry 时的创建校验文案改为自然业务语言，不再要求用户选择点/面。

- [ ] **Step 4: 实现地图任务卡与工作台集成**

在 `IncidentMapCaptureTask.vue` 用 `<Teleport to=".atlas-map-stage">` 渲染紧凑任务卡。默认地点模式显示单击提示；范围模式显示顶点数，并将撤销/完成 disabled 状态直接绑定 facade progress。双击、右键、Enter 的提示要可见，Esc 由 AppView 统一处理。任务开始后把焦点放到任务卡，结束后回到表单入口。

在 `IncidentTool.vue` 将任务卡与两个 dialog 同级挂载，确保内容面板状态改变时地图任务仍共享事件上下文。扩展 CSS，避免与左上快捷控件、右侧检查器、底部提示重叠，并在窄屏下将卡片收敛为底部横向布局。

在 `incidentUiState.ts` 保留 dialog visible 状态但不耦合草稿 reset；在 `AppView.onWindowKeydown` 首先调用活动任务的 `cancel()`，调用 `preventDefault()` 后返回；没有活动任务时原有快捷逻辑不变。

- [ ] **Step 5: 运行 UI 测试确认通过**

Run: `pnpm exec node --test tests/incidentMapTaskUi.test.mjs tests/incidentWorkspaceUi.test.mjs tests/incidentGeometryCaptureTask.test.mjs`  
Expected: PASS，单一入口、地图任务 controls、草稿恢复与 Escape 优先级都有回归保护。

### Task 5: 端到端回归、类型检查与构建验证

**Files:**
- Modify only if verification exposes一个与本规格直接相关的缺陷；不得顺带重构无关工作区文件。
- Test: `tests/incidentGeometryCaptureTask.test.mjs`
- Test: `tests/incidentMapCaptureFacade.test.mjs`
- Test: `tests/incidentMapTaskUi.test.mjs`
- Test: `tests/incidentWorkspaceUi.test.mjs`

**Interfaces:**
- Consumes：任务 1–4 的最终接口。
- Produces：完整、可复核的验证证据；不产生 Git 提交或部署。

- [ ] **Step 1: 运行地图任务的目标测试集**

Run: `pnpm exec node --test tests/incidentGeometryCaptureTask.test.mjs tests/incidentMapCaptureFacade.test.mjs tests/incidentMapTaskUi.test.mjs tests/incidentWorkspaceUi.test.mjs`  
Expected: PASS，尤其验证取消替换、少于三点、普通图层隔离、3D 过期 guard 与 Escape 优先级。

- [ ] **Step 2: 运行完整测试套件**

Run: `pnpm test`  
Expected: PASS，现有事件领域、导入、仓储、角色、选择、工作台和启动体验测试不回归。

- [ ] **Step 3: 运行类型与构建验证**

Run: `pnpm typecheck && pnpm build`  
Expected: 两个命令均以退出码 0 完成；Vue template、MapFacade 和 Cesium/OpenLayers 类型一致。

- [ ] **Step 4: 检查变更完整性**

Run: `git diff --check`  
Expected: 无空白错误。随后使用 Git status/change summary 核对仅新增了本计划涉及的文件或直接相关修复，且没有执行 commit、push、部署、reset 或删除既有工作。

## 计划自审记录

- **规格覆盖：** 五个任务覆盖单一入口、草稿生命周期、状态机、2D/3D facade、参考 geometry、撤销/完成/取消、Teleport 任务卡、Escape/focus、数据边界和全量验证。
- **接口一致性：** `IncidentCaptureMode`、`IncidentGeometryCaptureRequest` 和五个 facade 命令先在任务 1/2 定义，任务 3/4 只消费同名接口。
- **Review Focus 覆盖：** 五类高风险输入均映射到任务 1–4 中的具体失败测试和最终目标测试集。
- **范围控制：** 计划不引入后端、数据库、协作服务、新依赖或普通 GIS 绘制重构；不包含任何 commit 步骤，以服从用户限制。
