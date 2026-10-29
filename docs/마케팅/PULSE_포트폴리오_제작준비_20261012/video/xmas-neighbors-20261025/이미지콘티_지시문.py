# 시즌 1 「옆집의 크리스마스」 이미지 콘티 지시문(2026-10-26) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록.
#   python -X utf8 이미지콘티_지시문.py   → synk-vendor/…/콘티/xmas-neighbors/ego/jobs_conti.json(실행기 gen.mjs가 읽음) · 같은 폴더 지시문/이미지콘티.json(저장소 사본)
# 길은 6번 「연말 빈방」 이미지 콘티와 같다: 원본 그 컷 첫 프레임에서 사람을 지우고 크게 흐린 회색 배치도에 원본 사람 자리를 검은 실루엣으로 두고
# (이미지콘티_배치도.py 가까이 · 흐림), 고정 와이드 1 · 12 · 20 · 26 · 35는 우리 복도 판(PL1) 위 사람 자리에 실루엣을 둔다(놓기).
# 빛 · 계절은 지시문에 쓰고 받은 색을 그대로 쓴다(장부 공통 원칙 3). 얼굴은 30 · 34뿐 — 나머지는 뒷모습 · 실루엣 · 손으로 쓴다(02_콘티 정한 것 ①).
# 제품 · 로고 · 간판 글자는 그리지 않는다 — 간판은 글 없는 호박빛 띠, 봉투는 호박빛 동그라미, 1+1 상자는 전구 그림과 빨간 동그라미만(글은 후반에 얹음).
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors")
R = V / "ego" / "refs"
B = R / "배치"


def ref(name):
    p = R / name
    return str(p) if p.exists() else f"(아직 없음) {p}"


def lay(name):
    # 움직이는 컷은 넓힌 배치도(카메라무브.py 배치 → S04o 등)가 있으면 그것으로 — 받은 판에서 시작 · 끝 창을 둘 다 잘라 낸다
    o = B / f"{name}o.jpg"
    p = o if (name.startswith("S") and o.exists()) else B / f"{name}.jpg"
    return str(p) if p.exists() else f"(아직 없음) {p}"


STILL = "Create one still photograph. A cinematic film still from a quiet, tender Korean Christmas short film, 16:9 frame."
# 10-27: 첫머리의 「Christmas short film」이 늦가을 컷에도 크리스마스 장식을 불렀다(1차 C08 — 504 안쪽 문에 리스). 1~19는 늦가을 첫머리,
# 20 · 21(첫 장식이 하나둘 — 장면 글이 말함)은 계절 말 없는 첫머리로 바꾼다(jobs() 끝 season()).
STILL_AUTUMN = ("Create one still photograph. A cinematic film still from a quiet, tender Korean short film, 16:9 frame. It is late autumn, weeks "
                "before Christmas: there are no Christmas decorations anywhere — no wreaths, no fairy lights, no Christmas trees, no ornaments.")
STILL_PLAIN = "Create one still photograph. A cinematic film still from a quiet, tender Korean short film, 16:9 frame."
FINISH = ("Photorealistic film still with natural textures, slight film grain and natural lens falloff, shot on a cinema camera. "
          "True-to-life colors. No text, no letters, no numbers, no logos, no watermarks anywhere.")
IDREF = "are identity references only — ignore their backgrounds, clothes and lighting."
LAYOUT_SIL = ("Image 1 is a heavily blurred grey layout guide made from another film's shot: copy only its camera position, height and angle, "
              "its lens and its framing, and the black silhouette's position and size in the frame — the silhouette marks exactly where and how "
              "large {who} is. Ignore its grey tones and its background; the place, the light and the pose are described below.")
LAYOUT_GREY = ("Image 1 is a heavily blurred grey layout guide made from another film's shot: copy only its camera position, height and angle, "
               "its lens and its framing — where the large shapes sit — and ignore its grey tones and its contents.")

# 사람 — 캐스팅북 고정 얼굴 세트(M04 민재 · F02 하린)
MAN = ("THE MAN: the Korean man of Images {a} to {b}, which " + IDREF +
       " He is twenty-eight, about 175 cm, average build, short black hair with messy straight bangs.")
WOMAN = ("THE WOMAN: the Korean woman of Images {a} to {b}, which " + IDREF +
         " She is twenty-four, slim, about 162 cm, light-brown shoulder-length layered hair with see-through bangs, worn HALF-UP: the upper "
         "part gathered at the back of her head and tied with a small crimson velvet ribbon bow, the rest falling loose to her shoulders.")
M_REFS_BACK = [ref("M04_angle-back.jpg"), ref("M04_hair-3.jpg"), ref("M04_fullbody.jpg")]
M_REFS_SIDE = [ref("M04_angle-left.jpg"), ref("M04_angle-back.jpg"), ref("M04_hair-3.jpg")]
M_REFS_FACE = [ref("M04_hero.jpg"), ref("M04_angle-left.jpg"), ref("M04_angle-right.jpg"), ref("M04_hair-3.jpg")]
W_REFS_BACK = [ref("H3.jpg"), ref("F02_angle-back.jpg"), ref("F02_hair-3.jpg")]
W_REFS_FACE = [ref("H3.jpg"), ref("F02_hero.jpg"), ref("F02_angle-left.jpg"), ref("F02_angle-right.jpg")]

# 옷 — 시간 표지(1~15 얇은 점퍼 · 16~19 긴 코트 · 20~21 우비 · 22~ 패딩 + 회색 목도리)
M_AUTUMN = "a thin dark-navy zip-up blouson jacket over a light-grey hoodie with the hood down, dark chinos, worn white sneakers"
M_COAT = "a long camel-brown wool overcoat, dark chinos, worn white sneakers"
M_RAIN = "a dark navy hooded raincoat with the hood up, dark chinos, worn white sneakers wet with rain"
M_WINTER = "a navy hooded padded jacket, a soft grey knitted scarf wrapped around his neck, dark chinos, worn white sneakers"
W_HOME = "an oversized cream cable-knit cardigan over a plain white T-shirt, light-blue jeans"
BAG = "a white plastic convenience-store bag with one plain round amber-orange circle printed on its side (no letters)"
STORE = ("a small 24-hour convenience store glowing warm amber-orange through its glass front; its sign is a plain warm amber-orange band "
         "with no letters")
BOX = ("a small white box for two light bulbs, printed with one large simple light-bulb drawing and a round red sticker on its corner "
       "(no letters, no numbers)")

CORRIDOR = ("the open-air outdoor corridor on the 5th floor of an old Korean corridor-style apartment block from the 1990s: on the LEFT the "
            "building wall with a row of identical dark grey steel front doors, each set back in a shallow alcove, the only lamps being small "
            "round frosted-glass motion-sensor lamps on the ceiling, one right above each door alcove; on the RIGHT a waist-high concrete "
            "parapet with a thin metal handrail; at the far end the stairwell landing")

KEEP_PLATE = ("Image 1 is this film's corridor, seen from its fixed camera, with a solid black silhouette placeholder in it. Keep Image 1's camera "
              "position, framing and lens exactly, and keep the walls, the doors and their alcoves, the lamps, the parapet and the store across "
              "the street exactly where they are. Paint {who} exactly inside the black silhouette's outline: the head, body and feet fill the "
              "outline and do not extend beyond it, so the person is exactly as large and as far from the camera as the silhouette — nothing of "
              "the silhouette remains.")
# 10-27: 1차 C01은 판은 지켰으나 민재를 카메라 3.5 m 앞에 화면 높이 64%로 크게 그렸다(실루엣은 35%) — 크기 · 자리를 숫자로 못 박는다
SMALL = ("He is SMALL and far from the camera, exactly where the silhouette is: the top of his head at about {top}% of the frame height from "
         "the top, his feet on the floor at about {bot}%, his body between about {x0}% and {x1}% of the frame width — his whole figure is "
         "only about a third of the frame height, {where}. Do not bring him closer to the camera or make him larger; the corridor floor "
         "between him and the camera stays empty.")
AT_DOOR = "standing right at the second door on the left"


def J(refs, *parts, ratio=None):
    j = {"refs": [r for r in refs if r], "prompt": " ".join(p for p in parts if p)}
    if ratio:
        j["ratio"] = ratio
    return j


