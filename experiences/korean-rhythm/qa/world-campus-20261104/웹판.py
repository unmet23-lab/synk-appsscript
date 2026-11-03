"""
말의 리듬 캠퍼스 판(2026-11-04) — 구운 판(굽기순서.mjs)을 게임 그림으로 만든다. 주문 폭주 2판_그림.py와 같은 길(rembg 가면 · WebP · 후보정 없음).

    python -I -X utf8 experiences/korean-rhythm/qa/world-campus-20261104/웹판.py [입구판=블루|노을]

들어오는 것(공용 작업본 .tmp/rhythm-world-20261104/판, git 밖): 입구_블루 · 입구_노을 · 무대_세로 · 무대_가로 · 결과 · 카드
나가는 것(experiences/korean-rhythm/assets/world/):
  lobby.webp(입구 사진 전체, 1000×1250) · lobby-mic.webp(같은 사진에서 마이크 · 스탠드만 남긴 투명 판 — 제목 위에 다시 얹어 「마이크 뒤로 들어가는 제목」)
  stage-tall.webp(세로 화면 놀이 바닥, 720×1280) · stage-wide.webp(가로 화면, 1600×900) — 좌우를 뒤집어 왼쪽(O) 벽이 청금석, 오른쪽(X) 벽이 코랄 빛이다.
      바닥과 커튼이 만나는 줄(레인이 모이는 높이)은 stage.mjs WORLD_FLOOR에 적는다(세로 0.236 · 가로 0.382, 이 파일이 잰 값을 찍는다).
  finale.webp(결과 — 축제 본무대 끝난 순간, 1000×1250, 좌우를 뒤집어 마이크가 오른쪽 아래)
  ../../../brand-opening/assets/world-play/rhythm.webp — 홈 「놀이」 카드 그림: 흰 바탕 위 마이크 하나(640 정사각, 주문 폭주 카드와 같은 꼴)
색 · 밝기는 고치지 않는다(좌우 뒤집기와 자르기 · 줄이기만).
"""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
공용 = Path(os.environ.get("SYNK_SHARED", r"C:\Users\q1212\Documents\SYNK-appsscript"))
판폴더 = 공용 / ".tmp" / "rhythm-world-20261104" / "판"
낼 = 뿌리 / "experiences" / "korean-rhythm" / "assets" / "world"
입구판 = sys.argv[1] if len(sys.argv) > 1 else "블루"


def 최근(이름):
    후보 = sorted((p for p in 판폴더.iterdir() if re.fullmatch(rf"{re.escape(이름)}_\d{{6}}\.png", p.name)), key=lambda p: p.stat().st_mtime)
    if not 후보:
        raise SystemExit(f"판이 없다: {이름}")
    return 후보[-1]


def 저장(im, dst, 품질=80):
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=품질, method=6)
    return dst


def 맞춤(im, w, h):
    """가운데 기준으로 w:h 비율에 맞춰 자른 뒤 w×h로 줄인다."""
    r = w / h
    if im.width / im.height > r:
        nw = round(im.height * r); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = round(im.width / r); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
    return im.resize((w, h), Image.LANCZOS)


def 바닥줄(im):
    """바닥과 먼 벽(커튼)이 만나는 줄 — 가운데 띠(폭 40~60%)의 세로 밝기 기울기가 가장 크게 오르는 자리(위 20~60% 안)."""
    g = np.asarray(im.convert("L")).astype(float)
    h, w = g.shape
    band = np.convolve(g[:, int(w * 0.4):int(w * 0.6)].mean(axis=1), np.ones(9) / 9, "same")
    d = np.diff(band)
    lo, hi = int(h * 0.2), int(h * 0.6)   # 먼 벽 위쪽 전구 줄(10~19%)은 건너뛴다
    return round(float((np.argmax(d[lo:hi]) + lo) / h), 3)


만든, 잰 = {}, {}

# ── 입구: 사진 전체 + 마이크만 남긴 투명 판(같은 크기 · 같은 자리) ──
입구 = 맞춤(Image.open(최근(f"입구_{입구판}")).convert("RGB"), 1000, 1250)
만든["lobby"] = str(저장(입구, 낼 / "lobby.webp", 82))
from rembg import new_session, remove  # noqa: E402  (이 판에서만 쓴다)
가면 = remove(입구, session=new_session("isnet-general-use"), only_mask=True)
m = np.asarray(가면).astype(np.uint8)
# 마이크는 왼쪽 아래(폭 29~47% · 머리가 화면 높이 41~50%)에 있다 — 위쪽 창 · 전등, 왼쪽 스피커 · 물병 · 수건, 오른쪽 의자 · 삼각대에서 잡힌 조각은 버린다
m[: int(m.shape[0] * 0.36), :] = 0
m[:, : int(m.shape[1] * 0.285)] = 0   # 마이크 클립 왼쪽 끝이 29.6% — 그 앞의 수건 끝 조각(25~28%)을 뺀다
m[:, int(m.shape[1] * 0.62):] = 0
가면 = Image.fromarray(m)
마이크 = 입구.copy(); 마이크.putalpha(가면)
만든["lobby-mic"] = str(저장(마이크, 낼 / "lobby-mic.webp", 86))
ys, xs = np.nonzero(m > 128)
잰["mic"] = {"top": round(ys.min() / m.shape[0], 4), "left": round(xs.min() / m.shape[1], 4), "right": round(xs.max() / m.shape[1], 4)}

# ── 놀이 바닥: 좌우 뒤집기(왼쪽 O = 청금석 벽 · 오른쪽 X = 코랄 벽) ──
for 이름, 크기, 낼이름 in [("무대_세로", (720, 1280), "stage-tall"), ("무대_가로", (1600, 900), "stage-wide")]:
    판 = ImageOps.mirror(맞춤(Image.open(최근(이름)).convert("RGB"), *크기))
    잰[낼이름] = 바닥줄(판)
    만든[낼이름] = str(저장(판, 낼 / f"{낼이름}.webp", 80))

# ── 결과 ──
# 좌우를 뒤집어 마이크를 오른쪽 아래로 — 제목 · 큰 숫자가 왼쪽에 서서 마이크를 가리지 않는다
만든["finale"] = str(저장(ImageOps.mirror(맞춤(Image.open(최근("결과")).convert("RGB"), 1000, 1250)), 낼 / "finale.webp", 82))

# ── 홈 「놀이」 카드: 흰 바탕 마이크(이미 흰 바탕 · 그림자까지 구운 판) → 640 정사각 ──
카드 = 맞춤(Image.open(최근("카드")).convert("RGB"), 640, 640)
만든["card"] = str(저장(카드, 뿌리 / "experiences" / "brand-opening" / "assets" / "world-play" / "rhythm.webp", 84))

합 = sum(Path(p).stat().st_size for p in 만든.values())
print(json.dumps({"입구판": 입구판, "잰 것": 잰, "만든": {k: round(Path(v).stat().st_size / 1024) for k, v in 만든.items()}, "합 KB": round(합 / 1024)}, ensure_ascii=False))
