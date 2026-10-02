# synkbrief 활용 — 사진 한 장으로 광고 세 컷

56.5초 · 세로 1080×1920 · 30fps · 한국어 내레이션·자막. 사용자 제공 참고 8개의 구성 원리를 반영한 로컬 제작본이다.

## 결과물

- [시리즈명 반영 영상](synkbrief-photo-to-3cuts-series.mp4)
- [재생 페이지](watch.html) — `node serve.mjs`로 실행 후 `http://127.0.0.1:4387/`
- [4쪽 실습 가이드](guide.pdf)
- [실습 자료 ZIP](synkbrief-practice.zip) — 가이드·복사 프롬프트·원본과 생성 결과 4장
- [복사 프롬프트](prompt.txt)
- [참고 8개 적용표](reference-report.md), [게시 문안·훅 3개](copy.md)

## 내용과 제작

원본과 생성 결과를 먼저 비교하고, 제품의 모양·색·재질을 고정한 뒤 전체·디테일·사용 장면을 각각 요청한다. 마지막에는 손잡이·색·테두리를 원본과 대조하고 실제 가이드와 자료 요청 문구로 연결한다.

원본과 광고 이미지 모두 내장 imagegen으로 만든 가상 제품이다. [생성 요청문과 파일 기록](image-generation.md)을 보관했다. 사진 편집 결과에 화면 이동을 넣었으며, 동영상의 새 카메라 시점을 생성했다고 주장하지 않는다. 입력 과정은 설명 그래픽이다.

기존 Typecast 은경 인증이 현재 연결되지 않아 이번 편은 실제 합성이 가능한 Edge SunHi를 사용했다. 보유 Suno 음악과 효과음을 낮게 섞었다. [오디오 출처·재현·확인](assets/audio/README.md).

## 시리즈명 수정 · 2026-09-27

사용자 지적을 반영해 영상 56.5초 전체 상단과 표지에 정확한 시리즈명 “synkbrief 활용”을 추가했다. 시리즈명은 작게, 결과를 설명하는 본제목은 크게 유지한다. 이전 영상은 보존하고 최신본은 synkbrief-photo-to-3cuts-series.mp4로 구분한다.

## 확인 기록

- 2026-09-29 미리보기 복구: 기존 IAB 탭의 영상 영역이 흰색이고 재생 조작이 멈춰 있었다. 영상 파일의 5초 실제 프레임·HTTP 응답·범위 요청은 정상. 새 탭에서 움직이는 화면과 25.7초 재생을 확인하고 기존 탭을 닫았다. 영상·서버 변경 없음. 기록: qa/preview-recovery-20260929.json.

- 시리즈명 수정본: qa/check-series.json 오류 0. 실제 MP4의 0.6·28·53.9초 및 표지에서 표기 확인, 전체 디코드 오류 0, 이전본과 오디오 패킷 해시 일치. 브라우저 수정본 재생과 표지·다운로드 링크 확인.

- HyperFrames 전체 장면 검사 `qa/check.json`: 오류 0. 마지막 광고 제목의 대비 수정 후 해당 구간 `qa/check-final.json`: 오류 0.
- 영상 프레임 육안 검수: 첫 결과 비교·6개 장면·자막·엔딩. 검정 광고 제목이 파란 컵과 겹치는 문제를 흰 제목판으로 수정했다.
- PDF 4쪽 렌더 및 SUIT 폰트 임베딩 확인: `qa/guide/verification.json`.
- 최종 MP4의 길이·해상도·코덱·전체 디코드·브라우저 재생 결과는 `qa/final-verification.json`에 기록한다.
- 오디오는 ASR·음량·전체 디코드로 검증했다. 직접 귀로 듣는 검수는 미확인이다.
- 참고 영상의 원본 오디오 직접 청취도 하지 않았으므로 음색·음악을 모방했다고 설명하지 않는다.

두 lint 경고는 전체 영상에 유지되는 브랜드·진행 막대의 묶음과, 첫 장면의 비교/카드 펼침에서 동일 이미지를 의도적으로 재사용한 구조에 관한 것이다. 실제 출력의 중복 소리나 배치 오류는 아니다.

## 다시 편집·렌더

`build.mjs`가 `audio-timing.json`의 실제 길이로 6개 장면과 `index.html`을 만든다. 장면 HTML은 `compositions/frames/`에 있다. `node build.mjs` → `npm run check` → `npx hyperframes render --quality delivery --fps 30 --workers 4 --output synkbrief-photo-to-3cuts-series.mp4`.

로컬 HyperFrames Studio: `http://localhost:3002/#project/synkbrief-ai-angles-20260927`. 원본과 다른 회차는 수정하지 않았다. 새 결제·구독·충전·외부 게시·DM 자동화 변경은 없다. 본편의 댓글 안내는 게시용 문안이며 실제 자동 전달 성공을 증명하지 않는다.
