# 영상(mp4) · 소리를 Gemini 무료 키에 직접 보여 · 들려 묻는다(2026-11-07 4번 패션 필름 때 Claude가 만듦 — 11-08 4번 기각 · 지움 때 이 공용 폴더로 옮김). 블프_소리듣기.py와 같은 길(inlineData, 키 값은 찍지 않음).
#   「사람이 살아 움직이나」를 물을 때는 --fps 8(초당 8장) — 기본(초당 1장쯤)은 깜빡임을 못 본다(슬롭 점검표 5-2).
#   python -X utf8 제미나이보기.py <질문.txt> <파일…> [--모델 gemini-3.6-flash,gemini-3.8-flash,…] [-o 답.md]
#   mp4는 영상 그대로(20MB 아래 — 폰 판), wav · mp3는 소리(mp3로 바꿔 보냄). 모델은 차례로 — 429(무료 몫) · 503(혼잡)이면 다음 모델.
# 현장노트 AI_CLI 「소리를 들려 맹검할 때 …」: 3.6 Flash 몫(하루 20)이 세션 공용이라 금방 찬다 — Lite 한 번 답으로 크게 바꾸지 않는다.
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

CHAIN = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]


def mp3(path):
    if path.lower().endswith(".mp3"):
        return open(path, "rb").read()
    tmp = tempfile.mktemp(suffix=".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-ac", "2", "-ar", "44100", "-b:a", "192k", tmp], check=True)
    b = open(tmp, "rb").read()
    os.remove(tmp)
    return b


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    models, out = CHAIN, None
    if "--모델" in a:
        i = a.index("--모델"); models = a[i + 1].split(","); del a[i:i + 2]
    if "-o" in a:
        i = a.index("-o"); out = a[i + 1]; del a[i:i + 2]
    fps = None   # 기본은 Gemini가 영상을 1초에 한 장쯤 본다 — 눈 깜빡임 · 숨 같은 작은 움직임을 보려면 --fps 8(11-07 「살아 움직이나」 심사)
    if "--fps" in a:
        i = a.index("--fps"); fps = float(a[i + 1]); del a[i:i + 2]
    q, files = open(a[0], encoding="utf-8").read(), a[1:]
    key = open(os.path.expanduser("~/SYNK_보안/제미나이_무료.txt"), encoding="utf-8").read().strip().split()[-1]
    parts = [{"text": q}]
    for k, f in enumerate(files, 1):
        if f.lower().endswith(".mp4"):
            data = open(f, "rb").read()
            if len(data) > 19 * 1024 * 1024:
                raise SystemExit(f"{f}: {len(data) / 1e6:.1f}MB — 20MB 아래 판(폰 판)을 쓴다")
            parts.append({"text": f"[영상 {k}]"})
            part = {"inlineData": {"mimeType": "video/mp4", "data": base64.b64encode(data).decode()}}
            if fps:
                part["videoMetadata"] = {"fps": fps}
            parts.append(part)
        else:
            parts.append({"text": f"[소리 {k}]"})
            parts.append({"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3(f)).decode()}})
    body = json.dumps({"contents": [{"role": "user", "parts": parts}]}).encode()
    for model in models:
        t0 = time.time()
        for attempt in range(2):
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", method="POST", data=body,
                                         headers={"x-goog-api-key": key, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=900) as r:
                    j = json.loads(r.read())
            except urllib.error.HTTPError as e:
                print(f"{model}: HTTP {e.code} {e.read()[:160]!r}", flush=True)
                if e.code == 503 and attempt == 0:
                    time.sleep(30)
                    continue
                j = None
            except Exception as e:   # 시간 초과 등
                print(f"{model}: {e}", flush=True)
                j = None
            break
        if not j:
            continue
        text = "".join(p.get("text", "") for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", []))
        if not text.strip():
            print(f"{model}: 빈 답 — 다음 모델", flush=True)
            continue
        print(f"[{model} · {time.time() - t0:.0f}초 · {j.get('usageMetadata', {}).get('totalTokenCount')}토큰]")
        print(text)
        if out:
            open(out, "w", encoding="utf-8").write(f"모델 {model}\n파일 {[os.path.basename(f) for f in files]}\n\n{text}\n")
        return
    raise SystemExit("모든 모델이 막혔다")


if __name__ == "__main__":
    main()
