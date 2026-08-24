# -*- coding: utf-8 -*-
"""색폭실측 — Loom 헌법 3조의 «폭»을 잰다 (2026-08-24 신설 · 유호 판정 「② 가 채택」).

왜 이 도구인가:
  헌법 3조(「킷 hex 정확 일치 불가능 = 정상」 · 정본 = docs/펠트엔진_설계.md)는 AgX 뷰 변환
  아래에서 실측된 조항인데, 08-24 에 「색이 씻긴다」의 진범이 재질이 아니라 그 자(AgX)로
  판명됐다(채택 = Khronos PBR Neutral). 조항의 «폭»(정상 이탈이 어디까지인가)을 새 자에서
  재기 전까지, 색 판정은 폭 없는 눈싸움이다 — 김치 15판·색 오보 1회가 그 값이었다.

무엇을 재나:
  오브 26색 렌더(docs/캐릭터/오브공방_0821/*.png — 파일명 = 킷 색 이름)의 «몸통 평균색»을
  킷 정본(docs/디자인_토큰.json 색.킷)의 hex 와 CIELAB ΔE(CIE76)로 대조한다.
  같은 도구를 옛 판(AgX)과 새 판(PBR Neutral) 산출에 각각 돌리면 「자가 바꾼 폭」이 정량화된다.

규율(헌법 3조 둘째 문): 숫자는 «잰 자의 이름»과 함께만 읽는다 — 이 도구는 산출 파일의
  mtime 범위를 함께 찍는다. 어느 자(색관리)로 구운 판인지는 mtime 을 굽기 이력과 대조해 안다.

사용:
  python tools/색폭실측.py                        # 기본 폴더(오브공방) 전량
  python tools/색폭실측.py --폴더 <경로> --중앙 0.2   # 다른 산출 · 중앙 crop 비율 변경
"""
import argparse
import datetime as _dt
import io
import json
import math
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from PIL import Image

루트 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def 킷맵():
    d = json.load(open(os.path.join(루트, 'docs', '디자인_토큰.json'), encoding='utf-8'))
    # 이름 정규화: 파일명은 공백 대신 _ 를 쓴다(Coral_Soft.png ↔ 「Coral Soft」)
    return {항['이름'].replace(' ', '_'): 항['hex'] for 항 in d['색']['킷']}


def srgb_to_lab(r, g, b):
    """sRGB(0-255) → CIELAB. CIE76 ΔE 용 — 폭을 «같은 자»로 재는 것이 목적이라 CIE76 이면 족하다."""
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    rl, gl, bl = lin(r), lin(g), lin(b)
    # sRGB D65
    x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
    y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
    z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041
    xn, yn, zn = 0.95047, 1.0, 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x / xn), f(y / yn), f(z / zn)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(lab1, lab2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2)))


def 몸통평균(경로, 중앙비=0.25):
    """이미지 중앙 crop 의 평균 RGB — 오브는 프레임 중앙의 구라 배경 오염이 최소인 영역이다."""
    im = Image.open(경로).convert('RGB')
    w, h = im.size
    cw, ch = int(w * 중앙비), int(h * 중앙비)
    box = ((w - cw) // 2, (h - ch) // 2, (w + cw) // 2, (h + ch) // 2)
    px = list(im.crop(box).getdata())
    n = len(px)
    return tuple(round(sum(p[i] for p in px) / n) for i in range(3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--폴더', default=os.path.join(루트, 'docs', '캐릭터', '오브공방_0821'))
    ap.add_argument('--중앙', type=float, default=0.25)
    a = ap.parse_args()

    킷 = 킷맵()
    줄들, 못맵 = [], []
    mtimes = []
    for f in sorted(os.listdir(a.폴더)):
        if not f.endswith('.png'):
            continue
        이름 = re.sub(r'\.png$', '', f)
        if 이름 not in 킷:
            못맵.append(이름)
            continue
        경로 = os.path.join(a.폴더, f)
        mtimes.append(os.path.getmtime(경로))
        평균 = 몸통평균(경로, a.중앙)
        hx = 킷[이름]
        목표 = tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))
        de = delta_e(srgb_to_lab(*평균), srgb_to_lab(*목표))
        줄들.append((이름, hx, 평균, de))

    if not 줄들:
        print('잰 것 0 — 폴더에 킷 이름 PNG 가 없다:', a.폴더)
        sys.exit(1)

    시각 = lambda t: _dt.datetime.fromtimestamp(t).strftime('%m-%d %H:%M')
    print(f'■ 색폭실측 — {len(줄들)}색 · 중앙 {a.중앙:.0%} 평균 · 산출 mtime {시각(min(mtimes))} ~ {시각(max(mtimes))}')
    print(f'  (잰 자 = 이 mtime 판의 색관리 — 굽기 이력과 대조해 이름을 붙인다 · 헌법 3조 둘째 문)')
    for 이름, hx, 평균, de in sorted(줄들, key=lambda x: -x[3]):
        print(f'   ΔE {de:5.1f}  {이름:<14} 킷 {hx} → 렌더 #{평균[0]:02X}{평균[1]:02X}{평균[2]:02X}')
    des = sorted(x[3] for x in 줄들)
    mid = des[len(des) // 2]
    print(f'   요약 — 중앙값 ΔE {mid:.1f} · 최대 {des[-1]:.1f}({max(줄들, key=lambda x: x[3])[0]}) · 최소 {des[0]:.1f}')
    if 못맵:
        print(f'   ⚠ 킷에 없는 이름 {len(못맵)}: {" · ".join(못맵[:6])}{" 외" if len(못맵) > 6 else ""}')


if __name__ == '__main__':
    main()
