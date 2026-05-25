# BenoQs Sequencer — User Manual (outline)

This document is a **structured outline** for the full manual. Expand each section as features stabilize.

## 1. Introduction

- Purpose: multi-track step sequencer inspired by the GenoQs Octopus hierarchy.
- Components: **Grid → Bank → Page → Track → Step** (MVP focuses on one active page, 10 tracks).

## 2. Hierarchy

| Level | Role |
|-------|------|
| **Grid** | Select bank/page (16×10 grid in GRID mode). |
| **Page** | Holds 10 tracks × 16 steps, scale, page length. |
| **Track** | MIDI channel routing, pitch, direction, multiplier, mute. |
| **Step** | On/off, skip, chord, per-step offsets (pitch, length, etc.). |

## 3. UI modes (PAGE / TRACK / STEP / GRID)

- **PAGE:** Edit the 10×16 step matrix for the active page.
- **TRACK:** Single-track row + attribute bar (MVP).
- **STEP:** Step detail (offsets, chord flags).
- **GRID:** Navigate banks and pages.

## 4. MIX target (edit lens)

The **MIX** target (VEL, PIT, LEN, …) selects which parameter the UI and encoders emphasize. The matrix status strip shows **bank, page, mode, mix target, and Live time signature**.

## 5. Scale

- Per-page scale: enable/disable, mode (e.g. MAJ, MIN, CHR).
- Force-to-scale quantizes pitch output per engine rules.

## 6. Transport

- Follows **Ableton Live** transport (host clock).
- **STOP/PLAY** controls map to engine run state.
- **Time signature** shown in the matrix header reflects Live’s meter when the Live API is available.
- In **PAGE** mode, **vertical beat guides** subdivide the 16-step row using the current meter: the bar is treated as 16 sixteenth notes, so beat length in steps is approximately `16 ÷ numerator` (e.g. 4/4 → guides every 4 steps).

## 7. MIDI routing

- **OCTOPUS_MCH:** Channel assignment follows the Octopus-style `mch` model.
- **FIXED_PER_TRACK:** Simpler fixed mapping per track.

## 8. Panic / all notes off

The engine sends an all-notes-off style sweep on stop/panic (see engine implementation).

## 9. Known limitations (MVP)

- Single active page focus in UI; deeper bank/page features evolving.
- Push not supported yet (see [push-mapping.md](push-mapping.md)).

## 10. Glossary

- **PPQN:** Pulses per quarter note (internal resolution 192).
- **MCH:** MIDI channel / routing slot in Octopus terminology.
- **MIX target:** The parameter “lens” for editing and display.
