## 판정: 적용 가능

JS 개선판을 `tools/영상사전검사.mjs`의 실제 `compareText`에 연결하는 이번 후보는 적용해도 됩니다. P0·P1 결함은 찾지 못했습니다. 아래 P3 세 건은 시험·유지보수 보완 제안이며 적용을 막지 않습니다.

### 근거

**정확성.** 공유 구현 `tools/lib/text-compare.mjs`의 `distanceJs`를 줄 단위로 따라가며 다음을 확인했습니다. 앞뒤 공통 부분을 뺀 뒤 긴 쪽을 a로 두므로 n ≥ m이 보장됩니다. 상한 `upper`는 「자리별 치환 + 꼬리 삭제」 편집열의 비용이라 항상 유효한 상한입니다. 시작 대역은 `min(upper, max(4, n−m))`이라 항상 n−m 이상이고, 따라서 끝 칸 (n, m)이 대역 안에 들어 `row[low−1]` 접근이 범위를 벗어나지 않습니다. 비용 d 이하의 경로는 모든 칸에서 |i−j| ≤ d를 만족하므로, 대역 밖을 band+1로 두는 계산은 참값이 band 이하일 때 정확히 참값을 내고 그보다 크면 band를 넘는 값만 냅니다. 행 최소값이 band를 넘으면 조기 중단해도 안전하고, 중단하면 `distance`가 infinity로 남아 넓히기로 갑니다. 공통 앞부분을 뺀 뒤 m > 0이면 a[0] ≠ b[0]이라 upper ≥ 1이고 대역이 매번 두 배로 커져 upper에서 멈추므로 무한 반복이 없습니다. 행 값은 최대 12,000 + band + 1 ≈ 24,002라 Uint16 범위 안입니다. 근사값을 돌려주는 경로는 없습니다.

**호환성.** `prepare`의 정규화 식은 기존 `normalize`와 글자 하나까지 같습니다. `Uint32Array.from(문자열, fn)`은 문자열 반복자를 쓰므로 `[...문자열]`과 같은 코드포인트 단위이고, 보조 평면과 홀로 남은 서로게이트 처리도 같습니다. 12,000자 검사는 두 입력을 모두 정규화한 뒤에 같은 문구로 던지므로 오류 순서·문구가 같습니다. 결과 객체는 다섯 필드가 같은 순서이고 similarity 산식도 동일한 부동소수 연산입니다.

**실제 연결.** `compareText`는 이름·동기 호출·인수를 유지한 채 위임만 합니다. `inspectMedia`의 자막·받아쓰기 두 경로, 0.95 미만 경고, 빈 입력 검사, CLI 종료 코드, 원본 지문 대조는 손대지 않았습니다. `tools/올리기전검사.js`는 대본 없이 `inspectMedia`만 부르고, `tools/완성본등록.mjs`는 검사 JSON만 읽으므로 영향이 없습니다.

**검증 독립성.** `baseline.mjs`를 HEAD(ff88b00b7)와 e93481078의 원본 `compareText`·`normalize`와 대조했고 본문이 동일합니다. `lib/text-compare.mjs`는 e93481078의 `compare.mjs`와 첫 줄 주석만 다릅니다. 시험은 운영 입구(영상사전검사.mjs)를 고정 기준선과 비교하므로 자기 자신과 비교하지 않습니다. 두 시험 파일을 이 워크트리에서 직접 다시 돌려 12개 통과, 실패 0, 생략 0을 확인했습니다. Rust 시험도 실제로 돌았고 WASM 해시가 원자료의 기록과 일치했습니다.

| 항목 | 값 |
|---|---|
| 재실행 결과 | 12 통과 · 0 실패 · 0 생략 |
| WASM SHA-256 | 0b9f1ac1… (원자료 기록과 일치) |

**성능 보고.** README 표의 열 행과 콜드스타트 중앙값, WASM 크기를 원자료 JSON의 21행과 대조했고 모두 일치합니다. 원자료 어느 행에서도 후보가 기준선보다 느리지 않았습니다. 합성 입력이며 완전히 다른 글에서는 약 2.4배에 그친다는 한계를 README가 스스로 적고 있어 과장으로 보지 않습니다.

