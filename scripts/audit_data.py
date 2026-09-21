"""Check public referential integrity and role-level evidence before publication."""
import datetime,json
from pathlib import Path
from export_public import validate
from career_network import date_bounds, interval

def audit(data):
 validate(data)
 people={p['id']:p for p in data['people']};orgs={o['id']:o for o in data['institutions']};sources={s['id'] for s in data['sources']};places={l['id'] for l in data['locations']}
 for p in people.values():
  assert set(p.get('possible_identity_ids',[]))<=set(people),('unknown identity candidate',p['id'])
  for r in p['roles']:
   assert r.get('source_ids') and set(r['source_ids'])<=sources,(p['id'],'unsourced role')
   if r.get('verification_status'):
    assert r['verification_status'] in ['verified_current','directory_only','historical_only','verified_former','unverified','conflicting']
    if r['status']=='current':assert r['verification_status']=='verified_current' and r.get('as_of_date'),('undated current claim',p['id'])
    if r['verification_status'] in ['directory_only','unverified']:assert r['status']!='current',(p['id'],'unchecked current claim')
 for post in data['career_posts']:
  assert post['organization_id'] in orgs and set(post.get('location_ids',[]))<=places
  if post.get('is_current') and not post.get('end'):
   bounds=interval(post)
   if bounds:assert bounds[1]==date_bounds(post.get('as_of_date') or post.get('latest_confirmed_at') or post.get('current_evidence_date')),('interval exceeds independent evidence date',post['id'])
 for o in orgs.values():assert set(o.get('location_ids',[]))<=places
 for group in data.get('place_groups',[]):
  post_ids=set(group['post_ids']);actual={p['person_id'] for p in data['career_posts'] if p['id'] in post_ids};assert actual==set(group['person_ids'])
 return {'profiles':len(people),'institutions':len(orgs),'roles':sum(len(p['roles']) for p in people.values()),'sources':len(sources),'stored_links':len(data['career_links']),'large_place_groups':len(data.get('place_groups',[]))}
if __name__=='__main__':print(json.dumps(audit(json.loads((Path(__file__).resolve().parents[1]/'data/atlas.json').read_text())),ensure_ascii=False))
