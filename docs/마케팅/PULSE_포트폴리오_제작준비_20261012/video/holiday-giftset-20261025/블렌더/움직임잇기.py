# 시즌 2 · 홀리데이 기프트 세트 — 15초 · 6초 움직임 굽기와 잇기 (2026-10-26)
#   python 움직임잇기.py 굽기 [15 6] [세로 가로] [--res-scale 0.5] [--samples N] [--일꾼 2]
#       → 선물상자.py --film을 묶음(30장)마다 블렌더로 띄워 빠진 프레임만 굽는다(끊겨도 다시 부르면 이어 감)
#   python 움직임잇기.py 잇기 [15 6] [세로 가로] [--원천 <프레임 폴더 뿌리>] [--이름 <꼬리>]
#       → 제목 이름(고정) · 끝의 어두워짐과 이름 교차 디졸브 · 끝 화면 · 소리 자리 합성음을 얹어 mp4
#   python 움직임잇기.py 보드 [15 6] [세로 가로] [--간격 0.5] [--원천 …] [--이름 …]
#       → 완성 mp4에서 간격마다 뽑아 덩이 이름 · 초를 붙인 한 장(검수 · 보여 드리기용)
# 컷 · 초 · 카메라 · 소리 자리는 움직임표.py 한 곳에 있다. 글자(이름)는 렌더에 그리지 않고 여기서 포장 원고와 같은
# Noto Serif KR로 얹는다(제품 · 로고 · 글자는 AI로 그리지 않는다). 렌더 · 영상은 git 밖 <밖>/움직임/.
import math
import os
import random
import struct
import subprocess
import sys
import time
import wave

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import 움직임표 as M  # noqa: E402

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
SCENE = os.path.join(HERE, "선물상자.py")
밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset")
움직임 = os.path.join(밖, "움직임")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
SIZE = {"세로": (1080, 1920), "가로": (1920, 1080)}
SR = 48000


def opt(args, name, default):
    return args[args.index(name) + 1] if name in args else default


def picks(args):
    films = [a for a in args if a in ("15", "6")] or ["15", "6"]
    orients = [a for a in args if a in ("세로", "가로")] or ["세로", "가로"]
    return films, orients


# ── 굽기 ────────────────────────────────────────────────────────────────────
def todo_frames(film, d):
    still = M.STILL_FROM[film]
    out = []
    for f in range(M.LEN[film]):
        if M.cut_at(film, f)[3] == "black" or (still is not None and f > still):
            continue
        if not os.path.exists(os.path.join(d, f"{f:04d}.png")):
            out.append(f)
    return out


def bake(args):
    films, orients = picks(args)
    scale = float(opt(args, "--res-scale", "1"))
    workers = int(opt(args, "--일꾼", "2"))
    extra = ["--samples", opt(args, "--samples", "")] if "--samples" in args else []
    root = opt(args, "--원천", 움직임)
    os.makedirs(root, exist_ok=True)
    log = open(os.path.join(root, "_굽기기록.log"), "a", encoding="utf-8")
    jobs = []
    for film in films:
        for o in orients:
            w, h = SIZE[o]
            res = f"{int(w * scale)}x{int(h * scale)}"
            d = os.path.join(root, f"{film}초_{o}")
            os.makedirs(d, exist_ok=True)
            fr = todo_frames(film, d)
            for i in range(0, len(fr), 30):
                chunk = fr[i:i + 30]
                jobs.append((film, o, res, d, ",".join(map(str, chunk)), len(chunk)))
    print(f"묶음 {len(jobs)}개 · 프레임 {sum(j[5] for j in jobs)}장")
    running = []
    t_all = time.time()
    while jobs or running:
        while jobs and len(running) < workers:
            film, o, res, d, frames, n = jobs.pop(0)
            cmd = [BLENDER, "-b", "--python", SCENE, "--", "--film", film, "--res", res, "--out", d, "--frames", frames] + extra
            # 출력은 파일로 받는다 — 파이프로 받고 끝날 때만 읽으면 버퍼(64 KB)가 차서 블렌더가 18장째에서 멈췄다(10-26)
            logf = os.path.join(d, f"_블렌더_{frames.split(',')[0]}.log")
            p = subprocess.Popen(cmd, stdout=open(logf, "w", encoding="utf-8", errors="ignore"), stderr=subprocess.STDOUT)
            running.append((p, film, o, frames, n, time.time(), logf))
        time.sleep(2)
        for item in list(running):
            p, film, o, frames, n, t0, logf = item
            if p.poll() is None:
                continue
            outp = open(logf, encoding="utf-8", errors="ignore").read()
            done = outp.count("Saved:")
            line = (f"{time.strftime('%H:%M:%S')} {film}초 {o} {frames.split(',')[0]}~{frames.split(',')[-1]} "
                    f"{done}/{n}장 {time.time() - t0:.0f}초 코드 {p.returncode}")
            if p.returncode or done < n:
                line += " · " + " | ".join(x for x in outp.splitlines() if "Error" in x or "Traceback" in x)[:400]
            print(line, flush=True)
            log.write(line + "\n")
            log.flush()
            running.remove(item)
    print(f"굽기 끝 {time.time() - t_all:.0f}초")


