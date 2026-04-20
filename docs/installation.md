# Installation

## Canonical artifact

The distributable device is **`BenoQs.amxd`** in the repository root (built by `python3 tools/build_amxd.py` from [`octopus_ui_main.maxpat`](../octopus_ui_main.maxpat) and the JavaScript modules next to it).

## Where to install

1. **Quick test:** Drag `BenoQs.amxd` onto any MIDI track. Ableton copies the device into the current Set. No manual install path is required.

2. **Permanent library (recommended):**
   - macOS: place the file under  
     `Music/Ableton/User Library/Presets/MIDI Effects/Max MIDI Effect/`  
     (create subfolders such as `BenoQs` if you want).
   - Windows: under  
     `Documents/Ableton/User Library/Presets/MIDI Effects/Max MIDI Effect/`.

3. **From source:** Keep the repo folder intact so the `.amxd` sits beside `octopus_data.js`, `octopus_engine.js`, `octopus_matrix_ui.js`, `octopus_ui.js`, and `octopus_scale.js`. The device loads those files at runtime; moving only the `.amxd` without its JS siblings will break the device.

## Build requirements

The Python build script shells an Ableton **Max MIDI Effect** template from your Live installation. If the build fails with “Missing Ableton template”, edit `LIVE_APP` in [`tools/build_amxd.py`](../tools/build_amxd.py) to match your Live app path.

## First launch

1. Open a **MIDI track**, drop **BenoQs**, arm the track if needed.
2. Press **Play** in Live so transport is running (the sequencer clock follows Live).
3. If the matrix stays grey or blank, confirm the `.js` files are next to the `.amxd` and rebuild the device.

See [compatibility.md](compatibility.md) for supported Live and Max versions.
