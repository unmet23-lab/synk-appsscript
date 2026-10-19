#!/usr/bin/env python3
"""Bounded consistent snapshots of existing radio source/config and user's crontab."""
import hashlib,io,json,os,pathlib,stat,subprocess,sys,tarfile,datetime,pwd
ROOT=pathlib.Path('/opt/synk-radio')
EXCLUDED=['media and fonts','derived HLS playlists and transport-stream chunks','logs','cache and dependencies','temporary and partial files']
def need(v,c):
 if not v:raise RuntimeError(c)
def selected():
 result=[]
 for p in sorted(ROOT.rglob('*')):
  if p.is_symlink():continue
  if not p.is_file():continue
  rel=p.relative_to(ROOT)
  if any(x in ('node_modules','.git','__pycache__','.cache') for x in rel.parts):continue
  if p.stat().st_size>=5*1024*1024:continue
  suffix=p.suffix.lower()
  if suffix in ('.ts','.m3u8','.png','.jpg','.jpeg','.webp','.gif','.mp3','.wav','.m4a','.mp4','.ttf','.otf','.log','.tmp','.part') or '.flac' in p.name.lower() or '.woff' in p.name.lower():continue
  result.append(p)
 for unit in ('radio-bot','radio-live','radio-stream'):result.append(pathlib.Path('/etc/systemd/system')/(unit+'.service'))
 return sorted(result)
def cron():
 r=subprocess.run(['crontab','-u','synk','-l'],capture_output=True,timeout=20)
 need(r.returncode in (0,1),'RADIO_CRON_FAILED');need(r.returncode==0 or b'no crontab' in r.stderr,'RADIO_CRON_FAILED')
 return r.stdout
def identity(p):
 s=p.lstat();need(stat.S_ISREG(s.st_mode) and not s.st_mode&0o022 and s.st_nlink==1,'RADIO_SOURCE_UNSAFE')
 need(s.st_uid in (0,pwd.getpwnam('synk').pw_uid),'RADIO_SOURCE_OWNER')
 return [s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns,stat.S_IMODE(s.st_mode),s.st_uid,s.st_gid]
def capture():
 files=selected();payload={};records=[];before={};total=0
 for p in files:
  before[str(p)]=identity(p);data=p.read_bytes();need(before[str(p)]==identity(p),'RADIO_SOURCE_CHANGED');name=str(p).lstrip('/');payload[name]=data;total+=len(data);need(total<=64*1024*1024,'RADIO_SIZE_LIMIT')
  records.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':before[str(p)][5],'uid':before[str(p)][6],'gid':before[str(p)][7]})
 cronbody=cron();payload['crontab-synk.txt']=cronbody;records.append({'path':'crontab-synk.txt','bytes':len(cronbody),'sha256':hashlib.sha256(cronbody).hexdigest(),'mode':0o600,'uid':0,'gid':0});total+=len(cronbody)
 need(files==selected(),'RADIO_SOURCE_SET_CHANGED')
 for p in files:need(before[str(p)]==identity(p) and hashlib.sha256(p.read_bytes()).hexdigest()==hashlib.sha256(payload[str(p).lstrip('/')]).hexdigest(),'RADIO_SOURCE_CHANGED')
 need(cronbody==cron(),'RADIO_CRON_CHANGED')
 fp=hashlib.sha256(json.dumps(records,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return {'schemaVersion':1,'kind':'radio-recovery','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFingerprint':fp,'sourceBytes':total,'fileCount':len(records),'files':records,'sourceStable':True,'excluded':EXCLUDED,'restoreMode':'restore into isolated folder; do not start streams or apply crontab automatically'},payload
class Writer:
 def __init__(self):self.sha=hashlib.sha256();self.bytes=0
 def write(self,b):self.sha.update(b);self.bytes+=len(b);sys.stdout.buffer.write(b);return len(b)
 def flush(self):sys.stdout.buffer.flush()
try:
 manifest,payload=capture()
 if sys.argv[1]=='inspect':print(json.dumps(manifest))
 else:
  need(sys.argv[1]=='capture' and sys.argv[2]==manifest['sourceFingerprint'],'RADIO_SOURCE_CHANGED_SINCE_INSPECT')
  payload['manifest.json']=json.dumps(manifest,sort_keys=True).encode();writer=Writer()
  with tarfile.open(fileobj=writer,mode='w|',format=tarfile.PAX_FORMAT) as tar:
   for name,data in sorted(payload.items()):
    member=tarfile.TarInfo(name);member.size=len(data);member.mode=0o600;member.mtime=0;tar.addfile(member,io.BytesIO(data))
  writer.flush();print('RADIO_CAPTURE '+json.dumps({'manifest':manifest,'archiveBytes':writer.bytes,'archiveSha256':writer.sha.hexdigest()}),file=sys.stderr)
except Exception as e:
 print(str(e) if str(e).startswith('RADIO_') else 'RADIO_CAPTURE_FAILED',file=sys.stderr);sys.exit(1)
