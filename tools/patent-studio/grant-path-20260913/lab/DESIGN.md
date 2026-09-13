# 원음 확인 계약 실험 — 현재 Core에 연결하는 로컬 어댑터

2026-09-13 · 구현 파일 `observation-contract.cjs` · 기존 Core 0.5 파일 수정 없음

## 이번 구현이 하는 일

실제 `../../core.cjs`의 `evaluate` 결과에서 **현재 보류 중이고 서로 다른 효과를 내는 후보 쌍이 있는 기록**을 찾는다. 같은 원음·발화·시도의 대상들을 묶고, 외부에서 제공한 단어 정렬 자료로 확인할 원음 범위를 계산한다. 그 원음·시도·후보 판본과 결과 종류를 계약에 담아, 실제 확인 결과를 반영할 때 같은 조건을 검사한다.

계약을 계산하는 것만으로 상태는 바뀌지 않는다. 유효한 실제 결과는 Core의 `review-original` 또는 `review-response` 사건으로 적용한다. 다시 `evaluate`하여 전사 자료·능력 기록의 상태를 얻는다. 전사 후보만 줄이고 문항·수행 시간·도움 범위·지원 해석 범위 등 나머지 조건을 자동 확인하지 않는다.

이는 실행 가능한 처리 관계의 구체화다. 등록 가능성, 선행기술 대비 성능 우월성, 학생의 실제 실력, 원음 인식 정확도를 입증하는 결과가 아니다.

## 공개 인터페이스

```js
const { compileObservationContracts, applyObservationReceipt } = require('./observation-contract.cjs');

const { contracts, unresolved } = compileObservationContracts(session, { alignments });
const result = applyObservationReceipt(session, contracts[0], receipt);
// result: { ok, reason, state, record, beforeCells, afterCells }
```

`session`은 현재 Core가 생성/처리하는 schemaVersion 1 세션이다. 잘못된 세션 자체는 Core 평가에서 예외가 날 수 있다. 올바른 세션을 전제로 계약·결과가 부적합하면 `ok:false`와 원래 `session` 객체를 반환한다. 원래 객체를 수정하지 않는다.

### 외부 제공 정렬

```js
{
  audioRef: '원음 내용 참조', utteranceId: 'original', epoch: 'e0',
  text: '친구를 만나서 카페에 갔어요',
  words: [
    { text: '친구를', startMs: 0, endMs: 600 },
    { text: '만나서', startMs: 600, endMs: 1200 },
    { text: '카페에', startMs: 1200, endMs: 1800 },
    { text: '갔어요', startMs: 1800, endMs: 2400 }
  ],
  sourceRef: '정렬 제공 근거 참조'
}
```

문자열은 NFC 정규화와 앞뒤/연속 공백 정리 후 공백 단어로 비교한다. 한글 형태소나 음소를 자동 분석하지 않는다. 후보마다 원음·시도가 일치하는 정렬이 정확히 하나 있어야 한다. 단어 수·단어열, 시간 순서, 원음 길이 안의 양수 구간을 검사한다. 실제 정렬 정확도는 검증하지 않는다.

### 계약

필수 구조는 `id`, `baseRevision`, `evidenceFingerprint`, `source:{audioRef,utteranceId,epoch}`, `range:{startMs,endMs,basis}`, `targetIds`, `witnesses`, `candidateTexts`, `allowedResultKind:'source-audio-review'`이다.

추가로 원음 길이 `durationMs`, 범위 계산 근거 `rangeEvidence`, 자체 데이터 지문 `integrity`, 평가 코드 식별 `engineIdentity`를 담는다. `engineIdentity`에는 실제 적재한 Core의 VERSION, Core 및 그 직접 의존 모듈의 상대 경로·파일 내용 SHA-256, 그 묶음의 지문이 있다. 현재는 `core.cjs`, `projection.cjs`, `temporal-evidence.cjs`, `observation-planner.cjs` 네 파일이다. VERSION이 같아도 내용이 다르면 다른 계약으로 구분한다.

`witnesses`에는 실제 Core가 생성한 목표·목적·능력과 후보 쌍을 보존한다. 계약은 현재 발화별로 하나이며 모든 보류 목적의 witness 대상을 함께 다룬다. 현재 화면의 `session.purpose`만으로 다른 목적의 기록을 숨겨 잘못 승인하지 않는다.

## 원음 범위 계산

두 후보의 같은 접두·접미 단어를 제외하고, 달라진 단어들의 양쪽 정렬 구간을 포함하는 범위를 계산한다. 여러 차이 구간을 한 번에 재생할 수 있도록 시작의 최솟값과 끝의 최댓값으로 감싼다. 이 때문에 중간의 공통 단어도 들어갈 수 있다. 최소 길이·최적 재생 범위라고 부르지 않는다.

