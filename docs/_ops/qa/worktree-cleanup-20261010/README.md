# 워크트리 정리 (2026-10-10)

유호님 「웅 워크트리 정리안 만들어줘 워크트리 최대한 푸시하고 용량 확보해줘」(10-10 22시)에 따른 기록이다. 그날 아침 PC 공간 정리(GPT 100GB 정리)가 appsscript 워크트리 10곳의 추적 파일을 이미 지운 상태였다.

## 판단 기준

- **지금 쓰는 곳은 남긴다.** 그 경로를 쓰는 프로세스, 최근 세션 기록, 최근 커밋을 보고, 앱이 새 세션용으로 준비해 둔 워크트리도 남긴다.
- **남길 작업은 지우기 전에 origin에 올린다.** origin에 없는 커밋이나 origin과 다른 바뀐 파일·새 파일이 있으면 `backup/worktree-<이름>` 가지로 올린다.
  - 보관 커밋은 HEAD 위에 바뀐 파일과 새 파일을 그대로 담는다.
  - 정리로 지워진 추적 파일은 HEAD 판으로 둔다.
  - 보관용이라 master에 합치지 않는다.
- **올리기 전에 비밀값처럼 보이는 문자열을 찾았다.** 대상은 개인 키, 클라우드 키, 토큰, JWT, `service_role`이다. GPT 백업에서 걸린 `service_role` 세 곳은 「쓰지 말 것」이라는 문서 문장과 가짜 토큰 시험이었다.
- **지우기 직전에 다시 확인했다.**
  - 그 경로를 쓰는 프로세스가 없다.
  - 보관 가지의 파일 해시가 워크트리 파일과 같다.
  - 보관 없이 지우는 곳은 origin에 없는 커밋이 모두 로컬 master에 있고, 바뀐 파일이 origin과 같다.

## origin에 올린 보관 가지 (7)

| 워크트리 | 보관 가지 | 커밋 | 담긴 것 |
| --- | --- | --- | --- |
| `SYNK-worktrees/atlas-ledger-20261002` | `backup/worktree-atlas-ledger-20261002` | `091a47e30` | 바뀐 파일 8, 새 파일 3(Atlas 학습 장부, 10-02) |
| `SYNK-worktrees/atlas-ledger2-20261002` | `backup/worktree-atlas-ledger2-20261002` | `9b5ec005d` | 바뀐 파일 7, 새 파일 1 |
| `SYNK-worktrees/atlas-ledger3-20261002` | `backup/worktree-atlas-ledger3-20261002` | `9cfafa37d` | 바뀐 파일 4 |
| `SYNK-worktrees/atlas-account-memory-20261002` | `backup/worktree-atlas-account-memory-20261002` | `7577b232a` | 새 파일 7(synk-account 빌드 결과 5, QA 그림 2) |
| `SYNK-worktrees/atlas-review-20261002` | `backup/worktree-atlas-review-20261002` | `75861de41` | origin에 없는 커밋 7(그중 2개는 10-02 메인 미커밋 엔진 상태 사본), 새 파일 7 |
| `~/.codex/worktrees/atlas-account-sync/SYNK-appsscript`(GPT) | `backup/worktree-codex-atlas-account-sync-20261002` | `3e12c4441` | GPT 기준 사본 커밋 1, 바뀐 파일·새 파일 40(패치 두 개 포함) |
| `SYNK-worktrees/workspace-redesign-20261010` | `backup/worktree-workspace-redesign-20261010` | `17f2b6684` | 미추적 점검 사본 `company/qa/signal-care-browser.mjs` 1개. origin 커밋(`0f06e30e9`) 위에 담았다 |

## 지운 워크트리 (15)

여유 공간은 37.20GB에서 41.07GB가 됐다. 가지(branch)는 지우지 않았다.

