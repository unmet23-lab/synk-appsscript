# 6번 「연말 빈방」(솜채) — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31).
#   python -X utf8 시댄스지시문.py      → 지시문/영상_시댄스웹.json(굽기 시트의 웹꾸러미.py가 읽는 꼴 — 11번 · 옆집과 같음)
# 그림은 이미지콘티_고르기.py가 만든 git 밖 콘티/p6/컷/S##.jpg(1920×1080 — 정지컷/의 받은 판을 16:9로 자르고, 21은 원본 크기로 맞춰 자른 판,
#   10-27 Omni 첫 시험이 올린 판과 같음). 정지컷/S##.jpg는 자르기 전 받은 판이라 쓰지 않는다(21 구도가 다르다).
# 동작은 02_콘티 2절 「화면」 한 가지 + 원본 프레임에서 잰 사건 시각(1 문 엶 1.8 · 닫힘 4.2, 7 일어나 앉음 1.2, 11 문 닫힘 2.4~3.4,
#   14 상자 내려놓음 1.9, 22 앉음 0.6 · 고개 듦 7.3), 카메라는 02_콘티 7-1절(원본 실측 — 01 2-1절) 숫자 그대로 — 1~18 · 22는 원본이
#   정말 고정이라 「화면이 처음부터 끝까지 그 자리」 긍정 문구(장비 이름 뺌), 19 다가감 · 20 옆 이동 · 21 기욺 → 팬.
#   21의 끝 1.3초 위로 0.8% 되돌림은 720p에서 안 보이고 지시만 복잡해져 뺐다(굽기 시트 10-31 「작은 숫자 조심」).
#   요즘 기법으로 바꾼 컷은 없다 — 같은 자리 고정 와이드가 세월을 보여 주는 이 원본의 뼈대다(10-29 옆집 조사: 크리스마스 · 가족 광고 호평은
#   실제 빛 · 절제한 카메라 쪽).
# 초는 그 컷 첫 프레임 기준(원본 초 − 컷 시작). 길이 = min(8, max(4, ⌈쓰는 초 + 0.8⌉)) — 시댄스가 0.7초쯤 늦게 온다(대사는 0.4~1.4초).
#   11-01 Fable 검수(P1 셋 반영): 7은 시작 그림의 벌린 입을 「막 끝난 외침」으로 닫게 하고 8초, 11은 0초부터 말이라 늦음에 문 닫힘이 밀려 6초.
# 22는 8.31초라 상한 8을 넘는다 — 웹 카드의 길이 상한을 아직 몰라 Fable B 길: 8초 판 그대로, 앉기는 0.5초 안, 고개 듦은 판 6.0초
#   (늦음 0.7이면 6.7초, 1.4여도 7.4초라 판 안). 편집은 판 0초 = 51.68초 — 고개 듦이 58.4초 안팎(도어락 57.99 뒤 · 「엄마!」 58.85 앞)이고
#   판이 59.68초에 끝나 마지막 0.31초는 고개 든 끝 장을 잇는다. 카드 상한이 10초 이상이면 아래 CARD_MAX를 10으로 — Fable A 길(길이 10 ·
#   고개 듦 6.6초, 편집은 판 0초 = 51.68 · 8.31초에서 자름, 이음 없음)로 바뀐다. 고개 듦이 늦어 판 밖이면 받은 끝 장에서 22b(앉은 엄마 ·
#   1.0초에 고개 듦 · 4초)를 바로 낸다.
# 두 샷 묶음 없음 — 붙은 그림 컷이 모두 해가 바뀌거나(1~16) 빛 · 카메라 자리가 바뀐다(18 ↔ 19 시작 그림 빛이 다르다).
# 소리: 입이 보이는 대사 둘(7 엄마 외침 · 11 딸)만 매진 · 7번 길(10-29 결정 — 배역 목소리 판 → 견본 → B 판)로 소리 켬. 맨 위 「목소리판」
#   두 줄(엄마 · 딸)을 웹꾸러미.py six_casting()이 맨 앞 7초 판으로 만들고, 받은 판에서 뗀 견본이 7 · 11 판의 3_목소리견본.mp3가 된다
#   (VOICE 줄은 prompt()가 붙임). 11의 엄마 대답 「이불만 갈았어, 이불만!」은 그 판 견본이 딸 것이라 소리 내지 않는다(뒷모습 · 후반).
#   나머지 판은 소리 끔 — 화면 밖 · 입이 안 보이는 말(2 · 4 · 11 엄마 · 12 · 14 · 21 속말 · 22 「엄마!」)과 끝 문구 · 브랜드 이름은 후반.
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6/컷"
# 딸 목소리 판만 쓰는 그림 — 컷/S11.jpg의 문간을 16:9로 잘라(가로 30~80% · 세로 10~60%) 2배로 키운 판(11-01 Fable P2 선택, 제작 컷이 아님).
#   딸 얼굴이 두 배라 말하는 사람이 분명해진다. 원본 컷/S11.jpg는 그대로이고 11 판은 그 그림을 쓴다.
CAST_DAUGHTER_IMG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6/시댄스/S11_딸목소리판.jpg"
CARD_MAX = 8   # 무제한 카드의 한 판 길이 상한 — 10 이상으로 확인되면 10으로 바꾸고 다시 돌린다(22가 Fable A 길로)

