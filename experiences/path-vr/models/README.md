# 한국어 로컬 음성 인식 자산

- 모델: Alpha Cephei `vosk-model-small-ko-0.22`, Apache-2.0. [공식 모델 목록](https://alphacephei.com/vosk/models).
- 원본 ZIP 86,914,329 bytes를 디렉터리 항목을 포함한 USTAR gzip으로 변환했다. 브라우저 파일은 89,103,045 bytes이며 `speech-assets.json`에 출처·SHA-256을 기록한다.
- `python tools/prepare-interview-speech.py`로 다운로드·검증·동일 형식 패키징을 재현한다. 모델 `.tar.gz`는 저장소의 기존 대용량 파일 제외 규칙에 따라 Git 밖에 있다. 배포 시 별도 복사해야 한다.
- 준비 과정은 처음에 모델 약 87MB와 런타임 약 2.4MB를 다운로드하고 임시 폴더에도 원본을 보관한다. 유료 API를 사용하지 않는다.
- 브라우저에는 공개 모델만 IndexedDB에 캐시한다. 마이크 PCM과 인식문은 메모리에서 처리하며 이 모듈은 서버로 보내거나 저장하지 않는다.
- 최초 실행은 다운로드·압축 해제·모델 초기화가 필요하다. 로드와 추론은 Worker에서 수행하고 AudioWorklet이 PCM을 Worker로 직접 전송한다.
- Quest 단독 실행을 목표로 구현했다. 실제 Quest의 메모리·처리 속도·마이크·정확도 검증은 아직 별도이며, 데스크톱 확인을 Quest 확인으로 표시하지 않는다.

## 합성 음성 검증

`powershell -File tools/prepare-interview-speech.ps1 -FixtureOnly`는 로컬 Windows 한국어 음성으로 `fixtures/interview-ko.wav`를 만든다. 내용은 "안녕하세요. 저는 한국어를 공부하고 있습니다. 저는 회사에서 일하고 싶습니다. 감사합니다."이며 사용자의 녹음이나 개인정보를 포함하지 않는다.

`node tools/prepare-interview-speech.mjs`는 Chrome에서 실제 WASM 모델과 AudioWorklet을 통해 이 WAV를 인식하고 `fixtures/verification.json`에 결과를 쓴다. 브라우저 개발 도구에서는 `transcribeWavFixture('/models/fixtures/interview-ko.wav', {onStatus: console.log})`를 `interview/voice.mjs`에서 import해 실행할 수도 있다.
