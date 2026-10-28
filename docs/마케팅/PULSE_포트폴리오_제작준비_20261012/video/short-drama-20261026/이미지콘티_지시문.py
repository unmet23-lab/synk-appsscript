# 7번 「사랑 한 칸」 이미지 콘티 지시문(2026-10-26) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록을 만든다.
#   python -X utf8 이미지콘티_지시문.py            → synk-vendor/…/콘티/p7/ego/jobs.json(실행기 gen.mjs가 읽음) · 같은 폴더 지시문/이미지콘티.json(저장소 사본)
#   python -X utf8 이미지콘티_지시문.py --보기 1-5 → 그 컷의 지시문과 참조만 찍는다
# 길은 「매진 임박」 v4(만족 사례 S31) · 8번 · 11번과 같다: 원본 첫 프레임의 사람 자리만 검은 실루엣으로 바꾼 배치도(이미지콘티_배치도.py) +
# 배역 참조(고정 얼굴 세트 — 주인공 넷, 같이 나오는 사람 둘) + 장소 기준 그림(L*, 먼저 굽고 고른 판). 원본 프레임은 넣지 않는다.
# 얼굴 크기 · 자리는 원본 첫 프레임의 YuNet 상자(원본첫프레임/_얼굴.json)를 「화면 높이의 몇 %」로 적는다(현장 노트 gemini_사진 「클로즈업은 화면 안 경계로」).
# 빛은 지시문으로만(후보정 없음, 결정 10-24). 화면 속 글자(혼인신고서 · 칸찬 라벨 · 로고)는 크로마 초록 대역으로 굽고 후반에서 얹는다.
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7")
LORA = "C:/SYNK-LoRA/validation"
cuts = {f"{c['화']}-{c['컷']}": c for c in json.load(open(V / "컷목록.json", encoding="utf-8"))}
facebox = json.load(open(V / "원본첫프레임" / "_얼굴.json", encoding="utf-8"))

START = "Create one still photograph. A cinematic film still from a Korean romantic-comedy web drama, vertical 9:16 frame."
TAIL = ("Photorealistic film still with natural skin texture, slight film grain and natural lens falloff, shot on a cinema camera. "
        "Nobody in the frame looks into the camera lens. No text, no subtitles, no letters, no logos, no watermarks anywhere.")   # 10-28 Opus 2차: 렌즈를 보는 시선(1-4 · 1-39 · 2-39)
TAIL_G = ("Photorealistic film still with natural skin texture, slight film grain and natural lens falloff, shot on a cinema camera. "
          "Nobody in the frame looks into the camera lens. Apart from the flat green placeholder, no text, no letters, no logos, no watermarks anywhere.")
ACT = ("The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never exaggerated or cartoonish.")
LAYOUT = ("Image {n} is a layout guide: the black silhouettes show only where the people are in the frame, how big they are and in what pose "
          "— match that placement, size and pose exactly, including how much of each person is cut off by the frame edges. The silhouettes "
          "have no faces, clothes or colors to copy. Its flat light-grey background is not a wall — ignore it.")
LAYOUT0 = ("Image {n} is a layout guide for the camera framing: match the position, size and angle of every shape in it. Its flat light-grey "
           "background is not a wall — ignore it.")
GREEN = ("The bright green area in Image {n} marks exactly where a flat, evenly lit chroma-key green placeholder (pure #00B140, no texture, "
         "no writing) sits in the frame — match its position, size and angle.")

# ── 배역(고정 얼굴 세트, C:/SYNK-LoRA/validation/<id>/refs) ──
P = {
    "S": dict(name="Seojin", dir="F03_seojin", refs=["01_hero", "02_left90", "03_right45", "04_fullbody"],
              face="one young Korean woman in her late twenties named Seojin. Keep her face exactly the same in every detail: long, narrow "
                   "dark brown eyes that fold into thin crescents when she smiles, slightly high cheekbones, a slim tapered jaw, a straight nose, "
                   "nude-coral lips, bright neutral-toned glowing skin, and natural black hair (close to #1D1C13) pulled back neatly into a sleek "
                   "low ponytail so her whole forehead shows, with small gold hoop earrings. Slim, 170 cm."),
    "I": dict(name="Ian", dir="M01_ian", refs=["01_hero", "02_left90", "03_right45", "04_fullbody"],
              face="one young Korean man in his late twenties named Ian. Keep his face exactly the same in every detail: dark brown eyes with "
                   "subtle inner double eyelids, a slim oval face with a well-defined jawline, a straight nose bridge, natural rosy-brown lips, "
                   "bright warm-toned skin with a faint shadow of stubble around his upper lip and chin, and medium-length natural medium-brown "
                   "hair (close to #483632) with a center part, in soft voluminous waves that fall toward his cheekbones. Slim, 182 cm, firm shoulders."),
    "M": dict(name="Minjae", dir="M04_minjae", refs=["01_hero", "02_left90", "03_right90", "04_fullbody"],
              face="one Korean man aged 28 named Minjae. Keep his face exactly the same in every detail: small double-eyelid eyes that droop "
                   "slightly at the outer corners, a round face with soft cheeks, a rounded nose tip, a soft rounded jaw, warm-toned skin with a "
                   "faint five o'clock shadow on the chin and upper lip, and short black hair with messy straight bangs. Average build, 175 cm."),
    "Y": dict(name="Soyeon", dir="F05_soyeon", refs=["01_hero", "02_left90", "03_right90", "04_fullbody"],
              face="one Korean woman aged 35 named Soyeon. Keep her face exactly the same in every detail: dark brown double-eyelid almond eyes, "
                   "an oval face with slightly full cheeks, faint soft shadows under her eyes, a straight nose with a slightly wide bridge, natural "
                   "rosy lips, warm-toned skin with light natural makeup, and collarbone-length natural dark-brown hair (close to #2A1F18) with "
                   "soft C-curl ends. A 162 cm woman with an average, soft build."),
}
ID_TAIL = ("Ignore the backgrounds, clothing and lighting of the reference photos. Do not add moles, freckles, marks, tattoos, text or logos.")

# ── 옷(장면마다) ──
W = {
    "I_office": "Ian wears a navy two-button suit jacket, a white dress shirt and a plain dark-navy tie.",
    "M_office": "Minjae wears a charcoal-grey wool cardigan over a light-blue oxford shirt with no tie.",
    "I_home": "Ian wears a plain charcoal-grey crew-neck sweatshirt and light-grey cotton sweatpants.",
    "I_suit_home": "Ian, just home from work, wears his navy suit jacket and white shirt with the dark-navy tie loosened.",
    "I_night": "Ian wears a plain oatmeal-beige long-sleeve cotton t-shirt and navy pajama pants.",
    "S_home": "Seojin wears a soft oatmeal-cream chunky knit cardigan over a pale-blue striped cotton pajama shirt.",
    "S_apron": "Seojin wears a plain sage-green cotton apron over a white long-sleeve t-shirt.",
    "S_cafe": "Seojin wears a crisp white collared cotton shirt with the sleeves rolled once.",
    "S_cafe2": "Seojin wears a navy crew-neck knit sweater.",
    "Y_cafe": "Soyeon wears a soft mustard-yellow knit cardigan over a cream crew-neck t-shirt.",
    "S_out": ("Seojin is dressed up for a night out in a way Ian has never seen: a fitted wine-red long-sleeve knit midi dress, a thin gold "
              "necklace, small gold hoop earrings, a little more makeup than usual."),
    "S_weekend": "Seojin wears a cream cable-knit sweater and light-blue jeans, a natural canvas shopping tote on her shoulder.",
    "S_pj": "Seojin wears a dusty-rose satin pajama set (a long-sleeve button-up shirt and long pants).",
}
DRESS = ("a brand-new emerald-green satin midi dress with thin straps, a white paper price tag still hanging from its strap on a string")
LUNCH = ("a rectangular two-compartment lunchbox in matte cream-white plastic with a light-oak-colored lid: a long compartment for rice and "
         "a square compartment for side dishes")
LUNCH_FULL = ("the side-dish compartment packed full and neat with Korean banchan — yellow rolled-egg omelet slices, green seasoned spinach, "
              "glossy soy-braised beef strips, small stir-fried anchovies with sesame, two cherry tomatoes — and the rice compartment filled "
              "with white rice sprinkled with black sesame")
BOX = ("a plain unprinted kraft-paper delivery box about 30 cm wide, its lid taped shut, with one flat green placeholder rectangle as its label")