공통 = {
    "장르": "a quiet, tender Korean family brand film, shot like a cinematic short film",
    "누구": {
        "DAUGHTER17": "the same teenage girl as in the first frame, seen only from behind — long straight black hair down her back, a navy "
                      "school blazer, a grey plaid pleated skirt, white socks, a mustard-yellow backpack on her shoulders. Her face is never "
                      "seen: she never turns toward the camera.",
        "DAUGHTER24": "the young woman standing in the doorway, exactly as in the first frame — early twenties, black hair tied low at the "
                      "nape, a white blouse and black slacks; small in the frame, seen from across the living room.",
        "DAUGHTER24_CAST": "the young woman standing in the doorway, exactly as in the first frame — early twenties, black hair tied low "
                           "at the nape, a white blouse and black slacks.",
        "MOM_STRIPE": "the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a navy-and-white "
                      "striped long-sleeve top and loose grey wide-leg trousers. She is seen from behind and the side.",
        "MOM_SUMMER": "the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a white "
                      "sleeveless linen top and khaki shorts, barefoot. She is small in the wide frame.",
        "MOM_VEST": "the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a mustard knit "
                    "vest over a white shirt, cream trousers. She is small in the wide frame and mostly turned away from the camera.",
        "MOM_NIGHT": "the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a dark burgundy "
                     "cardigan — sitting almost in silhouette in the dark; her face stays in deep shadow.",
        "MOM_SAGE": "the same Korean woman in her forties as in the first frame, seen from behind — dark-brown, wavy, shoulder-length hair, "
                    "a sage-green blouse, black trousers, barefoot, a white medical brace on her left lower leg. Only the back of her head "
                    "is seen.",
        "MOM_PLUM": "the same Korean woman in her forties as in the first frame, seen from behind — dark-brown, wavy, shoulder-length hair, "
                    "a dark plum cardigan over a long dark skirt — almost a silhouette in the dark.",
        "MOM50": "the same Korean woman as in the first frame, now in her mid-fifties — a sleek chin-length dark bob with a few grey "
                 "strands, a pearl stud earring, an oat-beige knit cardigan over a light-blue shirt, a long taupe skirt.",
        "VACUUM": "the canister vacuum cleaner of the first frame — its body on the floor beside her, the hose and the long wand in her hands.",
        "POSTER": "the picture-only band poster taped on the door, exactly as in the first frame — no letters.",
        "GIFT": "a white gift box tied with a red ribbon bow, held against her chest.",
        "ROOM": "the daughter's tidy bedroom, exactly as in the first frame — a light-oak desk and chair, two white storage boxes, a round "
                "tabletop mirror on a small round side table, a light-oak single bed, a small pressed-flower frame on the wall, a window "
                "with a thin curtain.",
        "BLANKET": "the new winter blanket on the single bed, exactly as in the first frame — a warm oatmeal-cream quilt with small diamond "
                   "stitching and thin terracotta piping, its top folded back to show the brick-red underside, with a matching pillow; no "
                   "letters, no logo, no label.",
    },
    "보기": "LOOK: a quiet, tender cinematic family film — cinema camera, soft natural light, fine film grain, natural textures, "
            "true-to-life colors. Each shot keeps its first frame's light — direction, color, white balance, exposure and darkness — "
            "exactly to the very end: no brightening, no flicker; night stays night. No new text, letters, numbers, logos or signs "
            "anywhere; any poster, photo frame or book keeps exactly the picture it has in the first frame. Never add a person or an "
            "animal who is not in the first frame, and nobody looks straight into the lens. Every object keeps exactly the shape, size "
            "and place it has in the first frame unless the ACTION moves it.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}

FIX = ("the frame stays exactly where it is from the first frame to the last — the door, the walls and the furniture never shift; "
       "no push-in, no zoom, no pan, no drift, no shake; only the people move.")
FIX_EMPTY = ("the frame stays exactly where it is from the first frame to the last — the door, the walls and the furniture never shift; "
             "no push-in, no zoom, no pan, no drift, no shake.")
FIX_GAP = ("the frame stays exactly where it is from the first frame to the last — the hallway walls, the door frame and the half-open "
           "door never shift; no push-in, no zoom, no pan, no drift, no shake; only she moves.")
LINE = "The thin line of light under the door stays lit and still."

# n: (쓰는 초, 설명, 누구, 동작, 카메라)
CUT = {
    1: (4.77, "아침 거실 고정 와이드 — 교복 딸(뒷모습)이 문으로 걸어가 1.8초에 문을 열고 들어가 4.2초에 닫음",
        ["DAUGHTER17"],
        "The schoolgirl walks straight away from the camera toward the closed bedroom door in the middle of the far wall, getting "
        "smaller as she goes. At about 1.8 s she reaches the door, turns the round brass knob and pushes the door open into her room; at "
        "about 2.4 s she steps through the doorway, and from about 3.4 s she pulls the door shut behind her from inside — it closes "
        "completely at about 4.2 s. Then the living room stays empty and still, the door shut, with nothing written on it. She never "
        "turns around.",
        FIX),
    3: (2.37, "아침 고정 와이드 — 엄마(40대 · 줄무늬)가 닫힌 문 앞 청소기, 1.2초에 왼쪽으로 한 걸음",
        ["MOM_STRIPE", "VACUUM", "POSTER"],
        "The mother vacuums the floor right in front of the closed door: in two or three slow, even strokes she pushes the wand forward "
        "and pulls it back along the foot of the door, taking a small step to her left at about 1.2 s; the canister rolls a little after "
        "her. The poster on the door does not move.",
        FIX),
    4: (5.54, "저녁 빈 거실 고정 와이드 — 호박빛 · 켜진 스탠드, 아무도 없음(엄마 · 딸 말은 화면 밖)",
        ["POSTER"],
        "The living room stays empty for the whole shot — nobody enters or appears at any moment. The long evening sunbeam from the right "
        "and the glow of the lit table lamp stay exactly as they are; only a few faint specks of dust drift slowly through the sunbeam. "
        "The closed door with its poster stays shut.",
        FIX_EMPTY),
    7: (5.17, "여름 고정 와이드 — 대자리에 앉은 엄마가 1.2초에 몸을 일으켜 문에 대고 두 번 소리침 · 엄마 목소리 B(시댄스가 연기, 1.4 · 3.6초)",
        ["MOM_SUMMER"],
        "In the first frame the mother sits on the bamboo mat to the right of the closed door, propped back on one hand, her head turned "
        "toward the door, her mouth still open from a call she has just finished. She closes her mouth at once and waits in silence, "
        "listening for an answer that does not come — she makes no sound before 1.4 s. By about 1.2 s she pushes herself upright and "
        "leans toward the door on both hands, facing the door, and she shouts at it in Korean — from about 1.4 s to 3.6 s: "
        "\"문 잠그고 뭐 해, 또 자?\" — then, sharper, from about 3.6 s: \"수능이 코앞이야!\" — her lips "
        "clearly forming the Korean words and her shoulders jerking forward with each call. After the second line she stays leaning "
        "toward the door, catching her breath, and says nothing more. The standing fan's blades keep spinning; the door stays shut.",
        FIX),
    11: (4.17, "흐린 낮 고정 와이드 — 문간의 딸이 엄마에게 쏘아붙이고(딸 목소리 B, 0.0~2.4초) 들어가 문을 닫음(3.4초), 엄마는 소리 없이 문 쪽으로"
               "(엄마 대답은 후반)",
         ["MOM_VEST", "DAUGHTER24"],
         "The bedroom door stands open. In the doorway the daughter faces her mother and, from the very start to about 2.4 s, snaps at "
         "her in Korean with one sharp gesture of her hand: \"내일 면접인데, 들어오지 말랬잖아!\" — her lips clearly forming the Korean "
         "words. Then she steps back into her room and swings the door shut — it is fully closed by about 3.4 s, and the dry-cleaning bag "
         "hooked over the top of the door swings in with it. The mother stays standing just left of the door, mostly turned away from the "
         "camera, and makes no sound: from about 2.4 s, as the door swings shut in front of her, she only turns to face it and lifts one "
         "hand a little, helpless, her lips closed, and keeps standing there after it has closed.",
         FIX),
    12: (3.64, "밤 고정 와이드 — 피아노 의자의 엄마가 1.4초에 문 쪽으로 기울어 말을 건넴(얼굴은 그늘), 문 밑 불빛",
         ["MOM_NIGHT"],
         "Night: the dark living room is lit only by the table lamp, and a thin line of warm light glows under the closed bedroom door — "
         "the daughter is inside. The mother sits still on the piano bench at the left, turned toward the door, hands in her lap. At about "
         "1.4 s she leans a little toward the door, as if saying something gentle to her daughter through it, and stays leaning to the "
         "end; her face stays in deep shadow the whole time. " + LINE,
         FIX),
    14: (2.60, "밝은 낮 고정 와이드(낮은 장) — 보조기 엄마가 선물 상자를 안고 절뚝이며 문으로, 1.9초에 문 앞에 내려놓음(원본 53.2초 그대로)",
         ["MOM_SAGE", "GIFT"],
         "Holding the gift box against her chest with both hands, the mother limps the last steps to the closed door, favoring her left "
         "leg in the white brace. At about 1.9 s she bends forward and sets the box down on the floor at the foot of the door, and she is "
         "still bent over it at the end. Her face is never seen.",
         FIX),
    16: (3.50, "깊은 밤 고정 와이드 — 문 앞에 가만히 선 엄마(뒷모습), 노크하지 않음 · 문 밑 불빛",
         ["MOM_PLUM"],
         "Night: violet darkness, and a thin line of warm light glows under the closed bedroom door — the daughter is inside. The mother "
         "stands right in front of the door with her back to the camera, arms hanging at her sides; she does not knock and does not touch "
         "the door. She stays almost perfectly still — only one slow breath lifts and lowers her shoulders at about 1.5 s. " + LINE,
         FIX),
    18: (3.10, "마지막 거실 고정 와이드 — 50대 엄마가 닫힌 문 앞 청소기(뒷모습), 포인세티아",
         ["MOM50", "VACUUM"],
         "In the final living room the mother vacuums the floor in front of the closed bedroom door with her back to the camera: two "
         "slow, even strokes forward and back with the wand while the canister stays beside her. Her face stays turned away. The red "
         "poinsettia, the photographs and the tall rubber plant stay exactly as they are.",
         FIX),
    19: (3.00, "문 앞 엄마 뒷모습 미디엄 — 카메라가 몸째 다가감(3초 약 5~8%), 0.4초에 손잡이를 돌려 문을 천천히 엶",
         ["MOM50"],
         "The mother stands with her back to the camera at the closed bedroom door, her right hand on the round brass knob. At about 0.4 s "
         "she turns the knob and slowly pushes the door open into the room — it swings away from her hand, so the gap opens at the right "
         "edge of the door, beside her hand — leaning her head and shoulders toward the widening gap; by about 3.0 s it stands open about "
         "a forearm's length, a quarter open, and a strip of the room's pale daylight shows in the gap. Her face stays turned away from "
         "the camera — at most the edge of her cheek shows.",
         "the camera physically moves forward toward her back at one steady speed from the very first frame to the last — the far wall "
         "and the door ahead grow by about 5% and the nearer door frame by about 6–8% over the first 3 seconds, heading toward a point "
         "slightly left of and below the frame center (44% across, 64% down), and it keeps that same steady forward speed to the end. "
         "Perfectly smooth, no shake, no pan, no tilt, no zoom; focus stays on her."),
    20: (2.17, "빈방 — 카메라 오른쪽 옆 이동(초당 약 4%, 앞 책상이 더 빨리 지나감), 새 겨울 이불 · 창밖 눈",
         ["ROOM", "BLANKET"],
         "The daughter's empty bedroom, exactly as in the first frame. Nobody is in the room and nothing in it moves — only the snow "
         "keeps falling softly outside the window.",
         "the camera glides sideways to the right at one steady speed from the very first frame to the last, like a slider — the room "
         "slides to the left by about 8% of the frame width over the first 2.2 seconds (about 4% per second) and keeps sliding at that "
         "same speed to the end; the desk and chair in the foreground pass slightly faster than the bed and the window behind them. "
         "Perfectly smooth, no pan, no tilt, no zoom; everything in the room stays sharp."),
    21: (5.44, "엄마 옆얼굴 클로즈업(왼 어깨 뒤) — 아래로 기욺(2.5초에 4%) → 2.1초부터 오른쪽 팬(5.4초에 4.4%), 입 다묾(속말은 후반)",
         ["MOM50", "BLANKET"],
         "A close-up of the mother from just behind her left shoulder; she looks down to the left, into her daughter's empty room. Over "
         "the whole shot her head turns very slowly, only a few degrees, to her left — toward the camera side, never toward the lens — as "
         "her eyes travel across the empty room, so that by the last frame a little more of her face shows, three-quarters from behind. "
         "Slow breathing, one slow blink at about 2.5 s, her eyes a little moist with a faint wistful softening — no tears running, no "
         "smile. Her lips stay closed the whole time; she never speaks.",
         "smooth and slow, never shaky, no zoom. From the first frame it tilts down a little, following her lowered gaze — the picture "
         "moves up by about 4% of the frame height by 2.5 s, slowing to a stop. From about 2.1 s to the very last frame it pans slowly to "
         "the right — the picture slides left by about 4.4% of the frame width by 5.4 s, so her face drifts a little toward the left edge "
         "— easing in, then keeping a steady pace until the last frame. Shallow depth of field: focus stays on her hair and face; the room "
         "behind her stays softly blurred the whole time."),
    22: (8.31, ("문틈 너머 고정 — 0.5초 안에 앉아 2초 이불 · 4초 거울 쪽을 둘러보다 6.6초에 문 · 복도 쪽으로 고개 듦(렌즈는 안 봄) · "
                "Fable A(카드 상한 10초 이상) — 편집: 판 0초 = 51.68초, 판 8.31초에서 자름(이음 없음)")
         if CARD_MAX >= 10 else
         ("문틈 너머 고정 — 0.5초 안에 앉아 2초 이불 · 4초 거울 쪽을 둘러보다 6.0초에 문 · 복도 쪽으로 고개 듦(렌즈는 안 봄) · 8.31초 컷을 "
          "8초 판에(Fable B — 편집: 판 0초 = 51.68초, 고개 듦 58.4초 안팎, 끝 0.31초는 끝 장 이음). 카드 상한이 10초 이상이면 길이 10 · "
          "고개 듦 6.6초로 바꿔 꾸러미를 다시 만든다(Fable A — 편집은 판 0 = 51.68초, 8.31에서 자름) — 생성기 CARD_MAX. 고개 듦이 늦어 판 "
          "밖이면 받은 끝 장으로 22b(앉은 엄마 · 1.0초에 고개 듦 · 4초)"),
         ["MOM50", "BLANKET"],
         "Seen from the hallway through the narrow gap of the half-open bedroom door, the mother, bent forward at the edge of the bed, "
         "finishes sitting down within the first 0.5 s. Then she rests one hand on her knee and the other on the new blanket and quietly "
         "looks around the room — by about 2 s she is looking down at the blanket, by about 4 s over toward the mirror and the desk — her "
         f"hair half over her face. At about {6.6 if CARD_MAX >= 10 else 6.0:.1f} s she slowly lifts her head and turns her face toward the "
         "open door and the hallway beyond it, as if she just heard the front door open — her eyes on the hallway, never on the camera — "
         "and holds that look, lips closed, without moving, to the last frame. She stays small in the door gap.",
         FIX_GAP),
}


# 배역 목소리 판(매진 HS_CASTING · 7번 P7_CASTING과 같은 길) — 웹꾸러미.py six_casting()이 맨 앞 7초 · 소리 켬 판 p6-목소리-<배역>으로 짠다:
#   ACTION: {동작} "{글}" {입} + 「다른 사람은 입 다묾」 · 고정 CAMERA · 공통 LOOK · SOUND: only {소리} … 견본 없이 일상 문장 한 줄(대본에 없는 말)을
#   말하게 해 시댄스가 처음 낸 목소리를 그 배역 목소리로 삼는다. 엄마는 7 그림이 소리치는 입이라 먼저 입을 닫고 가라앉힌 뒤 말하게 하고(매진 목소리 판처럼),
#   딸은 11 그림(문간 3/4 얼굴) — 「누구」에 엄마 KEY를 넣지 않는다(사람을 더할 위험, 엄마는 그림에 있어 「anyone else keeps still」로 충분).
목소리판 = [
    {"배역": "엄마", "컷": "7", "그림": "S07.jpg", "누구": ["MOM_SUMMER"],
     "동작": "The mother, sitting on the bamboo mat to the right of the closed door with her mouth open, closes her mouth and settles down "
             "in silence, sitting comfortably; then, still turned toward the door, she says in Korean, in her own natural everyday "
             "speaking voice — relaxed and conversational, as if chatting with her daughter through the door; not shouting, not crying, "
             "not whispering, not announcing:",
     "글": "냉장고에 수박 썰어 놨어. 공부하다 출출하면 나와서 먹어.",
     "입": "Her lips clearly form the Korean words.", "소리": "her own natural speaking voice"},
    # 그림은 컷/S11.jpg의 문간 2배 판(위 CAST_DAUGHTER_IMG — 절대 경로면 six_casting이 그 파일을 쓴다), 「누구」는 「작게 · 멀리」를 뺀 딸 줄.
    #   글은 15음절 한 줄(11-01 Fable P2 — 손 내림 · 늦음까지 7초 판에 여유).
    {"배역": "딸", "컷": "11", "그림": CAST_DAUGHTER_IMG, "누구": ["DAUGHTER24_CAST"],
     "동작": "The daughter in the doorway lowers her hand and, still facing her mother, says in Korean, in her own natural everyday "
             "speaking voice — relaxed and conversational, as if chatting with her mother; not shouting, not crying, not whispering, "
             "not announcing:",
     "글": "역 앞에 새로 생긴 국숫집, 생각보다 맛있더라.",
     "입": "Her lips clearly form the Korean words.", "소리": "her own natural speaking voice"},
]
# 대사(B) 판 — 그 배역 목소리 판에서 뗀 견본(3_목소리견본.mp3)의 결로 시댄스가 지시문의 한국어를 연기한다. 대사는 지시보다 0.4~1.4초 늦게 와
#   (현장 노트 higgsfield) 7은 둘째 줄(3.6초~) 뒤 숨 고르는 꼬리까지 8초, 11은 0초부터 말이라 문 닫힘(3.4) · 엄마 돌아섬이 판 안에 들게 6초
#   (11-01 Fable P1 · P2 — 무제한이라 길이에 값이 들지 않는다). SOUND는 매진 B처럼 목소리 + 방 공기만 — 선풍기 · 매미는 후반 녹음 모음.
B = {
    7: {"소리": "켬", "목소리견본": "p6-목소리-엄마", "길이": 8,
        "소리줄": {"켬": "SOUND: only her voice shouting these two Korean lines at the door, over quiet room tone — no fan noise, no "
                         "insects, no music, no narration, no other voices, no sound effects."}},
    11: {"소리": "켬", "목소리견본": "p6-목소리-딸", "길이": 6,
         "소리줄": {"켬": "SOUND: only the daughter's voice snapping this one Korean line, then the soft thud of the door shutting and the "
                          "rustle of the dry-cleaning bag, over quiet room tone — no music, no narration, no other voices; the mother "
                          "makes no sound."}},
}


def length(used):
    return min(CARD_MAX, max(4, math.ceil(used + 0.8)))


def build():
    판 = []
    for n, (used, note, who, act, cam) in CUT.items():
        p = {"id": f"p6-{n:02d}", "컷": [str(n)], "길이": length(used), "설명": note,
             "샷": [{"그림": f"S{n:02d}.jpg", "쓰는초": used, "누구": who, "동작": act, "카메라": cam}]}
        p.update(B.get(n, {}))
        판.append(p)
    return {
        "메모": "6번 연말 빈방 「솜채」 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31). 시작 그림은 확정 이미지 콘티를 16:9 · 1920×1080으로 "
                "자른 git 밖 콘티/p6/컷(21은 원본 크기로 맞춰 자른 판 — 정지컷/은 자르기 전이라 쓰지 않음). 동작은 02_콘티 2절 한 가지와 원본 "
                "프레임에서 잰 사건 시각, 카메라는 02_콘티 7-1절(원본 실측) 숫자 그대로 — 1~18 · 22 고정(긍정 문구), 19 다가감 · 20 옆 이동 · "
                "21 기욺 → 팬. 두 샷 묶음 없음(붙은 컷마다 해 · 빛 · 카메라 자리가 바뀜). 22는 8.31초라 사건을 8초 판 안으로 당겨 씀(생성기 머리 "
                "주석). 입이 보이는 대사 둘(7 엄마 · 11 딸)은 「목소리판」 두 줄 → 견본 → B 판(소리 켬, 10-29 결정), 나머지 말 · 속말 · 끝 "
                "문구 · 브랜드 이름은 후반이라 소리 끔. 생성기는 ../시댄스지시문.py, 꾸러미는 ../../../시댄스무제한/웹꾸러미.py.",
        "편": "p6",
        "이름": "6번 연말 빈방 「솜채」",
        "비율": "16:9",
        "그림": IMG,
        "공통": 공통,
        "목소리판": 목소리판,
        "판": 판,
    }


if __name__ == "__main__":
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.write_text(json.dumps(build(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    spec = build()
    print(f"{out} — 판 {len(spec['판'])}개 · 길이 합 {sum(p['길이'] for p in spec['판'])}초")
