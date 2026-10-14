# Platform 0.4.4 공통 배포·현재 PC 설치

2026-10-14 사용자 요청에 따라 홈페이지 다운로드와 PC 앱을 **Preview 0.4.4 / build 20261014.1**로 통일했다. 공개 홈페이지와 앱은 `https://synk.im/desktop/releases/preview.json`을 함께 사용한다. [배포 manifest](release-manifest.json), [공통 배포 절차](../../../../desktop/LIFECYCLE.md#platform-release-reproduction).

## 실제 반영

- 공개 소스 `3a002cc627828643517a1e6d9e2764a4e52944b7`, 게시 도구 `892d6087913116b278381e35f4854e8977360612`, 홈페이지·feed `2fb762a954b29a21758226ec0c8af89964f72d0b`.
- [0.4.4 공개 릴리스](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.4): Windows x64 402,719,744 bytes, Mac arm64 461,999,357 bytes, Mac x64 479,638,966 bytes. 세 공개 다운로드를 끝까지 읽어 manifest의 SHA-256과 대조했다. [게시 영수증](publication.json).
- Pages `38505838439` 성공, 전체 사이트 점검 `38505838465` 성공. [CI 결과](site-ci.json). 한국어·영어 공개 페이지의 표시 버전·3개 링크·3개 설치 안내창 다시 받기·feed 응답 **15/15** 일치. [공개 UI](homepage-live-qa.json).
- 기존 설치 77파일·설치 등록·바로가기 백업을 압축 내부 해시까지 검증한 후, 공개 Windows 설치기와 동일 SHA의 내장 `InstallerEngine.Install`을 실행했다. 기존 정상 종료·설치 대상·3GiB 공간·프로세스 검사는 그대로 적용했다. [설치 결과](installed.json), [백업 영수증](rollback-receipt.json).
- 설치 뒤 75개 payload 파일을 별도 코드로 크기·SHA-256 대조했다. 설치된 ASAR의 updater 코드를 직접 읽어 공개 feed를 조회했으며 `current / 0.4.4 / 20261014.1`로 응답했다. 다운로드·추가 설치·계정 접근은 0이다. [설치 바이트·실제 feed](installed-live-update.json).
- 실제 설치 경로에서 `SYNK Platform` 창 실행·응답을 확인했다. 네이티브 창의 시각 검사를 대신한 주장이 아니다. [실행 확인](running.json).

백업과 복구 도구는 `.tmp/platform-unified-20261014/rollback/` 및 `rollback-platform.ps1`에 보존한다. 446,455,962-byte ZIP의 SHA-256은 영수증에 있다. 설치 도구가 계정·토큰·메모·userData를 읽거나 변경한 작업은 없다. 기존 별도 WORLD/Workspace 앱 설치 경로는 변경하지 않았다.

## 검증과 범위

원문 관련 **140개** 시험 통과([로그](source-tests.txt)), 조립 도구18개·게시 도구3개 통과. 실제 Windows 패키지 부팅·암호화 합성 왕복([결과](windows-native-smoke.json))과 설치기 payload 검증([결과](windows-installer-proof.json)), Mac CI run `38503684241`의 arm64/x64 네이티브 QA 성공([arm64](mac-arm64-qa.json), [x64](mac-x64-qa.json)). Windows 업데이트의 미저장 작업 취소→재시도→정상 종료 후 설치기 인계는 합성 설치파일로 실제 Electron에서 확인했다([결과](update-exit-qa.json)). 홈페이지의 새 feed·잘못된 feed·503·이전 버전 유지·모바일 안내창 **61/61** 통과([결과](homepage-fixture-qa.json)).

새 계정 생성·가입 뒤 PC 로그인 왕복, 실물 Mac 수동 설치, 사용자 PC에서 향후 0.4.5 업데이트를 버튼으로 완료하는 왕복은 아직 수행하지 않았다. Windows는 미서명, Mac은 ad-hoc Preview이며 정식 코드 서명·공증 유예를 유지한다. WORLD·Workspace의 독립 버전은 이 Platform feed의 대상이 아니다.

웹 원천은 `C:/Users/q1212/Documents/SYNK-website`의 `b7dbaa3`에 저장했다. 표적 v10 build 성공, 관련 feed 시험2개 통과. 전체 v10 계약23/24의 유일한 실패는 기존 HEAD에도 있는 PATH rehearsal 페이지의 로컬 파일 누락이며 이번 배포는 해당 부분을 변경하지 않았다.

## 이후 업데이트

원문을 한 번 동결해 세 운영체제를 빌드·검증하고 `assemble-platform-release.cjs`와 `publish-platform-release.cjs`로 한 번 게시한다. 세 설치파일이 모두 준비되지 않으면 홈페이지·feed를 전환하지 않는다. 공개 버전의 파일을 바꾸거나 PC ASAR만 따로 패치하지 않는다. 변경은 반드시 새 버전으로 게시한다.

앱은 시작과 6시간 주기로 확인한다. 사용자가 다운로드와 설치를 선택하면 Windows는 미저장 작업 보호와 정상 종료 후 시그널 설치기를 열고, Mac은 DMG를 연다. 실제 설치 버튼/Applications 교체는 사용자 조작이다. 0.4.3 이하의 기존 사용자는 홈페이지에서 업데이트 기능이 포함된 0.4.4를 한 번 설치해야 한다.
