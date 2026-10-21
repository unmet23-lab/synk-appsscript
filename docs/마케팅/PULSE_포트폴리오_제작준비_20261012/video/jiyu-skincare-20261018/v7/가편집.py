# 지유 광고 v7 · 15초 가편집(2026-10-21, 힉스필드 크레딧 없이). 샷표(00_브리프_샷표.md)의 9컷을 정지컷으로 놓고
# 컷마다 움직임 하나(밀기 · 미끄러지기 · 호 · 돌기 · 초점 옮기기)와 장면 안 효과(빛 띠 · 파문 · 기포)를 후반에서 입힌 뒤
# 모션그래픽 층(모션/렌더.js, 투명 PNG)을 얹고 소리(음악 · 내레이션 한 줄 · 효과음)를 붙인다.
#   python 가편집.py [--판 가편집_v1] [--컷 3]   (--컷: 그 컷만 미리 보기 판으로)
#   → Documents/synk-vendor/jiyu-skincare-20261018/v7/가편집/<판>.mp4 · <판>_시트.jpg
import glob
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
STILLS = os.path.join(V, "v7", "콘티", "판")
OUT = os.path.join(V, "v7", "가편집")
W, H, FPS, DUR = 1080, 1920, 24, 15.0
MUSIC = os.path.join(V, "음악", "지유_음악_15초_A1.wav")
NAR = os.path.join(V, "내레이션")
SFX = os.path.join(V, "효과음")

# 컷: (이름, 시작초, 끝초, 움직임, 효과들) — 움직임 값은 컷 안에서 0→1로 가는 비율에 따라 바뀐다
#   push: (처음 배율, 끝 배율, 가운데 x, 가운데 y)   slide: (배율, 처음 x 비율, 끝 x 비율)   arc: (배율 처음, 끝, 돌기 도)
#   rotate: (배율, 처음 도, 끝 도)
CUTS = [
    # P1: 뚜껑 윗선이 세로 16%라 가운데를 42%로 잡아 화면을 내린다(위 300px에 MALGEUM 자리)
    # 빛 띠는 gain 0.9 · 폭 0.22에서 서리 몸통이 통째로 하얗게 떠 「포토샵 빛 쓸기」로 읽혀(Fable 10-21) 0.35 · 0.10으로 줄였다
    ("P1_공개", 0.0, 1.5, ("pushshift", 1.0, 1.03, 0.5, 0.42), [("band", {"dir": "down", "t0": 0.0, "t1": 1.3, "gain": 0.35, "width": 0.10})]),
    ("K2_정면", 1.5, 3.0, ("push", 1.0, 1.02, 0.5, 0.38), [("light", {"from": 0.92, "to": 1.03})]),
    # P3(10-21 16시 다시 구움): 왕관이 선 고속 사진을 1.5초 움직이면 왕관이 얼어 보여(Fable P1), 왕관이 꺼진 뒤 고리만 남은 순간으로
    # 바꿨다 — 무늬 전체를 가운데에서 바깥으로 펼치고(가운데도 조금), 그 위로 굴절 고리 하나가 지나가게 한다
    # 펼침 0.10은 바닥 무늬까지 다른 컷(2~3%)의 다섯 배로 밀려 「느린 줌」으로 읽혀(Fable 다시 확인) 0.055로
    ("P3_방울", 3.0, 4.5, ("push", 1.02, 1.02, 0.5, 0.5), [("spread", {"cx": 0.5, "cy": 0.5, "rate": 0.055, "core": 0.35}),
                                                     ("ripple", {"cx": 0.5, "cy": 0.5, "t0": 0.0, "speed": 0.22, "amp": 2.5, "wave": 0.05})]),
    # P4(16시 다시 구움): 병은 오른쪽 3분의 1, 물높이선 아래가 굴절로 어긋난다 — 왼쪽은 글자 자리. 기포는 병 옆 물속에서만, 다섯 개를 흐리게
    ("P4_물높이", 4.5, 6.5, ("slide", 1.08, 0.46, 0.54), [("bubbles", {"x0": 0.52, "x1": 0.89, "y_top": 0.61, "y_bot": 0.83, "n": 5})]),
    ("K5_옆얼굴숨", 6.5, 8.0, ("push", 1.03, 1.0, 0.5, 0.4), [("band", {"dir": "right", "t0": 0.1, "t1": 1.4, "gain": 0.45, "width": 0.3})]),
    # 초점 옮기기는 반경 14 · 0.55초에서 화면 전체가 걷히는 「블러 인」으로 읽혀(Fable) 6 · 0.3초로
    ("P6_라벨접사", 8.0, 9.5, ("push", 1.0, 1.015, 0.5, 0.5), [("focus", {"t0": 0.0, "t1": 0.3, "blur": 6}),
                                                         ("band", {"dir": "right", "t0": 0.35, "t1": 1.45, "gain": 0.55, "width": 0.18})]),
    # K7: 호의 가운데를 0.42H로 잡아 화면을 내리면 위 154px가 거울 반사(거꾸로 늘어진 머리카락)로 메워져(Fable) 제자리(0.5H)에서 돈다.
    # -0.6°를 덮으려면 1.02배가 필요하다
    ("K7_미소", 9.5, 11.0, ("arc", 1.05, 1.02, -0.6, 0.5), []),
    # P8: 10° 돌기는 1.29배가 있어야 모서리가 안 드러나 4°(1.13배)로 줄였다. 파문은 뚜껑(유리 테까지) 밖에서만 — 금속 테가 출렁이지 않게
    ("P8_위에서", 11.0, 12.0, ("rotate", 1.13, 0.0, 4.0), [("ripple", {"cx": 0.505, "cy": 0.477, "t0": 0.0, "speed": 0.18, "amp": 4.0,
                                                                   "wave": 0.04, "hole": 0.145})]),
    # P9: 위에 AI 표시 알약(281) · 로크업(440~)을 두고도 뚜껑과 띄우려 화면을 8% 내린다(위로 드러나는 가장자리는 벽)
    ("P9_팩샷", 12.0, 15.0, ("pushshift", 1.02, 1.02, 0.5, 0.42), []),
]
DISSOLVE = {4.5 + 2.0: 4}   # 6.5초(제품 → 사람) 한 번만 녹이기(벤치마킹 2-4). 8프레임은 얼굴이 병 속에 비치는 순간이 보여 4프레임


