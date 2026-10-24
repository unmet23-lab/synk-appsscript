# 콘티 v4 영상 시작 그림(2026-10-24) — 이미지 콘티의 맞춘 판(synk-vendor/…/콘티/v4/컷/S<컷>.jpg)을 Flow에 넣을 시작 그림으로 옮긴다.
#   python -X utf8 영상시작_v4.py S01 S03 …   → synk-vendor/…/영상/시작_v4/S<컷>.jpg(1920×1080) · _시작기록.json
# 이미지 콘티 Fable 검토에서 「영상 시작 그림 단계로 미룸」이었던 것을 여기서 한다(04 10절 「검토」 줄):
#  - #8 · #17 · #20 리4 클로즈업은 원본(밝기 중앙 64~70)보다 어둡다(46~48) → 중간 밝기를 64 쪽으로 감마로 올린다(흰 곳은 그대로, 최대 0.75).
#  - #30은 휙 흐림 없이 또렷한 판으로(흐림은 편집에서 첫 0.28초에) — 흐린 그림을 넣으면 영상 모델이 흐림을 이어 그린다.
#  - #9(주머니를 들여다보는 첫 자세) · #15(왼손 주머니)는 새로 구운 판을 이미지콘티_v4_맞춤.py로 맞춘 뒤 이 스크립트에 넣는다.
import importlib.util
import json
import os
import shutil
import sys

import cv2
import numpy as np

V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/"
SRC = V + "콘티/v4/컷/"
OUT = V + "영상/시작_v4/"
BRIGHT = {"S08", "S17", "S20"}
TARGET = 64


def read(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def lift(img):
    g = float(np.median(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)))
    gamma = max(0.75, min(1.0, np.log(TARGET / 255) / np.log(max(g, 1) / 255)))
    lut = np.clip(255 * (np.arange(256) / 255) ** gamma, 0, 255).astype(np.uint8)
    out = cv2.LUT(img, lut)
    return out, f"밝기 중앙 {g:.0f} → {np.median(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)):.0f}(감마 {gamma:.2f})"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    lp = OUT + "_시작기록.json"
    log = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("fit", os.path.join(here, "이미지콘티_v4_맞춤.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    for arg in sys.argv[1:]:
        cid, _, newpick = arg.partition("=")   # S09=S09f1_155241.jpg — 영상 시작 그림만 새로 구운 판(받음/v4/)을 원본 자리 · 빛에 맞춰 넣는다
        newpick, _, win = newpick.partition("@")   # …@x0,y0,폭 — 원본 크기로 자르면 소품이 잘릴 때 손으로 정한 창(그 판에만)
        dst = OUT + cid + ".jpg"
        if newpick:
            n = int(cid[1:3])
            keep = m.CROP.get(n)
            if win:
                m.CROP[n] = tuple(int(v) for v in win.split(","))
            _, note = m.fit(n, V + "받음/v4/" + newpick, out=dst)
            if keep is None:
                m.CROP.pop(n, None)
            else:
                m.CROP[n] = keep
            note = f"새로 구운 판 {newpick} · " + note
        elif cid == "S30":
            _, note = m.fit(30, V + "정지컷/v4/S30.png", blur=False, out=dst)
            note = "휙 흐림 없는 또렷한 판 · " + note
        elif cid in BRIGHT:
            img, note = lift(read(SRC + cid + ".jpg"))
            cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(dst)
        else:
            shutil.copyfile(SRC + cid + ".jpg", dst)
            note = "이미지 콘티 판 그대로"
        log[cid] = note
        print(cid, note)
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
