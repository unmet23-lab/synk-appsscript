# 5번 새 기획(11-05) 콘티 가편집 — 시작 그림을 글 콘티의 초 · 카메라대로 이은 소리 없는 15초 · 6초(1080×1920 · 30fps).
# 컷 길이와 박자를 미리 보는 판이다(영상 생성 전). 다가감은 확대로, 초점 끌기는 흐림으로만 흉내 낸다. 결과는 git 밖.
#   python -X utf8 새기획_콘티가편집.py   → 콘티/p5n/가편집/p5n_콘티가편집_15초.mp4 · _6초.mp4
import subprocess
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n")
OUT = V / "가편집"
W, H, FPS = 1080, 1920, 30

# (그림, 길이 초, 처음 배율, 끝 배율, 처음 중심(x,y 비율), 끝 중심, 처음 흐림 px, 흐림이 0이 되는 비율)
CUTS15 = [  # 배율 1일 때 중심은 늘 가운데(0.5, 0.5) — 아니면 가장자리 밖이 비친다. 끝 중심은 끝 배율 안에서만 옮긴다
    ("N01", 1.63, 1.00, 1.45, (0.5, 0.5), (0.42, 0.62), 14, 0.6),
    ("N02n", 1.24, 1.00, 1.06, (0.5, 0.5), (0.5, 0.485), 0, 0),   # 11-07 밑창 밑 연기 구름을 뺀 N02n(Fable 확인 「가장 위험」)
    ("N03", 0.40, 1.00, 1.00, (0.5, 0.5), (0.5, 0.5), 0, 0),
    ("N04", 0.40, 1.00, 1.00, (0.5, 0.5), (0.5, 0.5), 0, 0),
    ("N05", 0.76, 1.00, 1.00, (0.5, 0.5), (0.5, 0.5), 0, 0),
    ("N06", 1.50, 1.00, 1.085, (0.5, 0.5), (0.5, 0.465), 0, 0),
    ("N07", 0.97, 1.00, 1.15, (0.5, 0.5), (0.5, 0.5), 0, 0),
    ("N08b", 1.80, 1.00, 1.00, (0.5, 0.5), (0.5, 0.5), 0, 0),  # 11-07 점검표 25번: N08s(신발 숨) → 역광 니트 N08b(05_콘티 11절, 비교판 N08h 채원 숨)
    ("N09", 1.17, 1.00, 1.03, (0.5, 0.5), (0.5, 0.488), 0, 0),
    ("N10", 1.53, 1.00, 1.03, (0.5, 0.5), (0.488, 0.5), 0, 0),
    ("N11n", 1.50, 1.00, 1.06, (0.5, 0.5), (0.5, 0.475), 10, 0.11),   # 흐림은 내리꽂히는 첫 5장만(길면 템플릿 흐림 전환처럼 보인다 — 맹검). 11-07 바닥 연기를 뺀 N11n
    ("N11_로고", 2.10, 1.00, 1.02, (0.5, 0.5), (0.5, 0.5), 0, 0),
]
# 6초 판(11-05 밤 유호님 「6초판은 좀 별로다. 너무 급하고 전달도 잘 안돼」로 다시 짬): 15초를 압축하지 않고 15초의 끝 6초(9.0~15.0초)를 같은 빠르기로 그대로 쓴다.
#   앞 0.87초는 신발 전체(N01 끝 모습) — 무슨 제품인지 먼저. 「Out of breath,」 자리는 N08s(니트에서 숨이 새어 나옴) — 말과 그림이 맞고, 밝은 뒤꿈치 컷의 밝기 튐이 없다(맹검 아르곤).
#   N11 · 로고는 15초 판과 프레임까지 같다(로고 3.867초).
CUTS6 = [("N01", 0.87, 1.30, 1.45, (0.443, 0.562), (0.42, 0.62), 0, 0), ("N08b", 1.53, 1.00, 1.03, (0.5, 0.5), (0.5, 0.49), 0, 0), ("N11n", 1.465) + CUTS15[10][2:], ("N11_로고", 2.135) + CUTS15[11][2:]]


def cover(img):
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    img = cv2.resize(img, (int(w * s + 0.5), int(h * s + 0.5)), interpolation=cv2.INTER_LANCZOS4)
    y, x = (img.shape[0] - H) // 2, (img.shape[1] - W) // 2
    return img[y:y + H, x:x + W]


def frames(cuts):
    for name, dur, z0, z1, c0, c1, b0, bt in cuts:
        src = cover(cv2.cvtColor(np.asarray(Image.open(V / "정지컷_916" / f"{name}.png").convert("RGB")), cv2.COLOR_RGB2BGR))  # cv2.imread는 한글 경로를 못 읽음
        n = int(round(dur * FPS))
        for i in range(n):
            t = i / max(1, n - 1)
            z = z0 + (z1 - z0) * t
            cx = (c0[0] + (c1[0] - c0[0]) * t) * W
            cy = (c0[1] + (c1[1] - c0[1]) * t) * H
            M = np.float32([[z, 0, W / 2 - cx * z], [0, z, H / 2 - cy * z]])
            f = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            if b0 and t < bt:
                k = b0 * (1 - t / bt)
                if k > 0.3:
                    f = cv2.GaussianBlur(f, (0, 0), k)
            yield f


def write(cuts, path):
    OUT.mkdir(parents=True, exist_ok=True)
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    k = 0
    for f in frames(cuts):
        p.stdin.write(f.tobytes()); k += 1
    p.stdin.close(); p.wait()
    print(path, k, "장", round(k / FPS, 2), "초")


write(CUTS15, OUT / "p5n_콘티가편집_15초.mp4")
write(CUTS6, OUT / "p5n_콘티가편집_6초.mp4")
