# 8번 1 · 4번 거꾸로 얼굴 시작 그림 다시 굽기(2026-11-07, Claude — 최종 편집 전 점검).
# 받은 p8-01 · p8-04가 가운데 정면 · 평평한 빛(얼굴 좌우 밝기 차 0.10 · 0.01) · 민무늬 회청 바탕이었다 — 11-05 로맨스 「앵글이 맹해」와 같은 짜임
# (원본 1 · 4번은 어두운 공원에 한쪽 빛, 뒤가 흐린 땅 · 그네 틀이다). 얼굴 자리 · 자세 · 손 · 폰은 그대로 두고 빛과 뒤만 바꾼다.
# 바로 선 판(위에서 내려다본 얼굴 — 콘티 4절, 거꾸로 굽기는 닮음이 0.26~0.33에 머물렀다)을 Image 1로 GPT 2.5 편집 → 180° 돌려 시작 그림으로.
#   python -X utf8 다시_1107_그림.py [C01 C04]   → git 밖 콘티/p8/다시_1107/<컷>_r<n>.png(바로 선 판) · <컷>_r<n>_돌림.jpg(시작 그림, 1920×1080)
import os
import subprocess
import sys

import numpy as np
from PIL import Image

P8 = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8"
PACK = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_여섯편"
OUT = os.path.join(P8, "다시_1107")
REFS = [f"C:/SYNK-LoRA/validation/F05_soyeon/refs/{f}" for f in ("01_hero.jpg", "02_left90.jpg", "03_right90.jpg")]
REPO = "C:/Users/q1212/Documents/SYNK-appsscript"

KEEP = ("Image 1 is the photo to edit. Images 2, 3 and 4 show the same Korean woman's face for identity only (ignore their backgrounds and clothes). "
        "Keep from Image 1 exactly: the same woman and every detail of her face, the same pose, the same framing, the same size and position of her face, hair, shoulders, "
        "hands and phone in the frame, the same light-blue chambray shirt and plain canvas apron, and the same bored, blank expression with her eyes on the phone.\n\n"
        "Change only where she is, the light and what is behind her:\n")
SETTING = ("SETTING: she is NOT lying on the floor. She sits in a wooden café chair and has slumped far back, her head tipped back over the top of the chair's backrest, "
           "and the camera looks straight down at her face from above. Behind her head, far below and very out of focus, is the café floor — worn grey-brown wooden floorboards "
           "about a meter below her head, with the soft blurred leg of another chair near one corner; nothing behind her is sharp. ")
LIGHT = ("LIGHT: a dim, overcast October afternoon in a small café with all its lamps switched off. The only light is soft, cool daylight from a big window at the RIGHT side of the frame: "
         "it falls across her so the right side of her face is softly lit and the left side falls into a gentle shadow about two stops darker. No light from the front, no flash, "
         "no ring light, no beauty light, no glow. The floor far below is darker than her face, with one faint, blurred streak of window light across the boards. "
         "Overall moody, cool blue-grey, slightly underexposed — true-to-life cinematic commercial footage, natural skin texture with fine pores, not retouched.\n\n"
         "Horizontal 16:9 photograph. No text, letters, numbers or logos anywhere.")
PROMPTS = {
    "C01": KEEP + SETTING + "The dark, rounded top rail of her chair's wooden backrest crosses the frame under her shoulders, partly hidden by her shoulders and arms.\n" + LIGHT,
    "C04": KEEP + SETTING + "This is a close shot: her face fills the middle of the frame as in Image 1, her forearms and phone at the bottom edge; the floor shows only around her hair.\n" + LIGHT,
}
SRC = {"C01": os.path.join(PACK, "124_p8-01b", "1_시작.jpg"), "C04": os.path.join(PACK, "125_p8-04b", "1_시작.jpg")}

