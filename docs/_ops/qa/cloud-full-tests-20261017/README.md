# 클라우드 전체 시험 · 2026-10-17

> 쓴 AI: Claude Code(클라우드 세션) · 브랜치 `claude/determined-dijkstra-l3ygqn`
> 기준: `origin/master` `1676291ad`(10-17). **유호님 로컬에만 있는 최신 커밋 41개와 미커밋 변경은 이 결과에 없다.** 아래 「로컬 전용 파일」로 분류한 실패 상당수는 로컬 작업본에서는 통과할 수 있다. 반대로 로컬에서 그 41개 커밋이 이미 고친 것을 여기서 실패로 적었을 수도 있다.

## 환경

| 항목 | 값 | 로컬과 다른 점 |
|---|---|---|
| OS | Linux(x64) | 로컬은 Windows 11 · NTFS · CRLF 작업본 |
| Node | 24.22.0(공식 배포본을 scratchpad에 받아 씀) | 로컬 24.20 |
| Python | 3.13 · numpy · pillow · opencv-python-headless(이 세션에서 설치) | |
| ffmpeg | Ubuntu 6.1.1(`liboapv` 인코더 없음) | |
| npm 의존성 | 루트·`desktop`(Electron 바이너리 내려받기 생략)·`experiences/synk-account`는 `npm ci`, `tools/patent-studio`는 `npm install --no-package-lock` | |
| 없는 것 | 옆 저장소 `SYNK-talk`(이 세션 접근 목록에 없음), 실제 키, `C:/Users/q1212/...` 경로, Edge·Chrome 채널, gitignore된 큰 자산 | |

실행 방식: 파일마다 `node --test --test-reporter=tap --test-reporter-destination=<파일>`로 따로 돌렸다(묶음 안에서는 4~6개 병렬, 파일당 10분 제한). `tests/`·`desktop/tests/`는 각 패키지 뿌리에서, 나머지는 가장 가까운 `package.json` 폴더(없으면 시험 파일 폴더)에서 돌렸다. 실패한 파일은 한 번 더 돌려 같은 결과인지 봤고, 원인 커밋은 별도 worktree에서 `git bisect`로 찾았다(「시험을 마지막으로 바꾼 커밋 = 좋음」으로 두고 HEAD까지).

## 묶음별 결과

1차는 고치기 전, 2차는 이 브랜치의 고침 커밋을 넣은 뒤 Node 묶음 전체를 다시 돌린 값이다(9번째 `4c733cc19`는 2차 도중에 들어갔다 — ※※※). Python은 고친 것이 없어 다시 돌리지 않았고 합계에는 1차 값을 넣었다.

| 묶음 | 파일 | 1차 시험 / 통과 / 실패 / 건너뜀 | 2차 시험 / 통과 / 실패 / 건너뜀 |
|---|---|---|---|
| 루트 `tests/*.test.{js,mjs,cjs}` | 273 | 3,957 / 3,898 / 47 / 12 | 3,957 / 3,904 / 41 / 12 ※※※ |
| `desktop/tests/*.test.cjs` | 68 | 837 / 826 / 9 / 2 | 837 / 826 / 9 / 2 |
| `experiences/**`·`tools/**`(company-messenger·patent-studio·synk-id 등)·`docs/디자인` 시험 | 333 | 3,303 / 3,268 / 33 / 2 | 3,303 / 3,269 / 32 / 2 |
| `docs/마케팅` SYNK 시험(회사 업무실 282파일 포함) | 298 | 3,913 / 3,900 / 10 / 3 ※ | 3,913 / 3,900 / 10 / 3 ※ |
| Python `tests/*.py`(unittest) | 12 | 125 / 111 / 10 / 4 ※※ | 다시 돌리지 않음(1차 값) |
| **합계** | **984** | **12,135 / 12,003 / 109 / 23** | **12,135 / 12,010 / 102 / 23** |

※ docs/마케팅 실패 10건 중 `content-engine.test.mjs` 1건은 내 실행 위치 탓이다(저장소 뿌리 기준 상대 경로를 씀). 저장소 뿌리에서 돌리면 25/25 통과하므로 아래 실패 목록에서 뺐다. 실제 실패는 **108건**이다.
※※ `git-storage-restore.test.py`는 이름에 `-`가 있어 `python -m unittest`가 모듈로 못 불러 1건 오류로 셌다. `python3 tests/git-storage-restore.test.py`로 돌리면 20/20 통과한다(합계에는 20건 통과로 넣었다).
※※※ 2차의 `미니게임_목소리_흐름.test.cjs`는 실패 뒤 띄운 도구를 정리하지 못해 매달렸다(아래 `4c733cc19`로 고친 문제). 그 실행은 내가 멈췄고, 고친 시험을 따로 돌려 1건 실패(원인은 그대로 없는 `voice-request.json`)로 끝나는 것을 확인해 그 1건을 넣었다. 2차의 실제 실패는 docs/마케팅 실행 위치 1건을 빼면 **101건**이다.

