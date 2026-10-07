# OpenSphere Atlas Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform OpenSphere from a collection of floating GIS tools into a map-first, professional Graphite Atlas workbench while preserving every existing GIS workflow.

**Architecture:** Add a small, typed workbench-navigation layer above the existing `ToolId` registry, then use a dedicated layout composable to coordinate the header, task rail, content panel, contextual inspector and bottom drawer. Keep `MapView`, map facade, Pinia map state, import logic and existing tool components as the business layer; migrate their visual hosts incrementally instead of replacing GIS logic.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Pinia, Element Plus, OpenLayers, Cesium, Vite, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-opensphere-atlas-workbench-design.md`

## Global Constraints

- Preserve all existing flows: local import, WMS, layer management, styles, drawing, measurement, queries, filtering, time, realtime tracking, playback, 2D/3D and workspace persistence.
- Do not replace OpenLayers, Cesium, Pinia, Element Plus, map facade or data-model contracts.
- Use Graphite Atlas tokens; do not add dashboard KPIs, fake monitoring data or decorative “big-screen” panels.
- Default desktop entry is **内容 / 图层与数据**; desktop workbench is primary and narrow screens use collapse/drawer behavior.
- Keep `MapView.vue` as the central map-engine host. Any new overlay must have a defined z-index and must not consume map pointer events unless interactive.
- Add no runtime dependency unless a task documents its need and the user explicitly approves it. This plan requires none.
- Use existing `node --test "tests/*.test.mjs"` tests for pure navigation/state logic; verify Vue layout composition through `pnpm typecheck`, `pnpm test`, `pnpm build`, plus the manual regression checklist below.
- Do not commit, deploy or remove unrelated files automatically. The implementation owner may create commits only with explicit user authorization.

## Review Focus

1. **Drawing session transition:** switching from 绘制与量测 to any other workbench task must still call the existing drawing stop path and leave no live draw interaction on the map. Covered in Task 2 manual regression and Task 7 final regression.
2. **Selection context:** selecting a layer, then a feature, then closing the inspector must preserve `selectedLayerId`/`selectedFeature` semantics and return focus correctly. Covered in Task 5.
3. **Map engine overlays:** 2D and 3D canvases must remain clickable, resizable and correctly stacked beneath rails/panels/controls. Covered in Tasks 3, 4 and 7.
4. **Narrow desktop / tablet:** at 1024px, panel collapse and bottom drawer behavior must not obscure the map or make a task unreachable. Covered in Task 6 and Task 7.
5. **Empty/import workflow:** an empty workspace must expose import, WMS and new drawing-layer actions; successful import must still zoom/choose the layer using existing context handlers. Covered in Task 5 and Task 7.

---

## Planned File Structure

### Create

| File | Responsibility |
| --- | --- |
| `src/layout/workbenchNavigation.ts` | Typed definitions and pure mappings for workbench sections, content tabs, tool hosts, inspector targets, bottom-drawer tabs and existing `ToolId` routes. |
| `src/composables/useWorkbenchLayout.ts` | Vue layout state that wraps existing active-tool operations without touching map business state. |
| `src/layout/WorkbenchHeader.vue` | Global header: brand/workspace status, search, save actions, engine/base-map controls. |
| `src/layout/PrimaryRail.vue` | Accessible primary task rail for 内容、数据、编辑、分析、时间、监测. |
| `src/layout/ContentPanel.vue` | Resizable/collapsible fixed left panel that renders the active task’s existing component. |
| `src/layout/InspectorPanel.vue` | Conditional right inspector for layer/feature/style/task context. |
| `src/layout/BottomDrawer.vue` | Collapsible bottom region for timeline, playback, realtime and query-result contexts. |
| `src/layout/MapQuickControls.vue` | Map-local controls for 2D/3D, base map, zoom/locate helpers and panel toggles. |
| `src/components/DataTab.vue` | Existing-import handler UI for the 数据 default task, with local-file and WMS calls re-emitted to the workspace context. |
| `src/styles/tokens.css` | Graphite Atlas colors, typography, spacing, radii, shadows, motion and z-index tokens. |
| `src/styles/workbench.css` | Application shell, panels, responsive breakpoints, status layer and map-overlays CSS. |
| `src/styles/element-plus-overrides.css` | Central Element Plus variable/component overrides for the workbench theme. |
| `tests/workbenchNavigation.test.mjs` | Node tests for section/tool/default mapping and drawer/inspector routing. |
| `tests/workbenchLayout.test.mjs` | Node tests for pure visibility/route helpers exported by `workbenchNavigation.ts`. |

### Modify

| File | Change |
| --- | --- |
| `src/main.ts` | Import the token, Element Plus override and workbench stylesheet in a stable order after library CSS. |
| `src/styles.css` | Retain only generic/map-specific legacy rules that have not moved; remove duplicated shell/theme values after migration. |
| `src/views/AppView.vue` | Compose the new workbench shell around the existing `MapView` and map facade events. |
| `src/composables/useMapWorkspace.ts` | Instantiate `useWorkbenchLayout` and expose its explicit UI state/actions through `WorkspaceContext`; preserve drawing cleanup wrapper. |
| `src/tools/workspaceContext.ts` | Extend the context interface with typed workbench state and commands. |
| `src/tools/components/LayersTool.vue` | Pass controlled content tab and import/WMS events into `LayerWorkspacePanel`. |
| `src/components/LayerWorkspacePanel.vue` | Add controlled tab support and Data tab; retain existing layers, areas, filters and places flows. |
| `src/components/LayerTab.vue` | Upgrade row actions/status/selection semantics for the persistent content panel; retain visibility/base-map/remove/edit/export behavior. |
| `src/layout/MapStatusBar.vue` | Adapt to the new shell token/state layer while keeping zoom, coordinate and base-map values. |
| `src/layout/AppTopbar.vue` | Replace by `WorkbenchHeader.vue` only after all current behavior is transferred; delete in Task 4 if no longer imported. |
| `src/layout/ToolDock.vue` | Remove only after its tool rendering/close semantics are owned by `ContentPanel` and `InspectorPanel`. |
| `tests/toolRegistry.test.mjs` | Keep existing registry contract test; add a narrow compatibility assertion if a tool-to-section invariant belongs beside it. |

---

### Task 1: Model the workbench navigation in a pure, testable module

**Files:**
- Create: `src/layout/workbenchNavigation.ts`
- Create: `tests/workbenchNavigation.test.mjs`
- Modify: `tests/toolRegistry.test.mjs`

**Interfaces:**
- Consumes: `ToolId` from `src/tools/toolMeta.ts`.
- Produces:
  - `type WorkbenchSection = 'content' | 'data' | 'edit' | 'analysis' | 'time' | 'monitor'`
  - `type ContentTab = 'layers' | 'data' | 'areas' | 'filters' | 'places'`
  - `type BottomDrawerTab = 'timeline' | 'playback' | 'realtime' | 'results'`
  - `type InspectorTarget = 'layer' | 'feature' | 'tool' | undefined`
  - `type WorkbenchToolHost = 'content' | 'inspector' | 'bottomDrawer'`
  - `const workbenchSections: readonly WorkbenchSectionDefinition[]`
  - `getDefaultTool(section: WorkbenchSection): ToolId`
  - `getSectionForTool(tool: ToolId): WorkbenchSection`
  - `getContentTabForSection(section: WorkbenchSection): ContentTab | undefined`
  - `getBottomDrawerTabForTool(tool: ToolId): BottomDrawerTab | undefined`
  - `getToolHost(tool: ToolId): WorkbenchToolHost`
  - `isInspectorTool(tool: ToolId): boolean`

- [ ] **Step 1: Write failing navigation tests**

Create `tests/workbenchNavigation.test.mjs` with explicit expectations:

```js
assert.equal(getDefaultTool('content'), 'layers');
assert.equal(getDefaultTool('data'), 'layers');
assert.equal(getSectionForTool('drawing'), 'edit');
assert.equal(getSectionForTool('query'), 'analysis');
assert.equal(getSectionForTool('realtime'), 'monitor');
assert.equal(getBottomDrawerTabForTool('timeline'), 'timeline');
assert.equal(getBottomDrawerTabForTool('playback'), 'playback');
assert.equal(getToolHost('drawing'), 'content');
assert.equal(getToolHost('vectorStyle'), 'inspector');
assert.equal(getToolHost('timeline'), 'bottomDrawer');
assert.equal(isInspectorTool('vectorStyle'), true);
assert.equal(isInspectorTool('realtime'), false);
```

Also assert every ID in `toolIds` maps to exactly one of the five tool-owning sections (content/edit/analysis/time/monitor) and exactly one visual host. `data` deliberately routes to `layers` plus the `data` content tab.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/workbenchNavigation.test.mjs`
Expected: FAIL because `src/layout/workbenchNavigation.ts` is absent.

