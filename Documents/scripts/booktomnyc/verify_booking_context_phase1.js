#!/usr/bin/env node
/**
 * verify_booking_context_phase1.js
 *
 * Regression test for Phase 1 of the Orchestrator Overhaul: the
 * BookingContext shape and its three real per-entry-point collectors.
 *
 * Two real bugs were caught and fixed DURING this function's own
 * construction this session, before ever being used elsewhere:
 *   1. collectBookingContext_freeText referenced nlpIntent._groupId, a
 *      field detectIntentNLP never actually returns (that field belongs
 *      to a separate function, resolveGroupFromIntent, called under
 *      specific real conditions by the legacy sqAnalyze pipeline).
 *   2. collectBookingContext_otherTile guessed at tile.groupId/
 *      tile._groupId; the real field (confirmed against
 *      buildOtherTilesForGroup's actual return shape) is
 *      tile.ui_taxonomy.group_id.
 * Both are covered here so a future edit can't silently reintroduce
 * either mistake.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc_schema.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== Phase 0: workflow node exists and validates ===');
check('btnyc.json has a top-level workflow node', !!DB.workflow);
check('workflow.steps is a real, non-empty array', Array.isArray(DB.workflow?.steps) && DB.workflow.steps.length > 0);
check('workflow.ui_template_matrix uses named flags, not a single chainIsQtyOnly boolean',
    JSON.stringify(DB.workflow?.ui_template_matrix).includes('chain_is_single_simple_question') &&
    JSON.stringify(DB.workflow?.ui_template_matrix).includes('chain_has_real_non_quantity_question'));
check('schema defines the workflow node', !!SCHEMA.properties?.workflow);
check('schema defines $defs.booking_context', !!SCHEMA.$defs?.booking_context);

console.log('\n=== Phase 1: BookingContext factory and collectors exist in qr.html ===');
check('makeBookingContext is defined', /function makeBookingContext\(/.test(QR_HTML));
check('collectBookingContext_catalog is defined', /function collectBookingContext_catalog\(/.test(QR_HTML));
check('collectBookingContext_otherTile is defined', /function collectBookingContext_otherTile\(/.test(QR_HTML));
check('collectBookingContext_freeText is defined', /function collectBookingContext_freeText\(/.test(QR_HTML));

console.log('\n=== Bug #1 fix: free-text collector no longer references the non-existent nlpIntent._groupId ===');
const freeTextFnMatch = QR_HTML.match(/function collectBookingContext_freeText\([^)]*\)\s*\{[\s\S]*?\n                \}/);
const freeTextBody = freeTextFnMatch ? freeTextFnMatch[0] : '';
check('does NOT actually USE nlpIntent._groupId as a value (only the fix comment mentions it by name)',
    !/selectedGroupId:\s*nlpIntent\??\._groupId/.test(freeTextBody));
check('DOES call the real resolveGroupFromIntent function instead', freeTextBody.includes('resolveGroupFromIntent('));
check('reads the real confidence threshold from the SSOT (workflow.resolution_thresholds), not a hardcoded literal -- closes Archaeology Audit finding #2',
    freeTextBody.includes('thresholds.route_to_group_other_tile'));

console.log('\n=== Bug #2 fix: other-tile collector reads the real tile.ui_taxonomy.group_id field ===');
const otherTileFnMatch = QR_HTML.match(/function collectBookingContext_otherTile\([^)]*\)\s*\{[\s\S]*?\n                \}/);
const otherTileBody = otherTileFnMatch ? otherTileFnMatch[0] : '';
check('reads tile?.ui_taxonomy?.group_id (the real, confirmed field)', otherTileBody.includes('tile?.ui_taxonomy?.group_id'));
check('does NOT read the guessed, non-existent tile.groupId/tile._groupId', !otherTileBody.includes('tile?.groupId') && !otherTileBody.includes('tile?._groupId'));

console.log('\n=== End-to-end: collectBookingContext_otherTile against a real, correctly-shaped tile object ===');
function makeBookingContext(entry, overrides) {
    return Object.assign({
        entry, selectedServiceId: null, selectedCategoryId: null, selectedGroupId: null,
        rawText: null, nlpIntent: null, extractedQty: null, extractedObject: null,
        extractedLocation: null, manuallyToggledTagIds: [], negatedTagIds: [],
    }, overrides || {});
}
function collectBookingContext_otherTile(tile, category_id) {
    return makeBookingContext('other_tile', {
        selectedCategoryId: category_id || null,
        selectedGroupId: tile?.ui_taxonomy?.group_id || null,
    });
}
const realTile = { _isOtherTile: true, ui_taxonomy: { group_id: 'minor_home_repairs_appliances_stove_range' } };
const ctx = collectBookingContext_otherTile(realTile, 'minor_home_repairs');
check('selectedGroupId resolves correctly from a real tile shape', ctx.selectedGroupId === 'minor_home_repairs_appliances_stove_range');
check('rawText/nlpIntent stay null for this entry type (no typed text exists)', ctx.rawText === null && ctx.nlpIntent === null);

console.log(`\n[Phase 0/1 Orchestrator verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
