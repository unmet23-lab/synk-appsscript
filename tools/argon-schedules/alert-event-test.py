#!/usr/bin/env python3
"""Offline notification safety tests. No metadata, Logging, or systemd calls."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location('alert_event', Path(__file__).with_name('alert-event.py'))
alert = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(alert)


class AlertTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'alerts'
        self.state = Path(self.temp.name) / 'run-status'
        self.patchers = [mock.patch.object(alert, 'ROOT', self.root),
                         mock.patch.object(alert, 'RUN_STATE', self.state),
                         mock.patch.object(alert, 'RUN_UID', os.getuid() if hasattr(os, 'getuid') else 0)]
        for patcher in self.patchers:
            patcher.start()
        # POSIX integration runs as root on the deployment host. Local non-root
        # runs check the same permission rules against their own test owner.
        if os.name == 'posix' and os.getuid() != 0:
            original = alert.check_private
            def local_owner(path, directory=False, uid=0):
                return original(path, directory=directory, uid=os.getuid() if uid == 0 else uid)
            owner_patch = mock.patch.object(alert, 'check_private', side_effect=local_owner)
            owner_patch.start()
            self.patchers.append(owner_patch)
        alert.private_dir(self.root)
        alert.private_dir(self.root / 'outbox')
        alert.private_dir(self.root / 'ack')
        self.state.mkdir(mode=0o700)
        self.unit = 'synk-argon-ultra-yt-tt.service'
        self.properties = {'Result': 'exit-code', 'ExecMainStatus': '1', 'ExecMainCode': '1',
                           'InvocationID': '0123456789abcdef' * 2, 'ActiveState': 'failed'}

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temp.cleanup()

    def capture(self, unit=None):
        with mock.patch.object(alert, 'show_unit', return_value=self.properties):
            identifier = alert.capture(unit or self.unit)
        return identifier, self.root / 'outbox' / (identifier + '.json')

    def test_unit_injection_never_reaches_subprocess(self):
        with mock.patch.object(alert.subprocess, 'run') as run:
            for value in ('other.service', '--all', '../../a', self.unit + '; id', self.unit + '\nsecret'):
                with self.assertRaises(alert.SafeFailure):
                    alert.show_unit(value)
            run.assert_not_called()

    def test_freeform_state_and_body_never_enter_queue(self):
        secret = 'SECRET_TOKEN_DO_NOT_TRANSMIT'
        source = {'role': 'yt-tt', 'status': 'failed', 'error': secret,
                  'response': secret, 'revisionId': secret, 'token': secret}
        alert.atomic_new(self.state / 'yt-tt.json', source)
        identifier, path = self.capture()
        event = alert.read_json(path)
        self.assertEqual(event['error'], 'RUN_CHECK_FAILED')
        self.assertNotIn(secret, path.read_text())
        self.assertEqual(set(event), alert.KEYS)
        self.assertEqual(event['eventId'], identifier)

    def test_known_error_and_test_scope(self):
        alert.atomic_new(self.state / 'yt-tt.json', {'role': 'yt-tt', 'status': 'failed', 'error': 'DOC_SHA_MISMATCH'})
        _, path = self.capture()
        self.assertEqual(alert.read_json(path)['error'], 'DOC_SHA_MISMATCH')
        _, test_path = self.capture('synk-argon-alert-test.service')
        event = alert.read_json(test_path)
        self.assertEqual(event['role'], 'alert-test')
        self.assertIs(event['test'], True)
        self.assertEqual(event['testId'], 'SYNK_ARGON_ALERT_TEST_20261018')
        event['test'] = False
        with self.assertRaises(alert.SafeFailure):
            alert.validate_event(event)

    def test_previous_invocation_error_is_not_reported_as_current_failure(self):
        invocation = self.properties['InvocationID']
        alert.atomic_new(self.state / 'yt-tt.json', {'role': 'yt-tt', 'status': 'failed',
                         'invocationId': invocation, 'error': 'DOC_SHA_MISMATCH'})
        self.assertEqual(alert.error_code('yt-tt', invocation), 'DOC_SHA_MISMATCH')
        self.assertEqual(alert.error_code('yt-tt', 'f' * 32), 'RUN_STATE_UNAVAILABLE')

    def test_queue_mutations_and_extra_content_are_rejected(self):
        _, path = self.capture()
        valid = alert.read_json(path)
        for key, value in [('response', 'secret'), ('unit', 'x.service'), ('error', 'SECRET'),
                           ('testId', 'arbitrary'), ('eventId', 'a' * 64), ('execMainStatus', True)]:
            event = copy.deepcopy(valid)
            event[key] = value
            path.write_text(json.dumps(event), encoding='utf-8')
            with mock.patch.object(alert, 'send') as send:
                result = alert.drain()
                self.assertEqual(result['rejected'], 1)
                send.assert_not_called()
            self.assertTrue(path.exists())

    def test_failed_delivery_retries_same_event_and_ack_prevents_resend(self):
        identifier, path = self.capture()
        original = path.read_bytes()
        with mock.patch.object(alert, 'send', side_effect=alert.SafeFailure('HTTP_FAILED')) as send:
            self.assertEqual(alert.drain()['retained'], 1)
            send.assert_called_once()
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse(alert.acknowledged(identifier))
        with mock.patch.object(alert, 'send') as send:
            self.assertEqual(alert.drain()['delivered'], 1)
            send.assert_called_once()
            self.assertTrue(alert.acknowledged(identifier))
            self.capture()
            self.assertEqual(alert.drain()['delivered'], 0)
            self.assertEqual(send.call_count, 1)
        self.assertFalse(path.exists())

    def test_ack_after_remote_success_before_unlink_recovers_without_send(self):
        identifier, path = self.capture()
        alert.atomic_new(self.root / 'ack' / path.name, {'eventId': identifier, 'deliveredAt': alert.utc_now()})
        with mock.patch.object(alert, 'send') as send:
            self.assertEqual(alert.drain()['alreadyAcknowledged'], 1)
            send.assert_not_called()
        self.assertFalse(path.exists())

    def test_symlink_or_hardlink_queue_is_not_sent(self):
        _, path = self.capture()
        alias = self.root / 'duplicate'
        os.link(path, alias)
        with mock.patch.object(alert, 'send') as send:
            self.assertEqual(alert.drain()['rejected'], 1)
            send.assert_not_called()
        alias.unlink()
        target = self.root / 'target.json'
        path.replace(target)
        try:
            path.symlink_to(target)
        except OSError:
            self.skipTest('Local OS does not permit symlink creation; hardlink case passed')
        with mock.patch.object(alert, 'send') as send:
            self.assertEqual(alert.drain()['rejected'], 1)
            send.assert_not_called()

    def test_http_contract_fixed_destination_and_token_only_in_header(self):
        _, path = self.capture()
        event = alert.read_json(path)
        token = 'private-metadata-access-token'
        with mock.patch.object(alert, 'request_json', side_effect=[{'access_token': token}, {}]) as request:
            alert.send(event)
        self.assertEqual(request.call_count, 2)
        self.assertEqual(request.call_args_list[0].args, (alert.METADATA_URL, {'Metadata-Flavor': 'Google'}))
        url, headers, encoded = request.call_args_list[1].args
        self.assertEqual(url, alert.LOGGING_URL)
        self.assertEqual(headers['Authorization'], 'Bearer ' + token)
        payload = json.loads(encoded)
        self.assertNotIn(token, encoded.decode())
        self.assertIs(payload['partialSuccess'], False)
        self.assertEqual(payload['entries'][0]['insertId'], event['eventId'])
        self.assertEqual(payload['entries'][0]['jsonPayload'], event)
        self.assertEqual(payload['resource']['labels']['instance_id'], '8318146427425792493')


if __name__ == '__main__':
    unittest.main(verbosity=2)
