"""이 폴더에서 python test_caption_overlap.py -v 로 실행한다.

Rust 경로까지 시험하려면 먼저 python caption_overlap.py --build 를 실행한다.
"""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

import caption_overlap
import 자리찾기 as placement


WIDTH, HEIGHT = 131, 141  # 64비트 경계 둘과 마지막 3픽셀을 포함한다.


class TestGlyphs:
    box_w = WIDTH

    def layout(self, word, size, alignment, y):
        advance = size - 3
        line = len(word) * advance
        # 가운데 글자는 x=64를 가로지르고, 왼쪽·오른쪽 글자는 화면 끝에 닿는다.
        left = {'l': 0, 'c': 59, 'r': WIDTH - line}[alignment]
        chars = []
        for i in range(len(word)):
            x = left + i * advance
            alpha = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
            alpha[max(0, y - 6):min(HEIGHT, y + 7), x:x + advance] = 40
            alpha[max(0, y - 3):min(HEIGHT, y + 4), x:x + advance] = 128
            chars.append(alpha)
        return chars, line


class CaptionOverlapTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.frames = Path(self.temp.name)
        self.rows = [{'f': f, 'w': f % 2, 'steady': f != 3} for f in range(6)]
        self.config = {'big': [('가', 1, 16, HEIGHT), ('나다', 1, 16, HEIGHT)],
                       'only_y': [1, HEIGHT - 2], 'sizes': [16, 12]}
        self.masks = {}
        self.enterContext(patch.dict(placement.SIZE, {'w': WIDTH, 'h': HEIGHT}))
        self.enterContext(patch.object(placement, 'subject_mask',
                                       side_effect=lambda t, *_: self.masks[round(t * placement.FPS)]))

    def write_frames(self, uniform):
        yy, xx = np.indices((HEIGHT, WIDTH))
        for row in self.rows:
            f = row['f']
            if uniform:
                pixels = np.full((HEIGHT, WIDTH), 255, dtype=np.uint8)
                self.masks[f] = None
            else:
                pixels = ((xx * 17 + yy * 5 + f * 43) % 256).astype(np.uint8)
                self.masks[f] = ((xx + yy + f) % 8 < 3) if f % 3 else None
            Image.fromarray(pixels).save(self.frames / f'{f:05d}.png')

    def picks(self):
        return placement.search(TestGlyphs(), [0, 1], self.rows, self.frames, [], 'p11',
                                self.config, top=100)

    def test_small_search_skips_native_and_keeps_tie_order(self):
        self.write_frames(uniform=True)
        with patch.object(placement, 'prepare_overlap', side_effect=AssertionError('작은 검색에서 Rust 준비')), \
             patch.object(placement, 'dilate', wraps=placement.dilate) as dilate:
            picks = self.picks()
        self.assertGreater(dilate.call_count, 0)
        at_top = [r for r in picks if (r['y'], r['size'], r['color']) == (1, 16, 'ink')]
        observed = [(r['x'], r['layer'], r['score'], r['worst_f'], r['worst_w']) for r in at_top]
        self.assertEqual(observed, [
            ('c', 'behind', 105, 0, 0), ('c', 'front', 105, 0, 0),
            ('l', 'behind', 63, 1, 1), ('l', 'front', 63, 1, 1),
            ('r', 'behind', 63, 1, 1), ('r', 'front', 63, 1, 1),
        ])
        with patch.object(placement, 'MIN_NATIVE_GLYPH_FRAME_CHECKS', 0), \
             patch.object(caption_overlap, 'load_counter', return_value=None) as missing_counter:
            self.assertEqual(self.picks(), picks)
        missing_counter.assert_called_once()

    def test_native_dispatch_counts_only_sampled_glyphs(self):
        # 64개 배치와 24개 글자×프레임 조합은 정확히 1,536회다.
        self.rows = [{'f': f, 'w': f % 2, 'steady': True} for f in range(16)]
        self.config.update(big=[('가', 1, 16, HEIGHT), ('나 다', 1, 16, HEIGHT)],
                           only_x='lc', only_y=list(range(1, 17)))
        self.write_frames(uniform=True)
        for rows, step, expected_calls in [(self.rows[:-1], 1, 0), (self.rows, 2, 0), (self.rows, 1, 1)]:
            with self.subTest(frames=len(rows), step=step), \
                 patch.object(placement, 'prepare_overlap', return_value=None) as prepare, \
                 patch.object(TestGlyphs, 'layout', return_value=([], WIDTH + 3)):
                placement.search(TestGlyphs(), [0, 1], rows, self.frames, [], 'p11', self.config, step=step)
            self.assertEqual(prepare.call_count, expected_calls)

    def test_native_matches_all_ranked_fields(self):
        path = caption_overlap.library_path(caption_overlap.SOURCE.read_bytes())
        if caption_overlap.load_counter(path) is None:
            self.skipTest('Rust 비교에는 python caption_overlap.py --build 가 필요합니다.')
        for uniform in (False, True):
            with self.subTest(uniform=uniform), patch.object(placement, 'MIN_NATIVE_GLYPH_FRAME_CHECKS', 0):
                self.write_frames(uniform)
                with patch.object(placement, 'prepare_overlap', return_value=None):
                    expected = self.picks()
                # DLL이 누락되거나 일부 낱말에서만 Python으로 되돌아가도 이 비교는 실패한다.
                with patch.object(placement, 'dilate', side_effect=AssertionError('Python 폴백 사용')):
                    actual = self.picks()
                self.assertEqual(len(expected), 48)
                self.assertEqual(actual, expected)


if __name__ == '__main__':
    unittest.main()
