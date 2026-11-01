#!/usr/bin/env python3
"""Read the existing active workspace and newest completed DR archive, never modify them.

Since the 2026-11 company release a backup may keep its studio media beside its
archive in GCS (`<snapshot>.media-<sha256>`) instead of inside it. Whether it did
is read from the DR archive itself (its data backup's media-manifest.json); for a
list-only backup the node's host-only receipt `<snapshot>.tar.gz.media.json`
(each sidecar's generation and md5, bound to the same list bytes) must exist, and
`media` below names the bodies the server-only Drive copy carries with it.
"""
import datetime,hashlib,json,pathlib,re,sqlite3,subprocess,tarfile
ARCHIVES=pathlib.Path('/srv/synk/backup-archives')
RECEIPT=re.compile(r'(synk-workspace-[0-9TZ-]+)\.tar\.gz\.media\.json')
NAME=re.compile(r'[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)',re.I)
B64MD5=re.compile(r'[A-Za-z0-9+/]{22}==')
def need(v,c):
 if not v:raise AssertionError(c)
def capsule_lists(capsule):
 """(media-manifest.json bytes or None, integration-manifest) of the data backup inside a DR archive, streamed."""
 with tarfile.open(capsule,'r:gz') as outer:
  for member in outer:
   if member.name!='data/workspace.tar.gz':continue
   need(member.isfile(),'DATA_ARCHIVE_TYPE');found={};roots=set()
   with tarfile.open(fileobj=outer.extractfile(member),mode='r|gz') as data:
    for inner in data:
     parts=inner.name.split('/');roots.add(parts[0])
     if len(parts)==2 and parts[1] in ('media-manifest.json','integration-manifest.json'):
      need(inner.isfile() and inner.size<=16<<20 and parts[1] not in found,'DATA_ARCHIVE_LIST_INVALID')
      found[parts[1]]=data.extractfile(inner).read()
   need('integration-manifest.json' in found and len(roots)==1,'DATA_ARCHIVE_INCOMPLETE')
   return found.get('media-manifest.json'),json.loads(found['integration-manifest.json']),roots.pop()
 raise AssertionError('DATA_ARCHIVE_MISSING')
def media_for(capsule,created_at,bucket,data,archives=ARCHIVES,owner=0):
 """None when the DR archive's own data backup keeps its media bytes (the archive itself says so); else its sidecars.
 owner=None skips the root-only file check (tests on a PC)."""
 raw,integration,backup=capsule_lists(capsule)
 need(integration.get('createdAt')==created_at,'DATA_BACKUP_TIME_MISMATCH')
 if raw is None:
  need(integration.get('mediaManifest') is None and integration.get('mediaBytesIncluded') is None,'MEDIA_LIST_MISSING')
  return None  # a backup from before media lists: the bytes are inside
 listed=json.loads(raw)
 need(isinstance(listed,dict) and type(listed.get('bytesIncluded')) is bool and listed['bytesIncluded'] is integration.get('mediaBytesIncluded') and isinstance(listed.get('files'),list),'MEDIA_LIST_INVALID')
 if listed['bytesIncluded']:return None  # the bodies are inside the archive already
 want=hashlib.sha256(raw).hexdigest()
 receipts=[]
 for p in archives.glob('synk-workspace-*.tar.gz.media.json'):
  m=RECEIPT.fullmatch(p.name)
  if not m:continue
  need(p.is_file() and not p.is_symlink(),'MEDIA_RECEIPT_INVALID')
  need(owner is None or (p.stat().st_uid==owner and not p.stat().st_mode&0o077),'MEDIA_RECEIPT_INVALID')
  r=json.loads(p.read_text())
  need(isinstance(r,dict) and r.get('schema')=='synk-backup-media-receipt/v1' and r.get('backup')==m.group(1) and isinstance(r.get('createdAt'),str),'MEDIA_RECEIPT_INVALID')
  receipts.append(r)
 # A list-only backup must have its node receipt: same backup, same list bytes. No receipt, no "success".
 found=[r for r in receipts if r['backup']==backup and r['createdAt']==created_at and r.get('manifestSha256')==want]
 need(found,'MEDIA_RECEIPT_MISSING')
 need(len(found)==1,'MEDIA_RECEIPT_DUPLICATE');r=found[0]
 need(r.get('bytesIncluded') is False and r.get('bucket')==bucket and isinstance(r.get('prefix'),str),'MEDIA_RECEIPT_INVALID')
 files,objects=r.get('files'),r.get('objects')
 need(files==listed['files'],'MEDIA_RECEIPT_INVALID')
 need(isinstance(files,list) and isinstance(objects,list) and isinstance(r.get('complete'),dict),'MEDIA_RECEIPT_INVALID')
 names={}
 for f in files:
  need(isinstance(f,dict) and isinstance(f.get('diskName'),str) and NAME.fullmatch(f['diskName']) and re.fullmatch('[0-9a-f]{64}',str(f.get('sha256'))) and type(f.get('bytes')) is int and f['bytes']>=0,'MEDIA_RECEIPT_INVALID')
  names.setdefault(f['sha256'],f)
 out=[]
 for o in objects:
  need(isinstance(o,dict) and o.get('sha256') in names and o.get('bytes')==names[o['sha256']]['bytes'] and o.get('object')==r['prefix']+r['backup']+'.media-'+o['sha256']
       and str(o.get('generation','')).isdigit() and B64MD5.fullmatch(str(o.get('md5Hash'))),'MEDIA_RECEIPT_INVALID')
  out.append({'sha256':o['sha256'],'bytes':o['bytes'],'object':o['object'],'generation':str(o['generation']),'md5Hash':o['md5Hash'],'diskName':names[o['sha256']]['diskName']})
 need(len({o['sha256'] for o in out})==len(out)==len(names),'MEDIA_RECEIPT_INCOMPLETE')
 return {'backup':r['backup'],'createdAt':r['createdAt'],'bucket':bucket,'dataDir':str(data),'objects':out}
