'use strict';
// Reviewed source-page captions establish identity; photographs do not establish current office.
let portraitCatalog={};
async function loadPortraits(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
 try{
  const response=await fetch('./portraits.json',{cache:'no-cache',signal:controller.signal});
  if(!response.ok)return;
  const packet=await response.json();
  if(packet.schema_version!=='china-atlas-portraits-v1'||!Array.isArray(packet.portraits))return;
  portraitCatalog=Object.fromEntries(packet.portraits.map(photo=>[photo.person_id,photo]));
  refreshProfilePortrait();
 }catch{/* A missing catalogue must never block reading or notes. */}finally{clearTimeout(timer);}
}
function portraitFor(p){
 const photo=portraitCatalog[p.id];if(!photo||photo.name!==p.name)return null;
 try{const url=new URL(photo.image_url),source=new URL(photo.source_url);if(url.protocol!=='https:'||source.protocol!=='https:'||url.username||url.password||source.username||source.password)return null;}catch{return null;}
 return photo;
}
function portraitHTML(p){
 const photo=portraitFor(p);if(!photo)return '';
 return `<figure class="profile-portrait"><img data-profile-portrait="${esc(p.id)}" src="${esc(photo.image_url)}" alt="${esc(p.name)}的公开肖像" width="144" height="180" decoding="async" referrerpolicy="no-referrer"><figcaption><a href="${esc(photo.source_url)}" target="_blank" rel="noopener noreferrer" title="${esc(photo.source_title)}">照片来源 ↗</a>${photo.credit?`<small>${esc(photo.credit)}</small>`:''}</figcaption></figure>`;
}
function profileHeading(p){const subtitle=[p.name_en,p.birth_year?p.birth_year+'年生':''].filter(Boolean).join(' · ');return `<div class="profile-heading"><div class="profile-identity"><h2 class="detail-title">${esc(p.name)}</h2>${subtitle?`<p class="detail-subtitle">${esc(subtitle)}</p>`:''}</div><div class="portrait-slot" data-portrait-for="${esc(p.id)}">${portraitHTML(p)}</div></div>`;}
function refreshProfilePortrait(){
 const slot=document.querySelector('.portrait-slot[data-portrait-for]');if(!slot||!atlas)return;
 const p=person(slot.dataset.portraitFor);if(p)slot.innerHTML=portraitHTML(p);
}
document.addEventListener('error',event=>{const img=event.target;if(img.matches?.('img[data-profile-portrait]')){const slot=img.closest('.portrait-slot');if(slot)slot.hidden=true;}},true);
