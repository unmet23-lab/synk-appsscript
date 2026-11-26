# E52 영상칸 계획.json · 지시문.json 만들기 — python -I -X utf8 _만들기.py
# 공통 글은 영상 공통 글(LAB_하루두편_설계_20261110/영상_공통글.txt)을 그대로 읽는다(제작 절차 lab-whole-video).
import json
from pathlib import Path

HERE = Path(__file__).parent
COMMON = (HERE.parent.parent / 'LAB_하루두편_설계_20261110' / '영상_공통글.txt').read_text(encoding='utf-8').strip()

FRIEND = ("The friend is the young felt man with short straight black wool hair with soft bangs, a heather-grey felt hoodie and dark-navy felt sweatpants: "
          "his face, hair and clothes stay exactly the same in every frame.")
PHONE = "The phone screen stays a plain soft pale-blue glow the whole time: no text, no icons, no bubbles ever appear on it."
NOMG = "MONGLE is not in this shot."
CLEAN = "Nothing is drawn over the picture."
MGFLOAT = "Mongle never grows arms or legs; it presses the phone only with its whole soft dome body."

SHOTS = [
  # id, 길이, 시작, 끝, key, 글
  ("s1", 4, "k_bed", None, "the phone screen glows a little brighter for a moment",
   f"Medium wide shot from slightly above of Mongle on its mint-green quilt beside a felt phone lying face-up, from the start frame. ACTION: at 0.4 s the phone screen glows a little brighter for a moment, as if a message arrived; from 0.6 to 1.4 s Mongle gives a small surprised hop in place and comes back down, its face at rest with round bead eyes; from 1.6 s to the end Mongle leans its whole dome slowly closer to the phone and tilts it to one side, studying the screen. {PHONE} {MGFLOAT} {CLEAN}"),
  ("s2", 3, "k_puzzle", None, "tilts its whole dome slowly to the left",
   f"Extreme close-up of Mongle's face lit pale blue from the phone below the frame, from the start frame. ACTION: from 0 to 1.4 s Mongle tilts its whole dome slowly to the left, then from 1.4 to 2.8 s slowly to the right, puzzled; its two bead eyes stay round and open, its face at rest with no mouth. The phone stays just below the bottom edge. {MGFLOAT} {CLEAN}"),
  ("s3", 4, "k_friend", None, "his small smile grows into a chuckle",
   f"Medium shot of the friend sitting cross-legged on the round grey floor cushion, holding the phone in both hands, from the start frame. ACTION: from 0 to 1.5 s he looks down at the phone with a small amused closed-lip smile; from 1.5 s his small smile grows into a chuckle: his eyes curve into happy arcs and his shoulders bounce up and down a little. {FRIEND} {PHONE} {NOMG} {CLEAN}"),
  ("s4", 4, "k_laugh", None, "rocking forward and back on the cushion",
   f"Close shot of the friend bent over the phone, laughing, from the start frame. ACTION: he laughs out loud the whole time with his eyes squeezed into happy curves and his mouth wide open, rocking forward and back on the cushion, his shoulders shaking; at about 2.5 s he throws his head back once and laughs even harder, then bends forward over the phone again. He keeps holding the phone in both hands. {FRIEND} {PHONE} {NOMG} {CLEAN}"),
  ("s5", 6, "k_tap", None, "bobs its whole dome down once onto the phone",
   f"Close low-angle shot of Mongle right behind the felt phone on the mint-green quilt, from the start frame. ACTION: from 0 to 3.4 s Mongle sways happily from side to side, its eyes curved into two happy dark stitched arcs and its small open smiling felt mouth bobbing as if it is repeating a sound; at 3.6 s it bobs its whole dome down once onto the phone, touching the glowing screen with the front of its body, and at 4.0 s springs back up and stays still, proud and expectant, eyes in happy arcs. The phone does not move. {PHONE} {MGFLOAT} {CLEAN}"),
  ("s6", 4, "k_cold", "k_coldx", "his face slowly goes flat and cold",
   f"Close-up from slightly below of the friend holding the phone up near his face, from the start frame. ACTION: from 0 to 0.8 s he looks at the screen with a bright expectant smile and raised eyebrows; from 0.9 to 1.8 s his face slowly goes flat and cold: his smile fades into a straight closed mouth, his eyelids drop halfway over his bead eyes and his eyebrows go flat and level, exactly as in the end frame; from 1.8 s to the end he holds that deadpan stare at the screen without moving. {FRIEND} {PHONE} {NOMG} {CLEAN}"),
  ("s7", 4, "k_panic", None, "presses its whole dome down onto the edge of the phone again and again",
   f"Medium low side shot of Mongle beside the felt phone on the quilt, from the start frame, with its sweat drop and small wobbly open mouth. ACTION: from 0.2 s to the end Mongle presses its whole dome down onto the edge of the phone again and again, quickly, about five times, squashing and springing back each time, panicking; its eyes stay wide and round, the pale-blue felt sweat drop stays on the side of its head and its small mouth wobbles open. The phone stays where it is. {PHONE} {MGFLOAT} {CLEAN}"),
  ("s8", 5, "k_roll", None, "rocks and rolls from side to side on his back",
   f"Wide low shot from floor level of the friend lying on his back on the wooden floor, laughing hard, from the start frame. ACTION: the whole time he laughs out loud with his eyes squeezed into happy curves and his mouth wide open, holding his belly with both hands; from 0.5 s he rocks and rolls from side to side on his back, kicking his bent legs, then at about 3.5 s rolls onto his side facing the camera, still laughing. The phone stays lying face-up on the floor near his shoulder. {FRIEND} {PHONE} {NOMG} {CLEAN}"),
]

plan = {"_예산": 180,
        "_배우는말": [{"말": "ㅋㅋㅋ", "한글": "ㅋㅋㅋ", "읽기": "keu-keu-keu", "뜻": "Korean “lol”", "초": 3.8, "칸": ["s5"], "음성": ["m2", "m2b"]}]}
clips = []
for sid, sec, start, end, key, prompt in SHOTS:
    p = {"model": "Omni 1.2 Flash", "n": 1, "cost": str(sec * 3), "dur": f"{sec}초", "proj": "omni", "start": start}
    if end:
        p["end"] = end
    p["key"] = key
    plan[sid] = p
    assert key in prompt, sid
    clips.append({"id": sid, "prompt": prompt})
(HERE / '계획.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
(HERE / '지시문.json').write_text(json.dumps({"모델": "E52 ㅋㅋㅋ — LAB 편 전체를 영상으로(제작 절차 lab-whole-video · 짜임 lab-video-story). 11-26에 구운 펠트 판 아홉 장을 시작 · 끝 그림으로 쓴다", "공통": COMMON, "클립": clips}, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
print("계획 합", sum(int(plan[s]['cost']) for s in plan if not s.startswith('_')))
