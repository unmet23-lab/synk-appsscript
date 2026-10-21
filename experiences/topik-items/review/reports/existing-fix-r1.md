# 검수 묶음 existing-fix-r1

- 문항 67(새 0 · 기존 67) · 기준 topik-review-r1 612d69674d6139bf
- 판정: 통과 63 · 고침 4 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $2.0618 + 판정 $0.1213 = $2.1831 → 1,000문항 어림 $32.58
- 토큰 합계: 입력 83498 · 캐시 쓰기 184558 · 캐시 읽기 977088 · 출력 105887
- 아르곤 호출 17회 · 24분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | korean-runner.listening-check.check-fence-jump.v2 | pass | pass | pass | 지시가 분명하고 정답이 유일한 게임형 세부 듣기 문항입니다. '울타리'가 다소 어렵고 speaker 표기가 규정과 다른 점은 사소하여 통과합니다. |
| u002 | korean-runner.listening-check.check-sign-duck.v2 | pass | pass | pass | 게임 꼴 세부 듣기 문항이다. 정답이 분명하고 오답이 행동 선택지로 고르며 해설도 정확해서 통과다. 「표지판」「숙이다」가 1급 앞쪽보다 조금 높은 점만 참고한다. |
| u003 | korean-runner.listening-check.check-no-fence.v2 | pass | pass | pass | 부정 표현 「-지 않아도 돼요」를 듣고 행동을 고르는 게임 문항이다. 정답이 하나로 분명하고, 오답은 대본 낱말을 써서 그럴듯하다. 해설도 정확해 통과로 판정한다. |
| u004 | korean-runner.listening-check.check-high-sign.v2 | pass | pass | pass | 「숙이지 않아도 돼요」를 듣고 그대로 지나가기를 고르는 부정 이해 문항이다. 정답이 하나뿐이고 함정 보기도 적절해 게임 꼴로 그대로 쓸 수 있다. |
| u005 | korean-runner.listening-check.check-middle-left.v1 | pass | pass | pass | 순서 문형 「-(으)ㄴ 다음」을 듣고 행동 순서를 고르는 게임 문항입니다. 정답이 유일하고 오답이 적절하며 해설도 정확해 통과입니다. |
| u006 | korean-rhythm:t0q1:v1:claim0 | pass | pass | pass | 「카페에서 친구를 기다리고 있어요」에서 지금 카페에 있음이 바로 드러나 정답 O가 유일하다. 1급 수준이고 해설도 바르다. 그대로 통과. |
| u007 | korean-rhythm:t0q4:v1:claim0 | pass | pass | pass | 시간 변경을 듣고 바뀐 시각을 확인하는 O/X 문항으로, 정답(O)이 유일하고 해설도 정확합니다. 게임 꼴 안에서 문제가 없어 통과합니다. |
| u008 | korean-rhythm:t1q0:v1:claim1:v2 | fix | fix | pass | A의 지적이 맞다. 문항 내용은 문제없다. 이야기에서 취소 이유가 「비가 많이 왔어요」로 분명하므로 「추워서」를 묻는 말에는 X가 유일한 답이다. 정답을 가르는 정보도 까닭이라 ko.listening.reason에 맞고, 기존 게임 꼴이므로 한국어 해 |
| u009 | korean-rhythm:t1q1:v1:claim1 | pass | pass | pass | 정답 X가 분명하고, 「오래 쓸 수 있어요」가 적절한 함정이 된다. 초급에 맞는 기존 O/X 문항으로 통과. |
| u010 | korean-rhythm:t1q3:v1:claim1 | pass | pass | pass | 현재 진행과 과거를 가르는 1급 듣기 O/X 문항이다. 정답 X가 분명하고 게임 꼴 안에서 기준을 모두 충족해 통과다. |
| u011 | korean-rhythm:t2q0:v1:claim1 | pass | pass | pass | 「-어야」 필요조건을 듣고 예약 없이는 이용할 수 없음을 판단하는 O/X 문항입니다. 정답 X가 유일하고 능력·난도·해설이 모두 맞아 통과입니다. |
| u012 | korean-rhythm:t2q1:v1:claim0 | pass | pass | pass | 정답 O가 분명하고 해설도 정확해요. 게임 O/X 꼴 안에서 급·난도·능력이 맞아 통과예요. |
| u013 | korean-rhythm:t2q2:v1:claim0:v2 | fix | fix | fix | 정답 O는 유일하고 문장도 자연스러워요. 다만 '찬성하다/동의하다'는 TOPIK I 범위를 넘는 중급 낱말로 보이고, 정답을 가르는 정보가 세부 정보가 아니라 유의어 뜻이에요. 그래서 시험 구분이나 낱말, 그리고 대표 능력을 고치면 쓸 수 있어요. |
| u014 | korean-rhythm:t2q3:v1:claim0 | fix | fix | fix | 정답 O는 맞지만 「일정」과 「날짜」가 어긋나 정답에 다툴 여지가 조금 있다. 해설 마지막 문장도 근거와 상관없다. 묻는 말이나 이야기의 낱말을 맞추고 해설을 다듬으면 쓸 수 있다. |
| u015 | korean-rhythm:t2q4:v1:claim0 | pass | pass | pass | 정답 O가 분명하고 낱말 바꿔 말하기를 잘 확인하는 게임형 O/X 문항으로, 그대로 써도 된다. |
| u016 | blank-slice.v08.v2 | pass | pass | pass | 「물 좀 주세요」가 단서인 낱말 빈칸 문항이에요. 정답 「매워요」 하나만 맞고, 보기 꼴과 난도가 알맞아서 그대로 써도 돼요. |
| u017 | blank-slice.a01.v1 | pass | pass | pass | '아직'과 '안 했어요'의 호응을 묻는 1급 문형 빈칸 문항이에요. 정답이 하나뿐이고 자연스러워서 통과예요. 해설에 '할게요' 오답 설명을 더하면 더 좋아요. |
| u018 | blank-slice.e06.v2 | pass | pass | pass | 정답 '타세요'가 유일하고 급·유형에 맞는 기존 게임 문항입니다. '타고'·'타면'이 꼴만으로 지워지는 약점이 있으나 학습자에게 해가 없어 통과합니다. |
| u019 | blank-slice.e07.v2 | pass | pass | pass | 정답 '도와줄'이 '내일 … 거예요'로 유일하게 정해지는 1급 문법 빈칸 문항이에요. 발문 말투만 시험과 조금 다르고, 그 밖에는 문제가 없어 통과예요. |
| u020 | blank-slice.a02.v1 | pass | pass | pass | 정답 '열심히'가 유일하고 오답 부사도 쓰임으로 분명히 걸러진다. 1급 수준에 맞는 깔끔한 낱말 빈칸 문항이다. 발문 말투(-세요)만 시험 꼴과 다르지만 기존 게임 문항이라 그대로 통과시킨다. |
| u021 | blank-slice.p06.v1 | pass | pass | pass | 목적격 조사 '을'을 묻는 기본 문항이에요. 정답이 유일하고 오답이 적절하며 해설도 바르게 되어 있어서 통과예요. |
| u022 | blank-slice.v14.v1 | pass | pass | pass | 정답 '샀어요'가 하나뿐이고 1급 낱말 빈칸으로 알맞아요. 오답 둘이 조금 쉽게 지워지지만 학습자에게 해가 없어 통과예요. |
| u023 | synk-town.reading-check.town-reading-place.v2 | pass | pass | pass | 정답 '찻집 안'이 유일하고 오답은 때만 바꿔 그럴듯합니다. 게임 꼴(보기 셋, 의문사 발문)은 기존 문항이라 허용되며, 해설도 근거를 바르게 짚어 통과입니다. |
| u024 | synk-town.reading-check.town-reading-negation.v2 | pass | pass | pass | 정답이 유일하고 오답이 글의 허용 장소를 써서 그럴듯합니다. 부정 이해 능력과 난도 1에 맞는 기존 게임 문항이라 통과입니다. |
| u025 | synk-town.reading-check.town-detail-lost.v2 | pass | pass | pass | 분실물 안내문에서 우산의 보관 장소를 찾는 세부 정보 문항이다. 정답이 하나로 분명하고 기존 게임 꼴 안에서 기준을 충족하므로 통과로 본다. 「사무실」 보기가 다소 약한 점만 사소하다. |
| u026 | synk-town.reading-check.town-negation-books.v2 | pass | pass | pass | 정답이 유일하고 능력·난도도 맞는 기존 게임 문항입니다. 0번 오답이 약한 것은 사소하므로 통과합니다. |
| u027 | synk-town.reading-check.town-negation-bus.v2 | pass | pass | pass | 정답이 유일하고 근거가 분명한 1급 안내문 문항입니다. 기존 게임 꼴(보기 셋)을 감안하면 고칠 점이 없어 통과입니다. |
| u028 | synk-town.reading-check.town-sequence-borrow.v2 | pass | pass | pass | 정답 '이름 적기'가 유일하고, 순서 능력을 바르게 겨눈 쉬운 게임형 문항이다. 그대로 써도 된다. |
| u029 | synk-town.reading-check.town-sequence-class.v2 | pass | pass | pass | 정답 「재료 받기」가 하나뿐이고 순서 능력과 잘 맞는 짧은 게임 문항입니다. 「공방」「-고 나서」가 1칸 위쪽에 걸친다는 점과 발문이 해요체라는 점은 사소해서 통과로 봅니다. |
| u030 | synk-town.reading-check.town-sequence-garden.v2 | pass | pass | pass | 정답 「흙을 넣기」가 「먼저」「그다음」으로 분명히 갈리고, 능력과 난도도 맞는다. 「씨앗을 심기」 보기가 다소 약하지만 게임형 1급 문항으로 쓸 만해 통과로 본다. |
| u031 | synk-town.reading-check.town-sequence-ticket.v2 | pass | pass | pass | 순서를 묻는 짧은 게임 문항이에요. 정답이 하나로 분명하고, 오답은 장소를 바꿔 그럴듯해요. 글이 자연스럽고 해설도 정확해서 통과예요. |
| u032 | synk-town.reading-check.town-reason-library.v2 | pass | pass | pass | 정답이 하나뿐이고 근거가 분명한 이유 묻기 게임 문항이에요. 1번 오답이 이유로서 조금 약한 점 말고는 고칠 것이 없어서 통과예요. |
| u033 | synk-town.reading-check.town-reason-walk.v2 | pass | pass | pass | 정답이 하나뿐이고 글과 해설이 바르다. 0번 오답이 이유로는 다소 어색하지만 학습자에게 해가 없어 통과로 본다. |
| u034 | synk-town.reading-check.town-reason-bus.v2 | pass | pass | pass | 이유를 묻는 짧은 안내문 문항으로, 정답이 유일하고 오답도 그럴듯하다. 게임 꼴(보기 셋, 해요체 발문)을 감안하면 그대로 써도 된다. |
| u035 | synk-town.reading-check.town-reason-quiet.v1 | pass | pass | pass | 이유를 묻는 짧은 안내문 문항이다. 정답이 하나뿐이고, 오답이 글의 말을 바꾸어 그럴듯하며, 해설도 정확하다. 기존 게임 꼴 안에서 기준을 모두 충족하므로 통과로 판정한다. |
| u036 | synk-town.reading-check.town-main-cup.v2 | pass | pass | pass | 정답이 유일하고 글의 근거가 분명한 중심 생각 문항이다. 기존 게임 꼴(보기 셋·해요체 발문·한국어 해설)로는 고칠 것이 없어 통과로 본다. |
| u037 | synk-town.reading-check.town-main-swap.v2 | pass | pass | pass | 정답은 2번 하나뿐이고 오답도 글의 말을 바꿔 써서 적절해요. 발문 꼴이 공식 46번(중심 생각)보다 「무엇에 대한 것」형에 가깝지만, adapted 게임 문항이라 통과예요. |
| u038 | synk-town.reading-check.town-main-thanks.v2 | pass | pass | pass | 정답이 하나뿐이고 해설도 정확한 기존 게임 문항입니다. 오답이 세부 불일치라 조금 쉽지만 게임 꼴 안에서는 쓸 수 있어 통과로 판정합니다. |
| u039 | entry-check.pool-09.v1 | pass | pass | pass | The single answer (no swimming cap) is clear, and the distractors use the notice's rules plausibly. This existing game-form item works as is |
| u040 | entry-check.pool-12.v1 | pass | pass | pass | 규칙 셋을 모두 지킨 손님이라 들여보내기가 유일한 정답이다. 게임 꼴 안에서 안내문 세부 대조가 잘 되고 해설도 정확해 통과한다. |
| u041 | entry-check.pool-13.v1 | pass | pass | pass | 세 규칙을 모두 지킨 손님이라 「들여보내기」가 유일한 정답이다. 게임 꼴 안에서 오답·해설·난도가 모두 적절해 통과한다. |
| u042 | entry-check.pool-11.v1 | pass | pass | pass | 규칙 세 가지를 모두 충족하므로 정답 「들여보내기」가 유일하고, 물병으로 「음식」 거절을 유도하는 설계도 좋습니다. 그대로 통과입니다. |
| u043 | entry-check.pool-14.v2 | pass | pass | pass | 세 규칙을 모두 충족하는 손님이라 '들여보내기'가 유일한 정답이에요. 게임 꼴 안에서 보기·해설·난도가 적절해서 통과입니다. |
| u044 | entry-check.library-10.v1 | pass | pass | pass | 정답은 들여보내기 하나로 분명합니다. 오답은 규칙 세 가지와 하나씩 짝지어져 있고, 급·난도·능력 모두 맞아 통과입니다. |
| u045 | entry-check.museum-09.v1 | pass | pass | pass | 조건 세 가지를 모두 따져야 '들여보내기'가 유일한 정답이 되는 잘 짜인 게임형 문항입니다. 해설도 정확해 그대로 통과합니다. |
| u046 | entry-check.museum-10.v1 | pass | pass | pass | 정답 2(카메라 반입 금지)가 유일하게 맞고, 시간·나이 함정도 적절해요. 손님 말이 답을 조금 드러내는 점은 사소해서 그대로 통과예요. |
| u047 | entry-check.museum-11.v1 | pass | pass | pass | 정답 '들여보내기'가 유일하다. 시간·표 조건을 읽는 게임형 문항으로 기준을 충족한다. 카메라 보기는 단서가 없어 매력이 약하지만 사소한 점이라 통과로 본다. |
| u048 | entry-check.concert-11.v1 | pass | pass | pass | 정답 2번(의자 때문에 돌려보내기)이 유일합니다. 날짜 변경 함정도 잘 설계되어 있습니다. 관계없는 시각 정보와 '돗자리·접이식' 같은 낱말은 사소하므로 통과입니다. |
| u049 | entry-check.concert-12.v2 | fix | fix | pass | 직접 풀면 0번(들여보내기)이 나온다. 안내문에 「8월 9일 표로 들어올 수 있습니다」라고 했고, 짐은 허용된 돗자리이며, 손님은 어른이므로 다른 거절 사유가 없다. 다만 두 가지는 고쳐야 한다. 첫째, 정답을 가르는 정보는 음악회 날짜가 바뀌었고 원 |
| u050 | entry-check.concert-13.v1 | pass | pass | pass | 과자(음식) 반입 금지로 돌려보내는 4번이 유일한 정답이다. 날짜 변경 함정도 잘 짜였고 게임 꼴 안에서 기준에 맞아 통과한다. |
| u051 | entry-check.concert-14.v1 | pass | pass | pass | 날짜 예외·짐·보호자 조건을 모두 충족해 '들여보내기'만 정답이고, 거절 보기는 각 조건에서 나온 그럴듯한 함정이다. 게임 꼴 안에서 문제없어 통과. |
| u052 | talk-rally.r01.v2 | pass | pass | pass | 게임 꼴(보기 셋)의 TI-L-01 네/아니요형 문항으로, 정답이 유일하고 오답이 전형적이며 해설도 정확하다. 화자 이름 「몽글」은 게임 화면용 이름표라 내용에는 영향이 없다. 통과. |
| u053 | talk-rally.w06.v1 | pass | pass | pass | 정답이 하나뿐이고 오답(낱말 재사용·시제 바꿈)도 적절한 1급 대답 고르기 문항입니다. 게임 꼴(보기 셋·마스코트 화자) 안에서 문제가 없어 그대로 통과합니다. |
| u054 | talk-rally.w08.v1 | pass | pass | pass | 「왜 늦었어요?」에 이유로 답하는 보기가 하나뿐이라 정답이 분명하다. 낱말·문형이 1급에 맞고 해설도 정확하다. 게임 꼴 안에서 문제가 없어 통과로 본다. |
| u055 | talk-rally.f06.v1 | pass | pass | pass | 인사 「어서 오세요」에 손님의 대답을 고르는 기존 게임 문항이다. 정답이 분명하고 오답도 그럴듯하다. 급과 능력이 맞아 그대로 써도 된다. |
| u056 | talk-rally.f11.v1 | pass | pass | pass | 「여보세요?」에 「네, 저 민수예요.」로 답하는 게임 꼴 문항이에요. 정답이 하나뿐이고 해설도 정확해요. 보기 셋·마스코트 화자는 게임 꼴이라 허용되므로 통과예요. |
| u057 | talk-rally.f12.v1 | pass | pass | pass | 헤어질 때 하는 인사에 같은 인사로 답하는 기존 게임 문항입니다. 정답이 하나뿐이고 오답은 상황이 어긋난 인사말이라 적절합니다. 난도·능력·해설 모두 맞아 통과입니다(「씨도」를 넣으면 더 자연스럽다는 것은 사소한 제안). |
| u058 | talk-rally.r07.v1 | pass | pass | pass | 게임 꼴(보기 셋) 안에서 TI-L-01 네/아니요형을 잘 따랐어요. 정답이 유일하고 오답도 용언 불일치로 그럴듯하게 설계돼 있어 그대로 써도 돼요. 화자가 마스코트인 것은 기존 게임 문항의 꼴이에요. |
| u059 | talk-rally.r09.v1 | pass | pass | pass | 권유 물음에 대한 대답 고르기로, 정답이 분명하고 1급 수준에 맞습니다. 기존 게임 꼴 안에서 문제가 없어 통과입니다. |
| u060 | talk-rally.w09.v1 | pass | pass | pass | '어떻게 왔어요?'에 방법(버스로)으로 답하는 정답이 유일하다. 오답은 의문사만 바꿔 그럴듯하다. 수준·해설 모두 적절하므로 통과다. |
| u061 | talk-rally.w10.v1 | pass | pass | pass | 사람 수를 높여 묻는 「몇 분이세요?」에 단위 명사(명·시·개)로 보기를 가른 깔끔한 게임 문항이에요. 정답이 하나뿐이고 해설도 정확해서 그대로 통과예요(해설에 「분」이 시간 단위로도 쓰인다는 점을 덧붙이면 더 좋아요). |
| u062 | talk-rally.w11.v1 | pass | pass | pass | 미래 시제 물음에 맞는 대답을 고르는 1급 문항이다. 정답은 하나이고 오답은 시제·화제 어긋남으로 그럴듯하며, 해설도 정확하다. 통과. |
| u063 | talk-rally.f13.v1 | pass | pass | pass | 정답이 하나로 분명하고, 급·자리·능력에 맞는 기존 게임 문항입니다. 해설이 방에 들어가는 상황을 가정하는 점은 사소하므로 통과로 판정합니다. |
| u064 | talk-rally.f14.v1 | pass | pass | pass | 「오랜만이에요」에 안부로 답하는 기초 인사 문항입니다. 정답이 하나뿐이고 오답도 적절해 게임 꼴 그대로 통과합니다. |
| u065 | talk-rally.f15.v1 | pass | pass | pass | 식사 뒤 인사 「잘 먹었습니다」에 「네, 또 오세요」로 답하는 게임형 문항입니다. 정답이 하나로 분명하고, 오답은 같은 장면의 인사말이라 그럴듯합니다. 게임 꼴 안에서 문제가 없어 통과입니다. |
| u066 | talk-rally.f16.v1 | pass | pass | pass | 「먼저 갈게요」에 「네, 내일 봐요」로 답하는 정답이 분명합니다. 「먼저」를 쓴 함정 보기도 적절하고 게임 꼴 안에서 문제가 없어 통과입니다. |
| u067 | talk-rally.f18.v1 | pass | pass | pass | 전화를 잘못 걸었다는 말에 사과로 답하는 1급 문항이다. 정답이 분명하고 해설도 바르다. 게임 꼴(보기 셋, 마스코트 화자) 안에서 문제가 없어 통과로 판정한다. |
