const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(root+'/web/search.js','utf8'),data=JSON.parse(fs.readFileSync(root+'/data/atlas.json','utf8'));
let checks=0;
function test(name,run){run();checks++;console.log('ok '+name);}
function fixture(){
 const atlas=structuredClone(data),elements=new Map(),listeners=new Map(),calls=[];
 class Element{
  constructor(id){this.id=id;this.value='';this.hidden=true;this.attrs={};this.options=[];this.html='';this.scrolled=false;}
  set innerHTML(value){this.html=value;this.options=[...value.matchAll(/id="([^"]+)" class="search-option"/g)].map(m=>new Element(m[1]));}
  get innerHTML(){return this.html;}
  setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}
  querySelectorAll(){return this.options;}scrollIntoView(){this.scrolled=true;}focus(){calls.push(['focus',this.id]);}
 }
 const element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 ['search','search-suggestions','network-person-search','network-person-options','network-compare-search','network-compare-options','network-compare'].forEach(element);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const context=vm.createContext({atlas,$:element,esc,query:'',networkPerson:'xi-jinping',
  person:id=>atlas.people.find(p=>p.id===id),org:id=>atlas.institutions.find(o=>o.id===id),place:id=>atlas.locations.find(l=>l.id===id),
  inheritedPlaces:ids=>{const result=new Set(ids),todo=[...ids];while(todo.length){const parent=atlas.locations.find(l=>l.id===todo.pop())?.parent_id;if(parent&&!result.has(parent)){result.add(parent);todo.push(parent);}}return [...result].filter(id=>id!=='china');},
  mainRole:p=>(p.roles.find(r=>r.status==='current')||p.roles[0])?.title||'',
  personLabel:p=>p.name+(atlas.people.some(other=>other.id!==p.id&&other.name===p.name)?'（'+(p.birth_year?p.birth_year+'年生':p.roles[0]?.title||'')+'）':''),
  T:(o,key)=>o[key]||'',showPerson:id=>calls.push(['person',id]),showOrg:id=>calls.push(['org',id]),goNetwork:id=>calls.push(['center',id]),render:()=>calls.push(['render']),
  document:{addEventListener:(event,callback)=>{if(!listeners.has(event))listeners.set(event,[]);listeners.get(event).push(callback);}},console,
 });
 vm.runInContext(source,context);
 const run=s=>vm.runInContext(s,context);
 const fire=(type,event)=>{for(const callback of listeners.get(type)||[])callback(event);};
 const key=(id,key,extra={})=>{const event={target:element(id),key,preventDefault(){this.prevented=true;},...extra};context.event=event;run('searchKeydown(event)');return event;};
 const find=(value,options={})=>{context.searchValue=value;context.searchOptions=options;return run('searchDatabase(searchValue,searchOptions)');};
 return {atlas,context,element,calls,run,fire,key,find};
}

