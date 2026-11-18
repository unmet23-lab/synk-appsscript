# 03_명절밥상_이어폰 이미지 콘티 지시문(11-17 video-image-prompts 에이전트가 짓고, 주 세션이 서진 뿌리 그림 · C3b 왼쪽 귀 · C6 할머니 쪽 카메라로 고침.
#   11-18 새벽 Fable 2차 검수 반영 — C3 귀 속 이어폰 · 참는 얼굴 · 천장 없음, C5 할머니 흐린 옆얼굴, C6 할머니 쪽 시선 · 앞 어깨, C7 케이스를 밥그릇과 같은 줄에.
#   11-17 밤 Fable 콘티 검수 반영 — 꾸민 서진 뿌리 · 작은 케이스를 C4 · C5에 미리 · C1 · C3 더 가깝게 · C3 굳은 미소 · C5 같은 상차림과 뒤 사람 · C6 방금 뗀 손 · C2 엄지 없음) — 표의 장소 · 빛 · 인물 · 소품 문장은 컷표.json에서 그대로 꺼내 붙인다.
import json, sys
from pathlib import Path

편 = Path(sys.argv[1])
표 = json.loads((편 / "컷표.json").read_text(encoding="utf-8"))
S, P, R = 표["장면"], 표["인물"], 표["소품"]
out = 편 / "이미지지시문"

HEAD = "Photoreal 9:16 vertical film still, fine natural grain."
NOT_TAIL = "No text, letters, logos or watermark anywhere. Indoors: the air is clear, no drifting specks."
ROOM_NOT = "No standing air conditioner; no coloured painting."


def 점(이름, n):
    return P[이름]["점"].replace("Image 1", f"Image {n}")


def 사람(이름, 점번호=None):
    p = P[이름]
    s = f'{p["묘사"]} {p["옷"]}'
    if 점번호:
        s += " " + 점(이름, 점번호)
    return s


def 짧게(이름):
    """흐리게 · 뒷모습 · 손만 나오는 사람 — 이름과 옷만(지시문 한도 4,300자)"""
    return {"은정": "Eunjeong (45, shoulder-length side-swept dark-brown waves, a navy silk blouse with a fine pearl necklace).",
            "준호": "Junho (38, neat black side-parted hair, a camel-brown crew-neck knit).",
            "민재": "Minjae (28, black hair with a messy fringe, a light-blue oxford shirt)."}[이름]


def 할머니():
    p = P["할머니"]
    return f'The grandmother: {p["묘사"]} {p["옷"]}'


def 판(refs, 장면, who, moment, frame, props, nott):
    return "\n".join([
        HEAD,
        "REFS: " + refs,
        "",
        "SETTING: " + S[장면]["장소"],
        "",
        "LIGHT: " + S[장면]["빛"],
        "",
        "WHO: " + who,
        "",
        "MOMENT: " + moment,
        "",
        "FRAME: " + frame,
        "",
        "PROPS: " + props,
        "",
        "NOT: " + nott,
        "",
    ])


이어폰 = R["이어폰"]["생김새"]
케이스 = R["케이스"]["생김새"]
만두 = R["만두"]["생김새"]

ROOM_REF = "an earlier wide shot at this table, for the room, dishes, light and clothes only; ignore its faces, poses and framing."
ROOM_REF_SOLO = "an earlier wide shot at this table, for the room behind her, the light and her clothes only; ignore its faces, poses, other people and framing."
SEOJIN_NOTE = "she wears no earrings and her clothes come from the text."
ROOT = ("[IMG1] Image 1 - Seojin's character reference: face, styling, hair, knit, earbuds. "
        "[IMG2] Image 2 - her casting photo, for facial features only (ignore its earrings and shirt).")

글 = {}

