# 新建事件：单一入口地图标注任务设计

- **日期：** 2026-10-08
- **状态：** 已获交互方向批准；待用户审阅本正式规格后进入实施计划
- **范围：** `E:\project\re-code\new-project` 的事件新建流程、地图采集 facade、2D/3D 临时采集控制与相关测试

## 1. 目标与已确认决策

本次重构解决“新建事件”表单把“从地图拾取点位”和“绘制影响范围”并列为两个技术操作的问题。调度人员的真实意图是标注事件，而不是预先选择 GeoJSON 几何类型。

已经确认的产品决策如下：

1. 事件位置与影响范围是**点位或范围二选一**；每个事件持续只保存一个 EPSG:4326 GeoJSON geometry。
2. 新建表单提供一个自然语言入口：**“在地图上标注”**；不在表单中预先要求用户理解点或面。
3. 新事件默认进入**地点落点**模式；范围是用户在地图任务中按需切换的替代方式。
4. 范围采集必须提供显式的**撤销上一点、完成绘制、取消**控制，同时保留双击、右键、Enter 和 Esc 快捷操作。
5. 采集时以地图为主，表单退出视觉焦点但草稿不丢失；完成或取消后回到同一份草稿。
6. 不修改事件领域状态机、IndexedDB/内存仓储、真实后端边界、普通 GIS 图层绘制语义或事件的单 geometry 数据模型。
7. 不执行 Git commit、push、部署、reset、checkout 或清理既有未提交改动。

## 2. 当前问题与重构范围

当前 `IncidentFormDialog.vue` 以一个 `capturing` boolean 及 `captureGeometry(kind): Promise` 控制两个并列按钮。它把地图采集变成表单内的 loading 操作，无法表达：当前模式、顶点数量、是否可撤销、是否可完成、模式切换、正常取消与引擎切换/卸载后的恢复。

现有 `MapManager` 与 `CesiumManager` 都已经拥有一次性临时 geometry 的基础能力，但缺少可控采集会话：

- 2D OpenLayers 使用临时 `Draw` 和临时图层，但没有把 `removeLastPoint()`、`finishDrawing()`、顶点进度暴露给事件 UI；
- 3D Cesium 使用临时顶点、预览实体和 Promise resolve，但没有撤销、任务进度或显式完成接口；
- `MapView` 在切换引擎、清空图层与卸载时会取消采集，但事件表单无法将这些取消识别为正常返回。

重构只覆盖“事件位置标注”这个临时任务，不接管普通绘制、量测、空间查询或事件投影图层。

## 3. 用户体验：一个入口，地图内选择模式

### 3.1 表单状态

位置字段按草稿状态渲染：

| 草稿状态 | 主内容 | 操作 |
| --- | --- | --- |
| 尚无 geometry | “尚未标注事件位置” | `在地图上标注` |
| Point | “已标注地点” | `调整标注`、`清除` |
| Polygon | “已圈定影响范围” | `调整标注`、`清除` |

表单中不再出现“从地图拾取点位”“绘制影响范围”“取消地图拾取”等按钮，也不使用按钮 loading 表示正在采集。表单仍可说明数据边界，例如“仅保存本事件的地图标注，不创建普通 GIS 图层”。

`调整标注` 也是单一入口。新事件及调整后的默认模式均为地点；用户可在任务卡中切换为范围。开始调整时，原草稿 geometry 作为参考轮廓可见，但不会被改写，直到新任务成功完成。

### 3.2 地图任务态

点击单一入口后，表单不销毁、不重置且不产生事件；它退出视觉与键盘焦点，地图成为主操作区。实现不得通过普通关闭表单的路径触发 `reset()`，而应使用显式的 `form` / `map-task` 展示状态保留同一份本地草稿。

新建事件草稿是独立于对话框可见性的 session：标题、分类、等级、说明、分派和 geometry 必须跨“关闭表单 → 再次打开”、取消地图任务、引擎切换和相关组件卸载保持不变。`reset()` 只能在事件创建成功后，或未来出现用户明确确认的“放弃草稿”操作时执行；当前的 `@close`、任务取消和生命周期清理都不得调用它。这样“关闭”是返回工作台，而不是隐式丢弃用户已经输入的事件信息。

`IncidentMapCaptureTask` 通过 Teleport 渲染到 `.atlas-map-stage` 内，置于地图画布的固定、紧凑任务卡位置，避开左上角地图快捷控制、右侧检查器、底部状态提示和三维加载遮罩。任务卡使用现有 Graphite Atlas token，不复制任何外部产品的品牌、资产或外观。

默认地点模式：

