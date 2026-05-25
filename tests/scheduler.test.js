// Golden tests for planTrack. Assertions encode the spec captured during the
// extraction (ADR-0002) so future changes that drift from this behavior fail
// loudly.

var fx = require("./fixtures");

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function run(sandbox, t) {
  var planTrack = sandbox.planTrack;

  t("no events before step boundary", function () {
    var track = fx.makeTrack();
    track.steps[0].active = true;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.makeRuntime(); // accum starts at 0
    var events = planTrack(track, rt, page, 1);
    t.eq(events.length, 0, "no events");
    t.eq(rt.accum, 1.0, "accum advanced by 1");
    t.eq(rt.pos, 0, "pos not advanced");
  });

  t("single active note emits noteon + noteoff", function () {
    var track = fx.makeTrack({ pit: 60, vel: 100, port: 1, channel: 5 });
    track.steps[0].active = true;
    track.steps[0].len = 12;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);

    var noteons = events.filter(function (e) { return e.type === "noteon"; });
    var noteoffs = events.filter(function (e) { return e.type === "noteoff"; });
    t.eq(noteons.length, 1, "one noteon");
    t.eq(noteoffs.length, 1, "one noteoff");
    t.eq(noteons[0].pitch, 60, "pitch = track.pit");
    t.eq(noteons[0].vel, 100, "vel = track.vel × (vel_factor/8)");
    t.eq(noteons[0].port, 1, "port from snapshot");
    t.eq(noteons[0].ch, 5, "channel from snapshot");
    t.eq(noteons[0].t, 100, "on-tick = globalTick (no sta, no grv on step 0)");
    t.eq(noteoffs[0].t, 112, "off-tick = on + len");
    t.eq(rt.pos, 1, "pos advanced");
  });

  t("skipped step emits nothing but advances", function () {
    var track = fx.makeTrack();
    track.steps[0].active = true;
    track.steps[0].skip = true;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    t.eq(events.length, 0, "no events");
    t.eq(rt.pos, 1, "pos advanced past skipped step");
  });

  t("inactive step emits nothing but advances", function () {
    var track = fx.makeTrack();
    // step 0 inactive by default
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    t.eq(events.length, 0, "no events");
    t.eq(rt.pos, 1, "pos advanced");
  });

  t("chord with polyphony == chord size emits all pool notes", function () {
    var track = fx.makeTrack({ pit: 60 });
    track.steps[0].active = true;
    track.steps[0].chords = [3, 7]; // pool = [0, 3, 7]
    track.steps[0].polyphony = 3;
    track.steps[0].len = 12;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);

    var pitches = events
      .filter(function (e) { return e.type === "noteon"; })
      .map(function (e) { return e.pitch; })
      .sort(function (a, b) { return a - b; });
    t.ok(deepEq(pitches, [60, 63, 67]), "pitches = base + 0,3,7");
  });

  t("page scale quantizes pitch down (tie-break)", function () {
    var track = fx.makeTrack({ pit: 61 }); // C#
    track.steps[0].active = true;
    var page = fx.makePage({
      tracks: [track],
      scale: { enabled: true, root: 0, intervals: [0, 2, 4, 5, 7, 9, 11], mode: "maj", locked: false },
    });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var noteon = events.filter(function (e) { return e.type === "noteon"; })[0];
    t.eq(noteon.pitch, 60, "C# quantized down to C in C major");
  });

  t("page pit_offset adds to track pit", function () {
    var track = fx.makeTrack({ pit: 60 });
    track.steps[0].active = true;
    var page = fx.makePage({ tracks: [track], pit_offset: 12 });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var noteon = events.filter(function (e) { return e.type === "noteon"; })[0];
    t.eq(noteon.pitch, 72, "60 + 12");
  });

  t("vel_factor halves velocity at factor=4", function () {
    var track = fx.makeTrack({ vel: 100 });
    track.steps[0].active = true;
    var page = fx.makePage({ tracks: [track], vel_factor: 4 });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var noteon = events.filter(function (e) { return e.type === "noteon"; })[0];
    t.eq(noteon.vel, 50, "100 × (4/8) = 50");
  });

  t("strum on single note emits 7 duplicates", function () {
    var track = fx.makeTrack({ pit: 60, vel: 100 });
    track.steps[0].active = true;
    track.steps[0].strum = 3;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var noteons = events.filter(function (e) { return e.type === "noteon"; });
    t.eq(noteons.length, 7, "7 strum duplicates");
    var allSamePitch = noteons.every(function (e) { return e.pitch === 60; });
    t.ok(allSamePitch, "all same pitch");
    // Strum table[2] = [0,1,1,2,2,3,3,4,5], indexed by lvl-1.
    // Level 3 ⇒ index 2 ⇒ second-note offset 1.
    var second = noteons[1];
    t.eq(second.t, 101, "note 2 offset = strum table[2][2] = 1");
  });

  t("strum negative reverses chord note order", function () {
    var track = fx.makeTrack({ pit: 60 });
    track.steps[0].active = true;
    track.steps[0].chords = [3, 7];
    track.steps[0].polyphony = 3;
    track.steps[0].strum = -2; // downward
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var noteons = events.filter(function (e) { return e.type === "noteon"; });
    // Highest pitch first when strum < 0; offset 0 on the first note.
    var firstNoteOn = noteons[0];
    t.eq(firstNoteOn.pitch, 67, "first played = highest pitch (67)");
    t.eq(firstNoteOn.t, 100, "first note at onTick (offset 0)");
  });

  t("dir=2 advances position backward", function () {
    var track = fx.makeTrack({ dir: 2 });
    track.steps[0].active = true;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime({ pos: 5 }), track);
    planTrack(track, rt, page, 100);
    t.eq(rt.pos, 4, "pos went from 5 to 4");
  });

  t("dir=1 wraps at pageLen", function () {
    var track = fx.makeTrack({ dir: 1 });
    var page = fx.makePage({ tracks: [track], len: 4 });
    var rt = fx.primeForStep(fx.makeRuntime({ pos: 3 }), track);
    planTrack(track, rt, page, 100);
    t.eq(rt.pos, 0, "3 + 1 mod 4 = 0");
  });

  t("step CC emitted when track.mcc set + step.mcc_value present", function () {
    var track = fx.makeTrack({ mcc: 74 });
    track.steps[0].active = true;
    track.steps[0].mcc_value = 64;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var cc = events.filter(function (e) { return e.type === "cc"; })[0];
    t.ok(!!cc, "cc event present");
    t.eq(cc.cc, 74, "cc number = track.mcc");
    t.eq(cc.val, 64, "cc val = step.mcc_value");
  });

  t("track.mcc='bend' emits sentinel cc=-1", function () {
    var track = fx.makeTrack({ mcc: "bend" });
    track.steps[0].active = true;
    track.steps[0].mcc_value = 64;
    var page = fx.makePage({ tracks: [track] });
    var rt = fx.primeForStep(fx.makeRuntime(), track);
    var events = planTrack(track, rt, page, 100);
    var cc = events.filter(function (e) { return e.type === "cc"; })[0];
    t.eq(cc.cc, -1, "bend sentinel");
  });

  t("chain head plays its own steps on first cycle", function () {
    var head = fx.makeTrack({ index: 0, chain_members: [3], chain_base: "individual" });
    head.steps[0].active = true;
    head.pit = 60;
    var member = fx.makeTrack({ index: 3 });
    member.steps[0].active = true;
    member.pit = 72;

    var page = fx.makePage({ tracks: [] });
    page.tracks[0] = head;
    page.tracks[3] = member;
    // ensure other tracks exist as placeholders
    for (var i = 0; i < 10; i++) if (!page.tracks[i]) page.tracks[i] = fx.makeTrack({ index: i });

    var rt = fx.primeForStep(fx.makeRuntime(), head);
    // Order is sorted descending: [3, 0]; memberIdx 0 ⇒ track 3.
    var events = planTrack(head, rt, page, 100);
    var noteon = events.filter(function (e) { return e.type === "noteon"; })[0];
    t.eq(noteon.pitch, 72, "first chain step from track 3 (descending order)");
  });
}

module.exports = { run: run };
