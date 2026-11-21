"""
꿈 무대 엔딩 여덟째 판(2026-11-20) — 옥상 영화 장면 뒤에 시즌 마무리 엔딩을 붙인다. 짜임은 일곱째 판(엔딩잇기.py)과 같고 결이 다르다.
유호님 11-20 「디자인 사이트 크롤링해서 전부 자율주행으로 엔딩 마무리 트렌디하게」에 따른 조사(README 「엔딩 여덟째 판」)를 옮겼다.

- 흐르던 출연 크레딧을 정지 카드로 바꾼다. 기념 컷 한 장에 출연 한두 쌍을 짝짓는다(Anaconda 2025 · tvN 「가족입니다」).
- 카드는 모두 엔딩곡의 박(76BPM, 0.79초)에 맞춰 바뀐다. 글자는 초점이 맺히듯 0.5초에 나타난다(Aftersun). 사진은 박에서 끊는다.
- 「이 영화에 쓰인 말」은 한 줄씩 쌓이고, 틀린 말에는 줄이 왼쪽에서 오른쪽으로 그어진 뒤 고친 말이 나온다.
- 엔딩 전체에 얇은 필름 그레인을 같은 값으로 입힌다. 바탕은 #000 대신 #0B0B0B다.
- 엔딩곡은 읽을 시간이 늘어난 만큼 가운데 두 마디(16.83~23.15초, 8박)를 한 번 더 잇는다. 마지막 화음은 그대로 「특별출연」 카드 아래에 온다.
- 영화관은 같은 방의 그림(어둠3)으로 빠지고, 불이 켜지며 관객이 나가는 5초 영상(설정 「객석영상」)으로 잇는다. 영상이 없으면 그림 두 장을 쓴다.

    python -I -X utf8 엔딩잇기8.py <밖.mp4> <설정.json>

파생판(11-21, 유호님 「응, 파생판부터」)은 설정에 세 칸을 더해 같은 스크립트로 잇는다.
- 「자막」: [[글자 폴더의 그림 이름, 시작초, 끝초], …] — 엄마 모국어 자막판. 영화 장면 위와 엔딩 위에 같은 결로 얹는다.
- 「타자」: [{"기록": 입력 기록.json, "시작": 초, "끝": 초, "자리": [가운데 x, 글 아래 y]}] — 목소리를 꺼 둔 학생의 글자 판.
  기록은 [[밀리초, 입력창의 글], …]이고 친 속도대로 보인다(견본은 `엔딩타자.py`).
- 「곡잇기횟수」: 가운데 두 마디를 몇 번 더 잇나(기본 1). 글자 판은 친 시간만큼 카드가 길어져 3이다.

카드 글자는 `엔딩카드.cjs`(원고 `엔딩원고.cjs`의 「판8」), 제작 마크는 `엔딩로고.py`의 평면 판이다.
"""
import importlib.util
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

_s = importlib.util.spec_from_file_location("옛", os.path.join(os.path.dirname(os.path.abspath(__file__)), "엔딩잇기.py"))
옛 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(옛)
FPS, W, H, SR = 옛.FPS, 옛.W, 옛.H, 옛.SR
읽기, 맞춤, 덮기, 빠르게멈춤, 부드럽게 = 옛.읽기, 옛.맞춤, 옛.덮기, 옛.빠르게멈춤, 옛.부드럽게
바탕 = 11.0          # #0B0B0B
그레인 = 3.6         # 0~255 눈금의 표준편차(조사 「불투명도 4~8%, 입자 약 1.2px」를 이 화면에서 눈으로 맞춘 값)


def 박(설정, k):
    return 설정["박"]["0"] + 설정["박"]["간격"] * k


def 맺힘(t, a, b, 들어옴=0.5, 나감=0.35):
    """글자가 초점이 맺히듯 나타난다 — (투명도, 흐림 시그마)."""
    if t < a or t > b:
        return 0.0, 0.0
    u = 빠르게멈춤((t - a) / 들어옴)
    v = 1.0 if t < b - 나감 else max(0.0, (b - t) / 나감)
    return u * v, 3.0 * (1 - u)


