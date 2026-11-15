import datetime,hashlib,importlib.util,io,json,pathlib,tempfile,unittest,urllib.parse
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('backup_watch',pathlib.Path(__file__).with_name('watch.py'));watch=importlib.util.module_from_spec(spec);spec.loader.exec_module(watch)
class WatchTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.now=datetime.datetime(2026,10,18,7,tzinfo=datetime.timezone.utc)
  self.state={'schema':'synk-server-independent/v1','role':'company','status':'success','runId':'synthetic-run','completedAt':(self.now-datetime.timedelta(hours=1)).isoformat(),'receipt':{'remoteVerifiedAt':self.now.isoformat()}}
  self.events=[]
 def tearDown(self):self.temp.cleanup()
 def runwatch(self,timer=True,result='success',cfg=None,radio=None):
  for n in ['latest.json','latest-success.json']:(self.root/n).write_text(json.dumps(self.state))
  original=watch.read
  def reader(p):return (cfg or {'role':'company'}) if p.as_posix()=='/etc/synk-server-backup/config.json' else original(p)
  def call(url,data=None,headers=None):
   if 'metadata.google.internal' in url:return {'access_token':'test_fixture_only'}
   self.events.append(data);return {}
  def proc(args,**kwargs):
   text=('ActiveState=active\nUnitFileState=enabled' if timer else 'ActiveState=inactive\nUnitFileState=disabled') if 'synk-server-backup.timer' in args else 'ActiveState=inactive\nResult='+result
   return type('Result',(),{'stdout':text})()
  with patch.object(watch,'ROOT',self.root),patch.object(watch,'now',return_value=self.now),patch.object(watch,'read',side_effect=reader),patch.object(watch,'request',side_effect=call),patch.object(watch.subprocess,'run',side_effect=proc),patch.object(watch.sys,'argv',['watch.py']),patch.object(watch,'radio_status',side_effect=radio or (lambda c:None)):return watch.main()
 def test_healthy_emits_only_positive_heartbeat(self):
  r=self.runwatch();self.assertTrue(r['healthy']);self.assertEqual(len(self.events),1);self.assertTrue(self.events[0]['logName'].endswith('company_healthy'))
 def test_old_verified_success_never_emits_healthy(self):
  self.state['completedAt']=(self.now-datetime.timedelta(hours=26,seconds=1)).isoformat();r=self.runwatch();self.assertFalse(r['healthy']);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'LAST_SUCCESS_OLDER_THAN_26_HOURS')
 def test_disabled_timer_alerts_while_vm_alive(self):
  r=self.runwatch(timer=False);self.assertFalse(r['healthy']);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'BACKUP_TIMER_DISABLED')
 def test_original_failure_code_is_delivered_once(self):
  self.state.update(status='failed',error='STORAGE_ETAG_MISMATCH');self.runwatch();self.runwatch();self.assertEqual(len(self.events),1);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'STORAGE_ETAG_MISMATCH')
 def test_radio_key_refusal_still_alerts_but_only_as_remote_audit_failure(self):
  # The server code folds every radio_status exception into one alert code; the narrow-key reason stays in neither the alert nor radio-audit.json.
  def refuse(cfg):raise RuntimeError('RADIO_OAUTH_CLIENT_REQUIRED')
  r=self.runwatch(cfg={'role':'company','radioFolderId':'radio_folder-1','requireRestrictedDrive':True},radio=refuse)
  self.assertFalse(r['healthy']);self.assertEqual(len(self.events),1);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'RADIO_REMOTE_AUDIT_FAILED');self.assertFalse((self.root/'radio-audit.json').exists())
