"""Turn the next-meeting walkthrough into one animated scene per action.

The exact v14 master narration is retained. New scene boundaries fall in pauses
between spoken phrases, so this edit needs no new voice synthesis.
"""
import copy
import json
from pathlib import Path

root = Path(__file__).resolve().parent
source = root.parent / "video-v14"
scenes = json.loads((source / "content.json").read_text(encoding="utf-8"))
timing = json.loads((source / "voice-timing.json").read_text(encoding="utf-8"))


def camera_body(image, target, labels, action, note, *, mask="", overlay=""):
    x, y, w, h = target
    return (
        '<div class="camera-steps"><b class="phase-wide">① 전체 화면</b>'
        '<span>→</span><b class="phase-focus">② 위치 확대</b>'
        '<span>→</span><b class="phase-act">③ 클릭</b></div>'
        '<div class="camera-frame"><div class="camera-world">'
        f'<img class="cam-base" src="assets/{image}" alt="ChatGPT 화면">'
        f'{mask}{overlay}'
        f'<div class="cam-target" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div>'
        '<div class="cam-pointer"><i></i><svg viewBox="0 0 24 24">'
        '<path d="M3 2.8 20.6 14 12.8 15.5 9 22 3 2.8Z" '
        'fill="white" stroke="#315fbe" stroke-width="1.4"/></svg></div>'
        f'</div><div class="camera-label">{labels}</div></div>'
        f'<div class="cam-action">{action}</div><div class="cam-note">{note}</div>'
    )


result = []
for original in scenes:
    if original["id"] == "repeat-find":
        menu = copy.deepcopy(original)
        menu.update(
            id="repeat-menu",
            duration=4.1,
            step="다음 회의 1/5 · 프로젝트 메뉴",
            title="왼쪽 ‘프로젝트’<br>메뉴를 누르세요.",
            caption="다음 회의가 끝나면 ChatGPT 왼쪽의 프로젝트 메뉴를 누르세요.",
            body=camera_body(
                "project/01-projects.png", (6, 132, 248, 35),
                "왼쪽 사이드바 · 프로젝트", "‘프로젝트’ 메뉴 클릭",
                "실제 ChatGPT 화면 · 전체 위치에서 메뉴까지 확대",
            ),
            camera={
                "file": "project/01-projects.png", "focus": [0, 40, 320, 260],
                "rect": [6, 132, 248, 35], "point": [84, 150],
                "actionAt": 2.7,
            },
        )
        project = copy.deepcopy(original)
        project.update(
            id="repeat-project",
            duration=3.4,
            step="다음 회의 2/5 · 같은 프로젝트",
            title="같은 ‘회의 정리’<br>프로젝트를 여세요.",
            caption="프로젝트 목록에서 이전에 만든 ‘회의 정리’를 누르세요.",
            body=camera_body(
                "project/01-projects.png", (385, 322, 600, 58),
                "프로젝트 목록 · 회의 정리", "‘회의 정리’ 프로젝트 클릭",
                "메뉴 위치는 실제 화면 · ‘회의 정리’ 목록은 예시로 재현",
                mask='<div class="repeat-list-mask"></div>',
                overlay='<div class="repeat-list-row">▱&nbsp; 회의 정리 · synkbrief 실습</div>',
            ),
            camera={
                "file": "project/01-projects.png", "focus": [330, 250, 725, 230],
                "rect": [385, 322, 600, 58], "point": [535, 350],
                "actionAt": 2.05,
            },
        )
        result.extend([menu, project])
    elif original["id"] == "repeat-new":
        new = copy.deepcopy(original)
        new.update(
            step="다음 회의 3/5 · 새 채팅",
            title="이 프로젝트 안에서<br>‘새 채팅’을 누르세요.",
            caption="프로젝트 이름 아래 긴 새 채팅 입력창을 누르세요. 이전 대화는 열 필요 없어요.",
        )
        new["body"] = new["body"].replace(
            "① 전체 화면", "① 프로젝트 화면"
        ).replace("③ 클릭·입력", "③ 새 채팅 클릭")
        result.append(new)
    elif original["id"] == "repeat-send":
        memo = copy.deepcopy(original)
        memo.update(
            id="repeat-memo",
            duration=8.0,
            step="다음 회의 4/5 · 새 기록 입력",
            title="이번 회의 메모를<br>새 채팅에 넣으세요.",
            caption="‘이번 회의도 정리해줘’라고 쓰고 오늘의 메모나 녹음을 글로 옮긴 내용을 넣으세요.",
            body=camera_body(
                "project/12-second-input.png", (281, 176, 770, 180),
                "새 채팅 입력창 · 부탁할 말과 오늘 기록",
                "‘이번 회의도 정리해줘’ + 오늘 기록 입력",
                "텍스트 메모 또는 녹음을 글로 옮긴 내용",
                mask=(
                    '<div class="cam-mask" style="left:298px;top:186px;width:714px;height:36px"></div>'
                    '<div class="cam-mask-later" style="left:298px;top:237px;width:714px;height:57px"></div>'
                ),
            ).replace("③ 클릭", "③ 입력"),
            camera={
                "file": "project/12-second-input.png", "focus": [260, 135, 820, 250],
                "rect": [281, 176, 770, 180], "point": [418, 205],
                "mask": [298, 186, 714, 36], "actionAt": 3.1,
            },
        )
        send = copy.deepcopy(original)
        send.update(
            id="repeat-finish",
            duration=original["duration"] - 8.0,
            step="다음 회의 5/5 · 보내기",
            title="오른쪽 ↑를 눌러<br>메모를 보내세요.",
            caption="입력창 오른쪽의 위쪽 화살표를 누르면 끝이에요.",
            body=camera_body(
                "project/12-second-input.png", (1005, 309, 42, 42),
                "입력창 오른쪽 아래 · ↑ 보내기", "↑ 보내기 버튼 클릭",
                "실제 ChatGPT 화면 · 마지막 버튼의 위치를 확대",
            ),
            camera={
                "file": "project/12-second-input.png", "focus": [884, 246, 220, 150],
                "rect": [1005, 309, 42, 42], "point": [1027, 330],
                "actionAt": 1.75,
            },
        )
        result.extend([memo, send])
    else:
        result.append(original)

old_duration = sum(scene["duration"] for scene in scenes)
new_duration = sum(scene["duration"] for scene in result)
assert abs(old_duration - new_duration) < 0.00001

starts = {}
cursor = 0.0
for scene in result:
    starts[scene["id"]] = cursor
    cursor += scene["duration"]

clips = []
for clip in timing["clips"]:
    if clip["id"] in {"repeat-find", "repeat-send"}:
        continue
    clips.append(clip)
for scene in result:
    if scene["id"] not in {"repeat-menu", "repeat-project", "repeat-memo", "repeat-finish"}:
        continue
    start = starts[scene["id"]]
    caption_group = [
        c for c in timing["captions"]
        if c["start"] >= start and c["start"] < start + scene["duration"]
    ]
    assert caption_group, scene["id"]
    voice_start = min(c["start"] for c in caption_group)
    voice_end = max(c["end"] for c in caption_group)
    clips.append({
        "id": scene["id"], "start": start, "duration": scene["duration"],
        "voiceStart": voice_start, "voiceDuration": voice_end - voice_start,
    })
clips.sort(key=lambda c: c["start"])
timing["clips"] = clips

(root / "content.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "voice-timing.json").write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"scenes": len(result), "duration": new_duration, "new_steps": [s["id"] for s in result if s["id"].startswith("repeat-")]}, ensure_ascii=False))
