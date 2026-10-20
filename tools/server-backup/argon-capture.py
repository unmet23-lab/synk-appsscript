import sys
MODE=sys.argv[1]
EXPECTED=sys.argv[2] if len(sys.argv)>2 else None
import sys,os,json,pathlib,stat,pwd,hashlib,subprocess,datetime,tarfile,io
H=pathlib.Path('/var/lib/synk-argon-77yuhbs')
# Approved role->Doc mapping. It must equal tools/argon-schedules/configuration/docs.json
# (backup.test.cjs checks it); an approved role change redeploys this file with docs.json.
EXPECTED_DOCS={"full":"10LfWPhwWO1Lzk8V_HddA0a5vVNJ0NVQXZgNyUplcwvk","yt-tt":"1aYwO_1qBcUs5uzeeRoeePBRo_qkWSFBwjr4Xj-LUXmI","meta-brand":"1YTHEzSzgdm76sXUz5hEbwdTiOse575D3_malZz8LWwQ","synkbrief":"16boBqiExm-qjCof8SQsEEpF2-5ckmK27Bc2kxKiFYwM","scan-lab":"1BoDuzB3y8SeCZiPdNu85ycBCRsAWselzsrwe50pN_Ak","scan-ai":"1CZnqJ79Y0rhfrDLmuUwfWzKtwrIzcFLY6ZqfW0Xw8so","scan-platform":"1Z5AVMaA6sgllAE0RSHpN5zE_tN7XgrehHt1giwMTDmo"}
ROLES=tuple(EXPECTED_DOCS)
EXCLUDED=['logs and mutable work outputs','run.lock and all temporary/partial files','CLI conversations SQLite, generated brain and caches','gws token_cache and discovery cache','CLI binaries and re-downloadable dependencies','smoke/old repair prompts and readiness markers','alert delivery outbox (owned by independent live alert service)']
def require(v,c):
 if not v:raise RuntimeError(c)
def instant():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def services():
 out={}
 for role in ROLES:
  p=subprocess.run(['systemctl','show','synk-argon-ultra-'+role+'.service','-p','ActiveState','-p','SubState','-p','Result'],capture_output=True,text=True,timeout=15)
  require(p.returncode==0,'ARGON_SERVICE_READ_FAILED')
  value=dict(line.split('=',1) for line in p.stdout.splitlines() if '=' in line)
  require(value.get('ActiveState') in ('inactive','failed'),'ARGON_SERVICE_BUSY')
  out[role]=value
 return out
def safe_file(p,uid,private):
 for parent in [p,*p.parents]:require(not parent.is_symlink(),'ARGON_SOURCE_LINK')
 s=p.lstat();require(stat.S_ISREG(s.st_mode) and s.st_nlink==1,'ARGON_SOURCE_NOT_REGULAR')
 require(s.st_uid==uid and not stat.S_IMODE(s.st_mode)&(0o077 if private else 0o022),'ARGON_SOURCE_PERMISSIONS')
 require(s.st_size<=16*1024*1024,'ARGON_SOURCE_TOO_LARGE')
 return s
def selected(uid):
 out=[]
 def add(p,private=True,owner=None):
  safe_file(p,uid if owner is None else owner,private);out.append((p,private,uid if owner is None else owner))
 for directory in ('docs-backups','docs-backup','run-status'):
  base=H/directory;require(base.is_dir() and not base.is_symlink(),'ARGON_SOURCE_DIRECTORY_MISSING')
  for p in sorted(base.rglob('*.json')):
   relative=p.relative_to(base)
   require(len(relative.parts)<=2 and (len(relative.parts)==1 or directory=='run-status' and relative.parts[0]=='history'),'ARGON_UNEXPECTED_STATE_LAYOUT')
   if p.name.startswith('.') or p.name.endswith('.tmp.json'):continue
   add(p)
 for role in ROLES:add(H/'prompts'/(role+'.input.jsonl'))
 for role in ROLES:
  # The first three human-readable prompts are required; later roles' copies are kept when present.
  p=H/'prompts'/(role+'.prompt.txt')
  if role in ('full','yt-tt','meta-brand') or p.exists():add(p)
 add(H/'work'/'yt-tt-format-repair-receipt-20261018.json')
 for relative in ('.config/gws-docs/client_secret.json','.config/gws-docs/credentials.enc','.config/gws-docs/.encryption_key','.gemini/antigravity-cli/antigravity-oauth-token','.gemini/antigravity-cli/settings.json','.gemini/antigravity-cli/jetski_state.pbtxt','.gemini/antigravity-cli/installation_id','.gemini/config/projects/default-cli-project.json'):
  add(H/relative)
 add(pathlib.Path('/etc/synk-argon-77yuhbs/docs.json'),False,0)
 # Capture readiness only as evidence; RESTORE.json forbids restoring it active.
 add(pathlib.Path('/etc/synk-argon-77yuhbs/production-ready'),True,0)
 for role in ROLES:
  for suffix in ('service','timer'):add(pathlib.Path('/etc/systemd/system')/('synk-argon-ultra-'+role+'.'+suffix),False,0)
 add(pathlib.Path('/etc/systemd/system/synk-argon-ultra.slice'),False,0)
 for name in ('docs-io.py','docs-io-test.py','run-check.py','alert-event.py'):add(pathlib.Path('/opt/synk-argon-77yuhbs')/name,False,0)
 for name in ('creative-research.mjs','organization.mjs','validate-report.mjs','manifest.json'):add(pathlib.Path('/opt/synk-argon-77yuhbs/report-contract')/name,False,0)
 return sorted(out,key=lambda x:str(x[0]))
