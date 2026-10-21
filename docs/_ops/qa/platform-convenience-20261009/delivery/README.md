# 플랫폼 편의 기능 Preview 설치 후보 · 2026-10-09

사용자 「이어서 해」에 따라 개인 PC용 **Platform Preview 0.4.0 · Windows x64** 설치본을 새로 만들었다. 현재 `desktop`의 실행 원본 100파일을 고정 사본으로 복사하고, 그 사본의 실제 ASAR·렌더러·EXE를 검사했다. 설치 실행과 사용자 창·계정 확인은 이 패키지 검사와 별도로 기록한다. 공개 배포는 하지 않았다.

## 후보와 보존 범위

- 고정 사본: `desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z`.
- sourceHash: `3bd1a86480a036eea62a3851e5a64537a20841404d375bbb255190b64949d8ba`.
- 설치 파일: [SYNK Platform Preview-0.4.0-win-x64.exe](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/dist/preview/win32/x64/platform/SYNK%20Platform%20Preview-0.4.0-win-x64.exe), 396,382,164바이트.
- 설치 파일 SHA-256: `a965f64131300ef5fb209d12f67f3386c88407aaa46291dde403ae1ac6c3357e`.
- EXE SHA-256: `ca013a915b67afff19ecb90c20e058ce7ae0544fbd7512e7d745e2e1bddbc7e0`.
- ASAR SHA-256: `4e79c368e9cc22ef2f116d92fc2b2af0c97eaff6bffd70dbdee3f4278a660ae5`.
- 기존 Preview 설치본의 공개 OAuth 설정과 현재 소스 `auth-config.json`이 동일하며, Platform 인증 fingerprint와 9개 클라이언트 등록을 보존했다. 토큰 파일이나 원래 프로필은 읽지 않았다.
- 기존 Preview의 WORLD·Messenger 실행/설치 해시와 동봉 설치 파일을 그대로 보존했다. 두 자식 앱은 다시 만들거나 설치하지 않았다.
- 앱 ID/프로필 범위는 `im.synk.platform.preview`, 기존 기본 설치 위치는 `%LOCALAPPDATA%/Programs/SYNKPlatformPreview`다. 소스 개발판도 같은 프로필·단일 실행 범위를 쓰므로 일반 실행 전에 기존 창을 정상 종료해야 한다.
- 개인 PC용 서명되지 않은 Preview이며 설치 파일 서명 상태는 `NotSigned`다. 정식 배포 채널이나 자동 업데이트를 추가하지 않았다.

[고정 입력 명세](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/snapshot-manifest.json) · [패키지 대조](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/package-verification.json)

## 검증

| 대상 | 결과 |
|---|---|
| 소스 동결 | 복사 전·고정 사본·복사 후 sourceHash 일치. 빌드 후에도 공유 실행 원본과 일치 |
| 이전 native 증거와 현재 코드 | 핵심 7파일의 SHA-256 모두 일치 |
| 고정 소스의 편의 기능 관련 회귀 | **66/66**: 창 복원·설정·트레이·초안·IPC·진단·렌더러 복구·기존 종료 보호 |
| ASAR 포함 원본 | **100/100** 바이트 일치, 공개 인증 설정·child release pins·동봉 설치 파일 일치 |
| 실제 ASAR 네이티브 모듈 | **20/20**: 숨김 창·확대·창 위치·트레이·실제 Windows DPAPI·합성 계정 간 초안 격리 |
| 실제 ASAR 렌더러/preload | **35/35**: 명령 검색·설정·탐색·정렬·알림·계정 전환·1440/1280/390/320px |
| 변경하지 않은 후보 EXE | **16/16**: main 시작 전 경로 격리, hidden boot, packageBootOnly, Node 차단, 합성 암호화 왕복, 외부 요청/콘솔 오류 0 |
| 화면 확인 | 실제 ASAR의 320px 검색 캡처를 직접 확인. 제목·입력·선택 항목·단축키 안내 표시 |

[회귀 로그](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/convenience-unit.log) · [ASAR/EXE 검사 요약](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/package-qa.json) · [320px 검색 화면](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/asar-renderer/command-320.png)

합성 네이티브 검사와 렌더러 검사는 임시 프로필만 사용하고 종료 후 제거했다. EXE 부팅은 기존 `--synk-smoke`를 사용하며, 디버거로 첫 main 프레임에서 `appData/temp/userData/sessionData`를 새 임시 폴더로 설정하고 ready 시 다시 검증했다. 원래 사용자 프로필·실계정·시작 프로그램·전역 단축키를 변경하지 않았다. EXE의 부팅 전후 바이트가 같다. EXE 검사의 격리 폴더와 출력은 증거로 남겼다.

첫 검사에서는 ASAR 경로를 자식 프로세스 working directory로 쓰는 QA 어댑터 오류가 발생했다. working directory를 고정 후보 폴더로 고쳐 검사 절차만 바로잡았다. 첫 EXE 부팅의 숨김 캡처에서도 `UnknownVizError`가 발생했고, 실패 결과를 보존한 뒤 같은 EXE 순차 재검사가 통과했다. 또한 Windows ASAR 3단계 자산 경로는 검증기에서 `path.normalize`한 뒤 읽도록 바로잡았다. 이러한 수정은 QA/검증기만 바꾸며 제품 파일과 최종 설치 파일을 바꾸지 않았다.

## 현재 PC 설치 후 대조 · 21:17 KST

주 작업에서 사용자 앱을 정상 종료한 뒤 이 후보 NSIS를 `/S`로 실행했고 **종료 코드 0**, 2026-10-09 21:17:19 KST 완료를 확인했다. 이어 설치된 `%LOCALAPPDATA%/Programs/SYNKPlatformPreview`의 EXE·ASAR·sourceHash·100원본·runtime·동봉 자식 설치 파일을 후보와 대조해 **6/6** 일치했다.

변경하지 않은 설치 EXE도 첫 main 프레임 이전에 새 임시 경로로 격리해 **16/16** 부팅 검사를 통과했고 정상 종료했다. 첫 숨김 캡처의 `UnknownVizError`는 `installed-boot-attempt1.json`에 보존했으며 같은 설치 EXE의 순차 재검사에서 통과했다. 이 단계도 원래 프로필이나 토큰을 읽지 않았다. 일반 사용자 창·설정 복원·실계정 확인은 주 작업의 별도 기록 범위다.

[설치 파일 대조](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/installed-verification.json) · [설치 EXE 격리 부팅](../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/artifacts/installed-boot.json)

## 재현 명령

저장소 루트에서 아래 순서로 실행했다. `snapshot`은 항상 새 고정 후보를 만들므로 기존 후보 재검사에는 `verify`만 쓴다.

```powershell
node desktop/tools/convenience-package-delivery.cjs snapshot
node desktop/tools/convenience-package-delivery.cjs build 'desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z'
node desktop/tools/convenience-package-delivery.cjs verify 'desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z'
node desktop/tools/convenience-package-qa.cjs 'desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z'
```

이 기록의 완료 범위는 **새 설치 파일 생성·실제 패키지 검사·설치 파일 대조·설치 EXE 격리 부팅**이다. 사용자 일반 프로필의 재시작·실계정 왕복과 실제 Windows 로그인/절전/물리 모니터 변경은 별도 증거가 필요하다.
