# -*- coding: utf-8 -*-
"""마스코트 «모션 프리베이크» — 앱에서 실제로 돌 방식 그대로 미리 굽는다.

왜 생성 모델로 안 만드나(유호 질문 08-14 「눈 깜빡이거나 웃는 거 동영상으로」에 대한 답):
  Veo 류에 마스코트를 통째로 넣으면 매 프레임 재렌더라 확정 hex 가 사라진다(🚫 조항 ·
  메모리 mascot-video-tooling). 그리고 더 중요한 건 **앱이 그렇게 안 움직인다** —
  앱은 스프라이트(눈 뜬/감은/눈웃음)를 «교체»하고 나머지는 코드 트랜스폼으로 낸다
  (character-customization-verdict: 1단계 Reanimated → 2단계 Rive 메시 리깅).
  그래서 이 도구는 그 구현을 그대로 흉내 낸다 — 이 영상이 곧 구현 명세다.

무손상 규격(마스코트영상합성.py 승계):
  원본 PNG 를 «얹기만» 한다. 변형은 위치·스케일뿐이고 **색 연산은 0**이다.
  squash 는 비균등 스케일이라 리샘플링이 끼지만 그것도 색 계산이 아니다 —
  그 사실을 --검증 이 코어 ΔE 로 되묻는다(임계 2.0: 리샘플 여유).

타임라인(6초 @30fps · 실제 앱 상태 전이와 1:1):
  0.0~2.2  대기      부유(sin) + 숨쉬기(미세 scale) + 자연 깜빡임
  2.2~2.5  탭 눌림   squash&stretch 스프링(300ms 상한 — DESIGN.md 감각 규칙)
  2.5~4.2  칭찬 반응 눈웃음 스프라이트 + 통통 튐(감쇠)
  4.2~6.0  대기 복귀 깜빡임 1회

틀릴 때의 모습: 스프라이트 3컷의 실루엣·조명이 어긋나면 교대 순간 «튄다».
  그건 이 도구가 아니라 컷 생성 단계의 결함이라 여기서 안 고친다(같은 참조로 다시 굽는다).
"""
import argparse
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
길이 = 6.0
무대 = (15, 23, 48)  # Navy 2 #0F1730 — 킷 다크 무대


