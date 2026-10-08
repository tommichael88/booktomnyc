#!/usr/bin/env node
/**
 * verify_no_orphaned_data.js
 *
 * Comprehensive orphan‑checker for all entity types in btnyc.json.
 * Uses data‑dependency analysis (scans actual references inside the JSON)
 * rather than source‑code literal matching.
 *
 * Reports are written to ../RESULTS/orphaned_data_report.txt.
 * Exits with code 1 if any unreviewed orphan is found.
 *
 * Designed to be run as part of the test_harness suite (no arguments).
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ──────────────────────────────────────────────────────────────
const REPO_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(REPO_ROOT, 'btnyc.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'RESULTS', 'orphaned_data_report.txt');

// ─── Load JSON ──────────────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// ─── Helpers ────────────────────────────────────────────────────────────
function extractRefId(refObj) {
  if (refObj && typeof refObj === 'object' && refObj.$ref) {
    const parts = refObj.$ref.split('/');
    return parts[parts.length - 1]; // e.g. '#brick_wall'
  }
  return null;
}

function normalizeTag(tag) {
  if (tag && !tag.startsWith('#')) return '#' + tag;
  return tag;
}

function collectTags(list) {
  const tags = new Set();
  if (!Array.isArray(list)) return tags;
  for (const item of list) {
    if (typeof item === 'string') {
      tags.add(normalizeTag(item));
    } else if (typeof item === 'object' && item.$ref) {
      const tid = extractRefId(item);
      if (tid) tags.add(normalizeTag(tid));
    }
  }
  return tags;
}

// ─── Build reference sets ──────────────────────────────────────────────
function buildReferences(db) {
  const refs = {
    tags: new Set(),
    services: new Set(),
    groups: new Set(),
    modules: new Set(),
    formulas: new Set(),
    checkoutStates: new Set(),
    materials: new Set(),
  };

  // ── services ──
  for (const svc of db.services || []) {
    // default_tags, suggested_tags
    for (const tag of collectTags(svc.default_tags)) refs.tags.add(tag);
    for (const tag of collectTags(svc.suggested_tags)) refs.tags.add(tag);

    // intake_chain: module names and then targets
    for (const step of svc.intake_chain || []) {
      if (step.module) refs.modules.add(step.module);
      const thenMap = step.then || {};
      for (const targets of Object.values(thenMap)) {
        if (Array.isArray(targets)) {
          for (const t of targets) {
            if (t) refs.modules.add(t);
          }
        }
      }
      const params = step.params || {};
      for (const resp of params.client_response || []) {
        for (const tag of collectTags(resp.tags)) refs.tags.add(tag);
      }
    }

    // remote_deep_dive_modules
    for (const m of svc.remote_deep_dive_modules || []) refs.modules.add(m);

    // financial_engine.checkout_state
    const fe = svc.financial_engine || {};
    if (fe.checkout_state) refs.checkoutStates.add(fe.checkout_state);
    if (fe.formula_ref) refs.formulas.add(fe.formula_ref);

    // pricing_engine (if it's a formula name, not a built‑in)
    const pe = svc.pricing_engine;
    if (pe && !['algorithmic_flat_rate', 'hourly_estimate', 'assembly_formula'].includes(pe)) {
      refs.formulas.add(pe);
    }

    // required/optional materials
    for (const mat of svc.required_materials || []) refs.materials.add(mat);
    for (const mat of svc.optional_materials || []) refs.materials.add(mat);

    // ui_taxonomy.group_id
    const groupId = svc.ui_taxonomy?.group_id;
    if (groupId) refs.groups.add(groupId);
  }

  // ── dynamic_services ──
  for (const dyn of Object.values(db.dynamic_services || {})) {
    for (const tag of collectTags(dyn.suggested_tags)) refs.tags.add(tag);
    for (const step of dyn.intake_chain || []) {
      if (step.module) refs.modules.add(step.module);
      const thenMap = step.then || {};
      for (const targets of Object.values(thenMap)) {
        if (Array.isArray(targets)) {
          for (const t of targets) {
            if (t) refs.modules.add(t);
          }
        }
      }
      const params = step.params || {};
      for (const resp of params.client_response || []) {
        for (const tag of collectTags(resp.tags)) refs.tags.add(tag);
      }
    }
    for (const m of dyn.remote_deep_dive_modules || []) refs.modules.add(m);
    const fe = dyn.financial_engine || {};
    if (fe.checkout_state) refs.checkoutStates.add(fe.checkout_state);
    if (fe.formula_ref) refs.formulas.add(fe.formula_ref);
  }

  // ── groups ──
  for (const grp of db.group || []) {
    if (grp.parent_group) refs.groups.add(grp.parent_group);
    for (const sid of grp.explicit_services || []) {
      refs.services.add(sid);
    }
  }

  // ── categories ──
  for (const cat of db.category || []) {
    for (const gid of cat.group_ids || []) {
      refs.groups.add(gid);
    }
  }

  // ── routing_archetypes ──
  for (const arch of Object.values(db.routing_archetypes || {})) {
    for (const svcList of Object.values(arch.component_id_to_service_ids || {})) {
      for (const sid of svcList) refs.services.add(sid);
    }
    for (const svcList of Object.values(arch.symptom_id_to_service_ids || {})) {
      for (const sid of svcList) refs.services.add(sid);
    }
  }

  // ── intent_mappings.objects ──
  for (const obj of db.intent_mappings?.objects || []) {
    if (obj.default_service_sku) refs.services.add(obj.default_service_sku);
    for (const ctx of obj.contextual_overrides || []) {
      if (ctx.override_sku) refs.services.add(ctx.override_sku);
      const st = ctx.smart_tag;
      if (st && typeof st === 'object' && st.$ref) {
        const tid = extractRefId(st);
        if (tid) refs.tags.add(normalizeTag(tid));
      }
    }
  }

  // ── smart_tags ──
  for (const [tid, tagDef] of Object.entries(db.smart_tags || {})) {
    for (const req of tagDef.requires || []) {
      const r = (typeof req === 'string') ? req : extractRefId(req);
      if (r) refs.tags.add(normalizeTag(r));
    }
    for (const ex of tagDef.mutually_exclusive || []) {
      refs.tags.add(normalizeTag(ex));
    }
  }

  // ── intake_modules ──
  for (const modDef of Object.values(db.intake_modules || {})) {
    for (const resp of modDef.client_response || []) {
      for (const tag of collectTags(resp.tags)) refs.tags.add(tag);
      if (resp.formula_override) refs.formulas.add(resp.formula_override);
      if (resp.checkout_state_override) refs.checkoutStates.add(resp.checkout_state_override);
    }
  }

  // T118: global_rules.intake_defaults (universal/category_defaults/
  // group_defaults) is a real, direct reference mechanism for modules,
  // replacing the old force_modules_by_variability this checker never
  // had explicit awareness of either (it relied on modules also
  // appearing in an intake_chain somewhere, which was true for
  // hybrid_qty by coincidence, not by this checker's own design).
  for (const m of (db.global_rules?.intake_defaults?.universal || [])) refs.modules.add(m);
  for (const arr of Object.values(db.global_rules?.intake_defaults?.category_defaults || {})) {
    for (const m of arr) refs.modules.add(m);
  }
  for (const arr of Object.values(db.global_rules?.intake_defaults?.group_defaults || {})) {
    for (const m of arr) refs.modules.add(m);
  }

  return refs;
}

// ─── Build defined sets ────────────────────────────────────────────────
function buildDefinitions(db) {
  const defs = {
    tags: new Set(Object.keys(db.smart_tags || {})),
    services: new Set((db.services || []).map(s => s.id).filter(Boolean)),
    groups: new Set((db.group || []).map(g => g.id).filter(Boolean)),
    modules: new Set(Object.keys(db.intake_modules || {})),
    formulas: new Set(Object.keys(db.pricing_formulas || {})),
    checkoutStates: new Set(Object.keys(db.checkout_states || {})),
    materials: new Set(Object.keys(db.materials_catalog || {})),
    dynamicServices: new Set(Object.keys(db.dynamic_services || {})),
  };
  return defs;
}

// ─── Determine which dynamic services are used ──────────────────────
function findUsedDynamicServices(db) {
  const groupTypes = {};
  for (const grp of db.group || []) {
    if (grp.id) {
      groupTypes[grp.id] = new Set(grp.dynamic_service_types || []);
    }
  }

  const used = new Set();
  for (const key of Object.keys(db.dynamic_services || {})) {
    const parts = key.split('+');
    if (parts.length === 3) {
      const [, gid, stype] = parts;
      if (gid && groupTypes[gid] && groupTypes[gid].has(stype)) {
        used.add(key);
      }
    } else if (parts.length === 2) {
      // category+type: fallback – conservatively mark as used
      used.add(key);
    }
  }
  return used;
}

// ─── Main ──────────────────────────────────────────────────────────────
function main() {
  const defs = buildDefinitions(db);
  const refs = buildReferences(db);
  const usedDyn = findUsedDynamicServices(db);

  // Compute orphans for dynamic services separately
  const dynOrphans = [...defs.dynamicServices].filter(d => !usedDyn.has(d)).sort();

  // Compute orphans for other categories
  const orphans = {};
  for (const cat of ['tags', 'services', 'groups', 'modules', 'formulas', 'checkoutStates', 'materials']) {
    const defined = defs[cat];
    const referenced = refs[cat] || new Set();
    orphans[cat] = [...defined].filter(item => !referenced.has(item)).sort();
  }
  orphans.dynamicServices = dynOrphans;

  // Special handling for intake modules: respect _orphan_backlog_note
  const moduleOrphans = orphans.modules;
  const reviewed = [];
  const unreviewed = [];
  for (const m of moduleOrphans) {
    const modDef = db.intake_modules?.[m] || {};
    if (modDef._orphan_backlog_note) {
      reviewed.push(m);
    } else {
      unreviewed.push(m);
    }
  }

  // Count total unreviewed orphans
  let totalOrphans = 0;
  for (const cat of ['tags', 'services', 'groups', 'formulas', 'checkoutStates', 'materials', 'dynamicServices']) {
    totalOrphans += orphans[cat].length;
  }
  totalOrphans += unreviewed.length;

  // ─── Write report ──────────────────────────────────────────────────
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const lines = [];
  lines.push('=== Orphaned data report (data‑dependency analysis) ===');
  lines.push(`Generated: ${new Date().toISOString()}\n`);

  for (const cat of ['tags', 'services', 'groups', 'modules', 'formulas', 'checkoutStates', 'materials', 'dynamicServices']) {
    const items = cat === 'modules' ? unreviewed : orphans[cat] || [];
    if (items.length > 0) {
      lines.push(`${cat} (${items.length}):`);
      for (const item of items) {
        lines.push(`  ${item}`);
      }
      lines.push('');
    }
  }

  if (reviewed.length > 0) {
    lines.push(`Reviewed intake modules (with _orphan_backlog_note, not counted as errors):`);
    for (const m of reviewed) {
      lines.push(`  ${m}`);
    }
    lines.push('');
  }

  if (totalOrphans === 0) {
    lines.push('✅ No unreviewed orphans found.');
  } else {
    lines.push(`❌ ${totalOrphans} unreviewed orphan(s) found.`);
  }

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');

  // ─── Console summary ──────────────────────────────────────────────
  console.log('=== Orphaned data summary ===');
  console.log(`Total unreviewed orphans: ${totalOrphans}`);
  if (totalOrphans > 0) {
    console.log(`Report written to ${OUTPUT_PATH}`);
    console.log('Sample orphans:');
    for (const cat of ['tags', 'services', 'groups', 'modules', 'formulas', 'checkoutStates', 'materials', 'dynamicServices']) {
      const items = cat === 'modules' ? unreviewed : orphans[cat] || [];
      if (items.length > 0) {
        console.log(`  ${cat}: ${items.slice(0, 3).join(', ')}${items.length > 3 ? ' ...' : ''}`);
      }
    }
  } else {
    console.log('✅ All data is referenced.');
  }

  // ─── Exit code ─────────────────────────────────────────────────────
  process.exit(totalOrphans > 0 ? 1 : 0);
}

main();
