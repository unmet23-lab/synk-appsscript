# 현장 노트 · git 줄끝·잠금·공용 작업본 · 지난 기록

> [git_줄끝_잠금](../git_줄끝_잠금.md)에서 2026-10-20에 옮긴 항목이다(글은 그대로, 상대 링크만 이 폴더에 맞춤). 도구가 이제 자동으로 막아 주거나(도구), 지금은 안 쓰는 옛 PC·판·절차 이야기거나(옛 판), 다시 오지 않을 한 번의 일(한 번)이다. 같은 증상을 다시 겪으면 그 항목을 원래 파일의 맞는 절로 되돌리고 고친다.

## 줄끝(CRLF·LF)에서 (2026-10-20)

### `tools/결정.js --추가`가 CRLF 결정 표에 LF 줄을 넣는다
- 증상: 결정을 넣은 뒤 git이 「LF will be replaced by CRLF」를 경고했고, 결정 표에서 LF만인 줄이 1개였다(10-18).
- 원인: 도구가 새 표 줄을 `\n`으로 끼운다. 작업본(`core.autocrlf true`)은 CRLF라 그 한 줄만 줄끝이 섞인다.
- 고침: 넣은 뒤 파일 전체를 CRLF로 맞춘다(`t.replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')`를 임시 파일 → rename). 10-19부터는 도구가 표 구간의 줄끝을 따라 새 줄을 넣는다(CRLF 표면 새 줄 끝에 `\r`을 붙임). 그 전에 섞인 작업본은 위처럼 한 번 맞춘다.
- 다시 확인: `(t.match(/(^|[^\r])\n/g)||[]).length`가 0이다. 도구 쪽은 `node --test tests/결정정본.test.js`의 「⑥-2」가 CRLF 정본에 넣은 뒤 CR 없는 줄바꿈이 0인지 본다(10-19 고치기 전 실패 → 고친 뒤 20/20).
- 옮긴 까닭(2026-10-20, 도구): `tools/결정.js`가 표 구간의 줄끝을 따라 새 줄을 넣고(168행) `tests/결정정본.test.js` ⑥-2가 CRLF 정본에서 지킨다

### 3방향 착지 스크립트가 그림을 글자로 다루면 줄끝을 바꿔 깨뜨린다
- 증상: 10-18 계정판 착지 미리 계산에서 새 jpg 두 장이 「줄 0→783 · CR 0→1470」으로 나왔다. 그대로 썼다면 그림 두 장이 깨졌다.
- 원인: 경로마다 `git show`를 utf8 글자로 읽고 「새 파일은 CRLF」 규칙으로 `\n`을 `\r\n`으로 바꾸는 착지 스크립트(공용 작업본 3방향 착지)가 바이너리를 가리지 않았다.
- 고침: 그림·글꼴·소리(`.jpg·png·webp·gif·woff2·ttf·mp3·mp4·wav`)는 `git show`의 바이트를 그대로 쓰고, 작업본에 다른 판이 있으면 충돌로 멈춘다. 쓰기 전에 합친 결과를 폴더로 꺼내 작업본과 diff해 내 줄만 더해졌는지 본다.
- 다시 확인: 착지 뒤 `cmp <(git show master:<그림>) <그림>`이 같다(10-18 두 장 통과).
- 옮긴 까닭(2026-10-20, 옛 판): `tools/master맞추기.js` 이전 손 착지 스크립트 이야기. 지금은 바이너리를 바이트로 다루고 양쪽이 바꾸면 멈춘다(시험 「바이너리…」)

### 서버 복사 원본인 systemd 단위는 끝 빈 줄 때문에 `--check`에 걸린다 (2026-10-19)
- 증상: 10-19 Argon 월요일 수집 단위 6개(`tools/argon-schedules/production-units/synk-argon-ultra-scan-*.service·timer`)를 별도 인덱스로 올리자 `git diff --cached --check`가 모두 `new blank line at EOF`로 멈췄다.
- 원인: 이 폴더의 단위는 10-18 커밋 판부터 파일 끝이 빈 줄로 끝나고(`tail -c 3`이 줄바꿈 셋), 서버 `/etc/systemd/system/`에 깔린 판의 복사 원본이다. 새 단위도 같은 꼴로 만들어 서버에 깔았다.
- 고침: 바이트를 고치면 저장소 판이 서버 판과 달라지므로 손대지 않았다. 커밋 스크립트에서 그 폴더 단위 파일의 「EOF 빈 줄」만 허용하고 다른 공백 오류는 그대로 막았다. 검사를 통째로 끄지 않는다.
- 다시 확인: 커밋 `557316313` 뒤 `git status --porcelain -- tools/argon-schedules`가 비어 있고(단위 blob = 작업본 바이트), 같은 커밋의 docs-io.py·run-check.py·alert-event.py·docs.json sha256이 서버 기록과 같다.
- 옮긴 까닭(2026-10-20, 한 번): 10-19 Argon 월요일 수집 단위 6개를 올릴 때 손 커밋 스크립트의 `--check`에 걸린 한 건. `내커밋.js`는 `--check`를 돌리지 않는다

