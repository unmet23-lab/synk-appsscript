# TOPIK 문항 묶음

TOPIK I·II 연습 문항(모두 자체 창작)과 그 AI 2중 검수 기록을 두는 곳이다. 2026-10-20 결정([결정 표](../../docs/_ops/결정.md) 10-20 「WORLD TOPIK 맞춤 학습 재설계」·「교원 검수를 AI로」·「TOPIK II 범위」)에 따라 만든다. 공식 시험 자리와 학습 항목의 짝은 [대응표](../../docs/TOPIK_유형_대응표.md)(원천 [strata/topik-types.json](../../strata/topik-types.json)), 지도는 TOPIK I [strata/maps/topik-i.json](../../strata/maps/topik-i.json)·TOPIK II [strata/maps/topik-ii.json](../../strata/maps/topik-ii.json)이다.

## 무엇이 어디에

| 파일 | 내용 |
|---|---|
| `items/<묶음>.json` | 문항 원천(꼴은 [schema.json](schema.json), 쓰는 법은 [작성기준.md](작성기준.md)) |
| `bank-files.mjs` | 문항 파일 목록(만든 파일 — `node tools/topik-items.mjs --묶기`) |
| `bank.mjs` | 화면·도구가 읽는 곳. `PUBLISHED`(검수 통과만) · `itemMeta`(Core 후보 메타) · `practiceItem`(진단·연습 화면 꼴) · `EXISTING_PASS` |
| `validate.mjs` | 검사기(node 전용) — 칸·자리·능력·급·해설 언어·세트·검수 계보 |
| `review/existing-verdicts.json` | 기존 게임·진단 문항의 검수 판정(허용 목록, `verdict: "pass"`만 연습에 낸다) |
| `review/rubric-r1.md` | 두 검수자가 함께 받는 검수 기준(판을 바꾸면 이름을 바꾼다) |
| `review/rubric-writing-r2.md` | 쓰기 51~54 검수 기준(r1에 공식 말투·51번 문체 줄을 더함, 10-21) |
| `audio/<문항 또는 세트>.mp3` | 듣기 대화 음성(64k 모노, 재생 횟수는 화면이 `audio.plays`대로) |

## 문항 한 개의 길

1. **쓰기** — [작성기준](작성기준.md)대로 `items/<묶음>.json`에 `reviewStatus: "draft"`로 쓴다. 공식 기출은 쓰지 않는다.
2. **검사** — `node tools/topik-items.mjs --묶기` → `node tools/topik-items.mjs`(검사 통과까지). 재고는 `--재고`(Core 칸마다 통과·초안 수와 목표 12), 소리는 `--소리`.
3. **AI 2중 검수** — 아래. 둘 다 통과하면 `reviewStatus: "ai-reviewed"`.
4. **소리(듣기)** — `node tools/topik-audio.mjs 굽기 <묶음>`(목소리 짝 하나-범수가 기본) → 폰 대역(300~3400Hz)으로 깎아 받아쓰기 확인.
5. **화면** — WORLD는 `bank.mjs`의 `PUBLISHED`와 `EXISTING_PASS`만 낸다. 내용을 고치면 `rev`를 올리고 검수를 다시 받는다(검수 줄의 내용 지문이 달라져 통과가 저절로 풀린다).

## AI 2중 검수

교원 검수를 대신한다(2026-10-20 결정). 통로는 기존 것 그대로다 — Claude는 [`tools/lib/클로드키.js`](../../tools/lib/클로드키.js)(일괄·한 건), 아르곤은 [`tools/lib/제미나이구독호출.js`](../../tools/lib/제미나이구독호출.js). 도구는 [`tools/topik-review.mjs`](../../tools/topik-review.mjs).

| 단계 | 누가 | 어떻게 |
|---|---|---|
| 1차 | Claude Opus 5.5(API 크레딧) | Message Batches(반값). 문항마다 ① 정답을 숨긴 **블라인드 풀이**와 ② 기준 열 가지 검수. 기준 글(검수 기준 + 작성 기준)은 1시간 캐시로 모든 요청이 같은 앞부분을 읽는다 |
| 2차 | 아르곤(gemini-4-argon-high, Google AI Ultra 구독) | 1차와 따로 같은 기준으로 판정하고, 영어·몽골어 해설을 한국어로 **직역 역번역**해 한국어 해설과 대조한다. 네 문항씩 차례로, 목록 끝 표식을 확인한 답만 쓴다 |
| 판정 | Claude Opus 5.5 | 한쪽만 통과면 두 의견을 놓고 다시 따져 통과·고침·뺌을 정한다 |

