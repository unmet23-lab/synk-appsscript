"""
주문 폭주 캠퍼스 판 2판(2026-11-03 유호님 「디테일이 많이 부족 · 맹한 느낌」) — 새로 구운 판 셋을 게임 그림으로 만든다.

    python -I -X utf8 experiences/order-rush/qa/world-campus-20261103/2판_그림.py

들어오는 것(공용 작업본 .tmp/order-rush-world-20261103/판, git 밖): ing-<재료>_*.png(재료 여섯 — 11-03 밤부터 한 장씩) · counter-top_*.png(바리스타 쪽 작업대)
  · lobby-latte_*.png(입구 주인공 — 아이스 라테 한 잔)
나가는 것(experiences/order-rush/assets/world/):
  ingredients/<coffee|tea|milk|ice|sugar|cold>.webp — 어두운 카운터 위 실물 사진(3:2, 720폭). 카드를 꽉 채운다(오려내지 않는다 —
      유리 · 얼음을 오려내면 바탕이 비쳐 어두운 판에서 회색 덩어리가 된다).
  bench.webp — 3D 컵이 서는 작업대 사진: 나무 면만(원본 위쪽의 홀 · 창 · 손님은 잘라 낸다 — 위 무대의 손님 사진과 지평선 · 손님이 두 벌이 되지
      않게, Fable 2판 검토 P1-5). 나무색은 손님 사진의 카운터와 같은 밝은 오크 계열이라 색은 고치지 않는다(11-03 나란히 비교).
  lobby.webp(입구 사진 전체) · lobby-glass.webp(같은 사진에서 유리잔만 남긴 투명 판 — 제목 글자 위에 다시 얹어 「잔 뒤로 들어가는 제목」)
  ../../../brand-opening/assets/world-play/order-rush.webp — 홈 「놀이」 카드 그림: 흰 바탕 위 잔 하나(640 정사각). 다른 놀이 카드의
      「흰 바탕 위 물건 하나」와 같은 꼴(Fable 2판 검토 P1-4 — 손님 얼굴 사진이면 목록에서 혼자 결이 다르다).
후보정(색 · 밝기)은 하지 않는다. 생성 표시 조각은 WebP로 다시 쓰며 남지 않는다.
"""
import json
import os
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
공용 = Path(os.environ.get("SYNK_SHARED", r"C:\Users\q1212\Documents\SYNK-appsscript"))
판폴더 = 공용 / ".tmp" / "order-rush-world-20261103" / "판"
낼 = 뿌리 / "experiences" / "order-rush" / "assets" / "world"


def 최근(이름):
    # 판 이름의 시각은 시분초뿐이라 자정을 넘기면 새 판이 이름순으로 앞에 선다 — 파일 시각으로 가장 새 판을 고른다(11-04)
    후보 = sorted((p for p in 판폴더.iterdir() if re.fullmatch(rf"{re.escape(이름)}_\d{{6}}\.png", p.name)), key=lambda p: p.stat().st_mtime)
    if not 후보:
        raise SystemExit(f"판이 없다: {이름}")
    return 후보[-1]


def 저장(im, dst, 품질=80):
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=품질, method=6)
    return dst


만든 = {}

# ── 재료 여섯(11-03 밤): 어두운 호두나무 카운터 위 한 가지씩 구운 판(ing-<이름>, 굽기순서.mjs 재료)을 3:2 그대로 줄인다 ──
# 회색 종이 한 판(3×2)을 잘라 쓰던 앞 판은 카드 가운데 작은 회색 사각형으로 붙어 「대충 만든」 것처럼 보였다(유호님). 카드가 사진으로 꽉 차고
# object-position으로 물건 자리를 맞추므로 여기서는 자르지 않는다. 색 · 밝기는 고치지 않는다.
for 이름 in ["coffee", "tea", "milk", "ice", "sugar", "cold"]:
    원 = Image.open(최근(f"ing-{이름}")).convert("RGB")
    만든[이름] = str(저장(원.resize((720, round(720 * 원.height / 원.width)), Image.LANCZOS), 낼 / "ingredients" / f"{이름}.webp", 82))

# ── 작업대: 나무 면만(원본 높이의 51%부터 아래 — 홀과 카운터 먼 끝이 끝나는 줄) ──
작업대 = Image.open(최근("counter-top")).convert("RGB")
s = 1280 / 작업대.width
작업대 = 작업대.resize((1280, round(작업대.height * s)), Image.LANCZOS)
작업대 = 작업대.crop((0, round(작업대.height * 0.51), 1280, 작업대.height))
만든["bench"] = str(저장(작업대, 낼 / "bench.webp", 80))

# ── 입구: 사진 전체 + 유리잔만 남긴 투명 판(같은 크기 · 같은 자리) ──
입구 = Image.open(최근("lobby-latte")).convert("RGB")
s = 1000 / 입구.width
입구 = 입구.resize((1000, round(입구.height * s)), Image.LANCZOS)
만든["lobby"] = str(저장(입구, 낼 / "lobby.webp", 80))
from rembg import new_session, remove   # noqa: E402  (이 판에서만 쓴다)
가면 = remove(입구, session=new_session("isnet-general-use"), only_mask=True)
가면 = np.asarray(가면).astype(np.float32) / 255.0
# 잔은 화면 아래 절반에만 있다 — 위쪽에서 잡힌 전등 · 창 조각은 버린다
yy = np.arange(가면.shape[0])[:, None] / 가면.shape[0]
가면 = np.where(yy > 0.36, 가면, 0)
가면 = Image.fromarray((np.clip(가면, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
잔 = 입구.copy()
잔.putalpha(가면)
만든["lobby-glass"] = str(저장(잔, 낼 / "lobby-glass.webp", 86))
m = np.asarray(가면) > 128
ys, xs = np.nonzero(m)
잔상자 = {"top": round(ys.min() / m.shape[0], 4), "bottom": round(ys.max() / m.shape[0], 4), "left": round(xs.min() / m.shape[1], 4), "right": round(xs.max() / m.shape[1], 4)}

# ── 홈 「놀이」 카드 그림: 흰 바탕 위 잔 하나 + 바닥에 닿는 옅은 그림자(640 정사각) ──
잔만 = 잔.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
높이 = 520
잔만 = 잔만.resize((round(잔만.width * 높이 / 잔만.height), 높이), Image.LANCZOS)
카드 = Image.new("RGB", (640, 640), (255, 255, 255))
그림자 = Image.new("L", (640, 640), 0)
from PIL import ImageDraw   # noqa: E402
ImageDraw.Draw(그림자).ellipse((320 - 잔만.width * 0.46, 586 - 14, 320 + 잔만.width * 0.46, 586 + 14), fill=70)
그림자 = 그림자.filter(ImageFilter.GaussianBlur(12))
카드.paste(Image.new("RGB", (640, 640), (40, 30, 24)), (0, 0), 그림자)
카드.paste(잔만, (320 - 잔만.width // 2, 590 - 높이), 잔만)
만든["play-card"] = str(저장(카드, 뿌리 / "experiences" / "brand-opening" / "assets" / "world-play" / "order-rush.webp", 84))

합 = sum(p.stat().st_size for p in 낼.rglob("*.webp"))
print(json.dumps({"만든": len(만든), "잔 자리(비율)": 잔상자, "assets/world 합 KB": round(합 / 1024)}, ensure_ascii=False))