## index.lock에서 (2026-10-20)

### 잠금이 저절로 풀리기도 해서 손으로 다시 돌리면 헛걸음한다
- 증상: 0바이트 잠금이 2분 안팎에 풀렸다가 사람 손으로 다시 돌리는 사이 새 잠금이 생긴다(10-03 두 번). 「잠금 없는 순간 기다리기」 고리가 남은 주인 없는 잠금 앞에서 10분 동안 헛돈다.
- 원인: Claude·Codex 앱이 변경 보기용으로 git을 수시로 돌려 잠금이 짧게 자주 생긴다(15분 감시에 30번, 각 0.5~2초).
- 고침: 한 스크립트 안에서 ① 지금 HEAD로 별도 인덱스 ② 0.2초 간격으로 잠금 없는 순간 기다리기(그사이 HEAD가 바뀌면 ①부터) ③ 곧바로 write-tree → commit-tree → update-ref ④ `git reset -q -- <내 경로>`를 성공할 때까지 다시 시도. 고리 안에서 잠금이 10초 넘게 그대로면 `node tools/git잠금.js --정리`를 한 번 부른다. 재시도 오류를 `2>/dev/null`로 버리지 말고 찍는다. 10-19부터 `tools/내커밋.js 커밋`이 이 고리를 그대로 한다(커밋 전 20초·reset 30초까지 기다림, ④가 끝내 안 되면 가지를 되돌림).
- 다시 확인: 고리가 끝난 뒤 `git diff --cached --name-only`가 비어 있다. 아니면 크게 알린다.
- 옮긴 까닭(2026-10-20, 도구): `tools/내커밋.js 커밋`이 잠금 없는 순간을 기다리고(커밋 전 20초·reset 30초) 주인 없는 잠금을 한 번 치우며 reset이 안 되면 가지를 되돌린다(`tests/내커밋.test.js` index.lock 시험)

### 연결 워크트리에서 `tools/git잠금.js`가 있을 수 없는 잠금 경로를 본다
- 증상: 10-19 `tools/내커밋.js`를 워크트리에서 시험하며 보니, `살피기()`가 `<워크트리>/.git/index.lock`을 봤다. 워크트리의 `.git`은 파일이라 그 경로에는 잠금이 생길 수 없어, 잠금이 있어도 늘 「잠금 없음」이 나올 판이었다(이것 때문에 난 사고는 확인하지 못했다).
- 원인: 잠금 경로를 `<저장소>/.git/index.lock`으로 박아 두었다. 연결 워크트리의 인덱스는 `<공용 .git>/worktrees/<이름>/index`다.
- 고침: `.git`이 폴더가 아니면 `git rev-parse --path-format=absolute --git-path index.lock`으로 묻는다(`tools/git잠금.js`의 `잠금경로`). 부르는 쪽이 경로를 알면 `살피기(저장소, { 잠금 })`로 넘긴다.
- 다시 확인: 워크트리에서 `node tools/git잠금.js --json`의 `잠금`이 `.git/worktrees/<이름>/index.lock`이다(10-19 확인, 옛 판은 `<워크트리>/.git/index.lock`).
- 옮긴 까닭(2026-10-20, 도구): `tools/git잠금.js`의 `잠금경로`가 연결 워크트리의 잠금 위치를 git에 묻도록 고쳐졌고 `tests/git잠금.test.js`가 확인한다

## 당기기·push에서 (2026-10-20)