- 위 보관 6곳.
- 남길 것이 없던 8곳:
  - `.claude/worktrees/laughing-merkle-17a9f0`
  - `.claude/worktrees/keen-kirch-d4b9b2`: origin에 없는 커밋 11개는 모두 로컬 master에 있다.
  - `~/.codex/worktrees/world-icon-output-20261002`
  - `SYNK-worktrees/atlas-api-source-20260922`
  - `SYNK-worktrees/interview-v4-close`
  - `SYNK-worktrees/lab-play-20261006`: 남은 연결 지점 `영상/node_modules`는 연결만 지웠다. 연결 대상인 메인 `영상/node_modules`는 그대로다.
  - `~/.codex/tmp/comment-dm-drive-monitor-20261008`: 바뀐 파일 2개가 origin과 같다.
  - `SYNK-worktrees/platform-signal-v2-20261010`:
    - Claude 플랫폼 작업은 origin(`ad76e8cef` 이후)에 들어가 있다.
    - 남은 파일은 메인 작업본 사본과 옛 QA 결과였다.
    - 기준선 사본 `876df8632`는 올리지 않았다.
- 메신저 세션이 다 쓴 뒤 지운 1곳(22:5x): `SYNK-worktrees/workspace-redesign-20261010`.
  - 메신저 세션이 6판을 반영한 뒤 「지워도 된다」고 알려 왔다. 그 가지의 마지막 커밋 `cbbec056f`와 같은 내용이 6판 커밋에 들어 있다.
  - 6판 커밋 두 개(로컬 `c3a5d0bae`·`4ec6941bf`)를 origin 위에 다시 쌓아 올렸다. origin에서는 `d054239f4`·`0f06e30e9`이고, 다섯 파일 모두 메신저 세션 판과 같다.
  - 미추적 점검 사본만 위 보관 가지에 담았다.
  - 기준선 사본 커밋 세 개(`ecdbe9f95`·`0364fb21f`·`171153435`)는 올리지 않았다. 그날 아침 공용 작업본의 미커밋 변경이 통째로 들어 있기 때문이다.
  - `experiences/spaceship-coop/`은 sparse 체크아웃 때문에 둔 사본이라 담지 않았다.
  - 여유 공간은 59.54GB에서 60.35GB가 됐다.

## 남긴 워크트리 (3)

- `.claude/worktrees/strange-wozniak-f57095`: 홈페이지 세션이 쓰는 중이다(21:43 기록).
- `.claude/worktrees/focused-villani-09429b`: 광고 영상 세션이 쓰는 중이다(영상 처리 실행 중).
- `.claude/worktrees/friendly-chaplygin-948277`: 앱이 새 세션용으로 준비해 둔 워크트리다. 앱이 관리한다.

## 남은 일

- **`.git/objects/pack/tmp_pack_n91LY6`(21.2GB) — 22:47에 지웠다.**
  - 10-10 08:54에 멈춘 git 임시 팩이다. 어떤 색인도 가리키지 않는 찌꺼기였다.
  - .git 안 파일이라 처음에는 자동 승인에서 막혔다(같은 날 GPT 정리 때도 막힘). 유호님 「웅 임시 파일 지워줘」를 받고 지웠다.
  - 지우기 직전 조건: 마지막 기록이 12시간 넘게 지났고, 그보다 먼저 시작한 git 프로세스가 없다.
  - 여유 공간이 38.5GB에서 59.7GB가 됐다. 그사이 다른 작업이 공간을 써서 41.07GB가 38.5GB로 줄어 있었다.
  - 지운 뒤 `git count-objects`·`git log`가 정상이다. 남은 임시 개체 41개(149MB)는 쓰는 중일 수 있어 두었다.
- **다른 저장소의 워크트리 — 그대로 두었다.**
  - 대상은 `SYNK-worktrees`와 `~/.codex/worktrees`·`~/.codex/tmp` 아래 SYNK-talk·synk-policy·SYNK-website 워크트리와 복제본 약 70곳이다.
  - 아침 정리로 거의 비어 있어 모두 합쳐 0.9GB 정도다.
  - 다수에 origin에 없는 커밋(1~10개)이 있다. talk은 push마다 CI가 돌기 때문에, 보관 가지를 올리면 CI가 수십 번 돈다. 따로 정한 뒤에 한다.

## 되살리는 법

```bash
git fetch origin backup/worktree-<이름>
git worktree add <새 폴더> origin/backup/worktree-<이름>
```
