# 4번 「결채 — 한 벌」 이미지 콘티 지시문(2026-10-26) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록을 만든다.
#   python -X utf8 이미지콘티_지시문.py   → synk-vendor/…/콘티/p4/ego/jobs_p4.json(실행기 gen.mjs가 읽음) · 같은 폴더의 지시문/이미지콘티.json(저장소 사본)
# 길은 만족 사례 장부 S31(「매진 임박」 v4) · 6번 이미지 콘티와 같다: 원본 첫 프레임에서 사람을 검은 실루엣으로 바꾸고 크게 흐린 배치도
# + 유나 고정 얼굴 세트(캐스팅 원본) + 옷 기준 그림(O1 · O3 — 먼저 굽는다). 빛 · 장소 · 카메라는 지시문에 쓰고 받은 색을 그대로 쓴다(공통 원칙 3).
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
    refs = ([str(B / f"{cid}.png")] if layout else []) + OUTFIT_REFS
    lay = LAYOUT.replace("The black silhouette marks exactly where the woman is. ", "") if layout else ""
    k = 2 if layout else 1
    p = " ".join([STILL, lay, f"Image {k} shows the outfit this detail belongs to — match its material and colour exactly.",
                  what, light, camera, "No person, no hands unless written.", extra, FINISH])
    return {"refs": refs, "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


def place(cid, what, light, camera):
    p = " ".join([STILL, LAYOUT.replace("The black silhouette marks exactly where the woman is. ", ""), what, light, camera, "No people.", FINISH])
    return {"refs": [str(B / f"{cid}.png")], "prompt": p.replace("  ", " ").strip(), "ratio": "16:9"}


J = {}

# ── 옷 기준 그림(먼저) — 얼굴 세트만 참조. 세로 3:4 전신 앞 · 뒤 · 옆, 가로 부분판.
def outfit_ref(view, extra):
    p = " ".join(["Create one photograph. A clean full-length fashion lookbook photo, 3:4 vertical frame.",
                  f"Images 1 to 3 {IDREF}", f"The woman is {YUNA}.", f"She wears {OUTFIT}.",
                  f"She stands on {STUDIO}, whole body in frame from the top of the hair to the boots with a little space above and below, {view}.",
                  "Soft, even studio light from the front-left, a gentle shadow on the paper. Hands relaxed at her sides (the bag hangs from her left shoulder).",
                  CALM, extra, FINISH])
    return {"refs": FACE, "prompt": p, "ratio": "3:4"}

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
                 "Dim, low raking side light from the left so the weave shows as fine ridges; the rest falls to deep shadow; warm brown-ivory tones.",
                 "Macro lens, perfectly still, flat to the fabric.", layout=False)
J["C03"] = thing("C03", "The trench coat's fabric-covered belt buckle stands alone in the middle of the frame, upright on a strip of the self-fabric belt, small in the frame with grey space around it.",
                 f"{STUDIO}, soft side light.", "Still camera, eye level with the object.")
J["C04"] = thing("C04", "An extreme close-up of one dark-brown horn button sewn on the ivory gabardine — the cross stitches of thread visible, the button filling most of the frame.",
                 "Soft grey studio light.", "Macro lens, still.")
J["C05"] = place("C05", f"A wide view of {FIELD}; the grass fills the lower third, a big pale sky with soft clouds above.",
                 "Clear afternoon light, slightly hazy, warm.", "Still camera at standing eye level, level horizon.")
J["C06"] = thing("C06", "The side of the small brown leather shoulder bag, close: the grain of the leather and a neat line of saddle stitching run diagonally up through the frame.",
                 "Against a dark warm-grey backdrop, soft light from the left so the stitching catches light.", "Close-up, still.")
J["C07"] = place("C07", f"Night. In the yard of {HANOK}, a large old persimmon tree stands as a black silhouette; warm orange light shines up from the ground behind and below it, glowing through the bare branches.",
                 "Deep night, the only light is the low warm orange glow; everything else near black.", "Wide, still camera at standing eye level, almost imperceptible push in.")
