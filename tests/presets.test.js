// Tests for buildPresetMutations. Encodes preset content so future edits to
// the pattern data are visible in the diff.

function _activeMutsByTrack(muts) {
  // Returns { trackIndex: [stepIndex,...] } for value===1 active mutations
  // (last write wins per path, mirroring Dict semantics).
  var lastByPath = {};
  for (var i = 0; i < muts.length; i++) lastByPath[muts[i].path] = muts[i].value;
  var byTrack = {};
  for (var p in lastByPath) {
    var m = p.match(/^banks::0::pages::0::tracks::(\d+)::steps::(\d+)::active$/);
    if (!m) continue;
    if (lastByPath[p] === 1) {
      var t = Number(m[1]);
      var s = Number(m[2]);
      if (!byTrack[t]) byTrack[t] = [];
      byTrack[t].push(s);
    }
  }
  for (var k in byTrack) byTrack[k].sort(function (a, b) { return a - b; });
  return byTrack;
}

function _hasMut(muts, path, value) {
  for (var i = 0; i < muts.length; i++) {
    if (muts[i].path === path && JSON.stringify(muts[i].value) === JSON.stringify(value)) return true;
  }
  return false;
}

function run(sandbox, t) {
  var buildPresetMutations = sandbox.buildPresetMutations;
  var applyPresetToDict = sandbox.applyPresetToDict;

  t("unknown preset id returns empty mutations", function () {
    t.eq(buildPresetMutations(0).length, 0, "id=0 owned by data.js");
    t.eq(buildPresetMutations(99).length, 0, "unknown id");
  });

  t("preset 1: every-4 on every track", function () {
    var muts = buildPresetMutations(1);
    var active = _activeMutsByTrack(muts);
    for (var ti = 0; ti < 10; ti++) {
      t.ok(active[ti] && active[ti].length === 4, "track " + ti + " has 4 active");
      t.eq(JSON.stringify(active[ti]), "[0,4,8,12]", "track " + ti + " pattern");
    }
  });

  t("preset 1: every step on every track gets a clear write", function () {
    var muts = buildPresetMutations(1);
    var clears = 0;
    for (var i = 0; i < muts.length; i++) {
      if (/::active$/.test(muts[i].path) && muts[i].value === 0) clears++;
    }
    t.eq(clears, 10 * 16, "160 clear writes (10 tracks × 16 steps)");
  });

  t("preset 2: per-track varied patterns", function () {
    var muts = buildPresetMutations(2);
    t.ok(_hasMut(muts, "banks::0::pages::0::len", 16), "page len set to 16");
    var active = _activeMutsByTrack(muts);
    t.eq(JSON.stringify(active[0]), "[0,4,8,12]", "track 0");
    t.eq(JSON.stringify(active[3]), "[0,1,2,3]", "track 3 (cluster)");
    t.eq(JSON.stringify(active[4]), "[0,8]", "track 4 (sparse)");
    t.eq(JSON.stringify(active[9]), "[0,2,4,6,8]", "track 9 (run)");
  });

  t("preset 3: enables C major scale", function () {
    var muts = buildPresetMutations(3);
    t.ok(_hasMut(muts, "banks::0::pages::0::scale::enabled", 1), "scale enabled");
    t.ok(_hasMut(muts, "banks::0::pages::0::scale::mode", "maj"), "scale mode = maj");
    t.ok(_hasMut(muts, "banks::0::pages::0::scale::intervals", [0, 2, 4, 5, 7, 9, 11]), "C major intervals");
  });

  t("preset 3: sparse pattern matches (t+s)%3===0 && s%2===0", function () {
    var muts = buildPresetMutations(3);
    var active = _activeMutsByTrack(muts);
    // track 0: s=0,6,12 ⇒ (0+0)%3=0, (0+6)%3=0, (0+12)%3=0; all even
    t.eq(JSON.stringify(active[0] || []), "[0,6,12]", "track 0 sparse");
    // track 1: even s where (1+s)%3==0 ⇒ s=2,8,14
    t.eq(JSON.stringify(active[1] || []), "[2,8,14]", "track 1 sparse");
  });

  t("applyPresetToDict writes all mutations and sets active_page", function () {
    var writes = [];
    var fakeDict = {
      get: function () { return null; },
      set: function (path, value) { writes.push({ path: path, value: value }); },
      getkeys: function () { return null; },
      parse: function () {},
    };
    applyPresetToDict(fakeDict, 1);
    var muts = buildPresetMutations(1);
    t.eq(writes.length, muts.length + 1, "wrote every mutation + active_page");
    var last = writes[writes.length - 1];
    t.eq(last.path, "active_page", "last write is active_page");
    t.eq(JSON.stringify(last.value), JSON.stringify({ bank: 0, page: 0 }), "lands at bank 0 page 0");
  });
}

module.exports = { run: run };