### 작업본을 새 HEAD로 당길 때 남의 미커밋 수정이 옛 HEAD 위에 남는다
- 증상: 남의 미커밋 파일을 「남겨 두기」만 하면 그 세션이 나중에 통째로 커밋할 때 우리 변경이 조용히 되돌아간다(10-03 talk 정리).
- 원인: 남겨 둔 파일은 「옛 HEAD + 그쪽 수정」 상태다.
- 고침: 바뀐 경로마다 작업본이 NEW와 같으면 둠, OLD와 같으면 NEW로 씀, 둘 다 아니면 `git merge-file -p <작업본> <OLD> <NEW>`(LF로 맞춰 합친 뒤 원래 줄끝으로)로 합치고 충돌이면 손대지 않고 알린다. 덧붙이기만 하는 장부(`.jsonl`)는 줄 합집합. 생성 묶음(dist·atlas-learning 등)은 3방향 대신 커밋 판으로 덮는다. 순서는 파일 → master(CAS, 실패하면 파일 되돌림) → 그 경로만 공용 인덱스. 한 파일이라도 부딪히면 아무것도 얹지 않는다.
- 다시 확인: 얹기 전후 CR 개수가 줄마다 그대로이고, 남의 미커밋 줄이 작업본에 남아 있다.
- 옮긴 까닭(2026-10-20, 도구): `tools/master맞추기.js`가 남의 미커밋 수정을 가장 가까운 이력 판 기준 3방향으로 얹고 충돌이면 손대지 않는다(`tests/master맞추기.test.js`)

