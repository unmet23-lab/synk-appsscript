# 원본 폰 화면 컷(3 · 6 · 10 · 12 · 15 · 17)에서 화면 속 내용이 프레임마다 얼마나 움직이는지 잰다(960×540 프레임, 화면 상자 안 Farneback 흐름의 중앙값).
#   python -X utf8 녹화_원본재기.py <프레임 폴더>  → git 밖 콘티/p8/녹화/원본재기/화면움직임.json (컷마다 프레임별 dx · dy · 크기 변화)
# 빠른 넘김은 흐름이 놓쳐 작게 나온다 — 타이밍은 프레임 모음(원본재기/C??_프레임.jpg)을 눈으로 본 것을 정본으로 쓴다(02_콘티.md 3절).
import sys, json, os
import numpy as np, cv2
F = sys.argv[1]
# 컷: (첫 프레임, 끝 프레임(다음 컷 첫 프레임), 화면 상자 x0,y0,x1,y1 — 960×540 기준, 첫 프레임을 보고 잡음)
CUTS = {
    3: (72, 123, (470, 10, 535, 230)),     # 똑바로 든 폰 — 화면 위쪽(손가락이 덜 가리는 곳)
    6: (223, 264, (40, 0, 330, 220)),       # 극접사 · 기운 화면
    10: (425, 455, (60, 20, 420, 230)),     # 극접사 · 빠른 넘김
    12: (475, 500, (265, 0, 340, 120)),     # 두 손 · 화면 위쪽
    15: (568, 602, (380, 20, 450, 200)),    # 비스듬히 든 폰
    17: (629, 670, (100, 0, 480, 90)),      # 극접사 · 다가감(화면 위 글줄)
}
def rd(n):
    return cv2.cvtColor(cv2.imread(os.path.join(F, f"{n+1:04d}.jpg")), cv2.COLOR_BGR2GRAY)
out = {}
for c, (a, b, (x0, y0, x1, y1)) in CUTS.items():
    rows = []
    prev = rd(a)
    for n in range(a + 1, b):
        cur = rd(n)
        fl = cv2.calcOpticalFlowFarneback(prev, cur, None, 0.5, 4, 21, 3, 5, 1.1, 0)
        box = fl[y0:y1, x0:x1].reshape(-1, 2)
        dx, dy = np.median(box[:, 0]), np.median(box[:, 1])
        # 크기 변화(다가감): 상자 안 흐름의 퍼짐 — x 위치에 대한 dx의 기울기
        xs = np.tile(np.arange(x0, x1), y1 - y0)
        k = np.polyfit(xs, box[:, 0], 1)[0] if len(xs) > 10 else 0.0
        rows.append({"f": n, "t": round(n / 29.97, 3), "dx": round(float(dx), 2), "dy": round(float(dy), 2), "zoom": round(float(k), 4)})
        prev = cur
    out[c] = rows
    tot = sum(r["dy"] for r in rows)
    print(c, "프레임", a, "→", b - 1, "세로 합", round(tot, 1), "px(540 기준)", "가로 합", round(sum(r["dx"] for r in rows), 1))
    print("   dy:", " ".join(f"{r['dy']:.0f}" for r in rows))
json.dump(out, open(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/녹화/원본재기/화면움직임.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
