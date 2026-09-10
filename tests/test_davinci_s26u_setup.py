"""Settings, save and input contracts; native acceptance is a separate tool."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'davinci-s26u-one-video.py'
spec = importlib.util.spec_from_file_location('synk_setup_tests', SCRIPT)
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class Project:
    def __init__(self):
        self.settings = {}
    def SetSettings(self, settings):
        if 'bad' in settings.values():
            raise ValueError('unsupported enum')
        self.settings.update(settings)
        return True
    def GetSettings(self):
        return dict(self.settings)


class SetupTests(unittest.TestCase):
    def test_fallback_exception_then_success(self):
        p = Project()
        result = w.apply_project_settings(p, [('colorSpaceTimeline', ['bad', 'good'], True)])
        self.assertEqual(result['applied']['colorSpaceTimeline'], 'good')
        self.assertFalse(result['failed_optional'])

    def test_true_without_actual_application_fails(self):
        p = Project()
        p.SetSettings = lambda s: True
        with self.assertRaises(w.SetupError):
            w.apply_project_settings(p, [('timelineFrameRate', ['24'], True)])

    def test_later_setting_reset_detected(self):
        p = Project()
        original = p.SetSettings
        def changed(s):
            original(s)
            if 'second' in s:
                p.settings['first'] = 'reset'
            return True
        p.SetSettings = changed
        with self.assertRaises(w.SetupError):
            w.apply_project_settings(p, [('first', ['good'], True), ('second', ['good'], True)])

    def test_save_failure_not_success(self):
        class Manager:
            def SaveProject(self):
                return False
        with self.assertRaises(w.SetupError):
            w.save_checked(Manager())

    def test_unknown_input_requires_confirmation(self):
        with self.assertRaises(w.SetupError):
            w.input_color_contract({}, None)

    def test_hdr_cannot_be_silently_log(self):
        for tag in ('smpte2084', 'arib-std-b67'):
            with self.assertRaises(w.SetupError):
                w.input_color_contract({'color_transfer': tag}, 'Samsung Log')
        self.assertEqual(w.input_color_contract({}, 'Samsung Log'), 'Samsung Log')

    def test_verified_copy_protects_user_edit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'source.mov'
            src.write_bytes(b'original media')
            copied = w.verified_source_copy(src, root / 'work')
            self.assertEqual(copied.read_bytes(), src.read_bytes())
            copied.write_bytes(b'user edit')
            with self.assertRaises(w.SetupError):
                w.verified_source_copy(src, root / 'work')
            self.assertEqual(copied.read_bytes(), b'user edit')

    def test_cache_path_separators_match(self):
        self.assertTrue(w.setting_matches('perfCacheClipsLocation', 'C:/test/cache', r'C:\test\cache'))

    def test_critical_studio_options_requested(self):
        settings = w.build_project_settings({'width':3840, 'height':2160, 'avg_frame_rate':'24/1'}, Path('C:/work'))
        values = {k:(v,c) for k,v,c in settings}
        self.assertEqual(values['perfOptimisedMediaOn'], (['0'], True))
        self.assertEqual(values['perfProxyMediaMode'], (['1'], True))
        self.assertEqual(values['timelineWorkingLuminanceMode'], (['SDR 100'], True))

    def test_reopen_requires_correct_current_timeline(self):
        p = Project()
        p.GetCurrentTimeline = lambda: None
        with self.assertRaises(w.SetupError):
            w.verify_loaded_project(p, [], '01_EDIT_RHYTHM')

    def test_edition_gate_before_media_or_filesystem_work(self):
        class Free:
            def GetVersion(self): return [21, 1, 0, '', 14]
            def IsStudio(self): return False
        with patch.object(w, 'probe_video') as probe:
            with self.assertRaisesRegex(w.SetupError, 'Studio'):
                w.setup_resolve(Free(), Path('does-not-exist.mov'))
            probe.assert_not_called()

    def test_studio_edition_gate_and_unknown_version(self):
        class Studio:
            def GetVersion(self): return [21, 1, 0, '', 14]
            def IsStudio(self): return True
        w.require_python_edition(Studio())
        with self.assertRaises(w.SetupError):
            w.require_python_edition(object())

    def test_interrupted_source_copy_can_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'source.mov'
            src.write_bytes(b'original media')
            def partial_copy(source, dest, size):
                dest.write(b'partial')
                raise OSError('simulated full disk')
            with patch.object(w.shutil, 'copyfileobj', side_effect=partial_copy):
                with self.assertRaises(OSError):
                    w.verified_source_copy(src, root / 'work')
            self.assertEqual(list((root / 'work' / 'source_backup').iterdir()), [])
            self.assertEqual(w.verified_source_copy(src, root / 'work').read_bytes(), src.read_bytes())

    def test_source_copy_does_not_overwrite_competing_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'source.mov'
            src.write_bytes(b'original media')
            original_publish = w._publish_no_replace
            def competing_publish(temp, dest):
                dest.write_bytes(b'competing user file')
                original_publish(temp, dest)
            with patch.object(w, '_publish_no_replace', side_effect=competing_publish):
                with self.assertRaises(OSError):
                    w.verified_source_copy(src, root / 'work')
            target = root / 'work' / 'source_backup' / src.name
            self.assertEqual(target.read_bytes(), b'competing user file')
            self.assertFalse(list(target.parent.glob('.synk-source-*')))


if __name__ == '__main__':
    unittest.main()