# ── 이름(후반 글자) ─────────────────────────────────────────────────────────────
def font(size, weight):
    from PIL import ImageFont
    f = ImageFont.truetype(SERIF, size)
    for name in (weight, weight.encode()):
        try:
            f.set_variation_by_name(name)
            break
        except Exception:
            continue
    return f


def spaced(d, cx, y, text, f, fill, spacing):
    widths = [d.textlength(ch, font=f) for ch in text]
    x = cx - (sum(widths) + spacing * (len(text) - 1)) / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill, anchor="lm")
        x += w + spacing


def name_card(size, kind):
    """이름 한 덩이(RGBA): title = 「유리결」 + YURIGYEOL(뚜껑 앞 옆띠와 같은 짜임, 남색 포장지 위라 상아색) ·
    end = 「유리결」 + 서리꽃 홀리데이 에디션(검은 끝 화면 위라 상아색)."""
    from PIL import Image, ImageDraw, ImageFilter
    W, H = size
    u = min(W, H)                      # 세로 1080 · 가로 1080 기준으로 같은 크기
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = W / 2, H / 2
    if kind == "title":
        # 카메라 2판: 제목 포장지가 남색 밤 종이 · 금박 서리꽃이 되어 원본처럼 밝은 글자(상아)로, 금박 위에서도 읽히게 옅은 어두운 테
        ink = (243, 236, 222, 255)
        d.text((cx, cy - u * 0.020), "유리결", font=font(int(u * 0.115), "SemiBold"), fill=ink, anchor="mm")
        spaced(d, cx, cy + u * 0.075, "YURIGYEOL", font(int(u * 0.026), "Regular"), ink, u * 0.016)
        glow = im.split()[3].filter(ImageFilter.GaussianBlur(u * 0.014))
        halo = Image.new("RGBA", (W, H), (6, 10, 24, 0))
        halo.putalpha(glow.point(lambda a: int(a * 0.6)))
        return Image.alpha_composite(halo, im)
    ink = (243, 236, 222, 255)
    d.text((cx, cy - u * 0.022), "유리결", font=font(int(u * 0.100), "Medium"), fill=ink, anchor="mm")
    spaced(d, cx, cy + u * 0.070, "서리꽃 홀리데이 에디션", font(int(u * 0.030), "Regular"), (214, 190, 140, 255), u * 0.006)
    return im


def cam_project(c, orient, W, H, pts):
    """움직임표 카메라 값으로 세계 점들을 화면 픽셀로 — 선물상자.py cam_pose(to_track_quat −Z · Y 뒤 로컬 Z 둘레 roll) ·
    cam_tan과 같은 셈(세로는 세로 화각, 가로는 가로 화각이 18/lens)."""
    import numpy as np
    az, el, roll = (math.radians(c[k]) for k in ("az", "el", "roll"))
    tgt = np.array(c["tgt"], dtype=float)
    loc = tgt + c["d"] * np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])
    fwd = (tgt - loc) / np.linalg.norm(tgt - loc)
    up0 = np.array([0.0, 0.0, 1.0]) - fwd * fwd[2]
    up0 /= np.linalg.norm(up0)
    right0 = np.cross(fwd, up0)
    right = right0 * math.cos(roll) + up0 * math.sin(roll)
    up = -right0 * math.sin(roll) + up0 * math.cos(roll)
    half = 18.0 / c["lens"]
    tx, ty = (half * W / H, half) if orient == "v" else (half, half * H / W)
    out = []
    for p in pts:
        v = np.asarray(p, dtype=float) - loc
        z = v @ fwd
        out.append((W / 2 * (1 + (v @ right) / z / tx), H / 2 * (1 - (v @ up) / z / ty)))
    return out


def persp_coeffs(dst, src):
    """화면 네 점(dst) → 원고 네 점(src)으로 가는 PIL PERSPECTIVE 계수."""
    import numpy as np
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


_MASK = {}


def lid_name_mask():
    """뚜껑 윗면 이름 원고(../라벨/포장.py lid_top_foil의 이름만, 뚜껑 윗면 2048²) — 셋째 줄(영문 에디션)은 끝 화면에서 8 px라 뺀다."""
    if "m" not in _MASK:
        from PIL import Image, ImageFilter
        m = Image.open(os.path.join(밖, "라벨", "뚜껑윗면_이름.png")).convert("L")
        cut = int(m.height * M.NAME_UV[1]) + 136
        m.paste(0, (0, cut, m.width, m.height))
        _MASK["m"] = m.filter(ImageFilter.GaussianBlur(1.2))    # 4분의 1 넘게 줄어들 때 가는 획이 깨지지 않게
    return _MASK["m"]


def lid_corners(film, o, W, H, t):
    """뚜껑 윗면 원고 네 모서리(왼위 · 오위 · 오아래 · 왼아래)의 화면 자리 — 15초 닫힘 카메라(t는 닫힘 안으로 묶음)."""
    cut = next(c for c in M.CUTS["15"] if c[0] == "닫힘")
    tt = min(t, (cut[2] - 1) / M.FPS)
    c = M.cam_at("15", "v" if o == "세로" else "h", cut, tt)
    h, z = M.LID_HALF, M.TOP
    return cam_project(c, "v" if o == "세로" else "h", W, H, [(-h, h, z), (h, h, z), (h, -h, z), (-h, -h, z)])