글["C1"] = 판(
    ROOT + " [IMG3] Image 3 - " + ROOM_REF
    + " [IMG4] Image 4 - the earbuds' shape and finish only. [IMG5] Image 5 - the dumplings and plate only.",
    "밥상_서진쪽",
    사람("서진", 1) + " " + 사람("은정")
    + " Eunjeong shows only as a blurred shoulder, necklace end and hand at the left edge of the frame; her face is outside the frame.",
    "The instant before the first question lands. Seojin sits at the table with her body and face turned three-quarters "
    "toward the left edge of the frame, toward Eunjeong. In her right hand her metal chopsticks hold one dumpling just above "
    "her plate, about to lift it toward her mouth; her eyes are lowered to the dumpling, her lips closed, her face "
    "unguarded. From the left edge of the frame Eunjeong's hand reaches in with metal chopsticks holding a piece of golden jeon, "
    "moving toward Seojin's plate.",
    "Close medium shot at her eye level: her head and shoulders fill the upper two-thirds of the frame, her face about 38% of "
    "the frame height; along the bottom of the frame only the edge of her plate, the dumpling in her chopsticks and "
    "Eunjeong's chopsticks with the jeon. Her left ear and the earbud in it face the camera, clearly visible. 65mm lens feel, focus on Seojin's eyes; the room behind her is a soft warm blur.",
    "The earbuds, one in each of her ears: " + 이어폰 + " The dumpling in her chopsticks comes from the plate on the table: " + 만두,
    "Only these two people appear - Seojin, and Eunjeong's shoulder and hand with her face outside the frame - no one else, "
    "no other faces and no other hands. " + NOT_TAIL,
)

글["C2"] = 판(
    "[IMG1] Image 1 - Junho's face reference, for his face and hair only. [IMG2] Image 2 - Minjae's face reference, for his "
    "face and hair only. Their clothes come only from the text below. [IMG3] Image 3 - the dumplings and plate only.",
    "밥상_맞은편",
    사람("준호", 1) + " " + 사람("민재", 2),
    "The instant before they both start talking at once, seen from Seojin's seat across the table. Junho, at the left of the "
    "frame, is already leaning forward over the table toward the camera; the metal chopsticks in his right hand are lifting "
    "off his plate, about to point at the plate in front of the camera; his eyebrows are rising and his lips are just parting "
    "to speak, his face full of worry. Minjae, at the right of the frame, leans toward the camera too, a proud grin starting "
    "across his face, two fingers of his right hand about to tap his own chest. Both men look at Seojin just beside the lens, "
    "not straight into it.",
    "Medium two-shot at Seojin's seated eye level, looking straight across the table at the two men. Junho at the left of "
    "the frame, Minjae at the right of the frame, both leaning toward the camera. Along the bottom of the frame the near "
    "dishes are soft and out of focus. 40mm lens feel, focus on both men's eyes; the bookshelf and the wall clock behind "
    "them are soft. The colour matches the rest of the film: neutral warm daylight and true skin tones, not amber or yellow.",
    "The plate of dumplings sits among the near dishes, blurred in the foreground: " + 만두,
    "Only these two people appear - no one else, no other faces. No thumbs-up. " + NOT_TAIL,
)

글["C3"] = 판(
    ROOT + " [IMG3] Image 3 - " + ROOM_REF_SOLO + " [IMG4] Image 4 - the earbuds' shape and finish only.",
    "밥상_서진쪽",
    사람("서진", 1),
    "A breath into the questions. Seojin faces the camera almost straight-on, her eyes just past the lens toward the "
    "relatives across the table. She is holding it together: lips pressed into a thin, tight line, the corners held up by "
    "effort, jaw set; eyes tired and flat, lower lids not raised, a faint crease between her brows. Shoulders slightly raised "
    "and stiff. Hands below the frame.",
    "Tight close-up at her eye level, slightly off-centre: the top edge of the frame cuts through her hair and no ceiling is "
    "visible; her face about 60% of the frame height; both ears visible, each earbud seated inside the ear opening. 85mm lens "
    "feel, focus on her eyes; behind her only the cream wall and the ink painting, soft and blurred.",
    "The earbuds, one in each of her ears: " + 이어폰,
    "She is the only person in the photo. Not a passport-style portrait. " + NOT_TAIL,
)

