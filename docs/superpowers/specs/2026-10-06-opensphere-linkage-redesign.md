# OpenSphere Atlas Workbench 联动体系重设计 spec（v2）

- 日期：2026-10-06
- 状态：**已获用户批准并实施完成**（Phase A–D 全部落地，typecheck / 21 项测试 / build 全部通过；实施摘要见文末第 12 节）
- 前置文档：`docs/superpowers/specs/2026-10-06-opensphere-atlas-workbench-design.md`（壳层与主题设计，本 spec 只演进「联动关系」，不推翻壳层）

## 1. 背景与问题

用户反馈「UI 之间的联动关系不清晰明了」。结合代码诊断，归纳为四类结构性问题（用户已确认全部成立）：

| # | 问题 | 结构性根源 |
| --- | --- | --- |
| 1 | 右侧面板不可预测 | `inspectorTarget` 有三种来源（`'layer'/'feature'/'tool'`）各自独立写入，清除规则散落在 `syncTool`/`syncSelection` |
| 2 | 工具落点不统一 | 各工具自行声明宿主（content/inspector/bottomDrawer），没有「什么类型去哪」的总规则 |
| 3 | 地图与面板缺双向联动 | 地图点选、图层树、检查器、属性表、结果列表各持局部状态，互不读写 |
| 4 | 残留与退出不干净 | 切换上下文后旧面板残留，靠补丁式修复（已发生两次） |

## 2. 标杆参照与提炼的联动设计原则

调研 ArcGIS Map Viewer、Mapbox Studio、Figma、SuperMap iClient，提炼：

| # | 原则 | 标杆做法 |
| --- | --- | --- |
| 1 | 选中驱动一切 | Figma 右侧面板完全由当前选中对象决定；ArcGIS 选中图层后 Settings 工具栏才出现对应配置 |
| 2 | 上下文按需出现 | ArcGIS 选项按对象类型动态出现；无选中时右侧不占位，地图最大化 |
| 3 | 双向互达 | Mapbox 点击地图反查图层并可跳转配置；图层/属性表/地图三向同步 |
| 4 | 面板位置由任务类型决定 | ArcGIS 左（深色）管内容结构、右（浅色）管配置，同类任务永远同一落点 |
| 5 | 即时反馈 | 配置改动立即上地图，边配边试 |
| 6 | 可退出、可预期 | ArcGIS 一键隐藏界面；切换上下文后旧面板确定性清除 |

## 3. 已确认的设计决策（与用户逐项澄清）

1. 痛点范围：上表四类全部纳入重设计。
2. 联动架构：**三区契约**——左操作、右检查、底数据流（用户在三个候选中选定）。
3. 双向联动深度：**统一选中核心**——一套 selection 状态被五端读写（用户在三个候选中选定）。

## 4. 三区契约（面板路由总规则）

| 区域 | 承载内容 | 驱动源 |
| --- | --- | --- |
| 左 · Content Panel | 所有工具操作面板：图层树/数据/地点、绘制/量测、查询/分析、坐标/WMS/搜索 | section（Primary Rail）+ 激活工具 |
| 右 · Inspector Panel | 仅上下文检查：图层属性/样式/筛选、要素详情、结果条目详情 | **仅由 selection 驱动**；无选中时容器不渲染，地图扩展 |
| 底 · Bottom Drawer | 时间性数据流：时间轴、轨迹回放、实时轨迹、属性表 | 激活工具中 `placement === 'bottom'` 者；**互斥单开**，后开替换前开 |

工具注册表新增 `placement: 'content' | 'bottom'` 字段；右侧不再允许承载工具面板。任何面板去哪由类型静态推导，不再由各工具自写 host 声明。

Primary Rail 只负责切换 section（决定左侧显示哪组工具），**不直接决定右侧/底部内容**。

## 5. 统一选中核心 `useSelection`

### 5.1 数据模型

