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
from PIL import Image, ImageFilter

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


def 알파써넣기(path):
    """정본 컷(마스코트_정본)은 이미 투명 배경이다 — 알파가 실재하면 그대로 쓰고, 아니면 채도 누끼."""
    im = Image.open(path)
    if "A" in im.getbands():
        rgba = im.convert("RGBA")
        if int(np.asarray(rgba)[:, :, 3].min()) < 10:
            return rgba.crop(rgba.getbbox())
    return 누끼(path)


def _스무스(p):
    p = min(1.0, max(0.0, p))
    return p * p * (3 - 2 * p)


def 키프레임(t, 점들):
    """(t,v) 키 사이를 스무스스텝으로 보간 — 키마다 속도 0이라 «뚝» 끊기는 지점이 없다."""
    if t <= 점들[0][0]:
        return 점들[0][1]
    for (t0, v0), (t1, v1) in zip(점들, 점들[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * _스무스((t - t0) / (t1 - t0))
    return 점들[-1][1]


def _눈찾기(im):
    """어두운 눈 요소(유리알·스티치)의 좌/우 중심. 못 찾으면 None — 호출부가 상대좌표 폴백을 쓴다.
    몸의 어두운 부위(체리 돔 상단·가장자리 림)는 세 제약으로 거른다:
    얼굴 띠(y 0.24~0.60H · x 0.16~0.84W) · 저채도(<60 — 림은 진홍이라 채도가 높다) · 몸 중앙값 대비 어둠."""
    a = np.asarray(im, dtype=np.int32)  # int16 은 255*299 에서 오버플로한다(실측 — 휘도가 음수가 됐다)
    alpha, rgb = a[:, :, 3], a[:, :, :3]
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    채도 = rgb.max(axis=2) - rgb.min(axis=2)
    h, w = lum.shape
    몸 = alpha > 200
    띠 = np.zeros_like(몸)
    띠[int(h * 0.24): int(h * 0.60), int(w * 0.16): int(w * 0.84)] = True
    안 = 몸 & 띠
    if not 안.any():
        return None
    본색 = float(np.median(lum[안]))
    후보 = None
    for 여유 in (60, 45, 30, 18):
        후보 = 안 & (채도 < 60) & (lum < 본색 - 여유)
        if int(후보.sum()) >= 120:
            break
    ys, xs = np.nonzero(후보)
    if len(xs) < 120:
        return None
    중x = float(np.median(xs))
    좌, 우 = xs < 중x, xs >= 중x
    if int(좌.sum()) < 40 or int(우.sum()) < 40:
        return None
    L = (float(xs[좌].mean()), float(ys[좌].mean()))
    R = (float(xs[우].mean()), float(ys[우].mean()))
    거리 = R[0] - L[0]
    if not (w * 0.16 <= 거리 <= w * 0.55) or abs(L[1] - R[1]) > h * 0.08:
        return None
    return L, R


def _소프트팽창(m, r1, r2):
    """이진 특징을 부드럽게 팽창시킨 알파 마스크로 — 경계가 절대 딱딱하지 않게."""
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8), "L")
    im = im.filter(ImageFilter.GaussianBlur(radius=r1))
    d = np.clip(np.asarray(im, dtype=np.float32) / 255.0 * 4.0, 0, 1)
    im2 = Image.fromarray((d * 255).astype(np.uint8), "L")
    im2 = im2.filter(ImageFilter.GaussianBlur(radius=r2))
    return np.asarray(im2, dtype=np.float32) / 255.0


def _페더(bw, bh, 폭):
    """패치 가장자리를 몸에 녹이는 알파 램프 — 경계선이 절대 보이면 안 된다."""
    wx = np.minimum(np.arange(bw) + 1, np.arange(bw)[::-1] + 1)
    wy = np.minimum(np.arange(bh) + 1, np.arange(bh)[::-1] + 1)
    return np.minimum(np.clip(wx / 폭, 0, 1)[None, :],
                      np.clip(wy / 폭, 0, 1)[:, None]).astype(np.float32)


