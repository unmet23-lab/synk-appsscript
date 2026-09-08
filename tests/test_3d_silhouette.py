"""실루엣 측정의 비율·알파·옛 산출물 오류만 재현한다. Blender는 실행하지 않는다."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('silhouette_gate', Path(__file__).parents[1] / 'tools' / '삼디실루엣대조.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class SilhouetteTests(unittest.TestCase):
    def test_aspect_difference_survives(self):
        a = np.zeros((80, 80), dtype=bool)
        b = a.copy()
        a[10:70, 30:50] = True
        b[20:60, 20:60] = True
        self.assertFalse(np.array_equal(gate.상자맞춤(a), gate.상자맞춤(b)))
        self.assertTrue(np.array_equal(gate.상자맞춤(a, 비율보존=False), gate.상자맞춤(b, 비율보존=False)))

    def test_translation_is_removed(self):
        a = np.zeros((80, 80), dtype=bool)
        b = a.copy()
        a[10:50, 10:30] = True
        b[30:70, 40:60] = True
        self.assertTrue(np.array_equal(gate.상자맞춤(a), gate.상자맞춤(b)))

    def test_invalid_alpha_rejected(self):
        with tempfile.TemporaryDirectory(prefix='synk-silhouette-test-') as d:
            for alpha in (0, 255):
                p = Path(d) / 'alpha.png'
                Image.new('RGBA', (8, 8), (30, 30, 30, alpha)).save(p)
                with self.assertRaises(ValueError):
                    gate.알파(p)

    def test_failed_render_with_existing_png_is_not_success(self):
        with tempfile.TemporaryDirectory(prefix='synk-silhouette-test-') as d:
            p = Path(d) / 'old.png'
            Image.new('RGBA', (8, 8), (30, 30, 30, 0)).save(p)
            with patch.object(gate, '일방', Path(d)), patch.object(gate, '블렌더', Path(__file__)), patch.object(gate, '렌더판', p), patch.object(gate.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout='failed', stderr='')):
                with self.assertRaises(SystemExit):
                    gate.렌더한다()

if __name__ == '__main__':
    unittest.main()
