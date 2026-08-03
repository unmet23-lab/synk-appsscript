"""채점기 자기검증용 **정답** 구현 — 벤더 제출물이 아니다.

이 파일이 만점을 못 받으면 채점기가 틀린 것이다(가드는 픽스처로 탐지 능력을 못박는다).
"""
import json
import os

from .recorder import RECORDING_SUFFIX, Recorder


def summarize_recordings(recordings_dir: str) -> dict:
    summary = {"files": 0, "events": 0, "malformed": 0, "games": {}, "sessions": []}
    try:
        names = sorted(os.listdir(recordings_dir))
    except OSError:
        return summary

    for name in names:
        path = os.path.join(recordings_dir, name)
        if not name.endswith(RECORDING_SUFFIX) or not os.path.isfile(path):
            continue

        events = malformed = 0
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        json.loads(line)
                    except ValueError:
                        malformed += 1
                    else:
                        events += 1
        except OSError:
            continue

        game = Recorder.get_prefix_one(name)
        summary["files"] += 1
        summary["events"] += events
        summary["malformed"] += malformed
        summary["games"][game] = summary["games"].get(game, 0) + 1
        summary["sessions"].append(
            {"file": name, "game": game, "guid": Recorder.get_guid(name), "events": events}
        )

    summary["sessions"].sort(key=lambda s: s["file"])
    return summary
