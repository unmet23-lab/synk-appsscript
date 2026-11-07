# 영상을 직접 보는 Gemini 맹검(2026-11-07, Claude) — xmas-neighbors-20261025/소리맹검.py와 같은 길(무료 키, 돈 안 나감)에 영상을 넣는다.
#   python -X utf8 영상맹검.py <지시문 파일> <영상.mp4> [--모델 gemini-3.6-flash] [--답 <답 파일>]
# 4분 넘는 편은 inline 한도(약 20MB) 안으로 640×360 · crf 33 · 소리 모노 64k로 줄여 보낸다 — Gemini는 화면을 1초 간격 대표 장으로 보니(현장노트 AI_CLI
# 「아르곤(웹)에 남의 광고 영상을 …」) 짧게 스치는 글자 · 물건 지적은 프레임으로 대조한 뒤 받는다. 키 값은 찍지 않는다.
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

KEY = open(os.path.join(os.path.expanduser("~"), "SYNK_보안", "제미나이_무료.txt"), encoding="utf-8").read().strip()


def small(path):
    tmp = os.path.join(tempfile.mkdtemp(prefix="영상맹검_"), "v.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vf", "scale=640:-2,fps=12", "-c:v", "libx264", "-crf", "33", "-preset", "medium",
                    "-c:a", "aac", "-ac", "1", "-b:a", "64k", "-movflags", "+faststart", tmp], check=True)
    return open(tmp, "rb").read()


def main():
    a = sys.argv[1:]
    model = a[a.index("--모델") + 1] if "--모델" in a else "gemini-3.6-flash"
    ans = a[a.index("--답") + 1] if "--답" in a else None
    skip = {i + 1 for i, x in enumerate(a) if x in ("--모델", "--답")}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in skip]
    prompt, video = open(pos[0], encoding="utf-8").read(), pos[1]
    data = small(video)
    print(f"보낼 영상 {len(data) / 1e6:.1f}MB", flush=True)
    body = {"contents": [{"role": "user", "parts": [{"inlineData": {"mimeType": "video/mp4", "data": base64.b64encode(data).decode()}}, {"text": prompt}]}]}
    for model_try in [model, "gemini-3.7-flash", "gemini-3.8-flash", "gemini-flash-latest"]:
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model_try}:generateContent?key={KEY}",
                                     data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                out = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"{model_try}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}", flush=True)
            continue
        except Exception as e:  # noqa: BLE001
            print(f"{model_try}: {type(e).__name__} {str(e)[:200]}", flush=True)
            continue
        cands = out.get("candidates") or []
        text = "".join(p.get("text", "") for c in cands for p in (c.get("content") or {}).get("parts", []))
        if not text.strip():
            print(f"{model_try}: 빈 답 — {json.dumps(out)[:300]}", flush=True)
            continue
        head = f"[{model_try} · {time.time() - t0:.0f}초 · 영상 {os.path.basename(video)}]\n\n"
        if ans:
            open(ans, "w", encoding="utf-8").write(head + text)
        print(head + text)
        return
    raise SystemExit("모든 모델이 실패")


if __name__ == "__main__":
    main()
