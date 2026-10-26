# 11번 반려동물 이미지 콘티 지시문(2026-10-26) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록을 만든다.
#   python -X utf8 이미지콘티_지시문.py   → synk-vendor/…/콘티/p11/ego/jobs_p11.json(실행기 gen.mjs가 읽음) · 같은 폴더의 지시문/이미지콘티.json(저장소 사본)
# 길은 6번 「연말 빈방」 · 「매진 임박」 v4(만족 사례 S31)와 같다: 원본 첫 프레임에서 사람 · 개를 지우고 크게 흐린 배치도 위,
# 사람 자리는 검은 실루엣 · 개 자리는 짙은 회색 실루엣(이미지콘티_배치도.py)을 Image 1로 주고, 민재는 캐스팅북 사진 넷, 개는 기준 그림으로 굽는다.
# 개는 컷마다 같은 개체여야 해서 기준 그림(D1 정면 앉음 · D2 옆 서 있음 · D3 조끼 + 선글라스)을 먼저 정하고 모든 개 컷에 넣는다.
# 빛 · 계절은 지시문에 쓰고 받은 색을 그대로 쓴다(장부 공통 원칙 3 — 후보정 없음).
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p11")
R = V / "ego" / "refs"
B = V / "배치"
ref = lambda name: str(R / name)
lay = lambda n: str(B / f"S{n:02d}_배치.png")

TAIL = (" Photorealistic, natural textures, slight film grain, shot on a phone-like wide lens as in a real TikTok video. "
        "No text, no letters, no numbers, no logos, no watermarks anywhere.")
DOG = ("a Xoloitzcuintli (Mexican hairless dog) of standard size, slim and long-legged: smooth hairless slate-grey skin with a few "
       "soft pinkish-grey patches on the chest and belly and tiny dark freckles on the shoulders, a tall fluffy crest of silver-white hair "
       "standing up on top of the head like a messy mohawk, very large upright bat-like ears, almond-shaped amber eyes, a long thin "
       "hairless tail with a small wisp of silver hair at the tip")
DOG_ID = ("The dog must be exactly the same individual dog as in the dog reference images — same slate-grey hairless skin, same pink "
          "patches on the chest, same silver-white mohawk crest, same big upright ears and amber eyes. ")
DEADPAN = ("The dog has a calm, serious, deadpan expression — perfectly still, not wagging, not panting, mouth closed, looking straight "
           "ahead as if posing.")
VEST = ("a bright lemon-yellow dog life jacket with navy-blue trim, two navy-blue grab handles sewn on top of the back (one near the "
        "shoulders, one near the hips), a thin silver reflective stripe along each side, and navy buckle straps under the chest and belly")
SUN = "small blue mirrored dog sunglasses with a thin black frame and an elastic strap behind the ears"
MINJAE_ID = ("Images 1 to 4 are identity references of one Korean man aged twenty-eight — keep his face exactly the same person: a round "
             "soft face, a rounded nose tip, small double eyelids with slightly drooping outer corners, warm-toned skin with a faint beard "
             "shadow on the chin and upper lip, short black hair with messy straight bangs (as in Image 1). An ordinary, friendly "
             "guy-next-door look — not a model or actor look.")
OUTFIT = ("a plain cobalt-blue sleeveless cotton tank top, white cotton shorts above the knee, white crew socks and black running "
          "sneakers, a black sports watch on his left wrist")
ROOM = ("a small, bright Korean one-room studio apartment on a summer afternoon: light wooden floor, white walls, a single bed with a "
        "light-grey and white striped duvet against the wall, a sheer white curtain on a big window, a small potted plant, a tall dark "
        "wooden chair with a folded white bath mat on its seat near the window, and at the far end a short entry hall with a glass "
        "sliding middle door (jungmun) through which daylight comes")

