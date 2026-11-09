# 완료된 회사 배포판 보존과 다음 후보 만들기

삭제되는 워크트리의 `.tmp`를 다음 배포의 필수 입력으로 두지 않는다. 완료된 배포판의 소스와 완료 증거를 공용 작업본의 별도 폴더에 보존하고, 그 보존본에 명시된 변경만 얹는다. 이 도구는 로컬 파일만 만들며 배포·승인을 실행하지 않는다.

## 완료판 보존

```text
node tools/company-release/closed-release.cjs preserve <입력.json>
node tools/company-release/closed-release.cjs verify <보존본> <봉인파일-SHA256>
```

입력은 절대 경로 `root`, 새 절대 경로 `output`, `pins`를 갖는다. `pins`의 각 항목에는 `root` 기준 상대 `path`, 확인된 `sha256`, `bytes`를 넣는다.

| 항목 | 원문 |
|---|---|
| manifest | 후보 `release-manifest.json` |
| images | `image-payload.json` |
| selection | `operator-input.json` |
| receipt | 실제 Linux 시험을 통과한 `deployment/reviewed-candidate-receipt.json` |
| approval | 완료된 재무장의 `approval-input-vN.json` |
| contract | 같은 재무장의 `contract-final-vN.json` |
| postcheck | 계약과 짝인 `arm-postcheck-final-vN.json` |
| validator | 그 판의 `rearm/postcheck.cjs` |

소스·이미지 목록, 선택 시험, 실제 Linux 시험 영수증, 승인 입력과 계약의 해시, 계약과 사후 확인의 해시·요청·판이 맞아야 한다. 핀으로 고정한 기존 검증기를 저장된 스냅숏의 수집 시각으로 다시 실행한다. 소스 누락·추가·변조·링크, 실패한 시험, 짝이 다른 재무장 증거는 거절한다. 기존 출력 폴더는 덮지 않는다.

보존·후보 생성은 같은 상위 폴더의 새 `.preparing-*` 임시 디렉터리에서 파일 바이트와 검증을 마친 뒤 최종 이름으로 바꾼다. 실패한 임시 디렉터리는 진단용으로 남으며 최종 경로는 생성되지 않는다. 검증 중 최종 경로가 다른 작업에 의해 생성돼도 덮지 않는다.

보존본의 `completed-release.json` SHA256을 다음 입력에 고정한다. 보존은 과거 완료의 재검증이다. 지금 서버가 같은 판인지, 지금 배포해도 되는지는 별도로 확인한다. 운영 인프라 정보가 있는 보존본·핀·실행 증거는 공개 저장소에 올리지 않는다.

## 다음 후보

```text
node tools/company-release/compose.cjs <입력.json>
```

입력은 `parent`, `sealSha256`, `carryFile`, `carrySha256`, `output`을 갖는다. 경로는 절대 경로다. 변경 명세에는 `parentManifestSha256`, `files`가 있고 각 파일은 `path`, 부모의 `beforeSha256`(새 파일은 `null`), 새 `sha256`, `bytes`를 갖는다. 새 바이트는 명세 옆 `files/<path>`에 둔다.

부모의 모든 소스·이미지·선택 시험을 보존하고 명세의 파일만 교체·추가한다. 이미 선택에서 빠진 시험을 바꾸면 별도 판단이 필요하므로 멈춘다. 새 시험은 선택에 추가한다.

부모 파일은 지우지 않는다. git에서 지운 시험이 새 코드에서 실패하면(사슬 56 메신저 `chat-categories.test.mjs`) 명세의 `retiredTests`(`path` · 부모 `sha256` · 열 자 이상 `reason`)로 선택에서만 뺀다 — 파일은 부모 바이트 그대로 소스와 이미지에 남고, 같은 경로를 `files`에 함께 적거나 선택에 없던 시험 · 바이트가 다른 시험을 적으면 멈춘다. 결과는 `droppedSelectedTests` · `retiredTests`에 남는다. 지운 화면 파일(부르는 곳 없음)도 같은 까닭으로 부모 바이트가 남는다. 반대로 부모 원천에는 있지만 선택 밖이라 어느 QA도 돌리지 않던 시험을 커밋이 그 대상 모듈과 함께 고쳤으면(사슬 57 `client-closeout.test.mjs` — 3c 서버 커밋) 명세의 `adoptedTests`(`path` · 부모 `beforeSha256` · 열 자 이상 `reason`)로 들인다 — 그 시험은 넘김 바이트로 선택과 이미지에 들어가 후보 QA가 돌린다. 줄이 없으면 그대로 `EXPLICIT_RETIRED_TEST_DECISION_REQUIRED`로 멈추고, 넘기지 않은 시험 · 이미 선택된 시험 · 부모 바이트가 다른 시험 · 시험 이름이 아닌 파일을 적어도 멈춘다. 결과는 `adoptedTests`(+ `addedSelectedTests`)에 남는다. 결과는 `prepared-local-qa-required`이며 검수·Linux QA·실제 배포를 통과했다는 표시를 만들지 않는다.

이후 기존 배포 절차의 검수, 현재 운영판·소유권 확인, Linux 격리 시험, 완료된 반영 전 백업, 자료 보존 검사, 공개 대조, 재무장과 최종 사후 확인을 그대로 수행한다. 과거 생성기를 다시 실행하거나 옛 검수 증거를 새로 승인한 것으로 바꾸지 않는다.

## 격리 로컬 QA와 소스 벡터

```text
node tools/company-release/local-qa.cjs <입력.json>
```

입력은 절대 경로 `candidate`(compose의 출력), 고정 `compositionSha256`, 새 절대 경로 `output`, `guard: {path, sha256}`, 양의 정수 `expectedTests`를 갖는다. `guard`는 검토한 외부 통신 차단기 원문과 핀이다. 필요한 경우 절대 경로 `dependencyRoots` 배열로 기존 시험 의존성만 명시한다.

