import datetime, hashlib, importlib.util, io, json, pathlib, tarfile, tempfile, unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('restore_drill', pathlib.Path(__file__).with_name('restore-drill.py'))
drill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)
UTC = datetime.timezone.utc


def at(text):
    return datetime.datetime.fromisoformat(text).astimezone(UTC)


def ms(text):
    return int(at(text).timestamp() * 1000)


GOOD_SESSIONS = {'schema': 'synk-ha-dr-session-preservation/v2', 'status': 'regional-session-proof-passed', 'protectedAccountTables': 9,
                 'unchangedNonTokenAccountTables': 8, 'activeSessionAndTokenRowsPreservedBeforeAndAfterStart': True,
                 'protectedAccountRowsPreservedExceptExpiredTokens': True, 'sourceManifestPinsMatched': True,
                 'sourceHashes': {'server.mjs': 'a' * 64}, 'originalKeyPreservedBeforeAndAfterStart': True,
                 'clockOverridden': False, 'externalRequestAttempts': 0, 'healthReady': True,
                 'protectedAccountRowsPreservedBeforeAndAfterStart': True, 'sessionValuesPreservedBeforeAndAfterStart': True,
                 'expiredTokenCleanup': {'boundary': 'before-server-import', 'cutoffAt': '2026-10-21T14:26:00.000Z', 'tokenRowsBefore': 2,
                                         'tokenRowsAfter': 2, 'removedRows': 0, 'removedByPurpose': {}, 'allRemovedExpiredBeforeStartup': True,
                                         'unexpiredRemovedRows': 0, 'addedRows': 0, 'changedRows': 0}}
PASSED_MONDAY = {'runId': 'p', 'startedAt': '2026-10-26T10:07:00+09:00', 'completedAt': '2026-10-26T10:40:00+09:00',
                 'backupCreatedAt': ms('2026-10-26T03:30:00+09:00'), 'archiveGeneration': '100'}


