"""
꿈 무대 엔딩 여덟째 판의 9:16 세로판(2026-11-21, 유호님 「응, 파생판부터」). 학생이 휴대폰에 저장하고 보내는 판이다.

가로판(`엔딩잇기8.py`)과 짜임 · 박 · 소리가 같다. 소리는 가로판 결과에서 그대로 가져온다. 바뀌는 것은 자리다.
- 영화 장면 네 컷은 컷마다 정한 가로 자리에서 9:16로 자른다(얼굴 컷은 YuNet 얼굴 가운데, 넓은 컷은 두 사람, 컷 3은 친구 뒷모습과 도시).
- 사진첩은 사진을 위, 크레딧을 사진 아래 가운데에 둔다. 카드는 `엔딩카드.cjs --세로`가 1080×1920으로 조판한다.
- 영화관으로 빠질 때 스크린에는 세로 화면이 스크린 높이로 걸리고, 창이 물러나 상영관 전체가 화면 가운데에 가로로 놓인다
  (위아래는 엔딩 바탕). 첫 판은 9:16 창이 상영관 높이까지만 물러나 스크린 가장자리가 끝내 보이지 않았고, 다른 눈이
  「극장 스크린이라는 이중 틀이 읽히지 않는다 · 의자 위 휴대폰이 뜬금없다」고 했다(11-21). 객석 영상과 빈 객석도 같은 가로 자리에 둔다.
- 쿠키는 휴대폰 시계와 「엄마 / 도착.」이 든 자리를 9:16로 자른다.

    python -I -X utf8 엔딩세로.py <밖.mp4> <설정.json> <가로판.mp4> <세로 글자 폴더>
"""
import importlib.util
import json
import os
import subprocess
import sys

import cv2
import numpy as np

여기 = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("판8", os.path.join(여기, "엔딩잇기8.py"))
판8 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(판8)
옛 = 판8.옛
FPS = 판8.FPS
W, H = 1080, 1920
바탕, 그레인 = 판8.바탕, 판8.그레인
읽기, 덮기, 빠르게멈춤, 부드럽게 = 옛.읽기, 옛.덮기, 옛.빠르게멈춤, 옛.부드럽게
박, 맺힘 = 판8.박, 판8.맺힘
영화자리 = [760, 830, 400, 760]       # 컷마다 1280×720 원본에서 자를 가운데 x(넓은 컷 두 사람 · 얼굴 · 친구 뒷모습 · 얼굴)
사진상자 = (540, 700, 960, 760)       # 가운데 x, y, 넓이, 높이 — 크레딧은 그 아래(엔딩카드.cjs 「.아래」 top 1150)
쿠키자리 = 820                        # 쿠키 그림(1672×941)에서 시계와 알림이 든 가운데 x


def 얹기(판, 층, 투명, 흐림=0.0, 가림=None):
    if 투명 <= 0:
        return
    if 흐림 > 0.15:
        층 = cv2.GaussianBlur(층, (0, 0), 흐림)
    if 가림 is not None:
        층 = 층.copy()
        층[:, 가림:, 3] = 0
    덮기(판, 층, 0, 0, 투명)


def 세로자름(im, cx):
    """그림을 높이 그대로 9:16로 자른다(가운데 x)."""
    h, w = im.shape[:2]
    cw = round(h * 9 / 16)
    x0 = max(0, min(w - cw, round(cx - cw / 2)))
    return im[:, x0:x0 + cw]


def 밀기(im, t, a, b, 배율, 중심):
    u = (t - a) / (b - a)
    z = 1 + 배율 * u
    h, w = im.shape[:2]
    cx, cy = 중심[0] * w, 중심[1] * h
    M = np.float32([[z * W / w, 0, (cx - cx * z) * W / w], [0, z * H / h, (cy - cy * z) * H / h]])
    return cv2.warpAffine(im.astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)


