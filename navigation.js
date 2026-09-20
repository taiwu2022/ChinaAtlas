'use strict';
let restoringDetail=false,navigationReady=false,navigationRun=0,lastBaseRoute='',peopleFiltersOpen=null,restoringRoute=false;
const hashParts=()=>{const [page,...rest]=location.hash.slice(1).split('?');return {page:page||'people',params:new URLSearchParams(rest.join('?'))};};
function baseHash(){const {page,params}=hashParts();params.delete('view');params.delete('id');return '#'+page+(params.size?'?'+params:'');}
function captureReadingState(){return {query,focus,peopleLevel,peopleTrack,peopleStatus,peopleOrg,peoplePlace,peopleRegionMode,peopleFiltersOpen,peopleSector,peopleVerification,regionSector,regionVerification,regionId,regionService,regionDepth,networkPerson,networkPlace,networkKind,graphMode,graphRelation};}
function restoreReadingState(s){if(!s)return;s={peopleSector:'all',peopleVerification:'all',regionSector:'all',regionVerification:'all',...s};({query,focus,peopleLevel,peopleTrack,peopleStatus,peopleOrg,peoplePlace,peopleRegionMode,peopleFiltersOpen,peopleSector,peopleVerification,regionSector,regionVerification,regionId,regionService,regionDepth,networkPerson,networkPlace,networkKind,graphMode,graphRelation}=s);$('search').value=query;}
function rememberReadingPosition(){if(!navigationReady||restoringRoute)return;const note=$('person-note'),question=$('ask-question');history.replaceState({...history.state,atlasRoute:hashParts().page,atlasUI:captureReadingState(),atlasScroll:window.scrollY,atlasDetailScroll:$('detail').scrollTop,atlasOpenSections:Array.from($('detail-body')?.querySelectorAll?.('details')||[]).map((el,i)=>el.open?i:-1).filter(i=>i>=0),...(note?{noteDraft:note.value}:{}),...(question?{questionDraft:question.value}:{})},'',location.href);}
function navigateModal(kind,id,draw){
 if(restoringDetail){draw();return;}
 ++navigationRun;rememberReadingPosition();const {page,params}=hashParts();params.set('view',kind);params.set('id',id);
 history.pushState({atlasDepth:(history.state?.atlasDepth||0)+1,atlasRoute:page,atlasUI:captureReadingState()},'','#'+page+'?'+params);draw();
}
function openAtlasEvidence(id){navigateModal('evidence',id,()=>{showDetail('<p class="note">正在读取来源摘录…</p>','evidence');handleAtlasNavigation();});}
function closeAtlasDetail(){++navigationRun;rememberReadingPosition();if(history.state?.atlasDepth){history.go(-history.state.atlasDepth);}else{history.replaceState({},'',baseHash());$('detail').close();}}
function leaveDetailForRoute(hash,captured=false){if(!captured)rememberReadingPosition();if($('detail').open)$('detail').close();history.pushState({atlasDepth:0,atlasRoute:hash.split('?')[0],atlasUI:captureReadingState()},'','#'+hash);handleAtlasNavigation();}
async function handleAtlasNavigation(){
 const ticket=++navigationRun,{page,params}=hashParts(),base=baseHash();
 if(history.state?.atlasUI&&history.state.atlasRoute===page)restoreReadingState(history.state.atlasUI);
 else if(lastBaseRoute!==base){query='';$('search').value='';}
 lastBaseRoute=base;
 if(params.has('region')&&place(params.get('region')))regionId=params.get('region');
 if(page==='network'){
  if(params.has('center')&&person(params.get('center')))networkPerson=params.get('center');
  if(params.has('place'))networkPlace=place(params.get('place'))?params.get('place'):'all';
 }
 restoringRoute=true;try{render();}finally{restoringRoute=false;}
 const view=params.get('view'),id=params.get('id');
 try{
  const evidence=view==='evidence'?await api('evidence?id='+encodeURIComponent(id)):null;
  if(ticket!==navigationRun)return;
  restoringDetail=true;
  if(view==='person'&&person(id))showPerson(id);
  else if(view==='org'&&org(id))showOrg(id);
  else if(view==='guide'&&atlas.guides.some(g=>g.id===id))showGuide(id);
  else if(view==='document'&&!isPublicAtlas()&&atlas.documents.some(d=>d.id===id))showDocument(id);
  else if(view==='link'&&findNetworkLink(id))showLink(id);
  else if(view==='roles'&&person(id))showPersonMap(id);
  else if(view==='evidence')showEvidence(evidence);
  else if(view==='notes'&&isPublicAtlas())showDeviceNotes();
  else if(view==='ask'&&id){const [kind,pid]=id.split(':');if((kind==='person'?person(pid):org(pid)))showAsk(kind,pid);else $('detail').close();}
  else if(view==='add')showAddProfile();
  else if($('detail').open)$('detail').close();
 }catch(e){if(ticket===navigationRun){toast(e.message);if($('detail').open)$('detail').close();}}finally{if(ticket===navigationRun)restoringDetail=false;}
 if(ticket!==navigationRun)return;
 if(history.state?.atlasOpenSections){const sections=Array.from($('detail-body')?.querySelectorAll?.('details')||[]);sections.forEach((el,i)=>el.open=history.state.atlasOpenSections.includes(i));}
 if(history.state?.noteDraft!==undefined&&$('person-note'))$('person-note').value=history.state.noteDraft;
 if(history.state?.questionDraft!==undefined&&$('ask-question'))$('ask-question').value=history.state.questionDraft;
 requestAnimationFrame(()=>{if(ticket!==navigationRun)return;window.scrollTo(0,history.state?.atlasScroll||0);if($('detail').open)$('detail').scrollTop=history.state?.atlasDetailScroll||0;});
}
function installAtlasNavigation(){
 const wrap=(original,kind)=>(id)=>navigateModal(kind,id,()=>original(id));
 showPerson=wrap(showPerson,'person');showOrg=wrap(showOrg,'org');showGuide=wrap(showGuide,'guide');showDocument=wrap(showDocument,'document');showLink=wrap(showLink,'link');showPersonMap=wrap(showPersonMap,'roles');
 const evidence=showEvidence;showEvidence=e=>navigateModal('evidence',e.id,()=>evidence(e));
 const notes=showDeviceNotes;showDeviceNotes=()=>navigateModal('notes','device',notes);
 const ask=showAsk;showAsk=(kind,id)=>navigateModal('ask',kind+':'+id,()=>ask(kind,id));
 const add=showAddProfile;showAddProfile=()=>navigateModal('add','profile',add);
 navigationReady=true;
 const original=location.hash;if(hashParts().params.has('view')&&!history.state?.atlasDepth){history.replaceState({atlasDepth:0},'',baseHash());history.pushState({atlasDepth:1},'',original);}else if(!history.state)history.replaceState({atlasDepth:0},'',location.href);
 document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',rememberReadingPosition));
 $('detail').addEventListener('cancel',e=>{e.preventDefault();closeAtlasDetail();});
 window.addEventListener('popstate',handleAtlasNavigation);
 document.addEventListener('input',e=>{if(['person-note','ask-question'].includes(e.target.id))rememberReadingPosition();});
 document.addEventListener('toggle',e=>{if(e.target.id==='people-filters'){peopleFiltersOpen=e.target.open;rememberReadingPosition();}},true);
 handleAtlasNavigation();
}
function syncNetworkAddress(){if(!navigationReady||route!=='network')return;const p=hashParts().params;p.set('center',networkPerson);if(networkPlace!=='all')p.set('place',networkPlace);else p.delete('place');history.replaceState({...history.state},'','#network?'+p);}
async function navigationClick(b){
 if(b.id==='detail-back'){rememberReadingPosition();if(history.state?.atlasDepth)history.back();else closeAtlasDetail();return true;}
 if(b.dataset.copyPerson){const url=new URL(location.href);url.hash='people?view=person&id='+encodeURIComponent(b.dataset.copyPerson);try{if(navigator.share&&compactScreen())await navigator.share({title:person(b.dataset.copyPerson)?.name+' · China Atlas',url:url.href});else{await navigator.clipboard.writeText(url.href);toast('人物链接已复制。');}}catch(e){if(e.name!=='AbortError')toast('暂时无法分享，可复制浏览器地址。');}return true;}
 return false;
}