글["C3b"] = 판(
    "[IMG1] Image 1 - Seojin's character reference, for her ear, jawline, skin, hair, knit and the earbud in her ear; she wears "
    "no earrings. [IMG2] Image 2 - an earlier wide shot at this same holiday table, for the light and the colours of the room "
    "only; ignore everything else in it. [IMG3] Image 3 - the earbuds' shape and finish only.",
    "밥상_서진쪽",
    사람("서진", 1),
    "The split second before the tap. Seen from her left side, her face turned toward the left edge of the frame and mostly "
    "out of focus, Seojin holds her left index fingertip a few millimetres above the centre of the round outer face of the "
    "earbud in her left ear - not on her earlobe - about to press it once; her other fingers curl loosely; a few fine loose "
    "hairs lie beside her ear.",
    "Ear macro at ear height from her left side: her left ear and the earbud in it at the centre of the frame, her index "
    "fingertip just above it; her jawline and her low ponytail fall into soft, shallow focus (100mm macro lens at f/2.8, "
    "focused at 0.3 m). The room behind is only a warm, bright blur.",
    "The earbud in her left ear: " + 이어폰,
    "She is the only person in the photo. " + NOT_TAIL,
)

글["C4"] = 판(
    "[IMG1] Image 1 - Seojin: face, styling, hair, knit, earbuds. [IMG2] Image 2 - Eunjeong: face and hair. [IMG3] Image 3 - "
    "the grandmother's hand. [IMG4] Image 4 - an earlier draft: keep its "
    "composition, seating and table layout only. [IMG5] Image 5 - the charging case. [IMG6] Image 6 - "
    "the dumplings.",
    "밥상_서진쪽",
    사람("서진", 1) + " " + 사람("은정") + " " + 할머니()
    + " At the bottom of the frame, backs to the camera and faces unseen: Junho at the right of the frame (" + P["준호"]["옷"].rstrip(".")
    + ") and Minjae at the left of the frame (" + P["민재"]["옷"].rstrip(".") + ").",
    "Seojin, at the centre facing the camera, lifts a dumpling in her chopsticks to her lips, eyelids starting to close. "
    "Eunjeong, at the left of the frame, leans toward her mid-sentence, one hand raised. "
    "The grandmother's hand rests at the right edge of the frame. Minjae's blurred hand taps his own chest; Junho's points with "
    "chopsticks.",
    "Medium-wide at eye level; only Seojin and Eunjeong in focus (50mm lens at f/2.0, focused at 2 m).",
    "In Seojin's ears: " + 이어폰 + " On the table just beside Seojin's rice bowl, small and easy to miss: " + 케이스
    + " By the grandmother's hand: " + 만두,
    "Only these five people appear - no one else. " + ROOM_NOT + " " + NOT_TAIL,
)

글["C5"] = 판(
    ROOT + " [IMG3] Image 3 - the grandmother's hand, ring and sleeve. [IMG4] Image 4 - the wide shot here: room, "
    "dishes, light, clothes; ignore its faces and framing. [IMG5] Image 5 - the "
    "charging case. [IMG6] Image 6 - the dumplings.",
    "밥상_서진쪽",
    사람("서진", 1) + " " + 할머니()
    + " In the soft background Eunjeong (" + P["은정"]["옷"].rstrip(".") + ") is still talking, a blur with no clear face; a "
    "man's blurred shoulder shows at the left edge.",
    "The instant before the grandmother's tap. Seojin's face is in three-quarter view, turned toward the left edge of the "
    "frame; her left cheek, ear and shoulder toward the camera. Eyes closed, a small content smile as she chews."
    " The grandmother's hand and lilac cuff rest on the table edge just beside her left arm, coming in from the right "
    "edge of the frame, fingertips lifting toward her shoulder.",
    "Medium close-up at eye level from the grandmother's side: Seojin's face and her left shoulder fill most of the frame; "
    "the dumpling plate at the lower right; at the right edge the grandmother's hand and sleeve, and above them a soft, "
    "out-of-focus slice of her profile leaning in. 65mm lens feel, focus on Seojin's eyes.",
    "In both ears: " + 이어폰 + " Beside her rice bowl, small: " + 케이스 + " At the lower right of the frame: " + 만두,
    "Only Seojin and the grandmother's hand are sharp. No extra moles on Seojin's face. "
    + ROOM_NOT + " " + NOT_TAIL,
)

