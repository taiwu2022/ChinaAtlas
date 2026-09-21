'use strict';
// Run from tests/navigation.cjs in the repository, or pass the repository root.
// This harness exercises production navigation/render/click code with an isolated
// DOM/history adapter. Visual layout and native browser event order need browser QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const read = name => fs.readFileSync(path.join(root, 'web', name), 'utf8');
const navigationSource = read('navigation.js');
const appLines = read('app.js').split('\n');
const networkLines = read('network.js').split('\n');
const regionLines = read('regions.js').split('\n');
const departmentSource = read('departments.js');
function productionLine(lines, prefix) {
  const line = lines.find(line => line.startsWith(prefix));
  assert.ok(line, 'Production code entrypoint exists: ' + prefix);
  return line;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(start = '#people') {
  let href = 'https://example.test/ChinaAtlas/' + start, cursor = 0;
  const entries = [{ url: href, state: { atlasDepth: 0 } }];
  const listeners = { document: {}, window: {} }, elements = {};
  const log = { draws: [], renders: [], scrolls: [], errors: [] };
  const makeElement = id => elements[id] ||= {
    id, value: '', open: false, scrollTop: 0,
    addEventListener() {}, setAttribute() {},
    close() { this.open = false; }, showModal() { this.open = true; },
    getBoundingClientRect() { return { left: 0, right: 390, top: 0, bottom: 844 }; },
  };
  ['search', 'detail', 'heading', 'content'].forEach(makeElement);
  const nav = Object.fromEntries(['map', 'people', 'regions', 'network', 'changes', 'guide'].map(id => [id, {
    hash: '#' + id, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
    addEventListener(type, fn) { this[type] = fn; },
  }]));
  const people = new Map(['a', 'b'].map(id => [id, { id, personal_note: 'saved:' + id }]));
  const draw = (kind, id) => {
    log.draws.push(kind + ':' + id);
    elements.detail.open = true;
    delete elements['person-note']; delete elements['ask-question'];
    if (kind === 'person') elements['person-note'] = { id: 'person-note', value: people.get(id).personal_note };
    if (kind === 'ask') elements['ask-question'] = { id: 'ask-question', value: '' };
  };
  const context = {
    URL, URLSearchParams, console,
    location: {
      get hash() { return new URL(href).hash; },
      set hash(hash) { context.history.pushState(null, '', hash.startsWith('#') ? hash : '#' + hash); },
      get href() { return href; },
    },
    history: {
      get state() { return entries[cursor].state; },
      replaceState(state, _, url) {
        href = new URL(url, href).href; entries[cursor] = { url: href, state: structuredClone(state) };
      },
      pushState(state, _, url) {
        href = new URL(url, href).href; entries.splice(++cursor); entries.push({ url: href, state: structuredClone(state) });
      },
      go(delta) { assert.ok(entries[cursor + delta], 'History destination exists'); cursor += delta; href = entries[cursor].url; },
      back() { this.go(-1); }, forward() { this.go(1); },
    },
    window: {
      scrollY: 120,
      scrollTo(_, y) { this.scrollY = y; log.scrolls.push(y); },
      addEventListener(type, fn) { (listeners.window[type] ||= []).push(fn); },
    },
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: selector => selector === 'nav a' ? Object.values(nav) : [],
      querySelector: () => ({ hidden: false }),
      addEventListener(type, fn) { (listeners.document[type] ||= []).push(fn); },
    },
    $: id => elements[id] || null,
    atlas: { people: [...people.values()], guides: [{ id: 'guide-a' }], career_links: [] },
    query: '', focus: 'all', peopleLevel: 'all', peopleTrack: 'all', peopleStatus: 'all', peopleOrg: 'all',
    peopleSector:'all',peopleVerification:'all',peopleEvent:'all',regionSector:'all',regionVerification:'all',
    peoplePlace: 'all', peopleRegionMode: 'any', regionId: 'jining', regionService: 'current', regionDepth: 'direct',
    networkPerson: 'a', networkPlace: 'all', networkKind: 'all', networkTrail: [], graphMode: 'dual', graphRelation: 'all', route: 'people',
    place: id => ['jining', 'jinan', 'shandong'].includes(id) ? { id } : null,
    person: id => people.get(id), org: id => id === 'org-a' ? { id } : null,
    showPerson: id => draw('person', id), showOrg: id => draw('org', id), showGuide: id => draw('guide', id),
    findNetworkLink: id => context.atlas.career_links.find(l=>l.id===id),
    showDocument: id => draw('document', id), showLink: id => draw('link', id), showComparison: id => draw('compare', id), showPersonMap: id => draw('roles', id),
    showEvidence: e => draw('evidence', e.id), showDeviceNotes: () => draw('notes', 'device'),
    showAsk: (kind, id) => draw('ask', kind + ':' + id), showAddProfile: () => draw('add', 'profile'),
    showDetail: (_, kind) => draw(kind, 'loading'),
    isPublicAtlas: () => true, compactScreen: () => true,
    toast: message => log.errors.push(message), requestAnimationFrame: fn => fn(), navigator: {},
    publicModeUI() {}, finishGraph() {},
    portableClick: async () => false, regionClick: () => false, registryClick: async () => false, networkClick: async () => false,
    localStorage: { setItem() {} }, api: async () => ({}),
  };
  vm.createContext(context);
  const run = source => vm.runInContext(source, context);
  run(navigationSource);
  run(departmentSource);
  ['Map', 'People', 'Changes', 'Guide', 'Network', 'Regions'].forEach(name => context['draw' + name] = () => {
    log.renders.push({ route: context.route, query: context.query, place: context.peoplePlace, region: context.regionId, service: context.regionService }); return '';
  });
  run(productionLine(appLines, 'function render()'));
  run(productionLine(appLines, "document.addEventListener('click'"));
  run(productionLine(appLines, "window.addEventListener('hashchange'"));
  run('installAtlasNavigation()');
  async function dispatchDocument(type, event) {
    for (const listener of listeners.document[type] || []) await listener(event);
  }
  async function browserNavigationEvents() {
    // Browsers can fire both events for one same-document history traversal.
    for (const listener of listeners.window.popstate || []) await listener({});
    for (const listener of listeners.window.hashchange || []) await listener({});
    await tick();
  }
  return {
    context, elements, entries, nav, people, log, run, dispatchDocument, browserNavigationEvents,
    async traverse(direction) { context.history[direction](); await browserNavigationEvents(); },
    async click(dataset = {}, id = '') {
      const button = { id, dataset, disabled: false, classList: { contains: () => false } };
      await dispatchDocument('click', { target: { closest: () => button } }); return button;
    },
    async typeNote(value) { elements['person-note'].value = value; await dispatchDocument('input', { target: elements['person-note'] }); },
    params: () => new URLSearchParams(context.location.hash.split('?')[1] || ''),
  };
}