선택 시험이 manifest 안에 있는지 확인하고 저장소 밖 OS 임시 폴더의 별도 사본에서 실제 `node --test`를 실행한다(끝나면 사본을 지운다). 저장소 안에서 돌면 Node가 위 폴더를 거슬러 저장소 `node_modules`를 찾아 Linux QA 컨테이너에서는 뜨지도 않는 시험이 통과한다(사슬 58 acorn). 사용자 자격증명·NODE_OPTIONS·운영 기능 환경 변수는 이어받지 않고 HOME·APPDATA·임시 경로도 새 격리 폴더로 준다. 원본과 시험 사본의 전후 벡터 네 개, TAP·종료 코드·정확한 기대 건수, 실행기·검증기·차단기의 해시를 남긴다. 통과한 시험이 소스를 바꿔도 QA는 실패한다. 실패 보고도 `failed-local`로 보존하며 CLI는 실패 종료한다. 여기서 Linux 검증·운영 승인 표시를 만들지 않는다.

## 복구한 준비 기록의 원본 핀 대조

```text
node tools/company-release/prepared-integrity.cjs <입력.json>
```

입력은 검증할 절대 경로 `root`, 고정 원문 `original`·`originalRearm`·`changes` 각각의 `{path, sha256}`, 기존 완료 표지의 `readySha256`이다. 현재 바이트에서 기대 해시를 새로 만들지 않고 기존에 기록한 핀을 넣는다.

원래 출력 전량과 명시한 메타데이터4개, 준비 문서·재무장 원천 문서2개의 before/after를 대조한다. 현재 출력 목록의 중복·누락·추가·다른 핀, 원본 목록 밖 메타데이터, 원본 QA/TAP 핀 누락은 거절한다. QA와 TAP·manifest·완료 표지가 서로 같아야 한다. 이 검사는 읽기 전용이며 검증 결과를 배포 승인으로 쓰지 않는다.

이후 별도 검수를 받아 수정한 파일은 당시 준비 원문에 몰래 재핀하지 않는다. 수정 전 바이트와 명시적 수정 기록, 그 후 검수의 최종 파일 SHA를 별도 사슬로 연결한다. 현재 작업본에서 새로 고친 도구·시험에 옛 검수 승인을 재사용하지 않는다.

35판 전용 `prepare-operators-35`·`prepare-rearm-35`는 당시 생성·검수의 보존 원문이다. 재사용 API로 삼지 않는다. 반복 가능한 후보 준비·시험·복구 대조는 위 저장소 도구에서 수행하고, 운영 도구의 새 판 포트는 해당 변경과 실제 검수 사슬로 별도 고정한다.

## 봉인된 부모(사슬 39부터)

```text
node tools/company-release/sealed-approval.cjs seal <입력.json>
node tools/company-release/sealed-approval.cjs verify <봉인 폴더> <봉인 SHA256> <완료 보존본> <보존본 봉인 SHA256>
```

옛 설계 판의 재무장은 부모 판 `rearm/approval.cjs`의 `loadApproval`을 부르고, 그 부모가 다시 그 부모를 불러 승인 사슬 끝(10-13 모듈)까지 내려가며 판마다 후보 전체와 기록을 다시 읽는다. 재무장 입력 그래프(`rearm-prepare-fresh.cjs`의 `graph()`)도 승인 입력·무장 계약·무장 해제 기준 속 승인 증거 핀을 따라 사슬 끝까지 간다. 그래서 옛 판 폴더 수십 곳이 늘 필요했다. 봉인된 부모 설계는 이 둘을 끊는다.

