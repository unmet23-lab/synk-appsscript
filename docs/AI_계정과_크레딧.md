# AI 계정과 크레딧

> 2026-10-20 [AI 운영 원칙](AI_운영원칙.md)에서 옮겼다(「역할」 아래 아르곤 계정 문단, 「비용과 권한」 첫 줄의 예외 통로). 원칙 — 신규 결제·구독·자동충전을 하지 않고, 한도·인증 문제를 다른 유료 경로로 자동 우회하지 않는다 — 은 운영 원칙이 정한다. 여기는 사용자가 정한 계정과 예외 통로, 그 도구만 둔다. 도구가 실제로 겪은 함정은 [현장 노트 AI CLI](현장노트/AI_CLI.md).

## 아르곤 계정

2026-10-18 계정 통일: 아르곤을 사용하는 모든 작업(딥리서치·예약 조사·블렌더 등)은 웹·앱·공식 CLI 모두 Google AI Ultra 계정 `77yuhbs@gmail.com`으로 실행한다. 작업을 시작할 때 해당 서비스의 실제 인증 계정을 확인한다. 업무 Google Docs/Sheets와 조사 결과 문서는 `unmet23@gmail.com`의 기존 연결·문서 ID·공유 범위를 유지한다. Chrome의 기본 계정과 Docs 계정을 일괄 전환하지 않고 아르곤 작업 세션에서 77yuhbs를 선택한다. 한도·인증·모델 접근 실패 시 unmet23이나 다른 모델·추가 결제·유료 API로 자동 대체하지 않는다. 기존 조사 4종(전체·YouTube/TikTok·Meta/브랜드·synkbrief)은 별도 서버의 공식 Antigravity CLI `gemini-4-argon-high`와 기존 예약 시각을 유지한다. 예약·복원 원문은 [Argon 예약 운영 소스](../tools/argon-schedules/README.md), 현재 결과는 [트랙](_ops/트랙.md)에 둔다.

2026-10-22 둘째 Ultra 계정: `unmet25`를 Google AI Ultra 가족 계정으로 더했다(Gemini 한도가 77yuhbs와 따로 돈다). 77yuhbs의 Gemini 주간 몫이 다 돼 가면(PowerShell `agy -p "/usage" --output-format json`의 주간 남은 비율이 10% 아래이거나 막힐 때) unmet25로 바꿔 쓴다. Gemini 웹·Flow는 Chrome에서 계정만 바꾼다. PC의 공식 CLI(agy)는 Windows 자격 증명에 계정이 하나뿐이고 계정별 프로필 설정이 없어(1.4.4 확인), agy 창에서 `/logout` → `/login`으로 바꾸고 브라우저의 계정 고르기·승인은 사용자가 한다. 바꾼 뒤에는 `~/.gemini/antigravity-cli/cli.log`의 `authenticated successfully as` 줄로 실제 계정을 확인한다. 이 PC의 모든 세션이 같은 agy 로그인을 쓰고, 쓰던 계정이 다 돼 갈 때만 다른 쪽으로 바꾼다(초기화됐다고 되돌리지 않는다).

서버 예약 조사(10-22)는 같은 실행 사용자 안에 agy HOME을 계정마다 따로 둔다(77yuhbs = 예약 작업 폴더, unmet25 = `/var/lib/synk-argon-unmet25`). 회차를 시작할 때 `agy-account.py`가 계정을 고른다. 77yuhbs의 Gemini 주간·5시간 남은 몫이 10% 아래이거나 확인이 실패한 회차만, unmet25가 같은 권한·유료 끔·실제 로그인·10% 이상일 때 unmet25로 돈다. 서버는 로그인이 둘 다 있어 바꾸는 데 다시 로그인할 일이 없으므로, PC와 달리 77yuhbs가 회복되면 곧바로 77yuhbs로 돌아간다. 고정이 필요하면 `mode unmet25`·`mode 77yuhbs`를 쓴다. 서버 unmet25 로그인은 PC 터미널의 `node tools/argon-schedules/agy-login.cjs unmet25`로 띄우고, 승인은 사용자가 한다. 쓰는 법과 확인은 [Argon 예약 운영 소스](../tools/argon-schedules/README.md)에 있다.

