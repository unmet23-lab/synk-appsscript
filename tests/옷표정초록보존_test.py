"""색만 보고 새싹까지 홍채로 여는 회귀와 별도 출력 경로를 검증한다."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('outfit_expression', ROOT/'tools/옷표정얹기.py')
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class GreenProtectionTest(unittest.TestCase):
    def setUp(self):
        self.rgb = np.full((40, 50, 3), (70, 55, 45), dtype=np.uint8)
        self.body = np.ones((40, 50), dtype=bool)
        self.eyes = (8, 8, 30, 15)

    def test_green_eye_is_open_but_same_color_leaf_is_protected(self):
        self.rgb[10, 10] = self.rgb[28, 10] = (60, 130, 45)
        seed = MOD.색옷씨앗(self.rgb, self.body, self.eyes)
        self.assertFalse(seed[10, 10])
        self.assertTrue(seed[28, 10])

    def test_low_saturation_fur_does_not_become_clothing(self):
        self.rgb[28, 10] = (60, 80, 50)
        self.assertFalse(MOD.색옷씨앗(self.rgb, self.body, self.eyes)[28, 10])

    def test_red_glasses_and_yellow_crown_remain_protected(self):
        self.rgb[10, 10] = (210, 85, 70)
        self.rgb[4, 10] = (230, 190, 60)
        seed = MOD.색옷씨앗(self.rgb, self.body, self.eyes)
        self.assertTrue(seed[10, 10])
        self.assertTrue(seed[4, 10])
        self.assertFalse(seed[10, 20])  # 원래의 갈색 털은 열어 둔다.

    def test_four_pixel_sampling_margin_is_not_a_face_height_margin(self):
        self.rgb[19, 10] = self.rgb[20, 10] = (60, 130, 45)
        seed = MOD.색옷씨앗(self.rgb, self.body, self.eyes)
        self.assertFalse(seed[19, 10])
        self.assertTrue(seed[20, 10])

    def test_background_is_not_protected(self):
        self.rgb[28, 10] = (60, 130, 45)
        self.body[28, 10] = False
        self.assertFalse(MOD.색옷씨앗(self.rgb, self.body, self.eyes)[28, 10])

    def test_output_is_separate_and_originals_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(MOD.출력방(folder), str(Path(folder).resolve()))
        for folder in [MOD.정본방, *MOD.옷방들]:
            with self.assertRaises(ValueError):
                MOD.출력방(str(Path(folder)/'candidate'))
        self.assertEqual(MOD.출력방(), MOD.낼방)


if __name__ == '__main__':
    unittest.main()
