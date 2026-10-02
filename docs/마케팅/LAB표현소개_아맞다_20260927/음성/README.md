# 내레이션

v2 내레이션은 Google Gemini TTS(`gemini-3.1-flash-tts-preview`, 목소리 Sulafat, Vertex 무료 크레딧)다. 12개 목소리를 시험하고 받아쓰기 일치로 골랐다. 고른 테이크와 생성 설정·평가표는 [v2](v2)에 있다. v1의 임시 edge-tts 기록은 `임시TTS_edge-tts.json`.

## Typecast 서현으로 바꿀 때

1. `node 음성/voice-connection.cjs`를 실행하고 http://127.0.0.1:5211 에서 Typecast API 키를 붙여 넣는다. 키는 메모리에만 2시간 머물고 파일·채팅에 남지 않는다. 월 제공 크레딧이 부족하면 멈춘다.
2. `voice-plan.json`의 5줄(hook·umbrella·beat·slow·confirm)이 `음성/audio/<id>.wav`로 생긴다.
3. `소스/v2/작업폴더_준비.py`로 작업 폴더를 세우고, 새 wav를 `v2/voice/lines/`에 넣은 뒤 `prep_voice.py`의 `PICK`을 새 파일 이름으로 바꾼다.
4. `prep_voice.py` → `render_v2.py --out`(따라 말하기 음절 채움이 새 음성 시각을 따르므로 영상도 다시 굽는다) → `mix_v2.py` → `qa_v2.py`.
