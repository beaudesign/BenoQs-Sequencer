autowatch = 1;

// Scheduler: pure-ish music decisions for one Track per Tick.
//
// Interface:
//   planTrack(track, runtime, page, globalTick) → events[]
//
// Inputs:
//   track     — TrackSnapshot (the head/standalone; caller filters muted/paused/chain-members)
//   runtime   — { accum, pos, pingDir, chain: {memberIdx, segPos, pingDir} } (MUTATED in place)
//   page      — PageSnapshot (for chain-member step lookup, pit_offset, vel_factor, scale)
//   globalTick — current tick number
//
// Output:
//   events[]  — [{t,type,port,ch,pitch,vel} | {t,type,port,ch,cc,val}], unordered;
//               caller is responsible for queue insertion ordering.
//
// Side effects beyond the runtime mutation: Math.random calls for grv shuffle,
// brownian/random direction, and chord random-pick. Same as pre-refactor engine.

include("octopus_scale.js"); // buildScalePitchClasses, quantizeToScale

var STEP_TICKS_FALLBACK = 12; // 1/16 @ 192 PPQN

function _clampMidi(v) {
  v = Math.round(Number(v));
  if (isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 127) return 127;
  return v;
}

function _grvDelayTicks(grv) {
  // Manual table (ticks at 1/192) for track shuffle; even settings are random in a range.
  var g = Math.max(0, Math.min(16, Math.round(Number(grv) || 0)));
  switch (g) {
    case 0: return 0;
    case 1: return 1;
    case 2: return Math.floor(Math.random() * 3); // 0..2
    case 3: return 2;
    case 4: return 1 + Math.floor(Math.random() * 3); // 1..3
    case 5: return 3;
    case 6: return 2 + Math.floor(Math.random() * 3); // 2..4
    case 7: return 4;
    case 8: return 3 + Math.floor(Math.random() * 3); // 3..5
    case 9: return 5;
    case 10: return 4 + Math.floor(Math.random() * 3); // 4..6
    case 11: return 6;
    case 12: return 5 + Math.floor(Math.random() * 3); // 5..7
    case 13: return 7;
    case 14: return 6 + Math.floor(Math.random() * 3); // 6..8
    case 15: return 8;
    case 16: return 7 + Math.floor(Math.random() * 3); // 7..9
  }
  return 0;
}

function _strumOffsetTicks(levelAbs, noteNumber1Based) {
  // Manual table: "Chord Strum Timings in Ticks" for strum 1..9, note 2..7.
  if (noteNumber1Based <= 1) return 0;
  var lvl = Math.max(0, Math.min(9, Math.round(levelAbs || 0)));
  if (lvl === 0) return 0;
  var table = {
    2: [0, 1, 1, 2, 2, 3, 3, 4, 5],
    3: [1, 2, 3, 4, 5, 6, 7, 8, 10],
    4: [1, 2, 4, 6, 8, 9, 10, 13, 17],
    5: [2, 3, 5, 9, 11, 13, 15, 19, 23],
    6: [2, 3, 6, 12, 15, 18, 21, 27, 30],
    7: [3, 6, 9, 16, 19, 24, 29, 36, 45],
  };
  var arr = table[noteNumber1Based];
  if (!arr) return 0;
  return arr[lvl - 1] || 0;
}

function _resolveChain(track, runtime, page) {
  // Returns { activeTrack, baseTrack } for stepping/output.
  if (!(track.chain_members && track.chain_members.length)) {
    return { activeTrack: track, baseTrack: track };
  }
  var order = [track.index];
  for (var cm = 0; cm < track.chain_members.length; cm++) {
    var idx = Math.max(0, Math.min(9, Math.round(track.chain_members[cm])));
    if (order.indexOf(idx) === -1) order.push(idx);
  }
  // Hardware default play order is top-to-bottom (row 9 -> row 0).
  order.sort(function (a, b) { return b - a; });
  var memberIdx = runtime.chain.memberIdx % order.length;
  var playingTi = order[memberIdx];
  var activeTrack = page.tracks[playingTi] || track;
  var baseTrack = track.chain_base === "head" ? track : activeTrack;
  return { activeTrack: activeTrack, baseTrack: baseTrack };
}