END_SCALE = 1.5   # 끝 화면 이름 = 뚜껑 이름의 1.5배, 같은 가운데(원본은 1.9배 — 뚜껑 글자 위에 큰 끝 글자가 덮인다, Fable P2-1)


def name_layer(corners, W, H, shift=(0.0, 0.0), scale=END_SCALE):
    """뚜껑 이름을 화면 네 점에 맞춰 편 알파(0~1, float)와 이름 가운데 · 반폭(px). 이름 가운데를 두고 scale배로 키운다.
    두 배로 펴서 줄인다."""
    import numpy as np
    from PIL import Image
    m = lid_name_mask()
    s = 2
    if scale != 1.0:      # 원고 네 모서리 → 이름 가운데(NAME_UV)의 화면 자리를 쌍선형으로 잡고 그 둘레로 키운다
        u, v = M.NAME_UV
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = corners
        cx = (1 - v) * ((1 - u) * x0 + u * x1) + v * ((1 - u) * x3 + u * x2)
        cy = (1 - v) * ((1 - u) * y0 + u * y1) + v * ((1 - u) * y3 + u * y2)
        corners = [(cx + (x - cx) * scale, cy + (y - cy) * scale) for x, y in corners]
    dst = [((x + shift[0]) * s, (y + shift[1]) * s) for x, y in corners]
    src = [(0, 0), (m.width, 0), (m.width, m.height), (0, m.height)]
    big = m.transform((W * s, H * s), Image.PERSPECTIVE, persp_coeffs(dst, src), Image.BICUBIC)
    al = np.asarray(big.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
    ys, xs = np.nonzero(al > 0.2)
    return al, ((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2), (xs.max() - xs.min()) / 2, ys.max()


def edition_line(W, H, cx, y_top):
    """끝 화면 이름 아래 한 줄 「서리꽃 홀리데이 에디션」(RGBA float) — 뚜껑의 영문 셋째 줄은 끝 화면에서 8 px라 이 줄이 대신한다."""
    import numpy as np
    from PIL import Image, ImageDraw
    u = min(W, H)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    spaced(ImageDraw.Draw(im), cx, y_top + u * 0.030, "서리꽃 홀리데이 에디션", font(int(u * 0.024), "Regular"),
           (214, 190, 140, 255), u * 0.004)
    a = np.asarray(im, dtype=np.float32)
    return a[..., :3], a[..., 3:] / 255


def soft_disc_at(W, H, cx, cy, r):
    import numpy as np
    y, x = np.mgrid[0:H, 0:W]
    return np.clip(1 - np.hypot(x - cx, y - cy) / r, 0, 1) ** 1.5


def soft_disc(size, radius):
    """가운데 부드러운 원(L, 0~255): 반지름 = 짧은 변 × radius, 가장자리로 갈수록 0."""
    from PIL import Image
    import numpy as np
    W, H = size
    y, x = np.mgrid[0:H, 0:W]
    r = np.hypot(x - W / 2, y - H / 2) / (min(W, H) * radius)
    return Image.fromarray((np.clip(1 - r, 0, 1) ** 1.5 * 255).astype("uint8"), "L")


# ── 소리 자리(표시용 합성음) ─────────────────────────────────────────────────────
def db(x):
    return 10 ** (x / 20)


def synth(film):
    """움직임표 SOUND대로 자리 표시 합성음(음악 · 효과음은 새로 짓는다). 원본 두 판처럼 음악은 닫힘 머리에서 끊고,
    매듭 완성에 가장 큰 한 방(−6 dBFS) → 정적. 6초는 마지막 유리 한 방에서 음악이 끝난다."""
    import numpy as np
    from scipy.signal import butter, sosfilt
    n = int(M.LEN[film] / M.FPS * SR)
    music, fx = np.zeros((n, 2)), np.zeros((n, 2))
    rng = np.random.default_rng(7)

    def add(buf, t0, sig, gain_db, pan=0.0):
        i0 = int(t0 * SR)
        if i0 >= n:
            return
        sig = sig[: n - i0] * db(gain_db)
        buf[i0:i0 + len(sig), 0] += sig * (1 - max(0.0, pan))
        buf[i0:i0 + len(sig), 1] += sig * (1 + min(0.0, pan))

    def env(length, a, r):
        x = np.arange(int(length * SR)) / SR
        return np.clip(np.minimum(x / max(a, 1e-4), (length - x) / max(r, 1e-4)), 0, 1)

    def bandnoise(length, lo, hi):
        sos = butter(2, [lo, hi], btype="band", fs=SR, output="sos")
        return sosfilt(sos, rng.standard_normal(int(length * SR))) * 3.0

    def pluck(freq, length=0.18, decay=0.09):
        x = np.arange(int(length * SR)) / SR
        return (np.sin(2 * math.pi * freq * x) + 0.35 * np.sin(4 * math.pi * freq * x)) * np.exp(-x / decay)

    def ting(freq, length=1.6):
        x = np.arange(int(length * SR)) / SR
        parts = [(1.0, 1.0, 0.9), (2.76, 0.45, 0.5), (5.40, 0.25, 0.3), (8.93, 0.12, 0.2)]
        sig = sum(g * np.sin(2 * math.pi * freq * k * x) * np.exp(-x / dcy) for k, g, dcy in parts)
        return sig * np.minimum(1, x / 0.002)

    glass = iter((2093.0, 2349.3, 2637.0))
    music_end = None
    for kind, t0, t1 in M.SOUND[film]:
        L = max(t1 - t0, 0.01)
        if kind == "바람":
            add(fx, t0, bandnoise(L, 120, 900) * env(L, 0.5, 0.25), -24)
        elif kind == "저음":
            x = np.arange(int(L * SR)) / SR
            vib = 1 + 0.003 * np.sin(2 * math.pi * 5 * x)
            sig = sum(np.sin(2 * math.pi * f0 * k * x * vib) / k for f0 in (55.0, 82.41) for k in (1, 2, 3))
            add(music, t0, sig * env(L, 0.4, 0.05) * 0.3, -18)
        elif kind == "음악":
            # 빠른 현악 합주 자리: 16분음 뜯는 소리(140 BPM, Am–F–C–G), 원본처럼 처음이 8 dB 작다(−20 → −12 dB의 차)
            step = 60 / 140 / 4
            chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (261.63, 329.63, 392.0), (196.0, 246.94, 293.66)]
            k, t = 0, t0
            while t < t1 - 0.02:
                ch = chords[int((t - t0) / (step * 16)) % 4]
                g = -25 + 8 * min(1.0, max(0.0, (t - t0) / 2.5))
                add(music, t, pluck(ch[k % 3] * (2 if (k // 3) % 2 else 1)), g, pan=0.3 * math.sin(k))
                if k % 4 == 0:
                    add(music, t, pluck(ch[0] / 2, 0.3, 0.2), g - 2)
                k += 1
                t += step
            music_end = t1
        elif kind == "마찰":
            t = t0
            while t < t1:
                add(fx, t, bandnoise(0.03, 1500, 5500) * env(0.03, 0.004, 0.02), -30, pan=rng.uniform(-0.3, 0.3))
                t += 2 / M.FPS          # 스톱모션 한 자세마다
        elif kind == "휘익":
            x = np.arange(int(L * SR)) / SR
            add(fx, t0, bandnoise(L, 300, 3000) * np.sin(math.pi * x / L) ** 2, -27)
        elif kind in ("반짝", "금가루"):
            t = t0
            while t < t1:
                add(fx, t, ting(rng.uniform(2600, 6200), 0.25) * 0.5, -26 if kind == "반짝" else -28, pan=rng.uniform(-0.8, 0.8))
                t += rng.exponential(0.07)
            if kind == "금가루":
                add(fx, t0, bandnoise(L, 3000, 9000) * env(L, 0.4, 0.4), -30)
        elif kind == "유리":
            add(fx, t0, ting(next(glass)), -16)
        elif kind == "매듭":
            x = np.arange(int(1.2 * SR)) / SR
            thud = np.sin(2 * math.pi * 62 * x) * np.exp(-x / 0.18)
            snap = rng.standard_normal(len(x)) * np.exp(-x / 0.003)
            sig = thud * 0.9 + snap * 0.6 + ting(1318.5, 1.2) * 0.5
            add(fx, t0, sig / np.abs(sig).max(), -3)
    if film == "15":            # 닫힘 바닥 소리는 −30 dB 아래로 — 매듭 한 방과 20 dB 넘게 벌린다(Fable 움직임 1차 P3-1)
        i0, i1 = int(10.55 * SR), int(12.05 * SR)
        fx[i0:i1] *= db(-9)
    if film == "6":
        music_end = 4.20          # 마지막 유리 한 방에서 음악이 끝난다
    if music_end is not None:    # 닫힘 머리(6초는 유리 한 방)에서 끊는다 — 끝 20 ms만 잦아들게
        i1 = int(music_end * SR)
        fade = int(0.02 * SR)
        music[i1 - fade:i1] *= np.linspace(1, 0, fade)[:, None]
        music[i1:] = 0
    out = music + fx
    peak = np.abs(out).max()
    if peak > db(-1):
        out *= db(-1) / peak
    return out


# ── 소리(끝 보강 10-28): Suno 새 연주곡 + 녹음 모음 한 타씩(어택을 사건 프레임에) + 만든 매듭 한 방 + 공간 소리 ──────────
# 화면 사건이 블렌더 프레임으로 정확히 정해져 있어 녹음 모음 소리를 그 프레임에 한 타씩 놓는다(AI 광고영상 제작 규칙 「소리」 2순위 길).
# 세기는 소리마다 가장 큰 0.1초 RMS를 dBFS로 맞춘다 — 원본 17초 판 실측(음악 −13~−16, 매듭 한 방 −8, 그 뒤 공간 −41)이 기준.
LIB = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "sound-library")
SFX = {   # 녹음 모음(Sonniss GDC 2026 · Fairlight)에서 이름 조각으로 찾는다
    "종이": "Wrapping Paper, Opening Present 1", "천": "ClothMovement29", "천2": "ClothMovement24",
    "천3": "Cloth Canvas Bag Slide Light 02", "휘익": "Low Whoosh x2", "쏟아짐": "Cofetti Whoosh Pluck Spill",
    "방울": "Magic Christmas Bells 2", "결정": "Crystal Fragments Sharp Shards Dry 05", "유리": "Glass Clink Toast",
    "스냅": "Interface Accept Glassy Snap", "종": "Bell Clang Resonance High", "반짝": "Button Arp Twinkle",
    "바람": "WINDDsgn_Wind, Rush, Whoosh, Long x5",
}
_SRC = {}


def load_audio(path, t0=0.0, dur=None):
    """ffmpeg로 48 kHz 스테레오 float32(n, 2)."""
    import numpy as np
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.4f}"] + (["-t", f"{dur:.4f}"] if dur else []) + \
          ["-i", path, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def sfx(name):
    if name not in _SRC:
        for dp, _, fs in os.walk(LIB):
            hit = next((f for f in fs if SFX[name] in f), None)
            if hit:
                _SRC[name] = load_audio(os.path.join(dp, hit))
                break
        else:
            raise FileNotFoundError(SFX[name])
    return _SRC[name]


def win_rms(x, w=0.1):
    """가장 큰 w초 RMS(선형)와 그 창의 시작 표본."""
    import numpy as np
    p = (x.astype(np.float64) ** 2).mean(axis=1)
    k = max(1, int(w * SR))
    c = np.convolve(p, np.ones(k) / k, mode="valid")
    i = int(np.argmax(c))
    return float(np.sqrt(c[i])), i


def attack(x, rel_db=-24):
    """어택 표본: 10 ms 포락선이 그 소리 최대의 rel_db를 처음 넘는 곳."""
    import numpy as np
    p = np.abs(x).max(axis=1)
    env = np.sqrt(np.convolve(p ** 2, np.ones(480) / 480, mode="same"))
    return int(np.argmax(env > env.max() * 10 ** (rel_db / 20)))


def mix(film):
    """움직임표 SOUND · MUSIC대로 섞는다. 원본 두 판처럼 15초는 음악이 닫힘 머리(10.5)에서 끊기고 닫힘 바닥 소리는 −30 dB 아래,
    매듭 완성(12.07)이 가장 큰 한 방, 그 뒤는 디지털 무음 대신 작은 공간 소리가 끝까지 잦아든다(원본 −41 dBFS → 끝 −97).
    6초는 마지막 유리 한 방(4.15)에서 음악이 끝난다."""
    import numpy as np
    n = int(M.LEN[film] / M.FPS * SR)
    out = np.zeros((n, 2), np.float32)

    def place(t, sig, level, at="attack", pan=0.0, length=None, fade_out=None, fade_in=None):
        """sig의 어택(attack) · 처음(start) · 가장 큰 0.1초(peak)를 영상 t초에 놓고, 가장 큰 0.1초 RMS를 level dBFS로."""
        sig = sig[: int(length * SR)].copy() if length else sig.copy()
        if fade_in:
            k = min(len(sig), int(fade_in * SR))
            sig[:k] *= np.linspace(0, 1, k)[:, None]
        if fade_out:
            k = min(len(sig), int(fade_out * SR))
            sig[len(sig) - k:] *= np.linspace(1, 0, k)[:, None]
        r, ipk = win_rms(sig)
        sig *= db(level) / max(r, 1e-9)
        ref = {"attack": attack(sig), "start": 0, "peak": ipk + int(0.05 * SR)}[at]
        i0 = int(round(t * SR)) - ref
        s0 = max(0, -i0)
        i0 = max(0, i0)
        seg = sig[s0: s0 + n - i0]
        if pan:
            seg = seg * np.array([1 - max(0.0, pan), 1 + min(0.0, pan)], np.float32)
        out[i0: i0 + len(seg)] += seg

    mu = M.MUSIC.get(film)
    if mu:
        L = mu["cut"] - mu["start"]
        x = load_audio(os.path.join(밖, "소리", "suno", mu["file"]), t0=mu["src_cut"] - L, dur=L)
        loud, _ = win_rms(x, 1.0)
        # 곡의 가장 큰 1초를 −16.5 dBFS로(원본 음악 −13~−16) — 매듭 한 방이 리미터 안에서 음악보다 4 dB 넘게 크게
        x *= db(-16.5) / loud
        k = int(mu["fade_in"] * SR)
        x[:k] *= np.linspace(0, 1, k)[:, None]
        k = int(0.02 * SR)                        # 닫힘 머리에서 끊는다 — 끝 20 ms만 잦아들게
        x[-k:] *= np.linspace(1, 0, k)[:, None]
        i0 = int(mu["start"] * SR)
        out[i0: i0 + len(x)] += x[: n - i0]
    rng = np.random.default_rng(7)
    glass = 0
    closing = 10.5 if film == "15" else None
    for kind, t0, t1 in M.SOUND[film]:
        L = max(t1 - t0, 0.01)
        quiet = -6 if closing is not None and t0 >= closing and kind not in ("매듭", "빛", "공간") else 0
        if kind == "바람":            # 포장지 스침(제목)
            # 원본 0–2초는 바람 · 포장지 스침이 −15~−18로 처음부터 크다(10-28 곡선 대조 — 첫 판 −30은 0.2초에 −45)
            # 포장지 스침은 띄엄띄엄이라(0.3초에 −41로 꺼졌다) 이어지는 바람 한 줄을 밑에 깐다
            w = sfx("바람")
            place(t0, w[attack(w):], -22, at="start", length=L, fade_in=0.04, fade_out=0.30)
            place(t0, sfx("종이")[int(2.0 * SR):], -24, at="start", length=L, fade_in=0.05, fade_out=0.25)
        elif kind == "마찰":          # 리본이 풀리고 · 쓰러지고 · 다시 묶이는 공단 마찰
            src = sfx("천3") if L < 0.5 else (sfx("천2") if t0 > 11 else sfx("천"))
            place(t0, src, -27 + quiet, length=L + 0.25, fade_out=0.2, pan=-0.15)
        elif kind == "휘익":          # 휘둘러 넘김 — 가장 큰 자리를 넘김 한가운데에
            if closing is not None and abs(t0 + t1 - 2 * closing) < 0.3:
                # 음악이 끊기는 닫힘 머리: 원본은 이 자리가 −6 dB 큰 한 방이다(10-28 곡선 대조) — 휘익을 키우고 낮은 쿵을 겹친다
                place((t0 + t1) / 2, sfx("휘익")[: int(0.62 * SR)], -11, at="peak", fade_out=0.08)
                x = np.arange(int(0.6 * SR)) / SR
                boom = (np.sin(2 * math.pi * 46 * x) * np.exp(-x / 0.12)).astype(np.float32)
                place(closing, np.stack([boom, boom], 1), -13, at="start")
            else:
                place((t0 + t1) / 2, sfx("휘익")[: int(0.62 * SR)], -19, at="peak", fade_out=0.08)
        elif kind == "반짝":          # 뚜껑이 열리며 금가루가 쏟아짐 · 닫힘에서 화면을 덮은 금가루가 돎
            if quiet:
                place(t0, sfx("방울")[int(13.0 * SR):], -31, at="start", length=L + 0.3, fade_in=0.1, fade_out=0.4)
            else:
                place(t0, sfx("쏟아짐"), -19, pan=0.2)
                place(t0 + 0.05, sfx("방울")[int(13.0 * SR):], -27, at="start", length=1.6, fade_in=0.05, fade_out=0.6)
        elif kind == "금가루":        # 금가루 구름 속을 빠르게 지남
            place(t0 + 0.25, sfx("결정"), -24, at="peak", fade_out=0.3, pan=0.25)
        elif kind == "유리":          # 단지 · 앰플이 멎음
            if film == "6" and glass == 1:
                # 6초 끝 한 방(Fable P2-4): −17 dB는 앞 유리 · 음악보다 작아 「음악이 멎음」이었다 — 유리 + 짧은 종 꼬리를 한 덩이로
                # 묶어 크레스트를 줄여 놓는다(유리 「팅」은 순간 최대가 커서 따로 키우면 마지막 리미터에 그대로 눌렸다)
                # 유리 「팅」은 몸통이 없어 0.1초 RMS를 키울 수 없다 — 단지가 바닥에 앉는 낮은 쿵(66 Hz)을 밑에 깐다
                x_ = np.arange(int(1.3 * SR)) / SR
                thud = (np.sin(2 * math.pi * 66 * x_) * np.exp(-x_ / 0.14)).astype(np.float32)
                hit = np.stack([thud, thud], 1) * db(-8)
                for nm, pk_db, ln in (("유리", -6, None), ("종", -14, 1.2)):
                    s_ = sfx(nm)[attack(sfx(nm)):]
                    s_ = s_[: int(ln * SR)].copy() if ln else s_.copy()
                    if ln:
                        k_ = int(0.8 * SR)
                        s_[-k_:] *= np.linspace(1, 0, k_)[:, None]
                    s_ *= db(pk_db) / np.abs(s_).max()
                    hit[: min(len(s_), len(hit))] += s_[: len(hit)]
                place(t0, limiter(hit, -6.0), -9, at="start", pan=0.12)
            else:
                place(t0, sfx("유리"), -15 - 2 * glass, pan=(0.12 if glass else -0.12))
            glass += 1
        elif kind == "매듭":          # 가장 큰 한 방: 낮은 쿵(만든 소리) + 유리빛 탁(녹음) + 짧은 종(녹음) — 한 덩이로 묶어 세기를 맞춘다
            # 따로 놓으면 탁의 순간 최대가 마지막 리미터를 눌러 한 방이 음악보다 작아졌다(−14 대 −11, 10-28 첫 섞기)
            m = int(1.6 * SR)
            x = np.arange(m) / SR
            thud = (np.sin(2 * math.pi * 58 * x) * np.exp(-x / 0.16)).astype(np.float32)
            hit = np.stack([thud, thud], 1) * db(-6)
            for nm, pk_db, ln, fo in (("스냅", -12, None, None), ("종", -16, 1.4, 1.0)):
                s = sfx(nm)[attack(sfx(nm)):]
                s = s[: int(ln * SR)].copy() if ln else s.copy()
                if fo:
                    k = int(fo * SR)
                    s[-k:] *= np.linspace(1, 0, k)[:, None]
                s *= db(pk_db) / np.abs(s).max()
                hit[: len(s)] += s[:m]
            hit = limiter(hit, -3.0)
            place(t0, hit, -6, at="start")      # 음악 큰 자리보다 4~5 dB 위(원본 매듭 −8 · 음악 −13)
        elif kind == "빛":            # 빛줄기가 금박 · 금 뚜껑 위를 지남 — 작은 반짝임 한 줄
            place(t0 + 0.05, sfx("반짝"), -28, fade_out=0.5, pan=0.3)
        elif kind == "공간":          # 디지털 무음 대신 작은 공간 소리 — 끝까지 잦아든다
            m = int((t1 - t0) * SR)
            from scipy.signal import butter, sosfilt
            air = sosfilt(butter(2, [60, 1800], btype="band", fs=SR, output="sos"), rng.standard_normal((m, 2)), axis=0)
            # 원본은 한 방 뒤 −38~−40이 평평하게 남다가 끝 화면 반쯤부터 잦아든다(10-28 곡선 대조 — 첫 판 −47은 곧장 가라앉았다)
            air = (air / np.sqrt((air ** 2).mean()) * db(-41)).astype(np.float32)
            env = np.ones(m, np.float32)
            env[: int(0.3 * SR)] = np.linspace(0, 1, int(0.3 * SR))
            f1 = M.FADE[film][1]
            tail = max(1, m - int((f1 + 0.35 * (t1 - f1) - t0) * SR))
            env[-tail:] *= np.linspace(1, 0, tail) ** 2          # 끝 화면 3분의 1 지나 잦아들어 마지막 프레임에 0
            i0 = int(t0 * SR)
            out[i0: i0 + m] += (air * env[:, None])[: n - i0]
    # 크기: 통합 −15 LUFS(플랫폼 기준 −14 근처 — 원본 17초 판은 −11.6)로 맞추고, 순간 최대만 미리 보는 리미터로 −1.5 dBFS 안에.
    # 끝에서 통째로 최대를 맞추면 매듭의 순간 최대 때문에 전체가 5 dB 내려가 −20.8 LUFS가 됐다(10-28 첫 섞기)
    out *= db(-15.0 - lufs_of(out))
    return limiter(out, -2.5)      # AAC가 −1.5 표본을 +0.3 dBTP로 넘겼다(Fable P3-5)


def lufs_of(x):
    """ffmpeg ebur128로 잰 통합 크기(LUFS)."""
    import re
    import tempfile
    p = os.path.join(tempfile.gettempdir(), f"_giftset_lufs_{os.getpid()}.wav")
    write_wav(p, x)
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True, errors="ignore").stderr
    os.remove(p)
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])


