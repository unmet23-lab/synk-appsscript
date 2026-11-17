# 솔리오와 백업 엔진이 주고받는 파일

이 폴더는 SYNK 솔리오(플랫폼 PC 앱의 「백업·복구」 탭)와 업무 백업 엔진 사이의 파일 꼴과 시험용 견본이다. 설계의 정본은 [1단계 설계 4.13](../../STAGE1_DESIGN.md)과 4.15 · 4.16이고, 엔진 쪽 코드는 `engine/src/solio.cjs`(상태 · 요청 · 결과), `src-tauri/src/space.rs`(공간 보고서), `src-tauri/src/mcp.rs`(AI 도구)다. 시험은 `tests/solio.test.cjs`가 이 견본을 엔진의 코드로 읽어 본다. 꼴을 바꿀 때는 GPT 솔리오 세션과 같이 바꾼다.

모든 파일은 사용자 상태 폴더 `%APPDATA%\SynkWorkBackup\solio\` 아래에 있다.

## 상태 파일 `status.json` — 엔진이 쓰고 솔리오가 읽는다

회차 실행기와 엔진 창이 회차와 작업이 끝날 때마다 쓰고, 작업이 도는 동안에는 5초에 한 번까지 쓴다. 같은 폴더의 임시 이름에 쓴 뒤 바꿔 넣으므로 반쪽 파일은 보이지 않는다. 64KB를 넘지 않는다. 파일 이름, 경로, 폴더 이름, 계정 주소, 출입증, 저장소 주소는 들어 있지 않다. 견본은 [status.sample.json](status.sample.json)이다.

| 칸 | 뜻 |
|---|---|
| `v` | 꼴 번호. 지금은 1이다. 솔리오가 아는 것보다 크면 「엔진이 새 판입니다 — 솔리오를 업데이트해 주세요」를 보인다 |
| `engine` | 엔진 판(예: `0.7.0`) |
| `state` | 보호 상태 낱말 하나: `safe`(지키는 중) · `starting`(자동 백업을 켰고 첫 백업 전) · `attention`(주의) · `paused`(잠시 멈춤) · `off`(자동 백업 꺼 둠) · `not-set-up`(보호를 시작하지 않음) · `moved`(다른 PC로 옮겨짐) · `restore-only`(옮겨 오기만 하고 쓰는 기기가 아닌 PC) |
| `lastBackupAt` | 마지막으로 백업을 확인한 시각(UTC ISO), 없으면 null |
| `proof` | 마지막 되살리기 증명 `{at, result}`. `result`는 `passed` · `failed` · `incomplete` · `skipped` |
| `attention` | 주의 주제 낱말 목록. 알림의 여덟 낱말 `status` · `folders` · `changes` · `devices` · `restore` · `space` · `signin` · `update` 가운데서, 이 차례로 |
| `job` | 지금 도는 작업 `{stage, percent}`, 없으면 null. `stage`는 `backup` · `check` · `proof` · `restore` · `move` · `setup` · `other` |
| `folders` | 보호 중인 폴더 수 |
| `bytes` | 마지막 백업의 원본 크기 합(바이트), 모르면 null |
| `writer` | 이 PC가 쓰는 기기인지 |
| `nextRunAt` | 다음 회차 예정 시각. 쓰는 기기가 아니면 null. 지금 시각이 이보다 2시간 넘게 지났으면 솔리오는 「확인 중」으로 보인다 |
| `writtenAt` | 이 파일을 쓴 시각 |

## 요청 파일 `requests\<시각>-<난수>.json` — 솔리오가 쓰고 엔진이 처리한다

- 이름은 13자리 밀리초 시각, 줄표, 소문자와 숫자 8~32자, `.json`이다(예: `1794880000000-a1b2c3d4.json`). 이 꼴이 아닌 이름과 보통 파일이 아닌 것(정션 · 링크 · 폴더)은 엔진이 읽지도 지우지도 않는다. 시각은 만료를 셈하는 데 쓰고, 지금보다 5분 넘게 앞선 시각이면 거절한다.
- 8KB를 넘지 않는다. 엔진은 연결점(링크 · 정션)을 따라가지 않고 자료로만 읽는다. 칸 이름을 고정 목록과 견주고, 모르는 칸이 하나라도 있으면 통째로 거절한다.
- 처리하는 쪽은 엔진 잠금을 쥔 채 먼저 `requests\claimed\`로 옮기고(같은 이름이 있으면 실패하는 하드 링크를 만든 뒤 원래 이름을 지운다), 옮기기에 성공한 쪽만 처리한다. 처리 도중 엔진이 죽어 남은 것은 다시 하지 않고 「실패」로 치운다.
- 넣지 않는 것: 경로, 파일 이름, 명령 줄, 자유 글. 정해진 값 밖의 것은 `hint` 하나뿐이고 주소 꼴(254자 이하, @ 하나)만 받는다.

| 종류 | 칸 | 누가 처리하나 | 엔진이 하는 일 |
|---|---|---|---|
| `setup` | `mode`(`protect` · `move`), `hint`(없어도 된다) | 엔진 창(떠 있는 동안 2초마다 본다. 확인을 넘지 못한 요청도 엔진 창이 거절로 치운다) | 「Google로 시작」 화면을 건너뛰고 Google 로그인으로 바로 가게 창에 알린다. 30분이 지나면 거절(`expired`). 보호를 시작한 PC와 옮겨진 PC는 거절. 옮겨 오기만 한 PC는 `protect`만 받는다 |
| `run-now` | 없음 | 요청 작업(작업 스케줄러 「요청 - <계정 이름> · <SID 짧은 표시>」)과 모든 회차의 끝 | 회차 간격만 건너뛰고 백업한다. 종량 회선 · 배터리 · 절전 · 쉬는 회선이면 쉬고(`rested`), 손님이 잠시 멈춘 동안은 거절(`paused`)한다. 화면에서 직접 누른 「지금 백업」과 달리 쉼을 지킨다 |
| `space-setting` | `name`이 `start-line`이면 `drive`(대문자 한 글자) · `gb`(정수), `auto-free` · `cloud-only-auto` · `empty-trash`이면 `value`(참 · 거짓) | 요청 작업과 회차 | 삭제 범위를 줄이는 쪽(시작선 낮추기, 끄기)만 한다. 넓히거나 켜는 값은 `confirm-in-engine` |
| `pick` | `action`(`free` · `restore`), `report`(보고서 번호), `items`(후보 번호 1~100개) | 요청 작업과 회차 | 보고서가 그 종류의 가장 새 것이 아니거나 24시간이 지났으면 거절한다. 공간 비우기 1판은 아무것도 비우지 않으므로 `free`는 모두 거절(`not-available`)한다. 찾기 결과의 보고서는 1단계에 남기지 않으므로 `restore`도 거절(`no-report`)한다(2단계 요청 도구와 함께 연다) |

`setup` 밖의 요청은 24시간이 지나면 거절(`expired`)한다. 견본은 [requests](requests/)에 있다.

## 결과 파일 `results\<같은 이름>` — 엔진이 쓰고 솔리오가 읽고 지운다

`{"v":1,"result":<낱말>,"reason":<까닭 낱말>,"at":<시각>}`이다. 하루가 지난 것은 엔진이 치운다.

- `result`: `done`(했음) · `rejected`(거절) · `confirm-in-engine`(엔진 창에서 확인 필요) · `rested`(쉼) · `failed`(실패)
- `reason`(거절 · 쉼 · 실패일 때): `invalid` · `version` · `expired` · `set-up` · `moved` · `restore-only` · `not-set-up` · `no-report` · `old-report` · `not-available` · `not-yet` · `no-drive` · `paused` · `clock` · `busy` · `interrupted` · `battery` · `saver` · `metered` · `network` · `error`

견본은 [results](results/)에 있다.

## 공간 보고서 `space.json` — 엔진이 하루 한 번 쓴다

[공간 비우기 설계](../../SPACE_DESIGN.md)의 1판(분석과 예측)이다. 1MB와 후보 1,000개를 넘지 않는다. **이 파일에는 후보의 경로가 들어 있다.** 솔리오는 이 내용을 서버, 로그, 오류 보고로 보내지 않는다. 견본은 [space.sample.json](space.sample.json)이다.

- `report`(보고서 번호, `pick` 요청이 쓴다) · `createdAt`
- `lap`: 마지막으로 한 바퀴를 다 훑은 때와 든 날수. `scanning`: 아직 훑는 중인 바퀴. 후보와 「지난 7일」은 다 훑은 바퀴에서만 낸다
- `lastAccess`: 마지막 접근 시각 갱신이 켜져 있는지(`on` · `off` · null)
- `drives`: 드라이브마다 `size` · `free` · `growthPerDay`(지난 14일, 바이트, 모르면 null) · `startLineGb` · `startLine`(`default` · `set`) · `daysToStartLine`(이미 아래면 0, 늘지 않으면 null)
- `grewSince` · `grew`: 지난 7일 가장 많이 늘어난 자리 다섯(`path` · `name` · `grew` · `bytes`)
- `candidates`: `n`(번호) · `grade`(`auto` 가 등급 자동 대상 후보 · `suggest` 제안 · `view` 보기만) · `kind` · `bytes` · `reason` · `name`(사람이 읽는 이름) · `path`

## AI 도구(MCP) — 같은 상태 폴더의 `mcp\`

`WorkBackupRun.exe --mcp`가 표준 입출력 MCP 서버가 된다. 도구는 `protection_status`(위 상태 파일 그대로) · `space_report`(위 공간 보고서) · `find_restorable`(이름 일부로 백업 안 찾기)이다. `space_report`는 가리는 낱말이 든 후보를 빼고, 후보 번호(`n`)를 빼고 보인다. 동의는 엔진 창의 설정 서랍 「AI 도구」가 `mcp\consent.json`(`{"v":1,"tools":{"space_report":참·거짓,"find_restorable":참·거짓},"masks":[가리는 낱말]}`)에 쓴다. 솔리오의 「AI 도구에 연결」 단추는 2단계에 더한다.
