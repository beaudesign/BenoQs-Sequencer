# QA checklist (manual smoke test)

Run before tagging a release. Environment: Live **12.3.6+** (or documented minimum), M4L enabled.

## Install / load

- [ ] `BenoQs.amxd` loads next to all `.js` files without errors.
- [ ] Device UI shows matrix; no grey placeholder.
- [ ] `python3 tools/build_amxd.py` completes and produces `BenoQs.amxd`.

## Transport

- [ ] Live **Play** starts audible stepping when steps are enabled.
- [ ] **Stop** stops new notes; panic / all-notes-off behaviour is acceptable (no stuck notes after stop).

## Matrix

- [ ] Step toggle on/off in **PAGE** mode.
- [ ] **Shift**-click (if wired) or skip path per spec.
- [ ] **GRID** mode selects bank/page.

## Data / scale

- [ ] SCALE on/off and mode change affects pitch as expected.
- [ ] MIX target changes highlight / attribute path in UI.

## Time signature

- [ ] Change Live time signature (e.g. 4/4 → 3/4); header updates within ~1 s.

## Presets (developer)

- [ ] Sending `preset 0` resets; `preset 1`–`3` loads distinct patterns.

## Regression

- [ ] No repeated `print` spam in Max window (production build).