function _resolveNotes(stepObj, finalPit) {
  // Returns ordered pitch array, accounting for chords + strum direction sort.
  var notes = [0];
  if (stepObj.chords && stepObj.chords.length) {
    var pool = [0];
    for (var ci = 0; ci < stepObj.chords.length; ci++) pool.push(stepObj.chords[ci]);
    var chordSize = pool.length;
    var poly = Math.max(1, Math.min(7, Math.round(stepObj.polyphony || 1)));
    var toPlay = Math.min(poly, chordSize);
    notes = [];
    if (poly === chordSize) {
      for (var pi = 0; pi < toPlay; pi++) notes.push(pool[pi]);
    } else {
      var used = {};
      while (notes.length < toPlay) {
        var r = pool[Math.floor(Math.random() * chordSize)];
        if (used[r]) continue;
        used[r] = 1;
        notes.push(r);
      }
    }
  }
  var played = [];
  for (var ni = 0; ni < notes.length; ni++) played.push(_clampMidi(finalPit + notes[ni]));
  played.sort(function (a, b) { return a - b; });
  return played;
}

function _advancePos(curPos, dir, pageLen, pingDirRef) {
  // Returns new position; mutates pingDirRef.value for ping-pong mode.
  if (dir === 1) return (curPos + 1) % pageLen;
  if (dir === 2) return (curPos - 1 + pageLen) % pageLen;
  if (dir === 3) {
    if (curPos <= 0) pingDirRef.value = +1;
    else if (curPos >= pageLen - 1) pingDirRef.value = -1;
    return curPos + pingDirRef.value;
  }
  if (dir === 4) return (curPos + (Math.random() < 0.6667 ? 1 : -1) + pageLen) % pageLen;
  if (dir === 5) return Math.floor(Math.random() * pageLen);
  return (curPos + 1) % pageLen;
}

