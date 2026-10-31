# 시즌 4 · 블프 스나이퍼 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31).
#   python -X utf8 시댄스지시문.py      → 지시문/영상_시댄스웹.json(굽기 시트의 웹꾸러미.py가 읽는 꼴 — 11번 · 옆집과 같음)
# 그림은 확정 이미지 콘티(git 밖 콘티/bf-sniper/정지컷/_고른판.json이 가리키는 받음/ 판)를 이름만 바꿔 모은 git 밖 콘티/bf-sniper/시댄스/
# (S02 … S19a · S19b, 출처는 그 폴더 _출처.json). 동작은 02_콘티 2절 「화면」대로 한 가지, 카메라는 01 8절 · 02 2절 카메라 칸(원본 23.92fps
# 매 프레임 실측)의 숫자 그대로 — 「고정」은 원본이 정말 고정인 열 컷(2 · 5 · 10 · 11 · 12 · 13 · 14 · 15 · 16 · 18)에만, 문구는 굽기 시트
# 10-31 반영 꼴(「화면이 처음부터 끝까지 그 자리」 긍정 먼저 · 장비 이름 없음 · 1.5° 아래 롤 없음 — 이 편은 원래 돌림이 1° 아래).
# 초는 그 판 첫 프레임 기준(원본 초 − 컷 시작). 길이 = max(4, ⌈쓰는 초 + 0.8⌉) — 시댄스가 0.7초쯤 늦게 온다. 3번만 앞 약 0.6초를 버리는 판이라 +0.7(5초).
# 두 샷 묶음은 없다 — 몽타주라 붙은 컷끼리도 각도 · 소품 배치가 다르고(10 · 12 손 접사와 11 얼굴의 책상 위 물건이 서로 다름) 달력 컷은 서로 붙지 않는다.
# 3번: 콘티 4절 ①(빈 벽에서 시작해 얼굴이 두 번 올라옴)의 「R1 TV 벽」은 넓은 방 기준 그림이라 시작 그림으로 쓸 수 없다 — S03(올라온 순간)으로
#   시작해 앞 0.6초에 내려가 화면 밖으로 빠지게 하고, 편집은 「첫 번째로 올라오기 0.25초 전」부터 쓴다(원본 빈 벽 2.68 → 2.93). 준호를 지운 빈 벽 판은
#   굽지 않는다(11-01 Fable — 얻는 것은 빈 벽 0.25초뿐이고, 첫 프레임에 얼굴이 없으면 올라오는 얼굴을 다른 사람으로 지을 위험).
# 19번: 시작 S19a(아무도 없는 00:00 거실) → 끝 S19b(잠든 준호) 한 판, 0.9초에 닿아 멈추고 끝까지 거의 그 자리(02 5절 1 · 2절 19 카메라 칸).
#   S19a 담요 자리와 S19b 준호 자리가 한 번의 옆 이동으로 이어지지 않아(11-01 Fable P1) 19a(끝 그림 없는 옆 이동 0.83초) · 19b(잠든 준호에서 시작
#   4.11초)도 주판으로 같은 묶음에서 굽는다 — 받은 19가 ① 1.2초 안 도착 ② 담요 → 준호 녹임 없음 ③ 끝 프레임 = S19b를 못 넘으면 둘을 27.0초 하드 컷.
# 11-01 Fable 검수(P0 0 · P1 1 · P2 9 · P3 5, git 밖 콘티/검수/시댄스앞_여섯편_20261031/s4/review.md) — P1 · P2는 지적 표의 「앞 → 새」 글자 그대로 반영.
# 영상은 모두 소리 끔 — 준호 속삭임 여섯은 입 다문 속마음, 가게 목소리는 화면 밖, 달력 손글씨 · D-숫자 · 훈련 꼬리표 · 전단 글 · 알림 · 끝 카드는 후반 합성.
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMG = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/시댄스"

