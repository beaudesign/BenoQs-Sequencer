// Tests for ui-mock/adapter.js. The adapter is pure: every method returns the
// LED-state assignments it would have applied, so we can verify the mapping
// without DOM or jsdom.

var path = require("path");
var Adapter = require(path.resolve(__dirname, "..", "ui-mock", "adapter.js"));

function findCall(calls, id) {
  for (var i = 0; i < calls.length; i++) if (calls[i].id === id) return calls[i];
  return null;
}

function run(_sandbox, t) {
  t("updateStep: active step lights green", function () {
    var a = Adapter.createAdapter();
    var calls = a.updateStep(0, 0, true, false, false);
    t.eq(calls.length, 1, "one call");
    t.eq(calls[0].id, "matrix-r0-c0", "matrix cell id");
    t.eq(calls[0].state, "green", "active = green");
  });

  t("updateStep: skip beats active and turns red", function () {
    var a = Adapter.createAdapter();
    var calls = a.updateStep(2, 3, true, true, false);
    t.eq(calls[0].state, "red", "skip wins over active");
  });

  t("updateStep: chord + active = orange", function () {
    var a = Adapter.createAdapter();
    var calls = a.updateStep(5, 7, true, false, true);
    t.eq(calls[0].state, "orange", "chord step");
  });

  t("updateStep: inactive cell is off", function () {
    var a = Adapter.createAdapter();
    var calls = a.updateStep(1, 1, false, false, false);
    t.eq(calls[0].state, "off");
  });

  t("updatePlayhead: lights cell with shine, no prev to restore", function () {
    var a = Adapter.createAdapter();
    var calls = a.updatePlayhead(0, 4);
    t.eq(calls.length, 1, "one call (no prev)");
    t.eq(calls[0].id, "matrix-r0-c4");
    t.eq(calls[0].state, "red_shine", "chase light over inactive = red_shine");
  });

  t("updatePlayhead: restores previous cell when moving", function () {
    var a = Adapter.createAdapter();
    a.updatePlayhead(0, 4);
    var calls = a.updatePlayhead(0, 5);
    t.eq(calls.length, 2, "restore + light");
    var restore = findCall(calls, "matrix-r0-c4");
    var light = findCall(calls, "matrix-r0-c5");
    t.eq(restore.state, "off", "previous restored to base");
    t.eq(light.state, "red_shine", "new cell lit");
  });

  t("updatePlayhead: overlay respects underlying active state", function () {
    var a = Adapter.createAdapter();
    a.updateStep(3, 8, true, false, false); // make 3,8 green
    var calls = a.updatePlayhead(3, 8);
    var lit = findCall(calls, "matrix-r3-c8");
    t.eq(lit.state, "green_shine", "active cell under playhead brightens");
  });

  t("updateStep: writes to playhead-occupied cell show overlay color", function () {
    var a = Adapter.createAdapter();
    a.updatePlayhead(0, 2);
    var calls = a.updateStep(0, 2, true, false, false);
    t.eq(calls[0].state, "green_shine", "live edit under playhead shows overlay");
  });

  t("updatePlayhead: same position = no-op", function () {
    var a = Adapter.createAdapter();
    a.updatePlayhead(0, 4);
    var calls = a.updatePlayhead(0, 4);
    t.eq(calls.length, 0);
  });

  t("updatePlayhead: pos < 0 clears the chase light", function () {
    var a = Adapter.createAdapter();
    a.updateStep(0, 5, true, false, false);
    a.updatePlayhead(0, 5);
    var calls = a.updatePlayhead(0, -1);
    t.eq(calls.length, 1, "restore only");
    t.eq(calls[0].state, "green", "restored to active base");
  });

  t("setTransport(true) lights play green; setTransport(false) lights stop red", function () {
    var a = Adapter.createAdapter();
    var on = a.setTransport(true);
    t.eq(findCall(on, "transport-play").state, "green");
    t.eq(findCall(on, "transport-stop").state, "off");
    var off = a.setTransport(0);
    t.eq(findCall(off, "transport-play").state, "off");
    t.eq(findCall(off, "transport-stop").state, "red");
  });

  t("setTempo writes both columns; ones-column has one green", function () {
    var a = Adapter.createAdapter();
    var calls = a.setTempo(124);
    var greens = calls.filter(function (c) { return c.id.indexOf("tempo-ones-") === 0 && c.state === "green"; });
    t.eq(greens.length, 1, "exactly one ones-green");
    t.eq(greens[0].id, "tempo-ones-4", "ones value = 4");
    var reds = calls.filter(function (c) { return c.id.indexOf("tempo-tens-") === 0 && c.state === "red"; });
    t.eq(reds.length, 2, "tens value 2 lights 2 reds (124 → tens=2)");
  });

  t("loadPage hydrates all 10×16 cells from snapshot JSON", function () {
    var a = Adapter.createAdapter();
    var page = { tracks: [] };
    for (var ti = 0; ti < 10; ti++) {
      var steps = [];
      for (var si = 0; si < 16; si++) {
        steps.push({ active: (ti === 0 && si === 0), skip: false, chords: [] });
      }
      page.tracks.push({ steps: steps });
    }
    var calls = a.loadPage(JSON.stringify(page));
    // 10×16 cells + 6 mode LEDs = 166 calls
    t.eq(calls.length, 166, "all cells plus full mode-LED set");
    t.eq(findCall(calls, "matrix-r0-c0").state, "green", "only active cell green");
    t.eq(findCall(calls, "matrix-r0-c1").state, "off", "rest off");
    t.eq(findCall(calls, "mode-page").state, "orange_flash", "PAGE indicator flashing");
    t.eq(findCall(calls, "mode-grid").state, "off", "non-active modes off");
  });

  t("loadPage with malformed JSON returns empty (no throw)", function () {
    var a = Adapter.createAdapter();
    var calls = a.loadPage("{not json");
    t.eq(calls.length, 0);
  });

  t("loadPage preserves playhead overlay", function () {
    var a = Adapter.createAdapter();
    a.updatePlayhead(2, 7);
    var page = { tracks: [{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]},{steps:[]}] };
    for (var ti = 0; ti < 10; ti++) {
      for (var si = 0; si < 16; si++) page.tracks[ti].steps.push({ active: true });
    }
    var calls = a.loadPage(JSON.stringify(page));
    t.eq(findCall(calls, "matrix-r2-c7").state, "green_shine", "playhead overlay survives loadPage");
    t.eq(findCall(calls, "matrix-r2-c6").state, "green", "non-playhead cell normal");
  });

  t("out-of-range updateStep returns []", function () {
    var a = Adapter.createAdapter();
    t.eq(a.updateStep(99, 0, true, false, false).length, 0);
    t.eq(a.updateStep(0, 99, true, false, false).length, 0);
  });

  // ── U5: mode dispatch ───────────────────────────────────────────────────
  function countByState(calls, idPrefix, state) {
    return calls.filter(function (c) {
      return c.id.indexOf(idPrefix) === 0 && c.state === state;
    }).length;
  }

  t("setMode('grid') lights only the active page cell", function () {
    var a = Adapter.createAdapter();
    var calls = a.setMode("grid", { bank: 2, page: 5 });
    t.eq(findCall(calls, "matrix-r2-c5").state, "green", "active page lit");
    t.eq(findCall(calls, "matrix-r0-c0").state, "off", "other cells off");
    t.eq(findCall(calls, "mode-grid").state, "orange_flash", "GRID mode LED");
    t.eq(findCall(calls, "mode-page").state, "off", "other modes off");
  });

  t("setMode('step') dims matrix and flashes selected cell", function () {
    var a = Adapter.createAdapter();
    var calls = a.setMode("step", { track: 4, step: 11 });
    t.eq(findCall(calls, "matrix-r4-c11").state, "orange_flash", "selected cell");
    t.eq(countByState(calls, "matrix-", "off"), 159, "159 cells dimmed");
    t.eq(findCall(calls, "mode-step").state, "orange_flash");
  });

  t("setMode('track') paints row 0 with toggles + lower rows as bars", function () {
    var a = Adapter.createAdapter();
    // Build a page with track 3 having a known step pattern + vel offsets.
    var page = { bank: 0, page: 0, tracks: [] };
    for (var ti = 0; ti < 10; ti++) {
      var steps = [];
      for (var si = 0; si < 16; si++) {
        steps.push({
          active: (ti === 3 && si % 4 === 0),
          skip: false,
          chords: [],
          vel_offset: ti === 3 && si === 0 ? 127 : (ti === 3 && si === 4 ? 0 : -127),
        });
      }
      page.tracks.push({ steps: steps });
    }
    a.loadPage(JSON.stringify(page));
    var calls = a.setMode("track", { track: 3, mixTarget: "vel" });

    // Top row should reflect step toggles for track 3.
    t.eq(findCall(calls, "matrix-r9-c0").state, "green",  "step 0 active");
    t.eq(findCall(calls, "matrix-r9-c1").state, "off",    "step 1 inactive");
    t.eq(findCall(calls, "matrix-r9-c4").state, "green",  "step 4 active");

    // Bars: vel_offset 127 → all 9 lit; 0 → ~4-5 lit (centered); -127 → 0 lit.
    var litStep0 = countByState(calls.filter(function (c) {
      return /^matrix-r[0-8]-c0$/.test(c.id);
    }), "matrix-", "green");
    t.eq(litStep0, 9, "+127 fills the bar");

    var litStep1 = countByState(calls.filter(function (c) {
      return /^matrix-r[0-8]-c1$/.test(c.id);
    }), "matrix-", "green");
    t.eq(litStep1, 0, "-127 leaves the bar empty");
  });

  t("setSelection in page mode is a no-op repaint (no errors)", function () {
    var a = Adapter.createAdapter();
    var page = { tracks: [] };
    for (var i = 0; i < 10; i++) page.tracks.push({ steps: [] });
    a.loadPage(JSON.stringify(page));
    var calls = a.setSelection({ track: 7 });
    t.eq(calls.length, 160, "page repaint after selection change");
  });

  t("playhead overlay survives a setMode round-trip back to page", function () {
    var a = Adapter.createAdapter();
    var page = { tracks: [] };
    for (var ti = 0; ti < 10; ti++) {
      var steps = [];
      for (var si = 0; si < 16; si++) steps.push({ active: true });
      page.tracks.push({ steps: steps });
    }
    a.loadPage(JSON.stringify(page));
    a.updatePlayhead(2, 7);
    a.setMode("grid");
    var calls = a.setMode("page");
    t.eq(findCall(calls, "matrix-r2-c7").state, "green_shine", "playhead restored after returning to page mode");
  });
}

module.exports = { run: run };
