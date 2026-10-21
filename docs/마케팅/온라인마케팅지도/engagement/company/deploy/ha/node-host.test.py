"""Local synthetic data tests. No cloud calls, Docker mutation or real unit start."""
import importlib.util,json,pathlib,sqlite3,tempfile,unittest,shutil,subprocess,os,hashlib,signal,sys
from unittest.mock import patch

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ha_host',HERE/'node-host.py')
host=importlib.util.module_from_spec(spec);spec.loader.exec_module(host)
REPO=pathlib.Path(os.environ['SYNK_HA_TEST_RELEASE_ROOT']) if os.environ.get('SYNK_HA_TEST_RELEASE_ROOT') else HERE.parents[6]
NODE=os.environ.get('SYNK_HA_TEST_NODE') or shutil.which('node')

def config():
    return {'activationAllowed':True,'units':list(host.UNITS),'containers':[{'name':name,'imageId':'sha256:'+str(i+1)*64} for i,name in enumerate(host.CONTAINERS)]}

def snapshots(c,running=True,restart='no'):
    return [{'Name':'/'+x['name'],'Image':x['imageId'],'State':{'Running':running,'Health':{'Status':'healthy'}},'HostConfig':{'RestartPolicy':{'Name':restart}}} for x in c['containers']]

def unit_rows(args,**values):
    fields=next(x.split('=',1)[1].split(',') for x in args if x.startswith('--property='))
    units=[x for x in args[2:] if not x.startswith('--')]
    return '\n\n'.join('\n'.join(k+'='+({'Id':unit,'LoadState':'loaded'}|values)[k] for k in fields) for unit in units)

class DataTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.mount=pathlib.Path(self.temp.name).resolve();self.root=self.mount/'company';self.root.mkdir()
        (self.root/'messenger/uploads').mkdir(parents=True);(self.root/'studio-media').mkdir()
        self.addCleanup(patch.stopall);patch.object(host,'MOUNT',self.mount).start();patch.object(host,'NODE',NODE).start()
        for name in ('check_mount','check_guards','check_release'):patch.object(host,name).start()
        self.c=config()|{'companyVolume':str(self.root),'releaseRoot':str(REPO),'diskId':'fixture-disk','requiredTables':{'company.sqlite':['documents','credentials','tokens','synk_identity_links','synk_identity_sessions'],'messenger/messenger.sqlite':['users','sessions','files']}}
        key=bytes(range(32));(self.root/'encryption.key').write_bytes(key);self.c['originalKeySha256']=hashlib.sha256(key).hexdigest()
        (self.root/'workspace-integration.json').write_text(json.dumps({'identityLinks':[{'companyUserId':'company-user','messengerUserId':'messenger-user'}]}))
        self.a=sqlite3.connect(self.root/'company.sqlite');self.b=sqlite3.connect(self.root/'messenger/messenger.sqlite')
        self.addCleanup(self.a.close);self.addCleanup(self.b.close)
        self.a.executescript('CREATE TABLE documents (kind TEXT,id TEXT,body TEXT,PRIMARY KEY(kind,id)); CREATE TABLE credentials(id TEXT,ciphertext TEXT); CREATE TABLE tokens(hash TEXT PRIMARY KEY,purpose TEXT,userId TEXT,body TEXT,expiresAt TEXT); CREATE TABLE synk_identity_links(synk_user_id TEXT,company_user_id TEXT,revision TEXT); CREATE TABLE synk_identity_sessions(session_hash TEXT REFERENCES tokens(hash),ciphertext TEXT);')
        self.b.executescript('CREATE TABLE users(id TEXT PRIMARY KEY); CREATE TABLE sessions(user_id TEXT); CREATE TABLE files(disk_name TEXT,storage_provider TEXT,size INTEGER); INSERT INTO users VALUES (\'messenger-user\'); INSERT INTO sessions VALUES (\'messenger-user\');')
        self.doc('users','company-user',{'id':'company-user','active':True})
        self.a.execute('INSERT INTO credentials VALUES (?,?)',('fixture',self.encrypt({'synthetic':'credential'})))
        self.a.execute('INSERT INTO tokens VALUES (?,?,?,?,?)',('session','session','company-user',json.dumps({'synkIdentity':'synk-user'}),'2099-01-01'))
        self.a.execute('INSERT INTO synk_identity_links VALUES (?,?,?)',('synk-user','company-user','revision'))
        self.a.execute('INSERT INTO synk_identity_sessions VALUES (?,?)',('session',self.encrypt({'version':1,'sessionHash':'session','companyUserId':'company-user','synkUserId':'synk-user','revision':'revision'})))
        self.names=[]
        for i in range(7):
            name=str(i+1)*8+'-1111-1111-1111-'+str(i+1)*12+'.'+('intake' if i==4 else 'mp4')
            (self.root/'studio-media'/name).write_bytes(b'synthetic-media');self.names.append(name)
        metadata=lambda i:{'diskName':self.names[i],'byteSize':15}
        self.doc('studioMedia','media',metadata(0))
        self.doc('studioPublicationPackages','package',{'outputs':[metadata(1)]})
        self.doc('clientProjects','project',{'versions':[{'media':metadata(2)}],'studio':{'assets':[metadata(3)]},'intake':{'files':[metadata(4)]}})
        self.doc('clientDeliveryDrafts','draft',{'items':[{'media':metadata(5)}]})
        # Intentionally unreferenced source is retained, not counted or deleted.
        self.upload='aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa.bin';(self.root/'messenger/uploads'/self.upload).write_bytes(b'attachment')
        self.b.execute('INSERT INTO files VALUES (?,?,?)',(self.upload,'local',10));self.a.commit();self.b.commit()

    def encrypt(self,value):
        script="const {createCipheriv}=require('node:crypto'),k=Buffer.from(Array.from({length:32},(_,i)=>i)),iv=Buffer.alloc(12,1),c=createCipheriv('aes-256-gcm',k,iv);const b=Buffer.concat([c.update(process.argv[1]),c.final()]);console.log(Buffer.concat([iv,c.getAuthTag(),b]).toString('base64'));"
        return subprocess.check_output([NODE,'-e',script,json.dumps(value)]).decode().strip()

    def doc(self,kind,id,body):self.a.execute('INSERT OR REPLACE INTO documents VALUES (?,?,?)',(kind,id,json.dumps(body)))
    def accepted(self):return host.check_data(self.c)
    def reject(self,code):
        with self.assertRaisesRegex(host.Rejected,code):self.accepted()

    def test_all_canonical_media_and_crypto_checked_without_changing_data(self):
        before={str(p.relative_to(self.root)):host.digest(p) for p in self.root.rglob('*') if p.is_file()}
        result=self.accepted();self.assertEqual(result['workspaceMediaChecked'],6);self.assertEqual(result['credentialsChecked'],2)
        self.assertEqual(before,{str(p.relative_to(self.root)):host.digest(p) for p in self.root.rglob('*') if p.is_file()})

    def test_each_media_owner_missing_file_blocks_acceptance(self):
        for name in self.names[:6]:
            with self.subTest(name=name):
                p=self.root/'studio-media'/name;p.unlink()
                with self.assertRaises(FileNotFoundError):self.accepted()
                p.write_bytes(b'synthetic-media')

    def test_legacy_release_enumerator_cannot_hide_newer_stored_owners(self):
        release=self.mount/'legacy-release';module=release/host.COMPANY_PATH/'workspace-media.mjs';module.parent.mkdir(parents=True)
        module.write_text('export function workspaceMediaNames(){return '+json.dumps([self.names[i] for i in (0,2,3,4)])+';}')
        self.c['releaseRoot']=str(release)
        self.assertEqual(self.accepted()['workspaceMediaChecked'],6)
        for i in (1,5):
            with self.subTest(owner=i):
                p=self.root/'studio-media'/self.names[i];p.unlink()
                with self.assertRaises(FileNotFoundError):self.accepted()
                p.write_bytes(b'synthetic-media')

    def test_new_owner_schema_must_be_an_array_not_arbitrary_text(self):
        for kind,body in [('studioPublicationPackages',{'outputs':'not-an-array'}),('clientDeliveryDrafts',{'items':{'media':'not-an-array'}})]:
            with self.subTest(kind=kind):
                self.doc(kind,'malformed',body);self.a.commit();self.reject('HOST_COMMAND_FAILED')
                self.a.execute('DELETE FROM documents WHERE id=?',('malformed',));self.a.commit()

    def test_unrelated_document_and_note_disk_names_are_not_media_owners(self):
        self.doc('notes','private',{'diskName':'unrelated','body':'diskName: not-a-file'})
        self.doc('clientProjects','project',{'versions':[{'media':{'diskName':self.names[2]}}],'studio':{'assets':[{'diskName':self.names[3]}]},'intake':{'files':[{'diskName':self.names[4]}]},'notes':{'diskName':'not-an-owner'}});self.a.commit()
        self.assertEqual(self.accepted()['workspaceMediaChecked'],6)

    def test_media_size_mismatch(self):
        (self.root/'studio-media'/self.names[0]).write_bytes(b'cut');self.reject('MEDIA_SIZE_MISMATCH')

    def test_media_hash_mismatch(self):
        self.doc('studioMedia','media',{'diskName':self.names[0],'sha256':'0'*64});self.a.commit();self.reject('MEDIA_HASH_MISMATCH')

    def test_media_traversal_rejected(self):
        self.doc('studioMedia','media',{'diskName':'../encryption.key'});self.a.commit();self.reject('MEDIA_NAME_INVALID')

    def test_original_key_mismatch(self):
        (self.root/'encryption.key').write_bytes(b'x'*32);self.reject('ORIGINAL_KEY_CHANGED')

    def test_same_size_bad_ciphertext_fails_before_start(self):
        self.a.execute('UPDATE credentials SET ciphertext=?',('A'*72,));self.a.commit();self.reject('HOST_COMMAND_FAILED')

    def test_synk_session_revision_mismatch(self):
        self.a.execute("UPDATE synk_identity_links SET revision='new-revision'");self.a.commit();self.reject('HOST_COMMAND_FAILED')

    def test_company_session_orphan(self):
        self.a.execute("UPDATE tokens SET userId='absent'");self.a.commit();self.reject('HOST_COMMAND_FAILED')

    def test_messenger_session_orphan(self):
        self.b.execute("UPDATE sessions SET user_id='absent'");self.b.commit();self.reject('SESSION_OWNER_INVALID')

    def test_duplicate_identity_link(self):
        link={'companyUserId':'company-user','messengerUserId':'messenger-user'}
        (self.root/'workspace-integration.json').write_text(json.dumps({'identityLinks':[link,link]}));self.reject('IDENTITY_LINK_INVALID')

    def test_attachment_size_mismatch(self):
        (self.root/'messenger/uploads'/self.upload).write_bytes(b'cut');self.reject('ATTACHMENT_SIZE_MISMATCH')

    def test_missing_db_cannot_be_created_by_write_check(self):
        p=self.root/'missing.sqlite'
        with self.assertRaises(FileNotFoundError):host.database_writable(self.c,'missing.sqlite')
        self.assertFalse(p.exists())

    def test_write_lock_probe_leaves_business_rows_unchanged(self):
        before=host.digest(self.root/'company.sqlite');host.database_writable(self.c,'company.sqlite')
        self.assertEqual(before,host.digest(self.root/'company.sqlite'))

    def test_locked_db_is_not_writable(self):
        self.a.execute('BEGIN IMMEDIATE')
        try:
            with self.assertRaises(sqlite3.OperationalError):host.database_writable(self.c,'company.sqlite')
        finally:self.a.rollback()

    def test_broken_wal_symlink_rejected(self):
        p=self.root/'company.sqlite-wal'
        try:p.symlink_to(self.root/'absent')
        except OSError:self.skipTest('OS denies test symlink creation')
        self.reject('DATA_SYMLINK')

    def test_directory_symlink_even_inside_volume_rejected(self):
        actual=self.root/'actual-media';(self.root/'studio-media').rename(actual)
        try:(self.root/'studio-media').symlink_to(actual,target_is_directory=True)
        except OSError:self.skipTest('OS denies test symlink creation')
        self.reject('DATA_SYMLINK')

    @unittest.skipUnless(os.name=='posix' and os.geteuid()==0,'root Linux filesystem durability test')
    def test_real_fsync_rename_and_sqlite_commit_readback(self):
        root=self.mount/'.ha-health';host.durable_probe(root);host.durable_probe(root)
        self.assertEqual([x.name for x in root.iterdir()],['durability.sqlite'])
        db=sqlite3.connect(root/'durability.sqlite')
        try:self.assertEqual(db.execute('SELECT count(*) FROM probe').fetchone(),(1,))
        finally:db.close()

