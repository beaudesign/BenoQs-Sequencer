# BenoQs Sequencer

> *A reimagining of the iconic GenoQs Octopus (2008), rebuilt in Max/MSP and Ableton Live.*

BenoQs is not just a sequencer. It is an instrument for exploration.

---

## Overview

The BenoQs Sequencer draws its inspiration from the philosophy and design of the legendary GenoQs Octopus: a performance-driven, deeply interactive sequencing environment that encourages experimentation at every level.

This project recreates that spirit in a modern hybrid setup using Max/MSP and Ableton, with a focus on:

- Non-linear sequencing
- Unconventional timing and tempo structures
- Hands-on, tactile exploration
- Deep integration with modular hardware

---

## Canonical install

1. Build or clone the repository so `**BenoQs.amxd`** sits in the **same folder** as `octopus_data.js`, `octopus_engine.js`, `octopus_matrix_ui.js`, `octopus_ui.js`, and `octopus_scale.js`.
2. Drag `**BenoQs.amxd`** onto a MIDI track in Ableton Live, or copy it into your User Library under **Presets → MIDI Effects → Max MIDI Effect** (see [docs/installation.md](docs/installation.md)).

---

## Documentation


| Document                                           | Description                                                  |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [docs/installation.md](docs/installation.md)       | Where to put the device, build requirements, troubleshooting |
| [docs/compatibility.md](docs/compatibility.md)     | Live / Max versions, time signature behaviour                |
| [docs/manual.md](docs/manual.md)                   | User manual (outline)                                        |
| [docs/faq.md](docs/faq.md)                         | Frequently asked questions                                   |
| [docs/push-mapping.md](docs/push-mapping.md)       | Push integration spec (planned)                              |
| [docs/qa-checklist.md](docs/qa-checklist.md)       | Release smoke test                                           |
| [docs/release-process.md](docs/release-process.md) | Tagging and shipping                                         |
| [demos/README.md](demos/README.md)                 | How to build a demo Live Set                                 |
| [presets/README.md](presets/README.md)             | Factory preset indices                                       |
| [CHANGELOG.md](CHANGELOG.md)                       | Version history                                              |


---

## Requirements

- Ableton Live **12+** with Max for Live (recommended **12.3.6+**; see [docs/compatibility.md](docs/compatibility.md))
- Max for Live **8+**
- (Optional) Virtual MIDI bus (e.g. IAC Driver on macOS) for hardware routing

---

## Build the device

From the repo root (macOS default Live path can be edited in the script):

```bash
python3 tools/build_amxd.py
```

Writes `**BenoQs.amxd**` next to the source `.js` files.

---

## Features (summary)


| Feature                  | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| Multi-layered sequencing | Grid, Page, Track, and Step hierarchy                 |
| Experimental timing      | Tempo multipliers, groove/shuffle, step offsets       |
| Modular-first design     | MIDI routing for hardware                             |
| Pattern behaviour        | Skip, directions, chaining (MVP scope)                |
| Polyphonic steps         | Chords / strum (engine)                               |
| Live integration         | Transport sync + **time signature** display from Live |


---

## Credits

This project would not exist without the original work of **Gabriel Seher** and **Marcel Achim** at genoQs Machines, Stuttgart.

---

## Status

Active development: core engine, native M4L UI, and product documentation.

---

## License

This project is an independent creative reimagining and is not affiliated with or endorsed by genoQs Machines.

---

*BenoQs is not meant to be fully predictable. If you are looking for control, you will find it. If you are looking to lose it: even better.*