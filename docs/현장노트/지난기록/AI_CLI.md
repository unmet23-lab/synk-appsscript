# 현장 노트 · AI CLI·구독 통로 · 지난 기록

> [AI_CLI](../AI_CLI.md)에서 2026-10-20에 옮긴 항목이다(글은 그대로, 상대 링크만 이 폴더에 맞춤). 도구가 이제 자동으로 막아 주거나(도구), 지금은 안 쓰는 옛 PC·판·절차 이야기거나(옛 판), 다시 오지 않을 한 번의 일(한 번)이다. 같은 증상을 다시 겪으면 그 항목을 원래 파일의 맞는 절로 되돌리고 고친다.

## Codex 세션 기록에서 (2026-10-20)

### 구형 Gemini CLI의 Google 로그인 통로가 지원 종료로 막힌다
- 증상: 10-17 Gemini CLI 0.64.0에서 기존 개인 Google OAuth로 Argon을 명시한 최소 요청 1회가 인증 단계의 `IneligibleTierError`·`UNSUPPORTED_CLIENT`로 끝났다. 모델 `init`·`result`는 없었고 실제 모델 호출은 0회였다.
- 원인: 서버가 Gemini Code Assist 개인용에서 이 클라이언트를 더는 지원하지 않으며 Antigravity 제품군으로 이전하라고 응답했다. 이 오류는 요청한 Argon 모델의 지원 여부를 확인한 결과가 아니다.
- 고침: 막다른 길 — 재시도·모델 대체·유료 API 전환 없이 중단했다. 기존 OAuth 파일이 있다는 것만으로 구형 CLI를 예약 실행 대안으로 쓰지 않는다.
- 다시 확인: 공식 클라이언트 지원·인증 방식을 먼저 확인한다. 이번 검증은 API 키·Vertex 환경값을 제외한 자식 프로세스에서 `GOOGLE_GENAI_USE_GCA=true`·`billing.overageStrategy=never`로 진행했고, 인증 실패 뒤 실행을 반복하지 않았다.
- 옮긴 까닭(2026-10-20, 옛 판): 구형 Gemini CLI 0.64.0의 Google 로그인은 서버가 지원을 끊은 옛 통로다. 지금 정식 경로는 agy(Antigravity)뿐이라 같은 길을 다시 쓸 일이 없다.

### systemd append 로그가 root 소유라 실행 후 검사기가 읽지 못한다
- 증상: 10-18 `StandardOutput=append:`로 처음 생긴 로그가 root 소유0600이라 별도 실행 사용자로 도는 `ExecStopPost`에서 Permission denied가 났다.
- 원인: systemd가 출력 파일을 먼저 열었고 서비스의 User만으로 파일 소유자까지 바뀌지는 않았다. 실행 종료0만 보면 이 후처리 실패를 놓친다.
- 고침: 설치 시 로그8개를 미리 만들고 실제 실행 사용자 소유0600으로 맞췄다. 실행·후처리 중에는 logrotate를 미뤄 같은 파일의 byte offset을 유지한다. Docs 읽기100초와 서비스 후처리30초의 불일치도120초로 맞췄다.
- 다시 확인: 모델·거절·완료 표식·Docs SHA를 검사하는 후처리 시험10개가 통과했다. NO_CHANGE는 실행 전후 SHA가 같아야 하고 완료 표식은 첫 줄을 정확히 대조한다. 실제 서비스의 Result·run-status와 함께 확인한다(`.tmp/argon-isolated-20261017/run-check-test.py`, `delivery-hardening-20261018.json`).
- 옮긴 까닭(2026-10-20, 도구): 설치 절차(`tools/argon-schedules/README.md`)가 빈 로그 14개를 실행 사용자 소유 0600으로 먼저 만들고, logrotate 설정과 후처리 시험(`run-check-test.py`)이 지킨다.

