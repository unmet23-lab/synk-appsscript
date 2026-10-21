#!/usr/bin/env python3
"""Root-only HA checks. Never creates business DBs or an empty replacement volume."""
import os,json,pathlib,hashlib,subprocess,sqlite3,sys,uuid,stat,re,time,signal
from contextlib import contextmanager

MOUNT=pathlib.Path('/srv/synk')
NODE='/opt/synk/ha-runtime/node'
AGENT='/opt/synk/ha/node-agent.mjs'
CONFIG='/etc/synk/ha/node.json'
COMPANY_PATH='docs/마케팅/온라인마케팅지도/engagement/company'
UNITS=('synk-company.service','synk-spaceship.service')
TIMERS=('synk-company-health.timer','synk-company-backup.timer','synk-company-backup-watch.timer')
GUARDED_UNITS=UNITS+('synk-company-health.service','synk-company-backup.service')
CONTAINERS=('synk-company-company-1','synk-company-https-1','synk-spaceship-spaceship-1')
START_BUDGET_SECONDS=300
STOP_BUDGET_SECONDS=240
# The spaceship unit can precede the company unit during an ordered stop.
# Allow both systemd stop budgets (30s + 90s), plus command overhead. The
# Compose company stop itself may legitimately consume the full 60 seconds.
UNIT_STOP_TIMEOUT_SECONDS=150
CHECK_BUDGET_SECONDS=180
_deadline=None

class Rejected(Exception): pass
def require(ok,code):
    if not ok: raise Rejected(code)
def cancel_operation(signum,frame):raise Rejected('HOST_OPERATION_CANCELLED')

@contextmanager
def operation_budget(seconds):
    """Bound the whole action, including Python work and all child commands."""
    global _deadline
    previous=_deadline;_deadline=min(previous,time.monotonic()+seconds) if previous is not None else time.monotonic()+seconds
    # The deployed helper is Linux and always executes in the main thread.
    # Per-command budgets also apply in the portable Windows fixture tests.
    timed=hasattr(signal,'setitimer')
    old_handler=signal.signal(signal.SIGALRM,cancel_operation) if timed else None
    if timed:signal.setitimer(signal.ITIMER_REAL,max(.001,_deadline-time.monotonic()))
    try:yield
    finally:
        if timed:signal.setitimer(signal.ITIMER_REAL,0)
        _deadline=previous
        if timed:
            signal.signal(signal.SIGALRM,old_handler)
            if previous is not None:signal.setitimer(signal.ITIMER_REAL,max(.001,previous-time.monotonic()))

@contextmanager
def finish_cleanup():
    # A second parent SIGTERM must not interrupt a stop already in progress.
    # operation_budget still imposes its independent hard Linux alarm.
    previous={s:signal.signal(s,signal.SIG_IGN) for s in (signal.SIGTERM,signal.SIGINT)}
    try:yield
    finally:
        for s,handler in previous.items():signal.signal(s,handler)

def run(args,timeout=30,input=None):
    if _deadline is not None:
        remaining=_deadline-time.monotonic();require(remaining>0,'HOST_OPERATION_TIMEOUT');timeout=min(timeout,remaining)
    r=subprocess.run(args,capture_output=True,timeout=timeout,input=input)
    require(r.returncode==0,'HOST_COMMAND_FAILED');return r.stdout.decode().strip()
def digest(p):
    h=hashlib.sha256()
    with pathlib.Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def regular(p):
    p=pathlib.Path(p);require(p.is_file() and not p.is_symlink(),'REGULAR_FILE_REQUIRED');return p
def private_json(p):
    p=regular(p);s=p.stat();require(s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o600,'PRIVATE_ROOT_CONFIG_REQUIRED');return json.loads(p.read_text())

def protected(p):
    p=regular(p);s=p.stat();require(s.st_uid==0 and not (s.st_mode&0o022),'ROOT_PROTECTED_FILE_REQUIRED');return p