- **승인 결과 봉인**: 판 P가 무장하고 완료판 보존(`closed-release.cjs preserve`)을 마치면, 같은 자리에서 `seal`이 P의 `loadApproval(<P 보존본>/evidence/approval.json)`을 따로 띄운 node로 한 번 돌려 결과를 `.tmp/company-approval-<manifest 앞 8>-<날짜>/`에 봉인한다(`approval-result.json`은 키 순서 그대로, `approval-seal.json`은 schema `synk-company-approval-result/v1` — 보존본 봉인 SHA, 승인 입력·계약·사후 확인·receipt SHA, 결과 SHA, 사슬 길이·끝 줄, 계산한 모듈과 방식). 입력은 `completed`·`completedSealSha256`·`module {path, sha256}`·`output`(절대 경로). **옛 설계 P(사슬 38까지)는 이때 옛 계보 전체가 마지막으로 필요하다** — 그래서 「실측 계보」 절은 P 봉인이 끝난 뒤에 줄인다. 봉인은 과거 검증의 기록이고 지금 운영 상태·배포 허가가 아니다.
- **믿기(`load`)**: 자식 판 승인 모듈은 부모 모듈을 부르지 않고 `load(SEALED_PARENT, e.previousApproval)`로 부모 결과를 받는다. 매 호출마다 보존본 `verify` 전부(후보 해시·증거 핀·계약↔사후 확인 짝·봉인된 검증기로 사후 확인 재계산), 승인 봉인 핀과 결과 바이트·왕복, 결과 ↔ 보존본 결속(같은 release·승인 입력 SHA·receipt, 그리고 **무장 계약이 결과에서 옮겨 적은 `deploymentChain`·`nextPlan`·`deployment`·`history`·`runtimeTransition`·`priorArm`·`expected`와 같음** — 봉인 SHA를 바꿔치기해도 부모가 실제로 무장한 계약과 어긋나면 잡힌다), 일반 사슬 확인(이음·시각·끝 줄 ↔ 계약·증거, priorArm)을 다시 보고, `previousApproval`이 정확히 봉인된 부모 입력인지 본다. 그 뒤 자식 자신의 검증(무장 계약·사후 확인, 라이브 무장 해제 기준, 자식 패키지 캡슐)은 그대로이고, 옛 HA 보기 겹이 하던 「부모 결과 런타임 넷 = 이 판 `ha-runtime-deployed-pins.json`의 runtime」 교차 확인(`haRuntimePinned`)은 남긴다(그 겹의 `ha-runtime-view/`는 더 읽지 않는다). 믿음의 닻 `SEALED_PARENT`(두 봉인의 경로·SHA, 부모·조부모 manifest, 사슬 길이)는 자식 코드에 박는다.
- **입력 그래프 경계**: 봉인 역사 H(`history()` — 보존본 approval·contract·postcheck와 봉인 결과 안의 모든 (경로, SHA) 핀, 핀으로 고정한 바이트에서만)는 `graph()`의 안쪽 걷기에서 잡지도 따라가지도 않는다(같은 경로라도 SHA가 다르면 잡는다). 위에서 직접 잡는 입력(`STATIC_KEYS`·fresh 증명·`approvalPins`의 맨 위 핀·리뷰 증거)은 그대로 TOCTOU 핀이 되고, 믿음의 닻 파일 셋(두 봉인·봉인 결과, `anchors()`)도 부모 결과 뒤 핀으로 잡아 계약을 쓰기 직전 다시 대조한다. 경계는 승인 모듈이 `SEALED_PARENT`를 내보낼 때만 켠다(없으면 옛 걷기 — 더 읽을 뿐 검증은 같다).
- **DR 묶음**: 격리 복원(비연습) 묶음은 그 묶음 판의 `adapter.cjs`가 자기 판 `../approval.cjs`를 다시 불러, 옛 설계 판 묶음이면 옛 사슬 전체를 다시 요구한다 — 그래서 옮긴 `prepareFresh`는 `verifyDr` 바로 앞에서 비연습 묶음이 이 판 폴더 안의 것일 때만 받는다(`SEALED_PARENT_DR_BUNDLE_OUTSIDE_RELEASE`). 주간 연습 묶음은 그대로이고, 연습이 앞 판 것보다 새롭지 않으면 앞 판 정적 입력의 경로를 물려받아 여러 판 앞 폴더일 수 있다(37 · 36은 10-22 `teacher-copy-23-release-20261022` 묶음) — `lineage.cjs` ①′가 그 길을 잰다.
- **옮기기**: 다음 판 생성기는 `trusted-parent-port.cjs`로 앞 판 원천을 옮긴다 — `portApproval`(부모 require·재귀·HA 보기 겹·부모 검증기 require → 봉인 믿기 + `haRuntimePinned`, 앵커가 정확히 한 번씩), `approvalBase`(맨 밑 도우미와 같은 정의 + 생성 때 옛 모듈에서 복사한 값, `baseEquivalence`로 옛 모듈과 같은 답인지 확인한 뒤에만), `portPrepare`(`REQUIRED_QA`에 새 파일 셋 — `verifyDr` 본문은 판 시험이 떼어 평가하므로 그대로), `portPrepareFresh`(H 경계·닻 핀·DR 묶음 제한, `{prepareSha256}`으로 `CANONICAL_REVIEW_SHA`를 옮긴 `prepare.cjs`에 맞춤), `portLocalInputs`(안 쓰는 부모 폴더 변수), `vendorFiles`(이 폴더의 `closed-release.cjs`·`sealed-approval.cjs`를 판 `rearm/sealed/`로 바이트째). 운영 값은 생성기(.tmp)가 넘기고 저장소에는 두지 않는다. 첫 옮김(38 → 39)만 옛 모듈이 있어야 하고, 그 뒤로는 `approval-base.cjs`를 같은 바이트로 이어 옮긴다. `deployment/parent-arm-pin.json`은 operators 생성기(p<N>-operators)가 쓰므로, 그 생성기가 두 봉인 핀(`completedSeal`·`approvalSeal`)을 함께 적고(기존 approval·contract·postcheck 키는 그대로) 앞 판 봉인이 없으면 operators·rearm 생성기 모두 멈춘다.
- 순서: 판 P 무장 → 완료판 보존 → `seal`(→ `verify`) → 다음 판 생성기가 `SEALED_PARENT`를 박아 옮김. **「실측 계보」 절은 지금 운영 판(마지막으로 무장한 판 — 다시 무장해야 할 수 있다)과 준비 중인 판의 합집합**(`lineage.cjs measure <운영 판> <준비 중 판> --절`)이라, 옛 설계 판(38)이 운영 판으로 남아 있는 동안은 옛 계보가 그대로 남는다. 첫 새 설계 판(39)이 무장하고 보존·봉인되면 그때 39(+ 준비 중인 40)로 다시 재서 절을 바꾼다(Fable 설계 검토 P1-2 — 39를 만든 것만으로 줄이면, 39 배포 전에 38을 다시 무장해야 할 때 옛 사슬이 없다).
- 리허설(2026-10-30): 37 판을 이 설계로 옮긴 사본 `.tmp/trusted-parent-rehearsal-37-20261030`(부모 = 봉인 36 `company-approval-62146584-20261030`)에서 ① 새 설계 `loadApproval` 결과가 옛 설계 37 결과와 바이트까지 같고(190,013바이트, 284초 → 3~15초), ② `prepare-arm` 메마른 실행(앞 판 정적 입력·DR 묶음 → 경계 넣은 `prepareFresh`)이 돌고, ③ 다시 지은 리뷰가 37 실제 리뷰와 바이트까지 같고(계약 `reviewSha256` 포함), ④ 재무장 Linux QA 원천이 877파일 · `.tmp` 56폴더 → 143파일 · 19폴더(QA 결과 목록 기준, 저장소 쪽 3곳은 같음), 판 재무장 단위 시험 111/111. 지금 절 가운데 리허설 계보(61곳) 밖 19곳을 프로세스 안에서 막은 채로도(그 경로를 ENOENT로, 막은 폴더 접근 0회) 같은 결과였다. 공용 `.tmp`에서 이름을 바꿔 숨기는 확인은 하지 않기로 했다(10-30) — child_process 일곱 함수를 감싼 채 두 믿는 길을 돌린 실측에서 자식 프로세스가 0회였다(리허설 `loadParent` 0.7초 · 자신의 `loadApproval` 4~6초). 불러오는 옛 모듈 가운데 child_process를 부르는 것은 있지만(실행 때 불린 28모듈 중 4 · 정적 require 닫힘 47파일 중 14) 이 두 길에서는 쓰이지 않으므로, 프로세스 안 막기가 두 길을 다 덮는다(`prepare-arm` 메마른 실행과 ③은 이렇게 재지 않았다). 절을 줄이는 관문은 39가 무장 · 봉인된 뒤 39 실물로 다시 재는 측정(①·①′·②·③)이고, 진행 중인 38 작업과 같은 `.tmp`라 이름 바꾸기는 그쪽을 끊을 위험만 있다. 진짜 봉인 자료 부정 시험 8건(결과 한 바이트 · 다른 판 결과로 바꾸고 봉인 다시 씀 · 사슬 한 줄/history 바꾸고 봉인 다시 씀 · 다른 보존본 핀 · 다른 판 입력 · 사슬 길이)은 모두 막혔다. 남는 계보 61곳 중 대부분은 판마다 늘지 않는 도구 고리다(아래 「계보 실측」).

