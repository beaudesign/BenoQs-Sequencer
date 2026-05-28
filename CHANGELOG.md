# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Tessella-tier product scaffolding: `docs/` (installation, compatibility, FAQ, manual outline, Push mapping spec, QA checklist, release process).
- `live_time_signature` in state (synced from Live via `LiveAPI` on `live_set`); matrix header shows meter (e.g. `4/4`).
- Periodic `sync_time_signature_from_live` from transport poll (`qmetro` → `js`).
- Factory presets `preset 0`–`3` in `octopus_data.js` (init, quarters, poly, scale).
- Dependency-free Node test harness (`node tests/run.js`) with 115 cases across 8 files, covering schema repair, the state facade, scheduler decisions, presets, Live sync, UI adapter/interactions, and engine tick-to-MIDI wiring. `tests/max_shim.js` supplies the Max globals (`Dict`, `LiveAPI`, `outlet`, `include`) inside a `vm` context.
- `ui-mock/panel-v2.html`: a scale-responsive (2400×1300 unit) SVG of the Octopus hardware surface with stable element ids, a 10-state LED vocabulary, an inbound adapter (`ui-mock/adapter.js`) that maps engine messages to LED state, an outbound interaction layer (`ui-mock/interactions.js`) for pointer/encoder input, and a dev-panel demo runner.
- MIDI keyboard transpose: a `transpose(track, note, velocity)` engine message sets a per-Track runtime offset that the scheduler folds into pitch. Relative mode (offset = note − 60) and absolute mode (offset = note − track pitch, so the played note lands exactly); velocity > 88 resets the offset (manual §Keyboard Transpose).
- Developer documentation: architecture decision records (`docs/adr/0001`–`0006`), a `CONTEXT.md` domain glossary, and a `docs/development.md` orientation guide (test/module maps, dataflow, where-to-change table).

### Fixed

- Engine `tick()` no longer calls full `ensure_state()` every step (dict repair + meter sync was unnecessarily hot); meter sync stays on `qmetro` + load sequence only.

### Changed

- **Architecture:** the monolithic engine was decomposed into focused modules — `octopus_state.js` (read facade → `PageSnapshot`), `octopus_scheduler.js` (per-Track music decisions via `planTrack`), `octopus_schema.js` (defaults + `repair_state`), `octopus_live.js` (LiveAPI integration), and `octopus_presets.js` (preset mutation lists). `octopus_engine.js` is now just transport state, the event queue, and tick dispatch — making the scheduler a self-contained function over plain snapshot structs, the natural seam for a future JUCE port.
- Global scale is resolved through the state facade (page scale wins, else global, else none) so the scheduler reads a single resolved scale.
- PAGE matrix: vertical **beat boundary** guides from Live time signature (16 steps = one bar of 16ths; e.g. 4/4 → line every 4 steps).
- `demos/README.md` and `presets/README.md` for demo set and preset usage.
- Build output renamed to **`BenoQs.amxd`** (see `tools/build_amxd.py`).
- README: canonical device name, install path, links to documentation.
