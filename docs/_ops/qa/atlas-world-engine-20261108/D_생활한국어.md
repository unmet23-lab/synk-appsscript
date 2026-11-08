# Atlas × WORLD 2단계 D — 생활 한국어를 엔진 고리에 (2026-11-08 설계)

> [1단계 설계](설계.md) §4 D 줄의 설계다(만들기 전 — 목적 · 흐름 · 데이터 · 바꿀 파일 · 시험 계획). 연결 원칙은 설계 §2(배움 기록 하나 = Trail practice · 지도 하나 = Strata · 다음 고르기 = Core + Temper · 이유 = Vellum). 22개 대응표는 AI 2중 검수(1차 Opus · 2차 아르곤)를 받고, 설계와 끝 판은 Fable · 아르곤 · 아스트라(GPT)가 본다(필요하면 그록). 관문은 12월 코호트가 들어오기 전.

## 0. 한 줄

**생활 한국어 132문항의 답을 같은 순간 Trail practice에 거울로 남기고, 22능력을 Strata 과제 마디(TOPIK I 능력 × 상황)로 WORLD 지도에 올리고, 홈 후보에 그 능력(targets)을 붙여 Core가 순서를 정한다.** Temper 1/7/30일 재확인은 그 기록으로 생활 문항에서도 돌고, 「내 위치」의 재확인 줄에 보인다. 제품의 진도 · 복습 약속(1 · 3 · 7 · 14 · 30일) · 화면 · 판정은 그대로 둔다.

## 1. 지금

- 생활 진도 `synk.life-korean.progress.v1`(`life-progress.mjs`)이 첫 답 · 도움 · 복습 · 하루 기록을 혼자 갖는다. 자체 간격 `INTERVALS=[1,3,7,14,30]`(8행).
- 능력 이름 22개(`life-content.mjs` `skills[].id`, 모두 `domain:'reading'`)가 Strata에 0건이다. 홈 후보 `lessonCandidate`(`world-learning-plan.mjs:94`) · 복습(139) · 이어 하기(176 · 185)가 `targets:[]`라 Core는 이 배움의 능력 상태를 모른다. 팩과 상황의 연결 `PACK_SITUATIONS`(28행)도 제품 안 상수다.
- Trail에 생활 사건이 없어 Temper 재확인 · 「내 위치」 · 다른 게임 추천이 생활 답을 모른다.
- 실제 학습자 0명(1단계 README §6) — 옛 생활 진도를 Trail로 옮겨 쓰기(backfill)는 하지 않는다.

## 2. 성공 기준

1. **Strata**: WORLD 코치 지도에 과제 마디 22개(`life.task.<생활 능력>`)가 있고, 생활 132문항 각각이 마디의 기본 칸 + 예외로 정확히 한 측정 칸(능력 · 난도 · 응답 꼴)에 간다. 대응은 AI 2중 검수를 거쳤다.
2. **Trail**: 레슨 문항 · 새 상황 복습 · 카페 장면 · 튜터 안내 연습이 보이고 · 도움이 열리고 · 답한 순간이 경험 `world-life`의 practice 사건(present → delivery → help → answer)으로 남는다. 독립 · 도움 · 첫 노출 판정은 Trail 규칙 그대로다. 제품 기록은 한 글자도 바뀌지 않고, 거울이 실패해도 레슨은 막히지 않는다.
3. **Core**: 레슨 · 복습 · 이어 하기 후보에 targets가 붙고 Core가 능력 칸으로 순서를 정한다.
4. **Temper**: 생활 첫 답이 재확인 앵커가 되고 새 생활 문항이 짝(observed)이 된다. 「내 위치」 재확인 줄에 생활 줄이 보이고, 지금 확인할 수 있으면 그 문항이 있는 제품 길(복습 · 레슨)을 연다.
5. **호환**: 기록 꼴 · 서버 · DB · 생활 진도 꼴 그대로. 옛 묶음 · 옛 기록과 섞여도 지금처럼 돈다.

## 3. 사람이 보는 것

레슨 · 이야기 · 카페 · 복습 화면은 그대로다. 달라지는 것은 셋이다. ① 홈 「다음 할 일」 순서가 능력 기록으로 바뀔 수 있다(예: 읽고 세부 정보 찾기를 여러 번 놓친 학생에게는 그 능력을 겨누는 팩의 다음 레슨이 급한 줄로 앞선다 · 놓친 칸이 없으면 생활 레슨은 지금처럼 진도 순서 · 목표로 순서를 받는다 — 잘한다고 진도에서 밀려나지 않는다, §4-3). ② 「내 위치」 근거 줄에 「생활 한국어」 답이 출처와 함께 보이고, 재확인 줄에 생활 칸이 생긴다. ③ 이번 주 계획의 셈은 지금과 같다(생활 답을 읽기로 한 번 더 세지 않게 고친다 — §4-5).

## 4. 설계

### 4-1. Strata — 과제 마디 22개 (능력 × 상황)

