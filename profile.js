'use strict';

// Reading presentation only: the complete sourced records remain unchanged.
const profileUncertainLabels={conflicting:'来源冲突',unverified:'待核实',directory_only:'名册列示 · 任职待复核',historical_only:'历史记录 · 当前状态待核'};
function profileKnownRank(value){return value&&!/未.*核|待核|未注明|未记载|未提供|尚未|不推断|不代表|历史.*职务|曾任|曾兼任|Not independently|Historical office/i.test(value)?value:'';}
function profileOfficeKey(entry){
 let id=entry.org_id||entry.organization_id||'';
 if(id==='cmc'&&/中华人民共和国|国家中央军委/.test(entry.title))id='state-cmc';
 else if(id==='cmc'&&/中共中央|中国共产党/.test(entry.title))id='cpc-cmc';
 const institution=org(id),title=String(entry.title||'').replace(/[\s·]/g,'');
 const prefix=String(institution?.name||'').replace(/[\s·]/g,'');
 return id+'|'+(prefix&&title.startsWith(prefix)?title.slice(prefix.length):title);
}
function profileEntryStatus(entry){return entry.status==='former'||entry.end?'former':entry.status==='current'||entry.is_current?'current':'historical';}
function profileReadingEntries(p){
 const entries=[],seen=new Set(),used=new Set();
 const records=[...(p.roles||[]).map(r=>({...r,start:r.since||null,end:r.until||null,recordKind:'role',records:[r]})),...careerPosts(p.id).map(post=>({...post,org_id:post.organization_id,recordKind:'career',records:[post]}))].filter(record=>{
  const exact=record.recordKind+'|'+JSON.stringify(record.records[0]);if(seen.has(exact))return false;seen.add(exact);return true;
 }).map(record=>({...record,key:profileOfficeKey(record),status:profileEntryStatus(record)}));
 const compatible=(a,b)=>a.recordKind!==b.recordKind&&a.key===b.key&&a.status===b.status&&(!a.start||!b.start||a.start===b.start)&&(!a.end||!b.end||a.end===b.end);
 // Match both directions against the complete list: an undated entry must not
 // silently attach to the first of multiple terms, regardless of input order.
 for(const record of records){
  if(used.has(record))continue;
  const candidates=records.filter(other=>compatible(record,other));
  const same=candidates.length===1&&records.filter(other=>compatible(candidates[0],other)).length===1?candidates[0]:null;
  const combined=same?[record,same]:[record];combined.forEach(r=>used.add(r));
  entries.push({...record,start:record.start||same?.start||null,end:record.end||same?.end||null,records:combined.flatMap(r=>r.records),source_ids:[...new Set(combined.flatMap(r=>r.source_ids||[]))],as_of_date:combined.map(r=>r.as_of_date||r.latest_confirmed_at||r.current_evidence_date).find(Boolean)});
 }
 return entries;
}
function profileEntryUncertainty(entry){
 const states=entry.records.map(roleEvidence);
 return ['conflicting','unverified','directory_only'].find(state=>states.includes(state))||(entry.status==='historical'?'historical_only':'');
}
function profileReadingPeriod(entry){
 if(entry.start&&entry.end)return entry.start+' — '+entry.end;
 if(entry.start)return entry.start+' 起'+(entry.status==='current'?'':entry.status==='former'?' · 曾任':' · 历史记录');
 if(entry.end)return '离任 '+entry.end;
 return entry.status==='former'?'曾任':entry.status==='current'?'':'历史记录';
}
function profileReadingOffice(entry){
 const institution=org(entry.org_id),uncertainty=profileEntryUncertainty(entry),period=profileReadingPeriod(entry),rank=profileKnownRank(T(entry,'rank'));
 const evidence=entry.as_of_date?'资料截至 '+entry.as_of_date:'';
 return `<article class="profile-office${uncertainty?' profile-office-uncertain':''}">${uncertainty?`<span class="badge profile-material-warning">${esc(profileUncertainLabels[uncertainty])}</span>`:''}<h4>${esc(T(entry,'title'))}</h4><div class="profile-role-meta">${period?`<time>${esc(period)}</time>`:''}${evidence?`<small>${esc(evidence)}</small>`:''}${rank?`<span>${esc(rank)}</span>`:''}</div>${institution?`<button class="text-button" data-org="${esc(institution.id)}">${esc(institution.name)} →</button>`:''}</article>`;
}
function profileBioIsDuplicate(bio,entries){
 const title=String(T(bio,'role')).split(/[；;]/)[0].trim(),years=String(T(bio,'years')).replace(/[.．]/g,'-').replace(/[—–至~]/g,'|');
 return entries.some(entry=>{
  if(title!==T(entry,'title'))return false;
  if(entry.start&&entry.end)return years.includes(entry.start)&&years.includes(entry.end);
  if(entry.start&&years.includes(entry.start))return true;
  if(entry.as_of_date&&years.includes(entry.as_of_date))return true;
  return !years&&!(entry.start||entry.end);
 });
}
function profileReadingTimeline(p,entries=profileReadingEntries(p)){
 const history=entries.filter(e=>e.status!=='current').sort((a,b)=>(b.start||b.end||b.as_of_date||'').localeCompare(a.start||a.end||a.as_of_date||''));
 const bios=(p.bio||[]).filter(b=>!profileBioIsDuplicate(b,entries));
 if(!history.length&&!bios.length)return '';
 return `<section class="profile-reading-history"><h3>任职经历</h3>${history.map(e=>`<div class="profile-history-item">${profileReadingOffice(e)}</div>`).join('')}${bios.length?`<${history.length?'details':'div'} class="profile-bio-fragments">${history.length?'<summary>其他履历</summary>':''}<ol class="timeline">${bios.map(b=>{const date=T(b,'years'),single=/^\d{4}(?:[-.]\d{2}){0,2}$/.test(date);return `<li>${date?`<time>${single?'资料日期：':''}${esc(date)}</time>`:''}<p>${esc(T(b,'role'))}</p></li>`;}).join('')}</ol></${history.length?'details':'div'}>`:''}</section>`;
}
function profileEditorialSentence(text){return /as_of_date|source_ids|verification_status|不补造|不从职务推断|不用于推断|私人关系|任用原因|(?:三类|分别|分开)任职.*记录|尚待补充|尚未.*核|未(?:单独|逐一)核|不代表任期|起始日期.*核|资料.*(?:日期|时点).*不.*任期|公开履历.*(?:核验|交叉)|以.*(?:姓名|任职地区).*区分同名|身份按本包|个人级别.*(?:核|推断)|(?:未|不).*同名.*(?:合并|串联)|^本条|^按.*(?:精度|记录)|^这里|不能把.*任期|交叉核验/.test(text);}
function profileFocusText(p){const focus=T(p,'focus');return (Array.isArray(focus)?focus:focus?[focus]:[]).filter(t=>t!=null).map(String);}
function profileReadingDuties(p){
 const sentences=profileFocusText(p).flatMap(text=>text.split(/(?<=[。；;])/)).map(s=>s.trim()).filter(Boolean);
 const factual=sentences.filter(s=>!profileEditorialSentence(s));if(!factual.length)return '';
 const lead=factual[0],remaining=factual.slice(1),shortLead=lead.length>150?lead.slice(0,150)+'…':lead;
 return `<section class="profile-duties"><h3>${current(p).length?'职责与分工':'人物概览'}</h3><p>${esc(shortLead)}</p>${remaining.length||shortLead!==lead?`<details><summary>展开完整介绍</summary>${(shortLead!==lead?factual:remaining).map(s=>`<p>${esc(s)}</p>`).join('')}</details>`:''}</section>`;
}
function profileReadingFacts(p){
 const facts=(atlas.profile_facts||[]).filter(f=>f.person_id===p.id);if(!facts.length)return '';
 return `<section class="profile-facts"><h3>背景资料</h3><div class="fact-grid">${facts.map(f=>`<article class="profile-fact"><span class="mini-label">${esc(f.label||profileFactLabels[f.field]||f.field)}</span><p>${esc(f.value)}</p>${f.evidence_status!=='verified'?`<span class="badge profile-material-warning">${esc(f.evidence_status==='conflicting'?'来源冲突':'待核实')}</span>`:''}</article>`).join('')}</div></section>`;
}
function profileReadingIdentity(p){
 const others=[...new Set([...(p.possible_identity_ids||[]),...atlas.people.filter(other=>other.id!==p.id&&other.name===p.name).map(other=>other.id)])].map(person).filter(Boolean);
 if(!others.length)return '';
 return `<aside class="profile-material-warning profile-identity-warning"><strong>${p.possible_identity_ids?.length?'同名身份待核':'库内有同名人物'}</strong>${p.identity_note?`<p>${esc(p.identity_note)}</p>`:''}<div>${others.map(other=>`<button class="text-button" data-person="${esc(other.id)}">${esc(personLabel(other))} →</button>`).join('')}</div></aside>`;
}
function profileReadingReferences(p,entries){
 const facts=(atlas.profile_facts||[]).filter(f=>f.person_id===p.id),bios=p.bio||[],events=personStatusEvents(p.id);
 const sourceIds=[...new Set([...(p.source_ids||[]),...entries.flatMap(e=>e.source_ids),...bios.flatMap(b=>b.source_ids||[]),...facts.flatMap(f=>f.source_ids||[]),...events.flatMap(e=>e.source_ids||[])])];
 const rawFocus=profileFocusText(p),notes=entries.map(entry=>{const distinct=[...new Set(entry.records.flatMap(r=>[T(r,'note'),r.date_note,T(r,'rank_basis')]).filter(Boolean))];return `<details><summary>${esc(T(entry,'title'))}</summary>${entry.start?`<p>起任：${esc(entry.start)}</p>`:''}${entry.end?`<p>离任：${esc(entry.end)}</p>`:''}${entry.records.some(r=>r.announced_at)?`<p>任命公告：${esc(entry.records.find(r=>r.announced_at).announced_at)}</p>`:''}${entry.records.some(r=>r.ended_announced_at)?`<p>免职公告：${esc(entry.records.find(r=>r.ended_announced_at).ended_announced_at)}</p>`:''}${distinct.map(note=>`<p>${esc(note)}</p>`).join('')}${entry.source_ids.length?sources(entry.source_ids,true):''}</details>`;}).join('');
 return `<details class="profile-reference"><summary>资料与来源${sourceIds.length?' · '+sourceIds.length:''}</summary>${p.checked_at?`<p class="note">档案核对：${esc(p.checked_at)}</p>`:''}${p.identity_note?`<p>${esc(p.identity_note)}</p>`:''}${notes}${facts.length?`<details><summary>背景资料依据</summary>${facts.map(f=>`<h4>${esc(f.label||profileFactLabels[f.field]||f.field)}</h4><blockquote>${esc(f.evidence_excerpt||f.value)}</blockquote><p class="note">${f.as_of_date?'资料时点 '+esc(f.as_of_date)+' · ':''}核对 ${esc(f.reviewed_at||'日期未记录')}</p>${f.note?`<p>${esc(f.note)}</p>`:''}${sources(f.source_ids,true)}`).join('')}</details>`:''}${bios.length?`<details><summary>原始履历片段</summary>${bios.map(b=>`<p>${esc(T(b,'years'))} · ${esc(T(b,'role'))}</p>${sources(b.source_ids)}`).join('')}</details>`:''}${rawFocus.length?`<details><summary>完整人物说明</summary>${rawFocus.map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}${sourceIds.length?sources(sourceIds,true):''}</details>`;
}
function showPerson(id){
 const p=person(id);if(!p)return;
 const entries=profileReadingEntries(p),active=entries.filter(e=>e.status==='current'),places=directPlaces(personPlaces(id)),timeline=profileReadingTimeline(p,entries);
 const headerRoles=active.length?`<section class="profile-current-offices"><h3>现任职务</h3>${active.map(profileReadingOffice).join('')}</section>`:'';
 showDetail(`<article class="profile-reading">${profileHeading(p)}${profileReadingIdentity(p)}${headerRoles}${profileStatusHistory(p)}${!active.length?timeline:''}${profileReadingDuties(p)}${profileReadingFacts(p)}${places.length?`<div class="place-tags profile-reading-places">${places.map(pid=>`<button data-place="${esc(pid)}">${esc(place(pid)?.name||pid)}</button>`).join('')}</div>`:''}<div class="detail-actions profile-reading-actions"><button class="primary" data-network-person="${esc(id)}">关系与足迹</button><button data-person-map="${esc(id)}">职务图</button><button data-copy-person="${esc(id)}">分享人物</button><button data-ask="person:${esc(id)}">询问 AI</button></div>${active.length?timeline:''}<section class="profile-notes"><h3>我的笔记</h3><label for="person-note" class="sr-only">个人笔记</label><textarea id="person-note" placeholder="记下疑问、阅读联想或待核实的线索…">${esc(p.personal_note||'')}</textarea><div class="detail-actions"><button data-save-note="${esc(id)}">保存笔记</button>${isPublicAtlas()?'<small class="note">保存在此浏览器 · 可从“我的笔记”导出</small>':''}</div></section>${profileReadingReferences(p,entries)}</article>`,'person');
}
