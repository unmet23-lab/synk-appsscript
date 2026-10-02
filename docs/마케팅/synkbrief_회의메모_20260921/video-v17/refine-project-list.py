"""Use the universal Projects-list route for returning to a saved project."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
path = root / "content.json"
scenes = json.loads(path.read_text(encoding="utf-8"))
scene = next(s for s in scenes if s["id"] == "repeat-find")
scene["title"] = "왼쪽 ‘프로젝트’를 누르고<br>목록의 ‘회의 정리’를 누르세요."
scene["caption"] = "먼저 왼쪽의 ‘프로젝트’, 다음엔 목록의 ‘회의 정리’를 눌러요."
scene["body"] = '<div class="camera-steps"><b class="phase-wide">① 전체 화면</b><span>→</span><b class="phase-focus">② 메뉴 확대</b><span>→</span><b class="phase-act">③ 프로젝트 선택</b></div><div class="camera-frame"><div class="camera-world"><img class="cam-base" src="assets/project/01-projects.png" alt="ChatGPT 프로젝트 목록 화면"><div class="repeat-list-mask"></div><div class="repeat-list-row">▱&nbsp; 회의 정리 · synkbrief 실습</div><div class="cam-target" style="left:6px;top:132px;width:248px;height:35px"></div><div class="cam-pointer"><i></i><svg viewBox="0 0 24 24"><path d="M3 2.8 20.6 14 12.8 15.5 9 22 3 2.8Z" fill="white" stroke="#315fbe" stroke-width="1.4"/></svg></div></div><div class="camera-label"><span class="first">왼쪽 메뉴 · 프로젝트</span><span class="next">목록 · 회의 정리</span></div></div><div class="cam-action"><span class="first">프로젝트 메뉴 클릭</span><span class="next">‘회의 정리’ 선택</span></div><div class="cam-note">실제 메뉴 위치 · 목록의 회의 정리 항목은 예시로 재현</div>'
scene["camera"] = {"file": "project/01-projects.png", "focus": [0, 40, 320, 260], "rect": [6, 132, 248, 35], "point": [84, 150], "label": "왼쪽 메뉴 · 프로젝트", "action": "프로젝트 클릭", "nextFocus": [330, 250, 725, 230], "nextRect": [385, 322, 600, 58], "nextPoint": [535, 350], "nextLabel": "목록 · 회의 정리", "nextAction": "회의 정리 선택", "actionAt": 4.7, "nextAt": 6.25}
path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