이 두 Ultra 계정 말고 unmet23·다른 모델·추가 결제·유료 API로 자동 대체하지 않는 것은 그대로다.

## GPT

GPT 그림 굽기는 2026-10-17 사용자 결정으로 등록한 GPT 보조 계정 사이에서 한도에 막히면 자동으로 바꿔 쓴다(`tools/codex계정.js`). synk.yuh Pro는 백엔드와 한도를 같이 쓰므로 보조 계정이 모두 막혔을 때만 맨 마지막 예비로 쓴다. 10-22 기준 GPT 앱 본 계정(`~/.codex`)은 unmet23 Pro(크레딧 잔액 있음)이고 synk.yuh Pro는 굽기 장부의 예비(bake3, 크레딧 0)로만 로그인돼 있다 — Pro가 둘이라 사용량은 나눠 본다.

Claude 백엔드의 GPT 2차 검수(2026-10-22, `tools/검수묶음.mjs GPT`)는 이 두 Pro 계정 가운데 주간 90% 아래이고 가장 덜 쓴 계정으로 돌고, 모델·추론은 본 계정 설정 그대로다. 주간 90%를 넘긴 계정은 쓰지 않는다 — 크레딧이 있는 계정이 한도를 넘기면 크레딧이 나갈 수 있어서다. GPT 세션도 앱 안의 그림 도구로 바로 굽지 않고 `codex exec` 대신 `node tools/codex계정.js exec <같은 인자>`(지시문은 표준입력)로 굽는다.

헤르메스 텔레그램 접수 GPT는 2026-10-18 요청에 따라 Microsoft 계정 `q121235@outlook.com`의 독립 Hermes 로그인으로 쓰며, 다른 계정·유료 API로 자동 대체하지 않는다.

## Claude API 크레딧

Claude API는 2026-10-17 사용자 결정으로 Max·Team 플랜에 딸린 월 API 크레딧 계정 사이에서, 한 계정의 크레딧이 바닥나면(「credit balance is too low」) 다음 계정 키로 자동으로 바꿔 쓴다(`tools/lib/클로드키.js`, 키 목록·상태·사용 기록은 저장소 밖 `~/SYNK_보안/`). 갱신일이 가까운 계정부터 쓰고, 속도 제한(429)·서버 오류·결과를 모르는 호출은 다른 키로 넘기지 않으며 모델을 바꾸지 않는다. 키 목록에는 Max 계정마다 결제 수단·충전 잔액·자동충전 없이 새로 만든 Console 조직의 키만 넣는다(2026-10-18 사용자 결정). 충전 잔액이 있는 조직은 크레딧이 떨어져도 「잔액 부족」 없이 돈이 나가기 때문이다.

Claude의 무인 작업(예약·헤르메스 /synk_claude)도 2026-10-18 요청에 따라 이 키부터 쓴다. `claude -p` 대신 `node tools/크레딧실행.js`로 띄운다(예약은 `작업 <이름>`, 헤르메스는 `중계 -- <같은 인자>`). 이것은 공식 CLI를 한 번 띄우면서 자격만 고르는 통로이고, 모델·인자를 바꾸거나 반복하지 않는다. 크레딧 키가 없으면 구독으로 돈다. 구독에 로그인된 PC에서는 키를 줘도 구독으로 청구되므로, 구독 로그인이 없는 전용 설정 폴더를 쓴다([현장 노트](현장노트/AI_CLI.md#claude-api)).

사용자가 헤르메스에서 클라우드를 지정한 작업(/synk_cloud)만 Managed Agents에서 크레딧으로 돌리고, 결과는 `claude/cloud-<작업 ID>` 브랜치로 받는다(한 번에 $15·120분 상한). 헤르메스 연결은 수정안을 얹은 뒤부터 적용된다([트랙](_ops/트랙.md)).

## Gemini 구독 대체

Gemini는 2026-10-17 사용자 결정으로, 무료 API 문이 몫 상한(429)에 막히면 같은 모델·사고 수준으로 Google AI 구독 통로(agy에 로그인한 계정, 지금 Ultra)를 한 번 부른다(`tools/lib/제미나이호출.js`의 구독대체). 유료 Vertex로는 넘어가지 않고, CI와 대량 검문 도구는 기본으로 넘기지 않는다.