def identity(s):return [s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns,stat.S_IMODE(s.st_mode),s.st_uid,s.st_gid]
def collect():
 started=instant();uid=pwd.getpwnam('synk-argon-ultra').pw_uid;before=services();chosen=selected(uid);files=[];payload={};identities={};total=0
 for p,private,owner in chosen:
  s=safe_file(p,owner,private);raw=p.read_bytes();require(identity(p.lstat())==identity(s),'ARGON_SOURCE_CHANGED')
  total+=len(raw);require(total<=128*1024*1024,'ARGON_SNAPSHOT_TOO_LARGE');name=str(p).lstrip('/');payload[name]=raw;identities[name]=identity(s)
  files.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'mode':stat.S_IMODE(s.st_mode),'owner':'root' if owner==0 else 'synk-argon-ultra','private':private})
 require([str(x[0]) for x in chosen]==[str(x[0]) for x in selected(uid)],'ARGON_SOURCE_SET_CHANGED')
 for p,private,owner in chosen:
  name=str(p).lstrip('/');require(identity(safe_file(p,owner,private))==identities[name] and hashlib.sha256(p.read_bytes()).hexdigest()==hashlib.sha256(payload[name]).hexdigest(),'ARGON_SOURCE_CHANGED')
 after=services();require(before==after,'ARGON_SERVICE_CHANGED')
 docs=json.loads(payload['etc/synk-argon-77yuhbs/docs.json']);require(docs==EXPECTED_DOCS,'ARGON_DOC_MAPPING_CHANGED')
 fingerprint=hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return {'schemaVersion':1,'kind':'argon-recovery','startedAt':started,'finishedAt':instant(),'files':files,'fileCount':len(files),'sourceBytes':total,'sourceFingerprint':fingerprint,'docs':docs,'servicesInactive':True,'sourceStable':True,'excluded':EXCLUDED,'restoreMode':'disabled-only; do not restore production-ready as active'},payload
class HashedWriter:
 def __init__(self):self.sha=hashlib.sha256();self.bytes=0
 def write(self,data):self.sha.update(data);self.bytes+=len(data);sys.stdout.buffer.write(data);return len(data)
 def flush(self):sys.stdout.buffer.flush()
def main():
 manifest,payload=collect()
 if MODE=='inspect':print(json.dumps(manifest));return
 require(manifest['sourceFingerprint']==EXPECTED,'ARGON_SOURCE_CHANGED_SINCE_INSPECT')
 writer=HashedWriter()
 members={'RESTORE.json':json.dumps({'schemaVersion':1,'steps':['Decrypt into a separate new directory and verify every manifest path, byte count and SHA256.','Do not overwrite an existing server. Install the official CLI/gws versions from the source guide.','Map owner synk-argon-ultra to its local service account; preserve private modes.','Restore files only with every synk-argon-ultra timer disabled and no active service.','Keep production-ready out of its live location until explicit reactivation and account/Docs checks.'],'excluded':EXCLUDED},sort_keys=True).encode(),'manifest.json':json.dumps(manifest,sort_keys=True).encode()}
 members.update({'snapshot/'+k:v for k,v in payload.items()})
 with tarfile.open(fileobj=writer,mode='w|',format=tarfile.USTAR_FORMAT) as archive:
  for name,body in sorted(members.items()):
   info=tarfile.TarInfo(name);info.size=len(body);info.mode=0o600;info.mtime=0;info.uid=0;info.gid=0
   archive.addfile(info,io.BytesIO(body))
 writer.flush();print('ARGON_CAPTURE '+json.dumps({'manifest':manifest,'archiveBytes':writer.bytes,'archiveSha256':writer.sha.hexdigest()}),file=sys.stderr)
try:main()
except Exception as error:
 code=str(error) if str(error).startswith('ARGON_') and str(error).replace('_','').isalnum() else 'ARGON_REMOTE_FAILED'
 print('ARGON_ERROR '+code,file=sys.stderr);sys.exit(1)