def _깜빡(t):
    """깜빡임 가중 0→1→0. 감기 60ms·감은 채 40ms·뜨기 90ms — 전부 스무스라 프레임이 안 튄다."""
    b = 0.0
    for t0 in (1.05, 3.90, 5.35, 5.62, 9.15):
        p = t - t0
        if 0.0 <= p < 0.06:
            b = max(b, _스무스(p / 0.06))
        elif 0.06 <= p < 0.10:
            b = 1.0
        elif 0.10 <= p < 0.19:
            b = max(b, 1.0 - _스무스((p - 0.10) / 0.09))
    return b


# 시선 궤도: 정면 → 왼쪽(도착 후 미세 재고정 사케이드) → 오른쪽(오버슈트 후 정착) → 정면.
# 키마다 속도 0 + 사이는 스무스 — «이어지는» 느낌의 뼈대다.
시선키 = [(0.0, 0.0), (1.35, 0.0), (1.85, -1.0), (2.35, -1.0), (2.47, -1.14),
        (3.30, -1.14), (4.00, 1.10), (4.40, 1.0), (5.05, 1.0), (5.55, 0.0), (99.0, 0.0)]


def _웃음(t):
    if t < 5.90:
        return 0.0
    if t < 6.10:
        return _스무스((t - 5.90) / 0.20)
    if t < 8.10:
        return 1.0
    return 1.0 - _스무스((t - 8.10) / 0.28)