**불안정(d)은 없었다.** 실패한 파일 전부를 한 번 더 돌렸을 때 모두 같은 시험이 같은 이유로 실패했다. 2차 전체 실행에서도 1차에 통과한 시험이 새로 실패한 것은 **없었다.** 1차와 2차의 실패를 시험 이름으로 대조하면, 2차에서 사라진 것은 정확히 이 브랜치에서 고친 7건이고 나머지 101건은 같은 시험이 같은 이유로 다시 실패했다.

## 분류 요약(실제 실패 108건)

| 분류 | 건수 | 이 브랜치에서 |
|---|---|---|
| (a) 코드 버그 | 18 | 1건 고침(dating 오류 코드). 실패 시험 밖에서 찾은 코드 버그 2개(미니게임 목소리 서버가 죽음, 교원 검수 시트의 hub 줄)도 고쳤다. 17건 보고만 |
| (b) 시험이 낡음 | 24 | 6건 고침, 18건 보고만(대부분 제품 판단이 필요한 「확인 필요」) |
| (c) 환경 탓(클라우드·리눅스·로컬 전용 파일) | 66 | 고치지 않음 |
| (d) 불안정 | 0 | |

건수는 시험(서브테스트) 단위다. 파일 하나가 통째로 못 뜬 경우는 1건으로 셌다.

## 이 브랜치에서 고친 것(커밋별)

| 커밋 | 분류 | 고친 내용 | 확인 |
|---|---|---|---|
| `ffd47b73d` | b | `tests/atlas-computer-runtime.test.mjs` — 고정물에 `request-security.mjs`를 복사한다. `store.mjs`가 10-09 `f12bef709`부터 import한다. | 7/7 |
| `0e4e65fe8` | a | `tools/미니게임_목소리.cjs` — `GET /`에서 화면을 먼저 만들고 머리를 보낸다. 화면 생성이 실패하면 머리를 두 번 써서 `ERR_HTTP_HEADERS_SENT`로 **로컬 서버 프로세스가 죽었다.** 이제 400 JSON으로 답한다. | 직접 띄워 `GET /`=400, `/status`=200, 프로세스 유지 |
| `e2e0a0a95` | b | `tests/synk-id-company-public.test.cjs` — 고객 로그인 런타임 확인에 임시 암호화 Store를 준다(10-14 `bfaf6d078`부터 필수). | 22/22 |
| `9414a4e22` | a | `experiences/atlas-lab/dating-account.mjs` — 토큰 갱신 중 자기 오류를 그대로 다시 던진다. 10-10 `7b2318e5c`부터 `tokenRequest`가 fetcher 안 예외를 전부 「로그인 서버에 연결하지 못했어요(NETWORK)」로 감싸서, **갱신 중 로그아웃은 「계정 연결이 바뀌었어요」 대신, 만료·폐기된 갱신 토큰(401)은 `AUTH_REQUIRED` 대신 재시도 가능한 NETWORK 오류로** 나갔다. 세션 정리 자체는 됐다. 실제 오프라인은 그대로 NETWORK. 시험에 401 → `AUTH_REQUIRED` 단언을 더했다. | 16/16, 고치기 전 코드에서 새 단언 실패 확인 |
| `5994a8503` | b | `tests/sync-atlas.test.js` — Talk 복사 목록에 `trail-member-observations.js`·`trail-periods.js`를 더한다(10-16 `8ab56fb91`에서 account-summary가 require). 동기화 도구는 이미 맞게 복사한다. | 12/12 |
| `d617cd65c` | b(+a) | `tools/교원검수시트.js` — 문항이 없는 항목(learning-hub 「모든 미니게임과 상점」)에는 「게임↔상황」 줄을 만들지 않는다. 시험 기대값을 「여덟 게임 + 바람길 두 상황 = 9」로 바꾸고 hub가 없음을 단언한다. 10-10 hub, 10-17 말 랠리 추가가 원인. `docs/교원검수/교원검수시트.csv`는 다시 굽지 않았다. | 12/12 |
| `bba65bd82` | b | `tools/company-messenger/tests/deadline-overlaps-client.test.mjs` — 10-13 `c32ebd1dd` 문구 감사로 「고객 합의 기한」이 「합의한 전달일」이 됐다. 회사 쪽 시험은 같이 고쳤고 메신저 쪽만 남아 있었다. | 10/10 |
| `d580a6ca9` | b | `tests/지면폰트.test.js` ④ — 10-10 `327c3af5e`에서 지운 `docs/교차검수_재설계_정찰_2026-09-02.html`을 목록에서 뺀다(시험 문구가 그렇게 하라고 한다). ⑦은 남김. | 7/8(⑦만 실패) |
| `4c733cc19` | (위생) | `tests/미니게임_목소리_흐름.test.cjs` — 시작 확인이 실패하면 띄운 도구를 끈다. `0e4e65fe8`로 도구가 더는 죽지 않게 되자, 이 시험은 실패할 때 도구를 정리하지 못해 제한 시간까지 매달렸다. 실패 문구에 화면 응답(없는 `voice-request.json`)을 싣는다. | 0.5초 안에 실패로 끝나고 남는 프로세스 0 |

