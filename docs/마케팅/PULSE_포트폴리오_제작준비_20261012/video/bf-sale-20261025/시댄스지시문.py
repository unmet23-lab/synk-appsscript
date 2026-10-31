# 시즌 3 블프 세일 「힘껏」 15초 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31).
#   python -X utf8 시댄스지시문.py   → git 밖 콘티/bf-sale/시댄스/C##.png(시작 그림) · 지시문/영상_시댄스웹.json(웹꾸러미.py가 읽는 꼴 — 11번과 같음)
# 영상으로 뽑는 컷은 사람 · 장면 컷 아홉(① ③ ④ ⑥ ⑦ ⑧ ⑩ ⑫ ⑬아래)뿐이다. ② 글자 카드 · ⑨ ⑪ 제품 칸 · ⑬ 위 끝 카드 · ① 전광판 숫자 ·
#   ⑥ 간판 글자 · ⑧ 떠 지나가는 제품 카드는 모션그래픽(01 3절 「주력 경로」 D)이라 판이 없고, ⑤는 편집 휙(0.12초)이다.
# 시작 그림은 확정 정지컷의 글자 없는 사진 판(C##.png) — 합성 판(C##_합성.png)은 전광판 · 간판 · 제품 카드 · 끝 카드 글자가 얹혀 있어
#   영상에서 글자가 무너지므로 넣지 않는다(글자는 후반에서 그 자리에 다시 얹음). ⑬만 정지컷이 끝 카드 자리를 남색으로 비우고 550px 내린 판이라,
#   같은 받은 판(C13t)을 내리기 전 9:16 그대로 넣는다(빈 남색 띠가 있으면 시댄스가 그 띠를 장면으로 바꾸거나 휙을 망칠 수 있다) — 편집에서 영상을
#   550px 내려 끝 카드 밑에 둔다(정지컷 C13.png와 같은 자리, 이미지콘티_정지컷.py와 같은 자르기).
# 카메라는 02 2절 「카메라 줄」(원본 0.04초 실측 — 01 1절 표)의 숫자 그대로이고, 시작 그림 때문에 다른 둘(⑫ 휙 · ⑬ 그림)만 판 「설명」에 까닭을 적었다.
#   ⑫는 시작 그림이 휙이 끝난 자리라 화면 안에서 휘둘러 들어오면 손 · 핸들이 오른쪽 밖으로 밀린다(11-01 Fable P1) — 주판은 화면 고정 판(s3-12b)이고
#   들어오는 휙은 ⑤처럼 편집 이음, 화면 안 휙(6%) 판 s3-12는 대안.
# 초는 그 컷 첫 프레임 기준(원본 초 − 컷 시작). 길이 = max(4, ⌈쓰는 초 + 0.8⌉) — 모두 4초. 두 샷 묶음은 없다(⑫ ⑬ 모두 휙이 있다).
#   말은 모두 화면 밖 내레이션이라 소리는 끔 — 입은 원본처럼 놀람 · 웃음 · 외침 모양만(입 맞춤 없음).
import json
import math
import os
import shutil
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
B = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale")
IMG = os.path.join(B, "시댄스")
W, H = 1080, 1920

공통 = {
    "장르": "a premium, high-energy Korean sportswear commercial set in a neon spin studio",
    "누구": {
        "CHAEWON": "the same young Korean woman (Chaewon) as in the first frame, in every frame — a short black pixie cut with light bangs, "
                   "faint freckles, an athletic build; a fitted orange-red half-zip long-sleeve training top, black high-waisted leggings, white "
                   "sneakers; a thin black headset with a small boom mic in front of her mouth, worn exactly as in the first frame. She is the "
                   "only person in the studio. She never speaks.",
        "STUDIO": "the dark navy-violet spin studio of the first frame — rows of empty white spin bikes along both sides, thin vertical light "
                  "strips on the walls, a large blank dark screen on the back wall that stays plain and dark, showing nothing.",
    },
    "보기": "LOOK: a premium, high-energy sportswear commercial — crisp cinema camera, deep navy-violet darkness with saturated orange-red, "
            "amber and pink neon, glossy reflections, natural skin texture, fine film grain, natural motion blur. Keep the first frame's light, "
            "colors and white balance to the very end; the light changes only where ACTION says so. Never add a person — Chaewon is the only "
            "person, and every other bike stays empty. Screens and signs stay plain and blank. No new text, letters, numbers, logos or brand "
            "marks anywhere.",
    "소리": "SOUND: silent clip — no dialogue, no narration, no music.",
}

