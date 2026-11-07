# 4번 패션 필름 「결채」 최종 편집 — 다시 내는 판 꾸러미(2026-11-07, Claude). 드리미나 울트라로 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 다시_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p4다시_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p4-24s p4-24w … --받을곳 <받음> --계정 ultra [--실행]
#   (같은 id를 두 번 주면 두 벌 — 둘째는 <판>__2.mp4)
#
# p4-24(스튜디오 · 허리 위 · 유리 겹상이 왼쪽으로 빠짐)는 11-05 ~ 06에 코드 20114로 다섯 번 실패했다(지시문을 줄여도). 실패는 매번 약 150초 뒤 —
# 성공한 판이 끝나는 때와 같아 생성 뒤 검사에서 떨어지는 꼴로 보인다(추정). 까닭을 하나씩 좁힌다(실패는 차감 없음):
#   p4-24s  그림 크기 · 비율만 — 시작 그림을 1280×720(정확한 16:9)으로, 지시문은 11-05 원문 그대로
#   p4-24w  낱말만 — 그림 그대로, 몸 · 옷 · 자세 · 「reflection · woman · eyes closed」 없이 카메라 줄만
#   p4-24g  왼쪽 유리 겹상(또렷한 둘째 얼굴)만 — GPT 이미지 2.5로 겹상을 지운 그림 + 겹상 줄을 뺀 원문
#   p4-24f  표정 · 자세만 — 턱을 내리고 입술을 다문 그림(GPT 이미지 2.5) + 원문(「chin raised」만 뺌)
# 11-07 결과: p4-24s(크기만) 20114 · p4-24w(낱말만) 나옴 → 그림이 아니라 지시문 낱말이 걸린다(g · f는 낼 까닭이 없어 안 냄).
#   p4-24w는 4장마다 같은 장(겹친장.py 창 6/6, 움직임 1.0~1.6) · 다가감 0.71초에 8%(원본 2.2%) · 겹상이 1.5초에야 걷힘.
#
# 편집 전 점검(편집전점검.py · 겹친장.py · 원본 대조표, 02_콘티 8절)에서 걸려 다시 내는 판 — 모두 m2v(시작 그림을 참고 `2_참고1_시작.jpg`로, 4장 무늬를 피함):
#   p4-24m  위 낱말 원칙(몸 · 자세 · 사람 낱말 없음) + 「거의 서 있음 · 겹상은 반 초 안에 걷힘」
#   p4-17m  받은 판이 끝까지 눈을 감음(11-01 결정 「0.25초 뒤 눈을 뜸」을 안 따름) · 4장 무늬(움직임 0.7~1.0)
#   p4-21m  4장 무늬(움직임 5~8 — 가장 잘 보임) · 올려 찍는 큰 이동이 1.5~3.5초에야(원본 0.08~0.9초)
#   p4-20m  유리 겹상이 밀려드는 일이 2.5초에야 · 그 자리에 4장 무늬
#   p4-08m  빛이 1.25초에야 가장 밝고(L 43, 원본 0.42초 L 31) 3.5초에 걸쳐 가라앉음(원본 1.13초에 거의 검정)
#   p4-32m  시작 그림이 원본보다 세 배 어두워(L 3.7 대 11.4) 판 처음부터 거의 검정 — 그림을 원본 밝기로 고친 C32b(GPT 이미지 2.5)로
import json
import os
import shutil

from PIL import Image

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기")
OUT = os.path.join(DAY, "웹올리기_p4다시_1107")
P4 = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p4"
GOT = os.path.join(P4, "다시_1107", "고름")   # GPT로 고친 시작 그림 — 고른 판을 여기에 둔다

ORIG24 = open(os.path.join(SRC, "102_p4-24", "지시문.txt"), encoding="utf-8").read().replace("\r\n", "\n").strip()
HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and animals, faces, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a quiet, high-end Korean fashion campaign film, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
SILENT = "SOUND: silent clip — no dialogue, no narration, no music."

P24W = (HEAD +
        "Everything in the picture stays exactly as in the first frame and keeps still.\n"
        "CAMERA: no shake. From 0.08 s to 0.46 s the soft blur across the left of the frame turns a little and slides away out of the left edge, fast at first and slowing, "
        "so the picture behind it becomes clear and sharp; from 0.17 s to 0.54 s the camera pushes in about 2.2% at an even speed. Then it holds steady to the end.\n"
        "LOOK: the first frame's light and colour kept to the end. No new text or logos.\n" + SILENT)