def imread_u(path, flags=cv2.IMREAD_COLOR):
    """한글 경로도 읽는다(cv2.imread는 윈도에서 유니코드 경로를 못 읽는다)."""
    data = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(data, flags) if data.size else None


def latest(name):
    fs = sorted(glob.glob(os.path.join(STILLS, f"{name}_*.png")))
    if not fs:
        raise SystemExit(f"정지컷이 없다: {name}")
    return fs[-1]


def cover(img):
    """9:16 1080×1920을 꽉 채우게 키워 가운데를 자른다(정지컷 비율이 조금 달라도)."""
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    big = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_LANCZOS4)
    y0, x0 = (big.shape[0] - H) // 2, (big.shape[1] - W) // 2
    return big[y0:y0 + H, x0:x0 + W].astype(np.float32)


def ease(p):
    p = min(1.0, max(0.0, p))
    return p * p * (3 - 2 * p)   # 부드럽게 출발 · 멈춤


def move(img, mv, p):
    """컷 움직임: 배율 · 자리 · 돌기를 한 아핀으로.
    push: 한 점(가운데 x, y)을 향해 다가간다 — 그 점은 화면에서 제자리라 배율 1 이상이면 화면 밖이 드러나지 않는다.
    pushshift: 그 점을 화면 가운데로 옮기며 다가간다(P1처럼 화면을 내려 위에 글자 자리를 낼 때만 — 드러나는 가장자리가 어두운 그림)."""
    kind = mv[0]
    e = ease(p)
    if kind in ("push", "pushshift"):
        s = mv[1] + (mv[2] - mv[1]) * e
        cx, cy, ang = mv[3] * W, mv[4] * H, 0.0
    elif kind == "slide":
        s = mv[1]
        cx, cy, ang = (mv[2] + (mv[3] - mv[2]) * e) * W, 0.5 * H, 0.0
    elif kind == "arc":   # (배율 처음, 끝, 돌기 도[, 가운데 y — 없으면 0.42])
        s = mv[1] + (mv[2] - mv[1]) * e
        cx, cy, ang = 0.5 * W, (mv[4] if len(mv) > 4 else 0.42) * H, mv[3] * e
    else:  # rotate
        s = mv[1]
        cx, cy, ang = 0.5 * W, 0.5 * H, mv[2] + (mv[3] - mv[2]) * e
    M = cv2.getRotationMatrix2D((cx, cy), ang, s)
    if kind != "push":   # push만 그 점을 제자리에 두고, 나머지는 그 점을 화면 가운데로
        M[0, 2] += W / 2 - cx
        M[1, 2] += H / 2 - cy
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


