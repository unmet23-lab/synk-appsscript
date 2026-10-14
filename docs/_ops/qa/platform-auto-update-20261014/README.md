# Platform 자동 업데이트·계정 라이브러리 연결 검증 · 2026-10-14

<a id="startup-quit-0410"></a>

## 0.4.10 정상 종료 보완 · 공개·PC 설치 완료, 실제 UI 검증은 사용자 요청으로 중단

**상태: 패키지 검증·공개·현재 PC 설치·설치 직후 기록 보존 확인 완료. 실제 앱 자동 연결·재실행 검증은 사용자의 ‘앱 조작은 여기서 멈춰줘’ 지시로 중단했으며 미확인 상태다.** 검증 중 바꾼 ‘닫으면 트레이로’는 꺼짐(`false`), 원래 켜짐(`true`)으로 복원하지 않았다. 사용자가 16:02경 직접 종료·설치하여 PC는 먼저 0.4.9가 됐고, 이후 정상 종료·백업 뒤 0.4.10 공통 설치기로 교체했다. 이를 구버전의 자동 업데이트 성공으로 기록하지 않는다. 0.4.10 / build20261014.7의 sourceHash는 `ca6651aa30f34d98142425c5c7e545e1d7645a601c9e42322a004636e0b310cb`다. [동결 입력](startup-quit-0.4.10/release-input.json)·[범위](startup-quit-0.4.10/integration-scope.json)대로 0.4.9에서 `src/main.cjs`·`src/platform-startup-window.cjs`만 수정했다. 계정 자동 연결 renderer와 다른 128파일은 그대로다.

`before-quit`가 시작 창의 닫힘을 허용하고 늦은 installing 알림에도 이를 유지한다. 초안 취소·인계 실패·새 창에서는 일반 닫힘 정책을 복구한다. 메인 창의 작성 내용 확인과 `will-quit` 이후 설치기 인계는 유지한다. [기존 버그 재현](startup-quit-0.4.10/old-startup-quit-reproduction.json), [관련 시험79/79](startup-quit-0.4.10/source-tests.txt), [실제 Electron53/53](startup-quit-0.4.10/startup-native.json)을 보존한다. 네이티브 검사는 실제 시작 창·gate/updater·원문 main 종료 핸들러를 연결해 정상 시작13개, 초안 취소 후 재시도20개, 인계 실패 후 오류 창·재시도20개를 확인했다. 세 경우 모두 인계 응답1회·정상 종료·합성 자식의 부모 종료 확인에 통과했으며, 실제 계정·설치 실행은 없다.

