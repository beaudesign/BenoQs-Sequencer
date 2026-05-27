// Tests for octopus_live.js. Uses the LiveAPI mock + outlet capture in
// tests/max_shim.js to assert Live-driven behaviour.

function run(sandbox, t) {
  function freshDict() {
    var d = new sandbox.Dict("octopus_state");
    d._reset();
    d.parse(JSON.stringify(sandbox.defaultGrid()));
    return d;
  }
  function clearOutlets() { sandbox._outletCalls.length = 0; }
  function outletsOfType(name) {
    return sandbox._outletCalls.filter(function (c) { return c[1] === name; });
  }

  t("set_time_signature clamps + writes Dict + outlets", function () {
    var d = freshDict();
    clearOutlets();
    sandbox.set_time_signature(7, 8);
    t.eq(d.get("live_time_signature").numerator, 7);
    t.eq(d.get("live_time_signature").denominator, 8);
    var emitted = outletsOfType("time_signature");
    t.ok(emitted.length === 1, "exactly one broadcast");
    t.eq(emitted[0][2], 7); t.eq(emitted[0][3], 8);
  });

  t("set_time_signature clamps out-of-range to bounds", function () {
    var d = freshDict();
    clearOutlets();
    sandbox.set_time_signature(0, 99);
    t.eq(d.get("live_time_signature").numerator, 1,  "lower clamp");
    t.eq(d.get("live_time_signature").denominator, 32, "upper clamp");
  });

  t("set_time_signature with unchanged values still writes but does not nudge UI twice", function () {
    var d = freshDict();
    d.set("live_time_signature", { numerator: 4, denominator: 4 });
    clearOutlets();
    sandbox.set_time_signature(4, 4);
    // Should still broadcast (Max patcher may rely on it), but the matrix
    // redraw branch is guarded — we just verify it doesn't throw.
    t.eq(outletsOfType("time_signature").length, 1);
  });

  t("sync_time_signature_from_live reads LiveAPI and writes Dict", function () {
    freshDict();
    sandbox._liveProps = { signature_numerator: 6, signature_denominator: 8 };
    clearOutlets();
    sandbox.sync_time_signature_from_live();
    var d = new sandbox.Dict("octopus_state");
    t.eq(d.get("live_time_signature").numerator, 6);
    t.eq(d.get("live_time_signature").denominator, 8);
  });

  t("sync_time_signature_from_live handles array-wrapped Live properties", function () {
    freshDict();
    sandbox._liveProps = { signature_numerator: [3], signature_denominator: [4] };
    clearOutlets();
    sandbox.sync_time_signature_from_live();
    var d = new sandbox.Dict("octopus_state");
    t.eq(d.get("live_time_signature").numerator, 3);
    t.eq(d.get("live_time_signature").denominator, 4);
  });

  t("sync_time_signature_from_live is a no-op when LiveAPI is missing", function () {
    freshDict();
    var saved = sandbox.LiveAPI;
    sandbox.LiveAPI = undefined;
    clearOutlets();
    try {
      sandbox.sync_time_signature_from_live();
      t.eq(outletsOfType("time_signature").length, 0, "no broadcast emitted");
    } finally {
      sandbox.LiveAPI = saved;
    }
  });
}

module.exports = { run: run };