### Docs 저장은 됐는데 긴 명령 출력이 잘려 완료 확인을 못 한다
- 증상: 10-18 Argon이 실제 조사 본문을 Docs에 저장·재읽기까지 끝냈지만, 보조도구가 본문 전체를 JSON 응답에 넣어 CLI 출력이 잘렸다. 모델이 저장 여부를 확인하려고 구현 파일을 읽다가 권한 거절로 끝났다.
- 원인: 독자용 본문과 기계 확인값을 같은 명령 출력으로 보냈다. 프로세스 종료0·SUCCESS만으로 저장 전달까지 완료로 처리할 수 없다.
- 고침: `snapshot ROLE`은 전체 본문을 전용 work 파일에 원자 저장하고 짧은 메타데이터·본문 경로만 반환한다. 모델은 그 파일을 범위 읽기한다. `write` 응답에서는 본문을 빼고 상태·revision·SHA·백업 경로만 반환한다. 내부 검사기의 `read` 계약은 유지했다.
- 다시 확인: 보조도구 시험17개가 통과했다. 큰 Unicode 본문·출력1KiB 미만·충돌·실패 시 이전 파일 보존을 확인하고, 실제 공식 CLI의 `denied_actions` 없음과 완료 표식·Docs 재읽기 SHA를 함께 대조한다. 운영 소스는 `tools/argon-schedules/`에 보존한다.
- 옮긴 까닭(2026-10-20, 도구): 보조도구 `tools/argon-schedules/docs-io.py`의 `snapshot ROLE`·`write`가 본문을 파일로 빼고 짧은 메타만 돌려주며, `docs-io-test.py`가 지킨다.

## Gemini·agy에서 (2026-10-20)

### agy가 `string_value contains invalid UTF-8`로 죽는다
- 증상: agy가 `proto: … string_value contains invalid UTF-8`를 내고 끝난다(10-14).
- 원인: 전역 훅(`~/.gemini/config/hooks.json`) 하나가 CP949로 된 오류문을 냈다. 구조화 답(`--json-schema`)은 `finish` 도구를 거치므로 반드시 훅을 지난다.
- 고침: 10-14에 깨진 훅 두 개(orca-status·synk-session-freshness)를 유호님 승인을 받아 뺐다. 백업은 `~/.gemini/config/hooks.json.bak-20261014`다. 훅이 다시 생기면 같은 일이 난다.
- 다시 확인: `cat ~/.gemini/config/hooks.json` — 10-17 새 노트북은 `{}`(훅 없음)다.
- 옮긴 까닭(2026-10-20, 옛 판): 원인이던 옛 노트북의 CP949 훅 둘은 빠졌고, 이 PC의 `~/.gemini/config/hooks.json`은 지금 `{}`다(10-20 확인).

## Hermes(텔레그램 팁 봇)에서 (2026-10-20)

### 연결됨 표시만으로 텔레그램 작업 완료를 판단하지 않는다
- 증상: 10-18 점검에서 게이트웨이는 running·telegram connected였지만, 같은 날 이전 로그에는 Telegram API ConnectTimeout이 반복됐고 14:33 재시작 때 이전 프로세스의 비정상 종료가 기록돼 있었다. 점검 당시 PC는 AC·배터리 모두 유휴 3,600초 후 절전 설정이었다.
- 원인: 시간초과와 비정상 종료의 직접 원인은 미확정이다. 현재 게이트웨이는 로컬 PC에서 실행되므로 절전 중에는 일을 진행할 수 없다. 시작프로그램 등록은 로그인 시 실행을 뜻하며 상시 가동 증거가 아니다.
- 고침: 이번 점검에서는 설정·프로세스를 바꾸지 않았다. 게이트웨이 상태·실제 PID·최근 polling 복구 로그, Telegram getMe/getWebhookInfo 읽기, 장부 pending/recent 읽기를 대조했다. getUpdates를 별도로 호출해 수신 메시지를 소비하거나 시험 메시지를 보내지 않았다.
- 다시 확인: 10-18 15:29 이후 Telegram 읽기 API HTTP 200·pending_update_count 0, 장부 조회 성공·기존 6줄·적용안 대기 0을 확인했다. 새 메시지의 접수→장부 추가→Claude 예약 완료→전달 전 과정은 이번에 시험하지 않았다. 비밀값을 제외한 근거는 `.tmp/hermes-audit-20261018/`.
- 옮긴 까닭(2026-10-20, 한 번): 10-18 점검 한 번의 관찰 기록이고 원인은 미확정이다. 그 뒤 복구 작업(`SYNK_Hermes_Gateway_Recovery`)과 AI 없는 감시가 생겨 같은 조건이 아니다.