| 최종 패키지 근거 | 결과 |
| --- | --- |
| [Windows 빌드](startup-quit-0.4.10/windows-build.json), [내장 payload 대조](startup-quit-0.4.10/windows-wrapper.json), [패키지 실행](startup-quit-0.4.10/windows-native.json) | 75파일 일치, packaged25/25, 정상 종료·ASAR 바이트 보존. |
| [Mac 검증](startup-quit-0.4.10/mac-evidence.json) | ARM34/34·Intel37/37, 각 패키지18/18, CI38525733231 성공. |
| [조립 manifest](startup-quit-0.4.10/preview.json) | 세 대상 sourceHash·버전·build 일치, Windows 원본과 Mac GitHub 자산 바이트/SHA 검증. |
| [공개 영수증](startup-quit-0.4.10/publication.json), [실제 공개 대조](startup-quit-0.4.10/public-verification.json) | 공개 커밋 `130b323072befae0dad6a05a520e6670fee3f9db`. 한영 홈페이지·feed·client.js와 세 공개 설치파일 전체 바이트/SHA 일치, Pages38528726382 성공. 독립 파일 다운로드는 병렬로 검증하되 세 파일 모두 통과한 뒤에만 feed를 전환한다. 관련 게시 시험3/3. |
| [공개 CI](startup-quit-0.4.10/public-ci.json) | 같은 공개 커밋의 Pages38528726382·전체 사이트 점검38528726787 모두 성공. |
| [PC 사전 검사](startup-quit-0.4.10/pc-preflight.json), [실제 설치](startup-quit-0.4.10/pc-apply.json), [설치 updater](startup-quit-0.4.10/pc-installed-update.json) | 실행 프로세스0에서 공개 파일과 같은 설치기 적용. 75파일·ASAR·metadata/sourceHash 일치. 설치된 updater가 `current / 0.4.10 / 20261014.7` 응답. 이 도구의 사용자 프로필 작업0·앱 실행0. |
| [기록·프로필 백업](../platform-real-account-20261010/installed-auto-connect-20261014/profile-backup-before-install.json), [프로그램 백업](../platform-real-account-20261010/installed-auto-connect-20261014/program-backup-049.json), [설치 직후 기록 대조](../platform-real-account-20261010/installed-auto-connect-20261014/profile-preservation-after-install.json) | 최신 Platform318+Suite1파일, 기존 프로그램77파일·등록6위치·바로가기2를 보존. 설치 직후319파일의 변경·누락·추가0. 계정·메모 내용을 보고하지 않는다. |
| [실제 UI 중단 기록](../platform-real-account-20261010/installed-auto-connect-20261014/actual-ui.json) | 마지막 실행 도구가 Esc 중지를 감지했고 이후 사용자가 앱 조작 중단을 명시했다. 최종 0.4.10 첫 실행·라이브러리 자동 연결·재실행은 미확인, 추가 앱 조작0. ‘닫으면 트레이로’는 꺼짐 상태로 복원하지 않았다. |

<a id="library-auto-049"></a>

## 0.4.9 계정 라이브러리 자동 연결 · 공개 후 실제 업데이트 정체 발견

**당시 상태: 세 대상 최종 검증·공개 완료 뒤 기존 0.4.7의 실제 시작 업데이트가 설치 중에 정체했다.** 이 항목은 0.4.9 당시의 이력이며, 최종 0.4.10 반영 결과는 위 절을 따른다.

2026-10-14 15:41 실행한 기존 0.4.7은 0.4.9 다운로드를 끝냈으나 설치 중 화면에 남았다. `setClosable(false)`인 업데이트 창이 Windows의 `app.quit()`도 거부해 `will-quit` 설치기 인계에 도달하지 못했다. 격리 Electron44.5.1에서 같은 실패를 재현했고, 닫힘을 허용하면 정상 종료되는 것을 확인했다. 0.4.9에도 같은 원문이 남아 있으므로 공개 파일을 교체하지 않고 0.4.10으로 수정한다. 기존 current-feed 패키지 검사와 plain-window 인계 검사는 실제 업데이트 창의 이 상태를 거치지 않아 놓쳤다.

0.4.9 / build20261014.6의 동결 원문은 `8e677fc7e09e8738002c8bb13909a596ce2c643d9df8cbf152bf6251a5a354a1`이다. [동결 입력](library-auto-0.4.9/release-input.json)과 [추가 범위](library-auto-0.4.9/integration-scope.json)대로 기존 0.4.7에서 `renderer/launcher.mjs`·`renderer/platform-continuity.mjs` 두 파일만 변경했다. [번들 범위 검증](library-auto-0.4.9/reviewed-bundle-proof.json)은 기존 의존 모듈을 그대로 보존하고 최종 view 원문을 반영했음을 확인한다. 다른 작업의 가족 앨범·개인 데이터 변경은 이 릴리스에 섞지 않았다. 0.4.8은 지연 조회 중 동작 유실을 발견해 공개하지 않은 후보로 보존한다.

