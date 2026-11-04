"""
말 랠리 캠퍼스 판(2026-11-04) — 구운 표정 판을 기준 판(ready)에 맞춰 게임 그림으로 낸다. 얼굴 · 몸은 손보지 않고, 판 전체를 아주 조금 옮길 뿐이다.

표정 판은 기준 판의 편집이라 탁구대 · 네트가 거의 같은 자리지만 몇 px씩 어긋날 수 있다. 3D 공은 ready에 맞춘 카메라로 그려지고 표정을 겹쳐 바꿀 때
탁구대가 움찔하면 사진 바꿔 끼우기로 보인다 → 탁구대 면(네트 · 흰 선)의 특징점으로 호모그래피를 구해 ready에 맞춘다.
입구 · 결과 판은 구도가 달라 크기만 줄인다.

    python -I -X utf8 판맞추기.py [기준 ready 파일 번호(기본 1)]
나가는 것: experiences/talk-rally/assets/world/cast/taeo/plates/<표정>.webp(폭 900) · assets/world/cast/taeo/{lobby,result}.webp(폭 1000), 어긋남 표는 표준 출력.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

여기 = Path(__file__).resolve().parent
게임 = 여기.parents[1]
밖 = Path(r"C:\Users\q1212\Documents\SYNK-appsscript") / ".tmp" / "talk-rally-world-20261104" / "nb" / "out"
인물 = 게임 / "assets" / "world" / "cast" / "taeo"
판 = 인물 / "plates"
판.mkdir(parents=True, exist_ok=True)
고른 = json.loads((밖.parent.parent / "고른.json").read_text(encoding="utf-8"))
번호 = 고른.get("plates", {})


def 읽기(이름):
    n = 번호.get(이름, 1)
    return cv2.imdecode(np.fromfile(밖 / f"rally-{이름}-nb_g{n}.png", np.uint8), cv2.IMREAD_COLOR)


def 맞추기(src, ref):
    """탁구대 면(사진 아래쪽 41%)의 ORB 특징으로 호모그래피 — 사람이 있는 위쪽은 보지 않는다."""
    h, w = ref.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    mask[int(h * 0.59) :, :] = 255
    orb = cv2.ORB_create(6000)
    ka, da = orb.detectAndCompute(cv2.cvtColor(src, cv2.COLOR_BGR2GRAY), mask)
    kb, db = orb.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), mask)
    matches = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(da, db), key=lambda m: m.distance)[:800]
    A = np.float32([ka[m.queryIdx].pt for m in matches])
    B = np.float32([kb[m.trainIdx].pt for m in matches])
    H, inl = cv2.findHomography(A, B, cv2.RANSAC, 3.0)
    corners = np.float32([[w * 0.2, h * 0.6], [w * 0.8, h * 0.6], [w * 0.1, h * 0.72], [w * 0.9, h * 0.72]]).reshape(-1, 1, 2)
    moved = cv2.perspectiveTransform(corners, H) - corners
    return H, int(inl.sum()), float(np.abs(moved).max())


def 쓰기(bgr, 곳, 폭, q=82):
    im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    im = im.resize((폭, round(im.height * 폭 / im.width)), Image.LANCZOS)
    im.save(곳, "WEBP", quality=q, method=6)
    return im.size, 곳.stat().st_size // 1024


if __name__ == "__main__":
    ref = 읽기("ready")
    h, w = ref.shape[:2]
    print("ready", 쓰기(ref, 판 / "ready.webp", 900))
    for k in ["talk", "return", "miss", "cheer", "speak", "nod", "quick", "wow", "pump", "wait", "cheerup"]:
        if not (밖 / f"rally-{k}-nb_g{번호.get(k, 1)}.png").exists():
            print(k, "아직 없음")
            continue
        src = 읽기(k)
        H, inl, moved = 맞추기(src, ref)
        out = cv2.warpPerspective(src, H, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE) if moved >= 1 else src
        print(k, f"특징 {inl} · 어긋남 최대 {moved:.1f}px", 쓰기(out, 판 / f"{k}.webp", 900))
    for k in ["lobby", "result"]:
        p = 밖 / f"rally-{k}-nb_g{번호.get(k, 1)}.png"
        if p.exists():
            print(k, 쓰기(cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR), 인물 / f"{k}.webp", 1000))
