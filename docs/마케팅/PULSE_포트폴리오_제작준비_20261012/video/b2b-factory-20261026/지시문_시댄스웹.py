# 10번 B2B 기업 홍보영상 「도담중공업」 60초 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31).
#   python -X utf8 지시문_시댄스웹.py           → 지시문/영상_시댄스웹.json(굽기 시트의 웹꾸러미.py가 읽는 꼴 — 11번 · 옆집과 같음)
#   python -X utf8 지시문_시댄스웹.py --그림    → 확정 시작 그림 37장 + 참고 R5를 git 밖 콘티/p10/시댄스/에 깨끗한 이름으로 복사(원본은 그대로)
# 그림: 10-27 이미지 콘티 보드(콘티/p10/보드/p10_이미지콘티_1~4.jpg, 이미지콘티_보드.py)와 같은 고르기 — 고름/S##.png가 있으면 그것(30 · 33),
#   없으면 받음/ · 받음_gpt/판/의 그 컷 가장 최근 판. 모두 16:9(그림은 후반에서 원본처럼 약 2:1 띠로 자른다).
# 카메라: 02_콘티 2절 카메라 칸(= 01 2절, 특징점 · 촘촘한 흐름 · ECC로 잰 원본 실측)과 10절 「영상 지시문에 그대로」. 고정은 4 · 6 · 17 · 21 · 24 · 30 · 32뿐,
#   3 · 11 · 25 · 29 · 33은 「거의 고정」, 손떨림은 3 · 12 · 13 · 15 · 20 · 34 · 36만. 방향은 01의 말과 원본 흐름(카메라_흐름.json — 이동x%가 음수면
#   그림이 왼쪽으로 = 카메라 오른쪽)을 맞대어 정했다(34는 흐름 · 샷보드로 「사람들과 함께 왼쪽」, 01 2절 표의 「오른쪽으로」와 다름 — 02_콘티 11절).
# 초는 그 컷 첫 프레임 기준(원본 초 − 컷 시작), 두 샷 판의 둘째 샷은 판 시간(자르는 초 + 컷 안 초). 길이 = max(4, ⌈쓰는 초 + 0.8⌉).
# 두 샷 묶음 = 편집 차례로 붙은 같은 곳 · 같은 때 · 같은 사람/물건 · 얼굴 클로즈업이 아닌 컷(굽기 시트 규칙) — 자르는 초 = 첫 샷 + 0.7(0.1 올림),
#   길이 = ⌈자르는 초 + 둘째 + 0.8⌉, 묶음마다 낱판 둘을 「대안」으로. 준호 얼굴 컷(1 · 16 · 18 · 25 · 27 · 31 · 34 · 36)은 시작 그림이 첫 장으로 박히는
#   낱판으로 둔다(옴니 레퍼런스의 두 샷은 첫 장이 그림과 조금 달라질 수 있어 얼굴 일관성이 성패인 편에서 피함).
# 소리 끔 — 내레이션(준호) · 노래 · 화면 글 · 회사 이름은 후반. 입이 보이는 대사 없음.
import json
import math
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
P10 = Path("C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10")
IMG = P10 / "시댄스"