# 시작 그림: (시댄스/ 이름, 원천, 내리기 전 받은 판에서 다시 자르기?)
SRC = {
    "C01.png": "정지컷/C01.png", "C03.png": "정지컷/C03.png", "C04.png": "정지컷/C04.png", "C06.png": "정지컷/C06.png",
    "C07.png": "정지컷/C07.png", "C08.png": "정지컷/C08.png", "C10.png": "정지컷/C10.png", "C12.png": "정지컷/C12.png",
    "C13.png": "받음/C13t_181533.jpg",   # 정지컷 C13.png의 원천(내리기 550px 전) — 이미지콘티_정지컷.py fit()과 같은 9:16 자르기
}

DOLLY_ZOOM = ("Dolly zoom from the first frame, at an even pace: the camera physically moves forward toward her while zooming out at the "
              "same time, so Chaewon and her bike keep exactly the same size and place, while the back wall and the dark screen shrink and "
              "sink a little — by 0.72 s the screen is about 0.77 of its first size — and the side walls, the rows of bikes and the mat "
              "stretch outward and grow, so the room seems to open up wider and deeper around her. The same move continues at the same "
              "pace until about 1.2 s; then it eases off into a very slow, steady push and the room keeps its new wider look to the end. "
              "Smooth, no shake.")
ACT6 = ("Front wide of the dark spin studio: Chaewon rides in the center, both hands on the handlebar, pedaling hard, and cheers toward the "
        "camera — mouth wide open in a big joyful shout (silent, no words). At the near end of the orange-red mat runner, the rolled-up "
        "end lying at the bottom of the frame rolls toward the camera and out of the bottom edge, so by about 0.56 s the whole mat lies "
        "flat. The big dark screen on the back wall stays plain and blank.")
ACT12 = ("Side view in the studio: Chaewon rides her white spin bike facing right, hands on the handlebar, gaze lifted slightly; stacked "
         "orange shopping boxes stand behind her on the left, and a blurred white towel hangs on a handlebar in the near foreground at the "
         "lower left. At about 0.24 s she snaps her head forward and leans in over the handlebar, pedaling hard from about 0.32 s; at about "
         "0.56 s she lifts her face and bursts into an open-mouthed laugh, still pedaling.")

