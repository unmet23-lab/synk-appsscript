import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec=importlib.util.spec_from_file_location('migration',Path(__file__).resolve().parents[1]/'tools/drive-mascot-archive.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='synk-drive-migration-test-')
        root=Path(self.tmp.name)
        mod.REPO=root;mod.OPS=root/'ops';mod.SOURCE=root/'source';mod.STAGE=root/'stage';mod.REMOTE=root/'remote'
        for p in (mod.OPS,mod.SOURCE,mod.STAGE,mod.REMOTE):p.mkdir()
        self.src=mod.SOURCE/'asset.png';self.src.write_bytes(b'original-asset')
        r=dict(path='asset.png',bytes=self.src.stat().st_size,mtime_ns=self.src.stat().st_mtime_ns,sha256=mod.digest(self.src))
        with zipfile.ZipFile(mod.REMOTE/'mascot-0001.zip','w') as z:z.write(self.src,'asset.png')
        receipt=dict(archive='mascot-0001.zip',bytes=(mod.REMOTE/'mascot-0001.zip').stat().st_size,sha256=mod.digest(mod.REMOTE/'mascot-0001.zip'),files=[r])
        mod.write_new(mod.OPS/'mascot-0001.json',receipt)
        mod.write_new(mod.OPS/'pack-plan.json',dict(packs=[dict(number=1,files=[r])]))

    def tearDown(self):self.tmp.cleanup()

    def test_corrupt_remote_preserves_source(self):
        p=mod.REMOTE/'mascot-0001.zip';b=bytearray(p.read_bytes());b[0]^=1;p.write_bytes(b)
        with self.assertRaises(RuntimeError):mod.reclaim(1)
        self.assertEqual(self.src.read_bytes(),b'original-asset')

    def test_changed_source_is_preserved(self):
        self.src.write_bytes(b'updated-source')
        mod.reclaim(1)
        self.assertEqual(self.src.read_bytes(),b'updated-source')

    def test_verified_reclaim_and_exact_restore(self):
        mod.reclaim(1);self.assertFalse(self.src.exists())
        mod.restore('asset.png');self.assertEqual(self.src.read_bytes(),b'original-asset')

    def test_escape_rejected(self):
        with self.assertRaises(ValueError):mod.source_path('../outside.png')

if __name__=='__main__':unittest.main()
