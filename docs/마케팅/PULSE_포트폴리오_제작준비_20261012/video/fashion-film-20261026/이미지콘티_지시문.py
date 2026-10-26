# 4번 「결채 — 한 벌」 이미지 콘티 지시문(2026-10-26) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록을 만든다.
#   python -X utf8 이미지콘티_지시문.py   → synk-vendor/…/콘티/p4/ego/jobs_p4.json(실행기 gen.mjs가 읽음) · 같은 폴더의 지시문/이미지콘티.json(저장소 사본)
# 길은 만족 사례 장부 S31(「매진 임박」 v4) · 6번 이미지 콘티와 같다: 원본 첫 프레임에서 사람을 검은 실루엣으로 바꾸고 크게 흐린 배치도
# + 유나 고정 얼굴 세트(캐스팅 원본) + 옷 기준 그림(O1 — 먼저 굽는다). 10-27부터 옷 펼침 O4와 얼굴 없는 옷감 · 소품 · 장소 컷은 GPT 이미지 2.5(이미지콘티_gpt굽기.py),
# O1~O3은 O4를 옷 참조로 받아 Gemini가 굽는다. 빛 · 장소 · 카메라는 지시문에 쓰고 받은 색을 그대로 쓴다(공통 원칙 3).
# 정해진 것(결정 10-26): 옷 한 벌 「가을 트렌치」 · 회색 스튜디오 · 가을 억새밭 · 황토 흙담 빈 한옥 · 가상 브랜드 결채(그림에는 글자를 굽지 않음) · 원본 전환 살림.
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p4")
R = V / "ego" / "refs"
B = V / "배치"
GOT = V / "받음"   # 옷 기준 그림을 받으면 여기 O1.png …

# 참조는 다섯 장 안으로(배치도 1 + 얼굴 3 + 옷 1) — 참조 5~6장 + 긴 지시문이면 보내기가 튕긴 적이 있다(현장노트 gemini_사진 10-25)
FACE = [str(R / n) for n in ("F01_front.jpg", "F01_profile-left.jpg", "F01_face-close.jpg")]
FACE_R = [str(R / n) for n in ("F01_front.jpg", "F01_profile-right.jpg", "F01_face-close.jpg")]
OUTFIT_REFS = [str(GOT / "O1.png")]   # 옷 기준(앞) — 받기 전에는 실행기가 멈춘다
OUTFIT_FLAT = [str(GOT / "O4.png")]   # 옷 펼침(GPT 이미지 2.5, 10-27) — 옷 기준 셋(O1~O3)과 옷감 · 소품 컷의 옷 생김새 기준

YUNA = ("a Korean woman in her early twenties — a small face with a slim jaw, full lips, dark-brown upturned cat-eye eyes with a long "
        "winged eyeliner, rose-coral lips, smooth bright neutral skin; long dark-brown wavy hair worn loose with a center part, falling "
        "past her shoulders; small gold stud earrings; 168 cm, slim")
OUTFIT = ("an ivory wool gabardine long trench coat that falls below the knee — double-breasted with dark-brown horn buttons, wide notched "
          "lapels, a matching self-fabric belt tied at the waist through a fabric-covered buckle, plain ivory satin lining (no check "
          "pattern); underneath a cream crew-neck fine-knit sweater and matching cream wide-leg trousers; brown leather ankle boots with a "
          "low block heel and an almond toe; a small brown leather shoulder bag with a flap and a brass turn-lock on a thin strap. No logos "
          "or labels anywhere")
IDREF = "are identity references of this one woman — take only her face, hair and body proportions from them; ignore their backgrounds, clothes and lighting."
OUTREF = "shows the exact outfit she wears in every shot — copy the coat, knit, trousers, boots and bag exactly (colour, cut, buttons, belt, length)."
CALM = "Her expression is calm and neutral, lips closed, no smile."
STILL = "Create one still photograph. A cinematic film still from a quiet, artful Korean fashion film, 16:9 frame."
LAYOUT = ("Image 1 is a heavily blurred layout guide taken from another film: copy only its composition — where the subject sits in the "
          "frame and how big it is, the camera height and angle, and where light and dark fall. The black silhouette marks exactly where "
          "the woman is. Copy nothing else from Image 1 — not the place, not the clothes, not the objects.")
FINISH = ("Photorealistic, shot on a cinema camera with a vintage prime lens, natural skin texture with visible pores, fine film grain, "
          "gentle lens falloff, true-to-life colours. No text, no letters, no logos, no watermarks.")
STUDIO = "a plain warm-grey seamless paper backdrop studio"
FIELD = "a wide field of silver Korean pampas grass (eulalia) in late autumn on a clear afternoon, low hills on the horizon"
HANOK = ("an abandoned old Korean house with crumbling yellow-ochre clay-and-straw walls (hwangto), weathered dark wooden beams and an "
         "empty window frame, dry grass in the yard")