시험을 지우거나 건너뛰게 바꾼 것은 없다. `지면폰트` ④는 없는 파일 한 줄만 목록에서 뺐다.

## 가장 중요한 실패

1. **개인 공개판 빌드가 멈춘다** — `tests/prepare-personal-public.test.mjs` 11건 전부(a). 10-16 `8ab56fb91`(회원 이해)이 공용 모듈 경로에 `experiences/synk-account/src/member-activity-data.mjs`·`member-understanding-data.mjs`를 넣었는데 `tools/prepare-personal-public.mjs`의 공개 허용 목록에 없다. 앨범·리허설·여행 공개판을 다시 만들면 esbuild가 「Module outside the public source allowlist」로 멈춘다. 공개 범위를 넓히는 일이라 손대지 않았다. → 두 모듈이 공개판에 실려도 되는지(학습 답·개인 성향이 안 들어가는지) 확인한 뒤 허용 목록에 넣고 시험의 출처·출력 해시 기대값을 갱신하거나, 공개판에서는 그 import가 안 걸리게 진입점을 나눈다.
2. **dating 단독 패키지가 시작되지 않는다** — `tests/atlas-dating-package.test.mjs` 2건(a). 10-14 `1e780b442`에서 `experiences/learning-hub/server.mjs`가 `../spaceship-coop/server.mjs`를 정적 import한다. dating 전용 모드에서는 `datingOnly ? null : createRoomHandler(...)`로 쓰지도 않는데, 정적 import라 격리 패키지(파일 57개 목록)에서 `ERR_MODULE_NOT_FOUND`로 죽는다. → 권장: `datingOnly`가 아닐 때만 `await import('../spaceship-coop/server.mjs')`. 그러면 패키지 표면과 시험 수치(32파일)를 그대로 지킨다.
3. **회사 SNS 지도 스냅샷 해시가 CRLF에 묶여 있다** — `docs/마케팅/온라인마케팅지도/verify-map.test.mjs`·`engagement/server.test.mjs`(c, 그러나 고칠 가치 큼). `verification-data.json`의 `inputs/content-lines.json` 해시는 CRLF 바이트의 sha256(`e249a48d…`)과 정확히 같고, 저장소(LF) 바이트는 `45b95d49…`다. Windows 작업본에서만 맞고 리눅스·CI·클라우드에서는 항상 「지도 생성 뒤 바뀜」(staleSources 5)이 된다. → `build-map.mjs`와 두 검사가 해시 전에 줄끝을 LF로 맞추게 하거나, 그 입력에 `.gitattributes`로 `eol` 고정.

그 밖에 눈여겨볼 것: `tools/davinci-s26u-one-video.py`가 09-18 `11157567c`에서 지운 `컷편집_리듬정본_20260910.md`를 필수로 요구해 S26U 컷 준비가 어디서든 실패한다(a, Python 3건).

## 실패 목록

분류: a 코드 버그 · b 시험이 낡음 · c 환경 탓 · ✅ 이 브랜치에서 고침. 「원인 커밋」은 bisect로 찾은 첫 실패 커밋이다. 「자기 커밋부터」는 시험을 마지막으로 바꾼 커밋에서 이미 실패했다는 뜻이다.

