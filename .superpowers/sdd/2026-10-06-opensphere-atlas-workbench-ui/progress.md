# SDD ledger — plan: docs/superpowers/plans/2026-10-06-opensphere-atlas-workbench-ui.md

Started: 2026-10-06
Execution mode: native sequential, explicitly selected by the user for the current project.

Pre-flight:
- Current branch is `main`; Ruling: execute in the selected current workspace because the user explicitly approved native code implementation for this project. Cost if wrong: changes remain uncommitted and can be reviewed/reverted as a normal worktree diff.
- Task 1 produces `WorkbenchSection`/`ContentTab`/tool-routing helpers; Task 2 consumes them through `WorkspaceContext`. Consistent with the approved spec.
- Task 2 exposes layout state; Tasks 4–6 consume it in shell, inspector and drawer components. Consistent with the approved spec.
- Task 3 owns CSS tokens/Element Plus overrides; Tasks 4–7 consume only `--os-*` tokens. Consistent with the approved spec.
- Task 5 owns data/import and inspector host behavior; Task 6 owns drawer host behavior. Ruling: add a single `WorkbenchToolHost` mapping so no tool mounts in more than one region. Cost if wrong: a later tool integration may need a route-table adjustment, not business-logic rewrites.

Baseline:
- `pnpm test`: 12/12 passing.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; pre-existing Vite chunk-size advisory remains (`index` 6.1 MB minified), outside the approved UI scope.
- Existing source worktree was clean; only approved `docs/` design and plan artifacts were untracked.

Task 1: Ruling: annotate the section array and partial drawer map explicitly — TypeScript inferred an incompatible heterogeneous tuple / narrow object index — cost if wrong: future section or drawer entries will be caught by the navigation tests and typecheck.
Task 1: complete (uncommitted by user-approved scope; tests: `pnpm test && pnpm typecheck` → 18/18 pass, typecheck pass).

Task 2: Ruling: set `allowImportingTsExtensions` because Node 24 native TypeScript tests require explicit source extensions while the project uses `noEmit` — cost if wrong: this option affects only module resolution checking and can be removed if the test runner changes.
Task 2: complete (uncommitted by user-approved scope; tests: `pnpm test && pnpm typecheck` → 18/18 pass, typecheck pass).

Task 3: Ruling: load legacy global CSS before the new token/Element/workbench layers so the new Graphite Atlas tokens are the final visual authority — cost if wrong: an old generic selector can still need a targeted override.
Task 3: complete (uncommitted by user-approved scope; tests: `pnpm typecheck` → pass).

Task 4: complete (uncommitted by user-approved scope; fixed task rail, content panel, inspector, bottom drawer, dynamic single tool host, and contextual topbar; tests: `pnpm typecheck` → pass).

Task 5: complete (uncommitted by user-approved scope; data catalog now routes real imports/WMS through existing workspace events and preserves layer actions; tests: `pnpm typecheck` → pass).

Task 6: complete (uncommitted by user-approved scope; every existing ToolId remains reachable through task routes/contextual actions, with temporal tabs synchronizing the legacy active tool; tests: `pnpm typecheck` → pass).

Task 7: complete (uncommitted by user-approved scope; responsive panel rules, keyboard-selectable layer/base-map rows, visible focus, Escape close sequence, reduced motion tokens, and MapFacade-based quick controls; tests: `pnpm typecheck` → pass).

Task 8: validation complete (uncommitted by user-approved scope; after final semantic layer-row cleanup, `pnpm test` → 19/19 pass, `pnpm typecheck` → pass, `pnpm build` → exit 0, `git diff --check` → pass). Vite runtime health: root/main/AppView returned 200 and 8 new SFC modules transformed successfully. Browser automation is not installed in this host (no Playwright or browser executable), so a full visual browser viewport sweep remains a manual follow-up rather than a fabricated pass.


