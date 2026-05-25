# Ableton Push — mapping specification (future work)

This document specifies **target** behaviour for a Tessella-level Push integration. **No Push mapping is implemented in the codebase yet.** Implement in phases after freezing PAGE/TRACK/STEP/GRID semantics.

## Goals

- Performance-safe: no accidental project edits when navigating modes.
- Clear **mode** feedback (PAGE vs TRACK vs STEP vs GRID) via display or clip/name row.
- Minimal mapping surface: **one primary grid** (8×8) mapped to the **10×16** matrix with scroll or bank shift.

## Mode: PAGE (default)

| Push element | Intended action |
|--------------|-----------------|
| Pad grid (8×8) | Map to an 8×8 **window** of the 10×16 matrix; **cursor** keys or **Octave**/**page** buttons shift the window vertically/horizontally. |
| Step **select** | Toggle step on/off; **Shift** + pad = skip (if shift is available). |
| **Duplicate** / **double** | Duplicate pattern row (future). |
| **Play** | Mirror Live transport (no duplicate of Live’s global play). |

## Mode: TRACK

| Element | Action |
|---------|--------|
| Pads | Toggle steps for **selected track** or scroll track selection. |
| Encoders | Map to MIX target (VEL/PIT/…) when “track” focus is active. |

## Mode: STEP

| Element | Action |
|---------|--------|
| Encoders | Pitch offset, length, velocity for selected step. |
| Pads | Select step index 0–15. |

## Mode: GRID

| Element | Action |
|---------|--------|
| Pads | Bank/page selection on 10×16 grid (subset of hardware). |

## Technical approach (Milestone 1)

1. Expose a **small set** of `live.dial` / `live.tab` parameters with stable **Automation IDs** for Push mapping.
2. **LiveAPI** (`live_set`, `live_set tracks`) for **clip** naming only; avoid heavy polling.
3. **Milestone 2:** Optional **M4L Control Surface** bridge (JavaScript) to map `live.path` to pad presses — higher effort.

## Out of scope (initial release)

- Step-by-step LED colours matching hardware Octopus LEDs.
- Multi-device Push takeover.

## References

- Ableton Live Object Model (LOM) for `live_set` and `signature_*`.
- Max for Live `live.path`, `live.observer`, `live.remote~` patterns.
