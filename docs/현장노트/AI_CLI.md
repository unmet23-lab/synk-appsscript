# 현장 노트 · AI CLI·구독 통로

> 판: Antigravity CLI `agy` 1.3.6(winget) · Gemini API 무료 몫 · `tools/몽골어대조.js`·`tools/lib/제미나이구독호출.js` · Hermes Agent v0.22.2(`%LOCALAPPDATA%\hermes`, 텔레그램 팁 봇 게이트웨이) · Codex 세션 기록(`~/.codex/sessions`·`~/.codex/archived_sessions`)
> 마지막 확인: 2026-10-17(아래 「다시 확인」을 새 노트북에서 돌림)
> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-03~10-17 Claude 메모에서 옮김(10-17 2차)

어느 AI·계정이 무엇을 맡는지는 [AI 운영 원칙 · 역할](../AI_운영원칙.md#역할), 유료 호출 승인은 [비용과 권한](../AI_운영원칙.md#비용과-권한)이 정한다. GPT 그림 굽기의 주간 한도와 계정 돌려쓰기는 [그림 굽기·오리기](그림_굽기_오리기.md#gpt-그림-굽기)에 있다. 여기는 AI CLI·구독 통로·세션 기록이 예상과 다르게 움직인 함정이다. 틀은 [README](README.md)를 따른다.

## Gemini·agy

### 몽골어 검문이 Gemini 무료 API의 429로 막힌다
- 증상: 10-14 LAB TOPIK 몽골어판 검문이 무료 API 몫(gemini-3.8-flash 하루 20회)에 두 번 막혔다. 몫은 09:00 KST에 풀렸지만 풀리자마자 다른 쪽에서 다 썼다.
- 원인: 무료 몫이 하루 20회뿐이라 다른 쪽이 먼저 쓰면 바로 바닥난다. 누가 썼는지는 확인하지 못했다.
- 고침: `node tools/몽골어대조.js --파일 <파일> --구독`을 쓴다. Google AI 구독(agy, `tools/lib/제미나이구독호출.js`)으로 같은 모델을 부르고, API 키나 결제는 쓰지 않는다. 유료(`--돈 --유료-api`)는 어림값을 알리고 승인을 받은 뒤에만 쓴다.
- 다시 확인: `rg -n "'--구독'" tools/몽골어대조.js`(10-17 74행).

### agy가 어느 계정으로 도는지 설정 파일 표시가 틀린다
- 증상: `~/.gemini/google_accounts.json`에 적힌 계정과 agy가 실제로 쓰는 계정이 다르다(10-17).
- 원인: agy 로그인은 Windows 자격 증명(키링)에 있고, 이 파일은 옛 기록이다. 키링에 있으니 `USERPROFILE`을 바꿔도 같은 로그인을 쓴다.
- 고침: 실제 계정은 `~/.gemini/antigravity-cli/cli.log`의 `authenticated successfully as` 줄로 확인한다. `--구독` 통로도 그 계정의 몫을 쓴다. agy에서는 gemini-4-argon-low/medium/high도 고를 수 있다.
- 다시 확인: `grep "authenticated successfully as" ~/.gemini/antigravity-cli/cli.log | tail -1`(10-17 한 줄 있음).

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
- 원인: `config.yaml` model 묶음의 `ollama_num_ctx: 65536`이 로컬 Ollama 모델이 아닌 모델에도 그대로 걸린다.
- 고침: 10-17에 그 줄만 뺐다. 로컬 qwen3.8-64k는 Modelfile의 num_ctx 65536과 `model.context_length: 65536` 상한 때문에 그대로 64K다.
- 다시 확인: 다음 공유를 처리한 뒤 `grep "clamped to Ollama" "$LOCALAPPDATA/hermes/logs/agent.log" | tail -1`의 시각이 10-17 06:23(줄을 빼기 전 마지막)에 머물러 있는지 본다. 10-17 15:50까지는 그 뒤 GPT 판정이 없어 아직 확인하지 못했다.

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
