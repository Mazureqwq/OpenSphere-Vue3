# SDD ledger — plan: docs/superpowers/plans/2026-10-08-incident-map-task-mode-implementation.md

## Setup
- Workspace: E:\project\re-code\new-project (main); user explicitly authorized inline execution in this workspace and prohibited additional worktrees, commits, pushes, deployments, resets, and cleanup of unrelated changes.
- Spec read: docs/superpowers/specs/2026-10-08-incident-map-task-mode-design.md
- Plan read: docs/superpowers/plans/2026-10-08-incident-map-task-mode-implementation.md
- Pre-flight interface: Task 1 produces `IncidentCaptureMode`, pure task state, and a persistent create-draft session; Task 2 consumes mode semantics through facade types; Task 4 consumes the state/draft session and all five facade commands. No naming conflict found; the plan's exact names will be used.
- Pre-flight interface: Task 2 produces `IncidentGeometryCaptureRequest` / `IncidentGeometryCaptureProgress` and five `MapFacade` commands; Task 3 routes the same commands through MapView; Task 4 consumes the same request lifecycle. No naming conflict found.
- Ruling: keep the plan's new persistent draft session rather than retaining `IncidentFormDialog` local reactive state, because the approved spec requires close/reopen and component-unmount resilience. Cost if wrong: a later extraction is limited to presentation state.

## Task progress
- Task 1: complete — RED: `incidentGeometryCaptureTask.test.mjs` failed with missing module; GREEN: 4/4 pass; full `pnpm test`: 59/59 pass.
- Task 2: complete — RED: facade contract test 0/3; GREEN: 3/3 pass; full `pnpm test`: 62/62 pass.
- Task 3: complete — RED: extended facade contract test 3/4; GREEN: 4/4 pass; full `pnpm test`: 63/63 pass.
- Task 4: complete — RED: new map-task UI contract suite 3/7 pass, with the intended missing controller/card/single-entry behavior. GREEN: targeted UI, workspace, and state tests 11/11 pass; full `pnpm test`: 66/66 pass. Initial typecheck then exposed one integration defect: `src/map/facade/index.ts` exported only `MapFacade`, while the new consumers imported its capture request/progress types. Added a failing facade-barrel contract test (3/4) before the smallest source fix; barrel test is now 4/4 and `pnpm typecheck` passes. The source controller, task card, dialog hand-off, task-first keyboard behavior, styles, and facade type exports are all in place.
- Task 5: complete — specified target suite 15/15 pass; fresh full `pnpm test`: 66/66 pass; `pnpm typecheck` passed; production `pnpm build` completed in 19.24s with exit 0; `git diff --check` exit 0. The direct build command exceeded the MCP synchronous command budget twice, so the final build was run once in a logged background process and its exit marker was read (`0`). Vite emitted only its non-fatal chunk-size advisory. No commit, push, deployment, reset, or deletion of pre-existing work was performed.

## Post-plan visual correction — range fill visibility
- Root cause: `incidentMapLayer.ts` declared `recordStyle.fillOpacity: 0.38`, and Cesium consumed that value, but the OpenLayers incident style passed the severity hex string directly to `Fill`. Saved Polygon events were therefore opaque in 2D and hid the basemap. Temporary 2D/3D capture previews were already translucent.
- TDD: added an integration regression in `tests/incidentPresentation.test.mjs`; it failed exactly as expected (`#f28b54` versus `rgba(242, 139, 84, 0.38)`) before the source change and passes after it.
- Fix: extracted the existing pure hex-to-RGBA helper to `src/map/styleColor.ts`, reused it from both generic vector styles and incident projection, and applied `recordStyle.fillOpacity` to saved incident Polygon fills. A direct import of the bundler-oriented `styles.ts` was rejected by the native Node test runner, so the pure utility preserves both reuse and the presentation module's dependency boundary.
- Verification: focused presentation suite 4/4 pass; fresh `pnpm typecheck` pass; fresh `pnpm test` 67/67 pass; production build exit 0 (18.41s); `git diff --check` exit 0. Vite emitted only its pre-existing/non-fatal chunk-size advisory. No commit, push, deployment, reset, or removal of pre-existing work was performed.

## Post-plan visual correction — Element Plus input focus
- Screenshot diagnosis: the `IncidentFormDialog` title `el-input` already received its component-level focused border from `.el-input__wrapper.is-focus`, while the global `input:focus-visible` selector also outlined its nested `.el-input__inner`. Those two effects created the duplicate blue rectangle shown in the screenshot.
- TDD: added `tests/focusStyle.test.mjs`; it first failed because the global selector targeted every input, then passed after the focused component inner input and textarea were excluded.
- Fix: `tokens.css` now keeps the accessible global outline for native inputs and textareas, but excludes `.el-input__inner` and `.el-textarea__inner`; Element Plus retains its single component-level focus state.
- Verification: focus regression 1/1 pass; fresh `pnpm typecheck` pass; fresh `pnpm test` 68/68 pass; production build exit 0 (18.54s); `git diff --check` exit 0. No commit, push, deployment, reset, or removal of pre-existing work was performed.

## Follow-up correction — native Element Plus focus only
- User feedback showed that excluding the nested native input outline alone was insufficient. The remaining source was the explicit `.el-input__wrapper.is-focus` / `.el-select__wrapper.is-focused` / `.el-textarea__inner:focus` box-shadow override, plus its `!important` base box-shadow, in `element-plus-overrides.css`.
- TDD: tightened the focus contract so Element Plus input, select and textarea controls must have no hand-written focus selector or wrapper box-shadow override; it failed before the change and passes after it.
- Fix: removed the four hand-written box-shadow/focus declarations while retaining only the dark workspace background override. Element Plus now owns the single focus border; the global focus rule continues to exclude its nested input and textarea elements while preserving focus visibility for native controls.
- Verification: focused regression 1/1 pass; fresh `pnpm typecheck` pass; fresh `pnpm test` 68/68 pass; production build exit 0 (20.21s); `git diff --check` exit 0. No commit, push, deployment, reset, or removal of pre-existing work was performed.

## Root-cause confirmation — remove global `:focus-visible`
- User correctly identified the remaining trigger as the app-wide `:focus-visible` outline block in `tokens.css`; it applied an extra outline in addition to the component's focus treatment.
- TDD: updated the focus regression to require that `tokens.css` contains no global `:focus-visible` selector; it failed on the existing block and passes after its removal.
- Fix: deleted the nine-line global `button/input/select/textarea/[tabindex]:focus-visible` rule. The event form input now uses Element Plus's native focus state alone, without an application-authored outer outline.
- Verification: focused regression 1/1 pass; fresh `pnpm typecheck` pass; fresh `pnpm test` 68/68 pass; production build exit 0 (20.43s); `git diff --check` exit 0. No commit, push, deployment, reset, or removal of pre-existing work was performed.
