# Windows 플랫폼 닫기 → 트레이 · 2026-10-09

사용자 요청: 창을 닫을 때 앱을 완전히 종료하지 않고 작업표시줄 알림 영역에 남긴다.

- `desktop/src/platform-tray.cjs`: 실제 Windows Tray·열기/완전히 종료 메뉴, 창 숨김·복원, 종료 취소·트레이 정리. 트레이 생성 실패 시 기존 닫기를 유지한다.
- `desktop/src/main.cjs`: Windows 플랫폼에만 적용, 자동 smoke·다른 클라이언트는 기존 동작. 환경에 실제 `closeToTray` 상태를 전달한다.
- `desktop/renderer/launcher.mjs`: 트레이에 숨길 때는 초안 확인·버리기 없이 기존 페이지를 유지한다. 실제 종료는 기존 네이티브 초안 보호를 따른다.

자동 시험 71/71: 신규 `platform-tray.test.cjs` 20, 기존 `draft-exit.test.cjs`·`native-shell.test.cjs`·`renderer-auth.test.cjs` 51. 실제 Electron 44.5.1의 BrowserWindow·Tray·Menu, 합성 DOM 초안으로 숨김/복원·최소화 복원·종료 취소 후 재닫기·명시 버리기 뒤 정상 프로세스 종료와 트레이 제거 16/16을 확인했다. [실행 결과](native.json). 격리 임시 프로필 삭제, 외부 요청 0.

바탕화면 `SYNK 플랫폼.lnk`는 저장소 `desktop`을 `--synk-dev --client=platform`로 연다. 이 바로가기로 실제 소스 창을 열고 Computer Use로 해당 창과 X를 확인했다. X 클릭 뒤 원래 main PID 49748의 프로세스 생존과 빈 MainWindowTitle을 확인했다. 바로가기 재실행의 추가 화면 확인 중 사용자가 물리 Escape로 Computer Use를 중단했으므로, 이후 직접 화면 검증은 수행하지 않았다. 실제 사용자 초안을 입력·삭제하거나 로그인을 수행하지 않았다.

기존 `node desktop/tools/smoke.cjs --client=platform`는 부팅·격리·암호화 보관·원격 요청 0·콘솔 오류 0을 확인했으나, UI probe의 과거 '게스트 WORLD만 표시' 가정 관련 4검사가 현재 개발판 전체 앱 표시와 달라 실패했다. 트레이는 이 smoke에서 비활성화되며, 해당 실패를 이번 기능의 통과 결과에 포함하지 않는다.

별도 `SYNK Platform Preview` 설치 EXE·다른 앱·운영 서버·공개 웹은 이번에 갱신하지 않았다. 최신 소스 해시는 `native.json`과 대조했으며, 개인 PC 사용 바로가기의 로컬 소스 반영과 설치본 배포를 구분한다.
