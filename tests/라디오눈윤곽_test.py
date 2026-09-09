"""명시 눈 윤곽 계약과 실제 고정 원본의 국소 복구. 파일 생성/원본 변경 없음."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('radio_outline', ROOT/'tools/라디오눈윤곽.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
HAS_ASSETS = all(M.source_path(c).is_file() for c in M.OPEN_CUTS) and all(
    (ROOT/p).is_file() for p in M.REGISTRATION_SOURCES)


class OutlineContractTest(unittest.TestCase):
    def test_eight_masks_are_binary_bounded_and_separate(self):
        for cut in M.OPEN_CUTS:
            left, right = M.open_eye_mask(cut, 'L'), M.open_eye_mask(cut, 'R')
            self.assertEqual(left.shape, (1219, 1290))
            self.assertEqual(left.dtype, np.uint8)
            self.assertEqual(set(np.unique(left)), {0, 255})
            self.assertEqual(set(np.unique(right)), {0, 255})
            self.assertFalse(np.any((left > 0) & (right > 0)))
            self.assertTrue(5000 < (left > 0).sum() < 22000)
            self.assertTrue(5000 < (right > 0).sum() < 22000)
            for mask in [left, right]:
                self.assertFalse(mask[:270].any())
                self.assertFalse(mask[545:].any())

    def test_pupils_highlights_and_cheer_sclera_are_inside(self):
        points = {
            ('본체', 'L'): [(366, 330), (377, 355)],
            ('본체', 'R'): [(633, 330), (642, 356)],
            ('궁금함', 'L'): [(371, 334), (382, 359)],
            ('궁금함', 'R'): [(628, 326), (617, 355), (664, 367)],
            ('응원', 'L'): [(460, 434), (472, 528), (419, 468)],
            ('응원', 'R'): [(763, 431), (795, 530), (860, 470)],
            ('놀람', 'L'): [(359, 327), (392, 359)],
            ('놀람', 'R'): [(628, 326), (680, 360)],
        }
        for (cut, side), samples in points.items():
            mask = M.open_eye_mask(cut, side)
            for x, y in samples:
                self.assertEqual(mask[y, x], 255, (cut, side, x, y))

    def test_no_implicit_resize_or_expression_substitution(self):
        for size in [(1024, 1024), (1219, 1290), (2580, 2438)]:
            with self.assertRaises(ValueError):
                M.open_eye_mask('본체', 'L', size)
        with self.assertRaises(ValueError):
            M.open_eye_mask('눈감음', 'L')
        with self.assertRaises(ValueError):
            M.open_eye_mask('본체', 'middle')

    def test_numeric_sides_and_return_arrays_are_independent(self):
        self.assertTrue(np.array_equal(M.open_eye_mask('본체', 0), M.open_eye_mask('본체', 'L')))
        self.assertTrue(np.array_equal(M.open_eye_mask('본체', 1), M.open_eye_mask('본체', 'R')))
        mask = M.open_eye_mask('본체', 'L')
        mask[:] = 0
        self.assertTrue(M.open_eye_mask('본체', 'L').any())

    def test_changed_source_hash_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = M.source_path('본체', root)
            path.parent.mkdir(parents=True)
            path.write_bytes(b'different input')
            with self.assertRaisesRegex(ValueError, '원본이 바뀌었다'):
                M.validate_sources(root, include_registration=False)


@unittest.skipUnless(HAS_ASSETS, '실물 원본은 별도 로컬 자산이며 이 작업 사본에 없음')
class SourceRecoveryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hashes = M.validate_sources()
        cls.frames = {}
        for cut in M.OPEN_CUTS:
            with Image.open(M.source_path(cut)) as image:
                cls.frames[cut] = np.asarray(image).copy()
        cls.frames['눈감음'] = np.zeros((1219, 1290, 4), np.uint8)
        cls.before = {cut: arr.copy() for cut, arr in cls.frames.items()}
        cls.result = M.source_frames(cls.frames)

    def test_only_cheer_right_rgb_changes_and_all_alpha_is_preserved(self):
        selected = M.open_eye_mask('응원', 'R') > 0
        self.assertTrue(np.any(self.result['응원'][selected, :3] != self.before['응원'][selected, :3]))
        for cut, original in self.before.items():
            self.assertTrue(np.array_equal(self.frames[cut], original), cut)
            self.assertTrue(np.array_equal(self.result[cut][..., 3], original[..., 3]), cut)
            if cut == '응원':
                self.assertTrue(np.array_equal(self.result[cut][~selected], original[~selected]))
            else:
                self.assertTrue(np.array_equal(self.result[cut], original), cut)

    def test_restored_pixels_are_exact_registered_original_not_generated(self):
        selected = M.open_eye_mask('응원', 'R') > 0
        registered = M.registered_cheer()
        self.assertTrue(np.all(registered[..., 3][selected] == 255))
        self.assertTrue(np.array_equal(self.result['응원'][selected, :3], registered[selected, :3]))

    def test_unverified_passed_frame_is_rejected(self):
        changed = {cut: arr.copy() for cut, arr in self.before.items()}
        changed['본체'][0, 0, 0] ^= 1
        with self.assertRaisesRegex(ValueError, '검수 원본과 다르다'):
            M.source_frames(changed)

    def test_all_seven_source_files_remain_unchanged(self):
        self.assertEqual(len(self.hashes), 7)
        self.assertEqual(M.validate_sources(), self.hashes)


if __name__ == '__main__':
    unittest.main()