글["C6"] = 판(
    ROOT + " [IMG3] Image 3 - " + ROOM_REF_SOLO
    + " [IMG4] Image 4 - the earbuds' shape and finish only.",
    "밥상_서진쪽",
    사람("서진", 1),
    "The instant before she answers her grandmother. In the near foreground at the right edge of the frame, the soft, "
    "out-of-focus lilac-cardigan shoulder of her grandmother. Seojin's face is turned toward that right edge, her eyes on "
    "her grandmother; her right ear, on the left side of the frame, still holds its earbud. She looks 28, fresh and youthful. "
    "A warm, real smile crinkles the corners of her eyes; her lips are just parting to speak. Her left hand, on the right side "
    "of the frame, has just come away from her left ear and is still close to it, below the earlobe, loosely pinching "
    "the earbud she took out between her thumb and index fingertip - a natural, unposed hand, not showing the earbud off.",
    "Close-up at her eye level, nearly frontal: her head and the top of her shoulders fill the frame, her face about 55% of the "
    "frame height; behind her the blurred table and a relative's shoulder, not an empty room; her left hand with the earbud "
    "beside her jaw on the right side of the frame. The window light reaches her face from the left edge of the frame: the side of her face nearer the left edge "
    "is bright and the side nearer the right edge falls into soft shadow. 85mm lens feel, focus on her eyes; the room behind is "
    "a soft warm blur.",
    "One earbud in her right ear, on the left side of the frame; the other between the fingertips of her left hand, on the "
    "right side of the frame, its soft ear tip visible - the same earbud, same colour and silver ring: " + 이어폰,
    "Only Seojin is sharp; the grandmother is just a blurred shoulder. " + NOT_TAIL,
)

글["C6b"] = 판(
    "[IMG1] Image 1 - Seojin's character reference, for her ear, jawline, skin, hair, knit and the earbud; she wears no "
    "earrings. [IMG2] Image 2 - an earlier wide shot at this same holiday table, for the light and the colours of the room "
    "only; ignore everything else in it. [IMG3] Image 3 - the earbuds' shape and finish only.",
    "밥상_서진쪽",
    사람("서진", 1),
    "The split second before the earbud goes back in - the mirror of the earlier tap shot. Seen from her left side, her face "
    "turned toward the left edge of the frame and mostly out of focus, Seojin holds the earbud between her left thumb and "
    "index fingertip just in front of her left ear opening, which is empty, about to press it in; a few fine loose hairs lie beside her "
    "ear; the corner of her mouth, soft in the blur, is lifted in a small smile.",
    "Ear macro at ear height from her left side, the same framing as the earlier tap shot: her left ear, empty, at the centre "
    "of the frame, the earbud in her fingertips just in front of it; her jawline and her low ponytail fall into soft, shallow "
    "focus (100mm macro lens at f/2.8, focused at 0.3 m). The room behind is only a warm, bright blur.",
    "The earbud between her fingertips, its soft ear tip toward her ear: " + 이어폰,
    "She is the only person in the photo. " + NOT_TAIL,
)

글["C7"] = 판(
    "[IMG1] Image 1 - Seojin's character reference (face, hair, knit). [IMG2] Image 2 - Eunjeong's face reference, for her "
    "face and hair only; her clothes come only from the text below. [IMG3] Image 3 - the wide shot of this "
    "table: the blurred background repeats its room, dishes, light, clothes and seating, seen from table height; ignore its "
    "faces. "
    "[IMG4] Image 4 - the charging case's shape and finish only. [IMG5] Image 5 - the dumplings and plate only.",
    "식탁접사",
    사람("서진", 1) + " " + 사람("은정")
    + " Both sit behind the dishes, soft and out of focus but recognisable.",
    "The last calm beat. In the soft background at the centre of the frame, Seojin, eyes closed, chews slowly with a small "
    "content smile, chopsticks resting in her hand. Eunjeong, also soft, at the left of the frame, leans toward her, toward "
    "the right of the frame, mid-sentence, one hand raised at chest height. In the sharp foreground, at Seojin's place, the "
    "small closed charging case sits alone on the bare walnut, the only sharp object, about the size of a hen's egg; her steel "
    "rice bowl stands further toward the right edge of the frame, soft and partly cut off by the right edge of the frame.",
    "Low macro: the lens sits at the height of the tabletop, about 40 cm from the case, looking across the table. The small "
    "closed charging case sits alone in the lower third of the frame, at the centre, tack sharp, the steel bowl soft at the "
    "right edge; behind it, soft and blurred, Seojin at the centre and Eunjeong at the left of the frame - the "
    "same arrangement as the wide shot, seen from table height, very soft (85mm lens at f/1.4, focused at 0.5 m). Above their heads the "
    "top of the frame is a calm, empty blur of the cream wall.",
    "The closed charging case on the table: " + 케이스 + " Further back on the table, soft: " + 만두,
    "Only these two people appear - no one else, no other faces. Apart from the tiny debossed circle on the lid, no text, "
    "letters, logos or watermark anywhere. Indoors: the air is clear, no drifting specks.",
)

