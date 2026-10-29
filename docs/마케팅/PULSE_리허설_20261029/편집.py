"""리허설(10-29) 1차 납품본 편집 — 오미톡 15초 9:16(1080×1920 · 24fps).

컷 경계는 음악 박(100 BPM): 2.4 · 4.8 · 7.8 · 10.8, 마지막 타 13.2. 영상은 카메라를 고정으로 뽑았고(Omni는 작은 카메라 이동을
크게 키운다 — 현장노트), 다가감 · 흔들림 · 위로 올림은 여기서 화면 창을 프레임마다 옮겨 만든다(cv2.warpAffine, 화소 아래 정밀도).
색 · 얼굴 · 밝기는 손대지 않는다(장부 공통 원칙 3). 컷 2는 캔 몸통(라벨)을 장면 그림의 렌더 화소로 다시 얹는다 — 카메라 · 캔이 멈춘 컷.
  python -X utf8 편집.py [--판 v1] [--자막없이]   → 작업 폴더 편집/오미톡_15초_<판>[_자막없음].mp4
"""
import argparse
import json
import math
import os
import subprocess

import cv2
import numpy as np
from PIL import Image

W, H, FPS = 1080, 1920, 24
FAST = False  # --720 : 키운 판이 있어도 720p 원본으로(검수용 가편집)
UP_MIX = 0.5  # 키운 판 몫(나머지는 720p Lanczos)
작업 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029")
받음 = os.path.join(작업, "영상", "받음")
글자 = os.path.join(작업, "글자")
SR = 48000

# 컷: 원본 · 쓰는 구간 시작(초) · 길이 · 화면 창 움직임(시작 → 끝: 확대 배율, 가운데 x · y 비율, 기울기°)
CUTS = [  # v2(Fable 완성본 v1 검수 반영): 컷 1 · 2는 다시 뽑은 판, 컷 4는 「우」 입을 빼려 0.9초부터, 엔드카드는 캔을 콘티 자리(29~56%)에 다시 얹은 판
    {"id": 1, "src": "R1d", "t0": 0.70, "up_t0": 0.70,  # R1c 둘째 판(입이 0.6~2.6초 자연스럽게 다묾) — 첫 판은 입술을 눌러 삐친 얼굴
     "dur": 2.4, "z": (1.02, 1.08), "c": ((0.5, 0.40), (0.5, 0.36)), "rot": (0, 0), "shake": 1.0},
    # 컷 2: 아래 낱말표 · 한글 줄을 통째로 화면 밖으로(Fable v1 P2-4 · v2 P2-1) — 1.10배부터, 엠블럼까지만 보인다(이름은 컷 5 로고가 맡음)
    {"id": 2, "src": "R2d", "t0": 0.0,  # R2c 둘째 판(거품이 0.17~0.5초에 한 번 톡, 0.6초에 가라앉음) — 첫 판은 액체가 분수처럼 솟음
     "dur": 2.4, "z": (1.10, 1.13), "c": ((0.5, 0.44), (0.5, 0.43)), "rot": (0, 0), "shake": 0, "relabel": True, "up_t0": 0.0},
    {"id": 3, "src": "R3b", "t0": 0.30, "up_t0": 0.30, "dur": 3.0, "z": (1.07, 1.11), "c": ((0.5, 0.42), (0.5, 0.42)), "rot": (0, -2.0), "shake": 0},
    # 컷 4: 다가감 기준을 아래로 — 화면 아래 끝의 캔 윗부분이 끝까지 남게(Fable P2-3)
    {"id": 4, "src": "R4b", "t0": 1.00, "up_t0": 0.90,  # 「우」 꼬리 0.2초도 빼려 1.0부터(Fable v2 P3-2) — 키운 판(0.9부터 72장) 안에서 0.1초 밀고 끝 2장은 붙든다
     "dur": 3.0, "z": (1.0, 1.04), "c": ((0.5, 0.5), (0.5, 0.53)), "rot": (0, 0), "shake": 0},
    # 엔드카드: 깨끗한 벤치 판 + 블렌더 팩샷(캔 29~56%) — 위로 올림은 13.2 마지막 타에서 멈추고 15.0까지 그대로(Fable P3-4)
    {"id": 5, "still": os.path.join(작업, "합성", "S5_v2.png"), "dur": 4.2, "z": (1.03, 1.05), "c": ((0.5, 0.52), (0.5, 0.48)), "rot": (0, 0), "shake": 0, "move": 2.4},
]
# 글자 층: 파일 · 들어옴 · 나감(초) · 나타남 길이
LAYERS = [
    ("자막_1", 0.40, 2.05, 0.15),
    ("자막_2", 8.40, 10.15, 0.15),
    ("끝_말", 11.40, 15.0, 0.25),
    ("끝_출시", 12.00, 15.0, 0.30),
    ("끝_로고", 13.20, 15.0, 0.12),
]