def jobs():
    J_ = {}
    # ── 기준 판 둘: 복도 고정 와이드(1 · 12 · 20 · 26 · 35의 같은 자리) · 하린 반묶음 빨간 리본 ──
    J_["PL1"] = J([ref("SET1.jpg")], STILL,
        "Image 1 shows this film's corridor set on a snowy night. Keep its building design — the dark grey steel front doors with lever "
        "handles, the stained cream-grey painted concrete walls with pipes and meter boxes, the bare concrete ceiling, the waist-high concrete "
        "parapet on the right and the old low-rise neighborhood beyond it — but this is a different night and a different camera position, "
        "described below. There is NO snow anywhere, and the caged ceiling lamp of Image 1 does not exist.",
        "Time: a damp late-autumn night around 11 pm; a few dry fallen leaves on the wet concrete floor; bare trees and power lines beyond "
        "the parapet.",
        f"Location: {CORRIDOR}, about twenty meters away, glowing with a dim, cold light. Beyond the parapet, across the street below: {STORE} "
        "(not striped), among dark rooftops.",
        "The two doors that matter: the second door alcove on the left, about six to seven meters from the camera, belongs to a lonely man — "
        "its sensor lamp is dead, so his alcove is a pitch-black hole where the keyhole cannot be seen; the very next alcove after it, a "
        "little farther, belongs to the noisy neighbor — its lamp is ON and pours a small warm pool of light only onto its own doorstep. All "
        "the other door lamps are off. Nobody is in the corridor.",
        "Camera: fixed on a tripod in the middle of the corridor near its closed end, at standing eye level (about 1.5 m), level and tilted "
        "only very slightly down, about 28 mm lens, looking straight down the corridor so that its far end sits slightly left of the frame "
        "center; the left wall runs from the left edge toward the far end, the parapet from the lower right corner; the dark alcove of the "
        "man's door sits at about 38–45% of the frame width from the left.",
        "Light: low-key night — most of the frame is dark: cool blue-grey night ambient, the warm pool at the neighbor's door, the amber glow "
        "of the store across the street, the dim cold stairwell light at the far end. Soft light, no harsh shadows.", FINISH)

    # 1판(PL1_200637)은 카메라가 첫 문 2.5 m 앞이라 민재의 깜깜한 문이 화면 30%에 왔다 — 원본 1의 사람 자리(머리 34% · 발 70% · 가로
    # 40~49%)에 서게 원근을 잰 배치도(복도배치도.py → 배치/PL_원근)로 다시 굽는다. 1판은 생김새 참조로만.
    J_["PL1b"] = J([lay("PL_원근"), ref("PL1.jpg")], STILL,
        "Image 1 is a heavily blurred grey layout guide of this exact shot: copy its camera position, height, angle, lens and framing "
        "exactly — where the near left wall with the big first door, the thin dark gap of the second door, the ceiling, the floor, the "
        "parapet face on the right, the bright far end and the band of the store's glow sit in the frame — and ignore its grey tones. "
        "Image 2 shows this film's corridor for its look only — the dark grey steel doors, the stained walls with pipes and meter boxes, the "
        "small round ceiling lamps, the concrete parapet with its metal handrail, the fallen leaves, the convenience store across the street "
        "and the night light — but Image 2's camera stands too close to the doors; this shot is taken from Image 1's camera, farther back, "
        "so the corridor looks long.",
        "Time: the same damp late-autumn night around 11 pm; no snow; a few dry fallen leaves on the wet concrete floor.",
        "The doors on the left wall: the first door, about three meters away, is large at the left of the frame; the second door, about "
        "seven meters away, belongs to a lonely man — its sensor lamp is dead and its doorway is a pitch-black gap at about 40% of the frame "
        "width; the third door right after it belongs to the noisy neighbor — its small round sensor lamp is the only lit lamp in the "
        "corridor and pours a small warm pool of light onto its own doorstep, just beyond the man's dark door; the farther doors are dark. "
        f"Beyond the parapet on the right, across the street: {STORE}. Nobody is in the corridor.",
        "Camera: fixed on a tripod in the middle of the corridor near its closed end, at standing eye level (about 1.5 m), level, the horizon "
        "at about 42% of the frame height from the top, about 28 mm lens, looking straight down the long corridor — about twenty-three meters "
        "to the lit stairwell landing at the far end, which sits just right of the frame center.",
        "Light: low-key night — most of the frame is dark: cool blue-grey night ambient, the warm pool at the neighbor's door, the amber "
        "glow of the store across the street, the dim cold stairwell light at the far end. Soft light, no harsh shadows.", FINISH)

    # PL1b도 1판을 생김새 참조로 넣자 1판 카메라(첫 문 2.5 m 앞)를 그대로 따랐다(10-27 01:45) — 참조 그림 없이 원근 배치도와 글만으로(PL1c).
    J_["PL1c"] = J([lay("PL_원근")], STILL,
        "Image 1 is a heavily blurred grey layout guide of this exact shot: copy its camera position, height, angle, lens and framing "
        "exactly — the big near door at the left, the thin dark gap of the second door at about 40% of the frame width, the ceiling and the "
        "floor converging to the far end just right of the frame center, the long parapet face on the right, the small bright far end and "
        "the band of a store's glow beyond the parapet — and ignore its grey tones. The corridor is LONG: the camera stands far back at its "
        "closed end.",
        "Location and time: the open-air outdoor corridor on the 5th floor of an old Korean corridor-style apartment block from the 1990s, "
        "on a damp late-autumn night around 11 pm; no snow; a few dry fallen leaves on the wet concrete floor. On the LEFT, the building "
        "wall of stained cream-grey painted concrete with pipes and small grey meter boxes, and a row of identical dark grey steel front "
        "doors with lever handles; the only lamps are small round frosted-glass motion-sensor lamps on the ceiling, one above each door. "
        "On the RIGHT, a waist-high concrete parapet with a thin metal handrail on top. At the far end, about twenty-three meters away, the "
        f"stairwell landing glows with a dim, cold light. Beyond the parapet, across the street below: {STORE}, among dark rooftops, bare "
        "trees and power lines.",
        "The doors on the left wall: the first door, about three meters away, is large at the left of the frame, its lamp off; the second "
        "door, about seven meters away, belongs to a lonely man — its sensor lamp is dead and its doorway is a pitch-black gap at about "
        "40% of the frame width; the third door right after it belongs to the noisy neighbor — its small round sensor lamp is the only lit "
        "lamp in the corridor and pours a small warm pool of light onto its own doorstep, just beyond the man's dark door; the farther "
        "doors are dark. Nobody is in the corridor.",
        "Camera: fixed on a tripod in the middle of the corridor near its closed end, at standing eye level (about 1.5 m), level, the "
        "horizon at about 42% of the frame height from the top, about 28 mm lens, looking straight down the long corridor.",
        "Light: low-key night — most of the frame is dark: cool blue-grey night ambient, the warm pool at the neighbor's door, the amber "
        "glow of the store across the street, the dim cold stairwell light at the far end. Soft light, no harsh shadows.", FINISH)

    J_["H3"] = J([ref("F02_angle-back.jpg"), ref("F02_hair-3.jpg"), ref("F02_angle-left.jpg"), ref("F02_hero.jpg"), ref("H1.jpg")],
        "Create one photograph. A natural hair-and-wardrobe reference photo, 3:4 frame. Images 1 to 4 are identity references of one Korean "
        "woman in her early twenties — keep her exactly the same person with the same hair color, length and bangs: a round soft face with a "
        "small chin, a rounded nose tip, double eyelids with soft aegyo-sal, dark brown eyes, bright warm-toned skin with a light natural "
        "blush, natural coral lips; light-brown shoulder-length layered hair with see-through bangs. Image 5 shows her cream cable-knit "
        "cardigan.",
        "Her hair is now worn HALF-UP: the upper part of her hair is gathered at the back of her head and tied with a small crimson velvet "
        "ribbon bow, about the size of her palm, with two short tails; the rest of her hair falls loose to her shoulders; the see-through "
        "bangs stay. She wears the oversized cream cable-knit cardigan over a plain white T-shirt.",
        "She stands in a softly lit plain room, turned three-quarters away from the camera — a three-quarter back view from her right side, "
        "so the back of her head with the crimson ribbon bow is the center of attention and only the soft line of her cheek and her "
        "eyelashes show; framed from the top of her head to her waist. Soft warm lamp light from the front left, a plain warm grey wall.",
        "Photorealistic, natural skin texture, slight film grain. No text, no letters, no logos, no watermarks.", ratio="3:4")

    # ── ① 혼자의 고생 1~6 ──
    J_["C01"] = J([lay("W01")] + M_REFS_BACK, STILL, KEEP_PLATE.format(who="THE MAN"), SMALL.format(top=36, bot=71.5, x0=42, x1=47.5, where=AT_DOOR),
        "He stands in the pitch-black alcove of his door (the second alcove on the left), right before the neighbor's warmly lit doorstep.",
        MAN.format(a=2, b=4), f"He wears {M_AUTUMN}.",
        f"What he does: he stands with his back to the camera, facing his door; his left hand holds his phone to his left ear (so its screen "
        f"gives no light); his right hand holds {BAG} and a ring of keys, the key tip scratching blindly around the keyhole in the dark. His "
        "body is a dark shape against the warm pool of the neighbor's lamp just beyond him. His face is not visible.",
        "Light exactly as in Image 1: a late-autumn night, no snow.", FINISH)
    J_["C02"] = J([lay("S02")], STILL, LAYOUT_GREY,
        "EXTREME CLOSE-UP, looking up from just below: the small round frosted-glass motion-sensor ceiling lamp above the lonely man's front "
        "door in the outdoor corridor of an old Korean apartment block, at night. The dusty frosted-glass dome is chipped at its rim; inside "
        "it a blackened, burnt-out bulb with a dried dead moth stuck on the bulb's glass. The lamp sits in the upper-left part of the frame "
        "(about 18–42% of the width); right below it the top of the dark grey steel door frame and, on the wall beside it, a small blank "
        "metal nameplate plate with nothing written on it — clearly the lamp of this very door. Caught in its last moment: the bulb's "
        "filament gives one weak, dying orange flicker, the only warm light. Out of focus in the right foreground, very close to the lens, "
        "the dark edge of a vertical pipe. Everything else is cold dark blue-grey night. Shallow depth of field, fixed camera.", FINISH)
    # 2 다시(C02r, 10-27): 1차는 「마지막 깜박임」 글 때문에 필라멘트가 주황으로 빛나 켜진 등으로 읽혔고(몇 달째 꺼진 등이다), 등이 원본 매듭
    # 자리(왼쪽 위)가 아니라 가운데에 왔다. 꺼진 등 · 자리 숫자로 다시 — 29(새 전구 편집) · 32(이 전구)는 이 판을 고른 뒤 굽는다.
    J_["C02r"] = J([lay("S02")], STILL, LAYOUT_GREY,
        "EXTREME CLOSE-UP, looking up from just below: the small round frosted-glass motion-sensor ceiling lamp above the lonely man's front "
        "door in the outdoor corridor of an old Korean apartment block, at night. The lamp is OFF and has been dead for months: through its "
        "dusty frosted-glass dome, chipped at the rim, we see the dark shape of a blackened burnt-out bulb with a dried dead moth stuck on "
        "it — no glow, no light, nothing warm anywhere in the lamp. The lamp sits in the UPPER-LEFT of the frame: its dome spans about 12% "
        "to 38% of the frame width and about 8% to 50% of the frame height. Right below it, the top of the dark grey steel door frame, and on "
        "the wall to the right of the lamp a small blank metal nameplate with nothing written on it — clearly the lamp of this very door. "
        "Out of focus in the right foreground, very close to the lens, the dark edge of a vertical pipe across the right fifth of the frame. "
        "Everything is cold dark blue-grey night, faintly lit from far down the corridor; the lamp reads as a dark, dead shape. Shallow "
        "depth of field, fixed camera.", FINISH)
    # 2 고침(C02e, 10-27 19:4x): 다시 구운 C02r은 자리는 맞았으나 등이 감시 카메라 돔처럼 읽혔다. 등으로 잘 읽힌 1차 판에서 필라멘트 빛만 끈다
    # (한 가지만 고치는 편집 — 현장노트 gemini). 등을 원본 매듭 자리(왼쪽 위)로 옮기는 것은 고를 때 잘라서(이미지콘티_고르기.py @상자).
    J_["C02e"] = J([ref("C02.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the light bulb inside the glass globe is dead — its filament is completely "
        "dark and broken, with no glow, no orange light, nothing lit anywhere in the lamp; the globe catches only the same faint cold blue "
        "night light as the rest of the picture. Keep everything else in Image 1 exactly: the same cracked globe, the same dead moth on the "
        "bulb, the same camera and framing, the same door frame and blank nameplate.", FINISH)
    J_["C03"] = J([lay("S03")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        f"Night in the outdoor corridor ({CORRIDOR}). MEDIUM, the camera slowly pushing in a little: THE MAN stands at his own door inside "
        "the black silhouette, seen in three-quarter back view — he has just hung up and now holds his phone up in his left hand so its "
        "flashlight makes a small cold circle on the keyhole, a ring of keys in his right hand. His alcove is otherwise pitch dark under its "
        "dead lamp. In the left part of the frame, far down the corridor and small, an elderly woman in a quilted vest is hanging a "
        "maple-leaf wreath on her own door under her lamp and gives him a small silent bow of the head.",
        MAN.format(a=2, b=4), f"He wears {M_AUTUMN}. His face is not visible. Late autumn, no snow; fallen leaves on the floor.", FINISH)
    J_["C04"] = J([lay("S04")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "CLOSE-UP from slightly below, the size and place of the black silhouette: THE MAN's head and shoulders seen from slightly behind "
        "his shoulder in lost profile — his face turned away from the camera toward the far end of the corridor — giving a small polite "
        "bow of the head in reply, his head tipped forward and down. The ONLY light is behind him: the far corridor glows softly out of focus "
        "(a neighbor's warm lamp, the cold stairwell light) and there is no light at all on the camera side, so his face, his front and his "
        "eyes are pure black like a cut-out paper silhouette; only a thin warm rim of light outlines the back of his hair, his ear and his "
        "shoulder. No eyes, nose or mouth can be seen.",
        MAN.format(a=2, b=4), f"He wears {M_AUTUMN}. Late-autumn night in the outdoor corridor of an old Korean apartment block.", FINISH)
    # 4 다시 둘째(C04b, 10-28 00:3x): 「뒤에서만 빛」을 써도 두 번 모두 옆얼굴에 빛이 들어 눈 · 코 · 입이 읽혔다 — 11처럼 난간 너머 흐린 밤하늘을
    # 등지게 해서 하늘 앞 검은 실루엣으로(11은 이 꼴로 됐다)
    J_["C04b"] = J([lay("S04")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "CLOSE-UP from slightly below, the size and place of the black silhouette: THE MAN's head and shoulders in profile facing the LEFT "
        "edge of the frame, giving a small polite bow of the head in reply, his head tipped forward and down. Behind him there is only the "
        "open night sky over the old rooftops beyond the corridor's parapet — a dull blue-grey glow, soft and out of focus — and no light "
        "falls on him from the camera side, so his head and shoulders are a near-black silhouette against the sky: his face is a black shape "
        "whose outline (forehead, nose, lips, chin) reads against the glow, with no eyes, no skin and no features lit. A thin warm rim of "
        "light from the corridor touches the back of his hair and his shoulder.",
        MAN.format(a=2, b=4), f"He wears {M_AUTUMN}. Late-autumn night in the outdoor corridor of an old Korean apartment block.", FINISH)
    # 5번은 아래로 43% 기울이는 컷(원본 실측 7.04~8.52초, 점점 느려짐) — 시작(위)과 끝(아래)을 한 장에 담은 세로 4:3 판으로 굽고
    # 카메라무브.py가 위 창 · 아래 창을 잘라 시작 · 끝 그림을 만든다(10-26 23:2x 유호님 「카메라 기법도 완전히 똑같게」).
    J_["C05"] = J([lay("S05t")], STILL.replace("16:9 frame", "4:3 frame"),
        "Image 1 is a heavily blurred grey layout guide of this exact tall frame: copy its camera position, height and angle, its lens and "
        "framing, and the black silhouette's position and size — ignore its grey tones and its background.",
        "This tall picture is the whole strip of space that one slow downward camera tilt travels over, in one continuous scene with one "
        "camera and nothing repeated: the UPPER part is where the shot begins — THE MAN, a young man seen only from the chest down inside "
        f"the silhouette, at his dark steel front door at night, bending his knees a little to set {BAG} (a lunch box inside) down by his "
        "feet with his right hand, freeing his hands for the key; the LOWER part is where the tilt ends — the same white bag now resting on "
        "the damp concrete floor right next to his worn white sneakers, among dry fallen leaves. Dark chinos, the hem of a thin dark-navy "
        "blouson. The dark door and its frame along the left edge, the vertical posts of the corridor's metal handrail along the right edge. "
        "Dim: only the cold night and a faint warm glow from a neighbor's lamp further down the corridor.", FINISH, ratio="4:3")
    J_["C06"] = J([], STILL,
        "EXTREME CLOSE-UP of the old brass key cylinder (keyhole) on a dark grey steel apartment front door, at night: around the keyhole "
        "the grey paint is covered in fine bright scratches — a rough half-circle of them below and around it, worn in by years of keys "
        "fumbling in the dark. The tip of a brass key, held between a man's fingers coming in from the right edge, has just missed the hole "
        "and scrapes the paint beside it. The only light is the cold white beam of a phone flashlight from the right, raking across the door "
        "so every scratch glints; the rest falls into darkness. The keyhole sits slightly left of the frame center. Fixed camera, shallow "
        "depth of field.", FINISH)

    # ── ② 경계 7~11 ──
    J_["C07"] = J([lay("S07")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "Night in the outdoor corridor of an old Korean apartment block, late autumn. Over THE MAN's right shoulder: his back and the back of "
        "his head, out of focus, fill the place of the black silhouette in the right part of the frame. Beyond him, a little farther down "
        "the corridor on the left wall, the neighbor's steel door has just swung wide open outward: warm golden light pours out into the "
        "dark corridor. Three laughing young women stand just INSIDE the open doorway with the bright warm room light directly behind them, "
        "so they are dark backlit silhouettes — their faces are completely black, no features can be seen; the one in the middle has a "
        "small crimson ribbon bow in her half-up hair, visible only as a small dark shape against the light. "
        "His own alcove beside it stays dark. The parapet along the right edge, the dark city beyond. The camera follows him a little "
        "sideways.", MAN.format(a=2, b=4), f"He wears {M_AUTUMN}.", FINISH)
    J_["C08"] = J([lay("S08")] + W_REFS_BACK, STILL, LAYOUT_SIL.format(who="each of the three young women"),
        "The silhouettes mark where and how large the three are, not their poses. Night, late autumn, in the outdoor corridor of an old Korean "
        "apartment block, MEDIUM-WIDE, seen from the corridor almost square-on to the neighbor's open front doorway: THE WOMAN (the middle "
        "silhouette) stands with her back to the camera, facing into her doorway, laughing; her two friends, young women in their twenties, "
        "chat with her — one in a denim jacket standing at the left, turned toward her, one in a grey hoodie close to the camera at the right "
        "edge, seen from behind. Warm golden light pours out of the open doorway; the friends' faces are in shadow against it. Just left of "
        "the doorway, the next alcove (the lonely man's) is pitch dark under its dead lamp.",
        WOMAN.format(a=2, b=4), f"She wears {W_HOME}. Her face is not visible.", FINISH)
    # 8 다시(C08r): 1차 C08은 자리 · 크기는 맞았으나 안쪽 문에 크리스마스 리스, 503 쪽 천장등이 환히 켜짐, 왼쪽 친구 얼굴이 밝게 드러남
    J_["C08r"] = J([lay("S08")] + W_REFS_BACK, STILL, LAYOUT_SIL.format(who="each of the three young women"),
        "The silhouettes mark where and how large the three are, not their poses. Night, late autumn, in the outdoor corridor of an old Korean "
        "apartment block, MEDIUM-WIDE, seen from the corridor almost square-on to the neighbor's open front doorway: THE WOMAN (the middle "
        "silhouette) stands with her back to the camera, facing into her doorway, laughing; her two friends, young women in their twenties, "
        "chat with her — one in a denim jacket standing at the left in deep shadow, turned away toward the doorway so that we see only the "
        "back of her head and her shoulder, never her face; one in a grey hoodie close to the camera at the right edge, seen from behind. "
        "The corridor itself is unlit — its ceiling lamps are dead and dark — so the only light is the warm golden glow pouring out of the "
        "open doorway, rimming the three from behind. Just left of the doorway, the next door (the lonely man's) stands in pitch darkness. "
        "Inside the doorway: a plain warm entryway with shoes and a shoe cabinet, nothing hung on any door.",
        WOMAN.format(a=2, b=4), f"She wears {W_HOME}. No face is visible.", FINISH)
    J_["C09"] = J([lay("S09")] + W_REFS_BACK, STILL, LAYOUT_SIL.format(who="the woman"),
        "CLOSE-UP, the size and place of the black silhouette (the right half of the frame): THE WOMAN, turned three-quarters away from the "
        "camera toward her friends, throws her head back laughing, a canned drink in her hand at the bottom edge. She stands in front of her "
        "open doorway's bright warm light, so she is a dark silhouette: her face is a dark shape with no readable features; the light rims "
        "the edge of her cheek, her hair and the crimson velvet ribbon bow tied in her half-up hair, whose shape reads clearly. Out of focus "
        "behind her: the warm doorway and a hint of the friends. Night.", WOMAN.format(a=2, b=4), f"She wears {W_HOME}.", FINISH)
    J_["C10"] = J([], STILL,
        "LOW and fixed, close to the floor of the outdoor corridor of an old Korean apartment block at night, a wide view of the neighbor's "
        "open front doorway from the side: the threshold is buried under a jumble of young women's shoes — sneakers, ankle boots, a pair of "
        "slippers — spilling out of the tiny entryway onto the corridor floor; inside, on top of the low shoe cabinet by the door, a small "
        "portable speaker glows, and a young woman's hand (only the hand and a cream knitted sleeve) turns its volume knob up. Warm golden "
        "light from inside, the cold dark corridor outside; a few fallen leaves on the floor.", FINISH)
    J_["C11"] = J([lay("S11")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "CLOSE-UP, the size and place of the black silhouette: THE MAN in profile, his shoulders hunched up, turning his head and his back "
        "away from the noisy neighbor's doorway (behind him, off the right side of the frame). Behind him only the cold night sky over old "
        "rooftops beyond the corridor's parapet, soft and out of focus, so his head and shoulders are a near-black silhouette against the dull "
        "blue-grey glow; his face shows no readable features, only its outline.", MAN.format(a=2, b=4), f"He wears {M_AUTUMN}.", FINISH)

    # ── ③ 되풀이 12~24 ──
    J_["C12"] = J([lay("W12")] + M_REFS_BACK, STILL, KEEP_PLATE.format(who="THE MAN"), SMALL.format(top=36, bot=71.5, x0=42, x1=47.5, where=AT_DOOR),
        "He finally gets his door open: the steel door of his dark alcove (the second on the left) stands half open and he slips in sideways "
        "through the gap into the darkness, seen from behind and a little from the side, small.", MAN.format(a=2, b=4),
        f"He wears {M_AUTUMN}, {BAG} in his hand.",
        "What has changed since the first night: far down the corridor the elderly neighbor's door now has a maple-leaf wreath; the noisy "
        "neighbor's door, under its warm lamp, has a small autumn decoration (a little garland of dried leaves and a tiny pumpkin). His lamp "
        "is still dead. Late-autumn night, no snow; light exactly as in Image 1.", FINISH)
    J_["C13"] = J([lay("S13")] + M_REFS_BACK, STILL, LAYOUT_GREY,
        "INSIDE his small studio apartment at night, the overhead light off, seen from the dark entryway through two layers of doorframes "
        "(dark frames close to the camera along the left and right edges): at the back, a narrow kitchen corner; THE MAN, small (at about "
        "52–62% of the frame width, his head at about 42% from the top), stands as a dark silhouette at the counter, where a small white "
        "microwave glows amber with a convenience-store lunch box turning inside; a small window above the sink shows the blue city night. "
        "The wall at the left is the wall he shares with the noisy neighbor. Mostly dark: the warm microwave glow and the cool window. "
        "Fixed camera.", MAN.format(a=2, b=4), "He wears a light-grey hoodie. His face is not visible.", FINISH)
    J_["C14"] = J([lay("S14")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "MEDIUM, the size and place of the black silhouette: THE MAN sits alone at a small table pushed against his window, eating from a "
        "convenience-store lunch box with chopsticks, seen from behind his right shoulder — the back of his head, his right ear and the edge "
        "of his cheek; he looks out of the window at the left, away from the camera, so his face is not visible. Through the window at the "
        f"left of the frame, across the street below: {STORE}. The room is dark except a small desk lamp off to the right and the store's "
        "glow; a shelf with a few things at the right.", MAN.format(a=2, b=4), "He wears a light-grey hoodie. Night, late autumn.", FINISH)
    J_["C15"] = J([lay("S15")] + W_REFS_BACK, STILL, LAYOUT_SIL.format(who="the woman"),
        "A long-lens view from a dark room across the street, through its window (a blurred dark window frame and curtain along the left and "
        "right edges of the frame), into the brightly lit convenience store: inside at the counter, THE WOMAN — large in the frame, exactly the "
        "place and size of the black silhouette, from the top of her head to below her knees — seen from behind three-quarters, the crimson "
        f"velvet ribbon bow in her half-up hair and her cream cable-knit cardigan clearly visible, holds up {BOX} beside her head so its big "
        "light-bulb drawing is clearly readable, asking the young male clerk behind the counter (at the right edge) about it. Shelves, warm "
        "store light. Night; the store is the only bright thing.",
        WOMAN.format(a=2, b=4), "Her face is not visible.", FINISH)
    J_["C16"] = J([lay("S16")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "A few days later, late at night, at his dark front door in the outdoor corridor: THE MAN seen from behind, now in a long camel-brown "
        f"wool overcoat, juggling {BAG} and a small cardboard parcel box under one arm, holding up his phone with the other hand so its "
        "flashlight finds the keyhole — the light is weaker than before, a dim bluish circle. Framed low: we see him from about the shoulders "
        "down, his head cut off by the top edge of the frame (the camera will tilt up to him); the parcel box and the bag in the middle; the "
        "dark steel door at the left. Fallen leaves blown onto the floor.", MAN.format(a=2, b=4), f"He wears {M_COAT}.", FINISH)
    # 16 다시(C16r, 10-28 00:3x): 1차는 문에 디지털 도어락(번호판 달린 손잡이)과 벽 인터폰이 달렸다 — 이야기는 어둠 속 열쇠 구멍이다
    J_["C16r"] = J([lay("S16")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "A few days later, late at night, at his dark front door in the outdoor corridor: THE MAN seen from behind, now in a long camel-brown "
        f"wool overcoat, juggling {BAG} and a small cardboard parcel box under one arm, holding up his phone with the other hand so its "
        "flashlight finds the keyhole — the light is weaker than before, a dim bluish circle. The door is an old dark steel door with an old "
        "brass key lock: a simple lever handle and a small round brass keyhole just below it — no digital door lock, no keypad, no "
        "electronic panel and no intercom anywhere on the door or on the wall. Framed low: we see him from about the shoulders down, his head "
        "cut off by the top edge of the frame (the camera will tilt up to him); the parcel box and the bag in the middle; the dark steel "
        "door at the left. Fallen leaves blown onto the floor.", MAN.format(a=2, b=4), f"He wears {M_COAT}.", FINISH)
    J_["C17"] = J([], STILL,
        "EXTREME CLOSE-UP over a man's shoulder at night: his hand holds his phone with the screen toward us and its flashlight on the back "
        "pointing at the door; the screen is dark except one small red battery shape in its top corner (no numbers, no text); the dim "
        "flashlight beam lands on the scratched brass keyhole of a dark grey steel door, its half-circle of scratches glinting; at the bottom "
        "a single dry fallen leaf lies on the door threshold. A long camel wool coat sleeve. Everything else in darkness. Shallow depth of "
        "field, fixed camera.", FINISH)
    J_["C18"] = J([lay("S18")] + W_REFS_BACK + [ref("M04_angle-back.jpg")], STILL, LAYOUT_SIL.format(who="each person"),
        "The silhouettes mark where and how large they are (him at the left, the three young women in the middle). Halloween, at blue dusk "
        f"in the outdoor corridor ({CORRIDOR}); the neighbor's lamp on, the man's lamp still dead; blue-hour sky beyond the parapet. THE "
        "WOMAN in a witch costume — a black pointed witch hat tilted back so the crimson ribbon bow of her half-up hair shows below it, a "
        "short black cape over her cream cardigan — and her two friends in costumes (one with cat ears, one with a small halo), carrying "
        "little candy buckets, have just come out of the neighbor's door and walk away down the corridor toward the lit stairwell, laughing, "
        "seen from behind. At the left, by his dark alcove, THE MAN in a long camel overcoat, seen from behind, points his phone's flashlight "
        "at the floor ahead of them to light their way. Nobody's face is visible. Fixed camera.",
        WOMAN.format(a=2, b=4), "Image 5 shows the man's hair from behind.", FINISH)
    J_["C19"] = J([lay("S19")] + M_REFS_BACK + [ref("H3.jpg")], STILL, LAYOUT_SIL.format(who="the man"),
        "Halloween dusk in the outdoor corridor. Over THE MAN's shoulder: the back of his head and his right shoulder in a long camel "
        "overcoat fill the place of the black silhouette in the foreground, out of focus; his right hand is half raised in a small wave of "
        "reply. Far down the corridor at the bright stairwell landing, small and in focus: a young woman in a black witch hat — the crimson "
        "velvet ribbon bow of her half-up hair showing under it (the woman of Image 5) — has turned back and gives him a small wave, her face "
        "small and shaded by the brim; her friends already on the stairs. His own door lamp is still dead. Warm stairwell light, blue dusk.",
        MAN.format(a=2, b=4), FINISH)
    J_["C20m"] = J([lay("W20")] + M_REFS_BACK, STILL, KEEP_PLATE.format(who="THE MAN"), SMALL.format(top=36, bot=71.5, x0=42, x1=47.5, where=AT_DOOR),
        "The same corridor weeks later on a night of heavy rain: rain blows in over the parapet in slanting sheets and the floor shines wet; "
        "the noisy neighbor's alcove now has a string of warm fairy lights hanging around it (the first Christmas decoration), the elderly "
        "neighbor's door far down has a small wreath; his alcove stays bare and pitch dark under its dead lamp.",
        MAN.format(a=2, b=4), f"In the silhouette: THE MAN in {M_RAIN}, seen from behind, standing at his door. His face is not visible.",
        "Two other neighbors in rain ponchos with their hoods up carry a small potted Christmas tree between them along the corridor, walking "
        "toward the camera in the middle distance beyond him — smaller than him (their heads at about 40% of the frame height from the top, "
        "their feet at about 62%), giving him a small nod as they pass; their faces hidden under their hoods.",
        "Camera exactly as in Image 1.", FINISH)
    J_["C21"] = J([lay("S21")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "Heavy rain, night, the outdoor corridor. MEDIUM, the size and place of the black silhouette: THE MAN in a dark navy hooded raincoat "
        "with the hood up, seen from behind and a little from the side, his face hidden inside the hood, at his dark door: an open black "
        "umbrella tilted on his shoulder, his phone's flashlight in one hand pointing at the keyhole, the keys in the other — too many things "
        f"for two hands; {BAG} is slipping off his wrist. Rain blows in over the parapet behind him; the floor shines; the neighbor's fairy "
        "lights glow warm and out of focus further down.", MAN.format(a=2, b=4), FINISH)
    J_["C22"] = J([lay("S22")] + [ref("M04_hair-3.jpg"), ref("M1.jpg")], STILL, LAYOUT_SIL.format(who="the man's reflection"),
        "Christmas Eve morning in his small entryway: a round wall mirror with a dark wooden frame fills the frame like an oval vignette "
        "(the frame and the dark wall in the four corners). In the mirror, inside the silhouette's place: THE MAN from the chin down — the "
        "mirror's upper rim cuts across his chin, so his face is never visible — his navy hooded padded jacket's shoulders and his two hands "
        "wrapping a soft grey knitted scarf around his neck. Soft warm morning light from the side; in the reflection behind him, an ordinary "
        "small entryway (a coat hook, a white wall). The camera slowly pushes in.",
        "Image 2 shows his hair, Image 3 his navy padded jacket — both for look only.", FINISH)
    J_["C23"] = J([lay("S23")], STILL, LAYOUT_GREY,
        "First snow, daytime. LOW at ankle height on a snowy sidewalk of an old Seoul neighborhood: a young man's legs from the knees down "
        "walk to the left through the right half of the frame (dark chinos, worn white sneakers pressing into fresh thin snow); at his knee "
        f"{BAG} swings in his hand. Bright overcast snow light, soft. A low old wall and a parked bicycle softly out of focus behind. The "
        "camera tracks sideways with him.", FINISH)
    # 22 · 23 다시(10-27 23:3x): 1차 22는 거울 위 테가 코 아래를 잘라 입 · 턱이 비쳤다(실루엣 머리 자리가 얼굴을 부름 — 배치도를 실루엣 없는 흐림으로),
    # 1차 23은 배경에 둔 자전거 손잡이에 봉투가 걸리고 오른쪽으로 걸었다
    J_["C22r"] = J([lay("S22"), ref("M1.jpg")], STILL, LAYOUT_GREY,
        "Christmas Eve morning in a small entryway: a round wall mirror with a dark wooden frame fills the frame like an oval vignette (the "
        "frame and the dark wall in the four corners). The mirror's upper rim crosses the man's neck just below his chin, so the mirror "
        "shows only his shoulders, his chest and his two hands — no part of his face at all, not even his chin or his lips. In the mirror: "
        "a young man's navy hooded padded jacket and his two hands wrapping a soft grey knitted scarf around his neck. Soft warm morning "
        "light from the side; in the reflection behind him, an ordinary small entryway (a coat hook, a white wall). The camera slowly "
        "pushes in.", "Image 2 shows his navy padded jacket — for look only.", FINISH)
    J_["C23r"] = J([lay("S23")], STILL, LAYOUT_GREY,
        "First snow, daytime. LOW at ankle height on a snowy sidewalk of an old Seoul neighborhood: a young man's legs from the knees down "
        "walk to the LEFT through the right half of the frame — both worn white sneakers point toward the left edge of the frame, pressing "
        f"into fresh thin snow, dark chinos — and {BAG} hangs from his hand and swings at his knee as he walks. Nothing else is near him: "
        "only a low old wall softly out of focus behind and the snowy pavement. Bright overcast snow light, soft. The camera tracks "
        "sideways with him.", FINISH)
    J_["C24"] = J([lay("S24")] + [ref("M04_angle-back.jpg"), ref("M1.jpg")], STILL, LAYOUT_SIL.format(who="the man"),
        "Christmas Eve, late afternoon turning to dusk: a snow-covered narrow street of an old Seoul residential neighborhood, WIDE and nearly "
        "fixed. THE MAN — at the place and size of the black silhouette, about half the frame height — walks away from the camera along the snowy street toward his "
        f"old apartment block, {BAG} in his hand, in a navy hooded padded jacket and a grey knitted scarf, seen from behind. Low houses, "
        "parked cars under snow, power lines, warm windows; a clear blue sky with a few golden clouds.",
        "Image 2 shows his hair from behind, Image 3 his navy padded jacket.", FINISH)

    # ── ④ 지켜봄 → 반전 25~30 ──
    J_["C25"] = J([lay("S25")] + W_REFS_BACK, STILL, LAYOUT_GREY,
        "Christmas Eve, late afternoon turning blue. Inside THE WOMAN's small room, seen from behind her: she stands at her small "
        "corridor-side window — a white-framed window, its glass frosted with ice crystals at the edges, a strand of silver tinsel along its "
        "sill — looking out through the clear middle of the glass toward the corridor and the stairs. Her head and shoulders seen from behind "
        "fill the middle of the frame (about 32–62% of the width, from near the top edge to the middle of the frame) — the crimson velvet "
        "ribbon bow of her half-up hair at the center of the picture. Beside her at the left, a small Christmas tree with warm lights. "
        "Outside, blue dusk. Her face is not visible. The camera slowly pushes in.",
        WOMAN.format(a=2, b=4), f"She wears {W_HOME}.", FINISH)
    J_["C26"] = J([lay("W26")] + M_REFS_BACK, STILL, KEEP_PLATE.format(who="THE MAN"), SMALL.format(top=36.5, bot=69.5, x0=47, x1=52.5, where="walking in the middle of the corridor just beyond the second door, toward the camera"),
        "Christmas Eve at blue dusk, snow falling softly, lying on the parapet's top and along the corridor's edges; every other door is now "
        "decorated and glowing — fairy lights around the alcoves, wreaths, a tiny lit tree by the neighbor's door — and the neighbor's lamp "
        "is on; only his alcove (the second on the left) is bare and pitch dark under its dead lamp.", MAN.format(a=2, b=4),
        f"In the silhouette: THE MAN walks toward the camera along the corridor, having just come up from the stairwell at the far end, in "
        f"{M_WINTER}, {BAG} in his hand. He is backlit by the lights behind him and his head is lowered, so his face falls into shadow and "
        "cannot be read.", FINISH)
    J_["C27"] = J([lay("S27")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "CLOSE-UP, the size and place of the black silhouette: THE MAN's head and shoulders, tired, seen from behind his shoulder in lost "
        "profile — his face turned away from the camera and in shadow, only the line of his cheek and his ear — looking down at the phone in "
        "his hand as he switches on its flashlight out of habit (the small light just coming on at the bottom edge). Behind him: blue snowy "
        "dusk and the warm, round, out-of-focus bokeh of the decorated doors' fairy lights. A few snowflakes on his hair.",
        MAN.format(a=2, b=4), f"He wears {M_WINTER}.", FINISH)
    J_["C28"] = J([lay("S28")] + M_REFS_BACK, STILL, LAYOUT_SIL.format(who="the man"),
        "Blue dusk, snow, the outdoor corridor. MEDIUM at his door, the size and place of the black silhouette (left of center): THE MAN seen "
        "from behind, standing in his alcove — and the small round sensor lamp right above him has just clicked on: a warm, soft light pours "
        "down over him, his shoulders dusted with snow, and over the keyhole. He has lowered his phone (its flashlight still on, pointing at "
        f"the floor), and with {BAG} still in his other hand he slides the key into the keyhole in one go. The glowing lamp is visible at the "
        "top of the frame. Warm light in the alcove; blue dusk and soft snowfall behind. His face is not visible.",
        MAN.format(a=2, b=4), f"He wears {M_WINTER}.", FINISH)
    J_["C29"] = J([ref("C02.jpg")],
        "Edit this photograph (Image 1): the same lamp, the same camera, the same framing — but a new night: the burnt bulb has been replaced "
        "by a brand-new bulb glowing a steady, warm golden light through the frosted glass dome; the dead moth and the dust are gone and the "
        "glass is clean, with a thin rim of frost at its edge and a few snowflakes drifting through the light; the door frame and the blank "
        "nameplate below now catch the warm light. Keep everything else in Image 1 exactly.", FINISH)
    VAR30 = {"C30a": "calm and almost neutral — only the corners of his closed mouth lift very slightly, a tiny private smile",
             "C30b": "a small, warm closed-mouth smile that reaches his eyes a little — quietly relieved and touched",
             "C30c": "he has just noticed — his eyebrows lift slightly and a faint closed-mouth smile begins"}
    for k, v in VAR30.items():
        J_[k] = J([lay("S30")] + M_REFS_FACE, STILL, LAYOUT_SIL.format(who="the man's head"),
            "TIGHT CLOSE-UP, exactly the size and place of the black silhouette (right of center, the head large): THE MAN's face in "
            "three-quarter view, tilted up toward the sensor lamp above him (just out of frame at the top left), which bathes his face in soft "
            "warm light from above; behind him, blue snowy dusk and the warm out-of-focus bokeh of fairy lights. A few snowflakes in his hair "
            f"and on the collar of his navy padded jacket and his grey knitted scarf. Expression: {v}. Lips closed.",
            "THE MAN: the Korean man of Images 2 to 5 — keep his face exactly the same person (a round soft face, a rounded nose tip, small "
            "double eyelids with slightly drooping outer corners, warm-toned skin with a faint beard shadow, short black hair with messy "
            "straight bangs). Images 2 to 5 " + IDREF, FINISH)

    # 30 다시(C30r): 표정 시험 a를 고른 뒤 배경만 못 박는다 — a · b · c 모두 지상 골목 · 공원처럼 나왔다(그는 5층 바깥 복도 자기 문 앞에서
    # 문 위 등을 올려다보니, 카메라 쪽에서 본 그의 뒤는 난간 너머 5층 높이의 동네다).
    J_["C30r"] = J([lay("S30")] + M_REFS_FACE, STILL, LAYOUT_SIL.format(who="the man's head"),
        "TIGHT CLOSE-UP, exactly the size and place of the black silhouette: his head is very large in the frame — the top of his hair is "
        "cut off by the top edge, his chin sits at about 78% of the frame height and his face spans roughly from 40% to 72% of the frame "
        "width. THE MAN's face in three-quarter view turned toward the LEFT edge of the frame (we see more of his right cheek), tilted up "
        "toward the small sensor lamp above his front door (just out of frame at the top left), which bathes his face in soft warm light "
        "from above. He stands in the open-air outdoor corridor on the 5th floor of his old apartment block, so "
        "behind him, out of focus, is the corridor's concrete parapet with a line of fresh snow on its edge low in the frame, and beyond it, "
        "five floors up, the blue dusk sky over the snowy rooftops of the old neighborhood, warm window lights and the round bokeh of a "
        "string of fairy lights on a neighbor's door — not a street, not an alley. A few snowflakes in his hair and on the collar of his "
        f"navy padded jacket and his grey knitted scarf. Expression: {VAR30['C30a']}. Lips closed.",
        "THE MAN: the Korean man of Images 2 to 5 — keep his face exactly the same person (a round soft face, a rounded nose tip, small "
        "double eyelids with slightly drooping outer corners, warm-toned skin with a faint beard shadow, short black hair with messy "
        "straight bangs). Images 2 to 5 " + IDREF, FINISH)

    # 끝 그림 둘(19 · 30): 사람을 따라 손으로 크게 도는 컷이라 받은 판을 잘라서는 끝을 못 만든다(사람은 그 자리, 바탕만 흐름) — 고른 시작 그림을
    # Image 1로 「같은 사람 · 같은 자리 · 같은 표정, 바탕만 흘러간 마지막 프레임」 편집으로 굽는다(얼굴 컷 고치기는 한 번까지 — 현장노트 gemini).
    J_["C30e"] = J([ref("C30.jpg")] + M_REFS_FACE[:2],
        "Edit this photograph (Image 1). It is the FIRST frame of a 2.3-second handheld shot; make the LAST frame of the same shot. The "
        "camera has slowly circled around THE MAN to the left while staying on his face: he stays exactly the same person, the same size and "
        "at the same place in the frame, with the same face and the same expression, lips closed; but the out-of-focus background behind "
        "him has swept to the right by about half of the frame width — now the blurred corridor wall with a neighbor's door strung with "
        "warm fairy lights fills the left part of the background — and the whole picture is tilted about 7 degrees counter-clockwise. "
        "Images 2 and 3 are his identity references — do not change his face.", FINISH)
    J_["C19e"] = J([ref("C19.jpg")],
        "Edit this photograph (Image 1). It is the FIRST frame of a 1.4-second handheld shot; make the LAST frame of the same shot. As the "
        "man in the foreground raises his hand higher in a small wave, the handheld camera swings with him: everything in the picture has "
        "shifted to the left by about a fifth of the frame width and up a little, and the whole picture is tilted about 10 degrees "
        "clockwise; his shoulder and the back of his head stay out of focus in the foreground; the woman far away at the bright stairwell "
        "landing stays small and keeps waving. Same light, same moment.", FINISH)

    # ── ⑤ 정체 31~34 ──
    J_["C31"] = J([lay("S31")] + [ref("H3.jpg"), ref("F02_angle-back.jpg"), ref("M04_angle-back.jpg")], STILL,
        LAYOUT_SIL.format(who="the woman's head"),
        "Christmas Eve night, gentle snow. Over THE WOMAN's shoulder from inside her dark kitchen: the back of her head with the crimson "
        "velvet ribbon bow in her half-up hair fills the right part of the frame, out of focus (the place of the black silhouette). Through "
        "her small corridor-side kitchen window, frosted at the edges, we see at the left of the frame the outdoor corridor: the next door — "
        "the lonely man's — under its newly lit warm sensor lamp; THE MAN, small, seen from behind in a navy padded jacket and grey scarf, "
        "opens his door with his phone held to his ear. Fairy lights on the other doors. Fixed camera.",
        "Images 2 and 3 show the woman's hair (identity only); Image 4 shows the man's hair from behind.", FINISH)
    J_["C32"] = J([lay("S32"), ref("C02.jpg")], STILL, LAYOUT_GREY,
        "EXTREME CLOSE-UP, fixed, on the top of a low wooden shoe cabinet by a young woman's front door at night: the blackened burnt-out "
        f"light bulb with the dried dead moth still stuck on its glass (the very bulb inside the lamp of Image 2), {BOX} lying open with one "
        "new bulb still inside and one empty slot, and a small screwdriver; a folded step stool leans against the cabinet at the edge. "
        "Behind, out of focus, the warm fairy lights of her window make round bokeh. No letters or numbers on anything.", FINISH)
    J_["C33"] = J([lay("S33"), ref("C32.jpg")], STILL, LAYOUT_GREY,
        "Close, at a young woman's desk at night: her hands, in cream cable-knit cardigan sleeves, screw the one remaining new bulb from "
        f"the box of Image 2 into her small desk lamp; beside it the empty bulb box and {BAG}. The lamp is about to turn on — her hand "
        "pauses on the bulb. Warm fairy-light bokeh in the foreground, the dark blue window behind. Only her hands and sleeves are in the "
        "frame.", FINISH)
    VAR34 = {"C34a": "calm and almost neutral, the corners of her closed mouth lifting very slightly",
             "C34b": "a small, quiet closed-mouth smile, her eyes soft",
             "C34c": "a small closed-mouth smile as she begins to turn her head toward the window at the left"}
    for k, v in VAR34.items():
        J_[k] = J([lay("S34")] + W_REFS_FACE, STILL, LAYOUT_SIL.format(who="the woman's head"),
            "CLOSE-UP, exactly the size and place of the black silhouette (left of center, the head large): THE WOMAN's face in three-quarter "
            "view, sitting upright at her desk at night; the small desk lamp she has just switched on (off-frame right) lights one side of her "
            "face warm, the other side catches the cold blue of the night window; the crimson velvet ribbon bow of her half-up hair shows at the "
            f"back of her head. Expression: {v}. Lips closed. No hand near her face.",
            "THE WOMAN: the Korean woman of Images 2 to 5 — keep her face exactly the same person (a round soft face with a small chin, a "
            "rounded nose tip, double eyelids with soft aegyo-sal, dark brown eyes, bright warm-toned skin, natural coral lips, light-brown "
            "hair with see-through bangs). Images 2 to 5 " + IDREF, f"She wears {W_HOME}.", FINISH)

    # 34 다시(10-27): 1차 a · b · c(닮음 0.60 · 0.56 · 0.57)는 표정은 좋으나 모두 오른쪽을 보고 · 작고(턱 65%) · 따뜻한 빛이 오른쪽 —
    # 원본 34 첫 프레임은 거의 정면에서 왼쪽으로 조금 돈 얼굴, 고개를 숙여 눈은 왼쪽 아래, 찬빛이 왼쪽, 머리가 화면을 꽉 채운다(턱 85%).
    VAR34R = {"C34d": "calm and almost neutral, the corners of her closed mouth lifting very slightly",
              "C34e": "a small, quiet closed-mouth smile, her eyes soft"}
    for k, v in VAR34R.items():
        J_[k] = J([lay("S34")] + W_REFS_FACE, STILL, LAYOUT_SIL.format(who="the woman's head"),
            "EXTREME CLOSE-UP, exactly the place and size of the black silhouette: her head is very large in the frame — the top of her hair "
            "is cut off by the top edge, her chin is at about 85% of the frame height, and her face spans roughly from 36% to 66% of the frame "
            "width, centered. She sits upright at her desk at night, her face almost frontal, turned only slightly toward the LEFT edge of the "
            "frame, her head bowed a little, her eyes lowered toward the lower left. Cold blue-white light from the night window at the "
            "frame's left lights the left side of her face; the small desk lamp she has just switched on, low at the frame's right and just "
            "out of frame, adds a soft warm glow to the right side of her face and her hair. Out of focus behind her: at the left, the window "
            "with round warm bokeh of the fairy lights in the corridor outside; at the right, the dark wall of her room. Behind her head on the "
            f"right, the crimson velvet ribbon bow of her half-up hair clearly peeks out. Expression: {v}. Lips closed. No hand near her face.",
            "THE WOMAN: the Korean woman of Images 2 to 5 — keep her face exactly the same person (a round soft face with a small chin, a "
            "rounded nose tip, double eyelids with soft aegyo-sal, dark brown eyes, bright warm-toned skin, natural coral lips, light-brown "
            "hair with see-through bangs). Images 2 to 5 " + IDREF, f"She wears {W_HOME}.", FINISH)

    # 고정 와이드 두 걸음(10-27 20:5x): 사람 · 기준 사진을 함께 넣으면 Gemini가 민재를 가장 가까운 첫 문 앞(3.5~4 m)으로 당겨 화면 높이
    # 52~64%로 그렸다(C01 · C01r · C12 · C20m — 실루엣 35%, 크기 숫자도 소용없음). 편집(「Image 1을 고쳐라」)은 틀을 지켰으므로(2 고침),
    # ① 복도 판(PL1)에서 계절 · 장식만 바꾼 판(PL12 · PL20 · PL26 — 사람 없음)을 편집으로 굽고 ② 그 판에 실루엣을 놓은 배치도(W12 · W20 · W26)의
    # 실루엣만 같은 크기 · 자리의 민재로 바꾸는 편집으로 굽는다(C01e · C12e · C20e · C26e). 503 = 둘째 문간(화면 가로 40% 어귀) — 첫 문은 남의 집.
    KEEP_ALL = "Keep the camera position, framing and lens and everything else in Image 1 exactly."
    D503 = ("the dark second doorway on the left wall, at about 40% of the frame width (the first, nearest door at the far left belongs to "
            "another neighbor)")
    J_["PL12"] = J([ref("PL1.jpg")],
        "Edit this photograph (Image 1). The same corridor on another late-autumn night, the same light — change only the doors' "
        "decorations: far down the corridor near the stairwell one door now has a small maple-leaf wreath, and the third door on the left, "
        "just beyond the dark second doorway, now has a little garland of dried autumn leaves and a tiny pumpkin by its threshold. "
        f"{D503[0].upper() + D503[1:]} stays bare and pitch dark. No people. " + KEEP_ALL, FINISH)
    J_["PL20"] = J([ref("PL1.jpg")],
        "Edit this photograph (Image 1). The same corridor weeks later, on a night of heavy rain: rain blows in over the parapet in slanting "
        "sheets and the floor shines wet; the third door on the left now has a string of warm fairy lights around its alcove (the first "
        "Christmas decoration) and a door far down has a small wreath; " + D503 + " stays bare and pitch dark under its dead lamp. Far down "
        "the corridor near the stairwell, two neighbors in clear rain ponchos with their hoods up carry a small potted Christmas tree "
        "between them, walking toward the camera, small (their heads at about 38% of the frame height from the top, their feet at about "
        "62%), their faces hidden under their hoods. No one else. " + KEEP_ALL, FINISH)
    J_["PL26"] = J([ref("PL1.jpg")],
        "Edit this photograph (Image 1). The same corridor on Christmas Eve at blue dusk, snow falling softly and lying on the parapet's top "
        "and along the corridor's edges, the sky beyond the parapet a deep blue dusk: every door is now decorated and glowing — fairy lights "
        "around the alcoves, wreaths, a tiny lit tree by the third door on the left, whose lamp is on — except " + D503 + ", which stays "
        "bare and pitch dark under its dead lamp. No people. " + KEEP_ALL, FINISH)
    PUT = ("Edit this photograph (Image 1). Replace only the solid black silhouette of a man with a real man of exactly the same size, in "
           "exactly the same place: {pos}. He is small and far from the camera; nothing of the silhouette remains and the corridor floor "
           "between him and the camera stays empty. ")
    POS_DOOR = ("the top of his head at about 36% of the frame height from the top, his feet at about 71.5%, between about 42% and 47.5% "
                "of the frame width, right in front of " + D503)
    MAN_FAR = ("He is a Korean man of twenty-eight, about 175 cm, average build, short black hair with messy straight bangs (Image 2 shows "
               "his hair from behind — identity only).")
    J_["C01e"] = J([lay("W01"), ref("M04_hair-3.jpg")], PUT.format(pos=POS_DOOR), MAN_FAR,
        f"He wears {M_AUTUMN}. He stands with his back to the camera, facing his door; his left hand holds his phone to his left ear (its "
        f"screen gives no light); his right hand holds {BAG} and a ring of keys whose tip scratches blindly around the keyhole in the dark. "
        "His body is a dark shape against the warm pool of the far lamp. His face is not visible. " + KEEP_ALL, FINISH)
    J_["C12e"] = J([lay("W12"), ref("M04_hair-3.jpg")], PUT.format(pos=POS_DOOR), MAN_FAR,
        f"He wears {M_AUTUMN}, {BAG} in his hand. He finally gets his door open: the steel door of the dark second doorway stands half "
        "open and he slips in sideways through the gap into the darkness, seen from behind and a little from the side. His lamp is still "
        "dead. " + KEEP_ALL, FINISH)
    J_["C20e"] = J([lay("W20"), ref("M04_hair-3.jpg")], PUT.format(pos=POS_DOOR), MAN_FAR,
        f"He wears {M_RAIN}, seen from behind, standing at his dark door in the rain; the two neighbors with the potted tree farther down "
        "the corridor give him a small nod as they pass. His face is not visible. " + KEEP_ALL, FINISH)
    J_["C26e"] = J([lay("W26"), ref("M04_hair-3.jpg")],
        PUT.format(pos="the top of his head at about 36.5% of the frame height from the top, his feet at about 69.5%, between about 47% "
                       "and 52.5% of the frame width, walking in the middle of the corridor just beyond " + D503 + ", toward the camera"),
        MAN_FAR, f"He wears {M_WINTER}, {BAG} in his hand, having just come up from the stairwell at the far end. He is backlit by the "
        "decorations' glow behind him and his head is lowered, so his face falls into shadow and cannot be read. " + KEEP_ALL, FINISH)

    # 판 고침 바로잡기(10-27 21:4x): PL12는 마른 잎 줄 · 호박을, PL20은 전구 줄을 503(어두운 둘째 문간)에 달았다 — 받은 판에서 그것만 옆 문(504)으로
    # 옮긴다(한 가지만 고치는 편집). PL26은 503이 비고 504에 리스 · 전구 · 작은 트리라 그대로 쓴다.
    MOVE = ("Edit this photograph (Image 1). Change only one thing: take the {what} away from the dark doorway at about 38–42% of the frame "
            "width, so that this doorway is completely bare and pitch dark again, with nothing on it, around it or on the floor in front of "
            "it; hang the same {what} instead on the next door just beyond it, the lighter grey door at about 43–46% of the frame width. "
            "Keep everything else in Image 1 exactly.")
    J_["PL12f"] = J([ref("PL12.jpg")], MOVE.format(what="little garland of dried autumn leaves and the tiny pumpkin"), FINISH)
    J_["PL20f"] = J([ref("PL20.jpg")], MOVE.format(what="string of warm fairy lights"), FINISH)
    # 34 끝 다시(C34t2): 1차 C34t는 고개를 오른쪽(스탠드 쪽)으로 돌려 입이 옆으로 보였다 — 창은 화면 왼쪽이다
    J_["C34t2"] = J([ref("C34e.jpg"), ref("H3.jpg")],
        "Edit this photograph (Image 1). It is the first frame of a 3-second shot; make the moment about 1.4 seconds later in the same shot: "
        "she has turned her head away from the camera toward the night window with the blurred fairy lights at the LEFT of the frame — away "
        "from the warm lamp at the right — so far that we see mostly the side and the back of her head: her ear, her cheek from behind, "
        "and the crimson velvet ribbon bow of her half-up hair, now clearly visible (as in Image 2, which shows the ribbon from behind); "
        "her eyes and her mouth are hidden from the camera. The same person, the same place in the frame, the same camera and the same "
        "light. Keep everything else in Image 1 exactly.", FINISH)

    # 26 원판 다시(C26e2): 1차 C26e는 고개를 들고 앞에서 빛을 받아 작게나마 얼굴이 읽혔다(얼굴은 30에서 처음) — 고개를 숙여 그늘
    J_["C26e2"] = J([lay("W26"), ref("M04_hair-3.jpg")],
        PUT.format(pos="the top of his head at about 36.5% of the frame height from the top, his feet at about 69.5%, between about 47% "
                       "and 52.5% of the frame width, walking in the middle of the corridor just beyond " + D503 + ", toward the camera"),
        MAN_FAR, f"He wears {M_WINTER}, {BAG} in his hand, having just come up from the stairwell at the far end. His head is bowed low, "
        "chin tucked into his grey scarf, eyes on the floor, and all the light is behind him — the decorations' glow rims his shoulders and "
        "hair — so his face is in deep shadow and none of his features can be read. " + KEEP_ALL, FINISH)

    # 1 다시(C01r): 크기 · 자리 숫자를 넣은 C01 그대로
    J_["C01r"] = dict(J_["C01"])
    # 34 끝 그림(C34t, 10-27): 고른 C34e에서 52.2초쯤 고개를 창 쪽(왼쪽)으로 돌린 순간 — 말(52.40~53.60)은 입이 안 보일 때(3절)
    J_["C34t"] = J([ref("C34e.jpg"), ref("H3.jpg")],
        "Edit this photograph (Image 1). It is the first frame of a 3-second shot; make the moment about 1.4 seconds later in the same shot: "
        "she has turned her head toward the night window at the LEFT edge of the frame, so we now see the side and the back of her head — "
        "her cheek and the line of her jaw from behind, her mouth hidden — and the crimson velvet ribbon bow of her half-up hair is now "
        "clearly visible at the back of her head (as in Image 2, which shows the ribbon from behind). The same person, the same place in "
        "the frame, the same camera and the same light. Keep everything else in Image 1 exactly.", FINISH)

    # Opus 검수(10-28 01시, Fable 주간 한도로 Opus가 대신 확인) 반영 다시 굽기 — 18 · 33은 P1, 17 · 27 · 4는 P2
    J_["C18r"] = J([lay("S18")] + W_REFS_BACK + [ref("M04_angle-back.jpg")], STILL, LAYOUT_SIL.format(who="each person"),
        "The silhouettes mark where and how large they are (him at the left, the three young women in the middle). Halloween, at blue dusk "
        f"in the outdoor corridor ({CORRIDOR}); the neighbor's lamp on, the man's lamp still dead; beyond the neighbor's warm lamp the "
        "corridor falls into dim blue dusk. THE WOMAN in a witch costume — a black pointed witch hat tilted back so the crimson ribbon bow "
        "of her half-up hair shows below it, a short black cape over her cream cardigan — and her two friends in costumes (one with cat "
        "ears, one with a small halo), carrying little candy buckets, have just come out of the neighbor's door and walk away down the "
        "dim corridor toward the stairwell, laughing, seen from behind. At the left, by his dark alcove, THE MAN in a long camel overcoat, "
        "seen from behind, stretches his arm out low toward them with his phone in his hand: its bright white flashlight beam falls on the "
        "floor right in front of their feet as a clear oval pool of light, lighting their way in the dim corridor. His other hand is not on "
        "his door. Nobody's face is visible. Fixed camera.", WOMAN.format(a=2, b=4), "Image 5 shows the man's hair from behind.", FINISH)
    J_["C33e"] = J([ref("C33.jpg"), ref("C29.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the light bulb in her hand becomes a clear glass bulb with a visible "
        "filament — exactly the same kind of bulb as the new bulb glowing in the lamp of Image 2 (the other bulb of the same two-pack). "
        "Keep everything else in Image 1 exactly.", FINISH)
    J_["C17e"] = J([ref("C17.jpg"), ref("C06.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the lock on the door becomes exactly the lock of Image 2 — the same old round "
        "brass keyhole with the same half-circle of scratches in the paint around it, on the same blue-grey steel door. Keep the hand, the "
        "phone, the coat sleeve, the dim flashlight light and everything else in Image 1 exactly.", FINISH)
    J_["C27r"] = J([lay("S27")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "CLOSE-UP, the size and place of the black silhouette: THE MAN's head and shoulders, tired, seen from behind his shoulder in lost "
        "profile — his face turned away from the camera and in shadow, only the line of his cheek and his ear — looking down at the phone in "
        "his hand as he switches on its flashlight out of habit (the small light just coming on at the bottom edge). Behind him, out of "
        "focus: the outdoor corridor of his old apartment block — dark grey steel front doors set in concrete walls, strung with warm "
        "fairy lights and small wreaths that blur into round golden bokeh, and the snowy concrete parapet; blue snowy dusk. No wooden "
        "doors, no nameplates, no signs. A few snowflakes on his hair.", MAN.format(a=2, b=4), f"He wears {M_WINTER}.", FINISH)
    J_["C04c"] = J([lay("S04")] + M_REFS_SIDE, STILL, LAYOUT_SIL.format(who="the man"),
        "Late-autumn NIGHT in the outdoor corridor of an old Korean apartment block. CLOSE-UP from slightly below, the size and place of the "
        "black silhouette: THE MAN's head and shoulders in profile facing the LEFT edge of the frame, giving a small polite bow of the head "
        "in reply, his head tipped forward and down. Right behind his head: the dark night sky beyond the parapet — deep navy, nearly black, "
        "with only a faint orange city glow low over the rooftops — and further back, out of focus, the warm lamp of a neighbor's door far "
        "down the corridor. No light falls on him from the camera side, so his head and face are a pure black silhouette: no eyes, no skin "
        "and no features lit; a thin warm rim of light from that far lamp outlines the back of his hair, his ear and his shoulder.",
        MAN.format(a=2, b=4), f"He wears {M_AUTUMN}.", FINISH)
    # 얼굴 다시(10-28 확정 뒤 조율 세션 지적 — 정한 것 ①): 4 · 9 · 11 · 19 · 27 · 28은 고른 판에서 눈 · 코 · 입이 읽혔다. 실루엣을 바라는
    # 지시문은 Gemini가 다섯 번 넘게 얼굴에 빛을 넣었으므로, 고른 판의 틀 · 크기는 그대로 두고 고개만 돌려 뒷모습으로 만드는 편집을 주로 쓴다.
    # 하늘 앞 옆 실루엣(11)과 문간 역광(9)은 얼굴만 검게 하는 편집도 함께 굽고 나은 쪽을 고른다. 28은 카메라가 문을 마주 봐야 뒷모습이라 새로 굽는다.
    TURN = ("Edit this photograph (Image 1). Change only one thing: {who} turns {pos} head away from the camera, toward {to}, so that the "
            "camera now sees the back of {pos} head — {hair} — and none of {pos} face: no eye, no eyelid, no eyebrow, no nose, no lips and no "
            "cheek can be seen. {keep} Keep the framing, the size and place of {pos} head and shoulders in the frame, the light and everything "
            "else in Image 1 exactly. {refs}")
    DARK = ("Edit this photograph (Image 1). Change only one thing: {who} becomes a true silhouette — {pos} face is a solid black shape with "
            "no eye, no eyebrow, no nose, no lips and no skin tone visible inside it, like a paper cut-out; only {rim}. {keep} Keep the "
            "framing, the pose, the size and place in the frame and everything else in Image 1 exactly.")
    J_["C04d"] = J([ref("C04.jpg"), ref("M04_angle-back.jpg"), ref("M04_hair-3.jpg")], TURN.format(
        who="the man", pos="his", to="the far end of the corridor on the left", hair="his dark messy hair, his ear and the back of his neck "
        "above the grey hood", keep="He still gives the same small polite bow, his head tipped forward and down, and the thin warm rim of "
        "light still outlines the back of his hair and his shoulder.", refs="Images 2 and 3 show his hair from behind."), FINISH)
    J_["C09s"] = J([ref("C09.jpg")], DARK.format(
        who="the laughing woman on the right", pos="her", rim="a thin warm rim of the doorway's light traces the outline of her forehead, "
        "nose, lips and chin, her hair and the crimson velvet ribbon bow", keep="She is backlit by the bright doorway: her neck and the "
        "front of her cardigan fall into deep shadow too. She keeps laughing with her head thrown back."), FINISH)
    J_["C09b"] = J([lay("S09")] + W_REFS_BACK, STILL, LAYOUT_SIL.format(who="the woman"),
        "The black silhouette marks only the size and place of her head and shoulders — she is NOT in profile: she is seen from behind. "
        "CLOSE-UP, the right half of the frame: THE WOMAN seen from behind her left shoulder, three-quarters from behind — the back of her "
        "head with the half-up hair tied by the crimson velvet ribbon bow in the middle of the frame's right half, her loose hair, her "
        "shoulder in the cream cardigan. She faces away from the camera, INTO her bright open doorway, and throws her head back laughing "
        "with her friends inside; a canned drink in her raised hand at the bottom edge. None of her face is visible — at most the edge of "
        "her jaw, rimmed with warm light. In front of her, out of focus: the warm golden doorway and her friends as soft blurred shapes whose "
        "faces are lost in the glow. The camera side is the dark outdoor corridor at night, so the back of her head is dark with a warm rim "
        "of light around her hair and the ribbon.", WOMAN.format(a=2, b=4), f"She wears {W_HOME}.", FINISH)
    J_["C11s"] = J([ref("C11.jpg")], DARK.format(
        who="the man", pos="his", rim="the outline of his forehead, nose, lips and chin reads against the dull blue-grey sky", keep="His "
        "hair, ear, neck and shoulders are just as black."), FINISH)
    J_["C11b"] = J([ref("C11.jpg"), ref("M04_angle-back.jpg"), ref("M04_hair-3.jpg")], TURN.format(
        who="the man", pos="his", to="the left, away from the noisy doorway behind him", hair="his dark messy hair, his ear and the back of "
        "his neck above the grey hood, a dark shape against the dull night sky", keep="His shoulders stay hunched up.",
        refs="Images 2 and 3 show his hair from behind."), FINISH)
    HAT = ("Edit this photograph (Image 1). Change only the small young woman in the black witch hat far down the corridor: her face is "
           "now hidden in the deep shadow under the wide brim of her hat — the warm stairwell light is behind her, so her face is a dark "
           "shape with no readable eyes, nose or mouth, only the soft outline of her cheek and chin — and the small crimson velvet ribbon "
           "bow of her half-up hair peeks out at the side of her head under the hat. She keeps waving with the same hand. Keep the man's "
           "out-of-focus shoulder and raised hand in the foreground, her friends, the corridor, the light and everything else in Image 1 "
           "exactly.")
    J_["C19s"] = J([ref("C19.jpg")], HAT, FINISH)
    J_["C19es"] = J([ref("C19e.jpg")], HAT, FINISH)
    J_["C27b"] = J([ref("C27.jpg"), ref("M04_angle-back.jpg"), ref("M04_hair-3.jpg")], TURN.format(
        who="the man", pos="his", to="the far end of the corridor", hair="his dark messy hair with a few snowflakes in it, his ear and the "
        "back of his neck above the grey knitted scarf", keep="He still looks down, tired, toward the phone in his hand whose flashlight is "
        "just coming on at the bottom edge.", refs="Images 2 and 3 show his hair from behind."), FINISH)
    # 고개 돌리기 편집은 27에서 거의 같은 그림으로 돌아왔다(C27b) — 9에서 된 「얼굴만 검게」 편집을 27 · 4에도 굽는다
    J_["C27s"] = J([ref("C27.jpg")], DARK.format(
        who="the man", pos="his", rim="a faint warm rim of the fairy lights behind him traces his hair, his ear and the line of his cheek",
        keep="The only light on him now comes from behind, from the decorated doors and the dusk, so his face and the front of his scarf "
        "fall into deep shadow. He keeps looking down at the phone in his hand, whose flashlight is just coming on at the bottom edge."),
        FINISH)
    J_["C04s"] = J([ref("C04.jpg")], DARK.format(
        who="the man", pos="his", rim="the thin warm rim of light from the far lamp outlines the back of his hair, his ear and his shoulder",
        keep="No light at all falls on him from the camera side. He keeps the same small polite bow, his head tipped forward and down."),
        FINISH)
    J_["C28b"] = J([lay("S28")] + M_REFS_BACK[:2] + [ref("C06.jpg")], STILL, LAYOUT_SIL.format(who="the man"),
        "The black silhouette marks only where and how large he is — he is seen from directly BEHIND. Blue dusk, snow, the outdoor corridor "
        "of an old Korean apartment block. MEDIUM, the camera on the parapet side of the corridor, facing straight at his front door: THE "
        "MAN stands in his door alcove (left of center, the size and place of the black silhouette) with his BACK to the camera, facing his "
        "dark grey steel door — the back of his head, his shoulders dusted with snow, the end of his grey scarf. The small round sensor lamp "
        "on the ceiling right above his door has just clicked on: a warm, soft light pours down over him and over the keyhole; the glowing "
        f"lamp is visible at the top of the frame. With {BAG} still in his left hand and his phone lowered in it (its flashlight still on, "
        "pointing at the floor), he slides the key into the keyhole in one go with his right hand. The lock is exactly the old round brass "
        "keyhole of Image 4 with scratches in the paint around it — no digital door lock, no keypad. His own door is bare, with no "
        "decoration; at the right edge of the frame the neighbor's door alcove glows with warm fairy lights. Soft snowfall in the blue dusk "
        "behind the camera reflects on the wet floor. None of his face is visible.",
        MAN.format(a=2, b=3), f"He wears {M_WINTER}.", FINISH)

    # ── 시댄스 앞 일관성 고침(10-29 — 확정 뒤라 유호님 확인 대기, 02_콘티 「시댄스 지시문(10-29)」) ──
    # 18: 난간 너머가 높은 아파트 단지라 1 · 20의 낮은 주택가와 다르다 — 확정 때 남긴 「18 뒤 벽의 작은 파란 글자 다시 굽기」도 이 한 장으로
    J_["C18v"] = J([ref("C18.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the view beyond the concrete parapet on the right. It becomes the same old "
        "low-rise neighborhood that lies across the street from this apartment block — two- to four-storey old houses and small brick "
        "apartment buildings with flat rooftops and rooftop water tanks, power poles and tangled overhead wires, a few warm lit windows — "
        "under the same blue Halloween dusk sky. No tall apartment towers, no high-rise blocks, and no letters, signs or words on any "
        "building. Keep the corridor, the parapet and its handrail, the man in the camel coat, the girls in costume, the light on the floor "
        "and everything else in Image 1 exactly.", FINISH)
    # 5 · 19: 열린 쪽 난간이 바닥까지 세로 창살 울타리다 — 1 · 3 · 18 · 20 · 26 같은 복도 컷은 허리 높이 콘크리트 난간 + 손잡이
    RAIL = ("Edit this photograph (Image 1). Change only one thing: the railing on the open side of the outdoor corridor. The tall metal "
            "bar fence becomes a waist-high solid grey concrete parapet wall with a round steel handrail on short posts along its top — the "
            "same parapet as along the rest of this old apartment corridor; above it, open air and {beyond}. {keep} Keep the framing and "
            "everything else in Image 1 exactly.")
    J_["C05v"] = J([ref("C05.jpg")], RAIL.format(beyond="the dark night", keep="Keep the man, his hands, the white bag on the floor, "
        "the fallen leaves, the door frame and the light exactly."), FINISH, ratio="4:3")
    KEEP19 = ("Keep the man's out-of-focus shoulder and raised hand in the foreground, and the small girls in costume at the far bright "
              "landing exactly as they are — the witch-hat girl's face stays hidden in the deep shadow of her hat brim.")
    J_["C19v"] = J([ref("C19.jpg")], RAIL.format(beyond="the blue dusk", keep=KEEP19), FINISH)
    # 11: 같은 밤(4 · 10 · 12 사이)인데 하늘이 흐린 낮처럼 밝은 청회색 · 동네 불빛 없음(아르곤 P2 · Opus P3) — 하늘과 동네만 밤으로
    J_["C11v"] = J([ref("C11.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the sky and the town behind him become late at night — a deep navy-blue "
        "night sky, darker toward the top, with a faint orange city glow low over the rooftops and small warm lit windows scattered "
        "across the houses below; nothing is lit by daylight any more. The man stays exactly the same pure black silhouette, his face a "
        "solid black shape with no features, its outline reading against the dark sky. Keep the framing, the parapet, the corridor ceiling "
        "edge and everything else in Image 1 exactly.", FINISH)
    # 28: 문 위 등이 납작한 흰 천장등 — 바로 뒤 29(같은 등의 극접사)와 2는 투명 유리 둥근 갓(아르곤 P1 중 맞는 부분 — 켜져 있는 것은 콘티대로)
    J_["C28v"] = J([ref("C28.jpg"), ref("C29.jpg")],
        "Edit this photograph (Image 1). Change only one thing: the lamp on the ceiling above his door becomes the same small round "
        "clear-glass globe lamp as in Image 2 — a clear glass sphere fixed just below the ceiling with a new bulb glowing warm inside — "
        "and its warm light still pours down over him and over the door. Keep the man, the door, the parapet, the snow and everything else "
        "in Image 1 exactly.", FINISH)

    # 14 · 36 큰 간판에 늘켬 로고 D(10-29 유호님 「D로 가자」 — 호박빛 바탕 · 흰 글자, 라벨/로고_늘켬.py) — 승인 로고를 참고로 넣어 정지컷에
    # 함께 굽는다(제작 규칙 원칙 — 장면 속 간판). 작은 아래 줄 「24시 동네 편의점」은 간판에서 뭉개지기 쉬워 큰 글자 「늘켬」만.
    # → 받은 판(C14L · C36L)은 글자는 맞았으나 간판이 납작한 노란 상자가 되어 「AI티」(유호님 10-29) — 쓰지 않고 옛 판 + 후반 글자로(02_콘티 11-3).
    SIGN = ("Edit this photograph (Image 1). Change only one thing: the plain amber sign band of the convenience store {where} now carries "
            "the store's logo from Image 2 — the white Korean word 「늘켬」 in exactly Image 2's heavy, rounded sans-serif lettering, centered "
            "on the amber band and sized to fill most of its height, glowing softly like a lit shop sign at night. Write exactly these two "
            "Korean letters, 늘켬, and nothing else on the band — no other words, no English, no numbers. Keep the band's size, shape and "
            "amber color, {keep} and everything else in Image 1 exactly.")
    J_["C14L"] = J([ref("C14.jpg"), ref("logo_D.png")], SIGN.format(where="across the street, seen through the window",
        keep="the man eating at the window, the room, the light"), FINISH)
    J_["C36L"] = J([ref("C36.jpg"), ref("logo_D.png")], SIGN.format(where="on the right side of the snowy street",
        keep="the old apartment block, the parked cars, the falling snow, the light"), FINISH)

    # ── ⑥ 끝 35~36 ──
    # 35(10-27 22:4x): 26은 판(PL26)에 민재를 합성해 앉혔으므로, 사람이 없는 PL26에서 바로 고친다
    J_["C35"] = J([ref("PL26.jpg")],
        "Edit this photograph (Image 1). The same corridor, the same camera, framing and lens, the same decorations — later that night: the "
        "sky beyond the parapet is now dark night blue, snow still falling. The man who lives behind the dark doorway at about 40% of the "
        "frame width has just gone inside: that door is swinging shut — in the narrowing gap of his alcove only the end of a grey knitted scarf and a corner of a white bag are still "
        "visible — and his sensor lamp is now ON: the two lamps, his and the neighbor's, glow warm side by side. Keep everything else in "
        "Image 1 exactly.", FINISH)
    # 35 더하기(C35b, 10-27 23:1x): C35는 503 문 틈의 목도리 끝 · 봉투 귀퉁이까지 나왔으나 503 등이 켜지지 않았다 — 그 한 가지만 더한다
    J_["C35b"] = J([ref("C35.jpg")],
        "Edit this photograph (Image 1). Change only one thing: add a small round frosted-glass ceiling lamp, switched ON and glowing warm, "
        "on the ceiling right above the half-closed door at about 40% of the frame width, so that two warm lamps now glow side by side "
        "over the two neighboring doors. Keep everything else in Image 1 exactly.", FINISH)
    J_["C36"] = J([lay("S36")], STILL, LAYOUT_GREY,
        "Christmas Eve night, snow falling: a quiet snow-covered street of an old Seoul neighborhood, WIDE, from the middle of the street at "
        "a low height: on one side the old five-storey corridor-style apartment block with its open outdoor corridors (a row of small warm "
        f"door lamps on the 5th floor), and across the street {STORE}, its light spilling onto the fresh snow. Street lamps, power lines, "
        "parked cars under snow. Calm and warm. The camera slowly pulls back.", FINISH)
    for k, v in J_.items():
        n = int(k[1:3]) if k[:1] == "C" and k[1:3].isdigit() else 0
        if 1 <= n <= 19:
            v["prompt"] = v["prompt"].replace(STILL, STILL_AUTUMN)
        elif n in (20, 21):
            v["prompt"] = v["prompt"].replace(STILL, STILL_PLAIN)
    return J_


if __name__ == "__main__":
    J_ = jobs()
    out = V / "ego" / "jobs_conti.json"
    out.write_text(json.dumps(J_, ensure_ascii=False, indent=1), encoding="utf-8")
    (HERE / "지시문").mkdir(exist_ok=True)
    # 저장소 사본: 참조는 파일 이름만(git 밖 경로 · 원본 프레임 이름은 뺀다)
    pub = {k: {**v, "refs": [Path(r.replace("(아직 없음) ", "")).name for r in v["refs"]]} for k, v in J_.items()}
    (HERE / "지시문" / "이미지콘티.json").write_text(json.dumps(pub, ensure_ascii=False, indent=1), encoding="utf-8")
    long = {k: len(v["prompt"]) for k, v in J_.items() if len(v["prompt"]) > 4000}
    missing = {k: [r for r in v["refs"] if r.startswith("(")] for k, v in J_.items()}
    print(len(J_), "작업 · 4000자 넘는 것", long)
    print("참조가 아직 없는 작업", {k: len(m) for k, m in missing.items() if m})
