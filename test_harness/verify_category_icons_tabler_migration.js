#!/usr/bin/env node
/**
 * verify_category_icons_tabler_migration.js
 *
 * Verifies the T118, operator-directed migration of the category grid's
 * icons from emoji characters to Tabler icon markup.
 *
 * Real, end-to-end finding during this fix, not assumed: editing the
 * static #category-card HTML alone is insufficient. renderCategoryCards()
 * fully replaces that container's children on init
 * (DOM.categoriesGrid.replaceChildren()), reading each category's icon
 * from SERVICE_DATA.category[*].icon and inserting it via `text:`
 * (el.textContent) in the `create()` helper. A plain data-value change
 * from emoji to a Tabler class string ("ti ti-home") would have rendered
 * as literal, visible text ("ti ti-home" as a word on the page), not an
 * icon glyph, without also fixing the render call itself to build a real
 * <i> element. Both were required together.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const html = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== Data: every category icon is now a real Tabler class string, not an emoji ===');
{
    const expected = {
        minor_home_repairs: 'ti ti-home',
        furniture_fixes_assembly: 'ti ti-sofa',
        wall_mounting: 'ti ti-wall',
        electric_lighting: 'ti ti-plug',
        plumbing_help: 'ti ti-bath',
        tech_trouble: 'ti ti-device-laptop',
    };
    for (const cat of DB.category) {
        if (expected[cat.id]) {
            check(`${cat.id}.icon is "${expected[cat.id]}"`, cat.icon === expected[cat.id]);
        }
    }
    check('no category icon still contains an emoji character', !DB.category.some(c => /\p{Extended_Pictographic}/u.test(c.icon || '')));
}

const consoleErrors = [];
const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => DB };
            return { ok: false, status: 404 };
        };
        window.HTMLElement.prototype.scrollIntoView = function () {};
        window.console.error = (...args) => consoleErrors.push(args.join(' '));
    },
});

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('\n=== App initializes cleanly ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));

    console.log('\n=== Real, end-to-end render: renderCategoryCards() actually produces real <i> icon elements, not literal text ===');
    const cards = doc.querySelectorAll('.category-card[data-category-id]');
    check('all 6 category cards render', cards.length === 6);
    let allHaveRealIcon = true;
    let noLiteralTextLeaked = true;
    cards.forEach((c) => {
        const icon = c.querySelector('.category-icon i.ti');
        if (!icon || !icon.className.startsWith('ti ti-')) allHaveRealIcon = false;
        // The bug this test guards against: if icon were inserted via
        // textContent, the class string itself would appear as visible
        // text inside .category-icon rather than as an element attribute.
        const iconDiv = c.querySelector('.category-icon');
        if (iconDiv && /ti ti-/.test(iconDiv.textContent)) noLiteralTextLeaked = false;
    });
    check('every card has a real <i class="ti ti-*"> icon element (not textContent)', allHaveRealIcon);
    check('the icon class string never leaks out as literal, visible text', noLiteralTextLeaked);

    console.log('\n=== Regression: the grid remains fully interactive after the migration ===');
    const before = consoleErrors.length;
    cards[0].dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    cards[0].dispatchEvent(new w.Event('click', { bubbles: true }));
    await wait(100);
    check('a real category tap produces no new console errors', consoleErrors.length === before);

    console.log(`\n[category icons Tabler migration] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
