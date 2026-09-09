"""눈 합성의 구조 불변 시험. 합성 fixture만 쓰며 실제 원본/후보를 수정하지 않는다.

시각적 자연스러움이나 초승달 홍채의 완전한 동공 추출을 인증하는 시험은 아니다.
"""
import importlib.util
import unittest
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('radio_fur', ROOT/'tools/라디오털고정.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def fixture():
    """서로 다른 털 무늬와 눈을 가진 8컷. 이마 표본 자리를 충분히 둔다."""
    rng = np.random.default_rng(260909)
    noise = rng.integers(-9, 10, (400, 320, 1))
    rgb = np.clip(np.array([85, 61, 52])+noise, 0, 255).astype(np.uint8)
    base = np.dstack([rgb, np.full((400, 320), 255, np.uint8)])
    base[:12, :, 3] = 128
    base[-12:, :, 3] = 0
    frames, boxes = {}, {}
    for i, cut in enumerate(M.CUTS):
        arr = base.copy()
        # 입력 표정마다 털이 달라도 출력은 한 장만 공유해야 한다.
        if cut != '본체':
            arr[..., 0] = np.clip(arr[..., 0].astype(int)+i, 0, 255)
        points = [(90+i % 3, 190+i % 2), (230+i % 3, 190+i % 2)]
        for cx, cy in points:
            if cut in M.OPEN:
                cv2.ellipse(arr, (cx, cy), (17, 22), 0, 0, 360, (90, 150, 60, 255), -1)
                cv2.ellipse(arr, (cx, cy), (11, 15), 0, 0, 360, (10, 9, 8, 255), -1)
                cv2.circle(arr, (cx-5, cy-7), 3, (230, 230, 230, 255), -1)
            else:
                cv2.ellipse(arr, (cx, cy), (17, 10), 0, 0, 180, (90, 150, 60, 255), 4)
        frames[cut] = arr
        boxes[cut] = [[cx-36, cy-36, cx+37, cy+37] for cx, cy in points]
    return frames, boxes


class RadioFurTest(unittest.TestCase):
    def test_open_full_iris_keeps_internal_pupil_and_highlight(self):
        arr = np.full((64, 80, 4), (85, 61, 52, 255), np.uint8)
        cv2.circle(arr, (40, 32), 15, (90, 150, 60, 255), -1)
        cv2.circle(arr, (40, 32), 10, (10, 9, 8, 255), -1)
        arr[27, 36] = (230, 230, 230, 255)
        before = arr.copy()
        mask = M.eye_mask(arr, [18, 10, 62, 54], True)
        self.assertGreater(mask[32, 40], 0)
        self.assertGreater(mask[27, 36], 0)
        self.assertTrue(np.array_equal(arr, before))
        outside = np.ones((64, 80), bool)
        outside[10:54, 18:62] = False
        self.assertFalse(mask[outside].any())

    def test_closed_eye_does_not_fill_its_concave_interior(self):
        arr = np.full((64, 80, 4), (85, 61, 52, 255), np.uint8)
        cv2.ellipse(arr, (40, 30), (15, 13), 0, 0, 180, (90, 150, 60, 255), 3)
        mask = M.eye_mask(arr, [18, 10, 62, 54], False)
        self.assertGreater(mask[43, 40], 0)
        self.assertEqual(mask[32, 40], 0)

    def test_isolated_green_noise_is_not_an_eye_component(self):
        arr = np.full((64, 80, 4), (85, 61, 52, 255), np.uint8)
        arr[28:33, 36:44] = (90, 150, 60, 255)
        arr[13, 22] = (90, 150, 60, 255)
        mask = M.eye_mask(arr, [18, 10, 62, 54], False)
        self.assertEqual(mask[13, 22], 0)
        self.assertGreater(mask[30, 40], 0)

    def test_empty_eye_and_empty_bounds_fail_explicitly(self):
        arr = np.full((20, 20, 4), (85, 61, 52, 255), np.uint8)
        with self.assertRaises(ValueError):
            M.eye_mask(arr, [0, 0, 20, 20], True)
        with self.assertRaises(ValueError):
            M.bounds(np.zeros((20, 20), np.uint8))

    def test_feather_never_changes_pixels_outside_mask(self):
        mask = np.zeros((24, 24), np.uint8)
        mask[6:18, 6:18] = 255
        weight = M.feather(mask)
        self.assertEqual(weight.shape, (24, 24, 1))
        self.assertTrue(np.all(weight[mask == 0] == 0))
        self.assertTrue(np.all((weight >= 0) & (weight <= 1)))
        self.assertEqual(weight[12, 12, 0], 1)
        self.assertGreater(weight[6, 6, 0], 0)
        self.assertLess(weight[6, 6, 0], 1)

    def test_blend_preserves_alpha_inputs_and_zero_weight_pixels(self):
        base = np.full((8, 8, 4), (70, 50, 40, 128), np.uint8)
        source = np.full((8, 8, 4), (100, 160, 60, 255), np.uint8)
        weight = np.zeros((8, 8, 1))
        weight[2:6, 2:6] = 1
        before_base, before_source = base.copy(), source.copy()
        result = M.blend(base, source, weight)
        self.assertTrue(np.array_equal(result[..., 3], base[..., 3]))
        self.assertTrue(np.array_equal(result[weight[..., 0] == 0], base[weight[..., 0] == 0]))
        self.assertTrue(np.array_equal(result[3, 3, :3], source[3, 3, :3]))
        self.assertTrue(np.array_equal(base, before_base))
        self.assertTrue(np.array_equal(source, before_source))

    def test_build_rejects_missing_mismatched_and_rgb_frames(self):
        frames, boxes = fixture()
        incomplete = dict(frames)
        del incomplete['놀람']
        with self.assertRaises(ValueError):
            M.build(incomplete, boxes)
        wrong_size = dict(frames)
        wrong_size['놀람'] = wrong_size['놀람'][:-1]
        with self.assertRaises(ValueError):
            M.build(wrong_size, boxes)
        with self.assertRaises(ValueError):
            M.build({cut: arr[..., :3] for cut, arr in frames.items()}, boxes)

    def test_build_preserves_input_all_alpha_and_pixels_outside_support(self):
        frames, boxes = fixture()
        before = {cut: arr.copy() for cut, arr in frames.items()}
        results, support, plate, masks, checks = M.build(frames, boxes)
        self.assertEqual(set(results), set(M.CUTS))
        self.assertEqual(len(checks), 8)
        self.assertEqual(support.dtype, np.bool_)
        self.assertTrue(support.any())
        self.assertFalse(support.all())
        for cut in M.CUTS:
            self.assertTrue(np.array_equal(frames[cut], before[cut]), cut)
            self.assertTrue(np.array_equal(results[cut][..., 3], frames['본체'][..., 3]), cut)
            self.assertTrue(np.array_equal(results[cut][~support], results['본체'][~support]), cut)
            self.assertEqual(len(masks[cut]), 2)
        self.assertTrue(np.array_equal(plate[..., 3], frames['본체'][..., 3]))
        self.assertTrue(all(c['눈경계밖_변경화소'] == 0 and c['알파차이'] == 0 for c in checks))

    def test_every_frame_uses_identical_plate_outside_its_two_active_eyes(self):
        frames, boxes = fixture()
        results, _, plate, masks, checks = M.build(frames, boxes)
        height, width = frames['본체'].shape[:2]
        for row in checks:
            cut = row['표정']
            active = np.zeros((height, width), np.uint8)
            for mask, (dx, dy) in zip(masks[cut], row['눈_이동']):
                moved = cv2.warpAffine(mask, np.float32([[1, 0, dx], [0, 1, dy]]),
                                       (width, height), flags=cv2.INTER_NEAREST)
                self.assertEqual(int((moved > 0).sum()), int((mask > 0).sum()))
                active = np.maximum(active, moved)
            self.assertTrue(np.array_equal(results[cut][active == 0], plate[active == 0]), cut)


if __name__ == '__main__':
    unittest.main()
