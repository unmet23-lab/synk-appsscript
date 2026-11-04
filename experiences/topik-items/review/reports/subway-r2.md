# 검수 묶음 subway-r2

- 문항 56(새 0 · 기존 56) · 기준 topik-review-r1 612d69674d6139bf
- 판정: 통과 52 · 고침 4 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $1.2057 + 판정 $0.2327 = $1.4383 → 1,000문항 어림 $25.68
- 토큰 합계: 입력 95033 · 캐시 쓰기 0 · 캐시 읽기 970928 · 출력 91850
- 아르곤 호출 8회 · 59분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | subway-rush.stop.chungjeongno.pass.right.v1 | pass | pass | pass | 목표(시청역 환승)와 방송(충정로역, 5호선 환승)을 견줘 「그대로」를 고르는 게임 문항입니다. 정답이 하나뿐이고, 「오른쪽 문」 오답의 매력도 좋습니다. 해설도 근거를 바르게 짚어 통과입니다. |
| u002 | subway-rush.stop.cityhall.off.left.v1 | pass | pass | pass | 목표 역과 문 방향을 방송에서 듣고 고르는 문항으로, 정답이 유일하고 대본이 자연스럽다. 해설에 '그대로'가 왜 틀렸는지 한 줄을 덧붙이면 더 좋지만 그대로 써도 학습자에게 해가 없어 통과로 본다. |
| u003 | subway-rush.fork.청량리.jongno5.v1 | pass | pass | pass | 청량리 방면을 그대로 듣고 고르는 짧은 게임형 문항입니다. 정답이 하나뿐이고, 반대 방향 보기가 적절한 함정입니다. 해설에 서울역 방면 오답의 까닭을 한 줄 더하면 좋겠지만 통과에 지장은 없습니다. |
| u004 | subway-rush.stop.jongno3.pass.right.v1 | pass | pass | pass | 목적지(종로5가)와 이번 역(종로3가)을 구별해 그대로 타는 것이 유일한 정답이에요. 「오른쪽 문」이 좋은 함정이 되고, 게임 꼴 안에서 기준을 모두 만족해서 통과예요. |
| u005 | subway-rush.stop.jongno5.off.right.v1 | pass | pass | pass | 목표 역 도착과 문 방향이라는 세부 정보를 듣는 짧은 게임형 문항입니다. 정답이 유일하고 오답도 그럴듯하며 난도와 능력이 맞아 통과입니다. |
| u006 | subway-rush.exit.3.v1 | pass | pass | pass | 정답 유일, 5번(종로 오가) 함정이 적절하고 1급 수준에 맞는 게임 문항입니다. 해설이 짧지만 학습자에게 해가 없어 통과합니다(선택 사항: 해설에 「종로 오가의 '오'는 역 이름이에요」 한 줄 추가). |
| u007 | subway-rush.stop.chungjeongno.pass.left.v1 | pass | pass | pass | 목표 환승역(시청)과 현재 역(충정로)을 비교해 「그대로」를 고르는 문항으로, 정답이 유일합니다. 「왼쪽 문」 함정도 적절합니다. 해설의 「내릴 곳」은 「갈아탈 곳」으로 다듬으면 더 좋겠지만, 그대로 통과해도 학습자에게 해가 없습니다. |
| u008 | subway-rush.stop.cityhall.off.right.v1 | pass | pass | pass | 정답이 오른쪽 문 하나로 분명하고, 오답도 그럴듯하며, 방송 말투가 자연스러운 게임 각색 문항이에요. 해설을 조금 보완할 여지만 있어서 통과로 판정해요. |
| u009 | subway-rush.fork.청량리.dongdaemun.v1 | pass | pass | pass | 정답이 유일하고 대본·보기·해설이 게임 꼴 안에서 바릅니다. 해설에 오답 설명을 덧붙이면 더 좋지만 그대로 써도 학습자에게 해가 없어 통과입니다. |
| u010 | subway-rush.stop.dongdaemun.off.right.v1 | pass | pass | pass | 길 안내의 목표 역과 방송의 역 이름·문 쪽을 이어 들으면 '오른쪽 문'만 정답이 됩니다. 오답·난도·능력이 모두 맞아 통과로 판정합니다. |
| u011 | subway-rush.exit.4.v1 | pass | pass | pass | 마지막 안내의 「사 번 출구」로 정답이 하나로 정해지는 쉬운 세부 듣기 문항입니다. 오답 번호가 대본에 없어 매력도는 낮지만, 게임 꼴에서는 문제가 되지 않아 통과입니다. |
| u012 | subway-rush.stop.jongno3.pass.left.v1 | pass | pass | pass | 목표 역(종로 오가)과 이번 역(종로 삼가)을 비교해 「그대로」를 고르는 문항이다. 정답이 유일하고, 문 쪽·환승 안내가 매력적인 오답 역할을 한다. 그대로 써도 된다. |
| u013 | subway-rush.exit.5.v1 | pass | pass | pass | 정답(5번 출구)이 마지막 안내로 분명히 유일하고, 난도·능력 표시도 맞다. 오답 숫자가 대본에 없어 매력도가 낮고 해설이 짧지만, 게임 꼴에서는 학습자에게 해가 없어 통과로 판정한다. |
| u014 | subway-rush.stop.dongdaemun.off.left.v1 | pass | pass | pass | 목적지와 이번 역이 같고 방송이 왼쪽 문을 알려 주므로 정답이 분명하다. 오답도 흔한 실수를 잘 겨누고, 게임 꼴 안에서 기준을 모두 충족해 통과한다. |
| u015 | subway-rush.exit.6.v1 | pass | pass | pass | 마지막 안내의 「육 번 출구」로 정답이 하나로 정해진다. 오답은 일호선·이웃 숫자로 그럴듯하게 짜였고, 1급 세부 듣기 게임 문항으로 문제가 없다. 해설에 대본 문장을 인용하면 더 좋지만 사소하다. |
| u016 | subway-rush.fork.청량리.jongno3.v1 | pass | pass | pass | 정답(청량리 방면)이 하나뿐이고 근거가 분명합니다. 게임 꼴 안에서 기준을 충족합니다. 해설에 「나가는 곳」이 왜 틀렸는지 한 줄 더하면 좋겠지만 필수는 아닙니다. |
| u017 | subway-rush.stop.jongno3.off.left.v1 | pass | pass | pass | 목표역 도착과 「내리실 문은 왼쪽」으로 정답이 하나로 정해진다. 게임 꼴 안에서 기준을 모두 충족하므로 통과로 판정한다. |
| u018 | subway-rush.exit.2.v1 | pass | pass | pass | 정답이 유일하고 게임 꼴 안에서 26번형 세부 듣기로 잘 작동한다. 해설이 짧고 「이 번/이번」 소리 겹침이 사소한 메모일 뿐이라 통과한다. |
| u019 | subway-rush.stop.jongno5.off.left.v1 | pass | pass | pass | 목표 역과 이번 역이 같아 내려야 하고, 방송이 문 방향을 분명히 말해 정답 「왼쪽 문」이 유일하다. 낱말·길이가 1급 앞쪽에 맞고 게임 꼴 안에서 문제가 없어 통과로 판정한다. |
| u020 | subway-rush.exit.8.v1 | pass | pass | pass | 마지막 안내의 「팔 번 출구」로 정답 8번 출구가 유일하게 정해진다. 1급 앞쪽 세부 듣기로 게임 꼴 안에서 문제가 없어 통과한다. |
| u021 | subway-rush.stop.jongno3.off.right.v1 | pass | pass | pass | 목표 역과 안내방송의 역 이름을 맞춰 보고, 「내리실 문은 오른쪽」을 들으면 정답이 하나로 정해진다. 게임 꼴 안에서 기준을 모두 충족하므로 통과한다. |
| u022 | subway-rush.exit.1.v1 | pass | pass | pass | 마지막 안내의 「일 번 출구」로 정답이 하나로 정해지는 쉬운 세부 듣기 문항이다. 해설이 짧은 점 말고는 문제가 없어 통과로 판정한다. |
| u023 | subway-rush.exit.7.v1 | pass | pass | pass | 대본의 「칠 번 출구」로 정답이 하나로 정해지고, 오답도 그럴듯하다. 해설이 짧지만 정확해서 통과로 본다. |
| u024 | subway-rush.stop.euljiro3.pass.left.v1 | pass | pass | pass | 정답 「그대로」가 유일하고 오답 「왼쪽 문」이 방송 말로 잘 유인한다. 해설이 짧지만 근거를 바르게 짚으므로 통과로 판정한다. |
| u025 | subway-rush.stop.euljiro3.pass.right.v1 | pass | pass | pass | 목표 역(시청)과 지금 역(을지로3가)을 맞대어 「그대로」를 고르는 문항으로, 정답이 하나뿐이에요. 방송의 「오른쪽」과 「갈아타실 분」이 그럴듯한 함정이 되고, 말투·난도·해설 모두 문제가 없어 통과예요. |
| u026 | subway-rush.busy.short.right.v1 | pass | pass | fix | 직접 풀어 보면 정답은 2(오른쪽 문)입니다. 안내방송의 「모두 내려 주시기 바랍니다」와 「내리실 문은 오른쪽입니다」가 답을 하나로 정해 줍니다. 앞서 들은 「시청역에서 일호선으로 갈아타세요」도 내려야 한다는 쪽을 가리키므로 「그대로」는 분명히 틀리고 |
| u027 | subway-rush.busy.express.jonggak.jongno3.v1 | pass | pass | pass | 정답이 유일하고 오답도 방송 말을 활용해 그럴듯합니다. 방송 문장 「급행으로 종각역에만 서지 않습니다」를 「급행열차로 종각역에만 서지 않습니다」로 다듬으면 더 자연스럽지만, 고치지 않아도 학습자에게 해가 없어 통과입니다. |
| u028 | subway-rush.busy.exit.3.4.v1 | pass | pass | fix | I solved the item before looking at the answer key and got choice 0, '4번 출구', which matches the key. The final announcement, 「삼 번 출구는 공사로 이용 |
| u029 | subway-rush.busy.delay.1to2.v1 | pass | pass | pass | 마지막 안내방송의 변경 정보(1호선 고장 → 2호선 이용)로 정답이 하나로 정해지고, 앞서 들은 안내가 좋은 오답 구실을 한다. 게임 꼴 안에서 기준을 충족해 통과다. |
| u030 | subway-rush.stop.euljiro3.off.right.v1 | pass | pass | pass | 목표 역과 안내방송의 문 쪽을 맞춰 「오른쪽 문」을 고르는 게임형 TI-L-26 문항이다. 정답이 유일하고 오답도 자연스러워 통과로 판정한다. |
| u031 | subway-rush.busy.exit.4.3.v1 | pass | pass | pass | 마지막 안내방송에서 출구가 4번에서 3번으로 바뀐 것을 듣는 문항이다. 정답이 하나로 분명하고, 4번이라는 매력적인 오답이 있으며, 대본도 자연스럽다. 게임 꼴 안에서 그대로 쓸 수 있다. |
| u032 | subway-rush.busy.short.left.v1 | pass | pass | pass | 종착 안내를 듣고 왼쪽 문으로 내리는 게임형 문항이다. 정답이 하나로 분명하고 표현이 자연스러우며 능력·난도 표시도 맞아 통과로 본다. |
| u033 | subway-rush.busy.express.jonggak.jongno5.v1 | fix | fix | pass | 정답 0번(이 열차 타기)은 맞고, 반대편 승강장 보기는 분명히 틀린다. 그러나 방송 문장 「급행으로 종각역에만 서지 않습니다」는 한국어로 어색하다. 「급행」은 보통 여러 역을 건너뛴다는 뜻으로 들려, 이 열차가 종로5가에도 서는지 의심할 여지가 생긴 |
| u034 | subway-rush.busy.exit.5.3.v1 | pass | pass | pass | 바뀐 출구 안내를 듣고 3번 출구를 고르는 게임 문항이다. 정답이 분명하고 해설도 맞다. 4번 보기가 약하지만 게임 꼴에서는 문제가 없어 통과로 판정한다. |
| u035 | subway-rush.stop.euljiro3.off.left.v1 | pass | pass | pass | 목표 역 도착과 내릴 문 방향을 대본에서 분명히 알 수 있고, 정답은 하나뿐입니다. 게임 꼴 안에서 기준을 모두 충족하므로 통과입니다. |
| u036 | subway-rush.busy.exit.6.7.v1 | pass | pass | pass | 6번에서 7번으로 바뀐 출구를 듣는 게임 문항이다. 정답이 유일하고 대본과 해설이 바르다. 오답 「1번 출구」가 약한 점만 사소하다. |
| u037 | subway-rush.busy.exit.7.6.v1 | pass | pass | pass | 안내방송의 출구 변경 정보를 듣고 6번 출구를 고르는 문항이다. 정답이 하나뿐이고, 오답 7번은 바뀌기 전 정보로 매력도가 있다. 게임 꼴 안에서 기준을 모두 충족해 통과한다. |
| u038 | subway-rush.busy.exit.1.2.v1 | pass | pass | pass | 정답 2번 출구가 유일하고, 1번 출구가 좋은 함정이다. 7번 출구는 약한 오답이지만 게임 꼴에서 사소한 문제라 통과로 판정한다. 고친다면 대본에 나오는 다른 숫자(예: 「이호선」에서 나온 「3번 출구」 같은 혼동 숫자)로 바꾸는 것을 고려할 수 있다 |
| u039 | subway-rush.busy.exit.2.1.v1 | pass | pass | pass | 정답 「1번 출구」가 유일하고 앞서 들은 2번을 함정으로 쓴 게임 각색 문항으로, 그대로 써도 됩니다. 「4번 출구」의 매력이 약한 점과 「이 번/이번」 소리 겹침은 사소합니다. |
| u040 | subway-rush.fork.청량리.jonggak.v1 | pass | pass | pass | 안내의 「청량리 방면」으로 정답이 유일하고, 오답(반대 방향·출구)도 그럴듯합니다. 게임 꼴 안에서 문제가 없어 통과입니다. 해설에 서울역 방면이 왜 틀렸는지 한 줄 더하면 좋겠습니다. |
| u041 | subway-rush.busy.express.jonggak.jonggak.v1 | fix | fix | fix | 정답은 하나이고 오답 설계도 좋습니다. 다만 방송 문장 「종각역에만 서지 않습니다」가 어색하고 뜻이 두 가지로 읽힐 수 있어 「종각역에 서지 않습니다」로 고쳐야 합니다. |
| u042 | subway-rush.stop.jonggak.off.right.v1 | pass | pass | pass | 내릴 역 종각에서 방송이 말한 오른쪽 문을 고르는 문항으로, 정답이 하나뿐이고 게임 꼴 안에서 기준을 모두 충족해 통과예요. |
| u043 | subway-rush.stop.jonggak.off.left.v1 | pass | pass | pass | 목표 역과 안내방송의 역이 같고 「내리실 문은 왼쪽」이 답을 정한다. 정답이 하나로 분명하며 게임 꼴 안에서 기준을 모두 충족해 통과로 판정한다. |
| u044 | subway-rush.meet.worker.chungjeongno.v1 | pass | pass | pass | The answer comes straight from the announcement 「다음 역은 충정로입니다」, and the language and type fit the game format. The item is very easy but has |
| u045 | subway-rush.meet.worker.cityhall.v1 | pass | pass | pass | 방송의 「시청」으로 정답이 하나로 갈리는 쉬운 세부 듣기 문항이다. 게임 꼴 안에서 기준을 모두 충족해 통과로 판정한다. |
| u046 | subway-rush.meet.worker.euljiro1.v1 | pass | pass | pass | 방송의 역 이름을 듣고 그대로 대답하는 단순한 세부 듣기 문항입니다. 정답이 유일하고 오답도 그럴듯합니다. 해설에 오답 설명 한 줄을 더하면 좋지만, 고치지 않아도 통과입니다. |
| u047 | subway-rush.meet.worker.euljiro3.v1 | pass | pass | pass | The answer is unique, and the item works well as a level-1 detail-listening question in game form. Adding a one-line explanation of why 을지로입 |
| u048 | subway-rush.meet.worker.jongno3.v1 | pass | pass | pass | 방송에서 들은 역 이름을 고르는 간단한 세부 듣기 문항이에요. 정답이 하나뿐이고 오답도 소리로 헷갈리게 잘 짜여 있어서 그대로 써도 돼요. |
| u049 | subway-rush.meet.worker.jongno5.v1 | pass | pass | pass | 방송의 역 이름을 듣고 대답하는 게임 문항입니다. 정답이 유일하고 오답도 그럴듯해 통과입니다. 해설에 「종로3가와 헷갈리지 않게」 한 줄을 더하면 더 좋지만 필수는 아닙니다. |
| u050 | subway-rush.meet.worker.dongdaemun.v1 | pass | pass | pass | 방송에 나온 다음 역을 그대로 듣고 답하는 쉬운 세부 듣기 게임 문항이에요. 정답이 하나뿐이고 오답(이웃 역 이름)도 그럴듯해서 그대로 써도 돼요. |
| u051 | subway-rush.meet.worker.ahyeon.v1 | pass | pass | pass | 방송의 「다음 역은 아현입니다」를 듣고 바로 대답하는 쉬운 세부 듣기 게임 문항이에요. 정답이 하나뿐이고 말이 자연스러워요. 자리 꼴(TI-L-26)과는 조금 다르지만 adapted 게임 꼴 안에서는 문제없어 통과로 봐요. |
| u052 | subway-rush.meet.traveler.cityhall.v1 | pass | pass | fix | The item can go to students as is. Before checking the key I solved it myself and got choice 2. The announcement says 「시청 방면으로 갑니다」 ("this t |
| u053 | subway-rush.meet.traveler.cheongnyangni.v1 | pass | pass | fix | 이 문항은 TI-L-01 자리에 맞습니다. 옆 사람의 「이 열차 청량리에 가요?」라는 네/아니요 물음에 알맞게 대답하는 문항이고, 판단 근거는 바로 앞 안내방송 「청량리 방면으로 갑니다」입니다. 그래서 정답은 「네, 청량리에 가요」 하나로 분명합니다. |
| u054 | subway-rush.meet.traveler.euljiro3.v1 | pass | pass | fix | 내가 먼저 풀었을 때 정답은 2번 「네, 을지로3가에 가요」이고, 정해진 정답과 같다. 안내방송 「을지로 삼가 방면으로 갑니다」가 근거다. 「아니요」 대답은 이 안내와 바로 어긋난다. 「저도 처음이에요」는 네/아니요 물음에 맞지 않는 대답이고, 학습자 |
| u055 | subway-rush.meet.traveler.myeongdong.v1 | fix | fix | fix | The yes/no response structure suits the slot, but 「시청 방면」 alone does not rule out that the train goes to 명동. The answer can be disputed and  |
| u056 | subway-rush.meet.traveler.airport.v1 | fix | pass | fix | The item fits TI-L-01: a yes/no question asked inside a game scene, answered with 「아니요」. The answer is the intended one. The weak point is t |
