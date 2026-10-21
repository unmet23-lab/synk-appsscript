# Windows 실제 통합 확인 · 2026-10-09

[실행 기록](os-integration.json): **23/23 통과**, Electron 44.5.1 정상 종료. 실행 도구는 [desktop-preferences-os-smoke.cjs](../../../../desktop/tools/desktop-preferences-os-smoke.cjs)다. 제품 코드는 변경하지 않았다.

- 실제 Windows 시작 프로그램 API와 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`을 통해 고유 QA 항목의 등록, 실행 파일·자동 시작 인수, 상태 재확인, 해제를 확인했다.
- 실제 두 Electron 프로세스에서 `Control+Alt+Shift+F24` 등록 충돌을 확인했다. 실패한 쪽은 `SHORTCUT_UNAVAILABLE`을 반환하고 기존 전역 단축키를 보존했다. 소유 프로세스가 해제한 뒤 다른 프로세스가 같은 키를 등록·해제했고, 저장한 설정을 새 컨트롤러가 읽어 다시 등록하는 것도 확인했다.
- Windows가 반환한 현재 모니터 1개의 작업 영역을 기준으로 화면 밖에 저장된 창 위치를 안전한 범위로 복원했다. 최대화 상태를 기억해도 숨김 시작 창이 나타나지 않았다.
- 사용자 입력·클립보드·실제 SYNK 설정·계정을 건드리지 않았다. QA 프로세스는 화면을 표시하지 않았고 외부 요청은 0건이다.
- QA 시작 항목·단축키·임시 프로필을 제거했다. 기존 `Run`과 `StartupApproved\Run` 전체의 전후 SHA-256이 같아 다른 앱의 시작 설정 보존을 확인했다. 종료 뒤 이 도구의 Electron 프로세스도 남지 않았다.

이 검증은 **등록과 OS 상태의 왕복**이다. 실제 키를 누른 뒤 검색창이 뜨는 흐름, Windows 재로그인 후 자동 실행, 절전·복귀, 물리 모니터 분리·재연결은 수행하지 않았다. 화면 밖 좌표 복원 검증은 물리 모니터를 뽑은 증거로 간주하지 않는다.