J["C08"] = person("C08", f"Night. The woman stands small and full-length in the dark doorway of a crumbling clay wall of {HANOK}, framed by the ruined opening, facing the camera.",
                  "Dim deep-red light washes the clay walls; she is barely lit, half in darkness, as if just emerging from the dark.", "Wide shot, still camera, eye level.")
J["C09"] = thing("C09", "One of her brown leather ankle boots stands alone in the middle of the frame, seen from the side at its own height: the smooth leather, almond toe and low block heel.",
                 "A plain beige paper backdrop, soft light.", "Close-up, still, a very slight push in.")
J["C11"] = person("C11", "An extreme close-up of her face filling the frame: the face fills about two-thirds of the frame height, the top of her head cut off by the top edge; her head tilts to her left and her eyes look down, lids lowered; the edge of the ivory trench collar just shows at the bottom edge.",
                  "Warm skin-toned soft side light from the left; dark grey background.", "Macro-close, the camera drifts slightly left and tilts about 6 degrees.")
J["C12"] = person("C12", "In the studio, her tilted head and shoulders in the ivory trench collar over the cream knit; her eyes are closed. A piece of glass held in front of the lens makes a second, soft, slightly offset reflection of her face float beside her.",
                  f"{STUDIO}, soft grey light.", "Chest-up, still; the doubled reflection comes from the glass, not from a second person.")
J["C13"] = person("C13", "In the studio, she stands full-length with her arms folded, the whole belted trench outfit sharp and clear, boots planted.",
                  f"{STUDIO}, soft even light.", "Full shot, still camera, eye level.")
J["C14"] = person("C14", "In the studio, waist-up, her figure softly blurred and doubled by a piece of glass in front of the lens, so two faint overlapping images of her drift across each other.",
                  f"{STUDIO}, soft grey light.", "Waist-up, still; one woman, doubled only by the glass.")
J["C15"] = person("C15", "The same extreme close-up of her face as before: head tilted, eyes lowered; the face fills about two-thirds of the frame height, the top of the head cut off by the top edge; the ivory collar at the bottom edge.",
                  "Warm skin-toned soft side light from the left; dark grey background.", "Macro-close; the camera pulls back about 7% and drifts left.")
J["C16"] = thing("C16", "An extreme close-up of the cream fine-knit sweater: individual loops of yarn and a few soft fibres fill the frame.",
                 "Lit with a warm pinkish-red light from the side, glowing.", "Macro, the camera tilts slowly down.")
J["C17"] = person("C17", f"In {FIELD}, she is seen from waist up against a clear deep-blue sky, shot from below; the wind blows her hair and the lapels and collar of the ivory trench; her eyes are closed.",
                  "Bright clear afternoon, sun from behind and to the side, the sky saturated blue.", "Low angle from below, waist-up, camera almost still.")
J["C18"] = place("C18", f"An extreme close, soft-focus view of pampas-grass seeds and fine dust drifting through the air above {FIELD}.",
                 "Strong golden backlight, everything glowing amber and out of focus.", "Close, still.")
J["C19"] = thing("C19", "The small brown leather shoulder bag seen from directly above, lying on grey paper: the flap, the brass turn-lock and the stitching, the bag filling the middle of the frame.",
                 f"{STUDIO}, soft even light.", "Top-down close-up, still.")
J["C20"] = person("C20", "In the studio, chest-up in the ivory trench collar over the cream knit; a piece of glass in front of the lens splits her face into two soft overlapping images that drift apart.",
                  f"{STUDIO}, soft grey light.", "Chest-up, still camera; only the glass moves; one woman.")
J["C21"] = person("C21", f"In {FIELD}, she walks toward the right; the frame starts low on her boots, the wide cream trousers and the swinging hem of the ivory trench, the sun low behind her with a lens flare.",
                  "Late-afternoon backlight, rim light on the coat, warm haze.", "Very low angle from the ground, walking alongside her.")
J["C21e"] = person("C21e", f"In {FIELD}, she walks to the right, now seen full-length from head to boots, the trench hem swinging, the sun low behind her with a lens flare.",
                   "Late-afternoon backlight, rim light on the coat, warm haze.", "Low angle, full shot, the camera has risen while walking alongside her.",
                   extra="This is the end frame of the same shot that began on her boots.")
