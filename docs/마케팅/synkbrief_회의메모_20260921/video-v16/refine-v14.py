"""Align the saved-project outline and show prior chats in the later-use example."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
path = root / "content.json"
scenes = json.loads(path.read_text(encoding="utf-8"))
find = next(s for s in scenes if s["id"] == "repeat-find")
find["camera"]["rect"] = [6, 337, 248, 42]
find["camera"]["point"] = [95, 357]
find["camera"]["focus"] = [0, 245, 320, 220]
find["body"] = find["body"].replace("top:355px;width:248px;height:40px", "top:337px;width:248px;height:42px")

new = next(s for s in scenes if s["id"] == "repeat-new")
new["title"] = "프로젝트 이름 아래<br>긴 ‘새 채팅’ 칸을 눌러요."
history = '<div class="repeat-history"><div class="rh-tab">지난 회의 대화</div><div class="rh-row">지난 회의 기록 정리 <span>9월 23일</span></div><div class="rh-row">지난 회의에서 확인할 일 <span>9월 23일</span></div><div class="rh-hint">이전 대화는 열지 않아도 돼요.</div></div>'
new["body"] = new["body"].replace('alt="ChatGPT 화면">', 'alt="ChatGPT 화면">' + history, 1)
new["body"] = new["body"].replace("실제 ChatGPT 화면 · 위치와 클릭 순서 안내", "실제 입력창 · 지난 대화 목록은 위치 예시로 재현")
path.write_text(json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