**원천** `strata/world-life.json`(판 `world-life-1`, 사람이 쓰고 검수가 확인하는 표): 줄마다 `[생활 능력, 기본 능력, [상황…], {예외}]`. 기본 난도 1 · 응답 꼴 `single-choice`. 예외는 문항 id(본문항 `<qid>`, 복습 `<qid>-transfer`)마다 다른 능력 · 난도 · 꼴. 카페 방문 장면(아래 4-2 ⑤)은 `scene: [레슨 id…]`로 따로 적는다.

**생성** `tools/build-game-learning.js`가 원천 해시와 함께 `strata/maps/world-life.json`(지도 층: `sources` · 과제 마디 22 · `layer_ver`)을 만든다(`--check` · 짝검사 대상). 마디: `{id:'life.task.<생활 능력>', kind:'task', label_ko:<그 능력 이름>, level:null, confidence:'ai_draft', reviewed:<2중 검수 통과>, review:{…증거}, material:{skill, pack, ability, situations, difficulty, format, items, scene}}`. 빌드가 확인: 기본 · 예외 능력은 TOPIK I 지도의 `skill` 마디, 상황은 `situation` 마디, 난도 1~3, 꼴은 Core의 응답 꼴.

**WORLD 코치만 싣는다.** `strata/world-life.js` `withLifeLayer(worldMapData())` — 마디 · 출처를 더하고 지도판에 `:<layer_ver>`를 붙인다. `strata/world-map.js`는 건드리지 않는다(3~4급 게임 묶음 `WORLD_MAP_GAMES`가 그 파일의 코드를 싣기 때문에, 고치면 데이터가 같아도 게임 묶음이 바뀐다 — 빌드로 확인: 게임 묶음 12개 그대로). `world-learning-map.mjs`만 층을 실은 지도로 바꾼다. 지도판이 바뀌어도 1단계 A(`temper-followup-2`)로 재확인 짝은 끊기지 않는다. 학습 증거의 `conceptIds`는 지금처럼 문법 · 낱말만이다(과제 · 상황 마디는 조회용 — TOPIK II 단원 지도와 같은 원칙, Strata 설계 11-02).

**조회** `strata/world-life.js`(순수, 입출력 없음): `lifeMeasure(질문, {review})` → `{skillId, modality:'reading', difficulty, responseFormat, audioRequired:false, confounded}` · `lifeSituations(생활 능력들)`. 제품은 이 조회만 쓴다(자기 표를 두지 않는다).

**대응표 2판(Opus 초안 — 이것을 2중 검수한다).** 판단 기준은 검수 기준 r1 `skill_fit` 그대로 「정답을 가르는 정보가 무엇인가」다. 상황에 맞는 말 · 표현 뜻 고르기 = 낱말 뜻 읽기(`vocabulary` — TOPIK I 읽기에 「이어지는 말」 자리가 없어 표현 뜻으로 본다), 문장의 꼴이 답을 가르는 것(「저는 N이에요」 소개 문장 고르기) = 조사 · 문형 읽기(`grammar`), 이야기 · 안내 · 메시지의 사실 = 세부(`detail`), 안 됨 · 아니라 · 바꾸기 = 부정 · 변경(`negation`), 이번 · 다음 정류장 = 순서(`sequence`), 왜 = 이유(`reason`). 여섯 모두 TOPIK I 지도의 읽기 영역 `skill` 마디(`ko.reading.*`)라 영역은 늘 읽기다(검수 GPT · 그록 KB2 — 판정 자격도 능력 둘째 토큰 = `reading` · 소리 필요 없음을 읽기 짧은 연습 `passedItems`처럼 본다).

| # | 생활 능력 | 기본 능력 | 예외(본문항 · 복습) | 상황 |
|---|---|---|---|---|
| 1 | greet-response 상황에 맞게 인사하기 | vocabulary | — | sit-people-greeting |
| 2 | greet-gratitude 고마움 전하기 | vocabulary | greetings-story-thanks(+복습) → reason | sit-people-greeting |
| 3 | greet-introduction 이름 소개 이해하기 | detail | greetings-expressions-name(+복습) → grammar(N이에요) | sit-people-greeting |
| 4 | cafe-order-detail 음료와 수량 이해하기 | detail | — | sit-travel-order |
| 5 | cafe-place 마실 장소 구분하기 | vocabulary | cafe-story-here(+복습) → detail | sit-travel-order |
| 6 | cafe-takeout-request 포장 요청하기 | vocabulary | cafe-story-takeout(본문항) → detail · cafe-visit-change-place(장면 본문항 · 복습) → negation | sit-travel-order |
| 7 | cafe-preference-reading 친구의 취향 이해하기 | detail | — | sit-travel-order |
| 8 | cafe-availability 품절과 주문 가능 안내 읽기 | negation | — | sit-travel-order |
| 9 | cafe-order-change 주문 변경 이해하기 | negation | — | sit-travel-order |
| 10 | cafe-compose-order 주문 문장 구성하기 | detail | (본문항은 장면 · `cup-compose`) | sit-travel-order |
| 11 | store-price-reading 가격 질문과 표시 읽기 | vocabulary | store-story-price(+복습) → detail | sit-travel-shopping |
| 12 | store-bag-request 봉투 요청하기 | vocabulary | store-story-bag(+복습) → reason | sit-travel-shopping |
| 13 | store-payment 결제 방법 이해하기 | vocabulary | store-story-card(+복습) → detail | sit-travel-shopping |
| 14 | directions-location-question 장소의 위치 묻기 | vocabulary | directions-story-where(+복습) → detail | sit-travel-directions |
| 15 | directions-turn 이동 방향 이해하기 | detail | directions-expressions-right(+복습) → vocabulary | sit-travel-directions |
| 16 | directions-landmark 주변 장소로 위치 찾기 | detail | — | sit-travel-directions |
| 17 | transit-route 목적지 확인하기 | vocabulary | transit-story-route(+복습) → detail | sit-travel-transport |
| 18 | transit-alighting 내릴 순서 이해하기 | sequence | — | sit-travel-transport |
| 19 | transit-instruction 승차 안내 이해하기 | vocabulary | transit-story-card(+복습) → detail | sit-travel-transport |
| 20 | plans-time-reading 약속 날짜와 시간 읽기 | detail | — | sit-people-messenger · sit-career-schedule |
| 21 | plans-location 만날 장소 확인하기 | negation | plans-expressions-place(+복습) → vocabulary · plans-story-place(본문항) → detail | sit-people-messenger · sit-career-schedule |
| 22 | plans-delay-message 늦는다는 연락 이해하기 | vocabulary | plans-story-delay(+복습) → detail | sit-people-messenger |