공통 = {
    "장르": "a deadpan Korean comedy TV commercial",
    "누구": {
        "JUNHO": "the same Korean man aged 38 as in the first frame, in every frame — short black hair neatly side-parted, clean-shaven "
                 "with a smooth jaw, exactly the face of the first frame, in exactly the clothes of the first frame (a plain heather-grey "
                 "crewneck sweatshirt and navy track pants). His face stays completely serious and deadpan, like a soldier on a mission — "
                 "calm steady eyes, eyebrows level, mouth a flat line, lips closed; whatever passes or happens, nothing moves on his face. "
                 "He never speaks, never smiles, never grimaces.",
        "HAND": "his hands — a man's hands in the heather-grey sweatshirt sleeves, exactly as in the first frame: short clean nails, no ring, "
                "no watch. Only the hands and a little of the forearms are in the frame; his face never appears.",
        "CALENDAR": "the big white paper wall calendar exactly as in the first frame — large black printed day numbers in a thin blue-grey "
                    "grid, the red marker X's already drawn on the earlier days, and '00:00' handwritten in red in the box for the 27th. "
                    "Every number and every mark already on it stays exactly as it is — never redrawn, moved or rewritten; the only new red "
                    "line is the one the marker draws now; no other writing, numbers or letters appear.",
        "RING": "the big LED ring light standing right in front of the camera, out of focus — its thin glowing white ring frames him in the "
                "middle of the picture and stays exactly where it is.",
        "ROBOT": "the small round white robot vacuum from the first frame — a plain white disc with no markings that moves by itself.",
        "FLYER": "the glossy sale flyer he holds open, exactly as printed in the first frame — the big TV photo, the amber-orange price "
                 "blocks and every printed Korean letter and number stay exactly as they are and are never redrawn.",
        "DESK": "the low light-oak 'operation desk' and the light wooden phone stands on it, exactly as in the first frame.",
        "CLOAK": "the grey fleece blanket draped over his head and back like a sniper's camouflage cloak, exactly as in the first frame.",
        "NIGHTDESK": "the operation desk at midnight, exactly as in the first frame — its screens glowing bright blue-white, and at its right "
                     "end the phones on stands and the old-fashioned twin-bell alarm clock.",
        "SLEEPER_END": "Junho, the Korean man aged 38 of @이미지 2 — short black hair, clean-shaven, faint black camouflage stripes on his "
                       "cheeks, a heather-grey sweatshirt — lying on his side on the floor in front of the desk under the grey fleece blanket, "
                       "his head on his arm, fast asleep: eyes closed, mouth slightly open, his index finger on the mouse on the floor, a lit "
                       "phone beside his head, exactly as in @이미지 2. He never wakes, never speaks; only slow breathing.",
        "SLEEPER": "Junho, the Korean man aged 38 of the first frame — short black hair, clean-shaven, faint black camouflage stripes on his "
                   "cheeks, a heather-grey sweatshirt — lying on his side on the floor under the grey fleece blanket, his head on his arm, "
                   "fast asleep: eyes closed, mouth slightly open, his index finger on the mouse on the floor, a lit phone beside his head, "
                   "exactly as in the first frame. He never wakes, never speaks; only slow breathing.",
    },
    "보기": "LOOK: a polished, high-end TV-commercial look — a real Korean apartment, realistic textures, natural skin, crisp focus, slight "
            "film grain. Keep the first frame's light — its direction, brightness, color and white balance — to the very end: the bright "
            "daytime rooms stay bright and warm, the dim bathroom stays dim, the midnight room stays dark blue. Everything printed or "
            "handwritten that is already in the first frame (calendar numbers and red marks, the flyer) stays exactly as it is; no new "
            "text, letters, numbers, logos or signs appear anywhere. Never add a person who is not described.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}


def still(what, mover="he moves"):
    # 원본이 정말 고정인 컷(01 8절 — 흔들림 0.01~0.18%)만. 5번 문구(10-29) 꼴: 긍정 먼저 · 장비 이름 없음
    return (f"the frame stays exactly where it is from the first frame to the last — {what} never shifts; no push-in, no zoom, no drift, "
            f"no shake; only {mover}.")


CAL_STILL = still("the calendar", "the hand and the marker move")

# (판 id 꼬리, 컷, 쓰는 초, 설명, 그림, 끝 그림, 누구, 동작, 카메라, 대안?, 덧초) — 덧초는 판 앞에서 버리는 몫(3번)
CUTS = [
    ("02", "2", 1.68, "달력 정면 접사 — 오른쪽에서 들어온 손이 빨간 펜으로 20일에 X(D-7, 27일 「00:00」 — 그 밖의 글은 합성)",
     "S02.jpg", None, ["HAND", "CALENDAR"],
     "Straight-on close-up of the wall calendar. A man's hand, reaching in from the right edge of the frame, holds an uncapped red "
     "marker whose tip is already in the box for the 20th, partway through the first diagonal of an X. He finishes that first diagonal by "
     "about 0.3 s, then draws the second diagonal across the 20th between about 0.5 and 1.1 s in one quick, firm stroke, so the 20th now "
     "carries a red X like the days before it; at about 1.3 s the marker lifts off the paper and the hand starts to pull away to the right. "
     "Nothing else on the calendar changes.",
     CAL_STILL, False, 0),
    ("03", "3", 2.59, "거실 바닥 윗몸일으키기 — 팔짱 낀 준호의 무표정한 얼굴이 아래에서 두 번 올라옴(앞 약 0.6초에 내려가 화면 밖으로 빠진 뒤부터 씀 — "
     "빈 벽 시작 그림이 없어 올라온 순간 S03으로 시작)",
     "S03.jpg", None, ["JUNHO"],
     "In the bright living room, Junho is doing sit-ups on the floor with his arms crossed flat over his chest; in the first frame he is at "
     "the top of a sit-up, his head and shoulders in the middle of the frame. From the first frame he lies back down, so by about 0.6 s "
     "his head and shoulders have sunk below the bottom edge and only the empty wall with the blue tape rectangle shows, exactly as in the "
     "first frame. At about 1.1 s he comes up again — his head rises into the frame from the bottom edge and stops in the middle of the "
     "frame, eyes open and steady, fixed just above the lens, eyebrows level; by about 1.9 s he sinks back down below the bottom edge; at "
     "about 2.8 s he rises into the middle of the "
     "frame once more and holds there to the end. Every time he comes up his face stays completely deadpan — lips pressed closed, no strain "
     "on the face, no smile — just one short, sharp breath through the nose.",
     "the camera sits about 1 m above the floor, level, on a long lens; the wall, tape rectangle and drawing behind him stay exactly as "
     "sharp and as they are in the first frame; it never travels sideways or forward. Between about 0.9 and 1.7 s it tilts down a little — the picture slides up by about 3.5% of the frame height, "
     "quickest in the middle and easing out — so his rising face settles nearer the center; before and after that the frame stays still. "
     "No zoom, no shake.",
     False, 0.7),
    ("04", "4", 2.34, "링 라이트 원 너머 휴대폰 아령 — 로봇 청소기가 앞을 지나가자 멈추고 무표정 목례, 지나가면 다시 듦",
     "S04.jpg", None, ["JUNHO", "RING", "ROBOT"],
     "Seen through the glowing ring light, Junho stands in the middle of the living room with his knees bent in a wide stance, curling a "
     "smartphone in each hand up and down at chest height like small dumbbells, his thumbs tapping the screens. At about 0.8 s the round "
     "white robot vacuum at the lower right rolls across the floor in front of him from right to left; he stops curling, lowers the phones "
     "a little and gives the robot vacuum one small, polite, completely deadpan bow of the head as it passes; once it has gone by, at "
     "about 1.8 s, he straightens up and starts curling the phones again, as serious as before.",
     "almost still for the whole shot — the camera only eases back a hair (well under 1% over the shot), smooth and steady; no zoom, no "
     "pan, no shake; the ring light and the room keep their places.",
     False, 0),
    ("05", "5", 1.00, "달력 접사 — 왼쪽 아래에서 온 손이 24일 X를 마저 그음(D-3)",
     "S05.jpg", None, ["HAND", "CALENDAR"],
     "Close-up of the wall calendar. A man's hand, his forearm reaching in from the lower left, holds an uncapped red marker and is drawing "
     "the first diagonal of an X across the box for the 24th. He finishes that diagonal by about 0.2 s and slashes the second diagonal "
     "across the 24th between about 0.3 and 0.8 s, completing the X; then the marker lifts off the paper. Nothing else on the calendar "
     "changes.",
     CAL_STILL, False, 0),
    ("06", "6", 1.84, "작전 책상 와이드 — 앞에 흐린 트로피 자리 셋(휴대폰 둘 · 빈 받침), 뒤에서 노트북을 반듯이 맞춤 · 카메라가 떠오르며 다가감",
     "S06.jpg", None, ["JUNHO", "DESK"],
     "Behind the low oak 'operation desk', Junho stands bent over it exactly as in the first frame — one hand on the edge of the open laptop (the "
     "arm on the left of the picture), the other hand resting on the small black mouse at the right end of the desk (the arm on the right of "
     "the picture). With the hand on the laptop he nudges it a centimetre until it sits perfectly straight, then with the other hand slides "
     "the mouse square with it, and checks both with one quick glance — calm and deadpan. In the near foreground, very close to the lens and softly out of focus, stand the three 'trophies' in a row: a phone on a "
     "wooden stand, a second phone on a stand, and an empty wooden stand.",
     "from the very first frame the camera physically rises like a boom up from behind the foreground stands while drifting a little to "
     "the left and edging closer: over about 1.8 s it rises by about 9% of the frame height, moves left by about 4% of the frame width and "
     "comes about 2.4% closer, at a steady pace that eases out near the end, then holds. The foreground stands sink toward the bottom edge, "
     "revealing more of the desk top and his hands. No shake.",
     False, 0),
    ("07", "7", 3.35, "현관 — 전단을 가슴 높이에 펼쳐 코끝 돋보기 너머로 보다가 무표정으로 천천히 안경을 벗고 더 가까이 봄(전단 글은 합성)",
     "S07.jpg", None, ["JUNHO", "FLYER"],
     "In the apartment entrance hall, Junho holds the open sale flyer at chest height and reads it, deadpan, looking over the thin black "
     "reading glasses that have slid to the tip of his nose. At about 1.3 s, still reading, he slowly takes the glasses off with the hand "
     "on the right side of the frame while his other hand keeps the flyer open, and leans his face a little closer to the flyer, eyes "
     "narrowing at the price; he holds that deadly serious look to the end; at about 2.4 s he swallows once and tilts the flyer a few "
     "millimetres closer, nothing else moves. His lips stay closed the whole time.",
     "the frame holds still until about 1.2 s; then the camera physically moves in toward him and rises slightly in two gentle steps — "
     "from about 1.2 to 2.0 s and from about 2.1 to 3.3 s — ending about 2.5% closer and about 2% higher than it started; smooth, no "
     "zoom, no shake.",
     False, 0),
    ("08", "8", 1.29, "거실 선반 휙 팬 — 헤드셋 쓴 준호가 오른쪽에서 뛰어 들어와 선반을 훑으며 왼쪽으로",
     "S08.jpg", None, ["JUNHO"],
     "Junho, wearing a black gaming headset, is just rushing in at the right edge of the frame and hurries to the left alongside the living-room "
     "shelf, glancing over its rows of plain colored drink cans, small white eye-drop bottles and black wrist braces as he passes; he "
     "keeps pace with the camera, staying in the right part of the frame, his face deadpan.",
     "a fast whip pan to the left from the very first frame: by about 1.25 s it has swung across about 88% of the frame width — the shelf "
     "smears into long horizontal streaks rushing to the right — while the view lifts slightly, so everything drifts down by about 12% of "
     "the frame height; fastest in the middle, slowing at the end; then the camera settles and holds while he carries on out of frame to "
     "the left.",
     False, 0),
    ("09", "9", 1.63, "불 끈 저녁 욕실 거울 — 어깨 너머 거울 속 준호가 뺨에 검은 위장 줄을 긋고 한 번 끄덕(입 다묾) · 거울로 고르게 다가감",
     "S09.jpg", None, ["JUNHO"],
     "In the dim bathroom, lit only by the small warm bulb beside the round mirror, we look over Junho's shoulder at his reflection: with "
     "the black face-paint stick he draws one more thick black stripe across his cheek (from the first frame to about 0.8 s), lowers the "
     "stick, and at about 1.1 s gives his reflection one slow, firm nod — grim and deadpan, lips closed. There is only one reflection of "
     "him, in the mirror; the back of his head stays out of focus at the right edge.",
     "a slow, steady push-in toward the mirror from the very first frame — the camera physically moves forward at an even pace, about 6% "
     "closer by 1.6 s, and keeps that same gentle pace to the end; no zoom, no shake.",
     False, 0),
    ("10", "10", 0.51, "작전 책상 손 접사(가슴 높이에서 내려다봄) — 휴대폰 초시계를 엄지로 누름, 다른 손은 마우스(초시계 화면은 합성)",
     "S10.jpg", None, ["HAND"],
     "Close-up looking down at the oak desk from his chest height: the hand on the right of the frame holds a smartphone showing a "
     "stopwatch, its thumb hovering just above the start button; the other hand rests on the wired mouse. At about 0.25 s the thumb presses "
     "the start button — one sharp tap — and stays poised, while the hand on the mouse tightens its grip, ready. The phone's screen keeps "
     "the same picture as in the first frame.",
     still("the desk", "the hands move"), False, 0),
    ("11", "11", 0.67, "작전 책상 앞 얼굴 미디엄 클로즈업(정면) — 손을 내려다보는 집중한 무표정, 눈을 가늘게 하며 살짝 다가앉음",
     "S11.jpg", None, ["JUNHO"],
     "Junho sits at the operation desk behind the open laptop, head slightly bowed, eyes fixed down on his hands on the mouse and keyboard "
     "just below the frame — total concentration. At about 0.3 s his eyes narrow a little and he leans in a touch toward his hands, "
     "unblinking; deadpan, lips closed.",
     still("the room behind him"), False, 0),
    ("12", "12", 1.04, "손 접사(가슴 높이에서 내려다봄) — 마우스 · 키보드 광클, 손가락이 흔들림 번짐으로 흐림",
     "S12.jpg", None, ["HAND"],
     "Close-up looking down at the oak desk from his chest height: his two hands go at full speed — the index finger on the wired mouse "
     "rapid-fire clicks and the fingers of his other hand hammer the keyboard, so fast that the fingers smear into motion blur — from the "
     "first frame to the end. His sweatshirt chest stays steady at the top of the frame.",
     still("the desk", "the hands move"), False, 0),
    ("13", "13", 0.46, "달력 접사(조금 아래에서) — 25일 X 첫 획을 마저 긋고 둘째 획(D-2)",
     "S13.jpg", None, ["HAND", "CALENDAR"],
     "Close-up of the wall calendar from slightly below. A man's hand, his forearm reaching in from the lower left, holds an uncapped red "
     "marker and is drawing the first diagonal of an X across the box for the 25th. He finishes that diagonal by about 0.2 s and slashes "
     "the second diagonal across the 25th between about 0.3 and 0.7 s, completing the X; then the marker lifts off the paper. Nothing else "
     "on the calendar changes.",
     CAL_STILL, False, 0),
    ("14", "14", 1.30, "거실 와이드 · 무릎 높이 로우앵글 — 담요 위장을 쓰고 바닥에 엎드린 저격 자세, 눈을 가늘게 하고 마우스 두 번 딸깍",
     "S14.jpg", None, ["JUNHO", "CLOAK"],
     "In the bright living room, Junho lies flat on his stomach on the floor like a sniper in position, propped on his elbows under the "
     "blanket cloak, one hand on a mouse on the floor, his face turned toward the operation desk on the right of the frame. He stays "
     "perfectly still and focused; at about 0.6 s his eyes narrow and his index finger clicks the mouse twice, quick and sharp; deadpan, "
     "lips closed. The rest of the room stays calm and empty.",
     "a low camera about 40 cm above the floor, level — the frame stays exactly where it is from the first frame to the last; the room "
     "never shifts; no push-in, no zoom, no drift, no shake; only he moves.",
     False, 0),
    ("15", "15", 0.67, "달력 접사 — 26일 칸 안쪽 오른쪽 위에서 둘째 획을 그어 X 마무리(D-1)",
     "S15.jpg", None, ["HAND", "CALENDAR"],
     "Close-up of the wall calendar. A man's hand, his forearm reaching in from the lower left, holds an uncapped red marker whose tip rests "
     "at the upper-right corner of the box for the 26th. Starting just inside that corner, he draws one diagonal of an X down to the box's "
     "lower-left corner in one quick stroke (by about 0.3 s), lifts the tip, and slashes the other diagonal from the box's upper-left corner "
     "down to its lower-right corner (by about 0.6 s), so the 26th is crossed out like the days before it; then the marker lifts off the "
     "paper. Nothing else on the calendar changes — the 27th keeps only its red '00:00'.",
     CAL_STILL, False, 0),
    ("16", "16", 1.67, "작전 책상 미디엄 — 탁상시계를 빈 받침에 「탁」 내려놓아 트로피 셋을 채우고 고개를 듦",
     "S16.jpg", None, ["JUNHO", "DESK"],
     "Behind the operation desk, Junho bends over it holding an old-fashioned twin-bell alarm clock in both hands just above the empty "
     "wooden stand at the front. His eyes drop from the lens to the clock, and with a slow, precise, ceremonial gesture he lowers it the "
     "last few centimetres and sets it down on the stand at about 0.9 s — one small firm tap — completing the row; he lets go, and from "
     "about 1.1 to 1.5 s straightens up and lifts his eyes back to the lens, deadpan, lips closed, holding that look to the end.",
     still("the room"), False, 0),
    ("17", "17", 2.26, "링 라이트 원 안 — 양손에 휴대폰을 든 채 팔을 옆으로 쭉 벌린 「완성된 저격수」, 앞으로 로봇 청소기",
     "S17.jpg", None, ["JUNHO", "RING", "ROBOT"],
     "Inside the glowing ring light, Junho stands tall in the middle of the living room with a smartphone in each hand, arms hanging at his "
     "sides. From the very first frame the round white robot vacuum at the lower right rolls across the floor in front of him from right "
     "to left, clearing the frame by about 1.0 s; he waits for it, motionless. Then, from about 1.0 s, he slowly raises both arms straight "
     "out to the sides, the phones in his hands, until they are level with his shoulders at about 1.5 s — a finished warrior — and holds "
     "that pose, perfectly still and deadpan, to the end.",
     "the frame stays exactly where it is until about 1.5 s; then the camera eases back a little (about 1%) and lowers slightly until "
     "about 2.2 s, then holds; smooth, no zoom, no shake.",
     False, 0),
    ("18", "18", 0.87, "달력 접사 — 27일 칸 손글씨 「00:00」 둘레에 빨간 동그라미 둘째 바퀴(D-DAY, 인쇄된 27은 밖)",
     "S18.jpg", None, ["HAND", "CALENDAR"],
     "Close-up of the wall calendar on the box for the 27th. A man's hand, his forearm reaching in from the lower left, holds an uncapped "
     "red marker whose tip rests on the red circle already drawn around the handwritten '00:00'. From about 0.1 to 0.8 s he goes around "
     "once more in one smooth motion — a second red loop just outside the first — and closes it; the printed 27 stays outside the circle. "
     "Nothing else on the calendar changes.",
     CAL_STILL, False, 0),
    ("19", "19", 4.94, "00:00 캄캄한 거실 — 화면 셋 번쩍 · 알람 셋이 우는 책상 앞을 바닥 높이로 왼쪽으로 지나 0.9초에 담요 속 잠든 준호에 닿아 멈추고 끝까지 "
     "거의 그 자리 · 숨 셋(시작 S19a · 끝 S19b, 알림 · 끝 카드는 합성) — 19a · 19b와 같은 묶음",
     "S19a.jpg", "S19b.jpg", ["NIGHTDESK", "SLEEPER_END"],
     "Midnight in the dark living room, all lights off. From the first frame the screens on the operation desk flash bright blue-white and, "
     "at the right end of the desk, the two phones on their stands and the twin-bell alarm clock ring at once — the clock's bells rattle "
     "and the phones buzz and jitter on their stands. Nobody is visible in the first frame; as the camera arrives, Junho is revealed asleep on the "
     "floor under the grey fleece blanket, exactly as in @이미지 2. He sleeps straight through it all — eyes closed, mouth slightly open; "
     "at about 1.5 s, 2.6 s and 3.8 s one slow, deep breath lifts his chest and the blanket and lets them sink, his lips parting a little "
     "more each time; otherwise he never wakes or moves. At about 1.4 s the alarms stop and the clock and the phones go "
     "still; the screens keep glowing.",
     "a low tracking move just above the floor: from the very first frame the camera glides fast to the left along the floor toward the "
     "crumpled blanket at the far left, where Junho lies asleep, and moves in close to him — the glowing desk grows and rises toward the "
     "top of the frame — and by about 0.9 s the move is over: the camera has stopped beside him, already at the framing of @이미지 2 except "
     "a hair wider. For the whole rest of the clip the frame is practically still — it only creeps in that last hair, very slowly and "
     "smoothly, so that the last frame is exactly @이미지 2. One continuous camera move — no cut, no dissolve, no shake.",
     False, 0),
    # 19a · 19b는 주판 — 19와 같은 묶음에서 굽고 고른다(11-01 Fable P1: S19a 담요 자리와 S19b 준호 자리가 한 번의 옆 이동으로 이어지지 않아
    #   끝 그림 판이 녹임 · 고른 이동으로 나올 수 있다). 받은 19가 셋을 못 넘으면 19a(0.83초) + 19b(4.11초)를 27.0초 하드 컷(스매시 컷).
    ("19a", "19", 0.83, "19와 같이 낸다 — 받은 19가 ① 1.2초 안 도착 ② 담요 → 준호 녹임 없음 ③ 끝 프레임 = S19b를 못 넘으면 19a + 19b를 27.0초 하드 컷"
     "(이 판은 앞 0.83초 — 끝 그림 없이 화면 · 알람이 우는 밤 거실을 바닥 높이로 왼쪽으로 지남)",
     "S19a.jpg", None, ["NIGHTDESK"],
     "Midnight in the dark living room, all lights off. From the first frame the screens on the operation desk flash bright blue-white and, "
     "at the right end of the desk, the two phones on their stands and the twin-bell alarm clock ring at once — the clock's bells rattle "
     "and the phones buzz and jitter on their stands. The crumpled grey blanket lies still on the floor at the far left; nobody comes into "
     "view.",
     "a low tracking move just above the floor: from the very first frame the camera glides fast to the left along the floor — the desk and "
     "its glowing screens slide to the right, about a quarter of the frame width by 0.9 s — then it eases to a stop by about 1.5 s and "
     "holds; smooth, no shake.",
     False, 0),
    ("19b", "19", 4.11, "19와 같이 낸다 — 받은 19가 ① 1.2초 안 도착 ② 담요 → 준호 녹임 없음 ③ 끝 프레임 = S19b를 못 넘으면 19a + 19b를 27.0초 하드 컷"
     "(이 판은 뒤 4.11초 — 잠든 준호 S19b에서 시작, 알람이 0.6초에 뚝 그치고 숨 셋, 끝까지 아주 느리게 다가감)",
     "S19b.jpg", None, ["SLEEPER", "NIGHTDESK"],
     "Midnight, low on the floor in front of the operation desk: Junho lies asleep under the blanket. At first the twin-bell alarm clock "
     "and the phones on the desk above him are still ringing — the clock's bells rattle and the phones jitter; at about 0.6 s they all stop "
     "and go still; the screens keep glowing. He sleeps straight through it — eyes closed, mouth slightly open; at about 0.7 s, 1.8 s and "
     "3.0 s one slow, deep breath lifts his chest and the blanket and lets them sink, his lips parting a little more each time; otherwise "
     "he never wakes and never moves his hands.",
     "a very slow, smooth creep-in toward his face from the first frame to the last — about 3% closer by the end; no zoom, no shake.",
     False, 0),
]


def build():
    판 = []
    for tail, cut, use, desc, img, end, who, act, cam, alt, lead in CUTS:
        shot = {"그림": img, "쓰는초": use, "누구": who, "동작": act, "카메라": cam}
        if end:
            shot["끝그림"] = end
        p = {"id": f"s4-{tail}", "컷": [cut], "길이": max(4, math.ceil(use + lead + 0.8)), "설명": desc, "샷": [shot]}
        if alt:
            p["대안"] = True
        if p["id"] == "s4-19":   # 첫 줄의 끝 그림 문장을 「일찍 닿고 버팀」으로(11-01 Fable P1 다시 확인 · 웹꾸러미 여섯 편 「끝그림말」 칸)
            p["끝그림말"] = ("@이미지 2 is the exact last frame: the video ends on exactly that framing — the camera reaches it early "
                          "(see CAMERA) and then holds.")
        assert p["길이"] <= 8, p["id"]
        판.append(p)
    spec = {
        "메모": "시즌 4 · 블프 스나이퍼 「블프 스나이퍼」 30초 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31). 생성기 ../시댄스지시문.py(머리말에 규칙). "
                "시작 그림은 확정 이미지 콘티(정지컷/_고른판.json의 받음/ 판)를 이름만 바꿔 모은 git 밖 콘티/bf-sniper/시댄스/. 카메라는 01 8절 · 02 2절 카메라 칸 "
                "숫자 그대로, 고정은 원본이 정말 고정인 열 컷에만(긍정 문구). 3번은 S03으로 시작해 앞 0.6초를 버림, 19번은 시작 S19a · 끝 S19b이고 19a · 19b도 주판(같은 묶음에서 굽고 고름). 11-01 Fable 검수 반영. "
                "두 샷 묶음 없음. 영상은 소리 끔 — 속삭임 · 가게 목소리 · 화면 글 · 로고는 후반. 꾸러미는 ../../../시댄스무제한/웹꾸러미.py.",
        "편": "s4",
        "이름": "시즌 4 블프 스나이퍼 「블프 스나이퍼」",
        "비율": "16:9",
        "그림": IMG,
        "공통": 공통,
        "판": 판,
    }
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    main = [p for p in 판 if not p.get("대안")]
    print(f"{out.name}: 판 {len(판)}(주판 {len(main)} · 대안 {len(판) - len(main)}) · 주판 길이 합 {sum(p['길이'] for p in main)}초 · "
          f"쓰는 초 합 {sum(s['쓰는초'] for p in main for s in p['샷']):.2f}")


if __name__ == "__main__":
    build()
