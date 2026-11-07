# 화면 밖 대사 판에서 목소리만 떼고(Demucs) 받아쓰기 · 말 덩어리 시각을 잰다(2026-11-07, 블프 두 편 공용).
#   python -X utf8 목소리재기.py <받아쓸 판…> [--모델 medium]   → git 밖 최종/<편>/목소리/<판>.wav · <판>.json(낱말 · 덩어리)
# 말 자리는 받아쓰기 낱말 시각이 0.7~0.9초 이르다(현장노트 영상) — 판 소리의 50ms 크기 곡선에서 봉우리 −14 dB 위 덩어리로 다시 잰다.
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종"


def chunks(x, rate=C.RATE, win=0.05, rel_db=-14.0, gap=0.18, min_len=0.12):
    n = int(win * rate)
    m = len(x) // n
    db = 20 * np.log10(np.sqrt(np.mean(x[:m * n].reshape(m, n) ** 2, axis=1)) + 1e-9)
    on = db > db.max() + rel_db
    out, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            out.append([s * win, i * win]); s = None
    if s is not None:
        out.append([s * win, m * win])
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] < gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [[round(a, 2), round(b, 2)] for a, b in merged if b - a >= min_len], db


def main():
    a = sys.argv[1:]
    model = "medium"
    if "--모델" in a:
        i = a.index("--모델"); model = a[i + 1]; del a[i:i + 2]
    from faster_whisper import WhisperModel
    wm = WhisperModel(model, device="cpu", compute_type="int8")
    for pid in a:
        piece = pid.split("-")[0]
        d = os.path.join(ROOT, piece, "목소리")
        wav = C.voice_only(pid, d)
        x = C.load(wav)
        ch, _ = chunks(x)
        segs, _ = wm.transcribe(wav, language="ko", word_timestamps=True, vad_filter=False, beam_size=5)
        words = [{"w": w.word.strip(), "a": round(w.start, 2), "b": round(w.end, 2)} for s in segs for w in (s.words or [])]
        text = " ".join(w["w"] for w in words)
        json.dump({"판": pid, "글": text, "낱말": words, "덩어리": ch}, open(os.path.join(d, pid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{pid}: 「{text}」")
        print("   덩어리", ch)
        print("   낱말", " ".join(f"{w['w']}@{w['a']}" for w in words))


if __name__ == "__main__":
    main()
