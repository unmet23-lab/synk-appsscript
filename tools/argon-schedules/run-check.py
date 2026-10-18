#!/usr/bin/env python3
"""Record and verify one direct official CLI execution; never runs an LLM."""
import json,os,sys,pathlib,datetime,subprocess,re,hashlib,stat,tempfile
H=pathlib.Path('/var/lib/synk-argon-77yuhbs')
role=sys.argv[2] if len(sys.argv)==3 else ''
if role not in ('full','yt-tt','meta-brand','synkbrief'):raise SystemExit(2)
state=H/'run-status';state.mkdir(exist_ok=True,mode=0o700)
log=H/'logs'/(role+'.stream.jsonl');err=H/'logs'/(role+'.stderr.log');record=state/(role+'.json')
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
SAFE_ERRORS={'DOC_READ_FAILED','BEGIN_DOC_READ_FAILED','BEGIN_INVOCATION_ID_INVALID','SERVICE_FAILED','MISSING_OR_MULTIPLE_RUNS','MODEL_MISMATCH','CONVERSATION_MISMATCH','CLI_FAILED_OR_DENIED','MISSING_DELIVERY_MARKER','DOC_SHA_MISMATCH','NO_CHANGE_DOC_CHANGED_OR_NO_BASELINE','RUN_CHECK_FAILED'}
def terminal_receipt(d):
 """Keep only bounded evidence fields, never report text or revision strings."""
 receipt={'receiptVersion':1,'role':role,'status':d['status']}
 for key in ('startedAt','completedAt'):
  value=d.get(key)
  if isinstance(value,str) and len(value)<=40:
   try:
    stamp=datetime.datetime.fromisoformat(value)
    if stamp.tzinfo and stamp.utcoffset()==datetime.timedelta(0):receipt[key]=stamp.isoformat()
   except ValueError:pass
 for key in ('offset','stderrOffset'):
  value=d.get(key)
  if type(value) is int and value>=0:receipt[key]=value
 for key in ('baselineSha256','sha256'):
  value=d.get(key)
  if isinstance(value,str) and re.fullmatch(r'[a-f0-9]{64}',value):receipt[key]=value
 for key in ('conversationId','documentId'):
  value=d.get(key)
  if isinstance(value,str) and re.fullmatch(r'[A-Za-z0-9_-]{1,128}',value):receipt[key]=value
 invocation=d.get('invocationId') or os.environ.get('INVOCATION_ID','')
 if isinstance(invocation,str) and re.fullmatch(r'[a-f0-9]{32}',invocation):receipt['invocationId']=invocation
 if d.get('model')=='gemini-4-argon-high':receipt['model']=d['model']
 if d['status']=='failed':receipt['error']=d.get('error') if isinstance(d.get('error'),str) and d['error'] in SAFE_ERRORS else 'RUN_CHECK_FAILED'
 return receipt
def archive(d):
 if d.get('status') not in ('complete','no-change','failed'):return
 receipt=terminal_receipt(d);history=state/'history';history.mkdir(exist_ok=True,mode=0o700)
 info=history.lstat()
 assert stat.S_ISDIR(info.st_mode) and history.resolve()==history.absolute(),'UNSAFE_HISTORY_DIRECTORY'
 if os.name=='posix':assert info.st_uid==os.geteuid() and stat.S_IMODE(info.st_mode)==0o700,'UNSAFE_HISTORY_PERMISSIONS'
 identity=receipt.get('invocationId') or hashlib.sha256(json.dumps([role,receipt.get('startedAt') or receipt.get('completedAt'),receipt.get('offset'),receipt.get('stderrOffset')],separators=(',',':')).encode()).hexdigest()
 destination=history/(role+'-'+identity+'.json')
 fd,name=tempfile.mkstemp(prefix='.receipt-',dir=history);temporary=pathlib.Path(name)
 try:
  with os.fdopen(fd,'w',encoding='utf-8',newline='\n') as handle:
   json.dump(receipt,handle,sort_keys=True,separators=(',',':'));handle.write('\n');handle.flush();os.fsync(handle.fileno())
  try:os.link(temporary,destination)
  except FileExistsError:
   existing=destination.lstat()
   assert stat.S_ISREG(existing.st_mode) and existing.st_nlink==1,'UNSAFE_HISTORY_FILE'
   if os.name=='posix':assert existing.st_uid==os.geteuid() and stat.S_IMODE(existing.st_mode)==0o600,'UNSAFE_HISTORY_PERMISSIONS'
 finally:temporary.unlink(missing_ok=True)
 if os.name=='posix':
  directory=os.open(history,os.O_RDONLY|os.O_DIRECTORY)
  try:os.fsync(directory)
  finally:os.close(directory)