### 「트리는 로컬 그대로」 병합이 origin에만 있는 남의 커밋을 떨어뜨린다
- 증상: GPT가 origin에만 올린 커밋(1,568개 경로)이 로컬 master에서 빠졌다. 그대로 push했으면 origin에서도 지워질 판이었다(10-08).
- 원인: push 뒤 로컬 병합을 「트리는 로컬 판」으로 만들면서 origin 쪽 커밋을 조상으로만 품었다. `merge_local.py --renumber`도 번호 바꾼 파일을 origin 판으로 통째 덮어 로컬에만 있는 남의 줄을 지웠다(10-14).
- 고침: 병합 전에 `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 본다. 번호만 바꿀 때는 「로컬 판 + 번호 문자열 바꾸기」로 blob을 만든다. 로컬과 origin이 크게 갈라졌을 때 합친 기록과 도구는 `.tmp/origin-merge-20261009/scripts/`(`apply3.cjs`: 병합 트리 → 공용 작업본 3방향 → master CAS → 그 경로만 인덱스)·`.tmp/origin-sync-20261010/README.md`. 작업 중 origin이 계속 움직이면 머리가 바뀔 때마다 처음부터 다시 계산하고, origin에 올리는 세션에 잠깐 멈춰 달라고 한다.
- 다시 확인: 병합 커밋과 origin/master의 `git diff --stat`이 로컬에만 있는 커밋들의 변경뿐이다.
- 옮긴 까닭(2026-10-20, 도구): `내커밋.js 올리기 --합치기`는 origin의 남의 커밋이 바꾼 경로가 모두 로컬과 같을 때만, `master맞추기.js` 빠른 길은 그 변경이 로컬에 줄 단위로 다 있을 때만 「트리는 로컬 그대로」로 합친다

### push 직후 `merge_local.py`가 「origin has other commits」로 멈춘다
- 증상: 내 커밋을 `restack.py --push`로 올린 직후 `merge_local.py`가 `AssertionError: ('origin has other commits', 4)`로 멈췄다(10-17). 그사이 다른 세션이 origin에 세 커밋을 올렸다.
- 원인: 이 도구는 로컬 master에 없는 origin 커밋이 방금 내가 올린 것뿐일 때만 「트리는 로컬 그대로」로 합친다. 남의 push가 섞인 채 트리를 로컬로 두면, 로컬에 아직 없는 남의 줄이 병합에서 빠진다(10-17에는 결정 표·트랙의 줄이 그랬다).
- 고침: 억지로 합치지 않는다. `HEAD..origin/master`의 커밋마다 바꾼 경로가 로컬 트리와 같은지 보고, 하나라도 다르면 로컬 병합은 하지 않고 그대로 둔다(그 커밋을 올린 세션이 자기 병합 때 합치거나, 위 항목의 3방향 절차로 따로 맞춘다). 내 내용은 로컬의 원래 커밋에 이미 있으니 잃는 것은 없다. 10-19부터 `tools/내커밋.js 올리기 --실행 --합치기`가 이 확인을 한다(내가 방금 올린 커밋은 빼고 본다). 다르면 「건너뜀」과 다른 경로 몇 개를 내고 합치지 않는다.
- 다시 확인: `for c in $(git rev-list HEAD..origin/master); do git diff-tree --no-commit-id --name-only -r $c; done`로 나온 경로마다 `git rev-parse origin/master:<경로>`와 `git rev-parse HEAD:<경로>`가 같은지 본다.
- 옮긴 까닭(2026-10-20, 옛 판): 없어진 `merge_local.py` 이야기(10-17). `내커밋.js 올리기 --합치기`가 같은 확인을 한다

### `restack.py --renumber`로 번호를 바꾸면 그 줄을 다시 고친 다음 커밋이 실패한다
- 증상: 10-18 회원 혜택 커밋 8개를 `--renumber=`(로컬 번호 셋)으로 다시 쌓는데, 앞 커밋이 QA README에 적은 로컬 번호를 새 번호로 바꾼 뒤 같은 줄을 고친 다음 커밋이 「replace 묶음이 0곳」으로 실패했다. 트랙은 다섯 커밋 모두 실패했다.
- 원인: 지금 판(앞에서 쌓은 것)은 새 번호인데 다음 커밋의 부모·자기 판은 옛 번호라 그 줄이 서로 다르다. 트랙은 그 위에 다른 세션의 미푸시 문장이 줄마다 섞여 origin 판과 로컬 판의 줄이 아예 다르다.
- 고침: 3방향 전에 부모·자기 판에도 같은 번호 바꾸기를 먼저 한다(`merge3` 첫 줄에서 두 blob에 `renum` 적용). 이미 origin에 다른 번호로 올라간 로컬 커밋 번호(10-18 `47a1d1f60`으로 올라간 바탕 커밋)도 같이 바꾼다(`--map=옛:새`). 트랙은 `--skip=docs/_ops/트랙.md`로 커밋별 이식에서 빼고, 마지막에 origin 판의 그 줄에 내 문장만 정확히 한 번 바꾸는 커밋을 얹는다(바뀐 줄 수가 맞는지 확인). 로컬 병합은 origin 판으로 덮지 않고 「로컬 트리 + 번호 문자열 바꾸기」로 만든다. 공용 `.tmp/push-mine-20261013/restack.py`에는 아직 이 셋이 없다(10-18은 세션 사본으로 했다).
- 다시 확인: 올린 머리에서 `git grep <옛 번호>`가 0, 올린 트리를 풀어 관련 시험 통과, 로컬 병합 전후 차이가 번호 줄뿐이다(10-18: origin `b79545629..b5ffa068f`, 로컬 병합 `659ea4d03` 7파일 8줄).
- 옮긴 까닭(2026-10-20, 옛 판): 없어진 `restack.py --renumber` 이야기(10-18 회원 혜택 한 건)

### 결정 표에 행을 더한 커밋을 다시 쌓으면 `restack.py`가 「끼울 자리 못 찾음」으로 멈춘다
- 증상: 10-18 결정 표에 세 행을 더한 커밋(`add77ba8c`)을 `restack.py --commits=add77ba8c --renumber=`로 다시 쌓았는데, 결정 표만 「끼울 자리 못 찾음: '| 2026-10-17 | 확정 | [보안 · talk 운영 반영 …'」(merge-file 충돌 2)로 빠졌다. 나머지 문서 셋은 merge-file·transplant로 됐다.
- 원인: 내 행 앞뒤의 문맥 행이 다른 세션의 로컬 전용 커밋이 넣은 행이라 origin 판에는 없다. 결정 표는 맨 위에 행이 계속 끼어서 로컬 판과 origin 판의 행 순서도 다르다.
- 고침: 결정 표만 origin 판에 내 행을 직접 끼운다. 닻은 「내 판에서 내 행 다음에 오는 행 중 origin 판에도 있는 첫 행」이고, 내 판에서 표 맨 위 행이면 구분줄 바로 다음이다(`결정.js --추가`와 같은 자리). 10-19부터 `tools/내커밋.js 올리기`가 `.md`·`.txt`·`.jsonl` 등 문서에서 같은 닻(내 줄 다음에 오는 줄 가운데 원격에도 있는 첫 줄 앞)으로 끼운다. `.tmp/push-mine-20261013/restack_결정행.js <restack 머리> <내 커밋> --out=<결과> [--push]`가 restack 머리에 결정 표만 채워 같은 메시지·작성자로 다시 만든다. 이 도구의 결과 파일에는 `renumber.files`가 있어 `merge_local.py --res=<결과>`가 그대로 읽는다. restack.py 결과는 번호를 안 바꾸면 `renumber`가 `{}`여서 merge_local.py 9행 `res['renumber']['files']`에서 KeyError가 난다(10-18 코드로 확인).
- 다시 확인: 도구가 경로마다 「origin → 올린 커밋」의 더한·지운 줄이 「부모 → 내 커밋」과 개수까지 같은지 보고, 저장소 검사를 돌린다. 올린 뒤에는 `git ls-remote`가 올린 커밋인지 본다. 10-18: origin `a99182659..886739c24`(13파일 +1732/−4, 원래 커밋과 같음), 로컬 병합 `b8b32d744`(트리는 로컬 그대로).
- 옮긴 까닭(2026-10-20, 옛 판): 없어진 `restack.py`의 결정 표 끼우기 이야기. `내커밋.js 올리기`가 문서에서 원격에도 있는 다음 줄 앞으로 끼운다

### `restack.py`가 통과해도 끼운 줄 차례가 로컬과 다를 수 있다
- 증상: 10-18 저녁 내 커밋 21개를 다시 쌓을 때, 트랙 계정판 줄은 다섯 커밋 모두 「replace 묶음이 0곳」으로 멈췄다. 통과한 결정 표 두 행과 AI_CLI 한 절은 남이 그사이 origin에 먼저 올린 행·절보다 위에 끼워졌다. 로컬에서는 그 아래에 있었고, 줄 개수 검사는 통과했다.
- 원인: 끼울 자리를 내 커밋 부모 판의 앞뒤 줄로만 찾는다. 남이 나중에 올린 행은 부모 판에 없어서 내 행이 그 위(표 맨 위)로 들어간다. 줄 개수 검사는 차례를 보지 않는다. 트랙 줄은 origin 판에 다른 커밋 문장이 먼저 들어가 있어 줄째로는 찾지 못한다.
- 고침: `.tmp/push-mine-20261013/restack_close.py`를 쓴다. 끼울 묶음이 로컬 master 판에 한 번 있으면, 로컬에서 그 위로 올라가며 origin에도 있는 첫 줄을 찾아 그 뒤에 끼운다. 바꿀 줄이 origin 판에 없으면 머리(앞 40자)가 같은 줄 하나에 문장 단위로 옮기고 문장 개수로 검사한다. `verify_close.py`는 경로마다 올릴 판에만 있는 줄이 origin 바탕에 있던 줄인지, 바탕에 없던 내 줄이 로컬과 다른 자리에 있는지 본다. `push_close.py --commits=… [--tests=…]`가 쌓기 → 대조 → 저장소 검사 → 올릴 트리 그대로 시험 → 빨리감기 push를 한 번에 한다. origin이 그새 움직이면 git이 push를 거절하니 다시 돌린다. 10-19부터 쓰는 `tools/내커밋.js 올리기`는 같은 자리에 원격도 줄을 더했으면 원격 줄 다음에 내 줄을 둔다. 로컬 차례와 다를 수 있으니, 미리 보기가 「자리 맞춤」 경로마다 보여 주는 「<원격 줄>」 다음에 「<내 줄>」을 올리기 전에 본다. 올릴 트리로 시험을 돌리는 단계는 넣지 않았다.
- 다시 확인: 10-18 origin `4aa8622f9..24791684c`(21커밋·102파일). 대조에서 남은 차이는 origin과 로컬에서 남의 결정 행 두 개의 차례가 다른 것뿐이었고, 올릴 트리를 풀어 돌린 구독·혜택 시험 52개가 통과했다.
- 옮긴 까닭(2026-10-20, 옛 판): 없어진 `restack_close.py` 이야기. 지금은 미리 보기의 「자리 맞춤」 줄로 확인한다

## 이력 훑기에서 (2026-10-20)

### OneDrive의 텍스트 필터를 Git 이력 백업에 그대로 쓰면 정상 소스가 빠진다
- 증상: 10-18 첫 Git 자동보존 진단에서 플랫폼 정본 그림·앱 음성·WASM과 HTML `autocomplete` 문자열·로컬 시험용 토큰까지 차단돼 현재 master를 보존하지 못했다.
- 원인: OneDrive는 문서·소스만, Git은 승인 앱 자산까지 포함하는 서로 다른 범위인데 텍스트 전용 필터를 그대로 적용했다. 자격 이름의 단순 정규식도 실제 비밀과 시험 문자열을 구분하지 못했다.
- 고침: `tools/GitHub백업.cjs`는 커밋된 Git 정책의 용량·QA 산출물 검사를 재사용하고, 실제 원격에 없는 객체만 검사한다. 비밀 서명은 계속 막고 검토한 더미값은 정확한 경로·값 SHA로 한정한다. Git 기본 가지 대신 `refs/synk-backup/<SHA>`를 새로 만들고 원격 SHA를 재조회하며 원래 작업본·공용 인덱스를 건드리지 않는다.
- 다시 확인: `node --test tests/GitHub백업.test.cjs`의 원격 ref·인덱스 보존·중간 삭제 미디어·비밀·public 읽기 전용·PID 잠금 시험과 `.tmp/backup-four-20261018/github/`의 실제 원격 대조를 본다. 사용자 정의 참조는 일반 clone에 자동으로 들어오지 않으므로 [Git 보관 안내](../../_ops/github-storage/README.md)의 fetch 복원 절차를 따른다.
- 옮긴 까닭(2026-10-20, 도구): `tools/GitHub백업.cjs`가 Git 정책 검사를 재사용하도록 만들어졌고 `tests/GitHub백업.test.cjs`가 있다. 도구 설계 기록

### 정책상 올릴 수 없는 Git 이력은 암호화 bundle로 보존한다
- 증상: 과거 로컬 가지·stash 6개에 QA 출력과 큰 묶음이 남아 현재 소스는 보존됐어도 이력 전체는 자동백업에서 보류됐다.
- 원인: Git 저장 정책을 통과시키려고 파일을 빼거나 과거 커밋을 고치면 원래 이력의 복원이 달라진다.
- 고침: `git bundle create --version=2 - --stdin`의 표준출력을 기존 공개키 암호화 스트림으로 연결한다. 원래 이름 있는 ref와 SHA, Git PACK 체크섬, 원문·암호문 해시를 기록하고 필요한 원격 선행 커밋은 immutable ref로 고정한다. 암호문과 manifest는 Drive 20TB `Git-보관` 그룹에 보존한다. 두 파일의 실제 원격 검증 전에 성공으로 표시하지 않는다.
- 다시 확인: `tests/Git보관묶음.test.cjs`에서 임시 키로 왕복 복원·정확한 커밋/파일·손상된 PACK 거절·원격 영수증의 계정/시각/파일 해시 불일치 거절을 검사했다. 실제 자료는 평문 파일 없이 생성했고, 복호화는 사용자가 기존 암호를 입력하는 복원 시에만 수행한다.
- 옮긴 까닭(2026-10-20, 도구): `tools/Git보관묶음.cjs`와 `tests/Git보관묶음.test.cjs`가 있다. 도구 설계 기록

### 갈라진 이력의 같은 blob 때문에 푸시 저장소 검사가 중단된다
- 증상: 10-18 성과 수집 브랜치를 `origin/master`와 검사할 때 `New Git blob has no inspected path: dbdaf6adad65fccb196f17381e719858b958bbe2`로 중단됐다.
- 원인: 해당 `desktop/README.md` blob은 양쪽 끝에 이미 같은 값으로 있다. 검사기는 기준과 같은 경로·blob을 변경 목록에서 빼지만, 갈라진 커밋 범위의 객체 목록에는 이를 남겨 경로 대조가 실패한다. 이번 진단에서 경로 없는 110개 객체는 모두 기준 이력에 이미 있었고 실제 새 blob의 경로 누락은 없었다.
- 고침 상태: 검사기·정책을 우회하거나 이력을 바꾸지 않고 push를 보류했다. 최신 원격 기준의 별도 전달 브랜치를 정확하게 통합하거나 검사기의 이력 처리를 별도 수정한 뒤 전체 범위 검사를 다시 해야 한다.
- 다시 확인: 이번 작업 범위 `8cdb318b9→c0e5251b4`는 기존 검사기로 25파일·1,353,823바이트 통과했다. 이것은 `origin/master→c0e5251b4` 전체 푸시 검사를 대체하지 않는다. 전체 오류는 `.tmp/post-performance-stage1-20261018/push-storage-check.json`에 남겼다.
- 수정 확인(2026-10-18, GPT): 범위 검사에서도 기준 커밋에서 이미 도달 가능한 객체를 정확히 빼도록 고쳤다. 새 객체·중간에 추가했다가 삭제한 큰 객체·기존 바이트의 QA 경로 복제는 계속 검사한다. 기존 검사와 새 회귀 시험 20/20이 통과했고, 실제 `a99182659febbd57a37a0fbef66afea35288dba1 → 744ef19f76521ce7ae9205e227a82f01a449c431` 범위는 25,878,144바이트·위반 0으로 통과했다. 저장 정책·용량 한도는 바꾸지 않았다.
- 10-19 덧붙임(CI 부분 클론에서 2분 제한): 위 수정은 기준 커밋의 전체 이력 객체(이 저장소 약 12만 6천 개)를 `rev-list --objects`로 나열한다. CI는 blob:none 부분 클론에 `--allow-lazy-fetch`라 빠진 blob을 하나씩 받다가 git 명령 2분 제한에 걸려, 이 수정이 origin에 올라간 뒤(`cea43f847`) push마다 「check new Git storage payloads」가 `Git inspection failed (rev-list)`로 실패했다. 기준 나열에만 `--missing=print`를 붙여 빠진 객체는 받지 않고 `?<oid>`로 센다(`knownIds`). 다시 확인: 이 저장소를 `git clone --no-local --no-checkout --filter=blob:none --upload-pack="git -c uploadpack.allowfilter=true -c uploadpack.allowanysha1inwant=true upload-pack" file:///…`로 부분 클론하고(지연 받기용으로 클론의 `remote.origin.uploadpack`도 같은 값) `node tools/git-storage-check.cjs --base b7e8346bc --head cea43f847 --allow-lazy-fetch`를 돌리면 고치기 전 판은 121초에 그 오류, 고친 판은 PASS(65 blob·832,161바이트)다. `GIT_CONFIG_PARAMETERS`로 준 설정은 로컬 전송의 upload-pack에 닿지 않아 「filtering not recognized by server」로 전체 클론(7GB)이 된다. 시험은 `tests/git-storage-check.test.cjs`의 「partial clone range check does not download…」(고치기 전 판에서 실패).
- 옮긴 까닭(2026-10-20, 도구): `tools/git-storage-check.cjs`가 기준 객체를 정확히 빼도록(`knownIds`, `--missing=print`) 고쳐졌고 시험이 있다. 같은 오류 문구가 진짜 원인일 때는 「로컬 master를 통째로 push하면…」의 워크트리 가지 덧붙임을 본다

