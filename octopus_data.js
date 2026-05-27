autowatch = 1;

/**
 * BenoQs / Octopus state storage + mutation API.
 * This file provides:
 *  - the State Dict name and access helper
 *  - mutation setters that write the Dict and broadcast via outlet()
 *  - ensure_state orchestration (delegates schema content to octopus_schema.js)
 *  - preset dispatch (delegates content to octopus_presets.js)
 *  - Live time-signature sync (will move to octopus_live.js in B3)
 *
 * NOTE: Max's JS runtime is not Node; avoid require(). Use include() from other JS files.
 */

include("octopus_schema.js");  // defaults + repair_state + utilities
include("octopus_presets.js"); // applyPresetToDict, buildPresetMutations

var STATE_DICT_NAME = "octopus_state";

// ---------- Dict access ----------

function getStateDict() {
  return new Dict(STATE_DICT_NAME);
}

function reset_state() {
  var d = getStateDict();
  d.parse(JSON.stringify(defaultGrid()));
  outlet(0, "state_reset");
}

// ---------- Live time signature (mirrors Live transport meter) ----------
function _bangMatrixRedraw() {
  try {
    if (typeof this !== "undefined" && this.patcher) {
      var m = this.patcher.getnamed("jsui-matrix-1");
      if (m) m.message("bang");
    }
  } catch (e) {}
}

function set_time_signature(num, den) {
  num = clampInt(num, 1, 32);
  den = clampInt(den, 1, 32);
  var d = getStateDict();
  var cur = d.get("live_time_signature");
  var same =
    cur &&
    clampInt(cur.numerator, 1, 32) === num &&
    clampInt(cur.denominator, 1, 32) === den;
  d.set("live_time_signature", { numerator: num, denominator: den });
  outlet(0, "time_signature", num, den);
  if (!same) _bangMatrixRedraw();
}

function sync_time_signature_from_live() {
  if (typeof LiveAPI === "undefined") return;
  try {
    var api = new LiveAPI("live_set");
    var n = api.get("signature_numerator");
    var de = api.get("signature_denominator");
    var num = Array.isArray(n) ? n[0] : n;
    var den = Array.isArray(de) ? de[0] : de;
    num = clampInt(num, 1, 32);
    den = clampInt(den, 1, 32);
    set_time_signature(num, den);
  } catch (e) {}
}

function ensure_state() {
  var d = getStateDict();
  if (!d.getkeys || d.getkeys() === null) {
    reset_state();
    sync_time_signature_from_live();
    return;
  }
  var changed = repair_state(d);
  if (changed) outlet(0, "state_repaired");
  outlet(0, "state_ok");
}

function get_active_page() {
  var d = getStateDict();
  var ap = d.get("active_page");
  if (!ap) ap = { bank: 0, page: 0 };
  var bank = clampInt(ap.bank, 0, 9);
  var page = clampInt(ap.page, 0, 15);
  outlet(0, "active_page", bank, page);
}

function _activePageRef(d) {
  var ap = d.get("active_page") || { bank: 0, page: 0 };
  return {
    bank: clampInt(ap.bank, 0, 9),
    page: clampInt(ap.page, 0, 15),
  };
}

function _stepBasePath(d, trackIndex, stepIndex) {
  var ap = _activePageRef(d);
  return [
    "banks", ap.bank,
    "pages", ap.page,
    "tracks", trackIndex,
    "steps", stepIndex,
  ].join("::");
}

function set_active_page(bank, page) {
  bank = clampInt(bank, 0, 9);
  page = clampInt(page, 0, 15);
  var d = getStateDict();
  d.set("active_page", { bank: bank, page: page });
  outlet(0, "active_page", bank, page);
}

function set_midi_routing_mode(mode) {
  var m = String(mode || "octopus").toLowerCase();
  if (m !== "octopus" && m !== "fixed") m = "octopus";
  var d = getStateDict();
  d.set("midi_routing_mode", m);
  outlet(0, "midi_routing_mode", m);
}

function set_fixed_routing(base_channel_port1, base_channel_port2) {
  var b1 = clampInt(base_channel_port1, 1, 16);
  var b2 = clampInt(base_channel_port2, 1, 16);
  var d = getStateDict();
  d.set("fixed_routing", { base_channel_port1: b1, base_channel_port2: b2 });
  outlet(0, "fixed_routing", b1, b2);
}

