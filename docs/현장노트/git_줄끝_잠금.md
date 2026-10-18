# 현장 노트 · git 줄끝·잠금·공용 작업본

> 판: Git for Windows 2.55 · 시스템 설정 `core.autocrlf=true` · 공용 `.git/config`에 `diff.autoRefreshIndex=false`(10-13)·`extensions.worktreeConfig=true` · 등록된 훅 없음
> 마지막 확인: 2026-10-17
> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-02~10-17 Claude 메모에서 옮김 · GPT(Codex) 10-17 공유 문서 숫자 치환 함정 추가

SYNK-appsscript 메인 작업본은 Claude 세션 여럿과 GPT가 같은 폴더·같은 git 인덱스를 함께 쓴다. 여기서 git을 쓸 때 남의 작업을 되돌리거나 내 커밋이 사라진 함정이다. 틀은 [README](README.md)를 따른다.

## 절차 · 공용 작업본에서 내 것만 커밋하기

공용 인덱스(`git add` → `git commit`)로 커밋하지 않는다. 다른 세션이 올려 둔 스테이징이 내 커밋에 섞이고, 반대로 내 스테이징이 남의 커밋에 섞인다.

1. `BASE=$(git rev-parse HEAD)`를 먼저 잡는다. 내용은 반드시 이 BASE에서 만든다.
2. `export GIT_INDEX_FILE=<임시>/x.index; git read-tree $BASE`로 별도 인덱스를 만든다.
3. 별도 인덱스에 올린다.
   - 내 파일: 추적 여부부터 본다(`git cat-file -e $BASE:<경로>`). 그다음 `git add -- <경로>`.
   - 남도 고치는 문서(AGENTS.md·결정·트랙·문서 지도 등): `git cat-file blob $BASE:<경로>`를 버퍼 그대로(줄 끝을 자르지 않고) 받아 내 줄만 더한 파일을 만든다. `git hash-object -w --no-filters <파일>`로 blob을 만들고(내용이 이미 LF라 바이트 그대로. `--no-filters`와 `--path=`는 같이 쓸 수 없다 — git 2.55가 「Can't use --path with --no-filters」로 거절, 10-17) `git update-index --cacheinfo 100644,<blob>,<경로>`로 올린다.
4. `git write-tree` → `git commit-tree <트리> -p $BASE -F <메시지 파일>` → `git update-ref -m <설명> refs/heads/master <새 커밋> $BASE`. 그사이 HEAD가 움직였으면 update-ref가 실패하고 아무것도 바뀌지 않는다 — 1부터 다시 한다.
5. 곧바로 `unset GIT_INDEX_FILE; git reset -q -- <내 경로들>`로 공용 인덱스의 그 경로만 새 HEAD에 맞춘다. 막히면 미루지 않는다(아래 「커밋 뒤 공용 인덱스」).
6. 확인: `git diff --cached --name-only`에 내 경로가 없고, `git diff --stat $BASE <새 커밋>`의 줄 수가 내가 바꾼 양과 같다.

보기 구현: [`tools/참고카드_커밋.js`](../../tools/참고카드_커밋.js)(잠금 확인 → 별도 인덱스 → `commit-tree` → CAS → 경로만 reset, 실패하면 가지를 되돌림).

## 줄끝(CRLF·LF)

### 문단을 파일 끝에 붙일 때 빈 줄 두 개가 커밋 검사를 막는다
- 증상: 10-18 결과 기록용 별도 인덱스의 `git diff --cached --check`가 두 문서에서 `new blank line at EOF`로 중단됐다. 커밋과 push는 아직 실행되지 않았다.
- 원인: 문단 사이에 쓰는 `\n\n`을 파일 끝에도 그대로 붙였다. 검사 래퍼가 stdout을 오류에 포함하지 않아 처음에는 `GIT_FAILED`만 보였다.
- 고침: 문단 사이의 빈 줄은 유지하고 EOF에서는 마지막 줄바꿈 하나만 남겼다. 실패한 별도 인덱스를 보존한 뒤 새 인덱스로 다시 만들었다. 검사를 끄거나 공용 인덱스를 수정하지 않았다.
- 다시 확인: `.tmp/backend-upgrade-release-20261018/commit-results-v4.cjs`의 소유 문단 보존 시험 51건과 실제 diff·저장소 용량 검사를 통과했고, 결과 커밋 `4816c777`을 별도 브랜치에 push했다.

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

### 그대로 들여온 외부 배포 파일의 해시가 커밋 뒤 달라진다
- 증상: 10-17 메신저 통화의 npm `livekit-client` ESM을 그대로 넣고 README에 SHA-256을 적었는데, 커밋 트리만 꺼낸 시험에서 해시가 맞지 않았다(1,396,433 → 1,396,348바이트).
- 원인: 원본 파일에 CRLF 줄 85개가 섞여 있었다. `core.autocrlf=true`라 `git add`가 CR을 지웠고, 새로 체크아웃하면 모든 줄이 CRLF가 되어 어느 쪽도 원본 바이트가 아니다.
- 고침: 들여온 배포 폴더에 `.gitattributes`로 `<폴더>/** -text -diff`를 걸고 다시 올린다. 바이트 그대로 저장·체크아웃된다.
- 다시 확인: `git cat-file blob <커밋>:<경로> | sha256sum`이 원본·README의 해시와 같다. 들여오기 전에 원본의 CR 개수부터 센다.

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
- 고침: 10-13 유호님 승인으로 공용 `.git/config`에 `diff.autoRefreshIndex=false`를 넣었다(재현에서 잠금 0/5). 그래도 생긴 잠금은 `node tools/git잠금.js`로 판별하고, 주인이 없을 때만 `--정리`로 지운다(0바이트 · 10초 넘음 · 잠금보다 먼저 시작한 git 프로세스 없음일 때만, 프로세스 목록을 못 읽으면 안 지움). 잠금보다 뒤에 시작한 git은 주인이 될 수 없다(잠금은 O_EXCL로 만든다). 되돌리기는 `git config --unset diff.autoRefreshIndex`.
- 다시 확인: `git config --show-origin --get diff.autoRefreshIndex`가 `.git/config`의 `false`이고, `node tools/git잠금.js`가 「잠금 없음」이다(10-17). 새 잠금이 또 생기면 다른 원인이니 `.tmp/index-lock-20261010/`의 감시 도구로 다시 본다.

### 잠금이 저절로 풀리기도 해서 손으로 다시 돌리면 헛걸음한다
- 증상: 0바이트 잠금이 2분 안팎에 풀렸다가 사람 손으로 다시 돌리는 사이 새 잠금이 생긴다(10-03 두 번). 「잠금 없는 순간 기다리기」 고리가 남은 주인 없는 잠금 앞에서 10분 동안 헛돈다.
- 원인: Claude·Codex 앱이 변경 보기용으로 git을 수시로 돌려 잠금이 짧게 자주 생긴다(15분 감시에 30번, 각 0.5~2초).
- 고침: 한 스크립트 안에서 ① 지금 HEAD로 별도 인덱스 ② 0.2초 간격으로 잠금 없는 순간 기다리기(그사이 HEAD가 바뀌면 ①부터) ③ 곧바로 write-tree → commit-tree → update-ref ④ `git reset -q -- <내 경로>`를 성공할 때까지 다시 시도. 고리 안에서 잠금이 10초 넘게 그대로면 `node tools/git잠금.js --정리`를 한 번 부른다. 재시도 오류를 `2>/dev/null`로 버리지 말고 찍는다.
- 다시 확인: 고리가 끝난 뒤 `git diff --cached --name-only`가 비어 있다. 아니면 크게 알린다.

## 커밋과 공용 인덱스

### 커밋 뒤 공용 인덱스를 안 맞추면 다음 남의 커밋이 내 커밋을 되돌린다
- 증상: 별도 인덱스로 커밋한 직후 `git status`에 방금 커밋한 파일이 「삭제·되돌림」으로 올라와 있다(공용 인덱스가 옛 판, 「MM」). 이때 다른 세션이 공용 인덱스로 커밋하면 내 커밋의 파일이 지워진다(10-02).
- 원인: 별도 인덱스 커밋은 공용 인덱스를 건드리지 않는다. 공용 인덱스는 옛 HEAD 판을 스테이징한 채로 남는다.
- 고침: 위 절차 5를 커밋과 같은 스크립트 안에서 곧바로 한다. 잠금에 막히면 판별·정리 뒤 바로 다시 한다.
- 다시 확인: `git diff --cached --name-only`에 내 경로가 없다.

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

## 당기기·push

### 작업본을 새 HEAD로 당길 때 남의 미커밋 수정이 옛 HEAD 위에 남는다
- 증상: 남의 미커밋 파일을 「남겨 두기」만 하면 그 세션이 나중에 통째로 커밋할 때 우리 변경이 조용히 되돌아간다(10-03 talk 정리).
- 원인: 남겨 둔 파일은 「옛 HEAD + 그쪽 수정」 상태다.
- 고침: 바뀐 경로마다 작업본이 NEW와 같으면 둠, OLD와 같으면 NEW로 씀, 둘 다 아니면 `git merge-file -p <작업본> <OLD> <NEW>`(LF로 맞춰 합친 뒤 원래 줄끝으로)로 합치고 충돌이면 손대지 않고 알린다. 덧붙이기만 하는 장부(`.jsonl`)는 줄 합집합. 생성 묶음(dist·atlas-learning 등)은 3방향 대신 커밋 판으로 덮는다. 순서는 파일 → master(CAS, 실패하면 파일 되돌림) → 그 경로만 공용 인덱스. 한 파일이라도 부딪히면 아무것도 얹지 않는다.
- 다시 확인: 얹기 전후 CR 개수가 줄마다 그대로이고, 남의 미커밋 줄이 작업본에 남아 있다.

### 로컬 master를 통째로 push하면 남의 미푸시 커밋이 같이 나간다
- 증상: 내 커밋만 올리려 했는데 아래에 깔린 다른 세션 커밋이 함께 올라갔다(10-03).
- 원인: `git push origin master`는 내 커밋의 조상인 남의 미푸시 커밋까지 올린다. 그 세션은 아직 유호님 확인을 기다리는 중일 수 있다.
- 고침: push 전에 `git log origin/master..<내 커밋>`을 본다. 남의 것이 섞였으면 origin/master 위에 내 커밋의 바뀐 파일만 다시 쌓아 `git push origin <커밋>:refs/heads/master`로 올리고, 로컬 master는 그대로 둔다. 도구는 `.tmp/push-mine-20261013/`(README: `restack.py --commits=…` 미리 보기 → `--push` → `compare.py` → `merge_local.py --go`). 「푸시해」는 내 커밋만이고, 남의 커밋까지 올리는 것은 유호님이 그렇게 말할 때만이다.
- 다시 확인: `git ls-remote origin master`가 올린 커밋이고, 원래 커밋과 올린 커밋의 바뀐 줄이 같다.

### 남의 미푸시 커밋이 같은 줄을 고쳤으면 `restack.py`가 그 파일에서 멈춘다
- 증상: 트랙 한 줄의 내 문장만 바꾼 커밋을 다시 쌓는데 `restack.py`가 `docs/_ops/트랙.md`에서 「병합 FAIL」로 멈췄다. 아무것도 올라가지 않았다(10-17).
- 원인: 다른 세션의 로컬 전용 커밋이 같은 줄의 다른 구절을 지워서, 내 커밋의 부모 판과 origin 판이 그 줄에서 다르다. 줄 단위 3방향으로는 두 수정을 가를 수 없다.
- 고침: 그 파일만 origin 판 blob에 내 문장 교체를 적용한다. 옛 문장이 origin 판에 꼭 한 번 있고 바뀐 줄이 하나일 때만 쓴다. 다른 경로는 origin 판이 내 부모 판과 같을 때만 내 판을 넣고, 다르면 멈춘다. 로컬 병합의 트리는 로컬 그대로 둔다(로컬이 남의 수정과 내 문장을 다 품는다).
- 다시 확인: 올린 커밋의 바뀐 파일이 로컬 커밋과 같고 트랙은 한 줄이며, 로컬 병합 전후 `git diff --stat`이 비어 있다.

### 「트리는 로컬 그대로」 병합이 origin에만 있는 남의 커밋을 떨어뜨린다
- 증상: GPT가 origin에만 올린 커밋(1,568개 경로)이 로컬 master에서 빠졌다. 그대로 push했으면 origin에서도 지워질 판이었다(10-08).
- 원인: push 뒤 로컬 병합을 「트리는 로컬 판」으로 만들면서 origin 쪽 커밋을 조상으로만 품었다. `merge_local.py --renumber`도 번호 바꾼 파일을 origin 판으로 통째 덮어 로컬에만 있는 남의 줄을 지웠다(10-14).
- 고침: 병합 전에 `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 본다. 번호만 바꿀 때는 「로컬 판 + 번호 문자열 바꾸기」로 blob을 만든다. 로컬과 origin이 크게 갈라졌을 때 합친 기록과 도구는 `.tmp/origin-merge-20261009/scripts/`(`apply3.cjs`: 병합 트리 → 공용 작업본 3방향 → master CAS → 그 경로만 인덱스)·`.tmp/origin-sync-20261010/README.md`. 작업 중 origin이 계속 움직이면 머리가 바뀔 때마다 처음부터 다시 계산하고, origin에 올리는 세션에 잠깐 멈춰 달라고 한다.
- 다시 확인: 병합 커밋과 origin/master의 `git diff --stat`이 로컬에만 있는 커밋들의 변경뿐이다.

### push 직후 `merge_local.py`가 「origin has other commits」로 멈춘다
- 증상: 내 커밋을 `restack.py --push`로 올린 직후 `merge_local.py`가 `AssertionError: ('origin has other commits', 4)`로 멈췄다(10-17). 그사이 다른 세션이 origin에 세 커밋을 올렸다.
- 원인: 이 도구는 로컬 master에 없는 origin 커밋이 방금 내가 올린 것뿐일 때만 「트리는 로컬 그대로」로 합친다. 남의 push가 섞인 채 트리를 로컬로 두면, 로컬에 아직 없는 남의 줄이 병합에서 빠진다(10-17에는 결정 표·트랙의 줄이 그랬다).
- 고침: 억지로 합치지 않는다. `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 보고, 하나라도 다르면 로컬 병합은 하지 않고 그대로 둔다(그 커밋을 올린 세션이 자기 병합 때 합치거나, 위 항목의 3방향 절차로 따로 맞춘다). 내 내용은 로컬의 원래 커밋에 이미 있으니 잃는 것은 없다.
- 다시 확인: `for c in $(git rev-list HEAD..origin/master); do git diff-tree --no-commit-id --name-only -r $c; done`로 나온 경로마다 `git rev-parse origin/master:<경로>`와 `git rev-parse HEAD:<경로>`가 같은지 본다.

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

## 공용 작업본 master를 origin/master에 맞추기

공용 작업본의 로컬 master가 origin/master보다 뒤처졌는데(다른 세션이 PR로 합침) 작업본에 남의 미커밋 수정과 미추적 단일 사본이 있을 때. 2026-10-17 SYNK-talk에서 `b190998`→`47dd88d`(242경로)·`47dd88d`→`cef5526`(31경로) 두 번 했다. 보고·도구·근거: `C:/Users/q1212/AppData/Roaming/Claude/side-session-notes/local_206a2f66-91f6-450a-a2d6-30903482cbf1/talk-master-align-result-20261017.md`와 그 옆 `talk-master-align-evidence/`.

- 하지 않는다: 제자리 `reset`·`checkout`·`stash`(미커밋 수정·미추적이 지워짐) · `git merge origin/master`(병합 커밋이 생겨 master ≠ origin) · 별도 워크트리에서 master 체크아웃(이미 체크아웃돼 있음) · ref만 옮기기(작업본이 수십 커밋 되돌린 것처럼 보임).
- 한다: ① `git fetch` 뒤 `git merge-base --is-ancestor master origin/master`로 빨리감기 가능인지 본다. ② origin이 고친 경로가 작업본 수정·미추적과 하나도 겹치지 않으면 `git merge --ff-only origin/master`로 끝. ③ 겹치면 `align.cjs`(사본 `C:/Users/q1212/AppData/Roaming/Claude/side-session-notes/local_206a2f66-91f6-450a-a2d6-30903482cbf1/talk-master-align-evidence/round2-cef5526/align.cjs`, 환경변수 `OLD`·`NEW`·`TALK`·`SNAPSHOT_BRANCH`·`BACKUP_DIR`·`DOCS_BRANCH=''`·`TAKE_NEW_PATHS`·`KEEP_PATHS`·`RESOLVE_DIR`): `plan <out.json>`(읽기 전용)으로 경로별 행동표 — NEW 쓰기(작업본이 OLD 그대로/없음/OLD의 옛 판) · 그대로(이미 NEW와 같음) · 3방향(기준 OLD → 안 되면 작업본과 가장 가까운 이력 판) · `.jsonl` 장부는 줄 합집합을 「때」 순서에 · NEW가 더한 경로의 다른 미추적 파일은 바이트 그대로 · NEW가 지운 수정 파일은 미추적으로 · 충돌은 경로별로 NEW/유지/손 병합 — 를 만들어 유호님 승인을 받고, `apply <approved.json>`(계획 재계산·승인판 대조 → 스냅샷 가지 + 바이트 백업 → 파일 쓰기 → `git update-ref refs/heads/master NEW OLD`(CAS) → `git reset -q`). ④ `verify-2.cjs`로 적용 전 상태 경로 전부 sha256 대조(잃은 파일 0).
- origin/master에 합친 세션이 할 일: 합친 직후 공용 작업본 master를 위 ②·③으로 바로 맞춘다. 미루면 다음 세션이 같은 조사를 다시 한다(10-17에 두 번).

### 가까운 이력 판 찾기가 스냅샷 가지에 가로채인다
- 증상: 작업본이 NEW 조상 커밋(`da431d3`)의 판과 똑같은 파일(`tests/synk-personal-media.test.js`)이 「어느 기준으로도 충돌」로 나온다.
- 원인: 같은 블롭을 가진 커밋이 여럿일 때 `git log --all` 첫 커밋(1차 스냅샷 가지, NEW 조상 아님)만 남겨, 그 가지와 NEW의 merge-base에는 그 파일이 없었다.
- 고침: 블롭별로 커밋을 모아 NEW 조상이 있으면 그것을 기준 커밋으로 쓴다(align.cjs 2차 판).
- 다시 확인: 같은 파일이 「기준 조상 da431d3, 결과=NEW」로 나오고 옮긴 뒤 `git status`에 안 보인다.

### 작업본이 OLD의 옛 판이면 3방향이 충돌한다
- 증상: 미커밋 「수정」으로 보이는 파일(`tools/synk-personal-build.js`)이 어느 기준으로도 충돌.
- 원인: 작업본이 OLD보다 오래된 판(작업본→OLD numstat에 지운 줄 0)이라 「수정」이 아니라 「되돌림」이다.
- 고침: 작업본→OLD에 지운 줄이 없으면 작업본 고유 내용이 없으니 NEW 판을 쓴다(align.cjs 0-b 규칙).
- 다시 확인: 옮긴 뒤 그 파일이 `git status`에 안 보인다.

### 공용 문서에 덧붙인 줄이 다른 세션의 통째 다시 쓰기로 사라진다
- 증상: 트랙 §1 항목 끝에 덧붙인 두 문장이 3시간 뒤 없다(파일은 CRLF 193줄 → LF 201줄로 바뀜).
- 원인: 다른 세션이 자기 판(옛 HEAD 기준)으로 파일을 통째로 썼다.
- 고침: 쓰기 직전 판을 바이트 그대로 읽어 그 줄 끝에만 끼우고(임시 파일 → 교체), 세션을 끝낼 때 `grep`으로 있는지 다시 본다.
- 다시 확인: `grep -c '10-17 C안' docs/_ops/트랙.md`가 0이 아니다.

### 로컬 master에 남의 미푸시 커밋이 있어 origin과 갈라졌다
- 증상: 10-18 「로컬 master도 origin이랑 맞춰줘」 때 로컬만 69커밋(다른 세션 미푸시·이미 restack으로 올린 커밋의 옛 번호 포함), origin만 43커밋이었다. 빨리감기가 안 되고, master를 origin으로 옮기면 남의 미푸시 커밋이 가지에서 빠진다.
- 원인: 세션마다 내 커밋만 origin에 다시 쌓아 올리고(restack) 로컬 병합은 「origin has other commits」로 건너뛰어, 같은 내용이 양쪽에 다른 번호로 쌓였다.
- 고침: `.tmp/master-align-20261018/align_merge.py`(계획만 → `--go`). `git merge-tree --write-tree`로 병합 트리를 만들고 충돌은 경로별 규칙(한쪽이 다른 쪽을 품으면 그쪽, 표·장부는 합집합, 「쓴 AI」 머리말은 잇기)으로 푼다. 바뀐 경로마다 작업본이 옛 HEAD 그대로면 새 판(작업본 줄끝 유지), 남의 미커밋 수정이면 3방향, 3방향이 부딪히면 줄 단위(한쪽만 고친 줄은 그쪽, origin에만 있는 새 묶음은 작업본에 같은 글이 없을 때만, 둘 다 다르게 쓴 줄은 작업본 판을 두고 기록) → 바이트 백업 → 병합 커밋(부모 로컬·origin) → master CAS → 그 경로만 공용 인덱스. 결과 `c3222446d`(71경로, 작업본 = 병합본 62, 3방향 9).
- 다시 확인: `git merge-base --is-ancestor origin/master master`, 3방향 파일마다 「백업의 작업본 고유 줄이 새 작업본에 다 있는지」(머리말을 이은 줄은 글이 들어 있는지). 둘 다 다르게 쓴 줄(10-18: 트랙 「자동화 3종 후속」)은 HEAD에 origin 판이 있으니 그 줄 주인 세션이 커밋 전에 합쳐야 한다.
- 함정(10-18 17:2x 두 번째 맞추기): `align_merge.py`의 충돌 규칙은 첫 병합의 충돌 6개에 맞춘 것이라, 다음 병합에 그대로 돌리면 트랙에서 다른 세션의 줄 2개(PULSE 뮤직비디오 포트폴리오·고객 화면 리디자인)를 지우는 계획이 나왔다. 계획 결과는 늘 `git diff <로컬 HEAD> <계획 트리>`로 보고 지워지는 줄이 없는지 확인한다. origin에만 있는 커밋이 내가 다시 쌓아 올린 커밋뿐이면, 그 변경이 로컬에 이미 다 들어 있는지(경로마다 blob 같음, 다른 파일은 「origin이 더한 줄이 로컬에 있고 뺀 줄이 없음」) 확인한 뒤 병합 트리 = 로컬 HEAD 트리로 `commit-tree -p HEAD -p origin/master` → `update-ref` CAS만 하면 된다(작업본·인덱스 안 건드림). 결과 `744ef19f7`.

### 공용 문서의 시험 숫자를 전체 치환하면 다른 작업 기록도 바뀐다
- 증상: 통화 시험189→190 갱신에 문서 전체 replaceAll을 써서, 다른 PULSE의 Linux189/189와 장애189.973초 기록까지 바뀌었다. 마감 대조에서 발견했다.
- 원인: 같은 숫자가 다른 항목의 시험·시간·해시에도 있다. 문서 전체 숫자 치환은 해당 작업 항목의 갱신이 아니다.
- 고침: HEAD와 공용 인덱스의 해당 문맥을 대조해 다른 기록 세 곳을 원래 값으로 되돌렸다. 이후 항목 제목/문맥으로 범위를 고정하고 그 범위의 정확한 문자열만 바꾼다.
- 다시 확인: 트랙의 다른 PULSE Linux189/189와 결정의 장애189.973초는 보존되고, 통화 항목/QA만190/190인지 함께 확인한다.

## 이력 훑기

### 큰 blob을 거른 클론에서 `git log -S`·`--find-object`가 「could not fetch」로 끝난다
- 증상: `git clone --bare --filter=blob:limit=1m`로 받은 이력(1MB 넘는 blob 1,787개 빠짐)에서 `GIT_NO_LAZY_FETCH=1 git log --all -S<값>`과 `--find-object=<blob>`이 `fatal: could not fetch <blob> from promisor remote`로 끝났다(10-17 클라우드 비밀값 점검). 환경 변수가 없으면 빠진 큰 blob을 하나씩 받으러 간다.
- 원인: 경로를 주지 않으면 모든 경로의 바뀐 blob을 읽는다(`-S`는 내용 비교, 이름 바뀜 탐지도 내용을 읽는다). 받지 않은 큰 blob에서 멈춘다. 둘 중 어느 쪽이 먼저 막혔는지는 가르지 않았다.
- 고침: 글 파일 경로로 좁히고 `--no-renames`를 붙인다: `GIT_NO_LAZY_FETCH=1 git log --all --no-renames --find-object=<blob> -- <경로>`. 이력 전체를 훑을 때는 `git rev-list --all --objects --filter=blob:limit=1m --missing=print`로 받은 blob만 골라(빠진 것은 `?`로 시작) `git cat-file --batch`로 읽는다.
- 다시 확인: 같은 클론에서 경로 없이 돌리면 fatal, 경로와 `--no-renames`를 주면 커밋 줄이 나온다.

### OneDrive의 텍스트 필터를 Git 이력 백업에 그대로 쓰면 정상 소스가 빠진다
- 증상: 10-18 첫 Git 자동보존 진단에서 플랫폼 정본 그림·앱 음성·WASM과 HTML `autocomplete` 문자열·로컬 시험용 토큰까지 차단돼 현재 master를 보존하지 못했다.
- 원인: OneDrive는 문서·소스만, Git은 승인 앱 자산까지 포함하는 서로 다른 범위인데 텍스트 전용 필터를 그대로 적용했다. 자격 이름의 단순 정규식도 실제 비밀과 시험 문자열을 구분하지 못했다.
- 고침: `tools/GitHub백업.cjs`는 커밋된 Git 정책의 용량·QA 산출물 검사를 재사용하고, 실제 원격에 없는 객체만 검사한다. 비밀 서명은 계속 막고 검토한 더미값은 정확한 경로·값 SHA로 한정한다. Git 기본 가지 대신 `refs/synk-backup/<SHA>`를 새로 만들고 원격 SHA를 재조회하며 원래 작업본·공용 인덱스를 건드리지 않는다.
- 다시 확인: `node --test tests/GitHub백업.test.cjs`의 원격 ref·인덱스 보존·중간 삭제 미디어·비밀·public 읽기 전용·PID 잠금 시험과 `.tmp/backup-four-20261018/github/`의 실제 원격 대조를 본다. 사용자 정의 참조는 일반 clone에 자동으로 들어오지 않으므로 [Git 보관 안내](../_ops/github-storage/README.md)의 fetch 복원 절차를 따른다.

### 정책상 올릴 수 없는 Git 이력은 암호화 bundle로 보존한다
- 증상: 과거 로컬 가지·stash 6개에 QA 출력과 큰 묶음이 남아 현재 소스는 보존됐어도 이력 전체는 자동백업에서 보류됐다.
- 원인: Git 저장 정책을 통과시키려고 파일을 빼거나 과거 커밋을 고치면 원래 이력의 복원이 달라진다.
- 고침: `git bundle create --version=2 - --stdin`의 표준출력을 기존 공개키 암호화 스트림으로 연결한다. 원래 이름 있는 ref와 SHA, Git PACK 체크섬, 원문·암호문 해시를 기록하고 필요한 원격 선행 커밋은 immutable ref로 고정한다. 암호문과 manifest는 Drive 20TB `Git-보관` 그룹에 보존한다. 두 파일의 실제 원격 검증 전에 성공으로 표시하지 않는다.
- 다시 확인: `tests/Git보관묶음.test.cjs`에서 임시 키로 왕복 복원·정확한 커밋/파일·손상된 PACK 거절·원격 영수증의 계정/시각/파일 해시 불일치 거절을 검사했다. 실제 자료는 평문 파일 없이 생성했고, 복호화는 사용자가 기존 암호를 입력하는 복원 시에만 수행한다.
