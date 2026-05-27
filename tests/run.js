#!/usr/bin/env node
// Tiny test runner. Loads Max modules into a vm context, then runs all
// registered test suites. Exits non-zero on any failure.

var shim = require("./max_shim");
var schedulerTests = require("./scheduler.test");
var presetsTests = require("./presets.test");
var uiAdapterTests = require("./ui_adapter.test");
var interactionsTests = require("./interactions.test");
var schemaTests = require("./schema.test");

var ctx = shim.createMaxContext();
ctx.include("octopus_schema.js");
ctx.include("octopus_scheduler.js"); // pulls in octopus_scale.js via its own include()
ctx.include("octopus_presets.js");

var pass = 0;
var fail = 0;
var failures = [];

function makeTester(suiteName) {
  function t(name, body) {
    var failedHere = false;
    var localFailures = [];

    t.eq = function (actual, expected, msg) {
      if (actual !== expected) {
        failedHere = true;
        localFailures.push((msg || "eq") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
      }
    };
    t.ok = function (cond, msg) {
      if (!cond) {
        failedHere = true;
        localFailures.push((msg || "ok") + ": condition false");
      }
    };

    try {
      body();
    } catch (e) {
      failedHere = true;
      localFailures.push("threw: " + (e && e.stack || e));
    }

    if (failedHere) {
      fail++;
      failures.push({ suite: suiteName, name: name, msgs: localFailures });
      process.stdout.write("  ✗ " + name + "\n");
      for (var i = 0; i < localFailures.length; i++) {
        process.stdout.write("      " + localFailures[i] + "\n");
      }
    } else {
      pass++;
      process.stdout.write("  ✓ " + name + "\n");
    }
  }
  return t;
}

process.stdout.write("\nschema.test.js\n");
schemaTests.run(ctx, makeTester("schema"));

process.stdout.write("\nscheduler.test.js\n");
schedulerTests.run(ctx, makeTester("scheduler"));

process.stdout.write("\npresets.test.js\n");
presetsTests.run(ctx, makeTester("presets"));

process.stdout.write("\nui_adapter.test.js\n");
uiAdapterTests.run(ctx, makeTester("ui_adapter"));

process.stdout.write("\ninteractions.test.js\n");
interactionsTests.run(ctx, makeTester("interactions"));

process.stdout.write("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail === 0 ? 0 : 1);
