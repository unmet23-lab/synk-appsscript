# 리허설 장면 그림 지시문(10-29) → 작업 폴더 ego/jobs.json. Gemini Ultra 웹 나노바나나 2.1(4 Argon · 사고 수준 최고가), 대화마다 새로.
# 얼굴 · 사진 공통 문구는 한결 데이터셋 v2(`C:/SYNK-LoRA/validation/M06_hangyeol/shots_v2.json`, 10-23 Fable 통과)를 그대로 쓰고,
# 참조는 같은 넷(대표 · 왼 90° · 오른 90° · 전신). 캔은 무지 남색으로 그리게 하고 그 자리에 블렌더 렌더를 얹는다(시안_합성.py).
#   python -X utf8 장면그림_지시문.py
import json
import os

V = r"C:/SYNK-LoRA/validation/M06_hangyeol"
W = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029").replace("\\", "/")
base = json.load(open(f"{V}/shots_v2.json", encoding="utf-8"))
REFS = [f"{V}/refs/{n}" for n in base["참조"]]
FACE = base["공통_얼굴"].replace(
    "In about two thirds of the photos his lips are together or he smiles softly with his mouth closed; in the others he laughs with a big smile showing the upper teeth, his monolid eyes narrowing into thin crescents. ", "")
PHOTO = base["공통_사진"]

CAN = ("a plain matte navy-blue aluminum soda can of the standard 355 ml size (66 mm wide, 122 mm tall, regular not slim) "
       "with a plain silver lid — the can has no printing, no logo, no label and no text at all")
PLACE = ("an outdoor public basketball court in Seoul at 6:30 pm in early autumn: a chain-link fence, a hoop and the court floodlights "
         "that have just switched on stand far behind, all softly out of focus with round warm and cool bokeh")
SUN = ("The sun is low behind him on the right side of the picture: a warm golden rim on his hair, ear and shoulder, "
       "while his face is lit by soft, even, cool skylight from the front — no harsh shadows on the face.")
WEAR = "He wears a plain white crew-neck t-shirt with no print and navy basketball shorts; the t-shirt collar is a little damp with sweat."

