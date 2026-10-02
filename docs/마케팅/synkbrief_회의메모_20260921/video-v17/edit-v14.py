"""Turn the next-meeting shortcut into three literal, beginner-paced UI steps."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
path = root / "content.json"
scenes = json.loads(path.read_text(encoding="utf-8"))
i = next(i for i, s in enumerate(scenes) if s["id"] == "repeat")

def camera_body(file, rect, label, action, *, mask=None, next_rect=None, next_label=None, next_action=None, extra="", note="실제 ChatGPT 화면 · 위치와 클릭 순서 안내"):
    x, y, w, h = rect
    masked = f'<div class="cam-mask" style="left:{mask[0]}px;top:{mask[1]}px;width:{mask[2]}px;height:{mask[3]}px"></div>' if mask else ""
    label_html = f'<span class="first">{label}</span><span class="next">{next_label}</span>' if next_rect else label
    action_html = f'<span class="first">{action}</span><span class="next">{next_action}</span>' if next_rect else action
    return f'<div class="camera-steps"><b class="phase-wide">① 전체 화면</b><span>→</span><b class="phase-focus">② 위치 확대</b><span>→</span><b class="phase-act">③ 클릭·입력</b></div><div class="camera-frame"><div class="camera-world"><img class="cam-base" src="assets/{file}" alt="ChatGPT 화면">{extra}{masked}<div class="cam-target" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div><div class="cam-pointer"><i></i><svg viewBox="0 0 24 24"><path d="M3 2.8 20.6 14 12.8 15.5 9 22 3 2.8Z" fill="white" stroke="#315fbe" stroke-width="1.4"/></svg></div></div><div class="camera-label">{label_html}</div></div><div class="cam-action">{action_html}</div><div class="cam-note">{note}</div>'

sidebar = '<div class="repeat-scrim"></div><div class="repeat-sidebar"><div class="rs-brand">ChatGPT</div><div class="rs-row">✎&nbsp; 새 채팅</div><div class="rs-row">▥&nbsp; 라이브러리</div><div class="rs-row">▱&nbsp; 프로젝트</div><div class="rs-sub">고정됨</div><div class="rs-project">▱&nbsp; 회의 정리 · synkbrief 실습</div></div>'
new_scenes = [
    {
        "id": "repeat-find", "duration": 6.8,
        "step": "다음 회의 ① 저장한 프로젝트 열기",
        "title": "왼쪽 ‘회의 정리’를<br>눌러 다시 들어가요.",
        "caption": "왼쪽에서 프로젝트 아래에 저장된 ‘회의 정리’를 찾으세요.",
        "body": camera_body("project/03-project-home.png", [6, 355, 248, 40], "왼쪽 고정됨 · 회의 정리", "‘회의 정리’ 프로젝트 클릭", extra=sidebar, note="실제 화면 위치를 바탕으로 사이드바를 단순화해 재현"),
        "camera": {"file": "project/03-project-home.png", "focus": [0, 270, 320, 220], "rect": [6, 355, 248, 40], "point": [95, 375], "label": "왼쪽 고정됨 · 회의 정리", "action": "회의 정리 프로젝트 클릭", "actionAt": 4.5}
    },
    {
        "id": "repeat-new", "duration": 8.2,
        "step": "다음 회의 ② 새 채팅 시작",
        "title": "프로젝트 이름 아래<br>‘새 채팅’을 누르세요.",
        "caption": "화면 위쪽의 긴 입력창에 ‘새 채팅’이라고 쓰여 있어요. 이전 대화는 열지 않아요.",
        "body": camera_body("project/03-project-home.png", [282, 176, 768, 53], "프로젝트 이름 바로 아래 · 새 채팅", "새 채팅 입력창 클릭"),
        "camera": {"file": "project/03-project-home.png", "focus": [255, 86, 835, 280], "rect": [282, 176, 768, 53], "point": [510, 202], "label": "프로젝트 이름 아래 · 새 채팅", "action": "새 채팅 입력창 클릭", "actionAt": 5.25}
    },
    {
        "id": "repeat-send", "duration": 9.6,
        "step": "다음 회의 ③ 새 기록 보내기",
        "title": "이번 회의 기록을 넣고<br>오른쪽 ↑를 누르세요.",
        "caption": "‘이번 회의도 정리해줘’와 오늘 메모를 넣은 뒤 보내기 버튼을 누르세요.",
        "body": camera_body("project/12-second-input.png", [281, 176, 770, 180], "새 채팅 입력창 · 부탁과 오늘 기록", "부탁할 말 + 이번 회의 메모 붙여넣기", mask=[298, 186, 714, 105], next_rect=[1005, 309, 42, 42], next_label="입력창 오른쪽 아래 · ↑ 보내기", next_action="↑ 보내기 클릭"),
        "camera": {"file": "project/12-second-input.png", "focus": [260, 135, 820, 250], "rect": [281, 176, 770, 180], "point": [418, 205], "label": "새 채팅 입력창", "action": "부탁 + 기록 붙여넣기", "mask": [298, 186, 714, 105], "nextFocus": [884, 246, 220, 150], "nextRect": [1005, 309, 42, 42], "nextPoint": [1027, 330], "nextLabel": "오른쪽 아래 ↑ 보내기", "nextAction": "↑ 보내기 클릭", "actionAt": 4.2, "nextAt": 7.9}
    },
]
scenes[i:i+1] = new_scenes
path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for name in ("build.mjs", "build-preview.mjs", "verify-camera.cjs", "verify-voice.cjs", "verify-scenes.cjs", "verify-preview.cjs", "verify-render.cjs"):
    p = root / name
    p.write_text(p.read_text(encoding="utf-8").replace("video-v13", "video-v14").replace("v13", "v14"), encoding="utf-8")

p = root / "build-preview.mjs"
s = p.read_text(encoding="utf-8")
s = s.replace("['repeat','다음 회의 입력']", "['repeat-find','① 프로젝트 열기'],['repeat-new','② 새 채팅'],['repeat-send','③ 기록 보내기']")
s = s.replace("preview.webm?v=16", "preview.webm?v=17")
p.write_text(s, encoding="utf-8")

p = root / "package.json"
package = json.loads(p.read_text(encoding="utf-8"))
package["name"] = "synkbrief-meeting-v14"
p.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
