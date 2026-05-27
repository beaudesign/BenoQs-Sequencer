// Octopus UI interactions.
//
// Pure mapping from (element id, modifiers / drag deltas) to outgoing
// messages. Mirrors the inverse direction of adapter.js: where the adapter
// turns inbound messages into LED state, this turns user input into outbound
// messages on octopus_jweb_bridge.js's inlet 0 vocabulary.
//
// Outputs are {name, args[]} records. The browser glue forwards each to
// window.octoEmit(name, ...args), which in production is overridden by the
// Max jweb host to send the message into the patcher.
//
// Pure JS, browser + Node.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OctopusInteractions = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ENCODER_PX_PER_TICK = 10; // one detent per N pixels of vertical drag

  // Map an interactive element id + modifier flags to an outgoing message.
  // Returns null when no message should be emitted.
  function interpretClick(id, modifiers, isDouble) {
    if (!id) return null;
    var mods = modifiers || {};

    // Matrix cell — matrix-r{0..9}-c{0..15}
    var mx = id.match(/^matrix-r(\d+)-c(\d+)$/);
    if (mx) {
      var ti = +mx[1], si = +mx[2];
      if (isDouble) return { name: "step_zoom", args: [ti, si] };
      if (mods.shift) return { name: "step_skip_toggle", args: [ti, si] };
      return { name: "step_toggle", args: [ti, si] };
    }

    // Row selector buttons
    var sel = id.match(/^sel-(\d+)$/);
    if (sel) return { name: "select_track", args: [+sel[1]] };

    var mut = id.match(/^mut-(\d+)$/);
    if (mut) return { name: "mut_track", args: [+mut[1]] };

    // Attribute selector (VEL/PIT/LEN/STA/POS/DIR/AMT/GRV/MCC/MCH)
    var attr = id.match(/^attr-([a-z]+)$/);
    if (attr) return { name: "set_attr", args: [attr[1]] };

    // MIX TARGET row slot
    var mt = id.match(/^mixtarget-(\d+)$/);
    if (mt) return { name: "set_mix_target", args: [+mt[1]] };

    // MODE block
    var mode = id.match(/^mode-(grid|page|track|step|map|play)$/);
    if (mode) return { name: "set_mode", args: [mode[1]] };

    // Transport buttons
    var tr = id.match(/^transport-(back|stop|rec|pause|play|fwd)$/);
    if (tr) return { name: "transport_action", args: [tr[1]] };

    // Scale ring + inner trio
    var sn = id.match(/^scale-note-(\d+)$/);
    if (sn) return { name: "scale_note_toggle", args: [+sn[1]] };
    if (id === "scale-mod") return { name: "scale_action", args: ["mod"] };
    if (id === "scale-sel") return { name: "scale_action", args: ["sel"] };
    if (id === "scale-cad") return { name: "scale_action", args: ["cad"] };

    // Chord note slot
    var cn = id.match(/^chord-note-(\d+)$/);
    if (cn) return { name: "chord_note_toggle", args: [+cn[1]] };

    // "200" key (master clock send tri-state per manual pg 11)
    if (id === "key-200") return { name: "clock_send_cycle", args: [] };
    if (id === "reset-button") return { name: "reset", args: [] };

    return null;
  }

  // Encoder drag interpretation. Returns {name, args, remainderPx} or null
  // if no tick crossed yet. The remainderPx must be threaded back into the
  // accumulator so partial drags don't get lost.
  function interpretEncoderDelta(id, accumulatedPx) {
    if (!id || typeof accumulatedPx !== "number") return null;
    var ticks = Math.trunc(accumulatedPx / ENCODER_PX_PER_TICK);
    if (ticks === 0) return null;
    var remainderPx = accumulatedPx - ticks * ENCODER_PX_PER_TICK;

    var mix = id.match(/^mix-encoder-(\d+)$/);
    if (mix) return { name: "mix_encoder", args: [+mix[1], ticks], remainderPx: remainderPx };

    var edit = id.match(/^edit-encoder-(\d+)$/);
    if (edit) return { name: "edit_encoder", args: [+edit[1], ticks], remainderPx: remainderPx };

    if (id === "main-encoder") return { name: "main_encoder", args: [ticks], remainderPx: remainderPx };

    return null;
  }

  return {
    interpretClick: interpretClick,
    interpretEncoderDelta: interpretEncoderDelta,
    ENCODER_PX_PER_TICK: ENCODER_PX_PER_TICK,
  };
});