SCENES = [  # 글 콘티 v2(10-29 Fable 콘티 검수 반영 — 라벨이 읽히는 캔은 S2 · S5뿐, S3 · S4는 캔 윗부분만)
    {"id": "S1", "ratio": "9:16", "face": True, "text":
     f"Vertical chest-up photo at {PLACE}. Right after a game he stands under the hoop, body turned about 20 degrees toward the left edge "
     "of the picture, face turned the same way, eyes looking slightly down and away from the camera. He is out of breath but his lips are "
     "closed — breathing hard through his nose, shoulders raised mid-breath. Beads of sweat on his forehead, temples and neck, and one "
     "clear drop of sweat hangs from the tip of his chin, about to fall. Both hands are down out of the picture. "
     f"{WEAR} {SUN} 50mm lens at his eye height, his head in the upper third of the picture, his shoulders filling the width. "
     "Tired, calm expression, no smile."},
    {"id": "S2", "ratio": "9:16", "face": False, "text":
     f"Vertical close-up product photo, no people and no hands: {CAN} stands on a weathered wooden bench beside {PLACE}. The camera "
     "looks down at the can from about 30 degrees above, close, so the can's top and upper half fill the middle of the picture and the "
     "lid sits in the upper third; the can has just been opened — its pull tab is lifted. Fine cold condensation droplets cover the can. "
     "The low sun, just above the horizon behind on the right side of the picture, puts a warm rim on the can's edge; the rest is cool "
     "blue dusk light. 100mm macro look, very shallow depth of field. No text anywhere."},
    {"id": "S3", "ratio": "9:16", "face": True, "text":
     f"Vertical close-up photo of his face at {PLACE}, seen from the front-left at 45 degrees (his face turned toward the left edge of "
     "the picture, his left eyebrow, both eyes, nose and jaw line clearly visible), framed from just below his chin to just above his "
     f"hair. He drinks from {CAN}: his head tilted back a little, eyes closed, the can tipped up to his lips at about 45 degrees. Only the "
     "top part of the can is in the picture — its silver rim and the navy upper part at his lips — and his left hand, the hand nearest "
     "the camera, wraps the rest of the can at the lower edge of the picture. The low sun just above the horizon behind his head on the "
     "right side of the picture: a warm golden rim along his hair, ear and jaw, his face in soft cool skylight. 85mm lens. "
     "A few beads of sweat on his forehead and temples."},
    # S3c(10-29 18:4x): S3 두 판 다 캔 몸통(라벨 자리)이 크게 보여 — 캔 바닥이 렌즈를 향하게(라벨이 안 보이는 각도). 바닥 띠 색만 손님 캔대로
    {"id": "S3c", "ratio": "9:16", "face": True, "text":
     f"Vertical close-up photo of his face at {PLACE}, seen almost from the front, his face turned only about 20 degrees toward the left "
     "edge of the picture, framed from just below his chin to just above his hair, both eyes, brows, nose and ears visible. He drinks "
     "from a standard 355 ml aluminum soda can: his head tilted back a little, eyes closed, and the can tipped up high toward the camera "
     "so its round silver bottom faces straight at the lens — we see the can almost end-on: its silver concave base and only a thin ring "
     "of the can's side around it, a deep ruby-red band, and no printing, text or logo is visible from this angle. His left hand holds "
     "the can from below, fingers around its lower end. The can covers only his mouth and chin, never his eyes or nose. The low sun just "
     "above the horizon behind his head on the right side of the picture: a warm golden rim along his hair and ear, his face in soft "
     "cool skylight. 85mm lens. A few beads of sweat on his forehead and temples."},
    # S3d(10-29 18:4x): S3c 첫 판이 캔을 통째로 빨갛게 · 검은 티로 그림(차림 문구를 빼먹음) — 차림과 캔 색을 못 박음
    {"id": "S3d", "ratio": "9:16", "face": True, "text":
     f"Vertical close-up photo of his face at {PLACE}, seen almost from the front, his face turned only about 20 degrees toward the left "
     "edge of the picture, framed from his collarbones to just above his hair, both eyes, brows, nose and ears visible. He drinks from a "
     "standard 355 ml aluminum soda can: his head tilted back a little, eyes closed, and the can tipped up high toward the camera so its "
     "round silver bottom faces straight at the lens — we see the can almost end-on: its silver concave base and only a thin ring of the "
     "can's side around it. The can's side is dark navy blue, with a deep ruby-red band only around its lowest part next to the silver "
     "base; no printing, text or logo is visible from this angle. His left hand holds the can from below, fingers around its lower end. "
     f"The can covers only his mouth and chin, never his eyes or nose. {WEAR} The low sun just above the horizon behind his head on the "
     "right side of the picture: a warm golden rim along his hair and ear, his face in soft cool skylight. 85mm lens. A few beads of "
     "sweat on his temples."},
    {"id": "S4", "ratio": "9:16", "face": True, "text":
     f"Vertical chest-up photo at {PLACE}. He faces the camera directly, a moment after drinking: his lips slightly parted at the end of "
     "an exhale, a calm, natural neutral face with relaxed brows, eyes open looking just past the camera, a few small beads of sweat on "
     f"his forehead. He holds {CAN} upright in his right hand low at the bottom edge of the picture, so only the can's top — its silver "
     f"rim and the navy upper part — shows above the frame's lower edge. {WEAR} {SUN} 50mm lens at his eye height, his head in the upper "
     "third of the picture."},
    {"id": "S5", "ratio": "9:16", "face": False, "text":
     f"Vertical product photo, no people and no hands: {CAN} stands alone on a weathered wooden bench beside {PLACE}. The camera is low, "
     "level with the middle of the can and about 60 cm away, the can's front facing the camera, centered horizontally; the can is small "
     "in the picture — its top at 29% and its bottom at 56% of the picture height. Above the can, the upper part of the picture is calm, "
     "dark blurred dusk sky and floodlight bokeh with nothing in it; below the can, the bench top and blurred court fill the lower part. "
     "Fine cold condensation droplets on the can. Warm low sun from behind on the left side of the picture puts a golden rim on the can's "
     "edge, a soft cool fill from the front. 85mm lens, shallow depth of field. No text anywhere."},
]

jobs = []
for s in SCENES:
    prompt = s["text"] + " " + (FACE + " " + PHOTO if s["face"] else
                                "Photorealistic photograph shot on a full-frame camera, natural textures, no text, logos or watermarks anywhere.")
    jobs.append({"id": s["id"], "ratio": s["ratio"], "refs": REFS if s["face"] else [], "prompt": prompt,
                 "out": f"{W}/장면그림/{s['id']}_g{{n}}.png"})
    assert len(prompt) < 4300, (s["id"], len(prompt))
os.makedirs(f"{W}/ego", exist_ok=True)
json.dump(jobs, open(f"{W}/ego/jobs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\n".join(f"{j['id']} {len(j['prompt'])}자 참조 {len(j['refs'])}" for j in jobs))