# ── 장소(글) · 빛 ──
L = {
    "office": ("Location: a bright open-plan office in Seoul — long rows of white desks with black monitors and laptops, grey mesh office "
               "chairs, white walls, a white ceiling with rows of square LED panel lights, big windows along one side."),
    "dining": ("Location: the dining corner of a cozy two-room apartment in Seoul — a light natural-oak dining table for two with two wooden "
               "chairs, a small kitchen behind with white cabinets, a stainless sink, a range hood and a few jars, a pendant lamp over the "
               "table, light oak floor, warm white walls."),
    "entry": ("Location: the entrance hallway of the same apartment — a small sunken entry with beige stone tiles and a white shoe cabinet, "
              "one step up to the light oak floor of a narrow hallway with warm white walls, a white front door, and a glass-paneled oak "
              "middle door (jungmun) between the hallway and the living room."),
    "laundry": ("Location: a small laundry nook at the end of the apartment hallway — a white top-loading washing machine, a pale-blue "
                "plastic laundry basket of clean folded clothes on top, a white wall, light oak floor."),
    "bedroom": ("Location: the apartment's bedroom — a double bed with rumpled oatmeal-linen bedding and white pillows, a wooden nightstand "
                "with a small fabric-shade bedside lamp, sheer cream curtains, a white bedroom door."),
    "cafe": ("Location: a bright café in Seoul — light wood tables, white walls, big windows with green potted plants, white ceramic coffee "
             "cups on saucers."),
    "white": "Location: none — a pure, seamless white studio background.",
}
LREF = {"office": "L1", "dining": "L2", "entry": "L3", "laundry": "L4", "bedroom": "L5", "cafe": "L6"}
LNAME = {"office": "office", "dining": "dining corner and kitchen", "entry": "entrance hallway", "laundry": "laundry nook",
         "bedroom": "bedroom", "cafe": "café"}
LIGHT = {   # 10-26 23:4x: 원본은 밤 집 장면도 밝은 TV 드라마 빛이다(자막 띠를 뺀 평균 밝기 집 100~135 · 침실 113~135) — 첫 판의 「한 스톱 어둡게」는 뺐다
    "night": ("Light: night at home, but lit brightly and softly like a Korean TV romantic comedy — warm 3000K ceiling and pendant light filling the "
              "whole room, soft fill light on the faces, bright clean skin tones, gentle shadows, no dark corners; the window is dark blue. "
              "Overall brightness of a well-lit TV drama interior, not moody or dim."),
    "evening": ("Light: early evening at home, lit brightly and softly like a Korean TV romantic comedy — warm 3000K room light everywhere, soft "
                "fill on the faces, bright clean skin tones, gentle shadows; the window outside is blue dusk. Not moody or dim."),
    "bed": ("Light: night in the bedroom, but lit like a Korean TV drama — the warm bedside lamp plus soft warm fill light from above, so the bed, "
            "the walls and both faces are clearly and evenly lit; bright, soft and cozy, not dark or moody."),
    "morning": ("Light: a weekend morning; bright, soft neutral daylight from a window mixed with the warm entrance light, faces bright and clean."),
    "office": ("Light: bright, even, cool-white office light from the ceiling panels plus soft daylight from the windows; clean bright "
               "whites, slightly high-key, like a Korean office drama."),
    "cafe": ("Light: bright late-morning daylight pouring through the big windows; airy, soft and high-key, fresh greens and warm wood."),
    "white": "Light: soft, even, shadowless white studio light.",
}


def framing(k, idx=0, who="his"):   # 원본 첫 프레임의 얼굴 상자 → 화면 안 경계(현장 노트 「클로즈업은 화면 안 경계로」 — 첫 판은 「얼굴이 화면 높이의 25%」를 무시하고 넓게 나왔다)
    fs = facebox.get(k) or []
    if len(fs) <= idx:
        return ""
    f = fs[idx]
    top = f["y"] - 0.55 * f["h"]           # 정수리(상자 위는 눈썹 언저리)
    chin = f["y"] + f["h"]
    cx = f["x"] + f["w"] / 2
    head = ("the top of the head is cut off by the top edge of the frame" if top < 0.01
            else f"the top of the head is about {round(top * 100)}% down from the top edge")
    size = ("a tight close-up" if f["h"] >= 0.3 else "a medium close-up (head and shoulders)" if f["h"] >= 0.2
            else "a medium shot" if f["h"] >= 0.12 else "a wide shot")
    return (f"Shot size — follow exactly, this is {size}: {who} face is big in the frame, about {round(f['w'] * 100)}% of the frame width; "
            f"{head}; the chin is about {round(chin * 100)}% down from the top edge; the face is centered about {round(cx * 100)}% in from "
            "the left edge. Do not pull the camera back to show more of the room.")



