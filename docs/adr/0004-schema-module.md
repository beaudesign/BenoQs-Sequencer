# Schema module owns defaults + repair; data.js orchestrates

## Status

accepted

## Context

After ADR-0003 (preset extraction), `octopus_data.js` was still four concerns
in one file: schema defaults + range utilities (~140 lines), Dict access,
mutation setters that broadcast, and Live API time-signature sync. The
defaults and utilities were used by both data.js (via `defaultGrid`) and the
preset module (indirectly), and were the natural shared dependency for any
future state-snapshot or migration code.

## Decision

Extract `octopus_schema.js` exposing:

- Utilities: `clampInt`, `clampFloat`, `asBool`, `deepCopy`, `ensureArrayLen`.
- Deterministic defaults: `defaultStep`, `defaultTrack`, `defaultPage`,
  `defaultBank`, `defaultGrid`, `defaultPageScale`, `defaultGlobalScale`.
- Pure `repair_state(d)` returning the number of repairs applied. The
  function knows the schema's root keys (`banks`, `active_page`, …),
  clamps a malformed `active_page`, and stamps `schema_version`.

`octopus_data.js` keeps the storage concern (the `STATE_DICT_NAME`, the
Dict access helper, the mutation setters that broadcast via outlet) and
orchestrates `ensure_state` as: empty Dict → `reset_state` + Live sync;
otherwise → `repair_state(d)` and broadcast.

## Rejected alternatives

- **Move `ensure_state` into `octopus_schema.js`.** Tempting because it
  reads like a schema concern. Rejected: the orchestration is where the
  side effects live (`reset_state`, `sync_time_signature_from_live`,
  `outlet`). Putting it in schema.js would couple a pure module to Max
  globals. `repair_state` is the pure piece that *can* move; `ensure_state`
  stays as the side-effecting caller.
- **One mega-module `octopus_model.js`** combining schema + data. Smaller
  surface, larger module. Rejected: violates the deletion test — schema
  defaults are referenced by tests and (eventually) snapshot writers that
  don't need storage wiring.

## Consequences

- `octopus_data.js`: 436 → 257 lines (~40% smaller). Now genuinely "storage
  + mutations + dispatch" only.
- `octopus_schema.js`: 217 lines. Pure, no Max globals at runtime
  (`autowatch = 1` and Max-side `include` are the only Max-isms).
- `tests/schema.test.js`: 17 cases lock the default shape and repair
  behaviour. Future schema changes show up as test diffs.
- Sets up B3 (extract Live API integration). After that move, `data.js`
  will be one concern: Dict mutations that broadcast.