def 그레인입히기(판, rng):
    n = rng.normal(0, 1, (H // 2 + 1, W // 2 + 1)).astype(np.float32)
    n = cv2.resize(n, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * 그레인 * 1.6
    return 판 + n


def 영화(설정, 일터):
    """옥상 영화 장면 네 컷을 9:16로 잘라 잇는다(소리 없이 — 소리는 가로판에서)."""
    ins, f = [], []
    for i, ((p, s, e), cx) in enumerate(zip(설정["영화"], 영화자리)):
        ins += ["-i", p]
        x0 = max(0, min(1280 - 405, cx - 202))
        f.append(f"[{i}:v]trim={s}:{e},setpts=PTS-STARTPTS,fps={FPS},crop=405:720:{x0}:0,scale={W}:{H}:flags=lanczos,"
                 f"unsharp=5:5:0.35,setsar=1,format=yuv420p[v{i}]")
    n = len(설정["영화"])
    f.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]")
    v = os.path.join(일터, "영화_세로.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *ins, "-filter_complex", ";".join(f),
                    "-map", "[v]", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", v], check=True)
    return v, sum(e - s for _, s, e in 설정["영화"])


def 뒤판(설정, 시작, 일터, 글자):
    T = {k: (박(설정, v) if isinstance(v, int) else v) for k, v in 설정["때"].items()}
    끝 = T["끝"]
    글 = {f[:-4]: 읽기(os.path.join(글자, f), True) for f in os.listdir(글자) if f.endswith(".png")}
    줄층 = 글["쓰인말_2줄"]
    xs = np.where(줄층[..., 3].max(0) > 0)[0]
    줄x0, 줄x1 = int(xs.min()), int(xs.max()) + 1
    cx, cy, bw, bh = 사진상자
    경계 = [박(설정, k) for k in 설정["사진박"]]
    사진 = [(경계[i], 경계[i + 1], 옛.사진층(읽기(p), bw, bh), f"출연_{i + 1}") for i, p in enumerate(설정["사진"])]
    사진첩끝 = 경계[-1]
    엄마사진 = 옛.사진층(읽기(설정["엄마사진"]), bw, bh)
    어둠 = 읽기(설정["상영관"])
    sx0, sy0, sx1, sy1 = 설정["스크린"]
    스크린x = (sx0 + sx1) / 2
    쿠키 = 읽기(설정["쿠키"])
    꺼짐 = np.zeros(쿠키.shape[:2], np.float32)
    cv2.fillPoly(꺼짐, [np.int32(설정["쿠키화면"])], 1.0)
    꺼짐 = cv2.GaussianBlur(꺼짐, (0, 0), 6)[..., None]
    쿠키켬 = 세로자름(쿠키.astype(np.float32), 쿠키자리)
    쿠키끔 = 세로자름(쿠키.astype(np.float32) * (1 - 꺼짐 * 0.97), 쿠키자리)
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", 설정["객석영상"], "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True, check=True).stdout
    객석 = np.frombuffer(b, np.uint8).reshape(-1, 720, 1280, 3)
    빈원본 = 읽기(설정["객석빈"])

    def 텅빈():
        return np.full((H, W, 3), 바탕, np.float32)

    def 카드(t, 이름, a, b, 판=None, 들어옴=0.5):
        판 = 텅빈() if 판 is None else 판
        투명, 흐림 = 맺힘(t, a, b, 들어옴)
        얹기(판, 글[이름], 투명, 흐림)
        return 판

    def 사진판(t):
        판 = 텅빈()
        for a, b, p, 이름 in 사진:
            if a <= t < b:
                투명 = 빠르게멈춤((t - a) / 0.4) if a == 경계[0] else 1.0
                if b == 사진첩끝:
                    투명 *= min(1.0, (b - t) / 0.4)
                덮기(판, p, cx - p.shape[1] // 2, cy - p.shape[0] // 2, 투명)
                카드(t, 이름, a + 0.15, b, 판, 0.4)
        return 판

    def 쓰인말판(t):
        판 = 텅빈()
        a, b = T["쓰인말"], T["마지막"]
        얹기(판, 글["쓰인말_머리"], *맺힘(t, a + 0.1, b))
        for 이름, 시 in (("쓰인말_1", T["쓰인말"] + 0.25), ("쓰인말_2", T["쓰인말2"]), ("쓰인말_3", T["쓰인말3"])):
            얹기(판, 글[이름], *맺힘(t, 시, b))
        u = (t - T["줄긋기"]) / 0.4
        if u > 0:
            투명 = 1.0 if t < b - 0.35 else max(0.0, (b - t) / 0.35)
            얹기(판, 줄층, 투명, 0, 가림=round(줄x0 + (줄x1 - 줄x0) * min(1.0, u)))
        얹기(판, 글["쓰인말_2고침"], *맺힘(t, T["줄긋기"] + 0.5, b, 0.4))
        return 판

    def 엄마판(t):
        판 = 텅빈()
        투명, _ = 옛.나타남(t, T["특별출연"], 끝 + 1, 0.5, 0.1)
        덮기(판, 엄마사진, cx - 엄마사진.shape[1] // 2, cy - 엄마사진.shape[0] // 2, 투명)
        얹기(판, 글["특별출연"], *맺힘(t, T["특별출연"] + 0.4, 끝 + 1))
        return 판

    # 빠지기: 세로 화면을 스크린 높이로 스크린 가운데에 건다(스크린의 나머지는 엔딩 바탕처럼 어둡다).
    # 창은 그 화면에서 시작해 9:16을 지키며 상영관 높이 전체로 물러난다. 큰 판 전체를 섞지 않고 창이 닿는 자리만 섞는다.
    sh = sy1 - sy0
    cw = sh * 9 / 16
    k = W / cw
    큰h, 큰w = round(어둠.shape[0] * k), round(어둠.shape[1] * k)
    큰바탕 = cv2.resize(어둠, (큰w, 큰h), interpolation=cv2.INTER_CUBIC)
    회 = cv2.cvtColor(어둠, cv2.COLOR_BGR2GRAY)
    면 = np.zeros(어둠.shape[:2], np.float32)
    면[sy0:sy1, sx0:sx1] = (회[sy0:sy1, sx0:sx1] > 30).astype(np.float32)
    면 = cv2.morphologyEx(면, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    면 = cv2.GaussianBlur(cv2.resize(면, (큰w, 큰h), interpolation=cv2.INTER_LINEAR), (0, 0), 1.5)
    사각 = np.zeros((큰h, 큰w), np.float32)
    사각[round(sy0 * k):round(sy1 * k), round(sx0 * k):round(sx1 * k)] = 1
    ox, oy = round((스크린x - cw / 2) * k), round(sy0 * k)
    fw = 큰w                     # 끝 창: 상영관 전체 넓이(가로판의 객석 자리와 같다)
    fh = fw * 16 / 9
    fx, fy = 0.0, 큰h / 2 - fh / 2

    def 빠지기판(t, 화면):
        u = 부드럽게((t - T["빠지기"]) / (T["빠지기끝"] - T["빠지기"]))
        r = 부드럽게(u / 0.35)
        vw = W * (fw / W) ** u      # 배율은 곱으로 늘려 물러나는 빠르기가 고르게 보이게
        s = (vw - W) / (fw - W)
        vx, vy = ox + (fx - ox) * s, oy + (fy - oy) * s
        vh = vw * 16 / 9
        x0, y0 = max(0, int(vx) - 2), max(0, int(vy) - 2)
        x1, y1 = min(큰w, int(vx + vw) + 3), min(큰h, int(vy + vh) + 3)
        조각 = 큰바탕[y0:y1, x0:x1].astype(np.float32)
        m = (면[y0:y1, x0:x1] * r + 사각[y0:y1, x0:x1] * (1 - r))[..., None]
        덮개 = np.full_like(조각, 바탕)
        a0, b0 = max(oy, y0), max(ox, x0)
        a1, b1 = min(oy + H, y1), min(ox + W, x1)
        if a1 > a0 and b1 > b0:
            덮개[a0 - y0:a1 - y0, b0 - x0:b1 - x0] = 화면[a0 - oy:a1 - oy, b0 - ox:b1 - ox]
        섞음 = 조각 * (1 - m) + 덮개 * m
        M = np.float32([[W / vw, 0, -(vx - x0) * W / vw], [0, H / vh, -(vy - y0) * H / vh]])
        return cv2.warpAffine(섞음, M, (W, H), flags=cv2.INTER_AREA if vw > W * 1.2 else cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_CONSTANT, borderValue=(바탕, 바탕, 바탕))

    가로h = round(W * 9 / 16)
    가로y = (H - 가로h) // 2
    빈가로 = cv2.resize(빈원본, (W, 가로h), interpolation=cv2.INTER_AREA).astype(np.float32)

    def 객석판(t):
        a, b = 설정.get("객석시작", 0.0), 설정.get("객석끝", len(객석) / FPS)
        tv = t - T["불"]
        장 = cv2.resize(객석[min(len(객석) - 1, int((a + tv) * FPS))], (W, 가로h), interpolation=cv2.INTER_AREA).astype(np.float32)
        if tv > b - a:
            u = min(1.0, (tv - (b - a)) / 0.8)
            z = 1 + 0.012 * (t - T["불"] - (b - a)) / (T["정적"] - T["불"] - (b - a))
            cx, cy = 0.5 * W, 0.78 * 가로h
            M = np.float32([[z, 0, cx - cx * z], [0, z, cy - cy * z]])
            장 = 장 * (1 - u) + cv2.warpAffine(빈가로, M, (W, 가로h), flags=cv2.INTER_LINEAR) * u
        판 = 텅빈()
        판[가로y:가로y + 가로h] = 장
        return 판 * min(1.0, max(0.0, (T["정적"] - t) / 0.6))

    rng = np.random.default_rng(20261121)
    밖 = os.path.join(일터, "뒤_세로.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", 밖],
                         stdin=subprocess.PIPE)
    for i in range(round((끝 - 시작) * FPS)):
        t = 시작 + i / FPS
        if t < T["주연"]:
            판 = 카드(t, "제목", T["제목"], T["주연"] - 0.05)
        elif t < 경계[0]:
            판 = 카드(t, "주연", T["주연"] + 0.1, 경계[0] - 0.05)
        elif t < 사진첩끝:
            판 = 사진판(t)
        elif t < T["마지막"]:
            판 = 쓰인말판(t)
        elif t < T["특별출연"]:
            판 = 카드(t, "마지막", T["마지막"] + 0.15, T["특별출연"] - 0.05)
        elif t < T["빠지기"]:
            판 = 엄마판(t)
        elif t < T["불"]:
            판 = 빠지기판(min(t, T["빠지기끝"]), 엄마판(t))
        elif t < T["정적"]:
            판 = 객석판(t)
        elif t < T["쿠키"]:
            판 = 텅빈() * 0
        elif t < T["쿠키끝"]:
            켜짐 = min(1.0, max(0.0, (t - T["쿠키켜짐"]) / 0.12))
            판 = 밀기(쿠키끔 * (1 - 켜짐) + 쿠키켬 * 켜짐, t, T["쿠키"], T["쿠키끝"], 0.03, (0.5, 0.5))
        else:
            판 = 텅빈() * 0
        판 = 그레인입히기(판, rng)
        p.stdin.write(np.clip(판, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    p.wait()
    return 밖


def main():
    밖, 설정, 가로, 글자 = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8")), sys.argv[3], sys.argv[4]
    일터 = os.path.join(os.path.dirname(os.path.abspath(밖)), "_일터세로")
    os.makedirs(일터, exist_ok=True)
    v1, 영화초 = 영화(설정, 일터)
    v2 = 뒤판(설정, 영화초, 일터, 글자)
    목록 = os.path.join(일터, "목록.txt")
    open(목록, "w", encoding="utf-8").write(f"file '{v1}'\nfile '{v2}'\n")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", 목록, "-i", 가로,
                    "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", 밖], check=True)
    print("끝", 밖)


if __name__ == "__main__":
    main()
