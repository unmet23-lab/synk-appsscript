# 검수 묶음 town-w10-tea-r1

- 문항 26(새 0 · 기존 0) · 기준 rubric-compose-r1 e99953b21967a24a
- 판정: 통과 0 · 고침 26 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $1.6903 + 판정 $0.2755 = $1.9658 → 1,000문항 어림 $75.61
- 토큰 합계: 입력 57833 · 캐시 쓰기 119446 · 캐시 읽기 15087 · 출력 109534
- 아르곤 호출 12회 · 152분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | guest.tea.req-mine.1 | fix | fix | fix | The tea axis is unambiguous at every level, and L1–L3 follow the level rules and read naturally. L4 has only two sentences and a weak level- |
| u002 | guest.tea.req-ask.1 | fix | fix | fix | 축 판정은 모든 판에서 차만 정하고 정답과 같다. L1·L2는 그대로 써도 된다. L3·L4는 「오늘의 차 향」이 어색해서 향을 일반적인 「차 향」으로 바꾸고, 차 이름은 주문 문장으로 옮긴다. L4는 두 문장뿐이라 한 문장을 더해 서너 문장 규칙을  |
| u003 | guest.tea.req-temp-tea.1 | fix | fix | fix | A temperature-only order. The blind solve matches the key and the meaning is unambiguous. Two things need fixing. L4 has only two sentences, |
| u004 | guest.tea.req-sweet-tea.1 | fix | fix | fix | 축 판정은 모든 예에서 정답과 같다(tea·temp null, sweet 0/1/2). L1~L3은 판 규칙과 자연스러움을 모두 지켜 그대로 쓸 수 있다. L4만 두 문장이라 「서너 문장」 규칙에 어긋나므로, 둘째 문장을 「-ㄹ 텐데요.」로 끊어 세  |
| u005 | guest.tea.req-no-honey.1 | fix | fix | fix | 축은 네 판 모두 sweet 0 하나로 정해지고 정답과 같다. L2는 「-어서 + 주세요」 결합을 「-(으)니까」로 바꾸고, L4는 두 문장뿐이라 추측 문장 하나를 더해 서너 문장 규칙을 맞춘다. L1 · L3은 그대로 쓴다. |
| u006 | guest.tea.req-if-tea.1 | fix | fix | fix | L1·L2는 그대로 써도 되고, 정답과 블라인드 풀이가 모든 예에서 같다. L4는 두 문장뿐이라 「서너 문장」 규칙을 어기므로 한 문장을 더해야 한다. L3·L4는 오늘의 차(n3)를 「제일 유명한」·「동네에 오면 꼭 마셔 봐야 할」 것으로 말해 어색 |
| u007 | guest.tea.req-sweat.1 | fix | pass | fix | A의 블라인드 풀이 판단은 맞다. 네 판 모두 온도는 cold 하나로, 단맛은 0·1·2 하나로 정해진다. L4의 「따뜻한 차를 좋아하기는 하지만, 지금은 차갑게」도 실제 요청이 cold로 분명하다. 다만 L2의 「땀이 나서 … 주세요」는 이유의 -아 |
| u008 | guest.tea.req-tired.1 | fix | fix | fix | 축 값은 네 판 모두 하나로 정해지고 정답과 같다. L2는 「-아서+주세요」 결합을 「-니까」로 고쳐야 한다. L4는 두 문장이라 서너 문장 규칙에 맞게 문장을 나누고 「-ㄹ 텐데」 연결을 다듬어야 한다. L1·L3은 그대로 써도 된다. |
| u009 | guest.tea.req-after-meal.1 | fix | fix | fix | 축 판정은 네 판 모두 정답과 같다. 다만 L2는 계획처럼 읽혀 주문이 아니고 '밥을 먹은 뒤라'는 뜻과도 어긋나므로 「-어서 … 주세요」로 고친다. L4는 두 문장뿐이라 서너 문장 규칙을 어기고 n=3에서 「오늘은 오늘의 차」가 겹치므로 세 문장으로 |
| u010 | guest.tea.req-walked.1 | fix | fix | fix | The answer key and blind solve agree, and the four levels set the same values. L3 and L4 can be used as is. L1 should be adjusted to use the |
| u011 | guest.tea.req-cold-advice.1 | fix | fix | fix | 블라인드 풀이는 모든 예에서 정답과 같다. 다만 두 곳을 고쳐야 한다. L2는 「감기 기운이 있어서 + (주세요)」가 초급 문법 규칙(-어서 + 요청 불가)과 TOPIK I 어휘 범위에 걸리므로 「감기에 걸렸으니까 … 주세요」로 바꾼다. L4는 「시원 |
| u012 | guest.tea.req-same-all.1 | fix | fix | fix | The answer key matches the blind solve in all examples, so the answers are sound. Fixes are needed in three places. In L2, remove 「-는데」 to k |
| u013 | guest.tea.req-barley.1 | fix | fix | fix | L1·L2·L4는 판 규칙과 정답을 모두 지켜 그대로 쓸 수 있다. L3는 보리차를 들은 말로만 언급하고 주문 문장에서 차를 고르지 않아 tea 축이 흐리다. 「보리차로」를 넣어 직접 요청하게 고치면 된다. |
| u014 | guest.tea.req-window.1 | fix | pass | fix | I checked the item myself. The blind reading matches the answer key in every filled example, and the request axes are unambiguous. L1 and L3 |
| u015 | guest.tea.req-good-day.1 | fix | fix | fix | Blind reading matches the answer key in every example, and L1, L2, and L4 can be shown as they are. In L3, change 시험이 끝났더니, which attaches - |
| u016 | guest.tea.req-same-l4.1 | fix | fix | fix | 축 값은 네 판 모두 하나로 정해지고 정답과 일치한다. L1·L2·L4는 그대로 써도 된다. L3 첫 문장 「앞사람 차가 맛있다고 해서요」만 말한 사람이 빠져 어색하다. 「앞사람이 그 차가 맛있다고 해서요」(5어절, 간접 인용 유지)로 고치면 통과다. |
| u017 | guest.tea.req-belly.1 | fix | pass | fix | A는 블라인드 풀이 일치만 보고 통과시켰고, 풀이는 네 판·모든 채운 예에서 정답과 같다. 「시원한 것도 좋기는 하지만 … 그래서 따뜻하게 마실게요」도 온도가 warm 하나로 정해진다. 그러나 B가 짚은 n=3 문제는 실제로 있다. L3 n=3 「오늘 |
| u018 | guest.tea.req-yuzu-cold.1 | fix | fix | fix | Blind reading matches the answer key, and every level stays within its rules. The only change needed is in L1: the adnominal cold slot uses  |
| u019 | guest.tea.req-aroma-first.1 | fix | fix | fix | 축은 모든 판에서 하나로 정해지고 블라인드 풀이도 정답과 모두 같다. 고칠 곳은 두 가지다. L1·L2 n2의 「차가운」을 표의 말 「찬」으로 바꾸고, L2·L3의 「-아서 + 주세요」 꼴을 「-(으)니까」로 바꿔 이유를 「꿀 없이」에 붙인다. L4는 |
| u020 | guest.tea.req-coffee.1 | fix | fix | fix | 축 값은 네 판 모두 하나로 정해지고 정답과 같다. L1·L4는 그대로 써도 된다. L2는 「커피를 끊어서」가 뜻과 어긋나고 연결이 어색해 고친다. L3은 오늘의 차를 채울 때 「오늘은 오늘의 차를」로 겹치는 문제가 있어 「커피 대신」으로 바꾼다. |
| u021 | guest.tea.req-barley-night.1 | fix | fix | fix | The axes resolve to one value each, and blind reading matches the answer key in all 12 examples. All versions keep their level rules. Natura |
| u022 | guest.tea.react-match.2 | fix | fix | fix | 만족을 말하는 반응 줄로 L2·L3는 그대로 써도 됩니다. L1 「이거예요.」는 가리키기나 주문으로 읽힐 수 있으니 「바로 이거예요.」로 고칩니다. L4는 두 문장이라 서너 문장 규칙에 못 미치고 「말로만 해서」가 어색합니다. 양보(-기는 했어요 …  |
| u023 | guest.tea.react-again.1 | fix | fix | fix | L1은 그대로 쓸 수 있다. L2는 '-어 줘서'와 '맞아요'의 인과 연결이 어색하다. L3은 상대가 주어인 '-었더니'가 어색하다. L4는 4급 문형이 없어 판 규칙을 채우지 못한다. 세 판을 고치면 쓸 수 있으므로 판정은 fix이다. |
| u024 | guest.tea.react-tea.1 | fix | fix | fix | L2·L3은 그대로 쓸 수 있다. L1은 「좋아요」가 취향 표현으로 읽혀 틀린 차에 대한 반응이 드러나지 않는다. 그래서 「유자차로 주세요.」로 고친다. L4는 두 문장이라 서너 문장 규칙을 어긴다. 손님이 자기 탓으로 돌리는 추측 문장(-나 봐요)을 |
| u025 | guest.tea.regular-usual.2 | fix | fix | fix | 단골 말로서 뜻과 말투는 좋다. L3은 그대로 써도 된다. 고칠 곳은 세 가지다. L1의 -던은 TOPIK I 밖이다. L2의 「같은 걸로」는 앱에서 '앞 손님 차'를 가리키는 말이라 뜻이 엇갈리고, 바꾸면 L2 이음이 따로 필요하다. L4는 두 문장 |
| u026 | guest.tea.regular-match.2 | fix | fix | fix | 요청이 아닌 단골 반응 줄로, 내용과 말투는 자연스럽고 문제가 없다. 판 규칙에서 두 곳을 고쳐야 한다. L2의 「-던」이 3급 문형이라 TOPIK I 범위를 넘고, L4는 두 문장뿐이라 서너 문장 규칙에 못 미친다. L1과 L3은 그대로 써도 된다. |