J["C22"] = person("C22", f"Inside {HANOK}, she stands full-length beside an empty window frame in the crumbling clay wall; bright sun pours through the window behind her.",
                  "Strong daylight through the window, the room dim, warm dust in the air, she is rim-lit.", "Full shot, the camera drifts left and down and tilts about 5 degrees.")
J["C23"] = person("C23", "In the studio, a close shot from her lips down to her shoulders: her hand rests on the neckline of the cream knit and the ivory trench collar; her face above the lips is cut off by the top edge.",
                  "Soft peach-coloured light.", "Chest-up crop, still.", extra="Do not show her eyes or nose.")
J["C24"] = person("C24", "In the studio, waist-up, one hand on her waist over the tied trench belt, eyes closed, chin raised; a sheet of glass in front of the lens throws a soft second image across the left of the frame.",
                  f"{STUDIO}, soft grey light.", "Waist-up; the glass turns about 15 degrees; one woman.")
J["C25"] = person("C25", f"Night. She stands in medium shot against the crumbling clay wall of {HANOK}; her single long shadow falls on the wall beside her.",
                  "Deep red light from below, most of the frame in darkness.", "Medium shot, the camera tilts down slowly.", extra="Only one person; the second shape on the wall is her shadow.")
J["C26"] = person("C26", f"Inside {HANOK}, she stands as a dark silhouette in front of the bright empty window frame, both arms raised above her head, the long trench outline clear.",
                  "Strong white daylight through the window, everything else dark; she is a pure silhouette.", "Full shot, the camera drifts right a little.")
J["C27"] = thing("C27", "Her brown leather ankle boot steps onto a dry dirt path in the yard, the hem of the wide cream trousers just above it.",
                 "Warm daylight, low angle shadows.", "Ground-level close-up; the camera pulls back a little and tilts about 6 degrees.", extra="Show only the boot, the trouser hem and the ground.")
J["C28"] = person("C28", "In the studio, from the neck down to the hips: she holds the small brown leather shoulder bag in front of her waist with both hands, the belted ivory trench and cream knit behind it.",
                  f"{STUDIO}, soft even light.", "Waist-up crop, the camera pushes in slightly.", extra="Her face is above the top edge and not visible.")
J["C29"] = thing("C29", "An extreme close-up of the plain ivory satin lining inside the trench coat: soft folds catch the light.",
                 "Warm side light.", "Macro, the camera pushes in slowly.")
J["C30"] = person("C30", f"Night. She stands full-length inside the rounded opening of a crumbling clay gateway of {HANOK}, her arms flung out, the trench hem swinging.",
                  "Deep red light, the clay glowing red, the rest dark.", "Full shot, handheld, the camera sinks down steadily.")
J["C32"] = person("C32", f"Night. Among dry bushes in the yard of {HANOK}, she stands medium-sized and almost swallowed by darkness.",
                  "Faint deep-red light, fading to black.", "Medium shot, still.")
J["C33"] = person("C33", "Night. Her face in profile, head bowed, lit only by a deep red glow; the ivory collar just visible.",
                  "Deep red light, near darkness.", "Chest-up, still.", face=FACE_R)
J["C34"] = person("C34", f"Night. She leans full-length against the crumbling yellow-ochre clay wall of {HANOK}, relaxed.",
                  "Deep red light raking across the wall from the side.", "Full shot, almost still.")
J["CEND"] = thing("CEND", "An extreme close-up of the ivory wool gabardine twill, filling the frame, with a soft dark vignette; leave a calm empty area in the middle for a title added later.",
                  "Dim warm light, low contrast.", "Macro, almost still.", layout=False)

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

(V / "ego").mkdir(parents=True, exist_ok=True)
(V / "ego" / "jobs_p4.json").write_text(json.dumps(J, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "지시문").mkdir(exist_ok=True)
(HERE / "지시문" / "이미지콘티.json").write_text(json.dumps({k: {"prompt": v["prompt"], "ratio": v["ratio"], "refs": [Path(r).name for r in v["refs"]]} for k, v in J.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(J), "jobs", max(len(v["prompt"]) for v in J.values()), "자 최대")