def container_contract(c):
    items=c.get('containers',[])
    require(len(items)==len(CONTAINERS) and {x.get('name') for x in items}==set(CONTAINERS),'CONTAINER_CONTRACT')
    require(all(re.fullmatch(r'sha256:[a-f0-9]{64}',x.get('imageId','')) for x in items),'IMAGE_CONTRACT')
    return items

def inspect_containers(c,required=False):
    items=container_contract(c)
    existing=set(run(['docker','ps','-a','--format','{{.Names}}']).splitlines())
    names=[x['name'] for x in items if x['name'] in existing]
    require(not required or len(names)==len(items),'CONTAINER_MISSING')
    if not names:return []
    found=json.loads(run(['docker','inspect',*names]))
    require(len(found)==len(names) and {x.get('Name','').lstrip('/') for x in found}==set(names),'CONTAINER_INSPECT_INCOMPLETE')
    expected={x['name']:x['imageId'] for x in items}
    for x in found:
        require(x.get('Name','').lstrip('/') in names and x.get('Image')==expected[x['Name'].lstrip('/')],'CONTAINER_IMAGE_CHANGED')
        require(x.get('HostConfig',{}).get('RestartPolicy',{}).get('Name')=='no','DOCKER_RESTART_BYPASS')
    return found
def check_release(c):
    root=pathlib.Path(c['releaseRoot']);require(root.parent==pathlib.Path('/opt/synk/releases') and not root.is_symlink(),'RELEASE_ROOT')
    m=regular(root/'release-manifest.json');require(digest(m)==c['releaseSha256'],'RELEASE_MANIFEST_CHANGED')
    rows=json.loads(m.read_text())['files'];require(len(rows)>100,'RELEASE_EMPTY')
    seen=set()
    for r in rows:
        p=pathlib.PurePosixPath(r['path']);require(not p.is_absolute() and '..' not in p.parts and r['path'] not in seen,'RELEASE_PATH')
        f=regular(root/p);require(f.resolve().is_relative_to(root) and f.stat().st_size==r['bytes'] and digest(f)==r['sha256'],'RELEASE_BYTES');seen.add(r['path'])
    require(COMPANY_PATH+'/workspace-media.mjs' in seen,'MEDIA_ENUMERATOR_NOT_IN_MANIFEST')
    for item in c['envFiles']:
        f=regular(item['path']);require(f.stat().st_uid==0 and stat.S_IMODE(f.stat().st_mode)==0o600 and digest(f)==item['sha256'],'ENV_CHANGED')
    for item in container_contract(c):
        image=json.loads(run(['docker','image','inspect',item['imageId']]))[0];require(image['Id']==item['imageId'],'IMAGE_CHANGED')
    return {'releaseSha256':c['releaseSha256'],'imagesAndEnvAccepted':True}
