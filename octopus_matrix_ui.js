autowatch = 1;

// JSUI matrix renderer (PAGE view MVP).
// Draws 10x16 step buttons + simple track labels.
// Emits messages: "step_toggle <track> <step>" on click.

include("octopus_state.js"); // load_active_page, load_ui_state, load_time_signature

inlets = 1;
outlets = 1;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var W = 520;
var H = 520;

var rows = 10;
var cols = 16;

var cell = 14;
var gap = 2;
var padLeft = 40;
var padTop = 46;

var mode = "page"; // page|track|step|grid
var selectedTrack = 0;
var selectedStep = 0;
var selectedAttr = "vel"; // vel|pit|len|sta|amt|grv|mcc

var colors = {
  bg: [0.10, 0.10, 0.10, 1.0],
  off: [0.16, 0.16, 0.16, 1.0],
  offBorder: [0.25, 0.25, 0.25, 1.0],
  active: [0.27, 0.87, 0.27, 1.0], // #44dd44
  skip: [0.87, 0.20, 0.20, 1.0], // #dd3333
  chord: [0.87, 0.53, 0.20, 1.0], // #dd8833
  label: [0.8, 0.8, 0.8, 1.0],
  labelMuted: [0.52, 0.52, 0.52, 1.0],
  sel: [1.0, 0.53, 0.0, 1.0],
  // Vertical beat guides (PAGE view): stronger than offBorder
  beatDiv: [0.48, 0.48, 0.48, 0.92],
};

