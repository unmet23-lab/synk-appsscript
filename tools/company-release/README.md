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

보존본의 `completed-release.json` SHA256을 다음 입력에 고정한다. 보존은 과거 완료의 재검증이다. 지금 서버가 같은 판인지, 지금 배포해도 되는지는 별도로 확인한다. 운영 인프라 정보가 있는 보존본·핀·실행 증거는 공개 저장소에 올리지 않는다.

## 다음 후보

```text
node tools/company-release/compose.cjs <입력.json>
```

입력은 `parent`, `sealSha256`, `carryFile`, `carrySha256`, `output`을 갖는다. 경로는 절대 경로다. 변경 명세에는 `parentManifestSha256`, `files`가 있고 각 파일은 `path`, 부모의 `beforeSha256`(새 파일은 `null`), 새 `sha256`, `bytes`를 갖는다. 새 바이트는 명세 옆 `files/<path>`에 둔다.

부모의 모든 소스·이미지·선택 시험을 보존하고 명세의 파일만 교체·추가한다. 이미 선택에서 빠진 시험을 바꾸면 별도 판단이 필요하므로 멈춘다. 새 시험은 선택에 추가한다. 결과는 `prepared-local-qa-required`이며 검수·Linux QA·실제 배포를 통과했다는 표시를 만들지 않는다.

이후 기존 배포 절차의 검수, 현재 운영판·소유권 확인, Linux 격리 시험, 완료된 반영 전 백업, 자료 보존 검사, 공개 대조, 재무장과 최종 사후 확인을 그대로 수행한다. 과거 생성기를 다시 실행하거나 옛 검수 증거를 새로 승인한 것으로 바꾸지 않는다.

확인: `node --test tests/company-release-closed-parent.test.cjs`