def fx_band(img, o, tc):
    """빛 띠: 부드러운 띠가 지나가는 자리를 곱으로 밝힌다(밝은 유리 테 · 하이라이트가 더 밝아져 빛이 훑는 것처럼)."""
    p = (tc - o["t0"]) / (o["t1"] - o["t0"])
    if p < -0.2 or p > 1.2:
        return img
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    if o["dir"] == "down":
        pos, coord = (-0.15 + 1.3 * p) * H, yy - xx * 0.25   # 살짝 비스듬히
    else:
        pos, coord = (-0.15 + 1.3 * p) * W, xx + yy * 0.15
    band = np.exp(-((coord - pos) / (o["width"] * (H if o["dir"] == "down" else W))) ** 2)
    return img * (1 + o["gain"] * band[..., None])


def fx_light(img, o, tc, dur):
    """창빛 밝기가 조금 오른다(구름이 걷히듯)."""
    return img * (o["from"] + (o["to"] - o["from"]) * ease(tc / dur))


def fx_ripple(img, o, tc):
    """퍼지는 동심원: 반지름 방향으로 화소를 밀어 굴절처럼 휘게 하고, 마루를 조금 밝힌다."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = o["cx"] * W, o["cy"] * H
    dx, dy = xx - cx, yy - cy
    r = np.sqrt(dx * dx + dy * dy) + 1e-3
    t = max(0.0, tc - o["t0"])
    front = o["speed"] * H * t                       # 맨 바깥 고리
    lam = o["wave"] * H
    env = np.clip(1 - (r - front) / (0.12 * H), 0, 1) * np.clip(front / (0.05 * H + 1e-3), 0, 1) * np.exp(-r / (0.6 * H))
    if o.get("hole"):   # 물 위에 뜬 단단한 것(뚜껑)은 굴절로 휘지 않는다 — 그 반지름 안은 0, 테 바깥 0.02H에 걸쳐 살린다
        env = env * np.clip((r - o["hole"] * H) / (0.02 * H), 0, 1)
    wave = np.sin(2 * np.pi * (r - front) / lam) * env
    off = o["amp"] * wave
    mx, my = xx + off * dx / r, yy + off * dy / r
    out = cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return out * (1 + 0.08 * np.clip(wave, 0, 1))[..., None]


def fx_spread(img, o, tc):
    """이미 그려진 동심원을 중심에서 바깥으로 천천히 펼친다. 바깥 고리일수록 빨리 벌어지고(고리 사이가 넓어지는 실제 파문),
    core(0~1)만큼은 가운데도 같이 움직인다 — 0이면 가운데가 서 있다(왕관이 있던 옛 P3)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = o["cx"] * W, o["cy"] * H
    dx, dy = xx - cx, yy - cy
    r = np.sqrt(dx * dx + dy * dy) + 1e-3
    k = 1 + o["rate"] * tc * np.clip(r / (0.25 * H), o.get("core", 0.0), 1)
    return cv2.remap(img, (cx + dx / k).astype(np.float32), (cy + dy / k).astype(np.float32), cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_REFLECT)


def fx_bubbles(img, o, tc, cut_seed=7):
    """유리 옆을 따라 오르는 작은 기포: 밝은 테두리 + 속은 거의 투명한 작은 원.
    또렷한 흰 고리는 가까이 보면 그린 동그라미로 읽혀(Fable 10-21) 기포 층만 따로 그려 흐린 뒤 옅게 얹는다."""
    rng = np.random.default_rng(cut_seed)
    layer = np.zeros(img.shape[:2], np.float32)
    for i in range(o["n"]):
        x = (o["x0"] + (o["x1"] - o["x0"]) * rng.random()) * W
        r = 3 + 5 * rng.random()
        speed = (0.10 + 0.12 * rng.random()) * H
        y = o["y_bot"] * H - ((tc * speed + rng.random() * H * 0.3) % ((o["y_bot"] - o["y_top"]) * H))
        x += 3 * np.sin(tc * 6 + i)
        cv2.circle(layer, (int(x), int(y)), int(r), 1.0, 1, lineType=cv2.LINE_AA)
        cv2.circle(layer, (int(x - r * 0.35), int(y - r * 0.35)), max(1, int(r * 0.25)), 1.0, -1, lineType=cv2.LINE_AA)
    a = cv2.GaussianBlur(layer, (0, 0), 1.2)[..., None] * 0.45
    return img * (1 - a) + 255.0 * a


