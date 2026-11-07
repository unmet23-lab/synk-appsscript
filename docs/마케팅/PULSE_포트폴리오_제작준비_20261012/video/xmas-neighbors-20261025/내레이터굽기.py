# 옆집 끝 내레이션 「옆집까지, 늘 켜 둡니다. 늘켬.」 — 일레븐 v4 공식 API(2026-11-07, Claude)
#   python -X utf8 내레이터굽기.py [이름 …]   → git 밖 pulse-portfolio12-20261024/최종/s1/소리/내레이터_일레븐/<이름>-<n>.mp3
# 시댄스 목소리 판 두 벌이 브랜드를 「늘큼」으로 읽었다(위스퍼 medium · 일레븐 스크라이브 둘 다) — 브랜드 이름이 틀린 판은 못 쓴다.
# 내레이션은 제작 규칙 「소리」대로 일레븐 v4(차분한 내레이션 — 결정 10-29). 한국어 공유 목소리를 더해 굽고 값은 머리글 character-cost로 읽는다(현장노트 영상).
import json, os, sys, urllib.request

KEY = open(os.path.join(os.path.expanduser("~"), "SYNK_보안", "elevenlabs.txt"), encoding="utf-8").read().strip()
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s1/소리/내레이터_일레븐"
TEXT = "[warm, gentle] 옆집까지, 늘 켜 둡니다. 늘켬."
VOICES = {   # 이름: (공유 목록 주인, 목소리) — el_shared_ko_young(11-04 주문 폭주 조사)의 「차분한 서울 여성 내레이터」
    "Elara": ("2d4b43166c1bef8c76cab7faf0952c6de478c8fa21ceb0f51c1aa0f8a55dc371", "KqpuJjfj0v99fo4RUJwg"),
    "Kyung": ("ee0dc6e2b0a4dd57e76f754ca612f3bef60b81f671594f0ecdccc5d2bbaa9659", "JQaWvPoEUkcuOTfxFYpJ"),
    "Jjeong": ("46690075fe372839d90823189a7122a6c3c6ff7bdc9573eeab12bf9ec7ecafbd", "DMkRitQrfpiddSQT5adl"),
    "Ohana": ("f6ef6d80d9b16e1581511deed9319392b71d895888f535f148584d39d141c2b7", "0IhKyLYnD1w7n6ZVziN1"),
}


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST",
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(), dict(r.headers)


# 11-07 소리 맹검 2~4차가 끝 브랜드를 「늘켜 · 늘겸 · 늘켜짐」으로 들음(위스퍼는 넷 다 「늘 켬」) — 받침 ㅁ이 약하다.
# 고른 Elara로 받침을 또렷이 하는 글 셋을 두 벌씩 더 굽는다: python -X utf8 내레이터굽기.py --받침
CLEAR = {
    "Elara-또렷": "[warm, gentle] 옆집까지, 늘 켜 둡니다. [clearly] 늘켬.",
    "Elara-쉼": "[warm, gentle] 옆집까지, 늘 켜 둡니다. 늘, 켬.",
    "Elara-천천히": "[warm, gentle] 옆집까지, 늘 켜 둡니다. [slowly, clearly] 늘켬.",
}


def clear_takes():
    os.makedirs(OUT, exist_ok=True)
    vid = VOICES["Elara"][1]
    total = 0
    for name, text in CLEAR.items():
        for k in (1, 2):
            data, head = post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192",
                              {"text": text, "model_id": "eleven_v4", "language_code": "ko", "voice_settings": {"stability": 0.5}})
            p = os.path.join(OUT, f"{name}-{k}.mp3")
            open(p, "wb").write(data)
            cost = int(head.get("character-cost") or head.get("Character-Cost") or 0)
            total += cost
            print(name, k, len(data), "크레딧", cost, flush=True)
    print("합", total)


def main():
    os.makedirs(OUT, exist_ok=True)
    if sys.argv[1:] == ["--받침"]:
        return clear_takes()
    names = sys.argv[1:] or list(VOICES)
    total = 0
    for name in names:
        owner, vid = VOICES[name]
        try:
            post(f"https://api.elevenlabs.io/v1/voices/add/{owner}/{vid}", {"new_name": f"s1 {name}"})
        except Exception as e:   # 이미 더한 목소리면 오류 — 그대로 굽는다
            print("더하기", name, str(e)[:80])
        for k in (1, 2):
            data, head = post(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192",
                              {"text": TEXT, "model_id": "eleven_v4", "language_code": "ko", "voice_settings": {"stability": 0.5}})
            p = os.path.join(OUT, f"{name}-{k}.mp3")
            open(p, "wb").write(data)
            cost = int(head.get("character-cost") or head.get("Character-Cost") or 0)
            total += cost
            print(name, k, len(data), "크레딧", cost, flush=True)
    print("합", total)


if __name__ == "__main__":
    main()
