"""
입장 검사 캠퍼스 판(2026-11-04) — 구운 부스 창 · 손님 · 짐 판을 게임에 쓰는 WebP로 만든다(주문 폭주 웹판.py와 같은 길).

    python -I -X utf8 experiences/entry-check/qa/world-campus-20261104/웹판.py

들어오는 것(공용 작업본 .tmp/entry-check-world-20261104, git 밖): 판/booth_*.png · 판/<who>-talk_*.png(고른 판은 판/고른.json)
  · 묶음/<who>-{pass,sorry,puzzled}.png(얼굴만 바꾼 짝) · 판/item-<k>_*.png
나가는 것(저장소 experiences/entry-check/assets/world/): booth.webp(빈 창, 900×1125) · guests/<who>-<mood>.webp(800×1000)
  · guests/face/<who>.webp(줄 선 손님 얼굴 동그라미 160×160, YuNet 얼굴 상자 기준 — 아이와 온 손님은 어른 얼굴) · items/<k>.webp(480×480)
아직 굽지 않은 표정은 없음에 적고 건너뛴다(게임은 없는 표정이면 말함 판 그대로). 픽셀은 줄이기 말고 손대지 않는다(후보정 없음).
"""
import json
import os
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

여기 = Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
공용 = Path(os.environ.get("SYNK_SHARED", r"C:\Users\q1212\Documents\SYNK-appsscript"))
밖 = 공용 / ".tmp" / "entry-check-world-20261104"
낼 = 뿌리 / "experiences" / "entry-check" / "assets" / "world"
손님 = ["bear", "raccoon", "rabbit", "fox", "squirrel", "hedgehog", "penguin", "ducks", "otter", "deer", "panda", "sheep"]
표정 = ["idle", "nervous", "pass", "sly", "sorry", "puzzled"]
근무지 = ["pool", "library", "museum", "concert"]
짐 = ["swim-cap", "towel", "water-bottle", "gimbap", "snack", "swim-ring", "book", "coffee-lid", "coffee-open", "phone", "purse", "camera", "picnic-mat", "chair"]


def 판(이름):
    고른경로 = 밖 / "판" / "고른.json"
    고른 = json.loads(고른경로.read_text("utf8")) if 고른경로.exists() else {}
    if 이름 in 고른:
        return 밖 / "판" / 고른[이름]
    후보 = sorted((p for p in (밖 / "판").iterdir() if re.fullmatch(rf"{re.escape(이름)}_\d{{6}}(_\d+)?\.(png|jpe?g|webp)", p.name, re.I)), key=lambda p: p.stat().st_mtime)
    return 후보[-1] if 후보 else None


def 저장(src, dst, 크기, 품질=80):
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
    # 믿을 만한 큰 얼굴 가운데 맨 위 — 아이와 온 손님은 어른 얼굴이다(큰 상자만 고르면 몸통을 얼굴로 잘못 잡은 상자가 뽑힌다)
    믿음 = [f for f in faces if f[-1] >= 0.8]
    큰폭 = max(f[2] for f in 믿음)
    x, y, w, h = min((f for f in 믿음 if f[2] >= 큰폭 * 0.5), key=lambda f: f[1])[:4]
    r = min(max(w, h) * 0.95, W / 2, H / 2)
    cx, cy = min(max(x + w / 2, r), W - r), min(max(y + h * 0.52, r), H - r)   # 그림 밖으로 나가면 검게 채워지니 안으로 민다
    box = tuple(int(round(v)) for v in (cx - r, cy - r, cx + r, cy + r))
    im = Image.open(src).convert("RGB").crop(box).resize((변, 변), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "WEBP", quality=82, method=6)


만든, 없음 = [], []
창 = 판("booth")
if 창:
    만든.append(저장(창, 낼 / "booth.webp", (900, 1125)))
else:
    없음.append("booth")
for g in 손님:
    바탕 = 판(f"{g}-talk")
    if not 바탕:
        없음.append(f"{g}-talk")
        continue
    만든.append(저장(바탕, 낼 / "guests" / f"{g}-talk.webp", (800, 1000)))
    얼굴(바탕, 낼 / "guests" / "face" / f"{g}.webp")
    for k in 표정:
        짝 = 밖 / "묶음" / f"{g}-{k}.png"
        if 짝.exists():
            만든.append(저장(짝, 낼 / "guests" / f"{g}-{k}.webp", (800, 1000)))
        else:
            없음.append(f"{g}-{k}")
