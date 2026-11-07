# 10번 도담중공업 내레이션 후보(2026-11-08, Claude) — 유호님 「전체적으로 음질이 너무 안좋아. 목소리도 기업느낌으로 희망적인 느낌이어야할것같아」.
#   지금 내레이션은 시댄스 판 셋이 낸 준호 목소리를 BS-RoFormer · Demucs로 뗀 것이라 뗀 자국이 남는다 → 일레븐 v4로 새로 굽는다.
#   제작 규칙 「소리」 · 메모: 광고 내레이션은 일레븐 v4, 전체 대본을 한 번에 이어 읽게 굽고(줄마다 따로 굽지 않음) 쉼표 · 말줄임으로 입말 호흡,
#   꼬리표는 큰 덩이에만. 목소리는 8번이 11-07에 고른 아이작과 같은 묶음(공유 목소리 · 공지 기간 730일 한국어 남자, 광고 · 다큐 결)에서 넷 — 들어 보고 고른다.
#   python -X utf8 내레이션_후보.py   → git 밖 최종/p10/소리/내레이션후보/<이름>.mp3 · _후보.json(글 · 값). 키 값은 찍지 않는다.
import json
import os
import urllib.error
import urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p10/소리/내레이션후보"
# 화면 자리: 40.1초 「한 대를 …」 · 42.5초 「볼트 …」 / 48.8초 「오늘은,」 · 50.4초 「이 아이를 보냅니다.」 / 56.1초 「어디서든,」 · 57.2초 「잘 돌아갑니다.」
TEXT = ("[warm, hopeful, confident] 한 대를 만드는 데, 삼 년. ... 볼트 하나도, 그냥 넘어가지 않았습니다. ... ... "
        "[proud, gentle] 오늘은, ... 이 아이를 보냅니다. ... ... [warm, hopeful] 어디서든, ... 잘 돌아갑니다.")
# 11-08 3차 — 유호님 「초반이 너무 나레이션도없고 그냥 영상만 나와서 심심하고 맹해. 이거 초반에 나레이션이든 자막이든 cg든 넣어줘야할것같아」.
#   원본은 0~40초를 가사 있는 노래가 끌었는데 연주곡으로 바꾸며 그 층이 빠졌다 → 이야기를 내레이션이 맡는다(02_콘티 21절).
#   여섯 판을 출처를 가려 Fable · Opus에 매겨(둘 다 「가」 1위 — 「아이」를 50초까지 아끼고 「다 컸습니다」로 받는 판) 두 고친 판에서 줄을 골랐다.
#   「한 대를 만드는 데, 삼 년」은 뺐다(삼 년은 21.8초 줄로, 40초 줄이 44초 첫 시동 소리를 덮지 않게).  python -X utf8 내레이션_후보.py --초반
TEXT_OPEN = ("[warm, calm, intimate] 이게 다 크면, 삼백 톤 나갑니다. ... ... 날개는 한 장씩, 손으로 달아 줬습니다. ... ... "
             "볼트 하나도, 그냥 넘긴 적 없습니다. ... ... 삼 년을, 매일 들여다봤습니다. ... ... [softly, quietly proud] 다 컸습니다. ... ... "
             "[quiet, hopeful] 이제, 처음으로 깨워 봅니다. ... ... [proud, gentle] 오늘은, ... 이 아이를 보냅니다. ... ... [warm, hopeful] 어디서든, ... 잘 돌아갑니다.")
