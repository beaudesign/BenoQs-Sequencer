# State facade owns reads and value resolution; Max Dict stays the storage

## Status

accepted

## Context

State for the sequencer lives in a single Max Dict named `octopus_state`, mutated only by top-level functions in `octopus_data.js`. Read access was duplicated: both `octopus_engine.js` and `octopus_matrix_ui.js` constructed their own `new Dict("octopus_state")`, redeclared `STATE_DICT_NAME`, and rebuilt Dict paths by hand. The engine's `tick()` also performed substantial **merge math** inline — resolving routing mode to a port/channel pair, merging page+track+step pitch/velocity offsets, parsing multiplier strings, applying the page scale — none of which was shared with the UI.

## Decision

Introduce a read-only **State facade** in `octopus_state.js` that:

1. Owns the `STATE_DICT_NAME` constant and is the only module besides `octopus_data.js` that touches the raw Dict.
2. Returns **Snapshots** (`PageSnapshot`, `TrackSnapshot`, `StepSnapshot`) carrying **Resolved values** — routing pre-applied, scale pre-merged, multiplier parsed to ticks.
3. Has no mutation API. Writes continue to live in `octopus_data.js` and remain unchanged.
4. Replaces no observer pattern. Mutations in `octopus_data.js` still broadcast via `outlet(0, ...)` and Max patch cords.

## Rejected alternatives

- **Mirror-the-Dict snapshot.** Cheaper to produce, but every consumer would keep redoing the merge. Rejected because it would leave the merge math smeared across engine and UI — the locality problem we're solving.
- **JS event bus for updates.** Max patch cords already implement the observer pattern. Adding a JS bus duplicates it.
- **Port to JUCE / native plugin.** A separate, much larger decision. The facade is designed so the resolution logic could be re-implemented in C++ as a pure translation — but that port is out of scope for this ADR.
- **Per-tick snapshot caching.** Tempting but premature: `tick()` already fetches the whole page object in one `Dict.get`. The win from the facade is locality of merge math, not fewer Dict reads.

## Consequences

- Engine `tick()` shrinks substantially; the resolution logic moves behind a named interface and becomes testable in isolation (feed a fixture Dict, assert snapshot contents).
- Schema changes to the Dict layout are localized to `octopus_data.js` + the facade; consumers see only the **Snapshot** contract.
- `STATE_DICT_NAME` is no longer duplicated across modules.
- Migration is mechanical but must preserve engine behavior tick-for-tick. Step-by-step migration with a green M4L load between each step is required.
