# BenoQs / Octopus

Max for Live sequencer modeled on the Genoqs Octopus hardware. State lives in a Max Dict; runtime is JS inside `js` / `jsui` objects. This document defines the domain language used in code and conversations.

## Language

### State storage and access

**State Dict**:
The single Max Dict named `octopus_state` holding all persistent state (banks, pages, tracks, steps, UI mode, routing, time signature). Written only by `octopus_data.js`.
_Avoid_: state store, database, model.

**State facade** (`octopus_state.js`):
The read-side JS module that turns raw **State Dict** entries into resolved **Snapshots** for the **Engine** and **Matrix UI**. Owns merge math (routing resolution, scale resolution, multiplier parsing). Does not mutate.
_Avoid_: model, store, repository, service.

**Snapshot**:
A plain JS object returned by the **State facade** that represents one read of state at a moment in time. Three shapes: **PageSnapshot**, **TrackSnapshot**, **StepSnapshot**. Snapshots carry **resolved values**, not raw Dict shapes.
_Avoid_: view, DTO.

**Resolved value**:
A value the **Snapshot** has already merged from multiple Dict layers (page + track + step, or global scale + page scale, or routing mode + track `mch`). Callers must not redo the merge.
_Avoid_: derived, computed, final.

### Sequencer model

**Grid**:
The full 10 × 16 matrix of **Pages**, organized into 10 **Banks** of 16 **Pages** each. Exactly one **Page** is the **Active Page** at any moment.

**Bank**:
A group of 16 **Pages**. There are 10 of them.

**Page**:
A snapshot of musical state: 10 **Tracks**, a page-level scale, a pitch offset, page length, velocity factor. The unit users switch between in performance.

**Track**:
One of 10 rows on a **Page**. Owns a default pitch, MIDI channel (`mch`), multiplier (e.g. `"1"`, `"1/3"`, `"2"`), direction, groove, and 16 **Steps**.

**Step**:
One cell in a **Track**. Either active or inactive; carries offsets (pit, vel, sta), length, optional chord pool, strum, polyphony, ghost flag, skip flag.

**Active Page**:
The `{bank, page}` pair the **Engine** is currently playing and the **Matrix UI** is currently editing.

**Page Set**:
A user-defined ordered list of `{bank, page}` pairs in one of 16 slots; used to chain pages for performance. Not currently played by the **Engine**.

**Preset**:
A factory pattern identified by id 0..3. Preset 0 = reset. Presets 1..3 are pure content defined in `octopus_presets.js` as a list of Dict mutations. Mutations are `{path, value}` records keyed by **State Dict** path. Applying a preset writes the mutations and sets the **Active Page** to bank 0 / page 0.

### Playback

**Engine** (`octopus_engine.js`):
The JS module that runs on every Max **Tick**, reads a **PageSnapshot**, dispatches each playable **Track** to the **Scheduler**, and emits scheduled MIDI events to outlets. Owns the sorted event queue and transport state. Does **not** decide what to play.

**Scheduler** (`octopus_scheduler.js`):
The module that decides what one **Track** plays this **Tick**. Function `planTrack(track, runtime, page, globalTick) → events[]`. Owns chain-member selection, multiplier-to-step-ticks accumulation, pitch/velocity/length/strum resolution, chord expansion, **Groove** and **Strum** offsets, direction advance. Mutates the per-track **Runtime** in place.

**Runtime**:
Per-**Track** ephemeral state held by the **Engine**: `{ accum, pos, pingDir, chain: { memberIdx, segPos, pingDir } }`. Reset on transport stop. Mutated by the **Scheduler**.

**Tick**:
One PPQN tick from Live's transport. `TICKS_PER_QN = 192`. The **Engine** receives `tick` messages and advances state by exactly one tick each call.

**Multiplier**:
A per-**Track** rate expressed as a string (`"1"`, `"1/2"`, `"1/3"`, `"2"`, `"3"`, `"1/16"` etc.) parsed into **step ticks** — how many **Ticks** elapse between successive **Step** advances on that **Track**.
_Avoid_: rate, divisor.

**Chain**:
A **Track** can be a **Chain Head** with one or more **Chain Member** tracks. When playing, the head substitutes the active member's steps according to `chain_base` (`"individual"` reads each member's own per-step values, `"head"` reads the head's). Members are skipped by the engine's top-level track loop.

**Strum**:
Per-**Step** delay applied across the notes of a chord (when `chords` is non-empty), in ticks.

**Groove (`grv`)**:
Per-**Track** shuffle amount that delays even-indexed **Steps** by a number of ticks.

**Skip**:
A per-**Step** flag. A skipped **Step** advances the position but emits no MIDI.

**Ghost**:
A per-**Step** flag. (Reserved; not yet rendered by the **Engine**.)

### Routing

**Routing Mode**:
Either `"octopus"` (track `mch` directly determines port/channel via a 1..32 mapping where 1..16 = port 1, 17..32 = port 2) or `"fixed"` (all tracks share a base channel per port).

**Resolved port/channel**:
The `{port, channel}` pair produced by the **State facade** after applying **Routing Mode** to a **Track**'s `mch`. **Engine** receives this on the **TrackSnapshot** and does not redo the calculation.

### UI surfaces

**Matrix UI** (`octopus_matrix_ui.js`):
The `jsui` renderer drawing the 10 × 16 grid inside the Max patcher. Reads **Snapshots**; emits click messages to the patcher.

**jweb UI**:
The HTML UI in `ui-mock/index.html`, loaded inside Max's `jweb` object in the device. Talks to the **State Dict** via `octopus_jweb_bridge.js`.

**UI Mode**:
One of `"grid"`, `"page"`, `"track"`, `"step"`. Controls what the **Matrix UI** draws and what edits map to.

**Mix Target**:
The currently-selected per-cell attribute being edited in track/step modes: `vel | pit | len | sta | pos | dir | amt | grv | mcc | mch`.

## Relationships

- A **Grid** contains 10 **Banks**, each containing 16 **Pages**.
- A **Page** contains 10 **Tracks**, each containing 16 **Steps**.
- The **Engine** consumes one **PageSnapshot** per **Tick** and emits MIDI.
- The **State facade** produces **Snapshots** from the **State Dict**.
- The **Matrix UI** and **jweb UI** both render from **Snapshots**; only mutation functions in `octopus_data.js` write the **State Dict**.
- A **Chain Head** **Track** plays steps from one **Chain Member** at a time.

## Example dialogue

> **Engine author:** "On every **Tick** I need the **Resolved port/channel** for each **Track**, plus the merged scale."
> **Facade author:** "Right — that's the **TrackSnapshot** and the `scale` field on the **PageSnapshot**. The facade applies **Routing Mode** before you see it. If you find yourself re-reading the **State Dict** to compute anything, that's a missing **Resolved value** — tell me and I'll move it into the **Snapshot**."

## Flagged ambiguities

- "model" was used loosely for both the **State Dict** and the **State facade**. Resolved: **State Dict** is storage, **State facade** is the read API; don't call either "the model."
- "page" sometimes referred to the **Active Page** pair `{bank, page}` and sometimes to the full **Page** object. Resolved: use **Page Ref** for the pair (`{bank, page}`), **Page** for the object.
