---
name: benoqs-ui-mock-front-end
description: >-
  Maintains the BenoQs HTML shell in ui-mock (light-refined, Pivot/Tonality-inspired).
  Use when editing ui-mock/index.html, #right-svg, buildRightPanel(), matrix/step styling,
  chrome tokens, or when the user mentions jweb mock, light shell, or sequencer UI polish.
---

# BenoQs ui-mock front-end

## Scope

- **Primary file:** `ui-mock/index.html` (CSS in `<style>`, SVG built in JS).
- **Intent doc:** `ui-mock/README.md` — keep design intent in sync when behavior or tokens change materially.
- **Live / Max:** `octopus_matrix_ui.js` is a separate surface; only align colors/strokes there when explicitly requested.

## Design language (non-negotiables)

1. **Light, refined:** warm paper background, ink foreground, thin dividers — not a dark theme unless the user asks.
2. **Tokens first:** add or change visuals via `:root` custom properties (`--stroke-hairline`, `--stroke-soft`, `--chrome-fg`, `--chrome-muted`, `--accent`, step/ball tokens). Keep `--text` / `--muted` mapped from `--chrome-*`; avoid duplicating raw color logic in many selectors.
3. **Thin chrome:** hairline borders, subtle inset highlights, low drop-shadow spread on circular controls.
4. **Typography:** Google Sans; secondary labels often **lowercase** with modest letter-spacing; preserve compact `@media` breakpoints for ~1100×620 and ~900×520.
5. **Matrix:** step cells use border-first + flat/soft gradient fills; preserve `.on`, `.skip`, `.chord`, `.sel`, `.inactive`, `.muted` semantics and contrast.
6. **Right panel SVG:** extend `SVG_P`, `svgDropBall`, `svgDropLed` instead of scattering `stroke-width` / `filter` literals. Keep guides + spiral a **single** stroke-weight family. Active mix-target on the ring stays the clearest accent.

## Implementation checklist

- [ ] Prefer editing tokens over one-off hex values in CSS.
- [ ] For new SVG elements, reuse `SVG_FONT` and centralized stroke/weights from `SVG_P`.
- [ ] After layout changes, mentally smoke-test narrow width + short height (existing media queries).
- [ ] If README’s “design intent” no longer matches the UI, update `ui-mock/README.md` in the same change.

## Out of scope (unless user asks)

- Dark theme or theme toggle.
- Rebuilding the right panel into an unrelated icon grid.
- Full mgraphics parity in Live without a dedicated pass.
