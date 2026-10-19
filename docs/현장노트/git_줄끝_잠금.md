# 현장 노트 · git 줄끝·잠금·공용 작업본

> 판: Git for Windows 2.55 · 시스템 설정 `core.autocrlf=true` · 공용 `.git/config`에 `diff.autoRefreshIndex=false`(10-13)·`extensions.worktreeConfig=true` · 등록된 훅 없음
> 마지막 확인: 2026-10-19(`tools/내커밋.js` 시험·워크트리 잠금 경로; 그 밖의 항목은 각 다시 확인 날짜 참조)
> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-02~10-17 Claude 메모에서 옮김 · 클라우드 세션(리눅스) 10-17 더함 · Claude Code(Claude Opus 5.5) 10-18 결정 표 행 다시 쌓기 · Claude Code 10-19 공용 인덱스 reset 빠뜨림 재발 추가 · Claude Code 10-19 커밋·push 절차를 `tools/내커밋.js`로 옮김·워크트리 잠금 경로 추가

SYNK-appsscript 메인 작업본은 Claude 세션 여럿과 GPT가 같은 폴더·같은 git 인덱스를 함께 쓴다. 여기서 git을 쓸 때 남의 작업을 되돌리거나 내 커밋이 사라진 함정이다. 틀은 [README](README.md)를 따른다.

## 절차 · 공용 작업본에서 내 것만 커밋하기

공용 인덱스(`git add` → `git commit`)로 커밋하지 않는다. 다른 세션이 올려 둔 스테이징이 내 커밋에 섞이고, 반대로 내 스테이징이 남의 커밋에 섞인다. 커밋과 push는 [`tools/내커밋.js`](../../tools/내커밋.js)로 한다(10-19). 두 명령 모두 기본은 미리 보기이고 `--실행`을 붙여야 반영한다.

- `node tools/내커밋.js 커밋 <경로…> -m "<메시지>"` — 아래 손 절차 1~6을 한 번에 한다. 바탕 고정 → 별도 인덱스 → 지정 경로만 → 줄끝을 바탕 판에 맞춤 → 저장 용량 검사 → `commit-tree` → `update-ref` CAS → 공용 인덱스의 그 경로만 reset 순서다. reset을 못 하면 가지를 되돌린다. index.lock은 기다렸다 다시 하고 주인 없는 잠금만 한 번 치운다. 줄끝을 맞추고 나니 바탕과 같으면 커밋하지 않는다(「커밋할 것 없음」).
- 남도 고치는 문서(AGENTS.md·CLAUDE.md·DESIGN.md·트랙·결정·문서 지도·AI 운영원칙·현장 노트·만족사례 장부)는 통째로 올리지 않는다. 미리 보기가 바탕 대비 조각을 id와 함께 보여 주면 내 것만 `--조각 <경로>=<id>[,<id>…]`로 고른다. 조각 안 일부 줄은 `<id>:<줄>-<줄>`(미리 보기가 조각의 줄 번호를 모두 보인다), 바뀐 곳이 모두 내 것이면 `=전부`다. 남의 줄은 작업본에 그대로 남는다.
- 폴더 경로는 그 아래 남의 미커밋 수정·새 파일까지 올리므로, `--폴더` 없이는 그 아래 바뀐 파일 목록만 보이고 멈춘다. 내 파일만 하나씩 주거나, 모두 내 것일 때만 `--폴더`를 붙인다. 하위 git 저장소(gitlink)가 섞이면 멈춘다.
- 「공용 인덱스에 내 경로의 다른 스테이징이 있다」로 멈추면 아무것도 바뀌지 않았다. 남이 올린 것이면 그 세션과 맞추고, 내가 전에 `git add`한 판이면 `git reset -q -- <경로>`로 내린 뒤 다시 한다.
- `node tools/내커밋.js 올리기 <커밋…>` — 아래 「로컬 master를 통째로 push하면 남의 미푸시 커밋이 같이 나간다」의 절차를 한다. `--합치기`는 올린 뒤 로컬 가지에 「트리는 로컬 그대로」 병합 커밋을 더한다. origin에 있는 남의 커밋이 바꾼 경로가 모두 로컬과 같고, 다시 쌓으며 줄끝을 맞춘 경로가 없을 때만 한다.
- `--줄끝그대로`(커밋·올리기)는 줄끝을 일부러 바꾸는 커밋(재정규화)에만 쓴다. 없으면 바탕·원격 판 줄끝으로 되돌려, 줄끝만 바꾼 커밋은 「커밋할 것 없음」·「올릴 것 없음」이 된다.
- git 2.31 이상(커밋)·2.43 이상(올리기, `merge-file --object-id`)이 필요하다. 모자라면 도구가 멈춘다(10-19 이 PC 2.55).
- 시험: `node --test tests/내커밋.test.js`. 임시 저장소에서 남의 스테이징·미커밋·미푸시, CAS 경합, index.lock, 줄끝 섞인 파일, 용량 초과, 폴더·하위 저장소, 재현(명령줄 처음부터 끝까지)을 잰다. 도구를 일부러 망가뜨린 29가지(reset 빠뜨림·CAS 없음·공용 문서 막기 없음·새는 줄 검사 없음 등)를 모두 잡는다(10-19). `tools/참고카드_커밋.js`는 카드 폴더만 커밋하는 좁은 판이다.

손 절차(도구를 못 쓸 때. 도구도 같은 일을 한다):

