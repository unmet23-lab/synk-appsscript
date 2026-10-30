# 로맨스 단편 「다 비침」 이미지 콘티 지시문(2026-10-30) — GPT Image 2.5 Sunburst · max(tools/GPT콘티굽기.mjs, 2048×1152)에 넣을 작업 목록.
#   python -X utf8 이미지콘티_지시문.py            → git 밖 콘티/romance/선버스트/작업.json(굽기가 읽음) · 같은 폴더 지시문/이미지콘티.json(저장소 사본 — 참고는 이름만)
#   python -X utf8 이미지콘티_지시문.py --보기 C02 → 그 컷의 지시문과 참고만 찍는다
# 길은 7번(이미지콘티_지시문.py) · 엔진 비교(콘티/romance/엔진비교/지시문.py)와 같다: 원본 첫 프레임의 사람 자리만 검은 실루엣으로 바꾼 배치도
# (이미지콘티_배치도.py) + 고정 얼굴 세트(유나 F01 · 태준 M02 · 민재 M04) + 장소 기준 그림(L*, 먼저 굽고 고름) + 「비침」 제품 기준 그림(P*).
# 원본 프레임은 넣지 않는다. 얼굴 크기 · 자리는 원본 첫 프레임의 YuNet 상자(원본첫프레임/_얼굴.json)를 「화면 높이의 몇 %」로 적는다.
# 블라인드 심사(10-30 opus)가 짚은 선버스트의 버릇 — 「AI 미녀」(유리알 입술 · 모공 없는 피부 · 인형 비율 · 동그란 보케) · 두 사람 컷에서 사람을 키움 ·
# 우산이 손을 떠 뜸 · 구도를 가깝게 당김 — 을 REAL · SIZE · HOLD · FRAMING 줄로 막고, 받은 판은 이미지콘티_맞춤.py로 원본 얼굴 자리에 잘라 맞춘다.
# 빛은 지시문으로만(후보정 없음, 결정 10-24). 화면 속 글자 · 로고는 굽지 않고 후반에서 얹는다.
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance")
OUT = V / "선버스트"
LORA = "C:/SYNK-LoRA/validation"
facebox = json.load(open(V / "원본첫프레임" / "_얼굴.json", encoding="utf-8"))

START = "Create one still photograph. A cinematic film still from a Korean romance brand film, horizontal 16:9 frame."
LAYOUT = ("Image {n} is a layout guide: the black silhouettes show only where the people are in the frame, how big they are and in what pose "
          "— match that placement, size and pose exactly, including how much of each person is cut off by the frame edges. The silhouettes "
          "have no faces, clothes or colors to copy. Its flat light-grey background is not a wall — ignore it.")
LAYOUT0 = ("Image {n} is a layout guide for the camera framing: match the position, size and angle of every shape in it. Its flat light-grey "
           "background is not a wall — ignore it.")
UMB_LINE = "The thin dark-grey lines in Image {n} mark the rim and the shaft of each open umbrella — match their position, size and tilt."
FOLD_LINE = "The thick grey bar in Image {n} marks the folded umbrella — match its position and angle."
OCC_LINE = ("The flat dark-grey area in Image {n} marks a huge, completely out-of-focus black umbrella of a passer-by right in front of the "
            "lens — a soft dark blur with no detail covering that part of the frame.")
DARK_LINE = "The small dark-grey shape in Image {n} marks Yuna's opaque black umbrella."
ACT = "The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never exaggerated."
REAL = ("REAL PEOPLE, NOT MODELS: matte lips with natural lip texture — no gloss, no glassy shine; real skin with visible pores, fine "
        "texture and small natural unevenness — not airbrushed, porcelain or plastic; natural eye size and real adult proportions — not "
        "doll-like. Keep every face exactly as in that person's identity reference photos and each body build exactly as in their "
        "full-body photo.")
SIZE = ("SIZES: everyone keeps exactly the size shown in the layout guide — do not enlarge anyone and do not bring anyone closer to the "
        "camera. Taejun (184 cm) is about 16 cm taller than Yuna (168 cm).")
HOLD = ("Every umbrella that someone carries is held: a hand grips its handle and the shaft runs from that hand up to the canopy — no "
        "umbrella floats.")
FRAMING = ("FRAMING (most important): output exactly the framing of the layout guide — the same field of view and the same sizes; do not "
           "zoom in, do not crop tighter and do not move the camera closer. If unsure, frame slightly wider, never tighter.")
FLASH = "Keep every person and the action inside the middle 75% of the frame width — the left and right edges will later be covered by black bars."
BLUR = "Background blur is soft and natural like a real lens — no perfectly round glowing bokeh balls."
TAIL = ("Photorealistic film still with natural skin texture, slight film grain and natural lens falloff, shot on a cinema camera. "
        "Nobody in the frame looks into the camera lens. No text, no subtitles, no letters, no numbers, no logos, no signs with writing, "
        "no watermarks anywhere.")

# ── 배역(고정 얼굴 세트) ──
P = {
    "Y": dict(name="Yuna", dir="F01_yuna", refs=["01_hero", "02_left90", "03_right45", "04_fullbody"],
              face="Yuna, a Korean woman in her late twenties: a small face with a slim jaw, dark-brown upturned cat-like eyes with a thin "
                   "natural eyeliner, natural rosy lips, light neutral skin, long dark-brown wavy hair; slim, 168 cm"),
    "T": dict(name="Taejun", dir="M02_taejun", refs=["01_hero", "02_left90", "03_right45", "04_fullbody"],
              face="Taejun, a Korean man in his mid-thirties: thick black hair, tousled and falling forward over his forehead, strong "
                   "straight brows, narrow calm eyes, high cheekbones, a defined jaw with light stubble on the jaw and upper lip, warm lightly "
                   "tanned skin; broad shoulders, 184 cm"),
    "M": dict(name="Minjae", dir="M04_minjae", refs=["01_hero", "02_left90", "03_right90", "04_fullbody"],
              face="Minjae, a Korean man aged 28: small double-eyelid eyes that droop slightly at the outer corners, a round face with soft "
                   "cheeks, a rounded nose tip, a soft rounded jaw, warm-toned skin with a faint five o'clock shadow, short black hair with "
                   "messy straight bangs; average build, 175 cm"),
}
ID_TAIL = "Ignore the backgrounds, clothing and lighting of the identity reference photos. Do not add moles, freckles, marks, tattoos, text or logos."

# ── 옷 · 머리(시작 편 = 하루 · 끝 편 = 이별 날과 그 앞날들, 02_콘티 1절) ──
W = {
    "Y1": ("Yuna wears a soft blush-pink chunky knit cardigan over a crisp white collared blouse and cream wide-leg trousers, small gold stud "
           "earrings; her hair is pulled back into a low ponytail with a few loose strands framing her face."),
    "Y2": ("Yuna wears a taupe (greige) tailored blazer over a plain black knit top and black trousers, small gold stud earrings; her long "
           "wavy hair is worn down past her shoulders."),
    "T1o": "Taejun wears a white dress shirt with a slim dark-navy tie and charcoal-grey trousers, and a smartwatch with a black strap on his left wrist.",
    "T1n": ("Taejun wears a white dress shirt with no tie — the top button open and the sleeves rolled to the elbows — charcoal-grey "
            "trousers, and a smartwatch with a black strap on his left wrist."),
    "T2": ("Taejun wears an unstructured navy jacket over a plain white crew-neck T-shirt, charcoal-grey trousers and black leather shoes, "
           "a smartwatch with a black strap on his left wrist."),
    "T2h": ("Taejun wears an unstructured navy jacket over a plain white crew-neck T-shirt and charcoal-grey trousers, a smartwatch with a "
            "black strap on his left wrist, and black over-ear headphones on his head."),
    "M": "Minjae wears a beige knit sweater vest over a white collared shirt and navy trousers.",
    # 끝 편 앞날(C41–C48) — 이별 날(재킷)과 갈리게(원본도 41–48 흰 셔츠 · 49 뒤 재킷, Fable P1)
    "Y2o": "Yuna wears a plain white silk blouse and dark-grey slacks, small gold stud earrings; her long wavy hair is worn down past her shoulders.",
    "T2o": "Taejun wears a pale-blue dress shirt with a slim charcoal tie and grey trousers, and a smartwatch with a black strap on his left wrist.",
    "T2oh": ("Taejun wears a pale-blue dress shirt with a slim charcoal tie and grey trousers, a smartwatch with a black strap on his left wrist, and "
             "black over-ear headphones on his head."),
    "M2": "Minjae wears a dark-green knit sweater vest over a white collared shirt and navy trousers.",
}

