"""Export the independent application without runtime data or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'ielts-path-source.zip'
DIRS={'app','components','db','drizzle','hooks','lib','scripts','public','docs','.github','vendor','build'}
FILES={'README.md','LICENSE','package.json','package-lock.json','vite.config.ts','worker.ts','wrangler.json','tsconfig.json','cloudflare-env.d.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs','components.json','.gitignore','.npmrc','.dev.vars.example','drizzle.config.ts'}
SKIP={'node_modules','.git','.wrangler','.sites-runtime','dist','.next','.vinext','outputs','__pycache__'}
GUIDES={'GUIA-INSTALACION.md':'guia-instalacion.md','METODOLOGIA.md':'metodologia.md','RESULTADOS-Y-LINKEDIN.md':'resultados-y-linkedin.md','INVESTIGACION.md':'investigacion.md','PRONUNCIACION-ED.md':'pronunciacion-ed.md','ALINEACION-IELTS.md':'alineacion-ielts.md'}
GUIDES['OXFORD-MAZO.md']='oxford-mazo.md'
def main():
 OUT.parent.mkdir(exist_ok=True)
 for src,dst in GUIDES.items():
  p=ROOT/'docs'/src
  if p.exists():
   text=p.read_text(encoding='utf-8-sig')
   for a,b in GUIDES.items():text=text.replace(']('+a+')',']('+b+')')
   text=text.replace('](../LICENSE)','](licencia.txt)')
   (OUT.parent/dst).write_text(text,encoding='utf-8')
 (OUT.parent/'licencia.txt').write_bytes((ROOT/'LICENSE').read_bytes())
 entries={}
 import os
 for folder,children,names in os.walk(ROOT):
  current=Path(folder)
  children[:]=[c for c in children if c not in SKIP and not (current/c).is_symlink() and (current!=ROOT or c in DIRS)]
  for filename in names:
   p=current/filename;relative=p.relative_to(ROOT);name=relative.as_posix()
   if p.is_symlink() or len(relative.parts)==1 and name not in FILES:continue
   if p.suffix in {'.zip','.log','.sqlite','.db','.sqlite3','.tsbuildinfo','.pyc','.key','.pem'}:continue
   if filename.startswith('.env') or filename.startswith('.dev.vars') and filename!='.dev.vars.example':continue
   data=p.read_bytes()
   if re.search(rb'appgprj_[a-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n|gh[pousr]_[A-Za-z0-9]{30,}',data):raise ValueError('Private identity or credential in '+name)
   if name=='wrangler.json':
    cfg=json.loads(data);cfg.pop('vars',None);cfg.pop('account_id',None)
    for db in cfg.get('d1_databases',[]):db['database_id']='00000000-0000-4000-8000-000000000000'
    data=(json.dumps(cfg,indent=2)+'\n').encode()
   entries[name]=data
 for required in ['worker.ts','wrangler.json','app/lib/auth.ts','drizzle/0002_independent_auth.sql','.github/workflows/ci.yml']:
  assert required in entries,required
 with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
  for name,data in sorted(entries.items()):z.writestr(name,data)
 with ZipFile(OUT) as z:assert z.testzip() is None
 print(f'Independent source archive verified: {len(entries)} files, {OUT.stat().st_size} bytes.')
 print('SHA-256: '+hashlib.sha256(OUT.read_bytes()).hexdigest())
if __name__=='__main__':main()