test('duplicate popstate/hashchange restores target search, filters and scroll without render overwriting history', async () => {
  const f = fixture();
  f.context.query = '郭飞'; f.context.peoplePlace = 'jining'; f.context.window.scrollY = 560; f.run('render()');
  f.nav.guide.click(); f.context.location.hash = 'guide'; await f.browserNavigationEvents();
  f.context.query = '制度'; f.run('render()'); await f.traverse('back');
  assert.equal(f.context.query, '郭飞'); assert.equal(f.context.peoplePlace, 'jining');
  assert.equal(f.context.history.state.atlasUI.query, '郭飞'); assert.equal(f.context.window.scrollY, 560);
  f.run('render()'); assert.equal(f.context.history.state.atlasUI.peoplePlace, 'jining');
});

test('person to AI question and back restores input draft; saved edits survive Forward', async () => {
  const f = fixture(); f.run("showPerson('a')"); await f.typeNote('draft A');
  await f.click({ ask: 'person:a' }); assert.equal(f.params().get('view'), 'ask');
  await f.traverse('back'); assert.equal(f.elements['person-note'].value, 'draft A');
  await f.typeNote('saved edit'); await f.click({ saveNote: 'a' });
  f.run('closeAtlasDetail()'); await f.browserNavigationEvents(); await f.traverse('forward');
  assert.equal(f.elements['person-note'].value, 'saved edit'); assert.equal(f.people.get('a').personal_note, 'saved edit');
});

test('institution and evidence deep links restore on Back without adding another history entry', async () => {
  const f = fixture(); f.context.api = async () => ({ id: 'source-a' }); f.run("showPerson('a')");
  await f.click({ org: 'org-a' }); assert.equal(f.params().get('view'), 'org');
  await f.click({ evidence: 'source-a' }); await tick(); assert.equal(f.log.draws.at(-1), 'evidence:source-a');
  const length = f.entries.length; await f.traverse('back');
  assert.equal(f.log.draws.at(-1), 'org:org-a'); assert.equal(f.entries.length, length);
  await f.traverse('back'); assert.equal(f.log.draws.at(-1), 'person:a');
});

test('Jining past-service view survives a different region and duplicate Back handlers', async () => {
  const f = fixture('#regions?region=jining');
  f.run(productionLine(networkLines, 'function locationHash(')); f.run(productionLine(regionLines, 'function goRegion('));
  f.run(productionLine(regionLines, 'function regionClick('));
  await f.click({regionService: 'past'}); await f.click({regionDepth: 'all'});
  await f.click({region: 'jinan'}); await f.browserNavigationEvents();
  assert.equal(f.context.regionId, 'jinan'); assert.equal(f.context.regionService, 'all');
  await f.traverse('back'); assert.equal(f.context.regionId, 'jining');
  assert.equal(f.context.regionService, 'past'); assert.equal(f.context.regionDepth, 'all');
});

test('network all-regions clears the place parameter; leaving a profile clears modal URL', async () => {
  const f = fixture('#network?center=a&place=shandong');
  f.context.networkPlace = 'all'; f.run('render()'); assert.equal(f.params().has('place'), false);
  f.run(productionLine(networkLines, 'async function networkClick('));
  f.run("showPerson('a')"); await f.click({ networkPerson: 'a' });
  assert.equal(f.params().has('view'), false); assert.equal(f.params().get('center'), 'a');
  assert.equal(f.context.history.state.atlasDepth, 0); assert.equal(f.elements.detail.open, false);
});

