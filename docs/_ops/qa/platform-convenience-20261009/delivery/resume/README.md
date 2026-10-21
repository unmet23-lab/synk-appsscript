# 자동 시작·창 복원 보완 설치 완료 · 2026-10-09

사용자 「배포하고 종료해」 요청으로 현재 PC 배포를 마감했다. 현재 실행 소스·고정 후보·설치 EXE/ASAR와 아래 설치 파일 해시를 다시 대조했고, 바탕화면 바로가기와 기존 다섯 설정도 유지되어 있다. 이미 같은 검증본이 설치되어 있어 재설치로 실행 중인 앱을 다시 중단하지 않았다. [종료 시 대조](deployment-close.json). 이 10-09 설치에 사용한 파일은 아래 고정 후보이며, `desktop/dist`의 초기 10월 2일 묶음은 이력으로 보존한다.

이 10-09 요청 범위에서 남은 구현·설치는 없었다. 이후 현재 설치와 업데이트는 [자동 업데이트 원문](../../../platform-auto-update-20261014/README.md)과 [실제 설치·계정 확인](../../../platform-real-account-20261010/README.md)에서 확인한다. 후속 실기기 검증이 필요하면 [실제 PC 기록](../../resume-actual-pc.json)부터 재개하며 물리 재부팅·절전 복귀·모니터 탈착, 사용자 요청으로 보류한 두 PC 동기화는 미검증이다. 공개 다운로드·업데이트 채널, 코드 서명은 이번 개인 PC 배포에 포함하지 않는다.

후속 「이어서 진행해」에서 실제 PC 점검으로 확인한 두 문제를 보완하고 Platform Preview를 다시 묶었다. Windows가 꺼 둔 자동 시작 상태를 설정에 반영하고, 숨김 시작의 최대화 예약과 실행 중 모니터 크기·배율 변경에 대한 창 복원을 보강했다. 제품 변경은 `desktop-preferences.cjs`와 `window-placement.cjs` 두 파일뿐이다.

이 문서는 **고정 사본·설치 파일 생성·패키지 검증·설치 후 파일 대조와 격리 부팅**의 증거다. 이전 21:17 설치 후보의 기록은 [상위 기록](../README.md)에 보존한다. 실제 사용자 창 조작은 주 작업의 별도 기록에서 확인한다.

## 새 고정 후보

- 후보: `desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z`.
- sourceHash: `d13667497625aa18265f5062d6a5519a76999fad6328e8e26067c323cde7c4e9`.
- 이전 설치본 sourceHash: `3bd1a86480a036eea62a3851e5a64537a20841404d375bbb255190b64949d8ba`.
- [Platform Preview 0.4.0 · Windows x64 설치 파일](<../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/dist/preview/win32/x64/platform/SYNK Platform Preview-0.4.0-win-x64.exe>) — 396,383,060바이트.
- 설치 파일 SHA-256: `782f12ae4c44b65a41d1e50c75086b10924bc0da3a72dfc98fbd15fbe83b0c7d`.
- EXE SHA-256: `22bfaccfbfe00cb561fe6a43aa5cc9a5236f877c9abe83ff265411597cd0140b`.
- ASAR SHA-256: `8cc787bd2419776bda4d5d43b3f2922c57d983e47e5fd3bfc50cf8d46358f981`.

직전 설치본의 공개 인증 설정·9개 클라이언트·WORLD/Messenger release pins·동봉 설치 파일을 보존했다. 소스 공개 설정도 설치본과 일치했다. 현재 사용자 토큰·프로필·시작 프로그램·바로가기는 이 패키지 작업에서 읽거나 변경하지 않았다. 기존 버전 번호 0.4.0·앱 ID `im.synk.platform.preview`를 유지한 개인 PC용 Preview이며 서명은 `NotSigned`, 공개 배포는 하지 않았다.

## 실제 고정 파일 검증

| 범위 | 결과 |
|---|---|
| 동결 일치 | 복사 전·사본·복사 후·빌드 후 공유 원본 sourceHash 동일 |
| 이전 후보와 차이 | 실행 원본 100파일 중 위 두 파일만 변경, 제거 0 |
| 고정 사본 회귀 | **82/82**: 기존 편의 관련 66개 + 자동 시작 8개 + 창 복원 8개 |
| ASAR 바이트 | 실행 원본 **100/100** 일치, runtime·공개 인증·child pins·동봉 설치본 동일 |
| 실제 ASAR 네이티브 | **20/20**, 새 두 파일의 해시와 실제 Windows DPAPI·트레이·창 검사 기록 |
| 실제 ASAR 렌더러/preload | **35/35**, 명령·설정·탐색·정렬·알림·계정 전환·반응형 |
| 변경하지 않은 후보 EXE | **16/16**, main 이전 경로 격리·숨김 부팅·합성 암호화·외부 요청 0 |

이번 새 후보 검사는 첫 실행에서 모두 통과했다. 패키지의 실제 모듈·preload·renderer를 읽도록 QA 어댑터의 루트만 새 ASAR로 지정했고 제품 코드와 검증 조건은 바꾸지 않았다. 새 자동 시작·화면 변경의 특수 조건은 복사된 신규 회귀 16개에서 별도로 확인하며, 위 일반 native 20개가 Windows 로그인·물리 모니터 분리까지 재현한 결과라는 뜻은 아니다.

[고정 명세](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/snapshot-manifest.json) · [82개 회귀 로그](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/convenience-unit.log) · [100개 ASAR 대조](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/package-verification.json) · [실제 패키지 검사](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/package-qa.json) · [검증 요약](validation.json)

## 설치 후 확인 · 21:40~21:41 KST

주 작업에서 기존 앱을 정상 종료하고 사용자 트레이 설정을 복원한 뒤 새 후보 NSIS를 실행했다. [설치 실행 결과](install-result.json)는 **종료 코드 0**, 완료 2026-10-09 21:40:52 KST다.

설치된 EXE·ASAR·sourceHash·100원본·runtime·동봉 자식 설치본을 새 후보와 대조해 **6/6** 일치했고, 실제 설치 EXE의 격리 부팅도 **16/16** 통과했다. 첫 숨김 캡처의 `UnknownVizError`를 보존한 뒤 동일 설치 EXE로 순차 재검사했다. EXE와 ASAR 바이트는 전후 동일하며, 경로 격리 검사는 두 실행에서 모두 통과했다. 설치 검사 과정에서는 일반 사용자 프로필·토큰을 읽지 않았다.

[설치 파일 대조](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/installed-verification.json) · [설치 EXE 부팅](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/installed-boot.json) · [첫 캡처 실패 보존](../../../../../../desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z/artifacts/installed-boot-attempt1.json)

## 재현

저장소 루트에서 새 후보를 만들고 기존 도구로 검사했다.

```powershell
node desktop/tools/convenience-package-delivery.cjs snapshot
node desktop/tools/convenience-package-delivery.cjs build 'desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z'
node desktop/tools/convenience-package-qa.cjs 'desktop/artifacts/platform-convenience-candidate-2026-10-09T12-35-49-759Z'
```

고정 사본 디렉터리에서 `node --test tests/desktop-convenience.test.cjs tests/platform-tray.test.cjs tests/draft-recovery.test.cjs tests/renderer-draft-recovery.test.cjs tests/draft-recovery-ipc.test.cjs tests/diagnostics-clipboard.test.cjs tests/convenience.test.cjs tests/native-shell.test.cjs tests/draft-exit.test.cjs tests/startup-resume.test.cjs tests/window-resume.test.cjs`를 실행했다.