### 루트 `tests/`(21파일 · 47건)

| 파일 | 시험(건수) | 오류 요지 | 분류 | 원인 · 고칠 방법 |
|---|---|---|---|---|
| `atlas-computer-runtime.test.mjs` | missing or broken adapter…(1) | `request-security.mjs` 못 찾음 | b ✅ | 위 `ffd47b73d` |
| `atlas-consultation-evaluation.test.mjs` | fewer questions alone cannot pass…(1), version 2 preserves…(1) | 예산이 이제 누락되지 않음 · Atlas 질문 수 38 ≠ 32 | b | `001d225cf`(10-08) 「가치 기반 질문 뒤 미응답 필수 확인을 같은 카드에서 묻는다」. 시험 2의 전제(예산을 안 물음) 자체가 사라졌다. 새 정책 `computer-question-value-4` 기준으로 요약 수치를 다시 내고, 「질문만 줄여서는 통과 못 한다」를 보여 줄 새 사례를 고른다. |
| `atlas-dating-account.test.mjs` | renewal is single-flight…(1) | 「바뀌었어요」 대신 「연결하지 못했어요」 | a ✅ | 위 `9414a4e22`(원인 `7b2318e5c`) |
| `atlas-dating-backup-restore.test.mjs` · `atlas-dating-central-lifecycle.test.mjs` · `atlas-dating-reconcile-export.test.mjs` | 파일 전체(각 1) | `../../SYNK-talk/...` 못 찾음 | c | 옆 저장소 SYNK-talk 필요 |
| `atlas-dating-package.test.mjs` | explicit package list…(1), isolated package starts…(1) | 의존 그래프 34 ≠ 32 · `spaceship-coop/server.mjs` 못 찾음 | a | 「가장 중요한 실패」 2 |
| `path-travel-server.test.mjs` | 로컬 여행 서버…(1), 여행 계정 서버…(1) | `/planner-ui.mjs`·`/planner-login-draft.mjs` 404 | c | `server.mjs`가 공개하는 `planner.html`·`planner.css`·`planner-ui.mjs`·`planner-origin.mjs`·`walking-router.mjs`·`planner-account-session.mjs`가 git에 한 번도 없다(10-14 `1e780b442`가 일부만 커밋, 자기 커밋부터 실패). 로컬 작업본에서 커밋할 것. |
| `prepare-personal-public.test.mjs` | 11건 전부 | 공개 허용 목록 밖 모듈 2개 | a | 「가장 중요한 실패」 1(원인 `8ab56fb91`) |
| `strata-situation-examples.test.js` | a sentence taken from a game…(1) | `ex-travel-order-3` 「따뜻한 커피 대신 차…」가 게임 글에 없음 | b | `e05f03ad1`(10-08)이 주문 폭주 o09를 「커피 대신 따뜻한 차 한 잔 주세요.」로 다시 썼다(잔 데이터도 뜨거운 차). `strata/topik-i.situation-examples.json` 32행과 시험 102행을 새 문장으로 바꾸면 된다. Strata는 콘텐츠AI 원천이라 손대지 않았다. 또 `experiences/order-rush/qa/audio-assets.json`의 o09가 옛 문장이라 **게임 음성이 옛 문장일 수 있다** — 확인 필요. |
| `sync-atlas.test.js` | Talk receives exactly…(1) | 복사 목록에 trail 파일 2개 더 있음 | b ✅ | 위 `5994a8503` |
| `synk-id-company-public.test.cjs` | apply preserves…(1) | 「암호화 영구 저장소가 필요합니다」 | b ✅ | 위 `e2e0a0a95` |
| `synk-id-provision-guard.test.cjs` | 파일 전체(1) | `/home/user/SYNK-talk/lib/자격증명.js` 없음 | c | SYNK-talk 필요 |
| `계정컬렉션.test.js` | 26개 실물…(1), 26장과 모아보기…(1), 완성 조합…(1) | `_검토/*.json` 없음 | c | `.gitignore` 208행 `**/_검토/` |
| `교원검수시트.test.js` | the sheet lists…(1) | 게임↔상황 10 ≠ 8 | b(+a) ✅ | 위 `d617cd65c` |
| `교재읽기본.test.js` | 삭제된 원고를 복원하지 않고…(1) | `adc049af2…:docs/_archive/…원고_v2.md`를 못 읽음 | c | 그 커밋이 origin 어느 이력에도 없다(전체 이력을 받은 뒤에도 실패, 개별 fetch도 안 됨). 로컬 저장소에만 있는 객체다. 보존 커밋을 태그로 push하거나 원문을 Git 자산 보관으로 옮긴다. |
| `라디오오버레이층.test.js` | 기본 편성은…(1) | `docs/Loom_자산/...webp` 없음 | c | `docs/Loom_자산`이 git에 없다(로컬 자산) |
| `미니게임_목소리.test.cjs` | 10건 | `experiences/beginner-games/voice-request.json` 없음 | c | 그 파일이 git에 한 번도 없다. 로컬 작업본에서 커밋할 것. |
| `미니게임_목소리_흐름.test.cjs` | 가짜 Typecast로…(1) | `fetch failed` | c(+a ✅) | 같은 파일이 없어 도구의 `GET /`가 실패했고, 그때 **도구 서버가 죽었다**(위 `0e4e65fe8`로 고침). 고친 뒤에는 400 응답에서 토큰을 못 찾아 실패한다. 실패하면 띄운 도구가 남던 위생 문제도 `4c733cc19`로 고쳤다. |
| `비전동기화.test.js` | 10-02 개인화 엔진…(1), 선택적 부연은…(1) | SHIFT 표제가 「기업이 AI와 개인화 기술을 자기 업무와 고객 서비스에 활용하도록 돕습니다.」로 바뀜 | b(확인 필요) | `2a06f31ed`(10-14 공용 문서 일괄 커밋)에서 `docs/비전_정본.md`가 바뀌었고 `SYNK_철학.md`도 새 문장이다. 새 문장이 확정이면 시험의 고정 문장을 바꾸고, 아니면 정본을 되돌린다. 유호님 확인이 필요해 손대지 않았다. |
| `지면폰트.test.js` | ④ 서체를 심은 지면…(1) | 없는 지면 1벌 | b ✅ | 위 `d580a6ca9` |
| 〃 | ⑦ SUIT를 이름으로 부르는 지면…(1) | 33벌(150벌 중)이 이름만 부르고 서체를 안 실음 | a | 자기 커밋(10-03)부터 실패. 시험이 출력하는 `node tools/lib/브랜드폰트.js --심기 <지면들>`로 심는다. docs 지면이라 손대지 않았다. |

