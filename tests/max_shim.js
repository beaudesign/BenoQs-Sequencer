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

    // In-memory Dict that mirrors Max's :: path semantics. Numeric path
    // segments index arrays; everything else indexes objects. set() creates
    // intermediate objects/arrays on the way down. Multiple Dict instances
    // sharing a name share the same backing store (matches Max behaviour).
    Dict: (function () {
      var stores = {}; // name -> root object

      function _segments(key) {
        return String(key).split("::");
      }
      function _isArrayIndex(seg) {
        return /^\d+$/.test(seg);
      }
      function _walk(root, segs, create) {
        var node = root;
        for (var i = 0; i < segs.length - 1; i++) {
          var seg = segs[i];
          var next = _isArrayIndex(seg) ? node[+seg] : node[seg];
          if (next === undefined || next === null) {
            if (!create) return null;
            // Decide array vs object based on the next segment.
            next = _isArrayIndex(segs[i + 1]) ? [] : {};
            if (_isArrayIndex(seg)) node[+seg] = next; else node[seg] = next;
          }
          node = next;
        }
        return node;
      }

      return function Dict(name) {
        name = name || "__default__";
        if (!stores[name]) stores[name] = {};
        var self = this;

        self.get = function (key) {
          var segs = _segments(key);
          var parent = _walk(stores[name], segs, false);
          if (parent === null) return null;
          var leaf = segs[segs.length - 1];
          var v = _isArrayIndex(leaf) ? parent[+leaf] : parent[leaf];
          return (v === undefined) ? null : v;
        };

        self.set = function (key, value) {
          var segs = _segments(key);
          var parent = _walk(stores[name], segs, true);
          var leaf = segs[segs.length - 1];
          if (_isArrayIndex(leaf)) parent[+leaf] = value;
          else parent[leaf] = value;
        };

        self.getkeys = function () {
          var keys = Object.keys(stores[name]);
          return keys.length ? keys : null;
        };

        self.parse = function (json) {
          try { stores[name] = JSON.parse(String(json)); }
          catch (e) { /* leave as-is */ }
        };

        // Test helpers: clear / inspect the backing store.
        self._reset = function () { stores[name] = {}; };
        self._raw   = function () { return stores[name]; };
      };
    })(),

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