# 2차(v1 Fable 맹검 뒤) — ④ 7번 「9~11초 가운데 정면 · 대칭 배경 · 평평한 회색 빛 · 무표정, 엥글이 슬롭 · 맹해 그대로」: 원본 7번도 정면이라 구도는 두고
#   빛만 왼쪽 창빛 한 방향 · 뒤 그늘로. 끝 그림은 다시 구운 시작 그림을 빛 기준(Image 2)으로 넣어 두 장의 빛을 맞춘다.
#   ③ 20번 「끝 3초에 모델이 없다」: 19번 벽 포스터(창 옆)와 같은 벽 — 카운터 뒤 선반 왼쪽 벽, 창 모서리 가까이 — 에 같은 사진 액자를 건다(제목 덩이 오른쪽 끝 밖).
LIGHT7 = ("Change only the light: a dim, overcast late afternoon in the café with every lamp switched off. The only light is soft, cool daylight from a big window just off the LEFT edge "
          "of the frame: it falls on her from the left, so the left side of her face and her hands are softly lit and the right side of her face falls into gentle shadow; the counter, "
          "shelves, drinks fridge and espresso machine behind her sit about one stop darker than now, the right part of the room darkest. Moody, cool blue-grey, true-to-life cinematic "
          "commercial footage with fine natural grain, natural skin texture, not retouched. Horizontal 16:9, the same framing. No text, letters or logos anywhere.")
P7 = {
    "C07s": ("Image 1 is the photo to edit. Images 2, 3 and 4 show the same Korean woman's face for identity only. Keep from Image 1 exactly: the framing and camera, her pose "
             "(slumped far back in her chair, only her two hands holding the phone above her face and the tip of her chin showing at the bottom of the frame), her light-blue chambray shirt and "
             "canvas apron, and every object of the café in the same place.\n\n" + LIGHT7),
    "C07e": ("Image 1 is the photo to edit. Image 2 is the same café a second earlier — match its light exactly (same direction, darkness and colour). Images 3, 4 and 5 show the same Korean "
             "woman's face for identity only. Keep from Image 1 exactly: the framing and camera, the woman sitting upright at the counter holding her phone at chest height in both hands, "
             "her surprised look with slightly raised eyebrows, her chambray shirt and apron, and every object of the café in the same place.\n\n" + LIGHT7),
}
POSTER = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/F02/context.webp"
P20 = ("Image 1 is the photo to edit. Keep everything in Image 1 exactly as it is: the high camera angle and framing, the warm golden afternoon light and the lit pendant lamps, the café, "
       "the two customers at the round table, and the woman behind the counter. Add only one thing: a framed poster of Image 2 — exactly that photo, unchanged: a young woman laughing "
       "with a pink strawberry latte — hanging straight on the plain wall to the LEFT of the wooden shelves behind the counter, close to the window corner, near the top of the frame: "
       "a thin light-wood frame in portrait orientation, about one fifth of the frame height, lit by the same warm room light, a flat printed photo. "
       "No text, letters or logos anywhere. Horizontal 16:9, the same framing.")