# 고무도장 머리: 흰 바탕 판에서 rembg로 오린다(사람 · 마스코트가 아닌 소품, 찍는 순간 표 위로 내려왔다 올라간다)
도장 = 판("stamp-head")
if 도장:
    from rembg import remove
    im = remove(Image.open(도장).convert("RGB")).convert("RGBA")
    im = im.crop(im.getbbox())
    s = 264 / max(im.size)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    판자 = Image.new("RGBA", (264, 264), (0, 0, 0, 0))
    판자.paste(im, ((264 - im.width) // 2, 264 - im.height), im)   # 받침 아래가 그림 아래 끝에 닿는다
    (낼 / "stamp-head.webp").parent.mkdir(parents=True, exist_ok=True)
    판자.save(낼 / "stamp-head.webp", "WEBP", quality=84, method=6)
    만든.append(낼 / "stamp-head.webp")
else:
    없음.append("stamp-head")
# 홈 「놀이」 목록의 인화지 한 장(정사각 640): 다른 놀이 카드처럼 흰 바탕 위 물건 하나 — 고무도장(흰 바탕에서 구운 판 그대로)
카드원본 = 판("stamp-head")
if 카드원본:
    im = Image.open(카드원본).convert("RGB")
    변 = min(im.size)
    x, y = (im.width - 변) // 2, (im.height - 변) // 2
    카드 = 뿌리 / "experiences" / "brand-opening" / "assets" / "world-play" / "entry-check.webp"
    카드.parent.mkdir(parents=True, exist_ok=True)
    im.crop((x, y, x + 변, y + 변)).resize((640, 640), Image.LANCZOS).save(카드, "WEBP", quality=82, method=6)
    만든.append(카드)
# 2판: 호두나무 책상 · 쇠 쟁반 · 근무지 입구
for 이름, 파일, 크기, 품질 in (("desk", "desk.webp", (900, 1125), 78), ("tray", "tray.webp", (780, 520), 78)):
    p = 판(이름)
    if p:
        만든.append(저장(p, 낼 / 파일, 크기, 품질))
    else:
        없음.append(이름)
for k in 근무지:
    p = 판(f"venue-{k}")
    if p:
        만든.append(저장(p, 낼 / "venues" / f"{k}.webp", (900, 1125)))
    else:
        없음.append(f"venue-{k}")
# 짐은 오려서 쇠 쟁반 위에 놓는다(소품이라 누끼, 마스코트 · 사람 얼굴이 아니다). 사람 마스크는 큰 글자를 사람 뒤로 넣을 때만 쓴다(사진은 그대로).
from rembg import new_session, remove
세션 = new_session("isnet-general-use")
for k in 짐:
    p = 판(f"item-{k}")
    if p:
        im = remove(Image.open(p).convert("RGB"), session=세션).convert("RGBA")
        im = im.crop(im.getbbox())
        s = 220 / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        판자 = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
        판자.paste(im, ((240 - im.width) // 2, (240 - im.height) // 2), im)
        (낼 / "items").mkdir(parents=True, exist_ok=True)
        판자.save(낼 / "items" / f"{k}.webp", "WEBP", quality=84, method=6)
        만든.append(낼 / "items" / f"{k}.webp")
    else:
        없음.append(f"item-{k}")
사람세션 = new_session("isnet-general-use")
for g in 손님:
    바탕 = 판(f"{g}-talk")
    if 바탕:
        im = Image.open(바탕).convert("RGB").resize((400, 500), Image.LANCZOS)
        알파 = remove(im, session=사람세션, only_mask=True).convert("L")
        # 창 틀 · 창턱 · 쟁반이 사람으로 잡혀도 글자를 가리지 않게 아래 끝을 비운다(창턱 위에서 끊는다)
        판자 = Image.new("RGBA", (400, 500), (255, 255, 255, 0))
        판자.putalpha(알파)
        (낼 / "guests" / "mask").mkdir(parents=True, exist_ok=True)
        판자.save(낼 / "guests" / "mask" / f"{g}.webp", "WEBP", quality=70, method=6)
        만든.append(낼 / "guests" / "mask" / f"{g}.webp")
합 = sum(p.stat().st_size for p in 낼.rglob("*.webp"))
(낼 / "manifest.json").write_text(json.dumps({"guests": sorted({p.stem for p in (낼 / "guests").glob("*.webp")}) if (낼 / "guests").exists() else [],
    "items": sorted(p.stem for p in (낼 / "items").glob("*.webp")) if (낼 / "items").exists() else [],
    "venues": sorted(p.stem for p in (낼 / "venues").glob("*.webp")) if (낼 / "venues").exists() else [],
    "masks": sorted(p.stem for p in (낼 / "guests" / "mask").glob("*.webp")) if (낼 / "guests" / "mask").exists() else []}, ensure_ascii=False, indent=1) + "\n", "utf8")
print(json.dumps({"만든": len(만든), "없음": len(없음), "assets/world 합 KB": round(합 / 1024)}, ensure_ascii=False))
