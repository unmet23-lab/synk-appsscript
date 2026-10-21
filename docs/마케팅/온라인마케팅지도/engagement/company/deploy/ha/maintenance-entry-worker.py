#!/usr/bin/env python3
"""Root-owned, fixed-protocol same-release checks under an exclusive flock.

No command, path, environment patch, release switch, start/stop or data restore
can be requested over stdin. Only proof and finish with exact GCS receipts are
accepted. The caller handles the controller and maintenance CAS. EOF, timeout
and signals terminate/join probe children before releasing the deployment lock.
"""
import ctypes,datetime,fcntl,hashlib,importlib.util,json,os,pathlib,re,signal,stat,subprocess,sys,time,urllib.parse,urllib.request
sys.dont_write_bytecode=True
BASE=pathlib.Path('/opt/synk/ha-maintenance')
LOCK=pathlib.Path('/run/lock/synk-ha-deploy.lock')
CONFIG=pathlib.Path('/etc/synk/ha/node.json')
PLAN=pathlib.Path('/etc/synk/ha/plan.json')
RUNTIME=pathlib.Path('/opt/synk/ha')
class Hold(Exception):pass
def require(v,code):
    if not v:raise Hold(code)
def sha(v):return hashlib.sha256(v).hexdigest()
def file_sha(p):return sha(pathlib.Path(p).read_bytes())
def protected(p,private=False):
    p=pathlib.Path(p);s=p.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'ROOT_FILE_REQUIRED')
    if private:require(stat.S_IMODE(s.st_mode)==0o600,'PRIVATE_CONTRACT_REQUIRED')
    for parent in p.parents:
        t=parent.lstat();require(stat.S_ISDIR(t.st_mode) and t.st_uid==0 and not t.st_mode&0o022,'PROTECTED_PARENT_REQUIRED')
    return p
def cancel(*unused):raise Hold('WORKER_CANCELLED')
def finish_group(child):
    handlers={s:signal.getsignal(s) for s in (signal.SIGTERM,signal.SIGINT,signal.SIGALRM)}
    for s in handlers:signal.signal(s,signal.SIG_IGN)
    try:
        for sig,budget in ((signal.SIGTERM,2),(signal.SIGKILL,3)):
            try:os.killpg(child.pid,sig)
            except ProcessLookupError:break
            end=time.monotonic()+budget
            while time.monotonic()<end:
                child.poll()
                # PR_SET_CHILD_SUBREAPER adopts grandchildren if their parent
                # exits first. Reap the exact group without touching other jobs.
                try:
                    while os.waitpid(-child.pid,os.WNOHANG)[0]:pass
                except ChildProcessError:pass
                try:os.killpg(child.pid,0)
                except ProcessLookupError:return
                time.sleep(.02)
        child.wait(timeout=2)
        try:os.killpg(child.pid,0)
        except ProcessLookupError:return
        raise Hold('PROBE_CHILD_GROUP_NOT_JOINED')
    finally:
        for stream in (child.stdin,child.stdout,child.stderr):
            if stream is not None:stream.close()
        for s,h in handlers.items():signal.signal(s,h)
def joined_run(args,timeout=30):
    """Bounded fixed probe only. Never return while its process group survives."""
    child=None
    try:
        require(ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)==0,'SUBREAPER_REQUIRED')
        previous=signal.pthread_sigmask(signal.SIG_BLOCK,{signal.SIGTERM,signal.SIGINT,signal.SIGALRM})
        try:child=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True,preexec_fn=lambda:signal.pthread_sigmask(signal.SIG_SETMASK,previous))
        finally:signal.pthread_sigmask(signal.SIG_SETMASK,previous)
        out,err=child.communicate(timeout=timeout)
        require(child.returncode==0,'PROBE_COMMAND_FAILED');finish_group(child);return out.strip()
    except BaseException:
        if child is not None:
            finish_group(child)
        raise