능력은 모두 `ko.reading.*`(TOPIK I 지도). 팩마다 상황의 합집합은 지금 `PACK_SITUATIONS`와 같다(시험으로 묶는다 — 「내 성향」 관심 · 지금은 아니에요 동작이 바뀌지 않게). 난도 · 꼴의 문항별 예외는 검수(`difficulty_fit` · `skill_fit`)가 짚은 대로 원천에 적고 그 문항만 다시 검수한다.

### 4-2. Trail — 거울 기록 (`experiences/synk-world-app/life-trail.mjs`, 경험 `world-life`)

① **문항 정체와 계열(2판 — 검수 아르곤 B1 · Fable F4).** 문항 id · itemKey는 본문항 `life.<qid>`, 복습 `life.<qid>-transfer`. 계열(familyKey)은 「한 문항의 답이 다른 문항의 답을 알려 주는가」로 정한다, 차례대로 — ⓐ 복습의 보기 셋이 본문항과 **같은 묶음**(순서만 다름)이면 본문항과 같은 계열(보기 변형 — 원고 66쌍 가운데 9쌍: 이름표 주인 · 갈림길 방향 · 취향 음료 등) ⓑ 능력이 낱말 뜻 · 문형(`vocabulary` · `grammar`)이면 그 표현을 아는지가 답을 가르므로 **표현마다 한 계열** `life.expr.<expressionId>`(「안녕하세요」를 고르는 여섯 문항은 한 계열) ⓒ 그 밖의 능력(세부 · 부정 · 순서 · 이유)이면 그 글의 사실이 답을 가르므로 **표현 + 정답 글마다 한 계열** `life.ans.<expressionId>.<정답 글 지문>`(정답이 같은 쌍둥이 — 「마린이 이름표를 찾아 줬어요」 본문항과 복습, 「내일 오후 세 시」 표현 · 이야기 문항 — 은 한 계열, 「따뜻한 차 한 잔」 → 「차가운 주스 두 잔」처럼 정답 · 보기가 바뀐 새 상황 복습은 새 계열). 그래서 같은 지식을 두 번 독립 근거로 세지 않고, 정답 · 보기가 바뀐 새 상황 복습만 처음 보는 문항 · 재확인 짝이 될 수 있다. 같은 복습을 1 · 3 · 7 · 14 · 30일에 다시 풀면 Trail은 반복(repeat)으로 읽는다(제품의 약속은 그대로 화면에 남는다). 계열 규칙은 한 함수(`life-items.mjs`)를 거울 · 홈 후보 · 재확인 공급 · 검수 도구가 함께 쓰고, 시험이 132문항 전부(같은 보기 묶음 9쌍 포함)를 대조한다.

② **사건 자리**(제품 함수 → 코치 호출, 판정 · 정답은 제품 것 그대로).

