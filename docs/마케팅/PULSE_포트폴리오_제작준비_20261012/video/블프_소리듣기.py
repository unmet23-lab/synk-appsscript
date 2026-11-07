# 블프 두 편 — 소리를 Gemini에 직접 들려 묻는다(2026-11-07). 현장노트 AI_CLI 「소리를 들려 맹검할 때 … gemini-3.6-flash가 mp3를 직접 들었다」와 같은 길(무료 키, inlineData).
#   python -X utf8 블프_소리듣기.py <질문 파일(.txt)> <소리 파일…> [--모델 gemini-3.6-flash] [-o 답.md]
# 아르곤 웹은 영상의 소리를 못 듣는다(같은 절). 키 값은 찍지 않는다. 목소리 결(나이 · 성별) 판단은 반만 믿는다(같은 절).
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request


def mp3(path):
    if path.lower().endswith(".mp3"):
        return open(path, "rb").read()
    tmp = tempfile.mktemp(suffix=".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-ac", "2", "-ar", "44100", "-b:a", "192k", tmp], check=True)
    b = open(tmp, "rb").read()
    os.remove(tmp)
    return b


def main():
    a = sys.argv[1:]
    model, out = "gemini-3.6-flash", None
    if "--모델" in a:
        i = a.index("--모델"); model = a[i + 1]; del a[i:i + 2]
    if "-o" in a:
        i = a.index("-o"); out = a[i + 1]; del a[i:i + 2]
    q, files = open(a[0], encoding="utf-8").read(), a[1:]
    key = open(os.path.expanduser("~/SYNK_보안/제미나이_무료.txt"), encoding="utf-8").read().strip().split()[-1]
    parts = [{"text": q}]
    for k, f in enumerate(files, 1):
        parts.append({"text": f"[소리 {k}]"})
        parts.append({"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3(f)).decode()}})
    body = {"contents": [{"role": "user", "parts": parts}]}
    t0 = time.time()
    for attempt in range(3):
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", method="POST", data=json.dumps(body).encode(),
                                     headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                j = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            print(f"HTTP {e.code} {msg!r}")
            if e.code in (429, 500, 503) and attempt < 2:
                time.sleep(20)
                continue
            sys.exit(1)
    text = "".join(p.get("text", "") for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", []))
    print(f"[{model} · {time.time() - t0:.0f}초 · {j.get('usageMetadata', {}).get('totalTokenCount')}토큰]")
    print(text)
    if out:
        open(out, "w", encoding="utf-8").write(f"모델 {model}\n파일 {files}\n\n{text}\n")


if __name__ == "__main__":
    main()
