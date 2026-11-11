#!/usr/bin/env python3
"""Read the existing active workspace and newest completed DR archive, never modify them.

Since the 2026-11 company release a backup may keep its studio media beside its
archive in GCS (`<snapshot>.media-<sha256>`) instead of inside it. Whether it did
is read from the DR archive itself (its data backup's media-manifest.json); for a
list-only backup the node's host-only receipt `<snapshot>.tar.gz.media.json`
(each sidecar's generation and md5, bound to the same list bytes) must exist, and
`media` below names the bodies the server-only Drive copy carries with it.

Since the 2026-11 retention rule (PULSE persona files never go to the unmet23
vault, 판 4 설계 11-2) a listed backup also holds media-retention.json: the
sha256 of every body a persona document owns. `retention` below passes that set
on, checked against the same list bytes, so backup.cjs can mark those receipt
items vault:false; the PC retention job keeps them out of the vault copy.
"""
import datetime,hashlib,json,pathlib,re,sqlite3,subprocess,tarfile
ARCHIVES=pathlib.Path('/srv/synk/backup-archives')
RECEIPT=re.compile(r'(synk-workspace-[0-9TZ-]+)\.tar\.gz\.media\.json')
NAME=re.compile(r'[0-9a-f-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)',re.I)
B64MD5=re.compile(r'[A-Za-z0-9+/]{22}==')
def need(v,c):
 if not v:raise AssertionError(c)
LISTS=('media-manifest.json','integration-manifest.json','media-retention.json')
RETENTION_SCHEMA='synk-workspace-media-retention/v1'
SHA=re.compile('[0-9a-f]{64}')
def capsule_lists(capsule):
 """{name: bytes} of the data backup's top-level lists inside a DR archive (integration-manifest always), and its root, streamed."""
 with tarfile.open(capsule,'r:gz') as outer:
  for member in outer:
   if member.name!='data/workspace.tar.gz':continue
   need(member.isfile(),'DATA_ARCHIVE_TYPE');found={};roots=set()
   with tarfile.open(fileobj=outer.extractfile(member),mode='r|gz') as data:
    for inner in data:
     parts=inner.name.split('/');roots.add(parts[0])
     if len(parts)==2 and parts[1] in LISTS:
      need(inner.isfile() and inner.size<=16<<20 and parts[1] not in found,'DATA_ARCHIVE_LIST_INVALID')
      found[parts[1]]=data.extractfile(inner).read()
   need('integration-manifest.json' in found and len(roots)==1,'DATA_ARCHIVE_INCOMPLETE')
   return found,roots.pop()
 raise AssertionError('DATA_ARCHIVE_MISSING')
def retention_from(found):
 """Which bodies stay out of the vault. classified=False only for a backup that names no retention file
 (made before the 2026-11 rule); a named file must exist and agree with the same list bytes."""
 integration=json.loads(found['integration-manifest.json']);raw=found.get('media-manifest.json')
 listed=json.loads(raw) if raw is not None else None
 included=listed.get('bytesIncluded') if isinstance(listed,dict) else None
 if integration.get('mediaRetention') is None:
  need('media-retention.json' not in found,'MEDIA_RETENTION_INVALID')
  return {'classified':False,'noVault':[],'bytesIncluded':included,'legacyDeleted':None}
 need(integration.get('mediaRetention')=='media-retention.json' and raw is not None and 'media-retention.json' in found and isinstance(listed,dict) and isinstance(listed.get('files'),list),'MEDIA_RETENTION_INVALID')
 kept=json.loads(found['media-retention.json'])
 need(isinstance(kept,dict) and kept.get('schema')==RETENTION_SCHEMA and kept.get('createdAt')==integration.get('createdAt')==listed.get('createdAt')
      and kept.get('manifestSha256')==hashlib.sha256(raw).hexdigest() and isinstance(kept.get('noVault'),list)
      and type(kept.get('legacyDeleted')) is int and kept['legacyDeleted']>=0,'MEDIA_RETENTION_INVALID')
 contents={f.get('sha256') for f in listed['files'] if isinstance(f,dict)}
 no=kept['noVault']
 need(all(isinstance(h,str) and SHA.fullmatch(h) and h in contents for h in no) and no==sorted(set(no)),'MEDIA_RETENTION_INVALID')
 # 해시 기록 없이 지운 인물이 있으면 그 바이트를 가릴 수 없다 — 분류를 미완(classified False)으로 내보내 PC가 영상 본문을 모두 금고에서 뺀다.
 return {'classified':kept['legacyDeleted']==0,'noVault':no,'bytesIncluded':included,'legacyDeleted':kept['legacyDeleted']}
def media_for(capsule,created_at,bucket,data,archives=ARCHIVES,owner=0):
 """None when the DR archive's own data backup keeps its media bytes (the archive itself says so); else its sidecars.
 owner=None skips the root-only file check (tests on a PC)."""
 return sources_for(capsule,created_at,bucket,data,archives,owner)[0]
def sources_for(capsule,created_at,bucket,data,archives=ARCHIVES,owner=0):
 """(media as media_for, retention as retention_from) from one pass over the DR archive."""
 found,backup=capsule_lists(capsule)
 integration=json.loads(found['integration-manifest.json'])
 need(integration.get('createdAt')==created_at,'DATA_BACKUP_TIME_MISMATCH')
 return media_from(found.get('media-manifest.json'),integration,backup,created_at,bucket,data,archives,owner),retention_from(found)
def media_from(raw,integration,backup,created_at,bucket,data,archives,owner):
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
 media,retention=sources_for(latest['path'],latest.get('dataBackupCreatedAt'),latest.get('bucket'),data)
 node=json.loads(pathlib.Path('/etc/synk/ha/node.json').read_text())
 print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nodeId':node['nodeId'],'registryPath':str(rp),'activeConnectionId':reg['activeConnectionId'],'files':files,'archives':[latest],'media':media,'retention':retention}))
if __name__=='__main__':main()
