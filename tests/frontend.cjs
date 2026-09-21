const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const el={addEventListener(){},value:'',close(){},open:false};
const ctx=vm.createContext({document:{getElementById:()=>el,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el},window:{addEventListener(){}},location:{hash:'#map'},console,URL,URLSearchParams,Set,Map,setTimeout,requestAnimationFrame(){}});
for(const f of ['portable.js','navigation.js','graph.js','registry-ui.js','network.js','regions.js','portraits.js','personnel.js','departments.js','search.js','profile.js','app.js'])vm.runInContext(fs.readFileSync(root+'/web/'+f,'utf8').replace(/boot\(\);\s*$/,''),ctx);
ctx.fixture=JSON.parse(fs.readFileSync(process.argv[2]||root+'/data/atlas.json','utf8'));if(!ctx.fixture.career_links){ctx.fixture.career_links=JSON.parse(require('node:child_process').execFileSync('/opt/homebrew/bin/python3',['-c','import json,sys;from network import build_network;print(json.dumps(build_network(json.load(sys.stdin))))'],{cwd:root,input:JSON.stringify(ctx.fixture),encoding:'utf8'}));}vm.runInContext('atlas=fixture',ctx);
const run=s=>vm.runInContext(s,ctx);let checks=0;const test=(s,expected)=>{assert.deepEqual(JSON.parse(JSON.stringify(run(s))),expected,s);checks++;};
test("band(person('lin-wu'))",'ministerial');test("band(person('zhou-naixiang'))",'ministerial');test("band(person('han-zheng'))",'national-unverified');
for(const id of ['deng-xiaoping','zhu-rongji','jiang-zemin','wang-qishan'])test(`band(person('${id}'))`,'historical');
test("mainRole(person('zhu-rongji'))",'前国务院总理（1998-03—2003-03）');
test("mainRole(person('lin-wu'))",'山东省委书记');
for(const mode of ['dual','state','finance','local','all']){run(`graphMode='${mode}';query=''`);const html=run('drawMap()');for(const id of ['deng-xiaoping','zhu-rongji','jiang-zemin','wang-qishan']){assert(!html.includes('data-person="'+id+'"'));checks++;}for(const m of html.matchAll(/data-node="([^"]+)"/g)){assert(ctx.fixture.institutions.some(o=>o.id===m[1]),m[1]);}}
run("peoplePlace='shandong'");test("[\"李干杰\",\"林武\",\"周乃翔\"].every(name=>drawPeople().includes(name))",true);
run("peoplePlace='all';peopleStatus='historical'");test("drawPeople().includes('朱镕基')",true);
run("focus='economy';peopleStatus='historical'");test("drawPeople().includes('朱镕基')",true);run("focus='all'");
run("networkPerson='xi-jinping';networkPlace='all';networkKind='all'");test("drawNetwork().includes('李强')",true);test("networkLinks('xi-jinping').some(l=>l.type==='co_service'&&l.to==='cai-qi')",false);
run("networkPerson='li-ganjie';networkPlace='shandong';networkKind='co_service'");test("networkLinks('li-ganjie').filter(l=>l.type==='possible_overlap').length",1);
test("T(atlas.guides.find(g=>g.id==='party_vs_state'),'title')",'党内决策与国家程序');
test("atlas.documents.length",0);
run("regionId='shandong';regionService='current';regionDepth='direct';query=''");test("drawRegions().includes('地方')||drawRegions().includes('林武')",true);test("regionPeople('shandong','current',false).some(p=>p.id==='li-ganjie')",false);

run("regionId='jining';regionService='current';regionDepth='direct';query=''");
test("regionPeople('jining','current',false).length >= 50",true);
test("regionPeople('jining','current',false).some(p=>p.id==='zhang-haibo-jining')",false);
test("regionPeople('weifang','past').some(p=>p.id==='guo-fei')",true);
test("personLabel(person('zhang-haibo-jining')).includes('1971')",true);
run("peoplePlace='jining';peopleRegionMode='current';peopleStatus='all';peopleOrg='all';peopleLevel='all';peopleTrack='all';query=''");
test("drawPeople().includes('data-person=\"zhang-haibo-jining\"')",false);
run("route='network';location.hash='#network';networkTrail=[];networkPerson='wen-jinrong';networkPlace='jining';networkKind='all';changeNetworkPerson('guo-fei')");
test("networkPlace",'jining');test("networkTrail[0].person",'wen-jinrong');test("drawNetwork().includes('返回 温金荣')",true);


run("regionDepth='direct'");test("regionPeople('jinan','past',false).some(p=>p.id==='yang-feng-jinan')",false);
run("regionDepth='all'");test("regionalCaption(person('sun-kailian'),'shandong','current')",'副省级城市岗位 · 个人级别待核');
run("networkKind='public_contact';networkPlace='qingdao'");test("networkLinks('zeng-zanrong').length",1);
run("networkPlace='jinan'");test("networkLinks('liu-qiang-jinan').length",1);
run("networkPlace='shandong'");test("networkLinks('wen-jinrong').length",2);
test("personLabel(person('zhang-haibo-shandong')).includes('1969')",true);
console.log(checks+' frontend/data regression checks passed');

for(const name of ['drawPublicChanges','drawPublicGuide']){const html=run(name+'()');assert(!html.includes('data-open-document'));assert(!html.includes('news/refresh'));}

// Large membership expansion retains exact source and profile navigation.
run("networkKind='same_place';networkPlace='jining'");
test("networkLinks('wen-jinrong').length > 400",true);
test("networkLinks('wen-jinrong').every(l=>l.source_ids.length && l.post_ids.length)",true);
test("findNetworkLink(networkLinks('wen-jinrong')[0].id).id === networkLinks('wen-jinrong')[0].id",true);
run("regionId='shanghai';regionDepth='direct';regionService='all';regionSector=regionVerification='all';query=''");
test("drawRegions().includes('data-person=\"xi-jinping\"')",true);
const unknown={id:'test-unknown',roles:[{status:'historical',title:'某局副局长',org_id:'jining-government',verification_status:'directory_only'}]};ctx.unknown=unknown;
test("band(unknown)",'uncertain');test("mainRole(unknown).startsWith('记录：')",true);
console.log('Expanded directory, status and lazy network regression checks passed');

// Field-level evidence remains visible, escaped and confined to regional exports.
test("profileFacts(person('wen-jinrong')).includes('北京大学')",true);
test("profileFacts(person('wen-jinrong')).includes('1996年7月')",true);
test("profileFacts(person('xi-jinping'))",'');
run("atlas.profile_facts.push({id:'unsafe-test',person_id:'wen-jinrong',field:'education',value:'<script>unsafe()</script>',evidence_status:'unverified',source_ids:[]})");
test("profileFacts(person('wen-jinrong')).includes('<script>unsafe()')",false);
test("profileFacts(person('wen-jinrong')).includes('未核实')",true);
run("atlas.profile_facts.pop();regionDepth='all';regionService='all';regionSector=regionVerification='all';query=''");
test("publicRegionExport('jining').profile_facts.length",33);
test("publicRegionExport('shanghai').profile_facts.length",0);
test("drawPublicGuide().includes('SOURCE_SEARCH_METHODS.md')",true);
console.log('Background facts, escaping and regional export checks passed');

// Unverified leads must never become a confirmed departure in cards or filters.
test("roleEvidence({status:'former',verification_status:'unverified'})",'unverified');
test("verificationSummary({roles:[{status:'historical',verification_status:'unverified'}]}).includes('线索待核')",true);
test("verificationSummary({roles:[{status:'historical',verification_status:'unverified'}]}).includes('已核离任')",false);
test("verificationSummary({roles:[]}).includes('已核离任')",false);
test("verificationSummary({roles:[{status:'former'}]}).includes('已核离任')",true);
// Pair lookup ignores the current browsing filters, and never fabricates a tie.
run("networkPlace='shanghai';networkKind='public_contact';query='no matching person'");
test("pairLinks('xi-jinping','li-qiang').some(l=>l.type==='co_service')",true);
test("pairLinks('xi-jinping','xi-jinping').length",0);
test("pairLinks('xi-jinping','missing-person').length",0);
test("pairLinks('wen-jinrong','guo-fei').some(l=>l.type==='same_place')",true);
test("comparisonBody('wen-jinrong','guo-fei').includes('同地不等于同期')",true);
test("profileCareerTimeline(person('wen-jinrong')).includes('任职时间轴')",true);
run("atlas.people.push({id:'empty-test',name:'<img src=x onerror=bad()>',roles:[],bio:[]})");
test("comparisonBody('empty-test','xi-jinping').includes('不能据此判断两人没有联系')",true);
test("comparisonBody('empty-test','xi-jinping').includes('<img src=x onerror=bad()>')",false);
run("atlas.people.pop();query='';networkPlace='all';networkKind='all'");
console.log('Evidence-state, pair comparison and profile timeline regression checks passed');

test("profileReadingOffice({title:'待核职务',status:'historical',records:[{status:'historical',verification_status:'unverified'}]}).includes('待核实')",true);

// Institutional classification is distinct from geography and broad parent grouping.
test("workingAgencyGroup(org('pboc'),'state_council')",'component');
test("workingAgencyGroup(org('nfra'),'state_council')",'direct');
test("workingAgencyGroup(org('csrc'),'state_council')",'direct');
test("workingAgencyGroup(org('sasac'),'state_council')",'special');
test("workingAgencyGroup(org('shandong-government'),'state_council')",'');
test("workingAgencyGroup(org('local_government'),'state_council')",'');
test("workingAgencyGroup(org('ministry-environment-protection-historical'),'state_council')",'');
test("workingAgencyGroup(org('ccdi'),'central_committee')",'');
test("workingAgencyGroup(org('cpc-organization-department'),'central_committee')",'general');
test("workingAgencyChildren('ndrc').some(o=>o.id==='nda')",true);
test("workingAgencyChildren('pboc').some(o=>o.id==='safe')",true);
test("workingAgencyGroup(org('safe'),'state_council')",'');
test("workingAgencyGroup(org('nbs'),'state_council')",'direct');
test("institutionInArea(org('safe'),'central')",true);
test("workingAgencyChildren('pboc').some(o=>o.id==='pboc_branch')",false);
test("workingAgencyChildren('central_financial_office').some(o=>o.id==='central_financial_work_commission')",false);
test("workingAgencyCard('pboc').includes('潘功胜') && workingAgencyCard('pboc').includes('行长')",true);
run("graphMode='dual';query=''");
test("drawMap().includes('data-agency=\"pboc\"') && drawMap().includes('data-agency=\"cpc-united-front-department\"')",true);
ctx.fixture.institutions.push({id:'test-unproven-child',name:'未核下级',parent_id:'pboc',level_label:'待核',duties:[]});
test("workingAgencyChildren('pboc').some(o=>o.id==='test-unproven-child')",false);
ctx.fixture.institutions.pop();
ctx.fixture.relations.unshift({from:'pboc',to:'safe',type:'administrative_leadership',label:'UNSOURCED WRONG LABEL',source_ids:[]});
test("workingAgencyCard('pboc').includes('UNSOURCED WRONG LABEL')",false);
ctx.fixture.relations.shift();
console.log('Working agency classification, sourced child links and visible role checks passed');

// Network and comparison careers keep evidence dates without routine metadata in the reading view.
test("displayPeriod({is_current:true})",'在任');
test("displayPeriod({start:'2000',status:'former'})",'2000 起 · 曾任');
test("displayPeriod({start:'2000',end:'2002'})",'2000 — 2002');
test("displayPeriod({start:'2000'})",'2000 起 · 历史记录 · 当前状态待核');
test("postCard({title:'职务',organization_name:'单位',is_current:true,as_of_date:'2026-05-21',date_note:'as_of_date metadata',source_ids:[]}).includes('<summary>资料与来源</summary><p class=\"note\">as_of_date metadata')",true);
test("postCard({title:'职务',organization_name:'单位',verification_status:'conflicting',source_ids:[]}).includes('来源冲突')",true);
console.log('Compact network career presentation checks passed');
