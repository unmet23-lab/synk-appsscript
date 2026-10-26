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
        wav = os.path.join(root, f"소리자리_{film}초.wav")
        write_wav(wav, synth(film))
        for o in orients:
            d = os.path.join(root, f"{film}초_{o}")
            names = sorted(n for n in os.listdir(d) if n.endswith(".png"))
            if not names:
                print("프레임 없음", d)
                continue
            W, H = Image.open(os.path.join(d, names[0])).size
            title = name_card((W, H), "title")
            end = name_card((W, H), "end")
            scrim_f = (np.asarray(soft_disc((W, H), 0.35), dtype=np.float32) / 255)[..., None]
            end_np = np.asarray(end, dtype=np.float32)
            end_rgb, end_a = end_np[..., :3], end_np[..., 3:] / 255
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
                    if a > 0 and x < 1:
                        v *= 1 - scrim_f * (0.5 * a)
                    if a > 0:
                        al = end_a * a
                        v = v * (1 - al) + end_rgb * al
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
