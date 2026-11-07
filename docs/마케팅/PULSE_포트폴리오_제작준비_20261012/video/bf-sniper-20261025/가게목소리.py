# 블프 스나이퍼 가게 목소리(화면 밖 내레이터, 28.3초~) — 일레븐 v4 공식 API로 후보 셋을 굽는다(2026-11-07, Claude).
# 새 배역이라 일레븐 기능표 「새 배역의 일레븐 v4는 여기로」(힉스필드 Luna 프리셋은 그 배역 몫). 줄은 02_콘티 1절 그대로, 소리용 글만 쉼을 둔다.
# 첫 판(쉼 「...」 · 빠르기 1.0)은 6.1~6.3초로 자리(28.3~31.1초)보다 길어 빠르기 1.2(최대) · 쉼 없이 다시 굽고, 남는 쉼은 편집에서 줄인다.
# 공유 목소리는 공지 기간 730일인 한국어 여성 · 부드러운 결만 골랐다(기능표 「쓸 때 조건」 5). 키 값은 찍지 않는다.
#   python -X utf8 가게목소리.py   → git 밖 최종/s4/목소리/가게_<이름>.mp3 · _가게목소리.json(글자 값)
import json
import os
import urllib.error
import urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/s4/목소리"
LINE = "[softly] 주무세요. 블프는 선착순 없이 일주일 내내. 느지막."   # 화면 · 콘티 글: 「주무세요. 블프는 선착순 없이 일주일 내내. 느지막.」
VOICES = {
    "모노베이지": "SE9upoSoM2ipDUdAVW8q",   # Mono Beige — calm, natural, urban, understated
    "루나": "kZJ3sOVD7WvNyF75aJZW",         # Luna — warm, affectionate Seoul (힉스필드 Luna 프리셋과는 다른 사람)
    "티아": "XuzKX1PtsYzivdEFzo2g",          # Tia — soft & calm, soothing
}


def main():
    key = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().split()[-1]
    os.makedirs(OUT, exist_ok=True)
    log = {}
    for name, vid in VOICES.items():
        body = {"text": LINE, "model_id": "eleven_v4", "voice_settings": {"stability": 0.6, "similarity_boost": 0.8, "style": 0.1, "use_speaker_boost": True, "speed": 1.2}}
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192", method="POST", data=json.dumps(body).encode(),
                                     headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
                cost = r.headers.get("character-cost")
        except urllib.error.HTTPError as e:
            print(name, "HTTP", e.code, e.read()[:300])
            continue
        p = os.path.join(OUT, f"가게_{name}.mp3")
        open(p, "wb").write(data)
        log[name] = {"voice_id": vid, "글": LINE, "값": cost, "바이트": len(data)}
        print(name, "→", p, "값", cost)
    json.dump(log, open(os.path.join(OUT, "_가게목소리.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