def ease(u):
    return u * u * (3 - 2 * u)


def frames(path, t0, n):
    """원본 mp4에서 t0부터 n장을 1080×1920 RGB로(업스케일 판이 아니면 Lanczos로 맞춤)."""
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", path, "-frames:v", str(n), "-vf",
           f"fps={FPS},scale={W}:{H}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    arr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    if len(arr) < n:  # 모자라면 끝 장을 늘인다(쓰는 구간이 원본 안에 있게 t0 · dur을 정해 두므로 기록만)
        print(f"  ⚠ {os.path.basename(path)} {len(arr)}/{n}장")
        arr = np.concatenate([arr, np.repeat(arr[-1:], n - len(arr), 0)])
    return arr


def camera(img, k, n, cut, rng):
    u = ease(min(1.0, k / (cut["move"] * FPS))) if cut.get("move") else ease(k / max(n - 1, 1))
    z = cut["z"][0] + (cut["z"][1] - cut["z"][0]) * u
    cx = cut["c"][0][0] + (cut["c"][1][0] - cut["c"][0][0]) * u
    cy = cut["c"][0][1] + (cut["c"][1][1] - cut["c"][0][1]) * u
    rot = cut["rot"][0] + (cut["rot"][1] - cut["rot"][0]) * u
    # 창이 그림 밖으로 나가면 가장자리가 거울처럼 비친다(10-29 시험판 컷 4 머리 띠) — 배율이 허락하는 만큼만 가운데를 옮긴다
    room = (1 - 1 / z) / 2 - 0.004 - (0.006 if cut["shake"] else 0) - abs(math.radians(rot)) * 0.6
    room = max(room, 0.0)
    cx = 0.5 + max(-room, min(room, cx - 0.5))
    cy = 0.5 + max(-room, min(room, cy - 0.5))
    sx = sy = 0.0
    if cut["shake"]:
        t = k / FPS
        sx = cut["shake"] * (2.2 * math.sin(2 * math.pi * 0.9 * t + 0.4) + 1.1 * math.sin(2 * math.pi * 2.3 * t + 1.7))
        sy = cut["shake"] * (1.6 * math.sin(2 * math.pi * 0.7 * t + 2.1) + 0.9 * math.sin(2 * math.pi * 1.9 * t))
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((cx * w, cy * h), rot, z)
    M[0, 2] += W / 2 - cx * w + sx
    M[1, 2] += H / 2 - cy * h + sy
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)