확인: `node --test tests/company-release-sealed-approval.test.cjs tests/company-release-lineage.test.cjs`

## 고정 도구 고리를 판 안으로(사슬 56부터)

봉인된 부모 뒤에도 판 계보(재무장 · 배포 도구가 쓰는 `.tmp` 폴더)는 55 기준 54곳 6.41GiB였고, 그 대부분이 판마다 늘지 않는 옛 도구 고리였다. 사슬 56 생성기가 `tool-ring-port.cjs`로 그 셋을 판 안으로 옮기거나 걷었다(글자만 바꾸고 실행하지 않았고, 같음 확인만 옛 사슬을 불렀다). 한 번 쓰는 변환이라 57부터 부르지 않아 11-09에 도구와 시험을 걷었다 — 코드는 커밋 `b676d48af5`, 56 생성기가 고정한 판 SHA는 `423eaba0…`다.

| 고리 | 들어오던 길 | 옮김 |
|---|---|---|
| G1 scope 상속 | 판 `deployment/scope.cjs`가 `company-sns-auth-20261016/deployment/scope.cjs`부터 14판을 거쳐 맨 밑 `pulse-workspace-integration-20261013/scope.cjs`까지 부름(판 자신의 `loadApproval` · 배포 도구가 실행) | `scopeBase` → 판 `deployment/scope-base.cjs`: 판이 받던 것(도우미 `sha · safeName · readRegular · verify · writeNew`, 상수 `COMPANY · PUBLIC · MESSENGER · WORKERS · RUNTIME_NAMES`, `prior`)만. 도우미는 맨 밑 정의 문장을 바이트 그대로 자르고(살아 있는 함수의 `toString()`이 원문에 정확히 한 번), 상수와 `prior`는 옛 사슬 내보내기에서 옮긴다. `portScope`가 상속 줄 하나를 `./scope-base.cjs`로 바꾼다 |
| G2 Codex 증거 거울 | `rearm-ops/rearm-prepare-fresh.cjs`의 `MIRROR = .tmp/business-automation-release-20261020`(이력 18 Codex v7 경로 → 거울) — 정적 닫힘이 그 판과 scope 꼬리(10-17~10-20 판들)를 끌어옴 | `portPrepareFreshMirror`가 걷는다. 봉인 설계에서는 그 길이 죽어 있다 — 안쪽 걷기는 봉인 역사를 건너뛰고, 맨 위 핀(부모 결과 inputPins · 앞 판 정적 입력 · 리뷰 증거 · QA)에 그 경로가 0이다. 그런 경로가 오면 이제 `LOCAL_REPOSITORY_PATH_REQUIRED`로 멈춘다(닫히는 쪽). 판 안 `evidence-carry` 거울(`CARRY_MIRROR`)은 그대로 |
| G3 ha-compat QA 흔적 | `rearm/linux-qa.cjs` sources()가 옛 승인 사슬 맨 밑 `pulse-harin-motion-20261012/ha-compat/{approval,postcheck}.cjs`를 실음 — 어떤 시험도 부르지 않고 `REQUIRED_QA` · verifyQa 요구에도 없음. 그 폴더 글자가 10-12 옛 판 6곳을 끌어옴 | `portLinuxQa`가 그 한 문장을 걷는다 |

