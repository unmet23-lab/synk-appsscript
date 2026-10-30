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

부모의 모든 소스·이미지·선택 시험을 보존하고 명세의 파일만 교체·추가한다. 이미 선택에서 빠진 시험을 바꾸면 별도 판단이 필요하므로 멈춘다. 새 시험은 선택에 추가한다. 결과는 `prepared-local-qa-required`이며 검수·Linux QA·실제 배포를 통과했다는 표시를 만들지 않는다.

이후 기존 배포 절차의 검수, 현재 운영판·소유권 확인, Linux 격리 시험, 완료된 반영 전 백업, 자료 보존 검사, 공개 대조, 재무장과 최종 사후 확인을 그대로 수행한다. 과거 생성기를 다시 실행하거나 옛 검수 증거를 새로 승인한 것으로 바꾸지 않는다.

## 격리 로컬 QA와 소스 벡터

```text
node tools/company-release/local-qa.cjs <입력.json>
```

입력은 절대 경로 `candidate`(compose의 출력), 고정 `compositionSha256`, 새 절대 경로 `output`, `guard: {path, sha256}`, 양의 정수 `expectedTests`를 갖는다. `guard`는 검토한 외부 통신 차단기 원문과 핀이다. 필요한 경우 절대 경로 `dependencyRoots` 배열로 기존 시험 의존성만 명시한다.

선택 시험이 manifest 안에 있는지 확인하고 별도 사본에서 실제 `node --test`를 실행한다. 사용자 자격증명·NODE_OPTIONS·운영 기능 환경 변수는 이어받지 않고 HOME·APPDATA·임시 경로도 새 격리 폴더로 준다. 원본과 시험 사본의 전후 벡터 네 개, TAP·종료 코드·정확한 기대 건수, 실행기·검증기·차단기의 해시를 남긴다. 통과한 시험이 소스를 바꿔도 QA는 실패한다. 실패 보고도 `failed-local`로 보존하며 CLI는 실패 종료한다. 여기서 Linux 검증·운영 승인 표시를 만들지 않는다.

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
- 리허설(2026-10-30): 37 판을 이 설계로 옮긴 사본 `.tmp/trusted-parent-rehearsal-37-20261030`(부모 = 봉인 36 `company-approval-62146584-20261030`)에서 ① 새 설계 `loadApproval` 결과가 옛 설계 37 결과와 바이트까지 같고(190,013바이트, 284초 → 3~15초), ② `prepare-arm` 메마른 실행(앞 판 정적 입력·DR 묶음 → 경계 넣은 `prepareFresh`)이 돌고, ③ 다시 지은 리뷰가 37 실제 리뷰와 바이트까지 같고(계약 `reviewSha256` 포함), ④ 재무장 Linux QA 원천이 877파일 · `.tmp` 56폴더 → 143파일 · 19폴더(QA 결과 목록 기준, 저장소 쪽 3곳은 같음), 판 재무장 단위 시험 111/111. 지금 절 가운데 리허설 계보(61곳) 밖 19곳을 프로세스 안에서 막은 채로도(그 경로를 ENOENT로, 막은 폴더 접근 0회) 같은 결과였다. 공용 `.tmp`에서 이름을 바꿔 숨기는 확인은 하지 않기로 했다(10-30) — 믿는 길(`load` → `verify` → 보존본 확인 · 봉인된 검증기)에는 자식 프로세스가 없어(`spawnSync`는 `seal` 때의 `compute`에만) 프로세스 안 막기가 그 길을 다 덮고, 절을 줄이는 관문은 39가 무장 · 봉인된 뒤 39 실물로 다시 재는 측정(①·①′·②·③)이다. 진행 중인 38 작업과 같은 `.tmp`라 이름 바꾸기는 그쪽을 끊을 위험만 있다. 진짜 봉인 자료 부정 시험 8건(결과 한 바이트 · 다른 판 결과로 바꾸고 봉인 다시 씀 · 사슬 한 줄/history 바꾸고 봉인 다시 씀 · 다른 보존본 핀 · 다른 판 입력 · 사슬 길이)은 모두 막혔다. 남는 계보 61곳 중 대부분은 판마다 늘지 않는 도구 고리다(아래 「계보 실측」).

확인: `node --test tests/company-release-sealed-approval.test.cjs tests/company-release-lineage.test.cjs`

## 계보 실측

```text
node tools/company-release/lineage.cjs measure <판 폴더> [<판 폴더>…] [--정리대기 <폴더>] [--json <출력>] [--절]
```

