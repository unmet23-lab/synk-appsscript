# 개인 Preview 재설치 파일 · 2026-10-10

최종 v4의 코드·인증·제품 구성을 기준으로 Windows x64 재설치 파일 세 개를 만들고 내장 payload를 검사했다. **2026-10-10 06:22 KST에 Platform만 현재 PC에 실제 재설치 완료**했다. 전체 설치 검사96/96, 별도 설치·원문·복구 준비 검사109/109, 등록·바로가기28/28을 통과했다. WORLD·Workspace의 기존 설치 코드는 그대로이고, 공개 업로드는 하지 않았다.

버전은 기존 **0.4.0 개인 Preview**를 유지했다. 공개 새 버전·자동 업데이트 배포용 산출물이 아니다. 기존 코드 서명 정책을 유지한 unsigned Preview다. 각 제품의 appId, 실행 파일, 인증 구성, 저장소 원문100/source e5e29cac 및 계정·프로필·금고 경로를 보존했다. canonical product source에는 손대지 않았다.

| 제품 | 재설치 파일 | 바이트 | 설치 파일 SHA-256 |
| --- | --- | ---: | --- |
| WORLD | [SYNK WORLD Preview](<../../../../desktop/artifacts/platform-reinstall-20261010/SYNK WORLD Preview-0.4.0-win-x64.exe>) | 132343097 | `537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4` |
| Workspace | [SYNK Workspace Preview](<../../../../desktop/artifacts/platform-reinstall-20261010/SYNK Workspace Preview-0.4.0-win-x64.exe>) | 132289230 | `b1028c0891ba7dfe69c0958c41eb3fc2b2b5569104682906b03da794f298f16b` |
| Platform | [SYNK Platform Preview](<../../../../desktop/artifacts/platform-reinstall-20261010/SYNK Platform Preview-0.4.0-win-x64.exe>) | 396515533 | `0ee66f9f697b9e718a917aa93afe925ff11ce4693250801de4db9fb531c66daa` |

WORLD·Workspace의 ASAR는 설치 v4와 바이트 동일하다. Platform만 기존 두 자식 release pin에 최신 WORLD·Workspace 설치 파일의 상대 경로·SHA·바이트를 추가하고 실제 파일을 `resources/clients`에 넣었다. Platform의 다른 runtime 필드, 인증, package 및 제품 원문은 그대로이며 새 ASAR SHA는 `eaa006fec10921cbb2681fd52f791fa1ac3ceb008097a951be684209160cf45e`다.

- [빌드 결과](package-result.json): 기존 검수된 frozen v4 stage/ASAR/metadata와 실제 설치 실행 파일을 분리 복사하고 기존 electron-builder의 prepackaged NSIS를 사용했다. generic `prepare()`로 현재 공용 제품 원문을 다시 구성하지 않았다.
- [실제 설치 파일의 payload 대조](verification.json): **47/47**. NSIS를 실행하지 않고 7-Zip CRC와 내장 7z 추출로 검증했다. 세 제품 원문 각각100개, 전체 payload 각각74/75/76파일, SHA/바이트/ASAR/package/metadata/auth 및 Platform의 실제 자식 설치 파일을 대조했다. NSIS 후미 데이터에 대한 7-Zip 경고는 정상적인 embedded payload 탐색 결과이며 CRC·추출 exit0이다.
- [NSIS 설치 identity 대조](nsis-identity.json): **30/30**. 실제 빌드 appId·executableName·NSIS 옵션과 정확한 기존 HKCU uninstall 세 항목을 비교했다. pinned builder의 UUID/folder 계약을 사용한 GUID가 기존 키와 일치하고 폴더는 `SYNKWorldPreview`/`SYNKMessengerPreview`/`SYNKPlatformPreview`다. Workspace 표시는 새 브랜드명이지만 GUID·폴더가 갈라지지 않는다. NSIS 명령을 디컴파일하거나 실제 upgrade를 실행했다는 증거는 아니다.
- `deleteAppDataOnUninstall:false`, `runAfterFinish:false`, perUser·자동 elevation 없음·설치 폴더 변경 없음 정책을 유지했다. 패키지 제작·정적 검증 단계에서는 설치를 실행하지 않았다. 아래 실제 재설치에서 Platform NSIS 한 번을 실행했으며 설치기가 기존 등록을 갱신했다. 스크립트의 앱 종료 명령·정상 프로필/금고 열기·실계정 로그인·공개 업로드·신규 결제는 **0**이다.

