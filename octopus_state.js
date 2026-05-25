autowatch = 1;

// State facade: read-only view of octopus_state Dict.
// Returns Snapshots with Resolved values (routing → port/channel, multiplier → ticks,
// page scale resolved). Mutations live in octopus_data.js; this module does not write.

include("octopus_data.js"); // for STATE_DICT_NAME

var STEP_TICKS_X1 = 12; // 1/16 at 192 PPQN; matches engine DEFAULT_STEP_TICKS_X1

function _clampInt(v, min, max) {
  v = Math.round(Number(v));
  if (isNaN(v)) v = min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function _parseMultiplier(multStr) {
  if (multStr === null || multStr === undefined) return 1.0;
  var s = String(multStr).trim();
  if (!s.length) return 1.0;
  if (s.indexOf("/") !== -1) {
    var parts = s.split("/");
    if (parts.length === 2) {
      var a = parseFloat(parts[0]);
      var b = parseFloat(parts[1]);
      if (!isNaN(a) && !isNaN(b) && b !== 0) return a / b;
    }
  }
  var f = parseFloat(s);
  if (!isNaN(f) && f > 0) return f;
  return 1.0;
}

function _resolvePortChan(mch, routingMode, fixedRouting, trackIndex) {
  if (routingMode === "fixed") {
    var base1 = fixedRouting && fixedRouting.base_channel_port1 ? fixedRouting.base_channel_port1 : 1;
    var ch1 = ((base1 - 1 + trackIndex) % 16) + 1;
    return { port: 1, ch: ch1 };
  }
  var v = Math.round(Number(mch) || 1);
  if (v <= 16) return { port: 1, ch: Math.max(1, Math.min(16, v)) };
  return { port: 2, ch: Math.max(1, Math.min(16, v - 16)) };
}

function _getDict() {
  return new Dict(STATE_DICT_NAME);
}

function _dictReady(d) {
  return d && d.getkeys && d.getkeys() !== null;
}

function load_active_page_ref() {
  var d = _getDict();
  if (!_dictReady(d)) return { bank: 0, page: 0 };
  var ap = d.get("active_page") || { bank: 0, page: 0 };
  return { bank: _clampInt(ap.bank, 0, 9), page: _clampInt(ap.page, 0, 15) };
}

function load_ui_state() {
  var d = _getDict();
  if (!_dictReady(d)) return { mode: "page", mixTarget: "vel" };
  return {
    mode: String(d.get("ui_mode") || "page").toLowerCase(),
    mixTarget: String(d.get("ui_mix_target") || "vel").toLowerCase(),
  };
}

function load_time_signature() {
  var d = _getDict();
  if (!_dictReady(d)) return { numerator: 4, denominator: 4 };
  var ts = d.get("live_time_signature") || {};
  return {
    numerator: _clampInt(ts.numerator != null ? ts.numerator : 4, 1, 32),
    denominator: _clampInt(ts.denominator != null ? ts.denominator : 4, 1, 32),
  };
}

function _resolvePageScale(pageObj /*, globalScale */) {
  // Phase 1: page scale wins; global scale is currently unused by engine.
  // Returning null means "no quantization."
  var sc = pageObj && pageObj.scale;
  if (!sc || !sc.enabled) return null;
  return {
    enabled: true,
    root: _clampInt(sc.root, 0, 127),
    intervals: Array.isArray(sc.intervals) ? sc.intervals.slice(0) : [0, 2, 4, 5, 7, 9, 11],
    mode: sc.mode ? String(sc.mode) : null,
    locked: !!sc.locked,
  };
}

function _buildStepSnapshot(stepObj, stepIndex) {
  if (!stepObj) {
    return {
      index: stepIndex,
      active: false, skip: false,
      pit_offset: 0, vel_offset: 0,
      len: 12, len_multiplier: 1, sta_offset: 0,
      amt: 0, grv: 0, pos: 8,
      mcc_value: null, chords: [], polyphony: 1,
      ghost: false, hyperstep: null, strum: 0,
    };
  }
  return {
    index: stepIndex,
    active: !!stepObj.active,
    skip: !!stepObj.skip,
    pit_offset: Number(stepObj.pit_offset) || 0,
    vel_offset: Number(stepObj.vel_offset) || 0,
    len: stepObj.len != null ? Number(stepObj.len) : 12,
    len_multiplier: stepObj.len_multiplier != null ? Number(stepObj.len_multiplier) : 1,
    sta_offset: Number(stepObj.sta_offset) || 0,
    amt: Number(stepObj.amt) || 0,
    grv: Number(stepObj.grv) || 0,
    pos: stepObj.pos != null ? Number(stepObj.pos) : 8,
    mcc_value: stepObj.mcc_value != null ? stepObj.mcc_value : null,
    chords: Array.isArray(stepObj.chords) ? stepObj.chords.slice(0) : [],
    polyphony: stepObj.polyphony != null ? Number(stepObj.polyphony) : 1,
    ghost: !!stepObj.ghost,
    hyperstep: stepObj.hyperstep != null ? stepObj.hyperstep : null,
    strum: Number(stepObj.strum) || 0,
  };
}

function _buildTrackSnapshot(trackObj, trackIndex, routingMode, fixedRouting) {
  var tr = trackObj || {};
  var mult = tr.multiplier != null ? tr.multiplier : "1";
  var multTicksPerStep = STEP_TICKS_X1 / _parseMultiplier(mult);
  if (!(multTicksPerStep > 0)) multTicksPerStep = STEP_TICKS_X1;

  var pc = _resolvePortChan(tr.mch, routingMode, fixedRouting, trackIndex);

  var steps = [];
  var rawSteps = Array.isArray(tr.steps) ? tr.steps : [];
  for (var i = 0; i < 16; i++) steps.push(_buildStepSnapshot(rawSteps[i], i));

  return {
    index: trackIndex,
    pit: tr.pit != null ? Number(tr.pit) : 60,
    vel: tr.vel != null ? Number(tr.vel) : 100,
    len_factor: tr.len_factor != null ? Number(tr.len_factor) : 8,
    sta_factor: tr.sta_factor != null ? Number(tr.sta_factor) : 8,
    dir: tr.dir != null ? Number(tr.dir) : 1,
    amt: Number(tr.amt) || 0,
    grv: Number(tr.grv) || 0,
    mcc: tr.mcc != null ? tr.mcc : null,
    mch: tr.mch != null ? Number(tr.mch) : 1,
    multiplier: String(mult),
    multiplier_ticks: multTicksPerStep,
    paused: !!tr.paused,
    muted: !!tr.muted,
    soloed: !!tr.soloed,
    chain_head: tr.chain_head != null ? tr.chain_head : null,
    chain_members: Array.isArray(tr.chain_members) ? tr.chain_members.slice(0) : [],
    chain_base: tr.chain_base ? String(tr.chain_base) : "individual",
    port: pc.port,
    channel: pc.ch,
    program_change: tr.program_change != null ? Number(tr.program_change) : 0,
    bank_change: tr.bank_change != null ? tr.bank_change : null,
    transpose_mch: tr.transpose_mch != null ? tr.transpose_mch : null,
    transpose_mode: tr.transpose_mode ? String(tr.transpose_mode) : "relative",
    steps: steps,
  };
}

// Returns PageSnapshot | null. Null means Dict not ready (caller should bail).
function load_active_page() {
  var d = _getDict();
  if (!_dictReady(d)) return null;

  var ap = d.get("active_page") || { bank: 0, page: 0 };
  var bank = _clampInt(ap.bank, 0, 9);
  var pageIx = _clampInt(ap.page, 0, 15);

  var pageObj = d.get(["banks", bank, "pages", pageIx].join("::"));
  if (!pageObj || !pageObj.tracks) return null;

  var routingMode = String(d.get("midi_routing_mode") || "octopus").toLowerCase();
  if (routingMode !== "octopus" && routingMode !== "fixed") routingMode = "octopus";
  var fixedRouting = d.get("fixed_routing") || { base_channel_port1: 1, base_channel_port2: 1 };

  var tracks = [];
  for (var ti = 0; ti < 10; ti++) {
    tracks.push(_buildTrackSnapshot(pageObj.tracks[ti], ti, routingMode, fixedRouting));
  }

  return {
    bank: bank,
    page: pageIx,
    pit_offset: Number(pageObj.pit_offset) || 0,
    vel_factor: pageObj.vel_factor != null ? Number(pageObj.vel_factor) : 8,
    len: _clampInt(pageObj.len != null ? pageObj.len : 16, 1, 16),
    sta: pageObj.sta != null ? Number(pageObj.sta) : 1,
    cluster_mode: !!pageObj.cluster_mode,
    scale: _resolvePageScale(pageObj),
    mute_pattern: Array.isArray(pageObj.mute_pattern) ? pageObj.mute_pattern.slice(0) : [],
    routingMode: routingMode,
    tracks: tracks,
  };
}
