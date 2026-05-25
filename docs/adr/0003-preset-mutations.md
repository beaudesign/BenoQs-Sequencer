# Presets are mutation lists, not state transforms

## Status

accepted

## Context

Factory preset application (~70 lines) lived inside `octopus_data.js`, mixed with schema/defaults, mutation setters, and Live API sync. The preset code wrote directly to the Dict with hand-built path strings inside conditional branches per preset id. To test a preset, you needed a Dict stub.

## Decision

Extract `octopus_presets.js` exposing two functions:

```
buildPresetMutations(id) → [{path, value}, ...]   // pure
applyPresetToDict(d, id) → void                    // writes
```

The mutation-list shape is the contract. `buildPresetMutations` is pure — it returns a flat sequence of Dict path writes that fully describes the preset's effect. `applyPresetToDict` is a trivial loop over the list (plus an `active_page` write at the end).

Preset 0 (reset) stays in `octopus_data.js` because it composes with `reset_state()` and the `_bangMatrixRedraw` side effect; the presets module covers ids 1..3.

## Rejected alternatives

- **Pure `(stateObj, id) → stateObj'` transform.** Cleaner functional shape, but requires reading the full state object from Dict, transforming it in JS, and writing it back. Slower in the Max Dict idiom and a bigger change. Mutation lists give equivalent testability without the round-trip.
- **Rich preset data structure** (`{name, scale, perTrackActiveSteps}`) interpreted by a generic applier. Tempting for presets 1 and 2, but preset 3's computed pattern (`(t+s)%3===0 && s%2===0`) is naturally expressed as a loop, not data. The mutation-list intermediate accommodates both.
- **Keep presets in data.js but make them pure.** Doesn't address the five-concerns-in-one-file problem flagged in the architecture evaluation.

## Consequences

- `octopus_data.js`: `apply_preset` shrinks from ~70 lines to 12. Data.js now has four concerns instead of five (schema/defaults, Dict mutations, Live sync, preset dispatch).
- `octopus_presets.js`: 100 lines. Testable from Node with no Dict required — `tests/presets.test.js` asserts mutation list contents directly.
- Adding a new preset = adding a `_presetN()` function returning a mutation list + one branch in `buildPresetMutations`. No Dict path knowledge leaks out.
- A future state-snapshot test could replay all preset mutations into an in-memory state and verify the resulting tree.
