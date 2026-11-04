"""
말 랠리 캠퍼스 판(2026-11-04) — 한 번에 읽힌 태오 목소리 묶음을 줄마다 자른다(드라마 목소리후보 나누기.py와 같은 방법).
받아쓰기 낱말 시각으로 대본 줄에 맞추고 줄 사이 쉼 가운데에서 자른 뒤, 앞뒤 무음을 자르고(말이 끝나는 순간 공을 친다 — 원래 몽글 음성과 같은 손질)
−18 LUFS · 24kHz 모노 MP3 96kbps로 맞춘다. 자른 줄마다 다시 받아 적어 대본과 맞는지 본다(맞음 = 글자 닮음, 1이면 같음).

    python -I -X utf8 목소리나누기.py [묶음 번호…]       (주지 않으면 받은 묶음 전부)

들어오는 것: 공용 작업본 .tmp/talk-rally-world-20261104/voice/묶음-N.mp3 · 묶음-N.줄.json(목소리굽기.mjs 준비)
나가는 것: experiences/talk-rally/assets/world/cast/taeo/voice/<id>.mp3, 대조 기록 .tmp/…/voice/나눔.json, 공개 목록 assets/world/cast/taeo/voice/manifest.json
"""
import difflib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from faster_whisper import WhisperModel

여기 = Path(__file__).resolve().parent
게임 = 여기.parents[1]
밖 = Path(r"C:\Users\q1212\Documents\SYNK-appsscript") / ".tmp" / "talk-rally-world-20261104" / "voice"
낼 = Path(os.environ["TALK_VOICE_OUT"]) if os.environ.get("TALK_VOICE_OUT") else 게임 / "assets" / "world" / "cast" / "taeo" / "voice"   # 시험 판은 다른 폴더로
낼.mkdir(parents=True, exist_ok=True)
norm = lambda s: re.sub(r"[^가-힣0-9]", "", s)
model = WhisperModel("medium", device="cpu", compute_type="int8")


def 닮음(a, b):
    a, b = norm(a), norm(b)
    return round(difflib.SequenceMatcher(None, a, b, autojunk=False).ratio(), 3) if (a or b) else 1.0


def 길이(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout)


