"""python host/wb-pair-check.test.py — the api's start-time pair check (Linux: it needs directory descriptors)."""
import importlib.util, os, pathlib, sys, tempfile, unittest

here = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('wb_pair', here / 'wb-pair-check.py')
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)


@unittest.skipUnless(sys.platform.startswith('linux'), 'needs Linux directory descriptors')
class Pairs(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.tmp.name)
        uid = os.getuid(); M.UIDS = {'api': uid, 'keys': uid, 'files': uid}
        for role in ('api', 'keys', 'files'): (self.root / role / 'secrets').mkdir(parents=True)
        for name, worker in M.PAIRS.items():
            for role in ('api', worker): (self.root / role / 'secrets' / name).write_text('a' * 64 + '\n')
    def tearDown(self): self.tmp.cleanup()
    def test_equal_pairs_pass(self):
        self.assertEqual(M.split(str(self.root)), [])
    def test_a_split_pair_is_named(self):
        (self.root / 'keys' / 'secrets' / 'wb-keys-rpc').write_text('b' * 64)
        self.assertEqual(M.split(str(self.root)), ['wb-keys-rpc'])
    def test_links_and_missing_files_refuse(self):
        f = self.root / 'files' / 'secrets' / 'wb-files-rpc'; f.unlink(); f.symlink_to(self.root / 'api' / 'secrets' / 'wb-files-rpc')
        with self.assertRaises(OSError): M.split(str(self.root))
        f.unlink()
        with self.assertRaises(OSError): M.split(str(self.root))


if __name__ == '__main__': unittest.main()
