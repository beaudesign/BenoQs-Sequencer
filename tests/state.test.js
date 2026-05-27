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
}

module.exports = { run: run };