# ── 우산 ──
CLEAR = ("a premium clear umbrella — a crystal-clear, glass-like canopy that is perfectly see-through (not cloudy or milky vinyl), thin "
         "silver metal ribs, and a slim straight handle of clear acrylic ending in a small frosted milky-white cap; no logo, no text, no pattern")
BLUE = ("the same premium umbrella in a new color — a misty pale-blue tinted canopy that is still see-through, thin silver ribs, a slim straight "
        "clear acrylic handle ending in a small frosted milky-white cap; no logo, no text")
BLACK = "a plain opaque black umbrella — black canopy, black handle, no logo"
CHEAP = "ordinary cheap convenience-store umbrellas with cloudy milky-white vinyl canopies and white plastic hook handles"

# ── 장소 ──
L = {
    "store_n": ("Location: a small corner convenience store on a quiet Seoul side street at night in the rain — big bright shop windows (white "
                "fluorescent light inside, plain shelves, posters with no writing), a cream-colored awning over the entrance with a plain glowing "
                "band and no letters, a glass door, a bicycle leaning on the wall, a glowing drink vending machine, a street lamp; rain pours off "
                "the edge of the awning; the wet dark asphalt mirrors pink, white and cyan light."),
    "store_d": ("Location: the same small corner convenience store in the daytime rain — the same big windows and cream awning, the fluorescent "
                "light inside dim against the grey daylight, an overcast sky, wet pale pavement, green street trees across the road."),
    "store_in": (f"Location: inside the convenience store — a tall, freestanding, open-backed umbrella display stand about as tall as a person "
                 f"(you can see through it from either side), with several rows of hooks at eye level and below where folded umbrellas hang by their "
                 f"handles: most are {CHEAP}, and one clearly separate section holds the premium clear umbrellas with silver ribs and straight clear "
                 "acrylic handles; behind, glass-door drink fridges and shelves of snacks in plain packaging with no readable writing, softly out of focus."),
    "office": ("Location: a modern Seoul open-plan office in the daytime — low frosted-glass partitions between white desks, black monitors, "
               "grey mesh chairs, big windows."),
    "elev": ("Location: inside an office-building elevator — warm walnut wood-panel walls, brushed-steel sliding doors, a slim steel handrail, a "
             "small steel button panel with round buttons (no readable numbers or letters)."),
    "pub": ("Location: a cozy Korean pub at night — dark wooden tables crowded with plain beer glasses with no logos and small plates of side "
            "dishes, warm orange incandescent pendant lamps, wooden walls, other customers out of focus in the background."),
    "street_n": "Location: a dark Seoul side street at night in heavy rain — wet asphalt, dark building walls, blue-teal street lamps glowing through the rain.",
    "street_d": ("Location: a tree-lined sidewalk in Seoul in the daytime rain — wet grey pavement, green street trees, a low wall, parked white "
                 "vans out of focus in the background."),
    "puddle_n": "Location: a rain puddle on dark asphalt in front of the convenience store at night, mirroring pink, purple and gold neon light.",
    "puddle_d": "Location: wet pale-grey pavement with a shallow rain puddle in the daytime, overcast.",
    "puddle_sky": "Location: a shallow rain puddle on a pavement after the rain, mirroring a clear blue sky with white clouds; a strip of dry concrete at the bottom.",
    "avenue": "Location: a quiet tree-lined street in Seoul just after the rain — wet pavement, lush green trees, a pale building at the left.",
    "card": "Location: none — a vertical sheet of glass beaded with raindrops, softly fogged at its edges, in front of a soft teal-cyan background.",
}
LIGHT = {
    "night": ("Light: a rainy night on a Seoul side street. Cool teal-cyan ambient light from the street and the wet glass, a soft pink neon "
              "glow from the shop window, warm white fluorescent spill from inside the shop; moody contrast, the faces softly lit but never "
              "flat or overexposed."),
    "office": "Light: bright, cool daylight from the big windows, a slightly cool teal-white office palette, soft and clean.",
    "elev": "Light: warm, dim light in the elevator — the walnut panels glow amber, a soft warm top light on the faces, darker corners.",
    "pub": "Light: warm orange incandescent pendant lamps, dark warm surroundings, soft amber light on the faces.",
    "street_n": "Light: night rain lit by cold blue-teal street lamps behind the rain; dark and moody; raindrops catch the light.",
    "store_in": "Light: cool teal-white fluorescent light inside the store, clean and slightly cold, with a faint pink reflection on the glass.",
    "day": ("Light: a grey, overcast rainy day — soft, cool, even daylight with no sun, muted blue-grey tones, the faces softly and evenly lit "
            "(not dark)."),
    "sun": "Light: the rain has just stopped — bright, warm afternoon sunlight breaking through, wet surfaces sparkling, fresh green leaves.",
    "card": "Light: soft, bright teal-cyan light through wet glass; a clean, airy product-advert look.",
    "splash_n": "Light: night, the puddle lit by pink and teal neon; a strong pink glow flares across the frame.",
    "splash_d": "Light: soft grey daylight, the wet pavement bright and pale.",
}
# 장소 기준 그림(먼저 굽고 고른다) — 넓은 컷에만 넣는다(7번 10-26: 넓은 장소 그림이 가까운 컷을 넓게 끈다)
LOCJ = {
    "L1": ("store_n", "night", "Wide establishing shot from across the wet street at about knee height: the whole storefront, the awning, the glass "
                               "door in the middle, the bicycle at the left, the vending machine at the right, rain pouring off the awning."),
    "L2": ("store_d", "day", "Wide establishing shot from across the wet street at about knee height: the whole storefront and awning in the "
                             "grey daytime rain, the glass door in the middle, the vending machine at the right."),
    "L3": ("store_in", "store_in", "Medium-wide shot inside the store at standing eye height: the open-backed umbrella display stand in the middle "
                                   "of the frame, the drink fridges behind it, the edge of the counter at the right."),
    "L4": ("office", "office", "Wide shot of the empty office at standing eye height down an aisle between rows of desks and low frosted-glass partitions."),
    "L5": ("elev", "elev", "Straight-on full view into the empty elevator through its open doors, from about 2 m outside."),
    "L6": ("pub", "pub", "Wide shot of the pub interior at seated eye height: a long wooden table in the middle with glasses and side dishes, "
                         "pendant lamps above, a wooden wall behind."),
}
LREF = {"store_n": "L1", "store_d": "L2", "store_in": "L3", "office": "L4", "elev": "L5", "pub": "L6"}
LNAME = {"store_n": "convenience store at night", "store_d": "convenience store in the daytime", "store_in": "store interior",
         "office": "office", "elev": "elevator", "pub": "pub"}