### Windows 시작프로그램은 게이트웨이 장애 복구가 아니다
- 증상: 공식 Startup VBS가 등록돼 있었지만 게이트웨이의 비정상 종료 뒤 재실행을 보장하는 외부 감시가 없었다(10-18).
- 원인: VBS의 `sh.Run(..., 0, False)`는 Python을 분리하고 종료한다. 게이트웨이 내부 loop watchdog도 종료 코드 75로 나가는 구조라 외부 재실행기가 필요하다.
- 고침: 기존 시작프로그램을 유지하고 `SYNK_Hermes_Gateway_Recovery` Windows 작업을 추가했다. 2분마다 소유 PID·실행파일·gateway run만 확인해 없을 때 공식 `hermes gateway start`를 부른다. LLM 호출·강제 종료는 없다. AC 유휴 절전·최대절전만 0으로 바꾸고 배터리·덮개 동작은 유지했다.
- 다시 확인: `tools/hermes-synk/runtime/recover-gateway.ps1 -ReadOnly`와 작업 스케줄러 실제 결과 0, 원래 게이트웨이 PID 유지·AC 0/DC 3600을 확인했다. 강제 장애 시험은 하지 않았다. 소스·복원은 `tools/hermes-synk/README.md`, 근거는 `.tmp/hermes-improve-20261018/runtime/`.
- 옮긴 까닭(2026-10-20, 도구): 복구 작업 `SYNK_Hermes_Gateway_Recovery`(2분마다)가 지금 정식 경로이고, 그 작업이 멈춰도 감시가 알린다(`tools/hermes-synk/runtime/README.md`).

### 큰 공용 저장소를 통째로 복사하면 격리 작업도 무거워진다
- 증상: 10-18 SYNK 전체 원문 후보가 약 1.29GiB여서 휴대폰 요청마다 전체 작업본을 만들 수 없었다.
- 원인: 큰 자료가 함께 있는 공용 저장소를 일반적인 작은 코드 저장소처럼 취급했다.
- 고침: 현재 수정본 중 요청한 파일·폴더와 필수 원문만 별도 인덱스로 확인한 뒤 공식 sparse worktree로 만든다. 격리 준비는 원본 HEAD·인덱스·설정을 바꾸지 않는다. 10-18 추가 승인 후 원본 파일 반영은 별도 3방향 병합·검증·배타 쓰기 단계가 맡는다. 원본 변경·비밀·용량 초과·대상 누락은 접수를 보류한다.
- 다시 확인: `tests/hermes-synk-workspace.test.cjs`의 현재 dirty 원문 보존·원본 인덱스/설정 불변·동시 준비·범위/비밀/보관 한도 시험. 별도 인덱스와 기준 HEAD를 그대로 `npm run check:storage`에도 넘긴다.
- 옮긴 까닭(2026-10-20, 도구): sparse worktree 준비가 `tools/hermes-synk/workspace.cjs`에 들어 있고 `tests/hermes-synk-workspace.test.cjs`가 지킨다.

### Git 무시 목록에 든 요청 파일이 격리 작업본에서 빠진다
- 증상: 실제 `docs/홈페이지_시안/시안.html`이 있어도 Git 후보 목록에서는 빠져, 대상 없이 준비 성공을 반환할 수 있었다.
- 원인: `ls-files --others --exclude-standard`에는 ignored 파일이 나오지 않는다. 반대로 전체 ignored 목록을 재귀 검색하자 실제 큰 저장소에서 준비가 지연됐다.
- 고침: 선택한 실제 경로만 제한적으로 열거하고 `check-ignore --stdin`으로 확인한다. 대상 소스가 무시되어 있으면 `IGNORED_SCOPE_SOURCE`로 보류한다. 기본 작업본에는 운영 원문과 도구 사용 전 필수 현장 노트도 포함한다.
- 다시 확인: 명시 파일·디렉터리 scope와 무관한 cache/dependency 제외 시험, 실제 문제 경로의 읽기 전용 진단. 준비 실패 때는 CLI를 시작하지 않으며 새 요청으로 다시 접수해야 한다.
- 옮긴 까닭(2026-10-20, 도구): 같은 `workspace.cjs`가 요청 경로만 열거하고 `IGNORED_SCOPE_SOURCE`로 보류하며, 같은 시험이 지킨다.