- **같음 확인**(`scopeBaseEquivalence`, 첫 옮김에서 생성기가 반드시 부른다): 옛 사슬의 도우미 다섯이 맨 밑과 같은 함수 객체(사슬 중간이 덮지 않음), 새 도우미 글(`toString`)이 옛 것과 같음, 상수 · `prior`의 JSON · 꼴(배열 · 얼림)이 같음, 내보내기 열쇠가 정확히 그 열하나, 그리고 행동 — `sha`, `safeName`에 이름 13가지(받는 것 · 거절 꼴), 임시 트리에서 `readRegular`(파일 · 디렉터리 · 없음 · `..` · 링크와 링크 너머 파일) · `verify`(맞음 · 다른 다이제스트 · 남는 파일 · 링크 · 바뀐 바이트 · 빠진 파일) · `writeNew`(새로 · 있는 파일), 진짜 부모 후보 트리(판 scope.cjs `candidate()`가 통째로 읽는 것)의 `verify` 결과. 링크는 Windows에서 권한 없이 되는 junction이고, 못 만들면 `SCOPE_BASE_LINK_PROBE`로 멈춘다. 같은 글이라도 builtin을 바꿔치기한 꼴(가짜 crypto · strict가 아닌 assert)은 행동 대조가 잡는다(시험).
- **이어 옮기기**: 첫 옮김(55 → 56)만 옛 사슬이 있어야 한다. 57부터는 부모 판 `deployment/scope-base.cjs`를 같은 바이트로 옮기고(scope.cjs는 이미 `./scope-base.cjs`를 부른다), G2 · G3는 이미 걷힌 원천을 그대로 옮긴다.
- **56 생성기에 넣는 자리**(Fable 11-07 — 55 생성기 실물 기준): ① p56-operators는 deployment/ 파일을 부모 `operator-preparation.json`의 outputs 목록에서 골라 옮기므로(`p55-operators.cjs` 156~160행, 파일마다 `PARENT_OPERATOR_FILE_CHANGED_AFTER_PREPARATION`) `deployment/scope-base.cjs`를 outputs에 **직접** 더한다 — 그래야 57이 outputs로 물려받는다. ② `scopeBase` → `scopeBaseEquivalence`를 `oldChain = require(55 scope.cjs가 부르던 상속 모듈)` · `bottom = require(.tmp/pulse-workspace-integration-20261013/scope.cjs)` · `probes.candidate = {root: <부모 봉인 55>/candidate, manifestSha256: <55 manifest>}`로 돌린 뒤에만 쓴다. ③ 55 scope.cjs 글에 기존 자리 바꾸기(H · IMG · 부모 경로 — `GENERAL_SITES`의 개수 앵커)와 함께 `portScope`를 건다. ④ 끝의 `scope.candidate(); scope.runtimePin()` 자체 확인(217행)은 그대로. port-rearm56은 55 글에 `portPrepareFreshMirror` · `portLinuxQa`를 걸고 자기 바뀜 목록(`KNOWN` · 앵커 보고)에 넣는다(`CANONICAL_REVIEW_SHA`는 그대로).
- **판에서 바뀌는 것**: `deployment/scope.cjs`(바뀜) · `deployment/scope-base.cjs`(새로) · `rearm-ops/rearm-prepare-fresh.cjs`(바뀜 — `CANONICAL_REVIEW_SHA`는 `prepare.cjs` SHA라 그대로) · `rearm/linux-qa.cjs`(바뀜). 재무장 Linux QA 원천은 154 → 132(옛 사슬 21 · ha-compat 2 빠지고 scope-base 1 더함)이고, 판마다 그 판 원천으로 새로 돌며 `verifyQa`의 `COMPLETE_QA_SOURCE_CLOSURE`가 대조한다.
- **남기는 것**: 기반(봉인 역사에 (경로, SHA)로 박힌 증거를 재무장 맨 위 — approvalPins · buildReview · 676 게이트 — 가 그 경로로 읽는다) `platform-ha-20261011` · `pulse-workspace-integration-20261013` · `server-latency-20261013` · `company-api-ha-followup-20261101`(runtime43 서버 배포 작업자 — `WORKERS()`가 해시를 재고 QA가 `*.test.py`를 돌림) · `pulse-library-20261012` · `pulse-portfolio-server-audit-20261012` · `pulse-harin-motion-20261012`(맨 밑 scope.cjs의 prior 글자 · `compat.test.mjs` 기본 경로). 배포 때만 쓰는 옛 도구(정적 닫힘만) `company-messenger-recovery-release-20261018`(verify-public LEGACY) · `pulse-production-release-20261012` · `pulse-mobile-release-20261012`(disarm-operator · image-transfer), `synk-id`(`/api/synk-id/renew` 글자가 같은 이름 폴더에 걸린 거짓 양성). 이것들을 더 옮기려면 증거 경로를 계약 inputPins에서 바꾸거나 읽기 거울을 새로 둬야 하고 배포 도구 · inert 시험 수를 함께 바꿔야 해 후속으로 둔다.
- **리허설(2026-11-07)**: 55를 통째로 복사한 `.tmp/lineage-ring-rehearsal-55-20261107`에 이 셋을 그대로 적용하고, 같은 조작(자기 이름 바꾸기)만 한 기준 사본 `.tmp/lineage-ring-baseline-55-20261107`과 대조했다. 원격 0, 쓰기 · 자식 프로세스는 막은 채. **조리법**: 사본의 자기 경로는 코드 다섯(`arm-chain.cjs` · `rearm-chain.cjs` · `rearm/linux-qa.py` · rearm-ops 시험 둘)의 판 이름 글자, `ha-runtime-deployed-pins.json`의 `directory`, DR 결속 기록(`rearm/dr/binding-v1.json`)의 `path` · `preparationReviewPath` 둘만 사본으로 바꿨다(다른 json 핀은 원본 55 절대 경로 그대로 — 같은 바이트라 읽기만 원본으로 간다). 55의 DR 묶음은 주간 연습이 아니라 판 안 격리 복원이라 `SEALED_PARENT_DR_BUNDLE_OUTSIDE_RELEASE` 검사를 받으므로, 메마른 실행의 정적 입력은 사본 `rearm/` · `rearm/dr/`의 묶음으로 새로 핀했다(`rearm/rehearsal-static-inputs-v2.json`). QA는 원격 Linux를 못 돌려, 사본 `sources()` 목록만 적은 `rearm/rehearsal-qa-sources-NOT-LINUX-v1.json`(통과 표시 없음 · `linux-qa-result-v*.json` 이름 꼴을 피함)을 QA 자리에 넣고 `createHelper({dependencies})` 주입으로 `verifyQa`만 바꿔 끼웠다 — 나머지(`loadApproval` · `verifyDr` · `currentSnapshot` · `prepare` · `HISTORY`)는 판 실물이고 `sealedHistory` · `sealedAnchors`도 판 `sealed-approval.cjs`로 함께 넘겨 봉인 역사 경계 · 닻 핀이 실제로 밟힌다. ① 판 자신의 `loadApproval` 결과가 옛 판과 바이트까지 같다(196,769바이트 `8f57aebd…`, 읽는 `.tmp` 18곳 → 4곳, 34초 → 7초). 결과에는 scope 출력이 들지 않아(approval.cjs 79행은 `root`만 씀, Fable) `candidate()`(48열쇠 · raw · delta · 이미지 목록 · manifest) · `runtimePin()` · 내보내기 열쇠를 따로 깊이 대조해 같았다. ② `prepare-arm` 메마른 실행(prepareFresh를 원격 수집 `collectFresh` 직전까지)이 끝까지 돌고 25곳 56초 → 11곳 17초, 남은 기반 8곳은 읽는 파일까지 옛 판과 같음. ③ 55 실제 리뷰를 같은 입력 · 시각으로 다시 지으면 바이트까지 같다(`10965b93…`). ④ 줄어든 계보 밖 옛 폴더 38곳을 프로세스 안에서 없는 것으로 막은 채로도 ①~③이 같았고 막은 폴더 접근 0회 — 같은 막기에서 옮기지 않은 기준 사본은 첫 require(`company-sns-auth-20261016/deployment/scope.cjs`)에서 멈춘다. ⑤ 판 시험 188건이 두 사본에서 줄마다 같은 결과(187 통과, `compat.test.mjs`만 inert 이미지 밖이라 두 쪽 다 `ERR_MODULE_NOT_FOUND`). ⑥ `lineage.cjs measure` 리허설(QA 결과 v12는 55 원천 것이라 `rearm/held-qa-55-original/`로 치워 「QA 전」): **54곳 → 17곳**(그중 원본 55 폴더는 사본이 원본 파일을 핀으로 읽어서 든 것 — 실제 다음 판이면 자기 판이라 16곳), 정적 50 → 12 · 입력 그래프 25 → 11 · QA 원천 19 → 4곳, 남는 폴더 크기 약 1.6GiB(판마다 바뀌는 자기 판 · 넘김 · 부모 봉인 · 앞 판을 빼면 고정 몫 약 0.7GiB). 이 리허설 중 `lineage.cjs` ①′가 4x~55 판의 JSON 글자 꼴 `PARENT_STATIC`(`Object.freeze({"path":"C:\\…",…})`)을 못 읽어 앞 판 정적 입력을 조용히 건너뛰던 것을 고쳤다(Fable) — 이제 두 꼴을 다 읽고 모르는 꼴이면 `PARENT_STATIC_FORM_UNKNOWN`으로 멈춘다. 55에서 입력 그래프가 217 → 230파일(54 안 13파일)로 늘었고 폴더 목록은 같았다(54는 이미 정적 닫힘에 있었다).
- **순서**: 56 생성기가 이렇게 옮겨 56이 무장 · 보존 · 봉인되면 `lineage.cjs measure <56> [<준비 중 57>] --절`로 「실측 계보」 절을 다시 잰다. 그 전까지는 55가 운영 판이라 옛 고리를 포함한 55 계보를 절에 남긴다(위 「봉인된 부모」 순서와 같은 까닭). 11-07에 절을 55 실측(54곳) + 봉인 55 둘로 바꿨다 — 그 전 절은 45~53 시대 것이라 운영 사슬(55 판 · 넘김 · 54 판 · 봉인 54 · 55)이 닫힌 목록에 없었다.
- **공간은 절만으로 비지 않는다**(11-07 실측): `tmp정리목록.js`는 절 밖의 평범한 줄과 사흘 안 폴더를 뿌리로 그 언급을 끝까지 따라가 남긴다. 절을 56 꼴(지금 절에서 고리 38곳을 뺌)로 바꾼 흉내(그 파일 읽기만 바꿔 끼움, `--일수 3`)에서 고리 38곳 중 37곳이 그대로 남았다 — 붙잡는 뿌리는 같은 파일의 평범한 줄 `drill-layer-sim-20261022`(31곳) · `github-storage-20261017`(22) · `document-cleanup-publish`(15) · 사슬 40 · 47 · 48 판 폴더(14~15)와, 사흘이 지나면 빠질 50~55 판 폴더들이다. 그러니 고리 4.81GiB를 실제로 비우려면 56 무장 뒤 그 평범한 줄들이 아직 필요한지 따로 가려야 한다(지금 절을 바꾼 직후에도 정리 후보는 111 → 101개로, 닫힌 절에서 빠진 44~53 시대 16곳 중 9곳이 그런 줄로 남았다). **11-07 저녁 그 줄들을 가려 보니 겹친 붙잡이였다**: 정리 도구 계산을 그대로 따라 하는 흉내(실제 `--json --일수 3`과 후보 102 · 참조로 남김 430까지 같음)에서 평범한 줄을 **전부** 걷어도 새 후보는 4곳 25MB · 고리 0곳이었다(지금 절 · 56 꼴, 오늘 · 사흘 뒤 모두). 사흘 뒤 고리 37곳을 혼자 붙잡는 뿌리는 `.tmp/검수`다 — 묶음 1,425개를 한 폴더로 보아 늘 사흘 안이고, 그 언급을 따라가지 않으면 56 꼴 · 사흘 뒤 258곳 40.9GiB가 새 후보가 된다. 사슬 48 작업 폴더 `company-release-downtime-20261103`도 고리 35곳에 닿는데, 50~54 넘김 절차서(`RUNBOOK-5x.md`)가 원격 전에 그 안 `check-clock-bound.cjs`를 부르고(11-07에도 돔) 55 `deployment-validation.json`이 그 안 QA 결과를 가리켜 남긴다. 낡은 38줄(사슬 40 · 45 · 47 · 48 판 34줄과 옛 판이 가리켜 넣은 `drill-layer-sim-20261022` · `sns-simple-33-company-20261025` · `ss33-src` · `workspace-password-min9-20261022`)은 유호님 승인으로 걷었다(전 판 `.tmp/_정리제외.txt.bak-20261107-평범줄`). 고리를 실제로 비우는 길은 정리 도구의 `검수` 처리와 그 작업 폴더가 쓰는 시계 도구를 닫는 일이다.
- **결과(11-09 실측)**: 56 · 57이 이대로 옮겨 무장 · 봉인됐다. 두 판의 `deployment/scope-base.cjs`는 리허설과 같은 바이트(`e9d10d75…`)이고, 옛 상속 · Codex 거울 · ha-compat 글자는 0이다. `lineage.cjs measure <57>`은 리허설 예상대로 **16곳**(재검증 3 · 입력 그래프 10 · 정적 12 · QA 원천 4)이고, 실제 재무장 Linux QA 원천 132개와 대조를 통과했다. 「실측 계보」 절은 57 실측 + 봉인 57 둘이다(58을 만드는 세션이 다시 잰다). 옛 고리 38곳(4.81GiB)은 재무장에 더 필요 없지만 아직 `.tmp`에 있다 — 사흘 기준 후보는 1곳뿐이고, 37곳을 붙잡는 것은 평범한 줄 `github-storage-20261017`(22곳) · `document-cleanup-publish`(15) · `company-release-downtime-20261103`(→ `company-downtime48-release-20261103-v2`, 14), 추적 기록 `docs/_ops/qa/company-voice-security-20261018/result.json` · `docs/_ops/qa/backend-upgrade-20261018/result.json`, 사흘 안이라 곧 빠질 55 판과 검수 묶음이다. 도구를 걷기 전에는 그 앵커 글자가 `business-automation-release-20261020`을 저장소 코드 뿌리로 붙잡았다. 리허설 · 기준 사본 둘(약 660MB)은 11-09에 지웠다 — 숫자는 위 줄에 남긴다.