```text
标注事件位置
[ 地点 ] [ 圈定范围 ]
在地图上单击以确定事件位置。
                         Esc 取消
```

在地点模式中，一次有效地图单击立即完成采集、关闭任务卡、将 geometry 写回表单草稿并恢复表单视觉焦点。

范围模式：

```text
圈定事件影响范围
单击添加顶点；至少 3 点后可完成。
已添加 N 个顶点
[ 撤销上一点 ] [ 完成绘制 ] [ 取消 ]
双击、右键或 Enter 完成；Esc 取消。
```

- `撤销上一点` 在没有顶点时禁用；
- `完成绘制` 在少于三个顶点时禁用；
- 模式切换只丢弃**尚未完成的临时顶点**，绝不清空原草稿 geometry；
- 完成后范围替换草稿中的点位，或点位替换草稿中的范围；二者不会同时保存；
- `清除` 是表单内显式操作，清除当前草稿 geometry，不创建事件，也不影响普通 GIS 图层；
- 取消、Esc、任务卡关闭、地图引擎切换和组件卸载都只清理临时会话与参考叠加，随后返回保留草稿的表单。

### 3.3 可访问性和键盘优先级

任务卡带有 `role="status"`/适当的可见状态文本，并为模式、顶点数量、不可用按钮和完成条件提供可读标签。进入任务时焦点落到任务标题或当前模式控件；完成、取消和故障返回时焦点回到表单的“在地图上标注”或“调整标注”入口。

`AppView` 的全局 Escape 处理必须优先识别活动事件标注任务：活动任务时 Esc 取消任务并阻止其继续关闭抽屉、检查器或内容面板；没有活动任务时维持既有行为。Enter、双击、右键只对范围任务生效，且 2D/3D 具有等价完成语义。

## 4. 可测试的采集会话状态机

以显式 session 替换表单 `capturing` boolean 与悬挂 Promise 的 UI 语义。UI 状态至少包含：

```ts
type IncidentCapturePhase = 'idle' | 'locating' | 'outlining';
type IncidentCaptureMode = 'Point' | 'Polygon';

interface IncidentCaptureState {
  phase: IncidentCapturePhase;
  mode?: IncidentCaptureMode;
  vertexCount: number;
  originalGeometry?: GeoJSON.Geometry;
}
```

`originalGeometry` 仅作为任务参考与取消保护，不是第二个持久化字段。会话状态转换固定如下：

| 触发 | 前置状态 | 后续状态 | 草稿 geometry |
| --- | --- | --- | --- |
| 在地图上标注 / 调整标注 | idle | locating | 保持原值 |
| 切换到圈定范围 | locating 或 outlining | outlining，顶点归零 | 保持原值 |
| 切换回地点 | outlining | locating | 保持原值 |
| 地图单击（地点） | locating | idle | 用新 Point 替换 |
| 添加顶点 | outlining | outlining | 保持原值 |
| 撤销上一点 | outlining | outlining | 保持原值 |
| 完成范围 | outlining 且顶点 ≥ 3 | idle | 用新 Polygon 替换 |
| 取消 / Esc / 引擎切换 / 卸载 | locating 或 outlining | idle | 保持原值 |
| 清除 | idle | idle | 设为 undefined |

每次任务创建唯一 session 标识；来自旧 3D 引擎异步加载、旧事件监听器或已关闭会话的回调必须被忽略。任何终止路径必须保证：地图交互恢复、临时图层/实体清理、session 回到 `idle`、表单可见且草稿可继续编辑。

## 5. 地图 facade 与引擎责任

事件采集改为专用、受控 API，而不是在事件表单直接等待裸 Promise。命名可在实现计划中收敛，但接口必须表达以下能力：

```ts
startIncidentGeometryCapture(options: {
  mode: 'Point' | 'Polygon';
  referenceGeometry?: GeoJSON.Geometry;
  onProgress: (progress: {
    mode: 'Point' | 'Polygon';
    vertexCount: number;
    canUndo: boolean;
    canFinish: boolean;
  }) => void;
  onComplete: (geometry: GeoJSON.Geometry) => void;
  onCancel: () => void;
}): void;

setIncidentGeometryCaptureMode(mode: 'Point' | 'Polygon'): void;
undoIncidentGeometryCapture(): void;
finishIncidentGeometryCapture(): void;
cancelIncidentGeometryCapture(): void;
```

普通 `setDrawMode`、`finishDrawing`、`abortDrawing` 和图层绘制 API 保持普通 GIS 工作流语义。事件专用会话不得写入 `mapStore.layers`，不得创建业务事件，也不得覆盖普通绘制操作的持久化数据。

### 5.1 2D（OpenLayers）