test('Liu Ruifeng resolves to the real database ID from every browsing context',()=>{
 const f=fixture();for(const route of ['map','people','regions','network','changes','guide']){Object.assign(f.context,{route,focus:'economy',peopleStatus:'historical',peoplePlace:'shanghai',peopleOrg:'pboc'});assert.equal(f.find('刘瑞峰')[0].id,'jining-206ab92a08a4');}
 assert(f.find('刘瑞峰')[0].record.roles.some(r=>r.org_id==='jining-urban-management'));
 f.context.searchValue='刘瑞峰';assert(f.run('drawSearchResults(searchValue)').includes('全库'));
});
test('aliases and token conjunction join real organizations to people',()=>{
 const f=fixture();for(const query of ['央行','PBOC']){const ids=f.find(query).map(r=>r.id);assert(ids.includes('pboc'));assert(ids.includes('pan-gongsheng'));}
 assert.equal(f.find('  刘瑞峰   城管 ')[0].id,'jining-206ab92a08a4');
 assert(f.find('济宁 城管',{kind:'person'}).some(r=>r.id==='jining-206ab92a08a4'));
 assert(!f.find('刘瑞峰 央行').length);
 assert(f.find('中组部',{kind:'org'}).some(r=>r.id==='cpc-organization-department'));
});
test('English case, spacing, punctuation and fullwidth input normalize consistently',()=>{
 const f=fixture();assert.equal(f.find('  XI   JINPING ')[0].id,'xi-jinping');assert.equal(f.find('Ｘｉ－Ｊｉｎｐｉｎｇ')[0].id,'xi-jinping');
 f.element('search').value='XI Jinping';f.key('search','Enter');assert.deepEqual(f.calls,[['person','xi-jinping']]);
});
test('homonyms remain separate IDs and Enter does not guess',()=>{
 const f=fixture(),rows=f.find('张海波',{kind:'person'}).filter(r=>r.name==='张海波');assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.id)).size,2);
 f.element('search').value='张海波';f.run("showSearchOptions('global')");const html=f.element('search-suggestions').innerHTML;assert(html.includes('1969'));assert(html.includes('1971'));
 f.key('search','Enter');assert.equal(f.calls.length,0);assert(f.element('search-suggestions').hidden);
});
test('every profile can be selected as center even without structured careers',()=>{
 const f=fixture(),p=f.atlas.people.find(p=>!f.atlas.career_posts.some(c=>c.person_id===p.id)&&f.atlas.people.filter(o=>o.name===p.name).length===1);assert(p);
 f.element('network-person-search').value=p.name;f.key('network-person-search','Enter');assert.deepEqual(f.calls,[['center',p.id]]);
});
test('index excludes personal notes, IDs, source IDs and review boilerplate',()=>{
 const f=fixture(),p=f.atlas.people.find(p=>p.name==='刘瑞峰');p.personal_note='私人暗号SecretNeedle';p.checked_at='ReviewOnlyNeedle';p.source_ids.push('SourceOnlyNeedle');p.roles[0].date_note='MachineNoteOnlyNeedle';
 for(const needle of ['私人暗号SecretNeedle','ReviewOnlyNeedle','SourceOnlyNeedle','MachineNoteOnlyNeedle','jining-206ab92a08a4','as_of_date'])assert.equal(f.find(needle).length,0,needle);
});
test('a career addition refreshes search text without indexing machine metadata',()=>{
 const f=fixture(),p=f.atlas.people.find(p=>p.name==='刘瑞峰');assert.equal(f.find('曾任公开机构甲').length,0);
 f.atlas.career_posts.push({id:'PrivatePostNeedle',person_id:p.id,title:'研究员',organization_name:'曾任公开机构甲',location_ids:['qingdao'],date_note:'PrivateReviewNeedle'});
 assert(f.find('曾任公开机构甲 青岛').some(r=>r.id===p.id));assert.equal(f.find('PrivatePostNeedle').length,0);assert.equal(f.find('PrivateReviewNeedle').length,0);
});
test('person-only place and English career titles are searchable',()=>{
 const f=fixture();f.atlas.people.push({id:'english-person',name:'无履历测试',name_en:'No Career Test',location_ids:['qingdao'],roles:[{title:'负责人',title_en:'Example Commissioner',status:'current'}]});
 assert.equal(f.find('无履历测试 青岛')[0].id,'english-person');assert.equal(f.find('Example Commissioner')[0].id,'english-person');
});
test('ArrowUp begins at the final option and Down wraps to the first',()=>{
 const f=fixture();f.element('search').value='刘';f.run("showSearchOptions('global')");const total=f.element('search-suggestions').options.length;assert(total>1);
 f.key('search','ArrowUp');assert.equal(f.run('searchSelection.global'),total-1);assert.equal(f.element('search').attrs['aria-activedescendant'],'search-suggestions-'+(total-1));assert(f.element('search-suggestions').options[total-1].scrolled);
 f.key('search','ArrowDown');assert.equal(f.run('searchSelection.global'),0);assert.equal(f.element('search-suggestions').options[0].attrs['aria-selected'],'true');
 const first=f.find('刘')[0].id;f.key('search','Enter');assert.deepEqual(f.calls,[['person',first]]);
});
test('Escape closes options without changing query or selected comparison identity',()=>{
 const f=fixture();f.element('network-compare-search').value='刘瑞峰';f.run("chooseSearchResult('compare','person','jining-206ab92a08a4')");f.run("showSearchOptions('compare')");
 f.key('network-compare-search','Escape');assert(f.element('network-compare-options').hidden);assert.equal(f.element('network-compare').value,'jining-206ab92a08a4');assert.equal(f.run('searchSelection.compare'),-1);
});
test('IME composition defers rendering and Enter until text is committed',()=>{
 const f=fixture();f.run('installSearch()');const input=f.element('search');input.value='刘瑞峰';
 f.fire('compositionstart',{target:input});f.fire('input',{target:input});f.key('search','Enter');assert.equal(f.calls.length,0);assert.equal(f.context.query,'');
 f.fire('compositionend',{target:input});assert.equal(f.context.query,'刘瑞峰');assert.deepEqual(f.calls,[['render']]);
 f.key('search','Enter',{isComposing:true});f.key('search','Enter',{keyCode:229});assert.equal(f.calls.length,1);
 f.key('search','Enter');assert.deepEqual(f.calls.at(-1),['person','jining-206ab92a08a4']);
});
test('comparison uses stable IDs and changing visible text clears the old selection',()=>{
 const f=fixture();f.context.networkPerson='zhang-haibo-shandong';const options=f.find('张海波',{kind:'person',exclude:f.context.networkPerson});assert.equal(options.length,1);assert.equal(options[0].id,'zhang-haibo-jining');
 f.run("chooseSearchResult('compare','person','zhang-haibo-jining')");assert.equal(f.element('network-compare').value,'zhang-haibo-jining');assert(f.element('network-compare-search').value.includes('1971'));
 f.element('network-compare-search').value='刘';f.run("updateSearchInput($('network-compare-search'))");assert.equal(f.element('network-compare').value,'');
 f.run("chooseSearchResult('compare','person','zhang-haibo-shandong')");assert.equal(f.element('network-compare').value,'');
 f.run("chooseSearchResult('compare','org','pboc')");assert.equal(f.element('network-compare').value,'');
});
test('missing IDs and invalid picker types never navigate',()=>{
 const f=fixture();for(const code of ["chooseSearchResult('global','person','missing')","chooseSearchResult('center','org','pboc')","chooseSearchResult('unrecognized','person','xi-jinping')","chooseSearchResult('global','guide','xi-jinping')"])f.run(code);assert.equal(f.calls.length,0);
});
test('result HTML and empty-state query escape public text',()=>{
 const f=fixture();f.atlas.people.push({id:'unsafe"id',name:'<script>BadName</script>',roles:[{status:'current',title:'<img src=x onerror=bad()>',org_id:'pboc'}]});
 f.context.searchValue='BadName';const html=f.run('drawSearchResults(searchValue)');assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('unsafe&quot;id'));
 f.context.searchValue='<img src=x onerror=QueryNeedle>';const empty=f.run('drawSearchResults(searchValue)');assert(!empty.includes('<img'));assert(empty.includes('没有找到'));
});
test('empty inputs show a concise hint and no invalid keyboard selection',()=>{
 const f=fixture();f.run("showSearchOptions('global')");assert(f.element('search-suggestions').innerHTML.includes('输入姓名'));f.key('search','ArrowUp');f.key('search','Enter');assert.equal(f.calls.length,0);assert.equal(f.run('searchSelection.global'),-1);
});
test('clearing global search resets the value and restores normal browsing',()=>{
 const f=fixture();f.context.query='刘瑞峰';f.element('search').value='刘瑞峰';f.context.button={dataset:{clearSearch:'true'}};assert(f.run('searchClick(button)'));assert.equal(f.context.query,'');assert.equal(f.element('search').value,'');assert.deepEqual(f.calls,[['render'],['focus','search']]);
});
console.log(checks+' search regression checks passed');
