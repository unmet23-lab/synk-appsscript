# 실제 인터뷰 표정 · 4초 검토 프로젝트

범위: 로컬 검토용 HyperFrames 편집과 비교 페이지. 24fps, 96프레임, 무음이며 영상 위에 추가 효과나 보정을 하지 않는다.

## 파일

- `index.html`: `assets/composite-master.mp4` 한 컷을 원래 순서·속도로 배치한 HyperFrames 타임라인.
- `review.html`: 480×854 세로 영상과 원본/합성 동기 비교. 별도의 검토 UI이므로 영화 픽셀에 포함되지 않는다.
- `prepare-media.ps1`: 완성된 세 소스를 복사하고 SHA256 동일성을 확인한 다음 local-only media-use adopt를 실행한다.
- `vendor/gsap.min.js`: GSAP 3.14.2 로컬 사본. 프레임 렌더 시 외부 네트워크에 의존하지 않는다.

## 원본이 완성된 뒤

PowerShell에서 이 폴더를 작업 디렉터리로 사용한다.

```powershell
./prepare-media.ps1
npm run check -- --json
```

`prepare-media.ps1`는 소스 폴더의 `render-report.json`이 `status=rendered_pending_independent_verification`, `frame_count=96`일 때만 진행한다. 검증 후 보고서 상태가 바뀌었으면 상태 조건을 검토하여 승인된 완료 상태를 명시적으로 추가한다.

## 검토 / 선택적 편집 렌더

루트 담당자가 로컬 HTTP 서버로 `review.html`을 열어 세로 영상 전체 재생과 동기 비교를 확인한다. 서버는 이 폴더 안의 `assets/`를 제공할 수 있어야 한다. 독립 브라우저 세션이나 외부 게시를 시작하지 않는다.

HyperFrames Studio가 필요한 경우:

```powershell
npx --yes hyperframes@0.8.97 preview --background
npx --yes hyperframes@0.8.97 preview --status
```

기존 480p 파일이 이미 검토 산출물이다. 추가 재압축을 피하기 위해 이 프로젝트가 새 세로 MP4를 만들지 않는다. 타임라인 수정 후 실제로 편집 렌더가 필요한 경우에만 다음을 실행한다.

```powershell
npm run render -- --fps 24 --quality delivery --output output/composite-edit.mp4
```

브라우저 동기 비교는 두 플레이어의 시간을 맞춘 시각 검토다. 픽셀 동일성은 별도 제작 보고서의 측정으로 확인하며 이 페이지가 보증하지 않는다. 직접 청취 대상은 없다. 의도적 무음 시안이다.

## 확인 기록 · 2026-10-01

- `hyperframes skills update general-video`: 성공, 이미 최신 상태.
- HyperFrames 0.8.97로 공식 scaffold 생성.
- 첫 `check --json`: `missing_local_asset` 1건으로 중단. 렌더가 아직 진행 중이어서 `assets/composite-master.mp4`를 복사하지 않은 상태다. 이 결과는 구조 검사 전체 통과나 영상 재생 확인이 아니다.
- `prepare-media.ps1` PowerShell 구문 검사, `review.html` JavaScript 구문 검사 완료.
- 렌더 완료 보고서 조건을 확인한 뒤 `prepare-media.ps1` 실행 성공. 세 파일 모두 원본과 복사본 SHA256이 같고, local-only media-use adopt로 3개 영상 등록 완료.
- 미디어 채택 후 `npm run check -- --json`: **통과**. HyperFrames 0.8.97, 4초 9개 시각 샘플, lint/runtime/layout 각각 오류 0·경고 0. 글자 없는 영상이므로 contrast 검사 대상 0개이며 별도 motion assertion은 없다.
- 실제 브라우저 전체 재생과 원본/합성 비교는 루트 담당자가 별도로 확인한다. CLI check 통과만으로 재생·자연스러움이 승인된 것은 아니다.
