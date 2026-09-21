'use strict';
let peopleBrowse='profiles',departmentGroup='all',departmentPlace='all',departmentId='all',departmentService='all';
let departmentIndexCache=null;
// Browsing groups are thematic indexes, never reporting lines or personal ranks.
const departmentGroups={discipline:'纪检监察',organization:'组织与人事',development:'发展改革',finance:'财政金融与银行',housing:'住建与住房',security:'公安司法与应急',other:'其他部门'};
const nationalDepartmentIds=new Set('party_congress central_committee politburo politburo_standing general_secretary npc npc_standing state_council cppcc cmc cpc-cmc state-cmc ccdi nsc supreme_court supreme_procuratorate central_financial_commission central_financial_work_commission nfra csrc pboc deepening_reform foreign_affairs mfa mof sta mofcom ndrc miit nda sasac central_financial_economic_commission central_financial_office central_financial_economic_office state-president central-secretariat cpc-organization-department cpc-publicity-department cpc-united-front-department cpc-general-office cpc-political-legal-commission central-state-organs-work-committee ministry-public-security foreign_affairs_office trade_representative aqsiq-product-quality-supervision cac mara moe moj natcm stma'.split(' '));
const centralDepartmentGroups={'cpc-organization-department':'organization','shandong-organization-department':'organization','shandong-party-organization':'organization','rizhao-organization':'organization',pboc_branch:'finance',commercial_banks:'finance',ccdi:'discipline',nsc:'discipline',organization_department:'organization',central_organization_department:'organization',ndrc:'development',mof:'finance',pboc:'finance',csrc:'finance',nfra:'finance',central_financial_commission:'finance',central_financial_office:'finance',central_financial_work_commission:'finance',central_financial_economic_commission:'finance',central_financial_economic_office:'finance',mohurd:'housing'};
function departmentGroupFor(o){
 if(centralDepartmentGroups[o.id])return centralDepartmentGroups[o.id];
 const sectors={discipline:'discipline',supervision:'discipline',organization:'organization',human_resources:'organization',development:'development',finance:'finance',banking:'finance',central_bank:'finance',financial_regulation:'finance',securities:'finance',financial_policy:'finance',housing:'housing',court:'security',procuratorate:'security',justice:'security',police:'security',emergency:'security',fire:'security'};
 return sectors[o.sector]||'other';
}
function departmentIndex(){
 const posts=atlas.career_posts||[];
 if(departmentIndexCache?.people===atlas.people&&departmentIndexCache.posts===posts&&departmentIndexCache.personCount===atlas.people.length&&departmentIndexCache.postCount===posts.length)return departmentIndexCache.index;
 const index=new Map(),people=new Map(atlas.people.map(p=>[p.id,p]));
 const add=(id,p,r)=>{if(!index.has(id))index.set(id,new Map());const group=index.get(id);if(!group.has(p.id))group.set(p.id,{person:p,entries:[]});group.get(p.id).entries.push(r);};
 for(const p of atlas.people)for(const r of p.roles)add(r.org_id,p,r);
 for(const post of posts){const p=people.get(post.person_id);if(!p)continue;const entries=index.get(post.organization_id)?.get(p.id)?.entries||[];if(!entries.some(r=>r.title===post.title&&r.status===careerStatus(post)))add(post.organization_id,p,{...post,status:careerStatus(post)});}
 departmentIndexCache={people:atlas.people,posts,personCount:atlas.people.length,postCount:posts.length,index};return index;
}
function departmentAccepts(status,mode){return mode==='all'||(mode==='current'?status==='current':mode==='past'?status==='former':!['current','former'].includes(status));}
function departmentEntries(p,id,mode='all'){return (departmentIndex().get(id)?.get(p.id)?.entries||[]).filter(r=>departmentAccepts(r.status,mode));}
function departmentPeople(id,mode='all'){return [...(departmentIndex().get(id)?.values()||[])].filter(row=>row.entries.some(r=>departmentAccepts(r.status,mode))).map(row=>row.person);}
function institutionInArea(o,id){return id==='all'||inheritedPlaces(o.location_ids||[]).includes(id)||(id==='central'&&nationalDepartmentIds.has(o.id));}
function departmentSearch(o,p){return !query||match(o)||(p?match(p)||departmentEntries(p,o.id).some(match):departmentPeople(o.id).some(p=>match(p)||departmentEntries(p,o.id).some(match)));}
function peopleBrowseTabs(){return `<div class="people-browse-tabs" role="group" aria-label="人物浏览方式"><button data-people-browse="profiles" class="${peopleBrowse==='profiles'?'selected':''}">人物名录</button><button data-people-browse="departments" class="${peopleBrowse==='departments'?'selected':''}">按部门找人</button></div>`;}
function departmentRosterCard(p,o){
 const entries=departmentEntries(p,o.id,departmentService);
 return `<article class="department-person"><button data-person="${esc(p.id)}"><h3>${esc(personLabel(p))}</h3>${entries.map(r=>`<p><span class="mini-label">${r.status==='current'?'现任资料':r.status==='former'?'明确曾任':'历史／待核'}</span> ${esc(T(r,'title'))}</p>`).join('')}${statusBadges(p)}</button><div class="department-card-actions"><button data-network-person="${esc(p.id)}">关系与足迹 ↔</button><button data-person="${esc(p.id)}">履历与依据 →</button></div></article>`;
}
function drawDepartments(){
 const all=atlas.institutions.filter(o=>departmentPeople(o.id).length),selected=departmentId!=='all'?org(departmentId):null;
 const choices=all.filter(o=>institutionInArea(o,departmentPlace)&&(departmentGroup==='all'||departmentGroupFor(o)===departmentGroup));
 const controls=`<div class="department-controls">${selectBox('department-place','地区',[['all','所有地区'],['central','中央及全国机构'],...localPlaces().map(l=>[l.id,l.name])],departmentPlace)}${selectBox('department-group','部门领域',[['all','全部部门'],...Object.entries(departmentGroups)],departmentGroup)}</div>`;
 const chips=`<div class="department-shortcuts" aria-label="常用部门领域">${[['all','全部'],...Object.entries(departmentGroups).filter(([id])=>id!=='other')].map(([id,label])=>`<button data-department-group="${id}" class="${departmentGroup===id?'selected':''}">${esc(label)}</button>`).join('')}</div>`;
 if(selected){
  const ps=departmentPeople(selected.id,departmentService).filter(p=>departmentSearch(selected,p)&&matchesStatusEvent(p,peopleEvent)).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  return `${peopleBrowseTabs()}<button class="text-button" data-department="all">← 部门目录</button><section class="department-heading"><div><span class="mini-label">${esc(departmentGroups[departmentGroupFor(selected)])}</span><h2>${esc(selected.name)}</h2><p class="note">${ps.length} 条人物档案 · 仅展示本单位的职务经历</p></div><button data-org="${esc(selected.id)}">机构职责与来源 →</button></section><div class="department-controls">${selectBox('department-service','本部门任职状态',[['all','全部已录入经历'],['current','本部门现任资料'],['past','本部门明确曾任'],['uncertain','历史／状态待核']],departmentService)}${statusFilter()}</div><div class="department-roster">${ps.map(p=>departmentRosterCard(p,selected)).join('')||'<p class="empty">当前筛选没有记录。</p>'}</div><p class="note compact-note">这是已收录资料，并非完整在职名单；同一人可出现在多个单位。</p>`;
 }
 const filtered=choices.filter(o=>departmentSearch(o));
 return `${peopleBrowseTabs()}${controls}${chips}<p class="note compact-note">${filtered.length} 个有档案的机构 · 点击看全部已录入人物</p><div class="department-grid">${filtered.map(o=>{const ps=departmentPeople(o.id),now=departmentPeople(o.id,'current');return `<button class="department-card" data-department="${esc(o.id)}"><span class="mini-label">${esc(departmentGroups[departmentGroupFor(o)])}</span><h3>${esc(o.name)}</h3><p>${ps.length} 条档案 · ${now.length} 位有本部门现任资料</p><span>查看人物 →</span></button>`;}).join('')||'<p class="empty">本地区暂无该类部门档案；可切换地区或继续补充。</p>'}</div>`;
}
function syncPeopleAddress(){
 if(!navigationReady||route!=='people')return;
 const params=hashParts().params;
 for(const [key,value] of [['browse',peopleBrowse==='departments'?'departments':null],['department',departmentId],['area',departmentPlace],['group',departmentGroup],['service',departmentService],['event',peopleEvent]]){
  if(value&&value!=='all')params.set(key,value);else params.delete(key);
 }
 history.replaceState({...history.state},'','#people'+(params.size?'?'+params:''));
}
function restorePeopleAddress(params){
 peopleBrowse=params.get('browse')==='departments'?'departments':'profiles';
 departmentId=org(params.get('department'))?params.get('department'):'all';
 departmentPlace=params.get('area')==='central'||place(params.get('area'))?params.get('area'):'all';
 departmentGroup=departmentGroups[params.get('group')]?params.get('group'):'all';
 departmentService=['current','past','uncertain'].includes(params.get('service'))?params.get('service'):'all';
 peopleEvent=params.get('event')||'all';
}
function goDepartment(id){
 rememberReadingPosition();peopleBrowse='departments';departmentId=id;departmentService='all';peopleEvent='all';query='';$('search').value='';
 const params=new URLSearchParams({browse:'departments'});if(id!=='all')params.set('department',id);
 if(departmentGroup!=='all')params.set('group',departmentGroup);if(departmentPlace!=='all')params.set('area',departmentPlace);
 leaveDetailForRoute('people?'+params,true);
}
function departmentClick(b){
 if(b.dataset.departmentRegion){departmentPlace=b.dataset.departmentRegion;departmentGroup='all';goDepartment('all');return true;}
 if(b.dataset.department){goDepartment(b.dataset.department);return true;}
 if(b.dataset.peopleBrowse){rememberReadingPosition();peopleBrowse=b.dataset.peopleBrowse;query='';$('search').value='';render();return true;}
 if(b.dataset.departmentGroup){departmentGroup=b.dataset.departmentGroup;departmentId='all';render();return true;}
 return false;
}