### `desktop/tests/`(7파일 · 9건)

| 파일 | 시험(건수) | 오류 요지 | 분류 | 원인 · 고칠 방법 |
|---|---|---|---|---|
| `development-catalog.test.cjs` | a signed-in account with no menu grants…(1) | 9 ≠ 8 | b(확인 필요) | `8da81b43c`(10-14)가 런처에 `insight` 앱을 더했다. |
| `renderer-personalization.test.cjs` | first start…(1), self-selected use contexts…(1) | 순서에 `insight` 추가, 10 ≠ 9 | b(확인 필요) | 같은 원인 |
| `renderer-state.test.cjs` | local preferences…(1), nine apps preserve…(1) | `insight: null` 추가, 앱 목록 | b(확인 필요) | 같은 원인. 목록만 바꾸면 「nine apps preserve two packages, six local previews…」의 분류 수(10 ≠ 9)에서 다시 걸린다 — `insight`를 로컬 미리보기·혜택·설치형 중 무엇으로 셀지 정해야 해서 손대지 않았다. |
| `lifecycle.test.cjs` | newer launch-only pins…(1) | `canLaunch` false | c | 설치 경로를 `path.win32`로 만들어 리눅스에서는 `desktop/` 안에 `\tmp\synk-lifecycle-…\…exe` 같은 **역슬래시 이름 파일을 남긴다**(돌릴 때마다 생겨 지웠다). Windows 전용 시험이면 `process.platform !== 'win32'`일 때 건너뛰는 조건을, 아니면 임시 폴더를 플랫폼 경로로. |
| `messenger-cloud-preview.test.cjs` · `world-cloud-preview.test.cjs` | CLI opt-in is explicit…(1), WORLD CLI flag…(1) | 「Use --client=…」 대신 「Unsupported build target」 | c | `tools/package.cjs`의 플랫폼 기본값이 `process.platform`(linux)이라 대상 검사에서 먼저 멈춘다. 시험 인자에 `--platform=win32`를 넣으면 플랫폼과 무관해진다. |
| `native-logout-provider.test.cjs` | 파일 전체(1) | `C:/Users/q1212/.../artifacts/...auth-service.cjs` 없음 | c | 로컬 산출물 경로를 박아 둠 |