```ts
export type SelectionTarget =
  | { kind: 'layer'; layerId: string }
  | { kind: 'feature'; layerId: string; featureId: string | number }
  | { kind: 'result'; toolId: string; itemId: string | number };

// src/stores/useSelection.ts（Pinia store）
export const useSelectionStore = defineStore('selection', {
  state: () => ({ current: null as SelectionTarget | null }),
  actions: {
    select(target: SelectionTarget) { this.current = target; },  // 新选中替换旧选中
    clear() { this.current = null; },
  },
});
```

约束：同一时刻最多一个选中对象；任何端调用 `select()` 即整体替换；`clear()` 全端收起。

### 5.2 派生关系

- `inspectorTarget` 由 `selection.current.kind` **computed 派生**（`layer→图层检查器`、`feature→要素检查器`、`result→结果检查器`），删除手工写入与清除补丁。
- 底部抽屉 `drawerTarget` = 当前激活工具中 `placement === 'bottom'` 的工具（派生或单值状态，实施时二选一，倾向派生）。

### 5.3 五端联动矩阵

| 端点 | 发出 select | 响应 selection | focus 行为 |
| --- | --- | --- | --- |
| 地图画布 | 点要素 → `select(feature)`；空白点击 → `clear()`（绘制态除外） | 高亮当前选中 | `focus(target)`：flyTo + 闪烁 |
| 图层树（左） | 点击图层 → `select(layer)` | 当前图层所在行高亮并滚动到可见 | — |
| 检查器（右） | 「缩放至」按钮 → 地图 focus | 按 `kind` 切换子面板；头部 × → `clear()` | — |
| 属性表（底） | 点击行 → `select(feature)` | 当前要素行滚动定位 | — |
| 结果列表（左） | 点击条目 → `select(result)` | 该条目高亮 | flyTo |

Map Facade 新增 `focus(target: SelectionTarget): void`（2D：`getView().animate`；3D：`camera.flyTo`），并配套短暂闪烁高亮。

## 6. 确定性生命周期（治残留）

| 场景 | 规则 |
| --- | --- |
| 切换 section | 只影响左侧工具面板组；selection 不清（右侧继续显示选中对象的属性——与 Figma/ArcGIS 一致） |
| 新 select | 替换旧 select，永不叠加 |
| Esc 优先级链 | ① 绘制/量测进行中 → 退出操作态；② 否则 `clear()` 选中 |
| 检查器关闭 | 头部 × 或 Esc → `clear()`，容器不渲染，地图扩展 |
| 底部抽屉 | 跟随激活工具（`placement==='bottom'`）：工具失活即收；面板头部 × 直接停用该工具；切换 section 不打断进行中的数据流（回放继续） |
| 地图空白点击 | 非绘制态 → `clear()`；绘制态不触发（Esc 链优先） |

## 7. 与既有代码的映射

| 文件 | 改动 |
| --- | --- |
| `src/stores/useSelection.ts` | **新增**：统一选中状态 |
| `src/composables/useWorkbenchLayout.ts` | `inspectorTarget` 派生化；删除 `syncTool` content 分支的 `'tool'` 清除补丁及类似逻辑 |
| 工具注册表（tools 定义处） | 新增 `placement` 字段，收敛各工具自写的宿主声明 |
| `src/map/facade/types.ts` + 实现 | 新增 `focus(target)`；要素点击回调接 `select(feature)` |
| `src/components/LayerWorkspacePanel.vue` | 图层树选中接 `select(layer)`；响应 selection 高亮行 |
| `src/layout/InspectorPanel.vue` | 由 selection 驱动渲染子面板；无选中不渲染容器 |
| `src/layout/BottomDrawer.vue` | 互斥单开；× → 停用对应工具 |
| 属性表 / 结果列表组件 | 接入选中核心（Phase C） |

保留不动：6 sections / Primary Rail / 壳层布局、13 个面板的 `.panel` 统一契约、Graphite Atlas 主题、轨迹回放拖拽关跟随等既有修复。

## 8. 分阶段实施计划（每阶段 `pnpm typecheck` + `pnpm test` + `pnpm build` 通过）