jobs = {
    # ── 기준 그림 ──
    "D1": {"ratio": "3:4", "refs": [],
           "prompt": "Create one photograph. A natural reference photo of one dog, 3:4 frame. The dog is " + DOG + ". It sits upright "
           "facing the camera on a plain light-grey floor in soft daylight from a window on the left, plain off-white wall behind. "
           "The whole dog from the tip of the ears to the paws is in the frame, centered, the head in the upper third. " + DEADPAN + TAIL},
    "P1": {"ratio": "3:4", "refs": [],
           "prompt": "Create one photograph. A clean product photo of one dog life jacket for a medium-size dog, 3:4 frame: " + VEST +
           ". It lies flat on a plain light-grey studio surface, seen from directly above, the back of the jacket facing up so both grab "
           "handles are clearly visible. Soft even studio light. The jacket has no printing at all — no logo, no words, no tags." + TAIL},
    "M1": {"ratio": "3:4", "refs": [ref("M04_hero.jpg"), ref("M04_angle-left.jpg"), ref("M04_angle-right.jpg"), ref("M04_fullbody.jpg")],
           "prompt": "Create one photograph. A natural full-body wardrobe reference photo, 3:4 frame. " + MINJAE_ID + " He wears " + OUTFIT +
           ". Full body from the top of his head to his sneakers, front view, standing relaxed in " + ROOM + ". Calm friendly expression "
           "with closed lips. Bright natural daylight from the window." + TAIL},
    "D2": {"ratio": "3:4", "refs": [ref("D1.jpg")],
           "prompt": "Create one photograph. A natural reference photo of one dog, 3:4 frame. Image 1 is the dog reference. " + DOG_ID +
           "The dog stands on all four legs on a plain light-grey floor, seen exactly from its left side in full profile — head to the "
           "left, tail to the right, the whole body from nose to tail tip and from ear tips to paws in the frame. Soft daylight, plain "
           "off-white wall behind. " + DEADPAN + TAIL},
    "D3": {"ratio": "3:4", "refs": [ref("D1.jpg"), ref("P1.jpg")],
           "prompt": "Create one photograph. A natural reference photo of one dog wearing a life jacket, 3:4 frame. Image 1 is the dog "
           "reference: " + DOG_ID + "Image 2 is the life jacket: " + VEST + " — keep its exact shape, colors and both grab handles. The dog "
           "wears this life jacket, buckled snugly around its chest and belly, and stands on all four legs on a plain light-grey floor, "
           "seen from a three-quarter front-left angle so the face, the jacket and both grab handles on its back are visible. Soft "
           "daylight, plain off-white wall behind. " + DEADPAN + TAIL},
}

# ── 컷(원본 1~9 + 12 → 우리 1~10) ── Image 1은 늘 배치도: 자리 · 크기 · 카메라만 따르고 흐림 · 색 · 실루엣 자체는 옮기지 않는다.
STILL = "Create one still photograph. A vertical 9:16 frame from a warm, funny TikTok-style pet video ad filmed on a phone. "
LAYOUT = ("Image 1 is only a layout guide: a heavily blurred photo where the dark grey silhouette marks where the dog is and the black "
          "silhouettes mark where people are. Keep the camera position and height, the framing, and the exact position, size and pose "
          "of the dog and of the people as in Image 1 — but do not copy its blur, its colors or the flat silhouettes themselves; draw a "
          "real, sharp scene. ")
BEACH = ("Location: a wide sandy beach on the east coast of Korea in the late afternoon of a clear summer day — fine pale sand with "
         "wind ripples, a calm blue sea, a soft blue sky with a few white clouds, the low sun from the side making long soft shadows. ")
INDOOR = ("Location: " + ROOM + ". Light: bright natural summer-afternoon daylight from the big window and through the glass middle "
          "door, white walls, slightly warm and airy, true-to-life colors. ")
M_REFS = lambda *n: [ref(f"M04_{x}.jpg") for x in n]