def relabel_mask():
    """컷 2 다시 얹기 판: 장면 그림(합성)과 원래 그림이 다른 자리(= 렌더 캔) 가운데 뚜껑 테 아래 몸통만, 가장자리 6px 흐림."""
    comp = np.asarray(Image.open(os.path.join(작업, "영상", "시작", "r_S2c.jpg")).convert("RGB")).astype(np.float32)  # v2: 라벨 색을 손님 사진 쪽으로(합성 --밝기하한 0.85 --색그대로)
    orig = Image.open(os.path.join(작업, "장면그림", "S2_g1.png")).convert("RGB")
    ow, oh = orig.size
    th = round(ow * 16 / 9)
    y0 = (oh - th) // 2
    orig = np.asarray(orig.crop((0, y0, ow, y0 + th)).resize((W, H), Image.LANCZOS)).astype(np.float32)
    d = np.abs(comp - orig).mean(2) > 14
    d = cv2.morphologyEx(d.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(d)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    can = (lab == big)
    can = cv2.morphologyEx(can.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8)).astype(bool)
    cut_y = json.load(open(os.path.join(작업, "편집", "컷2_테.json"), encoding="utf-8"))["y"]  # 뚜껑 테 아래 끝(화면 y) — 거품은 그 위
    can[:cut_y] = False
    m = cv2.erode(can.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    return comp, cv2.GaussianBlur(m, (0, 0), 3.0)[..., None]


def layers():
    out = []
    for name, a, b, f in LAYERS:
        im = np.asarray(Image.open(os.path.join(글자, name + ".png")).convert("RGBA")).astype(np.float32) / 255.0
        out.append((im, a, b, f))
    return out


def video(path_out, with_text):
    rng = np.random.default_rng(29)
    lay = layers() if with_text else []
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
                            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", path_out], stdin=subprocess.PIPE)
    t_abs = 0
    sec = 0.0
    for cut in CUTS:
        n = round((sec + cut["dur"]) * FPS) - round(sec * FPS)  # 박 자리(0.6초 = 14.4장)는 장 경계가 아니라 누적으로 반올림
        sec += cut["dur"]
        if "still" in cut:
            st = Image.open(cut["still"]).convert("RGB")
            sw, sh = st.size
            th = round(sw * 16 / 9)
            y0 = (sh - th) // 2
            st = np.asarray(st.crop((0, y0, sw, y0 + th)).resize((W, H), Image.LANCZOS))
            src = np.repeat(st[None], n, 0)
        else:
            up = os.path.join(받음, cut["src"] + "_up.mp4")  # 영상_키우기.py가 그 컷 구간만 1080×1920으로 키운 판(t0부터 잘라 둠)
            base = frames(os.path.join(받음, cut["src"] + "_a.mp4"), cut["t0"], n)
            if os.path.exists(up) and not FAST:
                # 키운 판은 모공 · 수염 그늘 · 눈 밑 주름을 지어내 한결(22세 · 면도)이 나이 들어 보였다(컷 4 닮음 0.58 → 0.52) —
                # 720p를 Lanczos로 늘린 판과 반씩 섞는다(0.57로 돌아옴, 컷 넷 모두 같은 비율이라 결이 컷마다 튀지 않음)
                upf = frames(up, cut["t0"] - cut.get("up_t0", cut["t0"]), n)
                src = ((upf.astype(np.float32) * UP_MIX + base.astype(np.float32) * (1 - UP_MIX)) + 0.5).astype(np.uint8)
            else:
                src = base
            print(f"  컷 {cut['id']} 원본 {'키운 판' if os.path.exists(up) and not FAST else '720p'}")
        if cut.get("relabel"):
            comp, m = relabel_mask()
        for k in range(n):
            f = src[k].astype(np.float32)
            if cut.get("relabel"):
                f = f * (1 - m) + comp * m
            f = camera(np.clip(f, 0, 255).astype(np.uint8), k, n, cut, rng).astype(np.float32) / 255.0
            t = (t_abs + k) / FPS
            for im, a, b, fd in lay:
                if a <= t < b:
                    al = min(1.0, (t - a) / fd) * min(1.0, (b - t) / 0.15 if b < 15.0 else 1.0)
                    A = im[..., 3:4] * al
                    f = f * (1 - A) + im[..., :3] * A
            enc.stdin.write((np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
        t_abs += n
        print(f"컷 {cut['id']} {n}장")
    enc.stdin.close()
    enc.wait()


def wav(path, t0=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", path] + (["-t", f"{dur:.3f}"] if dur else []) + \
          ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()


def db(x):
    return 10 ** (x / 20)


def audio(path_out, plan):
    """plan: 소리_계획.json — 음악 · 말 · 효과음을 초 · dB로 놓고, 말 아래 음악을 4 dB 내린다. 끝에서 −14 LUFS · −2 dBTP(AAC로 담으면 봉우리가 1 dB쯤 오른다 — v0 시험판 −1.0 → 0.0)."""
    N = int(15.0 * SR)
    mix = np.zeros((N, 2), np.float32)
    duck = np.ones(N, np.float32)
    for it in plan["말"]:
        a = int(it["at"] * SR)
        x = wav(it["src"], it["t0"], it["dur"]) * db(it.get("db", 0))
        e = min(N, a + len(x))
        mix[a:e] += x[: e - a]
        lo, hi = max(0, a - int(0.05 * SR)), min(N, e + int(0.20 * SR))  # v1은 0.12초 앞서 내려 말 앞에 구멍(Fable P3-3)
        duck[lo:hi] = np.minimum(duck[lo:hi], db(plan.get("더킹", -4)))
    duck = np.convolve(duck, np.ones(int(0.08 * SR)) / int(0.08 * SR), mode="same").astype(np.float32)
    m = wav(plan["음악"]["src"])[:N] * db(plan["음악"]["db"])
    mix[: len(m)] += m * duck[: len(m), None]
    for it in plan["효과음"]:
        a = int(it["at"] * SR)
        x = wav(it["src"], it["t0"], it.get("dur")) * db(it.get("db", 0))
        if it.get("fade"):
            fl = int(it["fade"] * SR)
            x[-fl:] *= np.linspace(1, 0, fl)[:, None]
            x[:min(fl, len(x)) // 4] *= np.linspace(0, 1, min(fl, len(x)) // 4)[:, None]
        e = min(N, a + len(x))
        mix[a:e] += x[: e - a]
    # 끝 울림(Fable P1-2): 13.2 마지막 타 둘레 음악 0.6초를 지수로 줄어드는 잔향(1.8초)에 통과시켜 15.0까지 남긴다 — 마지막 0.9초가 무음이던 것
    if plan.get("끝_울림"):
        r = plan["끝_울림"]
        a0 = int(r["at"] * SR)
        seg = m[a0: a0 + int(r["len"] * SR)].copy()  # v3: 재료는 음악이 아직 울리는 12.6~13.2(v2의 13.15~13.75는 이미 −37 dBFS라 되울릴 것이 없었다)
        L = int(r["tail"] * SR)
        rng = np.random.default_rng(1029)
        t = np.arange(L) / SR
        ir = rng.standard_normal((L, 2)).astype(np.float32) * np.exp(-r.get("decay", 6.9) * t / r["tail"])[:, None]
        ir = np.stack([np.convolve(ir[:, c], np.ones(12) / 12, mode="same") for c in range(2)], 1)  # 고역을 조금 눅임
        wet = np.stack([np.convolve(seg[:, c], ir[:, c])[: len(seg) + L] for c in range(2)], 1)
        wet *= db(r["db"]) / max(1e-6, float(np.abs(wet).max()))
        e = min(N, a0 + len(wet))
        fade = np.ones(e - a0, np.float32)
        fl = int(0.6 * SR)
        fade[-fl:] = np.linspace(1, 0, fl)
        mix[a0:e] += wet[: e - a0] * fade[:, None]
    tmp = path_out + ".raw.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", tmp], input=mix.tobytes(), check=True)
    # 두 번 재는 loudnorm(첫 번에 잰 값으로 둘째에 선형 맞춤)
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", tmp, "-af", "loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    j = json.loads(r[r.rindex("{"): r.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-2.0:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.75:attack=1:release=60:level=disabled,aresample={SR}")  # AAC로 담으면 봉우리가 1 dB쯤 올라(v2 시험 −0.3) 미리 −2.5 dBFS로 누른다
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", af, path_out], check=True)
    os.remove(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--판", default="v1")
    ap.add_argument("--자막없이", action="store_true")
    ap.add_argument("--소리만", action="store_true")
    ap.add_argument("--720", dest="fast", action="store_true")
    a = ap.parse_args()
    global FAST
    FAST = a.fast
    out = os.path.join(작업, "편집")
    os.makedirs(out, exist_ok=True)
    plan = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "소리_계획.json"), encoding="utf-8"))
    for k in ("음악",):
        plan[k]["src"] = os.path.join(작업, plan[k]["src"])
    for k in ("말", "효과음"):
        for it in plan[k]:
            it["src"] = it["src"] if os.path.isabs(it["src"]) else os.path.join(작업, it["src"])
    snd = os.path.join(out, f"소리_{a.판}.wav")
    audio(snd, plan)
    if a.소리만:
        return
    tag = "_자막없음" if a.자막없이 else ""
    vid = os.path.join(out, f"_영상_{a.판}{tag}.mp4")
    video(vid, not a.자막없이)
    final = os.path.join(out, f"오미톡_15초_{a.판}{tag}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", snd, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "256k", "-shortest", "-movflags", "+faststart", "-metadata", "title=omitok 15s", final], check=True)
    os.remove(vid)
    print(final)


if __name__ == "__main__":
    main()
