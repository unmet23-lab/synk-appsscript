# 11번 민재 내레이션(MonoGPT 시댄스 한 판)을 받아써 문장마다 원래 컷 자리에 놓고, 낱말 시각을 Remotion 시안 표(src/p11/timing.ts)로 쓴다.
#   python -X utf8 내레이션시각.py [판 id | 소리 파일]   (기본 p11-말-민재-전체 — 시댄스 세 판 모두 「구명조끼」를 「구명조닉」으로 읽어 11-03부터 일레븐 v4 후보 파일)
import json, os, subprocess, sys, tempfile
from faster_whisper import WhisperModel

PID = sys.argv[1] if len(sys.argv) > 1 else "p11-말-민재-전체"
SRC = PID if os.path.exists(PID) else f"C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음/{PID}.mp4"   # 판 id 또는 소리 파일 경로(일레븐 대비책)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "remotion", "src", "p11", "timing.ts")
# 대본(받아쓰기가 틀린 낱말은 대본 글로 쓴다) · ★ 강조 · 원래 컷 자리(02_콘티 2절 · 최종편집.py CAP의 문장 첫 시각)
SCRIPT = [
    ("★외계인 닮은 우리 개는 ★바닷가에서 뛰어노는 걸 제일 좋아해요.", 0.00),
    ("근데 사람들이 보면 ★깜짝 ★놀라요.", 3.80),
    ("그래서 올해는 ★특별한 걸 준비했어요.", 5.70),
    ("★첨벙댕 ★구명조끼!", 8.60),
    ("값도 착하고 ★튼튼해요.", 10.20),
    ("등에 ★손잡이가 두 개라 물에서도 ★번쩍 건져요.", 11.90),
    ("올해는 진짜 ★멋있을 거예요.", 14.90),
    ("아무도 ★외계인인 줄 모를걸요?", 16.27),
    ("물놀이 가는 날엔, ★첨벙댕.", 19.33),
]
GAP = 0.12

wav = os.path.join(tempfile.mkdtemp(), "v.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", local_files_only=True)
segs, _ = m.transcribe(wav, language="ko", word_timestamps=True, beam_size=5)
words = [w for s in segs for w in s.words]
out, i, prev_end = [], 0, -1.0
for text, slot in SCRIPT:
    toks = text.split()
    ws = words[i:i + len(toks)]
    i += len(toks)
    if len(ws) != len(toks):
        raise SystemExit(f"낱말 수가 안 맞음: {text} ↔ {[w.word for w in ws]}")
    s0, s1 = ws[0].start, ws[-1].end
    place = max(slot, prev_end + GAP)
    prev_end = place + (s1 - s0)
    out.append({"src": [round(s0, 3), round(s1, 3)], "at": round(place, 3), "end": round(prev_end, 3),
                "words": [{"w": tok.lstrip("★"), "key": tok.startswith("★"), "t": round(place + (w.start - s0), 3)} for tok, w in zip(toks, ws)],
                "heard": "".join(w.word for w in ws).strip()})
    print(f"{place:6.2f}–{prev_end:6.2f} (자리 {slot:5.2f}) {text}  ← 받아쓰기 「{out[-1]['heard']}」")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(f"// 내레이션시각.py가 {PID}에서 만든 표 — 손으로 고치지 않는다\n")
    f.write("export type Word = { w: string; key: boolean; t: number };\n")
    f.write("export type Line = { src: [number, number]; at: number; end: number; words: Word[]; heard: string };\n")
    f.write(f"export const NARR_ID = {json.dumps(PID, ensure_ascii=False)};\n")
    f.write("export const LINES: Line[] = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
print(OUT)