### `experiences/**`·`tools/**`(23파일 · 33건)

| 파일 | 시험(건수) | 오류 요지 | 분류 | 원인 · 고칠 방법 |
|---|---|---|---|---|
| `experiences/20260909/pulse/qa/story-browser.test.cjs`, `experiences/brand-opening/qa/{home-doors,home-town,tutor-choice-sync}.test.mjs`, `experiences/synk-world-app/qa/{cafe-static,daily-tutor-static,home-tutor-static,life-tutor-static}.test.mjs` | 파일 전체(각 1, 8건) | `C:/Users/q1212/.cache/codex-runtimes/.../playwright` 못 찾음 | c | Playwright 경로를 박아 둔 파일이 저장소에 254개다. 경로만 이 컨테이너의 Playwright 1.62로 바꾼 임시 사본으로도 돌려 봤으나 msedge 채널, `C:/Users/.../server.cjs`, `qa/.tmp/...world-config.json`이 더 필요해 모두 실패했다. → `PLAYWRIGHT_MODULE` 같은 환경 변수를 먼저 보고 없을 때만 Codex 경로를 쓰는 공용 해석기를 두면 클라우드·리눅스에서도 돈다. |
| `experiences/synk-world-app/qa/{account-browser,daily-tutor-store,life-progress-store,tutor-selection-store}.test.mjs` | 파일 전체(각 1, 4건) | `SYNK-talk/...` 못 찾음 | c | SYNK-talk 필요 |
| `experiences/synk-world-app/qa/tutor-switch-20261011/backend-life-20261012/candidate-contract.test.cjs` | 파일 전체(1) | `.tmp/tutor-life-backend-20261012/candidate-runtime.cjs` 없음 | c | 로컬 `.tmp` 산출물 |
| `experiences/korean-racing/tests/coastal-rocks.test.mjs` · `vehicles.test.mjs` | 파일 전체(1), shipped GT low detail…(1) | `assets/*.glb` 없음 | c | `.gitignore` `*.glb` |
| `experiences/learning-hub/server.test.mjs` | beginner games expose…(1), shared origin serves…(1) | 404 | c | `spaceship-coop/starbook.mjs` 등 입문 게임 파일이 git에 없다(자기 커밋 `1e780b442`부터 실패). |
| `experiences/path-vr/tests/interview-mount.test.mjs`(3) · `interview-pages.test.mjs`(5) · `interview-server-package.test.mjs`(2) | 10건 | `*.mp4`·`vosk-model-…tar.gz`·`.tmp/path-interview-pages/...` 없음, 「Required public file is not approved」 | c | `*.mp4`·`*.tar.gz` gitignore, `.tmp` 빌드 산출물. 승인 거절도 없는 파일 때문이다. |
| `experiences/play-common/collection.test.mjs` · `kit.test.mjs` | 각 1 | `experiences/word-magic/collection.js`·`kit/` 없음 | c | git에 한 번도 없다(로컬 작업본에서 커밋할 것) |
| `experiences/synk-account/tests/member-benefits.test.mjs` | benefits are discoverable…(1) | 목록에 `subscriptions` 추가 | b(확인 필요) | `d27596c6c`(10-17) AI 구독 계정판을 공용 혜택 목록(`desktop/renderer/benefits.mjs`)에 넣었다. 웹(synk-account) 혜택 화면에도 PC 전용 계정판을 보일지 정한 뒤 시험 목록을 갱신하거나 웹에서 거른다. |
| `experiences/synk-account/tests/shared-server.test.mjs` | path serves…(1), secret-bearing…(1) | CSP `connect-src`에 ` blob:` 추가 | b(확인 필요) | `1e1db9a37`(10-12 PATH 몰입 면접)이 음성 모델 워커용으로 `blob:`을 더했다. 보안 단언이라 `blob:` 허용을 확인한 뒤 정규식을 바꾼다. |
| `tools/company-messenger/tests/deadline-overlaps-client.test.mjs` | today displays…(1) | 「고객 합의 기한」 없음 | b ✅ | 위 `bba65bd82` |

### `docs/마케팅`(9파일 · 9건)

docs 아래는 동시에 도는 문서 정리 세션과 겹칠 수 있어 하나도 고치지 않았다.

