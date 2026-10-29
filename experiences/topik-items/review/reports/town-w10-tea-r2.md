# 검수 묶음 town-w10-tea-r2

- 문항 23(새 0 · 기존 0) · 기준 rubric-compose-r1 a3076395e063d620
- 판정: 통과 7 · 고침 16 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $1.3411 + 판정 $0.7386 = $2.0797 → 1,000문항 어림 $90.42
- 토큰 합계: 입력 49151 · 캐시 쓰기 99192 · 캐시 읽기 19720 · 출력 84405
- 아르곤 호출 13회 · 100분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | guest.tea.req-mine.1 | fix | fix | pass | 이 틀은 차 축만 정하고 온도와 단맛은 정하지 않는다. 블라인드 풀이는 네 판 모든 예에서 정답과 같다(tea만 값이 있고 temp·sweet는 null). 「따뜻」·「달」 같은 말이 없어 다른 축을 요청한 것처럼 읽힐 여지도 없다. L1(2~3어절, |
| u002 | guest.tea.req-ask.1 | pass | pass | pass | 차 종류 하나만 정하는 단순 주문 틀이다. 네 판 모두 판 규칙·자연스러움·정답 일치를 만족하므로 그대로 쓴다. |
| u003 | guest.tea.req-temp-tea.1 | pass | pass | pass | An order template that states only the temperature. Blind readings at all four levels match the answer key, the level rules are met, and the |
| u004 | guest.tea.req-no-honey.1 | pass | pass | fix | 네 판 모두 단맛 0(꿀 없이 · 꿀은 빼고)만 요청하고 차와 온도는 정하지 않는다. 블라인드 풀이는 모든 판에서 tea null · temp null · sweet 0이어서 정답과 같다. L4 「마시기는 편하겠지만」은 양보 속에 나온 말이고, 바로  |
| u005 | guest.tea.req-if-tea.1 | pass | pass | pass | Each axis has a single answer at every level, and the blind reading matches the intended answers. The level rules (sentence count, eojeol co |
| u006 | guest.tea.req-sweat.1 | fix | pass | fix | Blind reading matches the answer key at every level: temperature is cold, tea is not set, and sweetness is 0/1/2. L2 can go out as is. L4 ca |
| u007 | guest.tea.req-tired.1 | fix | fix | pass | In every level the tea is fixed by its blank, sweet is fixed at 2 ('달게'), and temperature is not requested (null). My blind reading matches  |
| u008 | guest.tea.req-after-meal.1 | fix | pass | fix | 네 판 모두 축 판정은 같다. 차는 채운 값, 온도는 null, 단맛은 0이다. 블라인드 풀이도 정답과 모두 같다. L1 · L3 · L4는 어절 수, 문형(-더니, -기는 하겠지만), 부정 표현 과제, 자연스러움 모두 문제가 없다. L4의 양보 대조 |
| u009 | guest.tea.req-walked.1 | pass | pass | fix | 다시 따져 보니 검수자 A의 판정이 맞다. 네 판 모두 tea·temp·sweet가 값 하나로 정해지고, 블라인드 풀이가 정답과 모두 같다. 판별 풀이: L1 barley/cold/0, yuzu/cold/1, today/cold/2. L2 이유 「많이 |
| u010 | guest.tea.req-cold-advice.1 | fix | fix | fix | 축 값이 네 판 모두 하나로 정해지고 정답과도 일치한다. 판 규칙과 부정 표현 과제도 잘 맞는다. L4에서 tea=today일 때 '오늘은 … 오늘의 차'로 겹치는 부분만 고치면 된다. |
| u011 | guest.tea.req-barley.1 | fix | fix | fix | The blind solve matches the key in all examples, and the sentence count, eojeol count and patterns of every level are within the rules. The  |
| u012 | guest.tea.req-window.1 | fix | fix | fix | 축 값은 네 판 모두 정답과 같고 하나로 정해진다. L1·L3·L4는 그대로 쓸 수 있다. L2만 「창가에서 마시니까」가 주문의 이유가 되지 않고, 값에 따라 반대 이유처럼 읽히는 어색한 연결이다. 배경 -는데(「창가에 앉을 건데」, 8어절)로 바꾸면 |
| u013 | guest.tea.req-good-day.1 | fix | fix | fix | The answer key is correct, every axis resolves to one value at every level, and level rules are met. Only L3 needs fixing for naturalness. T |
| u014 | guest.tea.req-same-l4.1 | fix | pass | fix | L1~L3은 그대로 써도 된다. L1은 4어절에 이음이 없고, L2는 7어절에 「같은 걸로」 하나만 더했다. L3은 「-다고 해서요」라는 간접 인용을 쓰고 문장마다 10어절 안이다. 블라인드 풀이도 정답과 같다. 「꿀은 조금만 주세요」·「꿀을 듬뿍 주 |
| u015 | guest.tea.req-belly.1 | fix | pass | fix | 네 판 모두 차·온도·단맛이 하나로 정해집니다. L4의 대조 「시원한 것도 좋기는 하지만 … 따뜻하게」도 따뜻한 쪽으로 분명히 읽혀, 블라인드 풀이가 정답과 모두 같습니다. 그래서 A의 answer_unique 판단은 맞습니다. 다만 B가 짚은 문장  |
| u016 | guest.tea.req-aroma-first.1 | fix | fix | fix | The blind reading matches the answer key in all examples, and the meaning, the contrast structure, and the negation-expression task are all  |
| u017 | guest.tea.req-coffee.1 | fix | pass | fix | 네 판 모두 세 축이 하나로 정해지고, 블라인드 풀이가 정답과 모두 같다. L1은 4어절에 이음이 없고, 「보리차를 따뜻하게, 안 달게요」는 「주세요」를 줄인 주문 말투로 쓸 수 있다. 그래서 B가 지적한 조사·종결 오류는 받아들이지 않는다. L4는  |
| u018 | guest.tea.req-barley-night.1 | fix | fix | fix | 축 값은 네 판 모두 하나로 정해지고, 블라인드 풀이가 정답과 같다. 판 규칙과 부정 표현 과제에도 맞다. 다만 L4 n3의 끝 문장 「꿀을 듬뿍요.」가 어색하므로 「꿀은 듬뿍 넣어 주세요.」로 고친다. |
| u019 | guest.tea.react-match.2 | pass | pass | fix | 요청이 아닌 반응 줄이므로 answer_unique·skill_fit은 「요청 아님」으로 ok다. L1 「바로 이거예요.」는 2어절 한 문장으로 이음이 없고 자연스럽다. L2 「부탁한 그대로라서 좋아요.」는 3어절이고 이유 하나(-라서)만 있으며 TO |
| u020 | guest.tea.react-again.1 | fix | fix | fix | 부드러운 반응 줄로 뼈대는 좋다. L1은 그대로 쓴다. 고칠 판은 셋이다. L2는 판 규칙의 이유 이음(-아서)을 넣고 뜻(고맙다)을 살린다. L3는 「잘못했나」 띄어쓰기와 쉼표 이음을 고친다. L4는 「한 번에 말했으면」이 게임 상황과 어긋나므로 「 |
| u021 | guest.tea.react-tea.1 | fix | pass | fix | 이 줄은 반응 줄이다. 그래서 answer_unique와 skill_fit은 「요청 아님」으로 ok이고, naturalness · culture_bias · level_fit · type_fit만 본다. 판 규칙은 네 판 모두 지킨다. L1은 3어절이 |
| u022 | guest.tea.regular-usual.2 | fix | fix | pass | 요청이 아닌 단골 줄이므로 naturalness · culture_bias · level_fit · type_fit만 본다. L1(3어절, 이음 없음), L3(두 문장, 8어절 · 6어절, -게 되다 · -더라고요), L4(두 문장, 10어절 · 3어 |
| u023 | guest.tea.regular-match.2 | pass | pass | fix | 이 줄은 요청이 아닌 반응 줄이어서 naturalness · culture_bias · level_fit · type_fit만 보았다. 네 판 모두 통과한다. L1 「이 맛이 좋아요.」는 한 문장 3어절이고 이음이 없다. L2는 5어절이고 이유 「-라 |
