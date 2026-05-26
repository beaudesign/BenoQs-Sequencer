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

  function createAdapter() {
    // cellBase[ti][si] = LED state if no playhead were present.
    var cellBase = {};
    // playhead[ti] = current step column lit by the chase light; -1 = none.
    var playhead = {};
    for (var i = 0; i < TRACK_COUNT; i++) {
      cellBase[i] = {};
      playhead[i] = -1;
    }

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

    function loadPage(json) {
      var page;
      try {
        page = (typeof json === "string") ? JSON.parse(json) : json;
      } catch (e) {
        return [];
      }
      var calls = _pageSnapshotCalls(page);
      // Active mode indicator: page is being loaded, so PAGE is the active mode.
      calls.push({ id: "mode-page", state: "orange_flash" });
      return calls;
    }

    return {
      updateStep: updateStep,
      updatePlayhead: updatePlayhead,
      setTempo: setTempo,
      setTransport: setTransport,
      loadPage: loadPage,
      // Test introspection: snapshot internal state. Do not mutate.
      _state: function () {
        return {
          cellBase: JSON.parse(JSON.stringify(cellBase)),
          playhead: JSON.parse(JSON.stringify(playhead)),
        };
      },
    };
  }

  return { createAdapter: createAdapter };
});