- **통과 규칙**: 1차·2차가 모두 통과(블라인드 풀이가 정답과 같고, 역번역이 어긋나지 않음)하거나, 엇갈린 문항을 판정이 통과시켰을 때만 `ai-reviewed`. 둘 다 고침·뺌이면 보류(`held`, 고친 뒤 다시) 또는 뺌(`rejected`).
- **기준 열 가지**: 정답 유일성 · 오답 매력도 · 유형 적합 · 어휘·문형 단계 · 자연스러움 · 해설 정확성 · 문화·편향 · 기출 유사도 · 대표 능력 · 난도 칸([rubric-r1.md](review/rubric-r1.md)).
- **계보**: 문항의 `review`에 단계·모델·기준 판·날짜·판정·내용 지문(`hash`)이 쌓인다. 기존 문항은 `existing-verdicts.json` 줄의 `by`·`hash`·`packet`.
- **기존 문항 약속**(① WORLD 읽기 짧은 연습): `pass`인 줄은 `skillId`·`difficulty`·`responseFormat`·`familyKey`가 진단 문항 메타와 같다. 검수자가 다른 능력을 제안하면 원고·메타를 고칠 때까지 `fix`로 둔다(`suggestedSkillId`).
- **기존 문항 고침(10-21):** 판정 `fix` 67개를 게임 원고에서 고치고 고친 것만 다시 받았다 — [1차](review/reports/existing-fix-r1.md) 통과 63·고침 4 → [2차](review/reports/existing-fix-r2.md) 4 모두 통과(뺀 문항 없음). 화면 검수 지적대로 해설·보기를 다듬은 여덟은 [3차](review/reports/existing-fix-r3a.md) 통과 7·고침 1, 그 하나(museum-11 — 짐이 빈 손님)는 [3차 둘째](review/reports/existing-fix-r3b.md)에서, Fable이 짚은 해설 둘(따옴표 안 마침표·시각 표기)은 [3차 셋째](review/reports/existing-fix-r3c.md)에서 통과해 판정 목록 168줄이 모두 `pass`다. 들리거나 보이는 글·보기·정답을 바꾼 문항은 판(`itemKey` 꼬리 `.vN`·`:vN`)을 올리고 계열(`familyKey`)은 v1 그대로 둔다 — 학생의 기록·노출이 이어진다. 해설·난도만 고치면 판은 그대로다. `반영`은 같은 계열·같은 문항의 옛 판 줄을 새 판 줄로 갈아 끼운다. 말의 리듬처럼 O/X 두 갈래가 해설 하나를 함께 쓰면 검수 보기에는 한 갈래만 나가므로, 해설에 다른 갈래에만 맞는 문장을 두지 않는다(그 문장이 「묻는 말과 상관없다」로 걸린다).

```bash
node tools/topik-review.mjs 준비 <이름> --새 [<묶음>…] --기존 [blank-slice synk-town entry-check] [--표본 50]
node tools/topik-review.mjs 준비 <이름> --기존 <출처…> --문항 <itemKey…>   # 고친 문항만 다시(나머지 판정은 그대로)
node tools/topik-review.mjs 클로드 <이름> --보내기     # 일괄 만들기(키 목록의 크레딧 키)
node tools/topik-review.mjs 클로드 <이름>              # 상태
node tools/topik-review.mjs 클로드 <이름> --받기       # 결과·쓴 비용
node tools/topik-review.mjs 아르곤 <이름>              # 2차(몇십 분, 끊겨도 받은 문항은 건너뜀)
node tools/topik-review.mjs 판정 <이름> --보내기       # 엇갈린 문항 Opus 판정
node tools/topik-review.mjs 반영 <이름>                # 문항 파일·허용 목록에 쓰기
node tools/topik-review.mjs 보고 <이름>                # report.md(판정 수·쓴 비용·1,000문항 어림)
```

묶음 원자료(요청·결과·아르곤 기록)는 저장소 밖 `output/topik-review/<이름>/`에 남는다(Git 제외).