- [ ] **Step 3: Implement `src/layout/workbenchNavigation.ts`**

Define the six section definitions with Chinese labels and stable ordering:

```ts
content → layers / layers tab
 data → layers / data tab
 edit → drawing
 analysis → query
 time → timeline
 monitor → realtime
```

Map every existing `ToolId` to one semantic section:

```text
content: layers, legend, feature
edit: drawing, vectorStyle, categoryStyle
analysis: query, visualization, coordinate
time: timeField, timeline, playback
monitor: realtime
```

Route tools to exactly one visual host: `layers`, `drawing`, `query`, `visualization` and `coordinate` use `content`; `vectorStyle`, `categoryStyle`, `legend`, `timeField` and `feature` use `inspector`; `timeline`, `playback` and `realtime` use `bottomDrawer`. This prevents duplicate tool mounting as the shell is introduced.

Use `as const` and `satisfies` so additions to `toolIds` cannot silently bypass the map. Do not import Vue or Element Plus in this file.

- [ ] **Step 4: Extend the existing registry contract test**

In `tests/toolRegistry.test.mjs`, import the new definitions and assert that the set of mapped tools equals `toolIds`. This protects future tool additions from becoming unreachable in the new workbench.

- [ ] **Step 5: Verify navigation contracts**

Run: `node --test tests/toolRegistry.test.mjs tests/workbenchNavigation.test.mjs`
Expected: all assertions pass.

