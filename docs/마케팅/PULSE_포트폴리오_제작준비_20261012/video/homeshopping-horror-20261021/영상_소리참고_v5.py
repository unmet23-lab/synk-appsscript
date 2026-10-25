# 콘티 v5 Seedance 소리 참고(2026-10-25) — 대사 컷마다 배역 목소리 줄(목소리/계획_v5.json → synk-vendor/…/목소리/vo_v5/<줄>.wav)을
# 지시문/영상_v5.json 「소리 참고」의 [줄, 클립 안 시작 초]대로 무음 위에 놓아 클립 길이만큼의 mp3로 만든다(원본 받아쓰기 시각 그대로).
#   python -X utf8 영상_소리참고_v5.py   → synk-vendor/…/영상/소리참고_v5/S02.mp3 …
# mp3로 만드는 까닭: 힉스필드 media_upload는 소리를 mp3 주소로 서명한다(현장노트 higgsfield 「MCP로 올린 참고 그림이 403·404로 막힌다」).
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
V = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/"
VO = V + "목소리/vo_v5/"
OUT = V + "영상/소리참고_v5/"


def build(clip):
    ref = clip["소리 참고"]
    dur = clip["길이"]
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=44100:cl=mono"]
    parts = []
    for i, (line, at) in enumerate(ref["줄"], start=1):
        cmd += ["-i", VO + line + ".wav"]
        ms = int(round(at * 1000))
        parts.append(f"[{i}]aresample=44100,aformat=channel_layouts=mono,adelay={ms}:all=1[a{i}]")
    n = len(ref["줄"])
    mix = "".join(f"[a{i}]" for i in range(1, n + 1))
    graph = ";".join(parts) + f";[0]{mix}amix=inputs={n + 1}:normalize=0:duration=first[m]"
    out = OUT + ref["파일"]
    cmd += ["-filter_complex", graph, "-map", "[m]", "-t", str(dur), "-c:a", "libmp3lame", "-b:a", "192k", out]
    subprocess.run(cmd, check=True)
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    spec = json.load(open(os.path.join(HERE, "지시문", "영상_v5.json"), encoding="utf-8"))
    for clip in spec["클립"]:
        if clip.get("소리 참고"):
            out = build(clip)
            d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
            print(clip["id"], os.path.basename(out), d + "초", " · ".join(f"{l}@{t}" for l, t in clip["소리 참고"]["줄"]))
