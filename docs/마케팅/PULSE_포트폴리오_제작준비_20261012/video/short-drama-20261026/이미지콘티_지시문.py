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
        "No text, no subtitles, no letters, no logos, no watermarks anywhere.")
TAIL_G = ("Photorealistic film still with natural skin texture, slight film grain and natural lens falloff, shot on a cinema camera. "
          "Apart from the flat green placeholder, no text, no letters, no logos, no watermarks anywhere.")
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
                t=f"Insert close-up from above at an angle, 85mm lens: the square side-dish compartment of {LUNCH} — completely empty and "
                  "clean, only a pair of light wooden chopsticks lying across it. Out-of-focus white desk around it."),
    "1-4": dict(f="IM", loc="office", light="office", w=["I_office"], fx=(0, "his"),
                t=f"Bust shot of Ian seated at his desk, 50mm lens at his eye level. He holds {LUNCH} near his chest with both hands, palms "
                  "up, in a small apologetic shrug, eyebrows slightly raised and lips slightly parted as if starting to explain. Only "
                  "Minjae's two hands (in his charcoal cardigan sleeves) rest on Ian's shoulders from behind at the upper left edge — Minjae's "
                  "face is not in the frame."),
    # ── 1화 ② 회상 — 집 식탁(밤) ──
    "1-5": dict(f="S", loc="dining", light="night", w=["S_home"], fx=(0, "her"),
                t="Medium shot of Seojin seated at the dining table at night, 50mm lens at her seated eye level. She holds an open small "
                  "planner notebook up in both hands toward the person opposite her (off screen right), looking straight at him calmly and "
                  "seriously, lips slightly parted as if starting to speak. A wooden door and the warm wall behind her."),
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
                  "Across the table Ian, still recovering, holds a white paper napkin over his mouth with his left hand and raises his right "
                  "palm toward her in a small 'wait a second' gesture; a glass of water on the table in front of him."),
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
                  t="Insert medium shot at waist height: Seojin's two hands (white sleeves) come in from the left edge and take hold of Ian's "
                    "hand and navy suit sleeve, gently pulling him toward the table; his body in the suit, shirt and belt fills the right "
                    "half, his face out of the frame."),
    "1-29": dict(f="S", loc="dining", light="evening", w=["S_apron", "I_suit_home"], fx=(0, "her"),
                  t="Medium over-the-shoulder shot: the back of Ian's head and his navy shoulder out of focus along the right edge. Seojin, "
                    "in her apron, clings to his upper arm with both hands and rests her cheek against his sleeve, looking up at him with "
                    "coaxing eyes; her mouth is hidden behind his arm. The kitchen shelves behind her."),
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
                    "mouth peek in at the very top left edge."),
    "1-40": dict(f="IM", loc="office", light="office", w=["I_office", "M_office"], fx=(0, "Ian's"),
                  t="Close-up: Ian, draped over Minjae's back, rests his chin on his folded hands on Minjae's shoulder, his face large in the "
                    "upper part of the frame, speaking with a sulky, self-assured little pout, lips slightly parted; Minjae's head lies on "
                    "the desk at the lower right, partly cut off by the frame."),
    "1-41": dict(f="MI", loc="office", light="office", w=["M_office", "I_office"], fx=None,
                  t="Close-up from desk height: Minjae lies on the desk in the lower half of the frame, turning his face up toward Ian, "
                    "speaking with a calm warning look, lips parted as if speaking; Ian's face rests on top of Minjae's head at the upper "
                    "left, partly hidden by Minjae's hair. Framing: Minjae's face (eyebrows to chin) is about 25% of the frame height, its "
                    "center about 70% down from the top edge and 55% in from the left edge."),
    # ── 1화 ⑦ 걸이 — 카페 ──
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
                   "middle of the frame, full body from head to slippers."),
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
                    "the top edge, slightly soft from her motion. White walls close on both sides."),
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
                  t="Wide shot of the office from a high corner, 24mm lens: Ian leans all the way back in his office chair at the left-"
                    "middle of the frame, staring at the ceiling, a sandwich in his hand; Minjae sits at the next desk on the right, "
                    "turned toward him. Both small in the frame; empty desks in front."),
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
    "2-25": dict(f="", loc="bedroom", light="bed", w=["S_pj", "I_night"], fx=None,
                  t="Insert shot of Seojin's hands rubbing hand cream into her fingers from a small white unlabeled tube, in the middle of "
                    "the frame; her dusty-rose sleeve; the edge of her face out of focus at the left edge, and Ian lying in bed in the soft "
                    "background."),
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
                  t="Wide shot of the dining corner at night from a high angle, 28mm lens: Ian stands bent over the light-oak table writing "
                    "carefully on a sheet of white paper with a pen; the table fills the lower half of the frame. Nothing on the paper is "
                    "readable from this distance."),
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
                  t="High-angle medium shot looking down at the floor: Seojin kneels and bows all the way down with her forehead to the "
                    "floor, her hair spread out, her face hidden; Ian's dark head out of focus at the lower left corner."),
    "2-37": dict(f="S", loc="dining", light="night", w=["S_pj"], fx=None,
                  t="Close-up of Seojin kneeling, starting to lift her head from the bow, her hair falling around her face, tearful eyes "
                    "coming up, lips parted as if starting to speak. Framing: her face is in the middle of the frame, its center about 40% "
                    "down from the top edge, face about 25% of the frame height."),
    "2-38": dict(f="I", loc="dining", light="night", w=["I_night", "S_pj"], fx=(0, "his"),
                  t="Wide shot over Seojin's kneeling back (dusty-rose, large and out of focus in the lower right foreground): Ian sits at "
                    "the table behind, looking down at her, his eyes welling."),
    "2-39": dict(f="I", loc="dining", light="night", w=["I_night"], fx=(0, "his"),
                  t="Bust shot of Ian at the table, tears welling and glistening in his eyes without falling, his lips trembling and "
                    "slightly parted as he begins to speak — quiet, held-back emotion, not loud crying."),
    "2-40": dict(f="S", loc="dining", light="night", w=["S_pj"], fx=(0, "her"),
                  t="Bust shot of Seojin moving toward him, crying softly, eyes wet, lips parted as if speaking, her hand reaching forward "
                    "past the right edge."),
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
                  t="Bust shot of Seojin in the hug, her face pressed against Ian's shoulder so her mouth is hidden by his oatmeal t-shirt, "
                    "eyes squeezed and crying softly; his arm around her back, the back of his head out of focus at the right edge."),
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
    if c["loc"] in LREF and not tight:   # 10-26 23:4x: 넓은 방 사진이 바스트 · 클로즈업을 넓은 컷으로 끌었다(S31 「방 참조가 있으면 넓은 컷」과 같은 결)
        refs.append(str(V / "정지컷" / f"{LREF[c['loc']]}.png"))
        parts.append(f"Image {len(refs)} shows this same {LNAME[c['loc']]} only for its furniture, materials and colors — do not copy its wide "
                     "framing; this shot keeps the framing described above.")
    parts.append(LIGHT[c["light"]])
    parts.append(TAIL_G if c.get("g") else TAIL)
    return dict(id=k, who=c["f"] or "-", ratio="9:16", prompt=" ".join(parts), refs=[small(r) for r in refs])


RELIGHT = {"L2b": ("L2", "night"), "L3b": ("L3", "night"), "L5b": ("L5", "bed")}


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
