# Demo Live Set

Ableton Live Sets (`.als`) are binary projects; this repository does **not** commit a canned `.als` so we avoid opaque blobs and merge noise. Use this recipe to build a **Tessella-style** demo session locally.

## Recipe (5–10 minutes)

1. Create a new Live Set (empty or template).
2. Add **MIDI tracks** (suggestions):
   - **Track 1:** BenoQs → **External Instrument** or hardware synth (IAC / interface).
   - **Track 2:** Same with a different sound (bass).
   - **Track 3:** Optional drum rack or another BenoQs for polyrhythms.
3. Load **`BenoQs.amxd`** from the repo root (after [building](../docs/installation.md)) onto each MIDI track.
4. Set **tempo** to taste (e.g. 120 BPM). Set **time signature** in Live; confirm the device header shows the same meter.
5. In **PAGE** mode, enable steps on several tracks; press **Play** in Live.
6. Rename the first scene or clip **“START HERE — BenoQs demo”** so opening the Set is self-explanatory.
7. **File → Save Live Set As…** and save the `.als` next to your project, or export via **Collect All and Save** if you move media.

## Optional: capture a preset

Use the factory preset messages documented in [`presets/README.md`](../presets/README.md) before saving, so the Set opens with a strong default pattern.

## Packaging

For distribution, zip:

- `BenoQs.amxd` + all `.js` files  
- `README.md` and `docs/`  
- Your saved `.als`  
- Optional: `CHANGELOG.md`
