# -*- coding: utf-8 -*-
"""
상태 컷 정합 검수 — 같은 오브젝트의 «상태 세트»가 교대할 때 튀는지 잰다 (2026-08-14).

왜 있나:
  명품판 패키지 §7-2 는 「녹음 오브 3상태는 **실루엣 일치 필수** — 안 맞으면 그 상태만 재생성」이라고
  적어 두었지만 재는 기계가 없었다. 그래서 눈으로 「비슷해 보인다」로 통과했고, 실제로는 상태마다
  크기·색이 달라 앱에서 교대하는 순간 튄다(정지 컷 3장을 나란히 보면 안 보이고, 겹쳐야 보인다).
  프로즈를 기계로 옮긴다 — 이 파일이 닫는 것은 그 §7-2 손 검수 문장 하나다.

무엇을 재나 (셋 다 «교대할 때 튀는 이유»다):
  ① 크기·자리 — 물체 bbox 의 지름과 중심. 상태마다 다르면 교대 순간 물체가 «점프»한다.
  ② 색 — 코어색을 Lab 으로 갈라 **ΔL(밝기) 과 ΔH(색상)을 따로** 본다.
     이 구분이 급소다: 명세가 녹음중에 요구하는 것은 「inner glow pulsing **brighter**」 —
     즉 **ΔL 은 커도 정상이고 ΔH 가 크면 위반**이다(같은 재질이 색이 변할 수는 없다).
     합쳐서 ΔE 하나로 재면 정상인 밝기 변화와 위반인 색 변화가 한 숫자에 섞여 판정을 못 낸다.
  ③ 입체감 — 중심 대비 테두리 광량 낙차. 구체는 테두리가 어둡고(부피), 평면 렌즈는 평평하다.
     같은 세트에 구체와 디스크가 섞이면 재질이 같아도 «다른 물건»으로 읽힌다.

⚠ 틀릴 때의 모습(= 이 장치가 새는 방향):
  배경 규격(밝은 무지 #E6E4E2)이 아닌 컷 — 예컨대 패키지 §5 의 **다크 무대판** — 을 넣으면
  배경 추정이 물체를 통째로 배경으로 먹어 마스크가 비고, **위반 0 = 통과**의 얼굴로 나온다.
  그래서 마스크 면적이 프레임의 2~95% 밖이면 통과시키지 않고 🔴 로 드러내고 종료한다.
  (탐지력 자체는 이 파일이 지지 않는다 — 판정 재료는 늘 사람이 그림도 같이 본다.)

사용법:
  python tools/상태컷정합.py 기준.png 비교1.png 비교2.png
  python tools/상태컷정합.py --기준 대기 docs/캐릭터/명품판_0814/녹음오브_*.png
종료 코드: 0=정합 · 1=어긋난 상태 있음 · 2=검사 불가(배경 규격 밖·파일 없음)
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # cp949 콘솔에서 🔴 · ΔE 가 죽는다

# 임계 — 「교대할 때 사람 눈에 튀는가」 기준. 지름·중심은 지름 대비 비율이라 캔버스 크기와 무관하다.
임계 = dict(지름=0.04, 세로가로=0.06, 중심=0.03, 색상=3.0, 입체=0.35)


def _lab(rgb):
    """sRGB → CIE Lab. tools/마스코트모션.py 의 같은 이름 함수와 같은 식(그쪽은 배열 1개 전용)."""
    c = np.array(rgb, dtype=float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = m @ c
    t = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def 물체마스크(im):
    """밝은 무지 배경에서 물체를 가른다. 배경색은 테두리 띠의 중앙값으로 «재서» 쓴다(하드코딩 금지 —
    컷마다 배경이 미세하게 다르고, 규격 밖 컷을 조용히 통과시키지 않으려면 실측이어야 한다)."""
    a = np.asarray(im.convert("RGB"), dtype=np.int16)
    h, w = a.shape[:2]
    띠 = max(4, min(h, w) // 64)
    가장자리 = np.concatenate([a[:띠].reshape(-1, 3), a[-띠:].reshape(-1, 3),
                              a[:, :띠].reshape(-1, 3), a[:, -띠:].reshape(-1, 3)])
    배경 = np.median(가장자리, axis=0)
    거리 = np.sqrt(((a - 배경) ** 2).sum(axis=2))
    m = 거리 > 25
    # 우하단 생성 표식·먼지 같은 작은 얼룩을 뺀다 — 행·열이 «충분히» 채워졌을 때만 물체로 친다.
    행 = m.sum(axis=1) > w * 0.005
    열 = m.sum(axis=0) > h * 0.005
    m &= 행[:, None] & 열[None, :]
    return m, 배경


def 측정(경로):
    im = Image.open(경로)
    m, 배경 = 물체마스크(im)
    a = np.asarray(im.convert("RGB"), dtype=np.int16)
    h, w = a.shape[:2]
    비율 = m.sum() / (h * w)
    if not (0.02 <= 비율 <= 0.95):
        raise ValueError(f"배경 규격 밖으로 보인다 — 물체가 프레임의 {비율:.1%} "
                         f"(배경 추정 rgb{tuple(int(v) for v in 배경)}). 밝은 무지 배경 컷만 잰다.")
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    지름 = ((x1 - x0 + 1) + (y1 - y0 + 1)) / 2
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    # 코어색 = 물체 안 «채도 상위 30%» 평균(하이라이트·테두리 어둠에 안 끌리는 대표값).
    rgb = a[m]
    채도 = rgb.max(axis=1) - rgb.min(axis=1)
    코어 = rgb[채도 >= np.percentile(채도, 70)].mean(axis=0)

    # 입체감 = 중심부(0~25%R) 대비 테두리(75~90%R) 광량비. 구체는 테두리가 어둡고, 평면은 비슷하다.
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - cx) / (지름 / 2)) ** 2 + ((yy - cy) / (지름 / 2)) ** 2)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    중심 = lum[m & (r <= 0.25)].mean()
    테두리 = lum[m & (r >= 0.75) & (r <= 0.90)].mean()
    return dict(이름=os.path.basename(경로), 캔버스=(w, h), 지름=지름,
                폭=x1 - x0 + 1, 높이=y1 - y0 + 1, 세로가로=(y1 - y0 + 1) / (x1 - x0 + 1),
                중심=(cx / w, cy / h), 코어=코어, 낙차=float(테두리 / max(중심, 1e-6)))


def 대조(기준, 그것, 변형=False):
    """변형=True 는 «명세가 일부러 형태를 바꾸라고 한» 상태(처리중의 squash 같은 것)다.
    그런 컷에 실루엣·입체 게이트를 물리면 명세대로 나온 컷이 빨개진다 — 우는 가드는 곧 무시당한다.
    ⚠단 크기·중심·색상은 변형 상태에도 그대로 문다: 찌그러져도 «같은 물건»이어야 하고,
    부피가 보존되면 세로가 준 만큼 가로가 늘어 평균 지름은 유지된다."""
    L1, L2 = _lab(기준["코어"]), _lab(그것["코어"])
    dL = abs(L2[0] - L1[0])
    dH = float(np.hypot(L2[1] - L1[1], L2[2] - L1[2]))   # ab 평면 거리 = 색상·채도 차
    dE = float(np.linalg.norm(L2 - L1))
    # ⚠부호를 죽이지 않는다 — abs 로 재서 «+14%»로 찍으면 «작아졌다»가 «커졌다»의 얼굴로 나온다(실측 08-14).
    d지름 = (그것["지름"] - 기준["지름"]) / 기준["지름"]
    d세로가로 = 그것["세로가로"] - 기준["세로가로"]
    d중심 = max(abs(그것["중심"][0] - 기준["중심"][0]), abs(그것["중심"][1] - 기준["중심"][1]))
    d입체 = abs(그것["낙차"] - 기준["낙차"])
    어긋남 = []
    if abs(d지름) > 임계["지름"]:
        어긋남.append(f"크기 {d지름:+.1%}(임계 ±{임계['지름']:.0%})")
    if not 변형 and abs(d세로가로) > 임계["세로가로"]:
        어긋남.append(f"실루엣 세로/가로 {그것['세로가로']:.2f} vs {기준['세로가로']:.2f}")
    if d중심 > 임계["중심"]:
        어긋남.append(f"중심 {d중심:.1%}(임계 {임계['중심']:.0%})")
    if dH > 임계["색상"]:
        어긋남.append(f"색상 ΔH {dH:.1f}(임계 {임계['색상']:.0f})")
    if not 변형 and d입체 > 임계["입체"]:
        어긋남.append(f"입체감 {d입체:.2f}(임계 {임계['입체']:.2f})")
    return dict(dL=dL, dH=dH, dE=dE, d지름=d지름, d세로가로=d세로가로,
                d중심=d중심, d입체=d입체, 어긋남=어긋남)


겹침색 = [(0, 170, 200), (60, 190, 90), (230, 150, 0), (150, 100, 220)]


def _한글폰트(크기):
    """PIL 기본 폰트엔 한글 글리프가 없어 파일명이 «두부»(▯▯▯)로 깨진다 — 원본은 멀쩡한데 표시 층만
    죽는 자리라, 못 찾으면 조용히 넘어가지 않고 라벨을 ASCII 로 낮춘다(호출부의 `한글가능`)."""
    for f in ("malgun.ttf", "C:/Windows/Fonts/malgun.ttf", "NanumGothic.ttf",
              "/System/Library/Fonts/AppleSDGothicNeo.ttc", "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"):
        try:
            return ImageFont.truetype(f, 크기), True
        except OSError:
            continue
    return ImageFont.load_default(), False


def 겹침저장(경로들, 잰것, 출력):
    """상태들을 «캔버스 중심»으로 포개 한 장으로 낸다 — 나란히 보면 안 보이고 겹쳐야 보이기 때문이다.
    앱에서 같은 자리에 갈아 끼우면 실제로 캔버스 중심이 맞물리므로, 그 조건 그대로 포갠다.
    합성은 multiply 가 아니라 darker — 배경(밝은 회색)이 겹칠수록 어두워지면 물체와 구분이 흐려진다."""
    W = max(m["캔버스"][0] for m in 잰것)
    H = max(m["캔버스"][1] for m in 잰것)
    무대 = Image.new("RGB", (W, H), (255, 255, 255))
    자리 = []
    for 경로, m in zip(경로들, 잰것):
        im = Image.open(경로).convert("RGB")
        ox, oy = (W - m["캔버스"][0]) // 2, (H - m["캔버스"][1]) // 2
        칸 = Image.new("RGB", (W, H), (255, 255, 255))
        칸.paste(im, (ox, oy))
        무대 = ImageChops.darker(무대, 칸)
        cx, cy = m["중심"][0] * m["캔버스"][0] + ox, m["중심"][1] * m["캔버스"][1] + oy
        자리.append((cx - m["폭"] / 2, cy - m["높이"] / 2, cx + m["폭"] / 2, cy + m["높이"] / 2))
    d = ImageDraw.Draw(무대)
    폰트, 한글가능 = _한글폰트(max(15, W // 55))
    for i, (m, box) in enumerate(zip(잰것, 자리)):
        c = 겹침색[i % len(겹침색)]
        이름 = m["이름"] if 한글가능 else f"cut{i + 1}"
        d.rectangle(box, outline=c, width=max(2, W // 340))
        d.text((box[0] + 10, box[1] + 8), f"{이름}  {m['폭']}×{m['높이']}", fill=c, font=폰트)
    if not 한글가능:
        print("⚠ 한글 폰트를 못 찾아 겹침 라벨을 cut1·cut2… 로 낮췄다(파일명 순서 그대로).")
    무대.save(출력)
    print(f"🖼 겹침 저장 — {출력} ({W}×{H} · 테두리 = 각 상태의 물체 크기)\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("컷", nargs="+", help="상태 컷들 — 첫 번째가 기준(또는 --기준 으로 지정)")
    p.add_argument("--기준", help="기준으로 쓸 컷의 파일명 조각")
    p.add_argument("--겹침", help="상태들을 캔버스 중심으로 포갠 증거 이미지를 이 경로에 저장한다")
    p.add_argument("--변형", default="", help="형태가 «명세대로» 달라지는 상태의 파일명 조각(쉼표) — "
                                             "예: 처리중(squash). 그 컷만 실루엣·입체 게이트를 뺀다")
    args = p.parse_args()

    컷들 = list(args.컷)
    if args.기준:
        골라 = [c for c in 컷들 if args.기준 in os.path.basename(c)]
        if not 골라:
            print(f"🔴 --기준 '{args.기준}' 에 맞는 컷이 없다 — 준 컷: {[os.path.basename(c) for c in 컷들]}")
            return 2
        컷들 = 골라 + [c for c in 컷들 if c not in 골라]

    잰것 = []
    for c in 컷들:
        if not os.path.exists(c):
            print(f"🔴 없다 — {c}")
            return 2
        try:
            잰것.append(측정(c))
        except ValueError as e:
            print(f"🔴 {os.path.basename(c)} — {e}")
            return 2

    if args.겹침:
        겹침저장(컷들, 잰것, args.겹침)

    기준 = 잰것[0]
    print(f"기준 = {기준['이름']} · 캔버스 {기준['캔버스'][0]}×{기준['캔버스'][1]} · "
          f"물체 {기준['폭']}×{기준['높이']}px(세로/가로 {기준['세로가로']:.2f}) · 낙차 {기준['낙차']:.2f} · "
          f"코어 rgb{tuple(int(v) for v in 기준['코어'])}\n")
    변형조각 = [s.strip() for s in args.변형.split(",") if s.strip()]
    어긋난것 = 0
    for 그것 in 잰것[1:]:
        변형 = any(s in 그것["이름"] for s in 변형조각)
        r = 대조(기준, 그것, 변형)
        표 = "🔴" if r["어긋남"] else "✅"
        같나 = "같은 캔버스" if 그것["캔버스"] == 기준["캔버스"] else f"⚠캔버스 다름 {그것['캔버스'][0]}×{그것['캔버스'][1]}"
        print(f"{표} {그것['이름']} ({같나}{' · 변형 상태 — 실루엣·입체 게이트 뺌' if 변형 else ''})")
        print(f"   물체 {그것['폭']}×{그것['높이']}px · 크기 {r['d지름']:+.1%} · "
              f"세로/가로 {그것['세로가로']:.2f} · 중심 {r['d중심']:.1%} · "
              f"ΔL {r['dL']:.1f}(밝기=허용) · ΔH {r['dH']:.1f}(색상=위반축) · ΔE {r['dE']:.1f} · "
              f"입체 낙차 {그것['낙차']:.2f} vs {기준['낙차']:.2f}")
        if r["어긋남"]:
            어긋난것 += 1
            print(f"   ↳ 어긋남: {' · '.join(r['어긋남'])} → 이 상태만 재생성")
        print()
    print(f"합계 = 잰 컷 {len(잰것)} = 기준 1 + 정합 {len(잰것) - 1 - 어긋난것} + 어긋남 {어긋난것}")
    return 1 if 어긋난것 else 0


if __name__ == "__main__":
    sys.exit(main())