def 말구간(원본, lo, hi, s, e):
    """lo~hi(앞뒤 줄과의 쉼 가운데) 창에서 말소리 덩이(−38dB 위, 0.1초 넘는 쉼으로 가름)를 찾아, 받아쓰기 낱말 s~e에 걸친 덩이부터 잡고
    0.45초 안쪽에 붙은 0.15초 넘는 덩이까지 넓힌 처음 · 끝(초). 낱말 밖의 짧은 소리(앞 줄 꼬리 · 숨소리)는 버리고(11-04 r01 · w04),
    받아쓰기가 첫 낱말을 놓쳐도 실제 말은 자르지 않는다(11-04 「괜찮아요. 한 판 더 해요!」의 앞이 잘렸다)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", f"{lo:.3f}", "-to", f"{hi:.3f}", "-i", str(원본), "-af", "silencedetect=n=-38dB:d=0.1", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    쉼, 시작 = [], None
    for m in re.finditer(r"silence_(start|end): ([\d.]+)", r):
        if m[1] == "start":
            시작 = float(m[2])
        elif 시작 is not None:
            쉼.append((시작, float(m[2])))
            시작 = None
    if 시작 is not None:
        쉼.append((시작, hi - lo))
    덩이, at = [], 0.0
    for a, b in sorted(쉼):
        if a > at:
            덩이.append((at, a))
        at = max(at, b)
    if at < hi - lo:
        덩이.append((at, hi - lo))
    걸침 = [i for i, (a, b) in enumerate(덩이) if b > s - lo - 0.05 and a < e - lo + 0.05 and b - a > 0.04]
    if not 걸침:
        return max(lo, s - 0.08), min(hi, e + 0.12)
    i0, i1 = 걸침[0], 걸침[-1]
    while i0 > 0 and 덩이[i0][0] - 덩이[i0 - 1][1] <= 0.45 and 덩이[i0 - 1][1] - 덩이[i0 - 1][0] >= 0.15:
        i0 -= 1
    while i1 < len(덩이) - 1 and 덩이[i1 + 1][0] - 덩이[i1][1] <= 0.45 and 덩이[i1 + 1][1] - 덩이[i1 + 1][0] >= 0.15:
        i1 += 1
    return lo + max(0.0, 덩이[i0][0] - 0.03), lo + min(hi - lo, 덩이[i1][1] + 0.06)


def 나누기(n):
    원본 = 밖 / f"묶음-{n}.mp3"
    줄 = json.loads((밖 / f"묶음-{n}.줄.json").read_text(encoding="utf-8"))
    segs, _ = model.transcribe(str(원본), language="ko", word_timestamps=True, beam_size=5)
    words = [w for s in segs for w in s.words]
    hyp, owner = "", []
    for i, w in enumerate(words):
        t = norm(w.word)
        hyp += t
        owner += [i] * len(t)
    ref = "".join(norm(l["글"]) for l in 줄)
    r2h = {}
    for a, b, k in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
        for j in range(k):
            r2h[a + j] = b + j

    def word_at(pos, forward=True):
        rng = range(pos, len(ref)) if forward else range(pos, -1, -1)
        for r in rng:
            if r in r2h:
                return owner[r2h[r]]
        return len(words) - 1 if forward else 0

    pos, spans = 0, []
    for l in 줄:
        k = len(norm(l["글"]))
        spans.append((word_at(pos, True), word_at(pos + k - 1, False)))
        pos += k
    dur = 길이(원본)
    out = []
    for i, (a, b) in enumerate(spans):
        s, e = words[a].start, words[b].end
        lo = 0.0 if i == 0 else (words[spans[i - 1][1]].end + s) / 2
        hi = dur if i == len(spans) - 1 else (e + words[spans[i + 1][0]].start) / 2
        a0, a1 = 말구간(원본, lo, hi, s, e)
        파일 = 낼 / 줄[i]["파일"]
        # 말소리 구간만 남기고(말 끝 = 공 치는 순간 — 앞 줄 꼬리 · 숨소리가 붙으면 공이 늦다), 크기는 원래 몽글 음성과 같은 −18 LUFS
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a0:.3f}", "-to", f"{a1:.3f}", "-i", str(원본), "-af",
                        "afade=t=in:d=0.008,areverse,afade=t=in:d=0.03,areverse,loudnorm=I=-18:TP=-1.5:LRA=11",
                        "-ar", "24000", "-ac", "1", "-b:a", "96k", str(파일)], check=True)
        다시, _ = model.transcribe(str(파일), language="ko", beam_size=5)
        글 = " ".join(x.text.strip() for x in 다시)
        초 = round(길이(파일), 2)
        음절 = len(norm(줄[i]["글"]))
        out.append({"id": 줄[i]["id"], "글": 줄[i]["글"], "꼬리표": 줄[i]["꼬리표"], "파일": 파일.name, "초": 초, "초당음절": round(음절 / max(초, 0.1), 1),
                    "받아쓰기": 글, "맞음": 닮음(줄[i]["글"], 글)})
        print(f"묶음-{n} {파일.name:16} {초:5.2f}초 {out[-1]['초당음절']:4}음절/초 맞음 {out[-1]['맞음']}  {글}")
    return out


if __name__ == "__main__":
    번호 = sys.argv[1:] or sorted({p.stem.split("-")[1] for p in 밖.glob("묶음-*.mp3") if not p.stem.endswith(".받은")}, key=int)
    기록파일 = 밖 / ("나눔.json" if not os.environ.get("TALK_VOICE_OUT") else "나눔_시험.json")
    기록 = json.loads(기록파일.read_text(encoding="utf-8")) if 기록파일.exists() else {}
    for n in 번호:
        for r in 나누기(n):
            기록[r["id"]] = r
    기록파일.write_text(json.dumps(기록, ensure_ascii=False, indent=1), encoding="utf-8")
    # 공개 목록: 제작 도구 이름 없이 글 · 길이만(원래 assets/voice/manifest.json과 같은 생각)
    목록 = {"speaker": "태오", "humanRecording": False, "lines": {k: {"text": v["글"], "seconds": v["초"]} for k, v in sorted(기록.items())}}
    (낼 / "manifest.json").write_text(json.dumps(목록, ensure_ascii=False, indent=1), encoding="utf-8")
    나쁨 = [k for k, v in 기록.items() if v["맞음"] < 0.85]
    print("맞음 0.85 아래:", 나쁨 or "없음")