function planTrack(track, runtime, page, globalTick) {
  var events = [];

  var chain = _resolveChain(track, runtime, page);
  var activeTrack = chain.activeTrack;
  var baseTrack = chain.baseTrack;
  var isChainHead = !!(track.chain_members && track.chain_members.length);

  var pageLen = Math.max(1, Math.min(16, Math.round(page.len || 16)));

  var stepTicks = baseTrack.multiplier_ticks;
  if (!(stepTicks > 0)) stepTicks = STEP_TICKS_FALLBACK;

  runtime.accum += 1.0;
  if (runtime.accum + 1e-9 < stepTicks) return events;
  runtime.accum -= stepTicks;

  // Step boundary reached.
  var stepIndex = (isChainHead ? runtime.chain.segPos : runtime.pos) % pageLen;
  if (stepIndex < 0) stepIndex += pageLen;

  var stepObj = activeTrack.steps ? activeTrack.steps[stepIndex % 16] : null;

  // Even-step shuffle (0-based odd indices = 2nd/4th/...).
  var shuffleDelay = ((stepIndex % 2) === 1) ? _grvDelayTicks(baseTrack.grv) : 0;

  if (stepObj && !stepObj.skip && stepObj.active) {
    // Resolve pitch with page+track+step offsets, then optional scale quantization.
    var finalPit = (page.pit_offset || 0) + (baseTrack.pit || 60) + (stepObj.pit_offset || 0);
    finalPit = _clampMidi(finalPit);
    if (page.scale && page.scale.enabled) {
      var pcs = buildScalePitchClasses(page.scale.root, page.scale.intervals);
      finalPit = quantizeToScale(finalPit, pcs);
    }

    // Velocity: track base + step offset, scaled by page vel_factor (neutral 8).
    var vf = Number(page.vel_factor);
    if (isNaN(vf)) vf = 8;
    var finalVel = _clampMidi(Math.round((_clampMidi((baseTrack.vel || 0) + (stepObj.vel_offset || 0)) * vf) / 8));

    // Start-time offset (neutral 8 => 1.0; 0 => 0; 16 => 2.0).
    var staScale = Math.max(0, Math.min(2, Number(baseTrack.sta_factor) / 8));
    var staTicks = Math.round((stepObj.sta_offset || 0) * staScale);

    // Length: step.len × len_multiplier, scaled by track len_factor (neutral 8).
    var baseLen = Math.max(1, Math.min(192, Math.round(stepObj.len || 12)));
    var lenMult = Math.max(1, Math.min(8, Math.round(stepObj.len_multiplier || 1)));
    var rawLen = Math.min(192, baseLen * lenMult);
    var lenScale = Math.max(0, Math.min(2, Number(baseTrack.len_factor) / 8));
    var finalLen = Math.max(1, Math.min(192, Math.round(rawLen * lenScale)));

    var port = baseTrack.port;
    var ch = baseTrack.channel;
    var onTick = globalTick + shuffleDelay + staTicks;

    // Strum level (sign chooses direction).
    var strum = Math.max(-9, Math.min(9, Math.round(Number(stepObj.strum || 0))));
    var levelAbs = Math.abs(strum);

    var played = _resolveNotes(stepObj, finalPit);
    if (strum < 0) played.reverse();

    if (levelAbs > 0 && played.length === 1) {
      // Single note + strum -> 7 duplicates at strum timings.
      var basePitch = played[0];
      for (var k = 1; k <= 7; k++) {
        var off = _strumOffsetTicks(levelAbs, k);
        events.push({ t: onTick + off, type: "noteon", port: port, ch: ch, pitch: basePitch, vel: finalVel });
        events.push({ t: onTick + off + finalLen, type: "noteoff", port: port, ch: ch, pitch: basePitch, vel: 0 });
      }
    } else {
      for (var pi2 = 0; pi2 < played.length; pi2++) {
        var off2 = _strumOffsetTicks(levelAbs, pi2 + 1);
        events.push({ t: onTick + off2, type: "noteon", port: port, ch: ch, pitch: played[pi2], vel: finalVel });
        events.push({ t: onTick + off2 + finalLen, type: "noteoff", port: port, ch: ch, pitch: played[pi2], vel: 0 });
      }
    }

    // Step CC emission tied to track.mcc.
    if (baseTrack.mcc !== null && baseTrack.mcc !== undefined && stepObj.mcc_value !== null && stepObj.mcc_value !== undefined) {
      var ccNum;
      if (baseTrack.mcc === "bend") ccNum = -1;
      else if (baseTrack.mcc === "pressure") ccNum = -2;
      else ccNum = _clampMidi(baseTrack.mcc);
      events.push({ t: onTick, type: "cc", port: port, ch: ch, cc: ccNum, val: _clampMidi(stepObj.mcc_value) });
    }
  }

  // Advance playhead.
  var dir = Math.round(Number(activeTrack.dir) || 1);
  if (isChainHead) {
    var pingRef = { value: runtime.chain.pingDir };
    runtime.chain.segPos = _advancePos(runtime.chain.segPos, dir, pageLen, pingRef);
    runtime.chain.pingDir = pingRef.value;
    if (runtime.chain.segPos === 0) {
      var chainLen = 1 + (track.chain_members ? track.chain_members.length : 0);
      runtime.chain.memberIdx = (runtime.chain.memberIdx + 1) % Math.max(1, chainLen);
    }
  } else {
    var pingRef2 = { value: runtime.pingDir };
    runtime.pos = _advancePos(runtime.pos, dir, pageLen, pingRef2);
    runtime.pingDir = pingRef2.value;
  }

  return events;
}
