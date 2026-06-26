# Style System Phase Plan

## Baseline
- Working baseline preview: `https://premove-clone-qfhtggv4e-otang00s-projects.vercel.app`
- Goal: keep the current preview behavior/layout, then unify the UI into one shared style system.
- Rule: each phase ends with code changes complete, build verification complete, then a commit before the next phase starts.

## Allowed shared system
- Buttons: `btn`, `btn-dark`, `btn-outline`, `btn-soft`, `btn-tab`, `btn-select`, size/block modifiers, `is-active`
- Panels/cards: `panel`, `panel-sub`, `panel-info`, `panel-form`, `panel-sticky`
- Fields: `field-label`, `field-input`, `field-select`, `field-group`, `field-note`

## Remove by the end
- Page-specific button classes carrying visual responsibility
- Mixed old/new button styling on the same role
- Duplicate page-specific panel/card styling for the same UI role
- Old selection-state styling when shared `is-active` rules already cover it

## Phase 0 — baseline lock
### Goal
- Document the baseline preview and class policy.
- Create a backup commit from the current working state.

### Exit criteria
- Plan document updated.
- Current state committed.

## Phase 1 — button system unification
### Scope
- Main search box
- Results sort actions / list actions
- Detail CTA / payment / tab buttons / delivery modal actions

### Goal
- Every action button uses the shared `btn` system only.
- Remove old visual button classes such as `location-select-button`, `action-submit`, `ghost`, `primary` as style carriers.

### Exit criteria
- No legacy button-style classes remain in JSX/CSS as visual dependencies.
- Build passes.
- Commit created.

## Phase 2 — field/input system unification
### Scope
- Search box inputs
- Detail search box inputs
- Reservation form inputs
- Delivery modal/select inputs

### Goal
- Inputs/selects/labels use one field system.
- Same role = same structure and class family.

### Exit criteria
- Field-related legacy styling removed.
- Build passes.
- Commit created.

## Phase 3 — panel/card layout unification
### Scope
- Search panels
- Results cards
- Detail summary/info cards
- Sticky payment box
- Section containers

### Goal
- Shared panel/card structure across main/list/detail.
- Remove page-specific visual duplication where the shared panel system should own the look.

### Exit criteria
- Panel/card structure aligned across screens.
- Build passes.
- Commit created.

## Phase 4 — selection/tabs/state unification
### Scope
- Age selection buttons
- Sort selection buttons
- Detail tabs
- Payment method cards
- Delivery selection cards

### Goal
- One selected/hover/active system across the app.
- Shared active-state rules only.

### Exit criteria
- Selection state rules unified.
- Build passes.
- Commit created.

## Phase 5 — legacy CSS purge and final lock
### Scope
- `src/styles.css`
- Related JSX cleanup

### Goal
- Remove unused legacy classes and duplicate visual rules.
- Final preview reflects one consistent style system.

### Exit criteria
- Legacy selectors removed.
- Build passes.
- Final preview deployed.
- Final commit created.