- [ ] **Step 6: Run static verification**

Run: `pnpm typecheck`
Expected: exit code 0.

### Task 2: Add layout state without altering map or tool business logic

**Files:**
- Create: `src/composables/useWorkbenchLayout.ts`
- Create: `tests/workbenchLayout.test.mjs`
- Modify: `src/tools/workspaceContext.ts`
- Modify: `src/composables/useMapWorkspace.ts`

**Interfaces:**
- Consumes: `WorkbenchSection`, `ContentTab`, `BottomDrawerTab`, `InspectorTarget` from Task 1; current `Ref<ToolId | undefined>`, `openTool`, `toggleTool`, `closeTool` from `useActiveTool`; selected state from `useMapStore`.
- Produces from `useWorkbenchLayout(...)`:
  - `activeSection: Ref<WorkbenchSection>`
  - `contentTab: Ref<ContentTab>`
  - `contentPanelOpen: Ref<boolean>`
  - `inspectorTarget: Ref<InspectorTarget>`
  - `bottomDrawerTab: Ref<BottomDrawerTab | undefined>`
  - `openSection(section: WorkbenchSection): void`
  - `openWorkbenchTool(tool: ToolId): void`
  - `closeWorkbenchTool(): void`
  - `setContentTab(tab: ContentTab): void`
  - `toggleContentPanel(): void`
  - `openBottomDrawer(tab: BottomDrawerTab): void`
  - `closeBottomDrawer(): void`
  - `openInspector(target: Exclude<InspectorTarget, undefined>): void`
  - `closeInspector(): void`

- [ ] **Step 1: Write failing pure layout-state tests**

Keep browser-independent logic in `workbenchNavigation.ts` and test it from `tests/workbenchLayout.test.mjs`: expected initial route is `content/layers`, opening `data` resolves to `layers/data`, styles resolve to the inspector, and timeline/playback/realtime resolve to their documented drawer tabs.

- [ ] **Step 2: Run the layout test and verify it fails**

Run: `node --test tests/workbenchLayout.test.mjs`
Expected: FAIL until Task 1 helper exports or Task 2 route helper are available.

- [ ] **Step 3: Implement `useWorkbenchLayout`**

