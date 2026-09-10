"""Free external CLI tests: mocks plus tiny real FFmpeg, never Resolve or UI."""

import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "davinci-s26u-free-prepare.py"
SPEC = importlib.util.spec_from_file_location("synk_free_prepare", SCRIPT)
free = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(free)


def read_report(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


class PrepareTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synk-free-unit-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / "source.mov"
        self.source.write_bytes(b"unchanged source bytes")
        self.guide = self.base / "guide.md"
        self.guide.write_text("versioned editing guide", encoding="utf-8")
        self.probe = {"primary_video": {"index": 0, "codec_type": "video", "codec_name": "h264",
                      "width": 640, "height": 512, "avg_frame_rate": "25/1", "duration": "0.4",
                      "nb_read_frames": "10", "nb_frames": "10", "pix_fmt": "yuv420p"},
                      "streams": [], "format": {"duration": "0.4"}}
        for obj, name, kwargs in [(free.media, "_probe", {"side_effect": lambda *a, **k: copy.deepcopy(self.probe)}),
                                   (free, "editorial_guide_source", {"return_value": self.guide})]:
            mock = patch.object(obj, name, **kwargs)
            mock.start()
            self.addCleanup(mock.stop)

    def prepare(self, **kwargs):
        return free.prepare_media(self.source, self.base, "Rec.709 Gamma 2.4", make_proxy=False, **kwargs)

    def failed(self, callback):
        with self.assertRaises(free.SetupError) as error:
            callback()
        report = read_report(error.exception.report_path)
        self.assertIs(report["media_prepared"], False)
        self.assertIs(report["resolve_project_ready"], False)
        self.assertIs(report["creative_finish_complete"], False)
        self.assertEqual(report["state"], "failed")
        return report

    def test_success_is_only_media_and_repeat_preserves_files(self):
        first_path = self.prepare()
        first = read_report(first_path)
        backup = Path(first["source_backup"]["path"])
        guide = Path(first["editorial_guide"]["path"])
        timestamps = (backup.stat().st_mtime_ns, guide.stat().st_mtime_ns)
        first_bytes = first_path.read_bytes()
        second_path = self.prepare()
        self.assertNotEqual(first_path, second_path)
        self.assertEqual(first_path.read_bytes(), first_bytes)
        self.assertEqual((backup.stat().st_mtime_ns, guide.stat().st_mtime_ns), timestamps)
        self.assertTrue(first["media_prepared"])
        self.assertFalse(first["resolve_project_ready"])
        self.assertFalse(first["creative_finish_complete"])
        self.assertFalse(first["proxy"]["prepared"])
        self.assertEqual(first["source_sha256"], free.file_sha256(backup))
        self.assertEqual(first["ui_handoff"]["import_video"], str(backup))

    def test_explicit_arguments_and_four_color_choices(self):
        with contextlib.redirect_stderr(io.StringIO()):
            for args in ([], ["--video", str(self.source)], ["--video", str(self.source), "--work-base", str(self.base)]):
                with self.assertRaises(SystemExit) as error:
                    free.main(args)
                self.assertEqual(error.exception.code, 2)
        self.assertEqual(set(free.INPUT_COLOR_SPACES), {"Samsung Log", "Rec.709 Gamma 2.4", "Rec.2100 HLG", "Rec.2100 ST2084"})

    def test_copy_change_and_guide_change_are_preserved(self):
        result = read_report(self.prepare())
        backup = Path(result["source_backup"]["path"])
        backup.write_bytes(b"user edit")
        self.failed(self.prepare)
        self.assertEqual(backup.read_bytes(), b"user edit")
        backup.write_bytes(self.source.read_bytes())
        guide = Path(result["editorial_guide"]["path"])
        guide.write_bytes(b"user guide edit")
        self.failed(self.prepare)
        self.assertEqual(guide.read_bytes(), b"user guide edit")

    def test_original_changes_during_copy_rejected(self):
        original_copy = free.verified_source_copy
        def changing(*args):
            result = original_copy(*args)
            self.source.write_bytes(b"new source bytes")
            return result
        with patch.object(free, "verified_source_copy", side_effect=changing):
            self.failed(self.prepare)

    def test_hardlink_is_not_reported_as_independent_source_copy(self):
        work_root = self.base / "SYNK_DAVINCI" / f"{self.source.stem}_{free.file_sha256(self.source)[:12]}"
        target = work_root / "source_backup" / self.source.name
        target.parent.mkdir(parents=True)
        os.link(self.source, target)
        self.failed(self.prepare)
        self.assertEqual(self.source.read_bytes(), b"unchanged source bytes")

    def test_mutation_during_hash_rejected(self):
        real_hash = free.file_sha256
        def changing(path):
            digest = real_hash(path)
            Path(path).write_bytes(b"changed during hash")
            return digest
        with patch.object(free, "file_sha256", side_effect=changing):
            self.failed(self.prepare)

    def test_same_filename_different_content_has_different_root(self):
        first = read_report(self.prepare())
        self.source.write_bytes(b"different original bytes")
        second = read_report(self.prepare())
        self.assertNotEqual(first["work_root"], second["work_root"])
        self.assertNotEqual(first["source_sha256"], second["source_sha256"])

    def test_low_disk_and_hdr_log_conflict_fail_false(self):
        with patch.object(free.media, "estimate_work_bytes", return_value=10**30):
            # The shared function has its own global reference to the estimator.
            with patch.dict(free._choose_work_root.__globals__, {"estimate_work_bytes": lambda *a: 10**30}):
                self.failed(self.prepare)
        self.probe["primary_video"]["color_transfer"] = "arib-std-b67"
        self.failed(lambda: free.prepare_media(self.source, self.base, "Samsung Log", make_proxy=False))

    def test_apv_and_hevc10_route_to_hqx_and_converter_failure_is_false(self):
        for codec in ("apv", "hevc"):
            self.probe["primary_video"].update(codec_name=codec, pix_fmt="yuv420p10le")
            with patch.object(free.media, "transcode_to_dnxhr_hqx", side_effect=free.SetupError("conversion failed")) as convert:
                self.failed(self.prepare)
                self.assertEqual(convert.call_count, 1)
                self.assertNotEqual(convert.call_args.args[0], self.source)

    def test_guide_writer_race_does_not_overwrite_competitor(self):
        publish = free.media._publish_no_replace
        raced = []
        def race(temp, destination):
            if destination.suffix == ".md":
                destination.write_bytes(b"competing user write")
                raced.append(destination)
            return publish(temp, destination)
        with patch.object(free.media, "_publish_no_replace", side_effect=race):
            self.failed(self.prepare)
        self.assertEqual(raced[0].read_bytes(), b"competing user write")

    def test_copy_writer_race_does_not_overwrite_competitor(self):
        helper_globals = free.verified_source_copy.__globals__
        publish = helper_globals["_publish_no_replace"]
        raced = []
        def race(temp, destination):
            destination.write_bytes(b"competing source copy")
            raced.append(destination)
            return publish(temp, destination)
        with patch.dict(helper_globals, {"_publish_no_replace": race}):
            self.failed(self.prepare)
        self.assertEqual(raced[0].read_bytes(), b"competing source copy")

    def test_report_writer_race_preserves_existing_and_cli_fails(self):
        publish = free.media._publish_no_replace
        raced = []
        def race(temp, destination):
            if destination.suffix == ".json":
                destination.write_bytes(b"existing report")
                raced.append(destination)
            return publish(temp, destination)
        stderr = io.StringIO()
        with patch.object(free.media, "_publish_no_replace", side_effect=race), contextlib.redirect_stderr(stderr):
            code = free.main(["--video", str(self.source), "--work-base", str(self.base),
                              "--input-color-space", "Rec.709 Gamma 2.4", "--no-proxy"])
        self.assertEqual(code, 2)
        self.assertFalse(json.loads(stderr.getvalue())["media_prepared"])
        self.assertEqual(raced[0].read_bytes(), b"existing report")

    def test_no_resolve_api_import_at_cli_help(self):
        code = ("import sys,runpy; "
                "sys.modules['DaVinciResolveScript']=None; "
                f"sys.argv=[{str(SCRIPT)!r},'--help']; "
                f"runpy.run_path({str(SCRIPT)!r},run_name='__main__')")
        result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--no-proxy", result.stdout)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg/ffprobe unavailable")
