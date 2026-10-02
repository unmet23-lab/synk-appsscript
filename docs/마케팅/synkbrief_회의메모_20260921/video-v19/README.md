# synkbrief 1편 · v19 마감본

2026-09-27. 사용자의 요청에 따라 v18의 설명 순서와 여성 내레이션을 유지하면서 장면 연결, 강조 동작, 효과음을 다듬었다. 전체 159.7초, 23장면, 53개 자막이다. 사용자 최종 검토와 외부 게시는 별도다.

[재생 미리보기](http://127.0.0.1:5197/video-v19/preview.html?revision=26) · [MP4](synkbrief-meeting-v19.mp4) · [편집용 Studio](http://localhost:5199/#project/video-v19) · [PDF와 복사용 자료](../follow-along-v15/README.md)

## 변경

- 장면 전환 22곳: 주제 전환 6곳은 0.42초 슬라이드, 같은 설명 안에서는 0.26초 이동과 페이드로 연결한다. 반복되는 전면 색 덮개를 제거했다.
- 실제 ChatGPT 화면의 전체 위치 → 확대 → 클릭 → 화면 복귀 흐름을 유지한다. 원본과 정리 결과의 항목은 차례로 나타나도록 했다.
- 클릭·전환·항목 등장·엔딩에 30개 효과음 타이밍을 배치했다. 클릭과 전환 소리의 높은 주파수를 완화하고, 엔딩 소리를 낮췄다.
- 마지막 댓글 `synk`에 밑줄을 그리며 강조한다. 팔로우와 댓글 안내 문구 및 음성은 v18과 같다.
- 자막이 아주 짧게 겹치던 11곳의 표시 종료 시간을 앞당겼다. 음성이나 문장을 자르지 않았다.

## 소스와 재현

`content.json`, `voice-timing.json`, `layout.css`, `motion.js`, `approved-audio.html`이 편집 원본이다. `node build-v19.mjs`로 합성용 HTML을, `node build-preview.mjs`로 검토 페이지를 만든다. `finish-v19.mjs`는 v18에서 이 버전을 준비한 변환 이력이며, 후속 수정 뒤에는 다시 실행하지 않는다.

HyperFrames와 core 0.8.78을 고정했다. page-slide 공식 레시피를 참고해 전체 장면에 맞게 적용했다. 출력 명령은 `npx hyperframes render --quality delivery --fps 30 --workers 5 --output synkbrief-meeting-v19.mp4`다.

Typecast 은경 내레이션과 사용자가 유료 구독 중 제작했다고 확인한 Suno 시티팝_147의 믹스·음성 대역 감쇄 설정을 v18에서 그대로 가져왔다. 효과음 원본은 `.media/manifest.jsonl`에 기록된 기존·내장 카탈로그 자산이다. `click-soft.wav`, `swish-soft.wav`, `pop-soft.wav`는 각각 `sfx_001.mp3`, `sfx_002.mp3`, `sfx_004.mp3`에 필터와 짧은 페이드를 적용한 파생본이다. 새 음성 합성이나 외부 음원 구매는 없다.

## 확인 기록

- `verification/integrity.json`: 장면 수·제목·순서·길이 동일, 승인된 내레이션/BGM 오디오 설정 유지, 자막 겹침 0건.
- `verification/check.json`: HyperFrames 실행 오류 0건, 레이아웃 오류·경고 0건. 구조 경고 27건은 기존 단일 HTML의 장면 구성, 반복 이미지와 의도한 짧은 효과음 겹침을 포함한다.
- 대비 경고 13건은 등장 페이드 중 1건과 엔딩 슬라이드 중 12건이다. 안정된 화면의 프로젝트 설명과 엔딩을 별도로 시각 확인했다. 전환 중 서로 가려지는 두 장면의 경계를 자동 검사가 중복 글자 정보로 기록한다.
- `snapshots/`: 실제 합성 화면의 전환 중간, 결과, 프로젝트 위치, 입력, 엔딩 이미지.
- 최종 MP4: H.264·1080×1920·30fps, AAC·48kHz 스테레오, 159.70초, 30,308,713바이트. 4,791프레임 전체 디코드 통과, 150ms 이상 검은 화면 없음. `verification/media-info.json`, `verification/decode-loudness.log`에 기록했다.
- 출력 오디오 측정은 -17.04 LUFS, true peak -2.72dBTP다. 원본 음성/BGM 파일도 v18과 SHA-256이 일치한다. 음량 분석과 직접 청취 평가는 별개다.
- MP4에서 23장면을 다시 추출하여 읽힘·UI 강조·결과·엔딩을 시각 확인했다. `verification/final-contact-1.jpg`, `final-contact-2.jpg`와 개별 장면 파일을 남겼다.
- 바탕화면 `synkbrief_회의정리_1편_20260923/회의정리_영상.mp4`를 갱신했고 소스와 해시가 일치한다. 이전 영상은 `회의정리_영상_v18_보관.mp4`로 보존했다. PDF와 ZIP은 기존과 같다. `verification/desktop-delivery.json` 참조.
- 미리보기 WebM 9,129,595바이트의 전체 디코드 통과. 실제 인앱 브라우저에서 12.905초 → 18.550초 재생과 캔버스 화면 진행, 결과 57.4초 이동, 엔딩 153.8초 → 159.709초 재생을 확인했다. 미디어/콘솔 오류와 가로 넘침 없음. PDF·ZIP 링크 HTTP 200. `verification/browser-playback.json` 참조. 바뀐 부분으로 바로 이동하는 검토 버튼 세 개를 추가했다.

## 제작 판단

[TikTok 공식 Creative Codes](https://ads.tiktok.com/business/en/creative-codes)는 움직임·전환·소리로 시선을 유도하는 방법을 설명한다. 광고 제작 가이드이며, 이번 일반 게시물의 반응 향상을 보장하는 근거는 아니다. 효과를 클릭 위치와 설명의 구분에 맞추고, 게시 후 시청 유지와 저장 등 실제 결과로 판단한다.

이 버전의 수정 범위는 영상 마감이다. Instagram 게시, 자동 DM 켜기, 실제 수신 검증은 이번 작업에서 수행하지 않았다. 기존 PDF와 자료 링크는 유지한다.
