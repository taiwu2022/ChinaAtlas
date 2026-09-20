"""Build a dependency-free project-path-safe GitHub Pages site."""
import hashlib,json,shutil,tempfile,subprocess
from pathlib import Path
from export_public import validate,validate_evidence,BANNED
ROOT=Path(__file__).resolve().parents[1]
def build():
 data=json.loads((ROOT/'data/atlas.json').read_text());validate(data)
 validate_evidence(data,json.loads((ROOT/'data/evidence.json').read_text()))
 target=Path(tempfile.mkdtemp(prefix='china-atlas-build-'))
 allowed={'.html','.css','.js','.svg','.png','.webmanifest'}
 for p in (ROOT/'web').iterdir():
  if p.is_file() and p.suffix in allowed:shutil.copyfile(p,target/p.name)
 (target/'data').mkdir(exist_ok=True)
 for name in ['atlas.json','evidence.json']:shutil.copyfile(ROOT/'data'/name,target/'data'/name)
 digest=hashlib.sha256((target/'data/atlas.json').read_bytes()).hexdigest()[:12]
 (target/'site-config.js').write_text('window.ATLAS_CONFIG='+json.dumps({'mode':'public','dataVersion':digest})+';\n')
 (target/'.nojekyll').write_text('')
 for p in target.rglob('*'):
  if p.is_file() and p.suffix!='.png':assert not BANNED.search(p.read_text()),'Local/private reference in '+str(p.relative_to(target))
 assert './style.css' in (target/'index.html').read_text()
 try:revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 except subprocess.CalledProcessError:revision='uncommitted'
 (target/'build-info.json').write_text(json.dumps({'source_commit':revision,'data_version':digest})+'\n')
 output=ROOT/'site'
 if output.exists():shutil.rmtree(output)
 shutil.copytree(target,output,copy_function=shutil.copyfile)
 shutil.rmtree(target)
 print('Built site/; public data version '+digest)
if __name__=='__main__':build()