Create a composable that owns only presentation state. It must call the existing tool operations rather than mutate `activeTool.value` directly. `openSection('data')` must select the `layers` tool and set `contentTab` to `data`; `openSection('content')` must select the `layers` tool and set `contentTab` to `layers`.

Use a watcher on `activeTool` to synchronize rail selection when a legacy caller invokes `ctx.openTool('query')`. Use the selected-layer/feature refs only to choose inspector visibility; never alter `mapStore` selection values inside layout code.

- [ ] **Step 4: Extend `WorkspaceContext` and integrate it in `useMapWorkspace`**

Add the produced refs and functions to `WorkspaceContext`. In `useMapWorkspace.ts`, wrap raw `openTool`, `toggleTool`, and `closeTool` so existing semantics remain intact:

- Switching away from `drawing` still calls `drawing.stopDrawing()`.
- Opening drawing still calls `drawing.openExistingDrawingSession()`.
- `LayersTool`’s existing `ctx.openTool('query')` call updates the new rail/section state.
- Closing the active tool still clears a drawing session when appropriate.

Do not change handlers such as `handleFiles`, `addWmsLayer`, `requestSpatialQuery`, realtime connections, or playback operations.

- [ ] **Step 5: Verify state integration**

Run: `node --test tests/toolRegistry.test.mjs tests/workbenchNavigation.test.mjs tests/workbenchLayout.test.mjs`
Expected: all tests pass.

Run: `pnpm typecheck`
Expected: exit code 0 with no `WorkspaceContext` implementation mismatch.

- [ ] **Step 6: Manually verify tool switching**

Run: `pnpm dev`
Check: open drawing, begin a drawing action, then select analysis; no stale drawing interaction remains on the map. Open a style tool from its existing path and confirm the new layout state selects 编辑.

