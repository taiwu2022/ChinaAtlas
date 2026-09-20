"""Export reviewed public facts from a local Atlas, never private storage or course materials."""
import argparse,copy,datetime,importlib,ipaddress,json,re,sys
from pathlib import Path
from urllib.parse import urlsplit

def fields(text):
 keys=text.split();return set(keys+[k+suffix for k in keys for suffix in ('_en','_zh')])
SCHEMAS={
 'people':fields('id name roles bio focus source_ids checked_at status historical tags profile_status location_ids birth_year birth_month identity_note'),
 'roles':fields('title org_id status since until rank rank_basis source_ids note office_band date_note checked_at current_evidence_date latest_confirmed_at first_observed_at announced_at ended_announced_at'),
 'bio':fields('years role source_ids date_note'),
 'institutions':fields('id name kind parent_id level_label duties authority limits source_ids location_ids territorial_level hierarchy_annotation'),
 'sources':fields('id url title published_at accessed_at source_type basis note evidence_summary availability_note'),
 'relations':fields('from to type label source_ids'),
 'career_posts':fields('id person_id organization_id organization_name location_ids start end title source_ids note start_precision end_precision is_current checked_at date_note interval_basis known_through end_by latest_confirmed_at status current_evidence_date'),
 'career_links':fields('id from to type start end precision_note organization_id organization_name post_ids location_ids source_ids label description date'),
 'person_connections':fields('id from to type label description date source_ids location_ids'),
 'events':fields('id date title person_ids org_ids description source_ids status announced_at effective_at'),
 'locations':fields('id name type parent_id'),
 'regional_coverage':fields('id location_id note'),
 'rank_mapping':fields('id sort_order label definition_source_ids usual_office_examples example_source_ids example_basis person_rank_rule'),
 'guides':fields('id title body source_ids learning_question historical_note')}
PUBLIC_GUIDES=set('read_edges party_vs_state rank_ladder rank_not_membership power_tools appointments tiaokuai vertical_contrast finance_map foreign_affairs_map joint_names budget_chain updates reading-career-networks researching-political-careers'.split())
BANNED=re.compile(r'/Users/|/home/|file://|127\.0\.0\.1|localhost|COMPANION_|API_KEY|BEGIN [A-Z ]*PRIVATE KEY|Oxford Political Summer Course',re.I)

def plain_value(value):
 return value is None or isinstance(value,(str,int,float,bool)) or (isinstance(value,list) and all(v is None or isinstance(v,(str,int,float,bool)) for v in value))

def clean_record(kind,record):
 result={}
 for k,v in record.items():
  if k not in SCHEMAS[kind] or (kind=='people' and k in ('roles','bio')):continue
  if not plain_value(v):raise ValueError('Unexpected nested value: '+kind+'.'+k)
  result[k]=copy.deepcopy(v)
 if kind=='people':
  result['roles']=[clean_record('roles',r) for r in record.get('roles',[])]
  result['bio']=[clean_record('bio',r) for r in record.get('bio',[])]
 return result

def source_ids(value):
 result=set()
 if isinstance(value,dict):
  for k,v in value.items():
   if k.endswith('source_ids'):result.update(v)
   else:result.update(source_ids(v))
 elif isinstance(value,list):
  for v in value:result.update(source_ids(v))
 return result

def public_url(url):
 parsed=urlsplit(url)
 if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:return False
 if parsed.hostname in ('localhost','localhost.localdomain') or parsed.hostname.endswith(('.local','.localhost')):return False
 try:return ipaddress.ip_address(parsed.hostname).is_global
 except ValueError:return True

def sanitize(data):
 out={'schema_version':'china-atlas-public-v1','public_edition':True,'verified_at':data.get('verified_at'),'documents':[]}
 for kind in SCHEMAS:
  if kind in ('roles','bio'):continue
  records=data.get(kind,[])
  if kind=='guides':records=[g for g in records if g.get('id') in PUBLIC_GUIDES and not g.get('course_refs')]
  out[kind]=[clean_record(kind,r) for r in records]
 for g in out['guides']:
  if g['id']=='updates':
   for k in list(g):
    if k.startswith('body'):del g[k]
   g['body']='网页展示最近一次发布时已经核对的资料。官方新公告可以从原始来源阅读；人物、职务和履历经过复核后，再发布新的数据版本。任命生效日、公告日和资料核对日分别保存。'
 out['caveats']=['精选公开资料库，尚非完整名册。','同地经历、同机构任期交集和公开活动分别记录，不推断私人关系。','以每条资料的核对日期为准；静态网站不会自行改变人物职务。']
 used=source_ids({k:v for k,v in out.items() if k!='sources'})
 out['sources']=[s for s in out['sources'] if s['id'] in used]
 validate(out)
 return out