test('late failed evidence deep link cannot close a newer person reached by history', async () => {
  const f = fixture(), wait = deferred(); f.context.api = () => wait.promise;
  f.context.history.pushState({}, '', '#people?view=evidence&id=old'); const pending = f.run('handleAtlasNavigation()');
  f.context.history.pushState({}, '', '#people?view=person&id=b'); await f.run('handleAtlasNavigation()');
  wait.reject(new Error('old request failed')); await pending;
  assert.equal(f.log.draws.at(-1), 'person:b'); assert.equal(f.elements.detail.open, true); assert.deepEqual(f.log.errors, []);
});

test('late successful evidence deep link cannot replace a newer clicked person', async () => {
  const f = fixture(), wait = deferred(); f.context.api = () => wait.promise;
  f.context.history.pushState({}, '', '#people?view=evidence&id=old'); const pending = f.run('handleAtlasNavigation()');
  await f.click({ person: 'b' }); wait.resolve({ id: 'old' }); await pending;
  assert.equal(f.log.draws.at(-1), 'person:b'); assert.equal(f.params().get('view'), 'person'); assert.equal(f.params().get('id'), 'b');
});

test('ordinary evidence button uses ticketed navigation and ignores a late response after another click', async () => {
  const f = fixture(), wait = deferred(); f.context.api = () => wait.promise;
  await f.click({ evidence: 'old' }); assert.equal(f.params().get('view'), 'evidence');
  await f.click({ person: 'b' }); wait.resolve({ id: 'old' }); await tick();
  assert.equal(f.log.draws.at(-1), 'person:b'); assert.equal(f.params().get('id'), 'b');
});

test('Close then a fresh profile click intentionally uses explicitly saved note', async () => {
  const f = fixture(); f.run("showPerson('a')"); await f.typeNote('unsaved');
  f.run('closeAtlasDetail()'); await f.browserNavigationEvents(); await f.click({ person: 'a' });
  assert.equal(f.elements['person-note'].value, 'saved:a');
});

test('legacy saved reading state defaults new evidence filters without hiding the directory',()=>{const f=fixture();f.run("restoreReadingState({query:'old query',peoplePlace:'jining'})");assert.equal(f.context.peopleSector,'all');assert.equal(f.context.peopleVerification,'all');assert.equal(f.context.regionSector,'all');});


test('two-person comparison deep link reloads and Back restores an unsaved profile note', async () => {
  const f=fixture();
  f.run("showPerson('a')");
  await f.typeNote('unsaved research question');
  f.run("showComparison('a~b')");
  assert.equal(f.params().get('view'),'compare');
  await f.browserNavigationEvents();
  assert.equal(f.log.draws.at(-1),'compare:a~b');
  await f.traverse('back');
  assert.equal(f.elements['person-note'].value,'unsaved research question');
  const direct=fixture('#network?view=compare&id=a~b');
  await tick();
  assert.equal(direct.log.draws.at(-1),'compare:a~b');
});
test('comparison deep links reject missing people and self comparison', async () => {
  for(const id of ['a~missing','a~a','a~b~a']){
    const f=fixture('#network?view=compare&id='+id);
    await tick();
    assert.equal(f.log.draws.some(d=>d.startsWith('compare:')),false);
    assert.equal(f.elements.detail.open,false);
  }
});

test('department deep link and person draft survive source drilldown and Back', async () => {
 const f=fixture('#people?browse=departments&department=org-a&area=jining&group=organization&service=past&event=retired');
 assert.equal(f.run('departmentId'),'org-a');assert.equal(f.run('departmentService'),'past');
 assert.equal(f.context.peopleEvent,'retired');
 f.run("showPerson('a')");await f.typeNote('department research draft');
 f.context.api=async()=>({id:'source-a'});await f.click({evidence:'source-a'});await tick();
 await f.traverse('back');assert.equal(f.elements['person-note'].value,'department research draft');
 await f.traverse('back');
 assert.equal(f.run('peopleBrowse'),'departments');assert.equal(f.run('departmentPlace'),'jining');assert.equal(f.run('departmentService'),'past');
 assert.equal(f.params().get('department'),'org-a');
});
test('institution roster entry opens a clean department view and invalid department links are ignored', async () => {
 const f=fixture();await f.click({viewOrgPeople:'org-a'});
 assert.equal(f.params().get('department'),'org-a');assert.equal(f.params().get('browse'),'departments');
 assert.equal(f.params().has('view'),false);assert.equal(f.run('departmentService'),'all');
 const invalid=fixture('#people?browse=departments&department=missing&area=missing&service=invalid');
 assert.equal(invalid.run('departmentId'),'all');assert.equal(invalid.run('departmentPlace'),'all');assert.equal(invalid.run('departmentService'),'all');
});
