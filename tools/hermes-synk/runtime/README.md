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

경고는 텔레그램으로 한 번 알린다(10-20): 점검마다 결과를 `%LOCALAPPDATA%\hermes\synk-gateway-recovery-status.json`에 남긴다. 담는 것은 점검 시각·종료 코드·어긋남 여부·세대·처음 확인 시각뿐이고, Windows PowerShell이 BOM을 붙이지 않게 ASCII로만 쓴다. `-ReadOnly`와 게이트웨이 모듈 목록을 못 읽은 점검은 남기지 않는다. AI 없는 SYNK 감시(`synk-three-flows`, 5분마다)가 이 기록을 읽어, 재시작 뒤에도 새로 깔린 패키지를 못 쓰거나(4) 30분 넘게 바빠 재시작을 미룬(6) 경우만 판단이 필요한 일로 한 번 보낸다. 같은 문제는 다시 보내지 않고, 풀린 뒤 다시 생기면 새로 보낸다. 15분 넘게 새 기록이 없으면(절전·작업 일시 중지) 판단을 바꾸지 않는다. 알림 문구는 감시(`tools/hermes-synk/overview.cjs`)가 짓고 종료 코드·세대 번호는 보이지 않는다. `/synk_today`에는 「헤르메스 게이트웨이 복구 점검」 한 줄로 나온다. 알리지 못하는 경우도 있다. 이 감시는 게이트웨이 안에서 돌기 때문에 게이트웨이가 아예 꺼져 켜지지도 않는 경우는 알리지 못한다.

복구 작업 자체가 멈춘 경우(작업 꺼짐·스크립트 구문 오류·끝나지 않는 실행)도 한 번 알린다(10-20). 감시는 회차마다 끊김 없이 이어 돈 시작 시각을 `runtime\synk-automation\state.json`의 `awakeSince`에 남긴다. 앞 회차와 15분 넘게 벌어지면 절전·종료로 보고 새로 센다(실제 회차는 약 6분 간격). 이렇게 30분 넘게 이어 도는 동안 이 기록이 한 번도 새로 쓰이지 않으면 「헤르메스 복구 작업이 멈춤」을 보낸다. 기록이 아예 없을 때도 같다. 새로 쓰였는지는 기록 안의 점검 시각과 파일 수정 시각 가운데 늦은 쪽으로 보므로, 내용을 잠깐 못 읽었다고 멈춤으로 보지 않는다. 절전에서 깬 직후·부팅 직후에는 이어 센 시간이 짧아 알리지 않고, 그동안 판단도 바꾸지 않는다. 기록이 다시 쓰이면 풀린 것으로 보고, 다시 멈추면 새로 알린다. 어긋남 알림과는 사건을 따로 둬서, 작업을 다시 켰을 때 이미 알린 어긋남을 또 보내지 않는다. 유지보수로 이 작업을 꺼 두고 다시 켜는 것을 잊어도 30분 뒤에 알림이 간다. `os.uptime`은 절전 시간까지 세어 절전과 멈춤을 가르지 못하므로 쓰지 않았다.

이 작업이 띄운 게이트웨이와 작업 스케줄러 Job(10-20 확인): 이 작업이 `gateway start`·`restart`로 띄운 게이트웨이는 작업 스케줄러 Job에 남는다. `gateway-exit-diag.log`에 `breakaway: true`로 찍혀도 마찬가지다. 그래도 탈이 없어서 띄우는 방식은 그대로 둔다. 이 Job은 제한이 없는 Job(LimitFlags 0x0)이고, 같은 사용자의 다른 예약 작업 프로세스도 들어 있었다. 같은 설정의 일회용 작업으로 시험했다. 진짜 게이트웨이 대신 hermes.exe와 같은 실행기·`_spawn_detached`와 같은 플래그로 띄운 대역 자식을 썼다. 작업은 스크립트가 끝나고 1~2초 뒤 Ready로 돌아왔다. 실행 중에 작업을 끝내도, 끝난 실행에 종료를 보내도, 작업을 지워도 Job 안의 자식은 살아 있었다. 원리와 다시 확인하는 법은 [현장노트](../../../docs/현장노트/AI_CLI.md)의 「작업 스케줄러에서 띄운 게이트웨이는 `breakaway: true`여도 작업 Job에 남는다」에 있다.

아직 확인 못 한 것(10-19·10-20 Fable 검수): ① 채팅 사이에 시작한 LLM 예약 작업은 active_agents에 안 잡혀, 그 사이 어긋남 재시작이 겹치면 끊긴다(지금 Hermes 예약은 AI 없는 스크립트 하나뿐). ② `hermes update`가 게이트웨이를 멈춘 동안 이 작업의 `gateway start`가 옛 트리로 띄울 수 있는지(기존 경로). ③ 작업 환경(작업 스케줄러가 만든 환경 변수·PATH)에서 진짜 게이트웨이가 켜져 텔레그램까지 도는지 — 10-20 기준으로 이 작업이 게이트웨이를 실제로 띄운 적은 아직 없다. ④ 게이트웨이를 관리자 권한 터미널에서 띄우면 이 작업(제한 권한)이 게이트웨이 모듈을 못 읽는다. 그러면 작업은 돌아도 기록을 쓰지 않아(못 읽은 점검은 남기지 않음) 30분 뒤 「복구 작업이 멈춤」이 잘못 나갈 수 있다. 드문 경우라 따로 막지 않았다(10-20 Fable 검수).

작업은 Windows에 들어 있는 Windows PowerShell 5.1(`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`)로 돈다. 10-18 설치 때는 Codex 앱 셸의 `pwsh.exe`가 잡혀 작업이 그 앱 런타임에 묶였고, 10-19에 바꿨다(GPT를 끊어도 돌게).

검증: 현재 게이트웨이를 건드리지 않은 채 스케줄러의 실제 실행이 성공 종료(0)했고 PID가 유지됐다. 프로세스 종료를 일부러 일으키는 장애 시험과 휴대폰 수신·응답의 전 과정은 이 복구 스크립트 검증에 포함하지 않았다.
