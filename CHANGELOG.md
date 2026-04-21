# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Tessella-tier product scaffolding: `docs/` (installation, compatibility, FAQ, manual outline, Push mapping spec, QA checklist, release process).
- `live_time_signature` in state (synced from Live via `LiveAPI` on `live_set`); matrix header shows meter (e.g. `4/4`).
- Periodic `sync_time_signature_from_live` from transport poll (`qmetro` → `js`).
- Factory presets `preset 0`–`3` in `octopus_data.js` (init, quarters, poly, scale).

### Fixed

- Engine `tick()` no longer calls full `ensure_state()` every step (dict repair + meter sync was unnecessarily hot); meter sync stays on `qmetro` + load sequence only.
- `demos/README.md` and `presets/README.md` for demo set and preset usage.
- Build output renamed to **`BenoQs.amxd`** (see `tools/build_amxd.py`).

### Changed

- README: canonical device name, install path, links to documentation.
