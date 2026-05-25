// Snapshot constructors for tests. Mirrors octopus_state.js shapes; if those
// shapes change, change these too — failures here would catch the drift.

function makeStep(overrides) {
  var base = {
    index: 0,
    active: false, skip: false,
    pit_offset: 0, vel_offset: 0,
    len: 12, len_multiplier: 1, sta_offset: 0,
    amt: 0, grv: 0, pos: 8,
    mcc_value: null, chords: [], polyphony: 1,
    ghost: false, hyperstep: null, strum: 0,
  };
  if (overrides) for (var k in overrides) base[k] = overrides[k];
  return base;
}

function makeTrack(overrides) {
  var steps = [];
  for (var i = 0; i < 16; i++) steps.push(makeStep({ index: i }));
  var base = {
    index: 0,
    pit: 60, vel: 100,
    len_factor: 8, sta_factor: 8, dir: 1, amt: 0, grv: 0,
    mcc: null, mch: 1,
    multiplier: "1", multiplier_ticks: 12,
    paused: false, muted: false, soloed: false,
    chain_head: null, chain_members: [], chain_base: "individual",
    port: 1, channel: 1,
    program_change: 0, bank_change: null,
    transpose_mch: null, transpose_mode: "relative",
    steps: steps,
  };
  if (overrides) for (var k in overrides) base[k] = overrides[k];
  return base;
}

function makePage(overrides) {
  var tracks = [];
  for (var i = 0; i < 10; i++) tracks.push(makeTrack({ index: i, channel: i + 1, port: 1 }));
  var base = {
    bank: 0, page: 0,
    pit_offset: 0, vel_factor: 8, len: 16, sta: 1,
    cluster_mode: false, scale: null, mute_pattern: [],
    routingMode: "octopus", tracks: tracks,
  };
  if (overrides) for (var k in overrides) base[k] = overrides[k];
  return base;
}

function makeRuntime(overrides) {
  var base = {
    accum: 0, pos: 0, pingDir: 1,
    chain: { memberIdx: 0, segPos: 0, pingDir: 1 },
    held: {},
  };
  if (overrides) for (var k in overrides) {
    if (k === "chain" && overrides.chain) {
      for (var ck in overrides.chain) base.chain[ck] = overrides.chain[ck];
    } else {
      base[k] = overrides[k];
    }
  }
  return base;
}

// Seed accum so the next planTrack call crosses a step boundary.
function primeForStep(rt, track) {
  rt.accum = track.multiplier_ticks - 1;
  return rt;
}

module.exports = {
  makeStep: makeStep,
  makeTrack: makeTrack,
  makePage: makePage,
  makeRuntime: makeRuntime,
  primeForStep: primeForStep,
};