### Phase A：选中核心 + 三端接线
- 新增 `useSelection` store。
- 地图要素点击 → `select(feature)`；图层树点击 → `select(layer)`。
- `InspectorPanel` 由 selection 驱动；`inspectorTarget` 派生化，删除手工清除补丁。
- 验证：选中图层/要素后右侧正确切换；空白点击/×/Esc 清除。

### Phase B：placement 声明化 + 补丁清理
- 工具注册表补 `placement`；移除各工具散落的宿主特判。
- 验证：所有工具落点与三区契约一致；此前「切 section 残留」场景回归通过。

### Phase C：底部互斥 + 属性表/结果联动
- `drawerTarget` 互斥单开；属性表行点击 → `select(feature)`；结果列表 → `select(result)`。
- Facade `focus()` 接入「缩放至」与行/条目定位。
- 验证：五端联动矩阵逐项通过。

### Phase D：退出层级与打磨
- Esc 优先级链；空态渲染；焦点管理（可访问性）；2D/3D 双引擎回归。

## 9. 验收清单

1. 右侧面板显示的内容永远可以用一句话解释：「因为你当前选中了 X」。
2. 任何工具面板的落点可由 `placement` 字段静态推导，无特判。
3. 五端任一 `select()`，其余端联动（高亮/定位/滚动/闪烁）。
4. 切换 section 无残留；Esc / × / 空白点击确定性清除。
5. `pnpm typecheck`、`pnpm test`、`pnpm build` 全通过；2D/3D 无层级回归。

## 10. 风险与控制

| 风险 | 控制 |
| --- | --- |
| `inspectorTarget` 派生化影响已修复的联动 bug | 回归用例覆盖「切 section」「轨迹回放拖拽」「检查器 ×」场景 |
| 属性表大数据量滚动定位卡顿 | 虚拟滚动 / 节流定位 |
| 地图空白点击与绘制点击冲突 | 绘制态不触发 `clear()`，Esc 链优先 |
| 一次迁移面板过多 | 严格按 Phase A→D，每阶段可构建可测试 |

## 11. 非目标

- 不改壳层布局与 6 sections 结构，不改 Graphite Atlas 视觉主题。
- 不新增 GIS 算法，不更换技术栈（OpenLayers/Cesium/Pinia/Element Plus）。
- 多选批量选中不在本期（单选为核心，多选进 backlog）。

## 12. 实施结果摘要（2026-10-06）

全部四阶段已实施并通过 `pnpm typecheck`、`pnpm test`（21/21）、`pnpm build`。

| 阶段 | 关键改动 |
| --- | --- |
| Phase A | 新增 `src/stores/selection.ts` 统一选中核心（桥接 mapStore 单一事实来源）；`useWorkbenchLayout` 的 `inspectorTarget` 改为由 selection 派生（`tool` 型占用优先回落）；删除 `syncSelection` 手工清除补丁；图层树选中接入 `selection.select`（再点取消）；修复「切左侧工具打断底部回放/实时」缺陷 |
| Phase B | 删除废弃的浮动面板 `src/layout/ToolDock.vue`（壳层零引用死代码）；`workbenchNavigation.ts` 的 `hostByTool` 确认为工具落点单一事实来源（测试覆盖） |
| Phase C | `focusQueryResult` 增强：结果条目点击 = 地图定位 + 统一选中（右侧检查器同步显示要素详情）；`MapFacade` 新增 `zoomToLayer(id)`（双引擎同步）；检查器图层详情新增「缩放至图层」联动按钮 |
| Phase D | Esc 优先级链补全：绘制进行中优先退出绘制 → 底部抽屉 → 检查器 → 内容面板；检查器新增「返回选中详情」路径（工具占用 → 选中检查回落）；检查器自动避让底部抽屉（`is-above-drawer`） |

五端联动现状：地图点选 ⇄ 图层树 ⇄ 检查器 ⇄ 查询结果列表均已接入选中核心；地图空白点击仅取消要素选中并回落图层上下文。
