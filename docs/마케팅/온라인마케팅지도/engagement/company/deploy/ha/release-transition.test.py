import base64,copy,importlib.util,json,os,pathlib,stat,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('transition',pathlib.Path(__file__).with_name('release-transition.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class IO:
    def __init__(self,files,current):self.files=files;self.current=current;self.fail_after=None;self.writes=0;self.current_regional_data=b'newer-live-data-never-restore';self.candidate_verified=False
    def read(self,p):return self.files[p]
    def exists(self,p):return p in self.files
    def mode(self,p):return 0o600 if p in (m.NODE,m.PLAN,m.ENV) else 0o644
    def link(self,p):return self.current
    def atomic(self,p,b,mode):
        self.files[p]=b;self.writes+=1
        if self.fail_after==self.writes:raise OSError('injected after replace')
    def replace_link(self,p,target):self.current=target
    def verify_candidate(self,c):self.candidate_verified=True
def fixture():
    old='a'*64;new='b'*64;oldbase=m.GUARD_BASE+'a'*16;newbase=m.GUARD_BASE+'b'*16
    filenames=('cloud-common.sh','company-stack.sh','company-health.sh','company-backup.sh','company-backup-watch.sh','company-compose.yaml','spaceship-compose.yaml','spaceship-stack.sh','check-maintenance.mjs','maintenance-stage.sh')
    oldguards={oldbase+'/'+n:b'old guard\n' for n in filenames};newguards={newbase+'/'+n:b'new guard\n' for n in filenames}
    drops={f'/etc/systemd/system/{n}.d/50-synk-ha.conf':b'old dropin\n' for n in m.NAMES}
    newdrop=(f'[Service]\nExecStartPre=/opt/synk/ha-runtime/node /opt/synk/ha/node-agent.mjs --check-start /etc/synk/ha/node.json\nExecStart={newbase}/company-stack.sh start\n').encode()
    env=b'OTHER_SECRET=never-print-this\nSYNK_COMPANY_IMAGE=synk-company-pulse:aaaaaaaaaaaa\n'
    plan={'armed':False,'actualFailoverDrillPassed':True,'release':{'manifestSha256':old},'preserve':'yes'}
    node={'activationAllowed':True,'nodeId':'primary','diskId':'unchanged','filesystemUuid':'unchanged','requiredTables':{'db':['old']},'releaseRoot':'/opt/synk/releases/'+old[:12],'releaseSha256':old,'envFiles':[{'path':m.ENV,'sha256':m.digest(env)}],'containers':[{'name':'synk-company-company-1','imageId':'sha256:'+old},{'name':'https','imageId':'sha256:'+old},{'name':'spaceship','imageId':'sha256:'+old}],'guardFiles':[{'path':p,'sha256':m.digest(b)} for p,b in {**oldguards,**drops}.items()]}
    np=copy.deepcopy(plan);np['release']['manifestSha256']=new;np['actualFailoverDrillPassed']=False
    nn=copy.deepcopy(node);nn['releaseSha256']=new;nn['releaseRoot']='/opt/synk/releases/'+new[:12];nn['containers'][0]['imageId']='sha256:'+new;nn['envFiles'][0]['sha256']=m.digest(m.image_environment(env,'synk-company-pulse:bbbbbbbbbbbb'))
    nn['guardFiles']=[{'path':p,'sha256':m.digest(b)} for p,b in {**newguards,**{p:newdrop for p in drops}}.items()]
    files={m.ENV:env,m.NODE:m.encode(node),m.PLAN:m.encode(plan),**oldguards,**newguards,**drops}
    c={'schema':'synk-ha-software-transition/v1','mode':'company-release-only','id':'f'*32,'newGuardId':'b'*16,'oldReleaseSha256':old,'newReleaseSha256':new,'dataRestoreAllowed':False,'automaticRearm':False,'schemaChangesAllowed':False,'oldNodeSha256':m.digest(files[m.NODE]),'oldPlanSha256':m.digest(files[m.PLAN]),'oldEnvironmentSha256':m.digest(env),'newImageTag':'synk-company-pulse:bbbbbbbbbbbb','newImageId':'sha256:'+new,'newNode':nn,'newPlan':np,'newGuardFiles':nn['guardFiles'],'sidecars':{p:{'sha256':m.digest(b),'base64':base64.b64encode(b).decode(),'mode':0o755} for p,b in newguards.items()},'dropins':{p:{'oldSha256':m.digest(b),'sha256':m.digest(newdrop),'base64':base64.b64encode(newdrop).decode(),'mode':0o644} for p,b in drops.items()}}
    io=IO(files,node['releaseRoot']);calls=[];t=m.SoftwareTransaction(c,io,lambda phase:calls.append(phase));return c,io,t,calls
class Tests(unittest.TestCase):
    def test_apply_and_software_only_rollback(self):
        c,io,t,calls=fixture();before=copy.deepcopy(io.files);data=io.current_regional_data;r=t.apply()
        self.assertEqual(r['phase'],'software-switched-writers-stopped');self.assertTrue(io.candidate_verified);self.assertNotIn('before',r);self.assertNotIn('never-print-this',json.dumps(r));self.assertEqual(io.current,c['newNode']['releaseRoot'])
        io.current_regional_data=b'even-newer-regional-data';r=t.rollback();self.assertEqual(r['phase'],'software-restored-current-regional-data-retained');self.assertEqual(io.current_regional_data,b'even-newer-regional-data')
        for p,b in before.items():self.assertEqual(io.files[p],b)
        self.assertGreater(len(calls),15)
    def test_expected_parent_drift_blocks_before_write(self):
        c,io,t,_=fixture();io.files[m.ENV]+=b'other=change\n'
        with self.assertRaisesRegex(m.Hold,'OLD_BYTES_CHANGED'):t.apply()
        self.assertEqual(io.writes,0)
    def test_data_or_key_configuration_change_rejected(self):
        for key in ('diskId','filesystemUuid','requiredTables'):
            c,io,t,_=fixture();c['newNode'][key]='changed'
            with self.assertRaisesRegex(m.Hold,'NODE_SCOPE_EXCEEDED'):t.apply()
            self.assertEqual(io.writes,0)
    def test_arming_or_unrelated_plan_change_rejected(self):
        for key,value in (('armed',True),('preserve','changed')):
            c,io,t,_=fixture();c['newPlan'][key]=value
            with self.assertRaises(m.Hold):t.apply()
            self.assertEqual(io.writes,0)
    def test_sidecar_missing_fails_before_write(self):
        c,io,t,_=fixture();io.files[next(iter(c['sidecars']))]=b'changed'
        with self.assertRaisesRegex(m.Hold,'STAGED_SIDECAR_CHANGED'):t.apply()
        self.assertEqual(io.writes,0)
    def test_foreign_changes_block_rollback(self):
        c,io,t,_=fixture();t.apply();io.files[m.NODE]=b'foreign'
        with self.assertRaisesRegex(m.Hold,'ROLLBACK_FOREIGN_BYTES'):t.rollback()
    def test_fail_after_replace_can_restore_from_durable_journal(self):
        c,io,t,_=fixture();before=copy.deepcopy(io.files);io.fail_after=3
        with self.assertRaises(OSError):t.apply()
        io.fail_after=None;t2=m.SoftwareTransaction(c,io,lambda phase:None);t2.rollback()
        for p,b in before.items():self.assertEqual(io.files[p],b)
    def test_ownership_verifier_failure_leaves_no_writes(self):
        c,io,t,_=fixture()
        def deny(phase):raise m.Hold('OWNER_EPOCH_CHANGED')
        t.verify=deny
        with self.assertRaisesRegex(m.Hold,'OWNER_EPOCH_CHANGED'):t.apply()
        self.assertEqual(io.writes,0)
    def test_arbitrary_target_rejected(self):
        c,io,t,_=fixture();c['dropins']['/etc/shadow']=c['dropins'].pop(next(iter(c['dropins'])))
        with self.assertRaisesRegex(m.Hold,'GUARD_FILE_ALLOWLIST'):m.SoftwareTransaction(c,io,lambda phase:None)
    def test_only_image_environment_line_changes(self):
        raw=b'A="hidden"\r\nSYNK_COMPANY_IMAGE=old\r\nB=keep'
        self.assertEqual(m.image_environment(raw,'synk-company:aaaaaaaaaaaa'),b'A="hidden"\r\nSYNK_COMPANY_IMAGE=synk-company:aaaaaaaaaaaa\r\nB=keep')
    def test_invalid_image_tag_and_duplicate_line(self):
        for raw,tag in ((b'SYNK_COMPANY_IMAGE=x\n','$(run)'),(b'SYNK_COMPANY_IMAGE=x\nSYNK_COMPANY_IMAGE=y','synk-company:aaaaaaaaaaaa')):
            with self.assertRaises(m.Hold):m.image_environment(raw,tag)
    def test_transaction_replay_rejected(self):
        c,io,t,_=fixture();t.apply()
        with self.assertRaisesRegex(m.Hold,'TRANSACTION_ALREADY_ATTEMPTED'):t.apply()
@unittest.skipUnless(os.name=='posix','Real POSIX file modes require Linux/Unix')
class AtomicFileTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='transition-atomic-',dir=pathlib.Path(__file__).resolve().parent)
        self.addCleanup(self.directory.cleanup)
        self.root=pathlib.Path(self.directory.name)
        self.target=self.root/'fixture.conf'
        self.io=object.__new__(m.ProtectedFilesystem);self.io.mutable={str(self.target)}
        self.previous_umask=os.umask(0o077);self.addCleanup(os.umask,self.previous_umask)
    def original(self,mode=0o644):
        self.target.write_bytes(b'original bytes\n');self.target.chmod(mode)
    def unchanged(self,mode=0o644):
        self.assertEqual(self.target.read_bytes(),b'original bytes\n')
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode),mode)
        self.assertEqual(set(self.root.iterdir()),{self.target})
    def test_real_atomic_preserves_requested_modes_under_private_umask(self):
        for mode in (0o644,0o600,0o755):
            with self.subTest(mode=oct(mode)):
                self.original(mode)
                self.io.atomic(str(self.target),b'replacement bytes\n',mode)
                self.assertEqual(self.target.read_bytes(),b'replacement bytes\n')
                self.assertEqual(stat.S_IMODE(self.target.stat().st_mode),mode)
                self.assertEqual(set(self.root.iterdir()),{self.target})
    def test_permission_failure_keeps_original_target_and_removes_temporary(self):
        self.original()
        with patch.object(m.os,'fchmod',side_effect=OSError('injected chmod failure')):
            with self.assertRaisesRegex(OSError,'injected chmod failure'):
                self.io.atomic(str(self.target),b'replacement bytes\n',0o644)
        self.unchanged()
    def test_replace_failure_keeps_original_target_and_removes_temporary(self):
        self.original(0o600)
        with patch.object(m.os,'replace',side_effect=OSError('injected replace failure')):
            with self.assertRaisesRegex(OSError,'injected replace failure'):
                self.io.atomic(str(self.target),b'replacement bytes\n',0o644)
        self.unchanged(0o600)
    def test_symlink_target_is_rejected_without_changing_referenced_file(self):
        original=self.root/'retained';original.write_bytes(b'retained bytes\n')
        self.target.symlink_to(original)
        with self.assertRaisesRegex(m.Hold,'ROOT_FILE_REQUIRED'):
            self.io.atomic(str(self.target),b'replacement bytes\n',0o644)
        self.assertEqual(original.read_bytes(),b'retained bytes\n')
        self.assertTrue(self.target.is_symlink())
        self.assertEqual(set(self.root.iterdir()),{self.target,original})

if __name__=='__main__':unittest.main()
