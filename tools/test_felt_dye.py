import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

import felt_dye
import 펠트색갈이 as dye


def check_pixels():
    rng = random.Random(20261119)
    pixels = [(127, 127, 127), (160, 120, 115), (255, 0, 0), (0, 0, 0)] * 17
    pixels.extend(tuple(rng.randrange(256) for _ in range(3)) for _ in range(33 * 29 - len(pixels)))
    image = Image.new("RGB", (33, 29))
    image.putdata(pixels)
    for neutral in (False, True):
        for knee in (0.0, 0.94, 1.0):
            native = felt_dye.prepare(image, knee, neutral)
            assert native is not None
            for gains in ((1.0, 1.0, 1.0), (2.3, 0.63, 1.8), (0.0, 0.0, 0.0)):
                expected, *expected_counts = dye.적용(image.load(), *image.size, gains, knee, neutral)
                actual, *actual_counts = native(gains)
                assert actual_counts == expected_counts, (neutral, knee, gains)
                assert actual.tobytes() == expected.tobytes(), (neutral, knee, gains)


class FeltDyeTests(unittest.TestCase):
    def test_native_matches_reference(self):
        if felt_dye.load_kernel(felt_dye.library_path(felt_dye.SOURCE.read_bytes())):
            check_pixels()
            return
        if not shutil.which("rustc"):
            self.skipTest("Install rustc or run felt_dye.py --build to test the native kernel.")
        with tempfile.TemporaryDirectory() as temp:
            env = dict(os.environ, LOCALAPPDATA=temp, XDG_CACHE_HOME=temp, HOME=temp)
            # The child exits before Windows tries to remove its loaded DLL.
            subprocess.run([sys.executable, "-c",
                            "import felt_dye; felt_dye.build(); "
                            "from test_felt_dye import check_pixels; check_pixels()"],
                           check=True, cwd=Path(__file__).resolve().parent, env=env)

    def test_small_images_and_unsupported_knee_use_python(self):
        small = Image.new("RGB", (1023, 1024))
        large = Image.new("RGB", (1024, 1024))
        with patch.object(felt_dye, "prepare") as prepare, patch.object(dye, "적용") as original:
            for image, knee in [(small, 0.94), (large, -0.1), (large, 1.1), (large, float("nan"))]:
                dye.게인적용기(image, knee, False)((1.0, 1.0, 1.0))
            self.assertEqual(original.call_count, 4)
            prepare.assert_not_called()

    def test_missing_library_and_failed_native_allocation_use_python(self):
        image = Image.new("RGB", (1024, 1024))
        gains = (0.9, 1.1, 1.07)
        for failure in (None, lambda _gains: None):
            with patch.object(felt_dye, "prepare", return_value=failure) as prepare:
                with patch.object(dye, "적용") as original:
                    result = dye.게인적용기(image, 0.94, False)(gains)
                    self.assertIs(result, original.return_value)
                    prepare.assert_called_once_with(image, 0.94, False)
                    self.assertEqual(original.call_args.args[1:], (1024, 1024, gains, 0.94, False))

    def test_loader_only_uses_the_versioned_cache(self):
        source = felt_dye.SOURCE.read_bytes().replace(b"\r\n", b"\n")
        cache = felt_dye.library_path(source)
        self.assertEqual(cache, felt_dye.library_path(source.replace(b"\n", b"\r\n")))
        self.assertNotEqual(cache, felt_dye.library_path(source + b"\n"))
        with patch.object(felt_dye, "load_kernel", return_value=None) as load:
            self.assertIsNone(felt_dye.prepare(Image.new("RGB", (1, 1)), 0.94, False))
            load.assert_called_once_with(cache)
        with patch.object(felt_dye, "load_kernel") as load:
            self.assertIsNone(felt_dye.prepare(Image.new("RGBA", (1, 1)), 0.94, False))
            load.assert_not_called()


if __name__ == "__main__":
    unittest.main()
