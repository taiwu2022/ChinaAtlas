'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),packet=JSON.parse(fs.readFileSync(path.join(root,'data/portraits.json'))),atlas=JSON.parse(fs.readFileSync(path.join(root,'data/atlas.json')));
const source=fs.readFileSync(path.join(root,'web/portraits.js'),'utf8');
function harness(fetch){const slot={dataset:{portraitFor:'xi-jinping'},innerHTML:'',hidden:false},note={value:'KEEP MY DRAFT'},listeners={};const ctx=vm.createContext({atlas,fetch,AbortController,setTimeout,clearTimeout,URL,person:id=>atlas.people.find(p=>p.id===id),document:{querySelector:()=>slot,addEventListener:(type,fn)=>listeners[type]=fn},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),current:p=>p.roles.filter(r=>r.status==='current')});vm.runInContext(source,ctx);return {ctx,slot,note,listeners,run:s=>vm.runInContext(s,ctx)};}
(async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r)),pending=h.run('loadPortraits()');
 h.slot.dataset.portraitFor='li-qiang';resolve({ok:true,json:async()=>packet});await pending;
 assert(h.slot.innerHTML.includes('李强的公开肖像'));assert(!h.slot.innerHTML.includes('习近平的公开肖像'));assert.equal(h.note.value,'KEEP MY DRAFT');
 assert.equal(h.run("portraitHTML(person('wen-jinrong'))"),'');
 h.run("portraitCatalog['xi-jinping'].name='Wrong person'");assert.equal(h.run("portraitHTML(person('xi-jinping'))"),'');
 h.run("portraitCatalog['li-qiang'].image_url='javascript:alert(1)'");assert.equal(h.run("portraitHTML(person('li-qiang'))"),'');
 h.listeners.error({target:{matches:()=>true,closest:()=>h.slot}});assert.equal(h.slot.hidden,true);assert.equal(h.note.value,'KEEP MY DRAFT');
 const failed=harness(async()=>{throw Error('Offline')});await failed.run('loadPortraits()');assert.equal(failed.slot.innerHTML,'');
 const rejected=harness(async()=>({ok:false}));await rejected.run('loadPortraits()');assert.equal(rejected.slot.innerHTML,'');
 console.log('Portrait identity, missing-image, failure and late-response checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