### 지적 (모두 P3, 적용을 막지 않음)

- **시험 이름과 실제 경로가 다름.** `tests/text-compare-bench.test.mjs:42-43`의 삽입·삭제 변형은 앞뒤 공통 부분을 빼고 나면 한쪽이 비어 `if (!m) return n` 경로만 탑니다. n > m > 0에서 대역을 넓히는 경우는 cases.mjs의 100자 미만 난수에만 기대고 있습니다. 치환과 이동을 한 입력에 섞은 변형을 하나 더 두면 좋겠습니다.
- **오류 문구는 후보끼리만 대조.** 같은 시험 6·26줄은 `LIMIT_MESSAGE`를 후보에서 가져와 후보에 대고 단언합니다. 지금은 기준선 문구와 같다고 확인했지만, 기준선이 던지는 메시지와 비교하는 편이 독립성 취지에 맞습니다.
- **정규화 식이 두 곳에 복제됨.** `tools/영상사전검사.mjs:19`의 빈 입력 검사용 `normalize`와 `tools/lib/text-compare.mjs:9`의 식이 같은 내용의 복사본입니다. 한쪽만 고치면 「비어 있다」 판정과 비교 결과가 어긋날 수 있으니 lib에서 내보내 함께 쓰는 쪽을 권합니다.

참고로 `.test.mjs` 시험은 `npm test`(tools/test-ci.js)와 push 전 관련 시험 선별 무늬(`tests/*.test.js`)에 들지 않고, push 뒤 wide-tests 워크플로와 일일 예약에서 돕니다. 이번 변경 전부터 그렇던 조건이라 지적으로 올리지 않습니다.

### 읽은 범위와 한계

변경 파일 8개 전체, diff.patch, 의존 파일 6개(올리기전검사.js는 머리말과 영상 검사 호출부, 완성본등록.mjs·cases.mjs·rust.mjs·lib.rs·cold-start.mjs 전체), 시험.tap, 배경, 페이블자료.json을 읽었습니다. 원자료 JSON은 환경·방법·해시와 21행의 결과·중앙값·배수를 뽑아 README와 대조했고 표본 배열 전체는 훑지 않았습니다.

입력 해시는 묶음이 utf8-lf 꼴로 잰 것입니다. 이 워크트리는 core.autocrlf가 켜져 있어 추적 파일의 원시 바이트가 CRLF라, 바뀐 추적 파일 6개는 원시 해시가 목록과 다르게 나왔고 CR을 떼는 셸 파이프는 권한 거부로 돌리지 못했습니다. 대신 의존 파일 6개는 HEAD 블롭 해시가 목록과 정확히 일치했고, 새 파일 2개(baseline.mjs·compare.mjs)와 시험.tap도 일치했으며, 바뀐 6개의 내용은 diff.patch와 글자 단위로 맞음을 확인했습니다. 시험 재실행 외에 임의 입력을 따로 돌리는 스크립트 실행은 허용되지 않아 알고리즘 판단은 코드 추론과 기존 시험에 근거합니다.

### 2단계 · 아르곤

호출자 설명대로 이번 변경은 GPT 작성이며 아르곤 선행 검수는 수행되지 않았습니다. 아르곤지적표.md에는 「(지적 없음)」만 있어 처리 확인 대상이 없으므로 argonReview는 비워 둡니다. 「아르곤이 보고 문제가 없었다」는 뜻이 아닙니다.

