# 8번 목소리 후보(2026-11-07, Claude — 최종 편집) — 유호님이 들어 보고 고르시는 두 자리(콘티 1절 · 5절 1).
#   ① 내레이션 「손님을 부르는 모델, 펄스 캐스팅북에서.」 — 원본처럼 남자 목소리 하나(콘티는 10-26에 타입캐스트 범수로 적었으나,
#      10-29 결정 「광고 내레이션은 일레븐 v4부터」 · 11-04 첨벙댕 Kevin 만족에 맞춰 일레븐 v4 후보를 굽는다). 새 배역이라 공식 API(일레븐랩스 기능표).
#      공유 목소리 가운데 공지 기간 730일인 한국어 남자 — 광고 · 다큐 결 넷. 꼬리표는 한 묶음만(값은 꼬리표까지 글자 수).
#   ② 손님 「포스터 보고 왔어요.」 (나) 길 — (가) 길은 19번 판(p8-19b)이 낸 시댄스 목소리를 뗀 것(최종소리.py). 얼굴이 안 보여 입 맞춤이 없다.
#   python -X utf8 목소리후보.py   → git 밖 최종/p8/소리/목소리후보/<자리>_<이름>.mp3 · _목소리후보.json(글 · 값). 키 값은 찍지 않는다.
import json
import os
import urllib.error
import urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/p8/소리/목소리후보"
NARR = "[warm, confident] 손님을 부르는 모델, 펄스 캐스팅북에서."
GUEST = "[warm, casual, a little excited] 포스터 보고 왔어요."
VOICES = {
    "내레이션": {
        "아이작": "8yI73tA9sY25UYpFjsgD",   # Isaac — warm documentary, early 30s, Seoul
        "에스엠": "HcMLbdbsDrYk09bKNfCf",   # SM — social media · ads
        "애셔": "t8OZfrGCqTBbi7c8Gn5J",     # Asher — warm storyteller
        "헨리": "0emXFRrt8HxjqJpgeQtr",     # Henry — friendly & bright
    },
    "손님": {
        "수리": "6yh8zsNIy3q3oI4ztsmm",     # Suri — 30s conversational
        "코코": "3TK0lmDCrufIhGmmRUMO",     # Coco — typical 20s~30s woman
        "루나": "kZJ3sOVD7WvNyF75aJZW",     # Luna — warm, affectionate Seoul(블프 가게 목소리 후보와 같은 공유 목소리)
    },
}


def main():
    key = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().split()[-1]
    os.makedirs(OUT, exist_ok=True)
    log = {}
    for seat, vs in VOICES.items():
        text = NARR if seat == "내레이션" else GUEST
        for name, vid in vs.items():
            p = os.path.join(OUT, f"{seat}_{name}.mp3")
            if os.path.exists(p):
                print("있음", p)
                continue
            body = {"text": text, "model_id": "eleven_v4", "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": 1.05}}
            req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192", method="POST", data=json.dumps(body).encode(),
                                         headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                    cost = r.headers.get("character-cost")
            except urllib.error.HTTPError as e:
                print(seat, name, "HTTP", e.code, e.read()[:300])
                continue
            open(p, "wb").write(data)
            log[f"{seat}_{name}"] = {"voice_id": vid, "글": text, "값": cost, "바이트": len(data)}
            print(seat, name, "→", p, "값", cost)
    old = os.path.join(OUT, "_목소리후보.json")
    allv = json.load(open(old, encoding="utf-8")) if os.path.exists(old) else {}
    allv.update(log)
    json.dump(allv, open(old, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