# 제품 기준 그림 — 「비침」의 생김새를 컷마다 같게
PJ = {
    "P1": f"Product reference photo on a seamless light-grey studio background: one {CLEAR} — shown twice, open at the left (three-quarter view "
          "from slightly above; ONE single-layer dome canopy, no inner second layer, a few raindrops on it) and folded upright at the right (the slim "
          "clear handle and frosted cap clearly visible).",
    "P2": f"Product reference photo on a seamless light-grey studio background: one umbrella, {BLUE} — shown twice, open at the left (three-quarter "
          "view from slightly above) and folded upright at the right.",
}


BIAS = 0.82   # 10-30 시험: 얼굴이 화면 40% 아래인 미디엄 · 두 사람 컷은 선버스트가 원본보다 1.27배 가깝게 그렸다(C12) — 조금 작게 적고 맞춤으로 잘라 맞춘다


def framing(fk, idx, who):   # 원본 첫 프레임의 얼굴 상자 → 화면 안 자리 · 크기(현장 노트 「클로즈업은 화면 안 경계로」)
    fs = (facebox.get(fk) or {}).get("얼굴") or []
    if len(fs) <= idx:
        return ""
    f = dict(fs[idx])
    cy = f["y"] + f["h"] / 2   # 꽉 찬 클로즈업도 C05(0.528 → 0.638)처럼 당겨 올 때가 있어 조금(0.9) 작게, 미디엄은 더(BIAS) 작게 적는다
    f["h"] *= BIAS if f["h"] < 0.4 else 0.9
    f["y"] = cy - f["h"] / 2
    top = f["y"] - 0.55 * f["h"]           # 정수리(상자 위는 눈썹 언저리)
    chin = f["y"] + f["h"]
    head = ("the top of the head is cut off by the top edge of the frame" if top < 0.01
            else f"the top of the head is about {round(top * 100)}% down from the top edge")
    size = ("a tight close-up" if f["h"] >= 0.4 else "a close-up" if f["h"] >= 0.3 else "a medium close-up (head and shoulders)"
            if f["h"] >= 0.2 else "a medium shot" if f["h"] >= 0.12 else "a wide shot")
    return (f"Shot size — follow exactly, this is {size}: {who} face (brows to chin) is about {round(f['h'] * 100)}% of the frame height "
            f"and centered about {round(f['가운데x%'])}% across from the left edge; {head}; the chin is about {round(chin * 100)}% down "
            "from the top edge.")