| 제품 순간 | 거울 |
|---|---|
| 답하지 않은 레슨 문항이 보임(`renderQuestion`) · 복습 문항이 보임(`renderReview`) · 카페 장면 선택 단계가 열림(`renderCafe` — 들어가기 · 쉬는 장면은 아니다) | 판을 연다(그 순간의 제품 이력 대조 ⑦과 제품의 도움 상태를 잰다). **코치에 보이는(`present`) 것은 그 판의 첫 도움 · 소리 · 답 때**다 — 흘끗 보고 새로고침한 문항이 「먼저 보인 문항」으로 남아 그 뒤의 첫 답이 Temper 짝(첫 제시만 짝)이 못 되는 일을 막는다(2판 — 검수 Fable F5 ①). 한 화면 실행 안의 같은 판(레슨 시도 id · 복습 회차 id · 문항)은 다시 그려도 같은 pid. 제품이 이미 「도움 펼침」이면(설정 · 새로고침 뒤 이어 하기) 보이는 즉시 `help` |
| 「도움」을 펼침(사람 · 「한 단계씩」 설정) — 해설을 미리 보인다 | `help(pid,'explanation')` |
| 카페 「힌트 보기」 · 「글자로 보기」 · 「느리게」 | `help(pid,'hint')` · `help(pid,'text')` · `help(pid,'replay')` |
| 카페 직원 말 재생 시작 · 끝까지 · 실패 | `delivery(pid,{audio:'pending'/'completed'/'failed'})` |
| 첫 답(`recordAnswer` · `answerReview`) | 제품이 그 답을 **새 첫 답으로 저장했을 때만**(`duplicate:false` — 두 탭 · 묵은 화면의 두 번째 답이나 저장 실패 · 충돌로 던지면 남기지 않는다, 2판 — 검수 Fable F2) 저장된 답의 `correct` · `helped` 그대로: 제품이 도움 받은 답으로 적었는데(진도 단계 · 미리 본 복습 · 같은 날 안내 연습 — 새로고침을 지난다) 이 판에 도움이 없으면 먼저 `help`, 그다음 `answer(pid,{correct,assessable,choice})`, 이어서 판정 띠가 정답 · 해설을 보이므로 `help(pid,'answer')` |
| 튜터 「이 표현 같이 연습」(`prepareTutorPractice` · `prepareHomePractice`) — 복습 원고를 미리 보인다 | 지금 문항이 있으면 `help(pid,'explanation')`, 그 복습 문항은 `present` + `help('explanation')`만(답은 남기지 않는다 — 실패 · 취소가 제품에 오지 않아 결과를 지어내지 않는다) |

pid는 한 화면 실행 안에서만 산다(코치의 보임이 메모리라 새로고침 · 다른 탭 · 계정 전환이면 새 거울이 새 pid). 판이 바뀌어도 같은 문항의 앞선 도움 · 정답 보임 · 답은 Trail이 itemKey · familyKey로 이어 읽으므로(`judge`의 앞선 흔적) 새 pid의 답도 도움 받은 · 반복으로 읽힌다. 거울에 그 앞선 사건이 빠졌을 때를 ⑦이 막는다(검수 그록 KB3). 도움을 연 뒤 새로고침해 답하면 그 문항은 두 번 보인 문항이라 Temper 짝이 되지 않는다(도움 받은 답이라 짝이 아니어도 맞다 — §7).

③ **판정 자격.** 문항의 측정은 4-1 조회가 정한다. 2중 검수가 `pass`이고 검수가 확인한 능력 · 난도 · 꼴 · 계열이 지금 조회 · 계열 규칙과 같고, 능력이 읽기 영역이며 소리가 필요 없을 때만 `assessable:true`. 아니면 `assessable:false`(노출 · 도움은 남고 능력 근거는 없다 — 읽기 짧은 연습 `passedItems`와 같은 생각). ⑦에 걸린 문항도 `assessable:false`다.

④ **도움은 출처와 상관없이 도움이다.** 「한 단계씩」 설정이 펼친 해설도 Trail에는 도움이다(제품은 그 도움을 어려움으로 세지 않아 복습 간격을 되돌리지 않는다 — 그건 제품 규칙으로 그대로). 새 상황 복습은 그 설정이어도 접힌 채 시작하므로 혼자 근거가 될 수 있다. **파급(2판 — 검수 Fable F6):** 처음 배우는 사람의 기본 도움 방식이 「한 단계씩」이라 그 학생의 레슨 첫 답은 모두 도움 받은 답이고, Core는 그 칸을 「도움과 함께 해냄(supported)」으로 읽어 그 칸을 겨누는 생활 레슨 · 복습을 급한 줄로 올리고(이유 「… 도움과 함께 해냈어요」), 이번 주 계획 · 「내 위치」도 그 칸을 다시 볼 항목으로 적는다. 학생이 고른(또는 받은 기본) 도움을 정직하게 적은 결과이고 혼자 푼 새 상황 복습이 쌓이면 풀린다 — Atlas 계약(도움 ≠ 독립)과 생활 원고의 원칙(「도움받은 성과를 독립 성공과 구분」)이 이미 정한 것이라 그대로 둔다(Claude 판단, 결정 표). 「한 단계씩」 학생의 해설을 답한 뒤로 미루는 것은 제품 변경이라 D 밖 후속이다.

⑤ **카페 방문 장면 15문항**(`cafe-apply` · `cafe-visit-*` · `cafe-compose`의 본문항)은 `measure.confounded:true`. 장면은 친구의 말이 답하기 전에 필요한 정보를 말해 주고(「수량 확인. 까몽 한 잔, 네 컵 한 잔. 둘.」), 직원이 틀린 주문을 되물어 고치게 하며, 듣기 · 읽기 판이 섞인다 — 측정 조건이 아니다(제품 문서도 카페 완료를 숙련으로 세지 않는다). 노출 · 도움 · 소리 전달은 남고 근거는 없다(Trail `reason:'visual'`). 그 15문항의 새 상황 복습(글 문항)은 다른 문항과 같이 잰다. 그래서 「듣고 주문하기」를 듣기 능력으로 재는 일은 이번에 하지 않는다.

