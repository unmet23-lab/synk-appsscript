# WORLD 선택 공개 — 11-24 02시 창 세 공개의 원천

이 커밋은 11-24 02시 창에 synk.im에 올리는 세 공개의 원천이다(설계 주인 11-23 「원천을 공개보다 먼저 올립니다」). master에는 공개 뒤에 3방향으로 합친다.

## 들어 있는 것

- `experiences/` 변경: 세 공개에 든 고침의 master 쪽 원천과 시험이다. 검수 -s3d · -s3e · -s3e1 고침, 입구 404 장면, 손님 게임 문 시험이 여기에 있다. 바탕은 이 커밋의 부모다.
- `후보/`: 검수한 최종 바이트와 공개 도구의 후보 명세(`후보.json`)다. 명세에는 경로마다 sha256, 앞 판 blob, 계획 해시, 후보를 지은 라이브 커밋(`위`)이 있다.
- `입력/step1/`: ③을 올릴 때 공개 도구에 주는 원본(`pub/`)과 기준(`pubbase/`)의 열세 파일, 공개 경로 목록(`items.txt`)이다.
- `대본/`: 후보를 지은 대본이다.

## 세 공개

| 공개 | 검수 사슬 | 검수한 후보 | 올릴 때 입력 |
|---|---|---|---|
| ③ (1) 열한 파일 | `atlas-world-step1-pub-20261123-s3e1b` | `후보/step1-1` — 계획 7d8cdada334c, 라이브 7dd7a9b 위 | `--원본 입력/step1/pub --기준폴더 입력/step1/pubbase`에 `--만` 열하나 |
| ③ (2) app-shell · home.css · HTML 셋 | `atlas-world-step1-pub-20261123-s3e2b` | `후보/step1-2` — 계획 2232d5f78040, 라이브 7dd7a9b 위. (1)이 라이브가 되기 전이라 `--허용 world/app-shell.mjs`로 지은 검수용이다 | 같은 입력에 `--만 world/app-shell.mjs --만 world/brand-opening/home.css`. HTML 셋의 `?v=` 토큰은 공개 도구가 바꾼다 |
| (2-1) 게임 사본 여덟 · HTML 넷 | `atlas-world-step2-pub-20261120-b` | `후보/step2-1` — 계획 88ae4573915b, 라이브 370aaa3 위 | 원본은 `후보/step2-1`의 사본 여덟과 같은 바이트다. HTML 넷의 토큰은 공개 도구가 바꾼다 |

올린 뒤 공개 커밋의 바이트는 `후보/<공개>/후보.json`의 sha256과 같아야 한다. 그사이 라이브가 같은 파일을 바꾸면 공개 도구가 3방향으로 합쳐 바이트가 달라지고, 검수 확인이 공개를 막는다.

## 지은 차례

- ③: master 1ebc932569를 꺼낸 사본(`D:/SYNK-worktrees/world-export-atlas-20261120b`)에서 `대본/wf3/step1.sh`의 차례로 지었다.
  - `cand.cjs`는 라이브 밖 커밋(첫날 끝 앞면)을 내 판에서 되돌리고, 바탕 A0(8fd4a3e8e^) · 라이브와 3방향으로 합친다.
  - `resolve.cjs`는 겹침을 손으로 푼 판을 쓰고, `pubprep.cjs`는 `pub/` · `pubbase/`를 만든다. 새 라이브에 다시 얹을 때는 `rebase-shell-c.cjs`를 썼다.
  - 그 뒤 검수 고침은 `대본/s3fix/edit-*.cjs`가 master 작업본과 후보 원본(cand-step1d → cand-step1e)에 같은 차이로 넣었다. 이름이 `-cand.cjs`로 끝나는 대본은 후보에만 넣은 고침이다. master에는 같은 뜻의 막이가 이미 있다.
  - 공개 도구 미리 보기는 `대본/s3fix/preview-s3e.sh`다.
- (2-1): 라이브의 옛 엔진 사본 여덟에 GC1(master 9af367c29b의 learning-sync `unsent()`)을 한 자리 끼웠다(`대본/wf3/gc1-copies.cjs`, 확인 `gc1-check.mjs`). 후보 폴더는 `대본/s2c/make-cand.cjs`와 명세 `spec-2-1g.json`으로 지었다.
- 대본의 절대 경로는 이 작업을 한 PC의 작업 자리다.

## 바이트

`후보/` · `입력/`의 파일은 `git hash-object --no-filters`로 넣어 바이트 그대로다. 대조할 때는 `git show <커밋>:<경로>`로 읽거나 `core.autocrlf=false`로 꺼낸다.
