'use strict';
/**
 * complexity_axes.js -- applies ssot/migration/complexity_axes.json to the entity-first source while migrate_legacy.js builds it (T180).
 *
 * R-COMPLEX-AXES: every service declares a skill tier, a risk tier and a batch-risk flag, independently. btnyc.json declares the skill tier (operational_metrics.complexity_tier) and neither of the other two,
 * so the other two, and the vocabulary every axis is written in, are authored in the axes file beside recovered_rules.json. This module is the only place they enter the source, so the migration stays a pure
 * function of (btnyc.json, recovered_rules.json, complexity_axes.json). The skill tier is copied from btnyc.json, not restated in the axes file: one authored value of it.
 *
 * It does NOT check the result. validate_source.js owns that, independently, from the source alone (V-COMPLEX-*).
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');

const AXES_PATH = path.join(lib.ROOT, 'ssot', 'migration', 'complexity_axes.json');

function load(p = AXES_PATH) {
  const text = fs.readFileSync(p, 'utf8');
  return { axes: JSON.parse(text), sha256: lib.sha(text), path: p };
}

// The complexity_profile of one service, in the order the source carries it. `tier` is btnyc.json's own declaration; everything else is the axes file's.
function profileFor(AX, legacyId, tier) {
  const s = AX.axes.services[legacyId];
  if (!s) return null;
  const p = { tier, risk_tier: s.risk_tier, batch_risk_compounds: s.batch_risk_compounds, risk_basis: lib.clone(s.risk_basis), batch_risk_basis: lib.clone(s.batch_risk_basis) };
  if (s.assembly_class !== undefined) p.assembly_class = s.assembly_class;
  return p;
}

// A service the axes file does not name, or a name in it that btnyc.json does not define, is reported (never defaulted): a new service cannot enter the source without declaring its axes.
function reconcile(AX, legacyServiceIds, unresolved) {
  const have = new Set(legacyServiceIds);
  for (const id of legacyServiceIds) if (!AX.axes.services[id]) unresolved('service with no entry in complexity_axes.json (R-COMPLEX-AXES: every service declares its axes)', id);
  for (const id of Object.keys(AX.axes.services)) if (!have.has(id)) unresolved('complexity_axes.json names a service btnyc.json does not define', id);
}

module.exports = { AXES_PATH, load, profileFor, reconcile };
