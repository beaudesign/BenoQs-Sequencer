// Tests for octopus_schema.js. Pure shape stability + utility behaviour +
// repair_state against an in-memory Dict stub.

function makeDictStub(initial) {
  var store = initial || {};
  return {
    get: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    set: function (key, value) { store[key] = value; },
    getkeys: function () {
      var keys = Object.keys(store);
      return keys.length ? keys : null;
    },
    _store: store,
  };
}

function run(sandbox, t) {
  var clampInt        = sandbox.clampInt;
  var clampFloat      = sandbox.clampFloat;
  var deepCopy        = sandbox.deepCopy;
  var ensureArrayLen  = sandbox.ensureArrayLen;
  var defaultStep     = sandbox.defaultStep;
  var defaultTrack    = sandbox.defaultTrack;
  var defaultPage     = sandbox.defaultPage;
  var defaultBank     = sandbox.defaultBank;
  var defaultGrid     = sandbox.defaultGrid;
  var defaultPageScale = sandbox.defaultPageScale;
  var repair_state    = sandbox.repair_state;

  // ── Utilities ───────────────────────────────────────────────────────────
  t("clampInt rounds + clamps", function () {
    t.eq(clampInt(5.7, 0, 10), 6, "rounds");
    t.eq(clampInt(-5, 0, 10), 0, "lower clamp");
    t.eq(clampInt(99, 0, 10), 10, "upper clamp");
    t.eq(clampInt("not a number", 3, 10), 3, "NaN → min");
  });

  t("clampFloat doesn't round but clamps", function () {
    t.eq(clampFloat(0.5, 0, 1), 0.5);
    t.eq(clampFloat(2, 0, 1), 1);
    t.eq(clampFloat(-1, 0, 1), 0);
  });

  t("deepCopy produces a disjoint clone", function () {
    var a = { x: [1, 2, { y: 3 }] };
    var b = deepCopy(a);
    b.x[2].y = 99;
    t.eq(a.x[2].y, 3, "original untouched");
    t.eq(b.x[2].y, 99, "copy mutated");
  });

  t("ensureArrayLen pads from defaults", function () {
    var arr = ensureArrayLen([1, 2], 5, 0);
    t.eq(arr.length, 5);
    t.eq(JSON.stringify(arr), "[1,2,0,0,0]");
  });

  t("ensureArrayLen truncates over-length arrays", function () {
    var arr = ensureArrayLen([1, 2, 3, 4, 5], 3, 0);
    t.eq(arr.length, 3);
  });

  t("ensureArrayLen handles non-array input", function () {
    var arr = ensureArrayLen(null, 3, "x");
    t.eq(JSON.stringify(arr), '["x","x","x"]');
  });

  // ── Defaults shape ──────────────────────────────────────────────────────
  t("defaultStep has the documented Phase-1 fields", function () {
    var s = defaultStep();
    t.eq(s.active, false);
    t.eq(s.len, 12, "1/16 at 192 PPQN");
    t.eq(s.len_multiplier, 1);
    t.eq(s.strum, 0);
    t.ok(Array.isArray(s.chords), "chords is an array");
    t.eq(s.chords.length, 0);
  });

  t("defaultTrack uses the manual pitch map", function () {
    // [C3, D3, E3, G3, A3, C5, D5, E5, G5, A5] for index 0..9
    var pitches = [57, 55, 52, 50, 48, 60, 62, 64, 67, 69];
    for (var i = 0; i < 10; i++) {
      t.eq(defaultTrack(i).pit, pitches[i], "track " + i + " pitch");
    }
  });

  t("defaultTrack contains 16 default steps", function () {
    var tr = defaultTrack(0);
    t.eq(tr.steps.length, 16);
    t.eq(tr.steps[0].active, false);
  });

  t("defaultPage contains 10 tracks", function () {
    var p = defaultPage();
    t.eq(p.tracks.length, 10);
    t.eq(p.vel_factor, 8);
    t.eq(p.len, 16);
  });

  t("defaultBank contains 16 pages", function () {
    t.eq(defaultBank().pages.length, 16);
  });

  t("defaultGrid has 10 banks × 16 pages × 10 tracks × 16 steps", function () {
    var g = defaultGrid();
    t.eq(g.banks.length, 10);
    t.eq(g.banks[0].pages.length, 16);
    t.eq(g.banks[0].pages[0].tracks.length, 10);
    t.eq(g.banks[0].pages[0].tracks[0].steps.length, 16);
    t.eq(g.tempo_bpm, 120);
    t.eq(JSON.stringify(g.active_page), '{"bank":0,"page":0}');
    t.eq(g.midi_routing_mode, "octopus");
  });

  t("defaultPageScale defaults are disabled with a C-major interval set", function () {
    var s = defaultPageScale();
    t.eq(s.enabled, false);
    t.eq(s.locked, false);
    t.eq(s.root, 60);
    t.eq(JSON.stringify(s.intervals), "[0,2,4,5,7,9,11]");
  });

  // ── repair_state ────────────────────────────────────────────────────────
  t("repair_state on a fully-populated Dict returns 0", function () {
    var g = defaultGrid();
    g.schema_version = 1;
    var d = makeDictStub(g);
    var changed = repair_state(d);
    t.eq(changed, 0, "no repairs needed");
  });

  t("repair_state populates each missing root key once", function () {
    var d = makeDictStub({});
    var changed = repair_state(d);
    // 8 root keys + schema_version + active_page is also a root key (already covered above)
    t.ok(changed >= 8, "at least one repair per missing root + schema_version");
    t.ok(d.get("banks") != null, "banks populated");
    t.ok(d.get("active_page") != null, "active_page populated");
    t.eq(d.get("schema_version"), 1);
  });

  t("repair_state clamps a bad active_page", function () {
    var g = defaultGrid();
    g.active_page = { bank: 99, page: -3 };
    g.schema_version = 1;
    var d = makeDictStub(g);
    var changed = repair_state(d);
    t.ok(changed > 0, "at least one repair");
    t.eq(d.get("active_page").bank, 9, "bank clamped to 9");
    t.eq(d.get("active_page").page, 0, "page clamped to 0");
  });

  t("repair_state does not overwrite existing data with defaults", function () {
    var g = defaultGrid();
    g.tempo_bpm = 140;
    g.schema_version = 1;
    var d = makeDictStub(g);
    repair_state(d);
    t.eq(d.get("tempo_bpm"), 140, "user tempo preserved");
  });
}

module.exports = { run: run };