## 계보 실측

```text
node tools/company-release/lineage.cjs measure <판 폴더> [<판 폴더>…] [--정리대기 <폴더>] [--json <출력>] [--절]
```

판의 재무장(prepare-arm)은 맨 먼저 부모 판 `rearm/approval.cjs`의 `loadApproval`을 봉인된 부모 승인 입력(`deployment/parent-arm-pin.json`의 approval)으로 부르고, 이 재검증은 승인 사슬을 끝까지 내려가며 판마다 `candidate/` 전체와 승인 기록을 다시 읽는다(2026-10-30 실측: 37 판 기준 옛 폴더 57곳, 5~6분). 그래서 옛 릴리스 폴더는 도우미 코드만이 아니라 자료째로 재무장에 쓰인다. 이 도구는 그 재검증(①)을 따로 띄운 node에서 읽기 추적과 함께 돌리고, 재무장 입력 그래프(①′ — `rearm-prepare-fresh.cjs`의 `graph()`·`approvalPins()`가 핀을 따라 읽는 파일)와 판 도구 코드의 정적 닫힘(② — require·import·경로 글자), 재무장 Linux QA 원천(③ — 판 `rearm/linux-qa.cjs`의 `sources()`를 그 판 코드 그대로 읽기 추적과 함께)을 더해 판이 실제로 쓰는 `.tmp` 폴더 목록을 낸다. 넷 가운데 하나라도 끝까지 못 돌면 측정 전체가 실패하고 절을 내지 않는다. 읽기만 하며 원격·운영 동작은 없다. 봉인된 부모 설계 판(위 절)은 ①이 판 자신의 `loadParent`, ①′이 그 판 코드의 봉인 역사 H를 건너뛴 걷기다.

