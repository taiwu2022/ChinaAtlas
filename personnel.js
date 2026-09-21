'use strict';
let peopleEvent='all';
const statusCategoryLabels={office_change:'任职变动',party_discipline:'党纪处分',administrative_discipline:'政务处分',organization_action:'组织处理',military_status:'军籍与军衔',investigation:'审查调查',judicial:'司法进展',qualification:'代表与委员资格'};
const statusEvidenceLabels={verified:'原文已核',unverified:'待核实',conflicting:'来源有分歧'};
const statusActionLabels={appointed:'任命／当选',office_removed:'免去职务',resigned:'辞职获接受',retired:'退休',term_ended:'任期届满',transferred:'调任',deceased:'逝世',party_warning:'党内警告',serious_party_warning:'党内严重警告',party_posts_removed:'撤销党内职务',party_probation:'留党察看',expelled_party:'开除党籍',party_rights_restored:'恢复党员权利',administrative_warning:'政务警告',demerit:'政务记过',major_demerit:'政务记大过',demoted:'政务降级',administrative_removed:'政务撤职',dismissed_public_office:'开除公职',suspended:'停职检查',duties_adjusted:'调整职务',ordered_resignation:'责令辞职',organizational_removed:'组织免职',organizational_demoted:'组织降职',expelled_military:'开除军籍',rank_revoked:'取消军衔',retired_from_service:'退出现役',investigation_opened:'审查调查启动',investigation_closed:'审查调查结束',referred_for_prosecution:'移送审查起诉',prosecution_filed:'提起公诉',convicted:'法院定罪判决',acquitted:'无罪判决',case_dismissed:'撤案／撤诉',sentence_changed:'刑事裁判变更',qualification_terminated:'代表／委员资格终止',qualification_suspended:'代表／委员资格暂停',qualification_restored:'代表／委员资格恢复'};
function personStatusEvents(id){return (atlas.status_events||[]).filter(e=>e.person_id===id).sort((a,b)=>(b.announced_at||'').localeCompare(a.announced_at||'')||Object.keys(statusCategoryLabels).indexOf(a.category)-Object.keys(statusCategoryLabels).indexOf(b.category)||a.id.localeCompare(b.id));}
function supersededStatusIds(){return new Set((atlas.status_events||[]).filter(e=>e.evidence_status==='verified').flatMap(e=>e.supersedes_event_ids||[]));}
function activeStatusEvents(id){const superseded=supersededStatusIds();return personStatusEvents(id).filter(e=>e.evidence_status==='verified'&&e.source_ids?.length&&!superseded.has(e.id));}
function statusBadges(p){
 const events=activeStatusEvents(p.id);if(!events.length)return '';
 const date=events[0].announced_at,seen=new Set();
 const latest=events.filter(e=>e.announced_at===date&&!seen.has(e.code)&&seen.add(e.code));
 return `<span class="status-badges" aria-label="最新已录入变动">${latest.map(e=>`<span class="status-tag status-${esc(e.category)}" title="公告 ${esc(date)} · ${esc(statusCategoryLabels[e.category]||e.category)}">${esc(e.label)}</span>`).join('')}<small>公告 ${esc(date)}</small></span>`;
}
function matchesStatusEvent(p,value){
 if(value==='all')return true;
 const events=activeStatusEvents(p.id);
 if(value==='none')return personStatusEvents(p.id).length===0;
 if(value==='uncertain')return personStatusEvents(p.id).some(e=>e.evidence_status!=='verified');
 if(value.startsWith('category:'))return events.some(e=>e.category===value.slice(9));
 return events.some(e=>e.code===value);
}
function statusFilter(){
 const events=(atlas.status_events||[]).filter(e=>e.evidence_status==='verified'),codes=new Map();
 for(const e of events)if(!codes.has(e.code))codes.set(e.code,statusActionLabels[e.code]||e.label);
 return selectBox('people-event','已记录的变动',[['all','全部记录'],...Object.entries(statusCategoryLabels).filter(([k])=>events.some(e=>e.category===k)).map(([k,v])=>['category:'+k,v+' · 全部']),...[...codes].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN')),['uncertain','有待核实事件'],['none','尚无专门记录']],peopleEvent);
}
function profileStatusHistory(p){
 const events=personStatusEvents(p.id),replaced=supersededStatusIds();
 return `<section class="profile-status-history"><div class="section-title"><h3>任职变动与纪律司法记录</h3><button class="text-button" data-guide="personnel-status-labels">标签说明 →</button></div>${!events.length?'<p class="note">尚未录入专门记录。一般免职或离任不自动标为处分。</p>':`<p class="note compact-note">按公告时间排列；调查、处分和裁判分别记录。</p><div class="status-timeline">${events.map(e=>`<article class="status-event ${replaced.has(e.id)?'superseded':''}"><div class="status-event-heading"><time>公告 ${esc(e.announced_at||'日期待核')}</time><span>${esc(statusCategoryLabels[e.category]||e.category)} · ${esc(statusEvidenceLabels[e.evidence_status]||'待核实')}${replaced.has(e.id)?' · 已有明确更正记录':''}</span></div><h4>${esc(e.label)}</h4><p>${esc(e.description)}</p><details class="status-event-details"><summary>日期、程序与依据</summary>${e.procedure_note?`<p class="procedure-note">${esc(e.procedure_note)}</p>`:''}${e.effective_at?`<p class="note">决定／生效日期 ${esc(e.effective_at)}</p>`:''}${e.date_note?`<p class="note">${esc(e.date_note)}</p>`:''}${e.decision_authority?`<small>决定机关：${esc(e.decision_authority)}</small>`:''}${e.org_ids?.length?`<div class="status-orgs">${e.org_ids.map(id=>org(id)).filter(Boolean).map(o=>`<button class="text-button" data-org="${esc(o.id)}">${esc(o.name)} →</button>`).join('')}</div>`:''}${sources(e.source_ids,true)}</details></article>`).join('')}</div>`}</section>`;
}
function drawStatusUpdates(){
 const ids=[...new Set((atlas.status_events||[]).filter(e=>match(e)||match(person(e.person_id))).sort((a,b)=>(b.announced_at||'').localeCompare(a.announced_at||'')).map(e=>e.person_id))];
 if(!ids.length)return '';
 return `<section class="map-section status-updates"><div class="section-title"><h2>纪律司法与其他变动</h2><button class="text-button" data-guide="personnel-status-labels">标签说明 →</button></div><div class="person-grid">${ids.map(person).filter(Boolean).map(p=>`<button class="person-card" data-person="${esc(p.id)}"><h3>${esc(personLabel(p))}</h3>${statusBadges(p)}<span class="card-footer">查看变动过程与出处 →</span></button>`).join('')}</div></section>`;
}
