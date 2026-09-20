"""Validate curated official portraits before public builds; never guess an identity."""
import datetime,json,re
from urllib.parse import urlsplit
from export_public import BANNED,public_url
OFFICIAL_DOMAINS=('gov.cn','news.cn','xinhuanet.com','12371.cn','people.com.cn','cctvpic.com')
REQUIRED={'person_id','name','image_url','source_url','source_title','publisher','checked_at','identity_basis'}
OPTIONAL={'credit','credit_note','published_at','source_path_date','visual_check','width','height','http_status','mime_type','usage_note','verification_note'}
def official_url(url):
 try:
  p=urlsplit(url)
  return p.scheme=='https' and public_url(url) and not p.port and any(p.hostname==d or p.hostname.endswith('.'+d) for d in OFFICIAL_DOMAINS)
 except (ValueError,TypeError,AttributeError):return False

def validate_portraits(atlas,packet):
 assert isinstance(packet,dict) and set(packet)=={'schema_version','portraits'},'Unexpected portrait package'
 assert packet['schema_version']=='china-atlas-portraits-v1' and isinstance(packet['portraits'],list)
 assert not BANNED.search(json.dumps(packet,ensure_ascii=False)),'Private portrait metadata'
 people={p['id']:p for p in atlas['people']};seen=set();images=set()
 for row in packet['portraits']:
  assert isinstance(row,dict) and REQUIRED<=set(row)<=REQUIRED|OPTIONAL,'Unexpected portrait fields'
  assert all(isinstance(row[k],str) and row[k].strip() for k in REQUIRED),'Missing portrait provenance'
  pid=row['person_id'];assert pid in people and pid not in seen,'Unknown or duplicate portrait ID';seen.add(pid)
  assert row['name']==people[pid]['name'],'Portrait name does not match profile'
  assert row['image_url'] not in images,'One photograph assigned to different people';images.add(row['image_url'])
  assert official_url(row['image_url']) and official_url(row['source_url']),'Portrait must link to an HTTPS official source'
  datetime.date.fromisoformat(row['checked_at'])
  for key in ('published_at','source_path_date'):
   if row.get(key):
    date=row[key];assert re.fullmatch(r'\d{4}(?:-\d{2}){0,2}',date),'Invalid date precision'
    datetime.date.fromisoformat(date+{4:'-01-01',7:'-01',10:''}[len(date)])
  for key,value in row.items():
   if key in ('width','height','http_status'):assert type(value) is int and value>0,'Invalid portrait dimensions/status'
   else:assert value is None or isinstance(value,str),'Unexpected nested portrait value'
  if 'http_status' in row:assert row['http_status']==200
  if 'mime_type' in row:assert row['mime_type'] in ('image/jpeg','image/png','image/webp')
 return packet
