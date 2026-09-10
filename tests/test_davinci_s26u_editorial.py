"""Offline contract checks; these do not certify an in-app Resolve run."""

import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "davinci-s26u-one-video.py"
SPEC = importlib.util.spec_from_file_location("synk_resolve", SCRIPT)
workflow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workflow)


class Timeline:
    def __init__(self, audio_tracks=2, duplicate_fails=False, track_fails=False):
        self.name = "00_SOURCE_FULL"
        self.tracks = {"video": ["ORIGINAL"], "audio": [f"SOURCE_{i}" for i in range(audio_tracks)]}
        self.clips = ["untrimmed-source-clip"]
        self.markers = {0: "color management"}
        self.duplicate_fails = duplicate_fails
        self.track_fails = track_fails

    def GetName(self):
        return self.name

    def DuplicateTimeline(self, name):
        if self.duplicate_fails:
            return None
        other = copy.deepcopy(self)
        other.name = name
        return other

    def GetTrackCount(self, kind):
        return len(self.tracks[kind])

    def GetTrackName(self, kind, index):
        return self.tracks[kind][index - 1]

    def SetTrackName(self, kind, index, name):
        self.tracks[kind][index - 1] = name
        return True

    def AddTrack(self, kind, subtype=None):
        if self.track_fails:
            return False
        self.tracks[kind].append("empty")
        return True

    def GetStartFrame(self):
        return 86400

    def GetEndFrame(self):
        return 86640

    def AddMarker(self, frame, color, name, note, duration, custom_data):
        if frame in self.markers:
            return False
        self.markers[frame] = note
        return True


class Project:
    def SetCurrentTimeline(self, timeline):
        self.current = timeline
        return True


class EditorialTests(unittest.TestCase):
    def test_source_and_all_audio_tracks_survive(self):
        source = Timeline(audio_tracks=2)
        before = copy.deepcopy(source.__dict__)
        working, report = workflow.prepare_editorial_timeline(Project(), source, {"path": "guide.md"})
        self.assertEqual(source.__dict__, before)
        self.assertEqual(working.clips, source.clips)
        self.assertEqual(working.tracks["audio"][:2], ["A_DIALOGUE_SOURCE_01", "A_DIALOGUE_SOURCE_02"])
        self.assertEqual(len(working.tracks["audio"]), 5)
        self.assertEqual(working.markers[0], "color management")
        self.assertIn(1, working.markers)
        self.assertTrue(report["ready"])
        self.assertFalse(report["automatic_cuts"])

    def test_silent_source_gets_empty_dialogue_track(self):
        working, report = workflow.prepare_editorial_timeline(Project(), Timeline(0), {"path": "guide.md"})
        self.assertEqual(report["source_audio_tracks"], 0)
        self.assertEqual(working.tracks["audio"][0], "A_DIALOGUE_EMPTY")
        self.assertTrue(report["ready"])

    def test_duplicate_failure_is_not_reported_ready(self):
        source = Timeline(duplicate_fails=True)
        working, report = workflow.prepare_editorial_timeline(Project(), source, {"path": "guide.md"})
        self.assertIs(working, source)
        self.assertFalse(report["ready"])
        self.assertTrue(report["failures"])

    def test_track_failure_is_not_reported_ready(self):
        _, report = workflow.prepare_editorial_timeline(Project(), Timeline(track_fails=True), {"path": "guide.md"})
        self.assertFalse(report["ready"])
        self.assertTrue(report["failures"])

    def test_reference_copy_is_versioned_and_protects_modified_copy(self):
        source = workflow.editorial_guide_source()
        with tempfile.TemporaryDirectory(prefix="synk-editorial-test-") as temp:
            first = workflow.preserve_editorial_guide(Path(temp), source)
            second = workflow.preserve_editorial_guide(Path(temp), source)
            self.assertEqual(first, second)
            destination = Path(first["path"])
            self.assertEqual(destination.read_bytes(), source.read_bytes())
            destination.write_text("user edit", encoding="utf-8")
            with self.assertRaises(workflow.SetupError):
                workflow.preserve_editorial_guide(Path(temp), source)
            self.assertEqual(destination.read_text(encoding="utf-8"), "user edit")


if __name__ == "__main__":
    unittest.main()