# ── 컷마다 ──
# f: 얼굴 참고(앞 사람 넷 · 다음 사람 둘, 둘 다 크면 넷 · 넷), w: 옷 열쇠, loc · light, t: 구도 · 몸짓(영어), fx: (얼굴 순번, 소유격) 또는 None,
# p: 제품 참고(P1 · P2), noloc: 장소 그림을 넣지 않음, fk: 얼굴 상자 열쇠(기본 컷 번호)
NIGHT_SHOP = "Behind: the lit shop window and a pale pillar glowing pink from the neon, softly out of focus; rain falls beyond the awning."
C = {
    # ── 시작 편 ① 현재 — 물음 ──
    "C01": dict(f="Y", w=["Y1"], loc="store_n", light="night", fx=None, p=["P1"],
                t=("Wide establishing shot from across the wet street at about knee height, locked off: the convenience store fills the left half "
                   "of the frame — bright windows, the cream awning, a bicycle leaning on the wall at the far left; rain pours off the awning "
                   "edge. Yuna stands under the awning by the shop, very small in the frame (about a quarter of the frame height from head to "
                   "feet), centered about 50% across, a folded clear umbrella in her hand; Taejun has just stepped out of the glass door a few "
                   "steps to her right (about 62% across), a folded clear umbrella in his hand, walking over to her. Nothing is in front of the "
                   "lens. The wet asphalt in the foreground mirrors pink, white and cyan light.")),
    "C01e": dict(f="YT", w=["Y1", "T1n"], loc="store_n", light="night", fx=None, p=["P1"], fk="01_끝",
                 t=("The same wide shot a moment later, locked off: Yuna (left, about 50% across) and Taejun (right, about 55% across) now "
                    "stand side by side under the convenience-store awning, very small in the frame (each about a quarter of the frame height "
                    "head to feet), both facing the street; each holds a folded clear umbrella. The store fills the left half of the frame. "
                    "Nothing is in front of the lens.")),
    "C02": dict(f="Y", w=["Y1", "T1n"], loc="store_n", light="night", fx=(0, "her"),
                t=("Close-up over Taejun's right shoulder at night under the convenience-store awning: the soft, out-of-focus blur of his white "
                   "shirt shoulder fills the lower right corner of the frame. Yuna faces him, her face turned a little toward the right of frame; "
                   "she has just looked up at him and asks a quiet, direct question — lips slightly parted, steady eyes lifted toward the right "
                   f"of frame at him, a hint of a knowing smile. {NIGHT_SHOP}")),
    "C03": dict(f="T", w=["T1n", "Y1"], loc="store_n", light="night", fx=(0, "his"),
                t=("Close-up over Yuna's left shoulder at night under the awning: the out-of-focus back of her dark hair and her blush-pink "
                   "cardigan shoulder fill the left edge of the frame. Taejun faces her, looking down toward the left of frame at her — caught "
                   "off guard, silent, lips closed, eyes a little wider. Behind him: blurred pink neon and the lit shop window.")),
    "C04": dict(f="Y", w=["Y1", "T1n"], loc="store_n", light="night", fx=(0, "her"),
                t=("Close-up over Taejun's right shoulder (the out-of-focus blur of his white shirt shoulder in the lower right corner): Yuna "
                   "asks him again, more firmly — lips parted mid-word, her eyes holding his toward the right of frame, no smile now, her chin "
                   f"lifted slightly. {NIGHT_SHOP}")),
    "C05": dict(f="T", w=["T1n"], loc="store_n", light="night", fx=(0, "his"),
                t=("Close-up of Taejun alone, seen slightly from his left, facing the left of frame: flustered, lips slightly parted as if about "
                   "to speak but no words come, his eyes starting to drop. Behind him a band of soft pink neon light out of focus.")),
    # ② 제목 카드
    "C06": dict(f="", w=[], loc="card", light="card", fx=None, p=["P1"],
                t=(f"Product title shot, locked off: behind a vertical sheet of glass beaded with raindrops, one open {CLEAR} stands upright on "
                   "its tip, tilted slightly, in the left third of the frame — its canopy spans from about 22% to 50% across and its straight "
                   "clear handle reaches down to about 85% from the top. The right half of the frame is empty glass with soft teal-cyan light, "
                   "left clean for a title.")),
    # ③ 회상 — 사무실
    "C07": dict(f="TM", w=["T1o", "M"], loc="office", light="office", fx=None, flash=True,
                t=("Wide shot of the open-plan office, locked off at standing eye height: Taejun sits at his desk in the left-middle of the frame "
                   "(his head about 36% across and 49% down, small — about 11% of the frame height), turned toward the right; Minjae leans over "
                   "the low frosted-glass partition in the upper right (his head about 68% across and 27% down), forearms folded on top of it, "
                   "grinning as he asks Taejun something. Desks, monitors and partitions in between.")),
    "C08": dict(f="T", w=["T1o"], loc="office", light="office", fx=(0, "his"), flash=True,
                t=("Medium shot of Taejun at his desk seen across a low frosted-glass partition, locked off: he sits at the right of the frame, "
                   "turned toward the left of frame where Minjae is (off screen), answering evasively with a small shrug, lips parted mid-word; "
                   "his eyes drift toward the left foreground. The lower part of the frame is the out-of-focus partition and the desk in front.")),
    # ④ 엘리베이터
    "C09": dict(f="T", w=["T1o"], loc="elev", light="elev", fx=None, flash=True,
                t=("Full shot into the elevator from just outside, locked off: Taejun stands alone in the middle of the walnut-paneled elevator "
                   "(about 40% across; his head about 18% from the top, his body down to the bottom edge), hands in his trouser pockets, looking "
                   "down. The brushed-steel doors are sliding shut from both sides — their dark edges already cover the left and right parts of "
                   "the frame.")),
    "C10": dict(f="", w=["T1o"], loc="elev", light="elev", fx=None, flash=True, noloc=True,
                t=("Insert close-up of the elevator's steel button panel on the walnut wall, locked off: two round steel buttons with no readable "
                   "symbols in the left-middle of the frame; Taejun's hand in a white shirt cuff is just entering from the right edge, reaching "
                   "quickly for the door-open button.")),
    "C11": dict(f="T", w=["T1o", "Y1"], loc="elev", light="elev", fx=None, flash=True,
                t=("Full shot from just outside the elevator, locked off: the brushed-steel doors are opening again — through the gap in the "
                   "middle we see Taejun inside, his arm stretched out holding the door; Yuna, out of focus and dark, is stepping in from the "
                   "right edge of the frame.")),
    "C11e": dict(f="TY", w=["T1o", "Y1"], loc="elev", light="elev", fx=None, flash=True, fk="11_끝",
                 t=("Full shot straight into the elevator, locked off: Taejun (left, head about 43% across and 27% down) and Yuna (right, head "
                    "about 60% across and 38% down) stand side by side inside the walnut-paneled elevator facing the open doors, a small gap "
                    "between them, both looking ahead politely; she has just stepped in and turned around. We see them from head to knees.")),
    "C12": dict(f="TY", w=["T1o", "Y1"], loc="elev", light="elev", fx=(0, "Taejun's"), flash=True, big=True,
                t=("Medium two-shot straight on inside the elevator, locked off: Taejun stands on the left and Yuna on the right, a bit lower "
                   "(her face about 66% across and 61% down, about 22% of the frame height). She turns her face slightly toward him and says "
                   "thank you with a small polite nod, lips parted mid-word; he gives a small stiff nod back, eyes lowered. Walnut wall behind.")),
    "C13": dict(f="T", w=["T1o"], loc="elev", light="elev", fx=(0, "his"), flash=True,
                t=("Close-up of Taejun in profile facing the left of frame inside the elevator, warm walnut wall behind: tense, jaw set, his "
                   "eyes sliding sideways toward the right of frame where Yuna stands (off screen) — a stolen glance.")),
    # ⑤ 회식
    "C14": dict(f="TM", w=["T1n", "M"], loc="pub", light="pub", fx=None, p=["P1"], flash=True,
                t=("Wide shot across the Korean pub at seated eye height: on the far side of a long wooden table in the middle of the frame, "
                   "Taejun (left, head about 40% across) and Minjae (right, head about 55% across) sit side by side facing the camera, both small "
                   "(heads about 10% of the frame height, 41% down); Minjae leans toward Taejun with a teasing grin; Taejun laughs and raises "
                   "one hand to wave it off. The table is crowded with plain beer glasses and small plates. At the right, other customers out "
                   "of focus. In the foreground, the out-of-focus backs of red leather bench seats; a folded clear umbrella hangs from one bench back, "
                   "a drop of water at its tip.")),
    "C14e": dict(f="TM", w=["T1n", "M"], loc="pub", light="pub", fx=(0, "Taejun's"), flash=True, big=True, fk="14_끝",
                 t=("Medium close two-shot at the pub table, the end of a slow push-in: Taejun (left) laughs and waves his raised hand in "
                    "denial, half-turned toward Minjae; Minjae (right, face about 61% across and 50% down, about 27% of the frame height) grins "
                    "at him. Plain beer glasses on the table before them.")),
    "C15": dict(f="", w=["T1n"], loc="pub", light="pub", fx=None, flash=True, noloc=True,
                t=("Insert close-up of Taejun's left wrist resting near the wooden table edge, handheld with a very slight shake: a smartwatch "
                   "with a black strap, its dark screen showing one plain glowing pink heart icon (no numbers, no text); his other hand is just "
                   "coming in from the left edge to cover it. Warm orange blur behind.")),
    "C16": dict(f="Y", w=["Y1"], loc="pub", light="pub", fx=(0, "her"), flash=True,
                t=("Medium close-up of Yuna seated at the pub table at the right of the frame, holding a glass of beer near her chest with "
                   "her right hand at the left; her head is still lowered toward the glass, about to lift and look across toward the left of "
                   "frame at Taejun (off screen) — a quiet, searching look. Dark warm background with an orange lamp.")),
    "C17": dict(f="TM", w=["T1n", "M"], loc="pub", light="pub", fx=(0, "Taejun's"), flash=True, big=True,
                t=("Medium close-up two-shot at the pub table: Taejun (left) holds his left wrist with his right hand, covering the watch, and "
                   "awkwardly looks away toward the lower right; Minjae beside him (right, face about 67% across and 46% down) laughs, "
                   "unaware. Plain beer glasses on the table.")),
    # ⑥ 빗길 — 우산 하나
    "C18": dict(f="T", w=["T1n"], loc="street_n", light="street_n", fx=None, p=["P1"], flash=True,
                t=("Seen from behind at shoulder height, very close, on a dark street in heavy rain at night: Taejun's back and shoulders fill "
                   "the middle of the frame (from about 27% to 87% across), the back of his head near the top edge, under one open clear "
                   "umbrella whose canopy edge crosses the top right of the frame. His white shirt is soaked and translucent on his left "
                   "shoulder. Rain streaks, blue-teal street lamps blurred beyond.")),
    "C18e": dict(f="TY", w=["T1n", "Y1"], loc="street_n", light="street_n", fx=None, p=["P1"], flash=True,
                 t=(f"Seen from behind at shoulder height on a dark street in heavy rain at night: Taejun (left of center, his back to the "
                    f"camera, head turned slightly toward her — his head about 43% across) and Yuna (right, her back three-quarters to us, low "
                    f"ponytail visible — her head about 79% across) walk close together under ONE shared umbrella, {CLEAR}. Taejun's right hand grips the handle "
                    "at chest height between them and tilts the umbrella far over to her side: the center of the canopy is over Yuna's head and "
                    "Taejun's left shoulder is outside the canopy in the rain — the white shirt there is dark and soaked through. The open canopy is "
                    "big and close to the camera: it spans the top of the frame from about 30% to 87% across. Both are seen from the waist up; "
                    "the frame is not wider than that. Raindrops on the clear canopy sparkle with blurred teal "
                    "and white street lights.")),
    # ⑦ 편의점
    "C19": dict(f="YT", w=["Y1", "T1n"], loc="store_n", light="night", fx=(0, "Yuna's"), p=["P1"], flash=True,
                t=("Medium two-shot under the convenience-store awning at night, locked off: Yuna in front (right of center) tucks wet strands "
                   "of hair behind her ear, glancing down; behind her at the left, Taejun (head about 28% across and 32% down, smaller) shakes "
                   "the rain off his soaked left shoulder with one hand, a folded clear umbrella in the other. Behind them the bright shop "
                   "window with a softly glowing pink neon shape with no letters.")),
    "C20": dict(f="YT", w=["Y1", "T1n"], loc="store_n", light="night", fx=None, flash=True, noloc=True,
                t=("Close-up of Yuna in profile facing the right of frame, her face in the middle of the frame (about 45–62% across, the profile "
                   "filling about 70% of the frame height), very close to the convenience-store window at night, peering inside and muttering "
                   "to herself, lips parted; the glass throws soft blue and teal light on her. Behind her at the left, out of focus, Taejun "
                   "stands watching her. Focus on Yuna.")),
    "C21": dict(f="Y", w=["Y1"], loc="store_in", light="store_in", fx=None, flash=True,
                t=("Over Yuna's shoulder from behind inside the store: the out-of-focus back of her head and shoulder fill the upper left of the "
                   f"frame; she faces the umbrella rack, which fills the rest of the frame in rows — {CHEAP}, and one clearly separate section of "
                   "the premium clear umbrellas with crystal-clear canopies, silver ribs and straight clear acrylic handles. Shallow focus on the rack.")),
    "C22": dict(f="YT", w=["Y1", "T1n"], loc="store_in", light="store_in", fx=None, flash=True, noloc=True,
                t=("Medium close-up two-shot in profile, seen through the umbrella rack: out-of-focus umbrella handles and canopies blur across "
                   "the lower and middle foreground. Taejun's profile at the left (his head about 34% across, facing right) and Yuna's profile "
                   "at the right (her head about 76% across, facing left); she turns toward him with a curious, half-smiling question, lips "
                   "parted mid-word.")),
    "C23": dict(f="TY", w=["T1n", "Y1"], loc="store_in", light="store_in", fx=(0, "Taejun's"), p=["P1"], flash=True,
                t=("Medium close-up of Taejun in profile facing the left of frame at the left of the frame, embarrassed, rubbing his ear with "
                   "his hand, eyes lowered; behind him at the right, out of focus, Yuna reaches up and pulls one premium clear umbrella off the "
                   "rack. Teal fluorescent light; the edge of a glass fridge door at the right.")),
    # ⑨ 현재 — 들킴
    "C24": dict(f="Y", w=["Y1", "T1n"], loc="store_n", light="night", fx=(0, "her"),
                t=("Close-up over Taejun's shoulder at night under the awning: the out-of-focus blur of his white shirt shoulder and arm fills "
                   "the right edge of the frame. Yuna, left of center, looks up at him and asks again, gently and directly, lips parted mid-word. "
                   f"{NIGHT_SHOP}")),
    "C25": dict(f="T", w=["T1n"], loc="store_n", light="night", fx=(0, "his"),
                t=("Close-up of Taejun under the awning at night, handheld with a very slight shake: flustered, he drops his gaze and mumbles "
                   "something evasive, lips slightly parted mid-word. Pink neon glow behind.")),
    "C26": dict(f="YT", w=["Y1", "T1n"], loc="store_n", light="night", fx=None, p=["P1"],
                t=("Wide establishing shot from across the wet street at about knee height, locked off, the same view as the opening shot but "
                   "with nothing in front of the lens: the convenience store, its awning and the bicycle at the left; Yuna and Taejun stand side "
                   "by side under the awning about 57–60% across, very small (each about a quarter of the frame height head to feet), each "
                   "holding a folded clear umbrella. Rain pours off the awning; the wet asphalt mirrors pink, white and cyan light.")),
    "C27": dict(f="YT", w=["Y1", "T1n"], loc="store_n", light="night", fx=(1, "Yuna's"),
                t=("Close two-shot side by side under the awning at night: Taejun in the right foreground, out of focus, in profile facing left; "
                   "Yuna beyond him in the middle of the frame, in focus, smiling to herself and then turning her head toward him to point "
                   "something out, lips parted mid-word. Teal and pink light.")),
    "C28": dict(f="T", w=["T1n"], loc="store_n", light="night", fx=(0, "his"), p=["P1"], noloc=True,
                t=("Close-up of Taejun under the awning at night, chest up: he has lifted his folded clear umbrella to chest height in his left hand "
                   "— its straight clear handle and frosted milky cap in the lower left of the frame — and glances from it down to his own soaked "
                   "left shoulder (the white shirt there dark and see-through with rain); a sheepish, caught-out look, mouth closed. Pink and white light.")),
    "C29": dict(f="Y", w=["Y1"], loc="store_n", light="night", fx=(0, "her"), noloc=True,
                t=("Close-up of Yuna under the awning at night, slightly from her left: she lifts her head and smiles warmly as she finishes "
                   "speaking, lips parted mid-word, eyes on Taejun toward the left of frame (off screen). Her low ponytail falls over her "
                   "shoulder. Blurred dark street and teal light behind.")),
    "C30": dict(f="", w=["Y1", "T1n"], loc="store_n", light="night", fx=None, noloc=True,
                t=("Insert of hands at about hip height, locked off: Taejun's empty right hand hangs by his side (white rolled-up sleeve, the "
                   "edge of his charcoal trousers); Yuna's hand (a blush-pink knit cuff) comes in from the left, about to slip into his — a small "
                   "gap between their fingers, not touching yet. Pink and dark-violet light.")),
    "C31": dict(f="T", w=["T1n"], loc="store_n", light="night", fx=(0, "his"), noloc=True,
                t=("Close-up of Taejun from slightly below, handheld with a very slight shake: he looks down at Yuna (off screen) with surprised, "
                   "widened eyes, lips just parted. Pink and white light.")),
    # ⑩ 제품 · 끝
    "C32": dict(f="", w=[], loc="puddle_n", light="splash_n", fx=None, p=["P1"],
                t=("High-speed product shot, low and close to the wet ground: two folded clear umbrellas lie on their sides in a shallow neon-lit "
                   "puddle on dark asphalt, one rolling into the other just as they knock together — a crown of water splashes up between them, frozen droplets sparkling "
                   "pink and teal. The umbrellas fill the middle of the frame from left to right.")),
    "C33": dict(f="", w=[], loc="puddle_n", light="splash_n", fx=None,
                t=("Insert looking down into a rain puddle at night: rippling water full of smeared pink, purple and gold neon and shop-window light; "
                   "two small, very blurry dark shapes are only just suggested in the reflection — nobody is recognizable, no faces.")),
    "C34": dict(f="TY", w=["T1n", "Y1"], loc="store_n", light="night", fx=None, noloc=True,
                t=("Medium two-shot in profile under the awning at night, locked off: Taejun at the left (about 30% across) takes Yuna's arm "
                   "gently and steps closer; Yuna at the right (her face about 57% across and 53% down) faces him, looking up; the two face each "
                   "other a hand's breadth apart, both seen from the waist up. Soft pink light blooms across the frame.")),

    # ── 끝 편 ① 현재 — 마주 섬(낮비) ──
    "C35": dict(f="YT", w=["Y2", "T2"], loc="store_d", light="day", fx=None, p=["P1", "P2"],
                t=(f"Full shot from a low angle with the camera tilted (a Dutch angle, the horizon sloping down to the left), locked off, in "
                   f"front of the same convenience store in the daytime rain: at the left of center, Taejun seen from behind under an open {CLEAR} "
                   f"held up in his right hand, and in his left hand a folded umbrella with a misty pale-blue canopy; facing him at about 51% "
                   f"across, Yuna stands under {BLACK}, her face in its shadow, looking at him. Grey sky, the storefront at the right.")),
    "C36": dict(f="Y", w=["Y2"], loc="store_d", light="day", fx=(0, "her"), noloc=True,
                t=(f"Close-up of Yuna under {BLACK} in the daytime rain: the black canopy shows only as a dark rim along the top edge of "
                   "the frame; her face is softly lit by the grey sky and clearly visible; calm and sad, she speaks quietly, lips parted mid-word, looking at "
                   "Taejun toward the right of frame. Rain and grey street out of focus behind.")),
    "C37": dict(f="T", w=["T2"], loc="store_d", light="day", fx=(0, "his"), p=["P1"], noloc=True,
                t=("Medium close-up of Taejun from a low angle under his open clear umbrella in the daytime rain: through the crystal-clear "
                   "canopy above him we see the grey sky and green treetops; his face is fully visible, silent, looking down at Yuna toward the "
                   "left of frame. The umbrella shaft runs up at the right edge from his hand.")),
    "C38": dict(f="TY", w=["T2", "Y2"], loc="store_d", light="day", fx=(0, "his"), noloc=True,
                t=("Close two-shot in the daytime rain: Taejun at the left under his clear umbrella, in focus, looking at Yuna; Yuna in the right "
                   "foreground, very close to the lens and out of focus — the back of her dark hair and her cheek fill "
                   "the right half of the frame.")),
    "C39": dict(f="T", w=["T2"], loc="store_d", light="day", fx=(0, "his"), noloc=True,
                t=("Close-up of Taejun under his clear umbrella in the daytime rain, handheld with a very slight shake: raindrops bead on the "
                   "clear canopy just above his head; his eyes redden and grow wet, but he holds it in, lips pressed together.")),
    # ② 제목 카드(글자 없음)
    "C40": dict(f="", w=[], loc="card", light="card", fx=None, p=["P2"],
                t=(f"Product title shot, locked off: behind a vertical sheet of glass beaded with raindrops, one open umbrella — {BLUE} — "
                   "stands upright on its tip, tilted slightly, in the left third of the frame (its canopy spans from about 22% to 50% across). "
                   "The right half of the frame is empty glass with soft teal-cyan light.")),
    # ③ 회상 — 사무실
    "C41": dict(f="TM", w=["T2o", "M2"], loc="office", light="office", fx=None, flash=True,
                t=("Wide shot of the open-plan office, locked off at standing eye height (the same view as before): Taejun sits at his desk in the "
                   "left-middle (his head about 38% across and 55% down, small — about 11% of the frame height); Minjae leans over the low "
                   "frosted-glass partition in the upper right (his head about 69% across and 23% down), asking Taejun something with a "
                   "suspicious grin.")),
    "C42": dict(f="YT", w=["Y2o", "T2o"], loc="office", light="office", fx=(0, "Yuna's"), flash=True, big=False,
                t=("Two-shot in the office, locked off: Yuna in the right foreground, close to the lens (her face about 64% across and 34% down, "
                   "large — about 43% of the frame height), seated at her desk, eyes lowered, cool and closed off; Taejun in the background at "
                   "the left (his head about 38% across, small), seated at his desk, turning to look at her. Focus on Taejun at first.")),
    # ④ 엘리베이터
    "C43": dict(f="T", w=["T2oh"], loc="elev", light="elev", fx=None, flash=True,
                t=("Full shot straight into the elevator, locked off: Taejun stands inside wearing headphones (his head about 44% across and 26% "
                   "down), and stretches out his arm to hold the steel door for someone; the doors are open.")),
    "C43e": dict(f="TY", w=["T2oh", "Y2o"], loc="elev", light="elev", fx=None, flash=True, fk="43_끝",
                 t=("Full shot straight into the elevator, locked off: Taejun with headphones on (left, head about 43% across and 26% down) and "
                    "Yuna (right, head about 64% across and 39% down) stand side by side, a little apart, facing the doors; she does not look at "
                    "him.")),
    "C44": dict(f="Y", w=["Y2o", "T2oh"], loc="elev", light="elev", fx=(0, "her"), flash=True,
                t=("Medium close-up over Taejun's shoulder inside the elevator: his pale-blue shirt shoulder and the edge of his jaw, out of focus, fill "
                   "the left edge of the frame. Yuna, right of center, looks up at him with a hurt, wistful look, about to lower her eyes. "
                   "Walnut wall behind.")),
    "C45": dict(f="TY", w=["T2oh", "Y2o"], loc="elev", light="elev", fx=(0, "Taejun's"), flash=True, big=True,
                t=("Medium two-shot straight on inside the elevator, locked off: Taejun at the left reaches up with both hands to pull his "
                   "headphones down to his neck, belatedly; Yuna at the right (face about 70% across and 58% down) glances at him sideways. "
                   "Walnut wall behind.")),
    "C46": dict(f="", w=["T2o", "Y2o"], loc="elev", light="elev", fx=None, flash=True, noloc=True,
                t=("Insert of hands on the elevator's steel handrail against the walnut wall, locked off: Taejun's hand with the black-strap "
                   "smartwatch (pale-blue shirt cuff) grips the rail at the left-middle; Yuna's hand (white blouse cuff) rests on the same rail at "
                   "the right, a small gap apart; his hand is about to move toward hers — they do not touch yet.")),
    # ⑤ 회식
    "C47": dict(f="Y", w=["Y2o"], loc="pub", light="pub", fx=(0, "her"), flash=True,
                t=("Medium close-up of Yuna seated at the pub table, right of center, in three-quarter profile facing the right of frame: she "
                   "has frozen for a moment at a question, and now lifts her chin and answers coldly, lips parted mid-word. Plain beer glasses "
                   "and side dishes on the table in the left foreground; warm dark pub behind.")),
    "C48": dict(f="TM", w=["T2o", "M2"], loc="pub", light="pub", fx=(0, "his"), p=["P1"], flash=True,
                t=("Medium shot at the pub table: Taejun, left of center, leans forward and pours beer from a plain brown bottle with no label "
                   "into Minjae's glass, cutting him off with a dry remark, lips parted mid-word; Minjae sits at the right edge, out of focus. "
                   "A folded clear umbrella hangs from a bench back behind them, out of focus.")),
    # ⑥ 빗길 — 우산 둘
    "C49": dict(f="YT", w=["Y2", "T2"], loc="street_d", light="day", fx=(0, "Yuna's"), p=["P1"], flash=True,
                t=(f"Medium two-shot on a tree-lined sidewalk in the daytime rain, the camera tracking alongside: Yuna at the left, nearer the "
                   f"camera, walking under her own open {BLACK} (holding it by the handle), eyes down, her face softly lit by the grey sky; Taejun at the right, a few steps ahead "
                   f"and farther away (his head about 68% across, smaller), under his own open clear umbrella; he has just stopped and turns to "
                   f"look back at her. A clear gap between them.")),
    # ⑦ 편의점
    "C50": dict(f="TY", w=["T2", "Y2"], loc="store_d", light="day", fx=None, p=["P1"], flash=True, noloc=True,
                t=("Under the convenience-store awning in the daytime, close and out of focus in the foreground: Taejun's chest in the navy "
                   "jacket and white T-shirt fills the middle of the frame as he finishes folding his clear umbrella and takes his phone out; "
                   "behind him at the right, Yuna's face is half visible, looking at him, her black umbrella folded in her hand.")),
    "C51": dict(f="T", w=["T2", "Y2"], loc="store_d", light="day", fx=(0, "his"), flash=True,
                t=("Medium close-up over Yuna's shoulder under the awning in the daytime: her hair and taupe blazer shoulder, out of focus, fill "
                   "the right edge of the frame. Taejun, left of center, lowers his phone in his right hand to chest height, its screen briefly "
                   "tilted toward the camera — the screen is one flat, evenly lit chroma-key green rectangle (pure #00B140) with nothing on it; he "
                   "looks up at her, about to slip it into "
                   "his inside pocket, avoiding her eyes. Green trees and the storefront behind.")),
    "C52": dict(f="T", w=["T2"], loc="store_in", light="store_in", fx=(0, "his"), p=["P2"], flash=True, noloc=True,
                t=("Medium close-up of Taejun from a low angle, as if from inside the umbrella rack, looking up at him: bright ceiling lights "
                   "behind him; he lifts a folded umbrella with a misty pale-blue canopy off the rack and looks at it, lips parted as he starts "
                   "to speak.")),
    "C53": dict(f="TY", w=["T2", "Y2"], loc="store_in", light="store_in", fx=None, p=["P2"], flash=True,
                t=(f"Full two-shot in the store aisle by the umbrella rack, locked off: Taejun at the left (head about 39% across and 27% down) "
                   f"holds the folded misty-blue umbrella and faces Yuna; Yuna at the right (head about 64% across and 40% down) faces him, "
                   f"holding her own {BLACK}, folded, that she brought with her. Both seen from head to knees, an arm's length apart. The open-backed "
                   f"umbrella stand and the drink fridges behind them are softly out of focus (shallow depth of field, no readable labels).")),
    "C54": dict(f="Y", w=["Y2"], loc="store_in", light="store_in", fx=(0, "her"), flash=True,
                t=(f"Medium close-up of Yuna in the store aisle, left of center: she holds her own {BLACK}, folded, low in front of her, and lowers "
                   "her eyes. Drink fridges glow behind her.")),
    # ⑨ 현재 — 끝맺음
    "C55": dict(f="T", w=["T2", "Y2"], loc="store_d", light="day", fx=(0, "his"), noloc=True,
                t=("Close-up over Yuna's shoulder under the convenience-store awning in the daytime rain (no umbrella open — both are folded): "
                   "the out-of-focus back of her dark hair and her taupe blazer shoulder fill the left part of the frame. Taejun, his own clear "
                   "umbrella folded in his hand, looks down at her and offers something, gently, lips parted mid-word. Rain falls past the "
                   "awning edge behind him.")),
    "C56": dict(f="", w=["T2", "Y2"], loc="store_d", light="day", fx=None, p=["P2"], noloc=True,
                t=("Insert close-up in the daytime rain: Taejun's hand (navy jacket cuff) comes in from the lower right and holds out a folded "
                   "umbrella with a misty pale-blue canopy and a clear acrylic handle, pointing diagonally up toward the upper left, toward Yuna; "
                   "her out-of-focus taupe shoulder at the right edge. Under the awning; grey wet street behind.")),
    "C57": dict(f="Y", w=["Y2", "T2"], loc="store_d", light="day", fx=(0, "her"), noloc=True,
                t=("Close-up of Yuna under the convenience-store awning in the daytime rain, her folded black umbrella in her hand below the "
                   "frame: eyes lowered, she speaks quietly and sadly, lips parted mid-word. Taejun's dark shoulder, out of focus, fills the right edge of the frame. "
                   "Wet grey street behind.")),
    "C58": dict(f="T", w=["T2", "Y2"], loc="store_d", light="day", fx=(0, "his"), noloc=True,
                t=("Close-up over Yuna's shoulder in the daytime rain: the out-of-focus back of her dark hair fills the left part of the frame. "
                   "Taejun answers with forced calm, lips parted mid-word, his gaze dropping. The storefront pillars behind.")),
    "C59": dict(f="Y", w=["Y2"], loc="store_d", light="day", fx=None, noloc=True, nolay=True,
                t=("Extreme close-up of Yuna's face: the frame is cropped just above her eyebrows and just below her lips — no forehead top, no "
                   "chin; her eyes are about 40% down, slightly right of center. Tears well up in her eyes as she looks at Taejun toward the left "
                   "of frame. Soft grey daylight.")),
    "C60": dict(f="T", w=["T2"], loc="store_d", light="day", fx=None, noloc=True, nolay=True,
                t=("Extreme close-up of Taejun's face: the frame is cropped through his forehead at the top and just below his nose — his eyes "
                   "are about 45% down, centered. His eyes are wet with tears, looking down at Yuna toward the right of frame. Soft grey "
                   "daylight.")),
    "C61": dict(f="Y", w=["Y2"], loc="store_d", light="day", fx=(0, "her"), noloc=True,
                t=("Close-up of Yuna under the awning in the daytime rain, tears in her eyes, her face softly lit by the grey sky: she says goodbye "
                   "with a small, broken voice, lips parted mid-word, looking straight at Taejun just right of the lens.")),
    "C62": dict(f="TY", w=["T2", "Y2"], loc="store_d", light="day", fx=None, p=["P1", "P2"],
                t=(f"Wide shot in front of the convenience store in the daytime rain, locked off: Taejun stands in the middle (about 63% across) "
                   f"under the awning, his clear umbrella folded in his hand, turned toward the right, watching Yuna go; Yuna at the right (about 85% across), already turned away "
                   f"from him, walks off under the open misty pale-blue umbrella he gave her, holding it by its handle, her folded black "
                   f"umbrella hanging from her other hand. The storefront and a cash machine at the left.")),
    "C63": dict(f="T", w=["T2"], loc="store_d", light="day", fx=(0, "his"), noloc=True,
                t=("Close-up of Taejun under the awning in the daytime, handheld with a very slight shake: he watches Yuna walk away toward the "
                   "right of frame, his eyes wet. Out-of-focus storefront colors behind.")),
    # ⑩ 제품 · 비 그침 · 끝
    "C64": dict(f="", w=[], loc="puddle_d", light="splash_d", fx=None, p=["P1", "P2"],
                t=("High-speed product shot close to the wet pavement in the daytime: two folded umbrellas — one clear, one with a misty pale-blue "
                   "canopy — fall and hit the shallow puddle side by side, water splashing up around them, droplets frozen in the air. They fill "
                   "the middle of the frame.")),
    "C66": dict(f="T", w=["T2"], loc="store_d", light="sun", fx=(0, "his"),
                t=("Medium close-up of Taejun from a low angle under the awning: the rain has stopped; he looks up at the sky with a faint, "
                   "surprised look and holds his right hand out, palm up, past the awning to feel for rain, lips parted as he speaks; his folded "
                   "clear umbrella hangs from his other hand. Warm sunlight on his face; the storefront glass behind.")),
    "C67": dict(f="", w=["T2"], loc="store_d", light="sun", fx=None, p=["P1"], noloc=True,
                t=("Insert close-up in bright sunlight: Taejun's hand (navy jacket cuff) lifts his folded clear umbrella up into the sun, "
                   "diagonally across the frame — the water drops on the crystal-clear folded canopy glitter, a soft warm light bloom and lens "
                   "flare across the frame.")),
    "C68": dict(f="T", w=["T2"], loc="store_d", light="sun", fx=None, noloc=True,
                t=("Close-up of Taejun in profile facing the right of frame, his face in the left half of the frame: eyes closed, face lifted "
                   "to the warm sun, a slow breath, damp hair; a soft warm light bloom at the right.")),
    "C69": dict(f="", w=[], loc="puddle_sky", light="sun", fx=None,
                t=("Insert looking down at a shallow rain puddle on the pavement, locked off: the still water mirrors a clear blue sky with white "
                   "clouds and fills most of the frame; a strip of dry pale concrete at the bottom right. Nobody in the frame yet.")),
    "C70": dict(f="T", w=["T2"], loc="avenue", light="sun", fx=(0, "his"), p=["P1"], noloc=True,
                t=("Medium close-up of Taejun walking toward the camera down a quiet tree-lined street just after the rain, his folded clear "
                   "umbrella in his hand below the frame edge: wet eyes and a faint smile — not relief, but the smile of letting go while it "
                   "still hurts. Lush green trees and a pale building softly out of focus behind.")),
}


