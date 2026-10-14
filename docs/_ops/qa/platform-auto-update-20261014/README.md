# Platform 0.4.7 자동 업데이트·저장 복구·내 성향 통합 검증 · 2026-10-14

**상태: 0.4.7 최종 검증·공개 배포·현재 PC 설치·공개 feed 확인·실제 저장/재실행 QA 완료.** 담당 채팅의 [실제 UI 증거](../platform-real-account-20261010/installed-storage-fix-20261014/actual-ui.json)를 인수했다. 계정 라이브러리는 재실행 후 수동 연결했으며 앱 내부 특정 작업 위치 복귀까지 확인한 것은 아니다. 이전 [0.4.4 공개·PC 반영](../platform-unified-20261014/README.md) 및 아래 선행 0.4.5·0.4.6 검증과 구분한다.

| 항목 | 공개·설치 기준 |
| --- | --- |
| 버전 / build | `0.4.7` / `20261014.4` |
| releaseId | `platform-preview-0.4.7` |
| sourceHash | `5d52702262a1f68f832b07d63d53cb20a7f3f05e1ebc9ac363038ba37e3971cc` |
| 공통 feed | `https://synk.im/desktop/releases/preview.json` |
| 대상 | Windows x64, Mac Apple Silicon arm64, Mac Intel x64 |
| 동결 입력 / 추가 범위 | [release-input-047.json](release-input-047.json), [integration-scope-047.json](integration-scope-047.json) |

선행 0.4.5는 0.4.4 기준에 업데이트 관련 13개 파일과 설치기 변경을 반영했다. 이후 다른 채팅의 직접 사용자 승인 원문을 담당자가 확인했고, 저장·복구 두 파일을 추가해 0.4.6으로 동결했다. 추가 사용자 승인으로 내 성향 관련 9개 파일을 더해 **0.4.7 / 130개 원문 파일**로 새로 동결했다. 각 선행 원문을 덮어쓰지 않았으며 승인 범위 외 동시 작업 변경은 가져오지 않았다. 원문 해시가 일치하지 않는 빌드 보고서를 섞어 게시하지 않는다.

0.4.7 추가 범위는 `renderer/benefits.mjs`, `convenience-state.mjs`, `index.html`, `launcher.mjs`, `member-insight-model.mjs`, `member-insight-view.mjs`, `member-insight.css`, `member-insight.mjs` 및 `src/security.cjs`다. 파일별 해시는 위 integration-scope에 기록했다. 최종 통합 관련 시험 125개와 세 대상 패키지 검증을 아래 최종 증거로 보존한다.

## 0.4.7 최종 검증 증거

