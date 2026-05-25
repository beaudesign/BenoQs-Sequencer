# Factory presets

Patterns are applied inside **`octopus_data.js`** via the **`preset <id>`** message (`id` = **0…3**). You can trigger them from the Max patcher (message box) or `call preset 1` on the `js` object for testing.

| ID | Name | Description |
|----|------|-------------|
| 0 | **Init** | Full reset (`reset_state()`). |
| 1 | **Quarters** | Four-on-the-floor style hits on steps 0, 4, 8, 12 per track. |
| 2 | **Poly** | Varied per-track patterns; page length 16. |
| 3 | **Scale** | Major scale enabled on the page; sparse checkerboard pattern. |

## Live-native preset browser

The device state is primarily stored in the **`octopus_state`** dict, not in Live’s automation parameters. **Live’s blue “Save Preset”** button saves only the device parameters that are exposed as `live.*` objects; it does **not** dump the full dict. For full-state snapshots, future work could add explicit JSON import/export (see roadmap).

## Developer: send a preset from the patch

Add a message box: `preset 0` through `preset 3` → `js-data` `octopus_data.js` (same inlet as `ensure_state`).
