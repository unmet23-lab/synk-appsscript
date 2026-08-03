"""Helpers for summarizing recorder output files."""

import json
import os

from .recorder import RECORDING_SUFFIX, Recorder


__all__ = ["summarize_recordings"]


def summarize_recordings(recordings_dir: str) -> dict:
    """Summarize the recording JSONL files directly inside ``recordings_dir``."""
    summary = {
        "files": 0,
        "events": 0,
        "malformed": 0,
        "games": {},
        "sessions": [],
    }

    if not os.path.isdir(recordings_dir):
        return summary

    try:
        filenames = sorted(os.listdir(recordings_dir))
    except OSError:
        return summary

    for filename in filenames:
        path = os.path.join(recordings_dir, filename)
        if not filename.endswith(RECORDING_SUFFIX) or not os.path.isfile(path):
            continue

        summary["files"] += 1
        game = Recorder.get_prefix_one(filename)
        guid = Recorder.get_guid(filename)
        event_count = 0

        try:
            with open(path, "r", encoding="utf-8") as recording_file:
                for line in recording_file:
                    if not line.strip():
                        continue
                    try:
                        json.loads(line)
                    except json.JSONDecodeError:
                        summary["malformed"] += 1
                    else:
                        event_count += 1
                        summary["events"] += 1
        except (OSError, UnicodeError):
            pass

        games = summary["games"]
        games[game] = games.get(game, 0) + 1
        summary["sessions"].append(
            {
                "file": filename,
                "game": game,
                "guid": guid,
                "events": event_count,
            }
        )

    return summary