# 3차(v3 Fable 2차 「기각」 뒤) — ⑧ 2 · 5번 「의자째 60도 넘게 뒤로 넘어간 자세 — 마네킹을 넘어뜨린 것처럼」(1 · 4번처럼 등받이 위로 머리만 젖힘),
#   ⑩ 5번 쇼핑백이 다리에서 반 화면 떨어져 떠 있고 얼굴이 턱선 단발(카드는 어깨 아래) → 걷는 사람 손에 들린 가방 · 카드와 같은 웃음 사진,
#   ⑥ 11번 「냉장고 안 액자」 → 유리문 바깥에 붙은 손바닥만 한 스티커, ③ 20번 포스터가 손톱만 함 → 화면 높이 1/3로.
F02 = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/F02"
P_V4 = {
    "C02n": ("Image 1 is the photo to edit. Images 2, 3 and 4 show the same Korean woman's face for identity only (ignore their backgrounds and clothes). Keep everything in Image 1 exactly as it is — "
             "the camera, the framing, the gray afternoon light with all lamps off, the empty café, every table and chair, the counter, the big windows and the quiet street outside with the small photo "
             "banner on the street lamp — and change only the woman's pose.\n\n"
             "POSE: she sits in the same wooden chair at the same place and size in the frame, the chair standing on all four legs on the floor. Her bottom has slid a little forward on the seat and her "
             "back rests against the backrest; only her head is tipped back over the top of the backrest so her face points up at the ceiling, and she holds her phone up above her face in both hands with "
             "her elbows bent, scrolling lazily — a bored, relaxed pose a real person can hold for minutes. Her upper body is not lying back at a steep angle, and the chair does not tip. Same light-blue "
             "chambray shirt, canvas apron and jeans.\n\nNo text, letters or logos anywhere. Horizontal 16:9, the same framing.",
             [os.path.join(PACK, "029_p8-02", "1_시작.jpg"), *REFS]),
    "C05n": ("Image 1 is the photo to edit. Image 2 is a photo of a young woman to print on the bag. Images 3, 4 and 5 show the café owner's face for identity only. Keep the camera, the framing, the gray "
             "afternoon light, the pavement and the fallen yellow ginkgo leaves, the café window and the walking legs in navy trousers and white sneakers exactly as in Image 1.\n\nChange only two things:\n"
             "1. The white paper shopping bag with thin rope handles is carried in the walker's trailing hand, right beside the walker's legs: its rope handles come down from the walker's hand at hip height "
             "(just above the top edge of the frame), and the bag hangs next to the walker's knee and shin, close to the leg, its front facing the camera. The front of the bag is exactly the photo in Image 2 — "
             "the young woman with shoulder-length light-brown hair and bangs, smiling, in a white T-shirt against a plain beige backdrop — printed flat and filling the bag's front.\n"
             "2. Through the window, slightly out of focus, the café owner sits in her wooden chair with all four chair legs on the floor, her back against the backrest and only her head tipped back over its "
             "top, holding her phone up above her face in both hands — a relaxed, natural pose; she is not lying back at a steep angle.\n\nNo text, letters or logos anywhere. Horizontal 16:9, the same framing.",
             [os.path.join(PACK, "031_p8-05", "1_시작.jpg"), os.path.join(F02, "exp-smile.webp"), *REFS]),
    "C11n": ("Image 1 is the photo to edit. Image 2 is a photo of a young woman. Keep the camera, the close framing, the cold white fridge light, the bottles of milk and juice on the shelves behind the "
             "glass, and the fridge's dark door frame at the right exactly as in Image 1.\n\nReplace the large framed picture with a photo sticker stuck on the OUTSIDE of the fridge's glass door: a die-cut "
             "sticker of the photo in Image 2 (her face and shoulders, smiling) with a thin white border and softly rounded corners, about the size of a hand — a little under half the frame height — pressed "
             "flat onto the glass a little left of the frame center, one corner very slightly lifted. The sticker sits in front of the glass: a soft streak of reflection runs diagonally across the glass and "
             "over the sticker, and the bottles behind the glass are seen through the glass all around the sticker, slightly blurred and cooler. It must read clearly as a sticker on the fridge door — not a "
             "frame, not a tablet, not a picture inside the fridge.\n\nNo text, letters or logos anywhere. Horizontal 16:9.",
             [os.path.join(PACK, "037_p8-11", "1_시작.jpg"), os.path.join(F02, "exp-smile.webp")]),
    "C20q": ("Image 1 is the photo to edit. Image 2 is the poster photo. Keep everything in Image 1 exactly as it is: the high camera angle and framing, the warm golden afternoon light and the lit pendant "
             "lamps, the window and the street, the two customers at the round table, the woman behind the counter, the counter, the shelves, the espresso machine and the drinks fridge.\n\n"
             "Change only the framed poster on the wall by the window corner: make it a LARGE poster — about one third of the frame height, portrait orientation, in a thin light-wood frame — hanging straight "
             "on the plain wall between the window corner and the shelves, near the top of the frame, showing exactly the photo in Image 2 (a young woman laughing with a pink strawberry latte), lit by the same "
             "warm room light, a flat printed photo. It does not cover the woman behind the counter, the pendant lamps or the shelves.\n\nNo text, letters or logos anywhere. Horizontal 16:9, the same framing.",
             [os.path.join(OUT, "C20p_pick.jpg"), POSTER]),
}