### Task 3: Establish Graphite Atlas design tokens and a safe workbench CSS layer

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/element-plus-overrides.css`
- Create: `src/styles/workbench.css`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `src/layout/MapStatusBar.vue`

**Interfaces:**
- Consumes: existing Element Plus, OpenLayers and Cesium CSS imports; Graphite Atlas values from the spec.
- Produces: CSS custom-property contract usable by all new layout components and a documented `z-index` ladder.

- [ ] **Step 1: Add token smoke-test expectations**

Extend `tests/workbenchLayout.test.mjs` to import and assert only the pure exported z-layer names/constants if they are represented in `workbenchNavigation.ts`. Do not attempt DOM/CSS parsing with the current test stack; record CSS contrast and layout checks as manual verification below.

- [ ] **Step 2: Create `tokens.css`**

Define the approved semantic tokens, including the exact starting palette:

```css
--os-bg-canvas: #0b1018;
--os-bg-shell: #121923;
--os-bg-surface: #18212d;
--os-bg-elevated: #202b38;
--os-border-subtle: #2a3746;
--os-border-strong: #41546a;
--os-text-primary: #f3f7fb;
--os-text-secondary: #b8c5d3;
--os-text-muted: #7d91a5;
--os-accent: #2f80ed;
--os-success: #35b979;
--os-warning: #e6a23c;
--os-danger: #ed6a5e;
```

Also define 4px/8px spacing aliases, 6px/8px radii, `--os-control-height: 32px`, `--os-compact-control-height: 28px`, motion duration, and named z-index tokens for map, controls, panels, popovers and dialogs.

- [ ] **Step 3: Centralize Element Plus overrides**

In `element-plus-overrides.css`, configure Element Plus CSS variables and only component-level selectors needed for buttons, inputs, selects, dialogs, tabs, dropdowns and focus rings. Preserve Element Plus behavior and do not copy overrides into business components.

- [ ] **Step 4: Create workbench layout styling and reduce legacy duplication**

Add `workbench.css` for shell/panel/rail/drawer/map-overlay rules. Move global visual rules out of `styles.css` only after their new target exists. Keep OpenLayers/Cesium and feature-specific rules in a clearly named legacy/map section until their owner migrates.

Adapt `MapStatusBar.vue` to `--os-*` tokens without changing its zoom, coordinate or base-map bindings.

- [ ] **Step 5: Wire stylesheet import order**

In `src/main.ts`, preserve third-party CSS first, then import `tokens.css`, `element-plus-overrides.css`, `workbench.css`, and legacy `styles.css`. This avoids accidental Element Plus overrides being overwritten by the library bundle.

- [ ] **Step 6: Verify the theme foundation**

Run: `pnpm typecheck && pnpm build`
Expected: both commands exit 0.

Manual check in `pnpm dev`: confirm text/focus contrast on a dark map, Element Plus dialogs/dropdowns remain legible, and no global rule makes Cesium/OpenLayers controls inaccessible.

### Task 4: Build the workbench shell, header, primary rail and fixed content host

**Files:**
- Create: `src/layout/WorkbenchHeader.vue`
- Create: `src/layout/PrimaryRail.vue`
- Create: `src/layout/ContentPanel.vue`
- Create: `src/layout/MapQuickControls.vue`
- Modify: `src/views/AppView.vue`
- Modify: `src/layout/MapStatusBar.vue`
- Modify: `src/layout/AppTopbar.vue`
- Modify: `src/layout/ToolDock.vue`

**Interfaces:**
- `WorkbenchHeader` consumes `WorkspaceContext` and `useMapStore`; it exposes no business events beyond invoking existing context methods.
- `PrimaryRail` props: `activeSection: WorkbenchSection`; emits: `select: [section: WorkbenchSection]`.
- `ContentPanel` props: `open: boolean`, `section: WorkbenchSection`, `title: string`, `activeTool?: ToolId`; it renders a registry component only when `getToolHost(activeTool) === 'content'`; emits: `close`, `resize` only if the resize value is persisted later.
- `MapQuickControls` uses existing `mapStore.setMapEngine`, `mapStore.setBaseMap`, existing map facade commands where already available, and `WorkspaceContext` panel toggles.

- [ ] **Step 1: Create component contract tests where pure state is involved**

Add tests to `tests/workbenchNavigation.test.mjs` for the six rail ordering/labels and default tool assignment. Keep Vue rendering checks manual because the repository currently has no Vue component test harness.

- [ ] **Step 2: Implement `WorkbenchHeader.vue`**

Transfer the following behavior from `AppTopbar.vue` unchanged at the handler level: search through `SearchPanel`, local-file import (`ctx.handleFiles`), 2D/3D switching, base-map change (`ctx.handleBaseMapChange`), save/restore/clear workspace actions and coordinate location.

Reduce its visual/interaction scope to global functions. Do not place layer, drawing, timeline, styling, realtime or playback buttons in the header. The header must show a concise workspace/save-state area, a central search field and right-side engine/base-map controls.

- [ ] **Step 3: Implement `PrimaryRail.vue` and `ContentPanel.vue`**

Render the six Task 1 sections in `PrimaryRail`. Use accessible buttons with an `aria-label`, visible selected state and tooltip/label at narrow widths. `ContentPanel` must be fixed to the left of the map, resizable/collapsible via CSS layout rather than freely draggable, and must render the existing active tool component supplied by the registry.

- [ ] **Step 4: Implement `MapQuickControls.vue` and the shell composition**

Refactor `AppView.vue` so the shell contains `WorkbenchHeader`, `PrimaryRail`, `ContentPanel`, `MapView`, `MapQuickControls`, `MapStatusBar`, plus conditional `InspectorPanel` and `BottomDrawer` containers wired to Task 2 state. Preserve all current `MapView` event bindings and the WMS dialog binding exactly.

Anchor map-local UI with the z-index tokens from Task 3. The map engine canvas must remain full-size behind the new layout.

- [ ] **Step 5: Retire old containers only after parity is observed**

After header and content-panel parity is verified, remove `AppTopbar` and `ToolDock` imports from `AppView.vue`. Delete the two files only if a repository search confirms no remaining import/reference. Do not delete existing individual tool components.

- [ ] **Step 6: Verify shell behavior**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all commands exit 0.

Manual checks at 1440×900:
- all six rail tasks are discoverable;
- map remains the largest region;
- header no longer contains a “更多” menu for workflow-critical tools;
- 2D/3D, base-map, search, import and workspace actions still work;
- map controls and status bar remain above both OpenLayers and Cesium canvases.

### Task 5: Deliver the Layers/Data default workflow and contextual inspector

**Files:**
- Create: `src/components/DataTab.vue`
- Create: `src/layout/InspectorPanel.vue`
- Modify: `src/components/LayerWorkspacePanel.vue`
- Modify: `src/components/LayerTab.vue`
- Modify: `src/tools/components/LayersTool.vue`
- Modify: `src/tools/components/FeatureTool.vue`
- Modify: `src/tools/components/VectorStyleTool.vue`
- Modify: `src/tools/components/CategoryStyleTool.vue`
- Modify: `src/tools/components/LegendTool.vue`
- Modify: `src/tools/components/TimeFieldTool.vue`
- Modify: `src/components/layer-workspace.css`
- Modify: `src/composables/useMapWorkspace.ts`

**Interfaces:**
- `DataTab` emits `files: [files: FileList | null]` and `openWms: []`; it does not parse data.
- `LayerWorkspacePanel` props: `activeTab: ContentTab`; emits `update:activeTab`, `files`, `openWms`, plus its existing events.
- `InspectorPanel` props: `target: InspectorTarget`; it reads `mapStore.selectedLayerId`, `mapStore.selectedFeature` and `ctx.activeTool` to render existing panels without duplicating business actions.

- [ ] **Step 1: Write failing data/default-route tests**

Add to `tests/workbenchLayout.test.mjs`:

```js
assert.equal(getContentTabForSection('content'), 'layers');
assert.equal(getContentTabForSection('data'), 'data');
assert.equal(getSectionForTool('feature'), 'content');
assert.equal(isInspectorTool('feature'), true);
```

- [ ] **Step 2: Implement `DataTab.vue`**

Provide the approved empty-workspace/data actions: **导入空间数据**, **添加 WMS/服务**, and **新建绘制图层**. Re-emit selected files to `ctx.handleFiles`, open the existing WMS dialog through `ctx.showWmsDialog`, and call the existing drawing-layer creation handler. Preserve existing accepted extensions:

```text
.geojson, .json, .csv, .kml, .kmz, .gpx, .zip
```

Do not duplicate import parsing, WMS validation, zoom-to-extent or data-layer mutation.

- [ ] **Step 3: Make `LayerWorkspacePanel` controlled and persistent**

Replace private-only tab state with controlled `activeTab` support while keeping local fallback behavior if the component is reused independently. Add a `data` tab next to existing 图层、范围、筛选、地点. Wire `LayersTool` to `ctx.contentTab` and `ctx.setContentTab` so Primary Rail selections drive the correct tab.

- [ ] **Step 4: Upgrade `LayerTab` for workbench semantics**

Keep selection, visibility, base-map, edit, export and remove actions. Improve only presentation semantics: type/status glyph, primary name, feature/realtime metadata, selected state and accessible labels. Do not change `mapStore` method signatures or layer ordering behavior.

- [ ] **Step 5: Implement `InspectorPanel`**

Use three target modes:

- `feature`: render the existing `FeatureInfoPanel` / `FeatureTool` when `mapStore.selectedFeature` exists;
- `layer`: render a compact selected-layer overview plus tabs/entry points for existing vector style, category style, legend and time-field tools;
- `tool`: render the active style/feature tool component only for `isInspectorTool(activeTool)`.

Closing the inspector must only change layout state, not clear `selectedLayerId` or `selectedFeature`. `ContentPanel` must not mount an active tool whose `getToolHost(activeTool)` is `inspector`. Do not attempt to create new style or feature business logic.

- [ ] **Step 6: Verify data and inspector continuity**

Run: `node --test tests/workbenchNavigation.test.mjs tests/workbenchLayout.test.mjs && pnpm typecheck && pnpm build`
Expected: all commands exit 0.

Manual check:
- fresh workspace shows three approved data actions;
- import calls existing handler and selects/zooms to the imported layer;
- selecting a layer opens layer context without changing the layer;
- selecting a feature opens feature context;
- closing the inspector does not lose the map selection;
- style, category, legend and time-field workflows still commit state changes to the map.

### Task 6: Migrate task-specific panels and introduce the bottom drawer

**Files:**
- Create: `src/layout/BottomDrawer.vue`
- Modify: `src/layout/ContentPanel.vue`
- Modify: `src/layout/InspectorPanel.vue`
- Modify: `src/tools/components/DrawingTool.vue`
- Modify: `src/tools/components/QueryTool.vue`
- Modify: `src/tools/components/CoordinateTool.vue`
- Modify: `src/tools/components/VisualizationTool.vue`
- Modify: `src/tools/components/TimelineTool.vue`
- Modify: `src/tools/components/PlaybackTool.vue`
- Modify: `src/tools/components/RealtimeTool.vue`
- Modify: `src/components/TimelinePanel.vue`
- Modify: `src/components/TrackPlaybackPanel.vue`
- Modify: `src/components/RealtimePanel.vue`
- Modify: `src/components/QueryPanel.vue`
- Modify: `src/views/AppView.vue`

**Interfaces:**
- `BottomDrawer` props: `tab: BottomDrawerTab | undefined`; emits `close`; uses `WorkspaceContext` for timeline/playback/realtime/query state.
- Existing tool components remain the owners of business event wiring; this task changes their host and layout class only.

- [ ] **Step 1: Add route tests for all task tools**

Extend `tests/workbenchNavigation.test.mjs` to assert the full mapping:

```text
编辑: drawing, vectorStyle, categoryStyle
分析: query, visualization, coordinate
时间: timeField, timeline, playback
监测: realtime
```

Assert timeline/playback/realtime route to the respective bottom-drawer tab; query routes to `results` only after a result context is available, otherwise it remains in the analysis content panel.

- [ ] **Step 2: Implement `BottomDrawer.vue`**

Support `undefined`, compact, half-height and expanded visual states with accessible close/collapse controls. Use `timeline`, `playback`, `realtime`, `results` as stable tab identifiers. `BottomDrawer` is the only host that may mount tools whose `getToolHost(activeTool)` is `bottomDrawer`; `ContentPanel` and `InspectorPanel` must not duplicate them. Do not mount every heavy panel simultaneously; mount the active panel and preserve its existing data/state source in `WorkspaceContext`/Pinia.

- [ ] **Step 3: Place task tools in their intended workspace region**

Use the Task 1 mapping:

- 编辑: drawing in content panel; active style tools in inspector.
- 分析: query, coordinate and visualization in content panel; query results in bottom drawer when results exist.
- 时间: time field in inspector, timeline/playback in bottom drawer.
- 监测: realtime connection/configuration in content panel; live list/status or focused playback in bottom drawer.

Preserve current `WorkspaceContext` methods and panel emits. If a wrapper component contains no layout-specific behavior after migration, keep it only if it gives the registry a stable interface; otherwise simplify it in the same task.

- [ ] **Step 4: Add clear mode/status feedback**

For drawing, measurement, spatial query and realtime states, show a concise, textual mode/status indicator near the active panel or bottom drawer. Use semantic tokens; do not rely on color/animation alone. Ensure `Esc` closes only layout UI or exits a documented temporary mode without bypassing existing cancel methods.

- [ ] **Step 5: Verify all task areas**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all commands exit 0.

Manual regression:
- draw/measure, finish/cancel/delete behavior;
- coordinate location and place search;
- spatial query and result focus;
- heatmap/cluster visualization;
- time filtering, timeline interaction and track playback;
- WebSocket/local realtime simulation, disconnect and error text;
- all remain usable in both 2D and 3D wherever supported today.

### Task 7: Harden responsive behavior, accessibility and visual regression checks

**Files:**
- Modify: `src/styles/workbench.css`
- Modify: `src/styles/element-plus-overrides.css`
- Modify: `src/layout/WorkbenchHeader.vue`
- Modify: `src/layout/PrimaryRail.vue`
- Modify: `src/layout/ContentPanel.vue`
- Modify: `src/layout/InspectorPanel.vue`
- Modify: `src/layout/BottomDrawer.vue`
- Modify: `src/layout/MapQuickControls.vue`
- Modify: `src/layout/MapStatusBar.vue`
- Modify: `src/views/AppView.vue`
- Modify: `tests/workbenchNavigation.test.mjs` only if mappings change intentionally

**Interfaces:**
- No new business interfaces. All visual changes consume Task 1/Task 2 state and `--os-*` tokens.

- [ ] **Step 1: Define responsive breakpoints in one stylesheet**

Implement the spec’s behavior in `workbench.css`:

| Range | Required behavior |
| --- | --- |
| 1440px+ | content panel and contextual inspector may display together |
| 1024–1439px | inspector defaults closable/collapsed; content panel stays adjustable |
| 768–1023px | rail remains; content/inspector become drawers; bottom drawer is an overlay |
| <768px | preserve browse/search/layers/locate; show an honest professional-desktop limitation for complex authoring |

Do not replicate breakpoint logic across component-scoped style blocks.

- [ ] **Step 2: Add keyboard and focus behavior**

Ensure rail buttons, panel close buttons, drawer controls, map quick controls and header commands have visible focus rings, accessible names, predictable tab order and focus restoration when dialogs/panels close. Respect `prefers-reduced-motion` in transition rules.

- [ ] **Step 3: Run visual and map-overlay checks**

Run: `pnpm dev`
Check at 1440×900, 1280×800, 1024×768 and 768×1024:
- map remains visible and interactive;
- controls do not fall beneath Cesium/OpenLayers or above dialogs;
- no panel blocks the only exit control;
- page has no unintended horizontal scrolling;
- native browser zoom at 125% keeps labels/actions usable.

- [ ] **Step 4: Run final project verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: every command exits 0. Document any pre-existing unrelated warning separately; do not suppress failures.

### Task 8: Conduct a full functional review and prepare delivery evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-10-06-opensphere-atlas-workbench-ui.md` only to tick completed steps during execution.
- No product-file changes should be required by this task; defects found must return to their owning task rather than be patched here.

