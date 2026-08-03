"""채점기 자기검증용 **오답** 구현 — 벤더 제출물이 아니다.

일부러 세 가지를 틀린다. 채점기가 이 셋을 못 잡으면 감점 능력이 없는 것이다:
  ① 깨진 줄에서 예외를 던진다(규칙1 위반)
  ② 없는 디렉터리에서 예외를 던진다(규칙3 위반)
  ③ Recorder를 재사용하지 않고 파일명 파싱을 새로 짠다(규칙5 위반)
"""
import json
import os


def summarize_recordings(recordings_dir: str) -> dict:
    summary = {"files": 0, "events": 0, "malformed": 0, "games": {}, "sessions": []}

    for name in sorted(os.listdir(recordings_dir)):        # ② 없으면 OSError
        if not name.endswith(".recording.jsonl"):
            continue
        events = 0
        with open(os.path.join(recordings_dir, name), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                json.loads(line)                            # ① 깨지면 ValueError
                events += 1

        parts = name.split(".")                             # ③ 직접 파싱
        summary["files"] += 1
        summary["events"] += events
        summary["games"][parts[0]] = summary["games"].get(parts[0], 0) + 1
        summary["sessions"].append(
            {"file": name, "game": parts[0], "guid": parts[-3], "events": events}
        )

    return summary