공통 = {
    "장르": "a cinematic, documentary-style brand film for a Korean heavy-industry company that builds gas turbines for power plants",
    "누구": {
        "JUNHO": "the same Korean man in his early forties in every shot — short, neat black hair, no glasses, exactly the face of the first "
                 "frame; a navy zip-up work jacket over a plain grey T-shirt. He never speaks: his lips stay closed, and his face stays calm, quiet "
                 "and serious — no big expressions.",
        "JUNHO_BACK": "Junho seen from behind — short, neat black hair and his navy work jacket; his face is not seen and he does not turn around.",
        "JUNHO_HAND": "Junho's own hand and forearm, in the sleeve of his navy work jacket.",
        "CREW": "every other worker is seen only as hands, a back, a far-away figure or behind a welding helmet or mask, exactly as in the first "
                "frame — no other face is ever shown, and nobody turns toward the camera.",
        "TURBINE": "the same big power-plant gas turbine in every shot — a long cream-white casing with rows of bolts and a round black bladed "
                   "intake with a black cone at its front end; no logo, letters or numbers anywhere on it.",
        "DRIVER": "the truck driver — only his hands, his arm in a light-grey work jacket and his shoulder are ever in the frame; his head always "
                  "stays above the top edge of the frame.",
    },
    "보기": "LOOK: a cinematic documentary brand film — real cinema camera, shallow depth of field, fine film grain, natural motion blur, "
            "true-to-life textures of steel, sparks and skin. Each shot keeps its first frame's light — direction, color, white balance and "
            "darkness — to the very end; only the light changes written in ACTION may happen. No new text, letters, numbers, logos or signs "
            "anywhere; never add anyone who is neither in the first frame nor written in ACTION; every machine keeps exactly the shape, size and parts it has in the "
            "first frame.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}


def fix(things, movers, verb="move"):
    return (f"the frame stays exactly where it is from the first frame to the last — {things} never shift; no push-in, no zoom, no drift, "
            f"no shake; only {movers} {verb}.")


def s(x):   # 판 시간 글자(0.1초 단위, 끝 0 없이)
    return f"{round(x, 2):g}"


# n: (쓰는 초, 설명, 누구, 동작(o), 카메라(o)) — o = 이 샷이 판 안에서 시작하는 초(낱판 0, 두 샷의 둘째는 자르는 초)
CUT = {
    1: (1.63, "준호 눈 극접사 — 아래 도면의 푸른 불빛이 눈동자에, 1.1초까지 거의 고정 → 끝 0.5초 위로 10% 기울임",
        ["JUNHO"],
        lambda o: "Extreme close-up of Junho's face from his eyes down to his cheek, lit from below by the cold blue glow of a turbine blueprint on "
                  "the desk below the frame; the blue lines reflect in his eyes. He studies it in silence — his eyes move slowly along the drawing; "
                  "his lips stay closed.",
        lambda o: "handheld and almost still for the first 1.1 s — only a slow float that slides the picture about 4% of the frame width to the "
                  "right; then from 1.1 s to 1.6 s the camera tilts up by about 10% of the frame height (the picture moves down, so his eyes sink "
                  "toward the lower part of the frame), with no zoom; from 1.6 s it holds still."),
    2: (1.42, "어두운 책상 위 푸른 터빈 단면 도면(글자 없음) — 오른쪽 아래로 미끄러지며 3° 돎",
        [],
        lambda o: "Close-up of a blue turbine cross-section drawing lying on a dark desk — thin pale lines, circles and the outline of turbine "
                  "blades on deep navy paper, the edge of a steel ruler along the lower right. Nothing on the desk moves. There are no letters or "
                  "numbers on the drawing.",
        lambda o: "a slow, smooth slide from the first frame to the last at an even speed — the camera glides to the right and a little down, so "
                  "the drawing slides about 3.5% of the frame width to the left and about 2.5% up, while the picture slowly turns by about 3°; no "
                  "shake, no zoom."),
    3: (0.54, "어두운 공장 바닥에 튀는 불꽃 — 거의 고정 · 작은 손떨림",
        [],
        lambda o: "Low on the dark, damp concrete floor of the factory: showers of bright orange sparks from a grinder just out of the frame rain "
                  "down and skip across the floor toward the camera, bouncing, scattering and fading, nonstop for the whole clip.",
        lambda o: "the frame stays where it is, low on the floor, with only a very small natural handheld tremble in place; no push-in, no zoom, "
                  "no pan."),
    4: (0.71, "어둠 → 0.15초 용접 불꽃이 켜지며 두꺼운 강판이 호박빛으로 — 고정",
        [],
        lambda o: "Near darkness: the tip of a welding rod hangs just above the edge of a thick steel plate, with only a faint blue spark. At "
                  "about 0.15 s the welding arc flares into a blinding white-gold light that floods the steel plate with amber; sparks spray out "
                  "to both sides and thin white smoke rises from the weld; it keeps burning bright to the end.",
        lambda o: fix("the steel plate and the welding rod", "the light, the sparks and the smoke")),
    5: (1.13, "어둠 속 용접 — 헬멧으로 얼굴을 가린 용접공 · 푸른 불꽃 · 흰 연기, 고르게 다가감 5%",
        ["CREW"],
        lambda o: "In the dark workshop, a welder in a dark welding helmet — his face completely hidden — bends over the joint and welds: a "
                  "hissing blue-white arc at his gloved hand throws sparks, and white smoke curls up past the helmet, for the whole clip.",
        lambda o: "a slow, steady push-in from the very first frame — the camera physically moves forward, so the welder grows by about 5% in "
                  "the first 1.1 s, at the same constant speed for the whole clip; no shake, no pan, no tilt."),
    6: (1.42, "밝은 불꽃 → 배관 틈 너머 보안경 · 마스크로 얼굴을 가린 용접공(붉은 작업복) — 고정",
        ["CREW"],
        lambda o: "Through a gap between blurred steel pipes in the foreground: a welder in a rust-red work jacket, his face covered by a welding "
                  "mask and goggles, welds on a big turbine part. The torch flares bright for the first 0.3 s, then settles to a steady glow, "
                  "and orange sparks keep spraying from it.",
        lambda o: fix("the pipes and the machine", "the welder, the sparks and the light")),
    7: (2.59, "터빈 속 배관 사이 렌치를 작게 두 번 돌리는 장갑 손 → 카메라가 오른쪽 위로 부드럽게 따라가 작업모 쓴 조립공의 어깨 · 뒤통수(얼굴 없음)",
        ["CREW"],
        lambda o: "Inside the turbine's tangle of steel pipes, a gloved hand works a wrench on a pipe fitting — two slow, small quarter-turns — and stays on "
                  "the fitting. The camera leaves the hand and finds the assembler's dark shoulder and the back of his head under a dark work "
                  "cap; his face stays turned away into the machine and is never seen. No one appears except the assembler whose hand and "
                  "shoulder are in the first frame.",
        lambda o: "a smooth, steady follow — from the very first frame the camera moves up and to the right at a steady speed, so the picture slides about half "
                  "the frame width to the left and about half the frame height down by 2.1 s, then it eases out over the last half second; it "
                  "also moves in slightly (about 5%); no shake, no zoom."),
    8: (1.88, "정면 큰 압축기 날개 원(화면 가득), 원 너머 멀리 서 있는 사람 — 고르게 다가감 9%",
        ["CREW"],
        lambda o: "Head-on in front of a huge compressor blade ring that fills the frame — rows of dark steel blades around a big round opening; "
                  "through the opening, far away in the bright hall, one worker stands small by the tall windows, green trees outside. Nothing "
                  "moves; the far worker stays still.",
        lambda o: "a slow, steady push-in from the very first frame — the camera physically moves forward toward the opening, so the ring grows "
                  "by about 9% over 1.9 s, at exactly the same speed the whole time; no shake, no pan, no tilt."),
    9: (1.13, "날개 원 가운데 원판 · 날개 뿌리 접사(위에 노란 띠) — 다가감 10%(앞 0.8초 빠르게, 끝에 거의 멈춤)",
        [],
        lambda o: "A close-up of the center of the blade ring: the round machined steel hub and the roots of the dark blades fanning out around "
                  "it, a thin strip of yellow safety tape along the top edge. Nothing moves.",
        lambda o: f"a push-in from the first frame of this shot — fast until {s(o + 0.8)} s, then easing to almost a stop by {s(o + 1.1)} s; the "
                  "hub grows by about 10%; no shake, no pan, no tilt."),
    10: (2.21, "흰 조명 조립동 와이드 — 받침대 위 터빈 로터, 옆에 작업자 둘(작게, 얼굴 없음) — 물러남 13%(처음 빠르고 갈수록 느려져 멈춤)",
         ["CREW"],
         lambda o: "A wide view of the bright, white-lit assembly hall: a long turbine rotor with rows of blades lies on steel stands, a big casing "
                   "section beside it, a yellow overhead crane above. Two small workers in grey work clothes and white hard hats stand by the "
                   "rotor with their faces turned toward it; they barely move.",
         lambda o: "a pull-back from the very first frame — the camera physically moves backward, so the whole hall shrinks by about 13% by 2.2 s: "
                   "fastest at the start, slowing steadily, and stopped at 2.2 s; no shake, no pan, no tilt."),
    11: (1.54, "터빈 몸통 밑 낮은 자리 — 위로 케이스, 아래로 흰 안전모 쓴 작업자 정수리(얼굴 없음) — 거의 고정",
         ["CREW"],
         lambda o: "Low under the curved belly of the turbine casing, which fills the top of the frame: at the bottom, a worker in a white hard "
                   "hat bends over his work, seen from above and behind — only the top of his hat and his shoulder show; his face is never seen. "
                   "The bright hall glows behind.",
         lambda o: "almost still — the frame stays where it is with only a tiny handheld float in place; no push-in, no zoom, no pan."),
    12: (1.96, "어두운 작업장 작업대 앞 작업자 뒷모습 → 아래로 따라 기울이면 화면 오른쪽 밖에서 들어와 날개 하나를 들고 지나가는 둘째 작업자(가슴 아래) — 손떨림 · 살짝 다가감",
         ["CREW"],
         lambda o: "In a dim workshop full of workbenches under warm work lamps, a worker stands at his bench, seen from behind; his face is never "
                   "seen. Then a second worker, who has been waiting just outside the right edge of the frame, walks past close in front of the "
                   "camera, seen only from the chest down, carrying a single long, curved turbine blade in both gloved hands; from about 1.2 s "
                   "the blade sweeps into the lower half of the frame and fills the middle of the frame from top to bottom by the end, his gloved hands on its right edge. No one appears except the two "
                   "workers written in ACTION.",
         lambda o: "handheld with a natural shake; from the very first frame the camera tilts down, slowly at first and faster and faster "
                   "(fastest around 1.5–1.75 s), so the picture moves up by about 40% of the frame height by 2 s, while the camera also moves in "
                   "a little (about 12%)."),
    13: (1.04, "두 팔로 검은 케이스 덮개를 받치는 작업자(뒷모습), 오른쪽 뒤 다른 작업자 — 손에 든 흔들림",
         ["CREW"],
         lambda o: "In the bright assembly hall, a worker in a grey work jacket and a white hard hat, seen from behind, holds a heavy dark casing "
                   "cover up against the turbine with both arms raised, steadying it; another worker stands small in the background on the right. "
                   "Their faces are never seen.",
         lambda o: "handheld with a small natural shake, drifting slightly sideways; no zoom."),
    14: (1.67, "어깨 너머 — 장갑 낀 손이 덮개 이음매를 한 번 천천히 눌러 맞춤(얼굴 없음) — 살짝 물러남 9% · 위로 조금",
         ["CREW"],
         lambda o: f"Over the shoulder of a worker in a dark cap and a dark work jacket (his face never seen): his gloved hand presses once, slowly "
                   f"and firmly, along the seam of the big dark casing cover to seat it, fingers kept together, from {s(o + 0.2)} s to "
                   f"{s(o + 1.2)} s; the bright hall stretches behind.",
         lambda o: f"from the first frame of this shot the camera pulls back slowly and rises a little — the picture shrinks by about 9% by "
                   f"{s(o + 1.7)} s, at an even pace; smooth, no shake."),
    15: (0.88, "어두운 날개 사이에 든 팔 · 장갑이 더 깊이 들어감 — 손에 든 흔들림",
         ["CREW"],
         lambda o: "In the dark between big curved black turbine blades, a worker's arm in a dark sleeve and a black glove, already between the "
                   "blades from the first frame, slides in deeper, as if fitting one into place.",
         lambda o: "handheld with a natural shake, nudged along as the arm slides in deeper; no zoom, no pan."),
    16: (1.13, "검은 날개 원 앞면 · 가운데 원뿔, 오른쪽에 준호 옆얼굴(제자리에서 눈으로 날개를 따라감 — 첫 등장) — 카메라가 둘레로 오른쪽으로 미끄러짐 12%",
         ["JUNHO", "TURBINE"],
         lambda o: "In the bright assembly hall, the turbine's front fills the left: the round black bladed intake with its black cone, inside the "
                   "cream-white casing. On the right, close to the lens, Junho in profile looks into the blades, quiet and serious, lips closed; he "
                   "keeps the same pose and does not turn — only his eyes follow the blades slowly; otherwise only the camera moves.",
         lambda o: "the camera glides smoothly to the right around him at a steady pace from the very first frame — the blade ring and its cone "
                   "slide to the left by about 12% of the frame width in 1.1 s, while Junho stays at about the same place on the right of the "
                   "frame; no shake, no zoom."),
    17: (1.67, "흰 조립동 — 덮개 열린 터빈 정면 와이드, 아래 작은 사람 셋 — 고정",
         ["TURBINE", "CREW"],
         lambda o: "A wide, head-on view in the white-lit assembly hall: the turbine stands on its stand with the casing panels around its front "
                   "opened up, showing the round black bladed intake and its cone; three small workers stand around its base, seen from behind "
                   "or far away. They shift only slightly.",
         lambda o: fix("the turbine and the hall", "the small workers")),
    18: (1.00, "준호가 위를 올려다봄(옆얼굴, 노란 크레인) — 인물 둘레로 살짝 돌아감(바탕 20% · 5° 기욺)",
         ["JUNHO"],
         lambda o: "Junho, in the bright hall under the yellow overhead crane, looks up at the turbine towering above him, still and quiet, lips "
                   "closed. He keeps the same pose and the same head angle the whole time — he does not turn; only his eyes travel slowly upward "
                   "along the machine, and he breathes.",
         lambda o: "the camera swings gently sideways to the left around him while staying on his face: the hall behind him — the steel columns "
                   "and the yellow crane — slides to the right by about 20% of the frame width in 1 s, while Junho stays at about the same place "
                   "in the frame; the horizon tilts gently by about 5° as it moves. Only the camera moves; light handheld feel."),
    19: (5.00, "트레일러 흙받이의 노란 아기 그림 표지(글자 없음) 접사 → 크레인처럼 올라가며 물러나 흰 터빈이 실린 트레일러 전체",
         ["TURBINE"],
         lambda o: "Close-up of the rear mud flap of a heavy low-bed trailer standing still on a concrete yard: a scuffed, dusty light-grey flap "
                   "with a small yellow diamond sign that shows only a baby's face, no letters; the big tires on the right and red tail lights on "
                   "the left. As the camera rises and pulls back, the whole trailer is revealed — a long multi-axle low-bed trailer carrying the "
                   "huge cream-white gas turbine, its black bladed intake facing the rear, strapped down and ready to leave. Nothing on it moves.",
         lambda o: "a smooth crane move that rises and pulls back: it starts slowly in the first 0.5 s, speeds up, is fastest between 1.5 s and "
                   "2.5 s, keeps moving a little slower until 4.0 s, then eases quickly to a stop by 4.5 s. The mud flap with its yellow sign "
                   "shrinks to the bottom of the frame and slips out below it by about 3.7 s; at the end the picture has pulled back to about a "
                   "quarter of its starting scale: the turbine on the trailer fills the frame, its black bladed intake facing the camera. "
                   "Perfectly smooth, no shake."),
    20: (2.92, "트럭 운전석 — 기어 잡은 손 → 운전대 손 → 어깨 · 옆 창(창밖은 콘크리트 마당, 머리는 화면 밖, 얼굴 없음) — 손에 든 채 빠르게 돌아 나감",
         ["DRIVER"],
         lambda o: "Inside the truck cab: the driver's right hand, in the sleeve of a light-grey work jacket, holds the gear lever and shifts it "
                   "once at the start; his other hand rests on the steering wheel. Only his hands, arm and shoulder are ever seen — his head "
                   "always stays above the top edge of the frame, and nobody turns toward the camera. Outside the window, the bright concrete yard "
                   "exactly as in the first frame. No one appears except the driver whose arm is in the first frame.",
         lambda o: "handheld, a quick swing from the very first frame: the camera rises and pulls back toward the upper left — off the gear hand, "
                   "past his hand on the steering wheel at about 0.7 s, to his shoulder and the side window by about 1.5 s; fastest between 0.5 s "
                   "and 1.3 s, then it slows and is almost still from 2.0 s; the picture shrinks by about a quarter as it pulls back; natural "
                   "handheld shake."),
    21: (1.04, "운전석 창밖 둥근 사이드미러, 거울 속에 실려 가는 터빈 — 고정",
         ["TURBINE"],
         lambda o: "From the driver's seat, looking out of the open side window: the round convex side mirror on its steel arm; in the mirror, "
                   "the long trailer with the cream-white turbine follows behind, steady. The concrete yard beyond.",
         lambda o: "the frame stays exactly where it is from the first frame to the last — the window frame and the mirror arm never shift; no "
                   "push-in, no zoom, no drift, no shake."),
    22: (1.08, "한낮 바깥 — 시험대 틀에 걸린 터빈, 뒤로 언덕 숲 — 아주 살짝 다가감 2%",
         ["TURBINE"],
         lambda o: "Outdoors in bright midday light: the turbine hangs in a big steel test-stand frame under a steel roof, its black bladed intake "
                   "toward the left; green wooded hills and blue sky behind. Nothing moves.",
         lambda o: "a very slow, even push-in from the very first frame — the camera physically moves forward, the picture grows by about 2% in "
                   "1.1 s; no shake."),
    23: (1.58, "한낮 — 큰 콘크리트 시험동 입구 와이드, 철골에 걸린 터빈 · 작은 사람 — 아주 살짝 다가감 2%",
         ["TURBINE", "CREW"],
         lambda o: "Midday: a wide view of the huge concrete test building's open entrance; the turbine sits in its steel frame in the doorway, a "
                   "small worker standing near it, a strip of green grass in the foreground. Nothing moves.",
         lambda o: f"a very slow, even push-in from the first frame of this shot — the camera physically moves forward, the picture grows by "
                   f"about 2% by {s(o + 1.6)} s; no shake."),
    24: (2.09, "어두운 시험동 — 흡음판 벽 통로 끝의 터빈 정면, 아래 흰 안전모 작업자 뒷모습 — 고정",
         ["TURBINE", "CREW"],
         lambda o: "In the dark test cell lined with rows of square sound-absorbing panels, the turbine faces the camera head-on at the end of the "
                   "long room, its blades still; at the bottom center a worker in a white hard hat stands with his back to the camera, still.",
         lambda o: fix("the room and the turbine", "the worker", "moves, and only very slightly")),
    25: (1.54, "준호 3/4 얼굴 접사(그림처럼 왼쪽을 봄), 어둠 속 호박빛(관제실 조명 — 불꽃 아님) — 긴장 · 0.5초 숨 한 번, 거의 고정",
         ["JUNHO"],
         lambda o: "Close-up of Junho's face in three-quarter view, turned toward the left exactly as in the first frame, in the dark control "
                   "room, lit warm amber by a small lamp behind him; tense and still, he watches something off the frame to the left and, at "
                   "about 0.5 s, takes one slow breath; his lips stay closed.",
         lambda o: "almost still — only a tiny handheld float in place, easing back very slightly (about 3%) over 1.5 s; no pan, no zoom."),
    26: (1.54, "관제실 — 오른쪽 화면에 시험동 카메라로 본 터빈, 준호 손이 레버를 한 번 천천히 밂 — 고르게 다가감 9% · 오른쪽 위로",
         ["JUNHO_HAND", "TURBINE"],
         lambda o: "In the dark control room: monitors glow above showing only graphs, no letters, and the monitor on the right shows the "
                   "turbine standing in the test cell, exactly as in the first frame. Junho's hand in a navy sleeve (only his hand and arm are seen) grips the throttle lever and slowly pushes it "
                   "forward once, from 0.2 s to 1.2 s.",
         lambda o: "a steady push-in from the very first frame — the camera moves forward and drifts up and to the right, toward the turbine on "
                   "the monitor: the picture grows by about 9% and slides about 15% of the frame width to the left and about 12% of the frame "
                   "height down by 1.5 s, at an even pace; no shake."),
    27: (1.71, "준호 눈 접사(앞) → 뒤 화면 불빛 속 동료(뒷모습)의 뒤통수 · 어깨로 초점 이동(0.3~1.3초, 얼굴 생기지 않게) — 작은 흐름",
         ["JUNHO", "CREW"],
         lambda o: "Extreme close-up of Junho's eye and cheek in the dark, sharp in the foreground, watching intently, lips closed; behind him on "
                   "the right, in the glow of the monitors, the soft dark shape of a colleague seen from behind, who never turns. From 0.3 s to "
                   "1.3 s the focus slowly moves from Junho's eye to that colleague: Junho turns soft while only the back of the colleague's "
                   "head and his shoulder become sharp — no facial features ever form. Nobody moves.",
         lambda o: "almost still — only a tiny handheld float in place, moving in very slightly (about 4%); no pan."),
    28: (1.96, "시험동 터빈 정면(흡음판 벽) — 날개가 천천히 고르게 돎(날개 선명 · 흐려지지 않게), 아주 느리게 다가감 4%",
         ["TURBINE"],
         lambda o: "The test cell again, head-on: the turbine at the end of the room between the walls of square panels. Its bladed intake "
                   "turns slowly and steadily from the first frame to the last — about a quarter turn every second — every blade staying sharp, "
                   "separate and the same shape, never blurring; the casing and the room stay perfectly still.",
         lambda o: "a very slow, even push-in from the very first frame — the camera physically moves forward, the picture grows by about 4% over "
                   "2 s at a constant speed; no shake."),
    29: (1.29, "준호 손바닥이 흰 케이스에 닿은 채(옆에서, 팔 · 소매 — 손가락만 한 번 조금 더 붙임) — 거의 고정, 끝에 살짝 다가감",
         ["JUNHO_HAND", "TURBINE"],
         lambda o: "Side view in the bright assembly hall, only his hand and arm in the frame: Junho's hand, in the navy work-jacket sleeve, rests flat with the palm on the "
                   "smooth cream-white casing beside a row of bolts and stays there — only his fingers press a little flatter against the casing "
                   "once — a quiet goodbye. The black blades and "
                   "cone at the left edge.",
         lambda o: f"almost still — only a tiny handheld float in place; in the last half second, from {s(o + 0.8)} s, it moves in very "
                   "slightly."),
    30: (1.83, "흰 조립동 — 다 만든 터빈 옆면 와이드, 준호가 작게 서서 케이스에 손을 댄 채 → 0.7초 손을 내리고 올려다봄 — 고정",
         ["JUNHO", "TURBINE"],
         lambda o: f"A wide view of the bright assembly hall: the finished turbine's long cream-white casing fills the right side; Junho stands "
                   f"small beside it with his hand on the casing. At about {s(o + 0.7)} s he lowers his hand and slowly looks up along the "
                   f"turbine, quiet, lips closed. Nothing else moves.",
         lambda o: fix("the turbine and the hall", "Junho", "moves")),
    31: (1.00, "준호 올려다봄(아래에서, 노란 크레인 · 흰 조명) → 0.3~0.9초 시선을 조금 내림 — 살짝 아래로 기울임 7%(32 실루엣으로 밝기 램프는 편집)",
         ["JUNHO"],
         lambda o: "From low below: Junho looks up at the turbine above him, under the white hall lights and the yellow crane; from 0.3 s to "
                   "0.9 s he lowers his gaze slightly, calm, lips closed.",
         lambda o: "the camera tilts down slightly as he lowers his gaze — about 7% of the frame height by 0.9 s; smooth, with only a tiny "
                   "handheld float."),
    32: (0.29, "같은 자세의 준호 역광 실루엣(31에서 밝기 램프로 이어짐 — 편집) — 고정",
         [],
         lambda o: "The same pose as a dark backlit silhouette: Junho's head and shoulders, looking up, a black shape against a warm, hazy amber "
                   "glow; his face is not seen. He stays perfectly still.",
         lambda o: fix("the silhouette and the background", "a faint drift of haze", "moves")),
    33: (1.84, "해 질 녘 발전소 터빈동 — 우리 터빈을 뒤에서(배기 끝이 카메라 쪽, 열린 문 너머 노을) · 젖은 바닥 그림자 — 거의 고정(2% 물러남)",
         ["TURBINE"],
         lambda o: "Dusk inside a power-plant turbine hall: the cream-white turbine seen from behind — its big round exhaust end toward the "
                   "camera — stands in the middle of the wet, mirror-like floor, facing the huge open doorway where the orange-pink sunset sky "
                   "glows; its reflection lies on the floor. Everything is still; only a faint haze drifts in the doorway.",
         lambda o: "almost still — the camera eases back very slowly, the picture shrinks by about 2% over 1.8 s; no shake, no pan."),
    34: (1.42, "바깥 해 질 녘 — 준호와 동료 둘이 걸어 나옴(앞 흐린 동료는 뒤통수 · 귀만, 뒷사람 얼굴 없음) — 걷는 사람들을 따라감 · 손에 든 흔들림",
         ["JUNHO", "CREW"],
         lambda o: "Outdoors at dusk at the power plant: Junho walks with two co-workers toward the left of the frame, looking ahead, calm, lips "
                   "closed. In the near left foreground, a co-worker's head and ear, seen from behind and blurred, drift out of the frame on the "
                   "left by about 1 s; another co-worker walks in the background, his face turned away.",
         lambda o: "handheld, moving along with them to the left with a natural walking sway — the plant behind them slides to the right by "
                   "roughly 15% of the frame width over 1.4 s, while Junho stays on the right side of the frame; focus stays on Junho's face."),
    35: (1.13, "세 사람 뒷모습(가운데 준호) 너머 발전소 굴뚝 · 송전탑 · 노을 하늘에 김 — 다가가며(3%) 위로 기울임 15~18%",
         ["JUNHO_BACK", "CREW"],
         lambda o: "Three men seen from behind — Junho in the middle in his navy jacket, a co-worker on each side — stand still, looking out at the "
                   "power plant at dusk: tall chimneys with white steam rising, transmission towers and plant lights under an orange-pink sky.",
         lambda o: "from the very first frame the camera moves in slightly (about 3%) while tilting up — the picture moves down by about 15–18% of "
                   "the frame height by 1.1 s, fastest between 0.2 s and 0.5 s, revealing more of the glowing sky and the rising steam; smooth, "
                   "no shake."),
    36: (1.25, "준호 얼굴 미디엄 클로즈업, 멀리를 바라봄(입 다문 채 · 조용한 뿌듯함) — 손에 든 채 살짝 다가감 · 작은 흔들림",
         ["JUNHO"],
         lambda o: "Medium close-up of Junho's face at dusk, looking far into the distance with quiet pride; warm sunset light on one side of his "
                   "face; a soft breeze stirs his hair slightly; his lips stay closed.",
         lambda o: "handheld with a small natural shake, moving in slightly (about 5%) over 1.25 s."),
    37: (4.00, "노을 하늘 — 송전탑 꼭대기 · 송전선이 카메라 옆을 스쳐 지나 뒤로 멀어지고 멀리 도시 불빛이 구역마다 번지며 더 밝아짐(S37은 이미 불이 켜진 그림 · 끝 글자 · 로고는 후반)",
         [],
         lambda o: "High in the air at dusk under glowing orange-pink clouds: the top of a steel transmission tower with its insulators stands "
                   "close beside the camera on the left, the power lines sloping away toward a wide city far below. As the camera flies past it, "
                   "the tower sweeps past the left side and falls away behind; then, from about 1.8 s to 3.8 s, the city glow grows: more windows "
                   "and streets light up district by district, the lit areas spreading and brightening until the whole city glows clearly "
                   "brighter than at the start, while the sky keeps its dusk colors. The tower's steel lattice stays rigid and sharp-edged as "
                   "it passes, and the power lines stay thin, straight and continuous.",
         lambda o: "a smooth aerial move: almost still for the first 0.5 s, then the camera flies forward past the tower — the tower sweeps out "
                   "of the frame on the left, fastest between 0.75 s and 1.5 s; the camera keeps gliding gently toward the city while slowing "
                   "down, and is almost still from about 2.3 s to the end; no shake."),
}

BUNDLES = [(8, 9), (10, 11), (13, 14), (22, 23), (29, 30)]   # 얼굴 클로즈업 없는 같은 곳 · 같은 때 짝만(1+2 · 25+26 · 34+35는 얼굴이라 낱판)
# 묶음 머리(웹꾸러미 prompt()의 「the same moment in the same place under the same light;」)를 판 칸 「같은때말」로 바꾼다 — 8 · 9는 빛이 달라
#   (S08 밝은 낮빛 ↔ S09 어두운 청동빛) 각 샷이 제 그림의 빛을 지키게(10-31 Fable p10-08-09). 바꾸는 것은 여섯 편 꾸러미(웹꾸러미 six_item)다.
BUNDLE_NOTE = {
    (8, 9): "the same moment, the same place and the same machine; each shot keeps the light and colors of its own reference image — "
            "SHOT 1 the bright daylight of @이미지 1, SHOT 2 the darker bronze light of @이미지 2;",
}
# 묶음의 낱판을 대안이 아니라 주판으로도 — 29+30은 이 편의 절정(손바닥 · 정적)이라 묶음과 낱판을 둘 다 뽑아 고른다(10-31 Fable 권고)
BOTH = {29, 30}
REF = {   # 글로만 지어내던 드러나는 구도를 그림 참고로(10-31 검수 12번 16과 같은 길) — 참고 없는 판을 대안으로 둔다
    19: ("R5.png",
         "@이미지 2 is a reference only for what the rising camera reveals — the same long multi-axle low-bed trailer and the same cream-white "
         "turbine on it, its black bladed intake facing the rear. It is not the last frame and not a separate shot; the mud flap and its yellow "
         "baby sign stay exactly as in @이미지 1."),
}


def pic(n):
    return f"S{n:02d}{SRC_EXT.get(n, '.png')}"


# 확정 판 파일의 확장자(시댄스/로 옮길 때 그대로 — Gemini 얼굴 판은 .jpg, GPT · 고름 판은 .png)
SRC_EXT = {n: ".jpg" for n in (1, 16, 18, 25, 27, 31, 34, 36)}


def length(t):
    return max(4, math.ceil(round(t + 0.8, 2)))


def shot(n, o=0.0):
    t, desc, who, act, cam = CUT[n]
    return {"그림": pic(n), "쓰는초": t, "누구": who, "동작": act(o), "카메라": cam(o)}


def single(n, alt=False, ref=True, tag=""):
    t, desc, *_ = CUT[n]
    p = {"id": f"p10-{n:02d}{tag}", "컷": [str(n)], "길이": length(t)}
    if alt:
        p["대안"] = True
    p["설명"] = desc
    if ref and n in REF:
        p["참고그림"], p["참고말"] = REF[n]
        p["설명"] = desc + " — 참고 그림 R5(옴니 레퍼런스로 올림 · 2_참고를 끝 프레임 칸에 넣지 않음)"
    p["샷"] = [shot(n)]
    return p


def bundle(a, b):
    ta, tb = CUT[a][0], CUT[b][0]
    cut = math.ceil(round((ta + 0.7) * 10, 3)) / 10
    p = {"id": f"p10-{a:02d}-{b:02d}", "컷": [str(a), str(b)], "길이": math.ceil(round(cut + tb + 0.8, 2)), "자르는초": cut,
         "낱판": [f"p10-{a:02d}", f"p10-{b:02d}"], "설명": f"{CUT[a][1]} → {CUT[b][1]}(두 샷 묶음)"}
    if (a, b) in BUNDLE_NOTE:
        p["같은때말"] = BUNDLE_NOTE[(a, b)]
        p["설명"] += " — 두 샷의 빛이 달라 각 샷이 제 그림 빛을 지키게(머리 구절을 판 칸 「같은때말」로)"
    p["샷"] = [shot(a), shot(b, cut)]
    return p


def build():
    first = {a: b for a, b in BUNDLES}
    inb = {n for ab in BUNDLES for n in ab}
    main, alts = [], []
    for n in range(1, 38):
        if n in first:
            main.append(bundle(n, first[n]))
            for m in (n, first[n]):
                if m in BOTH:   # 절정 낱판은 주판 — 묶음과 같이 내고 받은 뒤 고른다
                    q = single(m)
                    q["설명"] += f" — 묶음 p10-{n:02d}-{first[n]:02d}과 같이 내고 고름(절정 컷이라 묶음 · 낱판 둘 다, 10-31 Fable 권고)"
                    main.append(q)
                else:
                    alts.append(single(m, alt=True))
        elif n not in inb:
            main.append(single(n))
            if n in REF:
                b = single(n, alt=True, ref=False, tag="b")
                b["설명"] = CUT[n][1] + " — 둘째 길: 참고 그림 없이 글로만(참고가 흙받이 · 첫 장을 바꾸거나 옴니 레퍼런스가 안 될 때)"
                alts.append(b)
    return {
        "메모": ("10번 B2B 기업 홍보영상 「도담중공업」 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31, 지시문_시댄스웹.py가 만듦). 10-29 결정 "
                 "「포트폴리오도 손님 납품도 Seedance 2.5 720p」로 9절 견적의 Omni 길 대신 이 판으로 낸다. 시작 그림은 10-27 이미지 콘티 보드와 같은 "
                 "고르기(고름/ 30 · 33, 나머지는 받음/ · 받음_gpt/판/의 가장 최근 판)를 git 밖 콘티/p10/시댄스/에 모은 것(--그림), 모두 16:9 — "
                 "후반에서 원본처럼 약 2:1 띠로 자른다. 카메라는 02_콘티 2절 카메라 칸 · 10절(원본 실측) 그대로이고 장비 이름 · 오빗 말 · 1.5° 아래 "
                 "롤은 쓰지 않았다. 10절이 「영상 단계에서 굽는다」고 한 끝 그림(7 · 12 · 19 · 20 · 35 · 37)은 아직 없어 끝 모습을 글로 쓰고, 19만 "
                 "기준 그림 R5(트레일러 · 터빈)를 참고로 넣는다(참고 없는 19b는 대안). 얼굴은 준호뿐이고 입은 늘 다문다. 소리 끔 — 내레이션 · "
                 "노래 · 화면 글 · 회사 이름은 후반. 길이 = max(4, ⌈쓰는 초 + 0.8⌉), 두 샷 = ⌈자르는 초 + 둘째 쓰는 초 + 0.8⌉. 꾸러미는 "
                 "../../../시댄스무제한/웹꾸러미.py. 10-31 Fable 결제 전 검수(P1 2 · P2 8 · P3 6, git 밖 콘티/검수/시댄스앞_여섯편_20261031/p10/review.md) 반영 — "
                 "12 둘째 작업자는 화면 오른쪽 밖에서 들어오고 공통 LOOK은 「not in the first frame or written in ACTION」, 37은 S37이 이미 불이 켜진 그림이라 "
                 "「불빛이 번져 더 밝아짐」, 28 날개는 천천히 선명하게, 8+9는 샷마다 제 빛, 29 · 30 낱판은 묶음과 함께 주판."),
        "편": "p10",
        "이름": "10번 B2B 기업 홍보영상 「도담중공업」",
        "비율": "16:9",
        "그림": str(IMG).replace("\\", "/"),
        "공통": 공통,
        "판": main + alts,
    }


def ours(n):
    """10-27 보드(이미지콘티_보드.py)와 같은 고르기 — 고름/이 먼저, 없으면 받은 판 가운데 가장 최근"""
    k = f"S{n:02d}"
    p = P10 / "고름" / f"{k}.png"
    if p.exists():
        return p
    cands = sorted([q for d in ("받음", "받음_gpt/판") for ext in ("png", "jpg") for q in (P10 / d).glob(f"{k}_*.{ext}")],
                   key=lambda q: q.stat().st_mtime)
    return cands[-1]


def copy_pics():
    IMG.mkdir(parents=True, exist_ok=True)
    rows = []
    for n in range(1, 38):
        src = ours(n)
        assert src.suffix.lower() == SRC_EXT.get(n, ".png"), (n, src)
        shutil.copy2(src, IMG / pic(n))
        rows.append({"컷": n, "그림": pic(n), "원본": str(src.relative_to(P10)).replace("\\", "/")})
    shutil.copy2(P10 / "참조" / "R5.png", IMG / "R5.png")
    rows.append({"컷": "참고", "그림": "R5.png", "원본": "참조/R5.png"})
    (IMG / "_출처.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"그림 {len(rows)}장 → {IMG}")


if __name__ == "__main__":
    if "--그림" in sys.argv:
        copy_pics()
    spec = build()
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    main = [p for p in spec["판"] if not p.get("대안")]
    alts = [p for p in spec["판"] if p.get("대안")]
    bund = [p for p in main if len(p["샷"]) > 1]
    print(f"판 {len(spec['판'])} — 주판 {len(main)}(두 샷 묶음 {len(bund)}) · 대안 {len(alts)} · 주판 길이 합 {sum(p['길이'] for p in main)}초 · "
          f"가장 긴 판 {max(p['길이'] for p in spec['판'])}초 · 컷 {sum(len(p['컷']) for p in main)}")
