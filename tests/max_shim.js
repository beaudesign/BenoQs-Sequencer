// Minimal shim so Max for Live JS modules can be loaded under Node.
//
// Why a vm.Context: the Max modules use top-level `var`/`function` declarations
// and expect them to be visible to subsequently-included files (Max inlines
// includes into the same `js` object scope). Node's module wrapper hides these.
// We create a single vm.Context whose global object accumulates all those
// declarations, and run every loaded file in that context.

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var PROJECT_ROOT = path.resolve(__dirname, "..");

function createMaxContext() {
  var sandbox = {
    // Max load-time globals.
    autowatch: 0,
    inlets: 1,
    outlets: 1,
    outlet: function () { /* swallow */ },
    box: { rect: [0, 0, 520, 520] },

    // Builtins the modules expect from V8's global.
    Math: Math,
    JSON: JSON,
    Array: Array,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Object: Object,
    isNaN: isNaN,
    isFinite: isFinite,
    parseInt: parseInt,
    parseFloat: parseFloat,
    Date: Date,
    Error: Error,
    RegExp: RegExp,

    // Bare Dict stand-in. Scheduler tests don't touch it; State facade tests
    // (Phase A2) will need a real one.
    Dict: function Dict(/* name */) {
      this.get = function () { return null; };
      this.set = function () {};
      this.getkeys = function () { return null; };
      this.parse = function () {};
    },

    LiveAPI: undefined,
  };

  // Memoize loads so include() is idempotent (mirrors how Max handles repeated
  // includes within one js object).
  var loaded = {};

  sandbox.include = function include(relPath) {
    var abs = path.resolve(PROJECT_ROOT, relPath);
    if (loaded[abs]) return;
    loaded[abs] = true;
    var src = fs.readFileSync(abs, "utf8");
    vm.runInContext(src, sandbox, { filename: relPath });
  };

  vm.createContext(sandbox);
  return sandbox;
}

module.exports = { createMaxContext: createMaxContext, PROJECT_ROOT: PROJECT_ROOT };