```json
{"findings":[{"grade":"P3","location":"tests/text-compare-bench.test.mjs:42-43 · 대역 확대 시험의 삽입·삭제 변형","quote":"original.slice(0, 100) + '힣'.repeat(edits) + original.slice(100), original.slice(0, 100) + original.slice(100 + edits)","problem":"앞뒤 공통 부분을 뺀 뒤 한쪽이 비어 distanceJs의 `if (!m) return n` 경로만 탄다. 시험 이름이 말하는 삽입·삭제 이동에서 n > m > 0으로 대역을 넓히는 경우는 cases.mjs의 100자 미만 난수에만 기대고 있다.","fix":"치환과 이동을 한 입력에 섞은 변형(예: 50번째 치환 + 150번째부터 10자 삭제)을 더해 공통 부분 제거 뒤에도 n > m > 0이 남게 한다."},{"grade":"P3","location":"tests/text-compare-bench.test.mjs:6,26 · 제한 오류 단언","quote":"assert.throws(() => compare(a, b), { message: LIMIT_MESSAGE });","problem":"LIMIT_MESSAGE를 후보(compare.mjs → lib/text-compare.mjs)에서 가져와 후보에 대고 단언한다. 지금은 baseline.mjs의 문구와 같음을 확인했지만, 후보 문구가 바뀌어도 시험이 잡지 못한다.","fix":"기준선도 같은 입력으로 throws 시켜 error.message가 서로 같은지 비교한다."},{"grade":"P3","location":"tools/영상사전검사.mjs:19 · tools/lib/text-compare.mjs:9 · normalize 복제","quote":"const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\\p{L}\\p{N}]/gu, '');","problem":"빈 입력 판정(142~147줄)은 영상사전검사.mjs의 복사본을, 비교는 lib의 복사본을 쓴다. 지금은 동일하지만 한쪽만 고치면 「비어 있다」 판정과 비교 결과가 어긋난다.","fix":"lib/text-compare.mjs에서 normalize를 내보내 영상사전검사.mjs가 같은 함수를 쓰게 한다."}],
 "argonReview":[],
 "coverage":{"reviewed":"변경 파일 8개 전체(tests/text-compare-bench.test.mjs, tests/영상사전검사.test.mjs, tools/lib/text-compare.mjs, tools/text-compare-bench/{README.md,baseline.mjs,bench.mjs,compare.mjs}, tools/영상사전검사.mjs)와 diff.patch, 의존 파일(tools/올리기전검사.js 머리말·checkVideo 호출부, tools/완성본등록.mjs 전체, cases.mjs·rust.mjs·cold-start.mjs·rust/src/lib.rs 전체, evidence/20261031.json의 환경·방법·해시·21행 결과·중앙값·배수), 시험.tap, 배경, 페이블자료.json, HEAD와 e93481078의 원본 compareText·compare.mjs. 두 시험 파일을 워크트리에서 재실행해 12 통과·0 실패·0 생략 확인, WASM 해시 0b9f1ac1… 원자료와 일치 확인.","limitations":"원자료 JSON의 표본 배열 전체는 훑지 않았다. 묶음 해시는 utf8-lf 꼴인데 이 워크트리는 core.autocrlf=true라 바뀐 추적 파일 6개(F1·F2·F3·F6·F8·F12)의 원시 바이트 해시가 목록과 달랐고 CR 제거 파이프는 셸 권한 거부로 돌리지 못했다. 그 6개는 내용을 diff.patch와 글자 단위로 대조했고, 의존 파일 6개(F4·F5·F9·F11·F13·F14)는 HEAD 블롭 해시, 새 파일 2개(F7·F10)와 시험.tap(E1)은 원시 해시가 목록과 정확히 일치했다. 임의 입력 스크립트 실행은 허용되지 않아 알고리즘 판단은 코드 추론과 기존 시험 재실행에 근거한다. 아르곤 선행 검수는 수행되지 않았다.","complete":true,"missing":[]},
 "seen":["F1-3a6a864f","F2-cccfe934","F3-1bbee478","F4-5dae0bf8","F5-4d954710","F6-0de35287","F7-d638db1f","F8-cb1a7017","F9-efbccf11","F10-592bf2ab","F11-018496b0","F12-f227b0ff","F13-69036b40","F14-eb1b8bac","E1-0b82ed51"],"reviewInputHash":"55749920780ba62a9449d8d252256585ae489e187f442fd142867024ab73f1ef","endMarker":"END_OF_FINAL_REVIEW_55749920780ba62a9449d8d252256585ae489e187f442fd142867024ab73f1ef"}
```

END_OF_FINAL_REVIEW_55749920780ba62a9449d8d252256585ae489e187f442fd142867024ab73f1ef