# (id, 컷, 쓰는 초, 그림, 누구, 동작, 카메라, 설명, 대안?)
PLATES = [
    ("s3-01", "1", 0.96, "C01.png", ["CHAEWON", "STUDIO"],
     "Front view straight down the middle of the dark spin studio: Chaewon rides the white spin bike in the center on the orange-red mat "
     "runner, pedaling at a brisk, steady rhythm and grinning at the camera. At about 0.8 s she lifts her right hand (on the left side of "
     "the picture) off the handlebar and throws it up beside her head in an energetic, open-palm come-on wave, still pedaling and smiling, "
     "lips apart in a grin; her other hand stays on the handlebar.",
     "The camera physically moves straight forward toward her at a slow, perfectly even pace from the first frame — by 0.96 s it is about "
     "6% closer, the walls, the dark screen and the rows of bikes all a little larger — and it keeps that same slow, even push to the end. "
     "Camera height stays exactly the same; no pan, no tilt, no shake.",
     "① 스튜디오 정면 와이드 — 웃으며 페달, 0.8초 오른손 「가자」 손짓 · 천천히 6% 다가감(전광판 카운트다운은 후반)", False),
    ("s3-03", "3", 0.76, "C03.png", [],
     "A low view from the glossy floor of the dark violet studio — no people. In the upper-left corner, the white edge of a spin bike's "
     "wheel guard; along the far wall, a glowing magenta line; at the back on the right, a rolled-up orange-red exercise mat lies on the "
     "floor. From the first frame big glowing orange-and-pink light rings swirl fast in circles just above the floor. At about 0.16 s the "
     "rings fade out as a big rolled-up orange-red mat shoots in from the lower-left edge, right in front of the lens, and rolls fast across "
     "the frame to the right, unrolling flat as it goes; at about 0.32 s the roll fills the frame for an instant as a dark orange blur, and "
     "by about 0.4 s the mat lies fully flat across the whole floor in front of the camera, its far edge running diagonally toward the back "
     "wall. The small rolled mat at the back on the right stays where it is. No person and no hand ever enters the frame. Then everything "
     "is still.",
     "The camera lies on the floor: the frame stays exactly where it is from the first frame — the wheel edge, the floor and the glowing "
     "line on the wall never shift; no push-in, no zoom, no pan, no shake — except that from about 0.4 s to 0.76 s it tilts up very "
     "slightly, so the glowing line on the far wall sinks by about 2% of the frame height, and then it holds.",
     "③ 바닥 낮은 카메라 — 빛 고리(0–0.16초) → 큰 두루마리가 왼쪽 아래 가장자리에서 렌즈 바로 앞으로 들어와 오른쪽으로 굴러(원본 그대로) 0.32초 화면을 "
     "채우고 0.4초 다 펼쳐짐 · 거의 그대로, 끝 0.36초 아주 작은 틸트 업. 뒤 오른쪽 작은 두루마리는 그 자리(멀리서 굴러오게 하면 0.16초 만에 못 옴 — 11-01 Fable P2)", False),
    ("s3-04", "4", 0.60, "C04.png", ["CHAEWON"],
     "A medium close-up of Chaewon's face in soft lavender studio light, a blurred spin bike behind her on the right: she stares up and to "
     "the right — toward the upper-right corner of the picture, exactly where her eyes point in the first frame — eyes wide, mouth open in a "
     "round \"O\" of astonishment; her head does not turn. At about 0.1 s her eyebrows jump a little higher and her eyes widen even more; "
     "then she freezes in that astonished look — the \"O\" stays still, she does not talk.",
     "Handheld: almost still for the first 0.2 s, with only a slight tremble in place. From 0.2 s the camera starts panning to the left and "
     "speeds up, and from 0.36 s it whips away down to the left — so fast that she streaks out through the upper-right corner of the frame "
     "by 0.52 s in horizontal motion blur; the whip carries the camera onto a blurred stretch of the violet studio wall, where it comes to "
     "rest and holds to the end.",
     "④ 놀란 얼굴(O) 미디엄 클로즈업 — 시작 그림이 이미 위 오른쪽을 보는 O라(원본 3.04~3.36도 위 오른쪽) 고개는 그대로, 0.1초 눈썹 · 눈만 더 · "
     "0.2초 왼쪽 팬 → 0.36초 왼쪽 아래로 휙(0.52초 오른쪽 위로 빠짐)", False),
    ("s3-06", "6", 0.72, "C06.png", ["CHAEWON", "STUDIO"], ACT6, DOLLY_ZOOM,
     "⑥ 정면 와이드 돌리 줌(채원 크기 그대로 · 뒷벽 화면 0.77배, 1.2초부터 느린 밀기로 풀림) · 외침(소리 없음) · 매트 두루마리가 카메라 쪽으로 굴러 다 펼쳐짐(0.56초) — "
     "간판 글자는 후반. 시험 판정: 첫 1초에 채원 크기 ±5% · 뒷벽 화면이 15% 넘게 줄면 통과, 채원만 커지면(그냥 밀기) 06b, 06b도 같으면 ①과 같은 느린 밀기 판으로 "
     "내고 결정 표에 「돌리 줌 못 함」 한 줄", False),
    ("s3-07", "7", 0.68, "C07.png", ["CHAEWON"],
     "Seen from behind in the dark studio, Chaewon pedals hard on her white spin bike down the glowing orange runner toward the tall "
     "orange-red neon arch — three nested rounded-rectangle frames of light — with rows of empty bikes along both edges. At about 0.4 s the "
     "inside of the arch flares into pure white light that spreads outward until, by about 0.6 s, the middle of the frame is almost all "
     "glowing white around her dark silhouette.",
     "The camera physically moves forward behind her toward the arch, speeding up — fastest between about 0.24 s and 0.48 s, easing very "
     "slightly in the last 0.1 s: the nearest bikes at both edges slide past the camera and out of the frame by 0.24 s while the rows "
     "further ahead stay along the edges, her back grows larger, and the arch grows until "
     "its glow fills most of the frame. The horizon stays perfectly level; no tilt, no shake. The forward move continues to the end.",
     "⑦ 뒷모습 — 빛 아치로 빨라지며 밀고 들어감(양 끝 자전거 0.24초에 빠짐) · 0.4초 아치 안이 하얗게 터짐(⑧로 이음)", False),
    ("s3-08", "8", 1.00, "C08.png", ["CHAEWON"],
     "Inside a tunnel of glowing orange and pink neon frames whose floor glows bright pink-white, Chaewon, seen from the side, pedals hard "
     "on her white spin bike facing right, leaning over the handlebar with a focused face, mouth closed; the neon frames and the light "
     "streaks on the floor rush past behind her from right to left the whole time, as if she is racing through the tunnel.",
     "Side tracking shot, camera perfectly level — the bike, her body and the neon frames stay upright. For the first 0.3 s it is almost "
     "still. From 0.3 s to 0.9 s the camera physically moves back away from her at an even pace while sliding a little to the right, so she "
     "shrinks to about 0.82 of her size and drifts left from just right of center to just left of center (about 15% of the frame width); "
     "it eases to a stop by 1.0 s and then holds that framing to the end while the tunnel keeps rushing past. No shake.",
     "⑧ 빛 터널 옆모습 질주 — 0.3–0.9초 고르게 0.82배로 물러나며 오른쪽으로 비켜 감(채원 오른쪽 가운데 → 왼쪽 가운데) · 터널은 계속 흐름(떠 지나가는 제품 카드는 후반)", False),
    ("s3-10", "10", 0.92, "C10.png", ["CHAEWON"],
     "A close-up of Chaewon against bright red neon zigzag lines: mouth open in a round \"O\" of surprise, eyes wide, gaze exactly as in "
     "the first frame. She holds the astonished \"O\" — no talking — and at about 0.76 s it melts into a big, toothy smile.",
     "Handheld close-up: from the first frame to 0.52 s the camera drifts sideways to the left at an even pace and eases to a stop, so her "
     "face slides from the center to the right third of the frame (about 15% of the frame width), staying the same size and fully inside "
     "the frame; then it holds there with only a slight handheld tremble in place. Behind her the red neon lines keep streaming to the left "
     "on their own — fast at first, slower after 0.5 s.",
     "⑩ 놀람 O → 0.76초 웃음 — 카메라는 원본 방향 그대로 왼쪽으로(원본 25% · 얼굴 왼쪽 1/4 → 가운데), 확정 그림의 얼굴이 이미 가운데(0.50)라 "
     "얼굴 0.50 → 오른쪽 1/3(약 15%, 프레임 안) · 0.52초 멈춤 · 뒤 네온은 거꾸로 왼쪽으로 흘러 원본의 엇갈리는 움직임 그대로(11-01 Fable P2)", False),
    ("s3-12b", "12", 0.84, "C12.png", ["CHAEWON"], ACT12,
     "The frame stays exactly where it is from the first frame to the last — the boxes, the wall and the light strips never shift; no pan, "
     "no push-in, no zoom, no shake; only she moves.",
     "⑫ 휘둘러 들어와 멈춘 옆모습 — 화면 고정 판(0.24초 고개 휙 · 0.56초 위를 보며 웃음), 들어오는 휙(원본 11.72~12.08)은 ⑤처럼 편집 이음 0.12~0.2초. "
     "시작 그림이 휙이 끝난 자리라 화면 안에서 휘둘러 들어오게 하면 손 · 핸들이 오른쪽 밖으로 밀리고 끝 자리 글과 부딪혀(11-01 Fable P1) 이 판이 주판이다. "
     "끝 프레임만 받는 판(12c)은 웹 카드가 그 모드를 받는지 몰라 만들지 않았다", False),
    ("s3-13", "13", 2.44, "C13.png", ["CHAEWON", "STUDIO"],
     "In the dark navy spin studio, Chaewon sits on her white spin bike on the right, hands resting on the handlebar, turned toward the "
     "camera and smiling warmly into the lens. From about 1.0 s to 1.6 s she clenches one fist and pumps it once or twice at chest height, "
     "delighted, then keeps grinning.",
     "From the first frame to 1.8 s the frame stays exactly where it is — the room, the bikes and the screen never shift; no push-in, no "
     "zoom, no shake. At 1.8 s the camera whips fast to the right, accelerating, so she and the bikes streak out to the left in horizontal "
     "motion blur; at about 2.24 s it stops on an empty stretch of the dark navy studio wall where one thin vertical light strip glows — no "
     "bikes, no objects, nothing written on it — and holds there to the end.",
     "⑬ 아래 — 카메라 보고 웃다 1.0–1.6초 주먹 쥐며 좋아함 · 1.8초까지 그 자리 → 오른쪽으로 휙 · 2.24초 빈 벽. 시작 그림은 정지컷 C13의 원천 C13t를 "
     "내리기 전 9:16 그대로(편집에서 550px 내려 끝 카드 밑에) — 6초 판 ⑬(고정 1.0초 → 휙 0.4초)도 이 판의 0.8초부터 잘라 쓴다", False),
    # 대안 — 첫 판이 어긋날 때만(굽기 시트 「대안 판」)
    ("s3-06b", "6", 0.72, "C06.png", ["CHAEWON", "STUDIO"], ACT6,
     "A fast, classic dolly zoom (the \"Vertigo\" effect) in the first second: Chaewon stays exactly the same size in the middle while the "
     "room stretches away behind her — by about 0.7 s the back wall and the screen have shrunk to about three-quarters of their size and the "
     "rows of bikes on both sides have swung outward and grown; then the move eases into a slow, steady push to the end. Smooth, no shake.",
     "⑥ 대안 — 돌리 줌이 그냥 다가감 · 줌으로만 나올 때, 카메라 줄을 「기법 이름 + 끝 모습」 꼴로", True),
    ("s3-12", "12", 0.84, "C12.png", ["CHAEWON"], ACT12,
     "A whip pan that lands on her: from the first frame the camera swings fast to the left, so the whole picture — boxes, light strips, "
     "the blurred towel in front and Chaewon — slides to the right by about 6% of the frame width in horizontal motion blur, braking hard "
     "and stopping dead at 0.36 s with her at the right third of the frame, her hands still inside the right edge. From 0.36 s the frame "
     "stays exactly where it is to the end — no push-in, no zoom, no drift, no shake; only she moves.",
     "⑫ 대안 — 화면 안 휙을 보고 싶을 때만: 첫 장부터 왼쪽으로 휘둘러 6% 미끄러지며 0.36초에 멈춤(채원 오른쪽 1/3 · 손은 오른쪽 끝 안 — 핸들 그립은 "
     "가장자리를 넘을 수 있어 받은 뒤 확인), 판 머리에서 0.7초쯤 머무는 동안은 버리고 미끄러짐이 시작되는 장부터 쓴다", True),
]


