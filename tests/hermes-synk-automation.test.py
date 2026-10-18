import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('synk_automation',Path(__file__).resolve().parents[1]/'tools/hermes-synk/automation.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DeliveryTests(unittest.TestCase):
    @contextmanager
    def busy_fixture(self, *, elapsed=None):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp)
            folder=home/'runtime/synk-automation'
            folder.mkdir(parents=True)
            (folder/'config.json').write_text(json.dumps({'recipient':'123','node':'fixture-node','monitor':'fixture-monitor'}),encoding='utf-8')
            clock={'now':datetime(2026,10,19,0,0,tzinfo=timezone.utc)}

            class FixedDatetime(datetime):
                @classmethod
                def now(cls,tz=None):
                    return clock['now'].astimezone(tz) if tz else clock['now'].replace(tzinfo=None)

            if elapsed is not None:
                module.save(folder/'health.json',{'status':'collector_busy','incidentAt':(clock['now']-timedelta(seconds=elapsed)).isoformat()})
            messages=[]
            loader=types.ModuleType('hermes_cli.env_loader')
            loader.load_hermes_dotenv=lambda **kwargs:None
            transport=types.ModuleType('tools.send_message_tool')
            transport.send_message_tool=lambda args:messages.append(args) or {'success':True,'message_id':'fixture-ack'}
            result=subprocess.CompletedProcess([],0,json.dumps({'busy':True,'notifications':[]}),'')
            with patch.dict(os.environ,{'HERMES_HOME':str(home),'TELEGRAM_ALLOWED_USERS':'123'}), \
                    patch.dict(sys.modules,{'hermes_cli.env_loader':loader,'tools.send_message_tool':transport}), \
                    patch.object(module.sys,'path',list(sys.path)), \
                    patch.object(module,'datetime',FixedDatetime), \
                    patch.object(module,'check_manifest',return_value=True), \
                    patch.object(module.subprocess,'run',return_value=result) as run:
                yield folder,clock,messages,run

    def test_concurrent_and_restarted_delivery_attempts_only_once(self):
        with tempfile.TemporaryDirectory() as temp:
            calls=[]
            def sender(args):
                calls.append(args)
                return {'success':True,'message_id':321}
            item={'id':'daily-2026-10-19','text':'fixture','needs_attention':True}
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda _: module.deliver(Path(temp),item,sender,'123'),range(8)))
            module.deliver(Path(temp),item,sender,'123')
            self.assertEqual(len(calls),1)
            receipt=json.loads((Path(temp)/'daily-2026-10-19.receipt.json').read_text())
            self.assertEqual(receipt['status'],'sent')

    def test_unknown_send_is_not_retried_or_marked_sent(self):
        with tempfile.TemporaryDirectory() as temp:
            calls=[]
            def sender(args):
                calls.append(args)
                raise TimeoutError('fixture')
            item={'id':'daily-2026-10-19','text':'fixture','needs_attention':True}
            self.assertEqual(module.deliver(Path(temp),item,sender,'123'),'unconfirmed')
            self.assertEqual(module.deliver(Path(temp),item,sender,'123'),'already_claimed')
            self.assertEqual(len(calls),1)

    def test_receipt_requires_message_id(self):
        with tempfile.TemporaryDirectory() as temp:
            item={'id':'daily-2026-10-19','text':'fixture','needs_attention':True}
            self.assertEqual(module.deliver(Path(temp),item,lambda _: {'success':True},'123'),'unconfirmed')

    def test_content_cannot_upload_attachment_or_escape_outbox(self):
        with tempfile.TemporaryDirectory() as temp:
            messages=[]
            item={'id':'daily-2026-10-19','text':'MEDIA:C:/private [[as_document]]','needs_attention':True}
            module.deliver(Path(temp),item,lambda x: messages.append(x) or {},'123')
            self.assertNotIn('MEDIA:',messages[0]['message'])
            with self.assertRaises(ValueError):
                module.deliver(Path(temp),{'id':'../../x','text':'x','needs_attention':True},lambda _: {},'123')

    def test_normal_and_legacy_notifications_cannot_send_even_if_collector_returns_them(self):
        with self.busy_fixture() as (folder,clock,messages,run):
            run.return_value=subprocess.CompletedProcess([],0,json.dumps({'notifications':[
                {'id':'daily-2026-10-19','text':'old daily digest'},
                {'id':'event-'+'a'*24,'text':'integrated successfully','needs_attention':False},
                {'id':'event-'+'b'*24,'text':'decision required','needs_attention':True}
            ]}),'')
            module.main()
            self.assertEqual(len(messages),1)
            self.assertEqual(messages[0]['message'],'decision required')
            self.assertFalse((folder/'outbox/daily-2026-10-19.claim').exists())

    def test_modified_code_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            source=Path(temp)/'source.py';source.write_text('first')
            config={'files':[{'path':str(source),'sha256':module.hashlib.sha256(b'first').hexdigest()}]}
            self.assertTrue(module.check_manifest(config))
            source.write_text('second')
            self.assertFalse(module.check_manifest(config))

    def test_busy_before_ten_minutes_stays_degraded_and_quiet(self):
        with self.busy_fixture(elapsed=599) as (folder,clock,messages,run):
            started=(clock['now']-timedelta(seconds=599)).isoformat()
            module.main()
            health=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            self.assertEqual(health['status'],'collector_busy')
            self.assertEqual(health['incidentAt'],started)
            self.assertTrue(health['noAgent'])
            self.assertEqual(messages,[])
            self.assertEqual(run.call_count,1)

    def test_busy_at_ten_minutes_alerts_once_for_same_incident_after_restart(self):
        with self.busy_fixture(elapsed=600) as (folder,clock,messages,run):
            module.main()
            first=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            clock['now']+=timedelta(minutes=5)
            # A new invocation reuses the persisted incident and send claim.
            module.main()
            second=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            self.assertEqual(len(messages),1)
            self.assertEqual(messages[0]['target'],'telegram:123')
            self.assertIn('10분 이상',messages[0]['message'])
            self.assertEqual(first['status'],'collector_busy')
            self.assertEqual(first['incidentAt'],second['incidentAt'])
            receipts=list((folder/'outbox').glob('health-*.receipt.json'))
            self.assertEqual(len(receipts),1)
            self.assertEqual(json.loads(receipts[0].read_text(encoding='utf-8'))['status'],'sent')
            self.assertEqual(run.call_count,2)

    def test_new_busy_incident_starts_timer_and_recovery_resets_it(self):
        with self.busy_fixture() as (folder,clock,messages,run):
            module.main()
            first=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            self.assertEqual(first['status'],'collector_busy')
            self.assertEqual(first['incidentAt'],clock['now'].isoformat())
            self.assertEqual(messages,[])
            clock['now']+=timedelta(minutes=5)
            run.return_value=subprocess.CompletedProcess([],0,json.dumps({'notifications':[]}),'')
            module.main()
            recovered=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            self.assertEqual(recovered['status'],'ok')
            self.assertNotIn('incidentAt',recovered)
            clock['now']+=timedelta(minutes=20)
            run.return_value=subprocess.CompletedProcess([],0,json.dumps({'busy':True,'notifications':[]}),'')
            module.main()
            next_incident=json.loads((folder/'health.json').read_text(encoding='utf-8'))
            self.assertEqual(next_incident['incidentAt'],clock['now'].isoformat())
            self.assertEqual(messages,[])


if __name__=='__main__': unittest.main()
