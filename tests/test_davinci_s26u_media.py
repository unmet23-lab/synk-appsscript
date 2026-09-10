"""Media safety checks; synthetic FFmpeg integration, not a Resolve UI test."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "davinci_s26u_media", Path(__file__).resolve().parents[1] / "tools" / "davinci_s26u_media.py")
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)


class MetadataTests(unittest.TestCase):
    def test_all_rates_preserved(self):
        for rate, expected in [("24000/1001", "23.976"), ("24/1", "24"), ("25/1", "25"),
                               ("30000/1001", "29.97"), ("30/1", "30"), ("50/1", "50"),
                               ("60000/1001", "59.94"), ("60/1", "60")]:
            with self.subTest(rate=rate):
                self.assertEqual(media.canonical_rate({"avg_frame_rate": rate}), expected)
                self.assertEqual(media.canonical_rate({"avg_frame_rate": expected}), expected)

    def test_invalid_average_fallback_and_unsupported_rejection(self):
        for invalid in (None, "N/A", "0/0", "1/0", "NaN", "inf", "-1", "0"):
            self.assertEqual(media.canonical_rate({"avg_frame_rate": invalid, "r_frame_rate": "60/1"}), "60")
        for value in ("48", "120", "26", "23.98", "59", "0/0"):
            with self.assertRaises(media.SetupError):
                media.canonical_rate({"avg_frame_rate": value})
        with self.assertRaises(media.SetupError):
            media.canonical_rate({"avg_frame_rate": "48", "r_frame_rate": "24"})

    def test_display_rotation_and_tag_fallback(self):
        for angle in (90, -90, 270, 450):
            stream = {"width": 3840, "height": 2160, "side_data_list": [{"rotation": angle}]}
            self.assertEqual(media.timeline_dimensions(stream), (2160, 3840))
            self.assertEqual(media._output_dimensions(stream, True), (1080, 1920))
        self.assertEqual(media.timeline_dimensions({"width": 3840, "height": 2160,
                                                   "tags": {"rotate": "90"}}), (2160, 3840))
        self.assertEqual(media.timeline_dimensions({"width": 3840, "height": 2160,
                        "tags": {"rotate": "90"}, "side_data_list": [{"rotation": 0}]}), (3840, 2160))
        with self.assertRaises(media.SetupError):
            media.timeline_dimensions({"width": 3840, "height": 2160, "tags": {"rotate": 45}})

    def test_even_proxy_and_anamorphic_display(self):
        self.assertEqual(media._output_dimensions({"width": 1922, "height": 1082}, True), (960, 540))
        self.assertEqual(media._display_dimensions({"width": 1440, "height": 1080,
                                                   "sample_aspect_ratio": "4:3"}), (1920, 1080))

    def test_ten_bit_and_free_edition(self):
        for pix in ("yuv422p10le", "yuv420p12le", "p010le", "gbrp16le"):
            self.assertTrue(media.is_ten_bit({"pix_fmt": pix, "bits_per_raw_sample": "N/A"}))
        self.assertFalse(media.is_ten_bit({"pix_fmt": "yuv422p"}))
        self.assertTrue(media.needs_free_edition_transcode({"codec_name": "apv"}, False))
        self.assertTrue(media.needs_free_edition_transcode({"codec_name": "hevc", "pix_fmt": "p010le"}, False))
        self.assertFalse(media.needs_free_edition_transcode({"codec_name": "hevc", "pix_fmt": "p010le"}, True))

    def test_probe_skips_cover_art_and_invalid_json(self):
        payload = {"streams": [{"codec_type": "video", "disposition": {"attached_pic": 1}},
                               {"codec_type": "video", "index": 2}]}
        with patch.object(media, "_find_tool", return_value="ffprobe"), patch.object(media, "_run") as run:
            run.return_value = subprocess.CompletedProcess([], 0, json.dumps(payload), "")
            self.assertEqual(media.probe_video(Path("x"))["primary_video"]["index"], 2)
            run.return_value = subprocess.CompletedProcess([], 0, "bad json", "")
            with self.assertRaises(media.SetupError):
                media.probe_video(Path("x"))

    def test_budget_4k24_sixty_seconds(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "compressed.mp4"
            source.write_bytes(b"small compressed source")
            probe = {"primary_video": {"width": 3840, "height": 2160, "avg_frame_rate": "24",
                                       "duration": "60"}, "streams": [{"codec_type": "audio", "channels": 2}]}
            video_gib = media._dnxhr_frame_bytes(3840, 2160) * 1440 / 1024 ** 3
            self.assertAlmostEqual(video_gib, 4.88, delta=.01)
            required = media.estimate_work_bytes(source, probe, True)
            self.assertGreater(required, 25 * 1024 ** 3)
            self.assertGreater(required, media.estimate_work_bytes(source, probe, False))
            probe["primary_video"]["avg_frame_rate"] = "60"
            self.assertGreater(media.estimate_work_bytes(source, probe, True), required * 2)
            del probe["primary_video"]["duration"]
            with self.assertRaises(media.SetupError):
                media.estimate_work_bytes(source, probe, True)

    def test_original_and_hardlink_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "original.mov"
            source.write_bytes(b"original")
            for convert in (media.transcode_to_dnxhr_hqx, media.transcode_to_dnxhr_proxy):
                with self.assertRaises(media.SetupError):
                    convert(source, source)
            alias = Path(tmp) / "alias.mov"
            os.link(source, alias)
            with self.assertRaises(media.SetupError):
                media.transcode_to_dnxhr_hqx(source, alias)
            self.assertEqual(source.read_bytes(), b"original")

    def test_atomic_publish_does_not_clobber(self):
        with tempfile.TemporaryDirectory() as tmp:
            first, second = Path(tmp) / "a", Path(tmp) / "b"
            first.write_bytes(b"a")
            second.write_bytes(b"b")
            with self.assertRaises(OSError):
                media._publish_no_replace(first, second)
            self.assertEqual(second.read_bytes(), b"b")


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg/ffprobe unavailable")
class FFmpegIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="synk-media-test-")
        cls.root = Path(cls.temp.name)
        cls.source = cls.root / "source.mov"
        cls.ffmpeg = shutil.which("ffmpeg")
        cls.command(["-f", "lavfi", "-i", "testsrc2=size=640x512:rate=25:duration=0.6",
                     "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=0.6",
                     "-c:v", "libx264", "-threads:v", "2", "-c:a", "pcm_s16le", str(cls.source)])
        cls.rotated = cls.root / "rotated.mov"
        cls.command(["-display_rotation:v:0", "90", "-i", str(cls.source), "-c", "copy", str(cls.rotated)])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    @classmethod
    def command(cls, args):
        result = subprocess.run([cls.ffmpeg, "-hide_banner", "-v", "error", "-nostdin", "-n"] + args,
                                capture_output=True, text=True)
        if result.returncode:
            raise AssertionError(result.stderr)

    def test_rotated_hqx_and_half_proxy_audio_and_reuse(self):
        original_hash = media._sha256(self.rotated)
        self.assertEqual(media.timeline_dimensions(media.probe_video(self.rotated)["primary_video"]), (2160, 3840))
        for proxy in (False, True):
            with self.subTest(proxy=proxy):
                output = self.root / f"rotated-{proxy}.mov"
                convert = media.transcode_to_dnxhr_proxy if proxy else media.transcode_to_dnxhr_hqx
                convert(self.rotated, output)
                info = media.probe_video(output)
                self.assertEqual((info["primary_video"]["width"], info["primary_video"]["height"]),
                                 (256, 320) if proxy else (512, 640))
                self.assertEqual(info["primary_video"]["pix_fmt"], "yuv422p" if proxy else "yuv422p10le")
                self.assertEqual(media.canonical_rate(info["primary_video"]), "25")
                self.assertEqual(media._audio(info)[0]["codec_name"], "pcm_s24le")
                self.assertEqual(media._audio(info)[0]["sample_rate"], "48000")
                before = output.stat().st_mtime_ns
                convert(self.rotated, output)
                self.assertEqual(output.stat().st_mtime_ns, before)
                record = json.loads(output.with_name(output.name + ".manifest.json").read_text(encoding="utf-8"))
                self.assertEqual(record["output"]["frames"], 15)
                self.assertEqual(record["source"]["sha256"], original_hash)
        self.assertEqual(media._sha256(self.rotated), original_hash)

    def test_different_source_and_tampered_output_rejected(self):
        output = self.root / "reuse.mov"
        media.transcode_to_dnxhr_hqx(self.source, output)
        with self.assertRaises(media.SetupError):
            media.transcode_to_dnxhr_hqx(self.rotated, output)
        with output.open("ab") as handle:
            handle.write(b"tampered")
        with self.assertRaises(media.SetupError):
            media.transcode_to_dnxhr_hqx(self.source, output)

    def test_legacy_short_hqx_and_forged_length_rejected(self):
        output = self.root / "old-short.mov"
        self.command(["-i", str(self.source), "-t", "0.2", "-c:v", "dnxhd", "-profile:v", "dnxhr_hqx",
                      "-pix_fmt", "yuv422p10le", "-threads:v", "2", "-c:a", "pcm_s24le", "-ar", "48000", str(output)])
        before = media._sha256(output)
        with self.assertRaises(media.SetupError):
            media.transcode_to_dnxhr_hqx(self.source, output)
        self.assertEqual(before, media._sha256(output))
        complete = self.root / "complete-for-forgery.mov"
        media.transcode_to_dnxhr_hqx(self.source, complete)
        record = json.loads(complete.with_name(complete.name + ".manifest.json").read_text(encoding="utf-8"))
        record["output"] = media._evidence(output, media._probe(output, count_frames=True))
        output.with_name(output.name + ".manifest.json").write_text(json.dumps(record), encoding="utf-8")
        with self.assertRaises(media.SetupError):
            media.transcode_to_dnxhr_hqx(self.source, output)

    def test_failure_cleans_private_temporary_files(self):
        output = self.root / "failure.mov"
        real_run = media._run

        def fail_encode(command):
            if "-profile:v" in command:
                Path(command[-1]).write_bytes(b"incomplete")
                return subprocess.CompletedProcess(command, 1, "", "simulated encoder failure")
            return real_run(command)

        with patch.object(media, "_run", side_effect=fail_encode):
            with self.assertRaises(media.SetupError):
                media.transcode_to_dnxhr_hqx(self.source, output)
        self.assertFalse(output.exists())
        self.assertFalse(output.with_name(output.name + ".manifest.json").exists())
        self.assertFalse(list(self.root.glob(".synk-dnxhr-*")))

    def test_silent_sixty_fps_and_fractional_rate(self):
        for rate, expected in (("60", "60"), ("24000/1001", "23.976")):
            source = self.root / f"silent-{expected}.mov"
            output = self.root / f"silent-{expected}-hqx.mov"
            self.command(["-f", "lavfi", "-i", f"testsrc2=size=512x512:rate={rate}",
                          "-frames:v", "6", "-c:v", "libx264", "-threads:v", "2", str(source)])
            media.transcode_to_dnxhr_hqx(source, output)
            info = media._probe(output, count_frames=True)
            self.assertEqual(media.canonical_rate(info["primary_video"]), expected)
            self.assertEqual(int(info["primary_video"]["nb_read_frames"]), 6)
            self.assertEqual(media._audio(info), [])

    def test_all_audio_tracks_preserved_and_audio_loss_rejected(self):
        source = self.root / "two-audio.mov"
        output = self.root / "two-audio-hqx.mov"
        self.command(["-i", str(self.source), "-map", "0:v", "-map", "0:a", "-map", "0:a",
                      "-c", "copy", str(source)])
        media.transcode_to_dnxhr_hqx(source, output)
        manifest = output.with_name(output.name + ".manifest.json")
        record = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(len(record["output"]["audio"]), 2)
        record["output"]["audio"].pop()
        with self.assertRaises(media.SetupError):
            media._validate_output(record["source"], record["output"], record["conditions"])

    def test_interrupted_manifest_commit_cannot_be_reused(self):
        output = self.root / "interrupted.mov"
        original = media._publish_no_replace

        def fail_manifest(temp, destination):
            if destination.suffix == ".json":
                raise OSError("simulated interruption before manifest commit")
            original(temp, destination)

        with patch.object(media, "_publish_no_replace", side_effect=fail_manifest):
            with self.assertRaises(media.SetupError):
                media.transcode_to_dnxhr_hqx(self.source, output)
        self.assertTrue(output.exists())
        self.assertFalse(output.with_name(output.name + ".manifest.json").exists())
        with self.assertRaises(media.SetupError):
            media.transcode_to_dnxhr_hqx(self.source, output)
        self.assertFalse(list(self.root.glob(".synk-dnxhr-*")))


if __name__ == "__main__":
    unittest.main()
