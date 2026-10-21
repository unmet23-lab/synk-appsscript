# 제품 QA 실행 증거

`qa-evidence.cjs`는 기존 제품 시험의 출력과 소스 판을 묶는다. 예약·AI 호출·배포는 하지 않는다.

## 실행

저장소 루트에서:

```powershell
node experiences/hangul-stage/qa/flow.cjs
node --test experiences/synk-world-app/qa/account-browser.test.mjs
node tools/lib/qa-evidence.cjs --check .tmp/qa-runs/<실행>/qa-evidence.json
```

한글 시험은 주소를 생략하면 빈 포트의 로컬 서버를 띄우고 끝에 자기 서버만 닫는다. WORLD 계정 시험도 자기 포트와 합성 계정 저장 폴더를 쓴다. 둘 다 격리된 Chrome으로 확인한다. 한글은 소리 없는 동작 시험이며 실제 청취 검수가 아니다.

기본 출력은 `.tmp/qa-runs/<종류>-<실행 ID>-<무작위>/`다. `SYNK_QA_OUT`으로 저장소 `.tmp` 안의 다른 증거 루트를 지정할 수 있고 `SYNK_QA_RUN_ID`는 사람이 읽는 접두어다. 같은 ID로 다시 실행해도 새 폴더가 생긴다. 원래 `experiences/*/qa`에 있던 캡처·JSON은 덮거나 삭제하지 않는다.

WORLD의 `cafe-static`, `daily-tutor-static`, `home-tutor-static`, `life-tutor-static` 시험도 이 출력 계약을 쓴다. 각 시험의 기존 `*_PAYLOAD` 환경변수는 검사할 동결 묶음을 고른다. 과거 기본 묶음과 현행 시험의 기능이 다르면 실패할 수 있으며, 동결 묶음 통과를 현재 공개판 통과로 읽지 않는다. 옛 `*_QA_RUN`·`*_STATIC_RUN` 출력 위치 옵션은 사용하지 않고 공통 `SYNK_QA_RUN_ID`를 쓴다.

## 결과 읽기

```javascript
const { readEvidence, freshness } = require('./qa-evidence.cjs');
const evidence = readEvidence({ root, manifestPath });
const current = freshness({ root, manifestPath });
```

- `evidence.status`: `running`, `passed`, `failed`. 시험의 실행 결과다.
- `evidence.target`: 제품·실제 로컬 URL·묶음 식별자. `sourceVersion.head`는 당시 Git HEAD이며 실제 작업본은 `source.files`의 SHA-256으로 식별한다.
- `evidence.syntheticAccount`, `liveProviderCalls`, `limitations`: 확인 범위와 남은 실기기·청취·학습 효과 경계다.
- `current.state`: `fresh`, `stale`, `unavailable`. 현재 소스가 그 시험 당시와 같은지 뜻하며 시험 성공 여부와 별개다. `changed`, `added`, `removed`는 달라진 경로다.
- `evidence.finishedSource`: 실행 도중 원본이 바뀌었는지도 기록한다.

현재 소스 범위는 명시한 파일과 폴더의 JS·JSON·HTML·CSS·셰이더와 그 코드가 리터럴 경로로 import/require한 저장소 내부 모듈이다. 계산한 경로·원격 모듈·설치 패키지는 추측하지 않으며 찾지 못한 로컬 리터럴 의존은 `source.missingDependencies`와 현재성 결과에 따로 남긴다. 이 목록이 비어 있지 않으면 `fresh`여도 전체 의존이 확인된 것은 아니다. QA·설치 의존·런타임 데이터는 폴더 탐색에서 제외하되 시험 진입점은 명시한 경우 포함한다. 모든 이미지·음원 바이트의 불변이나 배포 상태를 보장하지 않는다. 각 제품의 실제 파일 로딩·동작 검사는 원래 시험이 담당한다. 비교는 읽기 전용이고 결과를 자동으로 새 판의 승인으로 바꾸지 않는다.