def fx_focus(img, o, tc):
    """초점 옮기기: 흐림 → 또렷(가우시안 반경이 줄어든다)."""
    p = (tc - o["t0"]) / (o["t1"] - o["t0"])
    if p >= 1:
        return img
    rad = o["blur"] * (1 - ease(p))
    k = int(rad * 3) * 2 + 1
    return cv2.GaussianBlur(img, (k, k), rad) if rad > 0.3 else img


def frame_of(cut, still, i_in, n):
    name, t0, t1, mv, fxs = cut
    tc = i_in / FPS
    img = move(still, mv, i_in / max(1, n - 1))
    for kind, o in fxs:
        if kind == "band":
            img = fx_band(img, o, tc)
        elif kind == "light":
            img = fx_light(img, o, tc, t1 - t0)
        elif kind == "ripple":
            img = fx_ripple(img, o, tc)
        elif kind == "spread":
            img = fx_spread(img, o, tc)
        elif kind == "bubbles":
            img = fx_bubbles(img, o, tc)
        elif kind == "focus":
            img = fx_focus(img, o, tc)
    return np.clip(img, 0, 255)


def frames_iter(only=None, mg_dir=None):
    """프레임을 하나씩 낸다(15초 360장을 한꺼번에 들고 있으면 9GB) — (번호, 컷 이름, 컷 안 번호, 컷 길이, uint8 RGB)."""
    k = 0
    last, dissolve = None, {round(t * FPS): n for t, n in DISSOLVE.items()} if only is None else {}
    for cut in CUTS:
        if only is not None and cut[0] != only:
            continue
        still = cover(cv2.cvtColor(imread_u(latest(cut[0])), cv2.COLOR_BGR2RGB))
        n = round((cut[2] - cut[1]) * FPS)
        prev_last = last
        for i in range(n):
            f = frame_of(cut, still, i, n)
            for f0, m in dissolve.items():   # 6.5초 한 번 녹이기: 앞 컷 마지막 장을 다음 컷 첫 m장에 겹친다
                if prev_last is not None and f0 <= k < f0 + m:
                    a = (k - f0 + 1) / (m + 1)
                    f = prev_last * (1 - a) + f * a
            if i == n - 1:
                last = f.copy()
            if mg_dir:
                p = os.path.join(mg_dir, f"{k:04d}.png")
                mg = imread_u(p, cv2.IMREAD_UNCHANGED) if os.path.exists(p) else None
                if mg is not None and mg.shape[2] == 4:
                    a = mg[..., 3:4].astype(np.float32) / 255
                    f = f * (1 - a) + cv2.cvtColor(mg[..., :3], cv2.COLOR_BGR2RGB).astype(np.float32) * a
            yield k, cut[0], i, n, np.clip(f, 0, 255).astype(np.uint8)
            k += 1


