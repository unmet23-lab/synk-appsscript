# 도담중공업 영어 판 제작기 그림(2026-11-17, Claude) — 영어 채비 설계 2-2절 「편마다 제작기를 붙인다. 영상 전에 모든 shot을 장면 이미지로 먼저 보여 준다는 우리 절차를 그림 두세 장으로」.
#   그림 안에는 글자를 넣지 않는다(설명은 게시 글이 맡는다 — 슬롭 점검표 6번 「구석 설명 딱지를 쓰지 않는다」). 원본 광고의 장면은 쓰지 않고 우리 그림만 쓴다.
#   1) 콘티34: 이 편이 쓴 판 34개(31 · 32컷은 한 판, 11-18 C22 · C34를 뺌)의 첫 장 = 영상이 움직이기 전의 장면 그림, 6 × 6
#   2) 한컷: 19컷 — 왼쪽 장면 그림(판 첫 장, 흙받이의 아기 표지) · 오른쪽 그 판이 움직여 필름에 쓴 마지막 장(크레인으로 물러나 트레일러 위 터빈 전체).
#      첫 판은 36컷 준호(웃음 전후)였는데 두 장이 거의 같아 「그림 → 움직임」이 보이지 않았다
#   3) 로고: 37컷 끝 화면 — 직접 그린 DODAM 이름이 앉은 장(영어 판 최종본에서)
#   python -X utf8 제작기.py   → git 밖 최종/p10_en/제작기/제작기_1_콘티34.jpg · _2_한컷.jpg · _3_로고.jpg
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
B2B = os.path.normpath(os.path.join(HERE, "..", "..", "PULSE_포트폴리오_제작준비_20261012", "video", "b2b-factory-20261026"))
sys.path.insert(0, B2B)
sys.path.insert(0, HERE)
import 최종편집 as E   # noqa: E402
import 영어판 as V      # noqa: E402 — 영어 판 편집(11-18 C22 · C34를 뺌)

C = E.C
OUT = os.path.join(E.ROOT, "최종", "p10_en", "제작기")
BG = (14, 13, 12)


def frame(src, n, w=1920):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-an", "-fps_mode", "passthrough", "-vf", f"select=eq(n\\,{n}),scale={w}:-2:flags=lanczos", "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(raw)).convert("RGB")


def crop21(im):
    """필름처럼 2:1(위아래를 덜어 냄)"""
    w, h = im.size
    nh = w // 2
    t = (h - nh) // 2
    return im.crop((0, t, w, t + nh))


def contact():
    seen, ids = set(), []
    for n in range(1, 38):
        pid, _a, k = V.CUTS_EN[n]
        if k and pid not in seen:          # 영어 판에서 뺀 컷(길이 0)은 넣지 않는다 — 11-18부터 34판
            seen.add(pid)
            ids.append(pid)
    assert len(ids) == 34, len(ids)
    cols, tw, gap, pad = 6, 520, 10, 40
    th = tw // 2
    rows = -(-len(ids) // cols)
    W = pad * 2 + cols * tw + (cols - 1) * gap
    H = pad * 2 + rows * th + (rows - 1) * gap
    sheet = Image.new("RGB", (W, H), BG)
    for i, pid in enumerate(ids):
        im = crop21(frame(C.clip(pid), 0, 1040)).resize((tw, th), Image.LANCZOS)
        r, c = divmod(i, cols)
        left = (cols - (len(ids) - r * cols)) * (tw + gap) // 2 if r == rows - 1 else 0   # 마지막 줄은 가운데로
        sheet.paste(im, (pad + left + c * (tw + gap), pad + r * (th + gap)))
    p = os.path.join(OUT, "제작기_1_콘티34.jpg")
    sheet.save(p, quality=92)
    print(p, sheet.size)


def one_shot():
    pid, a = E.CUTS[19]
    src = C.clip(pid)
    still = crop21(frame(src, 0))
    moved = crop21(frame(src, a + (E.F[19] - E.F[18]) - 1))   # 19컷이 필름에 쓴 마지막 장(카메라가 멈춘 자리)
    gap, pad = 16, 40
    w, h = 1200, 600
    sheet = Image.new("RGB", (pad * 2 + w * 2 + gap, pad * 2 + h), BG)
    sheet.paste(still.resize((w, h), Image.LANCZOS), (pad, pad))
    sheet.paste(moved.resize((w, h), Image.LANCZOS), (pad + w + gap, pad))
    p = os.path.join(OUT, "제작기_2_한컷.jpg")
    sheet.save(p, quality=92)
    print(p, sheet.size)


def logo(final):
    im = frame(final, E.END.LOCK_F + 12)   # 로고가 다 앉고 12장 뒤(58.5초) — 마지막 자막이 진 뒤
    p = os.path.join(OUT, "제작기_3_로고.jpg")
    im.save(p, quality=92)
    print(p, im.size)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    contact()
    one_shot()
    final = sys.argv[1] if len(sys.argv) > 1 else os.path.join(E.ROOT, "최종", "p10_en", "도담_영어_C_아이작.mp4")
    if os.path.exists(final):
        logo(final)
