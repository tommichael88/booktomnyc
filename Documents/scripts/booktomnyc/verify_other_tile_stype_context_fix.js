#!/usr/bin/env node
/**
 * verify_other_tile_stype_context_fix.js
 *
 * Regression test for a real, severe, just-fixed bug found while scoping
 * the prefillSmartQuoteFromOtherTile rewire: collectBookingContext_otherTile
 * never set BookingContext.nlpIntent at all, but orch_resolve_entity's
 * real, exact code reads context.nlpIntent?.stype to resolve the dynamic
 * service's TYPE — meaning the orchestrator would always fall back to
 * the hardcoded 'Repair' default for ANY "Other" tile entry, even when
 * the real tile's genuine service_type is Mount/Diagnostic/Install/Setup.
 *
 * Confirmed via direct check this is not a narrow edge case: 20 real
 * groups in the current catalog have dynamic_service_types that never
 * include "Repair" at all — every one of them would have hit a real,
 * severe failure (resolveDynamicService returning nothing real, since
 * e.g. "wall_mounting+Repair" doesn't exist as a real dynamic_services
 * entry — only "wall_mounting+Mount" does), falling all the way through
 * to the generic fallback/default_fallback branch instead of resolving
 * the real, intended dynamic service.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

const FNS = ['resolveDynamicService', 'collectBookingContext_otherTile', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service',
    'resolveGroupFromIntent'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'other_tile_stype_fix' });

console.log('=== collectBookingContext_otherTile now genuinely sets nlpIntent.stype ===');
{
    const tile = { ui_taxonomy: { group_id: 'wall_mounting_frames_shelves' }, service_type: 'Mount', uncovered_service_types: ['Mount'] };
    const ctx = sandbox.collectBookingContext_otherTile(tile, 'wall_mounting');
    check('nlpIntent is genuinely set (was null before this fix)', ctx.nlpIntent !== null);
    check('nlpIntent.stype correctly reflects the real tile service_type', ctx.nlpIntent?.stype === 'Mount');
}

console.log('\n=== Real, complete catalog sweep: every group with no real "Repair" dynamic_service_type resolves correctly ===');
{
    const noRepairGroups = DB.group.filter(g => {
        const types = g.dynamic_service_types || [];
        return types.length && !types.includes('Repair');
    });
    check(`confirmed real, non-trivial scope: ${noRepairGroups.length} real groups never include "Repair" as a dynamic_service_type`, noRepairGroups.length >= 15);

    let failures = [];
    for (const g of noRepairGroups) {
        const realType = g.dynamic_service_types[0];
        const tile = { ui_taxonomy: { group_id: g.id }, service_type: realType, uncovered_service_types: [realType] };
        const ctx = sandbox.collectBookingContext_otherTile(tile, g.category_id);
        const resolution = sandbox.orch_resolve_entity(ctx, DB);
        if (resolution.entityType !== 'dynamic' || !resolution.entity) {
            failures.push(`${g.id} (type=${realType}) -> entityType=${resolution.entityType}, entity=${!!resolution.entity}`);
        }
    }
    check(`zero real resolution failures across all ${noRepairGroups.length} affected groups (found ${failures.length})`, failures.length === 0);
    failures.forEach(f => console.log(`    ${f}`));
}

console.log('\n=== The real, exact, originally-investigated case ===');
{
    const tile = { ui_taxonomy: { group_id: 'wall_mounting_frames_shelves' }, service_type: 'Mount', uncovered_service_types: ['Mount'] };
    const ctx = sandbox.collectBookingContext_otherTile(tile, 'wall_mounting');
    const resolution = sandbox.orch_resolve_entity(ctx, DB);
    check('resolves to a real, genuine dynamic entity (not the fallback)', resolution.entityType === 'dynamic');
    check('the resolved entity has the real, correct base_price ($60, matching wall_mounting+Mount)', resolution.entity?.financial_engine?.base_price === 60);
}

console.log(`\n[other_tile BookingContext stype fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
