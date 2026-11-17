"""
꿈 무대 엔딩(2026-11-18) — 옥상 영화 장면 뒤에 시즌 마무리 엔딩(제목 → 주연 → 촬영 현장 사진첩과 흐르는 출연 크레딧 →
이 영화에 쓰인 말 → 엔딩곡 · 촬영 · 제작 → 특별출연 엄마에서 영화관으로 빠짐 → 불이 켜진 빈 객석 → 정적 → 쿠키 「도착.」)을 붙여 한 편으로 만든다.
유호님 「진짜 영화 엔딩처럼 (조사해봐) 크레딧 나오면서 synkpulerse같은 마크도 … 마치 좋은 추억, 좋은 선물처럼」에서 나왔다.
짜임과 까닭(조사 · 맹검 시험관 넷)은 README 「시즌 마무리 엔딩」 절에 있다.

    python -I -X utf8 엔딩잇기.py <밖.mp4> <설정.json>

설정.json은 재료 경로와 판마다 바뀌는 값(학생 이름이 든 글자 그림, 사진 일곱 장과 초, 목소리 두 줄, 상영관 그림 둘과 스크린 자리)을 담는다.
엔딩 글자는 `엔딩크레딧.cjs`, 제목은 `끝글자.cjs`, 곡은 `엔딩곡.py`가 만든다. 그림 엔진은 글자를 굽지 않는다.
소리는 numpy로 한 줄에 놓고(곡은 목소리 자리에서 낮춘다) 마지막에 loudnorm I=-16을 한 번 건다.
"""
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

FPS, W, H, SR = 24, 1280, 720, 48000


def 읽기(p, 알파=False):
    im = cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_UNCHANGED)
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    if 알파 and im.shape[2] == 3:
        im = np.dstack([im, np.full(im.shape[:2], 255, np.uint8)])
    if not 알파 and im.shape[2] == 4:
        im = im[..., :3]
    return im


def 맞춤(im, 가로, 세로):
    """비율을 지키며 상자 안에 들어가게 줄인다."""
    h, w = im.shape[:2]
    s = min(가로 / w, 세로 / h)
    return cv2.resize(im, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)


def 덮기(판, 층, x, y, 투명=1.0):
    """판(BGR float) 위에 층(BGRA uint8)을 (x, y)에 얹는다. 판 밖으로 나간 부분은 자른다."""
    h, w = 층.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(판.shape[1], x + w), min(판.shape[0], y + h)
    if x1 <= x0 or y1 <= y0 or 투명 <= 0:
        return
    c = 층[y0 - y:y1 - y, x0 - x:x1 - x].astype(np.float32)
    a = c[..., 3:4] / 255 * 투명
    판[y0:y1, x0:x1] = 판[y0:y1, x0:x1] * (1 - a) + c[..., :3] * a


def 사진층(im, 가로, 세로):
    p = 맞춤(im, 가로, 세로)
    return np.dstack([p, np.full(p.shape[:2], 255, np.uint8)])


def 빠르게멈춤(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 5


def 부드럽게(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def 나타남(t, 시작, 끝, 들어옴=0.4, 나감=0.4):
    """카드의 투명도와 올라오는 거리(12px, 0.4초, 빠르게 나와 천천히 멈춤 — 후반 가이드 「엔드카드」)."""
    if t < 시작 or t > 끝:
        return 0.0, 0
    a = 빠르게멈춤((t - 시작) / 들어옴)
    b = 1.0 if t < 끝 - 나감 else max(0.0, (끝 - t) / 나감)
    return a * b, round(12 * (1 - 빠르게멈춤((t - 시작) / 들어옴)))


def 영화(설정, 일터):
    """옥상 영화 장면을 잘라 붙인다(이어붙이기.py와 같은 길, loudnorm 없이)."""
    ins, f = [], []
    for i, (p, s, e) in enumerate(설정["영화"]):
        ins += ["-i", p]
        d = e - s
        f.append(f"[{i}:v]trim={s}:{e},setpts=PTS-STARTPTS,fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p[v{i}]")
        f.append(f"[{i}:a]atrim={s}:{e},asetpts=PTS-STARTPTS,aresample={SR},aformat=channel_layouts=stereo,afade=t=in:d=0.08,afade=t=out:st={max(0, d - 0.08):.3f}:d=0.08[a{i}]")
    n = len(설정["영화"])
    f.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]")
    f.append("".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[a]")
    v, a = os.path.join(일터, "영화.mp4"), os.path.join(일터, "영화.wav")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *ins, "-filter_complex", ";".join(f),
                    "-map", "[v]", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", v,
                    "-map", "[a]", "-c:a", "pcm_s16le", a], check=True)
    return v, a, sum(e - s for _, s, e in 설정["영화"])


