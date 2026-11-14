"""층 나누기 — 장면 그림 한 장을 「빈 배경」과 「움직일 인물 층」으로 나눈다 (2026-11-15 · 유호님 「몽글이나 이런거 움직일때 주변 배경이 너무 같이 움직여서 … 근본적으로 해결할수있는 방법이 없을까 ?」).

왜 있나: Remotion 편에서 몽글 · 곁 인물을 같은 그림의 둥근 가림(radial-gradient)으로 떠서 움직이면 둘레 배경이 함께 출렁이고
원래 자리에 남은 몸이 겹쳐 비친다. 그래서 같은 엔진으로 「인물을 지운 같은 장면」(빈 판)을 굽고, 이 도구로
  ① 빈 판을 원본에 맞춰 놓고(ECC 어긋남 맞추기 · 색 맞추기),
  ② 인물마다 원본에서 오려 낸 층(AI 누끼 ∩ 원본 · 빈 판 차이)을 만들고,
  ③ 원본에서 인물 자리 둘레만 빈 판으로 메운 배경을 만든다(그 밖은 원본 화소 그대로 — 빈 판의 결이 조금 달라도 이음이 안 보인다).
인물 층은 원본과 같은 크기의 투명 PNG라 영상에서 그 자리 그대로 얹고 움직이면 된다.

  python -I -X utf8 tools/층나누기.py --원본 img/tank.jpg --빈판 판/tank_plate.png --낼 img --이름 tank \
      --층 m:0,1050,560,1700 --층 o:560,380,1080,1500 [--떼기 o:wave:380,800,150,200] [--아래 m] [--시트 확인.png]

  --층 이름:x0,y0,x1,y1   그 상자 안의 인물을 오린다(상자는 원본 화소 · 여러 번).
  --떼기 부모:자식:cx,cy,rx,ry[:깃]   부모 층에서 타원 자리를 떼어 따로 움직일 자식 층으로(손 흔드는 지느러미 · 생각 구름).
       깃(기본 40px)은 붙은 쪽 이음을 부드럽게 하는 너비다. 부모에는 그 자리가 빠지고 그 밑은 빈 판이 보인다.
  --아래 이름             그 층의 아래 가장자리를 30px 흐리게 한다(물에 잠긴 강아지처럼 몸 아래가 잘린 인물).
  --시트 경로             확인 시트(원본 · 배경 · 층 · 차이)를 낸다.
낸 것: <이름>_bg.jpg · <이름>_<층>.png · <이름>_층.json(층마다 bbox · 바닥 가운데 — 영상의 회전 기준).
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def 읽기(p, 크기=None):
    im = Image.open(p).convert('RGB')
    if 크기 and im.size != 크기:
        im = im.resize(크기, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def 맞추기(원본, 빈판, 가림):
    """빈 판을 원본에 맞춘다 — 인물 상자 밖(가림=1)만 보고 아핀 ECC. 실패하면 그대로."""
    작게 = 0.35
    a = cv2.cvtColor((원본 * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    b = cv2.cvtColor((빈판 * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    a_s = cv2.GaussianBlur(cv2.resize(a, None, fx=작게, fy=작게, interpolation=cv2.INTER_AREA), (5, 5), 0)
    b_s = cv2.GaussianBlur(cv2.resize(b, None, fx=작게, fy=작게, interpolation=cv2.INTER_AREA), (5, 5), 0)
    m_s = cv2.resize(가림.astype(np.uint8) * 255, (a_s.shape[1], a_s.shape[0]), interpolation=cv2.INTER_NEAREST)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        cc, warp = cv2.findTransformECC(a_s, b_s, warp, cv2.MOTION_AFFINE,
                                        (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), m_s, 5)
    except cv2.error as e:
        print(f'[층나누기] 맞추기 실패 — 그대로 둔다: {e}', file=sys.stderr)
        return 빈판, None
    warp[:, 2] /= 작게
    h, w = 원본.shape[:2]
    맞춘 = cv2.warpAffine(빈판, warp, (w, h), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    return 맞춘, {'cc': round(float(cc), 4), 'warp': [[round(float(v), 5) for v in r] for r in warp]}


def 색맞추기(원본, 빈판, 가림):
    """Lab 평균 · 표준편차를 인물 상자 밖에서 맞춘다(빈 판의 색 흐름이 조금 다를 때 이음을 줄인다)."""
    a = cv2.cvtColor(원본, cv2.COLOR_RGB2LAB)
    b = cv2.cvtColor(빈판, cv2.COLOR_RGB2LAB)
    k = 가림 > 0
    for c in range(3):
        ma, sa = a[..., c][k].mean(), a[..., c][k].std() + 1e-6
        mb, sb = b[..., c][k].mean(), b[..., c][k].std() + 1e-6
        b[..., c] = (b[..., c] - mb) * (sa / sb) + ma
    return np.clip(cv2.cvtColor(b, cv2.COLOR_LAB2RGB), 0, 1)


def 차이(원본, 빈판):
    """인물이 있던 자리 — Lab 거리(흐린 뒤). 0~1."""
    a = cv2.cvtColor(cv2.GaussianBlur(원본, (0, 0), 2.0), cv2.COLOR_RGB2LAB)
    b = cv2.cvtColor(cv2.GaussianBlur(빈판, (0, 0), 2.0), cv2.COLOR_RGB2LAB)
    d = np.sqrt(((a - b) ** 2).sum(-1))
    return np.clip((d - 6.0) / 14.0, 0, 1)


def 오리기(원본, 상자, 차, 세션값, 채움=None, 좁게=False):
    from AI누끼 import 걷기
    x0, y0, x1, y1 = 상자
    조각 = Image.fromarray((원본[y0:y1, x0:x1] * 255).astype(np.uint8))
    알 = np.asarray(걷기(조각, 세션값).split()[-1]).astype(np.float32) / 255.0
    # 누끼가 배경 물건(바위 · 줄)까지 잡으면 빈 판과 차이 없는 곳이다 — 차이 자리(넓힌 것)로 자른다
    넓이 = 11 if 좁게 else 31  # 좁게: 인물 뒤에 붙은 배경 물건(울타리 기둥)이 층에 묻지 않게
    차자리 = cv2.dilate((차[y0:y1, x0:x1] > 0.25).astype(np.uint8), np.ones((넓이, 넓이), np.uint8)).astype(np.float32)
    차자리 = cv2.GaussianBlur(차자리, (0, 0), 3 if 좁게 else 6)
    알 = 알 * np.clip(차자리 * 1.6, 0, 1)
    if 채움 is None:
        전체 = np.zeros(원본.shape[:2], np.float32)
        전체[y0:y1, x0:x1] = 가장큰(알)
        return 전체
    # 누끼가 놓친 몸(물개 등 · 바위 위 앞지느러미)은 차이로 채운다 — 닫고 · 구멍 메우고 · 작은 조각 버린 뒤 안쪽만.
    # 「무채」면 채도 낮은 곳(회색 털 · 검은 눈)만 채운다 — 빈 판이 바위 이끼 · 물빛을 조금 바꾼 자리가 몸에 묻지 않게
    속 = 차[y0:y1, x0:x1]
    b = (속 > 0.3).astype(np.uint8)
    if 채움 == '무채':
        hsv = cv2.cvtColor(원본[y0:y1, x0:x1], cv2.COLOR_RGB2HSV)
        b = b & (hsv[..., 1] < 0.32).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    큰 = np.zeros_like(b)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.01 * b.size:
            큰[lab == i] = 1
    채움 = 큰.copy()
    hh, ww = 채움.shape
    밖 = np.zeros((hh + 2, ww + 2), np.uint8)
    뒤집 = (1 - 큰).astype(np.uint8)
    for (sx, sy) in [(x, 0) for x in range(0, ww, 7)] + [(x, hh - 1) for x in range(0, ww, 7)] + [(0, y) for y in range(0, hh, 7)] + [(ww - 1, y) for y in range(0, hh, 7)]:
        if 뒤집[sy, sx] == 1 and 밖[sy + 1, sx + 1] == 0:
            cv2.floodFill(뒤집, 밖, (sx, sy), 2)
    채움[뒤집 == 1] = 1  # 테두리와 닿지 않은 빈자리 = 몸 안의 구멍
    심 = cv2.erode(채움, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(np.float32)
    심 = cv2.GaussianBlur(심, (0, 0), 3)
    알 = 가장큰(np.maximum(알, 심))
    전체 = np.zeros(원본.shape[:2], np.float32)
    전체[y0:y1, x0:x1] = 알
    return 전체


def 가장큰(알):
    """알에서 가장 큰 덩어리(넓혀 이은 것)만 남긴다 — 유리 반사 · 상자 가장자리 부스러기를 버린다."""
    b = cv2.dilate((알 > 0.35).astype(np.uint8), np.ones((15, 15), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(b, 8)
    if n <= 2:
        return 알
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return 알 * (lab == k).astype(np.float32)


def 타원(h, w, cx, cy, rx, ry, 깃):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    안 = 1.0 - np.clip((d - 1.0) * min(rx, ry) / max(1.0, 깃) + 0.5, 0, 1)
    return 안


def 정보(알):
    ys, xs = np.where(알 > 0.5)
    if not len(ys):
        return None
    y1 = int(ys.max())
    바닥 = xs[ys >= y1 - 12]
    return {'bbox': [int(xs.min()), int(ys.min()), int(xs.max()), y1], '바닥': [int(np.median(바닥)), y1]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--원본', required=True)
    ap.add_argument('--빈판', required=True)
    ap.add_argument('--낼', required=True)
    ap.add_argument('--이름', required=True)
    ap.add_argument('--층', action='append', default=[])
    ap.add_argument('--떼기', action='append', default=[])
    ap.add_argument('--아래', action='append', default=[])
    ap.add_argument('--채움', action='append', default=[], help='이름[:무채] — 누끼가 놓친 몸을 차이로 채울 층')
    ap.add_argument('--빼기', action='append', default=[], help='이름:cx,cy,rx,ry — 그 층에서 타원 자리를 뺀다(인물 뒤에 붙어 온 배경 물건)')
    ap.add_argument('--색빼기', action='append', default=[], help='이름:x0,y0,x1,y1:색상0-색상1 — 상자 안에서 색상(0~360°)이 그 범위인 화소를 층에서 뺀다(몸에 딸려 온 바닥 반사)')
    ap.add_argument('--넘기기', action='append', default=[], help='부모:자식:x0,y0,x1,y1 — 상자 안 크림 · 흰 털(채도 0.32 아래 · 빈 판과 다른 곳)을 부모 층에서 자식 층으로 옮긴다(몽글 머리에 붙은 생각 구름 방울)')
    ap.add_argument('--원', action='append', default=[], help='부모:자식:cx,cy,r — 둥근 물건(생각 구름 방울)을 원째 부모 층에서 자식 층으로 옮긴다(빛을 받아 분홍빛이 된 쪽까지)')
    ap.add_argument('--메우기', action='append', default=[], help='층:cx,cy,r — --원으로 떼어 낸 자리에 파인 그 층의 윗선을 양옆 윗선에 맞춰 둥글게 잇고 속을 메운다(방울에 가려 원본에 없던 몽글 머리)')
    ap.add_argument('--좁게', action='append', default=[], help='이름 — 누끼를 차이 자리에 좁게 묶을 층')
    ap.add_argument('--시트')
    a = ap.parse_args()

    원본 = 읽기(a.원본)
    h, w = 원본.shape[:2]
    빈판 = 읽기(a.빈판, (w, h))
    층들 = []
    for s in a.층:
        이름, 상자 = s.split(':', 1)
        층들.append((이름, [int(v) for v in 상자.split(',')]))
    상자밖 = np.ones((h, w), bool)
    for _, (x0, y0, x1, y1) in 층들:
        상자밖[max(0, y0 - 20):y1 + 20, max(0, x0 - 20):x1 + 20] = False

    빈판, 맞춤 = 맞추기(원본, 빈판, 상자밖)
    빈판 = 색맞추기(원본, 빈판, 상자밖)
    차 = 차이(원본, 빈판)
    print(f'[층나누기] {a.이름} 맞추기 {맞춤}')
    # 상자 밖인데 차이가 크면 빈 판이 다른 데를 바꾼 것 — 그 몫을 알린다(배경은 원본을 쓰므로 화면에는 안 나온다)
    밖차 = float((차[상자밖] > 0.5).mean())
    print(f'[층나누기] 상자 밖 차이 비율 {밖차:.4f}' + ('  ← 빈 판이 인물 밖도 바꿨다(어긋남 · 다시 굽기 검토)' if 밖차 > 0.03 else ''))

    from AI누끼 import 세션
    세션값 = 세션()
    알들 = {}
    채움들 = {}
    for s in a.채움:
        이름, _, 방식 = s.partition(':')
        채움들[이름] = 방식 or '전부'
    앞층 = np.zeros((h, w), np.float32)
    for 이름, 상자 in 층들:
        # 상자가 겹치면 앞에 준 층이 먼저 가진다(몽글 상자 · 물개 상자가 겹칠 때 물개 층에 몽글이 묻지 않게)
        # 넓혀서 빼면 두 층이 맞닿은 자리(구름 방울 사이)에 둘 다 비는 줄이 생긴다 — 앞 층 알만큼만 뺀다
        알 = 오리기(원본, 상자, 차, 세션값, 채움들.get(이름), 이름 in a.좁게) * (1 - np.clip(앞층 * 1.2, 0, 1))
        알들[이름] = 알
        앞층 = np.maximum(앞층, 알)
    for s in a.빼기:
        이름, 자리값 = s.split(':', 1)
        cx, cy, rx, ry = [float(v) for v in 자리값.split(',')]
        알들[이름] = 알들[이름] * (1 - 타원(h, w, cx, cy, rx, ry, 8))
    for s in a.색빼기:
        이름, 상자값, 범위 = s.split(':')
        x0, y0, x1, y1 = [int(v) for v in 상자값.split(',')]
        h0, h1 = [float(v) for v in 범위.split('-')]
        hsv = cv2.cvtColor(원본[y0:y1, x0:x1], cv2.COLOR_RGB2HSV)  # float 입력이면 색상 0~360
        빼 = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] > 0.2)).astype(np.float32)
        빼 = cv2.GaussianBlur(cv2.dilate(빼, np.ones((3, 3), np.uint8)), (0, 0), 1.0)
        알들[이름][y0:y1, x0:x1] *= (1 - np.clip(빼, 0, 1))
    for s in a.넘기기:
        부모, 자식, 상자값 = s.split(':')
        x0, y0, x1, y1 = [int(v) for v in 상자값.split(',')]
        hsv = cv2.cvtColor(원본[y0:y1, x0:x1], cv2.COLOR_RGB2HSV)
        # 크림 · 흰 털(채도 0.32 아래)이면서 빈 판과 다른 곳 — 누끼가 반쯤만 잡았어도 온전히(알 1) 옮긴다
        옮길 = ((hsv[..., 1] < 0.32) & (차[y0:y1, x0:x1] > 0.2)).astype(np.uint8)
        옮길 = cv2.morphologyEx(옮길, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        옮길 = cv2.GaussianBlur(옮길.astype(np.float32), (0, 0), 1.0)
        알들[부모][y0:y1, x0:x1] *= (1 - 옮길)
        알들[자식][y0:y1, x0:x1] = np.maximum(알들[자식][y0:y1, x0:x1], 옮길)
    for s in a.원:
        부모, 자식, 원값 = s.split(':')
        cx, cy, r = [float(v) for v in 원값.split(',')]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        안 = np.clip(r + 0.75 - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2), 0, 1.5) / 1.5
        알들[부모] = 알들[부모] * (1 - 안)
        알들[자식] = np.maximum(알들[자식], 안)
    색들 = {}
    for s in a.메우기:
        이름, 원값 = s.split(':')
        cx, cy, r = [float(v) for v in 원값.split(',')]
        알 = 알들[이름]
        # 원 밖 양옆(원 지름의 두 배 폭)에서 층의 윗선을 읽어 2차 곡선으로 잇는다
        xs, ys = [], []
        for x in range(int(cx - 2.5 * r), int(cx + 2.5 * r) + 1):
            if abs(x - cx) <= r + 6 or x < 0 or x >= w:
                continue
            col = np.where(알[:, x] > 0.9)[0]  # 털끝이 아니라 몸통의 윗선(털끝을 읽으면 메운 자리가 혹처럼 솟는다)
            col = col[(col > cy - 3 * r) & (col < cy + 4 * r)]
            if len(col):
                xs.append(x)
                ys.append(col.min())
        if len(xs) < 10:
            print(f'[층나누기] 메우기 {이름}: 윗선을 못 읽음 — 건너뜀', file=sys.stderr)
            continue
        곡 = np.polyfit(np.array(xs, float), np.array(ys, float), 2)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        윗선 = np.polyval(곡, xx)
        원안 = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) <= r + 6
        메울 = (np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) <= r) & (yy >= 윗선 + 4.0)  # 방울 안쪽만 · 윗선보다 살짝 낮게(혹이 솟지 않게)
        테밖 = 원안 & (yy < 윗선 - 1.5)  # 윗선 위로 남은 방울 털 가닥은 지운다
        # 메울 색은 바로 아래(지름 두 배 아래) 같은 층의 결을 옮긴다 — 원본의 그 자리는 방울 색이라 번지면 크림이 된다
        아래 = int(round(2 * r))
        ky, kx = np.where(메울 & (알 < 0.9))
        ky2 = np.clip(ky + 아래, 0, h - 1)
        채움 = 원본.copy()
        채움[ky, kx] = 원본[ky2, kx]
        새알 = np.clip((yy - 윗선 - 3.0) / 3.0, 0, 1) * (np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) <= r)  # 윗선에서 3px 부드럽게
        k = 메울 & (알 < 0.9)
        색 = 색들.get(이름, 원본).copy()  # 메운 색은 그 층에만 — 같은 자리를 덮는 방울 층의 색은 원본 그대로
        색[k] = 채움[k]
        색들[이름] = 색
        알[원안] = np.where(테밖[원안], 0, np.maximum(알[원안], 새알[원안]))
        알들[이름] = 알
        print(f'[층나누기] 메우기 {이름}: {int(k.sum())}화소')
    for s in a.떼기:
        부분 = s.split(':')
        부모, 자식 = 부분[0], 부분[1]
        cx, cy, rx, ry = [float(v) for v in 부분[2].split(',')]
        깃 = float(부분[3]) if len(부분) > 3 else 40.0
        t = 타원(h, w, cx, cy, rx, ry, 깃)
        알들[자식] = 알들[부모] * t
        알들[부모] = 알들[부모] * (1 - t)
    for 이름 in a.아래:
        알 = 알들[이름]
        ys = np.where(알.max(1) > 0.5)[0]
        if len(ys):
            y1 = ys.max()
            ramp = np.clip((y1 - np.arange(h)) / 30.0, 0, 1).astype(np.float32)
            알들[이름] = 알 * ramp[:, None]

    # 배경 — 인물 자리(층 알 ∪ 상자 안 차이)를 넓혀 빈 판으로, 나머지는 원본
    자리 = np.zeros((h, w), np.float32)
    for 알 in 알들.values():
        자리 = np.maximum(자리, (알 > 0.04).astype(np.float32))
    상자안차 = np.where(상자밖, 0, (차 > 0.2).astype(np.float32))
    자리 = np.maximum(자리, 상자안차)
    자리 = cv2.dilate(자리, np.ones((33, 33), np.uint8))
    자리 = np.clip(cv2.GaussianBlur(자리, (0, 0), 9) * 1.3, 0, 1)[..., None]
    배경 = 원본 * (1 - 자리) + 빈판 * 자리

    os.makedirs(a.낼, exist_ok=True)
    Image.fromarray((배경 * 255).round().astype(np.uint8)).save(os.path.join(a.낼, f'{a.이름}_bg.jpg'), quality=93)
    표 = {'원본': os.path.basename(a.원본), '빈판': os.path.basename(a.빈판), '맞추기': 맞춤, '상자밖차이': round(밖차, 4), '층': {}}
    for 이름, 알 in 알들.items():
        rgba = np.dstack([색들.get(이름, 원본) * (알 > 0.004)[..., None], 알])  # 다 비치는 곳의 색은 0 — PNG가 작아진다
        Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA').save(os.path.join(a.낼, f'{a.이름}_{이름}.png'), optimize=True)
        표['층'][이름] = 정보(알)
    with open(os.path.join(a.낼, f'{a.이름}_층.json'), 'w', encoding='utf-8') as f:
        json.dump(표, f, ensure_ascii=False, indent=1)
    print(f'[층나누기] {a.이름} → {a.낼} · 층 {json.dumps(표["층"], ensure_ascii=False)}')

    if a.시트:
        체크 = np.ones((h, w, 3), np.float32) * 0.5
        yy, xx = np.mgrid[0:h, 0:w]
        체크[((yy // 24 + xx // 24) % 2) == 0] = 0.75
        층합 = 체크.copy()
        for 알 in 알들.values():
            층합 = 층합 * (1 - 알[..., None]) + 원본 * 알[..., None]
        칸 = [원본, 배경, 층합, np.repeat(차[..., None], 3, -1)]
        시트 = np.concatenate([cv2.resize(c, (w // 2, h // 2), interpolation=cv2.INTER_AREA) for c in 칸], 1)
        Image.fromarray((시트 * 255).astype(np.uint8)).save(a.시트)


if __name__ == '__main__':
    main()