# ── 컷마다 ──
# f: 얼굴 참조(첫 사람 네 장 · 다음 사람 두 장), loc · light, w: 옷 열쇠, t: 구도 · 몸짓(영어), fx: 숫자 자리 (얼굴 순번, 소유격) 또는 None,
# g: 초록 자리 있음, lay: 배치도 문구(사람 있음 LAYOUT / 사람 없음 LAYOUT0)
C = {
    # ── 1화 ① 회사 점심 ──
    "1-1": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=(0, "Ian's"),
                t=f"Wide shot at standing eye level, 24mm lens. Ian sits at his white office desk right of center, holding open {LUNCH} in "
                  "both hands and staring down into it; Minjae stands bent over right behind his left shoulder, both hands on Ian's shoulders, "
                  "peering into the lunchbox with raised eyebrows. The desk surface fills the lower third of the frame, the rows of desks and "
                  "the ceiling lights recede behind them. Both look mildly surprised."),
    "1-2": dict(f="", loc="office", light="office", w=["I_office"], fx=None,
                t=f"Close insert shot over Ian's right shoulder (his navy sleeve out of focus along the lower left edge): his two hands hold "
                  f"{LUNCH} tilted toward the camera — the rice compartment holds plain white rice with one single red pickled plum (maesil) "
                  "in the middle, and the corner of the side-dish compartment shows it is completely empty. White desk below, 85mm lens, "
                  "shallow depth of field."),
    "1-3": dict(f="", loc="office", light="office", w=[], fx=None,
                t=f"Tight insert close-up from above at an angle, 85mm macro lens: the square side-dish compartment of {LUNCH} — completely "
                  "empty and clean, only a pair of light wooden chopsticks lying across it. The empty compartment fills most of the frame; "
                  "the rest is the out-of-focus edge of the box and a pale blur. No desk, no office, no second container visible."),   # 10-27 첫 판이 책상 위 상자 둘로 넓게 나옴
    "1-4": dict(f="IM", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                t=f"Bust shot of Ian seated at his desk, 50mm lens at his eye level. He holds {LUNCH} near his chest with both hands, palms "
                  "up, in a small apologetic shrug, eyebrows slightly raised and lips slightly parted as if starting to explain. Only "
                  "Minjae's two hands (in his charcoal cardigan sleeves) rest on Ian's shoulders from behind at the upper left edge — Minjae's "
                  "face is not in the frame. Inside the open lunchbox the rice compartment holds plain white rice with one red pickled plum, "
                  "and the side-dish compartment is completely EMPTY and clean — no food at all in it."),   # 10-28 이해 시험 두 명 모두: 반찬 칸이 차 있어 「반찬이 끊겼어」와 어긋남
    # ── 1화 ② 회상 — 집 식탁(밤) ──
    "1-5": dict(f="SI", loc="dining", light="night", w=["S_home", "I_home"], fx=(0, "her"),
                t="Medium over-the-shoulder shot from behind Ian, 50mm lens at seated eye level: along the right edge the back of Ian's dark "
                  "head and his hand holding a glass of green tea are large and out of focus. Across the dining table at night Seojin holds "
                  "an open small planner notebook up in both hands toward him, looking straight at him calmly and seriously, lips slightly "
                  "parted as if starting to speak. A wooden door and the warm wall behind her."),   # 10-28 Opus 원본 대조: 원본 5는 남자 어깨 너머(오른쪽 끝 머리 · 녹차 잔)
    "1-6": dict(f="I", loc="dining", light="night", w=["I_home", "S_home"], fx=(0, "his"),
                t="Medium over-the-shoulder shot from behind Seojin: the back of her head and her cream knit shoulder fill the lower left "
                  "corner, large and out of focus. Across the table Ian sits drinking water from a clear glass held to his lips with his "
                  "right hand, his eyes slightly widened above the glass, looking at her. Light oak table edge at the bottom right."),
    "1-7": dict(f="I", loc="dining", light="night", w=["I_home"], fx=(0, "his"),
                t="Close-up of Ian in three-quarter profile facing the right edge, 85mm lens: he has just choked on his water — the clear "
                  "glass is still at his lips in his right hand, his eyes squeezed half shut, starting a small cough. The kitchen behind is "
                  "soft and warm."),
    "1-8": dict(f="I", loc="dining", light="night", w=["I_home", "S_home"], fx=(0, "his"),
                t="Medium over-the-shoulder shot: Seojin's cream knit shoulder and the back of her head out of focus along the left edge. "
                  "Across the table Ian, still recovering from a cough, presses a crumpled white paper napkin against his mouth with his left "
                  "hand — the napkin covers his mouth and chin completely, only his eyes and nose show — and raises his right palm toward her "
                  "in a small 'wait a second' gesture; a glass of water on the table in front of him."),   # 10-27 첫 판은 냅킨 없이 컵을 듦
    "1-9": dict(f="S", loc="dining", light="night", w=["S_home", "I_home"], fx=(0, "her"),
                t="Medium over-the-shoulder shot from behind Ian: the back of his head and his charcoal shoulder out of focus along the right "
                  "edge. Seojin sits across the table, leaning slightly forward, explaining to him patiently with a small sigh, lips slightly "
                  "parted as if speaking, her hands resting on the table."),
    "1-10": dict(f="S", loc="dining", light="night", w=["S_home"], fx=(0, "her"),
                 t="Close-up of Seojin, 85mm lens: her face fills the middle of the frame, the top of her head close to the upper edge. She "
                   "looks at him in silence, a quiet, slightly hurt, searching look, lips closed. Background soft and warm."),
    "1-11": dict(f="I", loc="dining", light="night", w=["I_home", "S_home"], fx=(0, "his"),
                  t="Medium over-the-shoulder shot: the back of Seojin's head with her sleek low ponytail, out of focus at the upper left. "
                    "Ian sits across the table with his hand around a glass, hesitating, glancing up at her with a sheepish half-smile, lips "
                    "slightly parted as if about to make a small joke."),
    "1-12": dict(f="I", loc="dining", light="night", w=["I_home", "S_home"], fx=(0, "his"),
                  t="Bust shot of Ian at the table. Seojin's hand in her cream knit sleeve comes in from the lower left edge and gently squeezes "
                    "both his cheeks between her thumb and fingers, pushing his lips into a small pout; he freezes, eyes wide and looking at "
                    "her, not resisting. Only her hand and forearm are in the frame."),
    "1-13": dict(f="S", loc="dining", light="night", w=["S_home"], fx=(0, "her"),
                  t="Bust shot of Seojin across the table, 50mm lens. She lets out a short, disbelieving breath, one hand raised toward him "
                    "at the lower right (her fingers reaching out of the frame), her eyebrows slightly raised, lips parted on the breath."),
    "1-14": dict(f="I", loc="dining", light="night", w=["I_home", "S_home"], fx=(0, "his"),
                  t="Bust shot of Ian with his cheeks still squeezed by Seojin's hand from the lower left; he looks up at her with sorry, "
                    "puppy-like eyes, mumbling a small apology through his squished lips. Only her hand and forearm are in the frame."),
    # ── 1화 ③ 회사 ──
    "1-15": dict(f="M", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "his"),
                  t="Bust shot of Minjae sitting across the desk from Ian, 50mm lens: eyebrows raised, lips slightly parted, about to say "
                    "something teasing. In the lower right foreground Ian's hand holding wooden chopsticks is large and out of focus."),
    "1-16": dict(f="M", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "his"),
                  t="Bust shot of Minjae leaning toward the camera, pointing with his right index finger down at the lunchbox in the out-of-"
                    "focus lower right foreground, a playful knowing look, lips slightly parted as if speaking. Ian's out-of-focus hand at the "
                    "bottom edge."),
    "1-17": dict(f="I", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                  t="Medium shot of Ian seen from his left side in near profile, facing the left edge, sitting at his desk with chopsticks in "
                    "his hand over the open lunchbox, talking with a sulky, defensive look, lips slightly parted. Bright office and ceiling "
                    "lights behind him, out of focus."),
    "1-18": dict(f="I", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                  t="Close-up of Ian chewing the sour pickled plum, wooden chopsticks still near his mouth in his right hand, his eyes "
                    "narrowed at the sourness and a little sorry for himself, mouth closed as he chews. Office out of focus behind."),
    "1-19": dict(f="M", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "his"),
                  t="Bust shot of Minjae across the desk, over Ian's out-of-focus navy shoulder at the left edge: Minjae holds a white paper "
                    "coffee cup at his lips with his right hand (the cup covers his mouth), eyes on Ian, eyebrows raised in a casual question."),
    "1-20": dict(f="I", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                  t="Bust shot of Ian with his head lowered, looking down at the lunchbox on the desk below the frame, his eyes cast down so "
                    "his mouth is mostly hidden by the downward angle, a quiet, slightly guilty look."),
    "1-21": dict(f="M", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "his"),
                  t="Bust shot of Minjae over Ian's out-of-focus navy shoulder at the right edge: Minjae leans back with a calm, knowing "
                    "nod, eyes half closed, lips slightly parted as if speaking."),
    # ── 1화 ④ 집 — 서류(저녁) ──
    "1-22": dict(f="", loc="entry", light="evening", w=[], fx=None,
                  t="Insert shot of the glass-paneled oak middle door (jungmun) in the hallway swinging open toward the camera, seen from the "
                    "living-room side, 50mm lens; the warm-lit hallway is visible through the opening, nobody in sight yet."),
    "1-23": dict(f="I", loc="entry", light="evening", w=["I_suit_home", "S_apron"], fx=None,
                  t="Wide shot from the living-room side: Seojin's shoulder in her sage-green apron fills the left half of the foreground, "
                    "very large and out of focus; far behind her, small in the frame, Ian steps in through the open middle door from the "
                    "entrance, in his suit, holding his lunch bag, looking tired."),
    "1-24": dict(f="", loc="dining", light="evening", w=["S_apron"], fx=None,
                  t="Insert close-up of the chrome kitchen faucet over a stainless sink, 85mm lens: Seojin's hand in her white sleeve reaches "
                    "in from the lower right to turn the water off; part of her sage-green apron out of focus at the bottom right."),
    "1-25": dict(f="S", loc="dining", light="evening", w=["S_apron"], fx=(0, "her"),
                  t="Bust shot of Seojin standing at the kitchen counter, 50mm lens: she looks down for a moment, calm and composed, lips "
                    "slightly parted as she begins to speak, a small determined set to her face."),
    "1-26": dict(f="", loc="dining", light="evening", w=["I_suit_home"], fx=None, g=True,
                  t="Insert shot looking down at the light-oak dining table at an angle, 50mm lens: a single A4 sheet lies on the table with a "
                    "black ballpoint pen on it — the sheet itself is the flat green placeholder. Out of focus at the bottom edge, Ian's navy "
                    "suit shoulder."),
    "1-27": dict(f="", loc="dining", light="evening", w=[], fx=None, g=True,
                  t="Insert close-up of the A4 sheet on the light-oak table, filling most of the frame at a diagonal angle, 85mm lens — the "
                    "sheet is the flat green placeholder (it will become a blank marriage registration form); a strip of oak table shows at "
                    "the upper left."),
    "1-28": dict(f="", loc="dining", light="evening", w=["I_suit_home", "S_apron"], fx=None,
                  t="Tight insert at waist height, 85mm lens, no faces and no heads anywhere in the frame: only hands and clothes fill the "
                    "frame — Seojin's two hands in white sleeves come in from the left edge and grip Ian's hand and the cuff of his navy suit "
                    "sleeve, pulling it; his navy suit jacket, white shirt and belt buckle fill the right half of the frame, cut off at the "
                    "chest by the top edge and at the thighs by the bottom edge. Warm kitchen wall soft behind."),
    "1-29": dict(f="S", loc="dining", light="evening", w=["S_apron", "I_suit_home"], fx=(0, "her"),
                  t="Medium over-the-shoulder shot: the back of Ian's head and his navy shoulder out of focus along the right edge. Seojin, "
                    "in her apron, clings to his upper arm with both hands and presses the lower half of her face against his navy sleeve — "
                    "her nose, mouth and chin are hidden behind his arm, only her eyes and forehead show above it, looking up at him with "
                    "coaxing eyes. The kitchen shelves behind her. Her mouth must not be visible at all — everything below her eyes is "
                    "pressed into and covered by his navy sleeve (this line is spoken off-mouth)."),   # 10-28 아르곤 검수: 두 판 모두 입이 드러남
    "1-30": dict(f="I", loc="dining", light="evening", w=["I_suit_home", "S_apron"], fx=(0, "his"),
                  t="Bust shot of Ian over the back of Seojin's head (her sleek black ponytail, out of focus in the lower left foreground): "
                    "he looks down at her, uneasy and gentle at once, lips slightly parted as if speaking."),
    "1-31": dict(f="I", loc="entry", light="evening", w=["I_suit_home"], fx=(0, "his"),
                  t="Bust shot of Ian from a slightly different angle, in the hallway, 50mm lens: a troubled, conflicted face, he glances "
                    "aside with his lips pressed together."),
    # ── 1화 ⑤ 카페 ──
    "1-32": dict(f="YS", loc="cafe", light="cafe", w=["Y_cafe", "S_cafe"], fx=(0, "her"),
                  t="Bust shot of Soyeon sitting at a café table, 50mm lens, with an amused, knowing smile, lips slightly parted as if "
                    "speaking; Seojin's white-shirt shoulder out of focus in the lower right foreground."),
    "1-33": dict(f="S", loc="cafe", light="cafe", w=["S_cafe", "Y_cafe"], fx=(0, "her"),
                  t="Bust shot of Seojin sitting at the café table with her hands folded around a white coffee cup, over Soyeon's out-of-"
                    "focus shoulder at the left edge; she answers with a tired little sigh, lips slightly parted as if speaking."),
    "1-34": dict(f="S", loc="cafe", light="cafe", w=["S_cafe"], fx=(0, "her"),
                  t="Close-up of Seojin looking down at the phone in her hand below the frame (its glow on her face), letting out a quiet "
                    "sigh with her lips closed, a little frustrated."),
    "1-35": dict(f="Y", loc="cafe", light="cafe", w=["Y_cafe", "S_cafe"], fx=(0, "her"),
                  t="Bust shot of Soyeon at the café table, a white coffee cup on its saucer in front of her, explaining like an older "
                    "sister with a gentle smile, lips slightly parted; Seojin's out-of-focus arm and coffee cup in the lower right "
                    "foreground. Other café guests far behind, out of focus."),
    "1-36": dict(f="S", loc="cafe", light="cafe", w=["S_cafe", "Y_cafe"], fx=(0, "her"),
                  t="Bust shot of Seojin over Soyeon's out-of-focus shoulder at the left edge: she leans forward a little, palms open, "
                    "asking back in exasperation, lips parted as if speaking. Big bright window behind."),
    # ── 1화 ⑥ 회사 — 그의 고민(민재가 책상에 엎드리고, 이안이 그 등에 업힌다 — 원본 짜임 그대로) ──
    "1-37": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=(0, "Ian's"),
                  t="Wide shot from across the office, 28mm lens at standing eye level, the dark backs of two monitors out of focus in the "
                    "lower foreground: Minjae sits slumped over his desk with both arms stretched out on it, and Ian, standing at the left, "
                    "shuffles toward him looking defeated. Both are small in the frame."),
    "1-38": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=(1, "Ian's"),
                  t="Close-up from desk height: Minjae sits slumped forward with his cheek on the white desk, his face in the lower half of the "
                    "frame, eyes open and patient. Ian is bent forward over Minjae's back from behind — his chest pressed on Minjae's back, "
                    "his arms around Minjae's shoulders, his own head resting just above Minjae's head — so Ian's face is in the upper half, "
                    "close to Minjae's, whining softly with a pained little frown and his lips slightly parted. Ian is not standing upright."),
    "1-39": dict(f="MI", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "Minjae's"),
                  t="Close-up from desk height: Minjae lies with the side of his head on the desk, half-closed eyes looking ahead; the lower "
                    "part of his face is hidden behind Ian's navy sleeve, whose arm hangs over his shoulder from above. Only Ian's chin and "
                    "mouth peek in at the very top left edge. Minjae's nose, mouth and chin must be completely covered by Ian's forearm lying "
                    "across them — only Minjae's eyes, brow and hair are visible."),   # 10-28 아르곤 검수: 민재 입이 드러남
    "1-40": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=(0, "Ian's"),
                  t="Close-up: Ian, draped over Minjae's back, rests his chin on his folded hands on Minjae's shoulder, his face large in the "
                    "upper part of the frame, speaking with a sulky, self-assured little pout, lips slightly parted; Minjae's head lies on "
                    "the desk at the lower right, partly cut off by the frame."),
    "1-41": dict(f="MI", loc="office", light="office", w=["M_office", "I_office"], fx=(0, "Ian's"),
                  t="Close-up from desk height, both faces very close to the lens and filling the frame: Minjae lies on the desk in the "
                    "lower half of the frame, his cheek on his folded arms, turning his face up toward Ian and speaking with a calm warning "
                    "look, lips parted; Ian is draped over Minjae's back, his face in the upper left, partly hidden behind Minjae's messy "
                    "black hair, eyes looking down at him. Minjae's face is about one third of the frame width, centered about 70% down from "
                    "the top edge. No wide view of the office — only blurred desk and ceiling light behind."),
    "1-42": dict(f="Y", loc="cafe", light="cafe", w=["Y_cafe", "S_cafe"], fx=(0, "her"),
                  t="Bust shot of Soyeon leaning in across the café table with a sly little smile, lips closed, about to share a secret; "
                    "Seojin's out-of-focus shoulder at the lower right."),
    "1-43": dict(f="Y", loc="cafe", light="cafe", w=["Y_cafe"], fx=None,
                  t="Extreme close-up of Soyeon's lips and nose only, 100mm lens, so close that her lips fill the upper middle of the frame "
                    "and her mustard cardigan collar the lower part; her lips are parted mid-whisper. Her eyes are cut off by the top edge."),
    "1-44": dict(f="S", loc="cafe", light="cafe", w=["S_cafe", "Y_cafe"], fx=(0, "her"),
                  t="Medium shot of Seojin at the café table over Soyeon's out-of-focus head and shoulder at the left edge: she has frozen, "
                    "eyes wide, startled by the idea, her hands around her coffee cup."),
    "1-45": dict(f="S", loc="cafe", light="cafe", w=["S_cafe"], fx=(0, "her"),
                  t="Close-up punch-in on Seojin, 85mm lens, slightly from the left: wide-eyed, leaning forward, lips parted as she asks "
                    "'how?', a white coffee cup on its saucer at the bottom of the frame."),
    # ── 2화 ① 단서(밤) ──
    "2-1": dict(f="I", loc="laundry", light="night", w=["I_home"], fx=None,
                 t=f"Wide shot of the laundry nook at night, 28mm lens: Ian stands with his back to the camera at the white top-loading "
                   f"washing machine, folding laundry from the pale-blue basket, and lifts out {DRESS}. He is small, standing in the left-"
                   "middle of the frame, full body from head to slippers. The camera looks straight at his back: we see the back of his head "
                   "and his navy sweater, not his face or profile, and the washing machine is right in front of him, clearly visible."),   # 10-28 첫 판은 복도에서 옆으로 선 이안 · 세탁기 안 보임
    "2-2": dict(f="I", loc="laundry", light="night", w=["I_home"], fx=(0, "his"),
                 t=f"Bust shot of Ian holding up {DRESS} — the dress fills the lower left foreground, out of focus — and looking at it "
                   "with a puzzled tilt of his head, lips closed."),
    "2-3": dict(f="", loc="laundry", light="night", w=["I_home"], fx=None,
                 t=f"Insert shot of {DRESS}, held up by Ian's two hands at the upper corners of the frame, the price tag hanging in the "
                   "middle; the pale-blue laundry basket out of focus below."),
    "2-4": dict(f="", loc="entry", light="night", w=["S_out"], fx=None, g=True,
                 t=f"Insert low shot on the entrance floor at night, 35mm lens close to the tiles: Seojin's foot in a black heeled ankle "
                   f"boot steps down onto the beige stone tiles from the left; beside the shoe cabinet stands {BOX}. One pair of Ian's "
                   "slippers on the step. The light oak hallway floor at the top."),
    "2-5": dict(f="I", loc="laundry", light="night", w=["I_home"], fx=(0, "his"),
                 t=f"Bust shot of Ian quickly stuffing {DRESS} back into the laundry basket — the dress is a big out-of-focus shape in the "
                   "lower left foreground — glancing toward the hallway with a startled, guilty look, lips closed."),
    "2-6": dict(f="I", loc="entry", light="night", w=["I_home"], fx=(0, "his"),
                 t="Bust shot of Ian standing in the hallway, 50mm lens, looking toward the entrance, trying to sound casual, lips slightly "
                   "parted as if speaking."),
    "2-7": dict(f="S", loc="entry", light="night", w=["S_out", "I_home"], fx=(0, "her"),
                 t="Medium over-the-shoulder shot: Ian's charcoal back fills the left half of the foreground, out of focus. Seojin, just "
                   "home, lifts one arm to tuck her hair and turns her head away from him as she answers, so her mouth is not visible."),
    "2-8": dict(f="I", loc="entry", light="night", w=["I_home", "S_out"], fx=(0, "his"),
                 t="Medium shot of Ian in the hallway as Seojin brushes past him (her wine-red shoulder out of focus at the lower left): "
                   "he leans slightly after her and sniffs the air, eyebrows drawn together, lips slightly parted as if speaking."),
    "2-9": dict(f="S", loc="entry", light="night", w=["S_out"], fx=(0, "her"),
                 t="Close-up of Seojin in the hallway, 85mm lens, glancing back over her shoulder with a small mysterious smile, lips "
                   "slightly parted."),
    # 2-10: 원본은 바닥 가까운 로우 앵글 고정 — 걸어오는 서진이 카메라 옆을 스쳐 지나가면 복도 끝에 혼자 선 이안이 드러난다(10-26 프레임 줄로 확인).
    # 시작 그림은 서진이 화면을 채운 순간, 끝 그림(2-10e)은 서진이 지나간 뒤 복도 끝의 이안 — 영상은 둘 사이를 잇는다.
    "2-10": dict(f="S", loc="entry", light="night", w=["S_out"], fx=None,
                  t="Very low-angle shot from a camera placed almost on the floor of the narrow hallway, 18mm lens, pointing up and down the "
                    "hallway: Seojin walks straight toward the camera in her new outfit and is about to pass right beside it — her body fills "
                    "most of the frame from the hem of her dress at the bottom to her shoulders near the top edge, her head partly cut off by "
                    "the top edge, slightly soft from her motion. White walls close on both sides. She is very close to the lens: her face is "
                    "not visible — it is above the top edge of the frame; we see her from the shoulders down, large. Do not show her full "
                    "body from a distance."),   # 10-28 첫 판은 멀리 선 전신(원본은 몸이 화면을 채우고 머리가 잘림)
    "2-10e": dict(f="I", loc="entry", light="night", w=["I_home"], fx=None,
                   t="The same very low-angle shot from almost on the floor of the narrow hallway, 18mm lens, a moment later: Seojin has "
                     "just walked out of the frame past the camera, and now the empty hallway is revealed with Ian standing alone at the far "
                     "end, small in the frame, full body in the upper middle, arms hanging, staring after her, stunned. Light oak floor "
                     "leading toward him, white walls close on both sides."),
    # ── 2화 ② 회사 ──
    "2-11": dict(f="MI", loc="office", light="office", w=["M_office", "I_office"], fx=(1, "Minjae's"),
                  t="Bust shot of Minjae leaning over the low desk partition toward Ian, pointing at what Ian is eating, eyebrows raised; "
                    "Ian is in the lower left foreground, out of focus, eating — his head and shoulder hide Minjae's mouth."),
    "2-12": dict(f="", loc="office", light="office", w=["I_office"], fx=None,
                  t="Insert close-up of Ian's hand holding a half-eaten plastic-wrapped convenience-store egg sandwich over the white desk, "
                    "85mm lens; his navy cuff at the right edge."),
    "2-13": dict(f="I", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                  t="Bust shot of Ian at his desk, 50mm lens, sulking with a small pout, lips slightly parted as if speaking; the office out "
                    "of focus behind."),
    # ── 2화 ③ 회상 — 혼자 장보기(주말 아침, 현관) ──
    "2-14": dict(f="S", loc="entry", light="morning", w=["S_weekend", "I_home"], fx=(0, "her"),
                  t="Bust shot of Seojin standing at the entrance, ready to go out, over Ian's out-of-focus shoulder at the left edge; she "
                    "touches the strap of her tote with one hand and looks at him with a light, unbothered expression, lips closed."),
    "2-15": dict(f="I", loc="entry", light="morning", w=["I_home"], fx=(0, "his"),
                  t="Bust shot of Ian in the hallway, 50mm lens, hopeful and eager, lips slightly parted as if speaking."),
    "2-16": dict(f="S", loc="entry", light="morning", w=["S_weekend", "I_home"], fx=(0, "her"),
                  t="Bust shot of Seojin at the entrance over Ian's out-of-focus shoulder at the left edge, answering lightly with a polite "
                    "little smile, lips parted as if speaking, her hand on the tote strap."),
    "2-17": dict(f="I", loc="entry", light="morning", w=["I_home"], fx=(0, "his"),
                  t="Bust shot of Ian looking down, stunned and a little hurt, lips closed, 50mm lens."),
    "2-18": dict(f="I", loc="entry", light="morning", w=["I_home"], fx=(0, "his"),
                  t="Bust shot of Ian from a three-quarter angle facing the right edge, 50mm lens, saying something quietly, lips slightly "
                    "parted, his eyes sad."),
    # ── 2화 ④ 회사 · ⑤ 카페 ──
    "2-19": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=None,
                  t="Wide shot of the office from standing eye height in a corner, 24mm lens: Ian leans all the way back in his office chair "
                    "at the left-middle of the frame, staring at the ceiling, a sandwich in his hand; Minjae sits right beside him on the "
                    "next chair, leaning in and holding Ian's forearm with one hand, both faces visible. Both small in the frame; empty "
                    "desks in front."),   # 10-28 Opus 원본 대조: 원본 30은 동료가 옆에서 팔을 붙잡음 · 서서 본 눈높이
    "2-20": dict(f="YS", loc="cafe", light="cafe", w=["Y_cafe", "S_cafe2"], fx=(0, "her"),
                  t="Medium shot at a bright café window: Soyeon at the left laughs out loud holding a white paper takeaway cup, while "
                    "Seojin, behind her shoulder, buries her face in Soyeon's shoulder and squirms — only Seojin's black hair and navy "
                    "sweater are visible behind Soyeon. Green plants out of focus behind."),
    "2-21": dict(f="S", loc="cafe", light="cafe", w=["S_cafe2", "Y_cafe"], fx=(0, "her"),
                  t="Bust shot of Seojin holding a white paper takeaway cup, eyes squeezed half shut in a pained, guilty wince, lips parted "
                    "as if speaking; Soyeon's mustard shoulder out of focus in the lower left foreground."),
    "2-22": dict(f="I", loc="white", light="white", w=["I_home"], fx=(0, "his"),
                  t="Bust shot of Ian facing the camera straight on against a pure white background: big, sad, abandoned-puppy eyes, the "
                    "inner ends of his eyebrows raised, lips pressed together — a gentle, comic imagined image."),
    # ── 2화 ⑥ 침실 — 대면(밤) ──
    "2-23": dict(f="I", loc="bedroom", light="bed", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Medium shot of Ian lying on his side in bed with his head on the white pillow, the duvet up to his chest, looking up "
                    "toward Seojin off screen with uneasy eyes, lips slightly parted as if speaking. The corner of her dusty-rose sleeve out "
                    "of focus at the upper left edge."),
    "2-24": dict(f="S", loc="bedroom", light="bed", w=["S_pj", "I_night"], fx=(0, "her"),
                  t="Bust shot of Seojin sitting up in bed against the headboard, the bedside lamp glowing behind her, looking down at Ian "
                    "with a startled, guarded look; Ian's head on the pillow is a large dark out-of-focus shape in the lower foreground."),
    "2-25": dict(f="IS", loc="bedroom", light="bed", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Over-the-shoulder shot from just behind Seojin, who sits up in bed: her dark hair fills the upper left corner and her "
                    "hands rubbing hand cream from a small white unlabeled tube fill the lower part of the frame — hair, hands and her "
                    "dusty-rose sleeve all large and out of focus. Beyond her, Ian lies on his side with his head on the pillow in the upper "
                    "middle of the frame, in sharp focus, eyes open, looking toward her; his mouth is half hidden by the pillow."),   # 10-28 Opus 원본 대조: 원본 42는 여자 머리 · 손(앞 흐림) 너머 또렷한 남자
    "2-26": dict(f="I", loc="bedroom", light="bed", w=["I_night"], fx=(0, "his"),
                  t="Medium shot of Ian lying in bed, the lower half of his face pressed into the white pillow so his mouth is half hidden, "
                    "his eyes looking up, hurt."),
    "2-27": dict(f="S", loc="bedroom", light="bed", w=["S_pj", "I_night"], fx=(0, "her"),
                  t="Bust shot of Seojin sitting up in bed, lamp behind her, over Ian's out-of-focus head at the lower right foreground: she "
                    "answers with a nervous little laugh, lips parted as if speaking, avoiding his eyes."),
    "2-28": dict(f="I", loc="bedroom", light="bed", w=["I_night"], fx=(0, "his"),
                  t="Medium shot of Ian sitting up in bed, the rumpled duvet filling the lower half of the frame in the foreground, looking "
                    "straight at her, gently but seriously, lips slightly parted as if speaking."),
    "2-29": dict(f="S", loc="bedroom", light="bed", w=["S_pj", "I_night"], fx=(0, "her"),
                  t="Medium shot of Seojin sitting in bed holding the hand cream tube, frozen, watching him; at the right edge Ian's dark "
                    "shoulder and back are rising out of bed, large and out of focus."),
    "2-30": dict(f="I", loc="bedroom", light="bed", w=["I_night", "S_pj"], fx=None,
                  t="Medium shot toward the bedroom door: Ian, seen from behind and partly hidden, is stepping out through the half-open "
                    "white door into the dark hallway, his hand on the handle; Seojin's dusty-rose shoulder and hair out of focus along the "
                    "left edge."),
    "2-31": dict(f="S", loc="bedroom", light="bed", w=["S_pj"], fx=(0, "her"),
                  t="Medium shot of Seojin alone in bed, hugging a white pillow against her chest, looking toward the closed door off screen "
                    "right, lips closed, regret rising in her eyes."),
    # ── 2화 ⑦ 복선 · ⑧ 자백 — 식탁(밤) ──
    "2-32": dict(f="I", loc="dining", light="night", w=["I_night"], fx=None,
                  t="Wide shot of the dining corner at night from a high angle, 28mm lens: Ian stands with both hands on the edge of the "
                    "light-oak table, looking down at a sheet of white paper and a pen lying on it, about to sit down — he is not writing, his "
                    "hands do not touch the pen. The table fills the lower half of the frame. Nothing on the paper is readable from this "
                    "distance."),   # 10-28 Opus 원본 대조: 원본 50b는 쓰는 손을 감춘 복선(식탁을 짚고 내려다보며 앉음)
    "2-33": dict(f="I", loc="dining", light="night", w=["I_night"], fx=(0, "his"),
                  t="Bust shot of Ian sitting at the table with his head bowed, looking down at the paper below the frame, breathing out "
                    "slowly, lips closed."),
    "2-34": dict(f="S", loc="dining", light="night", w=["S_pj"], fx=None,
                  t="Medium shot of the light oak floor near the table: Seojin, in her pajamas, runs in from the hallway and slips on the "
                    "smooth floor — her legs and lower body in motion in the upper middle of the frame, socked feet sliding, slight motion "
                    "blur. Her face is above the frame."),
    "2-35": dict(f="I", loc="dining", light="night", w=["I_night", "S_pj"], fx=None,
                  t="Wide shot from floor level beside the table: Ian sits at the far side of the light-oak table, startled, half rising "
                    "from his chair; in the foreground at the bottom edge, Seojin's dusty-rose back out of focus, kneeling on the floor."),
    "2-36": dict(f="S", loc="dining", light="night", w=["S_pj", "I_night"], fx=None,
                  t="High-angle medium shot from close above, looking down at the wooden floor: Seojin kneels and bows all the way down "
                    "with her forehead to the floor, her hair spread out, her face hidden — her bowed body is large and fills the middle of "
                    "the frame almost from the left edge to the right edge. Only the light wooden floor around her, no furniture or kitchen "
                    "visible. Ian's dark head is large and out of focus in the lower left corner. Do not pull the camera back."),   # 10-28 첫 판은 부엌까지 넓게 나와 서진이 작았다(원본은 화면 폭 60%)
    "2-37": dict(f="S", loc="dining", light="night", w=["S_pj"], fx=None,
                  t="Close-up of Seojin kneeling, her head still bowed low from the bow and only just beginning to lift: we see the top of "
                    "her head and her long dark hair falling forward over her face, her face still hidden behind the hair, only a glimpse of "
                    "her forehead. Her shoulders in the dusty-rose pajama fill the lower half of the frame. Do not show her full face."),   # 10-27 첫 판은 이미 고개를 든 얼굴 — 원본 첫 프레임은 정수리
    "2-38": dict(f="I", loc="dining", light="night", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Wide shot over Seojin's kneeling back (dusty-rose, large and out of focus, filling the lower right foreground): Ian sits "
                    "at the table further back, small in the frame — his face only about one seventh of the frame height, in the upper "
                    "middle — with the near edge of the table between them in the foreground. He looks down at her, his eyes welling. 28mm "
                    "lens, keep the camera far from him."),   # 10-27 첫 판은 이안이 미디엄만큼 큼(얼굴 0.22 · 원본 0.14)
    "2-39": dict(f="I", loc="dining", light="night", w=["I_night"], fx=(0, "his"),
                  t="Bust shot of Ian at the table, his eyes red-rimmed and visibly wet, tears glistening on his lower lids and one thin tear "
                    "line on his cheek, his brows drawn together, his lips trembling and slightly parted as he begins to speak — quiet, "
                    "held-back emotion, not loud crying."),   # 10-27 첫 판은 눈물 없이 담담함
    "2-40": dict(f="S", loc="dining", light="night", w=["S_pj"], fx=(0, "her"),
                  t="Bust shot of Seojin moving toward him, openly crying: tears running down both cheeks, her eyes red and squeezed "
                    "narrow, brows pinched upward, face crumpled with emotion, lips parted as if speaking through sobs, her hand reaching "
                    "forward past the right edge."),   # 10-27 첫 판은 울지 않고 걱정하는 얼굴
    "2-41": dict(f="I", loc="dining", light="night", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Bust shot of Ian over Seojin's out-of-focus dusty-rose shoulder and hair at the right edge, teary but steady, lips "
                    "slightly parted as if speaking."),
    "2-42": dict(f="IS", loc="dining", light="night", w=["I_night", "S_pj"], fx=None,
                  t="Wide shot of the dining corner: Ian sits at the table at the left, Seojin stands beside him holding his arm; he points "
                    "down at the table top where a sheet of paper, a pen, a kraft-paper box and two cream-white lunchboxes are laid out. "
                    "Both small in the frame, the table filling the lower half."),
    "2-43": dict(f="", loc="dining", light="night", w=["I_night", "S_pj"], fx=None, g=True,
                  t=f"Insert shot looking down at the light-oak table at an angle, 35mm lens: an A4 sheet (the flat green placeholder) with "
                    f"a black pen on it at the upper part, and beside it two open lunchboxes, each {LUNCH} with {LUNCH_FULL}, and the open "
                    "kraft-paper delivery box with a few small glass side-dish containers. At the lower right, Seojin's and Ian's hands are "
                    "clasped together on the table edge."),
    "2-44": dict(f="", loc="dining", light="night", w=[], fx=None, g=True,
                  t="Insert close-up of the A4 sheet on the light-oak table filling the whole frame at a slight angle, 85mm lens — the "
                    "sheet is the flat green placeholder (it will become the completed marriage registration form)."),
    # ── 2화 ⑨ 공개 · ⑩ 끝 ──
    "2-45": dict(f="IS", loc="dining", light="night", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Medium shot: Ian stands up and pulls Seojin into a tight hug, his face over her shoulder toward the camera, smiling "
                    "through tears, lips parted as if speaking; her dusty-rose back and arm fill the lower right foreground, her head "
                    "turned away at the right edge."),
    "2-46": dict(f="S", loc="dining", light="night", w=["S_pj", "I_night"], fx=(0, "her"),
                  t="Bust shot of Seojin in the hug, her face buried in Ian's shoulder: her nose, mouth and chin are completely pressed into "
                    "his oatmeal t-shirt and not visible at all — only her eyes squeezed shut with tears, her brows and forehead show above "
                    "his shoulder, crying; his arm around her back, the back of his head out of focus at the right edge."),   # 10-28 아르곤 검수: 입이 드러남
    "2-47": dict(f="S", loc="dining", light="night", w=["S_pj", "I_night"], fx=(0, "her"),
                  t="Close-up of the hug: Seojin's tearful face over Ian's shoulder in the upper middle, eyes closed, calming down; the back "
                    "of Ian's head and his shoulder fill the lower half of the frame, out of focus."),
    "2-48": dict(f="", loc="dining", light="night", w=[], fx=None,
                  t=f"Overhead still-life shot of two open lunchboxes side by side on the light-oak table, each {LUNCH} with {LUNCH_FULL}; "
                    "a pair of light wooden chopsticks beside each. The lunchboxes sit in the lower half of the frame; the upper half is "
                    "plain oak table, left empty for a title."),
}

