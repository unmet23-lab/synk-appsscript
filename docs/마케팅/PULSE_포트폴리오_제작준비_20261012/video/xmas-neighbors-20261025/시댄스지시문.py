# 시즌 1 「옆집의 크리스마스」 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-29).
#   python -X utf8 시댄스지시문.py      → 지시문/영상_시댄스웹.json(굽기 시트의 웹꾸러미.py가 읽는 꼴 — 4번 · 11번과 같음)
# 그림은 시댄스그림.py가 git 밖 <밖>/시댄스/에 모은 것(C##.jpg 시작 · C##e.jpg 끝). 동작은 02_콘티 2절 「화면」대로 한 가지, 카메라는 2절 카메라 칸
# (원본 25fps 실측 — 카메라무브.py · 지시문/카메라.json)의 숫자 그대로 쓰되, 「요즘 기법으로 바꾼 컷」(02_콘티 「시댄스 지시문(10-29)」)만 바꾼 문장이다.
# 초는 그 컷 첫 프레임 기준(원본 초 − 컷 시작). 길이 = max(4, ⌈쓰는 초 + 0.8⌉) — 시댄스가 0.7초쯤 늦게 온다(현장노트 higgsfield).
# 두 샷 묶음 = 같은 곳 · 같은 때 · 같은 사람/물건이 바로 붙은 컷(굽기 시트 규칙), 고정 와이드 다섯(합성 판)과 끝 그림 컷은 묶지 않는다.
# 자르는 초 = 첫 샷 쓰는 초 + 0.7(0.1초 올림), 길이 = ⌈자르는 초 + 둘째 쓰는 초 + 0.8⌉. 묶음 판마다 낱판 둘, 끝 그림 판마다 끝 그림 없는 판을 「대안」으로.
# 영상은 소리 끔 — 말은 모두 입이 안 보이는 자리(1 뒷모습 · 31 창 너머 작게 · 34 고개 돌린 뒤 · 36 화면 밖)라 후시녹음이다. 소리 참고 칸은
# 목소리 방식 결정(트랙 §8) 뒤에 넣을 자리만 둔다.
import json
import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
IMG = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/시댄스"

