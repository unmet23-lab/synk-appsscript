# 옆집의 크리스마스 곡(2026-11-07, Claude) — Gemini API 무료 키의 음악 모델(Lyria)로 가사 없는 연주곡을 굽는다.
#   python -X utf8 곡굽기.py <모델> <이름> [--글 <지시문 파일>]   → git 밖 pulse-portfolio12-20261024/최종/s1/소리/곡_리리아/<이름>.<확장자> + <이름>.json(답 머리)
# 일레븐 음악 · Suno는 ego 로그인이 풀려 있어(11-07) 로그인 없이 되는 길로 먼저 굽는다. 무료 키라 돈이 나가지 않는다(키 값은 찍지 않는다).
# 곡 짜임은 02_콘티 4절 — 피아노 하나가 0.3초에 낮게 들어와 끝까지 → 35.4~36.35 숨 → 현악 → 43.6~46.5 1차 고조 → 47~51.5 피아노로 잦아듦 →
# 53~57 오케스트라 2차 절정 → 59.4 끝. 받은 곡은 크기 곡선을 재서 그 자리에 맞춰 편집한다(곡편집 — 소리.py가 곡.wav를 깐다).
import base64, json, os, sys, time, urllib.request

KEY = open(os.path.join(os.path.expanduser("~"), "SYNK_보안", "제미나이_무료.txt"), encoding="utf-8").read().strip()
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1/소리/곡_리리아"
PROMPT = """Instrumental only, no vocals, no choir words. A tender, intimate cinematic score for a one-minute Christmas brand film about two lonely neighbours in an old apartment corridor — warm, hopeful, restrained, never sugary.
Exactly 60 seconds long, in this order:
0:00–0:35 — a single solo felt piano, soft and sparse, slow (about 66 BPM), a simple lyrical melody in a major key with gentle sustained chords; very quiet and close, like a late-autumn night alone.
0:35–0:36 — the piano pauses for one breath: almost silence.
0:36–0:43 — soft warm strings enter under the piano, a little fuller.
0:43–0:47 — a first warm swell: strings and piano rise together, hopeful.
0:47–0:52 — it settles back to quiet solo piano, very soft.
0:53–0:57 — the emotional climax: full warm orchestra (strings, soft french horns, gentle timpani roll, glockenspiel sparkle), big but tender.
0:57–1:00 — it resolves into one last quiet piano chord that rings out and fades to silence by 0:59.
No drums, no beat, no synths, no sleigh bells, no electronic sounds."""


def main():
    model, name = sys.argv[1], sys.argv[2]
    text = PROMPT
    if "--글" in sys.argv:
        text = open(sys.argv[sys.argv.index("--글") + 1], encoding="utf-8").read()
    os.makedirs(OUT, exist_ok=True)
    body = {"contents": [{"role": "user", "parts": [{"text": text}]}]}
    if "--소리만" in sys.argv:
        body["generationConfig"] = {"responseModalities": ["AUDIO"]}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}",
                                 data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            j = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read()[:800].decode("utf-8", "replace"))
        return
    meta = {"모델": model, "걸린초": round(time.time() - t0, 1), "부분": []}
    k = 0
    for c in j.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "inlineData" in p:
                mime = p["inlineData"].get("mimeType", "")
                ext = {"audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/L16": "pcm"}.get(mime.split(";")[0], "bin")
                path = os.path.join(OUT, f"{name}{'' if k == 0 else f'_{k}'}.{ext}")
                open(path, "wb").write(base64.b64decode(p["inlineData"]["data"]))
                meta["부분"].append({"mime": mime, "파일": os.path.basename(path), "바이트": os.path.getsize(path)})
                k += 1
            elif "text" in p:
                meta["부분"].append({"글": p["text"][:600]})
    meta["쓴것"] = j.get("usageMetadata")
    json.dump(meta, open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(meta, ensure_ascii=False)[:1200])


if __name__ == "__main__":
    main()
