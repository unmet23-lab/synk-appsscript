"""
꿈 무대 엔딩(2026-11-18) — 엔딩곡 「안녕, 서울」(연주곡)을 일레븐랩스 음악 API로 굽는다.
유호님 「진짜 영화 엔딩처럼 … 크레딧 나오면서」에서 나왔다. 시험관 편집자가 「피아노 첫 음은 감성 엔딩의 기본값이다.
옥상의 빨래 소리나 도시 소리에서 곡이 자라 나오게 하라」고 해서, 곡의 첫 몇 초를 거의 없는 소리에서 자라게 시킨다.
일레븐랩스 Creator 월정액 안(분당 900크레딧, 기능표 「음악」)이라 묻지 않고 쓴 양만 보고한다. 키는 ~/SYNK_보안/elevenlabs.txt.

    python -I -X utf8 엔딩곡.py <밖 폴더> <판 이름> <길이 초> [지시문 파일]
"""
import json
import os
import sys
import time
import urllib.request

밖, 이름, 초 = sys.argv[1], sys.argv[2], float(sys.argv[3])
기본 = (
    "Instrumental end-credits theme for a quiet Korean indie coming-of-age film titled 'Hello, Seoul', "
    "about a foreign student's first year in Seoul and her or his mother far away. "
    "It grows out of near silence: for the first 4 seconds only a soft sustained warm string pad and a few distant, "
    "gently plucked nylon-string guitar notes, as if rising from the sound of a rooftop at dusk. "
    "At about 4 seconds a warm, intimate main melody enters on nylon-string acoustic guitar, with cello underneath, "
    "in D major, around 76 BPM, hopeful and a little bittersweet. "
    "From about 20 seconds the arrangement opens up gently with light strings, a soft felt piano answering the guitar "
    "and a quiet glockenspiel counter-melody, never loud, never epic. "
    "In the last 10 seconds it thins back to guitar and cello and resolves on one long final chord that rings out to silence. "
    "Organic, real instruments, close and warm, like a Korean independent film soundtrack. "
    "No vocals, no humming, no synth leads, no big drums, no trailer hits, no risers, not generic stock music."
)
지시 = open(sys.argv[4], encoding="utf-8").read().strip() if len(sys.argv) > 4 else 기본
키 = open(os.path.expanduser("~/SYNK_보안/elevenlabs.txt"), encoding="utf-8").read().strip().splitlines()[-1].strip()
몸 = json.dumps({"prompt": 지시, "music_length_ms": int(초 * 1000), "model_id": "music_v1", "force_instrumental": True}).encode()
요청 = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", data=몸, method="POST",
                            headers={"xi-api-key": 키, "Content-Type": "application/json"})
t0 = time.time()
with urllib.request.urlopen(요청, timeout=300) as r:
    소리 = r.read()
os.makedirs(밖, exist_ok=True)
p = os.path.join(밖, f"{이름}.mp3")
open(p, "wb").write(소리)
open(os.path.join(밖, f"{이름}_지시문.txt"), "w", encoding="utf-8").write(지시)
print(json.dumps({"파일": p, "바이트": len(소리), "걸린초": round(time.time() - t0, 1)}, ensure_ascii=False))
