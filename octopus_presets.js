autowatch = 1;

// Factory presets.
//
// Interface:
//   buildPresetMutations(id) → [{path, value}, ...]      (pure)
//   applyPresetToDict(d, id) → void                       (writes Dict)
//
// The mutation-list shape is the contract: it's a flat sequence of Dict path
// writes. applyPresetToDict is a trivial loop over it. The split keeps preset
// content testable without needing a Dict stub.
//
// Preset 0 (reset) is owned by octopus_data.js — it just calls reset_state().
// Presets 1..3 land at bank 0, page 0.

var PRESET_BASE_BANK = 0;
var PRESET_BASE_PAGE = 0;

function _stepPath(t, s) {
  return [
    "banks", PRESET_BASE_BANK,
    "pages", PRESET_BASE_PAGE,
    "tracks", t,
    "steps", s,
  ].join("::");
}

function _pagePath() {
  return ["banks", PRESET_BASE_BANK, "pages", PRESET_BASE_PAGE].join("::");
}

function _scalePath() {
  return _pagePath() + "::scale";
}

// Helper: clear all 10×16 step active flags, then set the supplied positions.
function _clearAndSetActive(muts, perTrackActiveSteps) {
  for (var t = 0; t < 10; t++) {
    for (var s = 0; s < 16; s++) {
      muts.push({ path: _stepPath(t, s) + "::active", value: 0 });
    }
    var pattern = perTrackActiveSteps[t] || [];
    for (var pi = 0; pi < pattern.length; pi++) {
      muts.push({ path: _stepPath(t, pattern[pi]) + "::active", value: 1 });
    }
  }
}

// Preset 1: "Every 4" — downbeats on all tracks.
function _preset1() {
  var muts = [];
  var allFour = [];
  for (var t = 0; t < 10; t++) allFour.push([0, 4, 8, 12]);
  _clearAndSetActive(muts, allFour);
  return muts;
}

// Preset 2: varied per-track patterns.
function _preset2() {
  var muts = [];
  muts.push({ path: _pagePath() + "::len", value: 16 });
  var pats = [
    [0, 4, 8, 12],
    [0, 3, 6, 9],
    [0, 2, 5, 7],
    [0, 1, 2, 3],
    [0, 8],
    [0, 2, 4],
    [0, 3, 7, 11],
    [0, 4, 8],
    [0, 6, 12],
    [0, 2, 4, 6, 8],
  ];
  _clearAndSetActive(muts, pats);
  return muts;
}

// Preset 3: C major scale + sparse computed pattern.
function _preset3() {
  var muts = [];
  muts.push({ path: _scalePath() + "::enabled", value: 1 });
  muts.push({ path: _scalePath() + "::mode", value: "maj" });
  muts.push({ path: _scalePath() + "::intervals", value: [0, 2, 4, 5, 7, 9, 11] });

  // Pattern: every even step where (track + step) % 3 === 0.
  var perTrack = [];
  for (var t = 0; t < 10; t++) {
    var row = [];
    for (var s = 0; s < 16; s++) {
      if (s % 2 === 0 && (t + s) % 3 === 0) row.push(s);
    }
    perTrack.push(row);
  }
  _clearAndSetActive(muts, perTrack);
  return muts;
}

function buildPresetMutations(id) {
  if (id === 1) return _preset1();
  if (id === 2) return _preset2();
  if (id === 3) return _preset3();
  return [];
}

function applyPresetToDict(d, id) {
  var muts = buildPresetMutations(id);
  for (var i = 0; i < muts.length; i++) {
    d.set(muts[i].path, muts[i].value);
  }
  d.set("active_page", { bank: PRESET_BASE_BANK, page: PRESET_BASE_PAGE });
}