# ── 장소 기준 그림(먼저 굽고 고른다) ──
LOCJ = {
    "L1": ("office", "office", "Wide establishing shot of the empty office at lunchtime from standing eye level in the aisle, 24mm lens, rows of "
                               "desks receding toward the windows."),
    "L2": ("dining", "night", "Wide establishing shot of the empty dining corner at night from the living-room side at standing eye level, "
                              "24mm lens: the oak table and two chairs in the middle, the small kitchen behind with the sink and range hood, "
                              "the pendant lamp glowing over the table."),
    "L3": ("entry", "night", "Wide establishing shot of the empty entrance hallway at night from the living-room end, standing eye level, "
                             "24mm lens: the open glass-paneled middle door, the narrow hallway, the sunken tiled entry with the shoe cabinet "
                             "and the white front door at the far end."),
    "L4": ("laundry", "night", "Wide establishing shot of the empty laundry nook at night, standing eye level, 28mm lens."),
    "L5": ("bedroom", "bed", "Wide establishing shot of the empty bedroom at night from the foot of the bed, standing eye level, 24mm lens: "
                             "the bed, the nightstand with the lit lamp, the curtains and the closed white door at the side."),
    "L6": ("cafe", "cafe", "Wide establishing shot of the café with no customers, from standing eye level, 24mm lens: a few small wood tables "
                           "by the big windows, plants, white walls."),
}