def 얹기(판, 층, 투명, 흐림=0.0, 가림=None):
    if 투명 <= 0:
        return
    if 흐림 > 0.15:
        층 = cv2.GaussianBlur(층, (0, 0), 흐림)
    if 가림 is not None:
        층 = 층.copy()
        층[:, 가림:, 3] = 0
    덮기(판, 층, 0, 0, 투명)


def 밀기(im, t, a, b, 배율, 중심):
    """그림을 천천히 당긴다(일곱째 판 뒤판 안의 밀기와 같다)."""
    u = (t - a) / (b - a)
    z = 1 + 배율 * u
    h, w = im.shape[:2]
    cx, cy = 중심[0] * w, 중심[1] * h
    M = np.float32([[z * W / w, 0, (cx - cx * z) * W / w], [0, z * H / h, (cy - cy * z) * H / h]])
    return cv2.warpAffine(im.astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)


def 그레인입히기(판, rng):
    n = rng.normal(0, 1, (H // 2 + 1, W // 2 + 1)).astype(np.float32)
    n = cv2.resize(n, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * 그레인 * 1.6   # 약 1.2px 입자(반 해상도에서 키움)
    return 판 + n


def 덧만들기(설정):
    """파생판의 덧층(자막 · 친 글자)을 그리는 함수를 돌려준다. 없으면 None. 그레인보다 먼저 얹는다."""
    자막 = 설정.get("자막") or []
    타자 = 설정.get("타자") or []
    if not 자막 and not 타자:
        return None
    그림 = {}
    for 이름, _, _ in 자막:
        그림[이름] = cv2.resize(읽기(os.path.join(설정["글자"], 이름 + ".png"), True), (W, H), interpolation=cv2.INTER_AREA)
    글꼴자리 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "docs", "브랜드_폰트", "SUIT", "SUIT-Medium.otf")
    색 = (210, 223, 230, 255)   # #E6DFD2(BGR 순서로 그린 뒤 그대로 쓴다)
    판들 = []
    for 타 in 타자:
        기록 = json.load(open(타["기록"], encoding="utf-8"))
        상태 = [(m / 1000, 글) for m, 글 in 기록["글"]]
        크기 = 타.get("크기", 32)
        글꼴 = ImageFont.truetype(글꼴자리, 크기 * 2)
        판들.append({**타, "상태": 상태, "x0": round(타["자리"][0] - 글꼴.getlength(상태[-1][1]) / 4), "글꼴": 글꼴, "크기": 크기, "캐시": {}})

    def 줄그림(글, 글꼴, 크기):
        w, h = max(4, int(글꼴.getlength(글)) + 40), 크기 * 3
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((0, round(h * 0.8)), 글, font=글꼴, fill=색, anchor="ls")
        return cv2.resize(np.array(im), (w // 2, h // 2), interpolation=cv2.INTER_AREA), 글꼴.getlength(글) / 2

    def 덧(t, 판):
        for 이름, a, b in 자막:
            if a - 0.12 <= t <= b + 0.12:
                투명 = min(1.0, (t - a + 0.12) / 0.12, (b + 0.12 - t) / 0.12)
                덮기(판, 그림[이름], 0, 0, max(0.0, 투명))
        for 타 in 판들:
            a, b = 타["시작"], 타["끝"]
            if not (a <= t <= b):
                continue
            tr = t - a
            글, 마지막 = "", None
            for 초, s in 타["상태"]:
                if 초 <= tr:
                    글, 마지막 = s, 초
            투명 = min(1.0, (b - t) / 0.35)
            if 글:
                if 글 not in 타["캐시"]:
                    타["캐시"][글] = 줄그림(글, 타["글꼴"], 타["크기"])
                층, 길이 = 타["캐시"][글]
            else:
                층, 길이 = None, 0.0
            x0, y, 크기 = 타["x0"], 타["자리"][1], 타["크기"]
            if 층 is not None:
                덮기(판, 층, x0, y - round(크기 * 1.2), 투명)
            쉼 = tr - (마지막 if 마지막 is not None else 0.0)
            if 쉼 < 0.45 or (쉼 - 0.45) % 1.0 < 0.5:   # 치는 동안은 켜 두고, 멈추면 깜빡인다
                cx = x0 + round(길이) + 3
                판[y - 크기:y + 크기 // 5, cx:cx + 2] = 판[y - 크기:y + 크기 // 5, cx:cx + 2] * (1 - 0.85 * 투명) + np.array([210, 223, 230], np.float32) * 0.85 * 투명
    return 덧


def 덧입히기(v, 덧, 일터):
    """영화 장면(ffmpeg로 이은 앞판)에 덧층을 얹어 다시 굽는다."""
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    장들 = np.frombuffer(b, np.uint8).reshape(-1, H, W, 3)
    밖 = os.path.join(일터, "영화_덧.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", 밖],
                         stdin=subprocess.PIPE)
    for i, 장 in enumerate(장들):
        판 = 장.astype(np.float32)
        덧(i / FPS, 판)
        p.stdin.write(np.clip(판, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    p.wait()
    return 밖


def 뒤판(설정, 시작, 일터, 덧=None):
    T = {k: (박(설정, v) if isinstance(v, int) else v) for k, v in 설정["때"].items()}
    끝 = T["끝"]
    글 = {}
    for f in os.listdir(설정["글자"]):
        if f.endswith(".png"):
            글[f[:-4]] = cv2.resize(읽기(os.path.join(설정["글자"], f), True), (W, H), interpolation=cv2.INTER_AREA)
    줄층 = 글["쓰인말_2줄"]
    xs = np.where(줄층[..., 3].max(0) > 0)[0]
    줄x0, 줄x1 = int(xs.min()), int(xs.max()) + 1
    cx, cy, bw, bh = 설정["사진상자"]
    사진 = []
    경계 = [박(설정, k) for k in 설정["사진박"]]
    for i, p in enumerate(설정["사진"]):
        사진.append((경계[i], 경계[i + 1], 옛.사진층(읽기(p), bw, bh), f"출연_{i + 1}"))
    사진첩끝 = 경계[-1]
    엄마사진 = 옛.사진층(읽기(설정["엄마사진"]), bw, bh)
    어둠 = 읽기(설정["상영관"])
    불 = 읽기(설정["상영관불"])
    쿠키 = 읽기(설정["쿠키"])
    꺼짐 = np.zeros(쿠키.shape[:2], np.float32)
    cv2.fillPoly(꺼짐, [np.int32(설정["쿠키화면"])], 1.0)
    꺼짐 = cv2.GaussianBlur(꺼짐, (0, 0), 6)[..., None]
    쿠키꺼짐 = 쿠키.astype(np.float32) * (1 - 꺼짐 * 0.97)
    sx0, sy0, sx1, sy1 = 설정["스크린"]
    객석 = None
    if 설정.get("객석영상") and os.path.exists(설정["객석영상"]):
        b = subprocess.run(["ffmpeg", "-v", "error", "-i", 설정["객석영상"], "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos", "-f", "rawvideo",
                            "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
        객석 = np.frombuffer(b, np.uint8).reshape(-1, H, W, 3)

    def 텅빈(t):
        return np.full((H, W, 3), 바탕, np.float32)

    def 카드(t, 이름, a, b, 판=None, 들어옴=0.5):
        판 = 텅빈(t) if 판 is None else 판
        투명, 흐림 = 맺힘(t, a, b, 들어옴)
        얹기(판, 글[이름], 투명, 흐림)
        return 판

    def 사진판(t):
        판 = 텅빈(t)
        for a, b, p, 이름 in 사진:
            if a <= t < b:
                투명 = 빠르게멈춤((t - a) / 0.4) if a == 경계[0] else 1.0
                if b == 사진첩끝:
                    투명 *= min(1.0, (b - t) / 0.4)
                덮기(판, p, cx - p.shape[1] // 2, cy - p.shape[0] // 2, 투명)
                카드(t, 이름, a + 0.15, b, 판, 0.4)
        return 판

    def 쓰인말판(t):
        판 = 텅빈(t)
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
        판 = 텅빈(t)
        투명, _ = 옛.나타남(t, T["특별출연"], 끝 + 1, 0.5, 0.1)
        덮기(판, 엄마사진, cx - 엄마사진.shape[1] // 2, cy - 엄마사진.shape[0] // 2, 투명)
        얹기(판, 글["특별출연"], *맺힘(t, T["특별출연"] + 0.4, 끝 + 1))
        return 판

    # 빠지기: 상영관 그림을 키운 큰 판의 스크린 면에만 엔딩 화면을 얹는다. 스크린 면은 사각형 안에서 밝기 30을 넘는 곳이라
    # 스크린 아래쪽에 겹친 앞줄 관객의 머리(어두움)는 그대로 남는다(11-20 어둠3 그림은 머리가 스크린 아래 끝에 걸친다).
    sh = sy1 - sy0
    cw = sh * 16 / 9
    cx0 = (sx0 + sx1) / 2 - cw / 2
    k = W / cw
    큰바탕 = cv2.resize(어둠, (round(어둠.shape[1] * k), round(어둠.shape[0] * k)), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    면 = np.zeros(어둠.shape[:2], np.float32)
    사각 = np.zeros(어둠.shape[:2], np.float32)
    사각[sy0:sy1, sx0:sx1] = 1
    사각 = cv2.resize(사각, (큰바탕.shape[1], 큰바탕.shape[0]), interpolation=cv2.INTER_LINEAR)[..., None]
    회 = cv2.cvtColor(어둠, cv2.COLOR_BGR2GRAY)
    면[sy0:sy1, sx0:sx1] = (회[sy0:sy1, sx0:sx1] > 30).astype(np.float32)
    면 = cv2.morphologyEx(면, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    면 = cv2.GaussianBlur(cv2.resize(면, (큰바탕.shape[1], 큰바탕.shape[0]), interpolation=cv2.INTER_LINEAR), (0, 0), 1.5)[..., None]
    ox, oy = round(cx0 * k), round(sy0 * k)

    def 빠지기판(t, 화면):
        덮개 = np.full_like(큰바탕, 바탕)
        덮개[oy:oy + H, ox:ox + W] = 화면[: 큰바탕.shape[0] - oy, : 큰바탕.shape[1] - ox]
        u = 부드럽게((t - T["빠지기"]) / (T["빠지기끝"] - T["빠지기"]))
        r = 부드럽게(u / 0.35)   # 처음에는 스크린 사각형 전체를 덮고, 빠지면서 앞줄 머리가 드러난다(첫 장에 머리가 튀어나오지 않게)
        m = 면 * r + 사각 * (1 - r)
        큰 = 큰바탕 * (1 - m) + 덮개 * m
        fw, fh = 큰.shape[1], 큰.shape[1] * 9 / 16
        fy = (큰.shape[0] - fh) / 2
        vx, vy = ox + (0 - ox) * u, oy + (fy - oy) * u
        vw = W + (fw - W) * u
        vh = vw * 9 / 16
        M = np.float32([[W / vw, 0, -vx * W / vw], [0, H / vh, -vy * H / vh]])
        return cv2.warpAffine(큰, M, (W, H), flags=cv2.INTER_AREA if vw > W * 1.2 else cv2.INTER_LINEAR)

    # 객석: 불이 켜지며 관객이 나가는 영상(설정 「객석영상」)의 [객석시작, 객석끝]초를 쓰고, 빈 객석 그림(「객석빈」, 같은 구도)으로 0.8초에 녹여 넘긴다.
    # 11-20 받은 영상은 첫 0.8초에 화면이 넓게 물러나고 끝까지 두 사람이 남아서, 앞을 자르고 끝을 빈 객석 그림으로 맺는다.
    빈 = cv2.resize(읽기(설정["객석빈"]), (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) if 설정.get("객석빈") and os.path.exists(설정["객석빈"]) else None

    def 객석판(t):
        if 객석 is not None:
            a = 설정.get("객석시작", 0.0)
            b = 설정.get("객석끝", len(객석) / FPS)
            tv = t - T["불"]
            판 = 객석[min(len(객석) - 1, int((a + tv) * FPS))].astype(np.float32)   # 녹이는 동안에도 영상은 흐른다
            if 빈 is not None and tv > b - a:
                u = min(1.0, (tv - (b - a)) / 0.8)
                빈판 = 밀기(빈, t, T["불"] + b - a, T["정적"], 0.012, (0.5, 0.78))
                판 = 판 * (1 - u) + 빈판 * u
        else:
            판 = 밀기(불, t, T["불"], T["정적"], 0.02, (0.5, 0.78))
        return 판 * min(1.0, max(0.0, (T["정적"] - t) / 0.6))

    rng = np.random.default_rng(20261120)
    밖 = os.path.join(일터, "뒤.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", 밖],
                         stdin=subprocess.PIPE)
    n = round((끝 - 시작) * FPS)
    for i in range(n):
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
            판 = 텅빈(t) * 0   # 정적은 아주 검게(그레인만)
        elif t < T["쿠키끝"]:
            켜짐 = min(1.0, max(0.0, (t - T["쿠키켜짐"]) / 0.12))
            원 = 쿠키꺼짐 * (1 - 켜짐) + 쿠키.astype(np.float32) * 켜짐
            판 = 밀기(원, t, T["쿠키"], T["쿠키끝"], 0.03, (0.56, 0.62))
        else:
            판 = 텅빈(t) * 0
        if 덧 is not None:
            덧(t, 판)
        판 = 그레인입히기(판, rng)
        p.stdin.write(np.clip(판, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    p.wait()
    return 밖, T


def 곡늘이기(설정, 일터):
    """엔딩곡 가운데 두 마디(설정 「곡잇기」의 [a, b]초, 8박)를 「곡잇기횟수」(기본 1)만큼 더 잇는다. 두 자리 모두 소리가 잦아드는 박이라 60ms로 겹친다."""
    s = 옛.소리읽기(설정["곡"])
    a, b = 설정["곡잇기"]
    ia, ib, k = round(a * SR), round(b * SR), round(0.06 * SR)
    r = np.linspace(0, 1, k)[:, None]
    앞, 조각 = s[:ib].copy(), s[ia:ib].copy()
    for x in (앞, 조각):   # b에서 a로 되돌아가는 자리마다 60ms로 겹친다
        x[-k:] = x[-k:] * np.cos(r * np.pi / 2) + s[ia - k:ia] * np.sin(r * np.pi / 2)
    out = np.concatenate([앞] + [조각] * (설정.get("곡잇기횟수", 1) - 1) + [s[ia:]])
    p = os.path.join(일터, "곡_늘임.wav")
    (np.clip(out, -1, 1) * 32767).astype(np.int16).tofile(p + ".raw")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", p + ".raw", p], check=True)
    os.remove(p + ".raw")
    return p


def main():
    밖, 설정 = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
    일터 = os.path.join(os.path.dirname(os.path.abspath(밖)), "_일터8")
    os.makedirs(일터, exist_ok=True)
    v1, a1, 영화초 = 옛.영화(설정, 일터)
    덧 = 덧만들기(설정)
    if 덧 is not None:
        v1 = 덧입히기(v1, 덧, 일터)
    v2, T = 뒤판(설정, 영화초, 일터, 덧)
    목록 = os.path.join(일터, "목록.txt")
    open(목록, "w", encoding="utf-8").write(f"file '{v1}'\nfile '{v2}'\n")
    붙음 = os.path.join(일터, "붙음.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", 목록, "-c", "copy", 붙음], check=True)
    소리설정 = dict(설정)
    소리설정["곡"] = 곡늘이기(설정, 일터)
    소리설정["때"] = {"끝": T["끝"]}
    소리설정["목소리"] = [[p, (박(설정, 초) + 0.1 if isinstance(초, int) else 초)] for p, 초 in 설정["목소리"]]
    a = 옛.소리(소리설정, a1, 영화초, 일터)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", 붙음, "-i", a, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", 밖], check=True)
    print("끝", 밖, json.dumps({k: round(v, 2) for k, v in T.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
