#!/usr/bin/env python3
"""Offline regression tests: fresh evidence, real novelty and bounded public reads."""
import copy
import importlib.util
import json
import http.client
import http.server
from pathlib import Path
import signal
import socket
import tempfile
import threading
import time
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('source_evidence', Path(__file__).with_name('source-evidence.py'))
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)
URL = 'https://www.youtube.com/watch?v=abcdefghijk'
RUN = 'a' * 32
AT = '2026-11-14T00:01:00+00:00'


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name).resolve()
        self.patch = patch.object(e, 'HOME', self.home)
        self.patch.start()
        e.write_json(self.home / 'run-status/full.json', {'status': 'running', 'invocationId': RUN})
        e.inventory('full', [])
        self.proof = {'invocationId': RUN, 'sourceUrl': URL, 'checkedAt': AT, 'metrics': {'views': 1234}}
        self.entry = {'sourceUrl': URL, 'checkedAt': AT, 'metrics': {'views': 1234, 'likes': None},
                      'research': {'evidenceLevel': 'page-read', 'productionGuide': {'formatName': 'test'}}}
        self.report = {'researchStartedAt': '2026-11-14T00:00:00Z', 'researchCompletedAt': '2026-11-14T00:02:00Z', 'entries': [self.entry]}
        self.save_proof()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def save_proof(self):
        e.write_json(e.evidence_dir('full') / (e.hashlib.sha256(URL.encode()).hexdigest() + '.json'), self.proof)

    def test_fresh_distinct_source_admitted(self):
        self.assertEqual(e.validate('full', self.report), {'freshSourceCount': 1, 'newCandidateCount': 1})

    def test_unobserved_fields_and_source_text_are_rejected(self):
        for key, value in [('ctrTopPercent', 1), ('budgetLabel', 'High'), ('durationSeconds', 30),
                           ('periodDays', 7), ('region', 'KR'), ('creator', 'Invented'), ('title', 'Invented')]:
            with self.subTest(key=key):
                report = copy.deepcopy(self.report)
                report['entries'][0][key] = value
                with self.assertRaisesRegex(e.Refused, 'SOURCE_(FIELD|TEXT)_NOT_OBSERVED'):
                    e.validate('full', report)
        self.entry['research']['publishedAt'] = AT
        with self.assertRaisesRegex(e.Refused, 'SOURCE_FIELD_NOT_OBSERVED'):
            e.validate('full', self.report)
        self.entry['research']['publishedAt'] = None
        self.entry.update(ctrTopPercent=None, durationSeconds=None, budgetLabel=None)
        self.assertEqual(e.validate('full', self.report)['newCandidateCount'], 1)

    def test_duplicate_report_aliases_and_noncanonical_single_source_are_rejected(self):
        duplicate = copy.deepcopy(self.entry)
        duplicate['sourceUrl'] = 'https://youtu.be/abcdefghijk'
        self.report['entries'].append(duplicate)
        with self.assertRaisesRegex(e.Refused, 'DUPLICATE_REPORT_SOURCE'):
            e.validate('full', self.report)
        self.report['entries'] = [duplicate]
        with self.assertRaisesRegex(e.Refused, 'CANONICAL_SOURCE_URL_REQUIRED'):
            e.validate('full', self.report)

    def test_equivalent_utc_spelling_keeps_same_observation(self):
        self.entry['checkedAt'] = AT.replace('+00:00', 'Z')
        self.assertEqual(e.validate('full', self.report)['newCandidateCount'], 1)

    def test_old_snapshot_cannot_be_dated_as_today(self):
        self.proof['invocationId'] = 'b' * 32
        self.save_proof()
        with self.assertRaisesRegex(e.Refused, 'CURRENT_SOURCE_READ_REQUIRED'):
            e.validate('full', self.report)

    def test_seen_short_url_and_watch_url_are_same_source(self):
        prior = json.dumps({'entries': [{'sourceUrl': 'https://youtu.be/abcdefghijk'}]})
        e.inventory('full', [prior])
        with self.assertRaisesRegex(e.Refused, 'NO_NEW_SOURCE_CANDIDATES'):
            e.validate('full', self.report)

    def test_malformed_old_json_still_preserves_source_identity(self):
        prior = '{"entries":[{"sourceUrl":"' + URL + '","note":"first\nsecond"}]}'
        stats = e.inventory('full', [prior])
        self.assertEqual((stats['knownSourceCount'], stats['recoveredDocumentCount']), (1, 1))
        with self.assertRaisesRegex(e.Refused, 'NO_NEW_SOURCE_CANDIDATES'):
            e.validate('full', self.report)

    def test_unreadable_nonempty_history_does_not_become_empty(self):
        with self.assertRaisesRegex(e.Refused, 'SOURCE_HISTORY_UNREADABLE'):
            e.inventory('full', ['{broken historical content'])

    def test_empty_and_bom_history_are_not_malformed_recoveries(self):
        stats = e.inventory('full', ['', '\ufeff' + json.dumps({'entries': [{'sourceUrl': URL}]})])
        self.assertEqual((stats['knownSourceCount'], stats['recoveredDocumentCount']), (1, 0))

    def test_history_page_aliases_share_the_same_identity(self):
        for url in ['https://instagram.com/creator/reel/abcdef/', 'https://www.instagram.com/reels/abcdef/', 'https://www.instagram.com/tv/abcdef/']:
            with self.subTest(url=url):
                self.assertEqual(e.report_urls(json.dumps({'entries': [{'sourceUrl': url}]})), {'https://www.instagram.com/p/abcdef/'})
        self.assertEqual(e.report_urls(json.dumps({'entries': [{'sourceUrl': 'https://www.youtube.com/live/abcdefghijk'}]})), {URL})

    def test_historical_share_parameters_and_mobile_aliases_are_not_new(self):
        for prior in ['https://youtu.be/abcdefghijk?si=x', URL + '&t=12',
                      'https://m.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk?feature=share']:
            with self.subTest(prior=prior):
                e.inventory('full', [json.dumps({'entries': [{'sourceUrl': prior}]})])
                with self.assertRaisesRegex(e.Refused, 'NO_NEW_SOURCE_CANDIDATES'):
                    e.validate('full', self.report)

    def test_all_roles_history_and_backup_are_in_inventory(self):
        e.write_json(self.home / 'docs-backups/meta-brand-old.json', {'state': {'plaintext': json.dumps({'entries': [{'sourceUrl': 'https://instagram.com/reel/abcdef/'}]})}})
        outcome = e.inventory('full', [json.dumps({'entries': [{'sourceUrl': URL}]})])
        self.assertEqual(outcome['knownSourceCount'], 2)
        (self.home / 'work/full-sources.json').write_text('{}')
        with self.assertRaisesRegex(e.Refused, 'NO_NEW_SOURCE_CANDIDATES'):
            e.validate('full', self.report)  # model's work copy cannot change admission

    def test_metric_invention_and_video_claim_are_rejected(self):
        self.entry['metrics']['likes'] = 50
        with self.assertRaisesRegex(e.Refused, 'SOURCE_METRIC_NOT_OBSERVED'):
            e.validate('full', self.report)
        self.entry['metrics']['likes'] = None
        self.entry['research']['evidenceLevel'] = 'video-watched'
        with self.assertRaisesRegex(e.Refused, 'PAGE_TEXT_IS_NOT_VIDEO_OBSERVATION'):
            e.validate('full', self.report)

    def test_time_outside_run_and_changed_checked_time_are_rejected(self):
        self.report['researchStartedAt'] = '2026-11-14T00:01:01Z'
        with self.assertRaisesRegex(e.Refused, 'SOURCE_OBSERVATION_TIME_MISMATCH'):
            e.validate('full', self.report)
        self.report['researchStartedAt'] = '2026-11-14T00:00:00Z'
        self.entry['checkedAt'] = '2026-11-14T00:01:02Z'
        with self.assertRaisesRegex(e.Refused, 'SOURCE_OBSERVATION_TIME_MISMATCH'):
            e.validate('full', self.report)

    def test_missing_proof_and_missing_guide_are_rejected(self):
        self.entry['sourceUrl'] = 'https://www.youtube.com/watch?v=ABCDEFGHIJK'
        with self.assertRaisesRegex(e.Refused, 'CURRENT_SOURCE_READ_REQUIRED'):
            e.validate('full', self.report)
        self.entry['sourceUrl'] = URL
        self.entry['research'].pop('productionGuide')
        with self.assertRaisesRegex(e.Refused, 'PRODUCTION_GUIDE_REQUIRED'):
            e.validate('full', self.report)

    def test_rejects_private_credentials_ports_and_non_source_paths(self):
        for url in ['http://www.youtube.com/watch?v=abcdefghijk', 'https://127.0.0.1/watch?v=abcdefghijk',
                    'https://www.youtube.com.evil.com/watch?v=abcdefghijk', 'https://u:p@www.youtube.com/watch?v=abcdefghijk',
                    'https://www.youtube.com:443/watch?v=abcdefghijk', 'https://www.youtube.com/redirect?q=x',
                    URL + '&v=ABCDEFGHIJK', URL + '#secret', 'https://studio.youtube.com/channel/123/analytics']:
            with self.subTest(url=url), self.assertRaises(e.Refused):
                e.canonical(url)

    def test_role_boundary_and_ig_aliases(self):
        self.assertEqual(e.canonical('https://instagram.com/reel/abcdef/'), e.canonical('https://www.instagram.com/p/abcdef'))
        with self.assertRaisesRegex(e.Refused, 'SOURCE_ROLE_MISMATCH'):
            e.role_url('meta-brand', URL)

    def test_private_dns_address_never_connects(self):
        connection = e.PublicConnection('www.youtube.com')
        with patch.object(socket, 'getaddrinfo', return_value=[(2,1,6,'',('169.254.169.254',443))]), patch.object(socket, 'create_connection') as connect:
            with self.assertRaisesRegex(e.Refused, 'NONPUBLIC_SOURCE_ADDRESS'):
                connection.connect()
            connect.assert_not_called()

    def test_redirect_to_login_or_another_video_is_refused(self):
        for target in ['https://accounts.google.com/login', 'https://www.youtube.com/watch?v=ABCDEFGHIJK']:
            connection = Mock()
            response = connection.getresponse.return_value
            response.status = 302
            response.getheader.return_value = target
            with patch.object(e, 'PublicConnection', return_value=connection), self.assertRaises(e.Refused):
                e.fetch(URL, 'full')
            connection.close.assert_called_once()

    def test_unbounded_body_is_refused(self):
        connection = Mock()
        response = connection.getresponse.return_value
        response.status = 200
        response.getheader.return_value = 'text/html'
        response.read1.return_value = b'x' * (e.MAX_BODY + 1)
        with patch.object(e, 'PublicConnection', return_value=connection), self.assertRaisesRegex(e.Refused, 'SOURCE_TOO_LARGE'):
            e.fetch(URL, 'full')

    def test_socket_timeout_is_a_stable_refusal_and_closes_connection(self):
        connection = Mock()
        connection.getresponse.side_effect = TimeoutError('read timed out')
        with patch.object(e, 'PublicConnection', return_value=connection), self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
            e.fetch(URL, 'full')
        connection.close.assert_called_once()

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_total_budget_interrupts_slow_headers_and_restores_alarm(self):
        previous = signal.getsignal(signal.SIGALRM)
        connection = Mock()
        connection.getresponse.side_effect = lambda: time.sleep(2)
        started = time.monotonic()
        with patch.object(e, 'FETCH_SECONDS', .1), patch.object(e, 'PublicConnection', return_value=connection):
            with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                e.fetch(URL, 'full')
        self.assertLess(time.monotonic() - started, 1)
        connection.close.assert_called_once()
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0, 0))
        self.assertEqual(signal.getsignal(signal.SIGALRM), previous)

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_dripping_http_headers_stop_at_total_deadline(self):
        class SlowHeaders(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                try:
                    for byte in b'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nbody':
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                        time.sleep(.03)
                except OSError:
                    pass

            def log_message(self, *args):
                pass

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), SlowHeaders)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=1)
        try:
            started = time.monotonic()
            with patch.object(e, 'FETCH_SECONDS', .2), patch.object(e, 'PublicConnection', return_value=connection):
                with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                    e.fetch(URL, 'full')
            self.assertLess(time.monotonic() - started, 1)
            self.assertIsNone(connection.sock)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_total_budget_is_shared_across_redirects(self):
        connection = Mock()
        response = connection.getresponse.return_value
        response.status = 302
        response.getheader.return_value = URL
        connection.getresponse.side_effect = lambda: (time.sleep(.06), response)[1]
        with patch.object(e, 'FETCH_SECONDS', .1), patch.object(e, 'PublicConnection', return_value=connection):
            with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                e.fetch(URL, 'full')
        self.assertLess(connection.getresponse.call_count, 4)
        self.assertEqual(connection.close.call_count, connection.getresponse.call_count)

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_alarm_at_cleanup_still_restores_previous_handler(self):
        previous = signal.getsignal(signal.SIGALRM)
        set_timer = signal.setitimer

        def pending_alarm(which, seconds):
            result = set_timer(which, seconds)
            if seconds == 0:
                raise TimeoutError('pending alarm during cancellation')
            return result

        with patch.object(e.signal, 'setitimer', side_effect=pending_alarm), patch.object(e, '_fetch', return_value=b'ok'):
            with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                e.fetch(URL, 'full')
        self.assertEqual(signal.getsignal(signal.SIGALRM), previous)
        self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0, 0))

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_alarm_during_tcp_connect_closes_socket_owned_by_stdlib(self):
        raw = Mock()
        raw.connect.side_effect = lambda address: time.sleep(2)
        address = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))]
        with patch.object(e, 'FETCH_SECONDS', .1), patch.object(socket, 'getaddrinfo', return_value=address), patch.object(socket, 'socket', return_value=raw):
            with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                e.fetch(URL, 'full')
        raw.connect.assert_called_once()
        raw.close.assert_called_once()

    @unittest.skipUnless(hasattr(signal, 'setitimer'), 'Production Linux deadline')
    def test_fetch_preserves_an_existing_alarm(self):
        previous = signal.getsignal(signal.SIGALRM)
        signal.setitimer(signal.ITIMER_REAL, 10)
        try:
            with patch.object(e, 'PublicConnection') as connection, self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMER_IN_USE$'):
                e.fetch(URL, 'full')
            connection.assert_not_called()
            self.assertGreater(signal.getitimer(signal.ITIMER_REAL)[0], 0)
            self.assertEqual(signal.getsignal(signal.SIGALRM), previous)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)

    def test_malformed_youtube_shapes_are_refused_without_tracebacks(self):
        target = {'watchEndpoint': {'videoId': 'abcdefghijk'}}
        bad = [None, [], 5, 'text', {'currentVideoEndpoint': None}, {'currentVideoEndpoint': {'watchEndpoint': []}},
               {'currentVideoEndpoint': target, 'videoPrimaryInfoRenderer': None},
               {'currentVideoEndpoint': target, 'videoPrimaryInfoRenderer': {'title': {'runs': None}}},
               {'currentVideoEndpoint': target, 'videoPrimaryInfoRenderer': {'title': {'runs': [{'text': 9}]}}}]
        for index, data in enumerate(bad):
            code = 'SOURCE_PAGE_IDENTITY_UNPROVEN' if index in (4, 5) else 'SOURCE_CONTENT_NOT_AVAILABLE'
            with self.subTest(data=data), self.assertRaisesRegex(e.Refused, '^' + code + '$'):
                e.extract(('var ytInitialData = ' + json.dumps(data)).encode(), URL)

    def test_optional_malformed_youtube_fields_do_not_invent_text(self):
        primary = {'title': {'simpleText': 'Actual title'}, 'dateText': {'simpleText': 'Nov 13, 2026'}}
        data = {'currentVideoEndpoint': {'watchEndpoint': {'videoId': 'abcdefghijk'}}, 'videoPrimaryInfoRenderer': primary}
        for bad in (None, 7, [], 'text'):
            data['videoSecondaryInfoRenderer'] = bad
            result = e.extract(('var ytInitialData = ' + json.dumps(data)).encode(), URL)
            self.assertEqual((result['title'], result['description'], result['creator']), ('Actual title', '', ''))
            data['videoSecondaryInfoRenderer'] = {'videoOwnerRenderer': bad, 'description': {'content': 9, 'runs': [{'text': 'Actual caption'}]}}
            result = e.extract(('var ytInitialData = ' + json.dumps(data)).encode(), URL)
            self.assertEqual((result['description'], result['creator']), ('Actual caption', ''))
            primary['title'] = {'simpleText': bad, 'content': bad, 'runs': [{'text': 'Actual title'}]}
            self.assertEqual(e.extract(('var ytInitialData = ' + json.dumps(data)).encode(), URL)['title'], 'Actual title' if bad != 'text' else 'text')
            primary['title'] = {'simpleText': 'Actual title'}

    def test_failed_reads_do_not_write_source_evidence(self):
        self.entry['sourceUrl'] = 'https://www.youtube.com/watch?v=ABCDEFGHIJK'
        proof = e.evidence_dir('full') / (e.hashlib.sha256(self.entry['sourceUrl'].encode()).hexdigest() + '.json')
        with patch.object(e, 'fetch', side_effect=e.Refused('SOURCE_FETCH_TIMEOUT')) as read:
            with self.assertRaisesRegex(e.Refused, '^SOURCE_FETCH_TIMEOUT$'):
                e.source_read('full', self.entry['sourceUrl'])
            read.assert_called_once_with(self.entry['sourceUrl'], 'full')
        self.assertFalse(proof.exists())
        with patch.object(e, 'fetch', return_value=b'var ytInitialData = null') as read:
            with self.assertRaisesRegex(e.Refused, '^SOURCE_CONTENT_NOT_AVAILABLE$'):
                e.source_read('full', self.entry['sourceUrl'])
            read.assert_called_once_with(self.entry['sourceUrl'], 'full')
        self.assertFalse(proof.exists())

    def test_youtube_extracts_only_target_primary_metadata(self):
        data = {'primary': {'videoPrimaryInfoRenderer': {'title': {'runs': [{'text': 'Target'}]}, 'dateText': {'simpleText': 'Nov 13, 2026'},
                    'viewCount': {'videoViewCountRenderer': {'originalViewCount': '1234'}}, 'accessibilityText': 'like this video along with 34 other people'}},
                'secondary': {'videoSecondaryInfoRenderer': {'description': {'runs': [{'text': 'Actual description'}]}}},
                'recommended': {'originalViewCount': '9999999'}}
        data['currentVideoEndpoint'] = {'watchEndpoint': {'videoId': 'abcdefghijk'}}
        body = ('var ytInitialData = ' + json.dumps(data) + '; LOGIN_REQUIRED').encode()
        value = e.extract(body, URL)
        self.assertEqual(value['metrics'], {'views': 1234, 'likes': 34})
        self.assertEqual(value['description'], 'Actual description')
        self.assertIn('requires login', value['limitations'][1])
        data['currentVideoEndpoint']['watchEndpoint']['videoId'] = 'ABCDEFGHIJK'
        with self.assertRaisesRegex(e.Refused, 'SOURCE_PAGE_IDENTITY_UNPROVEN'):
            e.extract(('var ytInitialData = ' + json.dumps(data)).encode(), URL)

    def test_empty_login_page_is_not_source_evidence(self):
        with self.assertRaisesRegex(e.Refused, 'SOURCE_CONTENT_NOT_AVAILABLE'):
            e.extract(b'<meta property="og:title" content="Instagram">', 'https://www.instagram.com/p/abcdef/')

    def test_long_login_metadata_or_wrong_content_is_not_evidence(self):
        login = b'<meta property="og:title" content="Facebook"><meta property="og:description" content="Log into Facebook to start sharing and connecting with your friends, family, and people you know."><meta property="og:url" content="https://www.facebook.com/reel/123456/">'
        with self.assertRaisesRegex(e.Refused, 'SOURCE_CONTENT_NOT_AVAILABLE'):
            e.extract(login, 'https://www.facebook.com/reel/123456/')
        other = ('<meta property="og:title" content="Actual creator post"><meta property="og:description" content="' + 'Actual post caption ' * 6 + '"><meta property="og:url" content="https://www.instagram.com/p/uvwxyz/">').encode()
        with self.assertRaisesRegex(e.Refused, 'SOURCE_PAGE_IDENTITY_UNPROVEN'):
            e.extract(other, 'https://www.instagram.com/p/abcdef/')

    def test_http_protocol_error_is_bounded_diagnostic(self):
        connection = Mock()
        connection.getresponse.side_effect = e.http.client.BadStatusLine('bad')
        with patch.object(e, 'PublicConnection', return_value=connection), self.assertRaisesRegex(e.Refused, 'SOURCE_FETCH_FAILED'):
            e.fetch(URL, 'full')

    def test_instagram_canonical_link_identifies_creator_prefixed_og_url(self):
        html = ('<meta property="og:title" content="Creator on Instagram"><meta property="og:description" content="' +
                'Actual post caption ' * 6 + '"><meta property="og:url" content="https://www.instagram.com/creator/reel/abcdef/">' +
                '<link rel="canonical" href="https://www.instagram.com/reel/abcdef/">').encode()
        self.assertEqual(e.extract(html, 'https://www.instagram.com/p/abcdef/')['title'], 'Creator on Instagram')
        for changed in [html.replace(b'/creator/reel/abcdef/', b'/creator/reel/uvwxyz/'),
                        html.replace(b'/creator/reel/abcdef/', b'/accounts/login/'),
                        html.replace(b'https://www.instagram.com/creator', b'https://example.com/creator'),
                        html + b'<meta property="og:url" content="https://www.instagram.com/reel/uvwxyz/">']:
            with self.subTest(html=changed), self.assertRaisesRegex(e.Refused, 'SOURCE_PAGE_IDENTITY_UNPROVEN'):
                e.extract(changed, 'https://www.instagram.com/p/abcdef/')
        relative = html.replace(b'https://www.instagram.com/creator/reel/abcdef/', b'/creator/reel/abcdef/')
        self.assertEqual(e.extract(relative, 'https://www.instagram.com/p/abcdef/')['title'], 'Creator on Instagram')
        self.assertEqual(e.extract(html + b'<link rel=canonical href><meta property=og:url content>', 'https://www.instagram.com/p/abcdef/')['title'], 'Creator on Instagram')


if __name__ == '__main__':
    unittest.main(verbosity=2)
