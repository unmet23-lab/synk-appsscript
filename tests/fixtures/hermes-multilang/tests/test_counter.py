import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('fixture_counter', pathlib.Path(__file__).parent.parent / 'counter.py')
counter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(counter)


class CounterTests(unittest.TestCase):
    def test_completed_count(self):
        self.assertEqual(counter.completed_count(), 2)