| 증거 | 확인 결과와 범위 |
| --- | --- |
| [최종 원문 회귀](startup-security-regression-047.txt) | 관련 시험 **125/125** 통과. 시작 창 보안·업데이트·종료 보호·복구와 UI 계약 확인. |
| [Windows 빌드](windows-build-047.json), [wrapper 검증](windows-wrapper-047.json), [네이티브 QA](windows-native-047.json) | 최종 sourceHash 일치, 설치기·내장 backend·명세 검증, 실제 0.4.7 패키지 **25개** 확인. 네이티브 QA는 격리 프로필·합성 current feed를 사용했으며 실제 계정 QA와 구분. |
| [Mac arm64 빌드](mac-arm64-build-047.json), [설치 QA](mac-arm64-installer-qa-047.json), [네이티브 흐름](mac-arm64-native-047.json) | 실제 DMG의 격리 Applications 설치 QA **34/34**, 네이티브 흐름 **18개** 통과. CI 호스트이며 물리 사용자 Mac·Gatekeeper 승인·실계정 인증 시험은 아님. |
| [Mac x64 빌드](mac-x64-build-047.json), [설치 QA](mac-x64-installer-qa-047.json), [네이티브 흐름](mac-x64-native-047.json) | 실제 DMG의 격리 Applications 설치 QA **37/37**, 네이티브 흐름 **18개** 통과. 같은 검증 한계 적용. |
| [공통 manifest](preview-047.json), [공개 검증](public-verification-047.json) | 한·영 홈페이지의 세 정확한 다운로드 링크, 고정 feed·선택 스크립트, 공개 설치파일 3개 전체 다운로드의 크기·SHA 일치. 공개 커밋 `413056c0317ee7b6e6921e5ce176ed0208a0acd7`. |
| [홈페이지 재생성](website-rebuild-047.json), [공개 CI](public-ci-047.json) | 정본 feed로 별도 출력에 14페이지를 생성하고 릴리스 연결 15/15 확인. 원문146·기존 dist4,335파일 변경0. Pages `38513927169`와 전체 사이트 점검 `38513927242` 모두 성공. |
| [후속 공개 후 재확인](recheck-047.json) | 10월14일 14:27 KST 독립 읽기 검사 13/13. 설치75파일·ASAR·0.4.7/build20261014.4와 공개 feed·한영 세 다운로드 링크가 그대로 일치. 설치·프로필·앱 조작 없음. |
| [PC 설치 영수증](apply-047.json) | 공개 Windows 설치기와 같은 SHA로 실제 설치. `APPLY_VERIFIED`, 버전·build·sourceHash·ASAR 및 설치 파일 **75/75** 일치. 설치 도구의 프로필 작업 0. |
| [설치된 updater의 공개 feed 확인](installed-live-update-047.json) | 설치 파일 75개·ASAR 대조 후 `current / 0.4.7 / 20261014.4`. 프로필·다운로드·설치 작업 모두 0. 실제 UI 저장 왕복 시험은 아님. |
| [설치 직후 기존 프로필 보존](profile-preservation-047.json) | 별도 저장 검증 담당자가 기존 Platform **296개**, suite **1개** 파일의 누락·바이트 변경 **0** 확인. 기록 내용은 보고하지 않았으며, 이 결과를 실제 저장 UI·재실행 성공으로 확대하지 않음. |

현재 PC 적용 전 복구 가능한 앱 payload·설치 등록 백업을 검증했다. 기존 프로세스가 정상 종료되어 강제 종료는 실행하지 않았다. 현재 설치기 SHA는 `7fb377ab1722a505d6fb690e7abd50a314aa22222950087250ea2b27ec2463ee`, 설치 ASAR SHA는 `5f3947ce4dfb39d411ecd2c154b3721ba558dfffd584f7540cd06c88aa10e418`다.

