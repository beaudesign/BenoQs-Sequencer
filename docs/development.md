# Development guide

Orientation for evolving this codebase. Pair with [`CONTEXT.md`](../CONTEXT.md)
for domain language and [`docs/adr/`](./adr/) for decisions.

## Tests

One runner, no dependencies:

```sh
node tests/run.js
```

Currently 109 cases across 8 files:

| File                       | What it locks down |
| -------------------------- | ------------------ |
| `tests/schema.test.js`     | Default shapes (track pitch map, grid 10×16×10×16), `repair_state` against in-memory Dict |
| `tests/state.test.js`      | `load_active_page` round-trip, routing resolution, multiplier parsing, scale precedence |
| `tests/scheduler.test.js`  | `planTrack` decisions: chord, strum, scale quantize, chain head, direction advance |
| `tests/presets.test.js`    | Mutation lists for factory presets 1–3 |
| `tests/ui_adapter.test.js` | LED state mapping, playhead overlay restore, mode dispatch |
| `tests/interactions.test.js` | Click + shift + double + encoder drag → outbound message |
| `tests/live.test.js`       | `sync_time_signature_from_live` against a LiveAPI mock |
| `tests/engine.test.js`     | Transport state, panic, tick-to-MIDI wiring |

`tests/max_shim.js` provides the Max globals (`autowatch`, `outlet`, `Dict`,
`LiveAPI`, `include`) inside a `vm.Context` so modules load with their normal
syntax. The `Dict` mock implements `::`-delimited path semantics; outlet
calls are captured into `sandbox._outletCalls` for assertions.

## Module map

Files in dependency order. Each does one job; see the named ADR for why.

| File                       | Concern                                        | ADR |
| -------------------------- | ---------------------------------------------- | --- |
| `octopus_scale.js`         | Pitch-class quantization (pure)                | —   |
| `octopus_schema.js`        | Defaults + `repair_state` (pure)               | 0004 |
| `octopus_state.js`         | Read facade — `load_active_page` → PageSnapshot | 0001 |
| `octopus_scheduler.js`     | Per-Track music decisions — `planTrack`        | 0002 |
| `octopus_presets.js`       | Preset mutation lists                          | 0003 |
| `octopus_live.js`          | Ableton LiveAPI integration                    | 0005 |
| `octopus_data.js`          | Dict mutations + outlet broadcasts             | —   |
| `octopus_engine.js`        | Transport + event queue + tick dispatch        | 0002 |
| `octopus_jweb_bridge.js`   | Max ↔ jweb message router                      | 0006 |
| `octopus_matrix_ui.js`     | JSUI in-Max renderer                           | —   |
| `octopus_ui.js`            | `live.tab` index → name translation            | 0006 |

The Max patcher loads modules into a single `js` object using `include()`.
Every JS file shares one scope at runtime.

## Dataflow

### Playback (transport → MIDI out)

```
Max tick message
  → octopus_engine.tick()
    → octopus_state.load_active_page()        // reads Dict, returns PageSnapshot
    → for each Track:
        octopus_scheduler.planTrack(track, runtime, page, globalTick)
        → events[]
    → engine._schedule(event)                  // sorted insert into eventQ
    → engine._flushDueEvents(globalTick)       // outlet noteon/noteoff/cc
```

The scheduler is pure-ish: it mutates the per-Track runtime in place but
calls no Max globals. The engine handles all transport/IO.

### Edits (UI → state)

```
Browser pointer / Max patcher message
  → octopus_jweb_bridge (or octopus_ui.js for live.tab inputs)
  → octopus_data mutation setter
    → Dict.set + outlet broadcast
  → octopus_jweb_bridge forwards to jweb (panel-v2)
    → ui-mock/adapter.js translates to setLed calls
```

### Schema repair (init)

```
Max loadbang
  → octopus_data.ensure_state()
    → if Dict empty: reset_state() + sync_time_signature_from_live()
    → else: octopus_schema.repair_state(d)
    → outlet state_ok / state_repaired
```

## Where to make changes