class RadioKeyTests(unittest.TestCase):
 # Server-only check deployed 2026-10-21 on all three nodes: the company node reads radio receipts with the radio's own narrow (drive.file only) key.
 RADIO='radio-fixture.apps.googleusercontent.com';COMPANY='company-fixture.apps.googleusercontent.com';CLASP='107294490549-fixture.apps.googleusercontent.com';DRIVE='https://www.googleapis.com/auth/drive.file'
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.now=datetime.datetime(2026,11,16,7,tzinfo=datetime.timezone.utc)
  self.cfg={'role':'company','radioFolderId':'radio_folder-1','restrictedClientId':self.COMPANY,'requireRestrictedDrive':True,'radioClientId':self.RADIO}
  self.creds={'drive77':{'client_id':self.COMPANY,'client_secret':'test_fixture_only','refresh_token':'test_fixture_only'},'drive77Radio':{'client_id':self.RADIO,'client_secret':'test_fixture_only','refresh_token':'test_fixture_only'}}
  self.info={'aud':self.RADIO,'scope':self.DRIVE}
  self.body=json.dumps({'schema':'synk-server-independent/v1','role':'radio','status':'success','completedAt':(self.now-datetime.timedelta(hours=1)).isoformat()}).encode()
  self.meta={'id':'receipt-fixture','size':str(len(self.body)),'sha256Checksum':hashlib.sha256(self.body).hexdigest(),'trashed':False,'owners':[{'emailAddress':'77yuhbs@gmail.com'}],'parents':['radio_folder-1'],'createdTime':self.now.isoformat()}
  self.calls=[];self.exchanged=[]
 def tearDown(self):self.temp.cleanup()
 def audit(self):
  def reader(p):return self.creds if p.as_posix()=='/etc/synk-server-backup/credentials.json' else {}
  def call(url,data=None,headers=None):
   self.calls.append(url.split('?')[0])
   if url.startswith('https://oauth2.googleapis.com/tokeninfo?'):return self.info
   if url.startswith('https://www.googleapis.com/drive/v3/about'):return {'user':{'emailAddress':'77yuhbs@gmail.com'}}
   if url.startswith('https://www.googleapis.com/drive/v3/files?'):return {'files':[self.meta]}
   raise AssertionError(url)
  def opener(req,timeout=None):
   if req.full_url=='https://oauth2.googleapis.com/token':self.exchanged.append(urllib.parse.parse_qs(req.data.decode())['client_id'][0]);return io.BytesIO(b'{"access_token":"test_fixture_only"}')
   if req.full_url=='https://www.googleapis.com/drive/v3/files/receipt-fixture?alt=media':return io.BytesIO(self.body)
   raise AssertionError(req.full_url)
  with patch.object(watch,'ROOT',self.root),patch.object(watch,'now',return_value=self.now),patch.object(watch,'read',side_effect=reader),patch.object(watch,'request',side_effect=call),patch.object(watch.urllib.request,'urlopen',side_effect=opener):return watch.radio_status(self.cfg)
 def refused(self,code):
  with self.assertRaisesRegex(RuntimeError,'^'+code+'$'):self.audit()
  self.assertNotIn('https://www.googleapis.com/drive/v3/about',self.calls);self.assertFalse((self.root/'radio-audit.json').exists())
 def test_radio_key_is_used_and_its_token_must_be_drive_file_only(self):
  self.assertIsNone(self.audit());self.assertEqual(self.exchanged,[self.RADIO]);self.assertEqual(self.calls[0],'https://oauth2.googleapis.com/tokeninfo')
  self.assertEqual(json.loads((self.root/'radio-audit.json').read_text())['status'],'success')
 def test_issued_to_is_accepted_when_aud_is_absent(self):
  self.info={'issued_to':self.RADIO,'scope':self.DRIVE};self.assertIsNone(self.audit())
 def test_required_narrow_drive_without_radio_client_stops_before_drive(self):
  del self.cfg['radioClientId'];self.refused('RADIO_OAUTH_CLIENT_REQUIRED');self.assertEqual(self.calls,[])
 def test_other_client_than_the_pinned_radio_client_is_refused(self):
  self.creds['drive77Radio']['client_id']=self.COMPANY;self.refused('RADIO_OAUTH_CLIENT_MISMATCH');self.assertEqual(self.calls,[])
 def test_clasp_client_is_refused_even_when_pinned(self):
  self.cfg['radioClientId']=self.CLASP;self.creds['drive77Radio']['client_id']=self.CLASP;self.refused('RADIO_OAUTH_CLIENT_MISMATCH')
 def test_missing_radio_key_falls_back_to_company_key_and_is_refused(self):
  del self.creds['drive77Radio'];self.refused('RADIO_OAUTH_CLIENT_MISMATCH');self.assertEqual(self.exchanged,[self.COMPANY])
 def test_token_with_a_wider_scope_is_refused(self):
  self.info['scope']=self.DRIVE+' https://www.googleapis.com/auth/drive';self.refused('RADIO_OAUTH_SCOPE_MISMATCH')
 def test_token_issued_to_another_client_is_refused(self):
  self.info['aud']=self.COMPANY;self.refused('RADIO_OAUTH_SCOPE_MISMATCH')
 def test_without_radio_client_the_restricted_client_is_checked(self):
  del self.cfg['radioClientId'];self.cfg['requireRestrictedDrive']=False;del self.creds['drive77Radio'];self.info['aud']=self.COMPANY
  self.assertIsNone(self.audit());self.assertEqual(self.exchanged,[self.COMPANY]);self.assertIn('https://oauth2.googleapis.com/tokeninfo',self.calls)
if __name__=='__main__':unittest.main()