### 검증한 작업을 원본에 자동 반영할 때 동시 저장과 알림이 겹친다
- 증상: 10-18 합성 저장소에서 하드링크 파일을 쓰자 범위 밖 연결 파일도 바뀌었다. 검증 뒤 같은 범위에 생긴 새 의존 파일도 기존 파일 해시만으로는 놓쳤다. 결과 처리와 5분 수집이 겹치면 같은 판단 알림을 두 경로에서 보낼 수 있었다.
- 원인: 경로 검사 뒤 교체하는 방법은 검사와 쓰기 사이에 틈이 있고, 기존 파일 목록만 비교하면 추가된 파일이 빠진다. 알림을 보냈는지 확인하는 것만으로는 아직 보내기 전인 두 처리기의 경합을 막지 못한다.
- 고침: 최신 원본과 3방향 병합한 후보를 다시 검사한다. Windows에서 원본·의존 파일과 부모 폴더의 핸들을 확보한 뒤 내용·범위 목록을 대조하고 같은 핸들로 쓴다. 쓰기 대상의 hardlink 수가 2 이상이면 보류한다. 사전 백업과 fsync 작업 영수증을 남기고 이미 적용한 부분은 다시 쓰지 않는다. 실패 뒤 생긴 빈폴더는 경로로 삭제하지 않는다. 새 직접 위임 작업의 판단 알림은 플러그인만 소유하며 수집기는 상세 조회만 한다.
- 다시 확인: `tests/hermes-synk-integration.test.cjs`의 실제 Windows writer 잠금·hardlink·검증 뒤 파일 추가·재시작 영수증·원본 HEAD/인덱스 보존 시험, `tests/hermes-synk-overview.test.cjs`의 발송 전/중/불명 구간 중복 알림 0회 시험. 다중 파일의 전원 차단을 단일 원자 쓰기로 보장하지 않으며, 중간 바이트나 이후 다른 변경이 있으면 자동 덮어쓰기 없이 판단 대기로 남긴다.
- 옮긴 까닭(2026-10-20, 도구): 원본 반영 코드(`tools/hermes-synk/integration.cjs`: 핸들 확보·hardlink 보류·영수증)와 `tests/hermes-synk-integration.test.cjs`·`hermes-synk-overview.test.cjs`가 지킨다.

### Node 시험의 종료 0과 모듈 로드는 변경 동작 검증이 아니다
- 증상: 없는 시험 경로와 정상 시험을 함께 주면 Node가 누락을 넘길 수 있고, 함수가 잘못돼도 모듈을 불러오기만 한 시험은 통과했다. 상위 Node 시험 프로세스의 `NODE_TEST_CONTEXT`를 물려주면 하위 시험 출력도 사라질 수 있었다.
- 원인: 명령 종료와 실제 시험 수·변경 동작의 실행 여부를 같은 증거로 취급했다.
- 고침: 검사 경로 실재·명시적 TAP 전체 통과·skip/todo 0·변경줄의 V8 함수/분기 실행을 확인한다. 하위 환경에서 계정·API 키·상위 test context를 제외한다. JSON 등 별도 검증 방법이 없는 형식은 파싱만으로 자동 반영하지 않는다. 새 계약 `changed_lines_v1` 이전의 성공 캐시는 재사용하지 않는다.
- 다시 확인: `tests/hermes-synk-validation.test.cjs`의 실제 실패·무관한 시험·미호출 함수/분기·여러 프로세스 실행 합산·시험 중 후보 변경·재시작 캐시 시험.
- 옮긴 까닭(2026-10-20, 도구): 검증기(`tools/hermes-synk/validation*.cjs`, 계약 `changed_lines_v1`)와 `tests/hermes-synk-validation.test.cjs`가 지킨다.

## Claude Code·공식 CLI 읽기(계정판)에서 (2026-10-20)