| Goal                                            | Touch                                           |
| ----------------------------------------------- | ----------------------------------------------- |
| Add a new step attribute                        | `octopus_schema.js` (defaultStep) → `octopus_state.js` (snapshot shape) → `octopus_scheduler.js` (planTrack reads it) → tests |
| Add a new preset                                | `octopus_presets.js` (new `_presetN()` + branch in `buildPresetMutations`) → `tests/presets.test.js` |
| Change MIDI scheduling behaviour                | `octopus_scheduler.js` (`planTrack`) → `tests/scheduler.test.js` |
| Add a Live API hook                             | `octopus_live.js` → `tests/live.test.js` (extend the `LiveAPI` mock) |
| Add a UI message from Max → panel               | `ui-mock/adapter.js` (new route) → `ui-mock/panel-v2.html` `ROUTES` table → `tests/ui_adapter.test.js` |
| Add a UI interaction (pointer/key)              | `ui-mock/interactions.js` (`interpretClick` / `interpretEncoderDelta`) → `tests/interactions.test.js` |
| Add a new mode interpretation for the matrix    | `ui-mock/adapter.js` `_paintXxx` + `setMode` route → tests |
| Add a Live `LiveAPI` mock for a new property    | `tests/max_shim.js` `_liveProps` |

## panel-v2 integration into BenoQs.amxd

Currently `BenoQs.amxd` uses the legacy `ui-mock/index.html` via Max's
`jweb` object. To swap in `panel-v2.html`:

1. In the Max patcher, set the `jweb` object's URL parameter to
   `panel-v2.html` (relative to the project root).
2. The bridge (`octopus_jweb_bridge.js`) already speaks the same
   vocabulary (`updateStep`, `updatePlayhead`, `setTempo`, `setTransport`,
   `loadPage`) and panel-v2 exposes the matching `window.octoMessage(name,
   ...args)` entry point. No code changes needed.
3. For input: panel-v2 emits via `window.octoEmit(name, ...args)`. Override
   `window.octoEmit` from the Max side to route into the bridge's outlet 1:
   ```js
   window.octoEmit = function (name) {
     var args = Array.prototype.slice.call(arguments, 1);
     // jweb provides outlet() bound to the patcher
     outlet.apply(null, [0, name].concat(args));
   };
   ```
4. Verify with the dev-panel demo runner first — click "Run demo" inside
   the panel to confirm all the inbound routes update LEDs correctly.

Once integrated, the dev panel can be hidden behind a query string check
(`?dev=1`) so production renders without the overlay.

## Future paths

- **JUCE port.** The scheduler is now a self-contained function over plain
  snapshot structs; translating `planTrack` to C++ is a mechanical job. The
  engine's transport plumbing is framework-specific and would be rewritten.
  `Sequencer/` is the natural home (currently empty).
- **More Live API hooks.** Tempo follow, scene change, clip launch — all
  land in `octopus_live.js`. The LiveAPI mock in `tests/max_shim.js` is
  extensible via `sandbox._liveProps`.
- **MIDI keyboard transpose.** Schema already carries `transpose_mch` and
  `transpose_mode` on each Track; engine currently ignores them. Wiring
  involves a new inbound `transpose(track, note, vel)` message in the
  engine that sets a per-Track runtime offset, plus a pitch-add in
  `planTrack`. Reference manual §Keyboard Transpose (pg 78).
- **Visual regression.** Headless screenshot diff against a known baseline.
  Puppeteer would work but adds Node deps the project doesn't otherwise
  have; consider only when the panel layout stabilises further.

## Conventions

- ES5 throughout the Max-side modules (Max's JS engine is older). The
  `ui-mock/` modules use ES6 — they only run in modern browsers.
- No external Node dependencies. Everything self-contained.
- ADR-worthy decisions: architecture shape, integration patterns, and
  deliberate non-actions. See `docs/adr/0006-architecture-sweep.md` for an
  example of recording "we considered this and chose not to do it".
- Domain language: prefer `Snapshot` over `view`, `Scheduler` over
  `service`, `State Dict` over `model`. See `CONTEXT.md` for the canonical
  list.
