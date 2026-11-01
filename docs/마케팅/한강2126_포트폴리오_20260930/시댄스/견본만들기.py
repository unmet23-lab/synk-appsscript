# 한강2126 재촬영 — 배역 목소리 견본(2026-11-01). 시댄스 2.5 새 방식(B)의 3_목소리견본.mp3 — 그 배역 견본의 결로 시댄스가 대사를 연기한다.
#   python -X utf8 견본만들기.py   → git 밖 재촬영_v40/시댄스/견본/<배역>.mp3 · _견본목록.json
# 목소리는 10-19 결정 그대로 v34 목소리다(03 대본 3절 — 조연 여섯은 v34에서 Seedance 2.5가 처음 낸 목소리, 그는 v34 영상 속 그 목소리). 견본은 v34 원본 클립에서
# Demucs로 뗀 목소리(소리/목소리_분리/<이름>_목소리.wav — 10-19)와 그의 깨끗한 줄(소리/그_목소리본뜨기/샘플/)에서 대사 구간만 잘라 0.35초 쉼으로 잇고,
# 앞뒤 무음을 자른 뒤 −17 LUFS · 봉우리 −1.5 dB로 둔다(굽기 시트 견본떼기.py와 같은 크기). 구간은 무음 검출(−40 dB · 0.25초)로 잰 실제 소리 자리다 —
# 받아쓰기 낱말 시각은 이 파일들에서 2~4초 어긋나 무음 자리를 가리켰다(11-01 실측: 감독 첫 줄은 0~2.1초에 다 있고 그 뒤 4.7초는 무음).
# 조각마다 받아써 적은 글과 견주고, 이은 견본도 다시 받아쓴다. 줄과 줄 사이 다른 소리(Demucs가 남긴 숨 · 발소리)는 구간 밖이라 안 들어간다.
# 인사 다섯(2C)은 v34 목소리가 없어 견본이 없다 — 03 대본대로 Gemini 원어민 목소리(유호님 고름)를 후반에 얹고 판은 소리 끔이다.
import json
import os
import re
import shutil
import subprocess
import tempfile

