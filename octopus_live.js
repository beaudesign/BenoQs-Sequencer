autowatch = 1;

// Live integration: everything that depends on Ableton's LiveAPI or
// transport-level messaging. Currently just the time-signature mirror, but
// future Live-API hooks (transport sync, tempo follow, scene change) belong
// here. Keeping this file isolated means octopus_data.js can stay storage-
// focused and tests that stub LiveAPI only need to mock one module.
//
// Required scope: must be include()d into the same Max js object as
// octopus_data.js (provides getStateDict()) and octopus_schema.js (provides
// clampInt). _bangMatrixRedraw lives in data.js as a generic UI nudge.

function set_time_signature(num, den) {
  num = clampInt(num, 1, 32);
  den = clampInt(den, 1, 32);
  var d = getStateDict();
  var cur = d.get("live_time_signature");
  var same =
    cur &&
    clampInt(cur.numerator, 1, 32) === num &&
    clampInt(cur.denominator, 1, 32) === den;
  d.set("live_time_signature", { numerator: num, denominator: den });
  outlet(0, "time_signature", num, den);
  if (!same && typeof _bangMatrixRedraw === "function") _bangMatrixRedraw();
}

function sync_time_signature_from_live() {
  if (typeof LiveAPI === "undefined") return;
  try {
    var api = new LiveAPI("live_set");
    var n = api.get("signature_numerator");
    var de = api.get("signature_denominator");
    var num = Array.isArray(n) ? n[0] : n;
    var den = Array.isArray(de) ? de[0] : de;
    num = clampInt(num, 1, 32);
    den = clampInt(den, 1, 32);
    set_time_signature(num, den);
  } catch (e) {}
}