판의 재무장(prepare-arm)은 맨 먼저 부모 판 `rearm/approval.cjs`의 `loadApproval`을 봉인된 부모 승인 입력(`deployment/parent-arm-pin.json`의 approval)으로 부르고, 이 재검증은 승인 사슬을 끝까지 내려가며 판마다 `candidate/` 전체와 승인 기록을 다시 읽는다(2026-10-30 실측: 37 판 기준 옛 폴더 57곳, 5~6분). 그래서 옛 릴리스 폴더는 도우미 코드만이 아니라 자료째로 재무장에 쓰인다. 이 도구는 그 재검증(①)을 따로 띄운 node에서 읽기 추적과 함께 돌리고, 재무장 입력 그래프(①′ — `rearm-prepare-fresh.cjs`의 `graph()`·`approvalPins()`가 핀을 따라 읽는 파일)와 판 도구 코드의 정적 닫힘(② — require·import·경로 글자), 재무장 Linux QA 원천(③ — 판 `rearm/linux-qa.cjs`의 `sources()`를 그 판 코드 그대로 읽기 추적과 함께)을 더해 판이 실제로 쓰는 `.tmp` 폴더 목록을 낸다. 넷 가운데 하나라도 끝까지 못 돌면 측정 전체가 실패하고 절을 내지 않는다. 읽기만 하며 원격·운영 동작은 없다. 봉인된 부모 설계 판(위 절)은 ①이 판 자신의 `loadParent`, ①′이 그 판 코드의 봉인 역사 H를 건너뛴 걷기다.

- ①′는 10-30에 더했다 — ①만 재던 판은 38 재무장이 닿는 폴더를 놓쳤다: 입력 그래프만 닿는 3곳(`company-completed-c2431857-20261027`·`backend-boundaries-20261027`·`sns-simple-fix-37-carry-20261029`), 리뷰가 맨 위에서 읽는 676 무장 게이트 증거(`pulse-portfolio-server-audit-20261012`·`pulse-library-20261012`). ①′가 따라가는 것: 부모 핀, 판 `candidate-validation.json`, 판 `rearm-ops/rearm-operations.cjs`가 고정한 앞 판 정적 입력(`PARENT_STATIC`)과 그 DR 묶음·승인 입력(맨 위에서), 판 rearm/의 승인 입력·정적 입력·fresh 증명(있으면), ①이 돌려준 부모 결과의 inputPins 가운데 판 승인 모듈이 자기 값으로 덮지 않는 열쇠(`inputPins={...a.inputPins,…}`에서 읽음 — 안 그러면 부모의 previousApproval로 옛 사슬을 내려간다), 676 게이트 증거(맨 위 핀은 상대 경로도 저장소 뿌리 기준), 판 QA 결과의 원천 파일(QA 뒤에 잴 때). 핀과 다른 파일·없는 파일은 따로 찍고 실패로 끝낸다(prepare-arm이 그 자리에서 멈춘다).
- ③도 10-30에 더했다 — QA 전 원천 목록을 「②가 덮는다」고 주장하지 않고 판의 `sources()`를 직접 돌린다. 배포 전에는 배포 단계가 판 안에 쓰는 파일(38: `deployment/rearm-stage-plan-pin.json`)이 아직 없어 `sources()`가 멈추므로, **판 `deployment/`(배포 단계가 쓰는 자리) 안에 없는 JS 아닌 파일만** 「있는 빈 파일」로 본다(lstat·stat은 보통 파일, 인코딩 없이 읽으면 빈 내용 — `sources()`가 열어 상대 require를 따라가는 것은 JS뿐이고 판 폴더는 늘 계보에 들어 폴더 목록이 바뀌지 않는다). 봐준 파일은 원천 목록의 잎이어야 한다 — 돌려준 목록에 그 이름으로 들고 인코딩 없이 많아야 한 번(해시) 읽혀야 하며, 아니면(두 번 읽음 · 있는지만 물어봄) `QA_TOLERATED_NOT_A_LEAF`로 실패한다(Fable 10-30 — 「따라가는 것은 JS뿐」이라는 코드 읽기를 실행 검사로). 판 밖 원천이 없거나, `deployment/` 밖이나 JS인 없는 파일이거나(깨진 사본), 없는 파일을 글로 읽으면 그대로 실패다 — 도중까지 센 몫으로 절을 내던 앞 꼴(GPT GB1)을 닫았다. **한계**: 봐준 파일을 한 번 읽어 해시와 원천 찾기에 함께 쓰는 코드는 QA 전에는 원리상 못 잡는다(그 내용이 아직 없다 — 37 · 38 · 리허설 `sources()`는 바이트까지 같은 꼴이고 그런 코드가 없다, Fable 10-30 확인). 그래서 그 판 몫은 절 머리에 「QA 전 · 봐줌 N(이름)」으로 남고, 그 판이 QA를 마치면 다시 재서 아래 대조로 닫는다. QA 뒤에 잴 때는 판의 가장 새 QA 결과(`rearm/linux-qa-result-v<N>.json` — 같은 `sources()`가 그때 낸 목록)의 원천 이름이 ③에 다 있는지 대조하고, 빠진 것이 있으면 실패로 끝낸다(그 파일은 ①′가 QA 결과 목록으로 잡는다 — ③을 그 판 코드에서 믿을 수 없거나 QA가 낡았다는 뜻). 10-30 실측: 37 877파일 56폴더(봐줌 없음 · QA 결과 877개와 같음) · 38 893파일 57폴더(봐줌 `deployment/rearm-stage-plan-pin.json` 하나 · QA 전) · 리허설 143파일 19폴더, 셋 다 ②에 없던 폴더 0곳(②만 닿지 못한 폴더가 생기면 따로 찍는다). 실제 37 판에서 배포 파일을 가려 배포 전 상태를 흉내 낸 ③(가림 하나 = 38이 지금 없는 파일 · 가림 셋 = `deployment/` 고정 원천 전부, 디스크는 그대로 · 도구의 ③ 자식을 그대로)도 877개가 QA 결과와 한 줄도 다르지 않았다.
- 판을 여럿 주면 절은 합집합이다 — 지금 운영 판과 준비 중인 판을 함께 준다(위 「봉인된 부모」 순서).
- 남는 고정 도구 고리(10-30 리허설 실측, 판마다 늘지 않음): `deployment/scope.cjs`의 상속(`company-sns-auth-20261016` → … → `workspace-login-v3-20261013` 15곳, 재검증 때 실행됨), `deploy-quiet/deploy-quiet.test.cjs`의 시험 자료가 가리키는 `maker-tools-24-release-20261022`와 그 판 `scope.cjs` 상속(10-14~10-22 판들), `rearm-prepare-fresh.cjs`의 Codex 증거 거울 `business-automation-release-20261020`(자료만 읽는데 정적 닫힘이 그 판 맨 위 코드와 `scope.cjs` 상속까지 넓게 잡음), 기반(`platform-ha-20261011`·`pulse-workspace-integration-20261013`·`server-latency-20261013`·10-12 판 몇 곳). 더 줄이려면 생성기가 그 도우미·자료를 판으로 옮겨야 한다(후속).
- `generators/` 아래 생성기는 앞 판 원천을 글자로 읽어 옮길 뿐 실행하지 않으므로, 가리키는 폴더 이름만 계보에 넣고 그 폴더 코드로 따라 들어가지 않는다(39 생성기가 38 `rearm/approval.cjs`를 글자로 적는 것만으로 옛 사슬이 다시 들어오지 않게).

