"""Summarize `.recording.jsonl` files produced by :class:`agents.recorder.Recorder`.

Standard library only. Filename parsing is delegated to the existing
``Recorder`` classmethods so the two stay in sync.
"""

import json
import os
from typing import Any

try:  # normal package import
    from .recorder import RECORDING_SUFFIX, Recorder
except ImportError:  # pragma: no cover - loaded outside the package
    try:
        from agents.recorder import RECORDING_SUFFIX, Recorder  # type: ignore[no-redef]
    except ImportError:
        # Last resort: load the sibling recorder module straight from disk so
        # this file works even when the package __init__ cannot be imported.
        import importlib.util as _importlib_util

        _spec = _importlib_util.spec_from_file_location(
            "_synk_recorder",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "recorder.py"),
        )
        if _spec is None or _spec.loader is None:  # pragma: no cover
            raise
        _recorder_mod = _importlib_util.module_from_spec(_spec)
        _spec.loader.exec_module(_recorder_mod)
        RECORDING_SUFFIX = _recorder_mod.RECORDING_SUFFIX
        Recorder = _recorder_mod.Recorder


def _empty_summary() -> dict[str, Any]:
    return {"files": 0, "events": 0, "malformed": 0, "games": {}, "sessions": []}


def _scan_file(path: str) -> tuple[int, int]:
    """Return ``(events, malformed)`` for one recording file.

    Blank / whitespace-only lines are ignored entirely. Lines that fail to
    parse as JSON are counted as malformed rather than raising.
    """
    events = 0
    malformed = 0
    with open(path, "r", encoding="utf-8") as f:
        while True:
            try:
                line = f.readline()
            except (UnicodeDecodeError, OSError):
                # Unreadable tail: keep whatever was counted so far.
                break
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            try:
                json.loads(line)
            except (ValueError, TypeError):
                malformed += 1
            else:
                events += 1
    return events, malformed


def summarize_recordings(recordings_dir: str) -> dict:
    """Summarize every ``*.recording.jsonl`` file in ``recordings_dir``.

    Returns a dict with keys ``files``, ``events``, ``malformed``, ``games``
    and ``sessions``. A missing (or unreadable) directory yields an empty
    summary instead of an exception.
    """
    summary = _empty_summary()

    if not recordings_dir or not os.path.isdir(recordings_dir):
        return summary

    try:
        entries = sorted(os.listdir(recordings_dir))
    except OSError:
        return summary

    games: dict[str, int] = {}
    sessions: list[dict[str, Any]] = []

    for name in entries:
        if not name.endswith(RECORDING_SUFFIX):
            continue
        path = os.path.join(recordings_dir, name)
        if not os.path.isfile(path):
            continue

        try:
            events, malformed = _scan_file(path)
        except (OSError, UnicodeDecodeError):
            # Unreadable file (permissions, encoding, ...): skip, keep going.
            continue

        game = Recorder.get_prefix_one(name)
        guid = Recorder.get_guid(name)

        summary["files"] += 1
        summary["events"] += events
        summary["malformed"] += malformed
        games[game] = games.get(game, 0) + 1
        sessions.append(
            {"file": name, "game": game, "guid": guid, "events": events}
        )

    summary["games"] = games
    summary["sessions"] = sorted(sessions, key=lambda s: s["file"])
    return summary
