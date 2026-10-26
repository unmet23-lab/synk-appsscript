# 콘티 v5 Seedance 결과 검수(2026-10-26) — 받은 클립마다 첫 화면이 시작 그림대로 남았는지, 끝 그림 컷은 끝이 끝 그림에 닿는지,
# 중간에 하드컷이 끼었는지, 말소리가 무엇인지(받아쓰기)를 재고, 컷마다 한 줄 프레임 판을 만든다.
#   python -X utf8 영상검수_v5.py <폴더>   → <폴더>/_검수.jpg · _검수.json (클립 이름은 <컷 id>_<꼬리>.mp4, 예: S07_480a.mp4)
# 시작 · 끝 그림(영상/시작_v5)과 우리 클립만 넣는다 — 원본과의 대조는 콘티보드에서. 결정 10-24대로 받은 그대로를 잰다.
# 첫 화면 · 끝 닮음은 흐린 회색 SSIM(1이 같음), 하드컷은 이웃 프레임 차이가 중앙값의 6배와 20을 함께 넘는 자리.
import glob
import importlib.util
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
START = os.path.join(V, "영상", "시작_v5")
SUIT = os.path.join(REPO, "docs", "브랜드_폰트", "SUIT")
F = lambda w, s: ImageFont.truetype(os.path.join(SUIT, f"SUIT-{w}.otf"), s)
BG, INK, DIM, GOLD, BAD = (17, 15, 14), (238, 232, 224), (160, 150, 140), (240, 200, 120), (240, 120, 100)
_spec = importlib.util.spec_from_file_location("sim", os.path.join(HERE, "이미지콘티_v4_닮음.py"))
SIM = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SIM)
WHO = {"S07": "A 지유", "S12": "A 지유", "S14": "A 지유", "S18": "A 지유", "S08": "B 리4", "S17": "B 리4", "S20": "B 리4",
       "S22": "B 리4", "S16": "C 통2", "S26": "C 통2", "S28": "C 통2", "S30": "C 통2"}


def imread(path):   # 한글 경로는 cv2.imread가 못 읽는다
    return cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)


