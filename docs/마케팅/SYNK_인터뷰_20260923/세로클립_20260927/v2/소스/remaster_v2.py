# -*- coding: utf-8 -*-
"""음량 다시 맞추기 — 승인 믹스를 지키려고 리미터가 거의 일하지 않는 가장 큰 음량을 고른다.
목표 −14 LUFS부터 0.5dB씩 내려 −15.5까지: 리미터 최대 4dB·3dB 넘게 줄이는 시간 0.5% 이하를 처음 만족하는 값. 영상은 다시 굽지 않고 소리만 바꿔 담는다."""
import sys, os, json, subprocess
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
import make_clips_v2 as M
res = {}
for key, clip in M.CLIPS.items():
    b = json.load(open(os.path.join(M.OUT, f"{key}_build.json"), encoding="utf-8"))
    n_total = sum(s["frames"] for s in b["shot_log"])
    parts, groups = [], []
    for t0, t1, kind in clip["segs"]:
        if groups and abs(groups[-1][1] - t0) < 1e-6: groups[-1][1] = t1
        else: groups.append([t0, t1])
    has_end = any(k == "endcard" for *_, k in clip["segs"])
    for i, (t0, t1) in enumerate(groups):
        x = M.load_audio_range(t0, t1); fi = int(0.025 * M.SR); fo = int((0.5 if (i == len(groups) - 1 and has_end) else 0.08) * M.SR)
        x[:fi] *= np.linspace(0, 1, fi)[:, None]; x[-fo:] *= np.linspace(1, 0, fo)[:, None]; parts.append(x)
    x = np.concatenate(parts); n = int(round(n_total / M.FPS * M.SR)); x = x[:n] if len(x) >= n else np.pad(x, ((0, n - len(x)), (0, 0)))
    I0, _ = M.measure(x); pick = None
    for target in (-14.0, -14.5, -15.0, -15.5):
        g = target - I0
        for it in range(6):
            y, st = M.limiter(x * 10 ** (g / 20), M.CEIL_TP); I2, TP2 = M.measure(y)
            if abs(I2 - target) <= 0.1 and TP2 <= M.CEIL_TP + 0.05: break
            g += target - I2
        cand = {"target": target, "I": I2, "TP": TP2, **st}
        if st["max_gr_db"] >= -4.0 and st["over3db_pct"] <= 0.5: pick = (y, cand); break
        last = (y, cand)
    if pick is None: pick = last
    y, cand = pick
    wav = os.path.join(M.OUT, f"{key}_audio_v2b.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(M.SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", wav], input=y.astype(np.float32).tobytes(), check=True)
    src = os.path.join(M.OUT, f"clip_{key}.mp4"); dst = os.path.join(M.OUT, f"clip_{key}_tmp.mp4")
    M.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", dst])
    os.replace(dst, src)
    b["audio"] = {"input_I": round(I0, 2), **cand}; json.dump(b, open(os.path.join(M.OUT, f"{key}_build.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    res[key] = b["audio"]; print(key, b["audio"])
json.dump(res, open(os.path.join(M.OUT, "remaster.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
