# Y89 영상칸 계획.json · 지시문.json 만들기 — python -I -X utf8 _만들기.py
# 제작 절차 「정지 그림 칸은 Omni 영상으로」(11-26): 몽글 진행의 처음 · 끝만 Omni 1.2 Flash로 굽는다. 가운데 실제 대화 기록 화면은 그대로 쓴다.
# 샷마다 두 판(o1 · o1b, e1 · e1b)을 낱말만 바꾼 글과 새 key로 굽고 고른다(제작 절차 lab-two-takes).
# 공통 글은 영상 공통 글(LAB_하루두편_설계_20261110/영상_공통글.txt)을 그대로 읽는다.
import json
from pathlib import Path

HERE = Path(__file__).parent
COMMON = (HERE.parent.parent / 'LAB_하루두편_설계_20261110' / '영상_공통글.txt').read_text(encoding='utf-8').strip()

SCREEN = "The laptop screen stays a plain soft pale glow the whole time: no text, no icons ever appear on it."
STRIP = "The cream felt paper strip stays completely blank: no lines, no writing, no marks ever appear on it."
CARD = "The small cream felt card on the desk stays flat, blank and where it is: no writing ever appears on it."
CLEAN = "Nothing is drawn over the picture."
MGFLOAT = "Mongle never grows arms or legs; it moves only by tilting, leaning, squashing and bouncing its whole soft dome body."

SHOTS = [
  ("o1", 4, "i_open", "its two bead eyes grow bigger and rounder",
   f"Medium wide shot at desk height of Mongle half buried in the big soft folds of the long cream felt paper strip that pours out of the laptop, from the start frame. ACTION: from 0 to 1.0 s the cream felt paper strip keeps slowly sliding out of the bottom of the laptop screen and piles up in more soft folds in front of Mongle, and Mongle stays still with its face at rest, only its eyes above the paper; at 1.2 s its two bead eyes grow bigger and rounder, overwhelmed, and one small felt sweat drop appears on the side of its dome; from 1.8 s to the end Mongle wriggles its whole dome a little to the left and right inside the folds and sinks back a little lower, still overwhelmed. {STRIP} {SCREEN} {MGFLOAT} {CLEAN}"),
  ("o1b", 4, "i_open", "its two bead eyes open wide and round",
   f"Medium wide shot at desk height of Mongle half buried in the big soft folds of the long cream felt paper strip that pours out of the laptop, from the start frame. ACTION: from 0 to 1.0 s more of the cream felt paper strip slides slowly out of the bottom of the laptop screen and heaps up in soft folds around Mongle, while Mongle stays still with its face at rest, only its eyes showing above the paper; at 1.2 s its two bead eyes open wide and round, overwhelmed, and one small felt sweat drop appears beside its eye; from 1.8 s to the end Mongle squirms its whole dome gently from side to side inside the folds and slips a little deeper, still overwhelmed. {STRIP} {SCREEN} {MGFLOAT} {CLEAN}"),
  # 셋째 처음 판(11-27 08:30): o1_a는 1.3초부터 눈에 흰 테, o1b_a는 2.0초부터 몸 옆에 분홍 팔이 돋아 — 몸을 꿈틀대지 않고 종이 속에 가만히 있게 줄였다.
  ("o1c", 4, "i_open", "its two glossy black bead eyes slowly grow a little rounder",
   f"Medium wide shot at desk height of Mongle half buried in the big soft folds of the long cream felt paper strip that pours out of the laptop, from the start frame. ACTION: from 0 to 1.0 s more of the cream felt paper strip slides slowly out of the bottom of the laptop screen and heaps up in soft folds around Mongle, while Mongle stays still with its face at rest, only its eyes showing above the paper; at 1.2 s its two glossy black bead eyes slowly grow a little rounder, overwhelmed, with no white around them, and one small felt sweat drop appears beside its eye; from 1.6 s to the end Mongle stays exactly where it is with its whole body hidden under the paper folds and only sinks very slowly a little lower, still overwhelmed. Nothing ever sticks out from the sides of Mongle's dome. {STRIP} {SCREEN} {MGFLOAT} {CLEAN}"),
  ("e1", 4, "i_end", "its eyes curve into two happy dark stitched arcs",
   f"Low close shot from the desk surface of Mongle facing the camera with the small blank cream felt card lying flat in front of it, from the start frame. ACTION: from 0 to 0.9 s Mongle stays still with its face at rest, two round bead eyes and no mouth; at 1.0 s its eyes curve into two happy dark stitched arcs, a small simple felt smile appears and soft pink felt blush shows on both cheeks; from 1.5 to 3.0 s it bounces gently twice in place, squashing down and stretching up its whole dome, then stays still and happy to the end. The folded paper stack and the closed laptop behind stay where they are, out of focus. {CARD} {MGFLOAT} {CLEAN}"),
  ("e1b", 4, "i_end", "its eyes bend into two cheerful dark stitched arcs",
   f"Low close shot from the desk surface of Mongle facing the camera with the small blank cream felt card lying flat in front of it, from the start frame. ACTION: from 0 to 0.9 s Mongle stays still with its face at rest, two round bead eyes and no mouth; at 1.0 s its eyes bend into two cheerful dark stitched arcs, a small simple felt smile appears and soft pink felt blush shows on both cheeks; from 1.5 to 3.0 s it hops gently twice in place, squashing down and stretching up its whole dome, then stays still and pleased to the end. The folded paper stack and the closed laptop behind stay where they are, out of focus. {CARD} {MGFLOAT} {CLEAN}"),
]

plan = {"_예산": 360}
clips = []
for sid, sec, start, key, prompt in SHOTS:
    plan[sid] = {"model": "Omni 1.2 Flash", "n": 1, "cost": str(sec * 3), "dur": f"{sec}초", "proj": "omni", "start": start, "key": key}
    assert prompt.count(key) == 1, sid
    clips.append({"id": sid, "prompt": prompt})

(HERE / '계획.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
(HERE / '지시문.json').write_text(json.dumps({"모델": "Y89 요약 새 대화 — 몽글 진행 처음 · 끝(제작 절차 daily-omni-20261126)", "공통": COMMON, "클립": clips}, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
print("ok", list(plan))
