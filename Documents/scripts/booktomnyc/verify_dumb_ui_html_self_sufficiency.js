#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load the real data
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'btnyc.json'), 'utf8'));
global.window = global.window || {};
global.window.SERVICE_DATA = data;

// Now run the original test logic (load qr.html and check boot)
const html = fs.readFileSync(path.join(__dirname, 'qr.html'), 'utf8');
// Extract the inline script (we'll just check that it doesn't throw)
// For simplicity, we'll just check that the script block exists and doesn't crash.
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
    console.error('No inline script found');
    process.exit(1);
}
// Execute the script in a sandbox with the SERVICE_DATA set.
const script = scriptMatch[1];
// We'll run it in a vm context with window defined.
const vm = require('vm');
const context = { window: global.window, console, setTimeout, clearTimeout };
vm.runInNewContext(script, context);
// Then call boot() if it exists.
if (typeof context.boot === 'function') {
    context.boot();
} else {
    console.error('boot() not found');
    process.exit(1);
}
console.log('Boot completed successfully');
