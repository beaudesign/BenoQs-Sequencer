# BenoQs UI mock (`index.html`)

Standalone HTML/CSS/JS prototype of the device shell and right-hand control panel. It mirrors layout intent for the Ableton `jweb` surface; the Live device uses `octopus_matrix_ui.js` and may differ until a dedicated pass aligns colors and strokes.

## Design intent (light, refined)

The mock follows a **light, refined** direction inspired by **Pivot**- and **Tonality**-style UIs: thin hairline dividers, restrained shadows, flat or near-flat fills with subtle gradients, generous spacing in the chrome, and consistent stroke weights in the SVG panel. It is **reference-inspired**, not a pixel copy—Octopus step semantics and BenoQs interactions stay primary.

### Tokens

Key CSS custom properties live on `:root` in `index.html`, including `--stroke-hairline`, `--stroke-soft`, `--chrome-fg`, `--chrome-muted`, step and ball fills, and beat-gap rhythm. Adjusting those variables retunes the whole shell without forking logic.

### Viewport checks

Smoke layouts at approximately **800×520** and **narrow** widths: the stylesheet uses `(max-width: 1100px), (max-height: 620px)` and `(max-width: 900px), (max-height: 520px)` to approximate cramped Ableton device sizes. Resize the browser or devtools dock to confirm the matrix and right panel remain usable.

### Running

Open `index.html` in a browser (double-click or serve the folder). No build step. Max bridge calls are no-ops when `window.max` is undefined.
