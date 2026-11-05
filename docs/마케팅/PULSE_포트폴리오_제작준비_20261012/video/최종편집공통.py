# 시댄스 판 최종 편집 공통(2026-11-03) — 받은 판을 프레임 번호로 잘라 하드컷으로 잇고, 소리를 놓고, 한계기로 마감한다. 후보정 없음(결정 10-24).
# 쓰는 곳: pet-ad-20261026/최종편집.py · mens-fragrance-20261026/최종편집.py (매진 임박은 먼저 만든 자기 파일을 쓴다)
import os
import subprocess
import wave

import numpy as np

RATE = 48000
DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"
REPO = "C:/Users/q1212/Documents/SYNK-appsscript"
DEMUCS = "C:/SYNK-LoRA/tools/demucs"


def run(*a, cwd=None):
    subprocess.run(a, check=True, cwd=cwd)


def md5(path):
    import hashlib
    h = hashlib.md5()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def frames_of(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    return int(r.stdout.strip().split(",")[0])


def clip(pid):
    return os.path.join(DAY, pid + ".mp4")


def latest(*pids):
    # 다시 뽑은 판이 들어왔으면 그 판, 아직이면 앞 판
    for p in pids:
        if os.path.exists(clip(p)):
            return p
    raise SystemExit(f"판이 없다: {pids}")


def cut_video(src, a, k, w, h, fps, out, crop=None):
    # 판의 a번째 프레임부터 k장 — 색 · 속도는 그대로. crop은 「너비:높이:x:y」(판 크기 기준, 없으면 판 전체)
    c = f"crop={crop}," if crop else ""
    vf = f"select='between(n,{a},{a + k - 1})',setpts=N/{fps}/TB,{c}scale={w}:{h}:flags=lanczos:out_color_matrix=bt709,format=yuv420p"
    run("ffmpeg", "-y", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(fps),
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)


def join_videos(paths, out):
    lst = out + ".txt"
    with open(lst, "w", encoding="utf-8") as f:
        for p in paths:
            f.write(f"file '{p}'\n")
    run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out)


def load(path, rate=RATE):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()


def voice_only(pid, out_dir):
    # 소리 켠 판에서 목소리만 뗀다(Demucs CPU, 현장노트 영상 「대사 클립의 목소리만 떼기」) — 이미 있으면 그대로
    import shutil
    import tempfile
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, pid + ".wav")
    if not os.path.exists(dst):
        tmp = tempfile.mkdtemp(prefix="목소리_")
        wav = os.path.join(tmp, "소리.wav")
        run("ffmpeg", "-y", "-v", "error", "-i", clip(pid), "-vn", "-ac", "2", "-ar", "44100", wav)
        subprocess.run([os.path.join(DEMUCS, "venv", "Scripts", "python.exe"), "-X", "utf8", os.path.join(DEMUCS, "목소리떼기.py"), tmp, wav], check=True, capture_output=True)
        shutil.copy2(os.path.join(tmp, "소리_목소리.wav"), dst)
        shutil.rmtree(tmp, ignore_errors=True)
    return dst


def load_stereo(path, rate=RATE):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).copy()


class Mix:
    # 말 · 사건 소리는 가운데(mono를 넣으면 양쪽 같게), 음악 · 바탕은 받은 스테레오 그대로
    def __init__(self, seconds):
        self.a = np.zeros((int(seconds * RATE) + RATE, 2), np.float32)
        self.n = int(seconds * RATE)

    def put(self, t, x, db=0.0, fade=0.006, fade_out=None):
        x = x.copy() * (10 ** (db / 20))
        if x.ndim == 1:
            x = np.stack([x, x], axis=1)
        n = int(fade * RATE)
        if n and len(x) > 2 * n:
            x[:n] *= np.linspace(0, 1, n)[:, None]
            x[-n:] *= np.linspace(1, 0, n)[:, None]
        if fade_out:
            m = min(len(x), int(fade_out * RATE))
            x[-m:] *= np.linspace(1, 0, m)[:, None]
        i = max(0, int(t * RATE))
        j = min(len(self.a), i + len(x))
        if i < j:
            self.a[i:j] += x[:j - i]

    def finish(self, path, boost_db=0.0):
        # 봉우리를 1로 둔 합을 한계기로 마감 — 소리는 조각마다 키우지 않는다
        raw = path + ".합.wav"
        peak = float(np.max(np.abs(self.a))) or 1.0
        with wave.open(raw, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes((self.a[:self.n] / peak * 32767).astype(np.int16).tobytes())
        run("ffmpeg", "-y", "-v", "error", "-i", raw, "-af", f"volume={boost_db}dB,alimiter=limit=0.89:attack=4:release=60:level=false", "-ar", str(RATE), "-c:a", "pcm_s16le", path)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(" ".join(r.stderr.split("Summary:")[-1].split())[:200])
