autowatch = 1;

// Schema module: the canonical shape of the State Dict.
//
// Owns:
//   - Range/coercion utilities (clampInt, clampFloat, asBool, deepCopy, ensureArrayLen)
//   - Deterministic defaults (defaultGrid → banks → pages → tracks → steps + scales)
//   - Pure repair_state(d) that brings an existing Dict up to schema without
//     wiping non-default content.
//
// Doesn't own:
//   - The State Dict name or any Dict access wiring (octopus_data.js)
//   - Live API integration (octopus_data.js for now; see B3)
//   - Mutation setters that broadcast via outlet() (octopus_data.js)

// ---------- Utilities ----------

function clampInt(v, min, max) {
  v = Math.round(Number(v));
  if (isNaN(v)) v = min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function clampFloat(v, min, max) {
  v = Number(v);
  if (isNaN(v)) v = min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function asBool(v) {
  return !!v;
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function ensureArrayLen(arr, len, fillValue) {
  if (!Array.isArray(arr)) arr = [];
  if (arr.length > len) arr = arr.slice(0, len);
  while (arr.length < len) arr.push(deepCopy(fillValue));
  return arr;
}

// ---------- Defaults (deterministic) ----------

function defaultGlobalScale() {
  return {
    enabled: false,
    root: 0,
    intervals: [0, 2, 4, 5, 7, 9, 11],
  };
}

function defaultPageScale() {
  return {
    enabled: false,
    locked: false,
    root: 60,
    intervals: [0, 2, 4, 5, 7, 9, 11],
  };
}

function defaultStep() {
  return {
    active: false,
    skip: false,
    pit_offset: 0,
    vel_offset: 0,
    len: 12, // 12 ticks = 1/16 at 192 PPQN
    len_multiplier: 1,
    sta_offset: 0,
    amt: 0,
    grv: 0,
    pos: 8,
    mcc_value: null,
    chords: [],
    polyphony: 1,
    ghost: false,
    hyperstep: null,
    strum: 0, // Phase 1: used by chord engine; 0..9 (negative supported in UI layer)
  };
}

function defaultTrack(trackIndex) {
  // Manual default PIT values for tracks 0..9:
  // 0: C3, 1: D3, 2: E3, 3: G3, 4: A3, 5: C5, 6: D5, 7: E5, 8: G5, 9: A5
  var manual = [57, 55, 52, 50, 48, 60, 62, 64, 67, 69];

  return {
    pit: clampInt(manual[trackIndex] != null ? manual[trackIndex] : 60, 0, 127),
    vel: 100,
    len_factor: 8,
    sta_factor: 8,
    dir: 1,
    amt: 0,
    grv: 0,
    mcc: null, // null | 0..127 | "bend" | "pressure"
    mch: 1,    // 1..16 port1, 17..32 port2
    multiplier: "1",
    paused: false,
    muted: false,
    soloed: false,
    chain_head: null,
    chain_members: [],
    chain_base: "individual", // "individual" | "head"
    program_change: 0,
    bank_change: null,
    transpose_mch: null,
    transpose_mode: "relative",
    steps: ensureArrayLen([], 16, defaultStep()),
  };
}

function defaultPage() {
  var tracks = [];
  for (var i = 0; i < 10; i++) tracks.push(defaultTrack(i));

  return {
    pit_offset: 0,
    vel_factor: 8,
    len: 16,
    sta: 1,
    scale: defaultPageScale(),
    cluster_mode: false,
    mute_pattern: ensureArrayLen([], 10, false),
    tracks: tracks,
  };
}

function defaultBank() {
  var pages = [];
  for (var i = 0; i < 16; i++) pages.push(defaultPage());
  return { pages: pages };
}

function defaultGrid() {
  var banks = [];
  for (var i = 0; i < 10; i++) banks.push(defaultBank());

  // page_sets: 16 slots, each an array of {bank,page} pairs
  var pageSets = [];
  for (var s = 0; s < 16; s++) pageSets.push([]);

  return {
    tempo_bpm: 120.0,
    midi_port1_channel: 1,
    active_page: { bank: 0, page: 0 },
    live_time_signature: { numerator: 4, denominator: 4 },
    page_sets: pageSets,
    global_scale: defaultGlobalScale(),
    banks: banks,
    // routing mode: "octopus" | "fixed"
    midi_routing_mode: "octopus",
    fixed_routing: { base_channel_port1: 1, base_channel_port2: 1 },
  };
}

// ---------- Schema repair ----------
//
// repair_state(d) brings the given Dict up to schema in-place. Returns the
// number of repairs applied (0 = clean). The caller decides what to do with
// the count (e.g. broadcast a "state_repaired" message).
//
// Repair rules:
//   - Any missing root key is populated from defaults.
//   - active_page is clamped to {bank: 0..9, page: 0..15}.
//   - schema_version is set to 1 if absent (placeholder for future migrations).
//
// Does NOT touch the full bank/page/track/step subtree — that stays as the
// user left it. The defaults are added only at the root keys.

var SCHEMA_VERSION = 1;
var ROOT_KEYS = [
  "banks",
  "active_page",
  "page_sets",
  "global_scale",
  "midi_routing_mode",
  "fixed_routing",
  "tempo_bpm",
  "live_time_signature",
];

function repair_state(d) {
  var def = defaultGrid();
  var changed = 0;

  for (var i = 0; i < ROOT_KEYS.length; i++) {
    var key = ROOT_KEYS[i];
    if (d.get(key) == null) {
      d.set(key, def[key]);
      changed++;
    }
  }

  var ap = d.get("active_page") || {};
  var repairedAp = {
    bank: clampInt(ap.bank, 0, 9),
    page: clampInt(ap.page, 0, 15),
  };
  if (ap.bank !== repairedAp.bank || ap.page !== repairedAp.page) {
    d.set("active_page", repairedAp);
    changed++;
  }

  if (d.get("schema_version") == null) {
    d.set("schema_version", SCHEMA_VERSION);
    changed++;
  }

  return changed;
}