class HostContractTests(unittest.TestCase):
    def test_restart_policy_bypass_rejected(self):
        c=config()
        def run(args,**kwargs):return '\n'.join(host.CONTAINERS) if args[1]=='ps' else json.dumps(snapshots(c,restart='unless-stopped'))
        with patch.object(host,'run',run),self.assertRaisesRegex(host.Rejected,'DOCKER_RESTART_BYPASS'):host.inspect_containers(c)

    def test_missing_container_not_ready(self):
        with patch.object(host,'run',return_value=''),self.assertRaisesRegex(host.Rejected,'CONTAINER_MISSING'):host.inspect_containers(config(),required=True)

    def test_loaded_guard_required_and_ignored_failure_rejected(self):
        c=config()|{'guardFiles':[{'path':'fixture','sha256':'fixture'}]*3}
        for response in ('LoadState=loaded\nExecStartPre=', 'LoadState=loaded\nExecStartPre={ argv[]='+host.NODE+' '+host.AGENT+' --check-start '+host.CONFIG+' ; ignore_errors=yes ; }'):
            with self.subTest(response=response),patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',return_value=response),self.assertRaises(host.Rejected):host.check_guards(c)

    def test_correct_effective_guards_and_no_containers_accepted(self):
        c=config()|{'guardFiles':[{'path':'fixture','sha256':'fixture'}]*3};seen=[]
        def run(args,**kwargs):
            seen.append(args)
            if args[0]=='docker':return ''
            return unit_rows(args,ExecStartPre='{ path='+host.NODE+' ; argv[]='+host.NODE+' '+host.AGENT+' --check-start '+host.CONFIG+' ; ignore_errors=no ; }')
        with patch.object(host,'protected'),patch.object(host,'digest',return_value='fixture'),patch.object(host,'run',run):host.check_guards(c)
        self.assertEqual(len([x for x in seen if x[0]=='systemctl']),1)

    def test_stop_confirms_units_and_docker_even_after_unit_stop_error(self):
        c=config();seen=[]
        def run(args,*a,**kw):
            seen.append(args)
            if args[:2]==['systemctl','stop']:raise host.Rejected('UNIT_FAILURE')
            if args[:2]==['systemctl','show']:return unit_rows(args,ActiveState='inactive')
            if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS)
            if args[:2]==['docker','inspect']:return json.dumps(snapshots(c,running=False))
            return ''
        with patch.object(host,'run',run),self.assertRaisesRegex(host.Rejected,'UNIT_STOP_FAILED'):host.stop_stack(c)
        self.assertTrue(any(x[:2]==['docker','stop'] for x in seen))

    def test_ordered_unit_stop_allows_full_service_shutdown_budgets(self):
        c=config();timeouts=[]
        def run(args,timeout=30,**kw):
            if args[:2]==['systemctl','stop']:
                timeouts.append(timeout)
                if timeout<=120:raise subprocess.TimeoutExpired(args,timeout)
            if args[:2]==['systemctl','show']:return unit_rows(args,ActiveState='inactive')
            if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS)
            if args[:2]==['docker','inspect']:return json.dumps(snapshots(c,running=False))
            return ''
        with patch.object(host,'run',run):result=host.stop_stack(c)
        self.assertTrue(result['stopped']);self.assertEqual(len(timeouts),1)
        self.assertGreater(timeouts[0],120)
        self.assertLess(timeouts[0],host.STOP_BUDGET_SECONDS)

    def test_stop_does_not_claim_success_if_docker_keeps_running(self):
        c=config()
        def run(args,*a,**kw):
            if args[:2]==['docker','ps']:return '\n'.join(host.CONTAINERS)
            if args[:2]==['docker','inspect']:return json.dumps(snapshots(c,running=True))
            return 'inactive'
        with patch.object(host,'run',run),self.assertRaisesRegex(host.Rejected,'STOP_NOT_CONFIRMED'):host.stop_stack(c)

    def test_start_failure_stops_partial_stack(self):
        with patch.object(host,'check_data'),patch.object(host,'run',return_value='inactive'),patch.object(host,'durable_health',side_effect=host.Rejected('BAD_HEALTH')),patch.object(host,'stop_stack') as stop,self.assertRaisesRegex(host.Rejected,'BAD_HEALTH'):
            host.start_stack(config(),host.CONFIG)
        stop.assert_called_once()

    def test_stale_active_oneshot_reset_before_start(self):
        seen=[]
        def run(args,*a,**kw):
            seen.append(args)
            return 'active' if args[:2]==['systemctl','show'] else ''
        with patch.object(host,'check_data'),patch.object(host,'run',run),patch.object(host,'inspect_containers',return_value=[]),patch.object(host,'durable_health',return_value={'durableHealthOk':True}):
            self.assertTrue(host.start_stack(config(),host.CONFIG)['startCompleted'])
        self.assertTrue(all(seen.index(['systemctl','stop',u])<seen.index(['systemctl','start',u]) for u in host.UNITS))

    def test_guard_denial_never_starts_systemd(self):
        with patch.object(host,'check_data') as data,patch.object(host,'run',side_effect=host.Rejected('NOT_OWNER')) as run,patch.object(host,'mount_candidate') as mount,patch.object(host,'stop_stack') as stop,self.assertRaisesRegex(host.Rejected,'NOT_OWNER'):host.start_stack(config(),host.CONFIG)
        self.assertEqual(run.call_count,1)
        stop.assert_called_once();data.assert_not_called();mount.assert_not_called()

    def test_authorized_owner_guard_mounts_before_first_cold_boot_data_check(self):
        state={'mounted':False};seen=[]
        def run(args,*a,**kw):
            seen.append(args)
            if args==[host.NODE,host.AGENT,'--check-start',host.CONFIG]:state['mounted']=True
            return 'inactive'
        def data(c):self.assertTrue(state['mounted'],'cold boot data check preceded authenticated mount')
        with patch.object(host,'run',run),patch.object(host,'check_data',data),patch.object(host,'durable_health',return_value={'durableHealthOk':True}):
            self.assertTrue(host.start_stack(config(),host.CONFIG)['startCompleted'])
        self.assertEqual(seen[0],[host.NODE,host.AGENT,'--check-start',host.CONFIG])

    def test_after_mount_data_rejection_cleans_up_without_starting_units(self):
        seen=[]
        with patch.object(host,'run',side_effect=lambda args,*a,**kw:seen.append(args) or ''),patch.object(host,'check_data',side_effect=host.Rejected('DB_INTEGRITY')),patch.object(host,'stop_stack') as stop,self.assertRaisesRegex(host.Rejected,'DB_INTEGRITY'):
            host.start_stack(config(),host.CONFIG)
        self.assertEqual(seen,[[host.NODE,host.AGENT,'--check-start',host.CONFIG]]);stop.assert_called_once()

    def test_live_unhealthy_container_is_reset_in_same_recovery(self):
        c=config();seen=[];items=snapshots(c);items[0]['State']['Health']['Status']='unhealthy'
        def run(args,*a,**kw):
            seen.append(args);return 'active'
        with patch.object(host,'check_data'),patch.object(host,'run',run),patch.object(host,'inspect_containers',return_value=items),patch.object(host,'durable_health',return_value={'durableHealthOk':True}):host.start_stack(c,host.CONFIG)
        self.assertLess(seen.index(['systemctl','stop',host.UNITS[0]]),seen.index(['systemctl','start',host.UNITS[0]]))
        self.assertNotIn(['systemctl','stop',host.UNITS[1]],seen)

    def test_successful_recovery_resumes_all_stopped_maintenance_timers(self):
        seen=[]
        with patch.object(host,'check_data'),patch.object(host,'run',side_effect=lambda args,*a,**k:seen.append(args) or 'inactive'),patch.object(host,'durable_health',return_value={'durableHealthOk':True}):result=host.start_stack(config(),host.CONFIG)
        self.assertEqual(seen[-1],['systemctl','start',*host.TIMERS]);self.assertTrue(result['maintenanceTimersResumed'])

    def test_start_waits_for_initial_docker_health_before_exposure(self):
        with patch.object(host,'check_data'),patch.object(host,'run',return_value='inactive'),patch.object(host,'durable_health',side_effect=[host.Rejected('CONTAINER_NOT_READY'),{'durableHealthOk':True}]) as health,patch.object(host.time,'sleep') as sleep,patch.object(host,'stop_stack') as stop:
            self.assertTrue(host.start_stack(config(),host.CONFIG)['startCompleted'])
        self.assertEqual(health.call_count,2);sleep.assert_called_once();stop.assert_not_called()

    def test_systemctl_timeout_stops_pending_start_job(self):
        def run(args,*a,**kw):
            if args[:2]==['systemctl','start']:raise subprocess.TimeoutExpired(args,180)
            return 'inactive'
        with patch.object(host,'check_data'),patch.object(host,'run',run),patch.object(host,'stop_stack') as stop,self.assertRaises(subprocess.TimeoutExpired):host.start_stack(config(),host.CONFIG)
        stop.assert_called_once()

    def test_whole_action_budget_caps_each_child_timeout(self):
        with host.operation_budget(2),patch.object(host.subprocess,'run',return_value=subprocess.CompletedProcess([],0,stdout=b'')) as child:host.run(['fixture'],180)
        self.assertGreater(child.call_args.kwargs['timeout'],0);self.assertLessEqual(child.call_args.kwargs['timeout'],2)

    @unittest.skipUnless(os.name=='posix','Linux signal cancellation and cleanup')
    def test_parent_sigterm_stops_partial_writer_before_process_exits(self):
        script=r'''
import importlib.util,signal,sys,os
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('host',sys.argv[1]);h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
signal.signal(signal.SIGTERM,h.cancel_operation)
def run(args,*a,**kw):
 if args[:2]==['systemctl','start']:os.kill(os.getpid(),signal.SIGTERM)
 return 'inactive'
def cleanup(c):
 with h.finish_cleanup(),h.operation_budget(2):
  os.kill(os.getpid(),signal.SIGTERM)
  print('CLEANUP_CONFIRMED',flush=True)
try:
 with patch.object(h,'check_data'),patch.object(h,'run',run),patch.object(h,'stop_stack',cleanup):h.start_stack({},'fixture')
except h.Rejected as e:
 print(str(e));sys.exit(23)
'''
        result=subprocess.run([sys.executable,'-c',script,str(HERE/'node-host.py')],capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,23);self.assertEqual(result.stdout.splitlines(),['CLEANUP_CONFIRMED','HOST_OPERATION_CANCELLED'])

    def test_health_rejects_paused_container(self):
        c=config();items=snapshots(c);items[0]['State']['Paused']=True
        with patch.object(host,'check_mount'),patch.object(host,'check_guards',return_value=items),self.assertRaisesRegex(host.Rejected,'CONTAINER_NOT_READY'):host.durable_health(c)

    def test_company_healthcheck_cannot_be_omitted(self):
        c=config();items=snapshots(c);items[0]['State'].pop('Health')
        with patch.object(host,'check_mount'),patch.object(host,'check_guards',return_value=items),self.assertRaisesRegex(host.Rejected,'COMPANY_HEALTHCHECK_REQUIRED'):host.durable_health(c)

if __name__=='__main__':unittest.main(verbosity=2)