P24G = (ORIG24
        .replace(" The soft blurred shape across the left of the frame is a reflection in a sheet of glass in front of the lens — not another person — and it is there in the first frame.", "")
        .replace("From 0.08 s to 0.46 s the blurred glass reflection turns about 7° clockwise and slides away out of the left side of the frame, fast at first and slowing, so that she becomes clear and sharp behind it; from 0.17 s to 0.54 s",
                 "From 0.17 s to 0.54 s")
        .replace(", and any doubled image of her comes only from glass in front of the lens", ""))

P24F = ORIG24.replace("eyes closed and chin raised, lips closed", "eyes closed, chin level, lips closed")


def orig(folder):
    return open(os.path.join(SRC, folder, "지시문.txt"), encoding="utf-8").read().replace("\r\n", "\n").strip()


def swap(text, old, new):
    assert old in text, f"원문에 없는 줄: {old[:60]}"
    return text.replace(old, new)


P24M = (HEAD +
        "Everything in the picture stays exactly as in the first frame and keeps still.\n"
        "CAMERA: no shake. In the first half second the soft blur across the left of the frame turns a little and slides away out of the left edge — quick at first, easing off — "
        "so that by about 0.5 s the picture behind it is clear and sharp, and the blur never comes back. The camera creeps in only very slightly, about 2% in all, "
        "and from about 0.6 s to the end the frame is completely still.\n"
        "LOOK: the first frame's light and colour kept to the end. No new text or logos.\n" + SILENT)

O17 = orig("095_p4-17")
P17M = swap(O17, "After about a quarter of a second she opens her eyes and looks up ahead into the wind — calm, lips closed, no smile — and keeps them open to the end; her face stays the same face.",
            "Her eyes are closed only at the very start: at about 0.25 s she opens them fully and from then on they stay clearly open to the end, her gaze level and straight ahead past the camera into the wind "
            "(not up at the sky) — calm, lips closed, no smile; her face stays the same face.")

O20 = orig("098_p4-20")
P20M = swap(O20, "From 0.33 s to 0.83 s, speeding up, the glass in front of the lens slides so its blurred image surges in from the lower right and spreads across her, until her sharp face has turned into a soft, doubled blur; it stays blurred to the end.",
            "The glass in front of the lens starts to slide at about 0.3 s: its blurred image surges in from the lower right, faster and faster, and by about 0.9 s it has spread across her so that her sharp face has turned into a soft, doubled blur; it stays blurred to the end.")

O21 = orig("099_p4-21")
P21N = swap(O21, "In one unbroken move from 0.08 s to 0.9 s the camera rises about 30.8% of the frame height",
            "Right from the first frame, in one unbroken move that is finished by about 1 s, the camera rises about 30.8% of the frame height")
# m2v에 끝 그림을 안 넣는 판 — 「@이미지 2 is the exact last frame」 문장을 빼고 끝 구도는 글로만(끝 그림을 참고로 넣은 m2v는 반투명 겹침이 날 수 있다, 현장노트)
P21M = swap(P21N, " @이미지 2 is the exact last frame: the camera arrives at exactly that framing at the very end.", "")

O08 = orig("090_p4-08")
P08M = swap(O08, "The light changes with the shot: from the first frame the dim red light swells a little to its brightest at about 0.42 s, then fades so that by about 1.2 s she and the doorway have sunk back into near-darkness, and it stays that dark to the end.",
            "The light changes with the shot, all within the first second: the dim, deep red light swells a little — brightest at about 0.4 s, and even then dim, never bright or pure red — "
            "then fades quickly, so that by about 1.1 s she and the doorway have sunk back into near-darkness; from then on it stays that dark to the end.")

O32 = orig("108_p4-32")

