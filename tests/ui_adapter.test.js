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
    // 10×16 + the mode-page indicator = 161 calls
    t.eq(calls.length, 161, "all cells plus mode-page");
    t.eq(findCall(calls, "matrix-r0-c0").state, "green", "only active cell green");
    t.eq(findCall(calls, "matrix-r0-c1").state, "off", "rest off");
    t.eq(findCall(calls, "mode-page").state, "orange_flash", "PAGE indicator flashing");
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
}

module.exports = { run: run };
