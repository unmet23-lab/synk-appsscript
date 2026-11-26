# M82 영상칸 계획.json · 지시문.json 만들기 — python -I -X utf8 _만들기.py
# 공통 글은 영상 공통 글(LAB_하루두편_설계_20261110/영상_공통글.txt)을 그대로 읽는다(제작 절차 lab-whole-video).
import json
from pathlib import Path

HERE = Path(__file__).parent
COMMON = (HERE.parent.parent / 'LAB_하루두편_설계_20261110' / '영상_공통글.txt').read_text(encoding='utf-8').strip()

GRANDMA = ("Grandma is the felt grandmother with short tight curly silver-grey perm hair, a burgundy flower-quilted vest over a cream turtleneck and a long open plum-purple padded coat, no glasses: "
           "her face, hair and clothes stay exactly the same in every frame.")
FRIEND = ("The friend is the young felt man with short straight black wool hair with soft bangs, a heather-grey felt hoodie and a mustard felt apron: "
          "his face, hair and clothes stay exactly the same in every frame.")
CUPS = "The hotteok stay inside their plain white paper cups; no cup falls, nothing flies through the air. No steam, no smoke rises from the griddle."
NOMG = "MONGLE is not in this shot."
CLEAN = "Nothing is drawn over the picture."
MGBODY = "Mongle's sides stay smooth and round: no arms, hands, flippers or legs ever grow out of its body, and it never stands up or hops: the scalloped bottom edge of its felt hem stays resting on the surface the whole time, with nothing ever showing under it; it moves cups only by nudging them with its whole soft dome body."

SHOTS = [
  ("s1", 4, "h_wide", None, "leans its whole round dome toward Grandma, eyes round and bright",
   f"Wide shot of the winter-night hotteok cart from the start frame. ACTION: from 0 to 0.8 s Grandma takes one small step toward the counter, smiling politely, hands together; from 1.0 to 2.2 s Mongle leans its whole round dome toward Grandma, eyes round and bright, eager; the single paper cup stays still on the counter in front of it and Mongle never touches it; from 2.4 s to the end Grandma looks down at the cup. The friend keeps turning a hotteok on the griddle with his spatula the whole time. {GRANDMA} {FRIEND} {CUPS} {MGBODY} {CLEAN}"),
  ("s2", 3, "h_grand", None, "her polite smile fades",
   f"Extreme close-up of Grandma's face from the start frame. ACTION: from 0 to 0.7 s she keeps her polite little smile; from 0.8 to 1.6 s her polite smile fades: her lips press into a flat line, one eyebrow lifts and twitches, and she turns her face a little away to the side with a small unimpressed 'hmph'; she holds that look to the end. {GRANDMA} {NOMG} {CLEAN}"),
  ("s3", 4, "h_two", None, "lifts her chin higher and turns her face away",
   f"Medium side shot along the counter from the start frame. ACTION: from 0.2 to 1.6 s Mongle, near the camera, wobbles eagerly in place beside the two paper cups and leans its round dome toward Grandma, its eyes round and eager; the two cups stay still and Mongle never touches them; at 1.8 s Grandma, arms still crossed, lifts her chin higher and turns her face away to the side, unimpressed, and stays like that. {GRANDMA} {CUPS} {MGBODY} {CLEAN}"),
  ("s4", 4, "h_tower", None, "the tall tower of five paper cups sways left and right",
   f"Close low-angle shot at counter level from the start frame. ACTION: the whole time Mongle presses its dome against the bottom cup, and the tall tower of five paper cups sways left and right a little but never falls; Mongle's eyes stay wide, its pale-blue felt sweat drop stays on its side and its small mouth wobbles open, desperate. In the soft background Grandma keeps her back turned and at 2.4 s takes one small step further away. {GRANDMA} {CUPS} {MGBODY} {CLEAN}"),
  ("s5", 3, "h_whisper", None, "whispers into the side of Mongle",
   f"Extreme close two-shot behind the counter from the start frame. ACTION: from 0 to 1.6 s the friend whispers into the side of Mongle, his cupped hand beside his moving lips, eyebrows raised; at 1.7 s Mongle's bead eyes grow a little bigger and rounder and it gives one small bob, as if it understood; its face stays at rest with no mouth. {FRIEND} {MGBODY} {CLEAN}"),
  ("s6", 5, "h_offer", None, "dips its whole round dome forward and down toward Grandma",
   f"Medium shot from behind Grandma's shoulder from the start frame, looking across the counter at Mongle. ACTION: from 0 to 0.6 s Mongle looks at Grandma with round hopeful bead eyes and gives one small eager wobble in place; from 0.7 to 1.5 s it dips its whole round dome forward and down toward Grandma into a deep polite bow, its eyes closing into two short curved stitched lines, and it holds that deep bow to the end, sinking a little lower once at 2.6 s. The single paper cup of hotteok stays still on the counter in front of Grandma the whole time; Mongle never touches it. Mongle's sides stay smooth and round: nothing grows out of its body. Grandma's curly perm and plum coat stay soft in the left foreground; at about 3.0 s her cheek lifts as she starts to smile. The tower of cups stays still. {GRANDMA} {CUPS} {MGBODY} {CLEAN}"),
  ("s7", 3, "h_beam", None, "pats her chest twice",
   f"Extreme close-up of Grandma's beaming face from the start frame. ACTION: the whole time she laughs with delight, eyes squeezed into happy crescents, cheeks glowing; her shoulders lift once at 0.4 s and her hand pats her chest twice, and she tilts her head fondly to one side at 1.8 s. {GRANDMA} {NOMG} {CLEAN}"),
  ("s8", 5, "h_give", None, "sets the single cup down on the counter right in front of Mongle",
   f"Medium wide shot across the counter from the start frame. ACTION: from 0 to 1.4 s Grandma, holding the tower of cups in the crook of one arm, leans forward and sets the single cup down on the counter right in front of Mongle; from 1.6 s Mongle sways happily from side to side, eyes in happy arcs, rosy blush and a small open smiling felt mouth, and at 3.0 s bobs its whole dome down and up once without lifting off the counter; the friend grins and nods. {GRANDMA} {FRIEND} {CUPS} {MGBODY} {CLEAN}"),
]

plan = {"_예산": 180,
        "_배우는말": [{"말": "드세요", "한글": "할머니, 드세요!", "읽기": "хальмони, тысэё!", "뜻": "Эмээ, зооглоорой!", "초": 3.8, "칸": ["s6"], "음성": ["m4", "f2"]}]}
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
(HERE / '지시문.json').write_text(json.dumps({"모델": "M82 드세요 — LAB 편 전체를 영상으로(제작 절차 lab-whole-video · 짜임 lab-video-story). 11-26에 구운 호떡 노점 펠트 판 여덟 장을 시작 그림으로 쓴다", "공통": COMMON, "클립": clips}, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
print("계획 합", sum(int(plan[s]['cost']) for s in plan if not s.startswith('_')))
