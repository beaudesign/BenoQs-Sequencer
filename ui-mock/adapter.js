// Octopus UI adapter.
//
// Translates the message vocabulary emitted by octopus_jweb_bridge.js into
// LED-state assignments on the panel-v2 SVG. Pure JS; runnable in both the
// browser (window.OctopusAdapter) and Node (require). The DOM side never
// appears here — every method returns an array of {id, state} pairs that the
// caller hands to setLed().
//
// Why this shape:
//   1. Pure mapping = testable from Node without jsdom.
//   2. The adapter owns the only state that needs to persist between
//      messages: per-cell "base state" (active/skip/chord without the
//      playhead overlay) and per-track playhead column. updatePlayhead
//      restores the previous cell's base when the chase light moves on.
//
// Mirrors the bridge calls in octopus_jweb_bridge.js:
//   updateStep(ti, si, active, skip, hasChord)
//   updatePlayhead(ti, pos)
//   setTempo(bpm)
//   setTransport(running)
//   loadPage(jsonString)        // PageSnapshot-shaped JSON

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OctopusAdapter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TRACK_COUNT = 10;
  var STEP_COUNT  = 16;
  var TEMPO_LEDS  = 7;

  function _cellId(ti, si)   { return "matrix-r" + ti + "-c" + si; }
  function _tensId(i)        { return "tempo-tens-" + i; }
  function _onesId(i)        { return "tempo-ones-" + i; }

  // Reference manual §Step skip pg 14:
  //   skip          → red
  //   chord+active  → orange
  //   active        → green
  //   otherwise     → off
  function _baseState(active, skip, hasChord) {
    if (skip) return "red";
    if (hasChord && active) return "orange";
    if (active) return "green";
    return "off";
  }

  // Playhead overlay (chase light). Brightens the underlying base state.
  function _overlay(base) {
    if (base === "green")  return "green_shine";
    if (base === "orange") return "orange_shine";
    if (base === "red")    return "red_shine";
    return "red_shine"; // chase light over an inactive cell
  }

  var MODES = ["grid", "page", "track", "step", "map", "play"];

  function createAdapter() {
    // cellBase[ti][si] = LED state if no playhead were present.
    var cellBase = {};
    // playhead[ti] = current step column lit by the chase light; -1 = none.
    var playhead = {};
    for (var i = 0; i < TRACK_COUNT; i++) {
      cellBase[i] = {};
      playhead[i] = -1;
    }
    // Mode + selection state for U5 dispatch.
    var lastPage = null;
    var mode = "page";
    var selection = { bank: 0, page: 0, track: 0, step: 0, mixTarget: "vel" };

    function updateStep(ti, si, active, skip, hasChord) {
      if (ti < 0 || ti >= TRACK_COUNT || si < 0 || si >= STEP_COUNT) return [];
      var base = _baseState(!!active, !!skip, !!hasChord);
      cellBase[ti][si] = base;
      var visible = (playhead[ti] === si) ? _overlay(base) : base;
      return [{ id: _cellId(ti, si), state: visible }];
    }

    function updatePlayhead(ti, pos) {
      if (ti < 0 || ti >= TRACK_COUNT) return [];
      var prev = playhead[ti];
      if (prev === pos) return [];
      var calls = [];
      // Restore the cell the playhead is leaving.
      if (prev >= 0 && prev < STEP_COUNT) {
        var prevBase = cellBase[ti][prev] || "off";
        calls.push({ id: _cellId(ti, prev), state: prevBase });
      }
      // Light the cell the playhead is entering (if in range).
      if (pos >= 0 && pos < STEP_COUNT) {
        var newBase = cellBase[ti][pos] || "off";
        calls.push({ id: _cellId(ti, pos), state: _overlay(newBase) });
      }
      playhead[ti] = (pos >= 0 && pos < STEP_COUNT) ? pos : -1;
      return calls;
    }

    // BPM display rule (Phase 1; manual is ambiguous for BPM > 79):
    //   tens column: first (bpm mod 10) reds lit, rest off.
    //   ones column: green at index (bpm mod 10), others off.
    // Good enough to show the BPM "moves" when adjusted; U6 can refine.
    function setTempo(bpm) {
      bpm = Math.max(0, Math.min(999, Math.round(Number(bpm) || 0)));
      var tensValue = Math.floor(bpm / 10) % 10;
      var onesValue = bpm % 10;
      var calls = [];
      for (var i = 0; i < TEMPO_LEDS; i++) {
        calls.push({ id: _tensId(i), state: i < (tensValue % TEMPO_LEDS) ? "red" : "off" });
        calls.push({ id: _onesId(i), state: i === (onesValue % TEMPO_LEDS) ? "green" : "off" });
      }
      return calls;
    }

    function setTransport(running) {
      var on = !!running && running !== "0";
      return [
        { id: "transport-play", state: on ? "green" : "off" },
        { id: "transport-stop", state: on ? "off"   : "red" },
      ];
    }

    function _pageSnapshotCalls(page) {
      var calls = [];
      var tracks = (page && page.tracks) ? page.tracks : [];
      for (var ti = 0; ti < TRACK_COUNT; ti++) {
        var tr = tracks[ti];
        var steps = (tr && tr.steps) ? tr.steps : [];
        for (var si = 0; si < STEP_COUNT; si++) {
          var s = steps[si] || {};
          var base = _baseState(!!s.active, !!s.skip, !!(s.chords && s.chords.length));
          cellBase[ti][si] = base;
          var visible = (playhead[ti] === si) ? _overlay(base) : base;
          calls.push({ id: _cellId(ti, si), state: visible });
        }
      }
      return calls;
    }

    // ── Mode paints ─────────────────────────────────────────────────────────
    function _paintPage() {
      if (!lastPage) {
        // Clear matrix when no page is loaded.
        var blanks = [];
        for (var r = 0; r < TRACK_COUNT; r++)
          for (var c = 0; c < STEP_COUNT; c++)
            blanks.push({ id: _cellId(r, c), state: "off" });
        return blanks;
      }
      return _pageSnapshotCalls(lastPage);
    }

    // Grid mode: matrix shows 10 banks × 16 pages. Active page lit green.
    // (A future enhancement can light pages that contain any active step.)
    function _paintGrid() {
      var calls = [];
      var b = selection.bank | 0, p = selection.page | 0;
      for (var r = 0; r < TRACK_COUNT; r++) {
        for (var c = 0; c < STEP_COUNT; c++) {
          calls.push({ id: _cellId(r, c), state: (r === b && c === p) ? "green" : "off" });
        }
      }
      return calls;
    }

    // Attribute value extracted from a step snapshot, normalised to 0..1 for
    // bar-graph display. Ranges mirror octopus_matrix_ui.js _paintTrack.
    function _stepAttrValue(step, attr) {
      switch (attr) {
        case "vel": return step.vel_offset || 0;
        case "pit": return step.pit_offset || 0;
        case "len": return step.len != null ? step.len : 12;
        case "sta": return step.sta_offset || 0;
        case "amt": return step.amt || 0;
        case "grv": return step.grv || 0;
        case "pos": return step.pos != null ? step.pos : 8;
        default:    return 0;
      }
    }
    function _normaliseAttr(v, attr) {
      switch (attr) {
        case "len": return Math.max(0, Math.min(1, v / 192));
        case "sta": return (Math.max(-5,   Math.min(5,   v)) + 5)   / 10;
        case "pit": return (Math.max(-64,  Math.min(63,  v)) + 64)  / 127;
        case "vel":
        case "amt": return (Math.max(-127, Math.min(127, v)) + 127) / 254;
        case "grv": return Math.max(0, Math.min(1, v / 16));
        case "pos": return Math.max(0, Math.min(1, v / 16));
        default:    return 0.5;
      }
    }

    // Track mode: top row (r=9) = step toggles for selected track;
    // rows 8..0 = bar graph height for the selected MixTarget attribute.
    function _paintTrack() {
      var calls = [];
      var trackIx = selection.track | 0;
      var attr = selection.mixTarget || "vel";
      var track = (lastPage && lastPage.tracks) ? lastPage.tracks[trackIx] : null;
      var steps = (track && track.steps) ? track.steps : [];

      for (var c = 0; c < STEP_COUNT; c++) {
        var s = steps[c] || {};
        var base = _baseState(!!s.active, !!s.skip, !!(s.chords && s.chords.length));
        calls.push({ id: _cellId(9, c), state: base });

        var normalised = _normaliseAttr(_stepAttrValue(s, attr), attr);
        var litRows = Math.round(normalised * 9); // 0..9
        for (var lvl = 0; lvl < 9; lvl++) {
          // lvl 0 = bottom-most bar (r=0); bars grow upward from row 0 toward row 8.
          calls.push({ id: _cellId(lvl, c), state: lvl < litRows ? "green" : "off" });
        }
      }
      return calls;
    }

    // Step mode: dim matrix, highlight the single selected cell with orange_flash.
    function _paintStep() {
      var calls = [];
      var ti = selection.track | 0, si = selection.step | 0;
      for (var r = 0; r < TRACK_COUNT; r++) {
        for (var c = 0; c < STEP_COUNT; c++) {
          calls.push({ id: _cellId(r, c), state: (r === ti && c === si) ? "orange_flash" : "off" });
        }
      }
      return calls;
    }

    function _repaintMatrix() {
      if (mode === "grid")  return _paintGrid();
      if (mode === "track") return _paintTrack();
      if (mode === "step")  return _paintStep();
      return _paintPage();
    }

    function _modeLedCalls() {
      var calls = [];
      for (var i = 0; i < MODES.length; i++) {
        calls.push({ id: "mode-" + MODES[i], state: MODES[i] === mode ? "orange_flash" : "off" });
      }
      return calls;
    }

    function setMode(newMode, sel) {
      if (sel) for (var k in sel) selection[k] = sel[k];
      if (typeof newMode === "string" && MODES.indexOf(newMode) !== -1) mode = newMode;
      return _repaintMatrix().concat(_modeLedCalls());
    }

    function setSelection(sel) {
      if (sel) for (var k in sel) selection[k] = sel[k];
      return _repaintMatrix();
    }

    function loadPage(json) {
      var page;
      try {
        page = (typeof json === "string") ? JSON.parse(json) : json;
      } catch (e) {
        return [];
      }
      lastPage = page;
      // bank/page from snapshot if present
      if (page && page.bank != null) selection.bank = page.bank | 0;
      if (page && page.page != null) selection.page = page.page | 0;
      return _repaintMatrix().concat(_modeLedCalls());
    }

    return {
      updateStep: updateStep,
      updatePlayhead: updatePlayhead,
      setTempo: setTempo,
      setTransport: setTransport,
      loadPage: loadPage,
      setMode: setMode,
      setSelection: setSelection,
      // Test introspection: snapshot internal state. Do not mutate.
      _state: function () {
        return {
          cellBase: JSON.parse(JSON.stringify(cellBase)),
          playhead: JSON.parse(JSON.stringify(playhead)),
          mode: mode,
          selection: JSON.parse(JSON.stringify(selection)),
        };
      },
    };
  }

  return { createAdapter: createAdapter };
});
