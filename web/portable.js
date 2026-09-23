'use strict';
const isPublicAtlas=()=>window.ATLAS_CONFIG?.mode==='public';
const compactScreen=()=>!!window.matchMedia?.('(max-width:800px)').matches;
const notesKey='china-atlas-personal-notes-v1';
let publicDataPromise=null,publicEvidencePromise=null,pendingNoteImport=[];
let deviceNotesError='';
function readDeviceNotes({allowFailure=false}={}){try{const rows=JSON.parse(localStorage.getItem(notesKey)||'[]');if(!Array.isArray(rows)||rows.some(n=>!n||typeof n.person_id!=='string'||typeof n.note!=='string'))throw new Error('invalid');deviceNotesError='';return rows.map(n=>({person_id:n.person_id,note:n.note,updated_at:n.updated_at||''}));}catch{deviceNotesError='无法读取此浏览器的笔记。为保护原数据，已停止写入；请先导出原始备份。';if(allowFailure)return [];throw new Error(deviceNotesError);}}
function mergeDeviceNotes(rows,incoming){const known=new Map(rows.map(n=>[n.person_id,n]));for(const row of incoming){const prior=known.get(row.person_id);if(!prior)known.set(row.person_id,row);else if(prior.note!==row.note&&!prior.note.includes(row.note)){const note=prior.note+'\n\n—— 导入的另一份笔记 ——\n'+row.note;if(note.length>20000)throw new Error('合并后的笔记超过 20,000 字符，尚未写入。请先整理文件。');known.set(row.person_id,{...prior,note,updated_at:new Date().toISOString()});}}return [...known.values()];}
function writeDeviceNote(id,note){const rows=readDeviceNotes().filter(n=>n.person_id!==id);if(note)rows.push({person_id:id,note,updated_at:new Date().toISOString()});try{localStorage.setItem(notesKey,JSON.stringify(rows));}catch{throw new Error('浏览器未能保存笔记。请允许本站存储，或先复制文字备份。');}}
async function publicAPI(path,body){
 if(path==='atlas'){
  publicDataPromise??=fetch('./data/atlas.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('资料暂时无法读取，请联网后重试。');return r.json();}).catch(e=>{publicDataPromise=null;throw e;});
  const data=JSON.parse(JSON.stringify(await publicDataPromise)),notes=new Map(readDeviceNotes({allowFailure:true}).map(n=>[n.person_id,n.note]));data.people.forEach(p=>p.personal_note=notes.get(p.id)||'');return data;
 }
 if(path==='notes'){if(!person(body?.person_id)||typeof body.note!=='string'||body.note.length>20000)throw new Error('笔记内容无效或过长。');writeDeviceNote(body.person_id,body.note);return {saved:true};}
 if(path==='reviews')return [];
 if(path==='news')return {items:[],loading:false};
 if(path.startsWith('evidence?id=')){
  publicEvidencePromise??=fetch('./data/evidence.json').then(r=>{if(!r.ok)throw new Error('摘录暂时无法读取。');return r.json();}).catch(e=>{publicEvidencePromise=null;throw e;});
  const result=(await publicEvidencePromise)[decodeURIComponent(path.slice(12))];if(!result)throw new Error('未收录这份摘录，请打开原文。');return result;
 }
 throw new Error('此操作需要在本地维护版本中完成。');
}
function saveJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function publicRegionExport(id){
 const copy=JSON.parse(JSON.stringify(atlas));copy.people.forEach(p=>delete p.personal_note);
 if(!id)return copy;
 const ps=regionPeople(id),pids=new Set(ps.map(p=>p.id));copy.people=copy.people.filter(p=>pids.has(p.id));copy.career_posts=copy.career_posts.filter(p=>pids.has(p.person_id));copy.career_links=copy.career_links.filter(l=>pids.has(l.from)&&pids.has(l.to));copy.person_connections=copy.person_connections.filter(l=>pids.has(l.from)&&pids.has(l.to));copy.events=copy.events.filter(e=>e.person_ids.some(pid=>pids.has(pid)));
 const postIds=new Set(copy.career_posts.map(p=>p.id));copy.place_groups=(copy.place_groups||[]).map(g=>({...g,person_ids:g.person_ids.filter(pid=>pids.has(pid)),post_ids:g.post_ids.filter(pid=>postIds.has(pid))})).filter(g=>g.person_ids.length>1);copy.research_coverage=(copy.research_coverage||[]).filter(r=>inheritedPlaces([r.location_id]).includes(id));
 copy.profile_facts=(copy.profile_facts||[]).filter(f=>pids.has(f.person_id));copy.status_events=(copy.status_events||[]).filter(e=>pids.has(e.person_id));
 for(const group of copy.place_groups)group.source_ids=[...new Set(copy.career_posts.filter(p=>group.post_ids.includes(p.id)).flatMap(p=>p.source_ids))];
 const orgs=new Set([...copy.people.flatMap(p=>p.roles.map(r=>r.org_id)),...copy.career_posts.map(p=>p.organization_id),...copy.status_events.flatMap(e=>e.org_ids||[])]);copy.institutions=copy.institutions.filter(o=>orgs.has(o.id));copy.relations=copy.relations.filter(r=>orgs.has(r.from)&&orgs.has(r.to));copy.guides=[];copy.rank_mapping=[];copy.regional_coverage=copy.regional_coverage.filter(r=>r.location_id===id);
 const ids=new Set();function collect(v){if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(k.endsWith('source_ids'))x.forEach(i=>ids.add(i));else collect(x);}}
 collect({...copy,sources:[]});copy.sources=copy.sources.filter(s=>ids.has(s.id));copy.region=place(id);copy.format='china-atlas-public-region-v1';return copy;
}
function showDeviceNotes(){
 let rows;try{rows=readDeviceNotes();}catch(e){showDetail(`<h2>笔记暂时无法读取</h2><p>${esc(e.message)}</p><button id="export-raw-notes">导出原始备份</button>`,'notes');return;}showDetail(`<span class="pill">我的笔记 · 当前浏览器</span><h2 class="detail-title">把阅读留下来</h2><p class="note">已保存 ${rows.length} 位人物的笔记。笔记只在这台设备的浏览器中，不会上传，也不会自动同步。换设备前导出，再在另一台设备导入。</p><div class="detail-actions"><button id="export-notes" class="primary">导出笔记</button><label class="file-button">导入笔记<input id="import-notes" type="file" accept="application/json,.json"></label></div><div id="note-import-preview"></div>${rows.map(n=>`<article class="note-entry">${person(n.person_id)?`<button data-person="${esc(n.person_id)}">${esc(person(n.person_id).name)}</button>`:`<strong>${esc(n.person_id)}</strong> <small>人物尚未在此版本收录</small>`}<p>${esc(n.note)}</p></article>`).join('')||'<p class="empty">打开任意人物，在档案下方写第一条笔记。</p>'}<p class="note">清除浏览器数据会移除笔记。无痕模式下，关闭窗口后可能丢失。</p>`,'notes');
}
function publicModeUI(){
 if(!isPublicAtlas())return;
 document.querySelectorAll('[data-local-only]').forEach(el=>el.hidden=true);
 document.querySelectorAll('[data-public-only]').forEach(el=>el.hidden=false);
 document.querySelectorAll('a[href^="/api/"]').forEach(a=>{const u=new URL(a.getAttribute('href'),'https://atlas.invalid');a.dataset.publicExport=u.pathname.includes('regions')?u.searchParams.get('id'):'all';a.href='#';a.removeAttribute('download');});
 const help=document.querySelector('[data-guide="reading-leadership-ranks"]');if(help)help.dataset.guide='rank_ladder';
}
function drawPublicChanges(){const events=atlas.events.filter(e=>e.status==='verified'&&match(e)).sort((a,b)=>b.date.localeCompare(a.date));return `${drawStatusUpdates()}<div class="section-title"><p class="note">已核对的任免 · ${events.length} 条</p>${external('https://www.12371.cn/special/rsrm/','查看官方新公告')}</div><p class="note compact-note">截至 ${esc(atlas.verified_at)} 的资料快照；新公告核实后再更新人物。</p>${events.map(eventCard).join('')||'<p class="empty">没有匹配的任免。</p>'}`;}
function drawPublicGuide(){return `<section class="rank-guide"><h2>职务层级</h2><div class="rank-ladder">${(atlas.rank_mapping||[]).map(r=>`<div><strong>${esc(r.label_zh)}</strong><span>${esc(r.label_en)}</span></div>`).join('')}</div><p class="note">党内身份、岗位层级、个人级别与影响力，分别理解。</p></section><section class="map-section reference-notes">${atlas.guides.filter(match).map(g=>`<details class="reference-item"><summary>${esc(T(g,'title'))}</summary>${guideDetail(g)}</details>`).join('')}</section>`;}
async function portableClick(b){
 if(b.id==='device-notes'){showDeviceNotes();return true;}
 if(b.id==='export-raw-notes'){let raw;try{raw=localStorage.getItem(notesKey);}catch{throw new Error('浏览器拒绝访问存储，暂时无法导出。');}saveJSON({format:'china-atlas-notes-recovery-v1',raw},'china-atlas-notes-recovery.json');return true;}
 if(b.id==='export-notes'){saveJSON({format:'china-atlas-notes-v1',exported_at:new Date().toISOString(),notes:readDeviceNotes()},'china-atlas-notes.json');return true;}
 if(b.id==='apply-note-import'){
  const merged=mergeDeviceNotes(readDeviceNotes(),pendingNoteImport),known=new Map(merged.map(n=>[n.person_id,n]));
  try{localStorage.setItem(notesKey,JSON.stringify(merged));}catch{throw new Error('浏览器未能保存导入内容；原有笔记保留。');}
  pendingNoteImport=[];atlas.people.forEach(p=>p.personal_note=known.get(p.id)?.note||'');showDeviceNotes();toast('笔记已合并；不同内容会同时保留。');return true;
 }
 return false;
}
document.addEventListener('click',e=>{const a=e.target.closest('a[data-public-export]');if(a){e.preventDefault();saveJSON(publicRegionExport(a.dataset.publicExport==='all'?null:a.dataset.publicExport),'china-atlas-'+a.dataset.publicExport+'.json');}});
document.addEventListener('change',async e=>{if(e.target.id!=='import-notes')return;try{const f=e.target.files[0];if(!f)return;if(f.size>5e6)throw new Error('笔记文件过大。');const pack=JSON.parse(await f.text());if(pack.format!=='china-atlas-notes-v1'||!Array.isArray(pack.notes)||pack.notes.length>1000)throw new Error('请选择从本应用导出的笔记 JSON。');if(pack.notes.some(n=>!n||typeof n.person_id!=='string'||typeof n.note!=='string'||n.note.length>20000))throw new Error('笔记格式无效，尚未导入。');pendingNoteImport=pack.notes.filter(n=>n.note).map(n=>({person_id:n.person_id,note:n.note,updated_at:typeof n.updated_at==='string'?n.updated_at:new Date().toISOString()}));$('note-import-preview').innerHTML=`<p>可导入 ${pendingNoteImport.length} 条。相同内容跳过，不同内容合并保留。</p><button id="apply-note-import" ${pendingNoteImport.length?'':'disabled'}>合并到此设备</button>`;}catch(error){pendingNoteImport=[];toast(error.message);}});

function initializeLayout(){const edition=document.querySelector('.edition strong');if(edition)edition.textContent=atlas.verified_at;if(!isPublicAtlas()){const container=document.querySelector('.side-bottom');if(container){const econ=new URL(location.origin),macro=new URL(location.origin);econ.port='18765';macro.port='18763';container.innerHTML=external(econ.href,'Econ Journal')+external(macro.href,'Macro Hour');}}}