def fetch(url,headers):
    request=urllib.request.Request(url,headers=headers)
    # All endpoints below are literal, authenticated resources. Never follow a
    # redirect carrying a metadata token to another origin.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    with urllib.request.build_opener(NoRedirect).open(request,timeout=10) as r:
        body=r.read(1048577);require(len(body)<=1048576,'RESPONSE_SIZE');return body,dict(r.headers)
def meta(path):
    b,h=fetch('http://169.254.169.254/computeMetadata/v1/'+path,{'Metadata-Flavor':'Google'})
    require(next((v for k,v in h.items() if k.lower()=='metadata-flavor'),None)=='Google','METADATA_HEADER');return b
def cloud(c,expected):
    require(meta('project/project-id').decode().strip()==c['project'] and meta('instance/id').decode().strip()==c['ownerId'],'CLOUD_IDENTITY')
    token=json.loads(meta('instance/service-accounts/default/token'))['access_token'];headers={'Authorization':'Bearer '+token}
    q=c['control'];url='https://storage.googleapis.com/storage/v1/b/'+q['bucket']+'/o/'+urllib.parse.quote(q['object'],safe='')
    m=json.loads(fetch(url,headers)[0]);require(str(m['generation'])==expected['generation'],'CONTROL_GENERATION_CHANGED')
    body=fetch(url+'?alt=media&generation='+expected['generation'],headers)[0]
    require(sha(body)==expected['sha256'] and json.loads(body)==expected['value'],'CONTROL_BYTES_CHANGED')
    s=expected['value'];require(s['schema']=='synk-ha-control/v1' and s['project']==c['project'] and s['activeId']==c['ownerId'] and s['activeEpoch']==c['activeEpoch'],'OWNER_CHANGED')
    require(s['bootAllowed']==[c['ownerId']] and s['readyAllowed']==[c['ownerId']] and all(not s.get(k) for k in ('operation','command','api','runner')),'OWNER_PERMISSIONS')
    require(s['maintenanceUntil']==0 or time.time()*1000<s['maintenanceUntil']<=c['expiresAt'],'MAINTENANCE_EXPIRED')
    prefix='https://compute.googleapis.com/compute/v1/projects/'+c['project']
    vm=json.loads(fetch(prefix+'/zones/asia-northeast3-a/instances/synk-company-1',headers)[0])
    disk=json.loads(fetch(prefix+'/regions/asia-northeast3/disks/synk-company-data-ha',headers)[0])
    owner='https://www.googleapis.com/compute/v1/projects/'+c['project']+'/zones/asia-northeast3-a/instances/synk-company-1'
    require(str(vm['id'])==c['ownerId'] and vm['status']=='RUNNING' and str(disk['id'])==c['data']['diskId'] and disk.get('users')==[owner],'CLOUD_SOLE_OWNER_REQUIRED')
    attached=[x for x in vm['disks'] if x['source']==disk['selfLink']]
    require(len(attached)==1 and attached[0]['mode']=='READ_WRITE' and not attached[0]['boot'] and not attached[0]['autoDelete'],'DATA_ATTACHMENT_CHANGED')