def replay_contract(c):
    check_release(c)
    require(c.get('externalReplayContract')=='background0-ai0-idempotent-import-payloadless-push-v1','REPLAY_CONTRACT_REQUIRED')
    env={}
    for line in regular('/etc/synk/company.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);env[k]=v.strip('"\'')
    require(len(c.get('requiredFlags',{}))>=2,'REPLAY_FLAGS_REQUIRED')
    for k,v in c['requiredFlags'].items():require(env.get(k)==v,'REPLAY_FLAGS_CHANGED')
    return {'externalReplaySafe':True}
def unit_properties(units,properties,timeout=30):
    """One fresh systemd read, mapped by exact Id; never rely on output order."""
    fields=('Id','LoadState',*properties)
    # systemctl renders each command in this array as a separate property line.
    # Identity/state properties remain scalars and must never be repeated.
    array_fields={'ExecStartPre'}
    require(len(units)==len(set(units)) and len(fields)==len(set(fields)),'UNIT_QUERY_CONTRACT')
    output=run(['systemctl','show',*units,'--property='+','.join(fields),'--all'],timeout=timeout)
    rows={}
    for block in re.split(r'\r?\n\s*\r?\n',output.strip()):
        row={}
        for line in block.splitlines():
            key,separator,value=line.partition('=')
            require(separator and key in fields,'UNIT_PROPERTIES_SHAPE')
            if key in array_fields:row.setdefault(key,[]).append(value)
            else:
                require(key not in row,'UNIT_PROPERTIES_SHAPE')
                row[key]=value
        require(set(row)==set(fields),'UNIT_PROPERTIES_INCOMPLETE')
        identity=row['Id']
        require(identity in units and identity not in rows,'UNIT_PROPERTIES_IDENTITY')
        require(row['LoadState']=='loaded','UNIT_NOT_LOADED')
        rows[identity]=row
    require(set(rows)==set(units),'UNIT_PROPERTIES_MISSING')
    return rows

def check_guards(c,required_containers=False):
    require(c.get('activationAllowed') is True and len(c.get('guardFiles',[]))>=3,'HOST_NOT_ACCEPTED')
    for item in c['guardFiles']:require(digest(protected(item['path']))==item['sha256'],'START_GUARD_CHANGED')
    # A matching hash does not prove systemd loaded the guard. Check its effective
    # command (including drop-ins), and reject ignored guard failures.
    require(c.get('units')==list(UNITS),'UNIT_ALLOWLIST')
    guard=' '.join((NODE,AGENT,'--check-start',CONFIG))
    units=unit_properties(GUARDED_UNITS,('ExecStartPre',))
    for unit in GUARDED_UNITS:
        output='\n'.join(units[unit]['ExecStartPre'])
        require(guard in output,'EFFECTIVE_START_GUARD_REQUIRED')
        command=next((x.strip() for x in output.split(';') if x.strip()=='argv[]='+guard),None)
        require(command is not None and 'ignore_errors=yes' not in output,'START_GUARD_MUST_FAIL_CLOSED')
    return inspect_containers(c,required=required_containers)
def check_mount(c):
    require(c['mount']=='/srv/synk','MOUNT_CONTRACT')
    require(not MOUNT.is_symlink(),'MOUNT_SYMLINK')
    m=json.loads(run(['findmnt','-J','-M',c['mount'],'-o','SOURCE,TARGET,UUID,OPTIONS']))['filesystems'][0]
    require(m['target']==c['mount'] and m['uuid']==c['filesystemUuid'] and 'rw' in m['options'].split(','),'MOUNT_IDENTITY')
    device=pathlib.Path('/dev/disk/by-id/google-'+c['diskName']).resolve(strict=True)
    require(pathlib.Path(m['source']).resolve()==device,'MOUNT_DEVICE')
    marker=private_json('/srv/synk/HA_VOLUME_IDENTITY.json')
    require(marker['diskId']==c['diskId'] and marker['filesystemUuid']==c['filesystemUuid'],'VOLUME_IDENTITY')
    require(not pathlib.Path('/srv/synk/HA_MIGRATION_INCOMPLETE').exists(),'MIGRATION_NOT_ACCEPTED')
    return {'mountedDiskId':c['diskId']}
def mount_candidate(c):
    if subprocess.run(['mountpoint','-q','/srv/synk']).returncode:
        device=pathlib.Path('/dev/disk/by-id/google-'+c['diskName']).resolve(strict=True)
        require(run(['blkid','-s','UUID','-o','value',str(device)])==c['filesystemUuid'],'CANDIDATE_FILESYSTEM_IDENTITY')
        mount=pathlib.Path('/srv/synk');mount.mkdir(exist_ok=True,mode=0o700)
        require(not mount.is_symlink() and not any(mount.iterdir()),'UNMOUNTED_DATA_DIRECTORY_NOT_EMPTY')
        run(['mount','-o','rw,nosuid,nodev',str(device),str(mount)])
    check_mount(c)
def data_path(c,relative):
    root=pathlib.Path(c['companyVolume']);rel=pathlib.PurePosixPath(relative)
    require(root.is_absolute() and root!=MOUNT and root.is_relative_to(MOUNT),'DATA_OUTSIDE_DISK')
    require(isinstance(relative,str) and relative and not rel.is_absolute() and '..' not in rel.parts and '\\' not in relative,'FILE_PATH')
    p=root/rel
    for item in [p,*p.parents]:
        if item==MOUNT:break
        require(not item.is_symlink(),'DATA_SYMLINK')
    require(p.resolve().is_relative_to(MOUNT.resolve()),'DATA_OUTSIDE_DISK')
    require(p.stat().st_dev==MOUNT.stat().st_dev,'DATA_ON_DIFFERENT_DEVICE')
    return p

def db_path(c,relative):return regular(data_path(c,relative))

def open_db(c,relative,write=False,timeout=5):
    p=db_path(c,relative)
    for suffix in ('-wal','-shm'):
        if pathlib.Path(str(p)+suffix).exists() or pathlib.Path(str(p)+suffix).is_symlink():db_path(c,relative+suffix)
    return sqlite3.connect(p.as_uri()+('?mode=rw' if write else '?mode=ro'),uri=True,timeout=timeout)

# Uses Node's bundled AES-GCM and SQLite, without importing Store (whose constructor
# writes migrations and expires sessions). Neither secret values nor identifiers
# are printed. The canonical media enumerator is taken from the verified release.
DATA_AUDIT_JS=r'''
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {DatabaseSync}=require('node:sqlite'),{createDecipheriv}=require('node:crypto');
const [directory,mediaModule]=process.argv.slice(1);
const check=(ok)=>{if(!ok)throw Error('DATA_AUDIT');};
(async()=>{
 const key=fs.readFileSync(path.join(directory,'encryption.key'));check(key.length===32);
 const db=new DatabaseSync(path.join(directory,'company.sqlite'),{readOnly:true});
 try {
  const decrypt=value=>{check(typeof value==='string');const b=Buffer.from(value,'base64');check(b.length>=29);const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'));};
  const quote=s=>'"'+s.replaceAll('"','""')+'"';let credentials=0;
  for(const {name} of db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all()){
   if(db.prepare('PRAGMA table_info('+quote(name)+')').all().some(x=>x.name==='ciphertext')){
    for(const r of db.prepare('SELECT ciphertext FROM '+quote(name)+' WHERE ciphertext IS NOT NULL').all()){decrypt(r.ciphertext);credentials++;}
   }
  }
  const docs=db.prepare('SELECT kind,id,body FROM documents').all();
  for(const row of docs){const value=JSON.parse(row.body);if(typeof value?.ciphertext==='string'){decrypt(value.ciphertext);credentials++;}}
  const users=new Map(docs.filter(x=>x.kind==='users').map(x=>[x.id,JSON.parse(x.body)]));
  for(const row of db.prepare("SELECT * FROM tokens WHERE purpose='session'").all())check(users.has(row.userId));
  for(const row of db.prepare('SELECT * FROM synk_identity_links').all())check(users.has(row.company_user_id));
  for(const saved of db.prepare('SELECT * FROM synk_identity_sessions').all()){
   const e=decrypt(saved.ciphertext),t=db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='session'").get(saved.session_hash);
   check(t);const b=JSON.parse(t.body),l=db.prepare('SELECT * FROM synk_identity_links WHERE company_user_id=?').get(t.userId);
   check(e.version===1&&e.sessionHash===t.hash&&e.companyUserId===t.userId&&e.synkUserId===b.synkIdentity&&l&&l.synk_user_id===e.synkUserId&&l.revision===e.revision);
  }
  const {workspaceMediaNames}=await import(pathToFileURL(mediaModule));const canonical=workspaceMediaNames(db);check(Array.isArray(canonical));const nameSet=new Set(canonical),metadata=[];
  // Older accepted releases may not enumerate publication outputs or delivery
  // drafts. Union their documented storage owners without scanning arbitrary
  // document fields, notes or text, and without changing the release itself.
  const object=v=>{check(v&&typeof v==='object'&&!Array.isArray(v));return v;};
  const array=v=>{check(Array.isArray(v));return v;};
  const media=(v,optionalName=false)=>{object(v);if(optionalName&&v.diskName==null)return;check(typeof v.diskName==='string'&&v.diskName.length>0);nameSet.add(v.diskName);metadata.push({diskName:v.diskName,...(v.byteSize!==undefined?{byteSize:v.byteSize}:{}),...(v.sha256!==undefined?{sha256:v.sha256}:{})});};
  for(const row of docs){
   if(!['studioMedia','studioPublicationPackages','clientProjects','clientDeliveryDrafts'].includes(row.kind))continue;
   const v=object(JSON.parse(row.body));
   if(row.kind==='studioMedia')media(v);
   if(row.kind==='studioPublicationPackages')for(const output of array(v.outputs))media(output,true);
   if(row.kind==='clientProjects'){
    for(const version of array(v.versions)){object(version);if(version.media!=null)media(version.media);}
    if(v.studio!=null){object(v.studio);if(v.studio.assets!=null)for(const asset of array(v.studio.assets))media(asset);}
    if(v.intake!=null){object(v.intake);if(v.intake.files!=null)for(const file of array(v.intake.files))media(file);}
   }
   if(row.kind==='clientDeliveryDrafts')for(const item of array(v.items)){object(item);if(item.media!=null)media(item.media);}
  }
  console.log(JSON.stringify({credentialsChecked:credentials,names:[...nameSet],metadata}));
 }finally{db.close();}
})().catch(()=>{process.stderr.write('DATA_AUDIT_FAILED');process.exitCode=1;});
'''

def check_crypto_and_media(c):
    module=regular(pathlib.Path(c['releaseRoot'])/COMPANY_PATH/'workspace-media.mjs')
    result=json.loads(run([NODE,'-e',DATA_AUDIT_JS,str(pathlib.Path(c['companyVolume'])),str(module)],60))
    sizes={}
    for name in result['names']:
        require(isinstance(name,str) and re.fullmatch(r'[a-f0-9-]{36}\.(mp4|webm|png|jpg|srt|vtt|intake)',name,re.I),'MEDIA_NAME_INVALID')
        p=db_path(c,'studio-media/'+name);sizes[name]=p.stat().st_size
    for row in result['metadata']:
        if 'byteSize' in row:require(type(row['byteSize']) is int and row['byteSize']>=0 and sizes[row['diskName']]==row['byteSize'],'MEDIA_SIZE_MISMATCH')
        if 'sha256' in row:require(re.fullmatch(r'[a-f0-9]{64}',row['sha256']) and digest(db_path(c,'studio-media/'+row['diskName']))==row['sha256'],'MEDIA_HASH_MISMATCH')
    return {'credentialsChecked':result['credentialsChecked'],'workspaceMediaChecked':len(sizes)}
def check_data(c):
    check_mount(c);check_guards(c);check_release(c)
    require(not pathlib.Path(c['companyVolume'],'PREPARATION_INCOMPLETE').exists(),'RESTORE_NOT_ACCEPTED')
    key=db_path(c,'encryption.key');require(key.stat().st_size==32 and digest(key)==c['originalKeySha256'],'ORIGINAL_KEY_CHANGED')
    integration=json.loads(db_path(c,'workspace-integration.json').read_text());require(isinstance(integration,dict),'INTEGRATION_INVALID')
    for relative in ('company.sqlite','messenger/messenger.sqlite'):
        db=open_db(c,relative)
        try:
            require(db.execute('PRAGMA quick_check').fetchall()==[('ok',)],'DB_INTEGRITY')
            names={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            required=c['requiredTables'][relative];require(len(required)>=2 and set(required)<=names,'DB_SCHEMA')
            require(not db.execute('PRAGMA foreign_key_check').fetchmany(1),'DB_FOREIGN_KEYS')
            if relative.startswith('messenger/'):
                for name,size in db.execute("SELECT disk_name,size FROM files WHERE storage_provider='local'"):
                    require(isinstance(name,str) and re.fullmatch(r'[a-f0-9-]{36}\.bin',name,re.I),'FILE_PATH')
                    require(db_path(c,'messenger/uploads/'+name).stat().st_size==size,'ATTACHMENT_SIZE_MISMATCH')
        finally:db.close()
    a=open_db(c,'company.sqlite');b=open_db(c,'messenger/messenger.sqlite')
    try:
        users={r[0] for r in a.execute("SELECT id FROM documents WHERE kind='users'")};messenger={r[0] for r in b.execute('SELECT id FROM users')}
        links=integration.get('identityLinks');require(isinstance(links,list),'IDENTITY_LINKS_REQUIRED');seen_left=set();seen_right=set()
        for link in links:
            left,right=link.get('companyUserId'),link.get('messengerUserId')
            require(left in users and right in messenger and left not in seen_left and right not in seen_right,'IDENTITY_LINK_INVALID');seen_left.add(left);seen_right.add(right)
        require(not b.execute('SELECT 1 FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE u.id IS NULL LIMIT 1').fetchone(),'SESSION_OWNER_INVALID')
    finally:a.close();b.close()
    checked=check_crypto_and_media(c)
    registry=pathlib.Path(c['companyVolume'],'messenger/drive-storage.json')
    if registry.exists() or registry.is_symlink():require(isinstance(json.loads(db_path(c,'messenger/drive-storage.json').read_text()),dict),'DRIVE_REGISTRY_INVALID')
    return {'mountedDiskId':c['diskId'],'originalKeyMatches':True,'bothDbsIntegrityOk':True,'identityAndSessionsConsistent':True,'localFilesAccepted':True,'imagesAndEnvAccepted':True,**checked}

def fsync_directory(root):
    fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)

def durable_probe(root):
    # Only this root-owned health directory is written. Business DB schemas,
    # notes, users, sessions and application records are never probe targets.
    require(not root.is_symlink(),'HEALTH_DIRECTORY')
    root.mkdir(exist_ok=True,mode=0o700)
    require(root.stat().st_uid==0 and stat.S_IMODE(root.stat().st_mode)==0o700 and root.stat().st_dev==MOUNT.stat().st_dev,'HEALTH_DIRECTORY')
    p=root/(str(uuid.uuid4())+'.probe');final=p.with_suffix('.committed');payload=os.urandom(32)
    try:
        fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as f:f.write(payload);f.flush();os.fsync(f.fileno())
        p.rename(final);fsync_directory(root)
        require(final.read_bytes()==payload,'DURABLE_WRITE_READ')
    finally:
        for item in (p,final):
            if item.exists():item.unlink()
        fsync_directory(root)
    # Commit and reopen a bounded single-row probe DB on the same filesystem.
    # This is independent SQLite durability evidence, not an application commit.
    probe=root/'durability.sqlite'
    if not probe.exists():
        fd=os.open(probe,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
    require(not probe.is_symlink() and probe.stat().st_uid==0 and stat.S_IMODE(probe.stat().st_mode)==0o600,'HEALTH_DB_PERMISSIONS')
    for suffix in ('-journal','-wal','-shm'):
        side=pathlib.Path(str(probe)+suffix);require(not side.is_symlink(),'HEALTH_DB_SYMLINK')
    db=sqlite3.connect(probe.as_uri()+'?mode=rw',uri=True,timeout=2)
    try:
        require(db.execute('PRAGMA journal_mode=DELETE').fetchone()==('delete',),'HEALTH_DB_JOURNAL')
        db.execute('PRAGMA synchronous=FULL');require(db.execute('PRAGMA synchronous').fetchone()==(2,),'HEALTH_DB_SYNC')
        db.execute('CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY CHECK(id=1), payload BLOB NOT NULL)')
        db.execute('INSERT INTO probe VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',(payload,));db.commit()
    finally:db.close()
    fsync_directory(root)
    db=sqlite3.connect(probe.as_uri()+'?mode=ro',uri=True,timeout=2)
    try:require(db.execute('SELECT payload FROM probe WHERE id=1').fetchone()==(payload,),'HEALTH_DB_COMMIT_READBACK')
    finally:db.close()

def database_writable(c,relative):
    db=open_db(c,relative,write=True,timeout=2)
    try:
        require(db.execute('PRAGMA quick_check(1)').fetchone()==('ok',),'DB_NOT_READABLE')
        # mode=rw prohibits a missing database from being silently recreated.
        # A write-lock probe is deliberately rolled back without changing rows.
        db.execute('BEGIN IMMEDIATE');db.rollback()
    finally:db.close()

# Match the application's configured public Host even when probing loopback.
# Its Host guard runs before /api/health and rejects 127.0.0.1 with HTTP 403.
HEALTH_PROBE_JS=r'''
const {request}=require('node:http');
const origin=new URL(process.env.SYNK_COMPANY_ORIGIN),port=Number(process.env.SYNK_COMPANY_PORT||4191);
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!Number.isInteger(port)||port<1||port>65535)process.exit(1);
const req=request({hostname:'127.0.0.1',port,path:'/api/health',headers:{Host:origin.host,Accept:'application/json'},signal:AbortSignal.timeout(5000)},res=>{
 let raw='',bytes=0;res.on('data',part=>{bytes+=part.length;if(bytes>4096){res.destroy();process.exitCode=1;}else raw+=part;});
 res.on('error',()=>{process.exitCode=1;});
 res.on('end',()=>{try{if(res.statusCode!==200)throw Error();console.log(JSON.stringify(JSON.parse(raw)));}catch{process.exitCode=1;}});
});req.on('error',()=>{process.exitCode=1;});req.end();
'''

def durable_health(c):
    check_mount(c)
    # Reuse the validated Docker read only inside this action. Never cache it
    # across a tick, a stop/start boundary, or any operation that changes state.
    containers=check_guards(c,required_containers=True)
    for x in containers:
        state=x['State'];health=state.get('Health',{}).get('Status')
        require(state.get('Running') and not state.get('Paused') and not state.get('Restarting') and not state.get('Dead') and health in (None,'healthy'),'CONTAINER_NOT_READY')
        if x['Name'].lstrip('/')=='synk-company-company-1':require(health=='healthy','COMPANY_HEALTHCHECK_REQUIRED')
    durable_probe(MOUNT/'.ha-health')
    for relative in ('company.sqlite','messenger/messenger.sqlite'):database_writable(c,relative)
    health=json.loads(run(['docker','exec','synk-company-company-1','node','-e',HEALTH_PROBE_JS],10))
    require(health.get('ready') is True,'APPLICATION_NOT_READY')
    return {'durableHealthOk':True,'businessDbsWriteLockOk':True,'separateProbeCommitReadbackOk':True,'businessRowsModified':False}

def stop_stack(c):
    with finish_cleanup(),operation_budget(STOP_BUDGET_SECONDS):return _stop_stack(c)

def _stop_stack(c):
    names=[x['name'] for x in container_contract(c)]
    # Stop timers and oneshot units as well as Docker: otherwise the unit remains
    # active and a subsequent systemctl start would be a no-op, or a health timer
    # could restart the writer after ownership was revoked.
    units=[*TIMERS,
           'synk-company-health.service','synk-company-backup.service','synk-company-backup-watch.service',*reversed(UNITS)]
    failure=False
    try:run(['systemctl','stop',*units],UNIT_STOP_TIMEOUT_SECONDS)
    except Exception:failure=True
    existing=set(run(['docker','ps','-a','--format','{{.Names}}'],10).splitlines());selected=[n for n in names if n in existing]
    if selected:
        run(['docker','update','--restart=no',*selected],15);run(['docker','stop','--time','60',*selected],70)
        for x in json.loads(run(['docker','inspect',*selected],15)):
            require(not x['State'].get('Running') and not x['State'].get('Restarting') and x['HostConfig']['RestartPolicy']['Name']=='no','STOP_NOT_CONFIRMED')
    states=unit_properties(units,('ActiveState',),5)
    for unit in units:
        require(states[unit]['ActiveState'] in ('inactive','failed'),'UNIT_STOP_NOT_CONFIRMED')
    require(not failure,'UNIT_STOP_FAILED')
    return {'stopped':True,'containerStopConfirmed':True,'unitsStopConfirmed':True}

def start_stack(c,config_path):
    try:
        with operation_budget(START_BUDGET_SECONDS):
            # The guard obtains current GCS ownership itself. No cached local
            # success authorizes boot. It authenticates ownership BEFORE its
            # accept-data action mounts a promoted disk after a cold reboot.
            # A pre-guard check_data would permanently reject that valid boot.
            run([NODE,AGENT,'--check-start',config_path],120)
            check_data(c)
            for unit in UNITS:
                # Oneshoot RemainAfterExit may survive a manually stopped
                # container. Reset only this stale unit before starting it.
                if run(['systemctl','show',unit,'--property=ActiveState','--value'])=='active':
                    names=['synk-spaceship-spaceship-1'] if unit=='synk-spaceship.service' else ['synk-company-company-1','synk-company-https-1']
                    found={x['Name'].lstrip('/'):x['State'] for x in inspect_containers(c)}
                    def healthy(name):
                        s=found.get(name,{})
                        return s.get('Running') and not any(s.get(k) for k in ('Paused','Restarting','Dead')) and s.get('Health',{}).get('Status') in ((None,'healthy') if name!='synk-company-company-1' else ('healthy',))
                    if not all(healthy(name) for name in names):run(['systemctl','stop',unit],100)
                run(['systemctl','start',unit],180)
            # company-stack uses compose up --detach; systemd success does not
            # mean Docker's initial health check has completed yet.
            health_deadline=time.monotonic()+60
            while True:
                try:result=durable_health(c);break
                except Rejected as e:
                    if str(e) not in ('CONTAINER_NOT_READY','CONTAINER_MISSING','APPLICATION_NOT_READY') or time.monotonic()>=health_deadline:raise
                    time.sleep(min(2,max(.001,health_deadline-time.monotonic())))
            # stop_stack disables the active timers while fencing. Their enabled
            # boot setting alone does not resume backups after same-boot recovery.
            run(['systemctl','start',*TIMERS],30)
            return result|{'startCompleted':True,'maintenanceTimersResumed':True}
    except Exception:
        # Do not leave an unaccepted writer running after a partial start.
        stop_stack(c)
        raise
def main():
    require(len(sys.argv)==3 and os.geteuid()==0,'ROOT_AND_CONFIG_REQUIRED')
    c=private_json(sys.argv[1]);require(c.get('schema')=='synk-ha-node/v1','NODE_CONFIG')
    action=sys.argv[2]
    for s in (signal.SIGTERM,signal.SIGINT):signal.signal(s,cancel_operation)
    if action=='stop':return stop_stack(c)
    if action=='start':return start_stack(c,sys.argv[1])
    with operation_budget(CHECK_BUDGET_SECONDS):
        if action=='release':return check_release(c)
        if action=='guards':check_guards(c);return {'guardsAccepted':True}
        if action=='fence-proof':return replay_contract(c)
        if action=='accept-data':mount_candidate(c);return check_data(c)
        if action=='health':return durable_health(c)
    raise Rejected('ACTION_REJECTED')
if __name__=='__main__':
    try:print(json.dumps(main()))
    except Exception as e:
        print(json.dumps({'error':str(e) if isinstance(e,Rejected) else 'HOST_CHECK_FAILED'}));sys.exit(1)
