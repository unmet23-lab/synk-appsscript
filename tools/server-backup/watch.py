#!/usr/bin/env python3
"""Persist/retry fixed-code backup failures through existing Cloud Logging identity."""
import datetime,hashlib,json,os,pathlib,subprocess,urllib.request,urllib.parse,sys
ROOT=pathlib.Path('/var/lib/synk-server-backup')
PROJECT='synk-bake-unmet27'
def now():return datetime.datetime.now(datetime.timezone.utc)
def save(p,v):
 t=p.with_suffix('.tmp');t.write_text(json.dumps(v));os.chmod(t,0o600);t.replace(p)
def read(p):
 try:return json.loads(p.read_text())
 except (OSError,ValueError):return {}
def request(url,data=None,headers=None):
 r=urllib.request.Request(url,data=None if data is None else json.dumps(data).encode(),headers=headers or {})
 with urllib.request.urlopen(r,timeout=30) as s:return json.load(s)
def radio_status(cfg):
 cred=read(pathlib.Path('/etc/synk-server-backup/credentials.json'))['drive77']
 req=urllib.request.Request('https://oauth2.googleapis.com/token',data=urllib.parse.urlencode(dict(cred,grant_type='refresh_token')).encode(),headers={'Content-Type':'application/x-www-form-urlencoded'})
 with urllib.request.urlopen(req,timeout=30) as r:token=json.load(r)['access_token']
 headers={'Authorization':'Bearer '+token}
 account=request('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',headers=headers)
 assert account['user']['emailAddress']=='77yuhbs@gmail.com'
 folder=cfg['radioFolderId'];assert folder.replace('_','').replace('-','').isalnum()
 params={'q':"trashed=false and '"+folder+"' in parents and name contains 'receipt-'",'orderBy':'createdTime desc','pageSize':'1','fields':'files(id,size,sha256Checksum,trashed,owners(emailAddress),parents,createdTime)'}
 rows=request('https://www.googleapis.com/drive/v3/files?'+urllib.parse.urlencode(params),headers=headers)['files'];assert len(rows)==1
 meta=rows[0];assert not meta['trashed'] and meta['owners']==[{'emailAddress':'77yuhbs@gmail.com'}] and folder in meta['parents'] and int(meta['size'])<2*1024*1024
 with urllib.request.urlopen(urllib.request.Request('https://www.googleapis.com/drive/v3/files/'+meta['id']+'?alt=media',headers=headers),timeout=30) as r:body=r.read(2*1024*1024)
 assert len(body)==int(meta['size']) and hashlib.sha256(body).hexdigest()==meta['sha256Checksum']
 v=json.loads(body);assert v['schema']=='synk-server-independent/v1' and v['role']=='radio'
 age=(now()-datetime.datetime.fromisoformat(v['completedAt'].replace('Z','+00:00'))).total_seconds()
 result={'checkedAt':now().isoformat(),'role':'radio','receiptId':meta['id'],'receiptSha256':meta['sha256Checksum'],'status':v['status'],'completedAt':v['completedAt'],'ageSeconds':round(age)}
 save(ROOT/'radio-audit.json',result)
 return None if v['status']=='success' and 0<=age<=26*3600 else 'RADIO_BACKUP_FAILED_OR_STALE'
def main():
 cfg=read(pathlib.Path('/etc/synk-server-backup/config.json'));state=read(ROOT/'latest.json');queue=read(ROOT/'alert-pending.json');ack=read(ROOT/'alert-ack.json');success=read(ROOT/'latest-success.json')
 if not success and state.get('status')=='success' and state.get('receipt',{}).get('remoteVerifiedAt'):success=state
 error=None
 if not state:error='BACKUP_NOT_STARTED'
 elif state.get('status')=='failed':error=state.get('error','BACKUP_FAILED')
 else:
  stamp=state.get('completedAt') if state.get('status')=='success' else state.get('heartbeatAt',state.get('startedAt'))
  age=(now()-datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds()
  if age>(26*3600 if state.get('status')=='success' else 3*3600):error='BACKUP_STALE'
 if success:
  successAge=(now()-datetime.datetime.fromisoformat(success['completedAt'].replace('Z','+00:00'))).total_seconds()
  if not 0<=successAge<=26*3600:error='LAST_SUCCESS_OLDER_THAN_26_HOURS'
 elif not error and state.get('status') not in ('running','uploading_receipt'):error='NO_REMOTE_VERIFIED_SUCCESS'
 result=subprocess.run(['systemctl','show','synk-server-backup.service','-p','ActiveState','-p','Result'],capture_output=True,text=True,timeout=15).stdout
 if 'ActiveState=failed' in result and not error:error='BACKUP_SERVICE_FAILED'
 timer=subprocess.run(['systemctl','show','synk-server-backup.timer','-p','ActiveState','-p','UnitFileState'],capture_output=True,text=True,timeout=15).stdout
 if 'ActiveState=active' not in timer or 'UnitFileState=enabled' not in timer:error='BACKUP_TIMER_DISABLED'
 if cfg.get('radioFolderId'):
  try:error=radio_status(cfg) or error
  except Exception:error='RADIO_REMOTE_AUDIT_FAILED'
 if '--self-test' in sys.argv:error='SYNTHETIC_BACKUP_ALERT_TEST'
 if error:
  if not isinstance(error,str) or not error.replace('_','').isalnum() or len(error)>100:error='BACKUP_FAILED'
  event={'event':'SYNK_SERVER_BACKUP_FAILED','role':cfg['role'],'error':error,'runId':state.get('runId','none'),'occurredAt':now().isoformat()}
  eventId=hashlib.sha256((event['role']+'|'+event['runId']+'|'+error).encode()).hexdigest()
  if ack.get('eventId')!=eventId:queue={'eventId':eventId,'payload':event};save(ROOT/'alert-pending.json',queue)
 token=request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',headers={'Metadata-Flavor':'Google'})['access_token']
 if queue and ack.get('eventId')!=queue.get('eventId'):
  request('https://logging.googleapis.com/v2/entries:write',{'logName':'projects/'+PROJECT+'/logs/synk_server_backup','resource':{'type':'global','labels':{'project_id':PROJECT}},'entries':[{'insertId':queue['eventId'],'severity':'ERROR','jsonPayload':queue['payload']}]},{'Authorization':'Bearer '+token,'Content-Type':'application/json'})
  save(ROOT/'alert-ack.json',{'eventId':queue['eventId'],'deliveredToCloudLoggingAt':now().isoformat()})
 if not error and success:
  beat={'event':'SYNK_SERVER_BACKUP_HEALTHY','role':cfg['role'],'lastRemoteSuccessAt':success['completedAt'],'runId':success['runId'],'checkedAt':now().isoformat()}
  request('https://logging.googleapis.com/v2/entries:write',{'logName':'projects/'+PROJECT+'/logs/synk_server_backup_'+cfg['role']+'_healthy','resource':{'type':'global','labels':{'project_id':PROJECT}},'entries':[{'severity':'INFO','jsonPayload':beat}]},{'Authorization':'Bearer '+token,'Content-Type':'application/json'})
  save(ROOT/'heartbeat-ack.json',beat)
 return {'pending':False,'deliveredToCloudLogging':True,'healthy':not error and bool(success),'awaitingFirstSuccess':not error and not success}
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print(json.dumps({'pending':True,'error':'ALERT_DELIVERY_FAILED'}));raise SystemExit(1)
