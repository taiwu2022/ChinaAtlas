'use strict';
let graphMode='dual',graphFocus='',graphRelation='all';
const relationClass=type=>['elects','appoints'].includes(type)?'selection':type==='party_leadership'?'party':['administrative_leadership','vertical_management'].includes(type)?'state':['coordinates','professional_guidance'].includes(type)?'coordination':'other';
function graphNode(id){if(!org(id))return '';return `<div class="flow-node" data-node="${esc(id)}">${orgCard(id,true)}<button class="connection-toggle" data-graph-focus="${esc(id)}">查看具体关系与依据 →</button></div>`;}
const down=(label,kind='selection')=>`<div class="flow-down ${kind}"><span>${esc(label)}</span><i aria-hidden="true">↓</i></div>`;
const siblingGroup=(title,ids)=>`<section class="flow-group"><h3>${esc(title)}</h3><div class="flow-siblings">${ids.map(graphNode).join('')}</div></section>`;
const flowColumn=(title,en,kind,body)=>`<section class="flow-column ${kind}"><header><h2>${esc(title)}</h2><small>${esc(en)}</small></header>${body}</section>`;
const branch=(title,body)=>`<section class="flow-branch"><h3>${esc(title)}</h3>${body}</section>`;
const branches=body=>`<div class="flow-branches">${body}</div>`;
const stateAgencyGroups=[['general','国务院办公厅'],['component','组成部门'],['special','直属特设机构'],['direct','直属机构'],['working','办事机构'],['public','直属事业单位']];
const partyAgencyGroups=[['general','综合部门与职能部门'],['dispatched','派出机关'],['coordination','决策议事协调机构及办事机构']];
function workingAgencyGroup(o,parent){
 if(o.parent_id!==parent||o.historical_only||/历史|示意/.test(o.level_label||''))return '';
 const label=o.level_label||'';
 if(parent==='state_council')return /^国务院办公厅/.test(label)?'general':/^国务院组成部门/.test(label)?'component':/^国务院直属特设机构/.test(label)?'special':/^国务院直属事业单位/.test(label)?'public':/^国务院直属机构/.test(label)?'direct':/^国务院办事机构/.test(label)?'working':'';
 if(parent==='central_committee')return /^党中央(?:综合部门|职能部门)/.test(label)?'general':/^党中央派出机关/.test(label)?'dispatched':/^党中央决策议事协调机构/.test(label)?'coordination':'';
 return '';
}
function workingAgencyChildren(id){
 return atlas.institutions.filter(o=>o.parent_id===id&&!o.historical_only&&!/历史|示意|分支机构/.test(o.level_label||'')&&atlas.relations.some(r=>r.from===id&&r.to===o.id&&['administrative_leadership','office_link'].includes(r.type)&&r.source_ids?.length));
}
function workingAgencyCard(id,trail=[]){
 const o=org(id);if(!o||trail.includes(id))return '';
 const ps=departmentPeople(id,'current'),children=workingAgencyChildren(id).filter(c=>!trail.includes(c.id));
 const roster=ps.map(p=>{const titles=[...new Set(departmentEntries(p,id,'current').map(r=>T(r,'title')))];return `<button data-person="${esc(p.id)}"><strong>${esc(personLabel(p))}</strong><span>${esc(titles.join(' · '))}</span></button>`;}).join('');
 return `<article class="working-agency" data-agency="${esc(id)}"><button class="working-agency-heading" data-org="${esc(id)}"><h4>${esc(o.name)}</h4><span>${esc(T(o,'level_label'))}</span></button>${o.duties?.length?`<p class="agency-remit">${esc(T(o,'duties')[0])}</p>`:''}<div class="agency-roster" aria-label="${esc(o.name)}已录入的现任资料">${roster||'<p class="agency-empty">现任人员待补充</p>'}</div><button class="agency-more text-button" data-view-org-people="${esc(id)}">本单位人物与履历 →</button>${children.length?`<div class="agency-children">${children.map(c=>{const r=atlas.relations.find(r=>r.from===id&&r.to===c.id&&['administrative_leadership','office_link'].includes(r.type)&&r.source_ids?.length);return `<div class="agency-child"><p class="agency-edge">↓ ${esc(T(r,'label'))}</p>${workingAgencyCard(c.id,[...trail,id])}</div>`;}).join('')}</div>`:''}</article>`;
}
function workingAgencies(parent){
 const groups=parent==='state_council'?stateAgencyGroups:partyAgencyGroups;
 const sections=groups.map(([key,label])=>{const os=atlas.institutions.filter(o=>workingAgencyGroup(o,parent)===key);return os.length?`<section class="agency-group" data-agency-group="${key}"><h3>${esc(label)}<small>${os.length} 个已录入机构</small></h3><div class="agency-grid">${os.map(o=>workingAgencyCard(o.id)).join('')}</div></section>`:'';}).join('');
 return `<div class="working-agencies" data-agency-root="${parent}">${sections}<p class="flow-caption">展示已核实机构分类与已录入的现任资料，尚非完整名册；点击姓名看任期与来源。</p></div>`;
}
function stateCouncilBranch(){return graphNode('state_council')+down('按机构性质展开；所属机关接受国务院领导','state')+workingAgencies('state_council');}
function drawMap(){
 if(query){const matches=atlas.institutions.filter(o=>match(o));return `<p class="note">找到 ${matches.length} 个机构与岗位</p><div class="org-grid">${matches.map(o=>orgCard(o.id)).join('')}</div>`;}
 let content='';
 if(graphMode==='dual'){
 const party=graphNode('party_congress')+down('全国代表大会分别选举')+branches(
  branch('中央委员会',graphNode('central_committee')+down('中央委员会全会分别选举')+siblingGroup('中央领导机构与岗位',['politburo','politburo_standing','general_secretary'])+`<p class="flow-caption">常委属于政治局成员，总书记须从常委中产生。三项均由中央全会选举，不是逐级选举。</p>`+siblingGroup('政治局及其常委会的办事机构',['central-secretariat'])+`<p class="flow-caption">以下按中央工作机关类型分组；不是书记处的下属部门。</p>`+workingAgencies('central_committee'))+
  branch('纪律检查机关',graphNode('ccdi')+`<p class="flow-caption">由党代会选举，在中央委员会领导下工作；不属于上述职能部门。</p>`));
 const state=graphNode('npc')+down('按法定职责分支；具体产生与监督程序见详情')+branches(
  branch('全国人大的常设机关',graphNode('npc_standing'))+
  branch('国家代表职务',graphNode('state-president'))+
  branch('行政机关',stateCouncilBranch())+
  branch('监察、审判与检察',siblingGroup('各自承担法定职责',['nsc','supreme_court','supreme_procuratorate'])));
 content=`<div class="flow-columns">${flowColumn('党的组织体系','Party institutions','party',party)}${flowColumn('国家机关体系','State institutions','state',state)}</div><section class="flow-separate"><div class="section-title"><h2>协商与军事体系</h2><span>单独理解其产生程序与职责</span></div><div class="org-grid">${graphNode('cppcc')}${graphNode('cmc')}</div><p class="note">政协是政治协商机构；军委节点合列党和国家两个军委，均不属于国务院行政体系。</p></section>`;
 }
 if(graphMode==='state')content=`<section class="state-agency-view"><div class="state-agency-intro"><h2>国务院与工作机关</h2><p>人民银行是组成部门；金融监管总局、证监会是直属机构。部委管理的国家局继续挂在主管部门下面。</p></div>${stateCouncilBranch()}</section>`;
 if(graphMode==='finance'){
 const party=graphNode('politburo_standing')+down('在中央政治局及其常委会领导下工作','party')+branches(
  branch('财经工作',graphNode('central_financial_economic_commission')+down('办事机构','party')+graphNode('central_financial_economic_office'))+
  branch('金融工作',graphNode('central_financial_commission')+down('办事机构','party')+graphNode('central_financial_office')+`<div class="joint-label">↔ 合署办公，分别承担职责</div>`+graphNode('central_financial_work_commission')+`<p class="flow-caption">金融工委是党中央派出机关；此处位置表示合署办公，不表示隶属中央金融办。</p>`));
 const state=graphNode('state_council')+down('组成部门、直属机构等，按职责展开','state')+branches(
  branch('发展规划与数据',graphNode('ndrc')+down('国家发展改革委管理','state')+graphNode('nda'))+
  branch('财政与税务',siblingGroup('按职责分组',['mof','sta']))+
  branch('央行与金融监管',siblingGroup('按职责分组',['pboc','nfra','csrc']))+
  branch('产业、贸易与国资',siblingGroup('按职责分组',['mofcom','miit','sasac'])))+
  `<section class="flow-separate"><h3>国务院任命的岗位</h3><p class="flow-caption">以下是任命关系；岗位的机构归属尚未核实。</p>${graphNode('trade_representative')}</section>`;
 content=`<div class="flow-columns">${flowColumn('党的经济与金融工作','Party direction','party',party)}${flowColumn('国家经济管理与监管','State implementation','state',state)}</div><section class="flow-separate"><h2>银行连接在哪里？</h2><div class="bank-links"><div><button data-org="pboc">人民银行</button><p>货币政策工具、准备金、央行贷款</p><span>↓</span></div><div><button data-org="nfra">金融监管总局</button><p>银行业监管与审慎监管</p><span>↓</span></div></div>${graphNode('commercial_banks')}<p class="note">监管与政策传导，不等于银行归央行所有。</p></section>`;
 }
 if(graphMode==='local')content=`<div class="flow-columns">${flowColumn('条：专业系统','Functional lines','state',graphNode('mof')+down('业务指导，以地方财政部门为例','coordination')+graphNode('local_bureau')+siblingGroup('垂直管理的另一种安排',['pboc'])+down('统一领导、管理派出机构','state')+graphNode('pboc_branch'))}${flowColumn('块：属地体系','Territorial organization','party',graphNode('local_party')+down('政治、思想和组织领导','party')+graphNode('local_government')+down('同级政府统一领导','state')+graphNode('local_bureau'))}</div><section class="flow-separate"><h2>地方扩展：从山东开始</h2><div class="org-grid">${['shandong-party','shandong-government'].map(graphNode).join('')}</div><button data-place="shandong">去人物关系网，看山东经历 →</button><p class="note">税务等系统还涉及双重领导。不同系统分别核对，不把一个范例套到所有部门。</p>${graphNode('local_tax')}</section>`;
 if(graphMode==='all')content=`<div class="org-grid">${atlas.institutions.filter(o=>!o.historical_only).map(o=>orgCard(o.id)).join('')}</div>`;
 return `<div class="map-shortcuts" aria-label="制度图视角">${[['dual','双轨总览'],['state','国务院机关'],['finance','经济金融'],['local','条条块块'],['all','全部机构']].map(([mode,title])=>`<button data-map-mode="${mode}" aria-pressed="${graphMode===mode}" class="${graphMode===mode?'selected':''}">${title}</button>`).join('')}</div>${graphMode==='state'?'':`<p class="note compact-note">箭头说明具体关系，卡片顺序不代表上下级。人员仅展示已录入的现任资料。</p>`}${content}`;
}
function connectionPanel(id){const o=org(id),relations=atlas.relations.filter(r=>r.from===id||r.to===id);return `<h2>${esc(o?.name||id)}</h2>${relations.map(r=>`<article class="connection-row"><button class="text-button" data-org="${esc(r.from)}">${esc(org(r.from)?.name||r.from)}</button><span> → ${esc(T(r,'label'))} → </span><button class="text-button" data-org="${esc(r.to)}">${esc(org(r.to)?.name||r.to)}</button>${sources(r.source_ids)}</article>`).join('')||'<p class="note">暂未录入具体关系。</p>'}`;}
function finishGraph(){} // Top-down connectors use the layout itself; no crossing SVG bundles.
function showPersonMap(id){const p=person(id),roles=current(p).length?current(p):p.roles;const groups=new Map();roles.forEach(r=>{if(!groups.has(r.org_id))groups.set(r.org_id,[]);groups.get(r.org_id).push(r);});showDetail(`<span class="pill">${current(p).length?'现任职务':'历史职务 · 不进入当前总览'}</span><h2 class="detail-title">${esc(p.name)} <small>${esc(p.name_en||'')}</small></h2><div class="person-role-network"><div class="ego-person">${esc(p.name)}</div><div class="ego-branches">${[...groups].map(([oid,rs])=>`<article><span class="ego-line">→</span><button class="text-button" data-org="${esc(oid)}">${esc(org(oid)?.name||oid)}</button><ul>${rs.map(r=>`<li>${esc(T(r,'title'))}${r.since?' · '+esc(r.since):''}${r.until?'—'+esc(r.until):''}</li>`).join('')}</ul></article>`).join('')}</div></div><button class="primary" data-network-person="${esc(id)}">继续看履历交集与地区足迹 →</button>`,'person');}