Core의 `witness`는 효과가 다른 최초 후보 두 개뿐이다. 셋째 후보가 다른 위치에서 갈리면 첫 쌍만 확인하고 셋째 후보를 제거하는 것은 확인 범위를 넘어설 수 있다. 따라서 **계약의 현재 후보 전체 쌍**을 추가 비교하여 그 차이 범위까지 포함한다. 이는 입력 후보 목록 내부의 보수적 범위 계산이며, 모든 가능한 음성 해석이 그 목록에 있다는 인증이 아니다.

토큰 편집거리의 최소 경로 중 삽입/삭제 경로가 가능하거나, 정렬이 누락·중복·불일치하거나, 정렬 출처가 없거나, 입력 한도를 넘으면 `range.basis='whole-source-audio-fallback'`으로 **전체 원음 [0,durationMs]**을 사용한다. `rangeEvidence.fallbackReason`에 이유를 남긴다. 정렬을 추정해 만든 것처럼 숨기지 않는다.

원음 참조가 없거나 길이가 없고/숫자가 아니고/0 이하이면 전체 원음 범위도 만들 수 없으므로 계약을 만들지 않고 `unresolved`에 남긴다. 예시 fixture의 가상 원음 존재 표지만으로 계약을 만들지 않는다.

## 실제 확인 결과

```js
{
  contractId: contract.id,
  kind: 'source-audio-review',
  source: { audioRef: '원음 내용 참조', utteranceId: 'original', epoch: 'e0' },
  range: { startMs: 0, endMs: 600 },
  remainingCandidateTexts: ['친구를 만나서 카페에 갔어요'],
  confirmed: true,
  eventId: 'review-고유식별자',
  at: '2026-09-13T12:00:20Z'
}
```

결과의 범위는 계약 범위를 모두 포함해야 하고 원음 길이를 넘어서는 안 된다. 후보는 현재 계약의 비어 있지 않은 부분집합이어야 한다. 새로운 단어열을 임의 추가하는 기능은 이 실험에 없다. 청취 후 새로운 후보가 발견되었다면 계약 결과로 승격하지 않고 새 후보 수집 후 재계약하는 경로가 필요하다.

여러 후보가 남아도 수신할 수 있으며, Core 재평가에서 효과 불일치가 남으면 보류한다. `confirmed:true`는 제공자가 확인했다고 제출한 입력이다. 사람이 실제로 들었다는 기계적 증명은 아니다.

## 거절과 재전송

| 조건 | 주요 reason | 상태 |
|---|---|---|
| 봉인 뒤 계약 데이터 변경 | `contract-integrity-mismatch` | 입력 상태 그대로 |
| 평가 코드 VERSION 또는 내용 묶음 불일치 | `engine-identity-mismatch` | 그대로 |
| 다른 계약 ID | `contract-id-mismatch` | 그대로 |
| 새 응답 등 다른 결과 종류 | `result-kind-ineligible` | 그대로 |
| 원음·발화·시도 중 하나 불일치 | `source-or-attempt-mismatch` | 그대로 |
| 확인 미완료 | `actual-confirmation-required` | 그대로 |
| 필요한 구간 미포함 | `review-range-insufficient` | 그대로 |
| 계약 밖 후보 | `candidate-outside-contract` | 그대로 |
| 다른 사건이 이미 반영되어 판본 변경 | `stale-revision` | 그대로 |
| 판본은 같은데 상태 내용 변경 | `evidence-fingerprint-mismatch` | 그대로 |
| 기존 사건 ID와 다른 계약/결과 | `event-id-conflict` | 그대로 |
| 같은 계약·같은 결과·같은 사건 재송신 | `idempotent-replay` | 추가 사건 없이 그대로 |

같은 오디오 바이트 참조라도 시도가 다르면 원래 수행에 쓸 수 없다. 재송신은 사건에 저장된 계약 지문·결과 지문이 모두 일치할 때만 멱등 처리한다. 정상 최초 반영 후 판본이 달라져도 같은 재송신은 추가 변경 없이 수용한다. 같은 사건 ID에 다른 후보·시각 등을 붙이면 충돌이다.

지문은 안정적으로 직렬화한 JSON과 코드 파일 바이트에 대한 SHA-256이다. 변경 검출과 상태/코드 결속을 위한 것이며 암호 서명이나 사용자 인증이 아니다. 공격자가 내용을 바꾸고 지문도 다시 만들 수 없는 신뢰 경계를 제공하지 않는다. 계약 원본은 신뢰된 저장소에서 가져온다는 전제이며, 공개 요청에 실린 임의 계약을 신뢰해도 된다는 보장이 아니다. 검증된 서버 발급 계약이라고 홍보하지 않는다.

## Core 사건과 재생

유효 결과는 실제 Core `applyEvent`에 다음을 전달한다.