// Minimal setters used by early UI scaffolding.
function step_toggle(trackIndex, stepIndex) {
  trackIndex = clampInt(trackIndex, 0, 9);
  stepIndex = clampInt(stepIndex, 0, 15);
  var d = getStateDict();
  var base = _stepBasePath(d, trackIndex, stepIndex);
  var cur = d.get(base + "::active");
  d.set(base + "::active", !cur);
  outlet(0, "step_active", trackIndex, stepIndex, !cur);
}

function step_skip_toggle(trackIndex, stepIndex) {
  trackIndex = clampInt(trackIndex, 0, 9);
  stepIndex = clampInt(stepIndex, 0, 15);
  var d = getStateDict();
  var base = _stepBasePath(d, trackIndex, stepIndex);
  var cur = d.get(base + "::skip");
  d.set(base + "::skip", !cur);
  outlet(0, "step_skip", trackIndex, stepIndex, !cur);
}

function step_pitch(trackIndex, stepIndex, pitOffset) {
  trackIndex = clampInt(trackIndex, 0, 9);
  stepIndex = clampInt(stepIndex, 0, 15);
  pitOffset = clampInt(pitOffset, -127, 127);
  var d = getStateDict();
  var base = _stepBasePath(d, trackIndex, stepIndex);
  d.set(base + "::pit_offset", pitOffset);
  outlet(0, "step_pitch", trackIndex, stepIndex, pitOffset);
}

function set_scale(scaleId) {
  var s = String(scaleId || "maj").toLowerCase();
  if (s === "chromatic") s = "chr";
  else if (s === "major") s = "maj";
  else if (s === "minor") s = "min";
  else if (s === "modal") s = "mod";
  var intervalsByMode = {
    chr: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    maj: [0, 2, 4, 5, 7, 9, 11],
    min: [0, 2, 3, 5, 7, 8, 10],
    mod: [0, 2, 3, 5, 7, 9, 10],
  };
  if (!intervalsByMode[s]) s = "maj";
  var d = getStateDict();
  var ap = _activePageRef(d);
  var pageScalePath = ["banks", ap.bank, "pages", ap.page, "scale"].join("::");
  d.set(pageScalePath + "::enabled", 1);
  d.set(pageScalePath + "::intervals", intervalsByMode[s]);
  d.set(pageScalePath + "::mode", s);
  outlet(0, "scale_mode", s);
}

function set_scale_enabled(v) {
  var enabled = asBool(v) ? 1 : 0;
  var d = getStateDict();
  var ap = _activePageRef(d);
  var pageScalePath = ["banks", ap.bank, "pages", ap.page, "scale"].join("::");
  d.set(pageScalePath + "::enabled", enabled);
  outlet(0, "scale_enabled", enabled);
}

function set_attr(attr) {
  var allowed = {
    vel: 1, pit: 1, len: 1, sta: 1, pos: 1,
    dir: 1, amt: 1, grv: 1, mcc: 1, mch: 1
  };
  var a = String(attr || "vel").toLowerCase();
  if (!allowed[a]) a = "vel";
  var d = getStateDict();
  d.set("ui_mix_target", a);
  outlet(0, "mix_target", a);
}

function set_mode(mode) {
  var allowed = { grid: 1, page: 1, track: 1, step: 1 };
  var m = String(mode || "grid").toLowerCase();
  if (!allowed[m]) m = "grid";
  var d = getStateDict();
  d.set("ui_mode", m);
  outlet(0, "ui_mode", m);
}

function transport(running) {
  outlet(0, "transport_state", asBool(running) ? 1 : 0);
}

function rec_toggle() {
  var d = getStateDict();
  var armed = asBool(d.get("record_armed"));
  d.set("record_armed", !armed);
  outlet(0, "record_armed", !armed ? 1 : 0);
}

// ---------- Factory presets (indices 0..3) ----------
// Preset 0 = reset. Presets 1..3 are defined in octopus_presets.js.
function apply_preset(id) {
  id = clampInt(id, 0, 3);
  if (id === 0) {
    reset_state();
    _bangMatrixRedraw();
    outlet(0, "preset_applied", 0);
    return;
  }
  reset_state();
  applyPresetToDict(getStateDict(), id);
  _bangMatrixRedraw();
  outlet(0, "preset_applied", id);
}

function preset(id) {
  apply_preset(clampInt(id, 0, 3));
}

// ---------- Dump helpers ----------

function dump_page() {
  var d = getStateDict();
  var ap = d.get("active_page") || { bank: 0, page: 0 };
  var pageObj = d.get(
    ["banks", clampInt(ap.bank, 0, 9), "pages", clampInt(ap.page, 0, 15)].join("::")
  );
  outlet(0, "page_dump", JSON.stringify(pageObj));
}