- ①′는 10-30에 더했다 — ①만 재던 판은 38 재무장이 닿는 폴더를 놓쳤다: 입력 그래프만 닿는 3곳(`company-completed-c2431857-20261027`·`backend-boundaries-20261027`·`sns-simple-fix-37-carry-20261029`), 리뷰가 맨 위에서 읽는 676 무장 게이트 증거(`pulse-portfolio-server-audit-20261012`·`pulse-library-20261012`). ①′가 따라가는 것: 부모 핀, 판 `candidate-validation.json`, 판 `rearm-ops/rearm-operations.cjs`가 고정한 앞 판 정적 입력(`PARENT_STATIC`)과 그 DR 묶음·승인 입력(맨 위에서), 판 rearm/의 승인 입력·정적 입력·fresh 증명(있으면), ①이 돌려준 부모 결과의 inputPins 가운데 판 승인 모듈이 자기 값으로 덮지 않는 열쇠(`inputPins={...a.inputPins,…}`에서 읽음 — 안 그러면 부모의 previousApproval로 옛 사슬을 내려간다), 676 게이트 증거(맨 위 핀은 상대 경로도 저장소 뿌리 기준), 판 QA 결과의 원천 파일(QA 뒤에 잴 때). 핀과 다른 파일·없는 파일은 따로 찍고 실패로 끝낸다(prepare-arm이 그 자리에서 멈춘다).
- ③도 10-30에 더했다 — QA 전 원천 목록을 「②가 덮는다」고 주장하지 않고 판의 `sources()`를 직접 돌린다. 배포 전에는 배포 단계가 판 안에 쓰는 파일(38: `deployment/rearm-stage-plan-pin.json`)이 아직 없어 `sources()`가 멈추므로, **판 `deployment/`(배포 단계가 쓰는 자리) 안에 없는 JS 아닌 파일만** 「있는 빈 파일」로 본다(lstat·stat은 보통 파일, 인코딩 없이 읽으면 빈 내용 — `sources()`가 열어 상대 require를 따라가는 것은 JS뿐이고 판 폴더는 늘 계보에 들어 폴더 목록이 바뀌지 않는다). 봐준 파일은 원천 목록의 잎이어야 한다 — 돌려준 목록에 그 이름으로 들고 인코딩 없이 많아야 한 번(해시) 읽혀야 하며, 아니면(두 번 읽음 · 있는지만 물어봄) `QA_TOLERATED_NOT_A_LEAF`로 실패한다(Fable 10-30 — 「따라가는 것은 JS뿐」이라는 코드 읽기를 실행 검사로). 판 밖 원천이 없거나, `deployment/` 밖이나 JS인 없는 파일이거나(깨진 사본), 없는 파일을 글로 읽으면 그대로 실패다 — 도중까지 센 몫으로 절을 내던 앞 꼴(GPT GB1)을 닫았다. **한계**: 봐준 파일을 한 번 읽어 해시와 원천 찾기에 함께 쓰는 코드는 QA 전에는 원리상 못 잡는다(그 내용이 아직 없다 — 37 · 38 · 리허설 `sources()`는 바이트까지 같은 꼴이고 그런 코드가 없다, Fable 10-30 확인). 그래서 그 판 몫은 절 머리에 「QA 전 · 봐줌 N(이름)」으로 남고, 그 판이 QA를 마치면 다시 재서 아래 대조로 닫는다. QA 뒤에 잴 때는 판의 가장 새 QA 결과(`rearm/linux-qa-result-v<N>.json` — 같은 `sources()`가 그때 낸 목록)의 원천 이름이 ③에 다 있는지 대조하고, 빠진 것이 있으면 실패로 끝낸다(그 파일은 ①′가 QA 결과 목록으로 잡는다 — ③을 그 판 코드에서 믿을 수 없거나 QA가 낡았다는 뜻). 10-30 실측: 37 877파일 56폴더(봐줌 없음 · QA 결과 877개와 같음) · 38 893파일 57폴더(봐줌 `deployment/rearm-stage-plan-pin.json` 하나 · QA 전) · 리허설 143파일 19폴더, 셋 다 ②에 없던 폴더 0곳(②만 닿지 못한 폴더가 생기면 따로 찍는다). 실제 37 판에서 배포 파일을 가려 배포 전 상태를 흉내 낸 ③(가림 하나 = 38이 지금 없는 파일 · 가림 셋 = `deployment/` 고정 원천 전부, 디스크는 그대로 · 도구의 ③ 자식을 그대로)도 877개가 QA 결과와 한 줄도 다르지 않았다.
- 판을 여럿 주면 절은 합집합이다 — 지금 운영 판과 준비 중인 판을 함께 준다(위 「봉인된 부모」 순서).
- 남는 고정 도구 고리: 10-30 리허설 때는 `deployment/scope.cjs` 상속 · `deploy-quiet` 시험 자료(`maker-tools-24-release-20261022`, 그 뒤 판에서 빠짐) · Codex 증거 거울 · 기반이었다. 11-07 55 실측에서 남은 셋(scope 상속 · Codex 거울 · ha-compat QA 흔적)은 사슬 56부터 생성기가 판 안으로 옮긴다(위 「고정 도구 고리를 판 안으로」). 그 뒤에 남는 것은 기반 7곳과 배포 때만 쓰는 옛 도구 4곳이다.
- `generators/` 아래 생성기는 앞 판 원천을 글자로 읽어 옮길 뿐 실행하지 않으므로, 가리키는 폴더 이름만 계보에 넣고 그 폴더 코드로 따라 들어가지 않는다(39 생성기가 38 `rearm/approval.cjs`를 글자로 적는 것만으로 옛 사슬이 다시 들어오지 않게).

