#!/usr/bin/env python3
"""Software-only, expected-bytes transaction for the HA deployment entry.

This is a building block, NOT a standalone live deploy command. Its coordinator
must retain both host flock leases, prove fresh cloud maintenance/sole ownership,
stop agents/writers, and invalidate controller acceptance before calling apply.
An executable CLI is intentionally absent until that complete adapter is tested.
The transaction changes no data, disk attachment, firewall, key, or account.
"""
import base64,hashlib,json,os,pathlib,re,stat,uuid

class Hold(Exception):pass
def require(v,code):
    if not v:raise Hold(code)
def digest(v):return hashlib.sha256(v).hexdigest()
def encode(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
NAMES=('synk-company.service','synk-spaceship.service','synk-company-health.service','synk-company-backup.service','synk-company-backup-watch.service')
GUARD_BASE='/opt/synk/ha/guards/'
NODE='/etc/synk/ha/node.json';PLAN='/etc/synk/ha/plan.json';ENV='/etc/synk/company.env';CURRENT='/opt/synk/current'

def image_environment(old,tag):
    require(re.fullmatch(r'synk-company(?:-[a-z0-9-]+)?:[a-f0-9]{12,64}',tag),'IMAGE_TAG')
    # Retain every non-image byte, line order, quote, key and newline exactly.
    lines=old.splitlines(keepends=True);found=[i for i,x in enumerate(lines) if x.startswith(b'SYNK_COMPANY_IMAGE=')]
    require(len(found)==1,'IMAGE_ENV_UNIQUE');i=found[0];line=lines[i]
    suffix=b'\r\n' if line.endswith(b'\r\n') else b'\n' if line.endswith(b'\n') else b''
    lines[i]=b'SYNK_COMPANY_IMAGE='+tag.encode()+suffix
    return b''.join(lines)

def validate_plan(old,new,manifest):
    require(old.get('armed') is False and new.get('armed') is False,'DISARMED_PLAN_REQUIRED')
    expected=json.loads(json.dumps(old));expected['release']['manifestSha256']=manifest
    expected['actualFailoverDrillPassed']=False
    require(new==expected,'PLAN_SCOPE_EXCEEDED')

def validate_node(old,new,manifest,env_sha,guard_files,image_id):
    allowed={'releaseRoot','releaseSha256','envFiles','guardFiles','containers'}
    require({k:v for k,v in old.items() if k not in allowed}=={k:v for k,v in new.items() if k not in allowed},'NODE_SCOPE_EXCEEDED')
    require(new['releaseRoot']=='/opt/synk/releases/'+manifest[:12] and new['releaseSha256']==manifest,'NEW_RELEASE_ROOT')
    require(old['activationAllowed'] is True and new['activationAllowed'] is True,'ACTIVATION_CONTRACT')
    envs=[{**x,'sha256':env_sha} if x['path']==ENV else x for x in old['envFiles']]
    require(new['envFiles']==envs and new['guardFiles']==guard_files,'NEW_ENV_GUARDS')
    images=[{**x,'imageId':image_id} if x['name']=='synk-company-company-1' else x for x in old['containers']]
    require(new['containers']==images and re.fullmatch(r'sha256:[a-f0-9]{64}',image_id),'NEW_IMAGES')

def approved_paths(c):
    base=GUARD_BASE+c['newGuardId'];require(re.fullmatch(r'[a-f0-9]{16}',c['newGuardId']),'GUARD_ID')
    require(c['oldReleaseSha256']!=c['newReleaseSha256'] and all(re.fullmatch(r'[a-f0-9]{64}',c[k]) for k in ('oldReleaseSha256','newReleaseSha256')),'NEW_RELEASE_REQUIRED')
    require(c['schema']=='synk-ha-software-transition/v1' and c['mode']=='company-release-only','TRANSITION_SCHEMA')
    require(c['dataRestoreAllowed'] is False and c['automaticRearm'] is False and c['schemaChangesAllowed'] is False,'PRESERVATION_CONTRACT')
    require(re.fullmatch(r'[a-f0-9]{32}',c['id']),'TRANSITION_ID')
    known={'cloud-common.sh','company-stack.sh','company-health.sh','company-backup.sh','company-backup-watch.sh','company-compose.yaml','spaceship-compose.yaml','spaceship-stack.sh','check-maintenance.mjs','maintenance-stage.sh'}
    sidecar={base+'/'+n for n in known}
    dropins={'/etc/systemd/system/'+n+'.d/50-synk-ha.conf' for n in NAMES}
    require(set(c['sidecars'])==sidecar and set(c['dropins'])==dropins,'GUARD_FILE_ALLOWLIST')
    for collection in (c['sidecars'],c['dropins']):
        for p,row in collection.items():
            body=base64.b64decode(row['base64'],validate=True)
            require(digest(body)==row['sha256'] and row['mode'] in (0o600,0o644,0o755),'CAPSULE_BYTES')
            if p in dropins:
                text=body.decode();require('ExecStartPre=/opt/synk/ha-runtime/node /opt/synk/ha/node-agent.mjs --check-start /etc/synk/ha/node.json\n' in text and base+'/' in text,'START_GUARD_REQUIRED')
                require('ignore_errors=yes' not in text and 'ExecStartPre=-' not in text,'FAIL_OPEN_DROPIN')
    return sidecar,dropins

class SoftwareTransaction:
    """Expected-file CAS, write-ahead journal and software-only recovery.

    `io` must be the protected production filesystem implementation below.
    `verify` is the coordinator's proof, executed before *every* replace, while
    the same exclusive lock is held. It verifies the current cloud generation,
    owner/epoch, controller disarm, stopped units and deadline. There is no
    default implementation and no bool shortcut.
    """
    def __init__(self,c,io,verify):
        self.c=c;self.io=io;self.verify=verify;self.state=None
        self.sidecars,self.dropins=approved_paths(c)
        self.journal='/opt/synk/ha-maintenance/transactions/'+c['id']+'.json'
    def save(self):self.io.atomic(self.journal,encode(self.state),0o600)
    def receipt(self):return {k:self.state[k] for k in ('schema','id','phase','newHashes','oldCurrent','newCurrent','written','applicationStarts','dataWrites','armed')}
    def material(self):
        c=self.c;old_node=json.loads(self.io.read(NODE));old_plan=json.loads(self.io.read(PLAN));old_env=self.io.read(ENV)
        require(all(self.io.mode(p)==0o600 for p in (NODE,PLAN,ENV)),'PRIVATE_CONFIGURATION_REQUIRED')
        require(digest(self.io.read(NODE))==c['oldNodeSha256'] and digest(self.io.read(PLAN))==c['oldPlanSha256'] and digest(old_env)==c['oldEnvironmentSha256'],'OLD_BYTES_CHANGED')
        require(self.io.link(CURRENT)=='/opt/synk/releases/'+c['oldReleaseSha256'][:12],'OLD_CURRENT_CHANGED')
        require(old_node['releaseSha256']==c['oldReleaseSha256']==old_plan['release']['manifestSha256'],'OLD_RELEASE_CHANGED')
        new_env=image_environment(old_env,c['newImageTag'])
        validate_plan(old_plan,c['newPlan'],c['newReleaseSha256'])
        validate_node(old_node,c['newNode'],c['newReleaseSha256'],digest(new_env),c['newGuardFiles'],c['newImageId'])
        expected={ENV:new_env,PLAN:encode(c['newPlan']),NODE:encode(c['newNode'])}
        for p,row in c['dropins'].items():
            require(digest(self.io.read(p))==row['oldSha256'],'OLD_DROPIN_CHANGED');expected[p]=base64.b64decode(row['base64'])
        # Every new guard target is pinned; unchanged original units/env/compose
        # remain pinned to their old bytes. No silently unlisted new sidecar.
        old_guard={x['path']:x['sha256'] for x in old_node['guardFiles']}
        new_guard={x['path']:x['sha256'] for x in c['newGuardFiles']}
        for p,h in new_guard.items():
            if p in c['sidecars']:require(h==c['sidecars'][p]['sha256'],'NEW_GUARD_BYTES')
            elif p in c['dropins']:require(h==c['dropins'][p]['sha256'],'NEW_DROPIN_BYTES')
            else:require(old_guard.get(p)==h and digest(self.io.read(p))==h,'UNEXPECTED_GUARD_CHANGED')
        require(self.sidecars<=set(new_guard) and self.dropins<=set(new_guard),'GUARD_PIN_INCOMPLETE')
        old_non_sidecar={p for p in old_guard if not p.startswith(GUARD_BASE)}
        require(old_non_sidecar<=set(new_guard),'ORIGINAL_GUARD_OMITTED')
        return expected
    def apply(self):
        require(not self.io.exists(self.journal),'TRANSACTION_ALREADY_ATTEMPTED');self.verify('before-apply')
        expected=self.material()
        # Candidate source/images and sidecars are staged and verified on BOTH
        # hosts before this method. This transaction never fetches or extracts.
        for p,row in self.c['sidecars'].items():require(digest(self.io.read(p))==row['sha256'],'STAGED_SIDECAR_CHANGED')
        self.io.verify_candidate(self.c)
        before={p:{'base64':base64.b64encode(self.io.read(p)).decode(),'sha256':digest(self.io.read(p)),'mode':self.io.mode(p)} for p in expected}
        self.state={'schema':'synk-ha-software-transaction/v1','id':self.c['id'],'contractSha256':digest(encode(self.c)),'phase':'prepared','before':before,'newHashes':{p:digest(b) for p,b in expected.items()},'oldCurrent':self.io.link(CURRENT),'newCurrent':self.c['newNode']['releaseRoot'],'written':[],'applicationStarts':0,'dataWrites':0,'armed':False}
        self.save()
        try:
            for p,body in expected.items():
                self.verify('before-replace');require(digest(self.io.read(p))==before[p]['sha256'],'CAS_FILE_CHANGED')
                self.state['intent']=p;self.save();self.io.atomic(p,body,before[p]['mode']);require(self.io.read(p)==body,'READBACK_FAILED');self.state['written'].append(p);self.save()
            self.verify('before-current');require(self.io.link(CURRENT)==self.state['oldCurrent'],'CURRENT_CAS_CHANGED')
            self.state['intent']=CURRENT;self.save();self.io.replace_link(CURRENT,self.state['newCurrent']);require(self.io.link(CURRENT)==self.state['newCurrent'],'CURRENT_READBACK_FAILED')
            self.state['written'].append(CURRENT);self.state['phase']='software-switched-writers-stopped';self.save();return self.receipt()
        except BaseException:
            # Record the ambiguous target, but never guess whether a failed
            # remote probe permits recovery. rollback() rechecks every input.
            self.state['phase']='hold-use-status-or-rollback';self.save();raise
    def rollback(self):
        if self.state is None:self.state=json.loads(self.io.read(self.journal))
        require(self.state['id']==self.c['id'] and self.state['contractSha256']==digest(encode(self.c)) and self.state['dataWrites']==0,'ROLLBACK_JOURNAL')
        self.verify('before-software-rollback')
        # Recovery is allowed only while writers are STOPPED on the CURRENT
        # regional disk. No snapshot/archive/original zonal disk is restored.
        for p,row in self.state['before'].items():
            require(digest(self.io.read(p)) in (row['sha256'],self.state['newHashes'][p]),'ROLLBACK_FOREIGN_BYTES')
        require(self.io.link(CURRENT) in (self.state['oldCurrent'],self.state['newCurrent']),'ROLLBACK_FOREIGN_CURRENT')
        for p,row in self.state['before'].items():
            self.verify('before-rollback-replace');body=base64.b64decode(row['base64']);require(digest(body)==row['sha256'],'ROLLBACK_BYTES')
            self.io.atomic(p,body,row['mode'])
        self.verify('before-rollback-current');self.io.replace_link(CURRENT,self.state['oldCurrent'])
        self.state['phase']='software-restored-current-regional-data-retained';self.state['intent']=None;self.save();return self.receipt()
    def resume(self):
        """Complete a known no-writer transaction after process/SSH loss."""
        if not self.io.exists(self.journal):return self.apply()
        self.state=json.loads(self.io.read(self.journal));s=self.state;c=self.c
        require(s['id']==c['id'] and s['contractSha256']==digest(encode(c)) and s['dataWrites']==0,'RESUME_JOURNAL')
        self.verify('before-software-resume');self.io.verify_candidate(c)
        old_env=base64.b64decode(s['before'][ENV]['base64']);expected={ENV:image_environment(old_env,c['newImageTag']),PLAN:encode(c['newPlan']),NODE:encode(c['newNode']),**{p:base64.b64decode(v['base64']) for p,v in c['dropins'].items()}}
        require({p:digest(b) for p,b in expected.items()}==s['newHashes'],'RESUME_TARGET_CHANGED')
        for p,body in expected.items():
            self.verify('before-resume-replace');actual=digest(self.io.read(p));require(actual in (s['before'][p]['sha256'],s['newHashes'][p]),'RESUME_FOREIGN_BYTES')
            if actual!=s['newHashes'][p]:s['intent']=p;self.save();self.io.atomic(p,body,s['before'][p]['mode'])
            require(self.io.read(p)==body,'RESUME_READBACK');
            if p not in s['written']:s['written'].append(p)
            self.save()
        self.verify('before-resume-current');require(self.io.link(CURRENT) in (s['oldCurrent'],s['newCurrent']),'RESUME_FOREIGN_CURRENT')
        self.io.replace_link(CURRENT,s['newCurrent']);
        if CURRENT not in s['written']:s['written'].append(CURRENT)
        s['phase']='software-switched-writers-stopped';s['intent']=None;self.save();return self.receipt()

class ProtectedFilesystem:
    """Concrete file adapter, instantiated only inside a verified host lease."""
    def __init__(self,c,run):
        require(os.geteuid()==0,'ROOT_REQUIRED')
        self.c=c;self.run=run;sidecars,dropins=approved_paths(c)
        self.mutable={NODE,PLAN,ENV,*dropins,'/opt/synk/ha-maintenance/transactions/'+c['id']+'.json'}
    def protected(self,p):
        p=pathlib.Path(p);s=p.lstat()
        require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'ROOT_FILE_REQUIRED')
        for parent in p.parents:
            t=parent.lstat();require(stat.S_ISDIR(t.st_mode) and t.st_uid==0 and not t.st_mode&0o022,'PROTECTED_PARENT_REQUIRED')
        return p
    def read(self,p):return self.protected(p).read_bytes()
    def exists(self,p):return pathlib.Path(p).exists() or pathlib.Path(p).is_symlink()
    def mode(self,p):return stat.S_IMODE(self.protected(p).stat().st_mode)
    def link(self,p):
        require(p==CURRENT,'LINK_PATH');f=pathlib.Path(p);require(f.is_symlink() and f.lstat().st_uid==0,'CURRENT_SYMLINK')
        target=str(f.resolve(strict=True));require(re.fullmatch(r'/opt/synk/releases/[a-f0-9]{12}',target),'CURRENT_TARGET');return target
    def atomic(self,p,body,mode):
        require(p in self.mutable,'WRITE_SCOPE');f=pathlib.Path(p)
        if self.exists(p):self.protected(p)
        for parent in f.parents:
            t=parent.lstat();require(stat.S_ISDIR(t.st_mode) and t.st_uid==0 and not t.st_mode&0o022,'PROTECTED_WRITE_PARENT')
        require(mode in (0o600,0o644,0o755),'FILE_MODE');tmp=f.with_name('.'+f.name+'.'+uuid.uuid4().hex)
        fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
        try:
            with os.fdopen(fd,'wb') as out:out.write(body);os.fchmod(out.fileno(),mode);out.flush();os.fsync(out.fileno())
            os.replace(tmp,f);directory=os.open(f.parent,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
        finally:
            if tmp.exists():tmp.unlink()
    def replace_link(self,p,target):
        require(p==CURRENT and target in ('/opt/synk/releases/'+self.c['oldReleaseSha256'][:12],'/opt/synk/releases/'+self.c['newReleaseSha256'][:12]),'LINK_WRITE_SCOPE')
        self.link(p);parent=pathlib.Path(p).parent;require(parent.stat().st_uid==0 and not parent.stat().st_mode&0o022,'LINK_PARENT')
        tmp=parent/('.current.'+uuid.uuid4().hex)
        try:
            os.symlink(target,tmp);os.replace(tmp,p);fd=os.open(parent,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(fd)
            finally:os.close(fd)
        finally:
            if tmp.is_symlink():tmp.unlink()
    def verify_candidate(self,c):
        root=pathlib.Path(c['newNode']['releaseRoot']);require(not root.is_symlink(),'CANDIDATE_LINK')
        raw=self.read(root/'release-manifest.json');require(digest(raw)==c['newReleaseSha256'],'CANDIDATE_MANIFEST')
        rows=json.loads(raw)['files'];require(len(rows)==c['newManifestFiles'] and len(rows)>100,'CANDIDATE_FILE_COUNT');seen=set()
        for row in rows:
            rel=pathlib.PurePosixPath(row['path']);require(not rel.is_absolute() and '..' not in rel.parts and row['path'] not in seen,'CANDIDATE_PATH')
            body=self.read(root/rel);require(len(body)==row['bytes'] and digest(body)==row['sha256'],'CANDIDATE_FILE_CHANGED');seen.add(row['path'])
        image=json.loads(self.run(['docker','image','inspect',c['newImageTag']],30))
        require(len(image)==1 and image[0]['Id']==c['newImageId'],'CANDIDATE_IMAGE_CHANGED')
        q=c['candidateQa'];require(re.fullmatch(r'/opt/synk/ha-maintenance/qa/[a-f0-9]{64}\.json',q['path']),'CANDIDATE_QA_PATH')
        raw=self.read(q['path']);require(digest(raw)==q['sha256'],'CANDIDATE_QA_BYTES');receipt=json.loads(raw)
        require(receipt['schema']=='synk-ha-reviewed-candidate/v1' and receipt['manifestSha256']==c['newReleaseSha256'] and receipt['imageId']==c['newImageId'] and receipt['linuxPassed'] is True and receipt['productionDataMounted'] is False and receipt['schemaChanges'] is False and receipt['rollbackCompatibleWithCurrentRegionalData'] is True,'CANDIDATE_QA_NOT_ACCEPTED')
        # The reviewed receipt itself lists immutable raw Linux/UI/data-contract
        # receipts. Pin their bytes; don't accept a free-floating boolean file.
        evidence=receipt['evidence'];require(len(evidence)>=3,'CANDIDATE_EVIDENCE_INCOMPLETE')
        for row in evidence:
            require(re.fullmatch(r'/opt/synk/ha-maintenance/qa/[a-f0-9]{64}\.json',row['path']),'EVIDENCE_PATH')
            require(digest(self.read(row['path']))==row['sha256'],'EVIDENCE_CHANGED')

# A real coordinator must supply checked file operations and verifier; importing
# this module cannot mutate production and executing it is deliberately denied.
if __name__=='__main__':raise SystemExit('USE_REVIEWED_HA_COORDINATOR_NOT_STANDALONE')
