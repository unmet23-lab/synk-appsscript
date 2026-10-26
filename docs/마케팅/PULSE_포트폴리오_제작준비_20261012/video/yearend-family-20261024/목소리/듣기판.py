# 6번 「연말 빈방」 목소리 듣기 판(2026-10-26) — 구운 줄(계획.json → synk-vendor/…/소리/p6/vo)을 02 콘티의 말 자리(at)에 놓은 60초 판.
#   python -X utf8 듣기판.py   → 소리/p6/듣기_<내레이터>.mp3(대사 + 그 내레이터의 끝 문구 · 브랜드 이름) · 내레이터_견줌.mp3(혜리 → 서현 → 소진)
# 듣기용 공간감(부엌 울림 · 문 너머 먹먹함 · 현관 울림)은 가볍게만 — 최종 믹스는 제작 규칙대로 다빈치 Fairlight에서 한다. 음악은 아직 없다(Suno).
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-portfolio12-20261024", "소리", "p6")
VO = os.path.join(V, "vo")
plan = json.load(open(os.path.join(HERE, "계획.json"), encoding="utf-8"))
NARR = ["혜리", "서현", "소진"]
# 줄마다 들리는 자리(02 2절 · 5절): 부엌(화면 밖) · 문 너머(딸 방 안) · 현관(멀리) · 나머지는 가까이
SPACE = {
    "부엌": "highpass=f=120,aecho=0.6:0.5:40|70:0.25|0.15,volume=-3dB",
    "문너머": "lowpass=f=1400,aecho=0.5:0.4:20:0.2,volume=-5dB",
    "현관": "lowpass=f=2500,aecho=0.6:0.5:60|110:0.3|0.2,volume=-6dB",
    "가까이": "anull",
}
WHERE = {"m02": "부엌", "m04a": "부엌", "m04b": "부엌", "d04": "문너머", "d11": "문너머", "d22": "현관"}
TOTAL = 59.99


def mix(items, out, total=TOTAL):
    """items: [(wav, 시작 초, 필터)] → 무음 바탕 위에 겹쳐 mp3"""
    args = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-t", f"{total}", "-i", "anullsrc=r=48000:cl=stereo"]
    chains = []
    for k, (wav, at, flt) in enumerate(items):
        args += ["-i", wav]
        ms = int(round(at * 1000))
        chains.append(f"[{k + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,{flt},adelay={ms}|{ms}[a{k}]")
    labels = "".join(f"[a{k}]" for k in range(len(items)))
    graph = ";".join(chains) + f";[0:a]{labels}amix=inputs={len(items) + 1}:normalize=0:duration=first,alimiter=limit=0.89[out]"
    args += ["-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", out]
    subprocess.run(args, check=True)
    print(out)


def line_items():
    out = []
    for l in plan["lines"]:
        out.append((os.path.join(VO, l["id"] + ".wav"), l["at"], SPACE[WHERE.get(l["id"], "가까이")]))
    return out


if __name__ == "__main__":
    base = line_items()
    for n in NARR:
        nv, bv = plan["variants"][f"n22_{n}"], plan["variants"][f"b22_{n}"]
        mix(base + [(os.path.join(VO, f"n22_{n}.wav"), nv["at"], "anull"), (os.path.join(VO, f"b22_{n}.wav"), bv["at"], "anull")],
            os.path.join(V, f"듣기_{n}.mp3"))
    # 내레이터 셋만 이어서: 끝 문구 → 0.6초 → 브랜드 이름, 사람 사이 1.5초
    items, t = [], 0.3
    for n in NARR:
        for key, gap in ((f"n22_{n}", 0.6), (f"b22_{n}", 1.5)):
            wav = os.path.join(VO, key + ".wav")
            d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                                     capture_output=True, text=True).stdout)
            items.append((wav, t, "anull"))
            t += d + gap
    mix(items, os.path.join(V, "내레이터_견줌.mp3"), total=round(t, 2))