def validate(data):
 assert not BANNED.search(json.dumps(data,ensure_ascii=False)), 'Private or local reference in public data'
 allowed_root=(set(SCHEMAS)-{'roles','bio'})|{'schema_version','public_edition','verified_at','documents','caveats'}
 assert set(data)<=allowed_root,'Unrecognized public top-level field'
 def validate_record(kind,record):
  allowed=SCHEMAS[kind]|({'has_local_evidence'} if kind=='sources' else set())
  assert set(record)<=allowed,'Unrecognized public field: '+kind
  if 'has_local_evidence' in record:assert isinstance(record['has_local_evidence'],bool),'Evidence flag must be boolean'
  clean_record(kind,record)
  if kind=='people':
   for child in ('roles','bio'):
    for entry in record.get(child,[]):validate_record(child,entry)
 for kind in SCHEMAS:
  if kind in ('roles','bio'):continue
  for record in data.get(kind,[]):validate_record(kind,record)
 assert not source_ids(data)-{s['id'] for s in data['sources']},'Source closure failed'
 assert all(public_url(s['url']) for s in data['sources']),'Non-public source URL'
 ids={k:{r['id'] for r in data[k]} for k in ['people','institutions','career_posts','locations']}
 for k,v in ids.items():assert len(v)==len(data[k]),'Duplicate '+k
 for p in data['people']:
  assert 'personal_note' not in p
  assert all(r['org_id'] in ids['institutions'] for r in p['roles'])
 for link in data['career_links']:
  assert {link['from'],link['to']}<=ids['people']
  assert set(link.get('post_ids',[]))<=ids['career_posts']
 for post in data['career_posts']:assert post['person_id'] in ids['people']
 assert not data['documents'] and not any(g.get('course_refs') for g in data['guides'])

def validate_evidence(data,evidence):
 source_map={s['id']:s for s in data['sources']}
 allowed={'id','title','url','published_at','accessed_at','event_date','evidence_excerpt','verified_facts'}
 assert isinstance(evidence,dict)
 for key,row in evidence.items():
  assert key in source_map and row.get('id')==key,'Unknown evidence source'
  assert set(row)<=allowed and all(isinstance(v,str) for v in row.values()),'Unexpected evidence fields'
  assert public_url(row['url']) and not BANNED.search(json.dumps(row,ensure_ascii=False)),'Private evidence reference'
  assert len(row.get('evidence_excerpt',''))<=501 and len(row.get('verified_facts',''))<=600,'Excerpt too long'
 assert all(not s.get('has_local_evidence') or s['id'] in evidence for s in data['sources']),'Missing flagged evidence'

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data');args=ap.parse_args()
 sys.path.insert(0,str(args.source.resolve()));Registry=importlib.import_module('registry').Registry
 merged=Registry(args.source,args.source/'data').view();data=sanitize(merged);evidence={}
 for s in data['sources']:
  path=args.source/'research/evidence'/(s['id']+'.json')
  if not path.is_file():continue
  raw=json.loads(path.read_text());e={k:raw[k] for k in ['id','title','url','published_at','accessed_at','event_date'] if k in raw and isinstance(raw[k],str)}
  excerpt=raw.get('evidence_excerpt');facts=raw.get('verified_facts') or raw.get('basis')
  if isinstance(excerpt,list):excerpt='\n'.join(excerpt)
  if isinstance(facts,list):facts='\n'.join(facts)
  if isinstance(excerpt,str):e['evidence_excerpt']=excerpt[:500]+('…' if len(excerpt)>500 else '')
  if isinstance(facts,str):e['verified_facts']=facts[:600]
  if not BANNED.search(json.dumps(e,ensure_ascii=False)) and public_url(e.get('url','')):
   evidence[s['id']]=e;s['has_local_evidence']=True
 validate_evidence(data,evidence)
 args.output.mkdir(parents=True,exist_ok=True)
 for name,obj in [('atlas',data),('evidence',evidence)]:
  path=args.output/(name+'.json');temp=path.with_suffix('.tmp');temp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
 print(json.dumps({'people':len(data['people']),'career_posts':len(data['career_posts']),'sources':len(data['sources']),'evidence':len(evidence)},ensure_ascii=False))