def limiter(x, ceiling_db=-1.5, look=0.005, release=0.08):
    """미리 보는(5 ms) 피크 리미터 — 넘는 순간만 이득을 내리고 80 ms에 걸쳐 놓아준다."""
    import numpy as np
    from scipy.ndimage import minimum_filter1d
    need = np.minimum(1.0, db(ceiling_db) / np.maximum(np.abs(x).max(axis=1), 1e-9))
    g = minimum_filter1d(need, size=2 * int(look * SR) + 1, mode="nearest")
    rel = math.exp(-1.0 / (release * SR))
    gain = np.empty_like(g)
    cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else v + (cur - v) * rel
        gain[i] = cur
    return (x * gain[:, None]).astype(np.float32)


def write_wav(path, data):
    import numpy as np
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ── 잇기 ────────────────────────────────────────────────────────────────────
def assemble(args):
    import numpy as np
    from PIL import Image, ImageFilter
    films, orients = picks(args)
    root = opt(args, "--원천", 움직임)
    tail = opt(args, "--이름", "")
    for film in films:
        wav = os.path.join(root, f"소리_{film}초.wav")      # 끝 보강(10-28): 자리 표시 합성음(synth) 대신 섞은 소리
        write_wav(wav, mix(film))
        for o in orients:
            d = os.path.join(root, f"{film}초_{o}")
            names = sorted(n for n in os.listdir(d) if n.endswith(".png"))
            if not names:
                print("프레임 없음", d)
                continue
            W, H = Image.open(os.path.join(d, names[0])).size
            title = name_card((W, H), "title")
            # 끝 보강(10-28 유호님 「뚜껑까지 바꿔」): 끝 화면 이름은 뚜껑 윗면 금박 이름 그 자리 · 크기로 겹쳐 든다(원본 1위처럼 상자가
            # 사라지고 이름만 남음). 닫힘 카메라가 이름에 멎어 끝 자리는 화면 가운데 — 6초는 같은 크기로 가운데에
            ink = np.array([243, 236, 222], dtype=np.float32)
            end_c = lid_corners(film, o, W, H, 99.0)
            end_al, end_cen, end_hw, end_bot = name_layer(end_c, W, H)
            if film == "6":
                end_al, end_cen, end_hw, end_bot = name_layer(end_c, W, H, (W / 2 - end_cen[0], H / 2 - end_cen[1]))
            ed_rgb, ed_a = edition_line(W, H, end_cen[0], end_bot)
            rng = np.random.default_rng(11)
            outp = os.path.join(root, f"기프트세트_{film}초_{o}{tail}.mp4")
            cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(M.FPS),
                   "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
                   "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outp]
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            still = M.STILL_FROM[film]
            f0, f1 = M.FADE[film]
            black = Image.new("RGB", (W, H), (0, 0, 0))
            last = None
            for f in range(M.LEN[film]):
                t = f / M.FPS
                scene = M.cut_at(film, f)[3]
                src = f if still is None or f <= still else still
                path = os.path.join(d, f"{src:04d}.png")
                if scene == "black":
                    im = black.copy()
                elif os.path.exists(path):
                    im = Image.open(path).convert("RGB")
                    if im.size != (W, H):
                        im = im.resize((W, H), Image.LANCZOS)
                    last = im
                else:
                    im = last.copy() if last else black.copy()   # 아직 안 구운 프레임은 앞 프레임으로(시험판)
                tt = M.TITLE[film]
                if tt and tt[0] <= t < tt[1]:
                    k = (t - (tt[1] - 4 / M.FPS)) / (4 / M.FPS)   # 하드 컷 앞 4프레임은 번진다(원본 1번 끝 0.15초)
                    if k > 0:
                        im = im.filter(ImageFilter.GaussianBlur(W * 0.012 * k))
                    im = Image.alpha_composite(im.convert("RGBA"), title).convert("RGB")
                if t >= f0:
                    # 어두워짐은 처음에 빠르게(ease-out), 이름이 드는 동안만 이름 뒤에 부드러운 검정 그늘 — 흰 상자 위에서
                    # 상아색 이름이 0.4초 안 읽혔다(Fable 움직임 1차 P2-4). 실수로 섞고 ±1 디더로 내린다 — 8비트로 섞으면
                    # 어두워질수록 단계가 줄어 보케 둘레에 등고선이 흘렀다(Fable 움직임 2차 P3-2)
                    x = min(1.0, (t - f0) / (f1 - f0))
                    a = min(1.0, max(0.0, (t - f0 - 0.15) / (f1 - f0 - 0.15)))
                    v = np.asarray(im, dtype=np.float32) * (1 - (1 - (1 - x) ** 2))
                    if film == "15" and t < f1:      # 디졸브 동안은 그 프레임 카메라로 뚜껑 이름 위에 정확히
                        al_n, cen, hw, _ = name_layer(lid_corners(film, o, W, H, t), W, H)
                    else:
                        al_n, cen, hw = end_al, end_cen, end_hw
                    if a > 0 and x < 1:
                        v *= 1 - soft_disc_at(W, H, cen[0], cen[1], hw * 2.4)[..., None] * (0.5 * a)
                    if a > 0:
                        al = (al_n * a)[..., None]
                        v = v * (1 - al) + ink * al
                    b = min(1.0, max(0.0, (t - f1 + 0.25) / 0.35))   # 에디션 한 줄은 이름이 다 든 뒤에
                    if b > 0:
                        al = ed_a * b
                        v = v * (1 - al) + ed_rgb * al
                    v += rng.random(v.shape, dtype=np.float32) - rng.random(v.shape, dtype=np.float32)
                    im = Image.fromarray(np.clip(np.rint(v), 0, 255).astype(np.uint8), "RGB")
                p.stdin.write(im.tobytes())
            p.stdin.close()
            p.wait()
            print("잇기", outp, "코드", p.returncode)