### 생성 지도의 원천 해시가 CRLF 작업본과 리눅스에서 다르다
- 증상: SNS 지도 시험(`verify-map`·`engagement/server`)이 리눅스 클론에서 원천 5개가 「바뀜」이라고 했다. 실제로 내용이 바뀐 것은 3개였다(10-17 클라우드).
- 원인: 지도 생성기가 Windows CRLF 작업본의 바이트로 해시를 쟀다. 같은 내용이 리눅스 체크아웃에서는 LF라 해시가 다르다.
- 고침: 원천 해시는 CRLF를 LF로 맞춘 바이트로 잰다(`build-map.mjs`의 `sourceHash`). 다른 생성 스냅샷도 같은 방식으로 잰다.
- 다시 확인: 리눅스 클론에서 `node --test docs/마케팅/온라인마케팅지도/verify-map.test.mjs`가 해시 시험을 통과한다.
- 옮긴 까닭(2026-10-20, 도구): `docs/마케팅/온라인마케팅지도/build-map.mjs`의 `sourceHash`가 CRLF를 LF로 맞춰 해시한다(6행)

## 워크트리·연결 폴더·공간 정리에서 (2026-10-20)

### `align.cjs`가 새 PC에 없다 — 갈라진 talk master는 `align_merge.py` 사본 + 이력 판 대조로
- 증상: 10-19 talk 공용 작업본 master(`f8e3ba7`, 남의 미푸시 커밋 1개)를 origin/master에 맞추려는데, 위 절차의 `align.cjs`(side-session-notes)가 노트북 교체 뒤 없고 git 이력에도 없었다. 10-18 appsscript용 `align_merge.py`를 그대로 돌리면 3방향 「resolved」가 옛 줄과 새 줄을 섞고(synkbrief 문서 절 순서가 뒤엉킴), 미추적 사본 20개를 「살펴볼 경로」로 멈춘다.
- 원인: `align_merge.py`는 OLD(로컬 master) 기준 3방향만 하고 「작업본이 이력 속 어느 판인지」를 보지 않는다. 공용 작업본에는 다른 세션의 옛 미추적 사본(origin 조상 판 그대로)과 GPT codex 가지 판이 섞여 있다.
- 고침: appsscript `.tmp/talk-master-align-20261019/`에 `align_merge.py`(REPO·RESOLVE만 바꾼 사본, 계획만) → `analyze.py`(경로마다 작업본과 가장 가까운 이력 판: 0줄 차이 + origin 조상 = 옛 판 → 새 판, 0줄 + 다른 가지 = 그 가지 판 → 손대지 않음, 차이 있음 → 그 판 기준 3방향) → `analyze3.py`(작업본이 더한 줄이 새 판에 있는지) → 문서·`.jsonl`은 손으로 만든 미리보기(`resolve_dm_doc.py`, 장부는 줄 합집합) → `apply.py --check`/`--go`(경로별 결정 고정, 쓰기 직전 해시 재대조, 백업, 병합 커밋 `commit-tree T -p 로컬 -p origin`, `update-ref` CAS, 계획 경로만 `reset --pathspec-from-file`, 적용 뒤 수정·미추적 전부 sha256 대조). 계획 뒤 origin이 움직이면 승인 계획을 보관하고 다시 계획해 「달라진 경로」만 따로 보인다.
- 다시 확인: 10-19 13:12 `f8e3ba7`→`d82c82e`(부모 로컬·`bd9dafa`, push 안 함), 199경로 중 쓰기 49·유지 150, 잃은 파일 0·계획 밖 변경 0·스테이징 0, synkbrief-dm 함수 파일이 운영 v68과 15/15 같음. 결과 `result.json`, 백업 `backup-20261019-131249/`.
- 10-19부터: talk 등 다른 저장소도 `node tools/master맞추기.js --저장소 <폴더>`로 맞춘다 — 위 사본 절차의 규칙(작업본과 가장 가까운 이력 판, 옛 판이면 새 판, 다른 가지 판은 손대지 않음)을 도구가 담았다.
- 옮긴 까닭(2026-10-20, 옛 판): 옛 PC의 `align.cjs`·`align_merge.py` 사본 이야기(10-19 talk). `master맞추기.js`(`--저장소 <폴더>`)로 대체됐다

