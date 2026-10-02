# synkbrief 01 · v7 템포·모션·BGM 검토본

2026-09-23 · 88초 · 14장면 · 1080×1920 · 30fps · 내레이션 삽입 전.

[영상 미리보기](http://127.0.0.1:5197/video-v7/preview.html?revision=9) · [MP4](synkbrief-meeting-v7.mp4) · [화면 원고](../원고_v7.md) · [정보·이해 흐름 검토](research-and-review.md) · [8쪽 PDF와 실습 키트](../follow-along-v6/README.md)

기존 v6의 123초를 35초(28.5%) 줄였다. 겹치는 설명을 합치고, 메모에서 표로 전환·지침 재사용 연결·실제 메뉴 확대·클릭 반응·형식 보완·PDF 등장 모션을 새로 구성했다. 기존 Suno `시티팝_147.wav`의 10초부터 88초 구간을 사용하고 시작·끝 페이드를 적용했다. 내레이션은 사용자 검토와 보고 다음 단계다.

## 구성과 재생성

- `build.mjs`: 14장면 내용과 오디오 배치 → index.html/scenes.json
- `style.css`, `motion.js`: 화면·GSAP 타임라인. 생성물만 수정하지 않는다.
- `build-preview.mjs`: 브라우저 미리보기·SRT. 기존 검증된 v6 PDF/ZIP 연결.
- `preview-display.js`: 인앱 브라우저의 흰 영상 문제를 피하기 위해 디코드된 프레임을 canvas로 표시.
- `assets/project`: 9월 23일 실제 프로젝트 시연 캡처. 공개 영상은 개인 사이드바를 제외한 크롭 사용.
- `.media/manifest.jsonl`: Suno 원본과 효과음 출처.

```powershell
node build.mjs
node build-preview.mjs
npx hyperframes check --json
npx hyperframes render --quality delivery --fps 30 --workers 2 --output synkbrief-meeting-v7.mp4
node verify-scenes.cjs
node verify-preview.cjs
```

검증 결과는 `verification/`에 기록한다. HyperFrames 기본 검사에서 오류 0, 레이아웃 이탈 0, 대비 49/49 통과. 린트 경고 17개는 단일 파일 장면 구성·타임라인 밀도·지침 화면 이미지 재사용 관련으로 보존한다. 모션 품질은 이 자동 검사만으로 판정하지 않고 실제 렌더 장면과 재생을 확인한다. 사용자 품질 승인·최종 음성·외부 발행은 별도다.

## 완성 파일 검증

MP4 H.264/AAC 88.000초, WebM VP9/Opus 88.008초 전체 디코드 통과. 0.3초 이상 검은 구간 없음. 실제 렌더 14장면과 중간 모션 14개 샘플을 시각 확인했다. 오디오 측정은 -22.77 LUFS / -8.30 dBTP / LRA 3.50 LU이며 클리핑 없음. 측정용 loudnorm 출력값은 파일에 적용한 정규화가 아니다. 향후 내레이션을 위한 배경 볼륨으로 두었다.

1280px·390px에서 재생, 소리 토글, 챕터 이동, canvas에 실제 프레임 표시, PDF·ZIP·MP4 링크 200을 확인했다. 가로 스크롤과 페이지 JS 오류 없음. 자세한 값과 SHA-256은 `verification/delivery.json`, `preview-qa.json`에 있다.

실제 Codex 인앱 브라우저에서도 재생 37초의 저장 장면과 83초 엔딩이 흰 화면 없이 표시되는 것을 확인했다. 사용자 검토용 탭은 첫 화면 일시정지 상태로 준비했다.
