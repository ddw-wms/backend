// Simple script to scan the frontend codebase for permission keys and output a manifest
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'wms_frontend');
const outFile = path.join(root, 'permission_manifest.json');

const fileList = [];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        if (e.isDirectory()) {
            if (['node_modules', '.next', 'tmp', 'out'].includes(e.name)) continue;
            walk(path.join(dir, e.name));
        } else if (e.isFile()) {
            if (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.js') || e.name.endsWith('.jsx')) {
                fileList.push(path.join(dir, e.name));
            }
        }
    }
}

walk(root);

const regex = /['\"]([a-zA-Z0-9_]+)['\"]/gi;
const keys = new Set();

// Only accept keys that start with specific permission prefixes OR match common UI suffixes
const permPrefix = /^(view_|create_|edit_|delete_|export_|manage_|print_|dashboard_|receive_|dispatch_|complete_|import_|refresh_|approve_|reject_|export_|refresh_|dashboard_)/i;
const permSuffix = /(_columns|_grid|_columns_settings|_grid_settings|_tab_|_columnstate|columnState)$/i;
// Blacklist common column-like keys that were false positives
const blacklist = new Set(['created_at', 'updated_at', 'created_by', 'updated_by', 'id', 'created_user_name']);

for (const f of fileList) {
    const content = fs.readFileSync(f, 'utf8');
    let match;
    while ((match = regex.exec(content))) {
        const key = match[1];
        const lower = key.toLowerCase();
        // Filter plausible permission prefixes or common UI suffixes and exclude blacklist
        if ((permPrefix.test(key) || permSuffix.test(key)) && !blacklist.has(lower)) {
            keys.add(key);
        }
    }
}

const arr = Array.from(keys).sort();
fs.writeFileSync(outFile, JSON.stringify({ generated_at: new Date().toISOString(), permissions: arr }, null, 2));
console.log('Generated', arr.length, 'permission keys to', outFile);