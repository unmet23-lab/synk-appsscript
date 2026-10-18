# 현장 노트 · AI CLI·구독 통로

> 판: Antigravity CLI `agy` 1.3.6(winget) · Gemini API 무료 몫 · `tools/몽골어대조.js`·`tools/lib/제미나이구독호출.js` · Hermes Agent v0.22.2(`%LOCALAPPDATA%\hermes`, 텔레그램 팁 봇 게이트웨이) · Codex 세션 기록(`~/.codex/sessions`·`~/.codex/archived_sessions`)
> 마지막 확인: 2026-10-17(아래 「다시 확인」을 새 노트북에서 돌림)
> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-03~10-17 Claude 메모에서 옮김(10-17 2차) · GPT(Codex) 10-17 예약 시각 해석 확인 추가 · GPT(Codex) 10-18 Argon 예약·Docs·장애 알림 확인

어느 AI·계정이 무엇을 맡는지는 [AI 운영 원칙 · 역할](../AI_운영원칙.md#역할), 유료 호출 승인은 [비용과 권한](../AI_운영원칙.md#비용과-권한)이 정한다. GPT 그림 굽기의 주간 한도와 계정 돌려쓰기는 [그림 굽기·오리기](그림_굽기_오리기.md#gpt-그림-굽기)에 있다. 여기는 AI CLI·구독 통로·세션 기록이 예상과 다르게 움직인 함정이다. 틀은 [README](README.md)를 따른다.

## Gemini·agy

### 몽골어 검문이 Gemini 무료 API의 429로 막힌다
- 증상: 10-14 LAB TOPIK 몽골어판 검문이 무료 API 몫(gemini-3.8-flash 하루 20회)에 두 번 막혔다. 몫은 09:00 KST에 풀렸지만 풀리자마자 다른 쪽에서 다 썼다.
- 원인: 무료 몫이 하루 20회뿐이라 다른 쪽이 먼저 쓰면 바로 바닥난다. 누가 썼는지는 확인하지 못했다.
- 고침: `node tools/몽골어대조.js --파일 <파일> --구독`을 쓴다. Google AI 구독(agy, `tools/lib/제미나이구독호출.js`)으로 같은 모델을 부르고, API 키나 결제는 쓰지 않는다. 유료(`--돈 --유료-api`)는 어림값을 알리고 승인을 받은 뒤에만 쓴다.
- 다시 확인: `rg -n "'--구독'" tools/몽골어대조.js`(10-17 74행).

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

### 아르곤에게 블렌더 실행까지 맡기면 Claude Code가 막는다
- 증상: Claude Code(자동 모드)에서 `agy -p … --dangerously-skip-permissions`로 아르곤이 블렌더를 직접 실행·반복하게 하려 하자 「Create Unsafe Agents」로 거절됐다(10-17 펠트 찻집 실험).
- 원인: 다른 에이전트에게 모든 도구 권한을 자동 승인으로 넘기는 실행이라 Claude Code 안전 장치가 막는다.
- 고침: 도구 없이 스크립트만 받는다 — `agy -p "<지시>" --model gemini-4-argon-high --disable-slash-commands --print-timeout 15m`, 답의 ```python 블록을 꺼내 위험 호출(지우기·네트워크·외부 실행)을 훑은 뒤 `blender -b --python build.py -- out.png scene.blend`로 내가 렌더한다. 고칠 점·오류는 `-c`(이어 하기)로 돌려준다. 답 하나에 3~5분, 1,300~1,700줄. 실행까지 맡기려면 유호님이 Antigravity 앱에서 직접 한다. 기록 `.tmp/argon-blender-20261017/notes.md`.
- 다시 확인: `agy models | grep argon`(10-17 low/medium/high 셋).

### 몽골어 검문이 문제없이 끝나도 종료 코드가 2다
- 증상: 검문이 끝나고 종료 코드 2가 나온다. 「■ 종합」 줄에는 「공식 앱 뜻 검토 대기」가 적혀 있다.
- 원인: `tools/몽골어대조.js`는 기계 검문 통과면 0, 실패면 1, 나머지는 모두 2로 끝난다. 뜻 대조가 돌지 않았으면 「뜻 검토 대기」로 남아 2가 된다.
- 고침: 판정은 「■ 종합」 사유 줄로 한다. 뜻은 원문과 역번역 한국어를 줄마다 직접 견준다. 맞춤법 층은 해시태그 붙여쓰기(`#солонгосхэл`)와 한국 이름(`Минсү`)을 늘 의심으로 낸다. 이런 것은 오타가 아니라고 보고하고, 게시 여부는 유호님께 묻는다.
- 다시 확인: `rg -n "exitCode = " tools/몽골어대조.js`(10-17 497행 `실패 ? 1 : (통과 ? 0 : 2)`).

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