⑥ **코치.** `createWorldEducation(…).lifeCoach()` = 지금의 `coachFor('world-life')`(손님은 기기 기록, 계정은 `SYNKLearningHost` — 같은 기록 열쇠를 다른 WORLD 코치와 나눈다). `createLifeExperience({learning})`로 넘기고 WORLD 앱(`app-shell.mjs`) · 생활 묶음(`life-standalone-entry.mjs`) 둘 다 잇는다. 레슨 · 복습을 열 때 계정 통로 준비(`education`의 기존 `prepare` — 지금은 「다음 할 일」만 부른다)를 함께 부른다. 코치에 보이는 때가 첫 도움 · 소리 · 답이라 통로가 늦게 준비돼도 그때 이어 적는다. 다른 탭이 기록을 잡은 동안의 사건은 이 탭 코치 메모리에 남았다가 잠금이 돌아오면 저장되고, 그동안의 답은 저장 사유(`storage`)로 근거 없음이 된다(코치 계약 그대로 — 검수 Fable 작은 지적). 통로가 끝내 없거나 호출이 던지면 그 사건은 건너뛰고 레슨은 그대로 간다. 계정이 바뀌면 생활 화면이 통째로 다시 서므로(`mountLifeLearning`) 옛 거울은 버려지고, 옛 계정의 늦은 소리 끝 · 답 사건은 새 계정 코치로 가지 않는다(판마다 처음 잡은 코치에만 적는다).

⑦ **제품 이력 대조(2판 — 검수 GPT · 아르곤 B4 · 그록 KB4).** 거울이 빠졌던 문항을 나중에 다시 보이면 Trail은 처음 보는 문항으로 읽을 수 있다. 그래서 `present` 전에 제품 진도로 「이 문항의 계열을 제품이 이미 만났는가」를 본다 — 계열의 문항 가운데 하나라도 ⓐ 본문항: 그 레슨이 다시 하기 판(이미 마친 레슨)이거나 지금 판에 그 문항 답이 있음 ⓑ 새 상황 복습: 복습 기록이 그 본문항 답보다 뒤에 갱신됨(`lastAt`) · 맞힌 적 있음(`streak>0`) · 본문항 답 기록이 없는데 복습 기록이 남음 · 하루 기록에 그 문항의 튜터 안내 연습(`guidedAt`)이 있음. 하나라도 맞는데 Trail 노출(`exposure`)은 「처음」이면 그 판은 `assessable:false`로 적는다(근거를 지우는 쪽으로만 틀린다 — 처음인 것을 처음 아니라고 볼 수는 있어도 그 반대는 없다).

### 4-3. Core — 홈 후보에 targets