def person(cid, shot, light, camera, face=FACE, extra=""):
    refs = [str(B / f"{cid}.png")] + face + OUTFIT_REFS
    n = len(face)
    p = " ".join([STILL, LAYOUT, f"Images 2 to {1 + n} {IDREF}", f"Image {2 + n} {OUTREF}",
                  f"The woman is {YUNA}. She wears {OUTFIT}.", shot, light, camera, CALM, extra, FINISH])
    return {"refs": refs, "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


def thing(cid, what, light, camera, layout=True, extra=""):
    refs = ([str(B / f"{cid}.png")] if layout else []) + OUTFIT_FLAT
    lay = LAYOUT.replace("The black silhouette marks exactly where the woman is. ", "") if layout else ""
    k = 2 if layout else 1
    p = " ".join([STILL, lay, f"Image {k} shows the pieces of the outfit this detail belongs to, laid flat — match its material and colour exactly.",
                  what, light, camera, "No person, no hands unless written.", extra, FINISH])
    return {"refs": refs, "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


def place(cid, what, light, camera):
    p = " ".join([STILL, LAYOUT.replace("The black silhouette marks exactly where the woman is. ", ""), what, light, camera, "No people.", FINISH])
    return {"refs": [str(B / f"{cid}.png")], "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


def faceless(cid, shot, light, camera, extra=""):
    """얼굴이 안 보이는 사람 컷(실루엣 · 목 아래) — GPT 이미지 2.5로 굽는다(10-27). 참조는 배치도와 옷 펼침뿐, 얼굴 세트는 넣지 않는다."""
    refs = [str(B / f"{cid}.png")] + OUTFIT_FLAT
    body = ("a slim Korean woman in her early twenties, 168 cm, with long dark-brown wavy hair worn loose")
    p = " ".join([STILL, LAYOUT, "Image 2 shows the exact pieces of her outfit laid flat — dress her in exactly these pieces (colour, cut, buttons, belt, length).",
                  f"The woman is {body}. She wears {OUTFIT}.", shot, light, camera, extra, "Her face is not visible.", FINISH])
    return {"refs": refs, "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


J = {}

# ── 옷 기준 그림(먼저) — 얼굴 세트만 참조. 세로 3:4 전신 앞 · 뒤 · 옆, 가로 부분판.
def outfit_ref(view, extra):
    p = " ".join(["Create one photograph. A clean full-length fashion lookbook photo, 3:4 vertical frame.",
                  f"Images 1 to 3 {IDREF}", "Image 4 shows the exact pieces of her outfit laid flat — dress her in exactly these pieces (colour, cut, buttons, belt, length).",
                  f"The woman is {YUNA}.", f"She wears {OUTFIT}.",
                  f"She stands on {STUDIO}, whole body in frame from the top of the hair to the boots with a little space above and below, {view}.",
                  "Soft, even studio light from the front-left, a gentle shadow on the paper. Hands relaxed at her sides (the bag hangs from her left shoulder).",
                  CALM, extra, FINISH])
    return {"refs": FACE + OUTFIT_FLAT, "prompt": p, "ratio": "3:4"}

J["O1"] = outfit_ref("facing the camera straight on", "The coat is closed and belted; the full outfit is clearly visible.")
J["O2"] = outfit_ref("seen from directly behind, her face not visible, hair falling down her back", "Show the back yoke, the belt loops and the back vent of the coat.")
J["O3"] = outfit_ref("turned 90 degrees to her right in clean profile, looking ahead", "Show the coat's length below the knee, the wide trousers and the boot heel in profile.")
J["O4"] = {"refs": FACE[:0], "prompt": " ".join([
    "Create one photograph. An overhead flat-lay product photo, 16:9 frame, on a warm-grey paper surface, soft even daylight.",
    f"Lay out the separate pieces of this one outfit, neatly spaced: {OUTFIT}.",
    "Also show, in small neat groups: three of the dark-brown horn buttons, the fabric-covered belt buckle, and a folded corner of the plain ivory satin lining.",
    "No person, no hands, no tags, no text.", FINISH]), "ratio": "16:9"}

# ── 컷별(01_샷표 · 02_콘티의 번호). 크기 · 카메라는 원본 그대로 — 방향은 카메라가 가는 쪽.
J["C02"] = thing("C02", "An extreme close-up of the ivory wool gabardine of the trench coat: the fine diagonal twill weave fills the whole frame, a few fibres catching the light.",
                 "Very low-key, like the first second of a film fading in from black: almost the whole frame is deep warm shadow so the ivory cloth reads dark brown-grey; only a thin, dim raking light from the left picks out the diagonal ridges, and nothing is brighter than a soft mid-tone.",
                 "Macro lens flat to the fabric; the first frame of a very slow push in (about 2.6% over 1.5 seconds).", layout=False)
J["C03"] = thing("C03", "The trench coat's fabric-covered belt buckle stands alone in the middle of the frame, upright on a strip of the self-fabric belt, small in the frame with grey space around it.",
                 f"{STUDIO}, soft side light.", "Still camera, eye level with the object.")
J["C04"] = thing("C04", "An extreme close-up of one dark-brown horn button sewn on the ivory gabardine — the cross stitches of thread visible, the button filling most of the frame.",
                 "Soft grey studio light.", "Macro lens, still.")
J["C05"] = place("C05", f"A wide view of {FIELD}; the grass fills the lower third, a big pale sky with soft clouds above.",
                 "Clear afternoon light, slightly hazy, warm.", "Still camera at standing eye level, level horizon.")
J["C06"] = thing("C06", "The side of the small brown leather shoulder bag, close: the grain of the leather and a neat line of saddle stitching run diagonally up through the frame.",
                 "Against a dark warm-grey backdrop, soft light from the left so the stitching catches light.", "Close-up, still.")
J["C07"] = place("C07", f"Night. In the yard of {HANOK}, a large old persimmon tree stands as a black silhouette; warm orange light shines up from the ground behind and below it, glowing through the bare branches.",
                 "Deep night, the only light is the low warm orange glow; everything else near black.", "Wide, camera at standing eye level, the first frame of an almost imperceptible push in (about 1.6%).")
J["C08"] = person("C08", f"Night. The woman stands small and full-length in the dark doorway of a crumbling clay wall of {HANOK}, framed by the ruined opening, facing the camera.",
                  "Dim deep-red light washes the clay walls; she is barely lit, as if just emerging from the dark. " + "Very low-key night: she and her ivory coat are mostly in shadow, so the coat reads as a dull dark red-brown, never bright or glowing; only a dim deep-red light from below catches parts of her face, hands and the edges of the coat; most of the frame is near black.", "Wide shot at eye level, the first frame of a slow tilt down of about 3% of the frame.")
J["C09"] = thing("C09", "One of her brown leather ankle boots stands alone in the middle of the frame, seen from the side at its own height: the smooth leather, almond toe and low block heel.",
                 "A plain beige paper backdrop, soft light.", "Close-up, still, a very slight push in.")
J["C11"] = person("C11", "An extreme close-up, much closer than a portrait: the top edge of the frame cuts across her eyebrows and forehead, the bottom edge cuts just below her lips and chin, so her face is larger than the frame. Her face fills the left two-thirds of the frame, turned three-quarters to her left with the head tilted down to her left; her right ear with the small gold stud earring sits at the centre-right; loose dark hair falls over the right third against a dark grey background. Her eyes look down, lids lowered.",
                  "Low-key: a warm skin-toned soft side light from the left lights the near cheek and eyelid; the far side of her face and the background fall into deep shadow.", "Macro-close; over the shot the camera drifts about 2% left while her head tilts about 4 degrees and rises slightly.")
J["C12"] = person("C12", "In the studio, her tilted head and shoulders in the ivory trench collar over the cream knit; her eyes are closed. A piece of glass held in front of the lens makes a second, soft, slightly offset reflection of her face float beside her.",
                  f"{STUDIO}, soft grey light.", "Chest-up, still; the doubled reflection comes from the glass, not from a second person.")
J["C13"] = person("C13", "In the studio, a three-quarter shot: she stands centred and fills the frame height from the top of her head near the top edge down to mid-thigh at the bottom edge, arms folded across the belted trench, the outfit sharp and clear.",
                  f"{STUDIO}, soft even light.", "Three-quarter shot, still camera, eye level.")
J["C14"] = person("C14", "In the studio, waist-up, her figure softly blurred and doubled by a piece of glass in front of the lens, so two faint overlapping images of her drift across each other.",
                  f"{STUDIO}, soft grey light.", "Waist-up, the camera pushing in very slightly; one woman, doubled only by the glass.")
J["C15"] = person("C15", "The same framing as the earlier close-up. An extreme close-up, much closer than a portrait: the top edge of the frame cuts across her eyebrows and forehead, the bottom edge cuts just below her lips and chin, so her face is larger than the frame. Her face fills the left two-thirds of the frame, turned three-quarters to her left with the head tilted down to her left; her right ear with the small gold stud earring sits at the centre-right; loose dark hair falls over the right third against a dark grey background. Her eyes look down, lids lowered.",
                  "Low-key: a warm skin-toned soft side light from the left lights the near cheek and eyelid; the far side of her face and the background fall into deep shadow.", "Macro-close; the first frame of a shot where the camera pulls back about 4% while drifting about 5% left and 4% up.")
J["C16"] = thing("C16", "An extreme close-up of the cream fine-knit sweater: individual loops of yarn and a few soft fibres fill the frame.",
                 "Lit with a warm pinkish-red light from the side, glowing.", "Macro; the first frame of a shot where the camera tilts down about 9% of the frame while pushing in 2%.")
J["C17"] = person("C17", f"In {FIELD}, she is seen from waist up against a clear deep-blue sky, shot from below; the wind blows her hair and the lapels and collar of the ivory trench; her eyes are closed.",
                  "Bright clear afternoon, sun from behind and to the side, the sky saturated blue.", "Low angle from below, waist-up, camera almost still.")
J["C18"] = place("C18", f"An extreme close, soft-focus view of pampas-grass seeds and fine dust drifting through the air above {FIELD}.",
                 "Strong golden backlight, everything glowing amber and out of focus.", "Close, still.")
J["C19"] = thing("C19", "The small brown leather shoulder bag seen from directly above, lying on grey paper, large in the frame: it fills about two-thirds of the frame height and its centre sits about one-third of the way in from the LEFT edge, so the right third of the frame is empty grey paper; the flap and brass turn-lock toward the camera, part of the strap running off the top edge.",
                 f"{STUDIO}, soft light from the left falling off into a darker grey on the right; slightly soft focus.", "Top-down close-up; the first frame of a shot that pushes in about 4.5% while drifting up about 3%.")
J["C20"] = person("C20", "In the studio, chest-up in the ivory trench collar over the cream knit; a piece of glass in front of the lens splits her face into two soft overlapping images that drift apart.",
                  f"{STUDIO}, soft grey light.", "Chest-up, camera nearly still; only the glass moves, its soft second image sliding in toward the lower right; one woman.")
J["C21"] = person("C21", f"In {FIELD}, she walks toward the right past the camera; the camera is at ankle height looking up and tilted so the horizon rises about 10 degrees toward the right; the frame shows her from the boots up to just above the waist, left of centre, the wide cream trousers and the swinging hem of the ivory trench filling the left half; a big pale sky fills the upper right, the sun low behind her with a lens flare.",
                  "Late-afternoon backlight, rim light on the coat, warm haze.", "Very low angle from the ground, walking alongside her; from here the camera rises about 30% of the frame height and moves about 11% closer, ending on her full figure.")
J["C21e"] = person("C21e", f"In {FIELD}, she walks to the right close to the camera, seen from a low angle from her head down to mid-thigh, left of centre and filling most of the frame height, the trench hem swinging; the sun is low behind her shoulder with a lens flare and a big pale sky behind her.",
                   "Late-afternoon backlight, rim light on the coat, warm haze.", "Low angle, close medium-full shot, the camera has risen while walking alongside her.",
                   extra="This is the end frame of the same shot that began on her boots.")
J["C22"] = person("C22", f"Inside {HANOK}, a medium-full shot: she fills most of the frame height, from her head near the top edge down to mid-thigh at the bottom edge, standing just right of centre and close to the camera. Behind her at the left, a small square empty window in the crumbling clay wall blazes with low sun.",
                  "Strong backlight: the low sun through the window behind her rims her hair and shoulders with gold and flares into the lens; the front of her body and the room are in warm shadow, warm dust in the air.", "Full shot; the first frame of a shot where the camera pulls back about 4% while drifting about 8% left and 7% down, rolling about 1.5 degrees.")
J["C23"] = person("C23", "In the studio, a close shot from her lips down to her shoulders: her hand rests on the neckline of the cream knit and the ivory trench collar; her face above the lips is cut off by the top edge.",
                  "Soft peach-coloured light.", "Chest-up crop, still.", extra="Do not show her eyes or nose.")
J["C24"] = person("C24", "In the studio, waist-up, one hand on her waist over the tied trench belt, eyes closed, chin raised; a sheet of glass in front of the lens throws a soft second image across the left of the frame.",
                  f"{STUDIO}, soft grey light.", "Waist-up; the camera pushes in about 2% while the blurred reflection in the glass turns about 7 degrees and slides off to the left; one woman.")
J["C25"] = person("C25", f"Night. A medium shot from the knees up: she stands just left of centre against the crumbling clay wall of {HANOK}, her single long shadow thrown large on the wall to the right of her.",
                  "Very low-key night: she and her ivory coat are mostly in shadow, so the coat reads as a dull dark red-brown, never bright or glowing; only a dim deep-red light from below catches parts of her face, hands and the edges of the coat; most of the frame is near black.", "Medium shot; the first frame of a shot where the camera tilts down about 7% and rolls about 3 degrees counter-clockwise.", extra="Only one person; the second shape on the wall is her shadow.")
J["C26"] = faceless("C26", f"Inside the roofless ruin of {HANOK}, low among dry grass, looking at one small, roughly square empty window opening in a thick crumbling clay wall. The bright opening sits a little left of centre and fills about one-third of the frame width and half of the frame height. She stands right inside the opening as a black silhouette against the bright sky, close to the camera: her figure fills the opening from her raised hands touching its top edge down to below her knees at its bottom edge, both arms raised above her head, the long trench outline clear. The low sun sits just behind her legs at the bottom of the opening, flaring; dry grass in front catches the glow; the thick wall around the opening is dark.",
                  "Strong white daylight through the window, everything else dark; she is a pure silhouette.", "Full shot; the first frame of a shot where the camera drifts about 4.5% right and 3% down.")
J["C27"] = thing("C27", "Her brown leather ankle boot steps onto a dry dirt path in the yard, the hem of the wide cream trousers just above it.",
                 "Warm daylight, low angle shadows.", "Ground-level close-up; the first frame of a shot where the camera pushes in about 4% and drifts slightly left as the boot steps forward.", extra="Show only the boot, the trouser hem and the ground.")
J["C28"] = faceless("C28", "In the studio, from the neck down to the hips: she holds the small brown leather shoulder bag in front of her waist with both hands, the belted ivory trench and cream knit behind it.",
                  f"{STUDIO}, soft even light.", "Waist-up crop; the first frame of a shot that pushes in about 6.5%.", extra="The top edge of the frame cuts across her neck.")
J["C29"] = thing("C29", "An extreme close-up of the plain ivory satin lining inside the trench coat, seen in near darkness: soft folds radiate from the top of the frame.",
                 "Very low-key: the lining sits in deep warm shadow so the ivory reads as dark olive-brown; only the crests of two or three folds catch a faint warm glint; no bright areas anywhere, overall as dark as a dim room at dusk.", "Macro; the first frame of a push in of about 12% in under a second.")
J["C30"] = person("C30", f"Night. Close to the camera, from the knees up, she fills most of the frame height inside the rounded opening of a crumbling clay gateway of {HANOK}, the dark arch framing her; her arms are flung out and the trench hem swings.",
                  "The clay arch glows deep red at its edges; " + "Very low-key night: she and her ivory coat are mostly in shadow, so the coat reads as a dull dark red-brown, never bright or glowing; only a dim deep-red light from below catches parts of her face, hands and the edges of the coat; most of the frame is near black.", "Handheld; the first frame of a shot where the camera sinks steadily about 17% of the frame height and rolls about 9 degrees counter-clockwise.")
J["C32"] = person("C32", f"Night. Among dry bushes in the yard of {HANOK}, she stands medium-sized and almost swallowed by darkness.",
                  "Faint deep-red light, fading to black.", "Medium shot; the camera drifts up about 2% and rolls 3 degrees as the light dies.")
J["C33"] = person("C33", "Night. Her face in profile, head bowed, lit only by a deep red glow; the ivory collar just visible.",
                  "Deep red light, near darkness.", "Chest-up, nearly still.", face=FACE_R)
J["C34"] = person("C34", f"Night. A medium shot from the hips up: she leans her shoulder against the crumbling yellow-ochre clay wall of {HANOK} at the left of the frame, relaxed, her face turned toward the camera; dark empty space to the right.",
                  "Deep red light raking across the wall from the side; " + "Very low-key night: she and her ivory coat are mostly in shadow, so the coat reads as a dull dark red-brown, never bright or glowing; only a dim deep-red light from below catches parts of her face, hands and the edges of the coat; most of the frame is near black.", "Medium shot, almost still.")
J["CEND"] = thing("CEND", "An extreme close-up of the ivory wool gabardine twill, filling the frame, with a soft dark vignette; leave a calm empty area in the middle for a title added later.",
                  "Very low-key and dark: the ivory twill lies almost entirely in deep warm shadow so it reads dark brown, only a faint raking light from the upper right touches a few ridges; the middle of the frame is dark enough for a white title to read clearly.", "Macro; the first frame of a slow steady push in of about 5%, shallow focus.", layout=False)

# ── 룩북 6장(세로 3:4 — 4:5로 자르기만 한다)
def look(i, scene, light):
    p = " ".join([f"Create one photograph. A fashion lookbook photo, 3:4 vertical frame.", f"Images 1 to 3 {IDREF}", f"Image 4 {OUTREF}",
                  f"The woman is {YUNA}.", f"She wears {OUTFIT}.", scene, light, CALM, FINISH])
    return {"refs": FACE + OUTFIT_REFS, "prompt": p, "ratio": "3:4"}

J["L1"] = look(1, f"On {STUDIO}, full-length, facing the camera, weight on one leg, hands in the coat pockets.", "Soft even studio light.")
J["L2"] = look(2, f"On {STUDIO}, full-length, turned three-quarters to her left, one hand on the bag strap, looking past the camera.", "Soft side light from the left.")
J["L3"] = look(3, f"In {FIELD}, waist-up, the wind lifting her hair and the coat collar, eyes looking down.", "Clear late-afternoon backlight, warm rim light.")
J["L4"] = look(4, f"Inside {HANOK}, full-length beside the empty window frame, sun pouring in behind her.", "Strong window backlight, dim warm room.")
J["L5"] = look(5, f"On {STUDIO}, a close detail from chest to hips: the tied belt, the horn buttons and the bag held at her waist, her face out of frame.", "Soft even light.")
J["L6"] = look(6, f"Night, full-length, leaning against the crumbling clay wall of {HANOK}.", "Deep red light raking across the wall.")

# ── 10-27 Fable 이미지 콘티 검수 반영(레퍼런스/p4/검수/fable_이미지콘티_20261027/답.md) — P1 아홉 · P2 열넷 가운데 굽기로 고칠 것. 위 정의를 덮어쓴다.
FACE_CLOSE = [str(R / n) for n in ("F01_face-close.jpg", "F01_front.jpg", "F01_profile-left.jpg")]   # 극접사는 얼굴 접사 참조를 앞에(Fable P3)
NIGHT2 = ("Very low-key night: she and her ivory coat are mostly in shadow, so the coat reads as a dull dark red-brown, never bright or glowing; "
          "only a dim deep-red light from below catches parts of her face, hands and the edges of the coat; most of the frame is near black.")
XCU = ("Extreme close-up, the face overflows the frame — crop just above the eyebrows and just below the lips: no forehead, no neck. "
       "Her eyes are in the upper-left third, her nose at centre-left, one small gold stud earring at the right; her head is tilted about 25 degrees so her chin points to the lower left; "
       "eyes cast down, lids lowered; loose dark hair at the right edge against dark grey.")
XCU_LIGHT = "Low-key: a warm skin-toned soft side light from the left lights the near cheek and eyelid; the far side of her face and the background fall into deep shadow."
# P1
J["C11"] = person("C11", XCU, XCU_LIGHT, "Macro-close; over the shot the camera drifts about 2% left while her head tilts about 4 degrees and rises slightly.", face=FACE_CLOSE)
J["C15"] = person("C15", XCU + " Framed about one hand's width further left and higher than the earlier close-up.", XCU_LIGHT,
                  "Macro-close; the first frame of a shot where the camera pulls back about 4% while drifting about 5% left and 4% up.", face=FACE_CLOSE)
J["C23"] = person("C23", "In the studio, a close shot framed from just above her eyebrows down to the collarbone: her eyes, nose and lips fully visible, a sidelong downward glance toward the camera, "
                  "one hand resting on the side of her neck at the ivory trench collar over the cream knit.",
                  "Peach key light from the left and a faint cool fill from the right.", "Close shot, still.")
J["C21"] = person("C21", f"In {FIELD}, first frame of a walking shot: the frame runs from the belt knot down — the belt ends and her hands at the top edge, the coat hem, the wide cream trousers and her boots on the dirt path; "
                  "the camera is at ankle height, the horizon tilted about 8 degrees, a sun flare at the upper left; no face in the frame.",
                  "Late-afternoon backlight, rim light on the coat, warm haze.", "Very low angle from the ground, walking alongside her; from here the camera rises about 30% of the frame height and moves about 11% closer.")
J["C21e"] = person("C21e", f"In {FIELD}, end frame of the same walking shot: her full figure from the top of her head to mid-shin, walking to the right in side view, the trench hem swinging, the sun behind her right shoulder with a lens flare.",
                   "Late-afternoon backlight, rim light on the coat, warm haze.", "Low camera, full figure.", extra="This is the end frame of the same shot that began on her belt and boots.")
J["C22"] = person("C22", f"Inside {HANOK}: she stands directly in front of a large empty window in the crumbling clay wall, centred about 45% across, framed from her head to mid-thigh; "
                  "the bright window fills the lower-left of the frame behind her legs.",
                  "Backlit by the low sun through the window, so her body is nearly a silhouette with a golden rim on her hair and coat edges; the front of the coat is in shadow; warm dust in the air.",
                  "Full shot; the first frame of a shot where the camera pulls back about 4% while drifting about 8% left and 7% down, rolling about 1.5 degrees.")
J["C20"] = person("C20", "In the studio, chest-up in the ivory trench collar over the cream knit, a thin brown bag strap over her left shoulder; eyes closed, head tilted toward her left shoulder, expressionless, no eye contact; "
                  "her face is sharp and a piece of glass in front of the lens throws a blurred second image of her face at the lower right.",
                  f"{STUDIO}, soft grey light.", "Chest-up, camera nearly still; only the glass image slides; one woman.")
J["C30"] = person("C30", f"Night. Inside the rounded opening of a crumbling clay gateway of {HANOK}, centred in the dark arch and framed from head to knees: mid-swing, both arms spread wide, one raised above her shoulder, the coat hem flaring.",
                  "The clay arch glows deep red at its edges; " + NIGHT2, "Handheld; the first frame of a shot where the camera sinks steadily about 17% of the frame height and rolls about 9 degrees counter-clockwise.")
J["C14"] = person("C14", "In the studio, waist-up, a thin brown bag strap over her left shoulder. The entire frame is out of focus — soft everywhere, no sharp edge anywhere: a dreamy, blurred double image of her head and shoulders drifting to the left.",
                  f"{STUDIO}, soft grey light.", "Waist-up, the camera pushing in very slightly; one woman, doubled only by the glass.")
J["C29"] = thing("C29", "An extreme close-up of the plain ivory satin lining inside the trench coat: soft folds radiate from the top of the frame.",
                 "Mid-key like a leaf in soft daylight, not dark: the ivory satin reads clearly cream; a warm side light rakes across the folds so the crests are bright ivory and only the troughs fall into soft shadow.",
                 "Macro; the first frame of a push in of about 12% in under a second.")
# P2
J["C17"] = person("C17", f"In {FIELD}, shot from far below at waist level: nothing but clear deep-blue sky behind her — no ground, no grass, no hills; the sun directly behind her head as a halo flare; "
                  "strong wind blows her hair across her face and lifts the lapels and collar of the ivory trench; her eyes are closed.",
                  "Bright clear afternoon, the sky saturated blue.", "Low angle from below, waist-up, camera almost still.")
J["C12"] = person("C12", "In the studio, her head and shoulders in the ivory trench collar over the cream knit, a thin brown bag strap over her left shoulder; her head tilted about 20 degrees to her right, eyes fully closed. "
                  "A piece of glass held in front of the lens makes a second, soft, slightly offset reflection of her face float beside her.",
                  f"{STUDIO}, soft grey light.", "Chest-up, still; the doubled reflection comes from the glass, not from a second person.")
J["C33"] = person("C33", "Night. Her face in profile, head bowed, chest-up; the ivory collar just visible.",
                  "A warm key light from the front-left so her bowed profile reads clearly; her clothes and the background fall to black.", "Chest-up, nearly still.", face=FACE_R)
J["C34"] = person("C34", f"Night. A medium shot from the hips up: she leans her shoulder on the crumbling yellow-ochre clay wall of {HANOK}, standing left of centre (about 45% across); the red-lit mud wall fills the left half of the frame, relaxed, her face turned toward the camera.",
                  "Deep red light raking across the wall from the side; " + NIGHT2, "Medium shot, almost still.")
J["C04"] = thing("C04", "An extreme close-up of one dark-brown horn button sewn on the ivory gabardine — the cross stitches of thread visible, the button filling most of the frame.",
                 "Low-key: the horn button sits in deep shadow, one soft raking side light catching its rim and the thread.", "Macro lens, still.")
J["C03"] = thing("C03", "The trench coat's fabric-covered belt buckle stands upright and tall on a strip of the self-fabric belt, filling about 80% of the frame height with the buckle head in the upper third, a little left of centre; grey space around it.",
                 f"{STUDIO}, soft side light.", "Still camera, eye level with the object.")
J["C06"] = thing("C06", "A narrow edge of the small brown leather shoulder bag rises from the lower left to the centre of the frame like a stalk, its stitching catching the light; most of the frame is empty dark grey.",
                 "Against a dark warm-grey backdrop, soft light from the left.", "Close-up, still.")
J["C09"] = thing("C09", "One of her brown leather ankle boots fills the frame from top to bottom, seen from the side at its own height and cropped at the top and bottom edges: the smooth leather, almond toe and low block heel.",
                 "A plain beige paper backdrop, soft light.", "Close-up, still, a very slight push in.")
J["C27"] = thing("C27", "Her brown leather ankle boot steps forward onto a dry dirt path in the yard, the hem of the wide cream trousers just above it, the foot moving into shadow.",
                 "Darker: dim light, the background nearly black.", "Ground-level close-up; the first frame of a shot where the camera pushes in about 4% and drifts slightly left as the boot steps forward.",
                 extra="Show only the boot, the trouser hem and the ground.")
J["CEND"] = thing("CEND", "An extreme close-up of the ivory wool gabardine twill, filling the frame, with a soft dark vignette; leave a calm empty area in the middle for a title added later.",
                  "Warm brown low-key, never olive or khaki: the twill lies in deep warm shadow, a few small bright glints along the ridges like droplets, light raking from the upper right; the middle is dark enough for a white title.",
                  "Macro; the first frame of a slow steady push in of about 5%, shallow focus.", layout=False)
J["C26"] = faceless("C26", f"Inside the roofless ruin of {HANOK}, low among dry grass, looking at one large, slightly trapezoid empty window opening in a thick crumbling clay wall: the bright opening fills about 25% to 60% of the frame width and 15% to 85% of its height. "
                    "She stands right inside the opening as a black silhouette against the bright sky, her figure spanning the full height of the window from her raised hands at its top edge to its bottom edge, both arms raised above her head, the long trench outline clear. "
                    "The low sun sits just behind her legs at the bottom of the opening, flaring; the thick wall around the opening is dark.",
                    "Strong white daylight through the window, everything else dark; she is a pure silhouette.", "Full shot; the first frame of a shot where the camera drifts about 4.5% right and 3% down.")
J["L4"] = look(4, f"Inside {HANOK}, full-length beside the empty window frame.", "Backlit by the low window at her side: a warm rim light on her hair and the coat edges, the front of her body in soft shade, dim warm room.")

# ── 10-27 08시 Fable 반영 2차 — 2차 판에서도 원본과 달랐던 넷(21 첫은 가슴부터, 22는 창 옆, 14는 얼굴이 또렷, 29는 너무 밝음)
J["C21"] = person("C21", f"In {FIELD}, first frame of a walking shot. Only the lower half of her body is in the frame: the top edge of the frame cuts across her hips at the belt knot — nothing above her waist is visible, no shoulders, no bag, no face. "
                  "The coat hem, the wide cream trousers and her brown boots on the dirt path fill the left half; the camera is at ankle height, tilted so the horizon slopes about 8 degrees; a big pale sky fills the upper right with a sun flare at the upper left.",
                  "Late-afternoon backlight, rim light on the coat, warm haze.", "Very low angle from the ground, walking alongside her; from here the camera rises about 30% of the frame height and moves about 11% closer.")
J["C22"] = person("C22", f"Inside {HANOK}: a large empty window in the crumbling clay wall glows with low sun in the lower-left-centre of the frame, and she stands directly in front of it, centred about 45% across — her hips and legs overlap the glowing window behind her; framed from her head to mid-thigh.",
                  "Backlit by the low sun through the window, so her body is nearly a silhouette with a golden rim on her hair and coat edges; the front of the coat is in shadow; warm dust in the air.",
                  "Full shot; the first frame of a shot where the camera pulls back about 4% while drifting about 8% left and 7% down, rolling about 1.5 degrees.")
J["C14"] = person("C14", "In the studio, waist-up, a thin brown bag strap over her left shoulder. Shot completely out of focus, as if the lens were focused far behind her: everything is soft and blurred, including her face — "
                  "no sharp edge or fine detail anywhere, her features only soft shapes; a second blurred copy of her head and shoulders drifts to the left.",
                  f"{STUDIO}, soft grey light.", "Waist-up, the camera pushing in very slightly; one woman, doubled only by the glass.")
J["C29"] = thing("C29", "An extreme close-up of the plain ivory satin lining inside the trench coat: soft folds radiate from the top of the frame.",
                 "Mid-tone overall, about as bright as a softly lit room, not white: the cream satin is lit by a low warm side light; the crests glow ivory and about half of the frame falls into soft warm brown shadow between the folds.",
                 "Macro; the first frame of a push in of about 12% in under a second.")

J["C22"] = person("C22", f"Inside {HANOK}. Composition: a single large, bright empty window opening in the crumbling clay wall, and she stands squarely in front of it so that her body blocks the middle of the window — "
                  "the glowing window shows on both sides of her hips and legs and above her shoulders; she is centred at about 45% across, framed from her head to mid-thigh; the window occupies the lower-left-centre of the frame.",
                  "Backlit by the low sun through the window behind her, so her body is nearly a silhouette with a golden rim on her hair and coat edges; the front of the coat is in shadow; warm dust in the air.",
                  "Full shot; the first frame of a shot where the camera pulls back about 4% while drifting about 8% left and 7% down, rolling about 1.5 degrees.")

# ── 10-27 09시 Fable 2차(답2.md) — 가방 쪽(옷 기준 O1: 모델의 오른쪽 어깨 = 화면 왼쪽)이 뒤집힌 21 끝 · 22, 허리띠 · 단추가 풀린 21 첫, 아직 밝은 4, 방향이 거울인 6
BAG = "The small brown leather bag hangs from HER RIGHT shoulder, which is on the LEFT side of the picture as we face her; the coat is belted (belt tied at the waist) and buttoned."
J["C21"] = person("C21", f"In {FIELD}, first frame of a walking shot, seen from the side as she walks to the right. Only the lower half of her body is in the frame: the top edge cuts across her hips at the tied belt knot — nothing above her waist is visible, no face. "
                  "The buttoned coat hem, the wide cream trousers and her brown boots on the dirt path fill the left half; the camera is at ankle height, tilted so the horizon slopes about 8 degrees; a big pale sky fills the upper right with a sun flare at the upper left.",
                  "Late-afternoon backlight, rim light on the coat, warm haze.", "Very low angle from the ground, walking alongside her; from here the camera rises about 30% of the frame height and moves about 11% closer.",
                  extra="The coat is belted with the belt tied and buttoned all the way down, exactly as in the end frame of this shot.")
J["C21e"] = person("C21e", f"In {FIELD}, end frame of the same walking shot: her full figure from the top of her head to mid-shin, walking to the right in side view, the belted, buttoned trench hem swinging, the sun behind her right shoulder with a lens flare.",
                   "Late-afternoon backlight, rim light on the coat, warm haze.", "Low camera, full figure.",
                   extra="She walks to the right, so we see her left side: the bag hangs from her right shoulder on her far side and is hidden behind her body. This is the end frame of the same shot that began on her belt and boots.")
J["C22"] = person("C22", f"Inside {HANOK}. Composition: a single large, bright empty window opening in the crumbling clay wall, and she stands squarely in front of it so that her body blocks the middle of the window — "
                  "the glowing window shows on both sides of her hips and legs and above her shoulders; she is centred at about 45% across, framed from her head to mid-thigh; the window occupies the lower-left-centre of the frame. " + BAG,
                  "Strong backlight from the low sun through the window behind her: her body, face and the front of the coat are nearly a dark silhouette, only a golden rim on her hair and coat edges; warm dust in the air.",
                  "Full shot; the first frame of a shot where the camera pulls back about 4% while drifting about 8% left and 7% down, rolling about 1.5 degrees.")
J["C04"] = thing("C04", "An extreme close-up of one dark-brown horn button sewn on the ivory gabardine — the cross stitches of thread visible, the button filling most of the frame.",
                 "Very low-key, like a dim room at night: almost the whole frame is deep shadow, the ivory cloth reads dark grey-brown; one thin soft raking side light catches only the rim of the button and the thread.", "Macro lens, still.")
J["C06"] = thing("C06", "A narrow edge of the small brown leather shoulder bag rises from the lower left toward the upper centre, leaning to the right like a stalk of grass, its stitching catching the light; the right half and the top of the frame are empty dark grey.",
                 "Against a dark warm-grey backdrop, soft light from the left.", "Close-up, still.")

(V / "ego").mkdir(parents=True, exist_ok=True)
(V / "ego" / "jobs_p4.json").write_text(json.dumps(J, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "지시문").mkdir(exist_ok=True)
(HERE / "지시문" / "이미지콘티.json").write_text(json.dumps({k: {"prompt": v["prompt"], "ratio": v["ratio"], "refs": [Path(r).name for r in v["refs"]]} for k, v in J.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(J), "jobs", max(len(v["prompt"]) for v in J.values()), "자 최대")
