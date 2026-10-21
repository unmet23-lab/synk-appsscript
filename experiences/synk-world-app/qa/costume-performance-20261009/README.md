# 코스튬 편의성 성능 벤치 — 2026-10-10

성능 측정은 QA 스크립트와 측정값만 추가한다. 아래 각도 재현에서 확인된 오류는 root 승인에 따라 `wardrobe-stage.mjs`의 캡처 각도 대입 한 줄만 고쳤다. 합성 목록/문자열 캐시 검사와 실제 8종 렌더 검사를 구분한다. 운영 계정·원격·유료 경로는 사용하지 않는다.

## 순수 메타데이터·캐시

`node experiences/synk-world-app/qa/costume-performance-20261009/pure.mjs`

`pure-results.json`에 환경·소스 SHA256·100회 원시 통계 요약이 있다. 8/50/200은 기존 8개 의상의 메타데이터를 복제한 합성 행 수이며 새 의상이나 실제 자산 수가 아니다. 원본 ID를 유지해 실제 태그 lookup 경로를 측정하며 `benchRow`가 합성 행을 구분한다. 현재 8종을 기준으로 목록 탐색 비용을 비교한 Node 측정이며 200개 서로 다른 제작 자산의 브라우저 성능을 검증한 것이 아니다.

| 합성 행 | 검색 p95(ms) | 이름 정렬 p95(ms) |
|---:|---:|---:|
| 8 | 0.086 | 0.103 |
| 50 | 0.235 | 0.256 |
| 200 | 0.992 | 1.318 |

같은 helper의 전체 목록·종류 필터·색 태그 필터도 측정했다. 값은 이번 Node 실행 관측값이며 성능 목표나 실물 휴대폰 결과가 아니다.

실제 exported `wardrobeThumbnailCache`에 기존 의상의 서로 다른 염색 상태로 생성한 키 200개를 넣었다. 실제 PNG 디코딩/렌더 200장이 아니라 PNG 크기를 모사한 문자열 payload다. 96항목 상한, 16,777,216 tracked bytes 상한(큰 payload에서는 32항목), 최근 사용 키 보존과 과대 payload 거절을 확인했다. 내부 bytes는 문자열 UTF-16 길이×2의 계산값이며 브라우저 전체 heap/GPU 메모리 상한이라는 뜻이 아니다. 검사 뒤 캐시를 비웠다.

## 실제 8종 브라우저 검사

`node experiences/synk-world-app/qa/costume-performance-20261009/browser.cjs`

GPU 검사는 담당자의 해제 확인 뒤 순차 실행했다. 최종 벤치는 fault71/20과 core101/22의 종료 뒤에 실행했다. 기본 URL은 기존 4296의 standalone home preview이며 기존 계정 저장 API는 쓰지 않는다. 1440×1000 및 390×844를 각각 새 브라우저 context로 연다. 홈 3D 준비 이후 첫 옷장 열기에서 관측한 첫 rendered frame과 8개 PNG 썸네일 완료를 나눠 측정한다. 재열기 cache hit/새 쓰기, 실제 PNG·Blob·기기 로컬 앨범·UI decode를 포함한 촬영 3회, 지원될 경우 Chromium JS heap snapshots를 기록한다.

최종 `browser-results.json`은 2026-10-10 03:16 KST 실행 결과이며 정상 exit0으로 완료했다. 실제 Intel Arc B390 GPU / ANGLE D3D11, Edge headless, DPR 1 환경이다. 4개 제품 파일(`wardrobe-studio.mjs/.css`, `wardrobe-stage.mjs`, `wardrobe-workbench.mjs`)의 시작·종료·4296 HTTP 원문 SHA256이 모두 같다. 최종 기본색 picker/getter 및 준비 guard가 포함된 소스다. 오류와 HTTP 쓰기 요청은 각각 0건이다. 기존 4296 서비스 PID 41712는 유지했고, 검사 브라우저·Node는 종료했다.

| viewport | 첫 observed rendered frame(s) | 8개 썸네일 완료(s) | 재열기 observed frame(s) | 재열기 8개 cache 준비(s) | 사진 3회(ms) |
|---|---:|---:|---:|---:|---|
| 1440×1000 | 4.388 | 6.498 | 2.838 | 2.864 | 1207 / 517 / 633 |
| 390×844 | 3.346 | 4.439 | 0.900 | 0.917 | 483 / 361 / 462 |

사진 3회의 중앙값은 PC 633ms, 390px 462ms다. 촬영은 실제 PNG 렌더·직렬화, Blob 전환, 해당 새 context의 기기 로컬 앨범 쓰기와 UI 이미지 decode까지 포함한다. `firstVisibleMs`라는 원시 필드명은 실제 viewport 노출을 검증한 시간이 아니다. 정의는 홈 3D가 준비된 뒤 옷장 버튼 클릭을 준비하는 시점부터 stage.frames>0으로 처음 관측한 rendered frame까지이며, 자동화와 polling 비용이 들어간다. 첫 8개 썸네일 완료는 PNG src·complete·naturalWidth를 확인했다. 재열기 cache 준비는 새 studio의 thumbnailCount=8을 기준으로 한다. 지표는 각 viewport 1회 개방/재개방의 관측값이며 분포나 성능 목표 통과를 뜻하지 않는다.

