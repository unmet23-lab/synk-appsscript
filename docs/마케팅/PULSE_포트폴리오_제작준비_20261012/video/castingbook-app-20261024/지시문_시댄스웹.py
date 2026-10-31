# 8번 앱 소개 30초(캐스팅북) — 시댄스 2.5 무제한 날 웹 판 지시문(2026-10-31).
#   python -X utf8 지시문_시댄스웹.py           → 지시문/영상_시댄스웹.json(굽기 시트 웹꾸러미.py가 읽는 꼴 — 11번과 같음) · 시작 그림 폴더(없는 것만)
#   python -X utf8 지시문_시댄스웹.py --그림     → 시작 그림 폴더를 처음부터 다시 모음
# 시작 그림: 확정 판이 git 밖 정지컷/(고른 판) · 컷/(초록 대역에 하린 사진 · 녹화를 붙인 합성판) · 받음/(한 판뿐인 컷)에 흩어져 있어 시댄스/에 모은다.
#   원본 파일은 옮기거나 덮지 않는다. 2752×1536 판은 합성기(이미지콘티_합성.py)와 같은 cv2 INTER_AREA로 1920×1080에 맞춘다(합성판 · 가편집과 같은 틀).
#   · 폰 화면 컷(3 · 6 · 10 · 12 · 15 · 17)은 초록 화면 그대로 — 캐스팅북 녹화는 후반에서 입힌다(02_콘티 3절).
#   · 인쇄물 컷(2 · 5 · 8 · 11 · 13 · 19)은 하린 사진을 붙인 합성판이 주판(10-25 「장면 속 간판 로고는 정지컷에 굽기」 길) — 사진 속 얼굴이 흔들리면
#     그 컷만 초록 판(대안 「b」)을 내 후반에서 붙인다(02_콘티 4절 Fable 3차 메모). 2번은 창 너머 작은 배너라 대안 없음.
#   · 1 · 4번 거꾸로 얼굴은 확정 판(위에서 굽고 180° 돌린 판)이 주판. 얼굴이 바로 서려 하거나 일그러지면 돌리기 전 바로 선 판으로 낸 대안 「b」를
#     받아 180° 돌려 쓴다(돌림은 확정 판을 만든 것과 같은 바꿈 — 색 · 얼굴은 그대로).
# 카메라는 원본 실측(01 2-1절) — 20컷 모두 고정(8 · 9 · 16 · 18의 1% 안 움직임은 720p에서 안 보여 고정으로). 4 · 17번 다가감은 원본도 편집기
#   디지털 줌(프레임마다 같은 걸음 · 뚝 멈춤)이라 영상은 고정으로 뽑고 후반에서 원 곡선 그대로 건다 — 영상 모델은 뚝 멈추지 못하고, 17번은 녹화를
#   고정 화면에 붙인 뒤 줌을 걸어야 녹화가 맞는다(02_콘티 2-1절).
# 길이 = max(4, ⌈쓰는 초 + 0.8⌉). 두 샷 묶음은 없다 — 이어 붙은 컷이 장소 · 크기가 다르거나(얼굴 ↔ 초록 폰) 소리 켬 판이라 묶으면 위험만 커진다.
# 소리: 19번만 켬(손님 「포스터 보고 왔어요」 · 소연 웃음 — 손님 얼굴이 안 보여 입 맞춤이 없다, 02_콘티 5절 1 (가) 길 · 10-29 시댄스 목소리).
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
IMG = P8 / "시댄스"
W, H = 1920, 1080