**내 성향 웹 후속 공개:** 담당 작업이 `account/` 4파일만 공개 커밋 `47fb0b72dddbf82bbbc8928f57b412beadf7badc`에 반영했다. Pages `38514869493`·전체 사이트 점검 `38514869666` 성공과 공개 4파일의 HTTP200·크기·전체 SHA 일치를 확인했고, 공통 0.4.7 feed·한영 홈페이지는 이전 공개 바이트 그대로다. [공개 증거](member-insight-web-publication.json), [화면 입구](https://synk.im/account/platform.html#benefits/insight). 배포 전 합성 브라우저 검사 55/55에 이어 14:29 KST [실제 계정 웹 UI](member-insight-real-web.json)의 두 영역·연결된 학습 요약·근거 펼침·새로고침 성공도 확인했다. 계정 설정·프로필·노트 변경 및 인증 정보 읽기 0. 설치 앱의 새 성향 UI 확인은 담당 작업에서 별도로 진행한다.

<a id="storage-integration-046"></a>

## 0.4.6 선행 저장·복구 통합 범위와 증거

| 승인 파일 | SHA-256 |
| --- | --- |
| `renderer/member-home.mjs` | `66ae3b7233db9affceb66a86eb020816074abce1941540a8f851b63608d3d1f5` |
| `renderer/draft-recovery.mjs` | `86b710d99c012cd83695b14dd62bb379112da7b00e5aed098faccdd6fc466786` |

당시 0.4.6 준비 원문과 `frozen/source` 모두 위 해시와 일치한다. [당시 동결 입력](release-input-046.json)·[추가 범위](integration-scope-046.json)를 보존한다. 당시 전이 의존성은 기존 `state.mjs`·`library.mjs`·`benefits.mjs`이며 추가 모듈·IPC 변경이 필요하지 않았다. 수정 전 저장 문서 전체를 검증해 손상·미지원 행을 보존하고, 아직 읽지 못했거나 선택하지 않은 복구본은 명시적 선택·삭제 전까지 보호한다. 실패 시 현재 입력을 유지하고 명시적 재시도를 제공한다. 0.4.7에서 내 성향 관련 의존 파일이 추가 변경됐으므로 이 결과를 최종 상호 검증으로 대신하지 않는다.

- [storage-integration-review.json](storage-integration-review.json): 선행 원문 대비 승인된 두 파일만 추가됐는지, 해시·의존성·기존 native 계약을 대조한 독립 검토. UI 교차 검토에서도 재현 가능한 회귀 없음.
- [storage-frozen-integration-tests.tap](storage-frozen-integration-tests.tap): 최종 **0.4.6 동결 원문을 직접 참조한 101/101 시험 통과**. 저장·복구·계정 경계·미저장 종료 보호 97개와 새 renderer/기존 native 저장소/IPC를 연결한 합성 통합 4개다. 동의·저장·삭제 응답, 미선택 복구본, 손상 암호문 원문 보존과 재시도, 앱 권한·계정 변경 경계를 확인했다.

이 선행 검토는 실계정·사용자 프로필을 열지 않았다. 실제 설치된 0.4.7의 저장·재실행 QA는 별도 담당자가 수행했으며 아래 최종 결과로 인수했다. 선행 합성 검사와 실제 공개·PC 적용·운영 계정의 관찰은 별도 근거로 구분한다.

## 제공하는 동작

- **완전 시작:** 메인 창과 계정 초기화 전에 별도 창에서 확인한다. 최신이면 메인으로 진입하고, Windows의 새 버전이면 다운로드·크기/SHA 검증·정상 종료·자동 설치·재실행한다.
- **트레이 재개:** 숨긴 앱을 트레이·전역 단축키·두 번째 실행으로 다시 열 때도 먼저 확인한다. 이미 보이는 앱을 다시 선택하면 현재 화면을 유지한다. 검사·다운로드가 진행 중이면 같은 작업을 이어받고 중복 설치하지 않는다.
- **사용 중:** 5분마다 확인하고 다운로드한다. Windows는 기존 미저장 작업 종료 보호를 통과해야 설치기로 인계한다. 종료를 취소하면 같은 메인·초안·검증된 설치파일을 보존하며, 해당 실행 중 같은 릴리스의 자동 종료를 반복하지 않는다. 더 새 릴리스의 검사는 계속한다.
- **실패:** 시작 전 확인은 최대 15초 뒤 안전한 오류와 재시도·현재 버전 열기를 제공한다. 네트워크·다운로드 실패는 다음 주기에 복구 가능하다. 설치기 인계 실패나 복구한 릴리스는 해당 실행 중 자동 설치를 반복하지 않는다. 명시적 재시도·앱 재열기는 다시 진행할 수 있다.
- **Windows 인계·복구:** 부모 PID·설치 경로·버전 및 nonce READY 응답을 확인한 뒤 정상 종료한다. 강제 종료하지 않는다. 설치 전 파일·등록·바로가기를 보존하고, 설치 실패 후 복구가 성공하면 이전 앱을 재실행한다. 한 번만 소비하는 복구 증거가 자동 설치 반복을 막는다.
- **Mac:** 검사·다운로드까지 자동이다. 사용자가 검증한 DMG를 열고 앱을 종료한 뒤 Applications에서 교체한다. 자동 교체·자동 재실행은 포함하지 않는다. Developer ID·공증은 사업자 등록 후 재개하는 기존 결정을 유지한다.

계정·노트 내용은 설치 대상에 포함하지 않는다. renderer는 임의 다운로드 URL·설치 경로·셸 명령을 전달할 수 없다. Windows 미서명·Mac ad-hoc Preview이며 해시 검증을 정식 코드 서명으로 표시하지 않는다. 자세한 계약은 [LIFECYCLE](../../../../desktop/LIFECYCLE.md#platform-update-047)을 따른다.

## 0.4.5 선행 자동 업데이트 증거

아래는 `0.4.5 / 20261014.2 / cda05cdc147b40533b352c07f572d4de222216e202e36c452c5c6365195002a9`의 선행 증거다. [당시 동결 입력](release-input.json)·[당시 범위](source-scope.json)와 원본 보고서를 보존한다. 변경되지 않은 업데이트 코드의 근거로 활용하며 **0.4.7 최종 패키지 검증으로 표시하지 않는다.** 각 결과는 검증 층이 달라 단순 합산하지 않는다. 합성 데이터·격리 프로필 검증을 운영 계정·실제 설치 성공으로 확대하지 않는다.

| 증거 | 확인 결과와 범위 |
| --- | --- |
| [source-tests.txt](source-tests.txt) | 후보 관련 Node 시험 **138/138**. updater·gate·미저장 종료·복구 증거·renderer 계약과 게시 도구 관련 회귀. |
| [windows-native.json](windows-native.json) | 동결 sourceHash가 일치하는 **실제 Windows 0.4.5 패키지의 25개 확인**. 격리 프로필·합성 current feed로 시작 창 동안 메인 부재, current 뒤 메인 한 개, 로그인/회원가입 가시성·고정 가입 URL, 두 수동 확인 화면을 검증. 패키지 바이트 보존. 실제 인증·설치 실행 없음. |
| [startup-native.json](startup-native.json) | 실제 Electron의 초안 종료 취소·기존 창 보존, 이후 승인·nonce READY·정상 종료. 합성 설치파일과 격리 프로필. |
| [background-native.json](background-native.json), [background-child-exit.json](background-child-exit.json) | 실제 Electron 배경 자동 설치 요청 → 초안 종료 취소 → 같은 릴리스 tick 두 번에서 작업 보존 → 명시 재열기 → READY 인계 → 부모 정상 종료·자식 PID 대기 해제. 실제 설치기는 실행하지 않음. |
| [installer-integration.json](installer-integration.json) | **18/18**. 합성 앱·등록을 이용한 실제 NSIS 설치, 실행 중 앱 보호, 잘못된 인계 거절, 자동 설치 성공·실패 복구·재실행. 실제 Platform 등록 보존, 실제 Platform 설치 시도 없음. |
| [main-reopen-review.json](main-reopen-review.json) | 실제 main 함수의 VM 실행 및 독립 관련 시험 **172/172**. 인계 실패 뒤 창 재생성에서 기존 auth 보존·새 auth 초기화 없음, 이전 IPC sender 거절, 트레이 유지, 프로토콜/다운로드 수신 중복 없음. 실제 프로필 접근 없음. |
| [startup-review.json](startup-review.json) | 실제 updater의 합성 스트림·타이머와 정확한 main 핸들러로 네 가지 경합 재검증: 진행 중 다운로드 인계, gate 중 타이머 보류, 초기 메인 중복 gate 방지, ready-to-show 우회 차단. |
| [startup-renderer.json](startup-renderer.json) | 320·360·440·560px 합성 시작 UI 25개 확인. 검사·진행률·설치·오류·Mac 안내, 버튼 가시성·넘침·제한된 bridge 확인. 운영 네트워크 없음. |
| [asar-native.json](asar-native.json) | 실제 Electron ASAR 가상 파일시스템과 `original-fs` 대조. 복구 기록의 ASAR 해시가 archive 실제 바이트 SHA와 일치. 합성 ASAR. |

Windows 0.4.5 네이티브 결과의 feed는 시험에서 후보 버전을 응답한 합성 feed다. 공개 feed 게시나 0.4.7 통합 패키지의 검증 증거가 아니다. 최종 0.4.7 Windows 및 Mac 두 대상의 빌드·QA와 공개 설치파일 전체 다운로드 검증은 위 최종 증거를 따른다. 물리 Mac에서의 교체·운영 계정 로그인 왕복·사용자 초안의 실제 운영 업데이트 인수는 이 선행 증거에 포함하지 않는다.

## 릴리스 도구의 Signal 완료 검증

0.4.6 빌드 시 하위 Signal의 payload 검사가 실패한 뒤 EXE만 남고 최종 성공 보고서가 없었으나, 상위 빌더가 종료 코드 0만 믿고 성공 보고서를 만든 경우를 확인했다. 상위 빌더에 최종 Signal 보고서·설치 명세·설치파일/backend 바이트·payload 보존 검증을 추가했다. [회귀 시험 27/27](signal-report-validation-tests.tap)과 [실제 실패 폴더의 읽기 전용 거절 재현](signal-report-validation-reproduction.json)을 보존한다. 하위 종료 코드가 0이 된 세부 원인은 미확정이며 특정 exit hook 때문이라고 단정하지 않는다. 이 보완은 빌드 도구에만 적용했고 제품 동결 원문이나 기존 산출물은 바꾸지 않았다.

<a id="publication-pending"></a>
<a id="publication-result"></a>

## 공개·현재 PC 반영 결과와 남은 확인

공개·설치 완료와 실제 계정 UI 검증을 분리해 기록한다. 아직 진행 중인 항목은 담당자가 결과를 확인한 뒤 갱신한다.

| 항목 | 상태 | 근거 또는 남은 확인 |
| --- | --- | --- |
| 최종 원문 상호 검증 | 완료 | [관련 시험 125/125](startup-security-regression-047.txt) 및 최종 패키지별 격리 검증 |
| 세 대상 최종 빌드와 QA | 완료 | 위 Windows·Mac arm64·Mac x64 보고서와 [공통 manifest](preview-047.json) |
| 공개 설치파일·홈페이지·feed 전환 | 완료 | [공개 링크·feed·세 설치파일 전체 SHA 대조](public-verification-047.json), 공개 커밋 `413056c0317ee7b6e6921e5ce176ed0208a0acd7` |
| 현재 PC 백업·동일 공개 Windows 파일 적용 | 완료 | 복구 백업 검증 후 [APPLY_VERIFIED 75/75](apply-047.json). 기존 프로세스 정상 종료, 강제 종료 0 |
| 설치 후 버전·파일·공개 업데이트 확인 | 완료 | [설치된 updater 검증](installed-live-update-047.json)의 `current / 0.4.7 / 20261014.4`, 75개 파일·ASAR 일치 |
| 실제 앱 UI 저장·재실행·복원 QA 인수 | 완료 | [담당자의 실제 UI 증거](../platform-real-account-20261010/installed-storage-fix-20261014/actual-ui.json). 합성 기기 할 일·결과 메모 저장→정상 완전 종료→새 프로세스 실행→제목·본문·기존 기록 복원→WORLD 시작 화면→합성 할 일 완료. 기존 계정 메모7·복구1 보존, 트레이 설정 원복. 계정 라이브러리는 수동 연결. 기존 기록 수정·삭제0, 새 검증 기록2개는 보존 |

게시 전 검증 실패는 기존 공개 feed·다운로드를 유지한다. 이미 공개한 버전의 바이트는 교체하지 않는다. 운영 PC 적용은 홈페이지와 동일한 설치파일로 수행하며 설치된 ASAR 일부를 직접 패치하지 않는다.
