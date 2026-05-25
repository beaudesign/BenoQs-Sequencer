# Compatibility

| Component | Minimum | Notes |
|-----------|---------|--------|
| Ableton Live | **12.0** (recommended **12.3.6+** for parity with commercial M4L devices) | Suite or Standard **with** Max for Live |
| Max for Live | **8** | Bundled with Live; Max 9 editor used when editing the device |
| OS | macOS 11+, Windows 10+ | Same as Ableton’s current requirements |

## Time signature

The device reads **Live’s** `signature_numerator` and `signature_denominator` via the Live API (`live_set`) and shows them in the matrix header. Changing the time signature in Live updates the displayed meter on the next sync tick (poll ~50 ms).

## MIDI

- Virtual ports (e.g. **IAC** on macOS) for routing to hardware or other apps.
- No external plug-in host required beyond Live.

## Not supported

- Running the `.amxd` without the bundled `.js` files (see [installation.md](installation.md)).
- Standalone Max (no Live) is not a supported target for this device.
