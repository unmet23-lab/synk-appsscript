# 8번 캐스팅북 초반 말(2026-11-08, Claude) — 0~18.95초에 말 · 가사 · 화면 글이 하나도 없던 것을 고친다(02_콘티 9절 · 슬롭 점검표 30번).
#   원본은 4.2초부터 여자 목소리 가사 노래와 17.35초 주인공 혼잣말이 끌던 자리인데, 11-07 곡이 연주곡으로 바뀌며 그 층이 빠졌다.
#   제작 규칙 「소리」 · 10번 21절과 같은 길: 일레븐 v4로 원고 전체를 한 번에 굽고(줄마다 따로 굽지 않음) Scribe로 받아써 낱말 시각을 남긴다.
#   최종소리.py가 받아쓰기의 낱말 사이 가장 조용한 20ms에서 잘라 첫 낱말을 화면 초(NARR_AT)에 놓는다.
#   v4는 같은 글도 판마다 쉼이 달라(현장노트 영상 「오늘은 뒤 쉼이 0.08초로 붙기도」) 씨앗만 바꿔 여러 벌 굽고 쉼을 재서 고른다.
#   python -X utf8 내레이션_초반.py [이름 …]   → git 밖 최종/p8/소리/내레이션초반/<이름>.mp3 · <이름>_받아쓰기.json · _후보.json(글 · 값). 키 값은 찍지 않는다.
import json
import os
import sys
import urllib.error
import urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/소리/내레이션초반"
# 원고 — 결이 다른 여섯 판을 출처를 가려 Fable · Opus에게 아홉 기준으로 매기게 한 뒤(git 밖 최종/p8/_검수/원고맹검_1108/) 고친 판.
#   말하는 사람은 사장(소연)의 속말 — 여자 목소리(두 검수자 모두 「내레이터 3인칭 · 2인칭은 기관 PR · 홈쇼핑 말투」로 바닥).
#   줄 사이 「...」는 쉼 — 최종소리.py가 받아쓰기의 그 쉼에서 자른다.
TEXT_A = ("[quietly, to herself, a little bored] 거꾸로 봐도, 손님이 없네. ... ... [thinking, half to herself] 광고 모델 쓰면, 좀 오려나. ... ... "
          "[curious, quietly] 이 얼굴, 어디서 봤더라. ... ... [softly, a little envious] 저 집은 좋겠다. ... ... "
          "[surprised, amused] 우리 냉장고에도? ... ... [softly, realizing] 다들 이 얼굴 보고 오는구나.")
# B — 줄 안 쉼표를 뺀 판. A는 「거꾸로 봐도, …」 · 「광고 모델 쓰면, …」 · 「이 얼굴, …」의 쉼표에서 0.5~0.6초씩 쉬어 줄이 1.9~2.3초가 되고,
#   첫 두 줄이 4.1초 곡 들어오는 자리(원고 맹검이 말 없이 두라고 한 곳)를 넘었다(11-08 첫 굽기 — 넷 모두 4.6초까지)
TEXT_B = TEXT_A.replace("거꾸로 봐도, ", "거꾸로 봐도 ").replace("광고 모델 쓰면, ", "광고 모델 쓰면 ").replace("이 얼굴, ", "이 얼굴 ")
# C — 두 검수자의 고친 판에서 고른 줄(02_콘티 9절). 둘 다 「라」(모델 쓰면 좀 오려나 — 23.8 손님 말이 답하는 물음) 1위 · 속말 권함.
#   첫 줄은 둘 다 「다」의 「거꾸로 봐도 손님이 없네」, 둘째는 Fable(「광고」를 붙여 패션 · 데이팅 모델로 안 읽히게), 「어디서 봤더라」는 Opus 자리(쇼핑백 얼굴 직후 폰 얼굴),
#   「저 집은 좋겠다」는 Fable 새 줄(포스터 앞에 멈춘 사람들 — 그림이 못 하는 부러움), 끝은 Opus 새 줄 「얘면 손님 오겠다」
#   (오려나 → 오겠다 → 23.8 손님 「왔어요」 → 26.7 「부르는」으로 한 동사가 이어지고, 19.1 화면 글 「이 얼굴이다 싶으면」 앞에서 「이 얼굴」을 되풀이하지 않는다).
TEXT_C = ("[quietly, to herself, a little bored] 거꾸로 봐도 손님이 없네. ... ... [thinking, half to herself] 광고 모델 쓰면 좀 오려나. ... ... "
          "[curious, quietly] 어디서 봤더라. ... ... [softly, a little envious] 저 집은 좋겠다. ... ... "
          "[surprised, amused] 우리 냉장고에도? ... ... [softly, decided, a small smile] 얘면 손님 오겠다.")
