// Tests for octopus_state.js. Focused on small pure helpers exposed in the
// module scope; full load_active_page round-trip would need a proper Dict
// stub which we haven't built yet.

function run(sandbox, t) {
  var resolveScale = sandbox._resolveScale;

  t("_resolveScale: page scale enabled wins", function () {
    var sc = resolveScale(
      { scale: { enabled: true, root: 60, intervals: [0, 2, 4, 5, 7, 9, 11], mode: "maj" } },
      { enabled: true, root: 0, intervals: [0, 1, 2] }
    );
    t.eq(sc.source, "page");
    t.eq(sc.root, 60);
    t.eq(sc.mode, "maj");
  });

  t("_resolveScale: global is the fallback when page disabled", function () {
    var sc = resolveScale(
      { scale: { enabled: false, root: 60, intervals: [0, 2, 4] } },
      { enabled: true, root: 5, intervals: [0, 2, 4, 5, 7, 9, 11] }
    );
    t.eq(sc.source, "global");
    t.eq(sc.root, 5);
  });

  t("_resolveScale: both disabled returns null", function () {
    t.eq(resolveScale({ scale: { enabled: false } }, { enabled: false }), null);
    t.eq(resolveScale({}, null), null);
  });

  t("_resolveScale: bad intervals fall back to C-major", function () {
    var sc = resolveScale({ scale: { enabled: true, root: 60, intervals: "nope" } }, null);
    t.eq(JSON.stringify(sc.intervals), "[0,2,4,5,7,9,11]");
  });

  // ── A2: round-trip tests against a real-ish Dict stub ──────────────────
  function freshDict(grid) {
    var d = new sandbox.Dict("octopus_state");
    d._reset();
    d.parse(JSON.stringify(grid || sandbox.defaultGrid()));
    return d;
  }

  t("load_active_page returns a PageSnapshot with default shape", function () {
    freshDict();
    var snap = sandbox.load_active_page();
    t.ok(snap !== null, "snapshot returned");
    t.eq(snap.bank, 0); t.eq(snap.page, 0);
    t.eq(snap.tracks.length, 10);
    t.eq(snap.tracks[0].steps.length, 16);
    t.eq(snap.tracks[0].pit, 57, "row 0 default pitch = C3 (57)");
    t.eq(snap.tracks[9].pit, 69, "row 9 default pitch = A5 (69)");
  });

  t("octopus routing resolves mch → {port, channel}", function () {
    var grid = sandbox.defaultGrid();
    grid.midi_routing_mode = "octopus";
    grid.banks[0].pages[0].tracks[3].mch = 5;     // port 1, ch 5
    grid.banks[0].pages[0].tracks[4].mch = 21;    // port 2, ch 5
    freshDict(grid);
    var snap = sandbox.load_active_page();
    t.eq(snap.tracks[3].port, 1);
    t.eq(snap.tracks[3].channel, 5);
    t.eq(snap.tracks[4].port, 2);
    t.eq(snap.tracks[4].channel, 5);
  });

  t("fixed routing resolves via trackIndex + base", function () {
    var grid = sandbox.defaultGrid();
    grid.midi_routing_mode = "fixed";
    grid.fixed_routing = { base_channel_port1: 3, base_channel_port2: 1 };
    freshDict(grid);
    var snap = sandbox.load_active_page();
    t.eq(snap.tracks[0].port, 1);
    t.eq(snap.tracks[0].channel, 3, "base 3 + track 0 = ch 3");
    t.eq(snap.tracks[2].channel, 5, "base 3 + track 2 = ch 5");
  });

  t("multiplier strings parse into multiplier_ticks", function () {
    var grid = sandbox.defaultGrid();
    grid.banks[0].pages[0].tracks[0].multiplier = "1";
    grid.banks[0].pages[0].tracks[1].multiplier = "2";
    grid.banks[0].pages[0].tracks[2].multiplier = "1/3";
    grid.banks[0].pages[0].tracks[3].multiplier = "1/2";
    freshDict(grid);
    var snap = sandbox.load_active_page();
    t.eq(snap.tracks[0].multiplier_ticks, 12, "x1 = 12 ticks");
    t.eq(snap.tracks[1].multiplier_ticks, 6,  "x2 = 6 ticks");
    t.eq(snap.tracks[2].multiplier_ticks, 36, "1/3 = 36 ticks");
    t.eq(snap.tracks[3].multiplier_ticks, 24, "1/2 = 24 ticks");
  });

  t("global scale fallback appears on snapshot when page scale disabled", function () {
    var grid = sandbox.defaultGrid();
    grid.global_scale = { enabled: true, root: 5, intervals: [0, 2, 4, 5, 7, 9, 11] };
    freshDict(grid);
    var snap = sandbox.load_active_page();
    t.ok(snap.scale !== null, "scale resolved");
    t.eq(snap.scale.source, "global");
    t.eq(snap.scale.root, 5);
  });

  t("page scale wins over global when both enabled", function () {
    var grid = sandbox.defaultGrid();
    grid.global_scale = { enabled: true, root: 5, intervals: [0, 2, 4] };
    grid.banks[0].pages[0].scale = { enabled: true, root: 60, intervals: [0, 2, 4, 5, 7, 9, 11] };
    freshDict(grid);
    var snap = sandbox.load_active_page();
    t.eq(snap.scale.source, "page");
    t.eq(snap.scale.root, 60);
  });

  t("load_active_page_ref clamps stored out-of-range values", function () {
    var grid = sandbox.defaultGrid();
    grid.active_page = { bank: 42, page: -3 };
    freshDict(grid);
    var ref = sandbox.load_active_page_ref();
    t.eq(ref.bank, 9, "bank clamped to 9");
    t.eq(ref.page, 0, "page clamped to 0");
  });

  t("load_ui_state defaults when keys absent", function () {
    freshDict();
    var ui = sandbox.load_ui_state();
    t.eq(ui.mode, "page");
    t.eq(ui.mixTarget, "vel");
  });

  t("load_ui_state reflects stored values", function () {
    var grid = sandbox.defaultGrid();
    grid.ui_mode = "track";
    grid.ui_mix_target = "pit";
    freshDict(grid);
    var ui = sandbox.load_ui_state();
    t.eq(ui.mode, "track");
    t.eq(ui.mixTarget, "pit");
  });

  t("load_time_signature defaults to 4/4 when missing", function () {
    var d = new sandbox.Dict("octopus_state");
    d._reset();
    d.parse("{}");
    var ts = sandbox.load_time_signature();
    t.eq(ts.numerator, 4);
    t.eq(ts.denominator, 4);
  });

  t("load_active_page returns null when Dict is empty", function () {
    var d = new sandbox.Dict("octopus_state");
    d._reset();
    t.eq(sandbox.load_active_page(), null);
  });
}

module.exports = { run: run };
