# Y80 영상칸 계획.json · 지시문.json 만들기 — python -I -X utf8 _만들기.py
# 제작 절차 「정지 그림 칸은 Omni 영상으로」(11-26): 몽글 진행의 처음 · 끝만 Omni 1.2 Flash로 굽는다. 가운데 실제 인사이트 화면은 그대로 쓴다.
# 공통 글은 영상 공통 글(LAB_하루두편_설계_20261110/영상_공통글.txt)을 그대로 읽는다.
import json
from pathlib import Path

HERE = Path(__file__).parent
COMMON = (HERE.parent.parent / 'LAB_하루두편_설계_20261110' / '영상_공통글.txt').read_text(encoding='utf-8').strip()

PHONE = "The phone screen stays a plain soft pale glow the whole time: no text, no icons ever appear on it."
CARDS = "The five felt picture cards stay plain felt with nothing drawn on them; they do not move, change colour or fall."
CLEAN = "Nothing is drawn over the picture."
MGFLOAT = "Mongle never grows arms or legs; it moves only by tilting, leaning, squashing and bouncing its whole soft dome body."

SHOTS = [
  ("o1", 4, "i_open", None, "its two bead eyes grow bigger and rounder",
   f"Medium wide shot at desk height of Mongle sitting on the light oak felt desk in front of the row of five upright felt picture cards, from the start frame. ACTION: from 0 to 1.2 s Mongle slowly tilts its whole dome from right to left, looking along the row of cards, its face at rest with round bead eyes and no mouth; at 1.4 s its two bead eyes grow bigger and rounder, surprised, as if it just noticed something; from 2.0 s to the end it leans its whole dome toward the three butter-yellow cards and holds there, curious, its face returning to rest. {CARDS} {PHONE} {MGFLOAT} {CLEAN}"),
  ("e1", 4, "i_end", None, "its eyes curve into two happy dark stitched arcs",
   f"Low close shot from the desk surface of Mongle facing the camera, from the start frame. ACTION: from 0 to 0.9 s Mongle stays still with its face at rest, two round bead eyes and no mouth; at 1.0 s its eyes curve into two happy dark stitched arcs, a small simple felt smile appears and soft pink felt blush shows on both cheeks; from 1.5 to 3.0 s it bounces gently twice in place, squashing down and stretching up its whole dome, then stays still and happy to the end. The cards behind stay where they are, out of focus. {MGFLOAT} {CLEAN}"),
]

plan = {"_예산": 180}
clips = []
for sid, sec, start, end, key, prompt in SHOTS:
    p = {"model": "Omni 1.2 Flash", "n": 1, "cost": str(sec * 3), "dur": f"{sec}초", "proj": "omni", "start": start}
    if end:
        p["end"] = end
    p["key"] = key
    assert prompt.count(key) == 1, sid
    plan[sid] = p
    clips.append({"id": sid, "prompt": prompt})

(HERE / '계획.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
(HERE / '지시문.json').write_text(json.dumps({"모델": "Y80 인스타 숫자 — 몽글 진행 처음 · 끝(제작 절차 daily-omni-20261126)", "공통": COMMON, "클립": clips}, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
print("ok", list(plan))
