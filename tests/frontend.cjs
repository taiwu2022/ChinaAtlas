const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const el={addEventListener(){},value:'',close(){},open:false};
const ctx=vm.createContext({document:{getElementById:()=>el,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>el},window:{addEventListener(){}},location:{hash:'#map'},console,URL,URLSearchParams,Set,Map,setTimeout,requestAnimationFrame(){}});
for(const f of ['portable.js','navigation.js','graph.js','registry-ui.js','network.js','regions.js','app.js'])vm.runInContext(fs.readFileSync(root+'/web/'+f,'utf8').replace(/boot\(\);\s*$/,''),ctx);
ctx.fixture=JSON.parse(fs.readFileSync(process.argv[2]||root+'/data/atlas.json','utf8'));if(!ctx.fixture.career_links){ctx.fixture.career_links=JSON.parse(require('node:child_process').execFileSync('/opt/homebrew/bin/python3',['-c','import json,sys;from network import build_network;print(json.dumps(build_network(json.load(sys.stdin))))'],{cwd:root,input:JSON.stringify(ctx.fixture),encoding:'utf8'}));}vm.runInContext('atlas=fixture',ctx);
const run=s=>vm.runInContext(s,ctx);let checks=0;const test=(s,expected)=>{assert.deepEqual(JSON.parse(JSON.stringify(run(s))),expected,s);checks++;};
test("band(person('lin-wu'))",'ministerial');test("band(person('zhou-naixiang'))",'ministerial');test("band(person('han-zheng'))",'national-unverified');
for(const id of ['deng-xiaoping','zhu-rongji','jiang-zemin','wang-qishan'])test(`band(person('${id}'))`,'historical');
test("mainRole(person('zhu-rongji'))",'前国务院总理（1998-03—2003-03）');
test("mainRole(person('lin-wu'))",'山东省委书记');
for(const mode of ['dual','finance','local','all']){run(`graphMode='${mode}';query=''`);const html=run('drawMap()');for(const id of ['deng-xiaoping','zhu-rongji','jiang-zemin','wang-qishan']){assert(!html.includes('data-person="'+id+'"'));checks++;}for(const m of html.matchAll(/data-node="([^"]+)"/g)){assert(ctx.fixture.institutions.some(o=>o.id===m[1]),m[1]);}}
run("peoplePlace='shandong'");test("[\"李干杰\",\"林武\",\"周乃翔\"].every(name=>drawPeople().includes(name))",true);
run("peoplePlace='all';peopleStatus='historical'");test("drawPeople().includes('朱镕基')",true);
run("focus='economy';peopleStatus='historical'");test("drawPeople().includes('朱镕基')",true);run("focus='all'");
run("networkPerson='xi-jinping';networkPlace='all';networkKind='all'");test("drawNetwork().includes('李强')",true);test("networkLinks('xi-jinping').some(l=>l.type==='co_service'&&l.to==='cai-qi')",false);
run("networkPerson='li-ganjie';networkPlace='shandong';networkKind='co_service'");test("networkLinks('li-ganjie').filter(l=>l.type==='possible_overlap').length",2);
test("T(atlas.guides.find(g=>g.id==='party_vs_state'),'title')",'党内决策与国家程序');
test("atlas.documents.length",0);
run("regionId='shandong';regionService='current';regionDepth='direct';query=''");test("drawRegions().includes('地方')||drawRegions().includes('林武')",true);test("regionPeople('shandong','current',false).some(p=>p.id==='li-ganjie')",false);

run("regionId='jining';regionService='current';regionDepth='direct';query=''");
test("regionPeople('jining','current',false).length",9);
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