def baseline(c):
    require(file_sha(protected(CONFIG,True))==c['nodeConfigSha256'] and file_sha(protected(PLAN,True))==c['planSha256'],'LOCAL_CONFIG_CHANGED')
    node=json.loads(CONFIG.read_text());plan=json.loads(PLAN.read_text())
    require(node['activationAllowed'] is True and plan['armed'] is False,'ACTIVATED_DISARMED_REQUIRED')
    require(node['nodeId']==c['ownerId'] and node['releaseSha256']==c['oldReleaseSha256']==c['candidateReleaseSha256']==plan['release']['manifestSha256'],'RELEASE_CHANGED')
    require(node['containers']==c['images'] and node['guardFiles']==c['guards'],'GUARD_OR_IMAGE_CONTRACT_CHANGED')
    require(node['diskId']==c['data']['diskId'] and node['filesystemUuid']==c['data']['filesystemUuid'],'DATA_CONTRACT_CHANGED')
    require(pathlib.Path('/opt/synk/current').resolve(strict=True)==pathlib.Path(node['releaseRoot']),'CURRENT_CHANGED')
    for name,h in c['runtime'].items():require(file_sha(protected(RUNTIME/name))==h,'RUNTIME_CHANGED')
    require(node['helperPath']==str(RUNTIME/'node-host.py'),'HELPER_PATH')
    spec=importlib.util.spec_from_file_location('same_release_host',RUNTIME/'node-host.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    helper.run=joined_run
    helper.check_data(node)
    rows=helper.inspect_containers(node,required=True)
    result={}
    for row in rows:
        s=row['State'];require(s['Running'] and not s.get('Paused') and not s.get('Restarting') and s.get('Health',{}).get('Status') in (None,'healthy'),'APP_NOT_HEALTHY')
        result[row['Name']]={k:s[k] for k in ('Pid','StartedAt')};result[row['Name']]['id']=row['Id'];result[row['Name']]['image']=row['Image']
    return result
def lock_open():
    # /run/lock commonly has sticky world-write permissions. O_NOFOLLOW and
    # fstat bind the exact lock inode; only a root-owned regular file is valid.
    require(LOCK.parent.resolve()==LOCK.parent and LOCK.parent.is_dir(),'LOCK_PARENT')
    fd=os.open(LOCK,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600);s=os.fstat(fd)
    try:
        require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'LOCK_OWNER')
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise Hold('DEPLOY_LOCK_BUSY')
    except BaseException:os.close(fd);raise
    return fd
def main():
    require(os.geteuid()==0 and len(sys.argv)==3,'ROOT_CONTRACT_REQUIRED')
    p=pathlib.Path(sys.argv[1]);require(p.parent==BASE/'contracts' and re.fullmatch(r'[a-f0-9]{32}\.json',p.name),'CONTRACT_PATH')
    raw=protected(p,True).read_bytes();require(sha(raw)==sys.argv[2],'CONTRACT_SHA');c=json.loads(raw)
    require(c['schema']=='synk-ha-maintenance-rehearsal/v1' and c['action']=='same-release-noop' and c['id']==p.stem,'CONTRACT_SCHEMA')
    require(c['workerSha256']==file_sha(protected(__file__)),'WORKER_BYTES_CHANGED')
    now=time.time()*1000;require(c['createdAt']<=now<c['expiresAt'] and c['expiresAt']-c['createdAt']<=600000,'CONTRACT_EXPIRED')
    for s in (signal.SIGTERM,signal.SIGINT,signal.SIGALRM):signal.signal(s,cancel)
    signal.setitimer(signal.ITIMER_REAL,(c['expiresAt']-now)/1000)
    held=lock_open()
    try:
        initial=baseline(c);print(json.dumps({'phase':'locked','contractSha256':sha(raw),'containers':initial}),flush=True)
        for line in sys.stdin:
            require(len(line)<=1048576,'MESSAGE_SIZE');m=json.loads(line)
            require(set(m)=={'phase','record'} and m['phase'] in ('proof','finish'),'FIXED_PROTOCOL_ONLY')
            cloud(c,m['record']);require(baseline(c)==initial,'APPLICATION_PROCESS_CHANGED');cloud(c,m['record'])
            if m['phase']=='finish':require(m['record']['value']['maintenanceUntil']==0,'LEAVE_NOT_PROVEN')
            print(json.dumps({'phase':m['phase'],'ownerId':c['ownerId'],'epoch':c['activeEpoch'],'containersUnchanged':True,'releaseGuardsConfigUnchanged':True,'dataAccepted':True,'businessWriteCommands':0}),flush=True)
            if m['phase']=='finish':return
        raise Hold('CONTROL_CHANNEL_CLOSED')
    finally:signal.setitimer(signal.ITIMER_REAL,0);os.close(held)
if __name__=='__main__':
    try:main()
    except BaseException as e:
        print(json.dumps({'phase':'hold','code':str(e) if isinstance(e,Hold) else type(e).__name__}),flush=True);sys.exit(1)