def small(src):   # 긴 변 1,400px JPEG 사본(ego/refs) — 올리기가 빠르고 Gemini가 받는 크기로 충분(현장 노트 S24). 없으면 「(아직 없음)」으로 실행기가 멈춘다
    src = Path(src)
    if not src.exists():
        return f"(아직 없음) {src}"
    tag = src.parent.parent.name if src.parent.name == "refs" else src.parent.name
    dst = V / "ego" / "refs" / f"{tag}_{src.stem}.jpg"
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        from PIL import Image
        dst.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert("RGB")
        im.thumbnail((1400, 1400))
        im.save(dst, quality=92)
    return str(dst)


EXTRA = ["2-10e"]   # 끝 그림(영상이 카메라 · 사람 움직임을 잇도록) — 10-26 9번 세션 전달: 끝 그림을 시작과 같은 구도로 구우면 영상 모델이 카메라를 멈춘다


def person_refs(code, n):
    p = P[code]
    return [f"{LORA}/{p['dir']}/refs/{r}.jpg" for r in p["refs"][:n]]


def build(k):
    c = C[k]
    refs, parts = [], [START]
    fsb = facebox.get(k) or []
    big2 = len(c["f"]) == 2 and len(fsb) >= 2 and min(fsb[0]["h"], fsb[1]["h"]) >= 0.2   # 둘 다 크게 나오는 컷(1-38 · 40 등) — 첫 판은 참조 4 + 2로 둘 다 닮지 않았다
    for j, code in enumerate(c["f"]):
        n = 4 if j == 0 or big2 else 2
        a = len(refs) + 1
        refs += person_refs(code, n)
        rng = f"Images {a} to {a + n - 1}" if n > 2 else f"Images {a} and {a + 1}"
        parts.append(f"{rng} are identity references for {P[code]['face']}")
    if c["f"]:
        parts.append(ID_TAIL)
    parts += [W[w] for w in c["w"]]
    t = c["t"]
    fs0 = facebox.get(k) or []
    if fs0 and c.get("fx") and fs0[c["fx"][0]]["h"] >= 0.2:   # 원본 얼굴이 화면 높이 20% 넘는 컷은 「미디엄」이 아니라 미디엄 클로즈업(첫 판이 넓게 나옴)
        t = t.replace("Medium over-the-shoulder shot", "Close over-the-shoulder shot").replace("Medium shot", "Medium close-up (head and shoulders)")
    parts.append(t)
    if c.get("fx"):
        fr = framing(k, *c["fx"])
        if fr:
            parts.append(fr)
    if c["f"]:
        parts.append(ACT)
    lay_n = len(refs) + 1
    refs.append(str(V / "배치" / f"S{k}.png"))
    has_person = any(x in c["t"] for x in ("Ian", "Seojin", "Minjae", "Soyeon"))
    parts.append((LAYOUT if has_person else LAYOUT0).format(n=lay_n))
    if c.get("g"):
        parts.append(GREEN.format(n=lay_n))
    parts.append(L[c["loc"]])
    fs = facebox.get(k) or []
    tight = bool(fs) and c.get("fx") and fs[c["fx"][0]]["h"] >= 0.17
    if c["loc"] in LREF and not tight and k not in NOLOC and k not in NOLOC2:   # 10-26 23:4x: 넓은 방 사진이 바스트 · 클로즈업을 넓은 컷으로 끌었다(S31 「방 참조가 있으면 넓은 컷」과 같은 결)
        refs.append(str(V / "정지컷" / f"{LREF[c['loc']]}.png"))
        parts.append(f"Image {len(refs)} shows this same {LNAME[c['loc']]} only for its furniture, materials and colors — do not copy its wide "
                     "framing; this shot keeps the framing described above.")
    if c.get("xref"):   # 10-28: 짝 컷의 정지컷을 같은 장소 · 같은 카메라 자리의 기준으로(2-10 ← 2-10e)
        refs.append(str(V / "정지컷" / f"{c['xref'][0]}.jpg"))
        parts.append(c["xref"][1].format(n=len(refs)))
    parts.append(LIGHT[c["light"]])
    parts.append(TAIL_G if c.get("g") else TAIL)
    return dict(id=k, who=c["f"] or "-", ratio="9:16", prompt=" ".join(parts), refs=[small(r) for r in refs])