VOICES = {
    "아이작": "8yI73tA9sY25UYpFjsgD",   # Isaac — warm documentary, early 30s, Seoul(8번 내레이터, 11-07 유호님 「추천대로」)
    "애셔": "t8OZfrGCqTBbi7c8Gn5J",     # Asher — warm storyteller
    "헨리": "0emXFRrt8HxjqJpgeQtr",     # Henry — friendly & bright
    "에스엠": "HcMLbdbsDrYk09bKNfCf",   # SM — social media · ads
}
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": 1.0}
# 11-08 2차 — 영상 안에서 들은 아르곤이 두 번 다 「낮고 가라앉아 쓸쓸 · 처짐」(이름 가린 Gemini 맹검은 아이작 희망 9.5)이라, 같은 아이작으로 더 밝게 읽힌 판 둘:
#   긴 말줄임(…)을 빼 처지는 쉼을 줄이고, 꼬리표를 확신 · 희망 쪽으로, 빠르기를 조금 올림.  python -X utf8 내레이션_후보.py --밝게
BRIGHT = {
    "아이작_밝게": ("8yI73tA9sY25UYpFjsgD",
                "[confident, warm, uplifting] 한 대를 만드는 데, 삼 년. 볼트 하나도, 그냥 넘어가지 않았습니다. "
                "[proud, hopeful] 오늘은, 이 아이를 보냅니다. [bright, confident] 어디서든, 잘 돌아갑니다.",
                {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True, "speed": 1.05}),
    "아이작_힘있게": ("8yI73tA9sY25UYpFjsgD",
                 "[energetic, confident, inspiring] 한 대를 만드는 데, 삼 년. 볼트 하나도, 그냥 넘어가지 않았습니다. "
                 "[proud, warm] 오늘은, 이 아이를 보냅니다. [confident, hopeful] 어디서든, 잘 돌아갑니다.",
                 {"stability": 0.4, "similarity_boost": 0.8, "style": 0.45, "use_speaker_boost": True, "speed": 1.08}),
}


def scribe(key, name):
    """일레븐 Scribe로 받아써 낱말 시각을 <이름>_받아쓰기.json에 — 최종소리.py가 자를 자리 · 놓을 자리 · 자막 시각을 여기서 읽는다"""
    import uuid
    data = open(os.path.join(OUT, name + ".mp3"), "rb").read()
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"model_id\"\r\n\r\nscribe_v1\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"language_code\"\r\n\r\nkor\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"timestamps_granularity\"\r\n\r\nword\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n").encode() + data + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, method="POST",
                                 headers={"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={b}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read())
    json.dump(j, open(os.path.join(OUT, name + "_받아쓰기.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    words = [w for w in j.get("words", []) if w.get("type") == "word"]
    print(name, "|", j.get("text", "").strip())
    print("   ", " ".join(f"{w['text']}({w['start']:.2f}-{w['end']:.2f})" for w in words))


def main():
    import sys
    key = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().split()[-1]
    os.makedirs(OUT, exist_ok=True)
    log = {}
    if "--밝게" in sys.argv:
        takes = BRIGHT
    elif "--초반" in sys.argv:
        takes = {n + "_초반": (v, TEXT_OPEN, SETTINGS) for n, v in VOICES.items()}
    else:
        takes = {n: (v, TEXT, SETTINGS) for n, v in VOICES.items()}
    for name, (vid, text, settings) in takes.items():
        p = os.path.join(OUT, f"{name}.mp3")
        if os.path.exists(p):
            print("있음", p)
            if not os.path.exists(os.path.join(OUT, name + "_받아쓰기.json")):
                scribe(key, name)
            continue
        body = {"text": text, "model_id": "eleven_v4", "voice_settings": settings}
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192", method="POST", data=json.dumps(body).encode(),
                                     headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                cost = r.headers.get("character-cost")
        except urllib.error.HTTPError as e:
            print(name, "HTTP", e.code, e.read()[:300])
            continue
        open(p, "wb").write(data)
        log[name] = {"voice_id": vid, "글": text, "설정": settings, "값": cost, "바이트": len(data)}
        print(name, "→", p, "값", cost)
        scribe(key, name)
    old = os.path.join(OUT, "_후보.json")
    allv = json.load(open(old, encoding="utf-8")) if os.path.exists(old) else {}
    allv.update(log)
    json.dump(allv, open(old, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
