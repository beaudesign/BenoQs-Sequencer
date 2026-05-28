autowatch = 1;

include("octopus_data.js"); // for ensure_state + mutations
include("octopus_state.js"); // for load_active_page (read facade)
include("octopus_scheduler.js"); // for planTrack (per-track music decisions)

// Inlets/outlets
inlets = 1;
outlets = 1; // messages to patcher: noteon/noteoff/cc/allnotesoff/debug

// Constants
var TICKS_PER_QN = 192;

// Engine state (runtime only; not serialized)
var running = 0;
var globalTick = 0; // monotonically increasing while running

// Per-track runtime state
var trackRt = []; // length 10

function _rtInit() {
  trackRt = [];
  for (var i = 0; i < 10; i++) {
    trackRt.push({
      accum: 0.0,
      pos: 0,
      pingDir: +1,
      chain: { memberIdx: 0, segPos: 0, pingDir: +1 },
      // note bookkeeping for panic / noteoffs: map key "port:chan:pitch" -> count
      held: {},
      // Keyboard-driven transpose offset (relative mode, manual §Keyboard
      // Transpose pg 78). Set by transpose() message; applied in scheduler.
      transposeOffset: 0,
    });
  }
}
_rtInit();

// Tick-scheduled MIDI events
// {t, type, port, ch, pitch, vel, cc, val}
var eventQ = [];

function reset_runtime() {
  running = 0;
  globalTick = 0;
  eventQ = [];
  _rtInit();
  outlet(0, "debug", "engine_reset");
}

// --- Helpers ---

function _schedule(ev) {
  // Keep queue sorted by event tick for efficient due-event flushing.
  var lo = 0;
  var hi = eventQ.length;
  while (lo < hi) {
    var mid = (lo + hi) >> 1;
    if (eventQ[mid].t <= ev.t) lo = mid + 1;
    else hi = mid;
  }
  eventQ.splice(lo, 0, ev);
}

function _flushDueEvents(nowTick) {
  if (!eventQ.length) return;
  // Since queue is sorted by tick, due events are always a prefix.
  var i = 0;
  while (i < eventQ.length && eventQ[i].t <= nowTick) {
    var ev = eventQ[i];
    if (ev.type === "noteon") outlet(0, "noteon", ev.port, ev.ch, ev.pitch, ev.vel);
    else if (ev.type === "noteoff") outlet(0, "noteoff", ev.port, ev.ch, ev.pitch, ev.vel || 0);
    else if (ev.type === "cc") outlet(0, "cc", ev.port, ev.ch, ev.cc, ev.val);
    i++;
  }
  if (i > 0) eventQ = eventQ.slice(i);
}

function _allNotesOff() {
  // Emit CC123 (all notes off) across both ports/channels for robust panic behavior.
  for (var port = 1; port <= 2; port++) {
    for (var ch = 1; ch <= 16; ch++) {
      outlet(0, "cc", port, ch, 123, 0);
    }
  }
  // Keep legacy panic event for any existing patcher listeners.
  outlet(0, "allnotesoff");
  eventQ = [];
  for (var t = 0; t < trackRt.length; t++) trackRt[t].held = {};
}

// --- Public messages from patcher ---

// Inbound MIDI-keyboard transpose. transpose(ti, note, velocity).
//   relative mode (default): offset = note - 60 (relative to middle C)
//   absolute mode:           offset = note - track.pit (so finalPit = note)
// Velocity > 88 resets the offset in both modes (manual §Keyboard Transpose
// pg 78 describes this as 'toggle back to original'; we just reset).
// The Max patcher routes MIDI input → this function via track.transpose_mch
// channel matching; that routing lives in the .amxd, not here.
function transpose(ti, note, velocity) {
  ti = Math.max(0, Math.min(9, Math.round(Number(ti) || 0)));
  note = Math.max(0, Math.min(127, Math.round(Number(note) || 0)));
  velocity = Math.max(0, Math.min(127, Math.round(Number(velocity) || 0)));
  if (velocity > 88) {
    trackRt[ti].transposeOffset = 0;
    return;
  }
  // Look up the Track's mode + base pitch via the state facade. This is a
  // rare event (human MIDI input) so the per-call Dict read is fine.
  var mode = "relative";
  var basePit = 60;
  var page = load_active_page();
  if (page && page.tracks && page.tracks[ti]) {
    mode = page.tracks[ti].transpose_mode || "relative";
    basePit = page.tracks[ti].pit;
  }
  if (mode === "absolute") {
    trackRt[ti].transposeOffset = note - basePit;
  } else {
    trackRt[ti].transposeOffset = note - 60;
  }
}

function transport_state(v) {
  running = Number(v) ? 1 : 0;
  if (!running) {
    _allNotesOff();
  }
}

function tick() {
  if (!running) return;

  // Hot path: do not call ensure_state() here (it runs schema repair + Live API sync).
  // Only repair if the Dict is missing (e.g. first tick before loadbang completed).
  var page = load_active_page();
  if (!page) {
    ensure_state();
    page = load_active_page();
    if (!page) return;
  }

  globalTick++;

  for (var ti = 0; ti < 10; ti++) {
    var track = page.tracks[ti];
    if (!track) continue;
    if (track.paused || track.muted) continue;
    // Chain members are played by their head.
    if (track.chain_head !== null && track.chain_head !== undefined) continue;

    var events = planTrack(track, trackRt[ti], page, globalTick);
    for (var ei = 0; ei < events.length; ei++) _schedule(events[ei]);
  }

  _flushDueEvents(globalTick);
}

