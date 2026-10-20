# 현장 노트 · AI CLI·구독 통로

> 판: Antigravity CLI `agy` 1.3.6(Windows winget)·1.4.0(Linux 별도 사용자) · Gemini API 무료 몫 · `tools/몽골어대조.js`·`tools/lib/제미나이구독호출.js` · Hermes Agent v0.22.2(`%LOCALAPPDATA%\hermes`, 텔레그램 팁 봇 게이트웨이) · Codex 세션 기록(`~/.codex/sessions`·`~/.codex/archived_sessions`)
> 마지막 확인: 2026-10-19(조사 예약의 작업 파일 읽기·명령 거절 실패 — 원인 조회·고침·고친 뒤 첫 회차 complete), 2026-10-18(Linux 파일 인증 복원·실제 timer Argon 실행·계정별 모델 목록·headless 도구 권한, 기존 노트북 항목은10-17)
> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-03~10-17 Claude 메모에서 옮김(10-17 2차) · GPT(Codex) 10-17 Antigravity 인증 공유·구형 Gemini CLI 지원 종료, 10-18 Linux 독립 실행·timer 검증 추가 · GPT(Codex) 10-17 예약 시각 해석 확인 추가 · GPT(Codex) 10-18 Argon 예약·Docs·장애 알림 확인 · Claude Code(Claude Opus 5.5) 10-18 `claude -p` 크레딧 청구(Claude Code 2.1.302) · Claude Code 10-18 아르곤 실행 두 항목 · Claude Code(Claude Opus 5.5) 10-19 조사 예약 거절 실패 관찰·고침

