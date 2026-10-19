// @ts-check
/**
 * DS Comments — settings wiring regression tests (source-level).
 *
 * The media provider API keys (dsc_media_tenor_key / dsc_media_giphy_key) are
 * localforage-backed password fields and are deliberately NOT registered in
 * FIELD_MAP. Their input/change handlers in index.js must therefore run
 * BEFORE the `if (!cfg) return;` FIELD_MAP gate — a regression here silently
 * drops every keystroke and the resolver runs with an empty key (observed
 * live: Giphy selected + key typed, comments still rendered text-only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'index.js'), 'utf8');

/** Index of the FIELD_MAP gate inside the handler containing `anchor`. */
function gateIndexAfter(anchor) {
    const start = src.indexOf(anchor);
    assert.ok(start !== -1, `anchor not found: ${anchor}`);
    const gate = src.indexOf("const cfg = FIELD_MAP[el.id];\n        if (!cfg) return;", start);
    assert.ok(gate !== -1, 'FIELD_MAP gate not found after anchor');
    return gate;
}

test('input handler: media key setters run BEFORE the FIELD_MAP gate', () => {
    // The gate found after the first (change) handler also guards the second;
    // anchor both handlers separately via their setApiKey lines.
    const setInput = src.indexOf("if (el.id === 'dsc_apikey') { setApiKey(el.value); return; }");
    assert.ok(setInput !== -1, 'input apikey handler not found');
    const gate = src.lastIndexOf("const cfg = FIELD_MAP[el.id];\n        if (!cfg) return;", setInput);
    const tenor = src.indexOf("setMediaProviderKey('tenor', el.value)");
    const giphy = src.indexOf("setMediaProviderKey('giphy', el.value)");
    assert.ok(tenor !== -1 && giphy !== -1, 'media key setters not wired');
    assert.ok(tenor < gate && giphy < gate, 'setMediaProviderKey calls must precede the FIELD_MAP gate');
});

test('change handler: media key flush runs BEFORE the FIELD_MAP gate', () => {
    const flush = src.indexOf("if (el.id === 'dsc_media_tenor_key' || el.id === 'dsc_media_giphy_key') { flushMediaProviderKeys(); return; }");
    assert.ok(flush !== -1, 'media key flush not wired');
    const gate = gateIndexAfter('dsc_sound_file');
    assert.ok(flush < gate, 'flushMediaProviderKeys must precede the FIELD_MAP gate');
});

test('both media key ids are hidden by updateMediaVisibility, keys synced from localforage', () => {
    const sync = readFileSync(path.join(root, 'src/ui/settings-sync.js'), 'utf8');
    assert.match(sync, /getElementById\('dsc_media_tenor_key'\)/);
    assert.match(sync, /getElementById\('dsc_media_giphy_key'\)/);
    assert.match(sync, /getMediaProviderKey\('tenor'\)/);
    assert.match(sync, /getMediaProviderKey\('giphy'\)/);
    // visibility: tenor fields hidden unless provider === 'tenor'
    assert.match(sync, /tenorKey\.hidden = provider !== 'tenor'/);
    assert.match(sync, /giphyKey\.hidden = provider !== 'giphy'/);
});
