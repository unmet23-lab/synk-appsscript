# 오미톡 15초 끝 두 줄 — 일레븐 v4 비교 후보(2026-11-07, Claude). 키는 찍지 않는다(1번 오미톡 내레이션 굽기3.py와 같은 길 · 공식 API).
#   python -X utf8 끝말_일레븐.py [이름…]   → git 밖 pulse-portfolio12-20261024/최종/om2/소리/끝말_일레븐/<이름>.mp3
# 브리프 「끝 두 줄은 om2-2 시댄스 목소리 견본으로, 어색할 때만 일레븐 v4」 — 받은 om2-끝말이 Gemini 소리 맹검 5/10(「다섯 가지만 톡」 · 무감정)이라
#   견본 목소리로 다시 낸 시댄스 두 벌(om2-끝말b)과 함께 이름을 가려 견준다. 목소리: 젊은 남자 셋 — Taehyung(자연스럽고 친근) · Mr. K(1번 오미톡 브랜드 목소리) · Apollo(맑음).
import json, os, sys, urllib.error, urllib.request

OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/om2/소리/끝말_일레븐"
TEXT = ("[relaxed, satisfied, a warm smile in the voice, refreshed after a cold drink] 다섯 가지 맛, ... [light and crisp] 톡. ... ... "
        "[warm, bright, assured, smiling] 오미톡.")
CANDS = {
    "Taehyung": ("m3gJBS8OofDJfycyA2Ip", 0.45),
    "MrK": ("LKOcTG4J4tYTPR9DnLeM", 0.45),
    "Apollo": ("xsfFw9plbX0VhNMhHgl1", 0.45),
}


def main():
    key = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().splitlines()[-1].split()[-1]
    os.makedirs(OUT, exist_ok=True)
    for name in sys.argv[1:] or list(CANDS):
        vid, stab = CANDS[name]
        body = {"text": TEXT, "model_id": "eleven_v4", "language_code": "ko", "voice_settings": {"stability": stab, "similarity_boost": 0.75}}
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_192",
                                     data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
        try:
            r = urllib.request.urlopen(req, timeout=180)
            b = r.read()
            open(os.path.join(OUT, name + ".mp3"), "wb").write(b)
            print(name, len(b), "값", r.headers.get("character-cost"))
        except urllib.error.HTTPError as e:
            print("실패", name, e.code, e.read()[:300])


if __name__ == "__main__":
    main()