# ---------- 편집본 Fable 맹검 1차(11-07 「고치고 통과」) 꼭 고칠 것 — 시작 그림부터 다시(GPT 이미지 2.5, git 밖 콘티/p4/다시_1107/고름/), 모두 m2v
#   끝 · 02 · 29: 옷감 삽입이 입은 옷의 색 · 소재가 아님(끝 황갈색 트윌 · 02 올리브 트윌 · 29 광택 새틴) — 지시문은 원래도 「ivory wool gabardine」인데
#     시작 그림 색을 따랐다 → 코트와 같은 아이보리 울 개버딘(잔털 · 사광)으로 그림을 바꾸고, 「warm brown low-key」처럼 갈색을 부르는 말을 뺀다
#   23: 가운데 정면 · 평평한 빛 · 힘 뺀 표정(11-05 조건 셋) → 원본처럼 이마에서 잘린 꽉 찬 틀 · 왼쪽 따뜻한 강한 빛 · 깊은 그림자 · 30° 튼 얼굴
#   30 · 21 끝: 얼굴이 다른 사람으로 읽힘(닮음 0.34 · 0.36) → F01 얼굴 세트로 다시, 30은 한 단계 가깝게(무릎 위), 21 끝 그림은 40° 3/4 얼굴
OEND = orig("110_p4-end")
PENDB = swap(OEND, "An extreme close-up of the ivory wool gabardine twill in warm brown low-key light, a soft fold rising across the frame; a few tiny bright glints catch the light along the ridges where it rakes from the upper right, and the middle of the frame stays calm and dark.",
             "An extreme close-up of the ivory wool gabardine twill — warm ivory, never brown or khaki — a soft fold rising across the frame; one warm low light rakes from the upper right so the twill ribs and the soft fiber nap stand out in relief, a few tiny glints of fiber sheen along the ridges, and the middle of the frame stays calm and a little darker.")
O02 = orig("088_p4-02")
P02B = swap(O02, "the fine diagonal twill ridges lie in deep warm shadow,", "the fine diagonal twill ridges of the warm ivory wool lie in deep shadow,")
O29 = orig("171_p4-29")
P29B = swap(swap(O29, "LINING: the plain ivory satin lining inside her trench coat — smooth and softly glossy, one solid color, no pattern, no check.",
                 "TWILL: the ivory wool gabardine of her trench coat — matte warm ivory wool with fine diagonal twill ribs and a soft fiber nap, never satin or silk, no sheen; at the lower-left edge a narrow sliver of its plain matte ivory lining joined by one line of topstitching."),
            "An extreme close-up of the plain ivory satin lining inside the trench coat: soft folds radiate from the top of the frame, their crests glowing ivory in a low warm side light, the hollows in soft warm-brown shadow. The satin lies still; no hands, no person.",
            "An extreme close-up of the coat's ivory gabardine gathered in broad soft ripples, its twill ribs flowing across the folds like the veins of a leaf; a warm raking light from the upper left gives the folds depth. The cloth lies still; no hands, no person.")
O23 = orig("101_p4-23")
P23B = swap(O23, "In the studio under a peach key light from the left with a faint cool fill from the right, a close shot of Yuna's face down to her collarbone, framed exactly as in the first frame: her head slightly lowered, she keeps a sidelong glance toward the camera, one hand resting on the side of her neck at the ivory trench collar over the cream knit. She holds the pose almost perfectly still; lips closed, expressionless.",
            "In the studio, a tight close shot exactly as in the first frame — the top of the frame cuts across her forehead — under one warm peach-amber hard key light from the left, the right half of her face in deep shadow: Yuna's head is turned a little and tilted, chin slightly down, and she looks up into the lens from under her brows with quiet intent, one hand resting on the side of her neck at the ivory trench collar. She holds the pose almost perfectly still; lips closed, no smile.")
O16 = orig("094_p4-16")
# 16: 붉은빛 아래 크림 니트가 복숭아색으로 읽혀 「다른 제품」(Fable 2차 남은 꼭 고칠 것) — 크림이 읽히는 따뜻한 흰 키 + 오른쪽 가장자리에만 깊은 붉은 테두리 빛(콘티 「붉은빛」은 남김)
P16B = swap(O16, "glowing under a warm pinkish-red side light.", "lit by one soft warm-white key light from the upper left so it reads clearly as cream — never peach, pink or orange — with only a thin deep-red rim glow along the right edge of the folds.")
O30 = orig("107_p4-30")
P30B = O30   # 지시문은 원래도 「framed from head to knees」 — 그림만 한 단계 가깝게 바꾼다