SET = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": 1.0}
# 목소리 넷(공유 목소리 · 공지 기간 730일) — 30대 중반 사장의 속말로 들릴 결: 8번 손님 후보였던 수리(30대 대화체), 대화체 「한」(팟캐스트 결),
#   30대 서울 「수지」, 친구 같은 「칸나」. 같은 원고로 구워 같은 자리에 놓고 이름 가린 Gemini 소리 맹검으로 고른다.
VOICES = {
    "수리": "6yh8zsNIy3q3oI4ztsmm",   # Suri — 30s conversational
    "한": "8jHHF8rMqMlg8if2mOUe",     # Han — natural, casual, podcast-style
    "수지": "UqW1DivwFt1NwUMSGnTn",   # Suzie — composed woman in her 30s, standard Seoul
    "칸나": "5I7B1di44aCL15NkP0jn",   # Kanna — warm and friendly, like a close friend
}
TAKES = {f"{n}_A": (v, TEXT_A, SET, None) for n, v in VOICES.items()}   # 이름 → (목소리 id, 글, 설정, 씨앗)
TAKES.update({f"{n}_B": (v, TEXT_B, SET, None) for n, v in VOICES.items()})
TAKES.update({f"{n}_C": (v, TEXT_C, SET, None) for n, v in VOICES.items()})
# 목소리 — 넷을 같은 자리에 놓아 이름 가린 Gemini 소리 맹검을 순서를 바꿔 두 번(git 밖 최종/p8/_검수/속마음목소리_*): 두 번 다 칸나 1위(31 · 31), 수지 30 · 30, 한 26 · 29, 수리 27 · 26.
#   칸나_C는 첫 두 줄이 1.90 + 1.78초라 둘째 줄이 4.88초에 끝나 곡 첫 큰 박(4.56초)을 넘는다 → 씨앗만 바꾼 판(현장노트 영상 「판마다 쉼이 다르다」)과,
#   Fable이 맹검에서 대비책으로 적은 「광고」 뺀 판(Opus 고친 판의 줄)을 같이 구워 쉼 · 길이를 재서 고른다.
TEXT_D = TEXT_C.replace("광고 모델 쓰면", "모델 쓰면")
TAKES.update({f"칸나_C{s}": (VOICES["칸나"], TEXT_C, SET, s) for s in (11, 23)})
TAKES.update({f"칸나_D{s}": (VOICES["칸나"], TEXT_D, SET, s) for s in (11, 23, 37)})
# E — 「광고」 뺀 판(D)은 둘째 줄이 1.38~1.50초로 4.4초 안에 끝나지만, 맹검 1위 까닭이던 「얘면」 앞 작은 헛웃음(칸나_C — 쉼 1.38초 중 0.56초가 웃음 · 숨)이
#   D11 · D37엔 거의 없다(0.1초). 끝 줄 꼬리표에 작은 웃음을 적어 씨앗 셋으로 다시 굽는다. D23은 받아쓰기가 「예면」으로 들어 뺐다.
TEXT_E = TEXT_D.replace("[softly, decided, a small smile] 얘면 손님 오겠다.", "[a small chuckle, then softly decided] 얘면 손님 오겠다.")
TAKES.update({f"칸나_E{s}": (VOICES["칸나"], TEXT_E, SET, s) for s in (11, 23, 37)})


def scribe(key, name):
    """일레븐 Scribe로 받아써 낱말 시각을 <이름>_받아쓰기.json에"""
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
    key = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().split()[-1]
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(TAKES)
    log = {}
    for name in want:
        vid, text, settings, seed = TAKES[name]
        p = os.path.join(OUT, f"{name}.mp3")
        if os.path.exists(p):
            print("있음", p)
            if not os.path.exists(os.path.join(OUT, name + "_받아쓰기.json")):
                scribe(key, name)
            continue
        body = {"text": text, "model_id": "eleven_v4", "language_code": "ko", "voice_settings": settings}
        if seed is not None:
            body["seed"] = seed
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
        log[name] = {"voice_id": vid, "글": text, "설정": settings, "씨앗": seed, "값": cost, "바이트": len(data)}
        print(name, "→", p, "값", cost)
        scribe(key, name)
    old = os.path.join(OUT, "_후보.json")
    allv = json.load(open(old, encoding="utf-8")) if os.path.exists(old) else {}
    allv.update(log)
    json.dump(allv, open(old, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