V40 = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40"
SEP = os.path.join(V40, "소리", "목소리_분리")
HIM = os.path.join(V40, "소리", "그_목소리본뜨기", "샘플")
OUT = os.path.join(V40, "시댄스", "견본")
GAP = 0.35
# 배역 → [(파일, 시작, 끝, 글)] — 시각은 무음 검출로 잰 소리 자리 ± 0.1초
ROLES = {
    "director": [   # 감독 — 1층 v20 장면(S2_v19) 한 생성의 목소리: S2e(옷 교차 몽타주)를 v20 그대로 쓰니 그 클립과 같은 목소리로
        (f"{SEP}/S2_v19_목소리.wav", 0.0, 2.25, "모델분, 늦으셨네요? 이쪽이요."),
        (f"{SEP}/S2_v19_목소리.wav", 8.45, 10.5, "AI 모델은 옷을 안 갈아입어도 돼요."),
        (f"{SEP}/S2_v19_목소리.wav", 14.35, 16.37, "수고하셨어요. 4층은 저 계단이요."),
    ],
    "receptionist": [   # 2층 접수원
        (f"{SEP}/G2_접수대_원래대사_목소리.wav", 2.7, 4.96, "면접이시죠? 14분 늦으셨네요."),
        (f"{SEP}/G3_4층이에요_원래대사_목소리.wav", 0.0, 1.95, "4층이에요. 계속 올라가세요."),
    ],
    "colleague": [   # 2층 빨간머리 직원 — v34 줄이 하나뿐이라 짧다(2.3초)
        (f"{SEP}/1910_커피질문_목소리.wav", 1.15, 3.6, "음... 커피 어디서 샀어요?"),
    ],
    "teacher": [   # LAB 선생님(L4b 1.6초의 「네」는 그의 목소리라 뺀다)
        (f"{SEP}/L2_원래대사_목소리.wav", 3.4, 5.95, "어. 서. 오. 세. 요~!"),
        (f"{SEP}/L4a_원래대사_목소리.wav", 0.84, 2.34, "한 번 해 보세요. 병원!"),
        (f"{SEP}/L4a_원래대사_목소리.wav", 8.76, 9.95, "한국 분이세요?"),
        (f"{SEP}/L4b_원래대사_목소리.wav", 3.84, 4.85, "아, 면접?"),
    ],
    "counselor": [   # PATH 상담사
        (f"{SEP}/P1_원래대사_목소리.wav", 3.8, 7.62, "면접이시죠? 한 번 연습하고 가세요."),
        (f"{SEP}/P3_원래대사_목소리.wav", 2.65, 4.96, "좋아요. 진짜는 4층이에요."),
    ],
    "interviewer": [   # 4층 면접관 — v34 두 줄(F1 · F4)이 짧아 2초 남짓
        (f"{SEP}/F1_원래대사_목소리.wav", 4.9, 5.66, "왜 늦었어요?"),
        (f"{SEP}/F4_원래대사_목소리.wav", 0.45, 1.52, "수영 잘해요?"),
    ],
    "him": [   # 그 — v34 영상 속 그 목소리(B 대안 판에만 — 그의 줄은 v34 녹음을 후반에 얹는 것이 주판)
        (f"{HIM}/09_20.wav", 0.0, 2.06, "모악산 배네치아요. 상어가 있어서요."),
        (f"{HIM}/17.wav", 0.0, 1.01, "잘 부탁드립니다."),
        (f"{SEP}/L4b1_네_원래대사_목소리.wav", 2.55, 2.95, "네."),
    ],
}
KO = {"director": "감독", "receptionist": "접수원", "colleague": "빨간머리 직원", "teacher": "선생님", "counselor": "상담사",
      "interviewer": "면접관", "him": "그"}


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def build(role, parts, tmp, model):
    pieces = []
    for i, (src, a, b, _) in enumerate(parts):
        p = os.path.join(tmp, f"{role}_{i}.wav")
        # 조각마다 앞뒤 무음을 자르고(−45 dB) 48k 모노로
        af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
              "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", src, "-ac", "1", "-ar", "48000", "-af", af, p])
        segs, _ = model.transcribe(p, language="ko", vad_filter=False, beam_size=5)
        heard = " ".join(s.text.strip() for s in segs).strip()
        print(f"   조각 {os.path.basename(src)} {a:.2f}–{b:.2f}: 「{heard}」 ← 「{parts[i][3]}」 오류율 {cer(parts[i][3], heard):.2f}")
        pieces.append(p)
    gap = os.path.join(tmp, "gap.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{GAP}", gap])
    lst = os.path.join(tmp, f"{role}.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for i, p in enumerate(pieces):
            if i:
                f.write(f"file '{gap}'\n")
            f.write(f"file '{p}'\n")
    joined = os.path.join(tmp, f"{role}_이음.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined])
    dst = os.path.join(OUT, role + ".mp3")
    run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-af", "loudnorm=I=-17:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "libmp3lame",
         "-b:a", "192k", dst])
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst],
                               capture_output=True, text=True).stdout.strip())
    return dst, dur


def norm(s):
    return re.sub(r"[^가-힣0-9A-Za-z]", "", s)


def cer(ref, hyp):
    a, b = norm(ref), norm(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)] / max(1, len(a))


def main():
    os.makedirs(OUT, exist_ok=True)
    from faster_whisper import WhisperModel
    model = WhisperModel("medium", device="cpu", compute_type="int8")
    tmp = tempfile.mkdtemp(prefix="한강견본_")
    listing = {}
    try:
        for role, parts in ROLES.items():
            dst, dur = build(role, parts, tmp, model)
            segs, _ = model.transcribe(dst, language="ko", vad_filter=False, beam_size=5)
            heard = " ".join(s.text.strip() for s in segs).strip()
            text = " ".join(t for *_, t in parts)
            err = cer(text, heard)
            listing[role] = {"배역": KO[role], "파일": os.path.basename(dst), "초": round(dur, 2), "글": text, "받아쓰기": heard,
                             "오류율": round(err, 2), "조각": [{"원본": os.path.relpath(s, V40).replace("\\", "/"), "시작": a, "끝": b, "글": t}
                                                              for s, a, b, t in parts]}
            print(f"{KO[role]}({role}): {dur:.1f}초 · 받아쓰기 오류율 {err:.2f} 「{heard}」" + ("" if err <= 0.2 else "  ⚠ 적은 글과 다르게 들림"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    json.dump(listing, open(os.path.join(OUT, "_견본목록.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