- `--절`은 `.tmp/_정리제외.txt`에 붙일 「#! 실측 계보 시작 … 끝」 절을 찍는다. `tools/tmp정리목록.js`는 그 절의 폴더를 남기되 그 안의 경로 언급은 따라가지 않는다 — 기록 json의 출처 언급(판마다의 후보 작업 폴더 등)은 쓰는 폴더가 아니다.
- 재검증이 실패하면 그 판의 재무장도 같은 자리에서 멈춘다(예: 10-29 정리로 옮겨진 `pulse-followthrough-20261012`의 기록 하나). 운영 반영 전에 돌리면 반영 뒤 재무장에서 멈출 일을 먼저 잡는다.
- 재검증이 `.tmp`만으로 통과하면 그 재검증은 정리 대기에서 아무것도 읽지 않는다 — 정리 대기를 지우기 전에도 이것으로 본다. 정적 참조가 가리키는 폴더가 `.tmp`에 없으면 「.tmp에 없는 계보 이름」을 찍고 실패로 끝나며, `--정리대기 <폴더>`를 주면 그중 그 폴더에 있는 것(되돌릴 것)을 알린다(있는지만 본다).
- 정적 닫힘은 남길 목록이라 빠뜨리기만 위험하다. 그래서 파일마다 작은 토크나이저와 정규식 두 추출기의 합집합(넓게 잡는 쪽)을 쓰고, 폴더를 가리키는 글자는 그 아래에서 경로 조각이 글자로 적힌 파일만(로더·목록 돌기는 바로 아래까지) 따라간다. 이름 자체를 계산해 부르는 길은 정적으로 못 본다 — 재검증 추적이 탄 만큼만 덮인다(10-30 GPT 8회차 검수 20건 반영).
- 사슬이 한 판 나아가면(새 판의 생성기가 돈 뒤) 새 판으로 다시 재서 절을 바꾼다. 준비 중인 판이 QA를 마치면(절 머리에 「QA 전」이 보이면) 그때도 다시 재서 ③을 실제 QA 결과와 대조한다.

확인: `node --test tests/company-release-closed-parent.test.cjs tests/company-release-lineage.test.cjs`