shots = {
    "S01": {"refs": [lay(1), ref("D2.jpg"), ref("D1.jpg")],
            "prompt": STILL + LAYOUT + BEACH + "Images 2 and 3 are the dog reference. " + DOG_ID + "A close-up of the dog alone on the "
            "beach, standing with the sea behind it, its head and shoulders filling the frame in the same pose and head direction as the "
            "silhouette in Image 1; the wind blows its silver-white crest of hair sideways and it squints its amber eyes against the wind. "
            "Camera: handheld at the dog's eye level, very close." + DEADPAN + TAIL},
    "S02": {"refs": [lay(2), ref("D2.jpg"), ref("D1.jpg")],
            "prompt": STILL + LAYOUT + BEACH + "Images 2 and 3 are the dog reference. " + DOG_ID + "The dog, seen from behind and slightly "
            "from above, has just turned away and walks off toward the right edge of the frame across the sand, its paw prints left behind "
            "in the sand in the lower part of the frame. Camera: handheld, slightly above the dog, close." + TAIL},
    "S03": {"refs": [lay(3), ref("D2.jpg")],
            "prompt": STILL + LAYOUT + BEACH + "Image 2 is the dog reference: " + DOG_ID + "A wide shot down the beach: a trail of paw "
            "prints and footprints runs from the bottom of the frame toward the sea; far away along the trail the small dog trots toward "
            "two distant beachgoers (a young couple in casual summer clothes) near the water, and the two of them take a small step back in "
            "surprise, one raising a hand — tiny figures, their faces not readable. The sky fills the top part of the frame. Camera: "
            "handheld at a walking adult's chest height, following the trail." + TAIL},
    "S04": {"refs": [lay(4)] + M_REFS("hero", "angle-right") + [ref("M1.jpg"), ref("D1.jpg"), ref("P1.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Images 2 and 3 are identity references of the man: " + MINJAE_ID.replace("Images 1 to 4 are identity references of ", "") +
            " Image 4 shows his outfit and his room: he wears " + OUTFIT + ". Image 5 is the dog reference: " + DOG_ID + "Image 6 is the "
            "life jacket. The man stands behind his bed on the right side of the frame, facing the camera, smiling happily with closed "
            "lips, opening a plain brown cardboard shipping box on the bed (no printing on the box) — the bright lemon-yellow life jacket "
            "from Image 6 peeks out of it. On the left, the dog sits upright on the tall dark wooden chair with a folded white bath mat on "
            "its seat, watching the box with its big ears up. Camera: fixed on a tripod at chest height." + TAIL},
    "S05": {"refs": [lay(5)] + M_REFS("angle-left") + [ref("M1.jpg"), ref("D3.jpg"), ref("D1.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Image 2 is an identity reference of the man (his left side): " + MINJAE_ID.replace("Images 1 to 4 are identity references of ", "") +
            " Image 3 shows his outfit and room: he wears " + OUTFIT + ". Images 4 and 5 are the dog and its life jacket: " + DOG_ID +
            "Next to the window, the dog stands calmly on the seat of the tall dark wooden chair (folded white bath mat), and the man, seen "
            "from the side in three-quarter view standing to the left of the chair, is buckling the lemon-yellow life jacket from Image 4 "
            "around the dog's chest with both hands. Calm, concentrated face, closed lips. Camera: fixed at adult eye level, slightly "
            "looking down, showing the man's full body." + DEADPAN + TAIL},
    "S06": {"refs": [lay(6), ref("D3.jpg"), ref("M1.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Image 2 is the dog wearing its life jacket: " + DOG_ID + "Image 3 shows the man's outfit (" + OUTFIT +
            "). The tall dark wooden chair by the window seen from the front: the dog stands on the folded white bath mat on its seat, "
            "wearing the lemon-yellow life jacket, and two hands of the man come in from the right edge of the frame and grip the two navy "
            "grab handles on top of the jacket (a black sports watch on the lower wrist); only his forearms and hands are visible. Camera: "
            "fixed at chair height." + DEADPAN + TAIL},
    "S07": {"refs": [lay(7)] + M_REFS("hero") + [ref("M1.jpg"), ref("D3.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Image 2 is an identity reference of the man: " + MINJAE_ID.replace("Images 1 to 4 are identity references of ", "") +
            " Image 3 shows his outfit (" + OUTFIT + ") and room. Image 4 is the dog wearing its life jacket: " + DOG_ID + "The man now "
            "wears " + SUN.replace("dog sunglasses", "sunglasses for people").replace(" and an elastic strap behind the ears", "") + ". He "
            "stands in front of the glass middle door at the end of the room, full body facing the camera, and lifts the dog off the floor "
            "by the two navy grab handles of its lemon-yellow life jacket like carrying a bag — the dog hangs calmly in the air with its legs "
            "dangling. Backlight from the glass door. Camera: fixed at the man's waist height, full body." + DEADPAN + TAIL},
    "S08": {"refs": [lay(8), ref("M1.jpg"), ref("D3.jpg"), ref("D2.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Image 2 shows the man's outfit (" + OUTFIT + "). Images 3 and 4 are the dog: " + DOG_ID +
            "A low shot at knee height near the glass middle door: we see the man's legs, white shorts, white socks and black sneakers and "
            "the hem of his cobalt tank top at the top of the frame — his hands hold the dog up by the two grab handles of the lemon-yellow "
            "life jacket so the dog hangs between his legs, its paws just above his sneakers, its head turned to the right of the frame. "
            "His face is not in the frame. Camera: fixed at knee height." + DEADPAN + TAIL},
    "S09": {"refs": [lay(9), ref("D3.jpg"), ref("D1.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Images 2 and 3 are the dog: " + DOG_ID + "A close-up of the dog sitting upright on the "
            "folded white bath mat on the tall dark wooden chair, wearing the lemon-yellow life jacket and " + SUN + ", facing the camera "
            "dead-on with the cool, serious look of a model on a magazine cover; in the blue mirrored lenses a tiny dark reflection of a "
            "person holding a phone. The dog's head and chest fill most of the frame. Camera: at the dog's eye level, close." + DEADPAN + TAIL},
    "S10": {"refs": [lay(12)] + M_REFS("hero") + [ref("M1.jpg"), ref("D3.jpg")],
            "prompt": STILL + LAYOUT + INDOOR + "Image 2 is an identity reference of the man: " + MINJAE_ID.replace("Images 1 to 4 are identity references of ", "") +
            " Image 3 shows his outfit (" + OUTFIT + ") and room. Image 4 is the dog wearing its life jacket: " + DOG_ID + "In front of the "
            "glass middle door, the man wears blue mirrored sunglasses and the dog wears matching " + SUN + " and its lemon-yellow life "
            "jacket — a matching-sunglasses duo. The dog stands on the floor; the man, full body facing the camera, bends forward with "
            "both hands on the two grab handles of the jacket, smiling with closed lips. Backlight from the glass door. Camera: fixed at "
            "the man's waist height, full body." + TAIL},
}
# 다시 굽기(1판을 원본 첫 프레임과 견준 뒤) — 이름 끝 b
shots["S01b"] = {"refs": [lay(1), ref("D1.jpg"), ref("D2.jpg")],
                 "prompt": STILL + LAYOUT + BEACH + "Images 2 and 3 are the dog reference. " + DOG_ID + "An extreme close-up of the "
                 "dog's head and neck on the beach, the sea and the horizon behind: the head is turned to the LEFT side of the frame, the "
                 "snout pointing down to the lower left, seen in three-quarter view from its right side; the head and neck fill most of the "
                 "frame — the crest of hair and the tips of the big ears touch the top edge, the neck and the top of the shoulders reach the "
                 "bottom edge. The strong wind blows the silver-white crest of hair sideways, and the dog squints its eyes almost shut "
                 "against the wind, calm and unbothered. The low sun lights its face from the right. Camera: handheld, very close, at the "
                 "dog's eye level." + TAIL}
shots["S03b"] = {"refs": [lay(3), ref("D2.jpg")],
                 "prompt": shots["S03"]["prompt"].replace("the small dog trots toward two distant beachgoers",
                 "the small dog, seen from BEHIND with its back and tail toward the camera, runs AWAY from the camera toward two distant beachgoers")}
shots["S09b"] = {"refs": [lay(9), ref("D3.jpg"), ref("D1.jpg")],
                 "prompt": STILL + LAYOUT + INDOOR + "Images 2 and 3 are the dog: " + DOG_ID + "A tight close-up of the dog sitting upright on "
                 "the folded white bath mat on the tall dark wooden chair: only its head, neck and chest are in the frame — the tips of its big "
                 "ears and the crest touch the top edge, the frame cuts across its chest and front legs at the bottom edge; the head fills "
                 "the top half of the frame. It wears " + SUN + " and the lemon-yellow life jacket from Image 2 strapped around its chest and "
                 "back exactly like in Image 2 (not around the neck), the navy grab handle visible on its back. It faces the camera dead-on "
                 "with the cool, serious look of a model on a magazine cover; in the blue mirrored lenses a tiny dark reflection of a person "
                 "holding a phone. The room behind is soft and out of focus. Camera: at the dog's eye level, very close, slightly from below."
                 + DEADPAN + TAIL}
for k, v in shots.items():
    v["ratio"] = "9:16"
jobs.update(shots)

out = {"_설명": "11번 반려동물 이미지 콘티 지시문 — 이미지콘티_지시문.py가 만든다", **jobs}
(V / "ego").mkdir(parents=True, exist_ok=True)
(V / "ego" / "jobs_p11.json").write_text(json.dumps(jobs, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "지시문").mkdir(exist_ok=True)
(HERE / "지시문" / "이미지콘티.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("작업", len(jobs), "·", ", ".join(jobs))