# ── 10-28 Opus 2차 검수(Fable 주간 한도로 대신, git 밖 콘티/p7/검수/opus_이미지콘티_2차/답.md) — 상 8 · 중 11과 짝 2-10e를 원본 첫 프레임대로 다시 쓴다 ──
# 얼굴이 안 잡히는 컷은 잘라 맞춤이 돌지 않으니 크기 · 자리를 숫자로, 긴 통로 장소 그림이 구도를 끈 컷은 장소 참조를 뺀다(NOLOC2).
OPUS2 = {
    "1-4": "Bust shot from slightly above. Ian tilts his head down to the left, looking down at the open lunchbox he holds low in his left hand "
           f"({LUNCH} — plain white rice with one red pickled plum, and the side-dish compartment completely EMPTY and clean), wincing "
           "sheepishly; his right hand is raised palm up at chest height in an explaining gesture. He does not look at the camera. His face is "
           "in the upper left part of the frame. From behind, Minjae's two hands rest one on each of Ian's shoulders (one hand per shoulder, "
           "charcoal cardigan sleeves); Minjae's face is not in the frame.",
    "1-5": "Seojin leans her upper body far toward Ian across the dining table (toward the right of the frame) and holds out a closed planner "
           "notebook with her right hand toward the front right of the camera — the notebook is blurred at the right edge of the frame and its "
           "pages are not visible. Her face is in the upper middle, about 45% of the frame width, looking at him seriously, lips slightly "
           "parted as if starting to speak. At the right edge, part of Ian's blurred dark head and a glass of green tea.",
    "1-22": "Insert, locked-off: a closed inner door with a light wooden frame and a grid of frosted glass panes fills the whole frame, seen "
            "straight on from close up; its handle is in the middle-right of the frame. Through the frosted glass, the blurred silhouette of "
            "Ian in a dark suit — his torso, his hand reaching for the handle and his legs — shows faintly. A thin strip of white wall at the "
            "right edge. The door is still closed. No hallway is visible.",
    "1-23": "The camera stands inside the hallway about 2 m from the inner door. Ian, in his suit, is just stepping in through the open "
            "frosted-glass grid door, in the left-middle of the frame (his head about 15% of the frame width), coming home. The lower part "
            "of his face is hidden by Seojin passing right in front of the camera — she covers the left half of the frame, very large and "
            "very blurred (sage-green apron, white long sleeves). The focus is on Ian.",
    "1-37": "The camera is low behind a row of monitors, looking straight across the row of office desks; behind them a plain white wall with "
            "a notice board — no deep aisle, no windows. Minjae sits in the middle of the frame with both arms stretched across his desk and "
            "his head bowed; Ian walks in from the left edge toward him, at the same distance as Minjae and about the same size. The lower "
            "half of the frame is the blurred backs of monitors.",
    "1-38": "Close-up: Minjae rests his cheek on the desk; Ian lies chest-down on Minjae's back with his chin resting right on top of "
            "Minjae's head — the two heads touch. Ian has a sulky, whiny, almost-crying face (soft, not slapstick) and looks toward the front "
            "right of the frame — not down at Minjae and not into the lens; his left hand is on Minjae's shoulder; Ian's mouth is visible.",
    "1-39": "Close-up from desk height: Minjae rests his head sideways on Ian's arm — a navy suit sleeve wrapped around his neck from the upper "
            "left — so Minjae's nose, mouth and chin are hidden by the arm; his eyes look toward the lower right of the frame, not into the "
            "lens. In the upper left corner Ian's chin and mouth just peek in. Minjae has the same round face as in the other shots.",
    "2-1": "A narrow laundry corner at night, the camera at chest height about 2 m away: Ian, seen in three-quarter back view from head to "
           "slippers, fills about 85% of the frame height. At the left of the frame he bends over a white top-loading washing machine with "
           "both hands inside the drum, taking out laundry; a pale-blue laundry basket at his feet; the right side of the frame is a plain "
           "white wall. No hallway is visible.",
    "2-10e": "Very low-angle shot from a camera about 40 cm above the floor of the narrow hallway, tilted slightly up, a moment after Seojin "
             "has walked past the camera and out of frame: Ian now stands alone by the middle door of the hallway, about 55% of the frame "
             "height, arms hanging, staring after her, stunned. Light oak floor leading toward him, white walls close on both sides.",
    "2-10": "Seojin in her burgundy knit dress, holding a small handbag, walks straight toward the camera so her torso and legs block the middle "
            "of the frame completely — her face is cut off above the top edge of the frame; the far end of the hallway is hidden behind her "
            "body. Light oak floor at the bottom, white walls close on both sides.",
    "2-19": "The camera is at standing eye height, looking sideways across a row of office desks (no deep aisle, no windows). In the upper left "
            "of the frame Ian leans far back in his office chair, head tilted back, holding a sandwich; right next to him Minjae sits close, "
            "laughing hard and grabbing Ian's arm; together the two span about 80% of the frame width. In front, a white desktop crosses the "
            "middle of the frame; the lower third is empty chairs and dark carpet. The monitors have no logos.",
    "2-25": "The camera is right behind Seojin at shoulder height as she sits on the bed: in the left foreground, very blurred, her profile and "
            "her two hands rubbing hand cream (dusty-rose pajamas). Beyond her, about 1 m away, Ian lies on his side with his back turned to "
            "her — we see only the back of his head, his ear and the nape of his neck; his face and mouth are turned toward the pillow and "
            "are not visible. Ian's head spans about 40% of the frame width; the focus is on Ian.",
    "2-30": "The left half of the foreground is covered by the blurred back of Seojin's head (low-tied black hair) and her dusty-rose pajama "
            "shoulder. Beyond her, Ian is halfway out through the bedroom doorway with his back to us — his head already past the door frame "
            "and cut off — his right hand holding the inner door handle, starting to pull the door shut.",
    "2-32": "The camera is at the far end of the dining table, just above the tabletop, looking along it: the tabletop fills the lower two "
            "thirds of the frame. In the upper left, Ian leans his upper body deep over the table with both hands planted on it, about to sit "
            "down (upper body only, his head about 25% of the frame width). A sheet of white paper and a pen lie in the middle of the frame; "
            "his hands do not touch the pen.",
    "2-34": "The camera is high behind the shoulder of Ian, who sits at the dining table, looking down at the wooden floor at 45 degrees: most "
            "of the frame is wooden floor. At the top center, Seojin in dusty-rose pajamas rushes in and starts to slide in her socks (her "
            "whole body about 40% of the frame height, motion-blurred). In the lower left corner the blurred back of Ian's head; in the lower "
            "right the table corner and the corner of a white sheet of paper.",
    "2-35": "The camera is low behind Seojin, who lies prostrate on the floor, about 50 cm above the floor, looking up: Ian is still sitting "
            "at the dining table and leans back in surprise (he does not stand up). On the table only a sheet of paper and a pen — no bowls. "
            "The blurred back of Seojin fills the lower foreground; the table edge cuts diagonally across the upper left.",
    "2-37": "Close-up from the front, slightly above: Seojin kneels on the floor with her head bowed deeply — the crown of her head and her "
            "forehead fill the upper middle of the frame (her head about 65% of the frame width); her face is almost hidden by her falling "
            "hair; the collar of her dusty-rose pajamas fills the bottom; behind her only a blurred wall and door frame. No other person is in "
            "the frame.",
    "2-38": "The camera is about 50 cm above the floor, looking up: the lower half of the frame is covered by the blurred back of Seojin "
            "kneeling (dusty-rose pajamas, low-tied hair); beyond her, Ian sits at the dining table in the upper middle of the frame, looking "
            "down at her with welling eyes; the table edge cuts diagonally across the upper left.",
    "2-39": "Bust shot of Ian at the table, eyes red-rimmed and welling with tears, his gaze dropped toward the lower left of the frame (toward "
            "Seojin on the floor), his head bowed slightly, leaning toward the table with one hand resting on it; quiet, held-back emotion; "
            "he does not look into the lens; his mouth is visible.",
}
for _k, _t in OPUS2.items():
    C[_k]["t"] = _t