원문 검수는 [최종 notice-review](../native-followup-corrections-20261010/notice-review/official-review-validation.json), 설치 v4 기준은 [기존 인수](../workspace-connect-20261009/native-recovery-acceptance-v4.json)다.

## 최종 검토·실제 반영

[공식 후보 검수](review/official-review.json)는 sole Opus5.5/max·completed·exit0·denial0와 원본31pin 보존을 확인했다. 실제 보고서는 P0/P1 없이 **조건부 적합**이며 원래 설치 실행 계획의 P2 세 가지와 로그 포함, P3 제약을 명시한다. 하네스 완료를 제품 PASS로 바꾸지 않았다. [root 판정](review/assessment.json)에서 원래 계획을 승인하지 않고 별도 [v2 계획](install-platform-v2.ps1)으로 전체76파일 검사·실패 영수증·ignored .tmp 백업·용량·숨김 링크·프로세스 경로·검수/실행 파일 pin을 보강했다. 개인 로컬 재설치 보조의 변경이며 v2가 새 공식 Claude 검수를 받았다고 주장하지 않는다.

Workspace 설치 파일에 포함된358바이트 로그는 Windows 진단 두 줄이며 인증값·메모·개인정보는 발견되지 않았다. [판정](debug-log-assessment.json)에 따라 **같은 PC 개인 재설치로만 수용하고 이 세 파일을 공개 다운로드로 사용하지 않는다**. 공개 배포 시 로그 제거와 새 패키지 검증이 필요하다.

- [실제 NSIS 설치](installed-platform.json): exit0·**96/96**, 닫힘 확인 두 번, 프로그램 파일만 전체 백업. 표준 NSIS 자체 종료 경로는 존재하며 스크립트에 직접 종료 명령이 없다는 사실을 NSIS가 종료하지 않았다는 관찰로 확대하지 않는다. 설치 후 앱은 자동 실행하지 않았다.
- [독립 설치 대조](installed-independent-verification.json): **109/109**, 실제76payload·세 앱 원문각100·인증/package/runtime 경계·WORLD/Workspace 기존 ASAR/EXE/uninstaller 보존. 설치된 Platform의 실제 자식 설치 파일을 격리 캐시로 복사해 크기·SHA검증을 거쳐 두 제품 모두 `ready`, `canOpen:true` 확인. 자식 installer·사용자 앱을 실행하지 않았다.
- [등록·바로가기](installed-registration-verification.json): **28/28**, 기존3개 GUID·설치 폴더·버전·이름·제거 경로·HKLM 부재와 시작 메뉴3개 실행 대상/AUMI 보존.
- [실사용 절차](acceptance/README.md): 실계정 로그아웃/재로그인·메모·교사/학생·실물 폰·닫힌 Care의 OS 알림·IME **8항목 NOT_RUN**. 사용자는 현재 폰 및 정상 PC 화면 확인이 어렵다고 답했다.
- [서명·자동업데이트 준비](release-readiness/README.md): 인증서 보유 없음 사용자 확인, NotSigned 개인 Preview 유지. 신규 인증서 발급/구매와 공개 feed 활성화는 수행하지 않았다.

준비 보조의 저장소 경로 계산 오류, Windows ASAR path 구분자 오류, 동일 경로 ASAR 재생성 뒤 라이브러리 캐시로 인한 읽기 오류를 각 로그와 실패 영수증에 보존했다. 마지막 캐시 오류는 새 프로세스에서 실제 원문 일치를 확인하고 `asar.uncache()`로 해결했다. 이미 성공한 두 자식 설치 파일은 다시 만들지 않았다. 불완전 attempt1·각 실패 기록을 지우지 않았으며 최종 성공은 별도 `package-result.json`/`verification.json`이다.

빌드·복사본·실제 payload 추출·프로그램 백업·격리 복구 캐시를 보존했다. 설치 시작 전2GB 이상, 백업 후1.3GB 이상 여유를 확인했다. 남은 용량은 후속 빌드 전 다시 확인해야 하며 보존 파일을 임의 삭제하지 않았다.
