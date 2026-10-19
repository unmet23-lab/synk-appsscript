#!/usr/bin/env python3
"""Read the existing active workspace and newest completed DR archive, never modify them."""
import datetime,json,pathlib,sqlite3,subprocess
def run(args):return subprocess.check_output(args,text=True,timeout=30)
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
for p in pathlib.Path('/srv/synk/backup-archives').glob('synk-server-recovery-*.tar.gz.upload-result.json'):
 try:
  r=json.loads(p.read_text());a=pathlib.Path(str(p).removesuffix('.upload-result.json'))
  if r.get('complete') is True and r.get('md5Verified') is True and r.get('sidecarMd5Verified') is True and a.is_file() and a.stat().st_size==r['bytes']:
   r['path']=str(a);candidates.append(r)
 except Exception:pass
assert candidates,'COMPLETED_SERVER_ARCHIVE_MISSING'
latest=max(candidates,key=lambda x:x['createdAt'])
age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(latest['createdAt'].replace('Z','+00:00'))).total_seconds()
assert 0<=age<=36*3600,'SERVER_ARCHIVE_STALE'
node=json.loads(pathlib.Path('/etc/synk/ha/node.json').read_text())
print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nodeId':node['nodeId'],'registryPath':str(rp),'activeConnectionId':reg['activeConnectionId'],'files':files,'archives':[latest]}))
