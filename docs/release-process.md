# Release process

1. **Version** — Update `CHANGELOG.md` with a `[Unreleased]` → dated section when cutting a release.
2. **QA** — Run [qa-checklist.md](qa-checklist.md).
3. **Build** — From repo root: `python3 tools/build_amxd.py` (requires Live app template path).
4. **Tag** — `git tag -a vX.Y.Z -m "BenoQs Sequencer vX.Y.Z"` and push tags.
5. **Artifact** — Attach `BenoQs.amxd` + all `.js` files + `docs/` + `CHANGELOG.md` (zip). Optionally include a user-built `.als` from [demos/README.md](../demos/README.md).

## Compatibility

Document the tested Live build in `CHANGELOG.md` for that tag. Minimum versions are listed in [compatibility.md](compatibility.md).
