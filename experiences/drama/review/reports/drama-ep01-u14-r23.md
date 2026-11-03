# 검수 묶음 drama-ep01-u14-r23

- 대사 2(장면 0 · 처음 보는 2) · 기준 drama-spec-r6 e8ed6b116d8b2052
- 판정: 통과 1 · 고침 1 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $0.2745 + 판정 $0.1107 = $0.3852 → 1,000문항 어림 $192.62
- 토큰 합계: 입력 46815 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 18087
- 아르곤 호출 1회 · 12분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | u14-mb | fix | pass | fix | Neither reviewer's probes show a false note or a false sure pass. Wrong facts (coffee as morning's top pick, 28%, 15%) stay unsure passes be |
| u002 | u14-mc | pass | pass | pass | 평소와 시험 기간의 밤 손님을 「에 비해」로 비교하게 하는 처음 보는 대사다. 높임 · 핵심 말 · alts · 길이가 화면 자료와 맞고, 판정 시험에서 오노트도 너그러움도 없다. 핵심 말이 다 들리되 방향이 뒤바뀐 말이 지나가는 것은 규칙 판정의 한 |

## u14-mb · 처음 보는 · fix

- 대사: 설문 결과에 따르면 학생의 절반이 아침 메뉴로 샌드위치를 골랐습니다.
- Claude(pass): An unseen line reporting survey data to a professor. The four keys (item · source · figure · time) pin down the required information, and wrong facts or numbers stay unsure passes under the number rule and missing keys. No wrong notes and no leniency in the judge tests or blind tests. A sure pass on a morning/evening swap is a limit of the rules. Pass, with optional fixes only. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 3 · 다른 노트 0
- 아르곤(fix): 핵심 말 네 축과 높임 · 최소 음절 설계는 탄탄하나, 처음 보는 대사인데 keys[3].alts에 단독 「아침에」가 빠져 「아침에 절반이 · 아침에 50퍼센트가 · 아침에 카페에서」가 확실한 통과로 잡히지 않고 keys[2].alts에도 「학생의 반」과 「가장 많이 찾/고른」 어순 등이 빠져 있어 alts 보강(fix)이 필요하다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 2 · 노트 없음 2 · 다른 노트 0
- 판정(fix): Neither reviewer's probes show a false note or a false sure pass. Wrong facts (coffee as morning's top pick, 28%, 15%) stay unsure passes because of missing keys and the number rule. The informal-ending probe 「…1위야」 being only unsure is a known rule limit. A morning/evening swap passing as sure is also a limit of keyword-order matching. However, this is an unseen line, and keys[3].alts only accepts 「아침에」 in fixed combinations (아침에 샌드위치 · 학생 · 가장 · 제일), not on its own. As a result, very common correct answers fall to unsure and are not counted as 「혼자 해 봄」. These include 「교수님, 설문에 따르면 아침에 절반이 샌드위치를 골랐습니다」, 「아침에 50퍼센트가…」 and 「…아침에 카페에서…」. Adding 「아침에」 on its own barely increases leniency, because the 샌드위치 and figure keys are still required and it does not resemble 「저녁에」. In keys[2], 「학생들 반이 · 학생의 반이」 also falls to unsure because only 「반 정도」 is listed. So does the question-answering pattern 「가장 많이 찾는 것은 샌드위치」. Common correct phrasings are missing from the alts of an unseen line, so B's alts reinforcement is accepted. Everything else (listener fit, keys, length, skill, level, naturalness, unseen fit) is fine, as both reviewers agree.
- 고칠 점:
  - keys[3].alts에 『아침에』 · 『아침엔』 · 『아침 시간』 더함
  - keys[2].alts에 『학생의 반』 · 『학생 반이』 · 『학생들 반이』 더함
  - keys[2].alts에 『가장 많이 찾』 · 『제일 많이 찾』 · 『가장 많이 고른』 · 『제일 많이 고른』 더함
  - 선택: keys[2].alts에 『오십 프로』 · 『백오십 명』 · 『샌드위치가 일 위』 더함(받아 적기 한글 표기 대비)
  - 선택: 문법[0] 「에 따르면」을 TOPIK II 읽기 문법 id에 이음
  - Optional: link 문법[0] (에 따르면) to a TOPIK II reading-grammar id
  - Optional: add 「오십 프로」 to keys[2].alts (a common spoken form)
  - Optional: replace keys[3].alts 「아침에는」 with 「아침에는 샌드위치」 and 「아침에는 학생」 to reduce sure passes on morning/evening swaps (this lowers sure counts slightly, so decide after measuring)
  - keys[2].alts에 『학생의 반』 · 『학생 반이』 · 『가장 많이 찾』 · 『제일 많이 찾』 · 『가장 많이 고른』 · 『제일 많이 고른』 · 『샌드위치가 일 위』 · 『백오십 명』 더함

## u14-mc · 처음 보는 · pass

- 대사: 평소에 비해 시험 기간에는 밤에 손님이 훨씬 많아요.
- Claude(pass): 평소와 시험 기간의 밤 손님을 「에 비해」로 비교하게 하는 처음 보는 대사다. 높임 · 핵심 말 · alts · 길이가 화면 자료와 맞고, 판정 시험에서 오노트도 너그러움도 없다. 핵심 말이 다 들리되 방향이 뒤바뀐 말이 지나가는 것은 규칙 판정의 한계로 적는다. 흔한 쉬운 말 몇 개를 더하는 다듬기만 선택으로 남기고 pass로 둔다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 3 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 새 자료와 새 상대에게 비교 표현(-에 비해)을 옮긴 측정 카드로, 핵심 말 세 축(평소에 비해 · 밤 · 많아요)과 허용 표현 · 최소 음절이 오노트와 너그러움 없이 잘 맞물려 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 「보통보다」 더함
  - 선택: keys[2].alts에 「늘었어요」 · 「많이 있어요」 더함
  - 선택: keys[1].alts에서 「저녁」과 겹치는 「저녁에」 뺌
  - 선택: 문법 꼬리표 「에 비하여(S461)」에 id를 달고 TOPIK II 읽기 문법(ko2.reading.grammar)에 이음
  - 선택: keys[2].alts에 『늘어났습니다』 · 『늘어요』 · 『증가해요』 · 『증가했어요』 · 『증가합니다』 · 『증가했습니다』 더함(『늘었어요 · 늘었습니다』는 『줄었어요 · 줄었습니다』와 자모 닮음 0.8 이상이라 넣지 않고 『늘어났어요 · 늘어났습니다』로 덮음)