## 쓴 기록

> 쓴 AI: Claude Code(Claude Opus 5.5) — 10-02~10-17 Claude 메모에서 옮김 · 클라우드 세션(리눅스) 10-17 더함 · Claude Code(Claude Opus 5.5) 10-18 결정 표 행 다시 쌓기 · Claude Code 10-19 공용 인덱스 reset 빠뜨림 재발 추가 · Claude Code 10-19 커밋·push 절차를 `tools/내커밋.js`로 옮김·워크트리 잠금 경로 추가 · GPT(Codex) 10-18 상태 출력 버퍼 한도 확인 · Claude Code 10-19 서버 복사 원본 단위의 EOF 빈 줄 추가 · Claude Code 10-19 통화 SDK 줄끝 항목 옮김(10-17 로컬 커밋 판)·워크트리가 같이 보는 origin/master 함정 · Claude Code 10-19 다시 쌓기를 파이프로 거른 함정 추가 · Claude Code 10-19 묵힌 커밋이 코드·생성 묶음에서 겹칠 때 다시 쌓기 · Claude Code 10-20 비밀값 경보 API·로컬 master에서 뜬 워크트리 맞추기 · Claude Code 10-20 자동 모드에서 워크트리 옮기기가 막힐 때 새 워크트리로 · Claude Code 10-19 master 맞추기를 `tools/master맞추기.js`로 옮김 · Claude Code 10-20 master맞추기 보강(겹친 절 정리·한쪽만 바꾼 경로 풀이·되풀이)
