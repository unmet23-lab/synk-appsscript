"""
목소리 후보 받아쓰기(2026-11-04): 후보 판(.tmp/subway-rush-20261104/목소리후보)을 faster-whisper medium으로 받아 원고와 견준다. 귀로 고르기 전에 말이 틀린 판을 거른다.

    python -I -X utf8 experiences/subway-rush/qa/받아쓰기-후보.py
"""
from difflib import SequenceMatcher
from pathlib import Path
import re

from faster_whisper import WhisperModel

OUT = Path(r"C:/Users/q1212/Documents/SYNK-appsscript/.tmp/subway-rush-20261104/목소리후보")
원고 = {
    "announcer": "이번 역은 시청, 시청역입니다. 내리실 문은 오른쪽입니다. 일호선으로 갈아타실 분은 이번 역에서 내리시기 바랍니다.",
    "guide": "시청역에서 일호선으로 갈아타세요. 일호선, 청량리 방면이에요. 종로오가에서 내리세요.",
    "worker": "어 다음이 어디예요? 아이고, 감사합니다!",
    "traveler": "저기요, 이 열차 명동에 가요? 고마워요!",
    "fan": "혹시 오늘 콘서트 가요? 아쉽다! 다음엔 같이 가요!",
    "grandma": "아이고, 다리가 아프네. 고마워, 학생. 밥은 먹고 다니지?",
    "hiker": "학생, 내려요? 어이쿠, 미안해요!",
    "freshman": "혹시 오티 가요? 저도요! 좋아요! 뛰어요!",
}
모델 = WhisperModel("medium", device="cpu", compute_type="int8")
다듬 = lambda t: re.sub(r"[^가-힣0-9]", "", t)
for f in sorted(OUT.glob("*.mp3")):
    역, 이름 = f.stem.split("-", 1)
    if 역 not in 원고:
        continue
    조각, 정보 = 모델.transcribe(str(f), language="ko", beam_size=5, vad_filter=False)
    글 = " ".join(s.text.strip() for s in 조각)
    닮음 = SequenceMatcher(None, 다듬(원고[역]), 다듬(글)).ratio()
    print(f"{닮음:.2f} | {역} | {이름} | {정보.duration:.1f}초 | {글}", flush=True)