`MapManager` 管理一个临时事件采集 layer、Draw interaction、参考 geometry 叠加及统一清理函数。范围模式复用 OpenLayers `Draw.removeLastPoint()` 和 `Draw.finishDrawing()`；绘制过程读取临时 geometry 的有效顶点数并向 facade 发送 progress。取消移除 interaction、临时 layer 和参考层，并恢复 Select/Modify。提交前用现有 `GeoJSON` 投影转换生成 EPSG:4326 geometry。

### 5.2 3D（Cesium）

`CesiumManager` 保留独立的临时顶点数组和预览实体；新增撤销最后一个顶点、显式完成和进度上报。范围预览显示已落顶点、跟随鼠标的边界及满足三点后的填充；参考 geometry 使用独立临时实体，且绝不成为普通图层或事件投影。完成时仅从落下顶点生成闭合 EPSG:4326 Polygon。清理时移除所有临时与参考实体，恢复相机输入和默认拾取交互。

### 5.3 MapView

`MapView` 是唯一跨引擎 facade：转发任务控制命令、保持 generation/session 防止懒加载 3D 的过期回调生效，并在引擎切换、清空数据层和卸载时有且仅有一次正常取消回调。它不拥有事件表单草稿，也不触发事件创建。

## 6. 组件与数据边界

建议新增下列受限模块：

- `src/incidents/presentation/incidentGeometryCaptureTask.ts`：纯状态转换、进度推导及取消/完成保护；无需 Vue 或地图依赖，可单测；
- `src/incidents/presentation/useIncidentCreateDraft.ts`：独立于对话框显示状态的单例草稿 session，负责草稿保留、成功创建后的重置及 geometry 写回；
- `src/incidents/presentation/useIncidentGeometryCaptureTask.ts`：连接状态机、注入的 `MapFacade` 与上述草稿 session；
- `src/incidents/components/IncidentMapCaptureTask.vue`：地图 Teleport 任务卡；
- 对 `IncidentFormDialog.vue` 的最小改动：单一入口、非破坏性表单隐藏、接收完成 geometry、清除/调整；
- 对 `MapFacade`、`MapView`、`MapManager`、`CesiumManager` 的受控会话实现。

不改变 `IncidentGeometry = GeoJSON.Geometry`、`IncidentDraft`、`IncidentService.create`、仓储 schema、事件状态机或 `incidentMapLayer` 的普通事件投影。提交表单时仍通过现有 `submitIncidentDraft` 仅在 geometry 存在时调用 `workspace.create`。

## 7. 测试与验证契约

新增和更新测试至少覆盖：

1. 纯状态机：初始地点、模式切换、范围顶点进度、少于三点不可完成、撤销、完成、取消、替换 geometry、取消保留旧 geometry；
2. 表单源/UI 契约：只有单一地图入口；表单不再出现两个原始 geometry 按钮；task 激活、关闭再打开、引擎切换和卸载时保留整份草稿；清除不创建事件；
3. 任务卡契约：地点/范围切换、可见顶点提示、撤销、完成、取消、键盘/手势提示和可访问名称；
4. facade 契约：2D 与 3D 都支持 `start / switch / undo / finish / cancel / progress`，2D 使用 OpenLayers 完成与撤销控制，3D 维护预览与清理；
5. 生命周期回归：地图未就绪时不启动；引擎切换、MapView 卸载、重复启动和过期异步回调不会写 geometry 或创建事件；
6. 既有领域、导入、仓储、角色和事件投影测试持续通过。

实施完成后按相关性依次运行新增事件任务测试、全部 `pnpm test`、`pnpm typecheck`、`pnpm build` 及 `git diff --check`。不以“已有未提交 worktree 实现”称为已部署或已交付；只有可访问预览或部署完成后才单独说明。

## 8. 验收清单

- [ ] 新建事件表单不存在两个并列的点/范围技术按钮；
- [ ] 用户通过一次“在地图上标注”进入地图优先任务，默认可单击落点；
- [ ] 范围选择只在地图任务卡中出现，提供顶点数、撤销、完成、取消和手势提示；
- [ ] 点和范围互斥，持久化数据仍是一个 EPSG:4326 GeoJSON geometry；
- [ ] 已有草稿 geometry 可调整或清除；取消替换时旧 geometry 完整保留；
- [ ] 取消、关闭、Esc、引擎切换和卸载不创建事件、不清空草稿、不遗留临时地图资源；
- [ ] 普通 GIS 图层绘制、事件状态机、仓储及数据投影未被语义性改变；
- [ ] 2D 与 3D 体验和测试契约一致；
- [ ] 未自动提交、推送或部署。
