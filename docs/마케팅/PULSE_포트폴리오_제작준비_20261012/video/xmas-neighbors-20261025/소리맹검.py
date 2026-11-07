# 소리를 직접 듣는 Gemini 맹검(2026-11-07, Claude) — 현장노트 AI_CLI 「소리를 들려 맹검할 때 … gemini-3.6-flash가 mp3를 직접 들었다」의 길.
#   python -X utf8 소리맹검.py <지시문 파일> <소리 파일…> [--모델 gemini-3.6-flash] [--답 <답 파일>]
# 무료 키(~/SYNK_보안/제미나이_무료.txt)로 mp3를 inlineData로 넣는다 — 돈이 나가지 않는다. 키 값은 찍지 않는다.
# 파일 이름은 「소리 1」 「소리 2」…로만 알린다(맹검). 목소리 결 판단은 반만 믿는다(같은 노트 — 여성 목소리를 40대 남성으로 적은 적 있음).
import base64, json, os, subprocess, sys, tempfile, time, urllib.request

KEY = open(os.path.join(os.path.expanduser("~"), "SYNK_보안", "제미나이_무료.txt"), encoding="utf-8").read().strip()


def mp3(path):
    tmp = os.path.join(tempfile.mkdtemp(prefix="맹검_"), "a.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vn", "-ac", "2", "-ar", "44100", "-b:a", "160k", tmp], check=True)
    return open(tmp, "rb").read()


def main():
    a = sys.argv[1:]
    model = a[a.index("--모델") + 1] if "--모델" in a else "gemini-3.6-flash"
    ans = a[a.index("--답") + 1] if "--답" in a else None
    skip = {i + 1 for i, x in enumerate(a) if x in ("--모델", "--답")}
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and i not in skip]
    prompt, files = open(pos[0], encoding="utf-8").read(), pos[1:]
    parts = [{"text": prompt}]
    for k, f in enumerate(files, 1):
        parts.append({"text": f"소리 {k}:"})
        parts.append({"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3(f)).decode()}})
    body = {"contents": [{"role": "user", "parts": parts}]}
    for model_try in [model, "gemini-3.7-flash", "gemini-3.8-flash", "gemini-flash-latest"]:
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model_try}:generateContent?key={KEY}",
                                     data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                j = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(model_try, "HTTP", e.code, e.read()[:300].decode("utf-8", "replace"), flush=True)
            continue
        text = "".join(p.get("text", "") for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", []))
        if not text.strip():   # 11-07 넷째 청취가 99초 뒤 본문 없이 끝남 — 빈 답은 버리고 다음 모델로
            why = [c.get("finishReason") for c in j.get("candidates", [])] or j.get("promptFeedback")
            print(model_try, "빈 답", why, flush=True)
            continue
        out = f"[{model_try} · {time.time() - t0:.0f}초 · 소리 {len(files)}개]\n" + "\n".join(f"소리 {k}: {os.path.basename(f)}" for k, f in enumerate(files, 1)) + "\n\n" + text
        if ans:
            open(ans, "w", encoding="utf-8").write(out)
        print(out)
        return
    print("모든 모델이 막힘")


if __name__ == "__main__":
    main()