def board(args):
    """완성 mp4에서 간격마다 한 장씩 뽑아 덩이 이름 · 초를 붙여 늘어놓는다."""
    from PIL import Image, ImageDraw, ImageFont
    films, orients = picks(args)
    root = opt(args, "--원천", 움직임)
    tail = opt(args, "--이름", "")
    step = float(opt(args, "--간격", "0.5"))
    lab = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 22)
    head = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 34)
    for film in films:
        for o in orients:
            mp4 = os.path.join(root, f"기프트세트_{film}초_{o}{tail}.mp4")
            if not os.path.exists(mp4):
                continue
            w = 216 if o == "세로" else 384
            h = 384 if o == "세로" else 216
            times = [round(i * step, 3) for i in range(int(M.LEN[film] / M.FPS / step))]
            cols = 10 if o == "세로" else 6
            rows = (len(times) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * w, 60 + rows * (h + 30)), (16, 17, 22))
            d = ImageDraw.Draw(sheet)
            d.text((12, 12), f"기프트 세트 {film}초 {o} — {os.path.basename(mp4)}", font=head, fill=(236, 214, 170))
            for i, t in enumerate(times):
                f = min(int(round(t * M.FPS)), M.LEN[film] - 1)
                raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", f"select=eq(n\\,{f}),scale={w}:{h}",
                                      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
                x, y = (i % cols) * w, 60 + (i // cols) * (h + 30)
                if len(raw) == w * h * 3:
                    sheet.paste(Image.frombytes("RGB", (w, h), raw), (x, y + 30))
                d.text((x + 6, y + 4), f"{t:.2f}초 · {M.cut_at(film, f)[0]}", font=lab, fill=(255, 230, 150))
            out = os.path.join(root, f"보드_{film}초_{o}{tail}.jpg")
            sheet.save(out, quality=88)
            print("보드", out)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] not in ("굽기", "잇기", "보드"):
        print("python 움직임잇기.py 굽기|잇기|보드 …")
        sys.exit(1)
    {"굽기": bake, "잇기": assemble, "보드": board}[a[0]](a[1:])