**Interfaces:**
- Consumes completed Tasks 1–7.
- Produces a verification record and a concise change summary for the user.

- [ ] **Step 1: Execute the end-to-end acceptance checklist**

Verify each item from the design spec’s acceptance checklist in a browser-backed development session:

1. import, WMS, layers, styles, drawing, queries, time, realtime, playback, 2D/3D and workspace save/restore have clear entry points;
2. at 1440×900 the map remains the dominant canvas and the inspector is contextual;
3. the header contains global controls, not workflow-critical “更多” hiding places;
4. layer/feature/task selection updates context predictably;
5. new workbench styling uses tokens rather than scattered hard-coded shell values.

- [ ] **Step 2: Run verification-before-completion workflow**

Before making any completion claim, load and follow `superpowers:verification-before-completion`. Re-run the final command set from Task 7 and preserve actual output in the execution trace.

- [ ] **Step 3: Review the final diff for scope discipline**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: changes are limited to the documented workbench UI, tests and plan/spec artifacts. Do not reset or overwrite unrelated changes.

- [ ] **Step 4: Request user review**

Present the changed files, validated flows, remaining caveats and an accessible preview. Ask whether the completed implementation matches the approved Graphite Atlas spec before any commit/deploy action.

## Self-Review

### Spec coverage