for 컷, t in 글.items():
    (out / f"{컷}.txt").write_bytes(t.encode("utf-8"))
    print(f"{컷}\t{len(t.rstrip())}")

차례 = {
    "굽는차례": ["C4", "C2", "C7"],
    "컷": {
        "C1": ["ref/인물_서진_뿌리.png", "ref/인물_서진.jpg", "정지/C4.png", "ref/소품_이어폰.png", "ref/소품_만두.png"],
        "C2": ["ref/인물_준호.jpg", "ref/인물_민재.jpg", "ref/소품_만두.png"],
        "C3": ["ref/인물_서진_뿌리.png", "ref/인물_서진.jpg", "정지/C4.png", "ref/소품_이어폰.png"],
        "C3b": ["ref/인물_서진_뿌리.png", "정지/C4.png", "ref/소품_이어폰.png"],
        "C4": ["ref/인물_서진_뿌리.png", "ref/인물_은정.jpg", "ref/인물_할머니손.png", "ref/장면_밥상_서진쪽_초판.png", "ref/소품_케이스.png", "ref/소품_만두.png"],
        "C5": ["ref/인물_서진_뿌리.png", "ref/인물_서진.jpg", "ref/인물_할머니손.png", "정지/C4.png", "ref/소품_케이스.png", "ref/소품_만두.png"],
        "C6": ["ref/인물_서진_뿌리.png", "ref/인물_서진.jpg", "정지/C4.png", "ref/소품_이어폰.png"],
        "C6b": ["ref/인물_서진_뿌리.png", "정지/C4.png", "ref/소품_이어폰.png"],
        "C7": ["ref/인물_서진_뿌리.png", "ref/인물_은정.jpg", "정지/C4.png", "ref/소품_케이스.png", "ref/소품_만두.png"],
    },
    "메모": (
        "먼저 _ref_할머니손.txt · _ref_만두.txt로 ref/인물_할머니손.png · ref/소품_만두.png를 굽는다(C4 · C5 · C1 · C2 · C7이 쓴다). "
        "굽는차례는 장면마다 먼저 구울 넓은 컷이다 — 밥상_서진쪽은 C4, 밥상_맞은편은 C2, 식탁접사는 C7. "
        "C4와 C2는 서로 기대지 않아 함께 구워도 된다. C4를 고른 뒤 C1 · C3 · C3b · C5 · C6 · C7을 굽는다. "
        "정지/C4.png는 밥상_서진쪽의 장면 기준 그림이자 첫 컷 승인 그림이라 한 번만 넣는다(ref/장면_밥상_서진쪽.png로 옮겨 두면 그 경로로 바꿔도 같은 그림이다). "
        "C7은 장면(식탁접사)의 첫 컷이지만 구도가 C4의 짜임을 식탁 높이에서 다시 잡는 컷이라 정지/C4.png를 뒤 흐림 · 자리 참고로 넣는다. "
        "앞 컷 그림은 얼굴 참고로 쓰지 않는다(지시문 REFS에 ignore the faces). "
        "C4의 준호 · 민재는 뒷어깨와 손만 나와 얼굴 기준 그림을 넣지 않았다. C1의 은정은 얼굴이 화면 밖이라 얼굴 기준 그림을 넣지 않았다."
    ),
}
(out / "_참고차례.json").write_bytes((json.dumps(차례, ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
print("_참고차례.json 씀")