1. `BASE=$(git rev-parse HEAD)`를 먼저 잡는다. 내용은 반드시 이 BASE에서 만든다.
2. `export GIT_INDEX_FILE=<임시>/x.index; git read-tree $BASE`로 별도 인덱스를 만든다.
3. 별도 인덱스에 올린다.
   - 내 파일: 추적 여부부터 본다(`git cat-file -e $BASE:<경로>`). 그다음 `git add -- <경로>`.
   - 남도 고치는 문서(AGENTS.md·결정·트랙·문서 지도 등): `git cat-file blob $BASE:<경로>`를 버퍼 그대로(줄 끝을 자르지 않고) 받아 내 줄만 더한 파일을 만든다. `git hash-object -w --no-filters <파일>`로 blob을 만들고(내용이 이미 LF라 바이트 그대로. `--no-filters`와 `--path=`는 같이 쓸 수 없다 — git 2.55가 「Can't use --path with --no-filters」로 거절, 10-17) `git update-index --cacheinfo 100644,<blob>,<경로>`로 올린다.
4. `git write-tree` → `git commit-tree <트리> -p $BASE -F <메시지 파일>` → `git update-ref -m <설명> refs/heads/master <새 커밋> $BASE`. 그사이 HEAD가 움직였으면 update-ref가 실패하고 아무것도 바뀌지 않는다 — 1부터 다시 한다.
5. 곧바로 `unset GIT_INDEX_FILE; git reset -q -- <내 경로들>`로 공용 인덱스의 그 경로만 새 HEAD에 맞춘다. 막히면 미루지 않는다(아래 「커밋 뒤 공용 인덱스」).
6. 확인: `git diff --cached --name-only`에 내 경로가 없고, `git diff --stat $BASE <새 커밋>`의 줄 수가 내가 바꾼 양과 같다.

도구 밖에서 커밋하면 `npm run check:storage`(별도 인덱스면 같은 `GIT_INDEX_FILE`과 `-- --base $BASE`)도 직접 돌린다.

### GitHub deploy key의 응답에는 공개키 주석이 없다 (2026-10-18)
- 증상: 읽기 전용 CI 키를 등록한 뒤 공개키 원문 전체를 대조하자 검증에 실패했다. 첫 키를 회수하고 임시 개인키 파일을 삭제한 뒤 원인을 확인했다.
- 원인: `ssh-keygen`의 `.pub`에는 끝 주석이 있지만 GitHub API의 `key`는 알고리즘과 키 재료만 반환한다. 주석 차이는 키 불일치가 아니다.
- 고침: 알고리즘·키 재료 두 필드를 대조하고 키 ID·제목·`read_only=true`를 별도로 확인한다. 개인키는 암호화된 Actions secret에 표준입력으로 등록하며 로그나 저장소에 넣지 않는다.
- 다시 확인: Talk 전용 키 등록에서 키 재료·제목·읽기 권한 대조가 통과했다. API 응답의 주석 부재와 임시 개인키 파일 삭제도 확인했다. 실제 CI 결과는 [백엔드 검증 기록](../_ops/qa/backend-upgrade-20261018/result.json)의 `integration.ciSkipAudit`를 본다.

### `worktree --no-checkout` 뒤 희소 경로만 설정하면 인덱스가 비어 있다 (2026-10-18)
- 증상: 새 공개 작업본에 sparse-checkout 경로를 설정했지만 `status`가 기존 파일 전체의 스테이징 삭제를 표시했다.
- 원인: `--no-checkout`으로 만든 비어 있는 인덱스에 HEAD를 읽지 않은 상태였다. 파일을 실제로 지운 결과가 아니었다.
- 고침: 이 작업에서 새로 만든 빈 전용 작업본임을 확인한 뒤 `git read-tree --reset -u HEAD`로 HEAD와 희소 범위를 구체화했다. 공용 작업본이나 변경이 있는 폴더에는 이 복구를 쓰지 않는다.
- 다시 확인: 공개 전 status가 비어 있고, `b45319c`의 변경 범위와 실제 공개 응답86개가 검토한 목록과 일치했다.

### 일부 경로만 꺼낸 사본에서 `git stash`를 쓰면 고친 파일이 stash에 갇힌다 (2026-10-19)
- 증상: `clone --no-checkout` 뒤 `git checkout <rev> -- site-v10 qa …`로 꺼낸 사본에서 기준 판 시험을 돌리려고 `git stash` → `git stash pop`을 했더니 「The stash entry is kept」로 끝나고, 고친 원고가 모두 원래 판으로 돌아가 있었다.
- 원인: 꺼내지 않은 나머지 경로가 인덱스에 「지움」으로 잡혀 있어 stash가 그것까지 담았고, 되돌릴 때 충돌했다.
- 고침: `git checkout 'stash@{0}' -- <고친 파일들>`로 되살린 뒤 `git stash drop`. 이런 사본에서는 stash를 쓰지 않고 기준 판을 따로 꺼낸다(`git archive <rev> <경로> | tar -x -C basesrc`).
- 다시 확인: 고친 파일마다 이번 작업의 표시 문자열이 `grep`으로 나오고, 빌드 결과가 되살리기 전과 같은 해시다.

## 줄끝(CRLF·LF)

### 서버 복사 원본인 systemd 단위는 끝 빈 줄 때문에 `--check`에 걸린다 (2026-10-19)
- 증상: 10-19 Argon 월요일 수집 단위 6개(`tools/argon-schedules/production-units/synk-argon-ultra-scan-*.service·timer`)를 별도 인덱스로 올리자 `git diff --cached --check`가 모두 `new blank line at EOF`로 멈췄다.
- 원인: 이 폴더의 단위는 10-18 커밋 판부터 파일 끝이 빈 줄로 끝나고(`tail -c 3`이 줄바꿈 셋), 서버 `/etc/systemd/system/`에 깔린 판의 복사 원본이다. 새 단위도 같은 꼴로 만들어 서버에 깔았다.
- 고침: 바이트를 고치면 저장소 판이 서버 판과 달라지므로 손대지 않았다. 커밋 스크립트에서 그 폴더 단위 파일의 「EOF 빈 줄」만 허용하고 다른 공백 오류는 그대로 막았다. 검사를 통째로 끄지 않는다.
- 다시 확인: 커밋 `557316313` 뒤 `git status --porcelain -- tools/argon-schedules`가 비어 있고(단위 blob = 작업본 바이트), 같은 커밋의 docs-io.py·run-check.py·alert-event.py·docs.json sha256이 서버 기록과 같다.

### 공용 문서 하나가 줄끝만 바뀌어 통째로 diff가 된다
- 증상: `git diff HEAD`가 트랙 87줄 전부 바뀐 것으로 나온다(내용은 몇 줄만 바뀜). 파이썬으로 고친 LF 파일(`KidsQuestion.tsx` 226줄)이 통째로 CRLF가 된다.
- 원인: 다른 도구가 작업본을 CRLF↔LF로 뒤집어 두었고, 「작업본 줄끝을 따르는」 스크립트가 그대로 이어 썼다. `sed -i`는 CRLF를 LF로, 파이썬 `open(p, 'w')`(text 모드)는 Windows에서 LF를 CRLF로 바꾼다. 한 파일 안에 CRLF 줄과 LF 줄이 섞여 있기도 하다(10-08 트랙 202줄 중 14줄 LF).
- 고침: 공용 문서를 쓰기 전후에 HEAD와 CR 개수를 견주고, 다르면 내용은 두고 줄끝만 HEAD 형식으로 되돌린다. 파이썬은 읽기·쓰기 모두 `newline=''`로 연다. 줄을 끼울 때는 `\n`으로 나누고 `\r`을 뗀 값으로 찾되, 넣는 줄은 이웃 줄의 `\r` 유무를 따른다. 남의 줄의 줄끝은 고치지 않는다.
- 다시 확인: `tr -cd '\r' < <파일> | wc -c`와 `git show HEAD:<파일> | tr -cd '\r' | wc -c`가 같고, `git diff HEAD --stat -- <파일>`이 실제로 바꾼 줄 수와 같다.

### CR 개수를 `grep -c $'\r'`로 세면 모든 줄이 나온다
- 증상: LF뿐인 파일에서도 `grep -c $'\r' AGENTS.md`가 줄 수(21)를 그대로 낸다.
- 원인: Git Bash의 grep이 CR 한 글자짜리 패턴을 빈 패턴처럼 다룬다(`grep -c ''`과 같은 수가 나온다). 더 깊은 까닭은 캐지 않았다.
- 고침: `tr -cd '\r' < <파일> | wc -c`로 센다.
- 다시 확인: LF 파일에서 `grep -c $'\r'`이 줄 수, `tr -cd '\r' | wc -c`가 0이다(10-17 재현, CR 한 줄 + LF 한 줄 파일에서도 grep은 2, tr은 1).

### 파이썬이 git에 넘긴 입력 끝에 `\r`이 붙는다
- 증상: `git update-ref --stdin`이 「extra input」으로 거절한다. `Path.write_text`로 쓴 `objects/info/alternates`에서 「object directory …? does not exist」가 난다(10-17).
- 원인: `subprocess.run(..., text=True, input=s)`와 `write_text`가 Windows에서 `\n`을 `\r\n`으로 바꿔 보낸다.
- 고침: git 입력과 git이 읽는 파일은 바이트로 넘긴다(`input=s.encode()`, `write_bytes`).
- 다시 확인: 넘긴 바이트를 파일로 떠서 `tr -cd '\r' | wc -c`가 0인지 본다.

### `.gitattributes`에 `eol=lf`를 넣어도 작업본의 CRLF 파일이 안 바뀐다
- 증상: 해시·바이트를 대조하는 시험이 빨개진다(10-08 `atlas/personalization.js` CRLF 435개 → 런처 사본 해시 시험 실패). `git checkout HEAD -- <파일>`을 해도 그대로다.
- 원인: autocrlf=true 작업본에서 새 `eol` 속성은 파일이 다시 쓰일 때만 적용된다. checkout은 정규화한 뒤 같다고 보고 다시 쓰지 않는다.
- 고침: 파일을 지운 뒤 `git checkout HEAD -- <파일>`로 다시 받는다.
- 다시 확인: `tr -cd '\r' < <파일> | wc -c`가 0이고 그 시험이 통과한다.

### 내용이 HEAD와 같은데 `git status`에 M이 남는다
- 증상: `git apply -R`로 HEAD 내용에 되돌린 파일이 `git diff`·`git hash-object`로는 HEAD와 같은데 `git status`·`update-index --refresh`에는 「needs update」(M)로 남는다(10-14).
- 원인: autocrlf가 CRLF로 다시 써서 작업본 크기가 인덱스에 적힌 크기(LF)와 다르다. 크기가 다르면 git은 내용을 다시 재지 않고 바뀐 것으로 본다.
- 고침: `git show HEAD:<파일> > <임시> && mv <임시> <파일>`로 HEAD 바이트 그대로 쓴다. `git add`로 맞추면 공용 인덱스를 건드린다.
- 다시 확인: `git ls-files --debug -- <파일>`의 size와 작업본 파일 크기가 같고 status가 깨끗하다.

### `git archive`로 꺼낸 파일이 CRLF로 풀린다
- 증상: 공개본(LF)과 견주면 모든 줄이 다르게 나온다. 커밋 판을 꺼내 빌드한 결과가 공개본과 바이트로 안 맞는다.
- 원인: 이 PC의 `core.autocrlf=true`가 archive에도 적용된다.
- 고침: `git -c core.autocrlf=false archive <커밋> -- <경로들> | tar -x -C <폴더>`. 차이만 볼 때는 `diff --strip-trailing-cr`도 된다.
- 다시 확인: 꺼낸 파일의 `tr -cd '\r' | wc -c`가 blob(`git cat-file blob <커밋>:<경로> | tr -cd '\r' | wc -c`)과 같다.

### 워크트리에서 만든 묶음의 지도 판(map_ver)이 바뀐다
- 증상: 워크트리에서 `node tools/build-game-learning.js`를 돌리자 묶음의 `map_ver`와 Strata 원본 sha256이 바뀐다(내용은 같음). 옮겨 쓴 `atlas-learning.js`가 메인 `--check`에서 「Learning source differs」로 실패한다(10-03).
- 원인: 워크트리 체크아웃이 `strata/*.json`을 CRLF로 꺼내 바이트 해시가 달라졌다. 옮기기 스크립트도 CRLF로 썼다. 생성기는 LF로 쓰고 바이트로 비교한다.
- 고침: 워크트리에서 묶기 전에 메인의 Strata 원본을 바이트 그대로 복사한다. 메인에 옮긴 뒤에는 묶음을 복사하지 말고 메인에서 생성기를 다시 돌린다. 지도 판은 학습 기록에 들어가므로 묶음 diff에 `map_ver`가 보이면 멈춘다.
- 다시 확인: 메인에서 `node tools/build-game-learning.js --check`가 모두 verified다.

### 워크트리 안에서 쓴 git config가 공용 설정에 들어간다
- 증상: 워크트리를 LF로 받으려고 `git config core.autocrlf false`를 썼더니 메인 작업본의 CRLF 파일이 전부 바뀐 것처럼 보인다(10-03, 6분간 모든 세션에 영향).
- 원인: 연결 워크트리에서 범위 없이 쓴 값은 메인과 같이 쓰는 `.git/config`에 들어간다.
- 고침: 워크트리는 `git -c core.autocrlf=false worktree add …`로 만들고, 계속 필요한 값은 `git -C <워크트리> config --worktree <키> <값>`으로 쓴다.
- 다시 확인: 메인에서 `git config --show-origin --get-all core.autocrlf`가 시스템 gitconfig의 `true` 하나뿐이다.

### 3방향 착지 스크립트가 그림을 글자로 다루면 줄끝을 바꿔 깨뜨린다
- 증상: 10-18 계정판 착지 미리 계산에서 새 jpg 두 장이 「줄 0→783 · CR 0→1470」으로 나왔다. 그대로 썼다면 그림 두 장이 깨졌다.
- 원인: 경로마다 `git show`를 utf8 글자로 읽고 「새 파일은 CRLF」 규칙으로 `\n`을 `\r\n`으로 바꾸는 착지 스크립트(공용 작업본 3방향 착지)가 바이너리를 가리지 않았다.
- 고침: 그림·글꼴·소리(`.jpg·png·webp·gif·woff2·ttf·mp3·mp4·wav`)는 `git show`의 바이트를 그대로 쓰고, 작업본에 다른 판이 있으면 충돌로 멈춘다. 쓰기 전에 합친 결과를 폴더로 꺼내 작업본과 diff해 내 줄만 더해졌는지 본다.
- 다시 확인: 착지 뒤 `cmp <(git show master:<그림>) <그림>`이 같다(10-18 두 장 통과).

### `tools/결정.js --추가`가 CRLF 결정 표에 LF 줄을 넣는다
- 증상: 결정을 넣은 뒤 git이 「LF will be replaced by CRLF」를 경고했고, 결정 표에서 LF만인 줄이 1개였다(10-18).
- 원인: 도구가 새 표 줄을 `\n`으로 끼운다. 작업본(`core.autocrlf true`)은 CRLF라 그 한 줄만 줄끝이 섞인다.
- 고침: 넣은 뒤 파일 전체를 CRLF로 맞춘다(`t.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')`를 임시 파일 → rename). 도구 자체를 고치는 건 따로 할 일이다.
- 다시 확인: `(t.match(/(^|[^\r])\n/g)||[]).length`가 0이다.

## index.lock

### 주인 없는 0바이트 `.git/index.lock`이 남는다
- 증상: `git add`·`git reset`·커밋 직후 공용 인덱스 맞추기가 「index.lock exists」로 막힌다. 잠금 파일은 0바이트인데 git 프로세스는 없다(10-02 하루에만 다섯 번, 10-06에는 7시간 남아 공용 인덱스가 커밋 전 판인 채로 있었다).
- 원인: 10-10 감시·재현으로 찾았다. 공용 작업본에 GPT 대화가 붙어 있으면 Codex 데스크톱이 검토 요약용 `git diff <merge-base> --raw --numstat`를 돌린다. 이 diff는 끝에 인덱스를 새로 고치며 잠금을 잡고(`diff.autoRefreshIndex` 기본값), 파일이 바뀌면 Codex가 `taskkill /t /f`로 늦게 죽여 0바이트 잠금이 남는다. `GIT_OPTIONAL_LOCKS=0`·`--no-optional-locks`는 `git status`에만 듣고 diff의 새로 고침은 못 막는다. 근거는 `.tmp/index-lock-20261010/`.
- 고침: 10-13 유호님 승인으로 공용 `.git/config`에 `diff.autoRefreshIndex=false`를 넣었다(재현에서 잠금 0/5). 그래도 생긴 잠금은 `node tools/git잠금.js`로 판별하고, 주인이 없을 때만 `--정리`로 지운다(0바이트 · 10초 넘음 · 잠금보다 먼저 시작한 git 프로세스 없음일 때만, 프로세스 목록을 못 읽으면 안 지움). 잠금보다 뒤에 시작한 git은 주인이 될 수 없다(잠금은 O_EXCL로 만든다). 되돌리기는 `git config --unset diff.autoRefreshIndex`. 주인 판정은 `git.exe` 프로세스만 센다 — 지금 이 PC에서 git을 부르는 Claude·Codex 앱은 git CLI를 쓰지만, libgit2 계열 클라이언트(GitKraken 등)를 들이면 이 판정을 다시 본다.
- 다시 확인: `git config --show-origin --get diff.autoRefreshIndex`가 `.git/config`의 `false`이고, `node tools/git잠금.js`가 「잠금 없음」이다(10-17). 새 잠금이 또 생기면 다른 원인이니 `.tmp/index-lock-20261010/`의 감시 도구로 다시 본다.

### 잠금이 저절로 풀리기도 해서 손으로 다시 돌리면 헛걸음한다
- 증상: 0바이트 잠금이 2분 안팎에 풀렸다가 사람 손으로 다시 돌리는 사이 새 잠금이 생긴다(10-03 두 번). 「잠금 없는 순간 기다리기」 고리가 남은 주인 없는 잠금 앞에서 10분 동안 헛돈다.
- 원인: Claude·Codex 앱이 변경 보기용으로 git을 수시로 돌려 잠금이 짧게 자주 생긴다(15분 감시에 30번, 각 0.5~2초).
- 고침: 한 스크립트 안에서 ① 지금 HEAD로 별도 인덱스 ② 0.2초 간격으로 잠금 없는 순간 기다리기(그사이 HEAD가 바뀌면 ①부터) ③ 곧바로 write-tree → commit-tree → update-ref ④ `git reset -q -- <내 경로>`를 성공할 때까지 다시 시도. 고리 안에서 잠금이 10초 넘게 그대로면 `node tools/git잠금.js --정리`를 한 번 부른다. 재시도 오류를 `2>/dev/null`로 버리지 말고 찍는다. 10-19부터 `tools/내커밋.js 커밋`이 이 고리를 그대로 한다(커밋 전 20초·reset 30초까지 기다림, ④가 끝내 안 되면 가지를 되돌림).
- 다시 확인: 고리가 끝난 뒤 `git diff --cached --name-only`가 비어 있다. 아니면 크게 알린다.

### 연결 워크트리에서 `tools/git잠금.js`가 있을 수 없는 잠금 경로를 본다
- 증상: 10-19 `tools/내커밋.js`를 워크트리에서 시험하며 보니, `살피기()`가 `<워크트리>/.git/index.lock`을 봤다. 워크트리의 `.git`은 파일이라 그 경로에는 잠금이 생길 수 없어, 잠금이 있어도 늘 「잠금 없음」이 나올 판이었다(이것 때문에 난 사고는 확인하지 못했다).
- 원인: 잠금 경로를 `<저장소>/.git/index.lock`으로 박아 두었다. 연결 워크트리의 인덱스는 `<공용 .git>/worktrees/<이름>/index`다.
- 고침: `.git`이 폴더가 아니면 `git rev-parse --path-format=absolute --git-path index.lock`으로 묻는다(`tools/git잠금.js`의 `잠금경로`). 부르는 쪽이 경로를 알면 `살피기(저장소, { 잠금 })`로 넘긴다.
- 다시 확인: 워크트리에서 `node tools/git잠금.js --json`의 `잠금`이 `.git/worktrees/<이름>/index.lock`이다(10-19 확인, 옛 판은 `<워크트리>/.git/index.lock`).

## 커밋과 공용 인덱스

### 커밋 뒤 공용 인덱스를 안 맞추면 다음 남의 커밋이 내 커밋을 되돌린다
- 증상: 별도 인덱스로 커밋한 직후 `git status`에 방금 커밋한 파일이 「삭제·되돌림」으로 올라와 있다(공용 인덱스가 옛 판, 「MM」). 이때 다른 세션이 공용 인덱스로 커밋하면 내 커밋의 파일이 지워진다(10-02).
- 원인: 별도 인덱스 커밋은 공용 인덱스를 건드리지 않는다. 공용 인덱스는 옛 HEAD 판을 스테이징한 채로 남는다.
- 고침: 위 절차 5를 커밋과 같은 스크립트 안에서 곧바로 한다. 잠금에 막히면 판별·정리 뒤 바로 다시 한다.
- 다시 확인: `git diff --cached --name-only`에 내 경로가 없다.
- 10-19 재발: 손으로 짠 커밋 스크립트가 `commit-tree`까지만 하고 `update-ref`는 따로 돌려서 5단계가 빠졌다. 계정판 코드·문서 16경로가 1시간 남짓(10:50~12:06) 「MM」·「D 」로 남았고, 새 파일 셋은 작업본에서 「??」로 보였다. 그사이 다른 세션 커밋 넷이 들어왔지만 이 경로를 되돌린 것은 없었다. reset 전에 `git ls-files -s`의 blob이 내 커밋 부모 판과 같은지(남이 올린 스테이징이 아닌지) 경로마다 대조하고 `git reset -q -- <경로들>`로 맞췄다. 그 뒤로 커밋은 손 스크립트 대신 `tools/내커밋.js 커밋`으로 한다. `update-ref`와 reset을 한 몸으로 하고, reset 전에 같은 대조(공용 인덱스가 바탕 판이나 내 판일 때만)를 한다.

### 미리 만든 「HEAD 판 + 내 줄」을 나중에 커밋하면 남의 줄이 옛 판으로 돌아간다
- 증상: 트랙의 「HEAD+내 줄」 파일을 만들어 두고 25분 뒤 커밋했더니 그사이 들어온 다른 세션 커밋 셋의 줄 다섯이 사라졌다(10-03 `44b49d06d`).
- 원인: update-ref의 BASE 확인은 「커밋 직전에 HEAD가 바뀌었나」만 막는다. 내용이 옛 HEAD 기준이라는 것은 못 막는다. 내용을 앞선 HEAD에서 만들고 부모는 그 뒤의 커밋으로 잡아도 같은 일이 난다.
- 고침: 만들기와 커밋을 한 스크립트에서 바로 잇는다. 미리 만든 파일을 써야 하면 만든 커밋(rev)을 적어 두고, 커밋할 때 그 경로 blob이 rev와 다르면 `git merge-file <새 HEAD 판> <rev 판> <내 파일>`로 합치고 충돌이면 멈춘다. 내가 쓴 줄도 통째로 갈아 쓰기 전에 지금 HEAD의 그 줄과 견준다(남이 사실을 덧붙였을 수 있다).
- 다시 확인: `git diff <부모> <새 커밋> -- <경로>`에 내 줄만 있다.

### `git show` 출력을 trim하면 파일 끝 줄바꿈이 잘린 채 커밋된다
- 증상: diff 끝에 「No newline at end of file」(10-09 `afdd15838`).
- 원인: 한 줄 출력용 도우미(`.trim()`)로 HEAD 판을 읽었다.
- 고침: 파일 내용은 버퍼 그대로 읽는다.
- 다시 확인: 커밋 뒤 `git diff --stat <부모> <새 커밋>`의 줄 수가 바꾼 줄 수와 같다.

### 남의 미추적 새 파일을 내 파일로 알고 커밋한다
- 증상: 다른 세션이 막 만든 미추적 시험 파일이 내 커밋에 통째로 들어갔다(10-14, push 전에 빼고 다시 커밋).
- 원인: 「작업본에서 안 바뀌었다」를 `git diff --quiet`로 판단했다. 미추적 파일은 diff에 나오지 않는다.
- 고침: 올리기 전에 `git ls-files --error-unmatch <경로>`나 `git cat-file -e HEAD:<경로>`로 추적 여부를 본다.
- 다시 확인: 커밋 뒤 `git diff --stat <부모> <새 커밋>`의 파일·줄 수가 내가 만든 양과 같다.

### `git diff`·`git status`는 `--pathspec-from-file`을 받지 않는다
- 증상: 커밋 스크립트 끝 확인이 사용법 오류로 터져 커밋이 안 된 줄 알고 다시 돌렸다(10-13). 오류를 버리면 빈 결과처럼 보인다.
- 원인: `git reset`은 `--pathspec-from-file`을 받지만 `git diff`·`git status`는 받지 않는다(2.55에서 다시 확인).
- 고침: 확인은 경로를 인자로 넘기거나 전체 출력을 경로 목록으로 거른다. 스크립트가 터지면 다시 돌리기 전에 `git log -1`부터 본다.
- 다시 확인: `git status --porcelain --pathspec-from-file=<목록>`이 「unknown option」을 낸다(10-17).

### porcelain 출력을 통째로 strip하면 첫 경로의 첫 글자가 잘린다
- 증상: 첫 줄 ` M experiences/blank-slice/README.md`가 `xperiences/…`가 되어 없는 경로를 지우려다 멈췄다(10-07).
- 원인: `--porcelain`은 「XY 두 칸 + 빈칸 + 경로」라 첫 줄 앞의 빈칸도 뜻이 있다. 출력 전체를 `strip()`하면 첫 줄만 한 칸 밀린다.
- 고침: `split('\n')` 뒤 빈 줄만 거른다(필요하면 `rstrip('\n')`). 옮기거나 지우기 전에 실제 경로인지 본다. `git status --porcelain`은 통째 새 폴더를 한 줄로 접으니 ?? 줄 수를 파일 수로 쓰지 않는다.
- 다시 확인: 연습 실행에서 개수만 보지 말고 다룰 경로 몇 개를 찍어 `os.path.exists`로 본다.

### 바뀐 줄을 `grep -c '^[-+][^-+]'`로 세면 목록 줄이 빠진다
- 증상: 커밋 안 된 줄이 0개로 나와 없는 줄 알았다(10-03).
- 원인: 트랙·결정 줄은 `- `로 시작해서 바뀐 줄이 `+-`·`--`가 된다.
- 고침: `git diff --numstat -- <경로>`나 두 내용을 직접 비교한다. 줄 대조에서 빼는 것은 파일 머리(`--- a/`·`+++ b/`)뿐이다.
- 다시 확인: 목록 줄 하나를 바꾼 파일로 두 방법의 수를 견준다.

### 공용 문서를 쓰다 실패하면 빈 파일이 남는다
- 증상: 기록 스크립트가 줄 길이 검사에서 실패했는데 공용 트랙이 0바이트로 남았다. `git show HEAD:`로 되살렸지만 커밋 안 된 남의 줄 넷이 빠졌다(10-03).
- 원인: `io.open(p, 'w').write(apply(w))`는 파일을 먼저 비운 뒤 인자를 계산한다. 셸 `> 파일`도 같다.
- 고침: 새 내용을 변수로 다 만들고 검사까지 통과시킨 뒤 임시 파일에 쓰고 `os.replace`로 바꿔 넣는다. 실패했으면 다시 돌리기 전에 그 파일이 비지 않았는지(`wc -c`, `git diff --stat`) 본다. HEAD에 없던 남의 줄은 HEAD로 되살아나지 않으니 바쁜 세션에 바로 알린다.
- 다시 확인: 쓰기 전후 `wc -c`와 `git diff --numstat -- <경로>`가 바꾼 양만큼만 다르다.

### 「이 글로 시작하는 첫 줄」을 골라 고치면 남의 줄을 덮는다
- 증상: 미리 돌릴 때는 맞던 스크립트가 두 시간 뒤 다시 돌리자 같은 시작 글로 시작하는 남의 줄을 덮을 판이었다(10-14).
- 원인: 그사이 다른 세션이 같은 시작 글의 줄을 위에 더했다.
- 고침: 시작 글이 딱 한 줄일 때만 그렇게 고르고, 흔한 시작 글은 `## ` 절 안에서만 찾는다. 미리 돌리기는 쓰기 직전에 지금 판 복사본으로 다시 한다.
- 다시 확인: 미리 돌린 결과에서 바뀐 줄 번호가 내 절 안인지 본다.

### 새 파일의 내 줄만 올릴 때 조각 id가 보이지 않는다 (2026-10-19)
- 증상: 다른 세션이 줄을 끼워 넣은 미추적 새 파일(`docs/현장노트/LoRA_학습.md`)에서 내 줄만 올리려 했는데, `tools/내커밋.js 커밋 … --자세히`가 새 파일의 조각은 보이지 않았다. UTF-8 문자열로 읽어 계산한 id는 「조각 …가 지금 차이에 없다」로 멈췄다(아무것도 커밋되지 않았다).
- 원인: `--자세히`는 바탕에 있던 파일만 조각을 보인다. 도구는 파일을 latin1(바이트) 문자열로 읽어 조각 id를 만든다.
- 고침: 도구가 내보내는 함수로 id를 구한다. `t = require('./tools/내커밋.js')`로 불러 `t.조각만들기('', fs.readFileSync(파일).toString('latin1'))`의 `묶음[0].id`를 쓴다. 새 파일은 조각이 하나이고 줄 번호는 파일 줄 번호와 같다. 올리기 전에 고른 줄을 `t.조각얹기`로 얹어 내 판과 바이트까지 같은지 본다.
- 다른 세션이 내 줄을 고쳐 쓴 새 파일(10-19 `docs/마케팅/제작양식/AI광고영상_제작규칙.md`, 내 줄 12개가 바뀜)은 작업본에 내 판이 없어 조각으로 만들 수 없다. 이 세션 기록의 Write·Edit만 처음부터 다시 적용해 내 판을 만들고, 위 손 절차(별도 인덱스, `hash-object -w --no-filters`, 저장 용량 검사, CAS, 공용 인덱스의 그 경로 reset)로 올렸다(`4113be901`). 남이 더하고 고친 줄은 작업본 차이(+61 −12)로 남아 그 세션이 올린다.
- 다시 확인: 커밋 뒤 `git diff --stat -- <파일>`이 남의 줄 수와 같고, `git diff --cached --name-only`가 비어 있다.

## 당기기·push

### 작업본을 새 HEAD로 당길 때 남의 미커밋 수정이 옛 HEAD 위에 남는다
- 증상: 남의 미커밋 파일을 「남겨 두기」만 하면 그 세션이 나중에 통째로 커밋할 때 우리 변경이 조용히 되돌아간다(10-03 talk 정리).
- 원인: 남겨 둔 파일은 「옛 HEAD + 그쪽 수정」 상태다.
- 고침: 바뀐 경로마다 작업본이 NEW와 같으면 둠, OLD와 같으면 NEW로 씀, 둘 다 아니면 `git merge-file -p <작업본> <OLD> <NEW>`(LF로 맞춰 합친 뒤 원래 줄끝으로)로 합치고 충돌이면 손대지 않고 알린다. 덧붙이기만 하는 장부(`.jsonl`)는 줄 합집합. 생성 묶음(dist·atlas-learning 등)은 3방향 대신 커밋 판으로 덮는다. 순서는 파일 → master(CAS, 실패하면 파일 되돌림) → 그 경로만 공용 인덱스. 한 파일이라도 부딪히면 아무것도 얹지 않는다.
- 다시 확인: 얹기 전후 CR 개수가 줄마다 그대로이고, 남의 미커밋 줄이 작업본에 남아 있다.

### 로컬 master를 통째로 push하면 남의 미푸시 커밋이 같이 나간다
- 증상: 내 커밋만 올리려 했는데 아래에 깔린 다른 세션 커밋이 함께 올라갔다(10-03).
- 원인: `git push origin master`는 내 커밋의 조상인 남의 미푸시 커밋까지 올린다. 그 세션은 아직 유호님 확인을 기다리는 중일 수 있다.
- 고침: `node tools/내커밋.js 올리기 <내 커밋…>`(미리 보기 → `--실행`)로 올린다(10-19). origin/master를 fetch해, 내 커밋이 그 바로 위에 이어져 있으면 그 커밋을 그대로 올린다. 남의 것이 섞였으면 origin/master 위에 내 커밋의 바뀐 경로만 별도 인덱스로 다시 쌓는다(같은 메시지·작성자). 원격 판이 내 부모 판과 같으면 내 판, 다르면 `git merge-file`, 문서가 겹치면 원격에도 있는 다음 줄 앞에 내 줄을 붙인다. 코드·데이터 파일이 겹치거나 내가 고친 줄이 원격에 그대로 없으면 멈춘다. 다시 쌓는 판의 줄끝은 원격 판에 맞추고, origin 바로 위의 커밋이라도 줄끝만 원격 판과 다른 줄이 있으면 그대로 올리지 않고 맞춰 다시 쌓는다(줄끝을 일부러 바꾸는 커밋만 `--줄끝그대로`). 올리기 전에 경로마다 「올라갈 줄은 모두 내 커밋의 줄(남의 미푸시 줄이 새지 않음) · 내 커밋이 바꾸지 않은 경로는 그대로 · 내가 지우지 않은 원격 줄은 그대로 · 줄끝은 원격 판을 따름」과 저장 용량(`git-storage-check.cjs --base origin/master --head <올릴 머리>`)을 본다. 미리 보기의 새 커밋 번호는 실행 때 다시 만들어 달라지니, 원격 CI는 실행 출력의 번호로 본다. 그다음 빨리감기로만 push하고, origin이 그새 움직였으면 다시 fetch해 처음부터 한다. 로컬 master는 그대로 둔다. 옛 `.tmp/push-mine-20261013/` 도구(restack.py·restack_close.py·push_close.py·merge_local.py)는 10-19부터 쓰지 않는다. 「푸시해」는 내 커밋만이고, 남의 커밋까지 올리는 것은 유호님이 그렇게 말할 때만이다.
- 다시 확인: `git ls-remote origin master`가 올리기 출력의 올린 머리이고, 출력에 「검사: 올라갈 줄은 모두 내 커밋의 줄 · 내 줄 빠짐 없음 · 줄끝은 원격 판을 따름」과 저장 용량 통과가 있다. 10-19 임시 저장소 재현(시험 「재현: …」을 `--test-reporter=tap`으로 돌리면 명령과 출력이 찍힌다): 남의 미푸시 커밋·스테이징·미커밋 수정·새 파일·트랙의 남의 줄이 있는 채로 내 파일과 트랙 내 줄만 커밋했고, 그새 origin에 올라온 GPT 커밋 위에 내 커밋 하나만 올렸다. 남의 것은 작업본·공용 인덱스·로컬 master에 그대로였다.

### 남의 미푸시 커밋이 같은 줄을 고쳤으면 `restack.py`가 그 파일에서 멈춘다
- 증상: 트랙 한 줄의 내 문장만 바꾼 커밋을 다시 쌓는데 `restack.py`가 `docs/_ops/트랙.md`에서 「병합 FAIL」로 멈췄다. 아무것도 올라가지 않았다(10-17).
- 원인: 다른 세션의 로컬 전용 커밋이 같은 줄의 다른 구절을 지워서, 내 커밋의 부모 판과 origin 판이 그 줄에서 다르다. 줄 단위 3방향으로는 두 수정을 가를 수 없다.
- 고침: 그 파일만 origin 판 blob에 내 문장 교체를 적용한다. 옛 문장이 origin 판에 꼭 한 번 있고 바뀐 줄이 하나일 때만 쓴다. 다른 경로는 origin 판이 내 부모 판과 같을 때만 내 판을 넣고, 다르면 멈춘다. 로컬 병합의 트리는 로컬 그대로 둔다(로컬이 남의 수정과 내 문장을 다 품는다). `tools/내커밋.js 올리기`도 이 경우 「내가 고친 줄이 원격 판에 그대로 없다」로 멈춘다(문장 단위 옮기기는 넣지 않았다) — 그 파일만 이 고침대로 손으로 한다.
- 다시 확인: 올린 커밋의 바뀐 파일이 로컬 커밋과 같고 트랙은 한 줄이며, 로컬 병합 전후 `git diff --stat`이 비어 있다.
- 10-19 덧붙임(`내커밋.js 올리기`로 나눠 올리기): 도구는 가지에 없는 커밋 번호도 받는다(`rev-parse --verify`, 부모 하나). 그래서 별도 인덱스와 `commit-tree`로 커밋 둘을 만들어 `올리기 A B`에 함께 넘긴다. 가지는 움직이지 않는다. A는 내 커밋에서 걸린 파일만 부모 판으로 되돌린 트리로, 같은 부모·같은 메시지로 만든다. B는 origin 머리를 부모로, 그 파일만 「origin 판 + 내 문장」으로 바꿔 만든다. 이렇게 넘기면 나머지 경로는 도구가 다시 쌓고, 검사(내 줄만·빠짐 없음·줄끝·용량)도 그대로 돈다. 10-19 Argon 커밋 `557316313`의 `docs/현장노트/AI_CLI.md` 「쓴 AI」 줄에서 썼다(origin `f36015517`·`4c3e47f30`). 확인: 올린 머리에서 그 파일을 뺀 경로의 blob이 로컬 커밋과 같은지(34경로 일치), 그 파일에 내 문장과 origin 구절이 둘 다 있는지 본다.

### 「트리는 로컬 그대로」 병합이 origin에만 있는 남의 커밋을 떨어뜨린다
- 증상: GPT가 origin에만 올린 커밋(1,568개 경로)이 로컬 master에서 빠졌다. 그대로 push했으면 origin에서도 지워질 판이었다(10-08).
- 원인: push 뒤 로컬 병합을 「트리는 로컬 판」으로 만들면서 origin 쪽 커밋을 조상으로만 품었다. `merge_local.py --renumber`도 번호 바꾼 파일을 origin 판으로 통째 덮어 로컬에만 있는 남의 줄을 지웠다(10-14).
- 고침: 병합 전에 `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 본다. 번호만 바꿀 때는 「로컬 판 + 번호 문자열 바꾸기」로 blob을 만든다. 로컬과 origin이 크게 갈라졌을 때 합친 기록과 도구는 `.tmp/origin-merge-20261009/scripts/`(`apply3.cjs`: 병합 트리 → 공용 작업본 3방향 → master CAS → 그 경로만 인덱스)·`.tmp/origin-sync-20261010/README.md`. 작업 중 origin이 계속 움직이면 머리가 바뀔 때마다 처음부터 다시 계산하고, origin에 올리는 세션에 잠깐 멈춰 달라고 한다.
- 다시 확인: 병합 커밋과 origin/master의 `git diff --stat`이 로컬에만 있는 커밋들의 변경뿐이다.

### push 직후 `merge_local.py`가 「origin has other commits」로 멈춘다
- 증상: 내 커밋을 `restack.py --push`로 올린 직후 `merge_local.py`가 `AssertionError: ('origin has other commits', 4)`로 멈췄다(10-17). 그사이 다른 세션이 origin에 세 커밋을 올렸다.
- 원인: 이 도구는 로컬 master에 없는 origin 커밋이 방금 내가 올린 것뿐일 때만 「트리는 로컬 그대로」로 합친다. 남의 push가 섞인 채 트리를 로컬로 두면, 로컬에 아직 없는 남의 줄이 병합에서 빠진다(10-17에는 결정 표·트랙의 줄이 그랬다).
- 고침: 억지로 합치지 않는다. `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 보고, 하나라도 다르면 로컬 병합은 하지 않고 그대로 둔다(그 커밋을 올린 세션이 자기 병합 때 합치거나, 위 항목의 3방향 절차로 따로 맞춘다). 내 내용은 로컬의 원래 커밋에 이미 있으니 잃는 것은 없다. 10-19부터 `tools/내커밋.js 올리기 --실행 --합치기`가 이 확인을 한다(내가 방금 올린 커밋은 빼고 본다). 다르면 「건너뜀」과 다른 경로 몇 개를 내고 합치지 않는다.
- 다시 확인: `for c in $(git rev-list HEAD..origin/master); do git diff-tree --no-commit-id --name-only -r $c; done`로 나온 경로마다 `git rev-parse origin/master:<경로>`와 `git rev-parse HEAD:<경로>`가 같은지 본다.

### `restack.py --renumber`로 번호를 바꾸면 그 줄을 다시 고친 다음 커밋이 실패한다
- 증상: 10-18 회원 혜택 커밋 8개를 `--renumber=`(로컬 번호 셋)으로 다시 쌓는데, 앞 커밋이 QA README에 적은 로컬 번호를 새 번호로 바꾼 뒤 같은 줄을 고친 다음 커밋이 「replace 묶음이 0곳」으로 실패했다. 트랙은 다섯 커밋 모두 실패했다.
- 원인: 지금 판(앞에서 쌓은 것)은 새 번호인데 다음 커밋의 부모·자기 판은 옛 번호라 그 줄이 서로 다르다. 트랙은 그 위에 다른 세션의 미푸시 문장이 줄마다 섞여 origin 판과 로컬 판의 줄이 아예 다르다.
- 고침: 3방향 전에 부모·자기 판에도 같은 번호 바꾸기를 먼저 한다(`merge3` 첫 줄에서 두 blob에 `renum` 적용). 이미 origin에 다른 번호로 올라간 로컬 커밋 번호(10-18 `47a1d1f60`으로 올라간 바탕 커밋)도 같이 바꾼다(`--map=옛:새`). 트랙은 `--skip=docs/_ops/트랙.md`로 커밋별 이식에서 빼고, 마지막에 origin 판의 그 줄에 내 문장만 정확히 한 번 바꾸는 커밋을 얹는다(바뀐 줄 수가 맞는지 확인). 로컬 병합은 origin 판으로 덮지 않고 「로컬 트리 + 번호 문자열 바꾸기」로 만든다. 공용 `.tmp/push-mine-20261013/restack.py`에는 아직 이 셋이 없다(10-18은 세션 사본으로 했다).
- 다시 확인: 올린 머리에서 `git grep <옛 번호>`가 0, 올린 트리를 풀어 관련 시험 통과, 로컬 병합 전후 차이가 번호 줄뿐이다(10-18: origin `b79545629..b5ffa068f`, 로컬 병합 `659ea4d03` 7파일 8줄).

### 결정 표에 행을 더한 커밋을 다시 쌓으면 `restack.py`가 「끼울 자리 못 찾음」으로 멈춘다
- 증상: 10-18 결정 표에 세 행을 더한 커밋(`add77ba8c`)을 `restack.py --commits=add77ba8c --renumber=`로 다시 쌓았는데, 결정 표만 「끼울 자리 못 찾음: '| 2026-10-17 | 확정 | [보안 · talk 운영 반영 …'」(merge-file 충돌 2)로 빠졌다. 나머지 문서 셋은 merge-file·transplant로 됐다.
- 원인: 내 행 앞뒤의 문맥 행이 다른 세션의 로컬 전용 커밋이 넣은 행이라 origin 판에는 없다. 결정 표는 맨 위에 행이 계속 끼어서 로컬 판과 origin 판의 행 순서도 다르다.
- 고침: 결정 표만 origin 판에 내 행을 직접 끼운다. 닻은 「내 판에서 내 행 다음에 오는 행 중 origin 판에도 있는 첫 행」이고, 내 판에서 표 맨 위 행이면 구분줄 바로 다음이다(`결정.js --추가`와 같은 자리). 10-19부터 `tools/내커밋.js 올리기`가 `.md`·`.txt`·`.jsonl` 등 문서에서 같은 닻(내 줄 다음에 오는 줄 가운데 원격에도 있는 첫 줄 앞)으로 끼운다. `.tmp/push-mine-20261013/restack_결정행.js <restack 머리> <내 커밋> --out=<결과> [--push]`가 restack 머리에 결정 표만 채워 같은 메시지·작성자로 다시 만든다. 이 도구의 결과 파일에는 `renumber.files`가 있어 `merge_local.py --res=<결과>`가 그대로 읽는다. restack.py 결과는 번호를 안 바꾸면 `renumber`가 `{}`여서 merge_local.py 9행 `res['renumber']['files']`에서 KeyError가 난다(10-18 코드로 확인).
- 다시 확인: 도구가 경로마다 「origin → 올린 커밋」의 더한·지운 줄이 「부모 → 내 커밋」과 개수까지 같은지 보고, 저장소 검사를 돌린다. 올린 뒤에는 `git ls-remote`가 올린 커밋인지 본다. 10-18: origin `a99182659..886739c24`(13파일 +1732/−4, 원래 커밋과 같음), 로컬 병합 `b8b32d744`(트리는 로컬 그대로).

### 로컬 master에 남의 미푸시 커밋이 있어 origin과 갈라졌다
- 증상: 10-18 「로컬 master도 origin이랑 맞춰줘」 때 로컬만 69커밋(다른 세션 미푸시·이미 restack으로 올린 커밋의 옛 번호 포함), origin만 43커밋이었다. 빨리감기가 안 되고, master를 origin으로 옮기면 남의 미푸시 커밋이 가지에서 빠진다.
- 원인: 세션마다 내 커밋만 origin에 다시 쌓아 올리고(restack) 로컬 병합은 「origin has other commits」로 건너뛰어, 같은 내용이 양쪽에 다른 번호로 쌓였다.
- 고침: `.tmp/master-align-20261018/align_merge.py`(계획만 → `--go`). `git merge-tree --write-tree`로 병합 트리를 만들고 충돌은 경로별 규칙(한쪽이 다른 쪽을 품으면 그쪽, 표·장부는 합집합, 「쓴 AI」 머리말은 잇기)으로 푼다. 바뀐 경로마다 작업본이 옛 HEAD 그대로면 새 판(작업본 줄끝 유지), 남의 미커밋 수정이면 3방향, 3방향이 부딪히면 줄 단위(한쪽만 고친 줄은 그쪽, origin에만 있는 새 묶음은 작업본에 같은 글이 없을 때만, 둘 다 다르게 쓴 줄은 작업본 판을 두고 기록) → 바이트 백업 → 병합 커밋(부모 로컬·origin) → master CAS → 그 경로만 공용 인덱스. 결과 `c3222446d`(71경로, 작업본 = 병합본 62, 3방향 9).
- 다시 확인: `git merge-base --is-ancestor origin/master master`, 3방향 파일마다 「백업의 작업본 고유 줄이 새 작업본에 다 있는지」(머리말을 이은 줄은 글이 들어 있는지). 둘 다 다르게 쓴 줄(10-18: 트랙 「자동화 3종 후속」)은 HEAD에 origin 판이 있으니 그 줄 주인 세션이 커밋 전에 합쳐야 한다.

### `restack.py`가 통과해도 끼운 줄 차례가 로컬과 다를 수 있다
- 증상: 10-18 저녁 내 커밋 21개를 다시 쌓을 때, 트랙 계정판 줄은 다섯 커밋 모두 「replace 묶음이 0곳」으로 멈췄다. 통과한 결정 표 두 행과 AI_CLI 한 절은 남이 그사이 origin에 먼저 올린 행·절보다 위에 끼워졌다. 로컬에서는 그 아래에 있었고, 줄 개수 검사는 통과했다.
- 원인: 끼울 자리를 내 커밋 부모 판의 앞뒤 줄로만 찾는다. 남이 나중에 올린 행은 부모 판에 없어서 내 행이 그 위(표 맨 위)로 들어간다. 줄 개수 검사는 차례를 보지 않는다. 트랙 줄은 origin 판에 다른 커밋 문장이 먼저 들어가 있어 줄째로는 찾지 못한다.
- 고침: `.tmp/push-mine-20261013/restack_close.py`를 쓴다. 끼울 묶음이 로컬 master 판에 한 번 있으면, 로컬에서 그 위로 올라가며 origin에도 있는 첫 줄을 찾아 그 뒤에 끼운다. 바꿀 줄이 origin 판에 없으면 머리(앞 40자)가 같은 줄 하나에 문장 단위로 옮기고 문장 개수로 검사한다. `verify_close.py`는 경로마다 올릴 판에만 있는 줄이 origin 바탕에 있던 줄인지, 바탕에 없던 내 줄이 로컬과 다른 자리에 있는지 본다. `push_close.py --commits=… [--tests=…]`가 쌓기 → 대조 → 저장소 검사 → 올릴 트리 그대로 시험 → 빨리감기 push를 한 번에 한다. origin이 그새 움직이면 git이 push를 거절하니 다시 돌린다. 10-19부터 쓰는 `tools/내커밋.js 올리기`는 같은 자리에 원격도 줄을 더했으면 원격 줄 다음에 내 줄을 둔다. 로컬 차례와 다를 수 있으니, 미리 보기가 「자리 맞춤」 경로마다 보여 주는 「<원격 줄>」 다음에 「<내 줄>」을 올리기 전에 본다. 올릴 트리로 시험을 돌리는 단계는 넣지 않았다.
- 다시 확인: 10-18 origin `4aa8622f9..24791684c`(21커밋·102파일). 대조에서 남은 차이는 origin과 로컬에서 남의 결정 행 두 개의 차례가 다른 것뿐이었고, 올릴 트리를 풀어 돌린 구독·혜택 시험 52개가 통과했다.

## 워크트리·연결 폴더·공간 정리

### junction이 든 워크트리를 통째로 지우면 공용 node_modules가 지워질 수 있다
- 증상: `git worktree remove --force`가 등록만 풀고 폴더를 남긴다. 남은 폴더를 `rm -rf`·`Remove-Item -Recurse`로 지우면 링크를 따라 공용 작업본의 node_modules까지 지울 수 있다(모든 세션의 빌드가 멈춤). `cmd /c rmdir`은 하네스가 막는다.
- 원인: 빌드·시험용으로 `node_modules`를 공용 작업본에 잇는 junction을 만들어 둔다.
- 고침: PowerShell에서 `(Get-Item <p> -Force).LinkType -eq 'Junction'`을 보고 `[System.IO.Directory]::Delete(<p>, $false)`로 링크만 지운다. 그다음 남은 폴더를 지운다.
- 다시 확인: 지우기 전 `Get-ChildItem -Recurse -Force | Where-Object LinkType`이 비었고, 끝난 뒤 공용 쪽에서 esbuild가 돈다(`node tools/build-world-life.mjs --check`).

### 사본(거울)의 junction 폴더를 타고 시험·패치가 공용 작업본에 쓴다
- 증상: 격리 사본에서 고친 시험 맞춤 패치가 공용 `verify-*.mjs`에 들어갔고, 출력 위치를 박아 둔 시험이 GPT 증거 폴더 14개를 덮었다(10-13).
- 원인: 「실제 경로 사슬 + 나머지는 junction」 사본에서 junction인 폴더는 공용 작업본 그 자체다. Node는 그 경로를 실제 경로로 풀어 공용 코드를 돌린다.
- 고침: 사본에서 시험·패치하기 전에 쓸 폴더(`qa`, `docs/_ops`, 출력 폴더)가 junction인지 보고 실제 폴더로 끊는다. 출력 위치를 박아 둔 진입 파일 대신 본 시험 파일을 환경 변수(출력 폴더)로 직접 돌린다.
- 다시 확인: `fsutil reparsepoint query <폴더>`나 `fs.realpathSync`로 쓸 폴더가 사본 안이다.

### 워크트리의 비추적 결과물은 워크트리를 지울 때 함께 사라진다
- 증상: 데스크톱 앱에서 워크트리 세션을 지우자 그 워크트리의 비추적 파일(정지컷·도구·인계문)이 모두 사라지고 `.gitignore` 대상만 남았다(10-14, 휴지통에도 없음).
- 원인: 세션·워크트리 정리가 추적되지 않는 파일을 지운다. 사용자가 앱에서 하는 일이라 작업 세션은 미리 알 수 없다.
- 고침: 워크트리에서 오래 일하면 결과물을 커밋하거나 메인 `.tmp/`로 옮겨 둔다. 정리를 권하기 전에 워크트리마다 `git -C <워크트리> status`의 `??`를 보고 알린다.
- 다시 확인: 정리 후보 워크트리의 `git status --porcelain | grep '^??'`가 비었다.

### 공간 정리가 추적 파일을 지운다
- 증상: PC 공간 정리 뒤 시험이 「파일 없음」으로 깨진다. 10-03 정리가 추적 파일 185개(142MB)를, 10-10 정리가 메인 추적 파일 217개 + 워크트리 10곳 약 8,900개를 지웠다(같은 SHA가 Drive에 있으면 로컬 삭제). 10-14에는 폴더 통째 삭제가 안쪽에 둔 git 클론까지 지웠다.
- 원인: 정리 목록이 `git ls-files`를 거르지 않았다. 추적 파일은 이미 `.git`에 있어 지워도 백업이 늘지 않는데, 작업본이 「삭제됨」으로 남아 누가 `git add -A`·`commit -a`를 하면 그 삭제가 저장소에 들어간다. 맨 위 `.git`만 보고 거르면 한 단계 안의 클론은 못 거른다.
- 고침: 정리 목록에서 `git ls-files` 경로를 뺀다. 추적 파일이 정말 크면 지우지 말고 sparse-checkout으로 작업본에서만 뺀다. 폴더를 통째로 지우기 전에 그 안 어디에든 `.git`(폴더든 파일이든)이 있는지 보고, 있으면 그 아래는 빼고 따로 본다. 지워진 추적 파일은 `git status --porcelain | grep '^ D'` 목록을 `GIT_LITERAL_PATHSPECS=1 git restore --worktree --pathspec-from-file=<목록>`으로 되살린다(공용 인덱스는 그대로). 정리 기록(`removed*.jsonl`의 경로·sha256)이 있으면 바이트까지 맞춘다: 별도 인덱스(`read-tree HEAD`)의 `checkout-index`(체크아웃 판, autocrlf 적용)와 HEAD blob(LF) 가운데 기록된 해시와 같은 쪽을 쓴다(10-10 349개). 내용이 같아도 인덱스에 적힌 크기와 다르면 status가 ` M`으로 남으니, 지우기 직전 바이트 그대로 되살린다(`git ls-files --debug`의 size로 확인). 단 낡은 것을 일부러 없앤 정리라면 되살리지 않는다 — 정리 기록·커밋·진행 중인 GPT 작업으로 가리고, 헷갈리면 유호님께 여쭌다.
- 다시 확인: 정리 뒤 `GIT_OPTIONAL_LOCKS=0 git ls-files --deleted | wc -l`이 0이다(10-17 0). 정리가 아직 돌고 있을 수 있으니 정리 기록 파일의 수정 시각이 멈췄는지도 본다.

## 이력 훑기

### 큰 blob을 거른 클론에서 `git log -S`·`--find-object`가 「could not fetch」로 끝난다
- 증상: `git clone --bare --filter=blob:limit=1m`로 받은 이력(1MB 넘는 blob 1,787개 빠짐)에서 `GIT_NO_LAZY_FETCH=1 git log --all -S<값>`과 `--find-object=<blob>`이 `fatal: could not fetch <blob> from promisor remote`로 끝났다(10-17 클라우드 비밀값 점검). 환경 변수가 없으면 빠진 큰 blob을 하나씩 받으러 간다.
- 원인: 경로를 주지 않으면 모든 경로의 바뀐 blob을 읽는다(`-S`는 내용 비교, 이름 바뀜 탐지도 내용을 읽는다). 받지 않은 큰 blob에서 멈춘다. 둘 중 어느 쪽이 먼저 막혔는지는 가르지 않았다.
- 고침: 글 파일 경로로 좁히고 `--no-renames`를 붙인다: `GIT_NO_LAZY_FETCH=1 git log --all --no-renames --find-object=<blob> -- <경로>`. 이력 전체를 훑을 때는 `git rev-list --all --objects --filter=blob:limit=1m --missing=print`로 받은 blob만 골라(빠진 것은 `?`로 시작) `git cat-file --batch`로 읽는다.
- 다시 확인: 같은 클론에서 경로 없이 돌리면 fatal, 경로와 `--no-renames`를 주면 커밋 줄이 나온다.

### 생성 지도의 원천 해시가 CRLF 작업본과 리눅스에서 다르다
- 증상: SNS 지도 시험(`verify-map`·`engagement/server`)이 리눅스 클론에서 원천 5개가 「바뀜」이라고 했다. 실제로 내용이 바뀐 것은 3개였다(10-17 클라우드).
- 원인: 지도 생성기가 Windows CRLF 작업본의 바이트로 해시를 쟀다. 같은 내용이 리눅스 체크아웃에서는 LF라 해시가 다르다.
- 고침: 원천 해시는 CRLF를 LF로 맞춘 바이트로 잰다(`build-map.mjs`의 `sourceHash`). 다른 생성 스냅샷도 같은 방식으로 잰다.
- 다시 확인: 리눅스 클론에서 `node --test docs/마케팅/온라인마케팅지도/verify-map.test.mjs`가 해시 시험을 통과한다.

### 다른 가지에서 들여온 생성 사본이 사본 대조 시험에서 어긋난다
- 증상: 병합 안 된 codex 가지의 `experiences/word-magic/kit/` 사본을 그대로 가져오자 `play-common/kit` 시험이 「사본이 원본과 같다」에서 실패했다(10-17).
- 원인: 그 가지의 사본은 CRLF로 커밋돼 있어 생성기 출력(LF)과 바이트가 달랐다. 사본은 생성기 결과라 가지마다 낡을 수도 있다.
- 고침: 생성 사본(`collection.js`·`kit/` 등)은 가져오지 말고 정본 생성기(`node experiences/play-common/build-kit.mjs`, `build-collection.mjs`)로 다시 만든다.
- 다시 확인: `git ls-files --eol experiences/word-magic/kit | grep -c 'i/crlf'`가 0이다.

### PC에만 있는 파일을 읽는 시험이 클라우드 클론에서 실패한다
- 증상: 클라우드 클론에서 `미니게임_목소리`(voice-request.json), `learning-hub/server`(입문 게임 파일), `path-travel-server`(계획 화면 파일)가 404·ENOENT로 실패했다(10-17).
- 원인: 10-14 「pending changes」 일괄 커밋들이 바뀐 파일이 import하는 새 파일만 넣어, 시험이 부르는 파일 일부가 PC 작업본에만 남았다.
- 고침: `git log --all --oneline -- <경로>`로 origin의 다른 가지에 있는지 먼저 찾는다(입문 게임 277개는 `origin/codex/beginner-games-finish-20261010`에 있었다). 어디에도 없으면 PC에서 커밋한다(path-travel 계획 화면 8개·장소 사진 13장).
- 다시 확인: PC 작업본에서 `git status --short experiences/path-travel`이 비어 있다.
