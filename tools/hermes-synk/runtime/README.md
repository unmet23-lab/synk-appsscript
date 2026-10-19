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

게이트웨이가 떠 있어도 켤 때 올린 의존성 세대가 Hermes가 지금 고른 세대(`installs\<id>\facts.json`)와 다르면, 그 뒤에 깔린 패키지를 못 써서 해당 대화가 모두 실패한다(10-19 Claude 전환 뒤 anthropic). 이때 처음 본 확인에서는 `%LOCALAPPDATA%\hermes\synk-gateway-recovery.json`에 적기만 하고, 다음 확인에서 Hermes가 쉬는 중(`gateway_state.json`의 active_agents 0·`processes.json` 빈 목록이거나 아직 없음·도구 자식 프로세스 없음)이면 공식 `hermes gateway restart`를 한 번 부른다. 공식 restart는 처리 중인 대화를 기다리지 않으므로(Windows는 30초 뒤 강제 종료) 바쁘면 다음 확인으로 미루고, 같은 세대에는 두 번 부르지 않는다. 종료 코드: `-ReadOnly`에서 어긋남 5, 30분 넘게 바빠 아직 미룸 6, 이미 한 번 다시 켰는데도 어긋남 4, 재시작이 아직 안 끝남 3, 재시작 실패 1. 시험은 `node --test tests/hermes-synk-recovery.test.cjs`.

아직 확인 못 한 것(10-19 Fable 검수): ① 이 작업이 직접 띄우거나 다시 켠 게이트웨이가 작업 스케줄러 쪽에 묶이지 않는지 — 지금까지 게이트웨이는 터미널·시작프로그램으로만 떴다. 작업이 실제로 start/restart를 한 뒤 `Get-ScheduledTask SYNK_Hermes_Gateway_Recovery`의 State가 Ready로 돌아오고 `Get-ScheduledTaskInfo`의 LastRunTime이 2분마다 나아가는지 본다. ② 채팅 사이에 시작한 LLM 예약 작업은 active_agents에 안 잡혀, 그 사이 어긋남 재시작이 겹치면 끊긴다(지금 Hermes 예약은 AI 없는 스크립트 하나뿐). ③ `hermes update`가 게이트웨이를 멈춘 동안 이 작업의 `gateway start`가 옛 트리로 띄울 수 있는지(기존 경로).

작업은 Windows에 들어 있는 Windows PowerShell 5.1(`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`)로 돈다. 10-18 설치 때는 Codex 앱 셸의 `pwsh.exe`가 잡혀 작업이 그 앱 런타임에 묶였고, 10-19에 바꿨다(GPT를 끊어도 돌게).

검증: 현재 게이트웨이를 건드리지 않은 채 스케줄러의 실제 실행이 성공 종료(0)했고 PID가 유지됐다. 프로세스 종료를 일부러 일으키는 장애 시험과 휴대폰 수신·응답의 전 과정은 이 복구 스크립트 검증에 포함하지 않았다.