def 라이브(args):
    """«3D LIVE» 문법(유호 지시 08-14 「뚝뚝 끊기지 않고 전부 이어지는 살아있는 느낌」).

    스프라이트 «교체»가 아니라 **눈 레이어 분리 리깅**이다 — 몸은 한 컷으로 고정하고(실루엣이
    한 프레임도 안 튄다), 눈 영역만 패치로 잘라 ①시선 이동=패치 평행이동(몸보다 100ms 먼저
    간다 — 눈이 이끌고 머리가 따라오는 생물의 순서) ②깜빡임·눈웃음=패치 크로스페이드(60fps
    에서 4~9프레임 디졸브 = 모션블러로 읽힌다) 로 낸다. 몸은 부유·숨·기울기·원근 스퀴즈가
    전부 연속 사인·스무스스텝이라 어느 프레임에서도 속도가 점프하지 않는다.

    구현 동형성: 이 리깅이 곧 2단계(Rive 메시) 구현 명세다 — 몸 메시 + 눈 레이어 본(bone)
    이동 + 상태 크로스페이드. 1단계 Reanimated 로도 눈만 별도 <Image> 레이어로 얹으면 같다.

    색 정직성: 눈 합성은 원본 픽셀의 가중 평균(크로스페이드)이고, 표정 패치에만 피부 링
    기준 게인 보정(0.90~1.12 클립)을 한 번 건다 — 컷 간 조명 차가 정본 본색을 흔들지 않게
    «기본 컷 쪽으로» 맞추는 것이라 확정 hex 보존 장치다. 결과는 코어 ΔE 로 되묻는다.

    합성은 원본 해상도에서 하고 마지막에 한 번 축소한다 — 시선 이동의 서브픽셀이 여기서
    나온다(출력 해상도에서 1px 계단이면 «미세 스터터»로 읽힌다).
    """
    fps, 길이초 = 60, 10.0
    접두 = args.접두
    경로 = {
        "기본": os.path.join(args.컷폴더, f"{접두}{args.기본}.png"),
        "감음": os.path.join(args.컷폴더, (args.감음컷 or f"{접두}눈감음") + ".png"),
        "웃음": os.path.join(args.컷폴더, (args.웃음컷 or f"{접두}눈웃음") + ".png"),
    }
    없는것 = [p for p in 경로.values() if not os.path.exists(p)]
    if 없는것:
        print("🔴 컷이 없다 — 안 돌린 것이다(통과 아님):", *없는것, sep="\n  ")
        return 2

    기본컷 = 알파써넣기(경로["기본"])
    W0, H0 = 기본컷.size
    컷들 = {"기본": 기본컷}
    for k in ("감음", "웃음"):
        im = 알파써넣기(경로[k])
        배율 = W0 / im.width  # 실루엣 폭 기준 정규화(교대·크로스페이드 시 크기 안 튐)
        컷들[k] = im.resize((W0, max(1, int(im.height * 배율))), Image.LANCZOS)

    기본눈 = _눈찾기(기본컷)
    if 기본눈 is None:
        print("🔴 기본 컷에서 눈을 못 찾았다 — 리깅 불가(통과 아님)")
        return 2
    L, R = 기본눈
    눈거리 = R[0] - L[0]
    중점 = ((L[0] + R[0]) / 2.0, (L[1] + R[1]) / 2.0)

    # 패치 상자(기본 기준 · 전 컷 공용 크기) — 여백은 최대 시선 이동(±0.076·눈거리)보다 훨씬 크다.
    padx, pady = 눈거리 * 0.34, 눈거리 * 0.30
    x0, y0 = int(중점[0] - 눈거리 / 2 - padx), int(중점[1] - pady)
    x1, y1 = int(중점[0] + 눈거리 / 2 + padx), int(중점[1] + pady)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W0, x1), min(컷들["기본"].height, y1)
    bw, bh = x1 - x0, y1 - y0
    페더판 = _페더(bw, bh, 눈거리 * 0.10)

    def 패치(im, 중심):
        cx, cy = 중심
        px0, py0 = int(round(cx - bw / 2)), int(round(cy - bh / 2))
        px0 = max(0, min(im.width - bw, px0))
        py0 = max(0, min(im.height - bh, py0))
        return np.asarray(im.crop((px0, py0, px0 + bw, py0 + bh)), dtype=np.float32)

    P = {"기본": 패치(기본컷, 중점)}
    검출로그 = []
    for k in ("감음", "웃음"):
        찾음 = _눈찾기(컷들[k])
        if 찾음 is not None:
            Le, Re = 찾음
            중심e = ((Le[0] + Re[0]) / 2.0, (Le[1] + Re[1]) / 2.0)
            검출로그.append(f"{k}=검출")
        else:  # 유리 곡선(체리 감은 눈)은 어둠 신호가 약하다 — 같은 참조 렌더라 상대좌표로 진다
            중심e = (중점[0], 중점[1] * 컷들[k].height / H0)
            검출로그.append(f"{k}=상대폴백")
        P[k] = 패치(컷들[k], 중심e)

    # 피부 링 게인 — 컷 간 조명 차를 «기본 쪽으로» 맞춘다(확정 hex 보존 · 0.90~1.12 클립).
    a0 = np.asarray(기본컷, dtype=np.int32)
    안대역 = (a0[:, :, 3] > 200)
    lum0 = (a0[:, :, 0] * 299 + a0[:, :, 1] * 587 + a0[:, :, 2] * 114) // 1000
    본색밝기 = float(np.median(lum0[안대역[int(H0 * 0.24):int(H0 * 0.60)].nonzero()[0] + int(H0 * 0.24),
                                np.nonzero(안대역[int(H0 * 0.24):int(H0 * 0.60)])[1]])) if 안대역.any() else 128.0
    링 = (페더판 < 0.999)
    게인로그 = []
    for k in ("감음", "웃음"):
        기L = (P["기본"][:, :, 0] * 0.299 + P["기본"][:, :, 1] * 0.587 + P["기본"][:, :, 2] * 0.114)
        pL = (P[k][:, :, 0] * 0.299 + P[k][:, :, 1] * 0.587 + P[k][:, :, 2] * 0.114)
        m = 링 & (P["기본"][:, :, 3] > 200) & (P[k][:, :, 3] > 200) \
            & (기L > 본색밝기 - 35) & (pL > 본색밝기 - 35)
        if int(m.sum()) > 200:
            g = np.clip(P["기본"][:, :, :3][m].mean(axis=0) / np.maximum(P[k][:, :, :3][m].mean(axis=0), 1.0),
                        0.90, 1.12)
            P[k][:, :, :3] *= g
            게인로그.append(f"{k}={g.round(3).tolist()}")

    # 상태별 «특징 마스크» — 패치 사각형 전체가 아니라 **변한 픽셀만** 몸 위에 얹는다.
    # (사각 전체를 얹으면 컷 간 광택·양모 결 차이가 «창문»으로 보인다 — 정지컷 실측 08-14)
    # 뜬 눈 = 어두운 눈 요소를 최대 시선 이동(0.076·눈거리)보다 넓게 소프트 팽창.
    # 표정 = 기본과의 차이를 블러 후 임계(양모 섬유 노이즈는 블러에서 죽고 스티치·지움 자리만 남는다).
    기L패 = (P["기본"][:, :, 0] * 0.299 + P["기본"][:, :, 1] * 0.587 + P["기본"][:, :, 2] * 0.114)
    M = {"기본": _소프트팽창((기L패 < 본색밝기 - 40).astype(np.float32),
                          눈거리 * 0.09, 눈거리 * 0.03)}
    for k in ("감음", "웃음"):
        d = np.abs(P[k][:, :, :3] - P["기본"][:, :, :3]).mean(axis=2)
        d = np.asarray(Image.fromarray(np.clip(d, 0, 255).astype(np.uint8), "L")
                       .filter(ImageFilter.GaussianBlur(radius=눈거리 * 0.02)), dtype=np.float32)
        M[k] = _소프트팽창(np.clip((d - 12.0) / 18.0, 0, 1), 눈거리 * 0.05, 눈거리 * 0.03)

    기본알파 = 기본컷.split()[3]
    원본색 = 코어색(기본컷)
    무대판 = 배경(args.폭, args.높이)
    목표폭 = args.폭 * args.비율
    총 = int(길이초 * fps)

    정지컷들 = [float(s) for s in args.정지컷.split(",")] if args.정지컷 else None
    tmp = args.정지컷폴더 if 정지컷들 else tempfile.mkdtemp(prefix="mascot_live_")
    os.makedirs(tmp, exist_ok=True)
    최대ΔE = 0.0

    def 프레임렌더(i, t, 저장경로):
        nonlocal 최대ΔE
        s = _웃음(t)
        b = _깜빡(t) * (1.0 - s)
        시선눈 = 키프레임(t + 0.10, 시선키)   # 눈이 먼저 간다
        시선몸 = 키프레임(t - 0.08, 시선키)   # 머리는 100ms 늦게 따라온다
        표류 = 0.006 * math.sin(2 * math.pi * 0.4 * t + 0.7) + 0.004 * math.sin(2 * math.pi * 0.9 * t)
        edx = (시선눈 * 0.058 + 표류) * 눈거리
        edy = (0.010 * math.sin(2 * math.pi * 0.5 * t + 2.1) - 0.012 * s) * 눈거리

        wo = 1.0 - s - b
        눈합 = P["기본"] * wo + P["감음"] * b + P["웃음"] * s
        마스크 = np.clip(M["기본"] * wo + M["감음"] * b + M["웃음"] * s, 0, 1)
        알파 = np.clip(눈합[:, :, 3], 0, 255) * 페더판 * 마스크
        패치판 = Image.fromarray(
            np.dstack([np.clip(눈합[:, :, :3], 0, 255), 알파]).astype(np.uint8), "RGBA")
        몸 = 컷들["기본"].copy()
        몸.paste(패치판, (x0 + int(round(edx)), y0 + int(round(edy))), 패치판)
        몸.putalpha(기본알파)  # paste 는 알파도 섞는다 — 안 되돌리면 무대색이 사각 테두리로 비친다(실측)

        숨 = 1.0 + 0.011 * math.sin(2 * math.pi * 0.3 * t)
        sx = 숨 * (1.0 - 0.03 * abs(시선몸))          # 원근 스퀴즈 — 돌아본 만큼 살짝 좁아진다
        sy = 숨
        dy = 8.0 * math.sin(2 * math.pi * 0.2 * t) + 3.0 * math.sin(2 * math.pi * 0.5 * t + 1.3)
        기울기 = -3.2 * 시선몸
        if s > 0.0:  # 눈웃음 — 잦아드는 통통 튐(전부 지수 감쇠 · 어디서도 안 끊긴다)
            p = max(0.0, t - 5.90)
            env = s * math.exp(-1.6 * p)
            튐 = env * abs(math.sin(2 * math.pi * 1.35 * p))
            dy -= 26.0 * 튐
            기울기 += 2.4 * env * math.sin(2 * math.pi * 2.1 * p)
            sy *= 1.0 + 0.04 * env * math.sin(2 * math.pi * 1.35 * p)
            sx *= 1.0 - 0.03 * env * math.sin(2 * math.pi * 1.35 * p)

        tw = max(1, int(목표폭 * sx))
        th = max(1, int(몸.height * (목표폭 / W0) * sy))
        스 = 몸.resize((tw, th), Image.LANCZOS)
        if abs(기울기) > 0.05:
            스 = 스.rotate(기울기, resample=Image.BICUBIC, expand=True)
        w, h = 스.size
        프레임 = 무대판.copy()
        px = int((args.폭 - w) / 2 + 시선몸 * 16.0)
        py = int(args.높이 * 0.40 - h / 2 + dy)
        프레임.paste(스, (px, py), 스)
        프레임.save(저장경로)
        if i % 30 == 0:
            d = float(np.linalg.norm(_lab(코어색(스)) - _lab(원본색)))
            최대ΔE = max(최대ΔE, d)

    if 정지컷들:
        for t in 정지컷들:
            프레임렌더(0, t, os.path.join(tmp, f"정지_{t:.2f}s.png"))
        print(f"✅ 정지컷 {len(정지컷들)}장 → {tmp} · 눈검출: 기본=검출 · {' · '.join(검출로그)}")
        return 0

    for i in range(총):
        프레임렌더(i, i / fps, os.path.join(tmp, f"{i:04d}.png"))

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
    print(f"✅ {args.출력} — {총}프레임 {길이초}초 @{fps}fps · 문법=라이브 · {크기:.0f}KB")
    print(f"   눈검출: 기본=검출 · {' · '.join(검출로그)}"
          + (f" · 피부게인 {' · '.join(게인로그)}" if 게인로그 else ""))
    print(f"   코어 무손상: 최대 ΔE {최대ΔE:.2f} (임계 2.0) {'OK' if 최대ΔE <= 2.0 else '🔴 초과'}")
    print(f"   모든 주기(부유 0.2/0.5 · 숨 0.3 · 표류 0.4/0.9/0.5Hz)가 10초의 배수 — 무한 루프 재생 가능")
    return 0 if 최대ΔE <= 2.0 else 1


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
    ap.add_argument("--문법", default="보간", choices=["보간", "스톱모션", "라이브"],
                    help="보간=젤리 물리(30fps 연속) · 스톱모션=인형극(24fps 컨테이너·12fps 투스) · "
                         "라이브=눈 레이어 분리 리깅(60fps · 시선/깜빡임/눈웃음 전부 이어짐)")
    ap.add_argument("--감음컷", default=None, help="깜빡임 컷 파일명(확장자 제외 · 기본={접두}눈감음)")
    ap.add_argument("--웃음컷", default=None, help="눈웃음 컷 파일명(확장자 제외 · 기본={접두}눈웃음)")
    ap.add_argument("--정지컷", default=None, help="라이브 전용: 't1,t2,…' 초의 정지 프레임만 굽고 종료(검수용)")
    ap.add_argument("--정지컷폴더", default=None, help="정지컷 저장 폴더")
    args = ap.parse_args()

    if args.문법 == "라이브":
        return 라이브(args)

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
