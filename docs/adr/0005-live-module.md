# Live API integration lives in octopus_live.js

## Status

accepted

## Context

`octopus_data.js` still owned the two Live-API touchpoints
(`set_time_signature` and `sync_time_signature_from_live`). These are the
only functions in the file that depend on Ableton's `LiveAPI` global. As
future Live integrations land (transport sync, tempo follow, scene change,
clip launch, etc.), keeping them in data.js would dilute it again.

## Decision

Extract `octopus_live.js`. It owns:

- `set_time_signature(num, den)` — Dict mutation + outlet broadcast, called
  by both Live's transport-meter change message and our own sync call.
- `sync_time_signature_from_live()` — read Live's `signature_numerator` /
  `signature_denominator` and write them to the State Dict.

`data.js` includes it; functions remain reachable from the patcher because
include() merges scopes inside one Max js object. `_bangMatrixRedraw` stays
in data.js (used by `apply_preset` too — it's a generic JSUI nudge, not
Live-specific).

## Rejected alternatives

- **Leave `set_time_signature` in data.js as a generic mutation.** The
  function is only ever called from Live-driven paths. Putting it with the
  rest of the mutation setters would imply UI/jweb might call it too;
  isolating it makes the dependency on LiveAPI explicit.
- **Make a single `octopus_integration.js` for all external systems.**
  Premature consolidation — we only have one integration so far. If a
  second arrives (e.g. MIDI input chase), revisit.

## Consequences

- `octopus_data.js`: 257 → 230 lines. The only file that touches the State
  Dict for writes; one concern.
- `octopus_live.js`: 39 lines, the only file touching `LiveAPI`. Future
  Live hooks land here.
- Tests unaffected (80 passed) — Live integration isn't testable in Node
  without a LiveAPI mock, and we don't have one yet. Worth adding if more
  Live behaviour lands.
