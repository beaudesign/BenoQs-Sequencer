# Scheduler owns per-Track music decisions; Engine owns transport + event queue

## Status

accepted

## Context

After ADR-0001 introduced the **State facade**, the engine's `tick()` was still ~200 lines containing chain-member resolution, multiplier-to-step-ticks math, pitch/velocity/length/strum resolution, chord pool randomization, MIDI event construction, and per-direction playhead advance — interleaved with `_schedule()` side effects on a shared `eventQ`. The engine module mixed two responsibilities: (1) "what does this track want to play this tick?" (music decisions) and (2) "when do events leave the module?" (transport / queue / outlet).

## Decision

Introduce `octopus_scheduler.js` exposing one function:

```
planTrack(track, runtime, page, globalTick) → events[]
```

Inputs are a `TrackSnapshot`, a per-track runtime accumulator, a `PageSnapshot`, and the current global tick. Output is an unordered array of MIDI events. The function mutates `runtime` in place (accum, pos, pingDir, chain.*) — documented at the top of the module.

The scheduler owns: `_grvDelayTicks`, `_strumOffsetTicks`, `_clampMidi`, chain-member selection, pitch/vel/len/sta resolution, chord/strum expansion, direction advance.

The engine retains: `running`, `globalTick`, `trackRt[]`, `eventQ`, `_schedule` (sorted insert), `_flushDueEvents`, `_allNotesOff`, `transport_state`, `reset_runtime`. `tick()` shrinks to a 12-line filter-and-dispatch loop.

## Rejected alternatives

- **Return a new runtime instead of mutating.** Cleaner functional contract but adds allocation per tick. Rejected for hot-path; the mutation is documented in the interface comment.
- **Make the scheduler depend on the State facade directly.** Would let it read its own snapshot. Rejected: snapshots are caller-provided so the scheduler stays testable with synthetic snapshots, and the engine retains control of when state is read (once per tick).
- **Extract `_grvDelayTicks` / `_strumOffsetTicks` to a separate "tables" module.** Premature; the tables aren't reused elsewhere and live with their consumer.

## Consequences

- `octopus_engine.js`: 418 → 125 lines. `tick()` is now ~20 lines.
- `octopus_scheduler.js`: new, 242 lines. Pure(-ish) per the Math.random caveat documented inline.
- Engine no longer depends on `octopus_scale.js` directly; the scheduler does.
- Schedule queue ordering is still owned by the engine (`_schedule` does sorted insertion); the scheduler returns events unordered, which matters because individual tracks may produce noteons and noteoffs at the same tick.
- A future port (e.g. JUCE) can translate `planTrack` as a pure function with the snapshot contract as input — the engine's transport plumbing remains framework-specific.
