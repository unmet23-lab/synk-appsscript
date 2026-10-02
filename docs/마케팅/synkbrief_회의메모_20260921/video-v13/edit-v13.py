"""Keep the v12 voice, add an actual ChatGPT menu-location beat before the concept card."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
content_path = root / "content.json"
scenes = json.loads(content_path.read_text(encoding="utf-8"))
project_index = next(i for i, scene in enumerate(scenes) if scene["id"] == "project")
project = scenes[project_index]
project["duration"] = 5.133333333333334
project["step"] = "프로젝트는 무엇인가요?"
menu = {
    "id": "project-menu",
    "duration": 4.733333333333333,
    "step": "ChatGPT에서 프로젝트 찾기",
    "title": "왼쪽 메뉴에서<br>‘프로젝트’를 찾으세요.",
    "caption": "ChatGPT 왼쪽 사이드바의 폴더 아이콘 옆 ‘프로젝트’가 시작점이에요.",
    "body": '<div class="camera-steps"><b class="phase-wide">① 전체 화면</b><span>→</span><b class="phase-focus">② 왼쪽 메뉴 확대</b><span>→</span><b class="phase-act">③ 위치 확인</b></div><div class="camera-frame"><div class="camera-world"><img class="cam-base" src="assets/project/01-projects.png" alt="ChatGPT 실제 화면, 왼쪽 프로젝트 메뉴"><div class="cam-target" style="left:6px;top:132px;width:248px;height:35px"></div><div class="cam-pointer"><i></i><svg viewBox="0 0 24 24"><path d="M3 2.8 20.6 14 12.8 15.5 9 22 3 2.8Z" fill="white" stroke="#315fbe" stroke-width="1.4"/></svg></div></div><div class="camera-label">왼쪽 사이드바 · 프로젝트</div></div><div class="cam-action">폴더 아이콘 옆 ‘프로젝트’ 메뉴</div><div class="cam-note">실제 ChatGPT 화면 · 전체 위치에서 메뉴까지 확대</div>',
    "camera": {
        "file": "project/01-projects.png",
        "focus": [0, 40, 320, 260],
        "rect": [6, 132, 248, 35],
        "point": [76, 149],
        "label": "왼쪽 사이드바 · 프로젝트",
        "action": "프로젝트 메뉴 위치",
        "actionAt": 3.3,
    },
}
scenes.insert(project_index, menu)
content_path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

timing_path = root / "voice-timing.json"
timing = json.loads(timing_path.read_text(encoding="utf-8"))
clip_index = next(i for i, clip in enumerate(timing["clips"]) if clip["id"] == "project")
original = timing["clips"][clip_index]
menu_clip = {"id": "project-menu", "start": original["start"], "duration": menu["duration"], "voiceStart": original["voiceStart"], "voiceDuration": 4.243}
concept_clip = {"id": "project", "start": original["start"] + menu["duration"], "duration": project["duration"], "voiceStart": 78.15633333333334, "voiceDuration": 4.724}
timing["clips"][clip_index:clip_index + 1] = [menu_clip, concept_clip]
timing_path.write_text(json.dumps(timing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for name in ("build.mjs", "build-preview.mjs", "verify-camera.cjs", "verify-voice.cjs", "verify-scenes.cjs", "verify-preview.cjs", "verify-render.cjs"):
    path = root / name
    text = path.read_text(encoding="utf-8")
    text = text.replace("video-v12", "video-v13").replace("v12", "v13")
    path.write_text(text, encoding="utf-8")

path = root / "build-preview.mjs"
text = path.read_text(encoding="utf-8")
text = text.replace("['project','프로젝트란?']", "['project-menu','프로젝트 메뉴 위치'],['project','프로젝트란?']")
text = text.replace("· 18장면 ·", "· ${scenes.length}장면 ·")
text = text.replace('preview.webm?v=15', 'preview.webm?v=16')
path.write_text(text, encoding="utf-8")

path = root / "build.mjs"
text = path.read_text(encoding="utf-8")
text = text.replace("['common','project','project-reuse','repeat','ending']", "['common','project-menu','project','project-reuse','repeat','ending']")
path.write_text(text, encoding="utf-8")

path = root / "package.json"
package = json.loads(path.read_text(encoding="utf-8"))
package["name"] = "synkbrief-meeting-v13"
path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
