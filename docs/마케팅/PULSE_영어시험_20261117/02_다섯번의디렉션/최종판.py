# 둘째 편 「다섯 번의 디렉션」 최종 판 만들기(2026-11-20, Claude) — 거친판.py를 바탕으로 한다
#   유호님 11-20 「둘 다 굽기」로 구운 720p 여섯 판을 잇는다. 거친 판과 다른 점: 판을 1080×1920으로 키워 자막 · 끝 화면 글자를 그 크기에서 얹는다.
#   화면: 여섯 판(git 밖 synk-vendor/pulse-en-ep2-20261117/받음_720p/C1~C6.mp4)을 컷표의 in · out대로 잘라 잇는다(1080×1920 · 초당 24장).
#   소리: 시댄스가 판마다 낸 소리를 그대로 쓴다. 슬레이트 딱도 판 소리다(실제 녹음 효과음을 겹치는 일은 최종 판에서 한다). 음량은 −14 LUFS로 맞춘다.
#   말자막: 자리는 아래 CAPS 표에 손으로 적었다. 11-18 받아 온 판을 faster-whisper large-v3-turbo(VAD 켬)로 받아쓰고 0.1초 소리 세기와 맞춰 본 값이다.
#           medium은 C1을 「I'm going to go to the bathroom」으로 지어내서 쓰지 않는다. --받아쓰기를 주면 판마다 다시 받아써 찍기만 한다.
#           첫 편 자막 결(명조 500 · #EFE7DA · 마침표와 쉼표 없음 · 0.25초에 8px 올라옴)을 세로 화면 머리 위 벽 자리에 둔다.
#   끝 화면: C6 2.3초부터 위쪽을 어둡게 깔고, 2.6초부터 로고 → 고지 → 주소를 0.3초 간격으로 0.4초 동안 12px 올린다(첫 편 P10en.tsx 꼴, 시안/끝로고_A.jpg 자리).
#   python -X utf8 최종판.py [--받아쓰기]
#     → git 밖 synk-vendor/pulse-en-ep2-20261117/최종/다섯번의디렉션_1080.mp4 · 다섯번의디렉션_1080_반초.jpg · _받아쓰기_720p.json
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", ".."))
V = os.path.normpath(os.path.join(REPO, "..", "synk-vendor", "pulse-en-ep2-20261117"))
SRC = os.path.join(V, "받음_720p")
OUT = os.path.join(V, "최종")
LOGO = os.path.join(REPO, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-PULSE-Paper.png")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
W, H, FPS = 1080, 1920, 24
K = W / 720   # 거친 판(720 폭)에서 정한 글자 크기 · 자리를 키우는 배수
WARM = (0xEF, 0xE7, 0xDA)

# 판마다 말자막 — (판 안 시작 초, 끝 초, 보일 글). 화면 밖 감독의 That's a wrap도 소리를 끄고 보는 사람을 위해 단다.
#   C1은 대사가 4.0~4.5초로 컷표(2.5초)보다 늦게 나왔고, C4는 「I'm fi—」가 1.6~2.1초, 재채기가 4.3~4.6초, 「I'm fine」이 5.0~5.7초다.
#   C4 앞 대사는 받아쓰기가 「I'm fine」으로 적지만 2.0초에서 소리가 끊겨 지시문대로 「I'm fi—」로 둔다(귀로는 확인 안 함).
CAPS = {
    "C1": [(3.85, 5.05, "I’m fine")],
    "C2": [(1.80, 3.20, "I’m fine!")],
    "C3": [(4.00, 5.15, "I’m fine")],
    "C4": [(1.25, 2.50, "I’m fi—"), (4.95, 5.95, "I’m fine")],
    "C5": [(1.55, 2.75, "I’m—"), (2.85, 4.00, "Myself? …Who’s that?"), (4.10, 5.00, "That’s a wrap")],
    "C6": [],
}
# 판마다 쓰는 구간(in, out) — 컷표의 in · out과 같게 둔다(11-18 받은 판에 맞춰 고침)
CAP_Y = 150   # 말자막 가운데 높이 — 가슴 높이(905)는 크림 니트 위라 안 읽히고(11-18 정지 그림 시험), 228은 앞머리 위에 얹혀 싸 보였다(11-18 볼 이유 심사)
CARD = {"어둠": 2.8, "로고": 3.1, "고지": 3.4, "주소": 3.7}   # C6 슬레이트가 2.6~3.3초에 빠져서(11-18 받은 판) 컷표의 2.6초보다 0.5초 늦춘다


def run(*a):
    subprocess.run(a, check=True)


def cuts():
    d = json.load(open(os.path.join(HERE, "컷표.json"), encoding="utf-8"))
    return [(c["cut"], float(c["in"]), float(c["out"]), c) for c in d["detail"]]


def font(size, weight=500):
    f = ImageFont.truetype(SERIF, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def transcribe(table):
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    out = {}
    for cut, a, b, _ in table:
        wav = os.path.join(OUT, "_소리", f"{cut}.wav")
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(SRC, f"{cut}.mp4"), "-ac", "1", "-ar", "16000", wav)
        segs, _ = m.transcribe(wav, language="en", word_timestamps=True, vad_filter=True, vad_parameters={"min_silence_duration_ms": 200})
        words = [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s in segs for w in (s.words or [])]
        out[cut] = words
        print(cut, " ".join(f"{w}@{s:.2f}" for s, e, w in words), flush=True)
    return out


def place(table):
    """판마다 말자막의 (편 초 시작, 끝, 글) — CAPS 표를 판의 in · out에 맞춰 편 시각으로 옮긴다"""
    caps, t0 = [], 0.0
    for cut, a, b, _ in table:
        for x, y, text in CAPS[cut]:
            if a <= x < b:
                caps.append((t0 + x - a, t0 + min(y, b) - a, text))
        t0 += b - a
    return caps


def text_patch(text, size, shadow=True, weight=500):
    f = font(size, weight)
    l, t, r, b = f.getbbox(text)
    pad = round(24 * W / 720)
    w, h = r - l + 2 * pad, b - t + 2 * pad
    txt = Image.new("L", (w, h), 0)
    ImageDraw.Draw(txt).text((pad - l, pad - t), text, font=f, fill=255)
    rgba = np.zeros((h, w, 4), np.float32)
    if shadow:
        far = np.asarray(txt.filter(ImageFilter.GaussianBlur(7 * W / 720)), np.float32) / 255 * 0.55
        near = np.asarray(txt.filter(ImageFilter.GaussianBlur(1.5 * W / 720)), np.float32) / 255 * 0.7
        rgba[..., 3] = np.maximum(far, near)
    a = np.asarray(txt, np.float32) / 255
    rgba[..., :3] = np.asarray(WARM, np.float32)[None, None, :] * a[..., None]
    rgba[..., 3] = a + rgba[..., 3] * (1 - a)
    rgba[..., :3] = np.where(rgba[..., 3:4] > 0, rgba[..., :3] / np.maximum(rgba[..., 3:4], 1e-6), 0)
    return rgba


def logo_patch(width):
    im = Image.open(LOGO).convert("RGBA")
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    a = np.asarray(im, np.float32)
    a[..., 3] /= 255
    # 첫 편과 같은 그늘(drop-shadow 0 4px 14px 45%)
    sh = Image.fromarray((a[..., 3] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8 * W / 720))
    s = np.asarray(sh, np.float32) / 255 * 0.45
    s = np.roll(s, round(3 * W / 720), axis=0)
    out = np.zeros_like(a)
    out[..., 3] = a[..., 3] + s * (1 - a[..., 3])
    out[..., :3] = a[..., :3] * (a[..., 3:4] / np.maximum(out[..., 3:4], 1e-6))
    return out


def blend(frame, patch, cx, cy, alpha):
    if alpha <= 0:
        return
    h, w = patch.shape[:2]
    x, y = int(round(cx - w / 2)), int(round(cy - h / 2))
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    p = patch[y0 - y:y1 - y, x0 - x:x1 - x]
    a = p[..., 3:4] * alpha
    region = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (region * (1 - a) + p[..., :3] * a).astype(np.uint8)


def ramp(t, a, d):
    if t <= a:
        return 0.0
    k = min(1.0, (t - a) / d)
    return 1 - (1 - k) ** 3   # 빠르게 나와 천천히 멎음


def main():
    os.makedirs(OUT, exist_ok=True)
    table = cuts()
    if "--받아쓰기" in sys.argv:
        json.dump(transcribe(table), open(os.path.join(OUT, "_받아쓰기_720p.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return
    caps = place(table)
    for a, b, s in caps:
        print(f"  자막 {a:5.2f}~{b:5.2f} {s}")

    # 1) 잘라 잇기 — 판과 컷표 구간이 그대로면 앞 회차의 이음 판을 다시 쓴다(PC가 바쁠 때 10분 걸렸다)
    joined = os.path.join(OUT, "_이음_720p.mov")
    key = json.dumps([(cut, a, b, os.path.getmtime(os.path.join(SRC, f"{cut}.mp4"))) for cut, a, b, _ in table])
    keyf = joined + ".key"
    if not (os.path.exists(joined) and os.path.exists(keyf) and open(keyf, encoding="utf-8").read() == key):
        args, fc = ["ffmpeg", "-y", "-v", "error"], []
        for i, (cut, a, b, _) in enumerate(table):
            args += ["-i", os.path.join(SRC, f"{cut}.mp4")]
            fc.append(f"[{i}:v]trim={a}:{b},setpts=PTS-STARTPTS,scale={W}:-2:flags=lanczos,crop={W}:{H},fps={FPS},setsar=1[v{i}]")
            fc.append(f"[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a{i}]")
        fc.append("".join(f"[v{i}][a{i}]" for i in range(len(table))) + f"concat=n={len(table)}:v=1:a=1[v][a]")
        run(*args, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "14", "-preset", "fast",
            "-c:a", "pcm_s16le", joined)
        open(keyf, "w", encoding="utf-8").write(key)

    # 2) 자막과 끝 화면 얹기
    cap_p = {s: text_patch(s, round(52 * K), weight=600) for _, _, s in caps}
    c6 = sum(b - a for cut, a, b, _ in table if cut != "C6")
    total = sum(b - a for _, a, b, _ in table)
    logo = logo_patch(round(360 * K))
    disc = text_patch("Every person on screen is an AI model.", round(31 * K))
    url = text_patch("synk.im/en/pulse", round(30 * K))
    ys = np.arange(H, dtype=np.float32) / H
    s = np.clip((ys - 0.08) / 0.14, 0, 1)
    shade = (0.80 * (1 - s * s * (3 - 2 * s)))[:, None, None]   # 위 8%는 0.8, 22%까지 부드럽게 풀린다(C6 머리 꼭대기가 265px라 그 위에서 끝낸다)

    # 음량 −14 LUFS — 한 번에 거는 loudnorm은 34초 판에서 −15.6에 머물러(11-18), 먼저 재고 그 값으로 다시 건다
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", joined, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    norm = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
            f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    n = int(round(total * FPS))
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", joined, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    final = os.path.join(OUT, "다섯번의디렉션_1080.mp4")
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", joined, "-map", "0:v", "-map", "1:a", "-af", norm, "-ar", "48000",
                            "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                            "-movflags", "+faststart", "-shortest", final], stdin=subprocess.PIPE)
    for i in range(n):
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        t = i / FPS
        for a, b, s in caps:
            if a <= t < b:
                k = ramp(t, a, 0.25)
                o = min(k, 1.0 if t < b - 0.2 else (b - t) / 0.2)
                blend(fr, cap_p[s], W / 2, CAP_Y * K + (1 - k) * 8 * K, o)
        tc = t - c6
        if tc >= CARD["어둠"]:
            g = ramp(tc, CARD["어둠"], 0.5)
            fr[:] = (fr.astype(np.float32) * (1 - shade * g) + np.array([10, 8, 14], np.float32) * shade * g).astype(np.uint8)
            for key, patch, cy in (("로고", logo, 72 * K), ("고지", disc, 160 * K), ("주소", url, 205 * K)):   # 11-18 첫 판은 주소(290)가 C6 머리카락에 걸려 올렸다
                k = ramp(tc, CARD[key], 0.4)
                blend(fr, patch, W / 2, cy + (1 - k) * 12 * K, k * (0.94 if key == "주소" else 1.0))
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    enc.wait()
    dec.stdout.close()   # 이음 판이 n장보다 한두 장 길면 디코더가 남은 장을 내보내려다 막힌다(11-18 첫 굽기에서 10분 멈춤)
    dec.kill()
    dec.wait()
    run("ffmpeg", "-y", "-v", "error", "-i", final, "-vf", "fps=2,scale=144:-2,tile=12x5:padding=3", "-frames:v", "1", "-q:v", "4",
        os.path.join(OUT, "다섯번의디렉션_1080_반초.jpg"))
    print(final, f"{total:.1f}초")


if __name__ == "__main__":
    main()