C["1-29"]["t"] += (" The back of Ian's head in the right foreground is his wavy brown hair (the same as in his other shots), slightly out of "
                   "focus, with his navy suit shoulder.")
C["1-22"]["f"] = ""
C["2-25"].update(f="IS", fx=None)
C["2-10"]["xref"] = ("2-10e", "Image {n} is the same hallway seen from the same camera position a moment later, after she has passed — "
                     "match the hallway, the doors, the floor and the camera height exactly; Ian stands behind her where he is in that "
                     "image, hidden by her body.")
NOLOC2 = {"1-22", "1-23", "1-37", "2-1", "2-19", "2-34"}
# 10-28 Opus 3차(git 밖 콘티/p7/검수/opus_이미지콘티_3차/답.md) — 같은 장면의 이어짐이 끊긴 중 넷 + 1-37 하(36차). 장소 그림 대신 같은 장면의 정지컷을 참고로(xref)
C["1-23"]["t"] = ("The camera stands inside the hallway about 2 m from the inner door, which is the same light wooden-framed hinged door with a "
                  "3 by 5 grid of frosted glass panes as in the previous shot, now swung open inward. Ian, in his suit, is just stepping in "
                  "through that doorway, in the left-middle of the frame (his head about 15% of the frame width). The lower part of his face is "
                  "hidden by Seojin passing right in front of the camera — she covers the left half of the frame, very large and very blurred "
                  "(sage-green apron, white long sleeves). The focus is on Ian. No white sliding door, no wired glass, no deep hallway.")