def small(src):   # 긴 변 1,600px JPEG 사본(선버스트/참고) — 올리기가 빠르고 그림 입력 토큰을 줄인다
    src = Path(src)
    if not src.exists():
        return f"(아직 없음) {src}"
    tag = src.parent.parent.name if src.parent.name == "refs" else src.parent.name
    dst = OUT / "참고" / f"{tag}_{src.stem}.jpg"
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        from PIL import Image
        dst.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert("RGB")
        im.thumbnail((1600, 1600))
        im.save(dst, quality=92)
    return str(dst)


def person_refs(code, n):
    p = P[code]
    picks = p["refs"] if n == 4 else [p["refs"][0], p["refs"][3]]
    return [f"{LORA}/{p['dir']}/refs/{r}.jpg" for r in picks]


NOLAY = {"C10", "C32", "C33", "C64", "C67", "C69"}   # 배치도가 빈 회색뿐인 컷(손이 아직 안 들어옴 · 물보라 · 웅덩이 · 접는 손) — 글로만 잡는다


def build(k):
    c = C[k]
    if k in NOLAY:
        c = dict(c, nolay=True)
    refs, parts = [], [START]
    for j, code in enumerate(c["f"]):
        n = 4 if j == 0 or c.get("big") else 2
        a = len(refs) + 1
        refs += person_refs(code, n)
        parts.append(f"Images {a} to {a + n - 1} are identity references for {P[code]['face']}." if n > 2 else
                     f"Images {a} and {a + 1} are identity references for {P[code]['face']}.")
    if c["f"]:
        parts.append(ID_TAIL)
    parts += [W[w] for w in c["w"]]
    parts.append(c["t"])
    if c.get("fx"):
        fr = framing(c.get("fk") or k[1:].lstrip("0").zfill(2), *c["fx"])
        if fr:
            parts.append(fr)
    if not c.get("nolay"):
        lay_n = len(refs) + 1
        refs.append(str(V / "배치" / f"{k}.png"))
        has_person = bool(c["f"]) or k in ("C10", "C15", "C30", "C46", "C56")
        parts.append((LAYOUT if has_person else LAYOUT0).format(n=lay_n))
        import 이미지콘티_배치도 as B
        cfg = B.CUT.get(k, {})
        if cfg.get("umb"):
            parts.append(UMB_LINE.format(n=lay_n))
        if cfg.get("fold"):
            parts.append(FOLD_LINE.format(n=lay_n))
        if cfg.get("occ"):
            parts.append(OCC_LINE.format(n=lay_n))
        if cfg.get("dark"):
            parts.append(DARK_LINE.format(n=lay_n))
    for pk in c.get("p", []):
        refs.append(str(OUT / "기준" / f"{pk}.png"))
        what = "clear umbrella" if pk == "P1" else "misty pale-blue umbrella"
        parts.append(f"Image {len(refs)} is the product reference for the {what} — copy its exact design (canopy, thin silver ribs, straight "
                     "clear acrylic handle with the frosted cap), not its background, light or size.")
    parts.append(L[c["loc"]])
    if c["loc"] in LREF and not c.get("noloc") and not (c.get("fx") and (((facebox.get(c.get("fk") or k[1:].zfill(2)) or {}).get("얼굴")
                                                                            or [{"h": 0}])[c["fx"][0]]["h"] >= 0.17)):
        refs.append(str(OUT / "기준" / f"{LREF[c['loc']]}.png"))
        parts.append(f"Image {len(refs)} shows this same {LNAME[c['loc']]} only for its look, materials and colors — do not copy its wide "
                     "framing; this shot keeps the framing described above.")
    parts.append(LIGHT[c["light"]])
    if c.get("flash"):
        parts.append(FLASH)
    if c["f"]:
        parts += [ACT, REAL, SIZE]
    if any(x in c["t"] for x in ("umbrella", "UMBRELLA")) and c["f"]:
        parts.append(HOLD)
    if not c.get("nolay"):
        parts.append(FRAMING)
    parts += [BLUR, TAIL]
    return dict(id=k, who=c["f"] or "-", prompt=" ".join(parts), refs=[small(r) if "/refs/" in r.replace("\\", "/") else r for r in refs])


