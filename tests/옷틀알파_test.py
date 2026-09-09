"""Regression tests for transparent outfit framing. No production assets are written."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outfit_frame', REPO / 'tools/옷틀맞추기.py')
frame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frame)

class OutfitAlphaTests(unittest.TestCase):
    def test_single_translucent_pixel_preserves_straight_rgba(self):
        pixel = (200, 100, 50, 128)
        result = frame.투명틀에앉히기(Image.new('RGBA', (1, 1), pixel), 1, 0, 0)
        self.assertEqual(result.getpixel((0, 0)), pixel)

    def test_antialiased_fur_edge_is_not_squared_or_darkened(self):
        source = Image.new('RGBA', (7, 1))
        pixels = [(172, 101, 72, alpha) for alpha in [0, 1, 32, 64, 128, 192, 255]]
        source.putdata(pixels)
        result = frame.투명틀에앉히기(source, 9, 1, 2)
        self.assertEqual([result.getpixel((x+1, 2)) for x in range(7)], pixels)
        self.assertEqual(result.getpixel((0, 2)), (0, 0, 0, 0))

    def test_negative_offset_clips_without_changing_remaining_rgba(self):
        source = Image.new('RGBA', (3, 3), (140, 90, 70, 100))
        result = frame.투명틀에앉히기(source, 3, -1, -1)
        self.assertEqual(result.getpixel((0, 0)), (140, 90, 70, 100))
        self.assertEqual(result.getpixel((2, 2)), (0, 0, 0, 0))

    def test_actual_output_branch_keeps_alpha_and_source_file(self):
        with tempfile.TemporaryDirectory(prefix='synk-outfit-alpha-') as folder:
            folder = Path(folder)
            source = folder / 'source.png'
            image = Image.new('RGBA', (3, 3), (180, 110, 75, 128))
            image.putpixel((1, 1), (180, 110, 75, 255))
            image.save(source)
            before = source.read_bytes()
            output = folder / 'review' / 'result.png'
            frame.앉히기(str(source), str(output), {'판': 5}, 값={'k': 1, 'dx': 1, 'dy': 1})
            with Image.open(output) as result:
                self.assertEqual(result.getpixel((1, 1)), (180, 110, 75, 128))
                self.assertEqual(result.getpixel((2, 2)), (180, 110, 75, 255))
            self.assertEqual(source.read_bytes(), before)

    def test_output_override_is_separate_and_cannot_target_source_or_canon(self):
        with tempfile.TemporaryDirectory(prefix='synk-outfit-path-') as folder:
            source = str(Path(folder) / 'source')
            custom = str(Path(folder) / 'review')
            self.assertEqual(frame.출력방(source, str(Path(folder) / 'default'), custom), custom)
            with self.assertRaises(ValueError):
                frame.출력방(source, source, source)
            with self.assertRaises(ValueError):
                frame.출력방(source, custom, str(Path(frame.정본방) / 'nested'))

if __name__ == '__main__':
    unittest.main()
