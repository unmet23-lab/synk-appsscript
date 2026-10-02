# 한국어 시티팝 3곡 라디오 추가 · 2026-10-01

사용자 요청: 새로 만든 Suno 한국어 시티팝을 기존 라디오 뒤에 이어서 재생한다.

- 최종 편성: 기존 19곡 → **유영 → 잔상 → 밤의 온도** → 첫 곡으로 반복. 기존 19곡의 오디오 파일·순서·곡 경계·제목을 유지했다.
- 최종 재생목록과 곡 시간표: `playlist-final.txt`, `now-playing-final.json`. 총 22곡, 4183.887596546초(69분 43.89초). 새 곡 시작은 58:41.13, 62:25.29, 66:09.09다.
- 원본은 이전 제작에서 전달한 첫 버전 MP3다. Suno ID·입력 해시·정규화 측정·방송 파일 해시는 `audio-build.json`에 기록했다. 원본을 덮어쓰지 않았다.
- 방송 파일: `C:\Users\q1212\Documents\SYNK-radio-20261001\synk-radio-citypop3-20261001.flac`. 44.1kHz 스테레오 24비트, 곡 사이 3초 크로스페이드, 662.76초. SHA-256 `3bac435befabd3f73ecb69b6a885795ab41a8d9ff4784abb247cb0fcb5d34a87`.
- 최종 편성 변경 전 새 3곡을 먼저 시험 송출해 공개 수신을 검증했다. `public-new-live.mp4`의 12초 소리는 방송 파일의 103.26625초 구간과 정규화 상관계수 **0.97805**로 일치했다. `public-new-live.png`에서 **유영** 제목·기존 SYNK radio 마크·방송 장면을 확인했다.
- 최초 `public-new.mp4` 수신에는 변경 전 방송 구간이 남아 있었고 비교가 실패했다. 재수신한 `public-new-live`가 신곡 검증 근거다. 파일 존재·서비스 active만으로 공개 재생을 판단하지 않았다.
- 로컬 FFmpeg 9의 기본 FLAC 출력은 STREAMINFO 블록 크기가 27로 생성되어 새 묶음 → 기존 첫 묶음 경계에서 디코딩 오류가 났다. 최종 묶음의 `-frame_size 4608`을 명시해 기존 파일과 맞췄다. 반영 전 로컬과 실제 방송 서버 FFmpeg 5.1 양쪽에서 전체 새 음원 및 두 연결 경계(각 30초)를 오류 없이 검사했다. `preflight.json`, `deployed-trial.json`의 `serverJoinTests`에 기록했다.
- `deployed-trial.json`은 공개 신곡 확인용 임시 시작 순서다. 운영 기준은 **`deployed-final.json`**과 **`final-status.json`**이다. 재생목록·곡 시간표는 함께 변경했고, 서버 원본을 단계별 백업했다. 방송 엔진·조율·무대·승인 마크는 변경하지 않았다.
- 최종 반영: 2026-10-01 20:10:12 KST. `final-status.json`에서 22곡의 목록/시간표 해시, 실제 기존 첫 묶음 입력, active/running·재시작 0·YouTube active/good를 확인했다. 최종 공개 수신 `public-final.mp4`는 기존 첫 곡 58.5445초와 상관계수 **0.99192**로 일치하며 `public-final.png`에서 기존 첫 곡 제목을 확인했다. 이번 회차 신곡 시작 예상은 약 21:09 KST(수신 지연 포함 약간 늦어질 수 있음)다.

방송: [SYNK Radio](https://www.youtube.com/watch?v=mP3T7Sabeh4).

`build.py` → `prepare.cjs` → `deploy.cjs trial` → 공개 수신·`compare.py` → `deploy.cjs final` 순으로 적용했다. 공개 비교는 첫 신곡을 검증한 것이며, 새 3곡 전체는 디코딩과 서버 연결 검사를 통과했다. 최종 22곡의 한 바퀴를 전부 공개 청취한 기록은 아니다. 기존 일부공개 19곡 모음집은 당시 편성의 보관본으로 유지한다.