def build_ref(k):   # 장소 · 제품 기준 그림(참고 없이 글로)
    if k == "L2":   # 10-30 첫 판이 L1과 다른 건물로 나옴 — 같은 가게여야 하니 고른 L1을 넣어 빛 · 날씨만 낮비로(7번 build_relight와 같은 길)
        prompt = " ".join([START, "Image 1 is a photograph of a small convenience store at night in the rain. Recreate exactly this same storefront from the "
                           "same camera position — the same building, awning, windows, glass door, bicycle, vending machine, street lamp and street, nothing "
                           "added or removed — but in the daytime rain: an overcast grey sky, soft even daylight, the fluorescent light inside dim against the "
                           "daylight, the pink glow in the window faint, wet pale pavement, rain still falling and pouring off the awning.",
                           "Nobody is in the frame.", LIGHT["day"], BLUR, TAIL])
        return dict(id=k, who="기준", prompt=prompt, refs=[str(OUT / "기준" / "L1.png")])
    if k in LOCJ:
        loc, light, t = LOCJ[k]
        prompt = " ".join([START, L[loc], t, "Nobody is in the frame.", LIGHT[light], BLUR, TAIL])
    else:
        prompt = " ".join([START.replace("A cinematic film still from a Korean romance brand film", "A clean product photograph"), PJ[k],
                           "Soft, even studio light. Photorealistic; the clear canopy shows real reflections and thin highlights.", TAIL])
    return dict(id=k, who="기준", prompt=prompt, refs=[])