처음은 fitting 탭이고 재열기는 photo 탭과 스크롤 위치가 복원되어 조건이 다르다. 특히 390px 재열기의 warm.stage는 inView=false/paused=true이며 stage 높이도 photo 210px/처음 fitting 215px로 다르다. 따라서 재열기 원시 시간을 같은 조건의 속도 개선값이나 개선 비율로 해석하지 않는다. 재열기는 아래의 썸네일 재생성 0회와 캐시 조회 hit 24회를 확인한 근거로만 사용한다. 원시 숫자는 변경하지 않았다.

각 viewport의 재열기 cache lookup hit는 24회(8개 키를 UI가 여러 번 조회), 새 write는 0회다. 실제 저장 항목은 각 8개이며 내부 tracked bytes는 PC 1,757,216 / 390px 1,762,720이다. 모델의 assetFailures는 0개다. PC는 1024 shadow / 55 draw calls / 68,642 triangles, 390px는 512 shadow / 35 draw calls / 44,998 triangles 예산으로 관측됐다.

| viewport | 홈 준비 후 heap(MiB) | 옷장·8 thumbnail 후 | 사진 3회 후 | 닫은 뒤 | 재열기 뒤 |
|---|---:|---:|---:|---:|---:|
| 1440×1000 | 15.00 | 33.95 | 28.51 | 29.32 | 23.43 |
| 390×844 | 17.83 | 34.11 | 27.83 | 28.36 | 39.01 |

두 context 모두 Chromium `performance.memory`를 지원해 usedJSHeapSize 순간값을 기록했다. 강제 GC를 하지 않았으며 홈·옷장·사진·썸네일 등 같은 context의 JS를 함께 포함한다. 이것은 retained-memory/누수 판정이나 GPU 메모리 측정이 아니다. 390px는 같은 PC GPU에서 실행한 작은 viewport이며 실물 휴대폰의 속도·RAM 근거가 아니다. 200개 새 의상 제작 자산 또는 200개 실제 PNG 렌더를 검증한 것으로 확대하지 않는다.

최종 core101이 만든 `../costume-convenience-20261009/r2-core-320-looks.png`와 `r2-core-390-photo.png`도 직접 다시 확인했다. 320px 첫 룩 카드의 이름·차림 설명·주요 조작, 390px 모델·코디 선택·조명과 하단 고정 버튼이 읽힌다. 이 두 정지 화면의 육안 검토에서 추가로 확인된 잘림/읽기 문제는 없었다. 실제 클릭·복구 검사는 별도의 core/fault 근거이며, 정지 화면만으로 전체 조작 가능성을 단정하지 않는다.

## 실제 각도 불일치 재현·수정 검증

`node experiences/synk-world-app/qa/costume-performance-20261009/angle-repro.cjs`

`angle-before-results.json`은 수정 전 실제 UI에서 움직임 줄이기를 끈 채 정면→뒤를 클릭한 결과다. 직후 PNG 직렬화 시 실제 avatar 회전과 currentAngle은 0이고, targetAngle/getView는 π였다. 직후 PNG는 정면과 동일했고, 회전 완료 후 뒤 PNG와 달랐다. `angle-before-immediate-back.png`와 `angle-before-settled-back.png`를 직접 시각 확인했다.

승인된 한 줄 수정은 일반 사진의 avatar 회전을 targetAngle로 지정한다. thumbnail은 기존의 고정 angle을 사용하고, 화면 애니메이션과 finally 원복은 currentAngle 그대로다. 수정 후 `angle-repro-results.json`에서 직후 실제 avatar 회전=π, metadata.view.angle=π이며, 직후 뒤 PNG와 회전 완료 뒤 PNG가 완전히 같다. currentAngle은 직후에도 0으로 남아 화면의 애니메이션이 유지된다.

후보 3개를 정면/옆/뒤 각각 만들고 다시 방문했다. 9개 사진 모두 실제 회전과 메타데이터가 해당 목표 각도이며, 재방문 때 같은 PNG 9개를 캐시에서 재사용했다(캐시 쓰기 9→9). 첫 계측의 URL 별칭 인스턴스 혼용은 교정했고, 결과는 실제 `/synk-world-home/` 모듈 인스턴스 계측만 반영한다. 첫 진단의 브라우저 close 지연은 해당 QA 프로세스만 정리했고, 수정 후 재현은 패널/페이지 정리 뒤 정상 종료했다.

수정 후 기존 `../costume-stage-20261009/verification.json`의 WebGL 검사 본문 18개와 `../wardrobe-stage-state.test.mjs`의 순수 시험 4개가 통과했다. 캡처와 오류 시 상태 복원, 실제 염색/기본색 복원, 휠/핀치, idle 제한, 원본 몸/눈 보존을 포함한다. 별도 18개 WebGL harness는 결과 파일을 저장한 뒤 Edge 종료가 지연되어 해당 QA 프로세스만 종료했다. 이를 정상 exit0 또는 제품 메모리 오류로 보고하지 않는다. 수정 후 각도 재현 harness는 정상 exit0으로 끝났다.