### 파이프로 부른 `claude -p`가 표준입력을 3초 기다리고, 로그인이 없어도 「Not logged in」을 내지 않는다
- 증상: 10-18 계정판이 `claude -p /usage`를 파이프로(표준입력을 열어 둔 채) 부르자 Claude 줄마다 3초씩 늦고 stderr에 `Warning: no stdin data received in 3s, proceeding without it`이 찍혔다. 로그인 없는 `CLAUDE_CONFIG_DIR`에서는 「Not logged in · Please run /login」 대신 `Total cost: $0.0000 …` 비용 요약이 나와, 로그아웃이 「읽기 실패」로 보였다. 터미널에서 직접 돌리면 「Not logged in」이 나와 차이를 놓치기 쉽다.
- 원인: Claude Code 2.1.302는 표준입력이 열린 파이프면 입력을 3초 기다린다. 출력이 파이프일 때는 로그인이 없어도 `/usage`가 비용 요약을 낸다.
- 고침: 넣을 것이 없으면 표준입력을 바로 닫는다(`child.stdin.end()`, 계정판 `rawRun`). 로그인 여부는 `/usage` 글이 아니라 `claude auth status --json`의 `loggedIn`(불리언)으로 본다. 그 값을 못 읽었으면 로그아웃으로 단정하지 않는다.
- 다시 확인: 빈 임시 폴더를 `CLAUDE_CONFIG_DIR`로 주고 Node `spawn`으로 `-p /usage`를 부른다. 표준입력을 열어 두면 3.9초, 닫으면 0.4초이고 둘 다 `Total cost`가 나온다. 같은 폴더의 `auth status --json`은 `"loggedIn": false`다. 로그인된 폴더는 7.4초→4.4초, 출력은 같다.
- 옮긴 까닭(2026-10-20, 도구): 계정판 `rawRun`이 넣을 것이 없으면 표준입력을 바로 닫고 로그인은 `claude auth status --json`의 `loggedIn`으로 본다(`desktop/src/ai-subscriptions.cjs`).

### 연결이 잠깐 끊기면 공식 CLI가 로그인이 풀린 것처럼 답한다
- 증상: 10-18 13:05 계정판 「지금 확인」에서 1분 사이 GPT(Codex) 줄이 「로그인이 필요해요」, Higgsfield 기본 로그인이 「읽지 못했어요」였다. 2분 뒤 같은 명령을 직접 돌리자 둘 다 그대로 읽혔다(Codex 2.7초). 계정판에서 그 Codex 읽기는 평소의 10배인 31초가 걸렸다.
- 원인: 망 요청(토큰 갱신 등)이 실패하는 동안 Codex app-server `account/read`가 계정 없이 답한 것으로 보인다. 내부 동작은 확인하지 못했다.
- 고침: 「로그인 필요」로 읽혀도 바로 믿지 않는다. 그 서비스의 고정 주소에 HEAD로(로그인 정보 없이) 인터넷이 닿는지 보고, 안 닿으면 연결 문제로 둔다. 닿으면 3초 뒤 한 번 더 읽어 같을 때만 「다시 로그인」으로 둔다(`desktop/src/ai-subscriptions.cjs`의 `readConfirmed`). Typecast는 서버가 401·403으로 분명히 답할 때만이라 바로 알린다.
- 다시 확인: 계정판 시험 「a sign-in that only looks lost for a moment …」. 실제 Claude Code로 로그인 없는 폴더를 읽으면, 인터넷이 닿을 때는 6.5초 뒤 「다시 로그인」이고 확인 주소를 막으면 1.8초 뒤 「인터넷에 연결되지 않아」다.
- 옮긴 까닭(2026-10-20, 도구): 계정판 `readConfirmed`가 인터넷 확인 뒤 한 번 더 읽고, `desktop/tests/ai-subscriptions.test.cjs`의 시험이 지킨다.

## 쓴 기록

> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-03~10-17 Claude 메모에서 옮김(10-17 2차) · GPT(Codex) 10-17 Antigravity 인증 공유·구형 Gemini CLI 지원 종료, 10-18 Linux 독립 실행·timer 검증 추가 · GPT(Codex) 10-17 예약 시각 해석 확인 추가 · GPT(Codex) 10-18 Argon 예약·Docs·장애 알림 확인 · Claude Code(Claude Opus 5.5) 10-18 `claude -p` 크레딧 청구(Claude Code 2.1.302) · Claude Code 10-18 아르곤 실행 두 항목 · Claude Code(Claude Opus 5.5) 10-19 조사 예약 거절 실패 관찰·고침 · Claude Code 10-20 데스크톱 앱 계정과 로그인 파일 계정이 다른 것 추가 · Claude Code 10-20 멈춘 세션 일괄 재개(/이어서) 함정 넷(다시 시도·Stop 표식·isRunning 순간값·우회 모드 최상위 세션의 다른 세션 글, Claude 데스크톱 2.42304.2.0·Claude Code 2.1.299) 추가
