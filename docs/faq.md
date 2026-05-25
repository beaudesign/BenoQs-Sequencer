# FAQ

## The device shows a grey box or no matrix

The Max for Live device needs its JavaScript files in the **same folder** as `BenoQs.amxd`: `octopus_data.js`, `octopus_engine.js`, `octopus_matrix_ui.js`, `octopus_ui.js`, and `octopus_scale.js`. Re-download the full project or rebuild with `python3 tools/build_amxd.py` and keep the output next to the sources.

## No MIDI output

1. Confirm the track MIDI routing to the intended instrument or IAC bus.
2. Ensure **Live transport is playing** if you expect clock-driven behaviour.
3. Use the device’s routing tab (**OCTOPUS_MCH** vs **FIXED_PER_TRACK**) as documented in [manual.md](manual.md).

## Time signature does not match Live

The header reads Live’s meter via the Live API. If you are not inside Live (e.g. opening the patch in Max only), the API may be unavailable and the display defaults to **4/4**.

## Presets

Factory presets are applied by sending messages to the data script (see [presets/README.md](../presets/README.md)). Live-native `.amxd` presets for automated parameters are limited; the main pattern state lives in the dict.

## Push / hardware controllers

There is no Ableton Push mapping yet. See [push-mapping.md](push-mapping.md) for the planned surface.

## Where is the manual?

Start with [manual.md](manual.md). Full wiki-style docs may be added separately.