- `--절`은 `.tmp/_정리제외.txt`에 붙일 「#! 실측 계보 시작 … 끝」 절을 찍는다. `tools/tmp정리목록.js`는 그 절의 폴더를 남기되 그 안의 경로 언급은 따라가지 않는다 — 기록 json의 출처 언급(판마다의 후보 작업 폴더 등)은 쓰는 폴더가 아니다.
- 재검증이 실패하면 그 판의 재무장도 같은 자리에서 멈춘다(예: 10-29 정리로 옮겨진 `pulse-followthrough-20261012`의 기록 하나). 운영 반영 전에 돌리면 반영 뒤 재무장에서 멈출 일을 먼저 잡는다.
- 재검증이 `.tmp`만으로 통과하면 그 재검증은 정리 대기에서 아무것도 읽지 않는다 — 정리 대기를 지우기 전에도 이것으로 본다. 정적 참조가 가리키는 폴더가 `.tmp`에 없으면 「.tmp에 없는 계보 이름」을 찍고 실패로 끝나며, `--정리대기 <폴더>`를 주면 그중 그 폴더에 있는 것(되돌릴 것)을 알린다(있는지만 본다).
- 정적 닫힘은 남길 목록이라 빠뜨리기만 위험하다. 그래서 파일마다 작은 토크나이저와 정규식 두 추출기의 합집합(넓게 잡는 쪽)을 쓰고, 폴더를 가리키는 글자는 그 아래에서 경로 조각이 글자로 적힌 파일만(로더·목록 돌기는 바로 아래까지) 따라간다. 이름 자체를 계산해 부르는 길은 정적으로 못 본다 — 재검증 추적이 탄 만큼만 덮인다(10-30 GPT 8회차 검수 20건 반영).
- 사슬이 한 판 나아가면(새 판의 생성기가 돈 뒤) 새 판으로 다시 재서 절을 바꾼다. 준비 중인 판이 QA를 마치면(절 머리에 「QA 전」이 보이면) 그때도 다시 재서 ③을 실제 QA 결과와 대조한다.

확인: `node --test tests/company-release-closed-parent.test.cjs tests/company-release-lineage.test.cjs`
