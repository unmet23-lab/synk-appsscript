import os,pwd
account=pwd.getpwnam('synk-argon-ultra')
os.setgroups([]);os.setgid(account.pw_gid);os.setuid(account.pw_uid)
EXPECTED_ID='16boBqiExm-qjCof8SQsEEpF2-5ckmK27Bc2kxKiFYwM'
import sys,json,pathlib,stat,subprocess,importlib.util,datetime,hashlib,base64
sys.dont_write_bytecode=True
def need(ok,code):
 if not ok:raise RuntimeError(code)
def instant():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data):return hashlib.sha256(data).hexdigest()
try:
 source=pathlib.Path('/opt/synk-argon-77yuhbs/docs-io.py');info=source.lstat()
 need(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022 and not source.is_symlink(),'WORKSPACE_DOCS_HELPER_IDENTITY')
 spec=importlib.util.spec_from_file_location('existing_docs_io',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 target=module.document_id('synkbrief');need(target==EXPECTED_ID,'WORKSPACE_DOCS_CONFIG_CHANGED')
 env={'HOME':str(module.HOME),'USER':'synk-argon-ultra','PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','GOOGLE_WORKSPACE_CLI_CONFIG_DIR':str(module.HOME/'.config/gws-docs'),'GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND':'file'}
 auth=subprocess.run([module.GWS,'auth','status'],env=env,cwd=str(module.WORK),stdin=subprocess.DEVNULL,capture_output=True,text=True,encoding='utf-8',timeout=30)
 need(auth.returncode==0 and len(auth.stdout)<=262144,'WORKSPACE_DOCS_AUTH_STATUS_FAILED')
 need(module.strict_json(auth.stdout).get('user')=='unmet23@gmail.com','WORKSPACE_DOCS_ACCOUNT_MISMATCH')
 started=instant();before,raw=module.read_document(target);after,raw_after=module.read_document(target);finished=instant()
 need(module.document_id('synkbrief')==target,'WORKSPACE_DOCS_CONFIG_CHANGED')
 need(before['revisionId']==after['revisionId'] and before['sha256']==after['sha256'],'WORKSPACE_DOCS_CHANGED_DURING_READ')
 encode=lambda value:json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
 data=encode(raw);need(data==encode(raw_after) and 0<len(data)<=8*1024*1024,'WORKSPACE_DOCS_RAW_CHANGED_OR_TOO_LARGE')
 # read_document/flatten rejects multiple tabs, embedded objects, footnotes,
 # headers/footers, suggestions, tables and every non-text body element.
 proof={'schemaVersion':1,'documentId':target,'sourceAccount':'unmet23@gmail.com','serverNodeId':'8318146427425792493','reader':'existing-server-gws','format':'Google Docs API JSON','includeTabsContent':True,'embeddedObjects':0,'bodyKind':'single-tab-text-with-formatting','startedAt':started,'finishedAt':finished,'revisionHash':digest(before['revisionId'].encode()),'plaintextSha256':before['sha256'],'bytes':len(data),'sha256':digest(data),'twoReadsMatched':True}
 print(json.dumps({'proof':proof,'bodyBase64':base64.b64encode(data).decode('ascii')},separators=(',',':')))
except Exception as error:
 code=str(error) if str(error).startswith('WORKSPACE_') and str(error).replace('_','').isalnum() else 'WORKSPACE_DOCS_REMOTE_READ_FAILED'
 print(code,file=sys.stderr);sys.exit(1)
