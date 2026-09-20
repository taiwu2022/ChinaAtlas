"""Synthetic scale and evidence-date regression tests; no production data mutation."""
import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import career_network as n
class ExpansionTests(unittest.TestCase):
 def test_thousand_person_place_uses_linear_membership(self):
  d={'people':[{'id':str(i)} for i in range(1000)],'locations':[{'id':'city','parent_id':None}],'career_posts':[{'id':'p'+str(i),'person_id':str(i),'organization_id':'one-office','location_ids':['city'],'source_ids':['s'],'start':None,'end':None} for i in range(1000)]}
  self.assertEqual(n.build_network(d),[])
  groups=n.build_place_groups(d);self.assertEqual(len(groups),1);self.assertEqual(len(groups[0]['person_ids']),1000);self.assertLess(len(json.dumps(groups)),20000)
 def test_uncertain_directory_does_not_create_cowork(self):
  post={'start':None,'end':None,'is_current':False,'checked_at':'2026-09-21'}
  self.assertIsNone(n.overlap(post,post))
 def test_current_interval_stops_at_evidence_date(self):
  a={'start':'2024','end':None,'is_current':True,'checked_at':'2026-03-26'}
  b={'start':'2026-04-01','end':'2026-08-01'}
  self.assertIsNone(n.overlap(a,b))
 def test_explicit_evidence_date_overrides_later_retrieval(self):
  a={'start':'2024','end':None,'is_current':True,'checked_at':'2026-09-21','latest_confirmed_at':'2026-09-16'}
  b={'start':'2026-09-17','end':'2026-09-20'}
  self.assertIsNone(n.overlap(a,b))
 def test_unverified_lead_cannot_create_place_or_cowork_links(self):
  d={'people':[{'id':'a'},{'id':'b'}],'locations':[{'id':'city','parent_id':None}],'career_posts':[{'id':x,'person_id':x,'organization_id':'office','location_ids':['city'],'source_ids':['s'],'start':'2020','end':'2025','verification_status':'unverified' if x=='a' else 'historical_only'} for x in ['a','b']]}
  self.assertEqual(n.build_network(d),[])
  self.assertEqual(n.build_place_groups(d),[])
if __name__=='__main__':unittest.main()
