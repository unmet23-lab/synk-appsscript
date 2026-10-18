# Hermes 실행 복구

기존 Hermes 팁 봇과 공식 로그인 시작프로그램을 유지하며, Windows 작업 스케줄러가 로그인한 사용자의 Hermes 프로세스를 2분마다 확인한다. AI 호출 없이 PID·실행 파일·`gateway run` 명령이 맞는지 보고, 프로세스가 없을 때만 공식 `hermes gateway start`를 부른다. 프로세스를 강제 종료하거나 다른 모델로 바꾸지 않는다.

```powershell
# 설치 또는 같은 소유 작업의 설정 갱신
pwsh -NoProfile -File tools/hermes-synk/runtime/install-recovery.ps1

# 실행 상태만 확인
pwsh -NoProfile -File tools/hermes-synk/runtime/recover-gateway.ps1 -ReadOnly

# 이 복구 작업만 제거. 원래 Hermes 시작프로그램은 유지
pwsh -NoProfile -File tools/hermes-synk/runtime/install-recovery.ps1 -Remove
```

작업 이름은 `SYNK_Hermes_Gateway_Recovery`다. 사용자 로그아웃·PC 종료·절전 중에는 실행되지 않는다. 프로세스는 살아 있지만 응답하지 않는 경우에는 Hermes 자체 watchdog이 종료할 때까지 기다린다. 계획된 게이트웨이 중지나 유지보수 중에는 이 작업을 잠시 사용 중지하고 완료 후 다시 켠다.

```powershell
Disable-ScheduledTask -TaskName SYNK_Hermes_Gateway_Recovery
Enable-ScheduledTask -TaskName SYNK_Hermes_Gateway_Recovery
Get-ScheduledTaskInfo -TaskName SYNK_Hermes_Gateway_Recovery
```

2026-10-18 적용: 현재 전원 구성표에서 전원 연결 시 유휴 절전·최대절전을 각각 3,600초에서 0(사용 안 함)으로 변경했다. 배터리의 두 값은 모두 3,600초를 유지하고 덮개 닫기 동작도 유지했다. 원래 값과 복구 스크립트는 `.tmp/hermes-improve-20261018/runtime/`에 있다. 덮개를 닫아 절전하거나 로그아웃하면 휴대폰 요청은 즉시 처리되지 않는다.

검증: 현재 게이트웨이를 건드리지 않은 채 스케줄러의 실제 실행이 성공 종료(0)했고 PID가 유지됐다. 프로세스 종료를 일부러 일으키는 장애 시험과 휴대폰 수신·응답의 전 과정은 이 복구 스크립트 검증에 포함하지 않았다.