def 뒤판(설정, 시작, 일터):
    """엔딩 부분의 장을 하나씩 그려 ffmpeg로 넘긴다. 시각은 영상 전체의 초다."""
    T = 설정["때"]
    끝 = T["끝"]
    글 = {k: 읽기(p, True) for k, p in 설정["글자"].items()}
    글 = {k: cv2.resize(v, (W, H), interpolation=cv2.INTER_AREA) if v.shape[1] >= W * 1.5 else v for k, v in 글.items()}
    롤 = 읽기(설정["출연판"], True)
    롤 = cv2.resize(롤, (롤.shape[1] // 2, 롤.shape[0] // 2), interpolation=cv2.INTER_AREA)
    사진상자 = 설정["사진상자"]  # [가운데 x, 가운데 y, 가로, 세로]
    사진 = []
    t0 = T["사진첩"]
    for p, 초 in 설정["사진"]:
        사진.append((t0, t0 + 초, 사진층(읽기(p), 사진상자[2], 사진상자[3])))
        t0 += 초
    사진첩끝 = t0
    롤x = 설정["롤x"]
    롤속도 = (H + 롤.shape[0]) / (사진첩끝 - T["사진첩"])
    엄마사진 = 사진층(읽기(설정["엄마사진"]), 사진상자[2], 사진상자[3])
    특별 = 읽기(설정["특별출연판"], True)
    특별 = cv2.resize(특별, (특별.shape[1] // 2, 특별.shape[0] // 2), interpolation=cv2.INTER_AREA)
    어둠, 불 = 읽기(설정["상영관"]), 읽기(설정["상영관불"])
    쿠키 = 읽기(설정["쿠키"])
    # 쿠키의 휴대폰 화면은 꺼져 있다가 진동과 함께 켜진다(11-18 최종본 검사 「굳음 0.013」 · 「끝 소리 한 방 없음」을 받아). 화면 자리는 설정의 네 점
    꺼짐 = np.zeros(쿠키.shape[:2], np.float32)
    cv2.fillPoly(꺼짐, [np.int32(설정["쿠키화면"])], 1.0)
    꺼짐 = cv2.GaussianBlur(꺼짐, (0, 0), 6)[..., None]
    쿠키꺼짐 = 쿠키.astype(np.float32) * (1 - 꺼짐 * 0.97)
    sx0, sy0, sx1, sy1 = 설정["스크린"]  # 상영관 그림 속 스크린 네 변(픽셀)

    def 사진판(t, 판):
        for a, b, p in 사진:
            if a <= t < b:
                투명 = 1.0 if a > T["사진첩"] else 빠르게멈춤((t - a) / 0.5)
                if b == 사진첩끝:
                    투명 *= min(1.0, (b - t) / 0.4)
                덮기(판, p, 사진상자[0] - p.shape[1] // 2, 사진상자[1] - p.shape[0] // 2, 투명)
        if T["사진첩"] <= t < 사진첩끝:
            y = round(H - (t - T["사진첩"]) * 롤속도)
            덮기(판, 롤, 롤x, y)

    def 엄마판(t):
        판 = np.zeros((H, W, 3), np.float32)
        투명, _ = 나타남(t, T["특별출연"], 끝 + 1, 0.6, 0.1)
        덮기(판, 엄마사진, 사진상자[0] - 엄마사진.shape[1] // 2, 사진상자[1] - 엄마사진.shape[0] // 2, 투명)
        투명2, dy = 나타남(t, T["특별출연"] + 0.5, 끝 + 1, 0.4, 0.1)
        덮기(판, 특별, 롤x, dy, 투명2)
        return 판

    # 빠지기: 상영관 그림을 키운 큰 판에 엔딩 화면을 제 해상도로 얹고, 보는 창을 스크린 속 16:9 자리에서 그림 전체로 넓힌다
    def 빠지기판(t, 화면):
        sh = sy1 - sy0
        cw = sh * 16 / 9
        cx0 = (sx0 + sx1) / 2 - cw / 2
        k = W / cw  # 큰 판 배율
        큰 = cv2.resize(어둠, (round(어둠.shape[1] * k), round(어둠.shape[0] * k)), interpolation=cv2.INTER_CUBIC).astype(np.float32)
        x0, y0, x1, y1 = [round(v * k) for v in (sx0, sy0, sx1, sy1)]
        큰[y0:y1, x0:x1] = 0  # 스크린 면 전체를 화면 속 검정과 같은 0으로 칠한다(원래 그림의 화면이 비치지 않게 — 11-18 첫 판에서 왼쪽에 밝은 띠, 둘째 판에서 옅은 띠가 남았다)
        ox, oy = round(cx0 * k), round(sy0 * k)
        큰[oy:oy + H, ox:ox + W] = 화면[: 큰.shape[0] - oy, : 큰.shape[1] - ox]
        u = 부드럽게((t - T["빠지기"]) / (T["빠지기끝"] - T["빠지기"]))
        # 창: 처음 (ox, oy, W, H) → 끝 그림 전체
        fw, fh = 큰.shape[1], 큰.shape[1] * 9 / 16
        fy = (큰.shape[0] - fh) / 2
        vx, vy = ox + (0 - ox) * u, oy + (fy - oy) * u
        vw = W + (fw - W) * u
        vh = vw * 9 / 16
        M = np.float32([[W / vw, 0, -vx * W / vw], [0, H / vh, -vy * H / vh]])
        return cv2.warpAffine(큰, M, (W, H), flags=cv2.INTER_AREA if vw > W * 1.2 else cv2.INTER_LINEAR)

    def 밀기(im, t, a, b, 배율, 중심):
        u = (t - a) / (b - a)
        z = 1 + 배율 * u
        h, w = im.shape[:2]
        cx, cy = 중심[0] * w, 중심[1] * h
        M = np.float32([[z * W / w, 0, (cx - cx * z) * W / w], [0, z * H / h, (cy - cy * z) * H / h]])
        return cv2.warpAffine(im.astype(np.float32), M, (W, H), flags=cv2.INTER_LINEAR)

    밖 = os.path.join(일터, "뒤.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", 밖],
                         stdin=subprocess.PIPE)
    n = round((끝 - 시작) * FPS)
    for i in range(n):
        t = 시작 + i / FPS
        판 = np.zeros((H, W, 3), np.float32)
        if t < T["주연"]:
            a, dy = 나타남(t, T["제목"], T["주연"] - 0.05, 0.4, 0.5)
            덮기(판, 글["제목"], 0, dy, a)
        elif t < T["사진첩"]:
            a, dy = 나타남(t, T["주연"] + 0.1, T["사진첩"] - 0.05, 0.4, 0.4)
            덮기(판, 글["주연"], 0, dy, a)
        elif t < 사진첩끝:
            사진판(t, 판)
        elif t < T["마지막"]:
            a, dy = 나타남(t, 사진첩끝 + 0.2, T["마지막"] - 0.05, 0.5, 0.5)
            덮기(판, 글["쓰인말"], 0, dy, a)
        elif t < T["특별출연"]:
            a, dy = 나타남(t, T["마지막"] + 0.2, T["특별출연"] - 0.05, 0.4, 0.4)
            덮기(판, 글["마지막"], 0, dy, a)
        elif t < T["빠지기"]:
            판 = 엄마판(t)
        elif t < T["불"]:
            판 = 빠지기판(min(t, T["빠지기끝"]), 엄마판(t))
        elif t < T["정적"]:
            판 = 밀기(불, t, T["불"], T["정적"], 0.02, (0.5, 0.78))
            판 *= min(1.0, max(0.0, (T["정적"] - t) / 0.6))
        elif t < T["쿠키"]:
            pass
        elif t < T["쿠키끝"]:
            켜짐 = min(1.0, max(0.0, (t - T["쿠키켜짐"]) / 0.12))
            원 = 쿠키꺼짐 * (1 - 켜짐) + 쿠키.astype(np.float32) * 켜짐
            판 = 밀기(원, t, T["쿠키"], T["쿠키끝"], 0.03, (0.56, 0.62))
        p.stdin.write(np.clip(판, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    p.wait()
    return 밖


def 소리읽기(p):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.float32).reshape(-1, 2).copy()


def 놓기(줄, 소리, 초, 이득=1.0, 들어옴=0.0, 나감=0.0):
    i = round(초 * SR)
    s = 소리 * 이득
    if 들어옴:
        k = min(len(s), round(들어옴 * SR))
        s[:k] *= np.linspace(0, 1, k)[:, None]
    if 나감:
        k = min(len(s), round(나감 * SR))
        s[-k:] *= np.linspace(1, 0, k)[:, None]
    j = min(len(줄), i + len(s))
    줄[i:j] += s[: j - i]


def 크기(s):
    return float(np.sqrt(np.mean(s ** 2)) + 1e-9)


def 소리(설정, 영화소리, 영화초, 일터):
    T = 설정["때"]
    줄 = np.zeros((round(T["끝"] * SR), 2), np.float32)
    a = 소리읽기(영화소리)
    k = round(1.2 * SR)
    a[-k:] *= np.linspace(1, 0, k)[:, None]
    놓기(줄, a, 0)
    # 곡: 목소리가 나오는 동안 0.3초에 걸쳐 -11dB로 낮춘다
    곡 = 소리읽기(설정["곡"])
    곡시작 = 설정["곡시작"]
    env = np.ones(len(곡), np.float32)
    for 이름, 초 in 설정["목소리"]:
        목 = 소리읽기(이름)
        놓기(줄, 목, 초, 10 ** (-17 / 20) / 크기(목))
        a0, a1 = round((초 - 0.3 - 곡시작) * SR), round((초 + len(목) / SR + 0.2 - 곡시작) * SR)
        r = round(0.3 * SR)
        낮음 = 10 ** (-11 / 20)
        env[a0:a1] = np.minimum(env[a0:a1], 낮음)
        env[a0 - r:a0] = np.minimum(env[a0 - r:a0], np.linspace(1, 낮음, r))
        env[a1:a1 + r] = np.minimum(env[a1:a1 + r], np.linspace(낮음, 1, r))
    놓기(줄, 곡 * env[:, None], 곡시작)
    for 이름, 초, 데시벨, 들, 나, 길이 in 설정["바탕소리"]:
        s = 소리읽기(이름)
        if 길이:
            s = s[: round(길이 * SR)]
        놓기(줄, s, 초, 10 ** (데시벨 / 20) / 크기(s), 들, 나)
    날 = os.path.join(일터, "날소리.wav")
    (np.clip(줄, -1, 1) * 32767).astype(np.int16).tofile(날 + ".raw")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", 날 + ".raw",
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR), 날], check=True)
    os.remove(날 + ".raw")
    return 날


def main():
    밖, 설정 = sys.argv[1], json.load(open(sys.argv[2], encoding="utf-8"))
    일터 = os.path.join(os.path.dirname(os.path.abspath(밖)), "_일터")
    os.makedirs(일터, exist_ok=True)
    v1, a1, 영화초 = 영화(설정, 일터)
    v2 = 뒤판(설정, 영화초, 일터)
    목록 = os.path.join(일터, "목록.txt")
    open(목록, "w", encoding="utf-8").write(f"file '{v1}'\nfile '{v2}'\n")
    붙음 = os.path.join(일터, "붙음.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", 목록, "-c", "copy", 붙음], check=True)
    a = 소리(설정, a1, 영화초, 일터)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", 붙음, "-i", a, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", 밖], check=True)
    print("끝", 밖)


if __name__ == "__main__":
    main()
