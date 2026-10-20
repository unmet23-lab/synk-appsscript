# 현장 노트 · AI CLI·구독 통로

> 판: Antigravity CLI `agy` 1.4.2(Windows winget, 10-18 코드 검수 비교에서 확인)·1.4.0(Linux 별도 사용자) · Gemini API 무료 몫 · `tools/몽골어대조.js`·`tools/lib/제미나이구독호출.js` · Hermes Agent v0.22.2(`%LOCALAPPDATA%\hermes`, 텔레그램 팁 봇 게이트웨이) · Codex 세션 기록(`~/.codex/sessions`·`~/.codex/archived_sessions`)
> 마지막 확인: 2026-10-19(조사 예약의 작업 파일 읽기·명령 거절 실패 — 원인 조회·고침·고친 뒤 첫 회차 complete), 2026-10-18(Linux 파일 인증 복원·실제 timer Argon 실행·계정별 모델 목록·headless 도구 권한, 기존 노트북 항목은10-17)
> 쓴 AI: Claude Code·GPT(Codex) — 누가 언제 무엇을 더했는지는 [지난 기록](지난기록/AI_CLI.md#쓴-기록)에 있다.

어느 AI·계정이 무엇을 맡는지는 [AI 운영 원칙 · 역할](../AI_운영원칙.md#역할), 유료 호출 승인은 [비용과 권한](../AI_운영원칙.md#비용과-권한)이 정한다. GPT 그림 굽기의 주간 한도와 계정 돌려쓰기는 [그림 굽기·오리기](그림_굽기_오리기.md#gpt-그림-굽기)에 있다. 여기는 AI CLI·구독 통로·세션 기록이 예상과 다르게 움직인 함정이다. 틀은 [README](README.md)를 따른다.

## 먼저 볼 것

> 도구를 쓰기 전에 여기와 목차만 읽고, 걸리는 절은 `rg -n "^###" docs/현장노트/AI_CLI.md`로 제목을 찾아 그 항목만 읽는다.

- hermes-synk 감시 계약 파일을 공용 작업본에 저장하면 라이브 감시가 멈추고 유호님께 알림이 간다 → 새 판은 따로 두고 넣기와 `install-automation.cjs --apply`를 붙여서 ([자세히](#감시-계약-파일을-공용-작업본에서-저장하면-그-즉시-라이브-감시가-멈추고-유호님께-알림이-간다-2026-10-20-claude))
- 구독 로그인 PC에서 `claude -p`에 API 키를 줘도 구독으로 청구된다 → `node tools/크레딧실행.js`(전용 `CLAUDE_CONFIG_DIR`)로 띄운다 ([자세히](#구독에-로그인된-pc에서-claude--p에-api-키를-줘도-구독으로-청구된다))
- 새 키의 조직에 월 API 크레딧이 없으면 충전 잔액이 나간다 → 큰 작업 전 Console의 크레딧과 조직부터 본다 ([자세히](#새-키의-조직에-월-api-크레딧이-없어-충전-잔액이-나갔다))
- 승인을 번호나 오래된 말로 받으면 자동 모드가 공개 push를 막는다 → 단추 문장에 대상과 행동을 적는다 ([자세히](#번호나-오래된-말로-승인하면-공개-push가-막힌다-2026-10-19-claude))
- Argon 예약이 허용 밖 도구를 고르면 `SUCCESS`여도 회차가 실패한다 → `run-status/<ROLE>.json`의 `denied_actions`를 보고, 새 역할은 허용 줄부터 더한다 ([자세히](#조사-예약이-작업-파일-읽기명령-실행-거절로-회차마다-들쭉날쭉-실패한다-2026-10-19))
- 긴 검수를 `제미나이구독호출.js`로 맡기면 agy가 안 끝나 다 쓴 답을 버린다 → result 사건에서 저장·종료하는 실행기로 돌린다 ([자세히](#긴-검수를-제미나이구독호출js로-맡기면-argon이-답을-다-쓰고도-시간-제한으로-끝난다--agy가-끝나지-않아서-2026-10-19-claude))
- 몽골어 검문은 `--파일 <경로> --구독` 순서로 → 거꾸로 두면 쓰는 법만 찍는다(이 PC는 무료 키가 없어 `--구독` 필수) ([자세히](#몽골어-검문에서---구독을---파일-앞에-두면-쓰는-법만-찍고-끝난다-2026-10-19))
- 헤르메스 게이트웨이를 켠 뒤 깐 패키지는 게이트웨이가 못 쓴다 → `hermes gateway restart` 뒤 폰 대화로 확인한다 ([자세히](#게이트웨이를-켠-뒤에-깔린-패키지는-게이트웨이가-못-쓴다--claude로-바꾼-뒤-텔레그램-공유가-모두-실패했다-2026-10-19-claude))
- 병렬 서브에이전트는 같은 scratchpad를 써서 보조 파일 이름이 겹친다 → 묶음마다 작업 폴더를 정해 주고 결과를 입력과 대조한다 ([자세히](#병렬-서브에이전트가-같은-scratchpad에-같은-이름의-보조-파일을-써서-남의-묶음-글을-읽는다-2026-10-19-claude))
- 수백 KB 검수 자료를 한 번에 넘기면 `SUCCESS`여도 뒷부분이 잘려 0건이 된다 → 나눠 보내고 끝 표식을 확인한다 ([자세히](#큰-검수-자료를-한-번에-넘기면-아르곤이-뒷부분을-못-읽고-0건으로-끝날-수-있다))

## 목차

[Gemini·agy](#geminiagy) · [Claude API](#claude-api) · [Claude Code 자동 모드](#claude-code-자동-모드) · [Claude 앱 세션](#claude-앱-세션) · [Claude 서브에이전트](#claude-서브에이전트) · [Hermes(텔레그램 팁 봇)](#hermes텔레그램-팁-봇) · [Codex 예약](#codex-예약) · [Codex 세션 기록](#codex-세션-기록) · [Claude Code·공식 CLI 읽기(계정판)](#claude-code공식-cli-읽기계정판) · [지난 기록](지난기록/AI_CLI.md)

## Gemini·agy

### 몽골어 검문이 Gemini 무료 API의 429로 막힌다
- 증상: 10-14 LAB TOPIK 몽골어판 검문이 무료 API 몫(gemini-3.8-flash 하루 20회)에 두 번 막혔다. 몫은 09:00 KST에 풀렸지만 풀리자마자 다른 쪽에서 다 썼다.
- 원인: 무료 몫이 하루 20회뿐이라 다른 쪽이 먼저 쓰면 바로 바닥난다. 누가 썼는지는 확인하지 못했다.
- 고침: 10-17부터는 저절로 넘어간다. 무료 문이 429(몫 상한)를 내면 `tools/lib/제미나이호출.js`의 구독대체가 같은 모델·사고 수준으로 Google AI 구독(agy, `tools/lib/제미나이구독호출.js`, 지금 Ultra 계정)을 한 번 부른다. 하루 몫이면 재시도 없이 바로, 분당 몫이면 5·15초 재시도 뒤 넘긴다. 장부 `문`은 `글→구독`, 화면은 「무료 몫 상한 → 구독 문으로 넘김」. 처음부터 구독으로 가려면 `--구독`, 넘기지 않으려면 `--대체없음`. 대량 도구(검수표검문·몽골어출구 `--태우기`·검문커버리지)는 기본이 `--대체없음`이고 `--구독대체`를 줘야 넘긴다. CI·끄기 변수 `SYNK_GEMINI_NO_SUBSCRIPTION_FALLBACK=1`·유료 「돈」 문에서는 넘기지 않는다. 유료(`--돈 --유료-api`)는 어림값을 알리고 승인을 받은 뒤에만 쓴다.
- 다시 확인: `node --test tests/제미나이구독대체.test.js`(10-17 6/6). 실제 넘김은 429를 흉내 낸 호출로 확인했다(10-17 agy 77yuhbs · gemini-3.8-flash-high · 40초).

### 몽골어 검문 묶음이 모두 「--effort is not supported for model "gemini-4-argon-high"」 실행 오류로 끝난다 (2026-10-20 Claude)
- 증상: 10-20 15:35쯤 `tools/몽골어대조.js --파일 … --구독` 세 묶음이 판정 없이 종료 1(8~56초)로 끝났다. 오류는 「실행 오류: 구독 통로 실패(종료 2) — … agy 종료 1: error: invalid model selection (--model "gemini-4-argon-high" --effort "high"): --effort is not supported for model "gemini-4-argon-high"」. 10분 전 같은 도구·같은 계정 호출은 문법 층까지 돌았다.
- 원인: 확실하지 않다. agy(WinGet 1.4.3, 실행 파일은 13:39 그대로)는 부를 때 모델 목록을 서버에서 받는다(`agy models`의 「Fetching available models...」). 그때 받은 모델 설정이 잠깐 아르곤 이름 + `--effort` 조합을 거절한 것으로 보인다 — 6분 뒤에는 같은 조합이 됐다.
- 고침: 도구(`tools/lib/제미나이구독호출.js`, `--model gemini-4-argon-high --effort high`)는 그대로 두고 몇 분 뒤 같은 묶음을 다시 돌렸다. 실행 오류(종료 1)는 판정이 아니므로 검문 기록에 「어색」·「정상」으로 적지 않는다. 계속 거절되면 이름에 수준이 이미 들어 있으니 `--effort`를 빼는 쪽부터 agy 도움말로 본다.
- 다시 확인: 빈 임시 폴더에서 `agy --input-format stream-json --output-format stream-json --model gemini-4-argon-high --effort high --print-timeout 90s --sandbox --disable-slash-commands`에 `{"event":"user","message":{"content":"…"}}` 한 줄을 보내 종료 0·결과 SUCCESS인지(10-20 15:43: 14초 성공, `--effort` 없이 16초, flash-high 10초).

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

### 긴 검수를 `제미나이구독호출.js`로 맡기면 Argon이 답을 다 쓰고도 시간 제한으로 끝난다 — agy가 끝나지 않아서 (2026-10-19 Claude)
- 증상: 10-19 재도전 사업계획서 심문·검수(34~70KB, 지적마다 바꿀 문장까지 요구)를 `--model gemini-4-argon`으로 여섯 번 보냈는데(high·medium·low, 10~30분 제한) 모두 `확인 불가: … agy 실행 실패: spawnSync agy ETIMEDOUT`(종료 2)·결과 파일 없음으로 끝났다. 짧은 질문은 같은 크기 입력에도 12~13초에 답했다.
- 원인: 실패 직후 복사한 `~/.gemini/antigravity-cli/cli.log`(`.tmp/restart-hwp-20261019/v9/아르곤_cli_v9.log`)에서 18:47 요청 → 18:50 「Print mode: stream input closed after 1 turn(s)」·「Stream goroutine exited」로 **답은 3분 만에 끝났는데 agy 프로세스가 19:07까지 종료하지 않았다**. 그때 `main()`은 `spawnSync`로 프로세스 종료를 기다린 뒤에야 stdout을 읽어서, 시간 제한에 걸려 이미 받은 답(result 사건)까지 버렸다. 짧은 호출에서는 agy가 바로 끝나 드러나지 않았다. 정상으로 끝나는 회차는 「Stream goroutine exited」 바로 뒤 「Waiting for migrations to complete…」를 남기고 1초 안에 끝나는데, 멈춘 회차에는 그 줄이 없다. 멈춘 회차는 agy 1.4.2(10-18 14:53부터 쓰는 판)에서만 나왔다 — 10-10~10-19 실행 기록 354개 중 8개, 모두 아르곤이고 7개는 답에 2분 50초 넘게 걸린 회차였다. 같은 판의 4분·8분짜리 회차도 정상으로 끝난 적이 있어 agy 안쪽 원인은 모른다. `cli.log`는 실행마다 덮어써지지만 같은 폴더 `log/cli-<시작 시각>.log`에 회차별 사본이 남는다.
- 고침: `tools/lib/제미나이구독호출.js`의 `main()`을 비동기로 바꿨다(`agy받기`). stdout을 줄마다 읽다 `result` 사건이 오면 바로 같은 모양의 기록을 `-o`에 쓰고, agy가 5초 안에 스스로 끝나지 않으면 프로세스 묶음을 닫는다(Windows `taskkill /T /F`, 그 밖은 프로세스 그룹 SIGKILL). 닫은 회차는 stderr에 「참고: agy가 결과를 낸 뒤 5초 안에 끝나지 않아 프로세스 묶음을 닫았다.」가 남는다. 시간 제한(`--timeout` + 30초)·결과 없이 끝남·SUCCESS 아님은 전처럼 종료 2다. `부르기`가 이 손잡이를 자식으로 띄우므로 무료 몫 구독 대체·`몽골어대조.js --구독`·`현지어대조.js`도 같이 고쳐졌다. 임시 실행기 `.tmp/restart-hwp-20261019/agy_once.cjs`는 더 쓰지 않는다.
- 다시 확인: `node --test tests/제미나이구독호출.test.js` — 결과를 낸 뒤 손주 프로세스와 함께 버티는 가짜 agy(`SYNK_AGY_BIN`에 .js)에서 답을 받고 6초 안에 끝나며 agy·손주가 모두 닫힌다(10-19 7/7, 옛 spawnSync 판은 45초를 넘겨 실패). 실제로는 10-19 아르곤 high 짧은 질문이 14.2초에 SUCCESS(agy가 스스로 끝남), 같은 v9 검수(34KB, 제한 20분)는 243초에 SUCCESS·10,282자를 저장한 뒤 agy가 또 끝나지 않아 묶음을 닫고 249초에 끝났다. agy 판이 바뀌면 stderr의 「참고:」 줄이 아직 나오는지로 멈춤이 남았는지 본다.

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

### 큰 검수 자료를 한 번에 넘기면 아르곤이 뒷부분을 못 읽고 0건으로 끝날 수 있다
- 증상: 10-18 공식 CLI 1.4.2에 실제 코드 묶음 745,066바이트를 stdin user event 하나로 전달했다. 응답은 SUCCESS였지만 coverage에 `<truncated 553485 bytes>`와 B·C 사례 미열람을 명시했다. 이 0건은 검수 통과가 아니다.
- 원인: 큰 단일 입력의 전달·문맥 구성 중 잘림이 발생했다. 어느 내부 단계의 한도인지는 확정하지 않았으며 모델의 100만 토큰 창과 같은 한도로 보지 않는다.
- 고침: 16,000바이트씩 47개 파일로 나누자 전부 읽었지만, 다음 문맥 압축에서 `Compaction failed`가 반복돼 그 실행도 제외했다. 최종 비교는 세 커밋을 네 기능 묶음으로 나눠 변경 전·후 코드와 필요한 보조 자료를 각각 69~168KB의 같은 stdin 입력으로 두 모델에 준다. 마지막 표식을 실제로 확인한 실행만 채점한다.
- 다시 확인: `.tmp/review-compare-20261018/v3/manifest.json`·`run-audit.json`에서 두 모델의 입력 SHA·종료 표식·도구 사용 없음·완료 상태를 확인한다. `v2/`에는 47개 읽기 뒤의 압축 실패를 보존하며, 미열람·중단과 검수 결과 0건을 구분한다.

### 아르곤 high로 계산 코드 검수를 보내면 답 없이 끝나고, medium은 몇 분 만에 끝난다
- 증상: 10-18 BM 계산 모델 검수에서 `tools/lib/제미나이구독호출.js --model gemini-4-argon --thinking high`로 보낸 코드 묶음(88KB)이 45분 제한까지 답이 없어 `spawnSync agy ETIMEDOUT`으로 끝났다. 같은 시각 같은 크기(88KB)의 사업 문서 묶음은 high로 5분 만에 SUCCESS였다. 코드 묶음을 고친 판(94KB)으로 high와 medium을 함께 다시 보내자 medium은 약 4분 만에 SUCCESS(11,274자), high는 약 7분 뒤 `agy 상태 ERROR: The stream was interrupted`로 끝났다.
- 원인: 확인하지 못했다. 코드가 많은 입력에서 high 사고가 길어지는 것과 같은 계정으로 두 실행을 함께 돌린 것 중 무엇이 원인인지 가르지 않았다.
- 고침: 계산 코드 검수는 medium으로 먼저 보내고(결과표를 쓰는 출력 부분은 묶음에서 빼서 줄임), high는 시간 여유가 있을 때 따로 한 번만 보낸다. 제한 시간은 `--timeout`(ms)이 agy `--print-timeout`과 함께 정해지므로 답이 없을 때 끝까지 기다리게 된다.
- 다시 확인: 같은 묶음을 high로 혼자 보냈을 때 끝나는지, 끝나는 데 몇 분 걸리는지 잰다. 기록은 세션 임시 폴더의 `argon_review_code2_medium.json`(SUCCESS)과 작업 출력의 오류 줄이다.

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

### 회사 DB를 읽기 전용으로 받아도 펼쳐 보는 단계가 「Production Reads」로 막히고, 같은 세션의 저장소 grep까지 막힌다 (2026-10-20 Claude)
- 증상: 10-20 다른 세션이 맡긴 게시 성과 칸 대조에서, 헤르메스 회사 SNS 점검과 같은 고정 서버 신원(`tools/server-backup/read-status.cjs`의 노드·호스트 키, `mode=ro`·`query_only`·ROLLBACK)으로 `postPerformanceEntries`를 받아 scratchpad 파일에 쓰는 스크립트는 돌았다. 그 파일을 요약해 펼치는 `node -e`가 「Production Reads」로 거절됐고, 바로 뒤 저장소 문서를 `grep -A`로 읽는 Bash까지 같은 이유로 거절됐다. Grep·Read 도구는 됐다.
- 원인: 기본 soft_deny 「Production Reads」는 운영 자료를 대화로 가져오는 일을 사용자 메시지의 명시 승인 없이는 막는다. 세션을 띄운 다른 세션의 지시문은 사용자 승인으로 치지 않는 것으로 보인다. 뒤 Bash 거절은 앞 호출의 맥락으로 판정한 것으로 보인다(추정).
- 고침: 우회하지 않았다. 받은 파일은 열지 않고 지우고, 코드와 저장소에 남은 운영 실측(게시 결과 문서의 작업실 관측 값)으로 할 수 있는 데까지 했다. 운영 값을 읽어야 하면 정해진 길인 작업실 화면(로그인된 브라우저의 GET)으로 읽거나, 유호님께 「회사 DB의 게시 성과 관측 기록을 읽기 전용으로 읽기」처럼 대상과 행동을 적은 단추로 여쭌다.
- 다시 확인: 유호님이 대상을 이름 댄 승인 뒤 같은 읽기의 요약이 통과하는지 본다.

## Claude 앱 세션

### 스스로 보관한 세션이 부모 세션에는 「끝나기 전에 사용자가 보관했다」로 온다 (2026-10-20 Claude)
- 증상: 10-20 오후 부모 세션에 「master 맞추기 도구를 tools/로 옮기고 시험 붙이기 … was archived by the user before it finished; it will not report」 알림이 왔다. 일이 중간에 끊긴 것처럼 읽혔지만, 그 세션은 origin 올리기(`855e68eaa`)·공용 master 반영·트랙과 노트 정리까지 마치고 스스로 보관했다. 마지막 보고는 부모 세션에 오지 않았다.
- 원인: 10-20 확정 규칙(AGENTS.md)대로 마지막 메시지와 함께 `archive_session`(`self`)을 부르면 보관이 그 차례가 끝나기 전에 일어난다. 앱은 이것을 「끝나기 전 사용자 보관」으로 알리고, 보관된 세션의 마지막 보고는 넘기지 않는 것으로 보인다(추정).
- 고침: 이 알림만 보고 일이 끊겼다고 판단하거나 그 일을 다시 시작하지 않는다. `mcp__ccd_session_mgmt__list_events`로 그 세션의 마지막 메시지를 읽고(보관된 세션도 읽힌다), 거기 적힌 커밋이 origin에 들어갔는지 `git merge-base --is-ancestor <커밋> origin/master`로 확인한 뒤 유호님께 알린다.
- 다시 확인: 다음에 띄운 세션이 스스로 보관하면, 부모 세션의 알림 문구와 `list_events` 마지막 메시지(보관 호출 뒤에 쓴 보고)를 대조한다.

## Claude 서브에이전트

### 병렬 서브에이전트가 같은 scratchpad에 같은 이름의 보조 파일을 써서 남의 묶음 글을 읽는다 (2026-10-19 Claude)
- 증상: 공모전 593건을 8묶음으로 나눠 general-purpose 서브에이전트 8개에 동시에 맡겼더니, 한 에이전트가 자기 묶음을 찍으려고 만든 `show.js`에서 다른 묶음(chunk_3) 항목이 나왔다고 보고했다. 같은 때 다른 묶음 몇 개는 30분 넘게 판정 파일을 한 번도 저장하지 않았다.
- 원인: 서브에이전트는 부모 세션의 scratchpad 폴더를 같이 쓴다. 각자 `show.js`·`merge.js`·`parts\`처럼 흔한 이름으로 보조 파일을 만들어 서로 덮어썼다. 저장이 늦은 묶음이 이 덮어쓰기 때문인지는 확인하지 못했다.
- 고침: 맡길 때 보조 파일 폴더를 묶음마다 정해 준다(예: `scratchpad\chunk3_work\`). 판정은 입력 파일의 그 id 본문으로만 하라고 적는다. 이미 돌고 있으면 SendMessage로 같은 내용을 보낸다(받는 쪽의 다음 도구 호출 때 전달된다).
- 다시 확인: 병렬 프롬프트마다 작업 폴더가 다르게 적혀 있는지, 결과 id 집합이 입력 묶음 id 집합과 같은지 대조한다(`.tmp/contests-20261019/build_page.py`의 `chunk_ids`·`verd` 비교).

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
- 10-20 덧붙임(Claude): 다른 작업본에서 고쳐 커밋만 한 계약 파일(`tools/server-backup/read-status.cjs`, `4017c1c92` 13:53)은 감시 고정(13:50) 뒤 16:01 `master맞추기` 병합으로 공용 작업본에 들어온 순간 어긋났다. 병합은 그 파일을 CRLF로 다시 썼고, 고정 해시는 13:53 전 판이었다. 다음 회차 전(16:05:36)에 `node tools/hermes-synk/install-automation.cjs --apply`(예약 그대로)로 다시 잡아 16:06 회차는 `ok`로 넘겼고 알림은 나가지 않았다. 계약 파일을 고친 커밋이 공용 작업본에 들어오는 때(병합 직후)에 다시 잡아야 한다. 병합 뒤 계약 해시를 대조해 다시 잡는 일은 아직 `master맞추기.js`에 넣지 않았다.

### 복구 작업이 멈춘 것과 PC 절전은 `os.uptime`으로 가르지 못한다 — 감시 회차가 끊김 없이 이어진 시간을 깨어 있던 증거로 쓴다 (2026-10-20 Claude)
- 증상: 복구 예약 작업(`SYNK_Hermes_Gateway_Recovery`)이 꺼지거나 저장소의 `recover-gateway.ps1`에 구문 오류가 나면 복구 기록(`synk-gateway-recovery-status.json`)이 더는 쓰이지 않는다. 감시는 15분 넘은 기록을 절전으로 보고 사건에서 빼므로, 이런 멈춤은 `/synk_today`에 「기록이 오래됨」으로만 보이고 아무도 몰랐다(10-20 Fable 검수 P3).
- 원인: 절전과 멈춤이 둘 다 「기록이 오래됨」으로 똑같이 보인다. PC 백업 감시가 쓰는 `os.uptime()`(overview.cjs `backupSnapshot`의 monitorStale)은 절전 시간까지 세어서, 켠 직후는 걸러도 절전에서 깬 직후는 거르지 못한다. Hermes cron의 `every 5m`은 분 단위 틱이라 실제로는 약 6분 간격으로 돌았고(10-20 07:48~11:59 `cron/output/<작업>/` 파일 시각), 절전 동안에는 한 번도 돌지 않았다(11:59→12:47). 이 PC는 S3 절전(Modern Standby 아님)이라 절전 중에는 게이트웨이와 작업 스케줄러가 함께 멈춘다.
- 고침: 감시가 회차마다 `state.json`에 `awakeSince`를 남긴다. 앞 회차와 15분 안으로 이어진 시작 시각이다. `overview.cjs`는 이 값을 읽어, 30분 넘게 이어 도는 동안 복구 기록이 한 번도 새로 쓰이지 않았으면(기록이 아예 없어도) `gateway-recovery-task` 사건으로 한 번 알린다. 새로 쓰였는지는 기록 안의 점검 시각과 파일 수정 시각 가운데 늦은 쪽으로 본다. 그래서 내용을 잠깐 못 읽었다고 거짓 알림이 나가지 않는다. 기록이 다시 쓰이면 풀리고, 절전에서 깬 직후처럼 아직 가를 수 없을 때는 사건을 빼서 판단을 그대로 둔다. 어긋남 알림(`gateway-recovery`)과 사건을 따로 둬서, 작업을 다시 켰을 때 이미 알린 어긋남을 또 보내지 않는다. 계약 파일이라 새 판은 저장소에 저장하지 않고 `.tmp/hermes-recovery-stop-20261020/hook.cjs`로 불러 시험했다. 이 파일은 시험 때만 `NODE_OPTIONS=--require`로 걸어, 새 판이 들어 있는 사본을 저장소 경로 대신 불러온다. 유호님 「진행」 뒤 `apply.cjs --run`이 감시 회차가 끝나기를 기다렸다가 넣기와 `install-automation.cjs --apply`(예약 그대로, `--enable` 없음)를 붙여서 했다(13:50). 실패하면 고정 판으로 되돌리게 해 두었다.
- 다시 확인: `node --test tests/hermes-synk-overview.test.cjs tests/hermes-synk-monitor.test.cjs`(라이브 판에서는 새 시험 4개가 실패하는 것도 봤다). 라이브에서는 `%LOCALAPPDATA%\hermes\runtime\synk-automation\state.json`의 `awakeSince`가 회차마다 그대로 이어지는지 본다(10-20 재반영 뒤 13:53·13:59 회차 모두 `ok`, `awakeSince`가 13:53으로 이어짐, 새 알림 없음). 작업을 실제로 꺼서 알림이 나가는지는 시험하지 않았다(유호님께 알림이 간다). 대신 임시 헤르메스 폴더에서 새 `monitor.cjs`를 main으로 띄워(`smoke-monitor.cjs`), 40분 깨어 있고 기록이 없을 때 알림이 1건 나오는 것을 봤다. 게이트웨이를 관리자 권한으로 띄우면 작업이 모듈을 못 읽어 기록을 남기지 않으므로, 이때는 30분 뒤 거짓 「멈춤」이 날 수 있다(실행 복구 README ④).

### 헤르메스는 플러그인을 별도 프로세스에서 돌린다 — 훅 인자는 Record·대역으로 오고, 실제 코드를 밖에서 부르려면 패키지 세대 경로가 필요하다 (2026-10-20 Claude)
- 증상: 텔레그램 이어 가기의 답장 가로채기(`pre_gateway_dispatch`)를 운영에서 확인하려는데, `hermes plugins show synk-work`가 「runs in the plugin host (plugins.isolation: host)」였다. 헤르메스 코드에는 이 훅이 호스트에서는 게이트웨이·세션 저장소를 대역으로 받는다고 적혀 있다(`hermes_cli/plugin_isolation.py`의 HOST_DEGRADED_HOOKS). 확인 스크립트를 헤르메스 파이썬으로 돌리니 `from gateway.config import Platform`에서 `No module named 'ruamel'`로 멈췄다.
- 원인: 호스트 모드에서는 훅 인자가 JSON으로 건너간다(`hermes_cli/plugin_host_wire.py`). 데이터클래스(MessageEvent·SessionSource)는 dict에 속성 읽기를 더한 Record가 되고, 열거형(Platform)은 값 글자(`"telegram"`)가 된다. 게이트웨이·세션 저장소처럼 살아 있는 객체는 속성을 읽으면 오류를 내는 Opaque가 된다. 호스트 쪽 `ctx`는 헤르메스가 알려 준 공개 메서드를 그대로 넘긴다. 그래서 `hasattr(ctx, "register_hook")`도 같은 답을 하고, 등록은 헤르메스 쪽의 진짜 PluginContext에서 다시 돌아 보통 등록과 같아진다. 헤르메스 파이썬(`tools/python-3.14.7…`)에는 패키지가 없다. 게이트웨이는 설치 세대(`installs/<id>/pm-runtime/generations/<세대>/Lib/site-packages` 또는 `environments/<세대>/venv`)에서 패키지를 읽는다.
- 고침: 훅은 인자를 `getattr(…, None)`으로만 읽고 게이트웨이·세션 저장소는 쓰지 않는다(synk-work 1.4.0 `_approval_dispatch`). 실제 헤르메스 코드로 확인할 때는 헤르메스 파이썬을 `PYTHONPATH="<hermes-agent>;<가장 최근 pm-runtime 세대의 Lib/site-packages>"`로 띄운다. 유호님 계정에서 오는 텔레그램 메시지는 이 PC에서 만들 수 없다. 텔레그램 PC 앱은 새 노트북에서 로그인 기록(`%APPDATA%\Telegram Desktop\tdata`)이 없고, 헤르메스의 메시지 주입은 플러그인이 내부 차례를 넣는 용도뿐이다(`inject_gateway_message`). 그래서 운영 확인은 코덱 점검까지로 하고, 마지막 한 칸은 처음 실제로 막혀 답장할 때 본다.
- 다시 확인: `.tmp/tg-approval-20261019/host_wire_check.py`는 실제 MessageEvent를 `encode`→JSON→`decode`해 설치본 플러그인에 넣는다(10-20 「기대와 같음」). `hermes plugins doctor synk-work`는 등록 통과(도구 1·훅 1)를 보여 준다. 시험은 플러그인 시험의 `test_plugin_host_records_are_intercepted_like_in_process_events`다.

### Hermes 반복 조회에서 보낸 기록이 새 보고를 가린다
- 증상: 10-18 세 흐름 연결 시험에서 발송 기록이 100개 넘으면 새 아침 보고가 큐에서 빠질 수 있었다. 자정에 받은 원격 자료를 아침 보고에 다시 쓸 수도 있었다.
- 원인: 파일명 정렬 뒤 개수 제한을 먼저 적용했고, 원격 갱신을 날짜 변경으로만 판단했다.
- 고침: 발송 시도 claim이 없는 초안만 생성 시각순으로 읽는다. 원격 자료는 한 시간마다, 아침 보고 직전에도 갱신한다. 발송 결과가 불명확하면 재전송하지 않는다. 잠금이 10분 넘게 남으면 정상으로 표시하지 않고 한 번 알린다.
- 현재 정책: 10-18 추가 요청 이후 아침 요약은 껐고 판단·조치 필요 사건만 알린다. 기존 정보성 초안은 보존하면서 발송을 억제하며 원격 자료의 시간당 조회는 유지한다.
- 다시 확인: `tests/hermes-synk-monitor.test.cjs`의 과거 발송 120건+새 보고, 동시 수집·재시작·변화 없는 날 시험과 `tests/hermes-synk-automation.test.py`의 동시 발송·불명확한 응답 시험. 공식 예약은 `--no-agent`·5분 하나이고 예약 엔진의 별도 실패 전송은 `local`로 두어 현재 수신자 허용 검사를 거친 전송만 쓴다.

### Hermes의 저장소 Python을 그대로 부르면 설치된 의존성을 못 찾는다
- 증상: 공식 관리 Python으로 스크립트를 직접 부르면 `ModuleNotFoundError: dotenv`가 났다. 공식 `hermes cron run`에서는 같은 스크립트가 성공했다.
- 원인: 이 Windows 설치는 의존성 경로를 공식 실행기가 구성한다. 저장소 Python 파일 하나만 실행하는 것은 같은 실행 환경이 아니다.
- 고침: 운영 검증은 공식 cron의 `--no-agent` 경로로 한다. 일시중지 예약의 `cron run`은 성공 실행이 아니라 활성화 안내만 반환하므로 실제 `last_status`와 수집 `health.json`을 확인한다.
- 다시 확인: 10-18 `synk-three-flows`의 17:00 공식 수동 실행과 17:10 첫 자동 실행 모두 `last_status=ok`, `health.json status=ok/noAgent=true`. 자동 실행이 보낸 점검 알림의 Telegram API 수신 확인과 발송 기록 재처리의 새 전송 0회를 대조했다.

## Codex 예약

### heartbeat RRULE의 시각 해석이 예약 형태마다 달랐다
- 증상: 10-17 새 `COUNT=2` 일간 예약에 `BYHOUR=8,16`을 넣자 첫 명목 실행이 예상한 08:00 KST 대신 17:00 KST였다. 기존 무기한 일간 `synk-sns`는 `BYHOUR=16`일 때 다음 명목 실행이 16:10 KST였고, 시험 삼아 `BYHOUR=7`로 바꾸자 07:10 KST가 됐다.
- 원인: 내부 해석 차이의 원인은 미확정이다. 이 판에서 확인한 `COUNT=2` 일간 예약과 `COUNT=1`·`COUNT=3` 월간 예약의 `BYHOUR`는 UTC로, 기존 무기한 일간 예약의 `BYHOUR`는 한국 시각으로 반영됐다. RRULE 전체에 한 시간대를 가정하면 예약이 어긋난다.
- 고침: 10-18 08:00·16:00 KST의 `COUNT=2` 일간 예약은 `BYHOUR=7,23`, 10-19 10:20·19:20·21:20 KST의 `COUNT=3` 월간 예약은 `BYHOUR=1,10,12`로 저장했다. 기존 무기한 일간 `synk-sns`는 `BYHOUR=16`을 유지하고, 10-18·22 16:00 KST의 일회성 월간 예약 두 개는 `BYHOUR=7`로 고쳤다. 모두 `ACTIVE`와 의도한 다음 명목 실행 시각을 확인했으며 실제 예약 실행은 아직 미검증이다.
- 다시 확인: `~/.codex/sqlite/codex-dev.db`를 SQLite `mode=ro`로 열어 `automations.next_run_nominal_at`(Unix 밀리초)을 UTC+09:00으로 변환해 일정별 의도한 시각과 대조한다. 실제 실행은 `last_run_at`과 `automation_runs`를 따로 본다.

### Windows의 하위 Codex 읽기 전용 실행이 파일 읽기도 정책으로 거절한다
- 증상: 10-18 `codex exec --sandbox read-only`의 읽기 전용 `type`·`Get-Content`가 모두 `blocked by policy`였고 자료를 읽지 못했다. 최종 findings는 비었지만 coverage는 검수 미실시라고 밝혔다.
- 원인: 해당 하위 CLI 실행의 셸 정책이 명령 실행을 거절했다. 샌드박스나 권한을 완화하지 않았으며 정책 내부의 정확한 이유는 미확정이다.
- 고침: 권한을 바꾸지 않고 파일 접근이 필요 없는 stdin 전달을 쓴다. 최종 비교의 두 모델 모두 같은 네 묶음을 이 방식으로 받고, 접근 실패·큰 입력 잘림·압축 실패 실행은 점수에서 제외한다.
- 다시 확인: 같은 비교의 `v2/runs/gpt/final.txt`·stderr와 `v3/run-audit.json`을 대조한다. 자료를 못 읽은 실행을 버그 0건으로 채점하지 않는다.

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

### 문서 저장까지 끝낸 회차가 마지막 모델 API 끊김으로 `CLI_FAILED_OR_DENIED` 실패가 된다 (2026-10-20 Claude)
- 증상: 위 고침 뒤에도 yt-tt 10-19 20:00·10-20 08:00, meta-brand 10-19 23:00(KST)이 실패 메일을 냈다. 거절된 도구는 0개였고, stream 끝 `result`의 status는 `ERROR`, error는 「The stream was interrupted. Please continue the task you were working on.」·「API error (attempt 2): request failed: stream idle timeout (5m0s): context deadline exceeded」였다. 한 회차는 응답 첫 줄이 ` Cui`이고 완료 표식이 둘째 줄이었다.
- 원인: Argon이 조사·validate·Docs 쓰기·재읽기와 완료 표식(문서 SHA)까지 낸 뒤 모델 API 스트림이 끊겨, 공식 CLI가 결과 status를 `ERROR`로 남겼다(종료 코드는 0). 끊겼다 이어진 흐름의 조각이 표식 앞줄에 붙기도 한다. `run-check.py`는 status가 `SUCCESS`가 아니면 문서를 보지 않고 실패로 쳤다. 세 회차 모두 표식 SHA가 다음 회차 시작 때(마지막 회차는 지금) 읽은 문서 SHA와 같아, 문서는 실제로 갱신돼 있었다. 끊김 자체는 모델 API 쪽 일이라 서버에서 막지 못한다.
- 고침: 거절이 하나라도 있으면 그대로 실패다. status가 `ERROR`여도 완료 표식(이때만 처음 세 줄 안)이 있고 Docs를 다시 읽은 SHA가 표식과 같으면 `complete`로 치고, 상태 파일에 `cliStatus`·`cliError`, 회차 영수증에 `cliStatus`만 남긴다. 「변경 없음」 표식이나 표식 없는 `ERROR`는 실패다. `SUCCESS` 회차의 「표식은 첫 줄」 규칙은 그대로 뒀다(`f5d67fd1f`, 서버 반영 10-20 13:32 KST, README 「2026-10-20」).
- 다시 확인: 실패 회차가 진짜 미전달인지는 그 역할 다음 회차 영수증(`run-status/history/ROLE-*.json`)의 `baselineSha256`과, 그 회차 stream 끝 `result.response`의 표식 SHA를 대조해 본다. 로그는 매일 회전하니 하루 지난 회차는 `logs/ROLE.stream.jsonl.1`에 있고, 영수증의 `offset`은 그 파일 기준이다(회차 시작 시각이 `.1` 파일의 수정 시각보다 이르면 `.1`). 읽기 도구는 `.tmp/standby-backup-fix-20261020/read-argon-delivery.cjs`, 오프라인 시험은 `python3 tools/argon-schedules/run-check-test.py` 17개(이 PC와 서버 python 양쪽 통과). full 10-20 05:00·meta-brand 11:00은 고치기 전 판에서도 `complete`였다.

## Claude Code·공식 CLI 읽기(계정판)

### 데스크톱 앱 계정과 `~/.claude` 로그인 파일의 계정이 다르다 (2026-10-20 Claude)
- 증상: 앱 세션의 `get_usage`는 주간 99%였는데 계정판(`~/.ai-accounts/read-usage.mjs`)의 Claude는 27%로 떴다. 기본 로그인 `~/.claude/.credentials.json`을 읽어 홈 `~/.claude.json`의 이메일을 붙이자, 다른 계정의 27%가 앱 계정 이름으로 찍혔다.
- 원인: 데스크톱 앱은 이 로그인 파일을 쓰지 않는다. 앱 안에 따로 로그인해 두고, 세션의 API 요청을 앱 쪽 통로(`ANTHROPIC_BASE_URL`)로 보낸다. 세션에는 `CLAUDE_CODE_USER_EMAIL`·`CLAUDE_CODE_ACCOUNT_UUID`만 오고 `CLAUDE_CODE_OAUTH_TOKEN`은 없다. 홈 `~/.claude.json`의 oauthAccount는 앱 계정을 따라가고, `~/.claude/.credentials.json`은 터미널 `claude` 로그인이라 둘이 다른 계정일 수 있다(10-20에는 서로 다른 Max 계정이었다).
- 고침: 로그인 파일의 계정은 설정 파일이 아니라 토큰으로 묻는다(`/api/oauth/profile`, `anthropic-beta: oauth-2025-04-20`, 토큰은 출력하지 않는다). 앱 계정의 한도는 세션 안에서 `mcp__ccd_session_mgmt__get_usage`로 보고, 밖에서 읽으려면 그 계정으로 `CLAUDE_CONFIG_DIR=<폴더> claude auth login`을 한 번 해 둔 폴더를 쓴다. 계정판은 기본 로그인을 profile로 확인해 읽고, 앱 계정을 어느 폴더도 못 읽으면 `claude-app` 「못 읽음」 줄을 띄운다.
- 다시 확인: `node ~/.ai-accounts/read-usage.mjs --only=claude`의 `folder: "claude"` 줄 이메일이 터미널 `claude auth status`의 계정과 같고, 세션의 `echo $CLAUDE_CODE_USER_EMAIL`과는 다를 수 있다.
