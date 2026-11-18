from fractions import Fraction
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import 수정전후시트 as pair


class ComparisonSheetTests(unittest.TestCase):
    def test_mapped_half_open_intervals(self):
        old, new = pair.correspondence('0~1=1~2')
        first = pair.anchors(old, Fraction(30), Fraction(2))
        second = pair.anchors(new, Fraction(30), Fraction(2))
        self.assertEqual([index + 30 for index in first], second)
        self.assertEqual(pair.correspondence('0~1'), (old, old))
        with self.assertRaises(ValueError):
            pair.anchors(new, Fraction(30), Fraction(1))
        with self.assertRaises(ValueError):
            pair.correspondence('1~0')

    def test_changed_input_rejected_before_decoding(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            old, new = out/'old.mp4', out/'new.mp4'
            old.write_bytes(b'old')
            new.write_bytes(b'new')
            for expected in [('wrong', None), (None, 'wrong')]:
                with self.assertRaisesRegex(ValueError, 'SHA-256'):
                    pair.create(old, new, ['0~1'], out, *expected)
            with self.assertRaisesRegex(ValueError, '같습니다'):
                pair.create(old, old, ['0~1'], out)
            self.assertEqual(set(out.iterdir()), {old, new})

    def test_frame_timestamp_must_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp)/'frames'
            def wrong_time(*args, **kwargs):
                (dest/'000001.jpg').touch()
                return subprocess.CompletedProcess([], 0, '', 'config in time_base: 1/30, frame_rate: 30/1\n'
                                                   'n: 0 pts: 10 pts_time:0.333')
            with patch.object(pair.subprocess, 'run', wrong_time):
                with self.assertRaisesRegex(ValueError, '실제 표시 시각'):
                    pair.extract(Path(tmp)/'src.mp4', [3], dest, Fraction(30))

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe 필요')
    def test_review_cli_missing_old_hash_keeps_original_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            new = root/'새판.mp4'
            out = root/'검수'
            subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i',
                            'color=blue:size=108x192:rate=12:duration=1', '-f', 'lavfi', '-i',
                            'anullsrc=r=48000:cl=stereo:d=1', '-c:v', 'libx264', '-threads', '1',
                            '-c:a', 'aac', str(new)], check=True)
            command = [sys.executable, '-I', '-X', 'utf8', str(Path(__file__).with_name('최종확인묶음.py')),
                       str(new), '--out', str(out), '--skip-stt', '--비교전', str(root/'구판.mp4'),
                       '--비교구간', '0~1']
            env = dict(os.environ, SYNK_검사이력='끔', SYNK_말시각='끔')
            proc = subprocess.run(command, capture_output=True, encoding='utf8', env=env, timeout=180)
            summary = json.loads(proc.stdout.splitlines()[-1])
            self.assertIn('SHA-256이 없어', summary['수정전후비교'])
            self.assertIn('기존 검수 자료만', (out/'독립검수_지시문.md').read_text(encoding='utf8'))
            self.assertTrue((out/'sheet_0.jpg').is_file())
            self.assertFalse(list(out.glob('compare_*')))

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe 필요')
    def test_video_delayed_against_audio_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'화면이_늦는_판.mp4'
            subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i',
                            'anullsrc=r=48000:cl=stereo:d=2', '-itsoffset', '0.5', '-f', 'lavfi',
                            '-i', 'color=red:size=40x60:rate=10:duration=1.5',
                            '-map', '1:v:0', '-map', '0:a:0', '-fps_mode', 'passthrough',
                            '-c:v', 'libx264', '-threads', '1', '-c:a', 'aac', str(path)], check=True)
            with self.assertRaisesRegex(ValueError, '시작 시각'):
                pair.stream(path)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg/ffprobe 필요')
    def test_render_offset_and_missing_range_does_not_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old, new = root/'이전.mp4', root/'수정.mp4'
            for path, color in [(old,'red'), (new,'blue')]:
                subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i',
                                f'color={color}:size=40x60:rate=12:duration=2', '-c:v', 'libx264',
                                '-threads', '1', str(path)], check=True)
            files = pair.create(old, new, ['0~1=1~2'], root, pair.fingerprint(old), pair.fingerprint(new))
            sheet = root/files[0]
            self.assertTrue(sheet.is_file())
            manifest = json.loads((sheet.parent/'source.json').read_text(encoding='utf8'))
            times = manifest['sections'][0]['time_seconds']
            self.assertEqual(len(times), 6)
            for a, b in times:
                self.assertAlmostEqual(b-a, 1)
            existing = set(root.iterdir())
            with self.assertRaisesRegex(ValueError, '영상 길이'):
                pair.create(old, new, ['0~3'], root)
            self.assertEqual(set(root.iterdir()), existing)


if __name__ == '__main__':
    unittest.main()
