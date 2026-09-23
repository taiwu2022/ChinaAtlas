import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from portraits import validate_portraits
class PortraitTests(unittest.TestCase):
 def setUp(self):
  self.atlas=json.loads((ROOT/'data/atlas.json').read_text())
  self.packet=json.loads((ROOT/'data/portraits.json').read_text())
 def test_reviewed_catalogue_and_seven_principals(self):
  validate_portraits(self.atlas,self.packet)
  self.assertTrue({'xi-jinping','li-qiang','zhao-leji','wang-huning','cai-qi','ding-xuexiang','li-xi'}<={p['person_id'] for p in self.packet['portraits']})
 def test_identity_mismatch_and_duplicate_image_rejected(self):
  for change in ['name','person_id','image']:
   with self.subTest(change=change):
    p=copy.deepcopy(self.packet)
    if change=='image':p['portraits'][1]['image_url']=p['portraits'][0]['image_url']
    else:p['portraits'][0][change]='unverified-person'
    with self.assertRaises(AssertionError):validate_portraits(self.atlas,p)
 def test_private_metadata_and_untrusted_urls_rejected(self):
  for field,value in [('personal_note','secret'),('image_url','https://localhost/portrait.jpg'),('source_url','https://www.news.cn.example.test/person'),('image_url','javascript:alert(1)'),('identity_basis',{'private_note':'hidden'})]:
   with self.subTest(field=field,value=value):
    p=copy.deepcopy(self.packet);p['portraits'][0][field]=value
    with self.assertRaises(AssertionError):validate_portraits(self.atlas,p)
 def test_missing_photo_is_optional(self):
  validate_portraits(self.atlas,{'schema_version':'china-atlas-portraits-v1','portraits':[]})
if __name__=='__main__':unittest.main()