# 시댄스/<이름> ← 원천(P8 아래). 1920×1080 합성판은 그대로 복사, 나머지는 1920×1080으로 맞춰 PNG.
SRC = {
    "C01.png": "정지컷/C01.png", "C01b_바로.png": "받음/C01e_050058.jpg",
    "C02.jpg": "컷/C02.jpg",
    "C03.png": "정지컷/C03.png",
    "C04.png": "정지컷/C04.png", "C04b_바로.png": "받음/C04s_053646.jpg",
    "C05.jpg": "컷/C05.jpg", "C05_초록.png": "받음/C05_024819.jpg",
    "C06.png": "받음/C06_020900.jpg",
    "C07.png": "정지컷/C07.png", "C07e.png": "정지컷/C07e.png",
    "C08.jpg": "컷/C08.jpg", "C08_초록.png": "받음/C08_025130.jpg",
    "C09.png": "받음/C09_032739.jpg",
    "C10.png": "정지컷/C10.png",
    "C11.jpg": "컷/C11.jpg", "C11_초록.png": "받음/C11_025511.jpg",
    "C12.png": "받음/C12_021551.jpg",
    "C13.jpg": "컷/C13.jpg", "C13_초록.png": "받음/C13_025836.jpg",
    "C14.png": "정지컷/C14.png",
    "C15.png": "정지컷/C15.png",
    "C16.png": "정지컷/C16.png",
    "C17.png": "정지컷/C17.png",
    "C18.png": "정지컷/C18.png",
    "C19.jpg": "컷/C19.jpg", "C19_초록.png": "받음/C19_033102.jpg",
    "C20.png": "정지컷/C20.png",
}


