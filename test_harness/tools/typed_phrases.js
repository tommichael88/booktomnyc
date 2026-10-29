#!/usr/bin/env node
/**
 * typed_phrases.js -- the catalog's own typed phrases, one per line, for tools/answer_space_diff.js --phrases (T192, PENDING_DECISIONS #195).
 *
 *   node test_harness/tools/typed_phrases.js [--wide] > phrases.txt
 *
 * How a customer says a job, read from the catalog and invented from nothing: each service's own name; the SSOT's own verb + noun links (intent_mappings.objects[].contextual_overrides:
 * "mount" + "tv"); and each of those with a tag's own synonym after it ("... on brick wall", "... on vaulted ceiling"). Default: the tags that answer a question the service asks (the same
 * corpus verify_state_ignorance.js types). --wide: EVERY tag with a synonym after EVERY service name, which is the measure of how far a change to what a tag may do can reach (a tag
 * typed about a service that does not ask its question must stay as it was).
 * Read-only; it prints lines and changes nothing.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT ? path.resolve(process.env.QR_ROOT) : path.resolve(__dirname, '..', '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const wide = process.argv.includes('--wide');
const plain = s => String(s || '').toLowerCase().replace(/[^a-z0-9 '\-/]+/g, ' ').replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
const services = new Map((DB.services || []).map(s => [s.id, s]));
const modulesOf = s => { const out = new Set(); const add = m => { if (typeof m === 'string') out.add(m); };
    for (const st of s.intake_chain || []) { add(st && (st.module || st)); if (st && st.then && typeof st.then === 'object') for (const v of Object.values(st.then)) [].concat(v).forEach(x => add(x && (x.module || x))); } return out; };
const frames = new Map(); const addFrame = (id, t) => { if (!services.has(id) || !t) return; if (!frames.has(id)) frames.set(id, new Set()); frames.get(id).add(t); };
for (const s of services.values()) addFrame(s.id, plain((s.ui_taxonomy || {}).display_name || s.id));
for (const o of (DB.intent_mappings || {}).objects || []) for (const c of o.contextual_overrides || []) for (const noun of (c.keywords || []).slice(0, 2)) addFrame(c.override_sku, plain(`${o.keyword} a ${noun}`));
const out = new Set();
for (const [id, set] of frames) {
    const mods = modulesOf(services.get(id));
    for (const f of set) {
        out.add(f);
        for (const [tid, d] of Object.entries(DB.smart_tags || {})) {
            if (!(d.synonyms || []).length) continue;
            if (!wide && !(d.answers && Object.keys(d.answers).some(m => mods.has(m)))) continue;
            const syn = plain(d.synonyms[0]); if (syn) out.add(`${f} on ${syn}`);
        }
    }
}
process.stdout.write([...out].join('\n') + '\n');