def main():
    sys.path.insert(0, str(HERE))
    jobs = {k: build_ref(k) for k in list(LOCJ) + list(PJ)}
    for k in C:
        jobs[k] = build(k)
    for j in jobs.values():
        if len(j["prompt"]) > 6000:   # API 한도(3만 2천 자)보다 한참 아래 — 길면 앞줄이 묻힌다
            raise SystemExit(f"{j['id']}: 지시문 {len(j['prompt'])}자 — 6,000자 안으로")
        if len(j["refs"]) > 10:
            raise SystemExit(f"{j['id']}: 참고 {len(j['refs'])}장")
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(json.dumps(jobs[k], ensure_ascii=False, indent=1))
        print(len(jobs[k]["prompt"]), "자")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    json.dump(jobs, open(OUT / "작업.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    (HERE / "지시문").mkdir(exist_ok=True)
    # 저장소 사본에는 git 밖 절대 경로 대신 이름만 남긴다(공개 저장소)
    pub = {k: dict(v, refs=[Path(r.split(") ")[-1]).name for r in v["refs"]]) for k, v in jobs.items()}
    json.dump(pub, open(HERE / "지시문" / "이미지콘티.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mx = max(jobs.values(), key=lambda j: len(j["prompt"]))
    print(len(jobs), "개 · 가장 긴 지시문", mx["id"], len(mx["prompt"]), "자 · 참고 가장 많은", max(len(j["refs"]) for j in jobs.values()))


if __name__ == "__main__":
    main()