- 레슨 후보: 그 레슨 본문항의 측정을 targets로(`{id, skillIds:[능력], difficulty, modality:'reading', responseFormat, itemKey, familyKey:계열, conceptIds:[]}`). `familyKeys`(활동의 모든 계열을 이미 봤으면 「다 씀(spent)」으로 뒤로 보내는 표시)는 넘기지 않는다 — 생활 레슨은 같은 표현을 새 장면에서 다시 쓰는 차례라, 표현 계열을 만났다고 아직 안 한 다음 레슨을 「새 문항을 모두 만났어요」로 밀어내지 않게(계열 반복 감점 −0.10은 `familyKey`로 그대로 받는다).
- **레슨 후보의 targets는 「놓친 칸을 당길 때」만 싣는다(2판 — 검수 Fable F1).** 생활 132문항은 Core 칸 몇 개(읽기 낱말 뜻 · 세부 · 부정 · 순서, 모두 난도 1 · 보기 고르기)를 나눠 써서, 그대로 실으면 첫 레슨만 잘 풀어도 그 칸이 「확인 중(.55)」이 되어 아직 기록 없는 듣기 게임(.65)에 지고, 혼자 맞힌 첫 답이 넷 쌓이면 「최근 혼자 수행」이라 그 칸만 겨누는 다음 레슨이 세 번째 줄(tier 2)로 내려간다 — 잘하는 학생일수록 홈 「다음 할 일」이 생활 진도를 안 이끈다. 그래서 계획(`createWorldLearningPlan`)이 Core 요약으로 레슨 targets를 거른다: 그 레슨의 칸 가운데 하나라도 다시 연습할 상태(놓침 practice · 도움으로만 supported · 오래됨 review · 틀린 답이 있는 확인 중 checking)이면 그 칸의 targets를 싣고(Core가 그 레슨을 급한 줄로 올린다 — 「Core가 순서를 정한다」), 아니면 지금처럼 targets 없이 둬서 진도 순서 · 목표로 순서를 받는다. 돌아온 복습 · 이어 하기 후보는 제품 일정 · 하던 자리로 이미 앞이라 targets를 늘 싣는다(이유 · 근거 줄이 그 칸을 가리키게). Core 쪽에 「진도 활동」 구분을 두는 길은 `atlas/` 변경이라 D 밖이다(결정 표).
- 카페 방문 장면 레슨은 targets를 비운다(2판 — 검수 아르곤 B2): 근거가 쌓이지 않는 칸(`cup-compose` 등)을 Core가 「이 칸을 연습할 자리」로 읽지 않게. 지금처럼 목표로만 순서를 받는다.
- 복습 후보: 돌아온 복습 문항들. 이어 하기 후보: 남은 문항.
- Core `recommendActivities`의 기존 규칙 그대로(급한 정도 → 목표 → 상태 → 새 문항 → 시간). 복습 시각(`reviewAt`)은 제품 일정 그대로라 돌아온 복습은 지금처럼 맨 앞 줄이다.
- `PACK_SITUATIONS` 상수를 4-1 조회로 바꾼다(값 같음을 시험).
- `hostReason`의 「생활 팩의 다음 레슨이에요」는 targets가 있어도 레슨이 아직 기록 없는 칸만 겨눌 때 그대로 쓴다(10-20 검수 #17 — 기록 있는 사람에게 「연습 기록이 적어요」가 틀린 말이 되지 않게). 이유 한 줄을 Vellum으로 모으는 일은 J.

### 4-4. Temper — 생활 재확인

- 앵커 · 짝은 Temper 그대로 생긴다: 칸(경험 `world-life` · 능력 · 난도 · 꼴 · 영역 · 소리)마다 45일 안 첫 자격 시도가 앵커, 1(1~3일) · 7(7~10일) · 30(30~37일) 창 안의 처음 보는 **다른 계열** 첫 시도가 짝. 정답이 바뀐 새 상황 복습이 앵커 본문항과 **같은 칸**이면(예외로 능력이 갈린 쌍 · 표현 계열 쌍 · 같은 보기 묶음 쌍은 아니다 — 검수 그록 KB1 · Fable F4) 다음 날 그 복습이 1일 짝이 된다(맞힌 첫 답은 제품 복습이 하루 뒤로 잡힌다). **틀린 첫 답(recovery)**은 제품이 그 복습을 1분 뒤로 잡아(「새 장면으로 다시 보기」 포함) 1일 창(1~3일) 전에 쓰므로, 그 앵커의 1일 짝은 같은 칸의 다른 처음 보는 문항(다음 레슨 본문항 · 다른 복습)에서 온다 — 공급이 그것을 가리킨다(검수 Fable F5 ②). 튜터 안내 연습으로 미리 본 복습은 Trail에서 도움 받은 · 처음이 아닌 시도라 짝이 되지 않는다.
- 투영 `lifeFollowupRows`(`world-learning-followups.mjs`): `gameId==='world-life'` 줄, `row.current ?? 옛 비교`. 확인할 수 있는 문항(공급) = 같은 칸이고, 문항 · 계열 모두 아직 안 봤고(노출 없음, ⑦도 안 걸림), 판정 자격이 있고(③ — 검수 pass · 메타 일치 · 장면 아님), 앵커와 계열 · 문항이 다른 생활 문항 가운데 **제품 길로 열 수 있는 것** — 지금 돌아온 새 상황 복습, 없으면 제품 순서상 다음에 시작할 레슨(장면 레슨 제외)의 본문항(2판 — 검수 GPT · 아르곤 B3). 없으면 「이 조건에 맞는 새 문항이 아직 없어요」. 제품 일정을 앞당기거나 새 문항을 만들지 않는다.
- 「내 위치」 재확인 줄(`world-learning-ui.mjs` `showBoard`)에 생활 줄을 더한다: 능력 이름 · 「생활 한국어」 · 창 · 상태 · 결과(있는 글 그대로). 확인할 수 있으면 단추가 그 복습 · 레슨을 연다(`startReview(lessonId,[id])` · `startLesson(id)`).
- 카페 장면 · 판정 자격 없는 문항은 Temper 자격이 없어 앵커 · 짝이 되지 않는다.

### 4-5. 다른 소비처

- `world-exam-plan.mjs` `weekActivity`: 경험 `world-life` 사건은 영역(읽기) 셈에서 뺀다 — 생활은 지금처럼 생활 진도로만 센다(안 고치면 생활 레슨이 「읽기 연습」으로 한 번 더 세어진다).
- `world-position-ui.mjs` `itemSource`: `life.` 열쇠 → 「생활 한국어」(새 문자열 `position.source.life` = 이미 있는 `life.everydayKorean` 세 언어 글 그대로 — 새 현지어 글 없음).
- 서버 · 교사 앱 · 계정 요약: 경험 id는 자유 식별자라 그대로 받는다. 능력 · 응답 수에 생활 답이 들어가는 것은 의도다(배움 기록 하나).
- 알림(`world-reminders`) · 하루 기록 · 튜터 · 카페 진행: 생활 진도를 그대로 읽는다(안 바뀜).

## 5. 바꿀 파일

| 엔진 · 자리 | 파일 |
|---|---|
| Strata | 새 `strata/world-life.json` · `strata/world-life.js`(빌더 · 조회 · `withLifeLayer`) · 생성 `strata/maps/world-life.json`, `tools/build-game-learning.js`(층 생성 · `--check`). `strata/world-map.js` · `index.js`는 그대로 |
| Trail 거울 | 새 `experiences/synk-world-app/life-trail.mjs`, `life-ui.mjs`(호출 자리), `world-learning-ui.mjs`(`lifeCoach` · 재확인 줄), `app-shell.mjs` · `life-standalone-entry.mjs`(잇기), `world-learning-map.mjs`(층을 실은 지도) |
| Core 후보 | `world-learning-plan.mjs`(targets · 상황 조회 · hostReason) |
| Temper 투영 | `world-learning-followups.mjs`(`lifeFollowupRows`) |
| 소비처 | `world-exam-plan.mjs`(`weekActivity`), `world-position-ui.mjs`(`itemSource`), `brand-opening/world-strings.mjs`(문자열 하나) |
| 검수 도구 | `tools/topik-review.mjs`(출처 `life` — 문항 보기 · 장면 표시), 판정은 `experiences/topik-items/review/existing-verdicts.json`(묶음에는 `tools/lib/world-verdicts.mjs`가 판정 칸만 싣는다) |
| 생성 묶음 | `world-account.bundle.mjs` · `brand-opening/content/life-standalone.mjs`(생성기로만), 짝검사 |
| 문서 | 이 설계 · README · `엔진8종_상향설계_v3.md` WORLD 표 · `Strata_설계.md` · `LIFE-CONTENT.md` · 트랙 · 결정 |

`atlas/` 원천은 바꾸지 않는다(크기 상한 7,419줄 그대로). Strata `index.js`도 그대로다.

## 6. 시험 계획

- `tests/world-life-map.test.mjs`(새): 원천 ↔ 생성 층 대조 · 22능력 · 132문항 모두 한 측정 칸 · 예외가 가리키는 문항이 있음 · 모든 능력이 TOPIK I 읽기 skill · 팩 상황 합집합 = 옛 `PACK_SITUATIONS` · 기본 `worldMapData()` 그대로 · WORLD 코치 지도 검증 통과 · 계열 규칙(표현 계열 · 정답 쌍둥이 · 정답이 바뀐 복습은 새 계열)을 132문항 전부 대조 · 검수 도구와 거울이 같은 계열을 낸다.
- `experiences/synk-world-app/qa/life-trail.test.mjs`(새): 실제 코치(`world-learning-map.mjs`)로 레슨 첫 답 → 독립 · 첫 노출, 도움 뒤 답 → assisted, 「한 단계씩」 → assisted, 다시 그려도 present 하나, 정답이 바뀐 복습 첫 풀이 → 새 문항 독립, 쌍둥이 복습 → 반복, 같은 복습 두 번째 → repeat, 튜터 안내 연습 뒤 복습 → 첫 노출 아님, 카페 장면 → unassessed(visual), 판정 자격 없음 → unassessed, 코치 없음 · 던짐 → 레슨 계속(제품 기록 같음), 생활 진도 바이트가 거울 유무와 같음.
- 수명(2판 — 검수 GPT P2): 실제 저장소 · 계정 호스트 모사로 ① 문항이 보인 뒤 새로고침해 이어 답하기(도움 펼친 단계 포함 — 새 pid의 답이 도움 받음) ② 두 탭 기록 소유 인계(잡은 탭만 적고 놓친 탭은 건너뜀, 나중 재노출은 ⑦로 근거 없음) ③ 계정 전환(옛 계정 소리 끝 · 답이 새 계정에 안 감) ④ 코치가 늦게 준비됨(첫 답 때 present) ⑤ 거울이 빠진 본문항 · 복습을 나중에 다시 보임 → `assessable:false` — 각각 사건 수 · 종류 · pid 귀속 · 제품 진도 불변.
- 재확인: 정답이 바뀐 같은 칸 복습 → d1 observed(`independent-correct`), 표현 계열 쌍은 짝 아님, 30일 창 · 지도 층이 바뀌어도 짝 유지, `lifeFollowupRows` 공급(돌아온 복습 · 다음 레슨 · 없음 · 검수 fix 문항 · 장면 · 앵커와 같은 계열은 공급 아님).
- 계획: 놓친 칸을 겨누는 레슨이 급한 줄로 앞섬 · 같은 칸을 넷 혼자 맞힌 뒤에도 다음 생활 레슨이 처음 보는 듣기 게임보다 앞 · 첫 레슨 뒤 둘째 레슨이 게임보다 앞(검수 Fable F1) · 「한 단계씩」 학생의 레슨 셋 → 그 칸 supported · 그 칸 레슨이 급한 줄(F6) · 장면 레슨 targets 없음 · 돌아온 복습은 여전히 맨 앞 · hostReason · `weekActivity` 생활 이중 셈 없음, 기존 계획 시험들(learning-plan · world-learning-plan · topik-personalization · answers · exam-link · guest-trial …) — 의도한 순서 변화는 시험을 새 계약으로 고친다.
- 제품 답과 거울(검수 Fable F2): 제품 `duplicate`(두 번째 탭 · 묵은 화면) → Trail 시도 0, `recordAnswer` 던짐 → Trail 시도 0 · 레슨 계속, 도움을 코치 없이 연 뒤 코치가 생겨 답 → assisted(F3), 문항이 보인 채 새로고침 → 그 뒤 첫 답만 보임 하나 · 짝이 될 수 있음(F5 ①), 틀린 첫 답 → 1분 복습 → 1일 창 짝은 다음 레슨 본문항이 공급(F5 ②), 검수 fix 문항 · 같은 보기 묶음 복습은 공급 아님(F5 ③ · F4).
- 브라우저: 생활 묶음 · WORLD 앱에서 레슨 한 개 · 복습 한 판 · 카페 방문 한 판 → 코치 기록 사건 수 · 종류, 「내 위치」 근거 줄 · 재확인 줄, 콘솔 오류 0.
- 생성 묶음 `--check` · 짝검사 · `tests/atlas-size-budget.test.js`(0줄).

## 7. 위험과 한계

- **순서 변화**: 생활 답이 능력 칸을 다른 게임과 나눠 쓴다(예: 읽기 낱말 뜻 1단계 보기 고르기는 빈칸 베기와 같은 칸). 생활에서 혼자 잘하면 그 칸이 「최근 혼자 수행」이 되어 **같은 칸을 겨누는 다른 활동**(게임 · 짧은 연습)이 뒤로 간다 — Core 규칙 그대로다. 생활 레슨 자신은 놓친 칸을 당길 때만 targets를 싣으므로(§4-3) 잘한다고 진도에서 밀려나지 않는다. 하던 자리 · 돌아온 복습 · 한글 먼저는 지금처럼 앞선다.
- **거울이 빠지는 때**: 다른 탭이 기록을 잡은 동안 · 계정 통로가 끝내 실패한 동안의 답은 Trail에 없다(통로 준비가 늦은 것은 첫 도움 · 답 때 이어 적는다). 그 문항 · 계열을 나중에 다시 보이면 ⑦이 제품 진도로 걸러 근거 없음으로 적는다. ⑦이 못 보는 것: 제품도 남기지 않은 「보기만 하고 답하지 않은」 노출(Trail 독립 판정에도 그 노출은 답 · 정답 보임이 아니라 영향이 없다), 하루 기록 보관(30일)을 넘긴 튜터 안내 연습.
- **검수 결과**: 2중 검수가 `fix`를 많이 내면 그 문항은 근거 없이 노출만 남는다(원고를 고치면 문항 id · 내용 판이 바뀌는 일이라 D 밖 — 후속).
- **저장 쓰기**: 문항마다 코치 쓰기 3~4번(게임과 같은 수준).
- **30일 재확인 공급**: 132문항 고정 원고라 과정을 마친 뒤의 30일 창은 「새 문항 없음」이 된다(예비 문항 은행은 후속).

## 8. 하지 않는 것

원고 · 정답 · 문항 id · 내용 판 바꾸기, 제품 복습 간격 · 하루 기록 · 카페 판정 바꾸기, 카페 「듣고 주문하기」를 듣기로 재기, 이유 한 줄 통합(J), 말하기(E) · 한글(F), 서버 · DB · `atlas/` 원천, 옛 생활 진도의 Trail 옮겨 쓰기.

## 9. 공개 · 관문

WORLD 계정 묶음 · 생활 묶음이 바뀐다. master에 남의 미공개 WORLD 변경이 있으면 [현장 노트 · 배포 공개](../../../현장노트/배포_공개.md) 「master에 미공개 게임이 있는데 계정 · 생활 묶음을 고쳐야 하면」대로 라이브 묶음에 이 판의 모듈만 끼우고 끼운 길을 실제로 돌려 본다. 공개 전에 후보의 새 `?v=` 주소를 synk.im에 부르지 않는다. 관문은 12월 코호트 전 — 못 맞추면 코호트 안내 · 트랙에 「생활 학습은 엔진 밖」을 적는다.

## 10. 근거

엔진 연결이라 새 화면 기능은 없다. 학습 흐름의 근거는 [LIFE-CONTENT.md](../../../../experiences/synk-world-app/LIFE-CONTENT.md) 10-11 · 10-13 비교(Speak Made For You의 실수 · 도움 기반 다음 연습, Duolingo Practice Hub의 실수 복습, Busuu Study Plan의 목표 연결)를 그대로 잇는다 — 거기서 채택한 「도움받은 성과를 독립 성공과 구분」 · 「배운 표현을 새 상황에서 확인」을 이번에 엔진 기록으로 정직하게 만든다. 엔진 쪽 선례: TOPIK II 단원 지도의 과제 마디(조회용 · 증거는 문법 · 낱말만), 읽기 짧은 연습의 판정 허용 목록.
