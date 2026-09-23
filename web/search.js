'use strict';
let searchIndexCache=null,searchInstalled=false;
const searchComposing=new Set(),searchSelection={global:-1,center:-1,compare:-1};
const searchNormalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const searchTokens=value=>String(value||'').normalize('NFKC').trim().split(/\s+/u).map(searchNormalize).filter(Boolean);
const searchAliases={pboc:'央行 人行 PBOC',ndrc:'发改委 NDRC',nfra:'金融监管总局 金监总局 NFRA',csrc:'证监会 CSRC',mof:'财政部 MOF',mofcom:'商务部 MOFCOM',safe:'外汇局 SAFE',nbs:'统计局 NBS',sasac:'国资委 SASAC',ccdi:'中纪委 中央纪委 CCDI','cpc-organization-department':'中组部 组织部','cpc-publicity-department':'中宣部 宣传部','cpc-united-front-department':'统战部'};
function institutionSearchText(o){
 const name=o.name||'',short=name.replace(/城市管理/g,'城管').replace(/发展和改革|发展改革/g,'发改').replace(/住房和城乡建设|住房城乡建设/g,'住建').replace(/纪律检查委员会/g,'纪委').replace(/监察委员会/g,'监委');
 return [name,o.name_en,short,searchAliases[o.id]||''].filter(Boolean).join(' ');
}
function atlasSearchIndex(){
 const posts=atlas.career_posts||[],locations=atlas.locations||[],count=atlas.people.length+atlas.institutions.length+posts.length+locations.length;
 if(searchIndexCache?.atlas===atlas&&searchIndexCache.people===atlas.people&&searchIndexCache.orgs===atlas.institutions&&searchIndexCache.posts===posts&&searchIndexCache.locations===locations&&searchIndexCache.count===count)return searchIndexCache;
 const orgs=new Map(atlas.institutions.map(o=>[o.id,o]));
 const postsByPerson=new Map();for(const post of posts){if(!postsByPerson.has(post.person_id))postsByPerson.set(post.person_id,[]);postsByPerson.get(post.person_id).push(post);}
 const locationText=ids=>[...inheritedPlaces(ids||[])].map(id=>place(id)?.name||'').join(' ');
 const institutions=atlas.institutions.map(o=>({kind:'org',id:o.id,name:o.name,record:o,nameKey:searchNormalize(o.name),text:searchNormalize([institutionSearchText(o),locationText(o.location_ids)].join(' '))}));
 const people=atlas.people.map(p=>{const career=postsByPerson.get(p.id)||[],units=[...new Set([...(p.roles||[]).map(r=>r.org_id),...career.map(r=>r.organization_id)])].map(id=>orgs.get(id)).filter(Boolean);
  const names=[p.name,p.name_en],titles=[...(p.roles||[]).flatMap(r=>[r.title,r.title_en]),...career.flatMap(r=>[r.title,r.title_en])],background=(p.bio||[]).flatMap(b=>[b.role,b.role_en]);
  return {kind:'person',id:p.id,name:p.name,record:p,nameKey:searchNormalize(p.name),englishKey:searchNormalize(p.name_en),text:searchNormalize([...names,...titles,...background,...units.map(institutionSearchText),...career.map(r=>r.organization_name),locationText([...(p.location_ids||[]),...units.flatMap(o=>o.location_ids||[]),...career.flatMap(r=>r.location_ids||[])])].join(' '))};
 });
 return searchIndexCache={atlas,people:atlas.people,orgs:atlas.institutions,posts,locations,count,peopleRows:people,orgRows:institutions};
}
function searchDatabase(value,{kind='all',exclude=''}={}){
 const tokens=searchTokens(value);if(!tokens.length)return [];
 const index=atlasSearchIndex(),needle=searchNormalize(value),rows=kind==='person'?index.peopleRows:kind==='org'?index.orgRows:[...index.peopleRows,...index.orgRows];
 return rows.filter(row=>row.id!==exclude&&tokens.every(t=>row.text.includes(t))).map(row=>({...row,score:row.nameKey===needle?1000:row.englishKey===needle?950:row.nameKey.startsWith(needle)?900:row.nameKey.includes(needle)?800:row.kind==='person'?400:300})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'zh-CN')||a.id.localeCompare(b.id));
}
function searchCaption(row){return row.kind==='person'?mainRole(row.record):T(row.record,'level_label');}
function searchResult(row){return `<button class="search-result" data-search-${row.kind}="${esc(row.id)}"><span><strong>${esc(row.kind==='person'?personLabel(row.record):row.name)}</strong><small>${esc(searchCaption(row))}</small></span><span aria-hidden="true">↗</span></button>`;}
function drawSearchResults(value){
 const rows=searchDatabase(value),people=rows.filter(r=>r.kind==='person'),orgs=rows.filter(r=>r.kind==='org');
 return `<section class="global-search-results"><div class="search-results-heading"><div><h2>搜索结果</h2><p>${people.length} 位人物 · ${orgs.length} 个机构 · 全库</p></div><button data-clear-search="true">清除搜索</button></div>${!rows.length?`<p class="empty">没有找到“${esc(value)}”。试试姓名的一部分、单位名称或简称。</p>`:''}${people.length?`<section><h3>人物</h3><div class="search-result-grid">${people.map(searchResult).join('')}</div></section>`:''}${orgs.length?`<section><h3>机构</h3><div class="search-result-grid">${orgs.map(searchResult).join('')}</div></section>`:''}</section>`;
}
const pickerConfig={global:{input:'search',list:'search-suggestions'},center:{input:'network-person-search',list:'network-person-options'},compare:{input:'network-compare-search',list:'network-compare-options'}};
function pickerKind(id){return Object.keys(pickerConfig).find(kind=>pickerConfig[kind].input===id);}
function personPicker(kind,label){const ids=pickerConfig[kind];return `<div class="person-picker"><label for="${ids.input}">${esc(label)}</label><input id="${ids.input}" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${ids.list}" autocomplete="off" placeholder="输入姓名或单位…"><div id="${ids.list}" class="person-options" role="listbox" aria-label="人物候选" hidden></div>${kind==='compare'?'<input id="network-compare" type="hidden" value="">':''}</div>`;}
function pickerRows(kind,value){return searchDatabase(value,{kind:kind==='global'?'all':'person',exclude:kind==='compare'?networkPerson:''}).slice(0,8);}
function hideSearchOptions(kind='global'){const ids=pickerConfig[kind],input=$(ids.input),list=$(ids.list);if(list)list.hidden=true;input?.setAttribute?.('aria-expanded','false');input?.removeAttribute?.('aria-activedescendant');searchSelection[kind]=-1;}
function showSearchOptions(kind){
 const ids=pickerConfig[kind],input=$(ids.input),list=$(ids.list);if(!input||!list||!atlas)return;
 const value=input.value,rows=pickerRows(kind,value);searchSelection[kind]=-1;
 list.innerHTML=rows.length?rows.map((row,i)=>`<button id="${ids.list}-${i}" class="search-option" role="option" aria-selected="false" tabindex="-1" data-search-pick="${kind}" data-pick-kind="${row.kind}" data-pick-id="${esc(row.id)}"><strong>${esc(row.kind==='person'?personLabel(row.record):row.name)}</strong><span>${esc(searchCaption(row))}</span></button>`).join(''):`<p class="search-hint">${value.trim()?'没有匹配的人物或机构。':'输入姓名、单位或简称；例如“刘瑞峰”“济宁 城管”“央行”。'}</p>`;
 list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
}
function chooseSearchResult(kind,type,id){
 if(!pickerConfig[kind]||!['person','org'].includes(type)||(kind!=='global'&&type!=='person')||(type==='person'&&!person(id))||(type==='org'&&!org(id))||(kind==='compare'&&id===networkPerson))return;
 hideSearchOptions(kind);
 if(kind==='center'){goNetwork(id);return;}
 if(kind==='compare'){$('network-compare').value=id;$('network-compare-search').value=personLabel(person(id));return;}
 if(type==='person')showPerson(id);else showOrg(id);
}
function searchClick(b){
 if(b.dataset.searchPick){chooseSearchResult(b.dataset.searchPick,b.dataset.pickKind,b.dataset.pickId);return true;}
 if(b.dataset.searchPerson){chooseSearchResult('global','person',b.dataset.searchPerson);return true;}
 if(b.dataset.searchOrg){chooseSearchResult('global','org',b.dataset.searchOrg);return true;}
 if(b.dataset.clearSearch){query='';$('search').value='';hideSearchOptions();render();$('search').focus?.();return true;}
 return false;
}
function updateSearchInput(input){
 const kind=pickerKind(input.id);if(!kind||!atlas)return;
 if(kind==='global'){const next=input.value.trim();if(query!==next){query=next;render();}}
 else if(kind==='compare'&&$('network-compare'))$('network-compare').value='';
 showSearchOptions(kind);
}
function searchKeydown(event){
 const kind=pickerKind(event.target.id);if(!kind||event.isComposing||event.keyCode===229||searchComposing.has(event.target.id))return;
 const ids=pickerConfig[kind],list=$(ids.list),rows=pickerRows(kind,event.target.value);
 if(!list)return;
 if(event.key==='Escape'){hideSearchOptions(kind);return;}
 if(['ArrowDown','ArrowUp'].includes(event.key)){
  if(!rows.length)return;event.preventDefault();if(list.hidden)showSearchOptions(kind);
  const step=event.key==='ArrowDown'?1:-1;searchSelection[kind]=searchSelection[kind]<0?(step>0?0:rows.length-1):(searchSelection[kind]+step+rows.length)%rows.length;
  const selected=searchSelection[kind],options=list.querySelectorAll('[role="option"]');options.forEach((el,i)=>el.setAttribute('aria-selected',String(i===selected)));options[selected]?.scrollIntoView?.({block:'nearest'});
  event.target.setAttribute('aria-activedescendant',ids.list+'-'+selected);return;
 }
 if(event.key==='Enter'){
  event.preventDefault();const index=searchSelection[kind],needle=searchNormalize(event.target.value),exact=rows.filter(row=>row.nameKey===needle||row.englishKey===needle);
  const row=index>=0&&!list.hidden?rows[index]:exact.length===1?exact[0]:null;
  if(row)chooseSearchResult(kind,row.kind,row.id);else if(kind==='global')hideSearchOptions();
 }
}
function installSearch(){
 if(searchInstalled)return;searchInstalled=true;
 document.addEventListener('compositionstart',e=>{if(pickerKind(e.target.id))searchComposing.add(e.target.id);});
 document.addEventListener('compositionend',e=>{if(pickerKind(e.target.id)){searchComposing.delete(e.target.id);updateSearchInput(e.target);}});
 document.addEventListener('input',e=>{if(!e.isComposing&&!searchComposing.has(e.target.id))updateSearchInput(e.target);});
 document.addEventListener('focusin',e=>{const kind=pickerKind(e.target.id);if(kind)showSearchOptions(kind);});
 document.addEventListener('focusout',e=>{const kind=pickerKind(e.target.id);if(kind&&!e.relatedTarget?.closest?.('#'+pickerConfig[kind].list))hideSearchOptions(kind);});
 document.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-search-pick]'))e.preventDefault();});
 document.addEventListener('click',e=>{for(const kind of Object.keys(pickerConfig))if(!e.target.closest?.('#'+pickerConfig[kind].input)&&!e.target.closest?.('#'+pickerConfig[kind].list))hideSearchOptions(kind);});
 document.addEventListener('keydown',searchKeydown);
}