class FFmpegTests(unittest.TestCase):
    def test_real_apv_and_h264_without_proxy(self):
        with tempfile.TemporaryDirectory(prefix="synk-free-no-proxy-") as tmp:
            base = Path(tmp)
            for codec, pix, transcode in (("liboapv", "yuv422p10le", True), ("libx264", "yuv420p", False)):
                with self.subTest(codec=codec):
                    source = base / f"{codec}.mov"
                    command = [shutil.which("ffmpeg"), "-hide_banner", "-v", "error", "-nostdin", "-n",
                               "-f", "lavfi", "-i", "testsrc2=size=512x512:rate=24",
                               "-frames:v", "6", "-c:v", codec, "-pix_fmt", pix, "-threads:v", "2"]
                    command += ["-preset", "fastest" if codec == "liboapv" else "ultrafast", str(source)]
                    made = subprocess.run(command, capture_output=True, text=True)
                    self.assertEqual(made.returncode, 0, made.stderr)
                    digest = free.file_sha256(source)
                    with patch.dict(sys.modules, {"DaVinciResolveScript": None, "fusionscript": None}):
                        result = read_report(free.prepare_media(source, base, "Samsung Log" if transcode else "Rec.709 Gamma 2.4", make_proxy=False))
                    self.assertEqual(result["transcode_used"], transcode)
                    self.assertTrue(result["media_prepared"])
                    self.assertFalse(result["proxy"]["prepared"])
                    self.assertFalse(result["resolve_project_ready"])
                    self.assertFalse(result["creative_finish_complete"])
                    self.assertEqual(result["edit_source"]["verified_media"]["frames"], 6)
                    self.assertEqual(free.file_sha256(source), digest)
                    self.assertEqual(result["source_backup"]["sha256"], digest)
                    if transcode:
                        self.assertEqual(result["edit_source"]["verified_media"]["profile"].upper(), "DNXHR HQX")

    def test_real_hevc10_hqx_proxy_cli_and_repeat(self):
        with tempfile.TemporaryDirectory(prefix="synk-free-ffmpeg-") as tmp:
            base = Path(tmp)
            source = base / "tiny-hevc10.mov"
            command = [shutil.which("ffmpeg"), "-hide_banner", "-v", "error", "-nostdin", "-n",
                       "-f", "lavfi", "-i", "testsrc2=size=640x512:rate=25:duration=0.4",
                       "-f", "lavfi", "-i", "sine=sample_rate=44100:duration=0.4",
                       "-c:v", "libx265", "-pix_fmt", "yuv420p10le", "-preset", "ultrafast",
                       "-x265-params", "pools=1:frame-threads=1:log-level=error", "-c:a", "pcm_s16le", str(source)]
            made = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(made.returncode, 0, made.stderr)
            digest = free.file_sha256(source)
            args = [sys.executable, "-B", str(SCRIPT), "--video", str(source), "--work-base", str(base),
                    "--input-color-space", "Rec.709 Gamma 2.4"]
            env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1")
            run = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", env=env)
            self.assertEqual(run.returncode, 0, run.stderr)
            result = read_report(json.loads(run.stdout)["report_path"])
            self.assertTrue(result["media_prepared"])
            self.assertFalse(result["resolve_project_ready"])
            self.assertFalse(result["creative_finish_complete"])
            edit = result["edit_source"]["verified_media"]
            proxy = result["proxy"]["verified_media"]
            self.assertEqual(edit["pix_fmt"], "yuv422p10le")
            self.assertEqual(edit["profile"].upper(), "DNXHR HQX")
            self.assertEqual(edit["dimensions"], [640, 512])
            self.assertEqual(proxy["profile"].upper(), "DNXHR LB")
            self.assertEqual(proxy["pix_fmt"], "yuv422p")
            self.assertEqual(proxy["dimensions"], [320, 256])
            self.assertEqual(proxy["frames"], 10)
            self.assertEqual(proxy["audio"][0]["codec"], "pcm_s24le")
            self.assertEqual(proxy["audio"][0]["sample_rate"], 48000)
            self.assertEqual(free.file_sha256(source), digest)
            timestamps = [Path(result[key]["path"]).stat().st_mtime_ns for key in ("edit_source", "proxy")]
            rerun = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", env=env)
            self.assertEqual(rerun.returncode, 0, rerun.stderr)
            self.assertEqual(timestamps, [Path(result[key]["path"]).stat().st_mtime_ns for key in ("edit_source", "proxy")])
            self.assertNotEqual(json.loads(run.stdout)["report_path"], json.loads(rerun.stdout)["report_path"])


if __name__ == "__main__":
    unittest.main()
