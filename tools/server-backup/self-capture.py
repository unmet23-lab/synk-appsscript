#!/usr/bin/env python3
"""Recovery source/config of this backup service, encrypted by the parent only."""
import hashlib,io,json,pathlib,stat,sys,tarfile
def need(ok,code):
 if not ok:raise RuntimeError(code)
def selected():
 files=[]
 for root in ('/etc/synk-server-backup','/opt/synk-server-backup'):
  for p in sorted(pathlib.Path(root).iterdir()):
   need(not p.is_symlink(),'BACKUP_CONFIG_SYMLINK')
   if p.is_file() and not p.name.endswith(('.tmp','.install-tmp','.update-tmp')):files.append(p)
 for name in ('synk-server-backup.service','synk-server-backup.timer','synk-server-backup-watch.service','synk-server-backup-watch.timer'):
  p=pathlib.Path('/etc/systemd/system')/name
  if p.exists():files.append(p)
 return sorted(files)
def capture():
 chosen=selected();members={};records=[]
 for p in chosen:
  s=p.lstat();need(stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022 and s.st_size<2*1024*1024,'BACKUP_CONFIG_UNSAFE');data=p.read_bytes();name=str(p).lstrip('/');members[name]=data
  records.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':stat.S_IMODE(s.st_mode)})
 need(selected()==chosen,'BACKUP_CONFIG_CHANGED')
 for p in chosen:need(p.read_bytes()==members[str(p).lstrip('/')],'BACKUP_CONFIG_CHANGED')
 manifest={'format':'server-backup-runtime/v1','files':records,'fileCount':len(records),'sourceBytes':sum(r['bytes'] for r in records),'sourceFingerprint':hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest(),'restoreMode':'disabled timers; restore original public key and verify source account; never add a decryption private key to the server'}
 return manifest,members
class Writer:
 def __init__(self):self.sha=hashlib.sha256();self.bytes=0
 def write(self,b):self.sha.update(b);self.bytes+=len(b);sys.stdout.buffer.write(b);return len(b)
 def flush(self):sys.stdout.buffer.flush()
try:
 m,items=capture()
 if sys.argv[1]=='inspect':print(json.dumps(m))
 else:
  need(sys.argv[1]=='capture' and sys.argv[2]==m['sourceFingerprint'],'BACKUP_CONFIG_CHANGED')
  items['manifest.json']=json.dumps(m,sort_keys=True).encode();w=Writer()
  with tarfile.open(fileobj=w,mode='w|',format=tarfile.PAX_FORMAT) as tar:
   for name,b in sorted(items.items()):
    t=tarfile.TarInfo(name);t.size=len(b);t.mode=0o600;t.mtime=0;tar.addfile(t,io.BytesIO(b))
  w.flush();print('RUNTIME_CAPTURE '+json.dumps({'manifest':m,'archiveBytes':w.bytes,'archiveSha256':w.sha.hexdigest()}),file=sys.stderr)
except Exception as e:
 print(str(e) if str(e).startswith('BACKUP_') else 'BACKUP_CONFIG_CAPTURE_FAILED',file=sys.stderr);sys.exit(1)