def gather(force=False):
    import shutil
    import cv2
    import numpy as np
    IMG.mkdir(parents=True, exist_ok=True)
    for name, rel in SRC.items():
        dst, src = IMG / name, P8 / rel
        if dst.exists() and not force:
            continue
        img = cv2.imdecode(np.fromfile(str(src), np.uint8), cv2.IMREAD_COLOR)
        if img.shape[1] == W and img.shape[0] == H:
            shutil.copyfile(src, dst)
            continue
        out = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)   # 이미지콘티_합성.py와 같은 바꿈
        ok, buf = cv2.imencode(".png", out)
        buf.tofile(str(dst))
    json.dump({k: v for k, v in SRC.items()}, open(IMG / "_원천.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


공통 = {
    "장르": "a cinematic live-action Korean app commercial",
    "누구": {
        "SOYEON": "the same Korean woman as in the first frame, in every frame — collarbone-length dark brown hair with softly curled ends, "
                  "a light-blue chambray shirt under a plain canvas work apron, exactly as in the first frame. She does not speak; her lips "
                  "stay closed unless this shot says otherwise.",
        "HANDS": "Soyeon's own hands and light-blue chambray shirt cuffs, exactly as in the first frame.",
        "PHONE": "her black smartphone, held exactly as in the first frame. Its screen is a flat, evenly lit chroma-green area with small "
                 "white crosses in a regular grid — it stays plain green with the same white crosses, fixed to the glass, for the whole "
                 "clip: never draw an app, a picture, text, a glow or a reflection on it, and the finger's edges stay crisp against the green.",
        "WALKER": "a passer-by seen only from the waist down, exactly as in the first frame — dark navy trousers and white sneakers — "
                  "carrying a white paper shopping bag with thin rope handles.",
        "PAIR": "two passers-by seen from behind, exactly as in the first frame — on the left a woman with a short dark bob in a long camel "
                "coat, on the right a man in a gray padded jacket and dark trousers. Their faces are never seen.",
        "CUSTOMER": "a woman customer seen from behind over her shoulder, exactly as in the first frame — dark shoulder-length hair, an "
                    "oatmeal knit sweater. Her face stays hidden the whole time.",
        "GUESTS": "two customers at the round table seen from behind and above, exactly as in the first frame — a man in a dark jacket and "
                  "a woman with a dark bob in a cream cardigan. Their faces stay turned away as in the first frame.",
    },
    "보기": "LOOK: true-to-life cinematic commercial footage with a shallow depth of field and natural motion blur; keep the first frame's "
            "own light, colors, brightness and white balance exactly to the very end — no new light, no flicker, no color shift. Every printed "
            "photo in the scene (on a bag, a window poster, a sticker, a street banner or a wall frame) is a flat, still print whose picture "
            "never moves or changes. No added text, letters, numbers, logos or captions anywhere; never add a person or an object that is not "
            "in the first frame.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}


def still(scene, movers):
    # movers는 동사까지(「the people move」 · 「Soyeon moves」)
    return (f"the frame stays exactly where it is from the first frame to the last — {scene} never shift; "
            f"no push-in, no zoom, no drift, no shake; only {movers}.")


def phone_still(scene):
    return (f"the frame stays exactly where it is from the first frame to the last, and the phone stays perfectly still in her hand — "
            f"the screen's position, angle and size never change and {scene} never shifts; no push-in, no zoom, no drift, no shake; "
            "only the finger moves.")


SOUND19 = ('SOUND: only the sound of this moment — the customer, seen from behind, says one short line in Korean in a warm, casual voice: '
           '"포스터 보고 왔어요." (from about 0.1 s to 1.4 s). Only the customer speaks — Soyeon\'s lips never form any words; from about '
           "1.7 s she only laughs softly. Quiet café room tone. No music, no narration, no other voices or words.")

# 컷: (쓰는 초, 설명, 그림, 끝 그림, 누구, 동작, 카메라)
CUT = {
    1: (1.44, "카페 손님 자리 · 의자 뒤 머리 높이 — 머리를 젖힌 소연의 거꾸로 얼굴(뒤는 민무늬 회청 — 등받이는 그림에 없음), 두 손에 든 폰(뒷면), 0.5초 심심한 숨",
        "C01.png", None, ["SOYEON"],
        "Seen from right behind her chair at head height: Soyeon has slumped back with her head tipped far back, so her face is seen "
        "upside down and fills the lower half of the frame, her hair hanging down toward the bottom edge against the plain blue-gray "
        "background — only her face, hair, hands, phone and that plain background are in the frame; she holds her phone up above her "
        "face in both hands (only its back is seen) and stares at it with a bored, blank face. At about 0.5 s she lets out one slow, bored "
        "breath — her chest sinks a little, her lips stay closed — while her eyes keep drifting over the screen; otherwise she stays almost "
        "still. The soft blue-gray background stays featureless.",
        still("her upside-down face, the phone and the soft blue-gray background", "her eyes, her breath and her fingers move")),
    2: (0.97, "와이드 — 조명 꺼진 빈 카페, 가운데 손님 자리에 작게 젖혀 앉은 소연, 창밖 가로등에 작은 하린 배너(13번 복선) · 먼 행인 하나",
        "C02.jpg", None, ["SOYEON"],
        "A wide shot of the empty café on a gray afternoon, all its lamps off: Soyeon sits small near the middle of the room, slumped far "
        "back in a wooden chair on the customer side of the counter, holding her phone up above her face and scrolling lazily with her "
        "thumb. Outside the big windows the gray street is quiet; the small banner on the street lamp outside hangs still, and one tiny "
        "passer-by walks slowly along the far sidewalk. Nothing else moves.",
        still("the tables, chairs, windows and counter", "Soyeon's hand and the far passer-by move")),
    3: (1.70, "폰 앞 고정 — 오른손에 세로로 든 폰(초록 화면), 왼손 검지가 두 번 올려 넘김(원본 손가락: 0.13초 뗌 · 0.77초 다시 닿음 · 1.13초 뗌) — 녹화 R3은 후반",
        "C03.png", None, ["HANDS", "PHONE"],
        "Close on Soyeon's right hand holding her phone upright in front of the softly blurred café window; the tip of her left index "
        "finger already rests on the lower part of the green screen. The finger flicks quickly upward and lifts off at about 0.13 s, "
        "hovers just above the glass, touches the lower part of the screen again at about 0.77 s, flicks upward once more and lifts off "
        "at about 1.13 s, then hovers still just above the screen until the end.",
        phone_still("the blurred window behind")),
    4: (1.83, "거꾸로 얼굴 클로즈업 — 떠돌던 눈이 0.3초에 한 곳에 멈춤. 다가감(0.88초에 4.5%)은 원본도 편집기 디지털 줌 — 영상은 고정, 줌은 후반에서 원 곡선 그대로(02_콘티 2-1절)",
        "C04.png", None, ["SOYEON"],
        "Close on Soyeon's upside-down face, exactly as in the first frame — her head tipped far back, her hair hanging down toward the "
        "bottom of the frame, her forearms and the edge of her phone at the top edge. Her eyes, drifting over the phone above her, stop "
        "and lock onto one spot on it at about 0.3 s; she goes completely still, staring, lips closed — only one slow blink at about "
        "1.2 s.",
        still("her face, the phone edge and the soft blue-gray background", "her eyes move")),
    5: (1.50, "가게 밖 보도 높이 — 행인 다리가 오른쪽으로 지나가고(0.6초에 나감) 뒤로 든 쇼핑백 앞면 하린(풀밭 · 누워서 웃음)이 따라 지나감(1.0초에 나감 — 손에 들려 있어 원본의 개처럼 늦게 남지 못함), 창 너머 젖혀 앉은 소연",
        "C05.jpg", None, ["WALKER", "SOYEON"],
        "Low on the sidewalk outside the café window, just above the pavement: the walker strides to the right across the frame — the "
        "legs leave the frame on the right at about 0.6 s. The white paper shopping bag in the walker's trailing hand swings gently along "
        "behind, its front — a printed photo of a smiling young woman lying on grass — facing the camera the whole time, and it leaves "
        "the frame on the right at about 1.0 s. Behind the glass, Soyeon stays slumped back in her chair with her phone held up, almost "
        "still. The yellow ginkgo leaves on the pavement stay where they are.",
        still("the window, the pavement and Soyeon behind the glass", "the walker and the bag move")),
    6: (1.37, "폰 화면 극접사(초록) — 오른쪽 엄지가 천천히 아래로 조금 끌어(원본 화면 높이의 1/18) 1.4초에 멈춤 — 녹화 R6(하린 대표 사진)은 후반",
        "C06.png", None, ["HANDS", "PHONE"],
        "An extreme close-up of the phone screen filling most of the frame, held in Soyeon's left hand at the left edge; her right thumb "
        "rests on the right side of the green screen. From the first frame the thumb drags slowly downward by only a short distance — "
        "about a twentieth of the screen height — reaching that spot by about 1.4 s, then rests there, still, on the glass until the end.",
        phone_still("the blurred background at the edges")),
    7: (2.47, "정면 미디엄(첫 · 끝 그림) — 젖혀 있던 소연이 0.8초까지 바로 앉아 폰을 가슴 높이로, 1.6초 눈썹이 올라가며 입술이 살짝 열림 → 끝 그림 그대로 멈춤",
        "C07.png", "C07e.png", ["SOYEON"],
        "A medium shot from seated eye level in front of the café counter: at first Soyeon is slumped far back in her chair, so only her "
        "two hands holding the phone and the tip of her chin show at the bottom of the frame. From the first frame she sits up straight "
        "in one smooth movement, reaching the upright pose by about 0.8 s with the phone held at chest height in both hands, and looks "
        "down at the screen; at about 1.6 s her eyebrows lift slightly and her lips part a little in quiet surprise; then she holds that "
        "pose, still, until the end — exactly as in the last frame.",
        still("the counter, the shelves, the espresso machine and the drinks fridge", "Soyeon moves")),
    8: (0.83, "길 건너 와이드 — 옆 가게 유리창 포스터 하린(스킨케어) 앞, 뒷모습 둘 — 왼쪽 사람이 0.3초에 포스터를 한 번 가리키고(손은 포스터 밖) 옆 사람에게 기울면 남자가 0.7초에 고개를 기울임",
        "C08.jpg", None, ["PAIR"],
        "A wide shot from across the quiet street: the two passers-by stand at the shop window with their backs to the camera, looking at "
        "the poster behind the glass — a printed photo of a smiling young woman touching her cheek. The woman in the camel coat, already "
        "leaning toward the poster, points at it once at about 0.3 s with her hand staying just outside the poster's edge, then leans "
        "toward the man as if to say something; he tilts his head toward her by about 0.7 s. Their faces stay hidden and nothing passes in "
        "front of the poster. The blurred bicycle in the foreground stays still.",
        still("the shop front, the street and the bicycle in the foreground", "the two passers-by move")),
    9: (2.07, "소연 클로즈업 — 바로 앉아 눈을 내리깔고 폰에 집중, 0.6초 엄지 한 번 · 1.2초 느린 깜빡임",
        "C09.png", None, ["SOYEON"],
        "A close-up: Soyeon sits upright with her eyes lowered to the phone in her hand at the lower left, absorbed in it. Her thumb "
        "scrolls once with a small movement at about 0.6 s and she blinks slowly once at about 1.2 s; otherwise she stays still and "
        "focused, lips closed.",
        still("her face and the softly blurred shelves behind her", "her eyes and her thumb move")),
    10: (1.00, "비스듬한 폰 극접사(초록) — 오른쪽 아래 엄지가 0.1초부터 빠르게 쓸어 올리고 0.35초에 화면 밖으로 — 녹화 R10(장면 격자 흐름)은 후반",
         "C10.png", None, ["HANDS", "PHONE"],
         "An extreme close-up of the tilted phone screen, its top and bottom beyond the frame, held in Soyeon's hands; her thumb rests at "
         "the lower right corner of the green screen. At about 0.1 s the thumb flicks quickly up across the right part of the screen — "
         "fastest between 0.2 and 0.3 s — and lifts away out of the frame by about 0.35 s; then only the still phone and its green screen "
         "remain.",
         phone_still("the blurred background at the left")),
    11: (0.67, "음료 냉장고 유리문 스티커 접사 — 하린(웃음), 움직임 없음(유리에 옅은 반사만)",
         "C11.jpg", None, [],
         "Close on the glass door of the drinks fridge beside the counter: a sticker on the glass shows a printed photo of a smiling young "
         "woman; behind the glass, bottles of milk and juice stand in cold white light. Nothing moves — the sticker stays a flat, still "
         "print; only a faint shimmer of reflection drifts slowly across the glass beside the sticker, never over the sticker itself.",
         still("the fridge door, the sticker and the bottles", "the faint reflections on the glass move")),
    12: (0.83, "오른손에 든 폰(초록) — 화면 가운데 닿아 있던 왼손 검지가 0.13초에 올려 넘기고 뗌 — 녹화 R12(「딸기 라떼 신메뉴」 · 01 하린)는 후반",
         "C12.png", None, ["HANDS", "PHONE"],
         "Soyeon holds the phone upright in her right hand; the tip of her left index finger already rests on the middle of the green "
         "screen, exactly as in the first frame. It flicks upward and lifts off at about 0.13 s, then hovers just above the glass, still, "
         "until the end.",
         phone_still("the blurred café behind")),
    13: (0.84, "가로등 세로 배너 하린(소파 · 폰 보며 웃음) · 길 아래 다음 가로등에 같은 배너가 작게 — 배너는 팽팽히 고정(원본 나무 소매처럼), 나뭇잎만 살짝",
         "C13.jpg", None, [],
         "A quiet city street on a gray autumn afternoon: on the street lamp in the foreground hangs a tall vertical banner with a printed "
         "photo of a smiling young woman, and the same banner hangs small on the next lamp down the street. The banners hang perfectly "
         "still and taut — flat prints that never move; only the yellowing leaves on the trees stir very slightly in a light breeze; no "
         "cars or people appear.",
         still("the lamp posts, the buildings and the street", "the leaves on the trees stir, very slightly")),
    14: (1.43, "소연 클로즈업 — 0.3초 말 없는 감탄 숨(입술이 조금 더 열리고 눈이 살짝 커짐) · 빠져듦(숨 소리는 후반)",
         "C14.png", None, ["SOYEON"],
         "A close-up: Soyeon looks down at her phone, her lips already slightly parted. At about 0.3 s she draws in a small, soundless "
         "breath of wonder — her lips part a little more and her eyes widen slightly — and she stays drawn in, gazing at the screen without "
         "speaking, until the end.",
         still("her face and the softly blurred shelves behind her", "her eyes and lips move")),
    15: (1.13, "어깨 너머 비스듬한 폰(초록) — 왼손 검지가 0.40초에 화면 가운데를 눌러 0.47초까지, 뒤 뗌 — 녹화 R15(크게 보기) · 글자 1은 후반",
         "C15.png", None, ["HANDS", "PHONE"],
         "Seen over her shoulder, which stays a dark, soft blur at the left edge exactly as in the first frame: she holds the phone tilted "
         "in her right hand; her left index finger, raised just in front of the screen, "
         "moves in and taps the middle of the green screen at about 0.40 s, stays pressed until about 0.47 s, then lifts away and drifts "
         "back off the screen.",
         phone_still("the softly blurred café behind")),
    16: (0.90, "소연 클로즈업 — 아래에서 오는 폰 빛, 0.3초 입꼬리에 작은 결심(입 다묾) — 글자 2는 후반",
         "C16.png", None, ["SOYEON"],
         "A close-up: Soyeon's face fills most of the frame, lit softly from below by the glow of the phone at the lower left; she looks "
         "down at the screen and, at about 0.3 s, a small, decided smile settles at the corners of her mouth, lips closed; then she stays "
         "still.",
         still("her face and the dark surroundings", "her mouth and eyes move")),
    17: (1.37, "폰 귀퉁이 극접사(초록) — 엄지가 0.67초에 화면으로 올라와 위 가운데(「+ 패키지」 자리)를 0.77~0.97초 누르고 1.0초에 뗌. 0.33초에 1.50배 다가감은 원본도 편집기 디지털 줌 — 영상은 고정, 녹화 R17(9배)을 붙인 뒤 후반 줌",
         "C17.png", None, ["HANDS", "PHONE"],
         "An extreme close-up of the lower left corner of the phone, held in Soyeon's left hand; the green screen fills the upper part of "
         "the frame and her thumb rests on the phone's lower edge. At about 0.67 s her thumb lifts and moves onto the screen, presses one "
         "spot in the upper middle of the green area (about 70% across the frame, a quarter of the way down) from about 0.77 s to 0.97 s, "
         "lifts off at about 1.0 s and moves back to rest on the phone's edge.",
         phone_still("the blurred background")),
    18: (1.27, "따뜻한 빛 — 소연의 손이 스팀 피처로 딸기 퓌레 유리잔에 찬 우유를 1.5초까지 붓고 멈춤(잔은 4/5 · 넘치지 않음), 분홍 구름이 퍼짐(라테아트 없음)",
         "C18.png", None, ["HANDS"],
         "Warm, golden café light: a close-up of Soyeon's hands — one holds a tall glass with strawberry purée at the bottom, the other "
         "keeps pouring cold milk into it from a steel milk pitcher in a steady stream for the first 1.5 s — the milk swirls into the red "
         "purée and a soft pink cloud spreads up through the glass, which fills to about four fifths and never overflows; at about 1.5 s "
         "she tilts the pitcher back so the stream stops, and both hands hold still. The surface stays plain, with no pattern drawn on it.",
         still("the glass, the counter and the warm background", "the hands, the pitcher and the milk move")),
    19: (3.07, "카운터 너머 미디엄(소리 켬) — 소연이 손님(왼쪽 앞 어깨 너머 뒷모습)에게 딸기 라떼를 건네며 웃음, 손님 「포스터 보고 왔어요」 0.1~1.4초 · 소연 웃음 1.7~3.0초, 벽 액자 = 15번에서 연 하린 · 딸기 라떼",
         "C19.jpg", None, ["SOYEON", "CUSTOMER"],
         "Warm afternoon light with the pendant lamps on: over the shoulder of the customer in the left foreground, Soyeon stands behind "
         "the counter and hands a strawberry latte across to her, smiling. The customer takes the glass and draws it toward herself by "
         "about 1.0 s, saying a short line as she does — her face stays hidden. Soyeon lets go, looks at her and, from about 1.7 s to "
         "3.0 s, laughs softly with a warm, open smile; she says no words. The framed poster on the wall at the top left — a printed "
         "photo of a young woman holding a strawberry latte — stays a flat, still print.",
         still("the counter, the wall poster and the windows", "the people move")),
    20: (1.74, "천장 모서리 높은 앵글 와이드 — 따뜻한 낮은 햇살, 딸기 라떼를 놓고 작게 웃는 손님 둘(뒷모습), 카운터에 손을 얹은 채 그들을 보며 웃는 소연(행주 없음) — 제목은 후반",
         "C20.png", None, ["SOYEON", "GUESTS"],
         "A high-angle wide shot from a ceiling corner of the warm café, golden low sunlight streaming in through the windows and the "
         "pendant lamps on: the two customers sit at the round table in the foreground with their strawberry lattes, chatting and laughing "
         "quietly — small nods and a tilt of the head, without turning toward the camera; behind the counter, Soyeon rests one hand on the "
         "counter exactly as in the first frame, looks over at the two customers and smiles warmly. "
         "The long sun shadows on the wooden floor stay still.",
         still("the room, the tables, the counter and the windows", "the people move")),
}

# 대안 — 주판이 안 될 때만(순서표 맨 끝). (id 꼬리, 컷, 그림, 설명, 동작 바꿈)
GREEN_PANEL = "a flat, plain, evenly lit chroma-green panel that stays plain green, with nothing ever drawn on it"
ALT_GREEN = {   # 인쇄물 사진 속 얼굴이 흔들리면 초록 판으로 내 후반에서 하린 사진을 붙인다 — (그림, [(바꿀 글, 새 글)…])
    5: ("C05_초록.png", [("its front — a printed photo of a smiling young woman lying on grass — facing",
                          f"its front — {GREEN_PANEL} — facing")]),
    8: ("C08_초록.png", [("the poster behind the glass — a printed photo of a smiling young woman touching her cheek",
                          f"the poster behind the glass — {GREEN_PANEL}")]),
    11: ("C11_초록.png", [("a sticker on the glass shows a printed photo of a smiling young woman",
                           f"a sticker on the glass is {GREEN_PANEL.replace('panel', 'rectangle')}"),
                          ("the sticker stays a flat, still print", "the sticker stays plain green")]),
    13: ("C13_초록.png", [("a tall vertical banner with a printed photo of a smiling young woman, and the same banner hangs small",
                           "a tall vertical banner that is a flat, plain, evenly lit chroma-green panel, and a second plain green banner hangs small"),
                          ("— flat prints that never move;",
                           "— plain green panels that never move, with nothing ever drawn on them;")]),
    19: ("C19_초록.png", [("— a printed photo of a young woman holding a strawberry latte — stays a flat, still print",
                           f"is {GREEN_PANEL}")]),
}
UPRIGHT = {   # 거꾸로 얼굴이 바로 서려 하거나 일그러지면 — 확정 판을 돌리기 전 바로 선 판으로 내고 받은 뒤 180° 돌린다 — (그림, 동작, 카메라)
    1: ("C01b_바로.png",
        "Seen from directly above: Soyeon lies on her back on a plain blue-gray surface, her face upright in the frame and her dark hair "
        "spread out around her head; she holds her phone in both hands at the bottom of the frame, just below her chin (only its back is "
        "seen), and stares at it with a bored, blank face. At about 0.5 s she lets out one slow, bored breath — her chest sinks a little, "
        "her lips stay closed — while her eyes keep drifting over the screen; otherwise she stays almost still.",
        still("her face, the phone and the plain blue-gray surface", "her eyes, her breath and her fingers move")),
    4: ("C04b_바로.png",
        "Seen from directly above, close on Soyeon's face: she lies on her back on a plain blue-gray surface, her face upright in the frame, "
        "her dark hair spread out above her head, her forearms resting out to the sides at the bottom of the frame with the top of her "
        "phone at the bottom edge. Her eyes, drifting over the phone, stop and lock onto one spot on it at about 0.3 s; she goes completely "
        "still, staring, lips closed — only one slow blink at about 1.2 s.",
        still("her face, her forearms, the phone edge and the plain blue-gray surface", "her eyes move")),
}


def length(t):
    return max(4, math.ceil(t + 0.8))


def shot(n, pic=None, act=None, end=True):
    t, _, img, end_img, who, a, cam = CUT[n]
    s = {"그림": pic or img, "쓰는초": t, "누구": who, "동작": act or a, "카메라": cam}
    if end and end_img:
        s["끝그림"] = end_img
    return s


def build():
    plates = []
    for n, (t, desc, *_rest) in CUT.items():
        p = {"id": f"p8-{n:02d}", "컷": [str(n)], "길이": length(t), "설명": desc, "샷": [shot(n)]}
        if n == 19:
            p["소리"] = "켬"
            p["소리줄"] = {"켬": SOUND19}
        plates.append(p)
    for n, (pic, act, cam) in UPRIGHT.items():
        t = CUT[n][0]
        plates.append({"id": f"p8-{n:02d}b", "컷": [str(n)], "길이": length(t), "대안": True,
                       "설명": f"대안 — {n}번 거꾸로 얼굴이 바로 서려 하거나 일그러질 때만: 확정 판을 돌리기 전 바로 선 판(위에서 내려다본 얼굴)으로 내고, 받은 뒤 180° 돌려 쓴다",
                       "샷": [dict(shot(n, pic=pic, act=act), 카메라=cam)]})
    for n, (pic, swaps) in ALT_GREEN.items():
        t = CUT[n][0]
        a2 = CUT[n][5]
        for old, new in swaps:
            assert old in a2, (n, old)
            a2 = a2.replace(old, new)
        p = {"id": f"p8-{n:02d}b", "컷": [str(n)], "길이": length(t), "대안": True,
             "설명": f"대안 — {n}번 인쇄물 사진 속 얼굴이 흔들리거나 바뀔 때만: 초록 대역 판으로 내고 후반에서 하린 사진을 평면 추적으로 붙인다(02_콘티 4절)",
             "샷": [shot(n, pic=pic, act=a2)]}
        if n == 19:
            p["소리"] = "켬"
            p["소리줄"] = {"켬": SOUND19}
        plates.append(p)
    return {
        "메모": "8번 앱 소개 30초(캐스팅북) — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31, 생성기 ../지시문_시댄스웹.py). 시작 그림은 확정 이미지 콘티(git 밖 "
                "콘티/p8/ — 정지컷 · 합성판 컷/ · 받음/)를 시댄스/에 모은 것(1920×1080, 합성기와 같은 바꿈). 폰 화면 컷 여섯은 초록 화면 그대로(녹화는 후반), "
                "인쇄물 컷은 하린 사진을 붙인 합성판(흔들리면 초록 대안). 카메라는 01 2-1절 원본 실측 — 모두 고정, 4 · 17번 다가감은 원본도 편집기 디지털 줌이라 "
                "후반에서 원 곡선 그대로. 19번만 소리 켬(손님 말 · 소연 웃음, 입 맞춤 없음). 내레이션 · 노래 · 글자 · 제목 · 끝 화면(21번)은 후반. "
                "꾸러미는 ../../../시댄스무제한/웹꾸러미.py.",
        "편": "p8",
        "이름": "8번 앱 소개 「캐스팅북」",
        "비율": "16:9",
        "그림": str(IMG).replace("\\", "/"),
        "공통": 공통,
        "판": plates,
    }


if __name__ == "__main__":
    gather(force="--그림" in sys.argv)
    spec = build()
    out = HERE / "지시문" / "영상_시댄스웹.json"
    json.dump(spec, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    main = [p for p in spec["판"] if not p.get("대안")]
    print(f"{out.name}: 판 {len(spec['판'])}(주판 {len(main)} · {sum(p['길이'] for p in main)}초 · 대안 {len(spec['판']) - len(main)}) · 그림 {IMG}")
