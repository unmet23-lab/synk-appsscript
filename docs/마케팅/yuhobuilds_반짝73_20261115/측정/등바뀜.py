"""영상 속 등(작은 밝은 점)마다 켜짐 · 꺼짐이 바뀐 횟수를 센다 — Y54 「반짝인다」 편의 실제 결과 숫자.

python -I -X utf8 등바뀜.py <영상.mp4> <밖 폴더> [--등 <x,y,r;x,y,r;...>] [--초 <시작>,<끝>] [--켜짐 0.6]

- 등 자리를 주지 않으면 영상 전체의 「밝은 자리 최댓값」 그림에서 작고 밝은 둥근 점을 찾아 큰 것부터 고른다(--개수, 기본 11).
- 등마다 둘레 원 안의 밝기(회색) 평균을 프레임마다 재고, 그 등의 밝기 범위로 나눠 0~1로 맞춘 뒤
  --켜짐 위면 켜짐, 그 아래(띠 0.1 둠)면 꺼짐으로 본다. 켜짐 ↔ 꺼짐이 바뀐 수를 등마다 세어 더한다.
- 밖 폴더에 등자리.jpg(번호 붙인 첫 장면) · 등바뀜.json(등마다 바뀐 수 · 프레임별 상태) · 띠.png(등 × 시간 켜짐 지도)를 쓴다.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np


def 쓰기(경로, 그림):
    # cv2.imwrite는 Windows에서 한글 경로를 말없이 못 쓴다 — 인코딩해 파일로 쓴다
    ok, buf = cv2.imencode(os.path.splitext(경로)[1], 그림)
    if ok:
        buf.tofile(경로)


def 읽기(경로):
    cap = cv2.VideoCapture(경로)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    장 = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        장.append(f)
    cap.release()
    if not 장:
        sys.exit(f"프레임 없음: {경로}")
    return 장, fps


def 등찾기(장, 개수):
    회 = np.stack([cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in 장[:: max(1, len(장) // 60)]])
    최대 = 회.max(axis=0).astype(np.uint8)
    h, w = 최대.shape
    문턱 = max(200, int(np.percentile(최대, 99.3)))
    _, 이진 = cv2.threshold(최대, 문턱, 255, cv2.THRESH_BINARY)
    n, lab, st, cen = cv2.connectedComponentsWithStats(이진)
    후보 = []
    for i in range(1, n):
        x, y, bw, bh, a = st[i]
        if a < 12 or a > h * w * 0.004:
            continue
        if max(bw, bh) > 3.5 * max(1, min(bw, bh)):
            continue  # 길쭉한 것(물빛 띠 · 난간 반사)은 뺀다
        r = int(max(bw, bh) * 0.8) + 3
        후보.append((a, int(cen[i][0]), int(cen[i][1]), r))
    후보.sort(reverse=True)
    return [(x, y, r) for _, x, y, r in 후보[:개수]], 최대


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("영상")
    ap.add_argument("밖")
    ap.add_argument("--등", default="")
    ap.add_argument("--개수", type=int, default=11)
    ap.add_argument("--초", default="")
    ap.add_argument("--켜짐", type=float, default=0.6)
    a = ap.parse_args()
    os.makedirs(a.밖, exist_ok=True)
    장, fps = 읽기(a.영상)
    if a.초:
        s, e = (float(v) for v in a.초.split(","))
        장 = 장[int(s * fps): int(e * fps)]
    if a.등:
        등 = [tuple(int(v) for v in t.split(",")) for t in a.등.split(";") if t.strip()]
    else:
        등, _ = 등찾기(장, a.개수)
    등.sort(key=lambda t: (t[0], t[1]))
    h, w = 장[0].shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    가면 = [((xx - x) ** 2 + (yy - y) ** 2) <= r * r for x, y, r in 등]
    밝기 = np.zeros((len(등), len(장)), dtype=np.float32)
    for j, f in enumerate(장):
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
        for i, m in enumerate(가면):
            밝기[i, j] = g[m].mean()
    상태 = np.zeros_like(밝기, dtype=np.int8)
    바뀜 = []
    동시 = np.zeros(len(장), dtype=np.int32)
    for i in range(len(등)):
        lo, hi = np.percentile(밝기[i], 3), np.percentile(밝기[i], 97)
        범위 = max(hi - lo, 1e-3)
        v = (밝기[i] - lo) / 범위
        # 밝기 범위가 아주 좁으면(늘 켜짐) 바뀜 없음으로 본다
        if hi - lo < 18:
            상태[i, :] = 1 if hi > 120 else 0
            바뀜.append(0)
            continue
        s = 1 if v[0] >= a.켜짐 else 0
        n = 0
        for j in range(len(장)):
            if s == 1 and v[j] < a.켜짐 - 0.1:
                s = 0; n += 1; 동시[j] += 1
            elif s == 0 and v[j] > a.켜짐 + 0.1:
                s = 1; n += 1; 동시[j] += 1
            상태[i, j] = s
        바뀜.append(n)
    첫 = 장[0].copy()
    for k, (x, y, r) in enumerate(등):
        cv2.circle(첫, (x, y), r, (0, 220, 255), 2)
        cv2.putText(첫, str(k + 1), (x - 8, y - r - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 255), 2)
    쓰기(os.path.join(a.밖, "등자리.jpg"), 첫)
    띠 = np.kron(상태.astype(np.uint8) * 255, np.ones((24, 3), dtype=np.uint8)).astype(np.uint8)
    쓰기(os.path.join(a.밖, "띠.png"), 띠)
    결과 = {
        "영상": os.path.basename(a.영상),
        "fps": round(fps, 3),
        "프레임": len(장),
        "초": round(len(장) / fps, 2),
        "등": [{"번호": k + 1, "x": x, "y": y, "r": r, "바뀜": 바뀜[k],
               "밝기범위": [round(float(np.percentile(밝기[k], 3)), 1), round(float(np.percentile(밝기[k], 97)), 1)]}
              for k, (x, y, r) in enumerate(등)],
        "바뀜합": int(sum(바뀜)),
        "셋넘게동시": int((동시 > 3).sum()),
        "켜진등수_프레임별": [int(c) for c in 상태.sum(axis=0)],
        "상태": ["".join(str(int(v)) for v in row) for row in 상태],
    }
    json.dump(결과, open(os.path.join(a.밖, "등바뀜.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print(f"{결과['영상']} · {결과['초']}초 · 등 {len(등)} · 바뀜 합 {결과['바뀜합']} · 등마다 {바뀜} · 셋 넘게 같은 프레임 {결과['셋넘게동시']}")


if __name__ == "__main__":
    main()