def save(d):
 p=record.with_suffix('.next');p.write_text(json.dumps(d,ensure_ascii=False,indent=2));os.chmod(p,0o600);p.replace(record)
 archive(d)
def read_doc():
 r=subprocess.run(['/usr/bin/python3','/opt/synk-argon-77yuhbs/docs-io.py','read',role],capture_output=True,text=True,timeout=100)
 assert r.returncode==0,'DOC_READ_FAILED'
 return json.loads(r.stdout)
if sys.argv[1]=='begin':
 d={'role':role,'status':'running','startedAt':now(),'offset':log.stat().st_size if log.exists() else 0,'stderrOffset':err.stat().st_size if err.exists() else 0}
 try:
  invocation=os.environ.get('INVOCATION_ID','');assert not invocation or re.fullmatch(r'[a-f0-9]{32}',invocation),'INVOCATION_ID_INVALID'
  if invocation:d['invocationId']=invocation
  baseline=read_doc();d.update({'baselineSha256':baseline['sha256'],'baselineRevisionId':baseline['revisionId']});save(d)
 except Exception as ex:
  d.update({'status':'failed','completedAt':now(),'error':'BEGIN_'+str(ex)[:180]});save(d);raise SystemExit(1)
 raise SystemExit(0)
try:
 d=json.loads(record.read_text());assert d['status']=='running'
 with log.open('rb') as f:f.seek(d['offset']);raw=f.read(20*1024*1024)
 events=[json.loads(x) for x in raw.decode().splitlines() if x.strip()]
 init=[x for x in events if x.get('event')=='init'];res=[x['result'] for x in events if x.get('event')=='result']
 assert os.environ.get('SERVICE_RESULT','success')=='success','SERVICE_FAILED'
 assert len(init)==1 and len(res)==1,'MISSING_OR_MULTIPLE_RUNS'
 result=res[0];assert init[0]['init']['model']=='gemini-4-argon-high','MODEL_MISMATCH'
 assert result['conversation_id']==init[0]['conversation_id'],'CONVERSATION_MISMATCH'
 assert result['status']=='SUCCESS' and not result.get('denied_actions'),'CLI_FAILED_OR_DENIED'
 text=result.get('response','');firstline=text.splitlines()[0] if text else '';match=re.fullmatch(r'SYNK_RUN_COMPLETE: '+re.escape(role)+r' : ([a-f0-9]{64})',firstline)
 nochange=firstline=='SYNK_RUN_NO_CHANGE: '+role
 assert match or nochange,'MISSING_DELIVERY_MARKER'
 doc=read_doc()
 if match:assert doc['sha256']==match.group(1),'DOC_SHA_MISMATCH'
 if nochange:assert doc['sha256']==d.get('baselineSha256'),'NO_CHANGE_DOC_CHANGED_OR_NO_BASELINE'
 d.update({'status':'no-change' if nochange else 'complete','completedAt':now(),'model':init[0]['init']['model'],'conversationId':result['conversation_id'],'documentId':doc['documentId'],'sha256':doc['sha256'],'revisionId':doc['revisionId'],'response':text})
 save(d);print(json.dumps({'role':role,'status':d['status'],'model':d['model'],'documentId':d['documentId']},ensure_ascii=False))
except Exception as ex:
 try:d
 except NameError:d={'role':role}
 d.update({'status':'failed','completedAt':now(),'error':str(ex)[:200]});save(d);print(json.dumps({'role':role,'status':'failed','error':d['error']}),file=sys.stderr);raise SystemExit(1)