- Product goal, map-first information architecture and all six task sections: Tasks 1, 2 and 4.
- Graphite Atlas design tokens, Element Plus consistency and visual hierarchy: Task 3.
- 图层与数据 default workflow, import/WMS/new-layer empty state and selected-object inspector: Task 5.
- Drawing, analysis, time, realtime and playback preservation: Task 6.
- Desktop-first responsive behavior, accessibility and map-overlay safety: Task 7.
- Acceptance criteria, build/test/typecheck and diff hygiene: Task 8.

No spec section lacks an owning task.

### Type/interface consistency

`WorkbenchSection`, `ContentTab`, `BottomDrawerTab`, `InspectorTarget` and `WorkbenchToolHost` are defined once in `src/layout/workbenchNavigation.ts`; Task 2 exposes them through `WorkspaceContext`, and later layout components consume the same types. Existing `ToolId`, `WorkspaceContext` actions and map-store selection remain the only business contracts.

### Testing proportion

The repository has Node-only unit tests and no Vue component-test harness. This plan adds pure navigation/state tests where deterministic behavior belongs and uses typecheck/build plus explicit browser regression cases for component composition, canvas stacking and pointer interaction. It does not add a test framework merely to snapshot CSS.

### Execution note

The implementation should run in an isolated worktree only if the user selects that execution mode. No automatic commits are authorized by this plan.
