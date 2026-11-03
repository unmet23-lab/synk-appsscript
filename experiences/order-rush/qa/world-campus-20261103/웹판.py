"""
주문 폭주 캠퍼스 판(2026-11-03) — 구운 손님 판 · 싱크타운 카페 홀 정지 화면을 게임에 쓰는 WebP로 만든다.

    python -I -X utf8 experiences/order-rush/qa/world-campus-20261103/웹판.py

들어오는 것(공용 작업본 .tmp, git 밖):
  order-rush-world-20261103/판/g?-order_*.png(고른 판은 판/고른.json) · 묶음/g?-{thanks,puzzled}.png(얼굴만 바꾼 짝)
  town-cafe-0-20261031/판/hall-real-b-merged.png(홀 실사 전경, 11-01 고른 결) · town-cafe-1-20261101/묶음/hall-rain-plant-merged.png(마감 홀)
나가는 것(저장소): experiences/order-rush/assets/world/ — hall.webp(무대 바탕) · close.webp(결과 포스터) · lobby.webp(입구 포스터 = LOBBY 손님 주문 판)
  guests/<g>-{order,thanks,puzzled}.webp(800×1000) · guests/face/<g>.webp(줄 선 손님 얼굴 동그라미 원판 160×160, YuNet 얼굴 상자 기준)
그림 생성 표시(C2PA) 조각은 WebP로 다시 쓰며 남지 않는다. 픽셀은 줄이기 말고 손대지 않는다(후보정 없음).
"""
import json
import os
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
sys.path.insert(0, str(뿌리 / "tools" / "lib"))
공용 = Path(os.environ.get("SYNK_SHARED", r"C:\Users\q1212\Documents\SYNK-appsscript"))
밖 = 공용 / ".tmp" / "order-rush-world-20261103"
낼 = 뿌리 / "experiences" / "order-rush" / "assets" / "world"
손님 = ["g1", "g2", "g3", "g4", "g5", "g6"]
LOBBY = os.environ.get("LOBBY", "g2")


def 판(이름):
    고른경로 = 밖 / "판" / "고른.json"
    고른 = json.loads(고른경로.read_text("utf8")) if 고른경로.exists() else {}
    if 이름 in 고른:
        return 밖 / "판" / 고른[이름]
    # 판 이름의 시각은 시분초뿐이라 자정을 넘기면 새 판이 이름순으로 앞에 선다 — 파일 시각으로 가장 새 판을 고른다(11-04)
    후보 = sorted((p for p in (밖 / "판").iterdir() if re.fullmatch(rf"{re.escape(이름)}_\d{{6}}(_\d+)?\.(png|jpe?g|webp)", p.name, re.I)), key=lambda p: p.stat().st_mtime)
    return 후보[-1] if 후보 else None


def 저장(src, dst, 크기, 품질=78):
    im = Image.open(src).convert("RGB")
    W, H = 크기
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=품질, method=6)
    return dst


def 얼굴(src, dst, 변=160):
    img = cv2.cvtColor(np.asarray(Image.open(src).convert("RGB")), cv2.COLOR_RGB2BGR)
    H, W = img.shape[:2]
    m = os.path.join(os.environ["USERPROFILE"], ".rembg", "models", "yunet", "face_detection_yunet_2023mar.onnx")
    fd = cv2.FaceDetectorYN.create(m, "", (W, H), 0.6, 0.3, 5000)
    _, faces = fd.detect(img)
    if faces is None or not len(faces):
        raise SystemExit(f"얼굴을 못 찾았다: {src}")
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
    cx, cy, r = x + w / 2, y + h * 0.52, max(w, h) * 0.95
    box = tuple(int(round(v)) for v in (cx - r, cy - r, cx + r, cy + r))
    im = Image.open(src).convert("RGB").crop(box).resize((변, 변), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=82, method=6)


만든 = []
만든.append(저장(공용 / ".tmp" / "town-cafe-0-20261031" / "판" / "hall-real-b-merged.png", 낼 / "hall.webp", (880, 1100)))
만든.append(저장(공용 / ".tmp" / "town-cafe-1-20261101" / "묶음" / "hall-rain-plant-merged.png", 낼 / "close.webp", (880, 1100)))
없음 = []
for g in 손님:
    바탕 = 판(f"{g}-order")
    if not 바탕:
        없음.append(f"{g}-order")
        continue
    만든.append(저장(바탕, 낼 / "guests" / f"{g}-order.webp", (800, 1000)))
    얼굴(바탕, 낼 / "guests" / "face" / f"{g}.webp")
    for k in ("thanks", "puzzled"):
        짝 = 밖 / "묶음" / f"{g}-{k}.png"
        if 짝.exists():
            만든.append(저장(짝, 낼 / "guests" / f"{g}-{k}.webp", (800, 1000)))
        else:
            없음.append(f"{g}-{k}")
    if g == LOBBY:
        만든.append(저장(바탕, 낼 / "lobby.webp", (960, 1200), 80))
        # 홈 「놀이」 목록의 인화지 한 장(정사각): 얼굴 · 어깨가 들어오게 위쪽 정사각을 자른다
        im = Image.open(바탕).convert("RGB")
        변 = round(im.width * 0.86)
        x = (im.width - 변) // 2
        y = round(im.height * 0.1)
        카드 = 뿌리 / "experiences" / "brand-opening" / "assets" / "world-play" / "order-rush.webp"
        카드.parent.mkdir(parents=True, exist_ok=True)
        im.crop((x, y, x + 변, y + 변)).resize((400, 400), Image.LANCZOS).save(카드, "WEBP", quality=80, method=6)
        만든.append(카드)
합 = sum(p.stat().st_size for p in 낼.rglob("*.webp"))
print(json.dumps({"만든": len(만든), "없음": 없음, "assets/world 합 KB": round(합 / 1024)}, ensure_ascii=False))