def bake4(cut):
    os.makedirs(OUT, exist_ok=True)
    n = 1
    while os.path.exists(os.path.join(OUT, f"{cut}_r{n}.png")):
        n += 1
    out = os.path.join(OUT, f"{cut}_r{n}.png")
    txt = os.path.join(OUT, f"{cut}_지시문.txt")
    prompt, refs = P_V4[cut]
    open(txt, "w", encoding="utf-8").write(prompt)
    subprocess.run(["node", os.path.join(REPO, "tools", "GPT콘티굽기.mjs"), txt, out, *refs, "--크기", "2048x1152"], check=True)
    im = Image.open(out).convert("RGB")
    w, h = im.size
    ch = round(w * 9 / 16)
    if ch <= h:
        im = im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    else:
        cw = round(h * 16 / 9)
        im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    im.resize((1920, 1080), Image.LANCZOS).save(out.replace(".png", "_1080.jpg"), quality=95)
    print(cut, out, (w, h))


def bake2(cut):
    os.makedirs(OUT, exist_ok=True)
    n = 1
    while os.path.exists(os.path.join(OUT, f"{cut}_r{n}.png")):
        n += 1
    out = os.path.join(OUT, f"{cut}_r{n}.png")
    txt = os.path.join(OUT, f"{cut}_지시문.txt")
    if cut == "C20p":
        refs = [os.path.join(PACK, "046_p8-20", "1_시작.jpg"), POSTER]
        open(txt, "w", encoding="utf-8").write(P20)
    elif cut == "C07s":
        refs = [os.path.join(PACK, "033_p8-07", "1_시작.jpg"), *REFS]
        open(txt, "w", encoding="utf-8").write(P7[cut])
    else:   # C07e — 빛 기준은 고른 C07s
        refs = [os.path.join(PACK, "033_p8-07", "2_끝.jpg"), os.path.join(OUT, "C07s_pick.png"), *REFS]
        open(txt, "w", encoding="utf-8").write(P7[cut])
    subprocess.run(["node", os.path.join(REPO, "tools", "GPT콘티굽기.mjs"), txt, out, *refs, "--크기", "2048x1152"], check=True)
    im = Image.open(out).convert("RGB")
    w, h = im.size
    ch = round(w * 9 / 16)
    if ch <= h:
        im = im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    else:
        cw = round(h * 16 / 9)
        im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    im.resize((1920, 1080), Image.LANCZOS).save(out.replace(".png", "_1080.jpg"), quality=95)
    print(cut, out, (w, h))


def bake(cut):
    os.makedirs(OUT, exist_ok=True)
    n = 1
    while os.path.exists(os.path.join(OUT, f"{cut}_r{n}.png")):
        n += 1
    out = os.path.join(OUT, f"{cut}_r{n}.png")
    txt = os.path.join(OUT, f"{cut}_지시문.txt")
    open(txt, "w", encoding="utf-8").write(PROMPTS[cut])
    subprocess.run(["node", os.path.join(REPO, "tools", "GPT콘티굽기.mjs"), txt, out, SRC[cut], *REFS, "--크기", "2048x1152"], check=True)
    im = Image.open(out).convert("RGB")
    w, h = im.size
    ch = round(w * 9 / 16)   # 구독 경로는 비율을 정확히 안 지킨다 — 가운데에서 16:9로 자르고 1920×1080
    if ch <= h:
        im = im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    else:
        cw = round(h * 16 / 9)
        im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    im = im.resize((1920, 1080), Image.LANCZOS).rotate(180)
    im.save(out.replace(".png", "_돌림.jpg"), quality=95)
    print(cut, out, (w, h))


if __name__ == "__main__":
    for c in sys.argv[1:] or ["C01", "C04"]:
        if c in P_V4:
            bake4(c)
        elif c in ("C07s", "C07e", "C20p"):
            bake2(c)
        else:
            bake(c)