function _clampInt(v, min, max) {
  v = Math.round(Number(v));
  if (isNaN(v)) v = min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Mirrors ui-mock status line: B0 P1 · PAGE · VEL
function _paintStatusHeader(g, snap) {
  var scaleEnabled = !!(snap.scale && snap.scale.enabled);
  var scaleMode = String((snap.scale && snap.scale.mode) || "maj").toUpperCase();

  var ts = load_time_signature();

  var line1 =
    "B" +
    snap.bank +
    " P" +
    (snap.page + 1) +
    " · " +
    mode.toUpperCase() +
    " · " +
    selectedAttr.toUpperCase() +
    " · " +
    ts.numerator +
    "/" +
    ts.denominator;
  var line2 =
    "TRK " +
    selectedTrack +
    " STP " +
    selectedStep +
    " · SCALE " +
    (scaleEnabled ? "ON" : "OFF") +
    " " +
    scaleMode;

  g.select_font_face("Helvetica", "normal", "normal");
  g.set_font_size(10);
  g.set_source_rgba(colors.label);
  g.move_to(8, 16);
  g.show_text(line1);

  g.set_font_size(9);
  g.set_source_rgba(colors.labelMuted);
  g.move_to(8, 28);
  g.show_text(line2);
}

// Assumes 16 steps = one bar of 16th notes; steps per beat = 16 / numerator (e.g. 4/4 → 4).
function _stepsPerBeatFromMeter() {
  var ts = load_time_signature();
  var spb = Math.round(16 / ts.numerator);
  if (spb < 1) spb = 1;
  if (spb > 16) spb = 16;
  return spb;
}

function _paintBeatBoundaries(g) {
  var stepsPerBeat = _stepsPerBeatFromMeter();
  if (stepsPerBeat <= 1 || stepsPerBeat >= cols) return;

  var y0 = padTop - 0.5;
  var y1 = padTop + (rows - 1) * (cell + gap) + cell + 0.5;

  g.set_source_rgba(colors.beatDiv);
  g.set_line_width(1.65);
  for (var c = stepsPerBeat; c < cols; c += stepsPerBeat) {
    var x = padLeft + c * (cell + gap) - gap * 0.5;
    g.move_to(x, y0);
    g.line_to(x, y1);
    g.stroke();
  }
}

function paint() {
  var g = mgraphics;
  var snap = load_active_page();
  var ui = load_ui_state();
  mode = ui.mode || mode || "page";
  selectedAttr = ui.mixTarget || selectedAttr || "vel";

  g.set_source_rgba(colors.bg);
  g.rectangle(0, 0, box.rect[2], box.rect[3]);
  g.fill();

  if (!snap) return; // Dict not ready

  _paintStatusHeader(g, snap);

  if (mode === "grid") {
    _paintGrid(g, snap);
    return;
  }
  if (mode === "track") {
    _paintTrack(g, snap);
    return;
  }
  if (mode === "step") {
    _paintStep(g, snap);
    return;
  }

  _paintBeatBoundaries(g);

  // Draw grid
  g.select_font_face("Helvetica", "normal", "normal");
  g.set_font_size(9);
  for (var r = 0; r < rows; r++) {
    // track label
    g.set_source_rgba(colors.labelMuted);
    g.move_to(10, padTop + r * (cell + gap) + cell - 3);
    g.show_text(String(r));

    for (var c = 0; c < cols; c++) {
      var x = padLeft + c * (cell + gap);
      var y = padTop + r * (cell + gap);
      var stObj = (snap.tracks[r] && snap.tracks[r].steps) ? snap.tracks[r].steps[c] : null;
      var st = {
        active: !!(stObj && stObj.active),
        skip: !!(stObj && stObj.skip),
        hasChord: !!(stObj && stObj.chords && stObj.chords.length > 0),
      };

      var fill = colors.off;
      if (st.skip && st.active) fill = colors.skip; // MVP: no flashing, just red
      else if (st.skip) fill = colors.skip;
      else if (st.hasChord) fill = colors.chord;
      else if (st.active) fill = colors.active;

      // button
      g.set_source_rgba(fill);
      g.rectangle_rounded(x, y, cell, cell, 3, 3);
      g.fill();

      g.set_source_rgba(colors.offBorder);
      g.rectangle_rounded(x + 0.5, y + 0.5, cell - 1, cell - 1, 3, 3);
      g.stroke();
    }
  }
}

function _paintGrid(g, snap) {
  // 10x16 pages: rows=banks, cols=pages
  var ab = snap.bank;
  var apg = snap.page;

  g.select_font_face("Helvetica", "normal", "normal");
  g.set_font_size(9);
  for (var r = 0; r < rows; r++) {
    g.set_source_rgba(colors.labelMuted);
    g.move_to(10, padTop + r * (cell + gap) + cell - 3);
    g.show_text(String(r));

    for (var c = 0; c < cols; c++) {
      var x = padLeft + c * (cell + gap);
      var y = padTop + r * (cell + gap);
      var isActive = r === ab && c === apg;

      g.set_source_rgba(isActive ? colors.sel : colors.off);
      g.rectangle_rounded(x, y, cell, cell, 3, 3);
      g.fill();
      g.set_source_rgba(colors.offBorder);
      g.rectangle_rounded(x + 0.5, y + 0.5, cell - 1, cell - 1, 3, 3);
      g.stroke();
    }
  }
}

function _paintTrack(g, snap) {
  // Row 0: step toggles for selectedTrack
  var tr = snap.tracks[selectedTrack] || { steps: [] };
  var trSteps = tr.steps || [];
  for (var c = 0; c < cols; c++) {
    var x = padLeft + c * (cell + gap);
    var y = padTop;
    var stObj = trSteps[c] || null;
    var st = {
      active: !!(stObj && stObj.active),
      skip: !!(stObj && stObj.skip),
      hasChord: !!(stObj && stObj.chords && stObj.chords.length > 0),
    };
    var fill = st.active ? colors.active : colors.off;
    if (st.skip) fill = colors.skip;
    g.set_source_rgba(fill);
    g.rectangle_rounded(x, y, cell, cell, 3, 3);
    g.fill();
    g.set_source_rgba(colors.offBorder);
    g.rectangle_rounded(x + 0.5, y + 0.5, cell - 1, cell - 1, 3, 3);
    g.stroke();
  }

  // Rows 1-9: simple bar map for selected attribute (MVP: vel_offset only)
  for (var c2 = 0; c2 < cols; c2++) {
    var stepSnap = trSteps[c2] || null;
    var v = 0;
    if (stepSnap) {
      if (selectedAttr === "vel") v = stepSnap.vel_offset;
      else if (selectedAttr === "pit") v = stepSnap.pit_offset;
      else if (selectedAttr === "sta") v = stepSnap.sta_offset;
      else if (selectedAttr === "amt") v = stepSnap.amt;
      else if (selectedAttr === "len") v = stepSnap.len;
    }

    var x2 = padLeft + c2 * (cell + gap);
    var yBase = padTop + (cell + gap) * 2;
    var barH = 9 * (cell + gap);

    // normalize
    var n = 0.0;
    if (selectedAttr === "len") n = Math.max(0, Math.min(1, v / 192));
    else if (selectedAttr === "sta") n = (Math.max(-5, Math.min(5, v)) + 5) / 10.0;
    else if (selectedAttr === "pit") n = (Math.max(-64, Math.min(63, v)) + 64) / 127.0;
    else if (selectedAttr === "amt" || selectedAttr === "vel") n = (Math.max(-127, Math.min(127, v)) + 127) / 254.0;
    else n = 0.5;

    var bh = Math.max(2, Math.round(n * barH));
    var y2 = yBase + (barH - bh);
    g.set_source_rgba(colors.label);
    g.rectangle(x2 + 4, y2, cell - 8, bh);
    g.fill();
  }
}

function _paintStep(g, snap) {
  var tr = snap.tracks[selectedTrack] || { steps: [] };
  var s = (tr.steps && tr.steps[selectedStep]) || null;

  var active = !!(s && s.active);
  var skip = !!(s && s.skip);
  var pit = s ? s.pit_offset : 0;
  var vel = s ? s.vel_offset : 0;
  var len = s ? s.len : 12;
  var sta = s ? s.sta_offset : 0;
  var strum = s ? s.strum : 0;

  g.select_font_face("Helvetica", "normal", "normal");
  g.set_font_size(10);
  g.set_source_rgba(colors.label);
  g.move_to(8, 46);
  g.show_text("TRK " + selectedTrack + " STEP " + selectedStep);
  g.move_to(8, 66);
  g.show_text("ACTIVE " + active + "  SKIP " + skip);
  g.move_to(8, 86);
  g.show_text("PIT " + pit + "  VEL " + vel);
  g.move_to(8, 106);
  g.show_text("LEN " + len + "  STA " + sta + "  STR " + strum);
}

function onclick(x, y, but, cmd, shift, caps, opt, ctrl) {
  // Map to cell
  var gx = x - padLeft;
  var gy = y - padTop;
  if (gx < 0 || gy < 0) return;

  var col = Math.floor(gx / (cell + gap));
  var row = Math.floor(gy / (cell + gap));
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  // Inside rect?
  var rx = gx % (cell + gap);
  var ry = gy % (cell + gap);
  if (rx > cell || ry > cell) return;

  if (mode === "grid") {
    outlet(0, "set_active_page", row, col);
  } else if (mode === "page") {
    // Shift-click -> skip toggle; otherwise active toggle
    if (shift) outlet(0, "step_skip_toggle", row, col);
    else outlet(0, "step_toggle", row, col);
  } else if (mode === "track") {
    // Row 0 toggles; clicking elsewhere selects step for STEP view quick access
    if (row === 0) {
      if (shift) outlet(0, "step_skip_toggle", selectedTrack, col);
      else outlet(0, "step_toggle", selectedTrack, col);
    } else {
      selectedStep = col;
      outlet(0, "bang");
    }
  } else if (mode === "step") {
    // Click in top row area selects step by x position
    selectedStep = col;
    outlet(0, "bang");
  }
  mgraphics.redraw();
}

function bang() {
  mgraphics.redraw();
}

function set_mode(m) {
  mode = String(m || "page").toLowerCase();
  mgraphics.redraw();
}

function select_track(t) {
  selectedTrack = _clampInt(t, 0, 9);
  mgraphics.redraw();
}

function select_step(s) {
  selectedStep = _clampInt(s, 0, 15);
  mgraphics.redraw();
}

function set_attr(a) {
  selectedAttr = String(a || "vel").toLowerCase();
  mgraphics.redraw();
}
