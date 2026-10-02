# 이번 편의 소리

- `master.wav`: 영상에 넣는 최종 믹스, 56.50초, 48 kHz stereo PCM.
- `narration.wav`: 나레이션만. 6단락 합성 원본은 `voice-01.mp3`부터 `voice-06.mp3`.
- `music-bed.wav`: 보유 Suno 곡 `docs/홍보물/BGM/시티팝_147.wav`의 25초부터 56.50초 구간. 음량 0.14, 90 Hz highpass, 6.5 kHz lowpass, 시작 0.25초·끝 1초 페이드. 믹스에서 나레이션에 따라 덕킹한다.
- `pop.mp3`, `click-soft.mp3`, `whoosh-short.mp3`, `chime.mp3`: media-use 스킬의 bundled SFX. 새 합성·구매 없이 사용했다.

현재 음성은 Edge TTS `ko-KR-SunHiNeural`, rate `+0%`다. Typecast 은경의 예전 인증은 프로세스 메모리에만 보관되던 연결이었고 현재 살아 있는 연결을 확인하지 못했다. 제작 담당자에게 대체 음성 경로와 실제 합성 성공을 보고한 뒤 이번 편을 제작했다. 첫 단락만 pitch `+1Hz`, 나머지 `+0Hz`로 과장 없이 밝기를 조금 달리했다. 사용자 목소리 복제는 사용하지 않았다.

첫 단락 앞 0.30초, 단락 사이 0.35초, 마지막 뒤 0.30초 여유를 두고 30fps 경계에 맞춰 패딩했다. 발화 속도를 강제로 늘리거나 줄이지 않았다. 동기화 기준은 프로젝트의 `audio-timing.json`이며 자막의 'synk'는 음성에서 '싱크'로 읽는다.

재현: `python build-audio.py`, `python mix-audio.py`, `python verify-audio.py`.

검증은 ffprobe/ffmpeg 음량·디코드와 faster-whisper 받아쓰기다. 기계 검증은 실제 귀로 듣는 음색·억양·음악 선곡 확인을 대신하지 않으며 직접 청취 완료로 표시하지 않았다.
