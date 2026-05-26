// Tests for ui-mock/interactions.js. Pure unit tests of the input-to-message
// mapping; no DOM, no events.

var path = require("path");
var Inter = require(path.resolve(__dirname, "..", "ui-mock", "interactions.js"));

function run(_sandbox, t) {
  var click = Inter.interpretClick;
  var enc   = Inter.interpretEncoderDelta;

  t("matrix click → step_toggle", function () {
    var r = click("matrix-r3-c7", {}, false);
    t.eq(r.name, "step_toggle");
    t.eq(JSON.stringify(r.args), "[3,7]");
  });

  t("matrix shift-click → step_skip_toggle", function () {
    var r = click("matrix-r3-c7", { shift: true }, false);
    t.eq(r.name, "step_skip_toggle");
    t.eq(JSON.stringify(r.args), "[3,7]");
  });

  t("matrix double-click → step_zoom (shift ignored)", function () {
    var r = click("matrix-r0-c0", { shift: true }, true);
    t.eq(r.name, "step_zoom");
  });

  t("SEL click → select_track", function () {
    var r = click("sel-5", {}, false);
    t.eq(r.name, "select_track");
    t.eq(r.args[0], 5);
  });

  t("MUT click → mut_track", function () {
    var r = click("mut-2", {}, false);
    t.eq(r.name, "mut_track");
  });

  t("attribute selector click → set_attr", function () {
    var r = click("attr-vel", {}, false);
    t.eq(r.name, "set_attr");
    t.eq(r.args[0], "vel");
  });

  t("MIX TARGET click → set_mix_target", function () {
    var r = click("mixtarget-9", {}, false);
    t.eq(r.name, "set_mix_target");
    t.eq(r.args[0], 9);
  });

  t("MODE click → set_mode", function () {
    t.eq(click("mode-grid", {}, false).args[0], "grid");
    t.eq(click("mode-page", {}, false).args[0], "page");
    t.eq(click("mode-track", {}, false).args[0], "track");
    t.eq(click("mode-step", {}, false).args[0], "step");
    t.eq(click("mode-map", {}, false).args[0], "map");
    t.eq(click("mode-play", {}, false).args[0], "play");
  });

  t("transport click → transport_action", function () {
    t.eq(click("transport-play", {}, false).args[0], "play");
    t.eq(click("transport-stop", {}, false).args[0], "stop");
    t.eq(click("transport-rec",  {}, false).args[0], "rec");
  });

  t("scale note click → scale_note_toggle", function () {
    var r = click("scale-note-7", {}, false);
    t.eq(r.name, "scale_note_toggle");
    t.eq(r.args[0], 7);
  });

  t("scale inner trio → scale_action", function () {
    t.eq(click("scale-mod", {}, false).args[0], "mod");
    t.eq(click("scale-sel", {}, false).args[0], "sel");
    t.eq(click("scale-cad", {}, false).args[0], "cad");
  });

  t("chord-note click → chord_note_toggle", function () {
    t.eq(click("chord-note-3", {}, false).name, "chord_note_toggle");
    t.eq(click("chord-note-3", {}, false).args[0], 3);
  });

  t("200 key → clock_send_cycle", function () {
    t.eq(click("key-200", {}, false).name, "clock_send_cycle");
  });

  t("reset button → reset", function () {
    t.eq(click("reset-button", {}, false).name, "reset");
  });

  t("unknown id returns null", function () {
    t.eq(click("foo", {}, false), null);
    t.eq(click("", {}, false), null);
    t.eq(click(null, {}, false), null);
  });

  t("encoder drag below threshold returns null", function () {
    t.eq(enc("mix-encoder-0", 5), null);
    t.eq(enc("mix-encoder-0", -5), null);
  });

  t("encoder drag emits ticks and threads remainder", function () {
    var r = enc("mix-encoder-3", 27);
    t.eq(r.name, "mix_encoder");
    t.eq(r.args[0], 3, "track index");
    t.eq(r.args[1], 2, "27px / 10 = 2 ticks");
    t.eq(r.remainderPx, 7, "27 - 2*10 = 7 leftover");
  });

  t("encoder drag negative direction", function () {
    var r = enc("edit-encoder-1", -23);
    t.eq(r.name, "edit_encoder");
    t.eq(r.args[1], -2, "negative ticks");
    t.eq(r.remainderPx, -3);
  });

  t("main encoder", function () {
    var r = enc("main-encoder", 15);
    t.eq(r.name, "main_encoder");
    t.eq(r.args[0], 1);
  });

  t("encoder with unknown id returns null", function () {
    t.eq(enc("sel-0", 100), null);
  });
}

module.exports = { run: run };