def mix_audio(path):
    """음악 + 내레이션 한 줄 + 끝 「맑음.」 + 효과음 → -14 LUFS(본편_편집.py와 같은 두 번 맞춤).
    항목: (파일, 시작 초, 크기[, {"ss": 파일 안 시작 초, "dur": 길이, "fade": 앞뒤 흐리기 초, "hp": 이 Hz 아래 걷기}])"""
    items = [(MUSIC, 0.0, 0.35), (os.path.join(NAR, "2_피부가먼저.wav"), 6.6, 1.0), (os.path.join(NAR, "3a_말금.wav"), 12.6, 1.0),
             (os.path.join(SFX, "mmaudio", "새소리_앞.wav"), 0.0, 0.25),
             # 물방울은 그림의 충돌(컷 3 앞)에 맞춰 컷 경계보다 조금 먼저(3.2초는 늦었다 — Fable 10-21)
             (os.path.join(SFX, "똑_물방울.wav"), 2.95, 0.5),
             # 들숨은 내레이션(6.6)과 같이 시작해 서로 가렸다 → 0.4초 먼저 들이쉬고 말한다
             (os.path.join(SFX, "mmaudio", "컷5_숨_s1.wav"), 6.2, 2.0),
             # 음악 원본이 9.49~10.0초 비어 컷 7(미소) 첫 0.5초가 완전 무음이었다(Fable P1) — 아침 새소리를 작게 깔아 메운다.
             # 2.0초 자리는 저음 바닥 위 지저귐이 약해 폰에선 여전히 빈 자리였다(Fable 다시 확인) → 지저귐이 또렷한 3.8초 자리, 500Hz 아래는 걷는다
             (os.path.join(SFX, "mmaudio", "새소리_s1.wav"), 9.2, 0.1, {"ss": 3.8, "dur": 1.6, "fade": 0.35, "hp": 500}),
             (os.path.join(SFX, "톡_병.wav"), 12.0, 0.35),
             (os.path.join(SFX, "mmaudio", "새소리_끝.wav"), 12.0, 0.3)]
    args, filt, labels = [], [], []
    for k, (f, t, g, *more) in enumerate(items):
        args += ["-i", f]
        ms = int(t * 1000)
        cut = ""
        if more:
            o = more[0]
            d, fd = o["dur"], o.get("fade", 0.0)
            cut = (f"atrim=start={o.get('ss', 0.0)}:duration={d},asetpts=PTS-STARTPTS,"
                   f"afade=t=in:d={fd},afade=t=out:st={d - fd:.3f}:d={fd},")
            if o.get("hp"):
                cut += f"highpass=f={o['hp']},"
        filt.append(f"[{k}:a]aresample=48000,{cut}volume={g},adelay={ms}|{ms}[a{k}]")
        labels.append(f"[a{k}]")
    filt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={DUR},atrim=0:{DUR}[mix]")
    raw = path + ".raw.wav"
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *args, "-filter_complex", ";".join(filt), "-map", "[mix]",
                    "-ar", "48000", "-ac", "2", raw], check=True)
    gain = 0.0
    for _ in range(2):
        r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", raw if gain == 0.0 else path, "-af", "ebur128", "-f", "null", "-"],
                           capture_output=True)
        txt = r.stderr.decode("utf-8", "ignore")
        lufs = float(txt.rsplit("I:", 1)[1].split("LUFS")[0]) if "I:" in txt else -14.0
        gain += -14.0 - lufs
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.79:level=false",
                        "-ar", "48000", path], check=True)
    os.remove(raw)


def main():
    args = sys.argv[1:]
    tag = args[args.index("--판") + 1] if "--판" in args else "가편집_v1"
    only = args[args.index("--컷") + 1] if "--컷" in args else None
    os.makedirs(OUT, exist_ok=True)
    mg = os.path.join(OUT, "_모션프레임")
    tmp = tempfile.mkdtemp()
    video = os.path.join(tmp, "v.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-crf", "14",
                            "-preset", "slow", video], stdin=subprocess.PIPE)
    picks, count = [], 0
    for k, name, i, n, f in frames_iter(only, mg if (only is None and os.path.isdir(mg)) else None):
        enc.stdin.write(f.tobytes())
        if i == n // 2:
            picks.append(cv2.resize(f, (270, 480), interpolation=cv2.INTER_AREA))
        count += 1
    enc.stdin.close()
    enc.wait()
    out = os.path.join(OUT, f"{tag}{'_' + only if only else ''}.mp4")
    if only:
        os.replace(video, out)
    else:
        audio = os.path.join(tmp, "a.wav")
        mix_audio(audio)
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", video, "-i", audio, "-vf", "noise=c0s=3:c0f=t",
                        "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
                        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                        "-c:a", "aac", "-b:a", "192k", "-t", str(DUR), "-movflags", "+faststart", out], check=True)
    # 시트: 컷마다 가운데 장 하나
    sheet = np.concatenate(picks, axis=1)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))   # 한글 경로는 imwrite가 못 쓴다
    buf.tofile(os.path.join(OUT, f"{tag}{'_' + only if only else ''}_시트.jpg"))
    print(out, f"{count}프레임")


if __name__ == "__main__":
    main()