| 파일 | 시험(건수) | 오류 요지 | 분류 | 원인 · 고칠 방법 |
|---|---|---|---|---|
| `맞춤도구/manual/rules.test.js` | 그림 안내…(1) | 「공개 빌드에 assets/gpt-guide-1-sidebar.webp」 | b | `209d50e8c`(10-14)가 `build.mjs`의 manual 줄 앞에 `theme: 'scrapbook',`을 넣어 시험의 `/^\s*manual: \{ out: 'builds\/manual'/`이 그 줄을 못 찾는다. 그림은 그대로 목록에 있다. 정규식을 `/^\s*manual: \{.*out: 'builds\/manual'/`로. |
| `맞춤도구/meeting/rules.test.js` | 영상에서 약속한 자료…(1) | `meeting-kit.zip` 없음 | c | `.gitignore` `*.zip` |
| `온라인마케팅지도/engagement/company/growth-home-client.test.mjs` | history navigation…(1) | `social` ≠ `marketing` | b(확인 필요) | `bfaf6d078`·`fe143956c`(10-14) SNS 작업 공간에서 레일 탭 `marketing`이 `social`이 됐다. |
| `…/company/marin-home-client.test.mjs` | a home refresh preserves…(1) | 레일 정규식에 `data-tab="marketing"` | b(확인 필요) | 같은 원인. 일괄 커밋 `bfaf6d078` 자체에서 이미 실패. |
| `…/company/demo-messenger-navigation.test.mjs` | desktop context stays visible…(1) | 「desktop navigation remains available」 | b(확인 필요) | 일괄 커밋 `bfaf6d078` 자체에서 이미 실패. 같은 개편으로 보이나 확인 못 함. |
| `…/company/server-client-startup-templates.test.mjs` | HTTP apply rejects a session revoked…(1) | 403 ≠ 401 | b 또는 a(요약표에는 b로 셈) | `bfaf6d078`부터. 본문을 받는 중 폐기된 세션이 401(다시 로그인) 대신 403(권한 없음)으로 나간다. 의도한 변경인지 확인 필요. |
| `온라인마케팅지도/engagement/server.test.mjs` | daily post and follower records…(1) | `staleSources` 5 ≠ 0 | c(줄끝) | 「가장 중요한 실패」 3과 같은 해시 대조 |
| `온라인마케팅지도/verify-map.test.mjs` | the built snapshot records hashes…(1) | `inputs/content-lines.json changed after the map was built` | c(줄끝) | 「가장 중요한 실패」 3 |
| `클라이언트_발주서_20260930/tests/receiver-build.test.cjs` | online HTML protects…(1) | `dist/SYNK_영상제작_발주서.html` 없음 | c | 빌드 산출물이 git에 없다. 빌드를 먼저 돌리는 시험이면 시험 안에서 빌드하거나 전제 조건을 적는다. |

### Python `tests/*.py`(4파일 · 10건)

| 파일 | 시험(건수) | 오류 요지 | 분류 | 원인 · 고칠 방법 |
|---|---|---|---|---|
| `test_davinci_s26u_editorial.py` | test_reference_copy_is_versioned…(1) | 「컷 편집 기준 파일이 없습니다」 | a | `tools/davinci-s26u-one-video.py`가 `컷편집_리듬정본_20260910.md`(스크립트 옆 또는 `docs/홍보물/기업소개20초_20260909/`)를 필수로 찾는데, 09-18 `11157567c` 문서 정리에서 지워졌다(133줄). 문서를 되살리거나(`git show 11157567c^:docs/홍보물/기업소개20초_20260909/컷편집_리듬정본_20260910.md`) 도구가 다른 정본을 가리키게 한다. |
| `test_davinci_s26u_free_prepare.py` | test_real_apv_and_h264_without_proxy(libx264)(1), test_real_hevc10_hqx_proxy_cli_and_repeat(1) | 같은 오류 | a | 같은 원인 |
| 〃 | test_real_apv_and_h264_without_proxy(liboapv)(1) | `Unknown encoder 'liboapv'` | c | 이 ffmpeg에 APV 인코더가 없다 |
| `test_davinci_s26u_setup.py` | test_cache_path_separators_match(1) | `C:/test/cache` ≠ `C:\test\cache` | c | `os.path.normcase`는 리눅스에서 역슬래시를 바꾸지 않는다. Resolve는 Windows에서만 도는 도구다. 플랫폼과 무관하게 하려면 `ntpath`로 비교. |
| `test_drive_mascot_archive.py` | 5건 | `'os.stat_result' object has no attribute 'st_file_attributes'` | c | Windows 전용 속성(재해석 지점 검사) |

