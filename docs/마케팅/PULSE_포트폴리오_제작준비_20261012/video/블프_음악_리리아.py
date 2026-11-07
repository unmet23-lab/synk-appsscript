# 블프 두 편 곡(2026-11-07, Claude) — Suno · 일레븐 웹이 ego 프로필 바뀜(11-07 새벽)으로 둘 다 로그아웃이라, 무료 Gemini 키 목록에 있는 Lyria(음악 모델)로 곡 후보를 굽는다.
# 무료 키(~/SYNK_보안/제미나이_무료.txt)만 쓰고 결제 · 유료 키는 쓰지 않는다. 키 값은 찍지 않는다.
#   python -X utf8 블프_음악_리리아.py <s3|s4> [<모델>] [<벌 수>]   → git 밖 최종/음악/블프_1107/리리아_<편>_<모델>_<n>.<확장자> · 기록 .json
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/음악/블프_1107"
PROMPTS = {
    # 세일 15초 — 02_콘티 4절: 분당 128박 안팎 밝은 전자 음악, 처음부터 끝까지 쉬지 않고 크기가 고르다, 말 밑에 깔림
    "s3": ("Instrumental only, no vocals, no lyrics, no voice. A bright, punchy electro-pop dance track for a 15-second Black Friday sportswear sale commercial "
           "set in a neon spin-class studio. 128 BPM, 4/4, four-on-the-floor kick from the very first beat, tight claps on 2 and 4, bright synth stabs, "
           "a bouncy sidechained bass and short sparkling arpeggios. Full energy from the first second to the end, no intro, no breakdown, no fade, "
           "steady loudness the whole way so a voice-over can sit on top. Modern, clean, expensive-sounding K-pop style production, upbeat and exciting."),
    # 스나이퍼 30초 — 02_콘티 3절: 1초부터 쉬지 않는 훈련 몽타주, 작전물 · 신스 북, 가사 없음, 조금씩 커져 26초 정점
    "s4": ("Instrumental only, no vocals, no lyrics, no voice. An over-the-top, tongue-in-cheek 1980s action-movie training montage cue for a deadpan comedy commercial "
           "about a dad training like a military sniper for a midnight online sale. 118 BPM, 4/4. It starts right away with a driving synth-bass ostinato and a tight "
           "military snare pattern, then keeps building for 26 seconds without a break: heroic analog brass-synth stabs, big gated drums, rising toms and a "
           "triumphant synth lead, getting steadily bigger and more epic, reaching its biggest, most triumphant peak at about 26 seconds. Serious and heroic on the "
           "surface, slightly cheesy, no comedy sound effects."),
}


def main():
    piece = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "lyria-3.5"
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    key = open(os.path.expanduser("~/SYNK_보안/제미나이_무료.txt"), encoding="utf-8").read().strip().split()[-1]
    os.makedirs(OUT, exist_ok=True)
    for k in range(1, n + 1):
        body = {"contents": [{"role": "user", "parts": [{"text": PROMPTS[piece]}]}]}
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", method="POST", data=json.dumps(body).encode(),
                                     headers={"x-goog-api-key": key, "Content-Type": "application/json"})
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                j = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"{piece} {model} #{k}: HTTP {e.code} {e.read()[:400]!r}")
            return
        parts = [p for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", [])]
        saved = []
        for i, p in enumerate(parts):
            d = p.get("inlineData") or p.get("inline_data")
            if d:
                ext = {"audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/L16": "pcm"}.get(d.get("mimeType", ""), "bin")
                path = os.path.join(OUT, f"리리아_{piece}_{model}_{k}{'_' + str(i) if i else ''}.{ext}")
                open(path, "wb").write(base64.b64decode(d["data"]))
                saved.append((path, d.get("mimeType")))
            elif p.get("text"):
                print("  글:", p["text"][:300].replace("\n", " "))
        json.dump({"모델": model, "편": piece, "지시문": PROMPTS[piece], "받음": saved, "쓰임": j.get("usageMetadata"), "초": round(time.time() - t0, 1)},
                  open(os.path.join(OUT, f"리리아_{piece}_{model}_{k}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{piece} {model} #{k}: {time.time() - t0:.0f}초 · {saved}")


if __name__ == "__main__":
    main()
