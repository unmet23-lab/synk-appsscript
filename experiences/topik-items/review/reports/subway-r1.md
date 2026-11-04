# 검수 묶음 subway-r1

- 문항 54(새 0 · 기존 54) · 기준 topik-review-r1 612d69674d6139bf
- 판정: 통과 7 · 고침 47 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $1.2917 + 판정 $0.7096 = $2.0013 → 1,000문항 어림 $37.06
- 토큰 합계: 입력 91067 · 캐시 쓰기 0 · 캐시 읽기 936252 · 출력 101597
- 아르곤 호출 9회 · 66분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | subway-rush.stop.chungjeongno.pass.right.v1 | fix | fix | fix | 정답 「그대로」는 유일하고, 「오른쪽 문」 함정도 좋습니다. 해설의 「충정로이에요」를 「충정로예요」로 바로잡고, 목표 역 「시청역」을 근거로 넣으면 쓸 수 있습니다. |
| u002 | subway-rush.stop.cityhall.off.left.v1 | fix | pass | fix | 정답은 하나뿐입니다. 앞서 들은 길 안내가 「시청역에서 1호선으로 갈아타세요」이고 안내방송이 「시청역입니다」「1호선으로 갈아타실 분은 이번 역에서 내리시기 바랍니다」라고 하므로 이번 역에서 내려야 합니다. 그래서 「그대로」는 틀립니다. 「내리실 문은  |
| u003 | subway-rush.fork.청량리.jongno5.v1 | fix | fix | fix | 정답은 「청량리 방면」 하나로 분명하고, 난도·꼴·해설은 쓸 만하다. 다만 skillId가 자리의 능력 목록 밖에 있으므로 detail로 고쳐야 한다. 또 「종로5가」 등 숫자 표기가 합성 음성에서 잘못 읽힐 수 있어 확인이 필요하다. |
| u004 | subway-rush.stop.jongno3.pass.right.v1 | fix | fix | fix | 정답 「그대로」는 유일하고 함정 「오른쪽 문」도 잘 짜였습니다. 다만 해설에 「종로3가이에요」 맞춤법 오류가 있고, 목표 역 「종로5가」라는 근거가 빠져 있어 해설만 고치면 쓸 수 있습니다. |
| u005 | subway-rush.stop.jongno5.off.right.v1 | fix | pass | fix | 정답은 하나로 정해진다. 목표역 종로5가에 도착했고 안내방송이 「내리실 문은 오른쪽입니다」라고 했으므로 「오른쪽 문」만 맞다. 「그대로」와 「왼쪽 문」은 대본으로 분명히 지워진다. 게임 꼴(보기 셋)과 1급 난도, 세부 능력도 맞다. 다만 작성 기준  |
| u006 | subway-rush.exit.3.v1 | fix | fix | fix | 정답이 하나뿐이고 오답도 그럴듯해요. 능력과 난도도 맞아요. 다만 듣기 대본의 숫자(특히 「3번」)를 읽는 대로 한글로 바꿔야 합성 음성이 잘못 읽지 않아요. 이 점을 고친 뒤 쓸 수 있어요. |
| u007 | subway-rush.stop.chungjeongno.pass.left.v1 | fix | fix | fix | 정답 「그대로」는 유일하고 오답도 그럴듯합니다. 해설의 맞춤법 오류(「충정로이에요」→「충정로예요」)를 고치고, 목표 역 「시청역」 근거를 더하면 쓸 수 있습니다. |
| u008 | subway-rush.stop.cityhall.off.right.v1 | fix | pass | fix | 정답은 하나로 정해진다. 휴대폰 안내에서 「시청역에서 1호선으로 갈아타세요」라고 했고, 안내방송이 이번 역이 시청이며 「내리실 문은 오른쪽」이라고 하므로 「오른쪽 문」만 맞다. 「그대로」와 「왼쪽 문」은 대본으로 분명히 지워진다. 게임 꼴(보기 셋)도 |
| u009 | subway-rush.fork.청량리.dongdaemun.v1 | fix | fix | fix | 정답이 하나로 분명하고 문장도 자연스럽다. 다만 대표 능력 ko.listening.word가 자리의 skills에 없으므로 ko.listening.detail로 고쳐야 한다. |
| u010 | subway-rush.stop.dongdaemun.off.right.v1 | fix | pass | fix | 정답 유일성은 문제없다. 목표 역 「동대문」과 방송의 「이번 역은 동대문」이 맞고, 「내리실 문은 오른쪽입니다」에 따라 정답은 '오른쪽 문' 하나다. '그대로'와 '왼쪽 문'은 방송과 분명히 어긋나 오답으로 성립한다. 해설도 근거를 바르게 짚고, 게임 |
| u011 | subway-rush.exit.4.v1 | fix | pass | fix | 정답은 마지막 안내의 「학교 셔틀은 4번 출구 앞에 있어요」로 하나로 정해집니다. 게임 꼴(보기 셋, 앞서 들은 안내)도 받아들일 만하고, 능력(세부)과 난도 1도 맞습니다. 다만 작성 기준 §7은 듣기 대본의 숫자를 읽는 대로 한글로 쓰라고 합니다. |
| u012 | subway-rush.stop.jongno3.pass.left.v1 | fix | fix | fix | 정답 「그대로」는 유일하고 오답 설계도 좋습니다. 다만 해설에 「종로3가이에요」 맞춤법 오류가 있고, 목표 역 「종로5가」라는 핵심 근거가 빠져 있어 해설을 고친 뒤 쓸 수 있습니다. |
| u013 | subway-rush.exit.5.v1 | fix | fix | fix | 정답은 유일하고, 능력과 난도도 맞다. 다만 듣기 대본의 숫자(5번·1호선·종로5가)를 합성 음성용 한글 표기로 바꿔야 하며, 해설에 오답 설명을 보태면 좋다. |
| u014 | subway-rush.stop.dongdaemun.off.left.v1 | fix | pass | fix | I solved it myself and got choice 0. The phone guidance says to get off at 동대문, and the announcement names 동대문역 and says 「내리실 문은 왼쪽입니다」, so  |
| u015 | subway-rush.exit.6.v1 | fix | pass | fix | 정답은 하나뿐이다. 마지막 안내의 「6번 출구 앞」이 정답을 가르고, 7번·1번은 글과 분명히 어긋난다. 게임 꼴(보기 셋)으로 보면 유형·난도(1)·대표 능력(세부)도 맞다. 다만 작성 기준 §7은 합성 음성이 읽는 대본의 숫자를 읽는 대로 한글로  |
| u016 | subway-rush.fork.청량리.jongno3.v1 | fix | fix | fix | The answer is unique and the level is appropriate. However, the skillId falls outside this slot's skills list, and one choice, 「나가는 곳」, does |
| u017 | subway-rush.stop.jongno3.off.left.v1 | fix | pass | fix | 정답은 하나로 정해진다. 휴대폰 안내의 「종로3가에서 내리세요」와 방송의 「이번 역은 종로3가」로 내릴 역임을 알 수 있어 「그대로」가 지워진다. 「내리실 문은 왼쪽입니다」로 「오른쪽 문」도 지워진다. 게임 꼴(보기 셋)도 받아들일 수 있다. 다만 작 |
| u018 | subway-rush.exit.2.v1 | fix | fix | fix | 정답 「2번 출구」는 하나뿐이고 자리·능력·난도도 맞아요. 고칠 곳은 세 가지예요: 해설이 「이 번 출구」라는 어색한 표기만 있고 근거 인용과 오답 설명이 빠졌어요. 「4번 출구」는 미끼로 약해요. 대본 숫자는 합성 음성 확인이 필요해요. |
| u019 | subway-rush.stop.jongno5.off.left.v1 | fix | pass | fix | 정답 근거는 분명합니다. 휴대폰 길 안내의 목표 역(종로5가)과 안내방송의 「이번 역은 종로5가」「내리실 문은 왼쪽」이 맞물려 정답은 「왼쪽 문」 하나로 정해집니다. 「그대로」와 「오른쪽 문」은 대본으로 분명히 지워집니다. 기존 게임 문항이라 보기 셋 |
| u020 | subway-rush.exit.8.v1 | fix | pass | fix | 정답(8번 출구)은 마지막 안내로 하나만 정해지고, 능력(세부)과 난도 1도 맞습니다. 문제는 대본입니다. 합성 음성이 그대로 읽는 대본에 아라비아 숫자(1호선·종로5가·8번)가 들어 있어 작성 기준 §7을 어깁니다. 특히 「8번」은 「여덟 번」으로  |
| u021 | subway-rush.stop.jongno3.off.right.v1 | fix | pass | fix | The answer is unique: the earlier guidance says to get off at 종로3가, and the final announcement says 「내리실 문은 오른쪽입니다」, so 「오른쪽 문」 is correct.  |
| u022 | subway-rush.exit.1.v1 | fix | pass | fix | 정답은 하나로 정해집니다. 마지막 안내의 「1번 출구」가 근거이고, 2번·7번은 대본에 없는 수라 다툴 여지가 없습니다. 게임 꼴(보기 셋)과 1급 세부 듣기에도 맞습니다. 다만 이 문항은 답을 가르는 정보가 바로 그 숫자입니다. 대본의 「1번」을 합 |
| u023 | subway-rush.exit.7.v1 | fix | fix | fix | 정답이 하나뿐이고 능력·난도도 맞는 기존 게임 문항입니다. 다만 듣기 대본의 숫자를 합성 음성이 읽기 좋게 한글로 바꾸면 그대로 쓸 수 있습니다. |
| u024 | subway-rush.stop.euljiro3.pass.left.v1 | fix | fix | fix | 정답 「그대로」는 유일하고, 문항 설계도 좋아요. 다만 고칠 점이 두 가지 있어요. 첫째, 해설의 「을지로3가이에요」는 틀린 말이고(→「을지로삼가예요」·「을지로3가예요」), 목표 역(시청역) 근거가 빠졌어요. 둘째, 대본의 아라비아 숫자(1호선·3가· |
| u025 | subway-rush.stop.euljiro3.pass.right.v1 | fix | fix | fix | 정답 「그대로」는 유일하고 함정 설계도 좋습니다. 해설에 맞춤법 오류(「을지로3가이에요」→「을지로3가예요」)가 있고, 목표 역 근거와 오답 설명이 빠져 있어 해설만 고치면 쓸 수 있습니다. |
| u026 | subway-rush.busy.short.right.v1 | fix | fix | fix | 정답(오른쪽 문)은 유일하고 게임 꼴에도 맞다. 다만 해설의 근거 인용(「이 역까지만」)이 대본(「시청역까지만」)과 어긋나고, 대본의 「1호선」이 숫자 표기라서 이 두 곳을 고치면 쓸 수 있다. |
| u027 | subway-rush.busy.express.jonggak.jongno3.v1 | fix | fix | fix | 정답 0은 맞다. 다만 방송이 종로3가 정차를 말하지 않아 다툴 여지가 조금 있다. 이를 막는 문장 하나와 보기 꼴 통일, 해설 보강, 난도 1 조정이 필요하다. / 블라인드 풀이 0(정답 0) · 다툴 보기 1: 목적지는 종각이 아니라 종로3가이고, |
| u028 | subway-rush.busy.exit.3.4.v1 | fix | fix | fix | 정답이 하나로 분명하고 목표 출구가 바뀌는 함정도 잘 짜인 게임 문항이다. 다만 짧고 친숙한 안내라서 TOPIK II 난도는 2가 아니라 1이 맞다. |
| u029 | subway-rush.busy.delay.1to2.v1 | fix | fix | fix | The answer, Line 2, follows the announcement. But the announcement makes Line 2 conditional on being in a hurry, and the item never says the |
| u030 | subway-rush.stop.euljiro3.off.right.v1 | pass | pass | fix | 정답은 하나뿐이다. 앞선 길 안내에서 목적지가 을지로3가였고, 방송이 「이번 역은 을지로3가」, 「내리실 문은 오른쪽」이라고 하니 오른쪽 문이 답이다. 「그대로」는 내릴 역이라서, 「왼쪽 문」은 「오른쪽」이라는 말과 어긋나서 지워진다. 게임 꼴인 보기 |
| u031 | subway-rush.busy.exit.4.3.v1 | fix | fix | fix | 정답은 하나이고 오답도 그럴듯한 좋은 게임 문항이다. 다만 내용이 3급 근처 생활 안내라 난도를 1로 낮추는 것이 맞고, 대본 숫자 표기는 음성을 새로 구울 때 한글로 바꾸면 된다. |
| u032 | subway-rush.busy.short.left.v1 | fix | fix | fix | 정답은 유일하고 문항 꼴·난도도 맞아요. 다만 해설이 대본에 없는 말(「이 역까지만」)을 따오고 있어, 대본 문장 「시청역까지만 운행합니다」로 바꾸면 쓸 수 있어요. |
| u033 | subway-rush.busy.express.jonggak.jongno5.v1 | fix | fix | fix | 정답(이 열차 타기)은 맞고 함정도 좋아요. 다만 대본의 숫자 표기, 보기 꼴, 근거를 짚지 않은 해설을 고쳐야 하고, 언어 난도는 1이 맞아요. / 블라인드 풀이 0(정답 0) · 다툴 보기 1: The destination is 종로5가, and  |
| u034 | subway-rush.busy.exit.5.3.v1 | fix | fix | fix | 정답이 하나뿐이고 바뀐 출구 정보를 잡는 좋은 게임 문항이다. 고칠 점은 두 가지다. 대본의 아라비아 숫자를 합성 음성용 한글 표기로 바꾸고, 짧은 생활 안내이므로 난도를 1로 낮춘다. |
| u035 | subway-rush.stop.euljiro3.off.left.v1 | fix | pass | fix | 정답은 하나뿐이고 게임 꼴 안에서 문항 설계는 바르다. 길 안내의 목적지 「을지로3가」와 방송의 「이번 역은 을지로3가」가 맞으니 내려야 하고, 「내리실 문은 왼쪽입니다」가 답을 가른다. 「그대로」와 「오른쪽 문」은 대본으로 분명히 지워진다. 난도 1 |
| u036 | subway-rush.busy.exit.6.7.v1 | fix | fix | fix | 정답 7번 출구는 유일하고 변경 정보를 듣는 좋은 게임 문항입니다. 다만 고칠 점이 셋 있습니다. 대본 숫자를 한글로 적어 합성 음성이 바르게 읽게 해야 하고, 난도는 1이 맞으며, 1번 출구 보기는 약합니다. |
| u037 | subway-rush.busy.exit.7.6.v1 | fix | fix | fix | 정답 6번 출구가 유일하고, 7번 출구 오답도 매력적이다. 다만 짧은 생활 안내에 정보도 단순해 난도를 1로 낮춰야 한다. |
| u038 | subway-rush.busy.exit.1.2.v1 | fix | fix | fix | 바뀐 출구 안내를 듣고 2번 출구를 고르는 문항이다. 정답은 하나뿐이고 해설도 바르지만, 정보가 적고 짧은 생활 안내라서 난도는 1이 맞다. 「7번 출구」 보기는 약해도 게임 꼴에서는 사소하다. |
| u039 | subway-rush.busy.exit.2.1.v1 | fix | fix | fix | 정답은 1번 출구 하나로 분명하고, 2번 출구 함정도 좋습니다. 다만 대본의 아라비아 숫자를 TTS가 읽기 좋게 한글로 바꾸고, 정보 하나짜리 생활 안내이므로 난도를 1로 낮춰야 합니다. |
| u040 | subway-rush.fork.청량리.jonggak.v1 | fix | fix | fix | The answer is unique and the item is usable, but the skillId is outside the TI-L-26 skills list. It should be changed to ko.listening.detail |
| u041 | subway-rush.busy.express.jonggak.jonggak.v1 | fix | fix | fix | The answer is unique and the item is natural, but the short daily-life announcement is closer to difficulty 1 (level 3) than 2. Lower the di |
| u042 | subway-rush.stop.jonggak.off.right.v1 | pass | pass | pass | 목표 역과 안내방송의 문 방향이 분명해 정답 「오른쪽 문」이 하나뿐이다. 오답도 그럴듯하고 1급 수준에 맞아 통과로 본다. |
| u043 | subway-rush.stop.jonggak.off.left.v1 | fix | pass | fix | 두 검수자 모두 정답이 하나뿐이라고 보았고, 이 판단이 맞다. 목표 역 종각과 방송 역이 같고, 방송이 「내리실 문은 왼쪽입니다」라고 분명히 말한다. 「그대로」와 「오른쪽 문」은 그럴듯한 오답이다. 게임 꼴(보기 셋, 해설 한국어만)은 기존 문항이라  |
| u044 | subway-rush.meet.worker.chungjeongno.v1 | pass | pass | fix | 방송의 「다음 역은 충정로입니다」 한 줄로 정답 「충정로예요」가 하나로 정해지고, 오답 「동대문이에요」「이대예요」는 방송과 분명히 어긋나서 다툴 여지가 없다. 이대는 실제 노선에서 가까운 역이라 오답으로서 그럴듯하다. 1급 앞쪽(difficulty 1 |
| u045 | subway-rush.meet.worker.cityhall.v1 | pass | pass | fix | 정답 「시청이에요」는 안내방송 「다음 역은 시청입니다」로 하나뿐이고, 다른 보기 종각·충정로는 그 말과 분명히 어긋납니다. 기존 게임 문항이라 보기 셋과 한국어만 있는 해설은 이 꼴에서 받아들일 수 있습니다. 어휘·문형도 1급 앞쪽(difficulty |
| u046 | subway-rush.meet.worker.euljiro1.v1 | pass | pass | fix | 방송의 「다음 역은 을지로입구입니다」를 듣고 그대로 대답하면 되므로 정답은 하나뿐이다. 오답 「시청」「이대」는 같은 노선의 다른 역 이름이라 그럴듯하고, 대본에서 다음 역이라고 말하지 않으므로 다툴 여지도 없다. 검수자 B는 길이 단서를 지적했다. 하 |
| u047 | subway-rush.meet.worker.euljiro3.v1 | fix | pass | fix | 정답은 「을지로3가예요」 하나뿐이다. 「다음 역은 을지로3가입니다」가 종각·이대를 분명히 지운다. 기능·난도·자리 꼴(게임 꼴 세 칸)도 맞다. 다만 작성 기준 §7은 숫자를 읽는 대로 한글로 쓰라고 한다. 대본의 「을지로3가」를 합성 음성이 「을지로 |
| u048 | subway-rush.meet.worker.jongno3.v1 | fix | pass | fix | 정답은 하나뿐이다. 「다음 역은 종로3가입니다」를 듣고 고르는 문항이고, 오답인 을지로3가·종각은 실제로 이웃한 역이라 그럴듯하다. 게임 꼴(보기 셋, 해설 한국어만)도 기존 문항 예외에 맞다. 그래서 A의 판단처럼 내용에는 문제가 없다. 다만 B가  |
| u049 | subway-rush.meet.worker.jongno5.v1 | fix | pass | fix | 정답은 하나뿐이다. 안내방송 「다음 역은 종로5가입니다」로 0번만 맞고, 아현·을지로3가는 대본과 어긋난다. 게임 꼴(보기 셋)과 세부 듣기 능력, 난도 1도 맞다. 다만 작성 기준 §7은 합성 음성이 읽는 대본의 숫자를 읽는 대로 한글로 쓰라고 한다 |
| u050 | subway-rush.meet.worker.dongdaemun.v1 | pass | pass | pass | 안내방송의 다음 역 이름을 듣고 대답하는 아주 쉬운 세부 듣기 게임 문항이다. 정답이 유일하고 말도 자연스러워 통과다. |
| u051 | subway-rush.meet.worker.ahyeon.v1 | pass | pass | pass | 안내방송의 역 이름을 듣고 옆 사람에게 대답하는 짧은 게임형 세부 듣기 문항입니다. 정답이 하나뿐이고 오답도 그럴듯하며, 급과 난도에도 맞아 통과입니다. |
| u052 | subway-rush.meet.traveler.cityhall.v1 | fix | fix | drop | 대본에 열차가 시청에 간다는 근거가 없어 「네」와 「아니요」 대답이 둘 다 성립합니다. 안내방송 한 줄을 넣고 해설을 고치면 쓸 수 있습니다. / 블라인드 풀이 0(정답 0) · 다툴 보기 2,1: The script has only one line, |
| u053 | subway-rush.meet.traveler.myeongdong.v1 | fix | fix | drop | 꼴과 급은 TI-L-01에 맞다. 하지만 대본에 열차가 명동에 가는지 알려 주는 정보가 없어 「네」와 「아니요」 대답을 가를 수 없고, 해설의 근거도 대본에 없다. 앞선 안내 한 줄을 넣고 보기 하나를 바꾸면 쓸 수 있다. / 블라인드 풀이 2(정답  |
| u054 | subway-rush.meet.traveler.airport.v1 | fix | fix | drop | 대본에 열차의 행선지 정보가 없어 「네」와 「아니요」 대답이 둘 다 성립합니다. 행선지 안내 한 줄을 대본에 넣고 해설이 그 말을 짚게 고치면 쓸 수 있습니다. / 블라인드 풀이 2(정답 1) · 다툴 보기 1: The script contains o |
