"""No Telethon installation, credentials, or network are used by these tests."""
import asyncio
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sender', Path(__file__).resolve().parents[1] / 'tools' / 'lib' / 'telegram-mtproto.py')
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)


class Row:
    def __init__(self, **values):
        self.__dict__.update(values)


class PeerUser(Row):
    def __init__(self, user_id): super().__init__(user_id=user_id)


class InputPeerUser(PeerUser): pass
class UpdateShortSentMessage(Row): pass
class UpdateMessageID(Row): pass
class UpdateShortMessage(Row): pass


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.payload = {'mode': 'send', 'botId': '123', 'target': 'telegram:456', 'randomId': '9223372036854775806', 'text': 'fixture'}
        self.cfg = {'api_id': 1, 'api_hash': 'a' * 32, 'token': '123:' + 'x' * 30, 'bot_id': '123'}
        self.options, self.requests, self.saved = [], [], []
        owner = self

        class Client:
            def __init__(self, *args, **kwargs):
                owner.options.append(kwargs)
                self.session = Row(save=lambda: owner.saved.append(True))
            async def connect(self): pass
            async def disconnect(self): pass
            async def is_user_authorized(self): return True
            async def get_me(self): return Row(bot=True, id=owner.me_id)
            async def get_input_entity(self, peer): return InputPeerUser(peer.user_id)
            async def __call__(self, request):
                owner.assertTrue(owner.saved, '세션 저장 뒤 전송해야 한다')
                owner.requests.append(request)
                return owner.response
        self.me_id = 123
        self.response = UpdateShortSentMessage(id=7)
        self.sdk = (Client, Row(messages=Row(SendMessageRequest=lambda **kw: Row(**kw))),
                    Row(PeerUser=PeerUser, InputPeerUser=InputPeerUser, UpdateShortSentMessage=UpdateShortSentMessage, UpdateMessageID=UpdateMessageID, UpdateShortMessage=UpdateShortMessage))

    def deliver(self, payload=None):
        return asyncio.run(sender.deliver(payload or self.payload, self.cfg, Path(tempfile.gettempdir()), self.sdk))

    def test_raw_id_and_receive_updates_disabled(self):
        result = self.deliver()
        self.assertFalse(self.options[0]['receive_updates'])
        self.assertEqual(self.options[0]['flood_sleep_threshold'], 0)
        self.assertEqual(self.requests[0].random_id, 9223372036854775806)
        self.assertEqual(result['randomId'], self.payload['randomId'])
        self.assertEqual(result['messageId'], '7')

    def test_probe_never_sends(self):
        result = self.deliver({**self.payload, 'mode': 'check'})
        self.assertTrue(result['authorized'])
        self.assertEqual(self.requests, [])

    def test_bot_mismatch_rejects_before_send(self):
        self.me_id = 999
        with self.assertRaisesRegex(sender.DeliveryError, 'BOT_MISMATCH'):
            self.deliver()
        self.assertEqual(self.requests, [])

    def test_updates_receipts_are_bound_to_id_and_peer(self):
        self.response = Row(updates=[UpdateMessageID(id=19, random_id=9223372036854775806)])
        self.assertEqual(self.deliver()['messageId'], '19')
        self.response = Row(updates=[Row(message=Row(id=21, out=True, peer_id=PeerUser(456), message='fixture'))])
        self.assertEqual(self.deliver()['messageId'], '21')
        self.response = Row(update=Row(message=Row(id=22, out=True, peer_id=PeerUser(456), message='fixture')))
        self.assertEqual(self.deliver()['messageId'], '22')
        self.response = UpdateShortMessage(id=23, out=True, user_id=456, message='fixture')
        self.assertEqual(self.deliver()['messageId'], '23')
        self.response = Row(updates=[Row(message=Row(id=21, out=True, peer_id=PeerUser(999), message='fixture'))])
        with self.assertRaisesRegex(sender.DeliveryError, 'RECEIPT_MISSING'):
            self.deliver()

    def test_inflight_duplicate_is_not_a_success_receipt(self):
        class Inflight(Exception): message = 'RANDOM_ID_DUPLICATE'
        async def fail(*args, **kw): raise Inflight()
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'SYNK_TELEGRAM_RUNTIME': root}), \
                patch.object(sender, 'settings', return_value=self.cfg), patch.object(sender, 'deliver', fail), \
                patch.object(sender.sys, 'stdin', io.StringIO(json.dumps(self.payload))), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(sender.main(), 1)
            result = json.loads(output.getvalue())
            self.assertFalse(result['ok'])
            self.assertEqual(result['code'], 'RANDOM_ID_DUPLICATE')


if __name__ == '__main__':
    unittest.main()