def read(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out, fps


def ssim(a, b):
    b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
    x, y = (cv2.GaussianBlur(cv2.cvtColor(i, cv2.COLOR_BGR2GRAY).astype(np.float64), (0, 0), 2) for i in (a, b))
    mx, my = cv2.GaussianBlur(x, (0, 0), 6), cv2.GaussianBlur(y, (0, 0), 6)
    vx = cv2.GaussianBlur(x * x, (0, 0), 6) - mx * mx
    vy = cv2.GaussianBlur(y * y, (0, 0), 6) - my * my
    cxy = cv2.GaussianBlur(x * y, (0, 0), 6) - mx * my
    c1, c2 = 6.5, 58.5
    return float((((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))).mean())


def cuts(frames, fps):
    small = [cv2.cvtColor(cv2.resize(f, (160, 90), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames]
    d = np.array([np.abs(small[i] - small[i - 1]).mean() for i in range(1, len(small))])
    if not len(d):
        return [], 0.0
    med = float(np.median(d))
    hits = [round((i + 1) / fps, 2) for i, v in enumerate(d) if v > max(20.0, 6 * med)]
    return hits, float(d.max())


def like(frame, who):
    fl = SIM.faces(frame)
    if not fl:
        return None
    return max(SIM.score(f, RF[who]) for _, f in fl)


def hear(path):
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-ac", "1", "-ar", "16000", wav], capture_output=True)
        if r.returncode or not os.path.exists(wav) or os.path.getsize(wav) < 2000:
            return None
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from faster_whisper import WhisperModel
        global _W
        if "_W" not in globals():
            _W = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=8)
        segs, _ = _W.transcribe(wav, language="ko", vad_filter=True)
        return [(round(s.start, 2), round(s.end, 2), s.text.strip()) for s in segs]


def main(folder):
    spec = {c["id"]: c for c in json.load(open(os.path.join(HERE, "지시문", "영상_v5.json"), encoding="utf-8"))["클립"]}
    clips = sorted(glob.glob(os.path.join(folder, "S*_*.mp4")))
    rows, report = [], {}
    for p in clips:
        cid = os.path.basename(p).split("_")[0]
        c = spec[cid]
        frames, fps = read(p)
        start = imread(os.path.join(START, c["시작 그림"]))
        end = imread(os.path.join(START, c["끝 그림"])) if c.get("끝 그림") else None
        hits, dmax = cuts(frames, fps)
        r = {"프레임": len(frames), "fps": round(fps, 2), "크기": f"{frames[0].shape[1]}×{frames[0].shape[0]}",
             "첫 화면 SSIM": round(ssim(frames[0], start), 3), "하드컷": hits, "이웃 차이 최대": round(dmax, 1)}
        if end is not None:
            r["끝 SSIM"] = round(ssim(frames[-1], end), 3)
        if cid in WHO:
            r["닮음 첫 · 끝"] = [None if v is None else round(v, 2) for v in (like(frames[0], WHO[cid]), like(frames[-1], WHO[cid]))]
        words = hear(p)
        r["받아쓰기"] = words
        r["대사"] = c["대사"]
        report[os.path.basename(p)] = r
        picks = [0, int(fps), int(2 * fps), int(3 * fps), len(frames) - 1]
        picks = sorted(set(min(i, len(frames) - 1) for i in picks))
        rows.append((os.path.basename(p), c, start, end, [(i / fps, frames[i]) for i in picks], r))
        print(os.path.basename(p), json.dumps(r, ensure_ascii=False))
    json.dump(report, open(os.path.join(folder, "_검수.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sheet(rows, os.path.join(folder, "_검수.jpg"))


def sheet(rows, path):
    TW, TH = 320, 180
    C = 7
    im = Image.new("RGB", (40 + C * (TW + 8), 100 + len(rows) * (TH + 96)), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 30), "매진 임박 · Seedance 결과 검수 — 시작 그림 | 클립 0초 · 1 · 2 · 3초 · 끝 | 끝 그림", font=F("ExtraBold", 30), fill=INK)
    for k, (name, c, start, end, shots, r) in enumerate(rows):
        y = 90 + k * (TH + 96)
        cells = [("시작 그림", start)] + [(f"{t:.1f}초", f) for t, f in shots] + ([("끝 그림", end)] if end is not None else [])
        for j, (lab, img) in enumerate(cells[:C]):
            x = 40 + j * (TW + 8)
            im.paste(Image.fromarray(cv2.cvtColor(cv2.resize(img, (TW, TH), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)), (x, y))
            d.text((x + 6, y + 4), lab, font=F("SemiBold", 18), fill=GOLD)
        bad = r["하드컷"] or r["첫 화면 SSIM"] < 0.5 or r.get("끝 SSIM", 1) < 0.4
        words = " ".join(t for _, _, t in (r["받아쓰기"] or [])) or "(말소리 없음)"
        line = f"#{c['컷']} {name} · 첫 화면 SSIM {r['첫 화면 SSIM']}" + (f" · 끝 SSIM {r['끝 SSIM']}" if "끝 SSIM" in r else "") + \
               (f" · 닮음 {r['닮음 첫 · 끝']}" if "닮음 첫 · 끝" in r else "") + (f" · 하드컷 {r['하드컷']}초" if r["하드컷"] else " · 하드컷 없음")
        d.text((40, y + TH + 8), line, font=F("SemiBold", 21), fill=BAD if bad else INK)
        d.text((40, y + TH + 40), f"받아쓰기: {words}   ·   대사: {c['대사']}", font=F("Medium", 19), fill=DIM)
    im.save(path, quality=88)
    print(path, im.size)


if __name__ == "__main__":
    RF = SIM.ref_feats()
    main(sys.argv[1])
