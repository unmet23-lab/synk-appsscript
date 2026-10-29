# 7번 숏드라마 소리 참고 만들기(2026-10-29) — 웹꾸러미.py --둘째날이 판 폴더에 넣을 파일을 git 밖 소리/p7/소리참고/에 만든다.
#   python -X utf8 소리참고.py A <대사 폴더>   → 소리참고/A/<판 id>.mp3 — 판마다 그 판의 입 맞춤 대사만, 앞 0.3초 무음 뒤 샷 「말」의 시작 초
#                                                (묶음 둘째 샷은 자르는 초를 더함)에 첫 소리가 오게 놓은 판 길이 mp3(02_콘티 8-4 · 현장노트 higgsfield
#                                                「시간표와 대사가 지시문보다 늦게 온다」)
#   python -X utf8 소리참고.py B <견본 폴더>   → 소리참고/B/<ian · seojin · minjae · soyeon>.mp3 — 고른 목소리로 구운 배역 견본(견본_계획.json 글)
# <대사 폴더>/<컷>.wav(예: 1-16.wav) = 고른 목소리로 그 컷의 대사만 구운 것. 앞뒤 무음은 있어도 된다 — 첫 소리를 −40 dBFS로 찾는다.
# 화면 밖 덧말 · 입이 가려진 말은 A에 넣지 않는다 — 입이 남의 목소리를 따라 움직이지 않게(02_콘티 8-4). 대사가 판 끝을 넘으면 알린다.
import json, os, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.join(HERE, "..", "지시문", "영상_시댄스웹.json")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/소리/p7/소리참고"
ROLE = {"IAN": "ian", "SEOJIN": "seojin", "MINJAE": "minjae", "SOYEON": "soyeon"}
LEAD = 0.3
SR = 48000


def load(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32)


def onset(x):
    n = int(SR * 0.02)
    for i in range(0, len(x) - n, n):
        if 20 * np.log10(np.sqrt(np.mean(x[i:i + n] ** 2)) + 1e-9) > -40:
            return i
    return 0


def write_mp3(x, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    p = subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "192k", dst],
                       input=x.astype(np.float32).tobytes(), check=True)
    return p


def build_a(lines):
    spec = json.load(open(SPEC, encoding="utf-8"))
    made, warn = 0, []
    for p in spec["판"]:
        if p["소리"] != "켬":
            continue
        total = int(round(p["길이"] * SR))
        out = np.zeros(total, np.float32)
        put = 0
        for i, s in enumerate(p["샷"]):
            m = s.get("말")
            if not m or "입 맞춤" not in m.get("꼴", ""):
                continue
            src = os.path.join(lines, s["컷"] + ".wav")
            if not os.path.exists(src):
                warn.append(f"{p['id']}: {s['컷']}.wav 없음")
                continue
            x = load(src)
            x = x[onset(x):]
            at = LEAD + m["시작초"] + (p["자르는초"] if i == 1 and p.get("자르는초") else 0)
            a = int(round(at * SR))
            if a + len(x) > total:
                warn.append(f"{p['id']}: {s['컷']} 대사가 판 끝을 {(a + len(x) - total) / SR:.2f}초 넘음(잘림)")
                x = x[:max(0, total - a)]
            out[a:a + len(x)] += x
            put += 1
        if put:
            write_mp3(np.clip(out, -0.99, 0.99), os.path.join(OUT, "A", p["id"] + ".mp3"))
            made += 1
    print(f"방식 A 소리 참고 {made}개 → {os.path.join(OUT, 'A')}")
    for w in warn:
        print("  ⚠", w)


def build_b(samples):
    made = 0
    for role in ROLE.values():
        src = next((os.path.join(samples, f) for f in os.listdir(samples) if os.path.splitext(f)[0] == role), None)
        if not src:
            print(f"  ⚠ {role} 견본 없음")
            continue
        dst = os.path.join(OUT, "B", role + ".mp3")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-af", "loudnorm=I=-17:TP=-1.5:LRA=11",
                        "-c:a", "libmp3lame", "-b:a", "192k", dst], check=True)
        made += 1
    print(f"방식 B 견본 {made}개 → {os.path.join(OUT, 'B')}")


if __name__ == "__main__":
    {"A": build_a, "B": build_b}[sys.argv[1]](sys.argv[2])