class Schedule(unittest.TestCase):
    def test_anchor_is_last_monday_ten_kst(self):
        self.assertEqual(drill.week_anchor(at('2026-10-22T01:00:00+09:00')), at('2026-10-19T10:00:00+09:00'))
        self.assertEqual(drill.week_anchor(at('2026-10-26T09:59:59+09:00')), at('2026-10-19T10:00:00+09:00'))
        self.assertEqual(drill.week_anchor(at('2026-10-26T10:00:00+09:00')), at('2026-10-26T10:00:00+09:00'))
        self.assertEqual(drill.week_anchor(at('2026-10-25T23:30:00+00:00')), at('2026-10-19T10:00:00+09:00'))

    def test_runs_once_a_week_and_backs_off_after_a_failure(self):
        now = at('2026-10-26T10:07:00+09:00')
        self.assertEqual(drill.decide({}, now), 'run')
        last_week = {'lastPassed': dict(PASSED_MONDAY, startedAt='2026-10-22T01:30:00+09:00', completedAt='2026-10-22T02:00:00+09:00')}
        self.assertEqual(drill.decide(last_week, now), 'run')
        this_week = {'lastPassed': PASSED_MONDAY}
        self.assertEqual(drill.decide(this_week, at('2026-10-27T09:00:00+09:00')), 'done-this-week')
        failed = dict(last_week, lastFailed={'at': '2026-10-26T10:07:00+09:00', 'code': 'X'})
        self.assertEqual(drill.decide(failed, at('2026-10-26T15:00:00+09:00')), 'backoff')
        self.assertEqual(drill.decide(failed, at('2026-10-26T16:08:00+09:00')), 'run')
        older_failure = dict(this_week, lastFailed={'at': '2026-10-26T09:00:00+09:00', 'code': 'X'})
        self.assertEqual(drill.decide(older_failure, at('2026-10-26T11:00:00+09:00')), 'done-this-week')

    def test_an_old_backup_is_refreshed_before_it_goes_stale(self):
        old_backup = {'lastPassed': dict(PASSED_MONDAY, backupCreatedAt=ms('2026-10-24T03:30:00+09:00'))}
        self.assertEqual(drill.decide(old_backup, at('2026-10-30T15:29:00+09:00')), 'done-this-week')
        self.assertEqual(drill.decide(old_backup, at('2026-10-30T15:31:00+09:00')), 'refresh')

    def test_refresh_needs_a_newer_bundle(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        state = {'lastPassed': dict(PASSED_MONDAY, backupCreatedAt=ms('2026-10-24T03:30:00+09:00'))}
        cfg = {'stateDir': temp.name, 'backupBucket': 'b', 'standbyNodeId': 'standby', 'serviceAccount': 'sa'}
        name = 'company/production/synk-server-recovery-2026-10-24T03-30-00Z-1.tar.gz'
        items = [{'name': name, 'generation': '100'}, {'name': name + '.receipt.json', 'generation': '101'}]
        meta = {'instance/id': 'standby', 'instance/service-accounts/default/email': 'sa'}
        with patch.object(drill, 'metadata', side_effect=meta.__getitem__), patch.object(drill, 'ha_snapshot', return_value={}), \
                patch.object(drill, 'require_quiet'), patch.object(drill, 'list_bundles', return_value=items), \
                patch.object(drill, 'prepare_root') as prepare:
            outcome = drill.attempt(cfg, state, at('2026-10-31T09:00:00+09:00'), refresh=True)
        self.assertEqual(outcome, {'status': 'refresh-waits-for-a-newer-backup'})
        prepare.assert_not_called()
        self.assertEqual(list(pathlib.Path(temp.name).iterdir()), [])

    def test_a_listing_failure_is_recorded_so_it_backs_off_and_alerts(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        cfg = {'stateDir': temp.name, 'backupBucket': 'b', 'standbyNodeId': 'standby', 'serviceAccount': 'sa'}
        meta = {'instance/id': 'standby', 'instance/service-accounts/default/email': 'sa'}
        with patch.object(drill, 'metadata', side_effect=meta.__getitem__), patch.object(drill, 'ha_snapshot', return_value={}), \
                patch.object(drill, 'require_quiet'), patch.object(drill, 'list_bundles', side_effect=OSError('gcs')):
            outcome = drill.attempt(cfg, {}, at('2026-10-26T10:07:00+09:00'))
        self.assertEqual(outcome, {'status': 'failed', 'code': 'PRECHECK_OSERROR'})
        state = json.loads((pathlib.Path(temp.name) / 'state.json').read_text())
        self.assertEqual(drill.decide(state, at('2026-10-26T11:00:00+09:00')), 'backoff')


class Alerts(unittest.TestCase):
    installed = '2026-10-22T01:30:00+09:00'

    def test_failure_newer_than_the_last_pass_alerts_once_per_week_and_code(self):
        state = {'lastPassed': dict(PASSED_MONDAY, startedAt='2026-10-22T01:30:00+09:00', completedAt='2026-10-22T02:00:00+09:00',
                                    backupCreatedAt=ms('2026-10-21T23:27:00+09:00')),
                 'lastFailed': {'at': '2026-10-26T10:30:00+09:00', 'code': 'OFFLINE_PREPARE_FAILED', 'runId': 'f'}}
        [(error, detail, key, run_id)] = drill.drill_alerts(state, self.installed, at('2026-10-26T10:31:00+09:00'))
        self.assertEqual((error, detail, run_id), ('RESTORE_DRILL_FAILED', 'OFFLINE_PREPARE_FAILED', 'f'))
        again = dict(state, lastFailed={'at': '2026-10-26T16:40:00+09:00', 'code': 'OFFLINE_PREPARE_FAILED', 'runId': 'g'})
        self.assertEqual(drill.drill_alerts(again, self.installed, at('2026-10-26T16:41:00+09:00'))[0][2], key)

    def test_stale_comes_first_and_is_not_hidden_by_a_failure(self):
        state = {'lastPassed': PASSED_MONDAY, 'lastFailed': {'at': '2026-11-02T10:30:00+09:00', 'code': 'X', 'runId': 'f'}}
        alerts = drill.drill_alerts(state, self.installed, at('2026-11-02T15:31:00+09:00'))
        self.assertEqual([(a[0], a[1]) for a in alerts], [('RESTORE_DRILL_STALE', 'PASSED_BACKUP_OLDER_THAN_7D12H'), ('RESTORE_DRILL_FAILED', 'X')])
        self.assertEqual(drill.drill_alerts({'lastPassed': PASSED_MONDAY}, self.installed, at('2026-11-02T15:29:00+09:00')), [])

    def test_a_failure_older_than_the_pass_is_not_reported(self):
        state = {'lastPassed': PASSED_MONDAY, 'lastFailed': {'at': '2026-10-26T10:00:00+09:00', 'code': 'X'}}
        self.assertEqual(drill.drill_alerts(state, self.installed, at('2026-10-26T12:01:00+09:00')), [])

    def test_no_pass_after_install_turns_stale_after_a_day(self):
        self.assertEqual(drill.drill_alerts({}, self.installed, at('2026-10-23T01:00:00+09:00')), [])
        self.assertEqual(drill.drill_alerts({}, self.installed, at('2026-10-23T02:00:00+09:00'))[0][1], 'NO_PASSED_DRILL_SINCE_INSTALL')

    def test_payload_uses_the_existing_backup_alert_channel(self):
        queued = drill.alert_payload(('RESTORE_DRILL_STALE', 'D', 'k', 'r'), at('2026-10-26T12:00:00+09:00'))
        self.assertEqual(queued['eventId'], hashlib.sha256(b'company|restore-drill|k').hexdigest())
        self.assertEqual({k: queued['payload'][k] for k in ('event', 'role', 'error', 'detail', 'runId')},
                         {'event': 'SYNK_SERVER_BACKUP_FAILED', 'role': 'company', 'error': 'RESTORE_DRILL_STALE', 'detail': 'D', 'runId': 'r'})


class Bundles(unittest.TestCase):
    def item(self, name, generation, size='10', md5='bWQ1'):
        return {'name': name, 'generation': str(generation), 'size': size, 'md5Hash': md5, 'timeCreated': '2026-10-21T00:00:00Z'}

    def test_newest_bundle_needs_its_receipt(self):
        a = 'company/production/synk-server-recovery-2026-10-21T11-04-04Z-1696255.tar.gz'
        b = 'company/production/synk-server-recovery-2026-10-21T14-27-17Z-1924778.tar.gz'
        c = 'company/production/synk-server-recovery-2026-10-22T03-30-00Z-2000000.tar.gz'
        items = [self.item(a, 1), self.item(a + '.receipt.json', 2), self.item(b, 3), self.item(b + '.receipt.json', 4), self.item(c, 5)]
        archive, sidecar = drill.newest_bundle(items)
        self.assertEqual((archive['name'], sidecar['name']), (b, b + '.receipt.json'))
        with self.assertRaises(drill.Hold):
            drill.newest_bundle([self.item(c, 5), self.item('company/production/other.tar.gz', 6)])

    def test_receipt_must_describe_the_listed_archive_and_be_recent(self):
        name = 'company/production/synk-server-recovery-2026-10-21T14-27-17Z-1924778.tar.gz'
        archive = self.item(name, 1792593540446185, '550227399', 'o/H6SwIVp1pleDdAUYs1Lg==')
        receipt = {'format': 'synk-server-recovery/v1', 'archiveObject': name, 'generation': '1792593540446185', 'bytes': 550227399,
                   'md5Hash': 'o/H6SwIVp1pleDdAUYs1Lg==', 'sha256': 'a' * 64, 'releaseManifestSha256': 'b' * 64,
                   'createdAt': '2026-10-21T14:27:17Z', 'dataBackupCreatedAt': '2026-10-21T14:26:00Z'}
        self.assertEqual(drill.check_receipt(receipt, archive, at('2026-10-22T01:00:00+09:00')), at('2026-10-21T14:26:00+00:00'))
        for change, code in (({'generation': '1'}, 'RECEIPT_ARCHIVE_MISMATCH'), ({'sha256': 'x'}, 'RECEIPT_HASHES'),
                             ({'createdAt': '2026-10-21T14:00:00Z'}, 'RECEIPT_TIMES'), ({'format': 'v0'}, 'RECEIPT_FORMAT')):
            with self.assertRaises(drill.Hold) as caught:
                drill.check_receipt(dict(receipt, **change), archive, at('2026-10-22T01:00:00+09:00'))
            self.assertEqual(str(caught.exception), code)
        with self.assertRaises(drill.Hold) as caught:
            drill.check_receipt(receipt, archive, at('2026-10-25T00:00:00+09:00'))
        self.assertEqual(str(caught.exception), 'NEWEST_BACKUP_OLDER_THAN_3_DAYS')

    def test_bootstrap_is_the_first_member_without_reading_on(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        archive = pathlib.Path(temp.name) / 'a.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, body in (('disaster-restore.py', b'first'), ('host/etc/x', b'x'), ('disaster-restore.py', b'second')):
                info = tarfile.TarInfo(name)
                info.size = len(body)
                tar.addfile(info, io.BytesIO(body))
        self.assertEqual(drill.bootstrap_from(archive), b'first')


class Checks(unittest.TestCase):
    def test_public_identity_keeps_only_public_sign_in_fields(self):
        env = '\n'.join(['SYNK_ID_ACCOUNT_API_URL=https://a', 'SYNK_ID_PUBLISHABLE_KEY="pk"', "SYNK_ID_SUPABASE_URL='https://s'",
                         'SYNK_ID_MESSENGER_CLIENT_ID=m', 'SYNK_SECRET=never', 'SYNK_ID_TEACHER_CLIENT_ID=t'])
        self.assertEqual(drill.public_identity(env), {'SYNK_ID_ACCOUNT_API_URL': 'https://a', 'SYNK_ID_PUBLISHABLE_KEY': 'pk',
                                                      'SYNK_ID_SUPABASE_URL': 'https://s', 'SYNK_ID_MESSENGER_CLIENT_ID': 'm',
                                                      'SYNK_ID_TEACHER_CLIENT_ID': 't'})
        with self.assertRaises(drill.Hold):
            drill.public_identity(env + '\nSYNK_ID_CUSTOMER_CLIENT_ID=c')
        with self.assertRaises(drill.Hold):
            drill.public_identity(env + '\nSYNK_ID_ACCOUNT_API_URL=https://b')
        with self.assertRaises(drill.Hold) as caught:
            drill.public_identity(env.replace('"pk"', '"pk'))
        self.assertEqual(str(caught.exception), 'PUBLIC_ENV_QUOTE')

    def test_session_proof_must_be_strict(self):
        pins = {'server.mjs': 'a' * 64}
        self.assertTrue(drill.session_passed(GOOD_SESSIONS, pins))
        for key, value in (('externalRequestAttempts', 1), ('clockOverridden', True), ('protectedAccountTables', 8),
                           ('schema', 'synk-ha-dr-session-preservation/v1'), ('sourceHashes', {}), ('healthReady', False)):
            self.assertFalse(drill.session_passed(dict(GOOD_SESSIONS, **{key: value}), pins))
        self.assertFalse(drill.session_passed(None, pins))
        self.assertFalse(drill.session_passed(dict(GOOD_SESSIONS, externalRequestAttempts=False), pins))
        cleanup = dict(GOOD_SESSIONS['expiredTokenCleanup'], tokenRowsAfter=1, removedRows=1, removedByPurpose={'login': 1})
        self.assertFalse(drill.session_passed(dict(GOOD_SESSIONS, expiredTokenCleanup=cleanup), pins))
        self.assertTrue(drill.session_passed(dict(GOOD_SESSIONS, expiredTokenCleanup=cleanup, protectedAccountRowsPreservedBeforeAndAfterStart=False,
                                                  sessionValuesPreservedBeforeAndAfterStart=False), pins))
        for change in ({'cutoffAt': '2026-10-21T14:26:00Z'}, {'addedRows': 1}, {'removedByPurpose': {'login': 0}}):
            broken = dict(GOOD_SESSIONS, expiredTokenCleanup=dict(GOOD_SESSIONS['expiredTokenCleanup'], **change))
            self.assertFalse(drill.session_passed(broken, pins))

    def test_changed_keys_names_what_moved(self):
        base = {'protectedHashes': {'/etc/x': 'a'}, 'containers': [], 'control': {'generation': '1', 'sha256': 'c'},
                'status': {'nodeId': 'n', 'reason': 'STANDBY', 'activationAllowed': True, 'at': 1}}
        self.assertEqual(drill.changed_keys(base, dict(base, status=dict(base['status'], at=2))), [])
        moved = dict(base, control={'generation': '2', 'sha256': 'c'}, status=dict(base['status'], activationAllowed=False),
                     protectedHashes={'/etc/x': 'b'})
        self.assertEqual(drill.changed_keys(base, moved), ['control', 'status', 'protectedHashes'])

    def test_guarded_change_while_ha_stays_idle_fails_but_ha_moving_defers(self):
        base = {'protectedHashes': {'/etc/x': 'a'}, 'containers': [], 'control': {'generation': '1', 'sha256': 'c'}, 'status': {'nodeId': 'n'}}
        for after, kind, code in ((dict(base, protectedHashes={'/etc/x': 'b'}), drill.Hold, 'STANDBY_PROTECTED_FILES_CHANGED'),
                                  (dict(base, control={'generation': '2', 'sha256': 'd'}, protectedHashes={'/etc/x': 'b'}), drill.Defer, 'HA_CHANGED_DURING_DRILL')):
            with patch.object(drill, 'ha_snapshot', return_value=after), patch.object(drill, 'require_quiet'):
                with self.assertRaises(kind) as caught:
                    drill.still_quiet({}, base)
                self.assertEqual(str(caught.exception), code)

    def test_prune_keeps_the_newest_runs_and_the_last_pass(self):
        names = ['drill-202610%02dT010000Z-%d' % (day, day) for day in range(1, 13)] + ['infra-dr-x', 'drill-bad']
        self.assertEqual(drill.runs_to_prune(names, protect={'drill-20261002T010000Z-2'}),
                         ['drill-20261004T010000Z-4', 'drill-20261003T010000Z-3', 'drill-20261001T010000Z-1'])

    def test_release_locks_are_read_from_proc_locks(self):
        text = '1: FLOCK  ADVISORY  WRITE 4242 00:19:12345 0 EOF\n2: -> FLOCK  ADVISORY  WRITE 4243 08:01:777 0 EOF\n'
        self.assertTrue(drill.lock_busy(text, {(0, 25, 12345)}))
        self.assertTrue(drill.lock_busy(text, {(8, 1, 777)}))
        self.assertFalse(drill.lock_busy(text, {(0, 25, 12346)}))
        self.assertFalse(drill.lock_busy('', {(0, 25, 12345)}))

    def test_container_output_with_broken_json_lines_is_kept_as_text(self):
        parsed, other = drill.safe_lines('{"status": "ok"}\n{not json\nplain\n[1]\n{"a": 1}')
        self.assertEqual(parsed, [{'status': 'ok'}, {'a': 1}])
        self.assertEqual(other, ['{not json'])


class Attempt(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = pathlib.Path(self.temp.name)
        self.root, self.state_dir = base / 'root', base / 'state'
        self.root.mkdir()
        self.state_dir.mkdir()
        self.cfg = {'root': str(self.root), 'stateDir': str(self.state_dir), 'standbyNodeId': 'standby', 'ownerNodeId': 'owner',
                    'serviceAccount': 'sa', 'backupBucket': 'b', 'installedAt': '2026-10-22T01:30:00+09:00'}
        self.now = at('2026-10-22T01:40:00+09:00')
        self.snapshot = {'control': {'generation': '1', 'sha256': 'c'}, 'status': {'activeEpoch': 7, 'releaseSha256': 'r'}}
        self.archive = {'name': 'company/production/synk-server-recovery-2026-10-21T14-27-17Z-1.tar.gz', 'generation': '42'}

    def tearDown(self):
        self.temp.cleanup()

    def go(self, restore=None, quiet=None, prepare=None):
        def fake_restore(cfg, run_dir, before, report, archive_item, sidecar_item):
            (run_dir / 'recovery.tar.gz').write_bytes(b'payload')
            (run_dir / 'restored').mkdir()
            report.update({'archive': {'generation': '42'}, 'backupCreatedAt': ms('2026-10-21T23:27:00+09:00'), 'releaseSha256': 'r' * 64})
            if restore:
                restore()

        meta = {'instance/id': 'standby', 'instance/service-accounts/default/email': 'sa'}
        with patch.object(drill, 'prepare_root', side_effect=prepare or (lambda cfg, protect: self.root)), \
                patch.object(drill, 'list_bundles', return_value=[self.archive, dict(self.archive, name=self.archive['name'] + '.receipt.json', generation='43')]), \
                patch.object(drill, 'metadata', side_effect=meta.__getitem__), \
                patch.object(drill, 'ha_snapshot', return_value=self.snapshot), \
                patch.object(drill, 'require_quiet', side_effect=quiet), \
                patch.object(drill, 'restore', side_effect=fake_restore), \
                patch.object(drill, 'still_quiet', return_value=self.snapshot):
            state = {}
            outcome = drill.attempt(self.cfg, state, self.now)
        return outcome, json.loads((self.state_dir / 'state.json').read_text())

    def run_dir(self):
        return self.root / 'drill-20261021T164000Z-42'

    def test_pass_records_the_proof_and_cleans_payloads(self):
        outcome, state = self.go()
        self.assertEqual(outcome['status'], 'passed')
        result = self.run_dir() / 'RESULT.json'
        self.assertEqual(json.loads(result.read_text())['status'], 'passed')
        self.assertEqual((self.state_dir / 'latest-passed.json').read_bytes(), result.read_bytes())
        self.assertEqual(state['lastPassed']['resultSha256'], hashlib.sha256(result.read_bytes()).hexdigest())
        self.assertEqual(sorted(p.name for p in self.run_dir().iterdir()), ['PROGRESS.json', 'RESULT.json'])

    def test_failure_is_recorded_for_the_alert_and_still_cleans(self):
        def broken():
            raise drill.Hold('OFFLINE_PREPARE_FAILED')
        outcome, state = self.go(restore=broken)
        self.assertEqual(outcome, {'status': 'failed', 'code': 'OFFLINE_PREPARE_FAILED'})
        self.assertEqual(state['lastFailed']['code'], 'OFFLINE_PREPARE_FAILED')
        self.assertNotIn('lastPassed', state)
        self.assertEqual(json.loads((self.run_dir() / 'RESULT.json').read_text())['status'], 'failed')
        self.assertFalse((self.run_dir() / 'recovery.tar.gz').exists())
        self.assertFalse((self.run_dir() / 'restored').exists())

    def test_busy_ha_defers_before_touching_the_disk(self):
        def busy(*args):
            raise drill.Defer('HA_NOT_ARMED')
        cleaned = []
        outcome, state = self.go(quiet=busy, prepare=lambda cfg, protect: cleaned.append(1))
        self.assertEqual(outcome, {'status': 'deferred', 'code': 'HA_NOT_ARMED'})
        self.assertEqual(state['lastAttempt']['status'], 'deferred')
        self.assertNotIn('lastFailed', state)
        self.assertEqual(cleaned, [])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_ha_moving_mid_drill_defers_too(self):
        def moved():
            raise drill.Defer('HA_CHANGED_DURING_DRILL')
        outcome, state = self.go(restore=moved)
        self.assertEqual(outcome['status'], 'deferred')
        self.assertNotIn('lastFailed', state)
        self.assertEqual(json.loads((self.run_dir() / 'RESULT.json').read_text())['status'], 'deferred')

    def test_a_stop_signal_still_cleans_and_records(self):
        def stopped():
            drill.on_terminate(15, None)
        outcome, state = self.go(restore=stopped)
        self.assertEqual(outcome, {'status': 'failed', 'code': 'TERMINATED'})
        self.assertFalse((self.run_dir() / 'restored').exists())


class Delivery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.sent = []

    def tearDown(self):
        self.temp.cleanup()

    def deliver(self, alerts, fail=False):
        def post(url, data=None):
            if fail:
                raise OSError('network')
            self.sent.append(data)
            return {}
        with patch.object(drill, 'cloud_json', side_effect=post):
            return drill.deliver(self.temp.name, alerts, at('2026-10-26T12:00:00+09:00'), lambda: 'synk-project')

    def test_each_alert_is_written_once_and_retried_after_a_network_error(self):
        failed = ('RESTORE_DRILL_FAILED', 'X', 'failed|w|X', 'r')
        with self.assertRaises(OSError):
            self.deliver([failed], fail=True)
        self.assertEqual(self.deliver([failed]), ['RESTORE_DRILL_FAILED:X'])
        self.assertEqual(self.deliver([failed]), [])
        entry = self.sent[0]
        self.assertEqual(entry['logName'], 'projects/synk-project/logs/synk_server_backup')
        self.assertEqual(entry['entries'][0]['jsonPayload']['error'], 'RESTORE_DRILL_FAILED')
        stale = ('RESTORE_DRILL_STALE', 'Y', 'stale|p', 'p')
        self.assertEqual(self.deliver([stale, failed]), ['RESTORE_DRILL_STALE:Y'])
        other = ('RESTORE_DRILL_FAILED', 'Z', 'failed|w|Z', 'r')
        self.assertEqual(self.deliver([other]), ['RESTORE_DRILL_FAILED:Z'])
        self.assertEqual(self.deliver([failed, other]), [])

    def test_an_alert_resolved_before_delivery_is_dropped(self):
        with self.assertRaises(OSError):
            self.deliver([('RESTORE_DRILL_FAILED', 'X', 'failed|w|X', 'r')], fail=True)
        self.assertEqual(self.deliver([]), [])
        self.assertEqual(self.sent, [])


if __name__ == '__main__':
    unittest.main()