- 원래 발화: `review-original`.
- 기존 새 응답의 원음 확인: `review-response` + 정확한 `responseId`.
- `alternatives`: 확인 뒤 남긴 후보.
- `confirmed:true`, 기존 `scopeConfirmed` 보존.
- `observationContract`: 계약/결과 지문, 평가 코드 식별, 원음·시도, 목표, 범위, 실제 결과 요약.

현재 Core는 `eventLog`에 사건의 헤더만 남기므로, 어댑터는 새로 반환된 상태의 해당 사건에 실제 `payload`를 부가한다. `record.event`에도 이를 반환한다. 입력 상태는 수정하지 않는다. `Core.applyEvent(preState, record.event)`만으로 평가 결과를 재생할 수 있다.

단, Core만 재생하면 그 로그의 payload는 다시 제거된다. **계약 메타데이터까지 보존하여 재생·재송신을 지원하려면 저장/재생 담당이 전체 사건 payload를 보존해야 한다.** 이 실험에서는 API·DB·저장기·실제 제품 연결을 수정하지 않았다. Core만 재생한 헤더 로그로 결과 지문을 확인할 수 없으면 이후 같은 ID 요청을 안전하게 충돌로 취급한다.

## 비용과 제한

최대 후보 40개, 후보당 단어 512개, 정렬 200개다. 후보 쌍 P개와 최대 단어 W에 대해 편집 경로 확인은 O(P×W²), 일반 범위 스캔은 O(P×W)다. 전체 후보 쌍을 검사하므로 가설 수에 제곱 비용이 있다. Core 평가의 기존 계획 탐색 비용도 그대로 남는다. 이 모듈이 더 빠르다고 주장하지 않는다.

같은 판본에서 같은 계약을 생성해도 같은 ID와 지문을 얻는다. 전체 세션 지문을 쓰므로 관련 없는 상태 변화에도 재계약이 필요할 수 있다. 이는 이번 실험의 단순하고 엄격한 판본 계약이며 최적 증분 무효화가 아니다.

어댑터는 범용 행동 최적화기·음성 인식기·정렬 생성기·사람 인증기·실제 도움 탐지기가 아니다. 관측 행동의 인지적 영향이나 학생에게 실제로 노출된 답의 모든 범위를 자동 계산하지 않는다. 등록성 판단을 대신하지 않는다.

A_CORE의 발전 설계에 있는 **실제 노출/새 수행 사건의 별도 참조 검증은 이번 receipt/contract에 구현하지 않았다.** 현재는 원음·시도·범위·후보·세션 판본·결과 종류의 데이터 귀속과 고정된 평가 코드 식별을 검사한다. `kind:'source-audio-review'`라고 제출된 내용이 실제로 그런 행동이었는지는 외부 사실이다. 새 수행이 발생했는데 발신자가 이를 숨기고 원래 원음 정보를 적는 것까지 탐지했다고 주장하지 않는다.

코드 식별은 어댑터 초기화 때 한 번 캡처하여 그 프로세스 동안 고정한다. 그때 이미 캐시된 Core/의존 모듈이 있다면 적재 코드와 당시 파일 내용이 일치하는 **신뢰된 고정 코드 실행 환경**을 전제로 한다. 파일을 고쳐 놓고 낡은 모듈 캐시를 섞거나 런타임 객체를 변조하는 공격을 인증하는 장치는 아니다. 코드 변경은 새 프로세스로 실행해야 새 지문으로 비교된다. 실행 중 디스크 파일 감시·자동 배포·핫 리로드·서명 검증을 추가하지 않았다. 직접 의존 범위 밖의 Node 런타임/내장 모듈 바이너리 전체를 봉인한 것도 아니다.

## 작성자가 직접 확인한 스모크

2026-09-13: `node --check` 통과. 학생 자료 없이 인메모리 합성 세션으로 다음을 확인했다.

- 두 조사 후보의 외부 정렬에서 0~600ms 계약 생성.
- 계약 생성과 결과 적용 모두 입력 객체 불변.
- 유효 확인 뒤 ASR 자료는 반영, 미확인 시간/문항 조건의 능력 기록은 보류 유지.
- 원음 참조 유지, 새 응답 결과 종류와 계약 변경 거절.
- 동일 사건 재송신 멱등, `record.event` Core 재생 후 cells 동일.
- 후속 코드 판본 보강: 계약에 기록된 4개 파일 지문을 디스크 원본과 대조. VERSION을 유지하면서 코드 내용 지문만 다른 유효 형식 계약은 `engine-identity-mismatch`로 거절.

보강 후 root가 작성한 독립 시험 `observation-contract.test.cjs` 21개를 다시 실행하여 21개 통과/0개 실패를 확인했다. 시험은 계약 처리의 지정 반례에 대한 것이며 등록성이나 사람의 실제 청취를 검증하지 않는다.

독립 반례·전체 시험 결과는 root의 별도 시험과 독립 검수 자료를 따른다. 이 문서는 그 시험을 대신 통과했다고 주장하지 않는다.
