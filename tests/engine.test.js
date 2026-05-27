// Tests for octopus_engine.js — the transport/queue layer around the
// scheduler. Scheduler decisions are already covered in scheduler.test.js;
// here we verify wiring: transport state, panic, tick advancing globalTick,
// and event ordering through _schedule + _flushDueEvents.

function run(sandbox, t) {
  function freshDict(grid) {
    var d = new sandbox.Dict("octopus_state");
    d._reset();
    d.parse(JSON.stringify(grid || sandbox.defaultGrid()));
    return d;
  }
  function clearOutlets() { sandbox._outletCalls.length = 0; }
  function outletsOfType(name) {
    return sandbox._outletCalls.filter(function (c) { return c[1] === name; });
  }

  function pageWithOneActiveStep(ti, si) {
    var grid = sandbox.defaultGrid();
    grid.banks[0].pages[0].tracks[ti].steps[si].active = true;
    return grid;
  }

  // ── transport_state ────────────────────────────────────────────────────
  t("transport_state(0) emits CC123 panic across both ports × 16 channels", function () {
    sandbox.reset_runtime();
    clearOutlets();
    sandbox.transport_state(0);
    var ccs = outletsOfType("cc").filter(function (c) { return c[4] === 123; });
    t.eq(ccs.length, 32, "16 ch × 2 ports of all-notes-off");
    t.eq(outletsOfType("allnotesoff").length, 1, "legacy panic broadcast");
  });

  t("transport_state(1) doesn't trigger panic", function () {
    sandbox.reset_runtime();
    clearOutlets();
    sandbox.transport_state(1);
    t.eq(outletsOfType("allnotesoff").length, 0);
  });

  // ── reset_runtime ──────────────────────────────────────────────────────
  t("reset_runtime emits engine_reset debug message", function () {
    clearOutlets();
    sandbox.reset_runtime();
    var dbg = sandbox._outletCalls.filter(function (c) { return c[1] === "debug" && c[2] === "engine_reset"; });
    t.eq(dbg.length, 1);
  });

  // ── tick when not running ──────────────────────────────────────────────
  t("tick is a no-op when transport is stopped", function () {
    sandbox.reset_runtime();
    freshDict(pageWithOneActiveStep(0, 0));
    sandbox.transport_state(0); // sets running=0 + panic
    clearOutlets();
    sandbox.tick();
    t.eq(sandbox._outletCalls.length, 0, "no MIDI emitted while stopped");
  });

  // ── tick when running advances globalTick by emitting at the right time ─
  t("running tick emits noteon at step boundary, noteoff after step length", function () {
    sandbox.reset_runtime();
    var grid = pageWithOneActiveStep(0, 0);
    // Make the trigger immediate: track 0 multiplier=1 → 12 ticks per step.
    // Pre-seed runtime accum so the next tick crosses the boundary.
    freshDict(grid);
    sandbox.transport_state(1);
    // Burn 11 ticks to fill the accumulator just below the threshold, then
    // the 12th tick should fire the active step.
    for (var i = 0; i < 11; i++) sandbox.tick();
    clearOutlets();
    sandbox.tick();
    // After the boundary, the scheduler will have produced a noteon at
    // globalTick + 0 (no sta/grv on step 0). The event queue flushes events
    // whose t <= globalTick, so the noteon should appear in this same tick.
    var noteons = outletsOfType("noteon");
    t.ok(noteons.length >= 1, "at least one noteon emitted at boundary");
    // Default track 0 pitch is 57 (C3 in our mapping).
    t.eq(noteons[0][4], 57, "pitch = default track 0 pit");
    // Default vel 100, page vel_factor 8 → final 100.
    t.eq(noteons[0][5], 100, "vel = track 100 × (8/8) = 100");
  });

  t("noteoff fires one step length later", function () {
    sandbox.reset_runtime();
    freshDict(pageWithOneActiveStep(0, 0));
    sandbox.transport_state(1);
    // Step 0 default len=12 ticks. Burn to boundary so first noteon fires
    // on tick 12, then run another 12 ticks so noteoff fires.
    for (var i = 0; i < 11; i++) sandbox.tick();
    sandbox.tick(); // boundary; noteon emitted
    clearOutlets();
    for (var j = 0; j < 12; j++) sandbox.tick();
    var noteoffs = outletsOfType("noteoff");
    t.ok(noteoffs.length >= 1, "noteoff after step length");
  });

  t("a paused track does not emit", function () {
    sandbox.reset_runtime();
    var grid = pageWithOneActiveStep(0, 0);
    grid.banks[0].pages[0].tracks[0].paused = true;
    freshDict(grid);
    sandbox.transport_state(1);
    clearOutlets();
    for (var i = 0; i < 24; i++) sandbox.tick();
    t.eq(outletsOfType("noteon").length, 0, "paused track silent");
  });

  t("a muted track does not emit", function () {
    sandbox.reset_runtime();
    var grid = pageWithOneActiveStep(0, 0);
    grid.banks[0].pages[0].tracks[0].muted = true;
    freshDict(grid);
    sandbox.transport_state(1);
    clearOutlets();
    for (var i = 0; i < 24; i++) sandbox.tick();
    t.eq(outletsOfType("noteon").length, 0, "muted track silent");
  });

  // ── keyboard transpose ────────────────────────────────────────────────
  t("transpose(ti, note, vel) sets per-Track offset = note - 60", function () {
    sandbox.reset_runtime();
    sandbox.transpose(3, 67, 64);     // G4 above middle C
    sandbox.transpose(7, 55, 64);     // G3 below middle C
    // The engine's trackRt isn't directly exposed but we can verify behaviour
    // by triggering tick() and inspecting the resulting noteon pitches.
    var grid = pageWithOneActiveStep(3, 0);
    grid.banks[0].pages[0].tracks[7].steps[0].active = true;
    freshDict(grid);
    // reset_runtime cleared the offsets — set them again *after* the dict load.
    sandbox.transpose(3, 67, 64);
    sandbox.transpose(7, 55, 64);
    sandbox.transport_state(1);
    for (var i = 0; i < 11; i++) sandbox.tick();
    clearOutlets();
    sandbox.tick();
    var noteons = outletsOfType("noteon");
    var byTrack = {};
    noteons.forEach(function (c) { byTrack[c[3]] = c[4]; });  // ch -> pitch
    // Track 3 default ch 4 (mch=1 + index logic? actually mch is per-track default 1 so ch=1).
    // Default pitches: track 3 = G3 (50), track 7 = E5 (64).
    // After +7 transpose: track 3 → 57; after -5 transpose: track 7 → 59.
    var pitches = noteons.map(function (c) { return c[4]; }).sort(function (a,b){return a-b;});
    t.ok(pitches.indexOf(57) !== -1, "track 3 default 50 + 7 = 57");
    t.ok(pitches.indexOf(59) !== -1, "track 7 default 64 + (55-60=-5) = 59");
  });

  t("transpose with velocity > 88 zeros the offset", function () {
    sandbox.reset_runtime();
    sandbox.transpose(0, 72, 50);    // offset = +12
    sandbox.transpose(0, 72, 100);   // velocity 100 > 88 → reset
    var grid = pageWithOneActiveStep(0, 0);
    freshDict(grid);
    sandbox.transpose(0, 72, 50);
    sandbox.transpose(0, 72, 100);
    sandbox.transport_state(1);
    for (var i = 0; i < 11; i++) sandbox.tick();
    clearOutlets();
    sandbox.tick();
    var noteon = outletsOfType("noteon")[0];
    t.eq(noteon[4], 57, "default track 0 pitch (no transpose)");
  });

  // After all engine tests: stop the engine so its `running` flag doesn't
  // carry into other suites' fixture loads.
  sandbox.reset_runtime();
}

module.exports = { run: run };