C["1-23"]["xref"] = ("1-22", "Image {n} is the inner door from the previous shot — the door in this shot is exactly this door (same wood, same "
                             "frosted grid), now open.")
C["1-39"]["t"] = ("Close-up near desk height: like the shots before and after, Minjae lies slumped over the desk; Ian's arm in a navy suit sleeve "
                  "lies across the desk and wraps around Minjae's neck and shoulder from the upper left, and Minjae rests his head sideways on "
                  "that arm so his mouth is hidden against it — the arm does not press on his mouth and no hand grabs his face. Minjae's eyes "
                  "look toward the lower right of the frame, not into the lens. In the upper left corner Ian's chin and mouth just peek in.")
C["2-10"]["t"] = ("The camera is about 40 cm above the floor, tilted slightly up. Seojin in her burgundy knit dress, holding a small handbag, "
                  "walks toward the camera; her torso and the arm holding the bag block the frame from about 25% to 68% of its width, so the "
                  "spot in front of the entrance door at the far end — where Ian stands a moment later — is completely hidden "
                  "behind her. To her right only the shoe-cabinet wall and the wooden grid glass door show. Her face is cut off above the top "
                  "edge of the frame.")
C["2-34"]["t"] += (" Only one dining table in the room — no second table or set of chairs.")
C["2-34"]["xref"] = ("2-33", "Image {n} shows Ian in this scene: the blurred man in the foreground is him — the same oatmeal long-sleeve top "
                             "and wavy brown hair (not navy, not black).")
C["2-38"]["t"] += (" Only one dining table in the room — no second table or set of chairs.")
C["1-37"]["t"] += (" Ian is taking a step in from the left edge toward Minjae, his body and face turned into the frame.")
# 2차 「하」 다섯(35차, 2-38과 한 차례에): 원본 첫 프레임의 시작 자세 · 표정에 맞춘다
C["1-1"]["t"] += " Minjae's eyes are wide open and his mouth hangs open in surprise."
C["1-3"]["t"] = (f"Insert from above at about 50 degrees, 85mm lens: the whole empty square side-dish compartment of {LUNCH} sits in the upper "
                 "middle of the frame — completely empty and clean, a pair of light wooden chopsticks lying inside the empty compartment. "
                 "Around it only the out-of-focus edge of the box and a pale blur; no desk or office visible.")
C["1-7"]["t"] = ("Close-up of Ian in clean side profile facing the right edge, 85mm lens: he drinks water from a clear glass held to his lips "
                 "with his right hand, eyes open, calm — the moment just before he chokes. The kitchen behind is soft and warm.")
C["1-8"]["t"] += (" He is still bent forward from the cough, eyes squeezed shut, just starting to straighten up.")
C["2-40"]["t"] += (" Her reaching hand does not hold any door frame or wall; behind her is the kitchen, and the dining table where he sits is "
                   "off frame to the right.")

# 장소 참조를 넣지 않는 인서트 · 접사(10-27): 현장 노트 「물건 인서트에 방 사진만 참고로 주면 사람이 앉은 방 전경을 그린다」 · 넓은 방 사진이 가까운 컷을 넓게 끈다
NOLOC = {"1-2", "1-3", "1-24", "1-26", "1-27", "1-28", "1-41", "1-43", "2-3", "2-4", "2-12", "2-25", "2-10", "2-36", "2-37", "2-43", "2-44", "2-48"}   # 2-36: 10-28 부엌 사진이 컷을 넓게 끌었다
RELIGHT = {"L2b": ("L2", "night"), "L3b": ("L3", "night"), "L4b": ("L4", "night"), "L5b": ("L5", "bed")}


def build_relight(k):   # 10-26 23:4x: 고른 장소 그림의 구조는 두고 빛만 원본처럼 밝게(현장 노트 「고른 판을 Image 1로 빛만 바꿔라」)
    src, light = RELIGHT[k]
    prompt = " ".join([START, "Image 1 is a photograph of a room. Recreate exactly this same photograph — the same camera position, lens, framing, "
                       "walls, doors, furniture, objects and colors, nothing added or removed — and change only the lighting.", LIGHT[light],
                       "Nobody is in the frame.", TAIL])
    return dict(id=k, who="장소", ratio="9:16", prompt=prompt, refs=[small(V / "정지컷" / f"{src}.png")])


def build_loc(k):
    loc, light, t = LOCJ[k]
    prompt = " ".join([START, L[loc], t, "Nobody is in the frame.", LIGHT[light], TAIL])
    return dict(id=k, who="장소", ratio="9:16", prompt=prompt, refs=[])


def main():
    jobs = {k: build_loc(k) for k in LOCJ}
    jobs.update({k: build_relight(k) for k in RELIGHT})
    for k in cuts:
        if k not in C:
            raise SystemExit(f"{k}: 지시문 없음")
        jobs[k] = build(k)
    for k in EXTRA:   # 컷목록에 없는 끝 그림
        jobs[k] = build(k)
    for j in jobs.values():
        if len(j["prompt"]) > 4300:
            raise SystemExit(f"{j['id']}: 지시문 {len(j['prompt'])}자 — 4,300자 안으로(현장 노트)")
        if "video" in j["prompt"].lower():
            raise SystemExit(f"{j['id']}: 지시문에 video — Gemini가 영상을 만들기 시작한다(현장 노트 10-23)")
        if len(j["refs"]) > 10:
            raise SystemExit(f"{j['id']}: 참조 {len(j['refs'])}장")
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(json.dumps(jobs[k], ensure_ascii=False, indent=1))
        print(len(jobs[k]["prompt"]), "자")
        return
    (V / "ego").mkdir(parents=True, exist_ok=True)
    json.dump(jobs, open(V / "ego" / "jobs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    (HERE / "지시문").mkdir(exist_ok=True)
    # 저장소 사본에는 git 밖 절대 경로 대신 이름만 남긴다(공개 저장소)
    pub = {k: dict(v, refs=[Path(r.split(") ")[-1]).name for r in v["refs"]]) for k, v in jobs.items()}
    json.dump(pub, open(HERE / "지시문" / "이미지콘티.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mx = max(jobs.values(), key=lambda j: len(j["prompt"]))
    print(len(jobs), "개 · 가장 긴 지시문", mx["id"], len(mx["prompt"]), "자")


if __name__ == "__main__":
    main()
