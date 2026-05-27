# Architecture sweep: global scale wired, ui.js kept, jweb cache deferred

## Status

accepted

## Context

The architecture evaluation flagged four cleanup candidates after the major
refactors (state facade, scheduler, presets, schema, live). This ADR records
the decisions for each in one place.

## C1 — Global scale: wired

`defaultGlobalScale()` lived in the schema, `global_scale` was a Dict root,
but no consumer read it. **Wired** in `octopus_state.js`: `_resolveScale`
now returns a page scale when one is enabled, otherwise the global scale
when enabled, otherwise `null`. The returned snapshot includes a `source:
"page" | "global"` field for UI surfaces that want to indicate which is
active. Matches reference manual §The grid scale (pg 71). Covered by
`tests/state.test.js` (4 cases).

## C2 — `octopus_ui.js`: keep

Earlier evaluation called it "a 50-line pass-through" and suggested
collapse. On second read, it isn't pass-through: it translates integer
indices emitted by Live's `live.tab` controls into named string messages
(`mode_index(2)` → `"set_mode track"`). Index → name translation is a real
job; data.js's setters take strings, Live's tabs emit ints, and somebody has
to bridge that. Deletion test now fails: removing this module would move
ten lines of index-to-name code into the Max patcher or duplicate it in
data.js. **Keep.**

## C3 — jweb bridge step cache: deferred

`octopus_jweb_bridge.js` keeps a `_stepCache` to merge `step_active` and
`step_skip` broadcasts into a single `script updateStep` call. Cleaning
this up means changing data.js's outlet protocol (emit one `step_changed`
with active + skip + hasChord, not separate messages). That touches the
Max patcher's cord wiring — risk without an obvious win given the cache
is a working 10-line shim with no observed bug. **Defer.** Revisit if the
jweb bridge grows further or another consumer needs the same merge.

## C4 — `Sequencer/` directory: leave alone

Empty directory, untracked by git (git doesn't track empty dirs). No
recorded purpose. The natural home for a future native (JUCE) port skeleton
but premature to scaffold. **Leave alone.** When/if the JUCE port begins,
this is where it lands.

## Consequences

- One real code change (C1, +30 lines in `octopus_state.js`, +4 tests).
- Three documented non-actions, so a future explorer doesn't re-discover
  the same candidates and re-evaluate from scratch.
- `octopus_data.js` is now structurally final at 230 lines; the
  architecture track from the initial evaluation is closed except for the
  jweb cache deferral.
