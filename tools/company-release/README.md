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

확인: `node --test tests/company-release-closed-parent.test.cjs`