def 누끼(path):
    """가장자리 플러드필로 무채색 배경만 걷는다(마스코트정본.py 와 같은 기준: 채도).
    밝기로 가르면 양모의 밝은 잔털이 함께 지워진다."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.int16)
    mx, mn = a.max(axis=2), a.min(axis=2)
    채도 = (mx - mn)
    배경후보 = (채도 <= 18) & (mx >= 150)  # 무채색 + 밝음

    h, w = 배경후보.shape
    방문 = np.zeros((h, w), dtype=bool)
    스택 = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
    스택 += [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    스택 = [(y, x) for y, x in 스택 if 배경후보[y, x]]
    for y, x in 스택:
        방문[y, x] = True
    while 스택:
        y, x = 스택.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not 방문[ny, nx] and 배경후보[ny, nx]:
                방문[ny, nx] = True
                스택.append((ny, nx))

    알파 = np.where(방문, 0, 255).astype(np.uint8)
    out = np.dstack([np.asarray(im, dtype=np.uint8), 알파])
    잘린 = Image.fromarray(out, "RGBA")
    return 잘린.crop(잘린.getbbox())


def 배경(폭, 높이):
    """다크 무대 + 좌상단 따뜻한 빛 — 앱 화면 시안과 같은 무대."""
    y, x = np.mgrid[0:높이, 0:폭].astype(np.float32)
    d = np.sqrt(((x - 폭 * 0.1) / (폭 * 1.1)) ** 2 + ((y - 높이 * 0.05) / (높이 * 0.55)) ** 2)
    빛 = np.clip(1.0 - d, 0, 1) ** 2.2
    바탕 = np.zeros((높이, 폭, 3), dtype=np.float32)
    for i, c in enumerate(무대):
        바탕[:, :, i] = c
    따뜻 = np.array([255, 214, 170], dtype=np.float32)
    for i in range(3):
        바탕[:, :, i] += (따뜻[i] - 바탕[:, :, i]) * 빛 * 0.30
    return Image.fromarray(np.clip(바탕, 0, 255).astype(np.uint8), "RGB")


def 상태(t):
    """그 시각의 스프라이트·변형을 정한다 — 앱 상태 머신과 같은 모양. (문법=보간 · 젤리 물리)"""
    깜빡 = any(abs(t - c) < 0.075 for c in (0.9, 1.75, 5.1))
    웃음 = 2.5 <= t < 4.2

    # 부유 + 숨쉬기(대기 중에만 · 반응 중엔 반응이 이긴다)
    떠오름 = math.sin(t * 1.9) * 10.0
    숨 = 1.0 + math.sin(t * 2.4) * 0.012

    sx = sy = 숨
    if 2.2 <= t < 2.5:  # 탭 눌림 — 스프링 squash
        p = (t - 2.2) / 0.3
        s = math.sin(p * math.pi)
        sx, sy = 숨 * (1 + 0.13 * s), 숨 * (1 - 0.15 * s)
        떠오름 += 14 * s
    elif 웃음:  # 칭찬 — 통통 튐(감쇠)
        p = t - 2.5
        튐 = math.exp(-p * 2.6) * math.sin(p * 13.0)
        떠오름 -= 26 * abs(튐) * 0.7
        sx, sy = 숨 * (1 - 0.05 * 튐), 숨 * (1 + 0.06 * 튐)

    컷 = "눈감음" if 깜빡 else ("눈웃음" if 웃음 else "기본")
    return 컷, 떠오름, sx, sy, 0.0, (0.0, 0.0)


def 상태_스톱모션(t):
    """펠트 문법 = «스톱모션 인형극»(아드만 교체 애니·몰카 계열).

    젤리 물리를 펠트에 씌우면 «고무 인형에 양모 씌운 것»으로 읽힌다 — 재질 정직성 위반.
    펠트가 사는 길은 실물 인형극의 세 가지다:
      ① 투스(on twos) — 캐릭터 시간을 12fps 스텝으로 양자화(24fps 컨테이너에 스텝당 2프레임).
         «손으로 한 장씩 찍은» 리듬이 이것 하나에서 나온다.
      ② 변형 대신 자세 — squash 는 3% 이내(양모가 눌리는 만큼만), 반응은 홉·기울임·움찔로.
      ③ 보일(boil) — 스텝마다 ±1px·±0.5° 미세 지터. 실물 스톱모션에서 프레임마다 손이
         닿아 생기는 «살아있는 떨림»의 디지털 등가물. 시드=스텝 번호(재현 가능·Date 없음).
    """
    스텝 = int(t * 12)
    ts = 스텝 / 12.0  # 캐릭터는 이 시간만 안다 — 부드러운 t 를 쓰면 문법이 죽는다

    깜빡 = any(abs(ts - c) < 0.085 for c in (0.9, 1.75, 5.3))
    웃음 = 2.9 <= ts < 4.6

    떠오름 = round(math.sin(ts * 1.6) * 7.0)  # 대기 봅(bob) — 양자화돼 뚝뚝 끊기는 게 정답
    sx = sy = 1.0 + math.sin(ts * 2.4) * 0.008  # 숨은 아주 얕게(양모는 거의 안 늘어난다)
    기울기 = 0.0

    if 2.2 <= ts < 2.4:  # 예비 동작(anticipation) — 웅크림
        sx, sy = 1.02, 0.96
        떠오름 += 8
    elif 2.4 <= ts < 2.75:  # 홉 — 포물선 + 진행 방향으로 기울기
        p = (ts - 2.4) / 0.35
        떠오름 -= 34 * math.sin(p * math.pi)
        기울기 = 4.0 * math.sin(p * math.pi)
    elif 2.75 <= ts < 2.9:  # 착지 — 반동
        sx, sy = 1.03, 0.97
        떠오름 += 5
        기울기 = -2.0
    elif 웃음:  # 칭찬 — 좌우로 번갈아 기우는 «인형극 춤» + 잦아드는 홉 2회
        p = ts - 2.9
        감쇠 = math.exp(-p * 1.4)
        기울기 = 5.0 * 감쇠 * math.sin(p * 7.4)
        떠오름 -= 16 * 감쇠 * abs(math.sin(p * 5.2))

    # ③ 보일 — 스텝이 시드라 같은 스텝은 늘 같은 값(재현 가능)
    rng = np.random.default_rng(스텝)
    지터 = (float(rng.uniform(-1.4, 1.4)), float(rng.uniform(-1.0, 1.0)))
    기울기 += float(rng.uniform(-0.5, 0.5))

    컷 = "눈감음" if 깜빡 else ("눈웃음" if 웃음 else "기본")
    return 컷, 떠오름, sx, sy, 기울기, 지터


def 코어색(img):
    """알파 있는 영역의 «채도 상위» 픽셀 평균 — 코어(양모 본색)의 대표값."""
    a = np.asarray(img.convert("RGBA"), dtype=np.int16)
    m = a[:, :, 3] > 200
    rgb = a[:, :, :3][m]
    채도 = rgb.max(axis=1) - rgb.min(axis=1)
    고른 = rgb[채도 >= np.percentile(채도, 70)]
    return 고른.mean(axis=0)


def _lab(rgb):
    c = np.array(rgb, dtype=float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = m @ c
    t = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷폴더", default=os.path.join(ROOT, "docs", "캐릭터", "재질대조_0814"))
    ap.add_argument("--접두", default="펠트_", help="컷 파일 접두(펠트_ / 글래시_)")
    ap.add_argument("--기본", default="본체")
    ap.add_argument("--출력", required=True)
    ap.add_argument("--폭", type=int, default=720)
    ap.add_argument("--높이", type=int, default=1280)
    ap.add_argument("--비율", type=float, default=0.46, help="마스코트 폭 / 화면 폭")
    ap.add_argument("--문법", default="보간", choices=["보간", "스톱모션"],
                    help="보간=젤리 물리(30fps 연속) · 스톱모션=인형극(24fps 컨테이너·12fps 투스)")
    args = ap.parse_args()

    fps = 24 if args.문법 == "스톱모션" else FPS
    상태함수 = 상태_스톱모션 if args.문법 == "스톱모션" else 상태

    경로 = {
        "기본": os.path.join(args.컷폴더, f"{args.접두}{args.기본}.png"),
        "눈감음": os.path.join(args.컷폴더, f"{args.접두}눈감음.png"),
        "눈웃음": os.path.join(args.컷폴더, f"{args.접두}눈웃음.png"),
    }
    없는것 = [p for p in 경로.values() if not os.path.exists(p)]
    if 없는것:
        print("🔴 컷이 없다 — 안 돌린 것이다(통과 아님):", *없는것, sep="\n  ")
        return 2

    컷들 = {k: 누끼(v) for k, v in 경로.items()}
    원본색 = {k: 코어색(v) for k, v in 컷들.items()}

    # 세 컷을 «같은 자»로 놓는다 — 실루엣 폭 기준(교대 시 크기가 튀면 안 된다).
    목표폭 = int(args.폭 * args.비율)
    for k, im in 컷들.items():
        배율 = 목표폭 / im.width
        컷들[k] = im.resize((목표폭, max(1, int(im.height * 배율))), Image.LANCZOS)

    무대판 = 배경(args.폭, args.높이)
    총 = int(길이 * fps)
    tmp = tempfile.mkdtemp(prefix="mascot_motion_")
    최대ΔE = 0.0

    for i in range(총):
        t = i / fps
        컷, dy, sx, sy, 기울기, (jx, jy) = 상태함수(t)
        기 = 컷들[컷]
        w, h = max(1, int(기.width * sx)), max(1, int(기.height * sy))
        스 = 기.resize((w, h), Image.LANCZOS)
        if abs(기울기) > 0.05:  # 회전은 중심 기준 — 작은 각이라 앵커 오차 무시 가능
            스 = 스.rotate(기울기, resample=Image.BICUBIC, expand=True)
            w, h = 스.size

        프레임 = 무대판.copy()
        x = int((args.폭 - w) / 2 + jx)
        y = int(args.높이 * 0.40 - h / 2 + dy + jy)
        프레임.paste(스, (x, y), 스)
        프레임.save(os.path.join(tmp, f"{i:04d}.png"))

        if i % 15 == 0:  # 색 무손상을 주기적으로 되묻는다
            d = float(np.linalg.norm(_lab(코어색(스)) - _lab(원본색[컷])))
            최대ΔE = max(최대ΔE, d)

    os.makedirs(os.path.dirname(os.path.abspath(args.출력)) or ".", exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", args.출력,
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print("🔴 ffmpeg 실패:", r.stderr.decode("utf-8", "replace")[-500:])
        return 1

    크기 = os.path.getsize(args.출력) / 1024
    print(f"✅ {args.출력} — {총}프레임 {길이}초 @{fps}fps · 문법={args.문법} · {크기:.0f}KB")
    print(f"   코어 무손상: 최대 ΔE {최대ΔE:.2f} (임계 2.0 — 리샘플 여유) "
          f"{'OK' if 최대ΔE <= 2.0 else '🔴 초과'}")
    print(f"   스프라이트 3컷 교대 = 앱 구현과 동형(색 연산 0 · 변형은 위치·스케일뿐)")
    return 0 if 최대ΔE <= 2.0 else 1


if __name__ == "__main__":
    sys.exit(main())