## 돌리지 않은 것과 이유

| 대상 | 이유 |
|---|---|
| `tests/*-smoke.mjs` 40개 | `node --test` 시험이 아니고, 40개 모두 `C:/Users/q1212/...` Playwright 경로를 박아 둔 브라우저 스모크다. |
| `tests/clasp-guard.check.js` | 파일 머리말에 「옛 행동을 재고 있어 반드시 어긋난다(09-09 게이트 완화)」고 적힌 수동 점검이고, 훅이 `node --test tests/`를 다시 부르는 구조라 돌리지 않았다. |
| `docs/마케팅/.../video-v3/.agents/skills/**` 55개, `.claude/skills/last30days/**` | 외부 skill 사본(hyperframes·last30days)이다. |
| `npm test`(`tools/test-ci.js`) 자체 | 같은 `tests/*.test.js`를 돈다. 나는 `.mjs`·`.cjs`까지 포함해 파일별로 돌렸다. `test-ci.js`는 `.test.js`만 돈다는 점도 적어 둔다 — `tests/`의 `.mjs` 134개·`.cjs` 29개는 `npm test`에 안 들어간다. |
| 각 폴더의 브라우저 QA 스크립트(`qa/*.cjs` 흐름, `verify-*.mjs`), `tools/patent-studio`의 `test:browser`·`test:live`, 영상(Remotion)·Unity | 서버·실제 브라우저 채널·실제 계정이 필요하거나 시험 묶음이 아니다. |
| 실제 키·네트워크가 드는 흐름 | 요청 범위 밖(키를 읽지 않았다). |

## 현장 노트에 옮길 새 함정

docs 영역이라 [시험·화면 확인 노트](../../../현장노트/시험_화면확인.md)에는 직접 쓰지 않았다. 문서 정리 세션이 끝난 뒤 옮긴다.

- **docs/마케팅 회사 시험은 저장소 뿌리에서 돌린다.** `content-engine.test.mjs` 등은 `resolve('docs/…')`처럼 뿌리 기준 상대 경로를 쓴다. 폴더 안에서 돌리면 거짓 실패가 난다.
- **`desktop/tests/lifecycle.test.cjs`는 리눅스에서 `desktop/`에 역슬래시 이름 파일 3개를 남긴다.** 돌린 뒤 `find desktop -maxdepth 1 -name '*synk-lifecycle*' -delete`.
- `미니게임_목소리_흐름.test.cjs`가 실패하면 띄운 도구가 남아 시험이 매달리던 문제는 `4c733cc19`로 고쳤다. 그 전 판으로 돌릴 때는 `pkill -f 미니게임_목소리.cjs`.
- **회사 SNS 지도의 해시는 CRLF 작업본 기준이다.** 리눅스·CI에서는 늘 「지도 생성 뒤 바뀜」이 된다.
- **로컬에만 있고 git에 한 번도 들어간 적 없는 파일을 읽는 시험이 많다**(`experiences/beginner-games/voice-request.json`, `experiences/word-magic/collection.js`·`kit/`, `experiences/spaceship-coop/starbook.mjs`, `experiences/path-travel/planner*.{html,css,mjs}`·`walking-router.mjs`). 10-14 「pending changes」 일괄 커밋이 「바뀐 파일이 import하는 새 파일만」 넣은 탓으로 보인다. 로컬 작업본에서 `git status`로 확인해 커밋할 것.
- Node 24의 파이프 출력에는 요약이 없다는 기존 함정 그대로였다(tap 보고기 파일로 받음).

## 다시 돌리는 법

```bash
# 저장소 뿌리에서. 결과 폴더는 저장소 밖으로.
OUT=/tmp/synk-tap; mkdir -p "$OUT"
for f in tests/*.test.{js,mjs,cjs}; do node --test --test-reporter=tap --test-reporter-destination="$OUT/$(basename "$f").tap" "$f"; done
grep -hE '^# (tests|pass|fail|skipped) ' "$OUT"/*.tap | awk '{s[$2]+=$3} END {for (k in s) print k, s[k]}'
grep -l '^not ok' "$OUT"/*.tap
```

남은 일은 [트랙](../../트랙.md)에 아직 옮기지 않았다(문서 정리 세션과 겹침을 피함). 이 문서의 「가장 중요한 실패」와 「확인 필요」 항목이 그 후보다.
