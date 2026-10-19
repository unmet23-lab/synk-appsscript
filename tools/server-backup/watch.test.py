import datetime,importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('backup_watch',pathlib.Path(__file__).with_name('watch.py'));watch=importlib.util.module_from_spec(spec);spec.loader.exec_module(watch)
class WatchTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.now=datetime.datetime(2026,10,18,7,tzinfo=datetime.timezone.utc)
  self.state={'schema':'synk-server-independent/v1','role':'company','status':'success','runId':'synthetic-run','completedAt':(self.now-datetime.timedelta(hours=1)).isoformat(),'receipt':{'remoteVerifiedAt':self.now.isoformat()}}
  self.events=[]
 def tearDown(self):self.temp.cleanup()
 def runwatch(self,timer=True,result='success'):
  for n in ['latest.json','latest-success.json']:(self.root/n).write_text(json.dumps(self.state))
  original=watch.read
  def reader(p):return {'role':'company'} if p.as_posix()=='/etc/synk-server-backup/config.json' else original(p)
  def call(url,data=None,headers=None):
   if 'metadata.google.internal' in url:return {'access_token':'test_fixture_only'}
   self.events.append(data);return {}
  def proc(args,**kwargs):
   text=('ActiveState=active\nUnitFileState=enabled' if timer else 'ActiveState=inactive\nUnitFileState=disabled') if 'synk-server-backup.timer' in args else 'ActiveState=inactive\nResult='+result
   return type('Result',(),{'stdout':text})()
  with patch.object(watch,'ROOT',self.root),patch.object(watch,'now',return_value=self.now),patch.object(watch,'read',side_effect=reader),patch.object(watch,'request',side_effect=call),patch.object(watch.subprocess,'run',side_effect=proc),patch.object(watch.sys,'argv',['watch.py']):return watch.main()
 def test_healthy_emits_only_positive_heartbeat(self):
  r=self.runwatch();self.assertTrue(r['healthy']);self.assertEqual(len(self.events),1);self.assertTrue(self.events[0]['logName'].endswith('company_healthy'))
 def test_old_verified_success_never_emits_healthy(self):
  self.state['completedAt']=(self.now-datetime.timedelta(hours=26,seconds=1)).isoformat();r=self.runwatch();self.assertFalse(r['healthy']);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'LAST_SUCCESS_OLDER_THAN_26_HOURS')
 def test_disabled_timer_alerts_while_vm_alive(self):
  r=self.runwatch(timer=False);self.assertFalse(r['healthy']);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'BACKUP_TIMER_DISABLED')
 def test_original_failure_code_is_delivered_once(self):
  self.state.update(status='failed',error='STORAGE_ETAG_MISMATCH');self.runwatch();self.runwatch();self.assertEqual(len(self.events),1);self.assertEqual(self.events[0]['entries'][0]['jsonPayload']['error'],'STORAGE_ETAG_MISMATCH')
if __name__=='__main__':unittest.main()