검증된 기존 로그인 뒤 라이브러리를 자동 시작하며, 중복 계정 이벤트는 추가 연결을 만들지 않는다. 조회 중의 즐겨찾기·정렬·성공한 앱 실행 기록은 준비 완료와 같은 계정을 확인한 뒤 순서대로 반영한다. 대기 동작이 있으면 종료·업데이트·로그아웃을 안내와 함께 보류한다. 읽기 실패를 빈 문서로 취급해 덮어쓰지 않으며, 이미 불러온 문서의 기존 오프라인 저장은 유지한다. 저장 동의·OAuth·기기 기록 가져오기·복구본 선택은 자동 변경하지 않는다.

| 근거 | 결과와 범위 |
| --- | --- |
| [원문 시험](library-auto-0.4.9/source-tests.json) | 관련 6파일171/171. 도구 실행 결과를 관찰한 기록이며 전체 stdout 파일은 별도로 저장되지 않았다. |
| [동결 후보 renderer](library-auto-0.4.9/renderer-auth.txt), [입력 대조](library-auto-0.4.9/renderer-input-proof.json) | 정확한 후보86/86. 느린 읽기·실패·동의 꺼짐·계정 교체·동시 입력·저장 중 종료 보호 포함. |
| [실제 Electron 라이브러리 흐름](library-auto-0.4.9/library-auto-native.json) | 격리 프로필26/26. 최초·reload·새 창에서 연결 클릭0, 지연 저장 중 실제 창 닫기 방지와 저장 후 정상 종료. 합성 계정이며 실제 계정 시험과 구분한다. |
| [Windows 빌드](library-auto-0.4.9/windows-build.json), [설치기 내부 대조](library-auto-0.4.9/windows-wrapper.json), [패키지 실행](library-auto-0.4.9/windows-native.json) | 실제 설치본25/25. 정상 종료·ASAR 바이트 보존, 내장 payload75파일 일치, 허용16/거절4의 설치 변형 확인. 사용자 PC 설치는 별도다. |
| [Mac 공통 검증](library-auto-0.4.9/mac-evidence.json) | ARM34/34·Intel37/37 설치 QA 및 각 실제 패키지 흐름18/18. sourceHash·버전·build와 GitHub 자산 SHA 일치. 물리 Mac 교체·실계정 로그인은 별도다. |
| [공개 영수증](library-auto-0.4.9/publication.json), [공개 파일 대조](library-auto-0.4.9/public-verification.json) | 한영 홈페이지 세 링크·feed·client.js와 공개 설치파일 전체 다운로드 바이트/SHA 일치. 공개 커밋 `021e7d8ebbf972638076b816fff898a1372c2708`. |
| [공개 CI](library-auto-0.4.9/public-ci.json) | Pages38522638973·사이트 점검38522638912 모두 성공. 홈페이지 정본 manifest도 같은 바이트로 반영했다. |

## 0.4.7 통합본 · 이전 공개·PC 반영 이력

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

**내 성향 웹 후속 공개:** 담당 작업이 `account/` 4파일만 공개 커밋 `47fb0b72dddbf82bbbc8928f57b412beadf7badc`에 반영했다. Pages `38514869493`·전체 사이트 점검 `38514869666` 성공과 공개 4파일의 HTTP200·크기·전체 SHA 일치를 확인했고, 공통 0.4.7 feed·한영 홈페이지는 이전 공개 바이트 그대로다. [공개 증거](member-insight-web-publication.json), [화면 입구](https://synk.im/account/platform.html#benefits/insight). 배포 전 합성 브라우저 검사 55/55에 이어 14:29 KST [실제 계정 웹 UI](member-insight-real-web.json)의 두 영역·연결된 학습 요약·근거 펼침·새로고침 성공도 확인했다. 이후 [설치된 0.4.7의 성향 화면](member-insight-real-installed.json)도 기존 로그인 상태에서 두 영역·실제 Atlas 요약·기록 범위 안내가 웹과 일치함을 확인했다. 두 성향 검증의 계정 설정·프로필·노트 변경 및 인증 정보 읽기는 0이다.

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
