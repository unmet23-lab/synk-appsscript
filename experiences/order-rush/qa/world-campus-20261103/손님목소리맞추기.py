"""
주문 폭주 손님 목소리(2026-11-04) — 받은 소리를 게임 파일로 맞추고 잰다.

    python -I -X utf8 손님목소리맞추기.py [손님…]      (주지 않으면 받은 손님 전부)

하는 일: 앞뒤 무음을 줄이고(앞 0.04 · 뒤 0.18초 남김) 크기를 지금 주문 음성(−22.5 LUFS)에 맞춰 44.1kHz 모노 80kbps mp3로 낸다(제작 표시 없음).
받아쓰기(faster-whisper medium, CPU)로 주문 글과 견주고, 초당 음절 · 엉킨 프레임(tools/목소리엉킴.py) · 봉우리를 재서 기록한다.
나가는 것: assets/world/voice/<손님>/<주문>.mp3, 기록 qa/world-voices.json(시험이 읽는다 — qa는 공개본에 실리지 않는다).
받아쓰기가 0.95 아래이거나 엉킴 · 빠르기가 튀는 줄은 끝에 적는다 — 그 줄은 받음/에서 지우고 다시 굽는다.
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
뿌리 = 게임.parents[1]
작업 = Path(r"C:\Users\q1212\Documents\SYNK-appsscript") / ".tmp" / "order-rush-voices-20261104"
받음 = 작업 / "받음"
낼 = 게임 / "assets" / "world" / "voice"
기록파일 = 게임 / "qa" / "world-voices.json"
목표 = -22.5
CAST = json.loads((게임 / "qa" / "world-voice-cast.json").read_text(encoding="utf-8"))
줄들 = {x["id"]: x["text"] for x in json.loads((게임 / "qa" / "voice-bank.json").read_text(encoding="utf-8"))}
norm = lambda s: re.sub(r"[^가-힣0-9]", "", s)
# 숫자로 받아 적은 수량은 소리가 같다(「두 잔」 · 「2잔」)
수 = {"1": "한", "2": "두", "3": "세", "4": "네"}
# 받아쓰기가 표기만 달리 적는 말: 「라테」를 「라떼」로 적는다(소리는 같다)
소리말 = lambda s: re.sub(r"[1-4]", lambda m: 수[m[0]], s).replace("라떼", "라테")
TRIM = "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.18,areverse"


def 크기(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", str(p), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])


def 길이(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout)


def 맞추기(src, dst):
    tmp = dst.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", TRIM + ",afade=t=in:d=0.006,areverse,afade=t=in:d=0.02,areverse", "-ar", "44100", "-ac", "1", str(tmp)], check=True)
    gain, 결과 = 0.0, None
    for _ in range(3):  # mp3로 담으면 잰 값이 조금 달라져 한두 번 더 맞춘다
        limit = ",alimiter=limit=0.84:level=disabled" if gain else ""
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-map_metadata", "-1", "-af", f"volume={gain:.2f}dB{limit}", "-ar", "44100", "-ac", "1", "-b:a", "80k", str(dst)], check=True)
        결과 = 크기(dst)
        if abs(결과[0] - 목표) <= 0.15:
            break
        gain += 목표 - 결과[0]
    tmp.unlink()
    return 결과


def 엉킴표(파일들):
    r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(뿌리 / "tools" / "목소리엉킴.py"), *map(str, 파일들)], capture_output=True, text=True, encoding="utf-8")
    표 = {}
    for l in r.stdout.splitlines():
        m = re.search(r"([^\\/\s]+)[\\/]([^\\/\s]+)\.mp3\s+엉킨 프레임\s+([\d.]+)%.*최고 음높이\s*([\d.]+)Hz", l)
        if m:
            표[f"{m[1]}/{m[2]}"] = (float(m[3]), float(m[4]))
    return 표


def 저장(기록):
    기록["clips"] = dict(sorted(기록["clips"].items()))
    기록파일.write_text(json.dumps(기록, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main():
    고른 = sys.argv[1:] or [g for g in CAST if (받음 / g).exists()]
    기록 = json.loads(기록파일.read_text(encoding="utf-8")) if 기록파일.exists() else {"lufs": 목표, "guests": {}, "clips": {}}
    model = WhisperModel("medium", device="cpu", compute_type="int8")
    for g in 고른:
        c = CAST[g]
        기록["guests"][g] = {"voice": c["voice"], "engine": c["engine"], "tag": c.get("tag"), "speed": c.get("speed"), "name": c["name"]}
        (낼 / g).mkdir(parents=True, exist_ok=True)
        새파일 = []
        for oid, text in 줄들.items():
            src = 받음 / g / f"{oid}.mp3"
            if not src.exists():
                print("받은 줄 없음", g, oid)
                continue
            dst = 낼 / g / f"{oid}.mp3"
            key = f"{g}/{oid}"
            old = 기록["clips"].get(key)
            # 받은 파일이 그대로면 다시 재지 않는다
            if old and old.get("srcBytes") == src.stat().st_size and dst.exists():
                continue
            lufs, peak = 맞추기(src, dst)
            segs, _ = model.transcribe(str(dst), language="ko", beam_size=5, vad_filter=False)
            heard = " ".join(s.text.strip() for s in segs)
            match = round(difflib.SequenceMatcher(None, norm(text), 소리말(norm(heard)), autojunk=False).ratio(), 3)
            초 = round(길이(dst), 2)
            기록["clips"][key] = {"text": text, "seconds": 초, "syllablesPerSecond": round(len(norm(text)) / max(초, 0.1), 1), "lufs": lufs, "peak": peak, "bytes": dst.stat().st_size, "srcBytes": src.stat().st_size, "heard": heard, "match": match}
            새파일.append(dst)
            print(key, f"{초:5.2f}초 {lufs:6.1f} LUFS 봉우리 {peak:5.1f} 맞음 {match}  {heard}", flush=True)
        if 새파일:
            엉 = 엉킴표(새파일)
            for key, (rate, top) in 엉.items():
                if key in 기록["clips"]:
                    기록["clips"][key]["tangled"] = rate
                    기록["clips"][key]["topHz"] = top
        저장(기록)  # 손님마다 남긴다 — 받아쓰기는 CPU로 한 손님에 몇 분이라, 끊기면 그 손님부터 잇는다
    # 한 글자라도 다르면 적는다 — 주문 듣기에서는 낱말 하나가 답을 가른다(「차갑게」를 「차답게」로 들음). 둘째 귀는 node 손님목소리.mjs 둘째귀
    for v in 기록["clips"].values():
        v["match"] = round(difflib.SequenceMatcher(None, norm(v["text"]), 소리말(norm(v["heard"])), autojunk=False).ratio(), 3)
    저장(기록)
    나쁨 =[(k, v["match"], v["heard"]) for k, v in 기록["clips"].items() if v["match"] < 1]
    튐 = [(k, v.get("tangled"), v.get("topHz")) for k, v in 기록["clips"].items() if (v.get("tangled") or 0) > 12 or (v.get("topHz") or 0) > 560]
    빠름 = [(k, v["syllablesPerSecond"]) for k, v in 기록["clips"].items() if v["syllablesPerSecond"] > 5.6 or v["syllablesPerSecond"] < 2.8]
    print("받아쓰기가 다른 줄:", 나쁨 or "없음")
    print("엉킴 · 높은 음 튐:", 튐 or "없음")
    print("빠르기 튐:", 빠름 or "없음")
    print("합계", len(기록["clips"]), "개", round(sum(v["bytes"] for v in 기록["clips"].values()) / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