# id, {파일 이름: (경로, 크기)}, 지시문 — 이름이 `1_`로 시작하면 첫 · 끝 프레임, `2_참고1_시작`이면 m2v(드리미나내기.py mode_of)
M2V = "2_참고1_시작.jpg"
BOARDS = [
    ("p4-24s", {"1_시작.jpg": (os.path.join(SRC, "102_p4-24", "1_시작.jpg"), (1280, 720))}, ORIG24),
    ("p4-24w", {"1_시작.jpg": (os.path.join(SRC, "102_p4-24", "1_시작.jpg"), None)}, P24W),
    ("p4-24g", {"1_시작.jpg": (os.path.join(GOT, "C24g.png"), (1672, 941))}, P24G),
    ("p4-24f", {"1_시작.jpg": (os.path.join(GOT, "C24f.png"), (1672, 941))}, P24F),
    ("p4-24m", {M2V: (os.path.join(SRC, "102_p4-24", "1_시작.jpg"), None)}, P24M),
    ("p4-17m", {M2V: (os.path.join(SRC, "095_p4-17", "1_시작.jpg"), None)}, P17M),
    ("p4-21m", {M2V: (os.path.join(SRC, "099_p4-21", "1_시작.jpg"), None)}, P21M),
    ("p4-21n", {M2V: (os.path.join(SRC, "099_p4-21", "1_시작.jpg"), None), "3_참고2_마지막.jpg": (os.path.join(SRC, "099_p4-21", "2_끝.jpg"), None)}, P21N),
    ("p4-20m", {M2V: (os.path.join(SRC, "098_p4-20", "1_시작.jpg"), None)}, P20M),
    ("p4-08m", {M2V: (os.path.join(SRC, "090_p4-08", "1_시작.jpg"), None)}, P08M),
    ("p4-32m", {M2V: (os.path.join(GOT, "C32b.png"), (1672, 941))}, O32),
    ("p4-endb", {M2V: (os.path.join(GOT, "CEND_b.png"), (1672, 941))}, PENDB),
    ("p4-02b", {M2V: (os.path.join(GOT, "C02_b.png"), (1672, 941))}, P02B),
    ("p4-02d", {M2V: (os.path.join(GOT, "C02_d.png"), (1672, 941))}, P02B),   # 02b 두 벌이 그림 밝기(L 50)에서 두 배로 올라(43 → 95, 원본 11 → 42) — 그림 노출만 원본 첫 장(L 17)으로 내린 판
    ("p4-29b", {M2V: (os.path.join(GOT, "C29_b.png"), (1672, 941))}, P29B),
    ("p4-23b", {M2V: (os.path.join(GOT, "C23_c.png"), (1672, 941))}, P23B),   # C23_b(닮음 0.38)에 지금 C23 얼굴을 신원 참고로 더 넣어 다시 구운 판(0.43)
    ("p4-30b", {M2V: (os.path.join(GOT, "C30_b.png"), (1672, 941))}, P30B),
    ("p4-16b", {M2V: (os.path.join(GOT, "C16_b.png"), (1672, 941))}, P16B),
    ("p4-21p", {M2V: (os.path.join(SRC, "099_p4-21", "1_시작.jpg"), None), "3_참고2_마지막.jpg": (os.path.join(GOT, "C21e_b.png"), (1672, 941))}, P21N),
]


def main():
    for t in (P24G, P24F):
        assert t != ORIG24, "원문 바꾸기가 먹지 않았다"
    assert "reflection" not in P24G and "chin level" in P24F
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for k, (pid, files, text) in enumerate(BOARDS, 1):
        lost = [p for p, _ in files.values() if not os.path.exists(p)]
        if lost:
            print(f"건너뜀 {pid}: 그림이 아직 없다 — {lost}")
            continue
        folder = f"{k:03d}_{pid}"
        d = os.path.join(OUT, folder)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        for name, (pic, size) in files.items():
            im = Image.open(pic).convert("RGB")
            if size and im.size != size:
                # 크기만 맞춘다 — 비율이 거의 같아(1672×941 = 1.777) 가운데 1px 안팎만 잘린다
                r = max(size[0] / im.width, size[1] / im.height)
                im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
                x, y = (im.width - size[0]) // 2, (im.height - size[1]) // 2
                im = im.crop((x, y, x + size[0], y + size[1]))
            im.save(os.path.join(d, name), quality=95)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(text + "\n")
        cut = pid[3:5]
        rows.append({"순서": k, "id": pid, "편": "p4", "컷": [cut], "폴더": folder, "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                     "방식": None, "낱판": [], "쓰는초": [], "파일": sorted(files), "빠진 파일": [], "지시문 글자 수": len(text), "판 수": 1})
        print(f"{pid}: {', '.join(sorted(files))} · 지시문 {len(text)}자")
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