공통 = {
    "장르": "a quiet, tender Korean Christmas brand film, shot like a cinematic short film",
    "누구": {
        "MINJAE": "the same young Korean man as in the first frame, in every frame — late twenties, short black hair with messy straight "
                  "bangs, an ordinary build. His face is never seen: it stays hidden exactly as in the first frame — turned away from the "
                  "camera, in silhouette or in deep shadow — and he never turns or lifts his face toward the lens. He never speaks.",
        "MINJAE_FACE": "the same young Korean man as in the first frame — late twenties, short black hair with messy straight bangs, a "
                       "round soft face with warm-toned skin and a faint beard shadow, exactly the face of the first frame. His lips stay "
                       "closed; he never speaks.",
        "AUTUMN": "his late-autumn clothes, exactly as in the first frame and never changing — a thin navy zip-up jacket over a light-grey "
                  "hoodie with the hood down, dark trousers, worn white sneakers.",
        "HOME": "at home in a plain grey hoodie, exactly as in the first frame.",
        "COAT": "a long camel wool coat, exactly as in the first frame.",
        "RAIN": "a navy raincoat with the hood up over his head, exactly as in the first frame.",
        "WINTER": "his winter clothes, exactly as in the first frame and never changing — a navy hooded padded jacket, a grey knitted "
                  "scarf, dark trousers, white sneakers.",
        "HARIN": "the young Korean woman of the first frame — early twenties, light-brown shoulder-length layered hair worn half-up and "
                 "tied with a crimson velvet ribbon bow, an oversized cream cable-knit cardigan. Her face is never seen: it stays hidden "
                 "exactly as in the first frame — turned away from the camera, in silhouette or in deep shadow — and she never turns her "
                 "face toward the lens.",
        "HARIN_FACE": "the same young Korean woman as in the first frame — early twenties, light-brown shoulder-length layered hair with "
                      "see-through bangs, worn half-up with a crimson velvet ribbon bow, a round soft face, exactly the face of the first "
                      "frame; an oversized cream cable-knit cardigan over a white T-shirt. Her lips stay closed; she never speaks.",
        "WITCH": "her Halloween costume, exactly as in the first frame — a black witch hat with the crimson ribbon peeking out under it and "
                 "a short black cape; her face stays hidden in the deep shadow of the hat brim.",
        "BAG": "the white plastic convenience-store bag printed only with one plain amber circle — no letters, no logo.",
        "KEYHOLE": "the old round brass keyhole in his blue-grey steel door, with a half-circle of scratches in the paint around it — no "
                   "digital door lock, no keypad.",
        "LAMP": "the small round clear-glass globe lamp on the ceiling above his door.",
        "BOX": "the small white light-bulb two-pack box — a big line drawing of a bulb and one red circle sticker, no letters.",
        "CORRIDOR": "the 5th-floor outdoor corridor of an old Korean corridor-style apartment block, exactly as in the first frame — grey "
                    "steel front doors in shallow alcoves along one wall, a waist-high concrete parapet with a round steel handrail along "
                    "the open side, small round ceiling lamps, a bare concrete floor.",
    },
    "보기": "LOOK: a quiet, tender cinematic Christmas film — cinema camera, soft natural light, fine film grain, gentle lens falloff, "
            "natural textures, true-to-life colors. Each shot keeps its first frame's light — direction, color, white balance and "
            "darkness — to the very end; night stays night and dusk stays dusk. Only the light changes written in ACTION may happen. No "
            "new text, letters, numbers, logos or signs anywhere — the store's sign band and the bag's circle stay blank. Never add a person "
            "who is not in the first frame, and keep every hidden face hidden exactly as in the first frame. Every object keeps exactly the "
            "shape, size and pattern it has in the first frame.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}

LOCK = "locked off on a tripod — absolutely no movement, no zoom, no shake, no drift."

# n: (쓰는 초, 설명, 누구, 동작, 카메라, 끝 그림?)
CUT = {
    1: (3.56, "늦가을 밤 · 고정 와이드(합성 판) — 깜깜한 503 문간에서 통화하며 열쇠 구멍을 긁는 민재, 2.7초 열쇠 꾸러미가 떨어짐",
        ["MINJAE", "AUTUMN", "CORRIDOR"],
        "Late-autumn night, the long outdoor corridor seen from its dead end. Minjae stands small at the second door on the left, in a "
        "pitch-dark doorway whose lamp is dead, his back to the camera: he holds a phone to his ear with one hand, and with the other hand, "
        "holding a bunch of keys, he scrapes around the door for the keyhole. The next door's lamp makes a pool of "
        "warm light just behind him, so he reads as a dark silhouette. At about 2.7 s the bunch of keys slips from his fingers and drops to "
        "the floor. Nothing else moves except a few dry leaves stirring on the floor.",
        LOCK, False),
    2: (0.96, "503 문 위 꺼진 등 극접사(올려다봄) — 마른 나방 · 필라멘트가 한 번 약하게 깜빡이고 꺼짐",
        ["LAMP"],
        "Extreme close-up looking up at the lamp above his door: a dusty clear-glass globe with a blackened, dead bulb inside and a dry "
        "moth stuck to it; below it the steel door frame and a blank nameplate; a blurred pipe in the right foreground. At about 0.2 s the "
        "dead filament gives one last weak orange flicker and goes dark again; everything else stays cold and dark.",
        "handheld. In the first 0.64 s the camera pushes in by about 2.4% while drifting about 5% to the right and 1.5% up, at an even "
        "speed, while the picture turns about 1° clockwise; then it holds still with a light handheld tremble (about 0.4% of the frame) to the end.",
        False),
    3: (1.36, "통화를 끊고 폰 손전등으로 열쇠 구멍을 비추는 민재(뒤 3/4) · 복도 끝에서 리스를 걸며 목례하는 502 할머니",
        ["MINJAE", "AUTUMN", "CORRIDOR"],
        "Minjae (seen from behind, three-quarters, right of center) shines his phone flashlight at the keyhole of his door on the left — a "
        "cold white spot of light on the steel door — with the bunch of keys in his other hand. Far down the corridor, small, the elderly "
        "neighbor hangs a maple-leaf wreath on her door and gives him a small silent nod. He keeps his face turned to his door.",
        "a smooth slider move, no shake. From 0.04 s to 1.32 s the camera pushes in about 2.3% while sinking about 1.5% of the frame "
        "height, at a perfectly even speed.",
        False),
    4: (1.16, "민재 옆 실루엣 접사(조금 아래에서, 밤하늘 앞) — 고개 숙여 목례로 답함",
        ["MINJAE", "AUTUMN"],
        "Close-up from slightly below: Minjae's head and shoulders in profile facing left, a pure black silhouette against the deep navy "
        "night sky with only a faint orange city glow low over the rooftops; a thin warm rim of light from a far lamp outlines his hair, "
        "ear and shoulder. He gives a small polite bow of the head in reply, tipping his head forward and down. His face stays a solid black "
        "shape — no eye, nose or lips are ever lit.",
        "handheld, following his bowing head: from 0 s to 1.12 s the camera moves about 5% to the right and about 3% down and eases back "
        "about 1%, starting slowly and speeding up.",
        False),
    5: (1.60, "가슴 아래 — 무릎을 굽혀 늘켬 봉투를 발치에 내려놓음, 카메라가 아래로 43% 기울며 따라감",
        ["MINJAE", "AUTUMN", "BAG", "CORRIDOR"],
        "From his chest down: Minjae bends his knees and sets the white bag down on the corridor floor at his feet, to free his hands for "
        "the key — his navy jacket, dark trousers and white sneakers, a few dry leaves on the damp concrete, the steel door frame at the "
        "left edge and the parapet on the right.",
        "handheld, a downward tilt that follows his hands to the floor: in one unbroken move from 0 s to 1.48 s the camera tilts down "
        "about 43% of the frame height, easing back about 3.5% and drifting about 3.6% to the right — fastest at first, slowing to a stop "
        "— from his chest to his sneakers and the bag on the floor; then it holds there with a light tremble (0.2%). It never cuts: the "
        "last framing is reached only by this tilt.",
        True),
    6: (1.44, "낡은 놋쇠 열쇠 구멍 극접사 — 열쇠 끝이 구멍을 비껴 칠을 긁음",
        ["KEYHOLE"],
        "Extreme close-up of the old round brass keyhole in his blue-grey steel door, the paint around it covered in half-circle "
        "scratches. From the right, his fingertips hold a brass key whose tip misses the hole and scrapes across the paint once more. A cold "
        "white phone flashlight from the right makes the scratches glint; everything else is dark.",
        "almost still: over the whole shot (0–1.40 s) the camera drifts very slowly about 1% to the left and about 2% up at an even speed "
        "— no shake.",
        False),
    7: (1.80, "민재 어깨 너머 — 바로 옆 504 문이 열려 금빛과 세 사람의 웃음이 쏟아짐(역광)",
        ["MINJAE", "AUTUMN", "CORRIDOR"],
        "Over Minjae's shoulder (the back of his head, his grey hood and navy jacket out of focus in the right foreground): the very next "
        "door stands wide open into the dark corridor, warm golden light pours out, and three young women, backlit silhouettes, laugh in "
        "the doorway. Nobody's face is lit.",
        "handheld over his shoulder: from 0 s to 1.56 s the camera slides about 10.5% to the left and about 1% down at an even speed, as if "
        "leaning to look past his shoulder; light tremble (0.2%).",
        False),
    8: (1.40, "504 문간 미디엄 와이드 — 하린(뒷모습 · 리본)과 친구 둘이 웃으며 떠듦, 503은 깜깜",
        ["HARIN"],
        "Medium-wide, almost straight at the open door of the next flat from the dark corridor: Harin (from behind — her half-up hair with "
        "the crimson ribbon, cream cardigan, light jeans) leans over the shoe shelf in the warm doorway, laughing and chatting with two "
        "friends — one in a denim jacket on the left in the dark corridor, one in a grey hoodie in the right foreground (a young woman — Minjae is not in this shot) — all backlit, "
        "their faces in shadow. The neighboring doorway on the left stays dark.",
        "handheld: from 0 s to 0.88 s the camera drifts about 3% to the left and about 3% up at an even speed, then holds; light tremble "
        "(0.2%).",
        False),
    9: (1.72, "하린 역광 실루엣 접사 — 캔을 들고 고개를 젖혀 웃음(얼굴은 검고 윤곽 · 리본만 빛남)",
        ["HARIN"],
        "Close-up in the right half of the frame: Harin as a backlit silhouette in her doorway, a can in her hand, throws her head back "
        "laughing; the warm light behind her traces only the outline of her forehead, nose, chin, hair and the crimson ribbon — her face "
        "stays dark. Her friends inside are soft blurred shapes.",
        "handheld, following her face: from 0 s to 1.68 s the camera pushes in about 3.3%, moves about 5% to the right and 1% down, and "
        "the picture turns about 2.5° clockwise — quick at first, slowing to a stop; very light tremble.",
        False),
    10: (0.96, "504 문턱 낮은 와이드 — 쏟아진 신발, 크림 소매 손이 스피커 볼륨을 올림",
         [],
         "Low wide at the threshold of the next flat: friends' sneakers and boots spill out of the open doorway onto the corridor floor; "
         "on the shoe cabinet stands a small portable speaker, and a hand in a cream knit sleeve reaches in and turns its volume knob up. "
         "Warm light inside, cold dark corridor outside.",
         "locked off on a tripod at floor height — absolutely no movement, no zoom, no shake.",
         False),
    11: (1.44, "민재 옆 실루엣(흐린 밤하늘 앞) — 어깨를 움츠리고 시끄러운 문간에 등을 돌림",
         ["MINJAE", "AUTUMN"],
         "Close-up: Minjae in profile, a pure black silhouette against the deep navy night sky with a low warm city glow and a few lit windows over the rooftops beyond the parapet; "
         "he hunches his shoulders and turns his back on the noisy doorway off screen to the right. His face stays a solid black shape.",
         "handheld: from 0 s to 1.40 s the camera eases back about 2%, moving about 1% to the right and 2% down — quick at first, slowing "
         "to a stop; light tremble (0.3%).",
         False),
    12: (1.40, "1과 같은 판 — 한참 만에 철컥, 반쯤 연 문으로 민재가 들어가고 다시 깜깜(502 리스 · 504 가을 장식)",
         ["MINJAE", "AUTUMN", "BAG", "CORRIDOR"],
         "The same corridor on the same kind of night: after a long fumble his door finally gives — Minjae pushes the half-open steel door "
         "at the second doorway, steps inside with his bag, and the door swings shut behind him; that doorway is pitch dark again. Far down, "
         "the elderly neighbor's door has its maple-leaf wreath; a string of dry leaves and a small pumpkin decorate the doorways.",
         LOCK, False),
    13: (1.20, "민재 집 안 와이드 — 두 겹 문틀 너머 불 끈 부엌, 전자레인지 호박빛 속 실루엣",
         ["MINJAE", "HOME"],
         "Inside his small home at night: from the dark entryway through two door frames, Minjae — a small silhouette in his grey hoodie — "
         "stands in the unlit narrow kitchen, lit only by the amber glow of a microwave; the small window above the sink shows the blue "
         "night. The microwave finishes and he reaches for its door.",
         LOCK, False),
    14: (1.44, "창가 작은 상에 혼자 앉아 도시락을 먹는 민재(오른쪽 어깨 뒤) · 창 너머 늘켬",
         ["MINJAE", "HOME"],
         "Seen from behind his right shoulder (the back of his head, his ear and the edge of his cheek — no face), Minjae sits alone at a "
         "small table by the window eating the boxed meal with chopsticks; through the window, across the street, the convenience store "
         "glows amber. He eats slowly, looking out.",
         "almost still: from 0 s to 1.24 s the camera drifts about 1% to the left, slowing to a stop — no shake.",
         False),
    15: (1.32, "민재 방 창 너머 망원 — 늘켬 계산대의 하린이 1+1 전구 상자를 얼굴 옆에 들어 보이며 점원에게 물음",
         ["HARIN", "BOX"],
         "Through his window (blurred window frames and a curtain at both edges), a telephoto view across the street into the bright "
         "convenience store: Harin (from behind, three-quarters — crimson ribbon, cream cardigan) stands at the counter, holds the white "
         "bulb box up beside her face and asks the clerk something; the clerk answers. She keeps her face turned toward the clerk.",
         "handheld long lens, peeking through the window: from 0 s to 1.16 s the camera tilts down about 4% of the frame height at an even "
         "speed; light tremble.",
         False),
    16: (1.36, "며칠 뒤 — 긴 코트의 민재(어깨 아래부터)가 택배 상자까지 낀 채 흐린 손전등으로 열쇠 구멍을 찾음",
         ["MINJAE", "COAT", "BAG", "CORRIDOR"],
         "Days later, at night: Minjae in his long camel coat (from behind; the first frame shows him from the shoulders down), the bag in "
         "one hand and a parcel box clamped under his arm, aims his phone flashlight at his door to find the keyhole — the light is dimmer "
         "than before. Dry leaves on the floor.",
         "following him up: from 0 s to 0.96 s the camera rises about 7.5% of the frame height and pushes in about 1.4%, slowing to a stop; "
         "light tremble.",
         False),
    17: (0.48, "폰 든 손 극접사(어깨 너머) — 흐린 불빛 · 긁힌 열쇠 구멍(빨간 배터리 표시는 후반)",
         ["COAT", "KEYHOLE"],
         "Extreme close-up over his shoulder: his hand in the camel coat sleeve holds the phone toward the scratched brass keyhole, and the "
         "weak flashlight trembles on the door. The phone's screen stays dark, with nothing on it.",
         "from 0 s to 0.44 s the camera pushes in about 2% at an even speed.",
         False),
    18: (1.28, "핼러윈 해질녘 — 마녀 모자 하린과 친구가 계단 쪽으로 멀어지고, 민재가 폰 불빛으로 그들 발밑을 비춤",
         ["MINJAE", "COAT", "HARIN", "WITCH", "CORRIDOR"],
         "Halloween, blue dusk in the corridor: Harin in her witch hat and cape and two friends in costume (cat ears, a small halo — the third "
         "half hidden behind) walk away from the camera toward the bright stair landing at the far end, small pumpkin buckets in their hands. At his door on the left, Minjae in his long camel coat "
         "(from behind) holds his phone low and points its light at the floor ahead of their feet — a pool of white light on the concrete.",
         "almost still: from 0 s to 1.24 s the camera drifts about 1.4% to the left and about 1.7% up, slowing to a stop.",
         False),
    19: (2.56, "민재 어깨 너머 — 복도 끝 밝은 계단참의 마녀 모자 하린이 돌아보며 작게 손을 흔듦(얼굴은 챙 그늘)",
         ["MINJAE", "COAT", "HARIN", "WITCH", "CORRIDOR"],
         "Over Minjae's shoulder (the back of his head and his raised hand, out of focus in the foreground): at the far, bright stair "
         "landing Harin in her witch hat, already turned toward him, keeps giving him a small wave; her face stays hidden in the shadow of "
         "the hat brim. He waves back. The lamp above his own door stays dead.",
         # 10-29 바꾼 컷(02_콘티 11-2): 원본 「손에 든 따라감 — 카메라 오른쪽으로 20.4% · 위로 5.3% · 물러남 1.7% · 기울기 +10.1°(뒤집은 판이라
         # 거울로 왼쪽 · -10.1°)」은 움직이는 얼굴을 따라간 움직임 — 어깨 너머로 먼 계단참을 보는 우리 구도에선 따라갈 것이 없어 느린 다가감으로
         "handheld, a slow push-in over his shoulder toward her: from 0 s to 1.44 s the camera moves gently forward by about 5%, quick at "
         "first and slowing to a stop, then it keeps only a light handheld tremble (about 0.5% of the frame) — no sideways swing, no roll. "
         "His blurred shoulder and raised hand stay in the foreground.",
         False),
    20: (2.32, "1과 같은 판, 폭우 — 504 전구 줄, 우비 민재, 화분 트리를 든 이웃 둘이 지나며 목례",
         ["MINJAE", "RAIN", "CORRIDOR"],
         "The same corridor weeks later in a night downpour: rain sheets past the parapet and the floor shines wet. Minjae in his navy "
         "raincoat (from behind) stands at his dark doorway; two neighbors in raincoats walk down the corridor carrying a small potted "
         "Christmas tree and give a small nod as they pass.",
         LOCK, False),
    21: (1.24, "우비 민재가 우산 · 손전등 · 열쇠를 다 든 채 열쇠 구멍 앞 — 봉투가 손목에서 미끄러짐(좌우 뒤집은 판)",
         ["MINJAE", "RAIN", "BAG", "CORRIDOR"],
         "Minjae in his navy raincoat, his face hidden inside the hood, stands at his door on the left juggling a black umbrella, his phone "
         "flashlight and his keys at the keyhole; the white bag slips down his wrist. Rain blows in past the parapet on the right; behind him "
         "down the corridor, the next door's warm fairy lights blur.",
         # 원본: 카메라 왼쪽으로 2% · 아래로 7.9% · 기울기 -3.9° — 좌우를 뒤집은 판이라(10-29 일관성) 방향 · 돎을 거울로
         "handheld in the rain: from 0 s to 1.20 s the camera jolts down about 8% of the frame height and about 2% to the right while "
         "the picture turns about 4° clockwise, at an even speed, with a strong rainy handheld tremble (about 0.7% of the frame).",
         False),
    22: (1.36, "크리스마스이브 아침, 현관 둥근 거울 — 턱 아래만, 회색 목도리를 두르는 두 손",
         ["WINTER"],
         "Christmas Eve morning, the round mirror in his entryway: the top edge of the frame cuts him off at the chin — only the shoulders "
         "of his navy padded jacket and his two hands wrapping the grey knitted scarf around his neck are seen. Soft warm morning side "
         "light.",
         "almost still: over the whole shot the camera sinks very slowly by about 1.7% of the frame height at an even speed, so the top "
         "edge of the frame stays below his lips — his mouth and face never come into the frame; no shake.",
         False),
    23: (1.12, "첫눈 — 발목 높이, 눈을 밟으며 왼쪽으로 걷는 운동화 · 무릎께에서 흔들리는 봉투",
         ["WINTER", "BAG"],
         "First snow, at ankle height: Minjae's white sneakers walk to the left through a thin layer of fresh snow while the white bag swings "
         "at his knee; a snowy low concrete wall behind.",
         "a low tracking shot moving left alongside his feet: from 0 s to 1.08 s the camera travels with him, the background sliding "
         "about 7% of the frame past, and it eases back about 5%, at an even speed; light tremble.",
         False),
    24: (1.44, "눈 덮인 골목 와이드 — 봉투를 든 민재(뒷모습)가 낡은 아파트 쪽으로 멀어짐",
         ["MINJAE", "WINTER", "BAG"],
         "A snow-covered alley of old brick houses in the late-afternoon light, blue sky with golden clouds: Minjae (from behind, about half "
         "the frame height) walks away up the alley toward the old apartment block, the white bag in his hand.",
         "almost still: from 0 s to 1.40 s the camera eases back about 1.5%, drifting about 2% to the left and 3% down, slowing to a stop.",
         False),
    25: (1.56, "하린 방 — 작은 트리 곁, 성에 낀 복도 쪽 창 앞에서 계단 쪽을 내다보는 하린(뒷모습)",
         ["HARIN"],
         "Inside Harin's warm room, beside a small lit Christmas tree: Harin (from behind — crimson ribbon, cream cardigan) stands at the "
         "frosted window that looks onto the corridor and watches toward the stairs, waiting. She stays still and never turns around.",
         "from 0 s to 1.44 s the camera pushes in about 12.5% toward her and the frosted glass while moving about 6.5% to the right and 5% "
         "up — quick at first, slowing to a stop; the frost on the glass comes into sharper focus as it nears.",
         False),
    26: (1.40, "1과 같은 판, 눈 오는 해질녘 — 문마다 전구 · 리스, 503만 깜깜, 계단에서 올라온 민재가 카메라 쪽으로 걸어옴",
         ["MINJAE", "WINTER", "CORRIDOR"],
         "The same corridor at snowy blue dusk on Christmas Eve: every door glows with fairy lights, wreaths and a small tree — only his "
         "doorway, the second on the left, is still bare and dark. Minjae, up from the stairs at the far end, walks slowly toward the camera "
         "and toward his door, head bowed, his face in shadow; he stays small and does not come close to the camera.",
         LOCK, False),
    27: (1.24, "민재 옆 접사(어깨 너머로 돌아간 옆) — 지친 걸음, 버릇처럼 폰 손전등을 켬",
         ["MINJAE", "WINTER"],
         "Close-up over his shoulder in lost profile, his face turned away and in shadow: tired, Minjae walks, looks down and, out of habit, "
         "switches on his phone flashlight — a small light just coming on at the bottom edge. Behind him, out of focus, the decorated doors' "
         "fairy lights and wreaths blur into golden bokeh; a few snowflakes.",
         "handheld, walking with him: from 0 s to 1.20 s the camera pushes in about 2% while moving about 8% to the right and 9% down, at "
         "an even speed; light tremble.",
         False),
    28: (2.76, "503 앞 미디엄(뒷모습) — 머리 위 센서등이 딸깍 켜져 있고, 폰 불빛을 내리고 열쇠를 한 번에 꽂음",
         ["MINJAE", "WINTER", "BAG", "KEYHOLE"],
         "Medium, from behind: Minjae stands at his door; the small sensor lamp above it has just clicked on and warm light pours over him "
         "and over the brass keyhole. He lowers his phone, its flashlight still on and pointing at the floor, and with the bag in his other "
         "hand slides the key into the keyhole in one go and turns it.",
         "almost still: from 0 s to 2.72 s the camera drifts about 2.5% to the left and about 2.3% down, starting very slowly and speeding "
         "up a little toward the end — no shake.",
         False),
    29: (1.16, "새 전구 극접사 — 2와 같은 갓 · 같은 자리, 따뜻한 빛, 테에 서리, 지나는 눈송이",
         ["LAMP"],
         "Extreme close-up: the same round clear-glass globe above his door, now with a clean new bulb glowing warm inside, frost on the "
         "rim, a few snowflakes drifting past.",
         "from 0 s to 0.72 s the camera eases back about 1.8% while the picture turns about 1° counter-clockwise, slowing to a stop — no shake.",
         False),
    30: (2.40, "민재 얼굴(처음 보이는 얼굴) — 등을 올려다보다 입 다문 작은 웃음, 사람을 따라 크게 돌아 바탕이 흐름",
         ["MINJAE_FACE", "WINTER"],
         "Minjae's face, seen for the first time, big and right of center: he looks up at the newly lit lamp above him and a small "
         "closed-lip smile slowly spreads; snowflakes in his hair, his grey scarf, blue dusk behind.",
         # 원본 그대로(카메라 왼쪽으로 47.9% · 위로 3.9% · 물러남 2.6% · 기울기 -6.7°) — 큰 아크를 먼저 쓰고 작은 것은 뒤에(겹친 움직임은 길을 벗어남)
         "handheld, one slow arc that follows him: from 0.08 s to 2.36 s the camera travels in an arc to the left around him — quick at "
         "first, slowing to a stop — so that the background sweeps about half the frame width, from the snowy rooftops to the decorated "
         "corridor behind him, while his face stays in about the same place in the frame; along the way it rises a little, eases back "
         "about 2.6%, and the picture turns about 7° counter-clockwise; light tremble (0.9%). It never cuts.",
         True),
    31: (1.16, "하린 뒤통수(리본) 너머 성에 낀 부엌 창 — 새 등 아래 문을 열며 폰을 귀에 댄 민재(작게)",
         ["HARIN", "MINJAE", "WINTER"],
         "From behind Harin's head (the crimson ribbon, out of focus in the right foreground), through her small frosted kitchen window onto "
         "the corridor: under his newly lit lamp, Minjae, small and from behind, opens his door with his phone at his ear. She stays still "
         "and never turns her head.",
         "locked off on a tripod — only the back of her head moves slightly in the foreground; no zoom, no drift.",
         False),
    32: (2.08, "하린 신발장 위 극접사 — 나방 붙은 옛 전구 · 1+1 상자(하나 남음) · 드라이버, 1.9초 손이 옛 전구를 집음",
         ["BOX"],
         "Extreme close-up on top of Harin's shoe cabinet: the blackened old bulb with the dry moth still stuck to it, the open white bulb "
         "box with one bulb left inside, a small screwdriver; a folding step stool at the edge; window lights behind as soft bokeh. Near the "
         "end, at about 1.9 s, only her hand in a cream knit sleeve comes into the frame — no face, no body — and picks up the old bulb.",
         "handheld, a slow turning push-in: from 0 s to 1.92 s the camera pushes in about 6%, moves about 9% to the left and 8% up and "
         "the picture turns about 10° counter-clockwise — quick at first, slowing to a stop.",
         False),
    33: (1.16, "하린 손이 남은 전구를 자기 책상 스탠드에 끼움 — 켜지려는 순간 멈춤(빈 상자 · 봉투)",
         ["BOX", "BAG"],
         "Harin's hands in cream knit sleeves screw the second clear bulb into her own desk lamp; beside it stand the empty white box and "
         "the white bag; out-of-focus fairy-light bokeh in front. Just as the lamp is about to light, her hands stop.",
         "almost still: from 0 s to 1.12 s the camera pushes in about 1.3% and drifts about 1% to the left, starting slowly and speeding "
         "up.",
         False),
    34: (3.00, "하린 얼굴(정체) — 막 켜진 스탠드 빛 속 입 다문 작은 미소, 1.0초쯤 반 초 만에 고개를 창 쪽으로 돌려 입이 안 보임(끝 그림 C34e = C34t2)",
         ["HARIN_FACE"],
         "Harin's face, seen for the first time, left of center, in the warm light of the desk lamp that has just come on: she sits upright "
         "with a small closed-lip smile; Christmas-tree bokeh and the cold night window on the left. At about 1.0 s, in about half a "
         "second, she turns her head toward the window on the left until the camera sees only the back of her head and her crimson ribbon — "
         "her face and lips are no longer visible — and she holds that pose for the rest of the shot.",
         "handheld, very gentle: from 0.28 s to 3.0 s the camera drifts about 4% to the left and about 1% up and eases back about 1.5%, "
         "slowing to a stop.",
         True),
    35: (3.24, "1과 같은 판, 눈 오는 밤 — 503 · 504 두 등이 나란히 켜졌고 503 문이 닫힘(틈에 목도리 끝 · 봉투 귀퉁이)",
         ["CORRIDOR"],
         "The same corridor later that night, snow falling: at the second doorway his door swings shut — in the narrowing gap only the end "
         "of a grey scarf and a corner of a white bag — and his lamp now glows warm beside the neighbor's lamp; every door glows with fairy "
         "lights. Then all is still.",
         LOCK, False),
    36: (2.96, "눈 내리는 밤 골목 와이드 — 낡은 복도식 아파트(5층 문등들) · 길 건너 늘켬이 호박빛을 쏟음 → 로고 판",
         [],
         "Christmas Eve night, snow falling on a quiet street of an old Seoul neighborhood: on one side the old five-storey corridor "
         "apartment block with small warm door lamps along its 5th floor; across the street the convenience store spills amber light onto "
         "the fresh snow, its sign band blank. Parked cars under snow, street lamps, power lines.",
         "from 0 s to 2.92 s the camera pulls back very slowly by about 4.2% at a perfectly even speed.",
         False),
}

BUNDLES = [(3, 4), (7, 8), (9, 10), (13, 14), (16, 17), (28, 29)]   # 23 → 24는 빛이 달라(흐린 낮 → 갠 늦은 오후) 묶지 않음
# 끝 그림이 있는 컷 가운데 구도가 크게 바뀌는 5(아래로 43%) · 30(사람을 따라 크게 도는 아크)은 시작 그림만 주는 판을 주판으로, 끝 그림 판을 대안으로
# (10-29 시댄스 2.5 조사 — 구도가 다른 시작 · 끝 그림은 morph · 하드컷, 카메라 이동은 시작 그림 + 글이 낫다 · 우리 10-12 하드컷 관찰과 같음).
# 34는 같은 구도에서 고개만 돌린 끝 그림이라(「한 그림을 고쳐 두 그림을」) 끝 그림 판이 주판.
END_ALT = {5, 30}
NOTES = {   # 판 메모(꾸러미는 읽지 않음 — 조율 세션 · 유호님 확인용)
    1: "소리 — 엄마(전화 스피커) 「아들, 집엔 들어갔어?」 · 민재 「응, 들어왔어.」(0.30–2.60)는 뒷모습이라 후시녹음. 소리 참고는 목소리 방식 결정 뒤",
    31: "소리 — 민재 「응, 엄마. 들어왔어.」(46.50–47.50)는 창 너머 작은 뒷모습이라 후시녹음. 소리 참고는 목소리 방식 결정 뒤",
    5: "확정 고침(10-29 유호님) — 시작 · 끝 그림의 오른쪽 난간을 콘크리트 난간 + 손잡이로 고쳐 구움(10-29 일관성 검수, 02 「시댄스 지시문(10-29)」)",
    14: "로고 대기 — 늘켬 로고를 정한 뒤 창 너머 큰 간판에 로고를 넣어 시작 그림을 다시 굽는다(지금은 글 없는 호박빛 띠)",
    11: "확정 고침(10-29 유호님) — 흐린 낮처럼 밝던 하늘 · 동네를 같은 밤(짙은 남색 · 도시 불빛 · 창 불빛)으로 고쳐 구움(10-29 아르곤)",
    18: "확정 고침(10-29 유호님) — 난간 너머를 1 · 20과 같은 낮은 주택가로 고쳐 구움(벽 글자 없음, 10-29)",
    28: "확정 고침(10-29 유호님) — 문 위 등을 2 · 29와 같은 투명 유리 둥근 갓으로 고쳐 구움(10-29 아르곤)",
    19: "확정 고침(10-29 유호님) — 오른쪽 난간을 콘크리트 난간 + 손잡이로 고쳐 구움(10-29). 끝 그림 C19e는 시작과 같은 구도라 쓰지 않는다",
    21: "확정 고침(10-29 유호님) — 20과 복도 방향을 맞춰 좌우를 뒤집은 판(10-29, 19와 같은 고침)",
    34: "소리 — 하린 한 줄 「메리 크리스마스, 옆집.」(52.40–53.60)은 고개를 돌려 입이 안 보인 뒤라 후시녹음. 소리 참고는 목소리 방식 결정 뒤",
    36: "로고 대기 — 늘켬 로고를 정한 뒤 길 건너 간판에 로고를 넣어 시작 그림을 다시 굽는다(지금은 글 없는 호박빛 띠). 내레이션은 화면 밖",
}


def length(t):
    return max(4, math.ceil(round(t + 0.8, 2)))


def shot(n, end=True):
    t, desc, who, act, cam, has_end = CUT[n]
    s = {"그림": f"C{n:02d}.jpg", "쓰는초": t, "누구": who, "동작": act, "카메라": cam}
    if has_end and end:
        s["끝그림"] = f"C{n:02d}e.jpg"
    return s


def single(n, alt=False, end=True, tag=None):
    t, desc, *_ = CUT[n]
    p = {"id": f"s1-{n:02d}" + (tag or ""), "컷": [str(n)], "길이": length(t), "설명": desc, "샷": [shot(n, end)]}
    if alt:
        p["대안"] = True
    if n in NOTES:
        p["메모"] = NOTES[n]
    p["소리참고"] = None
    return p


def after_cut(cam):
    """두 샷 판의 둘째 샷 — 카메라 초를 컷 뒤 기준으로(4번 판과 같음)"""
    cam = re.sub(r"from 0 s to (\d+(?:\.\d+)?) s", r"from the cut to \1 s after it", cam)
    return re.sub(r"from (\d+(?:\.\d+)?) s to (\d+(?:\.\d+)?) s", r"from \1 s to \2 s after the cut", cam)


def bundle(a, b):
    ta, tb = CUT[a][0], CUT[b][0]
    cut = math.ceil(round((ta + 0.7) * 10, 3)) / 10
    second = shot(b)
    second["카메라"] = after_cut(second["카메라"])
    p = {"id": f"s1-{a:02d}-{b:02d}", "컷": [str(a), str(b)], "길이": math.ceil(round(cut + tb + 0.8, 2)), "자르는초": cut,
         "낱판": [f"s1-{a:02d}", f"s1-{b:02d}"], "설명": f"{CUT[a][1]} → {CUT[b][1]}(두 샷 묶음)", "샷": [shot(a), second]}
    memo = " / ".join(NOTES[n] for n in (a, b) if n in NOTES)
    if memo:
        p["메모"] = memo
    p["소리참고"] = None
    return p


def build():
    inb = {n for ab in BUNDLES for n in ab}
    main, alts = [], []
    for n in range(1, 37):
        if n in inb:
            if any(n == a for a, _ in BUNDLES):
                b = next(b for a, b in BUNDLES if a == n)
                main.append(bundle(n, b))
                alts += [single(n, alt=True), single(b, alt=True)]
            continue
        if n in END_ALT:   # 주판은 시작 그림만(움직임은 글로), 끝 그림 판은 둘째 길
            main.append(single(n, end=False))
            a = single(n, alt=True, tag="e")
            a["설명"] += f" — 둘째 길: 끝 그림 C{n:02d}e로 끝 구도를 잠금(시작 그림만으로 움직임이 모자랄 때)"
            alts.append(a)
            continue
        main.append(single(n))
        if CUT[n][5]:   # 끝 그림 판의 둘째 길 — 끝 그림이 하드컷을 부르면(현장노트 higgsfield) 끝 구도를 글로만
            b = single(n, alt=True, end=False, tag="b")
            b["설명"] = re.sub(r"\(끝 그림 [^)]*\)", "", b["설명"]) + " — 둘째 길: 끝 그림 없이 끝 모습을 글로만(끝 그림 판이 하드컷 · morph가 되면)"
            alts.append(b)
    spec = {
        "메모": ("시즌1 「옆집의 크리스마스」 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-29, 시댄스지시문.py가 만듦). 시작 · 끝 그림은 시댄스그림.py가 "
                 "git 밖 콘티/xmas-neighbors/시댄스/에 모은 것(10-28 확정 이미지 콘티의 받은 판 — 움직이는 컷은 시작 창, 끝 그림은 5 · 30 · 34에만). "
                 "카메라는 02_콘티 2절(원본 25fps 실측) 그대로이고, 02_콘티 11절 「요즘 기법으로 바꾼 컷」만 바꿨다. 동작은 2절 "
                 "「화면」대로 한 가지, 얼굴은 30 · 34뿐(나머지는 뒷모습 · 실루엣 · 손 — 정한 것 ①), 말 · 음악 없음(소리 끔 — 대사는 모두 입이 안 "
                 "보이는 자리라 후시녹음). 같은 곳 · 같은 때 · 같은 사람으로 바로 붙은 컷은 두 샷 한 판으로 묶고 낱판을 「대안」으로 둔다(고정 와이드 "
                 "1 · 12 · 20 · 26 · 35는 합성 판이 정확해야 해 묶지 않음). 끝 그림은 34(같은 구도에서 고개만 돌림)만 주판에 쓰고 끝 그림 없는 둘째 길 34b를, "
                 "구도가 크게 바뀌는 5 · 30은 시작 그림 + 글을 주판으로 끝 그림 판 5e · 30e를 「대안」으로 둔다(시댄스 2.5 조사 — 02_콘티 11절). "
                 "판 「메모」의 「확정 고침」(5 · 11 · 18 · 19 · 21 · 28)은 시댄스 앞 일관성 검수로 고친 그림이고 10-29 유호님이 확정했다(결정 10-29). "
                 "「로고 대기」(14 · 36)는 늘켬 로고를 정한 뒤 시작 그림을 다시 굽는다. 길이 = max(4, ⌈쓰는 초 + 0.8⌉), 묶음은 "
                 "⌈자르는 초 + 둘째 쓰는 초 + 0.8⌉. 꾸러미는 ../../../시댄스무제한/웹꾸러미.py."),
        "편": "s1",
        "이름": "시즌1 「옆집의 크리스마스」",
        "비율": "16:9",
        "그림": IMG,
        "공통": 공통,
        "판": main + alts,
    }
    return spec


if __name__ == "__main__":
    spec = build()
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    main = [p for p in spec["판"] if not p.get("대안")]
    alts = [p for p in spec["판"] if p.get("대안")]
    bund = [p for p in main if len(p["샷"]) > 1]
    print(f"판 {len(spec['판'])} — 주판 {len(main)}(두 샷 묶음 {len(bund)}) · 대안 {len(alts)} · 주판 길이 합 {sum(p['길이'] for p in main)}초 · "
          f"가장 긴 판 {max(p['길이'] for p in spec['판'])}초 · 컷 {sum(len(p['컷']) for p in main)}")