def run(args):return subprocess.check_output(args,text=True,timeout=30)
def main():
 ids=run(['docker','ps','--filter','label=com.docker.compose.service=company','--format','{{.ID}}']).split()
 assert len(ids)==1,'ACTIVE_COMPANY_REQUIRED'
 obj=json.loads(run(['docker','inspect',ids[0]]))[0]
 mount=next(x for x in obj['Mounts'] if x['Destination']=='/data' and x['Type']=='bind')
 data=pathlib.Path(mount['Source']).resolve(strict=True)
 assert data.is_relative_to('/srv/synk')
 rp=data/'messenger/drive-storage.json';reg=json.loads(rp.read_text())
 con=sqlite3.connect((data/'messenger/messenger.sqlite').as_uri()+'?mode=ro',uri=True)
 con.execute('PRAGMA query_only=ON')
 files=[dict(zip(['fileId','connectionId','remoteId','bytes','md5'],r)) for r in con.execute("SELECT id,storage_connection_id,storage_remote_id,size,md5 FROM files WHERE storage_provider='google-drive' ORDER BY id")]
 con.close()
 candidates=[]
 for p in ARCHIVES.glob('synk-server-recovery-*.tar.gz.upload-result.json'):
  try:
   r=json.loads(p.read_text());a=pathlib.Path(str(p).removesuffix('.upload-result.json'))
   if r.get('complete') is True and r.get('md5Verified') is True and r.get('sidecarMd5Verified') is True and a.is_file() and a.stat().st_size==r['bytes']:
    r['path']=str(a);candidates.append(r)
  except Exception:pass
 assert candidates,'COMPLETED_SERVER_ARCHIVE_MISSING'
 latest=max(candidates,key=lambda x:x['createdAt'])
 age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(latest['createdAt'].replace('Z','+00:00'))).total_seconds()
 assert 0<=age<=36*3600,'SERVER_ARCHIVE_STALE'
 media=media_for(latest['path'],latest.get('dataBackupCreatedAt'),latest.get('bucket'),data)
 node=json.loads(pathlib.Path('/etc/synk/ha/node.json').read_text())
 print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nodeId':node['nodeId'],'registryPath':str(rp),'activeConnectionId':reg['activeConnectionId'],'files':files,'archives':[latest],'media':media}))
if __name__=='__main__':main()