어느 AI·계정이 무엇을 맡는지는 [AI 운영 원칙 · 역할](../AI_운영원칙.md#역할), 유료 호출 승인은 [비용과 권한](../AI_운영원칙.md#비용과-권한)이 정한다. GPT 그림 굽기의 주간 한도와 계정 돌려쓰기는 [그림 굽기·오리기](그림_굽기_오리기.md#gpt-그림-굽기)에 있다. 여기는 AI CLI·구독 통로·세션 기록이 예상과 다르게 움직인 함정이다. 틀은 [README](README.md)를 따른다.

## Gemini·agy

### 몽골어 검문이 Gemini 무료 API의 429로 막힌다
- 증상: 10-14 LAB TOPIK 몽골어판 검문이 무료 API 몫(gemini-3.8-flash 하루 20회)에 두 번 막혔다. 몫은 09:00 KST에 풀렸지만 풀리자마자 다른 쪽에서 다 썼다.
- 원인: 무료 몫이 하루 20회뿐이라 다른 쪽이 먼저 쓰면 바로 바닥난다. 누가 썼는지는 확인하지 못했다.
- 고침: 10-17부터는 저절로 넘어간다. 무료 문이 429(몫 상한)를 내면 `tools/lib/제미나이호출.js`의 구독대체가 같은 모델·사고 수준으로 Google AI 구독(agy, `tools/lib/제미나이구독호출.js`, 지금 Ultra 계정)을 한 번 부른다. 하루 몫이면 재시도 없이 바로, 분당 몫이면 5·15초 재시도 뒤 넘긴다. 장부 `문`은 `글→구독`, 화면은 「무료 몫 상한 → 구독 문으로 넘김」. 처음부터 구독으로 가려면 `--구독`, 넘기지 않으려면 `--대체없음`. 대량 도구(검수표검문·몽골어출구 `--태우기`·검문커버리지)는 기본이 `--대체없음`이고 `--구독대체`를 줘야 넘긴다. CI·끄기 변수 `SYNK_GEMINI_NO_SUBSCRIPTION_FALLBACK=1`·유료 「돈」 문에서는 넘기지 않는다. 유료(`--돈 --유료-api`)는 어림값을 알리고 승인을 받은 뒤에만 쓴다.
- 다시 확인: `node --test tests/제미나이구독대체.test.js`(10-17 6/6). 실제 넘김은 429를 흉내 낸 호출로 확인했다(10-17 agy 77yuhbs · gemini-3.8-flash-high · 40초).

### 새 노트북에 Gemini 무료 키 파일이 없다
- 증상: `node evals/돌리기.js --자체점검`의 문 프로브가 「키없음 — 글 API 키 파일이 없다: C:/Users/q1212/SYNK_보안/제미나이_무료.txt」로 멈춘다(10-17).
- 원인: 노트북을 옮길 때 `SYNK_보안`에 무료 키 파일이 따라오지 않았다(10-17에는 타입캐스트·클로드 키만 있었다).
- 고침: 옛 노트북 백업이나 AI Studio에서 무료 키를 다시 받아 그 경로에 둔다. 그 전까지 몽골어 검문은 `--구독`으로 돌린다(키가 없으면 무료 문을 부르기 전에 멈추므로 자동 넘김도 일어나지 않는다).
- 다시 확인: `ls ~/SYNK_보안/` 에 `제미나이_무료.txt`.

### agy가 어느 계정으로 도는지 설정 파일 표시가 틀린다
- 증상: `~/.gemini/google_accounts.json`에 적힌 계정과 agy가 실제로 쓰는 계정이 다르다(10-17).
- 원인: agy 로그인은 Windows 자격 증명(키링)에 있고, 이 파일은 별도 Gemini CLI의 기록이다. 키링에 있으니 `USERPROFILE`을 바꿔도 같은 로그인을 쓴다. 10-17 확인한 [공식 설치 문서](https://antigravity.google/docs/install/)도 한 로컬 제품에서 로그인하면 로컬 환경의 다른 제품과 자격이 공유된다고 명시한다.
- 고침: 실제 계정은 `~/.gemini/antigravity-cli/cli.log`의 `authenticated successfully as` 줄로 확인한다. `--구독` 통로도 그 계정의 몫을 쓴다. 로컬 프로필 파일이나 홈 경로만 바꾸면 계정이 격리된다고 가정하지 않는다. agy에서는 gemini-4-argon-low/medium/high도 고를 수 있지만, 모델 선택이 계정 격리를 뜻하지 않는다.
- 다시 확인: 최신 인증 로그와 공식 설치 문서를 함께 확인한다. 10-17 `agy --help`·설치된 공식 문서에서는 계정별 프로필·인증 격리 옵션을 찾지 못했다. 기존 로그인 계정은 바꾸지 않았다.

### agy가 `string_value contains invalid UTF-8`로 죽는다
- 증상: agy가 `proto: … string_value contains invalid UTF-8`를 내고 끝난다(10-14).
- 원인: 전역 훅(`~/.gemini/config/hooks.json`) 하나가 CP949로 된 오류문을 냈다. 구조화 답(`--json-schema`)은 `finish` 도구를 거치므로 반드시 훅을 지난다.
- 고침: 10-14에 깨진 훅 두 개(orca-status·synk-session-freshness)를 유호님 승인을 받아 뺐다. 백업은 `~/.gemini/config/hooks.json.bak-20261014`다. 훅이 다시 생기면 같은 일이 난다.
- 다시 확인: `cat ~/.gemini/config/hooks.json` — 10-17 새 노트북은 `{}`(훅 없음)다.

### 아르곤에게 블렌더 실행까지 맡기면 Claude Code가 막을 때가 있다
- 증상: Claude Code(자동 모드)에서 `agy -p … --dangerously-skip-permissions`로 아르곤이 블렌더를 직접 실행·반복하게 하려 하자 「Create Unsafe Agents」로 거절됐다(10-17 펠트 찻집 실험). 같은 날 15:56 싱크타운 찻집 구역 비교에서는 같은 플래그로 띄운 실행이 막히지 않고 1시간 20분·320단계를 혼자 돌아 GLB까지 냈다.
- 원인: 다른 에이전트에게 모든 도구 권한을 자동 승인으로 넘기는 실행이라 Claude Code 안전 장치가 그때그때 판단한다. 통과한 실행은 유호님이 그 실험을 직접 말했고(「둘 다 실험해줘」), 요청문·규격·참고 파일만 둔 격리 폴더를 작업 폴더로 해 스크립트 파일로 띄웠다. 어느 것이 갈랐는지는 모른다.
- 고침: 실행까지 맡길 때는 유호님 말을 받은 뒤 격리 폴더에서 띄운다 — `agy --model gemini-4-argon-high --input-format stream-json --output-format stream-json --print-timeout 0s --dangerously-skip-permissions --disable-slash-commands --log-file <폴더>/agy-cli.log`, 표준 입력에 `{"event":"user","message":{"content":"<요청문>"}}` 한 줄(기록 `experiences/synk-town/qa/blender-district-20261017/argon/run.json`). 이때 `--print`를 같이 넣으면 바로 뒤 낱말을 질문으로 먹고 종료 코드 2로 끝난다(10-17 그대로: `Error: --print took "--print-timeout" as its prompt, so the intended prompt was left as an argument and ignored.`) — 표준 입력으로 줄 때는 `--print`를 뺀다. 막히면 도구 없이 스크립트만 받는다 — `agy -p "<지시>" --model gemini-4-argon-high --disable-slash-commands --print-timeout 15m`, 답의 ```python 블록을 꺼내 위험 호출(지우기·네트워크·외부 실행)을 훑은 뒤 `blender -b --python build.py -- out.png scene.blend`로 내가 렌더한다. 고칠 점·오류는 `-c`(이어 하기)로 돌려준다. 답 하나에 3~5분, 1,300~1,700줄. 그래도 실행까지 맡겨야 하면 유호님이 Antigravity 앱에서 직접 한다. 기록 `.tmp/argon-blender-20261017/notes.md`.
- 다시 확인: `agy models | grep argon`(10-17 low/medium/high 셋).

### 아르곤 작업 보고서의 설정 주장이 실제와 다르다
- 증상: 10-17 찻집 구역 아르곤 보고서(`report.json`)가 굽기에 「OpenImageDenoise」를 켰다고 적었지만, 받은 굽기 지도에는 노이즈 제거가 걸리지 않았다.
- 원인: 아르곤이 켠 것은 Cycles 렌더 설정이고, 굽기는 그 설정을 쓰지 않는다([블렌더 노트](블렌더_3D.md#cycles-굽기에는-렌더-노이즈-제거가-걸리지-않는다)). 실제 노이즈 감소는 아르곤이 직접 짠 numpy 흐림과 검은 텍셀 메우기였다.
- 고침: 아르곤 보고서는 「한 일 목록」으로만 읽고, 수치·설정은 남긴 스크립트와 결과 파일로 확인한다(삼각형 수·텍스처 수는 GLB에서 직접 센다).
- 다시 확인: 보고서에 적힌 설정 이름을 아르곤 스크립트에서 `rg`로 찾아 어디에 쓰였는지 본다.

### 몽골어 검문이 문제없이 끝나도 종료 코드가 2다
- 증상: 검문이 끝나고 종료 코드 2가 나온다. 「■ 종합」 줄에는 「공식 앱 뜻 검토 대기」가 적혀 있다.
- 원인: `tools/몽골어대조.js`는 기계 검문 통과면 0, 실패면 1, 나머지는 모두 2로 끝난다. 뜻 대조가 돌지 않았으면 「뜻 검토 대기」로 남아 2가 된다.
- 고침: 판정은 「■ 종합」 사유 줄로 한다. 뜻은 원문과 역번역 한국어를 줄마다 직접 견준다. 맞춤법 층은 해시태그 붙여쓰기(`#солонгосхэл`)와 한국 이름(`Минсү`)을 늘 의심으로 낸다. 이런 것은 오타가 아니라고 보고하고, 게시 여부는 유호님께 묻는다.
- 다시 확인: `rg -n "exitCode = " tools/몽골어대조.js`(10-17 497행 `실패 ? 1 : (통과 ? 0 : 2)`).

### 몽골어 검문에서 `--구독`을 `--파일` 앞에 두면 쓰는 법만 찍고 끝난다 (2026-10-19)
- 증상: 10-19 `node tools/몽골어대조.js --구독 --파일 <경로>`가 검문 없이 「쓰는 법」만 찍었다. `--구독` 없이 돌리면 무료 키 파일(`~/SYNK_보안/제미나이_무료.txt`)이 없다며 멈춘다(새 노트북).
- 원인: 도구가 `--파일 <경로>`를 맨 앞 인자로 본다. 붙임 옵션은 그 뒤에 와야 한다.
- 고침: `node tools/몽골어대조.js --파일 <경로> --구독` 순서로 부른다.
- 다시 확인: 결과 맨 위에 「구독 문(Google AI 구독 …)」 줄과 「■ 문법·자연스러움」이 나온다.

### 몽골어 검문의 맞춤법 층이 긴 묶음에서 「Reached character limit」로 안 돈다 (2026-10-19)
- 증상: 10-19 WORLD 화면 언어 1판의 몽골어 15묶음(묶음당 55줄, 몽골어 1,072~3,055자)을 `--파일 … --구독`으로 돌리자 13묶음의 「■ 맞춤법」이 `HTTP 400 · Reached character limit`로 「미측정」이었다. 1,082자 묶음은 돌았고 1,275자 묶음부터 막혔다. 문법·역번역 층은 그대로 돌아 판정만 보면 놓친다.
- 원인: spellcheck.mn이 한 요청에 받는 글자 수에 상한이 있다(시간당 몫 초과와 다른 400). `tools/lib/몽골어맞춤법.js`는 문서 전체를 한 요청으로 보낸다.
- 고침: 묶음을 몽골어 쪽 950자 안으로 나눠 다시 돌렸다(고친 줄 재검문 12+2+1묶음, 마지막 재검문 20묶음 모두 맞춤법 층이 돌았다). 맞춤법만 따로 잴 때는 `맞춤법검사()`를 950자 조각마다 부른다(18조각, 시간당 몫에 걸리지 않았다).
- 다시 확인: 로그 「■ 맞춤법」 아래에 「이 층은 **안 돌았다**」가 없고 ✖ 줄이나 「0건」이 나온다.

## Claude API

### 새 키의 조직에 월 API 크레딧이 없어 충전 잔액이 나갔다
- 증상: Max 20x 월 API 크레딧($200)이 있다고 보고 새 키(`synk-local-tools`)로 블라인드 비교·교원 검수 사전 점검을 돌렸는데, 약 $2.6을 쓴 뒤 「Your credit balance is too low」가 났다(10-17).
- 원인: 그 키의 조직(unmet23 Console의 「양유호's Individual Org」, `anthropic-organization-id` f6ddc1be…)에는 크레딧이 없었고(Promotional credits 칸 없음), 8~9월에 산 작은 충전 잔액이 먼저 나갔다. 동시 요청 4개가 돌던 중이라 잔액을 넘겨 **미납 -$1.31**이 됐고 API가 막혔다(충전 전까지 같은 조직의 talk 운영·리허설 키도 멈춘다). 크레딧은 claude.ai 설정 → 결제의 「API 크레딧」에서 연결한 조직 하나에만 들어오고, 새 구독은 7일 뒤부터 받을 수 있다. 그날 Chrome의 claude.ai는 77yuhbs(Max 5x, 10-17 결제)였고 결제 화면에 API 크레딧 칸이 아직 없었다.
- 고침: 큰 작업 전에 Console 결제 화면의 Promotional credits와 조직 이름을 먼저 본다. 응답 머리 `anthropic-organization-id`로 키의 조직을 확인할 수 있다(키 값은 출력하지 않는다). 크레딧이 없으면 연결한 조직에서 키를 새로 만들거나 연결 조직을 고친다(직접 못 바꾸면 고객지원). 연결할 조직은 결제 수단·산 잔액·자동충전이 없는 새 조직이 안전하다. 공식 문서(10-18 확인)에 따르면 월 크레딧 다음에 산 잔액이 쓰인다. 그래서 잔액이 남은 조직은 크레딧이 떨어져도 「credit balance is too low」가 나지 않고, 다음 키로 넘어가지 않은 채 돈이 나간다. 자동충전도 산 잔액만 보고 기준선에서 충전하므로, 월 크레딧이 남아 있어도 충전된다.
- 다시 확인: 키 하나로 `claude-haiku-5-5` 16토큰 요청 — 크레딧이 있으면 200, 없으면 400 「credit balance is too low」(청구 없음).

### 구독에 로그인된 PC에서 `claude -p`에 API 키를 줘도 구독으로 청구된다
- 증상: 10-18 예약 작업을 크레딧으로 옮기려고 `ANTHROPIC_API_KEY`(또는 `apiKeyHelper`)를 주고 `claude -p`를 돌렸는데 구독 주간 한도 문구(「weekly limit」)가 나왔다. 키가 아니라 구독 로그인으로 돈 것이다. `--bare`를 붙이면 키로만 인증되지만, 도구가 Bash·Edit·PowerShell·Read 넷으로 줄고 `--tools default`로도 늘지 않는다(Claude Code 2.1.302).
- 원인: 구독 로그인이 든 설정 폴더(`~/.claude`)에서는 CLI가 로그인을 키보다 먼저 쓴다. `--bare`는 설정·로그인을 아예 읽지 않는 최소 모드라 도구도 최소다.
- 고침: 크레딧으로 돌 때는 구독 로그인이 없는 전용 설정 폴더를 `CLAUDE_CONFIG_DIR`로 주고 키를 함께 넣는다. `tools/크레딧실행.js`가 이렇게 띄운다. 폴더는 `%LOCALAPPDATA%\synk-claude-credit`이고, 유호님 설정에서는 `autoMode`·`permissions`만 옮긴다. 도구는 그대로고 인증은 키뿐이다. 그 폴더에서는 훅·플러그인·자동 메모를 읽지 않고, 세션 기록도 그 폴더에 쌓인다.
- 다시 확인: `--output-format stream-json --verbose` 시작 줄의 `apiKeySource`가 `ANTHROPIC_API_KEY`인지 본다. 실행기는 다른 값이면 경고를 남긴다. 일부러 틀린 키로 돌리면 「Invalid API key」로 바로 끝나서 청구 없이 확인된다(10-18: permissionMode auto · 도구 30개 · 비용 0). 크레딧이 없는 조직의 키면 「Credit balance is too low」가 나온다.

### 새 Console에서 만든 키가 `sk-ant-api…` 모양이 아니다
- 증상: 10-19 유호님이 새 Console(platform.claude.com)에서 DM 자동 답용 키를 만들었는데, `^sk-ant-api\d{2}-` 형식 검사에 걸려 1토큰 확인이 멈췄다.
- 원인: 새 Console의 키 생성 창은 「연결된 계정」(그 사용자 명의로 실행)과 「범위」(조직 또는 워크스페이스)를 고르게 한다. 이렇게 만든 키는 `sk-ant-usr…`로 시작한다(106자). 생성 전에 「ID 페더레이션을 쓰면 API 키가 필요 없다」 창이 먼저 뜨는데, 그건 GCP·AWS·Azure·GitHub Actions용이라 Supabase 함수에는 맞지 않는다.
- 고침: 키 모양은 `sk-ant-` 뒤를 넓게 받는다(`tools/lib/클로드키.js`·가리기 정규식은 이미 그렇다). 생성 창에서는 「API 키로 계속하기」를 고르고, 만료는 「안 함」(서버용), 범위는 「기본 워크스페이스」를 고른다. 키는 화면 캡처 없이 복사해 `~/SYNK_보안/클로드키_<계정>.txt`에만 넣는다. 캡처 도구가 스크린샷 폴더에 자동으로 저장하기 때문이다.
- 다시 확인: 그 키로 `claude-opus-5-5` 1토큰 요청이 200이고, 응답 머리 `anthropic-organization-id`가 크레딧을 받은 조직이다(10-19 「공자's Individual Org」 `c22447c4…`).

### Opus 5.5의 토큰 세기(count_tokens)는 생각 끄기(`disabled`)를 거절하지 않는다 (2026-10-19 Claude)
- 증상: talk 강사 도우미를 Opus 5.5로 올린 뒤(운영 v74) 무료 점검 `companion?점검=몸통`이 `ok:false`였다. 정상 몸통 200·가격표 있음인데, 일부러 넣은 틀린 값(`thinking.type: disabled`)도 200(`틀린값거절: 200`)이었다.
- 원인: Opus 5.5에서 count_tokens는 모델별 생각 규칙 일부를 보지 않는다. 실측(강사 도우미 실제 몸통, synk.yuh 키): `adaptive` 200 · `disabled` 200 · `enabled`+`budget_tokens` 200 · `between_tools` 400(「not supported for this model」) · 없는 값 400. 생성 창구(`/v1/messages`)는 `disabled`를 400(「Use thinking.type.adaptive and output_config.effort」)으로 거절한다. 10-05 Sonnet 5.5 때는 count_tokens도 `disabled`를 400으로 거절해 이 점검이 통했다.
- 고침: 점검의 틀린 값을 모델마다 표에 두고, 토큰 세기 창구가 그 모델에서 실제로 400을 내는 값으로 고른다(talk `lib/교정엔진.js` `도우미모델표`의 `점검틀린생각`, Opus 5.5는 `between_tools`, 커밋 `20849aa`). 모델을 옮길 때는 count_tokens에 후보 값을 먼저 보내 400이 나는지 본다(무료).
- 다시 확인: 무료 시험 스크립트 `.tmp/companion-opus-20261019/thinking-variants.cjs`(결과 `thinking-variants-*.json`). 고친 판을 배포한 뒤 `?점검=몸통`이 `ok:true`·`틀린값거절: 400`이다.

## Claude Code 자동 모드

### 번호나 오래된 말로 승인하면 공개 push가 막힌다 (2026-10-19 Claude)
- 증상: 10-18 synk.im 공개 push(synk-policy main)가 「공개해도 돼」(9시간 전, 그사이 방법이 바뀜)와 「1,2,공개해도돼」 뒤에도 「Production Deploy」로 거절됐다. 두 번째 뒤에는 자동 모드를 끄고 진행했다(그 세션은 검사 없이 돌았다).
- 원인: 판정 모델은 사용자 메시지·실행 명령·CLAUDE.md만 보고, Claude의 말과 도구 결과는 보지 않는다. 승인은 행동과 그 대상을 이름 대야 하고 한 번에 한 행동만 덮으며, 규칙으로 저장되지 않아 압축되면 사라질 수 있다(공식 문서 permission-modes 「Approvals you state in conversation」). 번호가 가리키는 Claude의 목록은 판정 모델에 보이지 않는다.
- 고침: 승인을 물을 때 다음 단계 상자 단추 문장에 대상과 행동을 적는다(예: 「synk.im(synk-policy main)에 회의·매뉴얼 도구 공개해」). 단추를 누르면 그 문장이 유호님 메시지로 간다. 자주 하는 정해진 길은 `~/.claude/settings.json`의 `autoMode.allow`에 둔다 — 10-19부터 본 작업본에서 돌리는 `git diff --quiet origin/master -- tools/공개.js && node tools/공개.js 올리기 <항목> -m '<메시지>' --실행 --계획 <해시>`(같은 세션에 미리 보기가 실제로 돈 뒤), 유호님이 요청한 꿀팁 글 push, 같은 세션에서 유호님 말로 `--승인`한 항목의 SNS `--발행`(앞에 같은 꼴의 `git diff --quiet origin/master` 확인, 다른 세션의 승인 기록은 안 됨). 정해진 옵션 밖의 옵션·환경 변수·리다이렉션이 붙어도 미리 허락이 아니다.
- 다시 확인: 10-18 아침 대상을 적은 단추 한 번으로 같은 push가 통과했다. `claude auto-mode config`의 allow에 위 네 줄이 있다.

### 예약 작업 지시문에 적은 공개·배포는 승인으로 치지 않는다 (2026-10-19 Claude)
- 증상(예방): 예약 작업이나 무인 `claude -p`의 지시문에 「synk.im에 공개까지」를 적어도 운영 반영 단계는 막힌다. `-p` 실행은 막힌 행동만 건너뛰고 끝까지 간다.
- 원인: 기본 allow 「Scheduled-Task Fires」가 저장된 지시문을 오래전에 친 지시로 다루고 soft 차단의 동의로 치지 않는다. 지시문에 「승인됨」을 적는 것은 지어낸 동의다.
- 고침: 무인으로 돌릴 운영 단계는 검사를 품은 정해진 도구 호출로 만들고 `autoMode.allow`에 그 호출 모양만 적는다. 그 밖의 운영 반영은 후보·미리 보기까지만 하고, 헤르메스(텔레그램 글이 그대로 사용자 메시지가 된다)나 다음 세션의 이름 댄 한마디로 잇는다. 무인 작업 보고에는 건너뛴 단계를 꼭 적는다.
- 다시 확인: `claude auto-mode defaults --label 'Scheduled-Task Fires'`.

### 설정 마법사 결과를 그대로 쓰면 자기 규칙과 부딪히고 기본 안전 문장이 빠진다 (2026-10-19 Claude)
- 증상: 10-17 앱이 띄운 「Teach auto mode about your environment?」로 `/auto-mode-setup`(쓰임새 mixed, 이 프로젝트만)을 돌려 그대로 적용했더니, 환경 설명의 「clasp push/deploy는 routine」이 clasp 확인 규칙과 부딪혔다. 기본의 「세션 저장소 신뢰」「공개 여부 가정」「민감 파일 전체」 문장이 빠졌고, 공개 사이트 synk.im을 믿는 내부 도메인에 넣었다. `claude auto-mode critique`가 같은 점을 짚었다.
- 원인: 마법사는 environment를 `$defaults` 없이 풀어 쓰면서 문장을 줄이고, 이 프로젝트 기록에서 본 명령을 「평소 일」로 적는다. 판정 모델은 cwd가 아니라 명령 글자를 보므로 `Bash(clasp push:*) in <경로>` 꼴 규칙은 PowerShell 배포(`& $claspBin push --force`)나 `clasp deploy -i`를 못 잡는다. `autoMode`는 프로젝트 설정에서는 읽지 않고 `~/.claude/settings.json`(과 관리 설정·`--settings`)에서만 읽는다.
- 고침: 10-19 손으로 다시 썼다 — 21칸을 모두 풀어 쓰고 운영 대상(synk-policy main·Releases·Apps Script 라이브·talk `--적용`·회사 서버), 공개 저장소(10-19 22:32 synk-appsscript가 공개로 바뀌어 넷 — 저장소 공개 여부가 바뀌면 판정 모델이 비공개로 알고 개인정보·비공개 자료 공개를 못 막으니 이 칸을 바로 고친다), 키 위치, Drive 백업처를 사실대로 적었다. clasp 규칙은 호출 방식과 상관없이 효과로 쓰고, allow·soft_deny는 맨 앞에 `$defaults`를 둔다. 비공개 저장소에서 만든 사이트 파일을 공개 저장소(synk-policy)로 보내는 공개는 단단 규칙(Data Exfiltration — 미리 허락으로 못 푼다)에 걸릴 수 있어, 「Data retention / declassification」 칸에 synk.im용 사이트 파일 공개 해제를 적었다. 도구 검사를 믿는 미리 허락은 여러 세션이 같은 작업본을 쓰므로 `git diff --quiet origin/master -- <도구>`를 앞에 붙인 꼴로만 연다(`HEAD` 기준이면 다른 세션이 고쳐 커밋만 한 판을 못 거른다). 페이블 검수·근거·적용 스크립트는 `.tmp/automode-review-20261019/`, 바꾸기 전 판은 `~/.claude/settings.json.bak-202610191939-automode`.
- 다시 확인: `claude auto-mode config` → environment 22·allow 20·soft_deny 77·hard_deny 1(10-19). `claude auto-mode critique`로 새 모순이 없는지 본다 — 규칙이 길면 비평 출력이 중간에 끊긴다(10-19 여러 번 끊김, `--model opus`가 조금 더 길게 낸다). 끊긴 곳까지 고치고 다시 돌린다. 비평은 돌릴 때마다 더 좁은 빈틈을 내므로, 되돌릴 수 없는 손상과 이어지는 지적까지만 고친다.

### 사람 없이 돌다 막힌 단계는 같은 세션을 유호님 문장으로 이어야 통과한다 — 대상 없는 「응 진행해」는 그때그때 다르다 (2026-10-19 Claude)
- 증상: 10-19 재현에서 예약 작업처럼 사람 없이 돈 `claude -p`(자동 모드)가 강제 push를 「Git Destructive」로 건너뛰고 끝났다. 같은 세션을 이어 간 실행에 「응 진행해」만 보냈더니 한 번은 다시 막혔고(20:50) 한 번은 통과했다(21:45). 알림에 적힌 「이 작업 폴더의 main을 원격 origin의 main에 강제로 덮어써 줘.」는 통과했다.
- 원인: 판정 모델은 막힌 호출 바로 뒤의 사용자 메시지를 그 호출의 재지시로 읽을 수 있다. 다만 대상 없는 짧은 말은 경계에 있어 판정이 흔들린다. 막힌 호출이 판정 모델에 보이려면 같은 세션(또는 그 갈래)이어야 한다.
- 고침: `tools/텔레그램승인.js` 훅(PermissionDenied·Stop)이 사람 없는 실행(`SYNK_UNATTENDED` 표시, 또는 첫 메시지가 `<scheduled-task …>`)의 막힌 일과 「이어갈 문장」(행동과 대상을 이름 댄 한 줄)을 텔레그램으로 보낸다. 답장은 헤르메스 `/synk_continue`(알림에 단 답장은 자동으로 이리 돌림)가 한 글자도 보태지 않고 `claude -p --resume`에 넣는다. 앱 예약 작업은 원래 기록을 건드리지 않게 `--fork-session` 갈래로 잇는다. 「취소」 답장은 실행 없이 건너뛴 채로 둔다. `--permission-prompt-tool`은 쓰지 않는다 — `-p` 실행을 폰 답이 올 때까지 붙잡고, 앱 예약 작업에는 붙일 수 없다.
- 다시 확인: `.tmp/tg-approval-20261019/e2e/`에서 `node 1_무인실행.cjs` → `python -X utf8 2_텔레그램답장.py "<알림 문장>"`(텔레그램 대신 `telegram-out/`에 글을 쓴다). 기록은 `logs/단계.jsonl`. 시험: `node --test tests/텔레그램승인.test.js`(11), `python tests/hermes-synk-plugin.test.py`(80), `node --test tests/크레딧실행.test.js`(8).

## Hermes(텔레그램 팁 봇)

봇 구성·장부·카드 절차는 [참고 카드 README](../참고카드/README.md)와 Hermes 스킬 폴더(`%LOCALAPPDATA%\hermes\skills\research\synk-tip-review\`)에 있다.

### GPT 대화 창이 64K로 묶여 2분마다 압축한다
- 증상: GPT(openai-codex)가 판정하는 동안 대화 압축이 2분마다 돌았고, 한 번에 1.5분이 걸렸다. agent.log에는 `Compressor window clamped to Ollama num_ctx: 500000 -> 65536`이 찍혀 있었다(10-16·10-17).
- 원인: `config.yaml` model 묶음의 `ollama_num_ctx: 65536`이 로컬 Ollama 모델이 아닌 모델에도 그대로 걸린다. `hermes-agent/agent/agent_init.py`는 이 값이 있으면 서버가 로컬인지 보지 않고 num_ctx로 쓰고, 압축기 창을 그 값으로 줄인다(`_clamp_compressor_to_ollama_num_ctx`). 값이 없으면 로컬 서버일 때만 Ollama에 물어 정한다.
- 고침: 10-17 11:31에 그 줄만 뺐고, 게이트웨이도 그 직후 다시 떴다. 로컬 qwen3.8-64k는 Modelfile의 num_ctx 65536과 `model.context_length: 65536` 상한 때문에 그대로 64K다.
- 다시 확인: `hermes chat -q "Reply with the single word OK." --oneshot --provider openai-codex -m gpt-6.1-sol --reasoning low --max-turns 1`을 한 번 돌리고, agent.log에서 그 실행의 `OpenAI client created (agent_init…)` 뒤에 `clamped to Ollama` 줄이 없는지 본다(10-17 16:26 없음, 입력 1.6만 토큰 한 번). 설정을 바꿨으면 게이트웨이 시작 시각(`%LOCALAPPDATA%\hermes\gateway-starts.log` 마지막 줄, 유닉스 초)이 config.yaml 수정 시각보다 뒤인지도 본다.

### Hermes 터미널에서 `/c/...` 경로를 넘긴 명령이 실패한다
- 증상: `git -C /c/Users/...`나 `node /tmp/a.js`가 「cannot change to」·「not found」로 실패한다. `cd /c/...`는 된다.
- 원인: Hermes의 `terminal` 도구는 Windows에서 Git Bash(MSYS)로 돌지만 경로 변환을 꺼 둔다. 그래서 네이티브 프로그램(git·rg·node·python)에는 MSYS 경로가 바뀌지 않고 그대로 넘어간다. PowerShell 명령도 쓸 수 없다.
- 고침: 네이티브 프로그램에는 `C:/Users/...`처럼 슬래시로 쓴 Windows 경로를 넘긴다. 네이티브 프로그램이 읽을 임시 파일은 `/tmp`가 아니라 `$LOCALAPPDATA/Temp`에 둔다.
- 다시 확인: `rg -n "path conversion is disabled" "$LOCALAPPDATA/hermes/hermes-agent/agent/prompt_builder.py"`(10-17 v0.22.2 926행).

### Hermes 파이썬에서 yaml을 못 읽는다
- 증상: Hermes에 딸린 파이썬으로 config.yaml을 검사하면 `ModuleNotFoundError: No module named 'yaml'`이 난다.
- 원인: `%LOCALAPPDATA%\hermes\tools\python-3.14.7…`는 Hermes가 쓰는 최소 파이썬이라 yaml이 들어 있지 않다.
- 고침: config 검사는 Node로 `hermes-agent/node_modules/yaml`을 불러서 한다.
- 다시 확인: `"$LOCALAPPDATA/hermes/tools/python-3.14.7+20260901-win32-x64/python.exe" -I -c "import yaml"`(10-17 여전히 실패, node yaml 2.9.1은 있음).

### Hermes의 GPT 계정은 `~/.codex`와 따로 있다
- 증상: GPT 앱의 로그인(`~/.codex`)을 바꿔도 Hermes가 쓰는 GPT 계정은 바뀌지 않는다. `hermes auth list/status`는 메일을 보여 주지 않는다(10-17).
- 원인: Hermes는 자기 `%LOCALAPPDATA%\hermes\auth.json`에 있는 openai-codex 자격(device_code)을 쓴다. 이 자격이 GPT 앱·굽기와 같은 계정이면 주간 한도도 같이 쓴다.
- 고침: 어느 계정인지는 토큰에서 email 칸만 풀어 확인하고, 토큰 값은 어디에도 남기지 않는다. Hermes에는 자격을 여러 개 넣고 순서(`auth add`·`priority`)대로 돌려 쓰는 기능이 있다.
- 다시 확인: `hermes auth status`로 자격 개수를 본다.

### GPT가 받기 스킬을 스스로 고친다
- 증상: 10-17 06:12에 GPT가 `skill_manage`로 자기 스킬(SKILL.md)을 고쳤다.
- 원인: Hermes는 에이전트에게 스킬을 고치는 도구를 준다. 스킬 폴더 안에 둔 옛 판 사본도 스킬로 읽힐 수 있다.
- 고침: 옛 판 사본은 스킬 폴더 밖(`%LOCALAPPDATA%\hermes\backups\`)에 둔다. 스킬을 고친 뒤에는 GPT가 다시 덮어썼는지 SKILL.md의 수정 시각과 내용을 본다.
- 다시 확인: `ls "$LOCALAPPDATA/hermes/backups"`(10-17 `synk-tip-판정판-20261017` 있음).

### `web_extract`가 Codex 연결에서 돌지 않는다
- 증상: GPT(openai-codex)로 도는 Hermes에서 `web_extract` 도구가 되지 않았다(10-16).
- 원인: 모른다.
- 고침: 막다른 길: 다른 연결로는 시험하지 않았다. 지금 받기 스킬은 `scripts/ig_fetch.py`로 게시물을 받는다.
- 다시 확인: 스킬 폴더 `scripts/`에 `ig_fetch.py`가 있는지 본다(10-17 있음).

### 설정을 바꿔도 게이트웨이에 바로 반영되지 않는다
- 증상: config.yaml을 고쳐도 다음 공유가 옛 설정으로 처리된다.
- 원인: 게이트웨이는 시작할 때 설정을 읽는다. PC가 절전 중이거나 꺼져 있으면 게이트웨이도 멈추고, 그동안 텔레그램이 약 24시간 쌓아 둔 메시지를 다음 로그인 때 한꺼번에 처리한다.
- 고침: 설정을 바꾸면 `hermes gateway restart`를 한다. 처리 중인 일을 마친 뒤 내려간다.
- 다시 확인: `%LOCALAPPDATA%\hermes\logs\gateway-restart.log` 끝 줄의 시각.

### 연결됨 표시만으로 텔레그램 작업 완료를 판단하지 않는다
- 증상: 10-18 점검에서 게이트웨이는 running·telegram connected였지만, 같은 날 이전 로그에는 Telegram API ConnectTimeout이 반복됐고 14:33 재시작 때 이전 프로세스의 비정상 종료가 기록돼 있었다. 점검 당시 PC는 AC·배터리 모두 유휴 3,600초 후 절전 설정이었다.
- 원인: 시간초과와 비정상 종료의 직접 원인은 미확정이다. 현재 게이트웨이는 로컬 PC에서 실행되므로 절전 중에는 일을 진행할 수 없다. 시작프로그램 등록은 로그인 시 실행을 뜻하며 상시 가동 증거가 아니다.
- 고침: 이번 점검에서는 설정·프로세스를 바꾸지 않았다. 게이트웨이 상태·실제 PID·최근 polling 복구 로그, Telegram getMe/getWebhookInfo 읽기, 장부 pending/recent 읽기를 대조했다. getUpdates를 별도로 호출해 수신 메시지를 소비하거나 시험 메시지를 보내지 않았다.
- 다시 확인: 10-18 15:29 이후 Telegram 읽기 API HTTP 200·pending_update_count 0, 장부 조회 성공·기존 6줄·적용안 대기 0을 확인했다. 새 메시지의 접수→장부 추가→Claude 예약 완료→전달 전 과정은 이번에 시험하지 않았다. 비밀값을 제외한 근거는 `.tmp/hermes-audit-20261018/`.

### Windows 시작프로그램은 게이트웨이 장애 복구가 아니다
- 증상: 공식 Startup VBS가 등록돼 있었지만 게이트웨이의 비정상 종료 뒤 재실행을 보장하는 외부 감시가 없었다(10-18).
- 원인: VBS의 `sh.Run(..., 0, False)`는 Python을 분리하고 종료한다. 게이트웨이 내부 loop watchdog도 종료 코드 75로 나가는 구조라 외부 재실행기가 필요하다.
- 고침: 기존 시작프로그램을 유지하고 `SYNK_Hermes_Gateway_Recovery` Windows 작업을 추가했다. 2분마다 소유 PID·실행파일·gateway run만 확인해 없을 때 공식 `hermes gateway start`를 부른다. LLM 호출·강제 종료는 없다. AC 유휴 절전·최대절전만 0으로 바꾸고 배터리·덮개 동작은 유지했다.
- 다시 확인: `tools/hermes-synk/runtime/recover-gateway.ps1 -ReadOnly`와 작업 스케줄러 실제 결과 0, 원래 게이트웨이 PID 유지·AC 0/DC 3600을 확인했다. 강제 장애 시험은 하지 않았다. 소스·복원은 `tools/hermes-synk/README.md`, 근거는 `.tmp/hermes-improve-20261018/runtime/`.

### 다른 Python 프로세스의 terminal 시험은 실제 게이트웨이 자동 전달 증거가 아니다
- 증상: 별도 Python helper가 공식 terminal을 호출해도 운영 게이트웨이가 그 프로세스의 메모리 queue를 자동 인수하지 않는다.
- 원인: 완료 watcher·ProcessRegistry는 프로세스별이고 checkpoint 복원은 게이트웨이 시작 시 수행된다. `process_manage poll`은 전체 output이 아니라 짧은 output_preview만 반환하며, log/wait를 먼저 읽으면 자동 알림이 소비될 수 있다.
- 고침: CLI 직접 실행·완료 receipt와 운영 게이트웨이의 자동 전달 시험을 구분한다. 전달 시험은 1회용 공식 gateway startup hook에서 실제 등록 명령을 호출한다. 현재 SYNK 연결은 추가 GPT 호출 없이 작업별 wait/log로 공식 마지막 응답을 읽어 공식 Telegram 전송 helper로 전달하며 `delivery.json`의 sent·message_id를 본다. 시험 hook는 끝나면 비활성화한다.

### 공식 CLI 작업이 끝나도 접수 GPT 한도 때문에 결과 알림이 실패한다
- 증상: 10-18 게이트웨이 안에서 실제 Codex·Claude 작업은 끝났지만, 기존 notify=true 완료 요약이 Hermes GPT의 `usage_limit_reached` 429에 막혀 결과 대신 재요청 안내를 보냈다. Claude도 `subtype: success`인데 `is_error: true`, `terminal_reason: api_error`, 429로 끝났다.
- 원인: CLI 실행 계정과 결과를 다시 요약하는 Hermes 계정은 별개이며, 프로세스 종료·JSON subtype만으로 성공을 판정할 수 없다.
- 고침: SYNK 작업의 notify를 끄고 공식 process_manage wait/log로 CLI 마지막 응답을 추출해 공식 send_message helper로 직접 보낸다. 오류·한도·미완료를 그대로 표시하고, API 수신 확인 ID와 결과를 저장한다. 전송 결과가 불명확하면 중복 전송하지 않는다. 계정·모델은 바꾸지 않는다.
- 다시 확인: `tests/hermes-synk-plugin.test.py`의 실제 모양 429·미완료·전송 미확인 시험과 `.tmp/hermes-improve-20261018/gateway-smoke-direct.json`의 운영 게이트웨이 시험을 대조한다. 직접 명령은 접수 GPT를 호출하지 않지만 자연어·기존 팁 답장은 GPT 한도 영향을 받는다.

### Hermes에서 실행한 Codex의 Windows 샌드박스 준비가 멈춘다
- 증상: 10-18 Codex workspace-write 실행이 Windows elevated sandbox 준비에서 문서 읽기를 끝내지 못했고, CLI는 종료 코드 0으로 원문 미확인 결과를 냈다.
- 원인: 해당 실행의 elevated 준비가 응답하지 않았다. 샌드박스 내부 원인은 미확정이다.
- 고침: 호출별 `-c windows.sandbox=mxc`로 공식 MXC를 선택하고 workspace-write는 유지한다. 계정·모델·전체 권한 우회 옵션은 바꾸지 않는다.
- 다시 확인: 공식 `codex sandbox --include-managed-config --permission-profile ':workspace'`로 실제 `docs/AI_운영원칙.md` 읽기가 성공했다. 텔레그램 실제 위임 결과에서도 문서 내용·미확인 문구·전송 확인을 따로 확인한다.
- 다시 확인: `.tmp/hermes-improve-20261018/gateway-smoke-result.json`의 운영 PID·작업 ID·종료 코드·Telegram assistant 표식과 실제 전송 기록을 대조한다. 휴대폰에서 직접 입력한 새 메시지의 수신 증거와는 구분한다.

### 헤르메스만 다른 GPT 계정으로 바꾸려면 독립 OAuth와 활성 자격을 함께 확인한다
- 증상: 10-18 사용자 요청으로 헤르메스 접수 GPT를 `q121235@outlook.com` Microsoft 계정으로 바꿨다. 기존 Codex 그림 굽기에도 같은 계정 로그인이 있었지만 refresh token 사본을 함께 쓰면 회전 때문에 다른 세션이 무효가 될 수 있다.
- 원인: Hermes는 독립 OAuth 세션과 credential pool을 쓰며, 새 계정을 priority 0에 추가만 하면 한도 때 옛 계정으로 회전할 수 있다. `auth.adopt_external_logins: true`도 다른 앱 로그인을 가져올 수 있다.
- 고침: Hermes 내부에 원래 인증·설정을 백업하고 공식 `auth add openai-codex --browser --no-browser`로 새 로그인했다. 실제 이메일을 확인한 뒤 기존 자격을 공식 `auth remove`로 활성 pool에서 뺐고 외부 로그인 자동 가져오기를 껐다. 모델·추론 설정은 유지하고 공식 gateway restart로 반영했다.
- 다시 확인: 활성 pool 1개·JWT 이메일 `q121235@outlook.com`·옛 singleton 없음·자동 provider fallback 없음, GPT-6.1 Sol xhigh의 `SYNK_HERMES_GPT_CONNECTED` 응답·도구 호출 0, gateway running·telegram connected를 확인했다. 비밀값 없는 근거 `.tmp/hermes-gpt-account-20261018/`. 기존 Codex·Claude 앱의 계정 전환은 하지 않았다.

### Hermes 반복 조회에서 보낸 기록이 새 보고를 가린다
- 증상: 10-18 세 흐름 연결 시험에서 발송 기록이 100개 넘으면 새 아침 보고가 큐에서 빠질 수 있었다. 자정에 받은 원격 자료를 아침 보고에 다시 쓸 수도 있었다.
- 원인: 파일명 정렬 뒤 개수 제한을 먼저 적용했고, 원격 갱신을 날짜 변경으로만 판단했다.
- 고침: 발송 시도 claim이 없는 초안만 생성 시각순으로 읽는다. 원격 자료는 한 시간마다, 아침 보고 직전에도 갱신한다. 발송 결과가 불명확하면 재전송하지 않는다. 잠금이 10분 넘게 남으면 정상으로 표시하지 않고 한 번 알린다.
- 현재 정책: 10-18 추가 요청 이후 아침 요약은 껐고 판단·조치 필요 사건만 알린다. 기존 정보성 초안은 보존하면서 발송을 억제하며 원격 자료의 시간당 조회는 유지한다.
- 다시 확인: `tests/hermes-synk-monitor.test.cjs`의 과거 발송 120건+새 보고, 동시 수집·재시작·변화 없는 날 시험과 `tests/hermes-synk-automation.test.py`의 동시 발송·불명확한 응답 시험. 공식 예약은 `--no-agent`·5분 하나이고 예약 엔진의 별도 실패 전송은 `local`로 두어 현재 수신자 허용 검사를 거친 전송만 쓴다.

### 큰 공용 저장소를 통째로 복사하면 격리 작업도 무거워진다
- 증상: 10-18 SYNK 전체 원문 후보가 약 1.29GiB여서 휴대폰 요청마다 전체 작업본을 만들 수 없었다.
- 원인: 큰 자료가 함께 있는 공용 저장소를 일반적인 작은 코드 저장소처럼 취급했다.
- 고침: 현재 수정본 중 요청한 파일·폴더와 필수 원문만 별도 인덱스로 확인한 뒤 공식 sparse worktree로 만든다. 격리 준비는 원본 HEAD·인덱스·설정을 바꾸지 않는다. 10-18 추가 승인 후 원본 파일 반영은 별도 3방향 병합·검증·배타 쓰기 단계가 맡는다. 원본 변경·비밀·용량 초과·대상 누락은 접수를 보류한다.
- 다시 확인: `tests/hermes-synk-workspace.test.cjs`의 현재 dirty 원문 보존·원본 인덱스/설정 불변·동시 준비·범위/비밀/보관 한도 시험. 별도 인덱스와 기준 HEAD를 그대로 `npm run check:storage`에도 넘긴다.

### Git 무시 목록에 든 요청 파일이 격리 작업본에서 빠진다
- 증상: 실제 `docs/홈페이지_시안/시안.html`이 있어도 Git 후보 목록에서는 빠져, 대상 없이 준비 성공을 반환할 수 있었다.
- 원인: `ls-files --others --exclude-standard`에는 ignored 파일이 나오지 않는다. 반대로 전체 ignored 목록을 재귀 검색하자 실제 큰 저장소에서 준비가 지연됐다.
- 고침: 선택한 실제 경로만 제한적으로 열거하고 `check-ignore --stdin`으로 확인한다. 대상 소스가 무시되어 있으면 `IGNORED_SCOPE_SOURCE`로 보류한다. 기본 작업본에는 운영 원문과 도구 사용 전 필수 현장 노트도 포함한다.
- 다시 확인: 명시 파일·디렉터리 scope와 무관한 cache/dependency 제외 시험, 실제 문제 경로의 읽기 전용 진단. 준비 실패 때는 CLI를 시작하지 않으며 새 요청으로 다시 접수해야 한다.

### Hermes의 저장소 Python을 그대로 부르면 설치된 의존성을 못 찾는다
- 증상: 공식 관리 Python으로 스크립트를 직접 부르면 `ModuleNotFoundError: dotenv`가 났다. 공식 `hermes cron run`에서는 같은 스크립트가 성공했다.
- 원인: 이 Windows 설치는 의존성 경로를 공식 실행기가 구성한다. 저장소 Python 파일 하나만 실행하는 것은 같은 실행 환경이 아니다.
- 고침: 운영 검증은 공식 cron의 `--no-agent` 경로로 한다. 일시중지 예약의 `cron run`은 성공 실행이 아니라 활성화 안내만 반환하므로 실제 `last_status`와 수집 `health.json`을 확인한다.
- 다시 확인: 10-18 `synk-three-flows`의 17:00 공식 수동 실행과 17:10 첫 자동 실행 모두 `last_status=ok`, `health.json status=ok/noAgent=true`. 자동 실행이 보낸 점검 알림의 Telegram API 수신 확인과 발송 기록 재처리의 새 전송 0회를 대조했다.

### 검증한 작업을 원본에 자동 반영할 때 동시 저장과 알림이 겹친다
- 증상: 10-18 합성 저장소에서 하드링크 파일을 쓰자 범위 밖 연결 파일도 바뀌었다. 검증 뒤 같은 범위에 생긴 새 의존 파일도 기존 파일 해시만으로는 놓쳤다. 결과 처리와 5분 수집이 겹치면 같은 판단 알림을 두 경로에서 보낼 수 있었다.
- 원인: 경로 검사 뒤 교체하는 방법은 검사와 쓰기 사이에 틈이 있고, 기존 파일 목록만 비교하면 추가된 파일이 빠진다. 알림을 보냈는지 확인하는 것만으로는 아직 보내기 전인 두 처리기의 경합을 막지 못한다.
- 고침: 최신 원본과 3방향 병합한 후보를 다시 검사한다. Windows에서 원본·의존 파일과 부모 폴더의 핸들을 확보한 뒤 내용·범위 목록을 대조하고 같은 핸들로 쓴다. 쓰기 대상의 hardlink 수가 2 이상이면 보류한다. 사전 백업과 fsync 작업 영수증을 남기고 이미 적용한 부분은 다시 쓰지 않는다. 실패 뒤 생긴 빈폴더는 경로로 삭제하지 않는다. 새 직접 위임 작업의 판단 알림은 플러그인만 소유하며 수집기는 상세 조회만 한다.
- 다시 확인: `tests/hermes-synk-integration.test.cjs`의 실제 Windows writer 잠금·hardlink·검증 뒤 파일 추가·재시작 영수증·원본 HEAD/인덱스 보존 시험, `tests/hermes-synk-overview.test.cjs`의 발송 전/중/불명 구간 중복 알림 0회 시험. 다중 파일의 전원 차단을 단일 원자 쓰기로 보장하지 않으며, 중간 바이트나 이후 다른 변경이 있으면 자동 덮어쓰기 없이 판단 대기로 남긴다.

### Node 시험의 종료 0과 모듈 로드는 변경 동작 검증이 아니다
- 증상: 없는 시험 경로와 정상 시험을 함께 주면 Node가 누락을 넘길 수 있고, 함수가 잘못돼도 모듈을 불러오기만 한 시험은 통과했다. 상위 Node 시험 프로세스의 `NODE_TEST_CONTEXT`를 물려주면 하위 시험 출력도 사라질 수 있었다.
- 원인: 명령 종료와 실제 시험 수·변경 동작의 실행 여부를 같은 증거로 취급했다.
- 고침: 검사 경로 실재·명시적 TAP 전체 통과·skip/todo 0·변경줄의 V8 함수/분기 실행을 확인한다. 하위 환경에서 계정·API 키·상위 test context를 제외한다. JSON 등 별도 검증 방법이 없는 형식은 파싱만으로 자동 반영하지 않는다. 새 계약 `changed_lines_v1` 이전의 성공 캐시는 재사용하지 않는다.
- 다시 확인: `tests/hermes-synk-validation.test.cjs`의 실제 실패·무관한 시험·미호출 함수/분기·여러 프로세스 실행 합산·시험 중 후보 변경·재시작 캐시 시험.

### Claude 결과의 `subtype: success`만으로 성공을 판정하면 안 된다

- 증상: 10-18 19:40 Hermes의 실제 Claude 시험 `synk-b4cde9c4b442`에서 JSON은 `type: result`, `subtype: success`지만 `is_error: true`와 주간 한도 문구를 반환했고 프로세스는 코드 1로 종료됐다.
- 원인: 결과 이벤트의 subtype과 실제 오류·사용량 한도 판정이 별개다. 설정 `opus / xhigh`는 유지됐어도 `modelUsage`가 비어 있으면 실제 모델 호출을 증명하지 못한다.
- 고침: 기존 결과 parser의 종료 코드·`is_error`·한도 문구 판정을 그대로 사용해 `NATIVE_QUOTA_LIMITED`로 보류했다. 계정·모델·API 경로를 바꾸거나 실패 영수증을 성공으로 고치지 않는다. 초기화 문구 `resets 12pm (Asia/Seoul)`에 없는 날짜는 추측하지 않는다.
- 다시 확인: `.tmp/hermes-claude-20261018/`와 해당 작업의 `native.stdout.jsonl`·`finalization.json`·`delivery.json`. 19:41:27 Telegram API 수신은 휴대폰 열람 증거가 아니며 실제 완주는 한도 해제 뒤 새 요청으로 확인한다.

### 개인 대화를 Claude로 바꿀 때 config.yaml은 줄끝이 섞여 있고, 보조 호출도 Claude로 나간다 (2026-10-19 Claude)
- 증상: 개인 대화(6017495834)를 GPT에서 Claude Sonnet 5.5로 바꾸려고 config.yaml의 두 값과 주석 두 줄을 글자 그대로 찾았더니 한 줄도 맞지 않았다. 시험 호출 한 번에 대화 제목 짓기 보조 호출도 Claude로 나갔다.
- 원인: config.yaml은 CRLF 줄(2,046)과 LF 줄(366)이 섞여 있어, 파일 전체를 한 가지 줄끝으로 나누면 줄이 합쳐진다. 보조 작업(제목·압축·그림 보기)은 「auto」면 그 대화의 주 제공자부터 쓴다(`agent/auxiliary_client.py`의 자동 사슬). 키는 `.env`의 `ANTHROPIC_API_KEY`가 찾아낸 OAuth보다 먼저 쓰인다(`agent/anthropic_credentials.py`).
- 고침: 줄마다 원래 줄끝을 둔 채 두 값과 주석만 바꾸고, 바꾼 뒤 전체를 다시 읽어 두 값 말고는 그대로인지 대조했다(`.tmp/hermes-telegram-claude-20261019/switch.cjs`, 되돌리기는 `--restore`). 키는 synk.yuh 조직 키를 `%LOCALAPPDATA%\hermes\.env`에 넣었다. 복구 작업을 잠시 끄고 공식 `hermes gateway restart`(하던 일 마치고 내려감, 45초)로 다시 켠 뒤 복구 작업을 다시 켰다.
- 다시 확인: `hermes chat -q "Reply with the single word OK." --oneshot --provider anthropic -m claude-sonnet-5-5 --max-turns 1` 뒤 agent.log에 `API call #1: model=claude-sonnet-5-5 provider=anthropic in=21870 … write=21866`가 찍힌다. 새 대화마다 약 2.2만 토큰을 캐시에 써서 약 $0.055가 든다. 휴대폰에서 온 메시지는 agent.log의 `conversation turn: … provider=anthropic platform=telegram`으로 본다. 게이트웨이 설정 읽기 코드를 헤르메스 파이썬으로 직접 부르면 `ruamel`을 못 찾아 그 길로는 확인하지 못했다.

### 게이트웨이를 켠 뒤에 깔린 패키지는 게이트웨이가 못 쓴다 — Claude로 바꾼 뒤 텔레그램 공유가 모두 실패했다 (2026-10-19 Claude)
- 증상: 10-19 20:33~20:54 휴대폰에서 공유한 인스타 링크 6건이 모두 몇 초 만에 오류 답장으로 끝났다. errors.log에는 `ImportError: The 'anthropic' package is required for the Anthropic provider: venv: not installed and lazy installs are disabled … this process is not running from the install's dependency environment`가 찍혔다. 같은 날 CLI 시험(`hermes chat … --provider anthropic`)은 성공했었다.
- 원인: 개인 대화를 Claude로 바꾸며 19:44:02에 게이트웨이를 다시 켰고, 24초 뒤 그 CLI 시험이 anthropic 추가 패키지를 지연 설치해 새 의존성 세대를 냈다(`logs/update_receipts/latest.json` 19:44:26~19:45:03, `installs/<id>/facts.json`의 선택이 `environments/e3240b89…/venv`로 바뀜). 게이트웨이는 켤 때 올린 세대(`9810c096…`, anthropic 없음)를 끝까지 쓰고, Hermes는 선택 세대가 아닌 세대에서 도는 프로세스의 지연 설치를 거절한다(`pm/client.py` sync_venv → `pm/environments.py` running_from_selected_environment). 그래서 CLI는 되고 게이트웨이만 매번 실패했다. 전환 때 CLI 시험만 보고 휴대폰에서 온 대화는 확인하지 않았다.
- 고침: 21:42 복구 작업을 잠시 끄고 공식 `hermes gateway restart`로 다시 켰다(새 게이트웨이가 `e3240b89…`를 씀). 막힌 6건은 한 번만 도는 Hermes 예약 작업(`hermes cron create "1m" … --skill synk-tip-review --provider anthropic --model claude-sonnet-5-5 --deliver telegram:6017495834 --failure-deliver local --repeat 1`)으로 같은 게이트웨이 안에서 다시 받아 장부 10~15행에 올리고 한 번에 답장했다(21:52, 호출 8번·약 $0.3). 「1m」은 1분 뒤 한 번이 아니라 1분마다라서 `--repeat 1`이 있어야 한 번으로 끝난다. 예약 작업 안에서는 execute_code가 막혀 터미널로 대신한다. 재발 막기로 `tools/hermes-synk/runtime/recover-gateway.ps1`가 게이트웨이가 올린 모듈 경로의 세대와 facts.json의 선택 세대를 대조해, 다르면 다음 확인(2분 뒤)에 Hermes가 쉬는 중(gateway_state.json의 active_agents 0·processes.json 빈 목록·도구 자식 프로세스 없음)일 때만 공식 restart를 한 번 부르게 했다. 공식 restart는 기본값(`restart_drain_timeout` 0)으로 처리 중인 대화를 기다리지 않고 끊으므로(Windows는 30초 뒤 강제 종료) 바쁘면 미루고, 30분 넘게 바쁘면 종료 코드 6을 낸다. 아직 확인 못 한 빈틈은 [실행 복구 README](../../tools/hermes-synk/runtime/README.md)에 적었다(10-19 Fable 검수. 그중 작업이 띄운 게이트웨이의 Job은 10-20에 확인해 바로 아래 항목에 적었다). restart가 하던 일을 마치고 내려가는 것처럼 보였다면 그때 처리 중인 일이 없었던 것이다. 제공자를 바꿀 때는 `hermes pm install --extra <제공자>`로 먼저 깔고 게이트웨이를 다시 켠다.
- 다시 확인: 게이트웨이가 쓰는 세대는 `(Get-Process -Id <gateway.pid>).Modules` 경로의 `\environments\<세대>\`, 선택 세대는 `installs/<id>/facts.json`으로 본다(10-19 21:43 둘 다 `e3240b89…`). `recover-gateway.ps1 -ReadOnly`는 어긋남을 찾으면 종료 코드 5를 낸다. 시험은 `node --test tests/hermes-synk-recovery.test.cjs`. 이번 다시 처리는 같은 게이트웨이의 예약 작업 경로(agent.log `platform=cron`, `delivered to telegram:6017495834 … message_id=65`)로 확인했고, 휴대폰에서 직접 보낸 새 공유는 `conversation turn: … provider=anthropic platform=telegram`으로 본다.

### 작업 스케줄러에서 띄운 게이트웨이는 `breakaway: true`여도 작업 Job에 남는다 — 그래도 점검과 게이트웨이에 탈은 없다 (2026-10-20 Claude)
- 증상: 복구 작업(`SYNK_Hermes_Gateway_Recovery`)이 `hermes gateway start`·`restart`로 띄운 게이트웨이가 작업 스케줄러 Job에 묶이는지는 확인한 적이 없었다(10-19 Fable 검수 빈틈). 10-20 같은 설정의 일회용 작업에서 같은 방식으로 대역 자식을 띄웠다. breakaway 요청은 오류 없이 끝나 표식이 "1"(진단 로그의 `breakaway: true`)이었는데, 자식은 작업 Job 안에 그대로 있었다.
- 원인: 이 PC에서 작업 스케줄러가 띄운 작업 프로세스(부모는 Schedule 서비스의 svchost)는 제한이 없는 Job(LimitFlags 0x0)에 들어 있었다. 같은 사용자의 다른 예약 작업 프로세스와 다음 실행의 PowerShell도 같은 Job이었다. 이 Job은 이탈(BREAKAWAY_OK·SILENT_BREAKAWAY_OK)을 허용하지 않는다. KILL_ON_JOB_CLOSE도 없으니, 플래그로 보면 Job 핸들이 닫혀도 안의 프로세스는 죽지 않는다. 그 안에서 `hermes.exe`(distlib simple_launcher)가 CLI 파이썬을 자기 Job(0x3000 = 닫히면 죽이기 + 조용한 이탈)에 한 겹 더 넣는다. 중첩 Job에서 CREATE_BREAKAWAY_FROM_JOB은 바로 위 Job이 이탈을 허용하면 위로 올라가다가, 이탈을 막는 첫 Job에서 오류 없이 멈춘다([Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs)). 그래서 자식은 실행기 Job만 빠져나와 작업 Job에 남고, Hermes는 이를 성공으로 본다. 그래도 작업 스케줄러는 작업 프로세스(PowerShell)가 끝나면 실행이 끝난 것으로 보고, Job 안의 다른 프로세스는 기다리지 않는다. 작업을 끝낼 때도 Job 전체를 끝내지 않았다(작업 PowerShell만 끝나고, 부모가 이미 끝난 자식은 살았다). Hermes 안내문(`hermes_cli/gateway_windows.py` 1266·1310행)은 「작업 스케줄러는 Job 밖에서 띄운다」고 적고 있어 글자 그대로는 이 관찰과 다르지만, 죽지 않는다는 취지는 맞다.
- 고침: 띄우는 방식은 바꾸지 않았다. 10-20 06:35~06:38에 유호님 승인을 받아 같은 주체·설정(Interactive·Limited·IgnoreNew·Windows PowerShell 5.1)의 일회용 작업을 등록해 시험하고 지웠다. hermes.exe의 실행기 부분(바이트가 같다)에 대역 스크립트를 붙인 대역 CLI가 `windows_detach_flags()`로 대역 자식을 띄웠다. 작업은 스크립트가 끝나고 1~2초 뒤 Ready가 됐다. 실행 중에 작업을 끝내도, 끝난 실행에 종료를 보내도, 작업을 지워도 자식은 살아서 심박을 이어 썼다. 이 가운데 끝난 실행에 종료를 보낸 것과 작업을 지운 것은 그날 손으로 확인했고(콘솔 출력은 `out/manual-checks.txt`), 그 뒤 같은 순서를 `run-test.ps1`의 runB·cleanup에 넣었다. 같은 Job에서는 다른 예약 작업이 10-19 19:11 로그인 때 띄운 NahimicSvc64·NahimicSvc32·XRiteColorAssistant가 11시간 넘게 살아 있었다. 문서상, 작업 Job이 바로 위 Job이 된 프로세스가 다시 이탈을 요청하면 ERROR_ACCESS_DENIED로 거절된다. 게이트웨이가 이탈해 띄운 재시작 감시자와 `/update` 도우미가 그런 프로세스다. 이번에 읽은 Hermes 경로는 그다음 프로세스를 이탈 없이 띄우거나(`gateway/run_shutdown.py` 110~115행 재스폰, `gateway/slash_commands.py` 70~78행 `/update` 도우미), 거절되면 이탈 없이 다시 띄운다(`hermes_cli/gateway.py` 1137~1151·1177~1189행 재시작 감시자). 그 감시자로 다시 뜬 게이트웨이는 진단 로그에 `breakaway: false`로 찍힐 수 있다.
- 다시 확인: 게이트웨이는 켜질 때 스스로 자기 Job에 들어간다(`gateway/run.py`의 attach_self_to_kill_on_close_job). 그래서 바깥에서 IsProcessInJob만 봐서는 작업 Job에 묶였는지 알 수 없고, 작업 안에서 그 Job의 프로세스 목록을 읽어야 한다. 유호님 승인을 받은 뒤 `.tmp/hermes-job-breakaway-20261019/run-test.ps1`을 `-Step register`→`runA`→`runB`→`cleanup` 순서로 돌린다(작업 등록·삭제가 따른다). `out/task-A.jsonl`의 작업 Job `LimitFlags`, `out/child-A.json`의 `job_at_start`(자식이 그 Job 안에 있는지), runA 출력의 「task state Ready」를 본다. Windows 업데이트 뒤 LimitFlags에 0x2000(닫히면 죽이기)이 생기면 이 판단을 다시 한다.

### 감시 계약 파일을 공용 작업본에서 저장하면 그 즉시 라이브 감시가 멈추고 유호님께 알림이 간다 (2026-10-20 Claude)
- 증상: 10-20 11:18에 복구 경고 알림을 넣으려고 `tools/hermes-synk/overview.cjs`를 고쳤다. 그러자 다음 회차(11:23)에 AI 없는 감시 `synk-three-flows`가 「SYNK 자동 조회를 잠시 멈췄습니다…」를 텔레그램으로 보내고 멈췄다. 11:13에 다른 세션이 막 재반영해 다시 돌던 감시였다. 10-19 21:07에도 다른 세션이 `plugin/__init__.py`를 고쳐 같은 일이 났고, 그때는 다음 날 11:13 재반영까지 14시간 멈춰 있었다.
- 원인: 설치본(`%LOCALAPPDATA%\hermes\runtime\synk-automation\config.json`)은 저장소 작업본의 계약 파일 23개와 설치된 스크립트의 SHA-256을 고정한다. `automation.py`가 회차마다 이를 대조해서, 하나라도 다르면 `source_contract_changed`로 멈추고 알린다. 감시는 저장소 작업본 경로를 그대로 읽기 때문에, 커밋 여부와 상관없이 파일을 저장하는 순간 어긋난다.
- 고침: 승인을 기다리는 동안 overview.cjs를 고정된 판(HEAD 판, 해시 일치를 확인)으로 되돌려서 11:41부터 감시를 다시 돌렸다. 새 판은 따로 두었다(`.tmp/hermes-recovery-alert-20261020/swap-overview.cjs pinned|new`). 유호님 승인 뒤 새 판을 넣는 일과 `node tools/hermes-synk/install-automation.cjs --apply`(예약 그대로, `--enable` 없음)를 한 명령으로 붙여서 했다(11:59). 계약 파일(`install-automation.cjs`의 originals·shared 목록)을 고칠 때는 새 판을 따로 만들어 시험하고, 넣기와 재반영을 붙여서 한다. 감시가 다시 돌기 시작했다는 알림은 따로 없다.
- 다시 확인: `%LOCALAPPDATA%\hermes\runtime\synk-automation\health.json`의 `status`가 `ok`인지 보고, config.json `files`의 SHA가 각 파일의 `Get-FileHash`와 모두 같은지 본다. `node tools/hermes-synk/install-automation.cjs`(인자 없음)는 미리 보기라 아무것도 바꾸지 않는다. 10-20 재반영 뒤 첫 회차(12:47, 절전에서 깬 직후)는 `ok`였다. 그때 복구 기록은 46분 묵어 있었고, 설계대로 사건을 내지 않았다.

## Codex 예약

### heartbeat RRULE의 시각 해석이 예약 형태마다 달랐다
- 증상: 10-17 새 `COUNT=2` 일간 예약에 `BYHOUR=8,16`을 넣자 첫 명목 실행이 예상한 08:00 KST 대신 17:00 KST였다. 기존 무기한 일간 `synk-sns`는 `BYHOUR=16`일 때 다음 명목 실행이 16:10 KST였고, 시험 삼아 `BYHOUR=7`로 바꾸자 07:10 KST가 됐다.
- 원인: 내부 해석 차이의 원인은 미확정이다. 이 판에서 확인한 `COUNT=2` 일간 예약과 `COUNT=1`·`COUNT=3` 월간 예약의 `BYHOUR`는 UTC로, 기존 무기한 일간 예약의 `BYHOUR`는 한국 시각으로 반영됐다. RRULE 전체에 한 시간대를 가정하면 예약이 어긋난다.
- 고침: 10-18 08:00·16:00 KST의 `COUNT=2` 일간 예약은 `BYHOUR=7,23`, 10-19 10:20·19:20·21:20 KST의 `COUNT=3` 월간 예약은 `BYHOUR=1,10,12`로 저장했다. 기존 무기한 일간 `synk-sns`는 `BYHOUR=16`을 유지하고, 10-18·22 16:00 KST의 일회성 월간 예약 두 개는 `BYHOUR=7`로 고쳤다. 모두 `ACTIVE`와 의도한 다음 명목 실행 시각을 확인했으며 실제 예약 실행은 아직 미검증이다.
- 다시 확인: `~/.codex/sqlite/codex-dev.db`를 SQLite `mode=ro`로 열어 `automations.next_run_nominal_at`(Unix 밀리초)을 UTC+09:00으로 변환해 일정별 의도한 시각과 대조한다. 실제 실행은 `last_run_at`과 `automation_runs`를 따로 본다.

## Codex 세션 기록

### GPT가 끝났는지를 기록 파일의 수정 시각으로 보면 틀린다
- 증상: 10-03 GPT 작업을 기다리던 감시가 「30분 조용함」으로 끝났다. 그런데 GPT는 그 뒤에도 기록을 쓰고 있었고, 2초 뒤에는 파일을 고쳤다.
- 원인: Windows는 열린 핸들로 파일 끝에 덧붙이는 동안 LastWriteTime을 늦게 갱신한다. 그래서 rollout 파일의 수정 시각은 세션이 열려 있는 동안 처음 만든 시각 근처에 멈춰 있다.
- 고침: 기록 파일은 크기 변화와 끝 줄의 `"timestamp"`(UTC)로 본다. 감시 스크립트는 「작업 파일 수정 시각」과 「그 파일을 언급한 기록 줄의 timestamp」 중 늦은 쪽을 기준으로 조용한 시간을 잰다. 처음에는 파일 끝 8MB만 읽고, 그 뒤로는 늘어난 부분만 읽는다. 목표 모드(`<objective>`)가 끝났는지는 부모 rollout의 `update_goal({status:"complete"})` 호출과 마지막 assistant 메시지로 확인한다. 하위 에이전트는 `send_message`의 target `/root`로 부모에게 보고한다. 작업 파일(게임 소스 등)의 수정 시각은 그대로 믿어도 된다.
- 다시 확인: 열려 있는 최신 rollout의 수정 시각과 끝 줄 timestamp를 견준다. 10-17 15:50에는 수정 시각이 14:51인데 끝 줄은 06:50Z(15:50 KST), 크기는 9.4MB였다.

### 작성자를 찾을 때 보관된 GPT 세션을 빠뜨린다
- 증상: 10-08 파일 작성자를 `~/.codex/sessions/2026/10/*`에서만 찾다가 못 찾았다. 그 스레드는 하루 만에 `~/.codex/archived_sessions/`로 옮겨져 있었다(10-04~08 보관 세션 165개).
- 원인: 보관된 세션은 날짜 폴더에서 빠져 `archived_sessions/`로 옮겨진다.
- 고침: `sessions/<연>/<월>/<일>/`와 `archived_sessions/`를 함께 찾는다. 하위 에이전트 세션은 `session_meta.payload.source.subagent.thread_spawn.parent_thread_id`로 부모 스레드에 묶는다. 10-08에 쓴 스레드 묶기 스크립트(`.tmp/atlas-preserve-20261008/codex_attrib2.js` 등)는 새 노트북에 없다.
- 다시 확인: `ls ~/.codex/archived_sessions | wc -l`(10-17 새 노트북 19개).

### 기록에서 한글 경로를 찾으면 놓친다
- 증상: apply_patch 기록에서 경로로 찾으면 한글 경로 파일이 나오지 않는다(10-08).
- 원인: 기록 JSON의 일부 줄은 한글을 `\uXXXX` 꼴로 남긴다.
- 고침: 파일 이름의 ASCII 부분으로 다시 찾거나, 한글을 `\u` 꼴로 바꿔서도 찾고, 찾은 줄은 내용으로 확인한다.
- 다시 확인: `grep -o '\\u[a-dA-D][0-9a-fA-F]\{3\}' <최신 rollout> | wc -l`(10-17 최신 기록에서 263곳).

### 몽골어 검문을 아르곤으로 돌리면 문법 층은 더 잡고 역번역은 고쳐 읽는다
- 증상: 10-18 관용구 퀴즈 #2 몽골어판으로 `GEMINI_MODEL=gemini-4-argon node tools/몽골어대조.js --파일 … --구독`과 기본(gemini-3.8-flash high)을 견줬다. 일부러 문제 셋(맞춤법 Хөхрөтлөө · 뜻이 틀린 зар · 탯줄 뜻인 хүй унах 예문)을 넣은 초안에서 문법 층은 flash 1개, 아르곤 3개를 잡았다(아르곤은 зар의 격 빠짐까지 짚음). 첫 편 승인본은 둘 다 「정상」(헛경보 없음). 최종본은 flash가 일부러 틀리게 보여 주는 오답 딱지(хүй унах?)를 「어색」으로, 아르곤은 「정상」으로 봤다. 대신 역번역에서 flash는 хүй를 「탯줄」로 직역해 어색함이 드러났고, 아르곤은 의도를 짐작해 「배꼽」으로 옮겨 그 문제를 가렸다. 시간은 flash 39~72초, 아르곤 92~106초.
- 원인: 강한 모델이 역번역에서 깨진 문장의 의도를 추론해 「고쳐 읽는」 현상(도구 머리말의 08-05 실측과 같은 뿌리). 문법 채점은 원문 없이 보는 층이라 강한 모델의 어휘·격 지식이 그대로 이득이 된다.
- 고침: 구독 통로 경로표에 `gemini-4-argon`(low·medium·high)을 더했다(`tools/lib/제미나이구독호출.js`, Ultra 계정 agy에서만 됨). 10-18 유호님 「그게 낫겠다」로 `tools/몽골어대조.js`가 `--구독`일 때 **문법 채점은 gemini-4-argon high, 직역 역번역은 flash high**로 나눠 부른다(화면 첫 줄 `모델: … (문법 채점은 gemini-4-argon …)`, 장부에 `문법모델`). `GEMINI_GRAMMAR_MODEL`로 채점 모델을 바꾸고, `GEMINI_MODEL`만 주면 두 층 모두 그 모델(비교용). 무료 API 문은 그대로 한 모델. 같은 날 이 조합으로 몽골어 「배꼽」 낱말을 견줬더니 flash 직역이 хүй를 「탯줄」, хүйс를 「배꼽」으로 옮겨 хүйс를 골랐다.
- 다시 확인: 비교 원자료 `.tmp/argon-mn-compare-20261018/`(A 초안·B 첫 편·C 최종, run.sh). 같은 파일을 두 모델로 돌려 문법 층 지적 수와 역번역의 직역 정도를 견준다.

### 제미나이 검문이 싱할라어 ZWJ를 「빠졌다」고 잘못 짚는다
- 증상: 10-18 `tools/현지어대조.js`로 싱할라어를 두 번 돌렸는데 두 번 다 아르곤이 「ජයග්‍රහණය의 ZWJ가 빠져 결합이 깨졌다」며 「어색」을 냈다.
- 원인: 원문에는 U+200D가 들어 있다(locales.ts·검문 파일 모두 `… dca 200d dbb …`). 모델이 받은 글에서 ZWJ를 못 보는 쪽이다.
- 고침: ZWJ·ZWNJ 지적은 코드 포인트로 먼저 확인하고, 들어 있으면 그 지적만 오판으로 적고 넘어간다. 다른 지적은 그대로 고친다.
- 다시 확인: `node -e`로 해당 낱말의 코드 포인트를 찍어 200d가 있는지 본다.

### 구형 Gemini CLI의 Google 로그인 통로가 지원 종료로 막힌다
- 증상: 10-17 Gemini CLI 0.64.0에서 기존 개인 Google OAuth로 Argon을 명시한 최소 요청 1회가 인증 단계의 `IneligibleTierError`·`UNSUPPORTED_CLIENT`로 끝났다. 모델 `init`·`result`는 없었고 실제 모델 호출은 0회였다.
- 원인: 서버가 Gemini Code Assist 개인용에서 이 클라이언트를 더는 지원하지 않으며 Antigravity 제품군으로 이전하라고 응답했다. 이 오류는 요청한 Argon 모델의 지원 여부를 확인한 결과가 아니다.
- 고침: 막다른 길 — 재시도·모델 대체·유료 API 전환 없이 중단했다. 기존 OAuth 파일이 있다는 것만으로 구형 CLI를 예약 실행 대안으로 쓰지 않는다.
- 다시 확인: 공식 클라이언트 지원·인증 방식을 먼저 확인한다. 이번 검증은 API 키·Vertex 환경값을 제외한 자식 프로세스에서 `GOOGLE_GENAI_USE_GCA=true`·`billing.overageStrategy=never`로 진행했고, 인증 실패 뒤 실행을 반복하지 않았다.

### Linux 서버에 키링 데몬이 없어도 공식 CLI의 파일 저장 경로가 있다
- 증상: 10-18 별도 계정 실행 환경을 준비한 Linux 서버에 D-Bus 실행기는 있지만 GNOME Keyring·Secret Service 데몬은 없었다. 이를 인증 불가로 판단하면 불필요한 데몬 설치가 선행된다.
- 원인: 설치 문서는 기본 키링을 설명하지만 공식 CLI 변경 기록의 1.1.3은 D-Bus 세션이 없는 headless Linux에서 키링을 건너뛰며, 1.1.26은 그때 파일 저장을 사용한다고 명시한다. Windows의 같은 OS 사용자에서 HOME만 바꾸는 방법과는 다르다.
- 고침: 공식 Linux CLI 1.4.0을 별도 OS 사용자·0700 HOME에 설치하고 설정을 0600으로 보존했다. `useG1Credits=false`와 전역 `use_ai_credits` 상속 없음·API `modelProvider` 없음도 확인했다. 공식 OAuth를 완료한 Ultra 별도 사용자에서 새 비대화형 systemd 프로세스의 인증 복원과 Argon 실행까지 확인했다. PC 자격을 복사하거나 바꾸지 않았다.
- 다시 확인: 토큰 값을 출력하지 않고 인증 로그와 실제 timer의 init·result·stderr를 대조한다. 10-18 11:00:28~11:00:41 KST 표식 시험은 `gemini-4-argon-high`·`SUCCESS`·표식 일치·stderr 빈 값이었다(`.tmp/argon-isolated-20261017/ultra-clock-result-20261018.json`). 운영 조사·Docs 저장·전달은 별도 검증 대상이다. SSH 인증 대기는 60초 뒤 종료될 수 있으므로 만료된 OAuth URL 대신 새 URL을 받는다.

### Pro 구독 표시만으로 CLI에서 Argon을 쓸 수 있다고 판단한다
- 증상: 10-18 별도 Pro 계정의 공식 CLI 1.4.0에서 `gemini-4-argon-high`가 `invalid model selection`으로 거절됐다. 실제 사용 가능 목록에 Argon이 없었고 모델 호출은 0회였다. 같은 날 Ultra 별도 계정의 목록에는 Argon low·medium·high가 있었다.
- 원인: 웹 구독 표시와 CLI가 해당 계정에 제공하는 실제 모델 목록을 같은 것으로 가정했다. 이번 관찰만으로 모든 Pro 계정의 지원 여부나 차이의 원인을 일반화할 수는 없다.
- 고침: 실행할 계정으로 `agy models`를 먼저 확인하고 목록의 정확한 slug를 지정한다. 공식 changelog 1.1.2는 print 모드에서 없는 모델을 명시하면 기본 모델로 대체하지 않고 실패하도록 바뀌었다고 설명한다. 다른 모델이나 유료 API로 자동 전환하지 않는다.
- 다시 확인: 동일 사용자 환경의 `agy models` 결과와 실제 timer 출력의 `init.model`을 대조한다. 10-18 Ultra 표식 timer는 `gemini-4-argon-high`로 성공했으며, Pro 계정의 실패를 모델 호출 성공으로 기록하지 않았다.

### systemd stdin은 공식 user event 한 줄로 넘긴다
- 증상: 10-18 공식 CLI를 직접 호출하는 예약은 stdin 파일로 지시를 넘기므로 일반 JSON·채팅 API 형식과 CLI 입력 형식을 구분해야 했다.
- 원인: 공식 `--input-format stream-json`은 한 줄당 `{"event":"user","message":{"content":"지시문"}}`인 NDJSON을 받으며 `--output-format stream-json`과 함께 쓴다. bare `-p`는 오류이고, 값을 붙인 prompt 플래그는 stdin을 건너뛸 수 있다(공식 changelog 1.1.15·1.1.18·1.1.1).
- 고침: JSON 문자열 안의 줄바꿈은 직렬화로 escape하고 파일은 JSON 1행 + LF 1개로 쓴다. 입력 파일 방식에 `-p`를 붙이지 않는다.
- 다시 확인: 10-18 표식 timer와 도구 점검이 이 user event 형식으로 실행됐다. 출력의 `event=init`·`event=result`와 실제 응답을 확인한다. JSON 파일이 존재한다는 것만으로 지시 실행 성공을 판단하지 않는다.

### headless 도구 거절도 종료 코드0과 SUCCESS로 끝날 수 있다
- 증상: 10-18 첫 도구 점검은 권한 거절이 있었지만 종료 코드0·`result.status=SUCCESS`였고 `denied_actions`에 거절이 남았다. 이 첫 결과 파일은 후속 점검으로 덮였으므로 당시 도구 출력에서 확인한 과거 관찰이다.
- 원인: 공식 changelog 1.1.20은 print 모드의 개별 도구 오류·거절을 실행 전체의 치명 오류와 구분한다고 설명한다. 기본 request-review에서 headless는 새 확인을 받을 수 없다.
- 고침: 설치된 공식 CLI의 거절 안내대로 `~/.gemini/antigravity-cli/settings.json`의 **`permissions.allow`**에 검증한 읽기 명령 두 개만 정확히 허용했다. 광범위 자동 승인·skip-permissions는 쓰지 않았다. 공식 builtin automation 문법은 `command(<명령 prefix>)`, `write_file(<절대 경로>)`, `read_url(<도메인>)`이며, 명령 prefix는 뒤 인자까지 허용 범위가 넓어질 수 있으므로 실제 옵션·대상까지 좁힌다. 예전 changelog의 단수 `permission.allow` 문구나 URL 도구명 자체를 설정 키로 복사하지 않는다.
- 다시 확인: 10-18 둘째 점검은 실제 UTC 시각·gws 버전·공식 설치 문서 본문을 읽고 Argon init·SUCCESS·denied_actions 없음·stderr 빈 값을 확인했다(`.tmp/argon-isolated-20261017/ultra-tool-probe-20261018.json`). 이때 전체 URL 형태의 read_url 규칙도 있었지만 그 규칙의 필요성과 정확한 매칭 범위를 분리 시험하지 않았으므로 일반 규칙으로 확정하지 않는다. 종료 코드·status·denied_actions·stderr·실제 도구 출력을 함께 본다.

### 조사 예약의 도메인을 몇 개만 허용하면 공식 연결 문서에서 멈춘다
- 증상: 10-18 실제 synkbrief 조사에서 검색의 Google grounding redirect, 다음 시험에서는 Google AI 개발 문서를 읽다가 headless `read_url` 거절로 응답 없이 끝났다.
- 원인: 출발점 도메인 목록은 새 공식 발표·검색 리디렉션·연결 도움말의 모든 호스트를 포함하지 않는다. 도메인을 한 개씩 더하는 방식은 다음 회차의 새 출처에서 같은 실패가 생길 수 있다.
- 고침: [공식 권한 문서](https://antigravity.google/docs/permissions?tab=cli)에서 `read_url(domain)`은 하위 도메인을 포함하고 `read_url(*)`는 모든 도메인의 **읽기**임을 확인했다. 승인된 공개 조사 범위에 읽기 규칙을 적용하고, 브라우저 조작 `execute_url`·명령 전체 허용은 추가하지 않았다. 명령·문서 쓰기는 지정 경로로 유지하며 인증 폴더·토큰·설정에 대한 에이전트의 `read_file`은 거절했다.
- 다시 확인: 실제 실행의 `denied_actions`와 Docs 저장·재읽기를 함께 본다. 권한 설정 자체는 조사 성공의 증거가 아니다. 규칙 근거와 변경 기록은 `.tmp/argon-isolated-20261017/research-permissions-20261018.json`이다.

### 조사 예약이 작업 파일 읽기·명령 실행 거절로 회차마다 들쭉날쭉 실패한다 (2026-10-19)
- 증상: 서버 예약 전환(10-18 12:12) 뒤 회차 6개 가운데 4개가 `CLI_FAILED_OR_DENIED`로 끝났다. 실패한 넷은 yt-tt 10-18 20:00·10-19 08:00, meta-brand 10-18 23:00, full 10-19 05:00이고, 성공한 둘은 yt-tt 10-18 14:00·meta-brand 17:00이다. synkbrief 10-19 09:00도 성공이다(KST). 실패한 회차의 stderr는 `a tool required the "read_file"`(full·meta-brand·yt-tt)·`"command"`(yt-tt) `permission that headless mode cannot prompt for, so it was auto-denied`였고, stream 끝에는 `view_file`·`run_command` 단계 ERROR 뒤 빈 응답의 `SUCCESS`가 남았다. 결과 문서는 마지막 성공 회차 그대로라 「조사가 안 돌았다」처럼 보인다.
- 원인: 위 절의 고침은 `read_url(*)`만 넓혔다. 모델이 회차마다 스스로 고르는 도구(작업 폴더 파일 보기·명령 실행)는 여전히 허용 목록 밖이라, 그 도구를 고른 회차만 실패한다. 타이머·PC·사용량 한도 문제는 아니다(타이머는 제시각에 돌았다).
- 고침: 10-19 10:48 KST 유호님 승인(「제안한 구성대로 진행해」)으로 두 가지를 함께 넣었다. ① settings `permissions.allow`에 `read_file(/opt/synk-argon-77yuhbs)` 한 줄만 더했다(보조도구 폴더 원문 보기. 인증 폴더·토큰·설정 `read_file` 거절은 그대로). ② 네 지시문 끝에 「[도구 규칙 · 2026-10-19 추가]」를 붙였다(작업 본문은 `snapshot`이 만든 파일만 범위 읽기, 명령은 지정 helper의 snapshot·read·validate·write만, 임시 python·셸 명령 금지). 명령 허용 prefix는 넓히지 않았다. 같은 날 더한 월요일 스캔 역할 셋(scan-lab·scan-ai·scan-platform)도 helper 네 명령만 역할별 정확한 줄로 더했다(12줄). 서버 백업은 `config-backups/20261019T014821Z`(권한·지시문)·`20261019T021946Z-weekly`(역할 셋), 저장소 원문은 `tools/argon-schedules/`(README 「2026-10-19」).
- 다시 확인: 읽기 전용 조회로 본다. `systemctl list-timers`, `run-status/ROLE.json`의 `status`·`error`, `logs/ROLE.stderr.log`의 거절 줄만 걸러 읽는다(로그 전문·인증 정보는 꺼내지 않는다). 읽은 기록은 Claude 세션 scratchpad의 `argon_status_result.json`·`argon_errors_result.json`(10-19 10:36 KST)이다. 고친 뒤 첫 회차 meta-brand 10-19 11:00(KST)은 `complete`·`gemini-4-argon-high`·거절 없음으로 19분 39초에 끝났다(`argon_deploy_result.json`). 새 역할 scan-lab 손 실행(11:21~11:46)도 `complete`·거절 0이었다. stream의 도구 `ERROR`는 거절과 따로 본다. Argon이 자기 `.gemini/antigravity-cli/brain/…/.system_generated/steps/N` 파일을 `view_file`로 다시 열다 낸 `invalid_args`·`ContentOffset … exceeds line range` 오류(scan-lab 4건, yt-tt 14:00 6건)는 회차를 멈추지 않았다. stderr의 `auto-denied` 줄 수는 파일 수정 시각과 함께 본다. 지난 실패 회차 줄이 남아 있을 수 있다. 이어 yt-tt 14:00 정규 회차도 `complete`·거절 0으로 14분 만에 끝났고 결과 문서가 갱신됐다(35,582자·완료 표식). scan-ai·scan-platform 손 실행(14:14~14:54)까지 고친 뒤 다섯 회차가 모두 성공했다. 그래도 모델이 회차마다 고르는 도구가 다 허용 안에 든다는 증거는 아니다. full 다음 날 05:00 회차도 `complete`인지와 결과 문서 갱신을 함께 본다.

### systemd append 로그가 root 소유라 실행 후 검사기가 읽지 못한다
- 증상: 10-18 `StandardOutput=append:`로 처음 생긴 로그가 root 소유0600이라 별도 실행 사용자로 도는 `ExecStopPost`에서 Permission denied가 났다.
- 원인: systemd가 출력 파일을 먼저 열었고 서비스의 User만으로 파일 소유자까지 바뀌지는 않았다. 실행 종료0만 보면 이 후처리 실패를 놓친다.
- 고침: 설치 시 로그8개를 미리 만들고 실제 실행 사용자 소유0600으로 맞췄다. 실행·후처리 중에는 logrotate를 미뤄 같은 파일의 byte offset을 유지한다. Docs 읽기100초와 서비스 후처리30초의 불일치도120초로 맞췄다.
- 다시 확인: 모델·거절·완료 표식·Docs SHA를 검사하는 후처리 시험10개가 통과했다. NO_CHANGE는 실행 전후 SHA가 같아야 하고 완료 표식은 첫 줄을 정확히 대조한다. 실제 서비스의 Result·run-status와 함께 확인한다(`.tmp/argon-isolated-20261017/run-check-test.py`, `delivery-hardening-20261018.json`).

### Docs 저장은 됐는데 긴 명령 출력이 잘려 완료 확인을 못 한다
- 증상: 10-18 Argon이 실제 조사 본문을 Docs에 저장·재읽기까지 끝냈지만, 보조도구가 본문 전체를 JSON 응답에 넣어 CLI 출력이 잘렸다. 모델이 저장 여부를 확인하려고 구현 파일을 읽다가 권한 거절로 끝났다.
- 원인: 독자용 본문과 기계 확인값을 같은 명령 출력으로 보냈다. 프로세스 종료0·SUCCESS만으로 저장 전달까지 완료로 처리할 수 없다.
- 고침: `snapshot ROLE`은 전체 본문을 전용 work 파일에 원자 저장하고 짧은 메타데이터·본문 경로만 반환한다. 모델은 그 파일을 범위 읽기한다. `write` 응답에서는 본문을 빼고 상태·revision·SHA·백업 경로만 반환한다. 내부 검사기의 `read` 계약은 유지했다.
- 다시 확인: 보조도구 시험17개가 통과했다. 큰 Unicode 본문·출력1KiB 미만·충돌·실패 시 이전 파일 보존을 확인하고, 실제 공식 CLI의 `denied_actions` 없음과 완료 표식·Docs 재읽기 SHA를 함께 대조한다. 운영 소스는 `tools/argon-schedules/`에 보존한다.

## Claude Code·공식 CLI 읽기(계정판)

### 파이프로 부른 `claude -p`가 표준입력을 3초 기다리고, 로그인이 없어도 「Not logged in」을 내지 않는다
- 증상: 10-18 계정판이 `claude -p /usage`를 파이프로(표준입력을 열어 둔 채) 부르자 Claude 줄마다 3초씩 늦고 stderr에 `Warning: no stdin data received in 3s, proceeding without it`이 찍혔다. 로그인 없는 `CLAUDE_CONFIG_DIR`에서는 「Not logged in · Please run /login」 대신 `Total cost: $0.0000 …` 비용 요약이 나와, 로그아웃이 「읽기 실패」로 보였다. 터미널에서 직접 돌리면 「Not logged in」이 나와 차이를 놓치기 쉽다.
- 원인: Claude Code 2.1.302는 표준입력이 열린 파이프면 입력을 3초 기다린다. 출력이 파이프일 때는 로그인이 없어도 `/usage`가 비용 요약을 낸다.
- 고침: 넣을 것이 없으면 표준입력을 바로 닫는다(`child.stdin.end()`, 계정판 `rawRun`). 로그인 여부는 `/usage` 글이 아니라 `claude auth status --json`의 `loggedIn`(불리언)으로 본다. 그 값을 못 읽었으면 로그아웃으로 단정하지 않는다.
- 다시 확인: 빈 임시 폴더를 `CLAUDE_CONFIG_DIR`로 주고 Node `spawn`으로 `-p /usage`를 부른다. 표준입력을 열어 두면 3.9초, 닫으면 0.4초이고 둘 다 `Total cost`가 나온다. 같은 폴더의 `auth status --json`은 `"loggedIn": false`다. 로그인된 폴더는 7.4초→4.4초, 출력은 같다.

### 연결이 잠깐 끊기면 공식 CLI가 로그인이 풀린 것처럼 답한다
- 증상: 10-18 13:05 계정판 「지금 확인」에서 1분 사이 GPT(Codex) 줄이 「로그인이 필요해요」, Higgsfield 기본 로그인이 「읽지 못했어요」였다. 2분 뒤 같은 명령을 직접 돌리자 둘 다 그대로 읽혔다(Codex 2.7초). 계정판에서 그 Codex 읽기는 평소의 10배인 31초가 걸렸다.
- 원인: 망 요청(토큰 갱신 등)이 실패하는 동안 Codex app-server `account/read`가 계정 없이 답한 것으로 보인다. 내부 동작은 확인하지 못했다.
- 고침: 「로그인 필요」로 읽혀도 바로 믿지 않는다. 그 서비스의 고정 주소에 HEAD로(로그인 정보 없이) 인터넷이 닿는지 보고, 안 닿으면 연결 문제로 둔다. 닿으면 3초 뒤 한 번 더 읽어 같을 때만 「다시 로그인」으로 둔다(`desktop/src/ai-subscriptions.cjs`의 `readConfirmed`). Typecast는 서버가 401·403으로 분명히 답할 때만이라 바로 알린다.
- 다시 확인: 계정판 시험 「a sign-in that only looks lost for a moment …」. 실제 Claude Code로 로그인 없는 폴더를 읽으면, 인터넷이 닿을 때는 6.5초 뒤 「다시 로그인」이고 확인 주소를 막으면 1.8초 뒤 「인터넷에 연결되지 않아」다.
