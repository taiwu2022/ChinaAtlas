'use strict';
// Isolated VM checks: never touches the user's browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = process.env.ATLAS_PROJECT_ROOT || path.resolve(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/atlas.json'), 'utf8'));
const script = fs.readFileSync(path.join(ROOT, 'web/portable.js'), 'utf8');

function harness(raw = null) {
  const storage = {raw, writes: 0, denyRead: false, denyWrite: false};
  const calls = [], handlers = {}, elements = {'note-import-preview': {innerHTML: ''}};
  const sandbox = {
    window: {ATLAS_CONFIG: {mode: 'public'}},
    document: {addEventListener(type, handler) {handlers[type] = handler;}, querySelectorAll() {return []; }},
    localStorage: {
      getItem() {if (storage.denyRead) throw Error('storage unavailable'); return storage.raw;},
      setItem(key, value) {if (storage.denyWrite) throw Error('storage unavailable'); storage.raw = value; storage.writes++;}
    },
    fetch: async url => {calls.push(url); return {ok: true, json: async () => structuredClone(base)};},
    person: id => base.people.find(person => person.id === id),
    atlas: structuredClone(base),
    $: id => elements[id],
    showDetail() {}, toast() {}, esc: value => String(value),
    URL, Blob, Date, setTimeout, console
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return {storage, calls, handlers, elements, sandbox, run: code => vm.runInContext(code, sandbox)};
}

(async () => {
  let checks = 0;
  for (const raw of ['invalid json', '{}', '[{"person_id":"x","note":99}]']) {
    const h = harness(raw);
    assert.throws(() => h.run("writeDeviceNote('x','NEW_NOTE')"));
    assert.equal(h.storage.raw, raw);
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  {
    const h = harness('[{"person_id":"x","note":"ORIGINAL"}]');
    h.storage.denyRead = true;
    assert.throws(() => h.run("writeDeviceNote('x','NEW_NOTE')"));
    assert.equal(h.storage.writes, 0);
    const loaded = await h.run("publicAPI('atlas')");
    assert.equal(loaded.people.length, base.people.length);
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  {
    const h = harness('[{"person_id":"x","note":"ORIGINAL"}]');
    h.storage.denyWrite = true;
    assert.throws(() => h.run("writeDeviceNote('x','NEW_NOTE')"));
    assert(h.storage.raw.includes('ORIGINAL'));
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  {
    const h = harness();
    const rows = h.run("mergeDeviceNotes([{person_id:'x',note:'original'}],[{person_id:'x',note:'different'},{person_id:'unknown-future-person',note:'retain me'}])");
    assert(rows.find(row => row.person_id === 'x').note.includes('original'));
    assert(rows.find(row => row.person_id === 'x').note.includes('different'));
    assert.equal(rows.find(row => row.person_id === 'unknown-future-person').note, 'retain me');
    const duplicate = h.run("mergeDeviceNotes([{person_id:'x',note:'same'}],[{person_id:'x',note:'same'}])");
    assert.equal(duplicate[0].note, 'same');
    assert.throws(() => h.run("mergeDeviceNotes([{person_id:'x',note:'a'.repeat(19000)}],[{person_id:'x',note:'b'.repeat(19000)}])"));
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  {
    const h = harness();
    const pack = {format: 'china-atlas-notes-v1', notes: [{person_id: 'unknown-future-person', note: 'retain me'}]};
    const text = JSON.stringify(pack);
    await h.handlers.change({target: {id: 'import-notes', files: [{size: text.length, text: async () => text}]}});
    assert.equal(h.run('pendingNoteImport.length'), 1);
    await h.run("portableClick({id:'apply-note-import'})");
    assert.equal(JSON.parse(h.storage.raw)[0].person_id, 'unknown-future-person');
    checks++;
  }
  {
    const h = harness('BROKEN_ORIGINAL');
    h.run("pendingNoteImport=[{person_id:'unknown-future-person',note:'incoming'}]");
    await assert.rejects(h.run("portableClick({id:'apply-note-import'})"));
    assert.equal(h.storage.raw, 'BROKEN_ORIGINAL');
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  {
    const h = harness();
    h.run("atlas.people[0].personal_note='PRIVATE_SENTINEL'");
    assert(!JSON.stringify(h.run('publicRegionExport(null)')).includes('PRIVATE_SENTINEL'));
    assert.equal(h.run('atlas.people[0].personal_note'), 'PRIVATE_SENTINEL');
    await h.run("publicAPI('atlas')");
    for (const endpoint of ['reviews/apply', 'news/refresh', 'documents/open']) {
      await assert.rejects(h.run(`publicAPI('${endpoint}',{})`));
    }
    assert.deepEqual(h.calls, ['./data/atlas.json']);
    assert.equal(h.storage.writes, 0);
    checks++;
  }
  console.log(`Portable notes: ${checks} checks passed (isolated storage only).`);
})().catch(error => {console.error(error); process.exitCode = 1;});
