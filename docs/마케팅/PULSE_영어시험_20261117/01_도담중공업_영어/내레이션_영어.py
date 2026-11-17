# 도담중공업 영어 판 내레이션(2026-11-17, Claude) — PULSE 영어 시험 첫 편. 유호님 11-17 「권고대로」(결정 표 11-17).
#   한국어 판과 같은 방법(만족 사례 S49): 일레븐 v4로 원고 전체를 한 번에 굽고, 받아쓰기(Scribe) 낱말 시각으로 문장 사이 무음에서 잘라 같은 화면 자리에 놓는다.
#   목소리: 한국어 판의 아이작(8번에서 고르신 목소리)이 기본이고, 견줄 판으로 영어가 모국어인 목소리 둘(조지 · 브라이언)을 함께 굽는다.
#   원고는 한국어 판 아홉 줄의 뜻과 자리를 지키고 귀로 듣는 영어로 썼다. 「아이」 비유는 50.5초까지 아낀다(25.5초 아기 표지 → 「all grown up」 → 「our baby」).
#   python -X utf8 내레이션_영어.py [이름…]   → git 밖 최종/p10_en/소리/내레이션/<이름>.mp3 · <이름>_받아쓰기.json · _후보.json. 키 값은 찍지 않는다.
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10_en/소리/내레이션"

# 화면 자리(한국어 판과 같다): 1.70 · 9.60 · 16.60 · 21.80 · 28.90 · 35.80 · 49.20 · 50.50 · 56.08초
TEXT = ("[warm, calm, intimate] When it's fully grown, it'll weigh three hundred tons. ... ... "
        "We fitted every blade, by hand. ... ... "
        "Not one bolt went unchecked. ... ... "
        "For three years, we looked in on it, every day. ... ... "
        "[softly, quietly proud] It's all grown up. ... ... "
        "[quiet, hopeful] Now, for the first time, we wake it. ... ... "
        "[proud, gentle] Today, ... we send our baby out into the world. ... ... "
        "[warm, hopeful] Wherever it goes, ... it'll keep turning.")

VOICES = {
    "아이작": "8yI73tA9sY25UYpFjsgD",   # Isaac — 한국어 판 내레이터(결정 표 11-17 「같은 아이작 목소리」)
    "조지": "JBFqnCBsd6RMkjVDRZzb",     # George — warm British storyteller(견줄 판)
    "브라이언": "nPczCjzI2devNBz1zQrb",  # Brian — deep American narration(견줄 판)
}
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": 1.0}


def key():
    return open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().split()[-1]


def scribe(k, name):
    """일레븐 Scribe(영어)로 받아써 낱말 시각을 <이름>_받아쓰기.json에"""
    data = open(os.path.join(OUT, name + ".mp3"), "rb").read()
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"model_id\"\r\n\r\nscribe_v1\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"language_code\"\r\n\r\neng\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"timestamps_granularity\"\r\n\r\nword\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n").encode() + data + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, method="POST",
                                 headers={"xi-api-key": k, "Content-Type": f"multipart/form-data; boundary={b}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read())
    json.dump(j, open(os.path.join(OUT, name + "_받아쓰기.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    words = [w for w in j.get("words", []) if w.get("type") == "word"]
    print(name, "|", j.get("text", "").strip())
    print("   ", " ".join(f"{w['text']}({w['start']:.2f}-{w['end']:.2f})" for w in words))


def main(names):
    k = key()
    os.makedirs(OUT, exist_ok=True)
    log = {}
    for name in names:
        vid = VOICES[name]
        p = os.path.join(OUT, f"{name}.mp3")
        if os.path.exists(p):
            print("있음", p)
            if not os.path.exists(os.path.join(OUT, name + "_받아쓰기.json")):
                scribe(k, name)
            continue
        body = {"text": TEXT, "model_id": "eleven_v4", "voice_settings": SETTINGS}
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192", method="POST",
                                     data=json.dumps(body).encode(), headers={"xi-api-key": k, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                cost = r.headers.get("character-cost")
        except urllib.error.HTTPError as e:
            print(name, "HTTP", e.code, e.read()[:300])
            continue
        open(p, "wb").write(data)
        log[name] = {"voice_id": vid, "글": TEXT, "설정": SETTINGS, "값": cost, "바이트": len(data)}
        print(name, "→", p, "값", cost)
        scribe(k, name)
    old = os.path.join(OUT, "_후보.json")
    allv = json.load(open(old, encoding="utf-8")) if os.path.exists(old) else {}
    allv.update(log)
    json.dump(allv, open(old, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:] or list(VOICES))