def fit(im):   # 이미지콘티_정지컷.py fit()과 같음 — 가운데를 9:16으로 잘라 1080×1920
    r = im.width / im.height
    if abs(r - W / H) > 0.002:
        if r > W / H:
            nw = int(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
        else:
            nh = int(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
    return im.resize((W, H), Image.LANCZOS)


def images():
    os.makedirs(IMG, exist_ok=True)
    for name, src in SRC.items():
        s, d = os.path.join(B, src), os.path.join(IMG, name)
        if src.startswith("정지컷/"):
            shutil.copy2(s, d)
        else:
            fit(Image.open(s).convert("RGB")).save(d)


def build():
    판 = []
    for pid, cut, used, pic, who, act, cam, desc, alt in PLATES:
        p = {"id": pid, "컷": [cut], "길이": max(4, math.ceil(used + 0.8))}
        if alt:
            p["대안"] = True
        p["설명"] = desc
        p["샷"] = [{"그림": pic, "쓰는초": used, "누구": who, "동작": act, "카메라": cam}]
        판.append(p)
    return {
        "메모": "시즌3 블프 세일 「힘껏」 15초 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-31, 생성기 ../시댄스지시문.py). 시작 그림은 확정 정지컷의 "
                "글자 없는 사진 판(git 밖 콘티/bf-sale/시댄스/에 모음 — ⑬은 내리기 전 원판, 생성기 머리말). 영상 컷은 ① ③ ④ ⑥ ⑦ ⑧ ⑩ ⑫ ⑬아래 아홉이고 "
                "② 글자 카드 · ⑨ ⑪ 제품 칸 · ⑬ 위 끝 카드 · 전광판 카운트다운 · 간판 글자 · ⑧ 제품 카드는 모션그래픽(후반). 카메라는 02 2절 「카메라 줄」 "
                "(원본 0.04초 실측) 숫자 그대로, 고정은 원본이 정말 그 자리인 ③ · ⑬ 휙 앞과, 들어오는 휙을 편집 이음으로 옮긴 ⑫ 주판(s3-12b — 시작 그림이 "
                "휙이 끝난 자리, 11-01 Fable P1)뿐. 11-01 Fable 검수(P1 2 · P2 5 · P3 4) 반영. 말은 모두 화면 밖 내레이션이라 소리 끔 · 입 맞춤 없음. "
                "6초 판은 15초 판 판에서 잘라 쓴다(새 판 없음). 꾸러미는 ../../../시댄스무제한/웹꾸러미.py.",
        "편": "s3",
        "이름": "시즌3 블프 세일 「힘껏」",
        "비율": "9:16",
        "그림": IMG.replace("\\", "/"),
        "공통": 공통,
        "판": 판,
    }


if __name__ == "__main__":
    images()
    spec = build()
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    main = [p for p in spec["판"] if not p.get("대안")]
    print(f"{out.name}: 판 {len(spec['판'])}(주판 {len(main)} · 대안 {len(spec['판']) - len(main)}) · 주판 {sum(p['길이'] for p in main)}초 · 그림 → {IMG}")