**결과(2026-10-21)** — 파일럿 50(1차 Opus·2차 아르곤 모두, [기존](review/reports/pilot-existing.md)·[새](review/reports/pilot-new.md)) 뒤 확대: 새 문항 414(TOPIK I 읽기 155·듣기 162, TOPIK II 읽기 46·듣기 51) 모두 통과(고침 판정은 의견대로 고쳐 rev를 올려 세 번까지 다시 받음), 기존 게임 문항 판정 168줄(빈칸·마을·입장·레이싱·바람길·리듬·말 랠리) 가운데 통과 101. 묶음별 결과·비용은 [보고 폴더](review/reports/). 작성 지시에 지난 검수에서 걸린 것(조건은 「-(으)면」이 가를 때만, 이유는 이유를 바꾼 오답, 난도 1 정보량, 글에 없는 정보·거울 오답, 몽골어 첫말)을 넣은 뒤로 새 묶음의 첫 통과율이 80% 안팎에서 90% 넘게 올랐다.

## 키와 비용

- Claude API는 결제 수단이 없는 Console 조직의 월 크레딧 키만 쓴다(10-18 결정). 그 키가 오기 전까지 검수는 synk.yuh 키의 무료 크레딧으로 돌린다(10-21 유호님 — 검수 키 목록 `~/SYNK_보안/클로드_키목록_검수.json`, 상태 `클로드_키상태_검수.json`을 `SYNK_CLAUDE_KEYS`·`SYNK_CLAUDE_KEY_STATE`로). 이 키는 다른 제품 기능과 크레딧을 같이 쓰니 일괄을 묶음별로 나눠 보내고, 판정(일반 Messages API) 전후로 `node tools/lib/클로드키.js --상태`를 본다.
- unmet23 Console 「양유호's Individual Org」에 10-20 프로모션 크레딧 $200(API·배치 API, 11-22 만료)이 들어왔지만 카드가 붙은 조직이라 쓰지 않는다(1토큰 확인만 했다). 쓸지는 유호님이 정한다.
- 실제 값(10-21): 파일럿 50 $2.75(문항당 5.5센트), 확대 12묶음 577건 $22.74(3.9센트, 1,000문항 어림 $39). 큰 일괄은 앞 일괄의 기준 글 캐시를 읽어 문항당 2.6~3.1센트, 캐시가 식은 뒤 보낸 작은 재검수·단독 일괄은 6~8센트였다 — 재검수는 새 묶음과 한 일괄로 보낸다.
- 아르곤은 구독 안이라 추가 비용이 없다. 학생 자료가 들어가는 제품 호출에는 이 통로를 쓰지 않는다(검수 대상은 우리 문항뿐이다).

## 소리

- Typecast(`tools/나레이션굽기.mjs`, 1글자 1크레딧, API Lite 월 20만 — 10-21 TOPIK I 듣기 60문항 약 4,200자). 역할마다 한 목소리 — 여자 하나·남자 범수(10-21 유호님 위임으로 견본 받아쓰기 오류율·남녀 높낮이 차이를 재고 Fable 검수로 정함, 견본은 `node tools/topik-audio.mjs 견본`). 범수는 속도 1.0·줄 음량 +1.5dB(`VOICE_TUNE`), 대본의 남자 줄은 짧게 쓴다.
- 굽고 나면 내보내는 mp3를 원음·폰 대역으로 줄마다 받아써 대본과 견준다(10-21 첫 60문항: 범수 92줄·하나 90줄 모두 유사도 0.98 위, 폰 대역에서 떨어진 줄 없음). 세 받아쓰기 모델이 같게 잘못 듣는 줄은 앞에 짧은 말을 붙여 다시 굽는다(현장 노트 「Typecast가 기호·낱말 하나를 엉뚱하게 읽는다」).
- 대본의 숫자·시각은 읽는 대로 한글로 쓴다(합성 음성이 기호를 잘못 읽는다 — [현장 노트](../../docs/현장노트/영상_ffmpeg_자막.md)).
- 재생 횟수는 파일에 넣지 않는다. TOPIK I 두 번, TOPIK II 1~20번 한 번·21~50번 두 번을 화면이 `audio.plays`로 지킨다.

## 지키는 것

- 문항은 학습 연습이다. 정답률·통과 수를 급수나 합격으로 바꾸지 않는다([학습기준](../../docs/미니게임_TOPIK_I_학습기준.md) §1·§7-3).
- 공식 기출·교재를 옮기지 않는다. 검수가 기출 유사도를 따로 본다.
- 화면에 AI 도구 이름을 쓰지 않는다. 「AI가 선생님을 대신한다」고 말하지 않는다.
