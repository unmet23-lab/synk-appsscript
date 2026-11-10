// LAB 영어 E34 「리나 둘」 화면 글 정본(영어 판 하나 — R · L 이름 놀이는 영어권 이름 이야기라 두 채널 판으로 옮기지 않는다, LAB 장부 「두 채널 판」).
const NL = String.fromCharCode(10);
export const FONT = "'Inter Tight', 'SUIT', sans-serif";
export const KO = "'SUIT', 'Inter Tight', sans-serif";
export const MONO = "'DM Mono', 'Inter Tight', monospace";
export const TEXT = {
  // v4 haiku · GPT 「맨 위 영어 머리 글이 지난 편과 같다」 → 머리 글을 영어 설명 띠가 아니라 이 카페의 주문표로(한 잔 · 리나 → 두 사람?!)
  ticket1: '1 cup',
  ticket2: '…2 people?!',
  call1: '“Ri-na!”',
  me: 'Me!',
  meRina: 'Rina: Me!', // v5 GPT · 그록 「이름표가 작아 누가 누군지 못 읽음」 → 말풍선 아래에 이름
  meLina: 'Lina: Me!',
  meRyan: 'Ryan: Me!',
  // v8 GPT 미학 맹검 「(Mongle: …) 화자 이름 · 괄호가 제작 원고를 얹은 듯」 → 괄호 · 화자를 빼고 꼬리가 말한 이를 가리킨다
  myCoffee: 'my coffee…', // v5 sonnet · 그록 「분홍 인형이 누구인지」
  rule: `In Korean, R and L${NL}are ONE letter`, // v5 sonnet · haiku 「Hangul이 낯설다 · 작다」 → Korean
  ruleSound: 'ㄹ = R = L',
  ruleSame: 'same letter, same sound', // v5 GPT · haiku 「발음까지 같다는 뜻인지」 // v4 셋 「one sound, between r and l이 작고 모호하다」 → 식 하나로
  twoCups: `Two Rinas?${NL}Two cups`, // v8 GPT 미학 맹검 [K6] 큰 글 마침표 → 뺌
  mine: 'and MY coffee…?',
  gulp: 'gulp!', // v5 셋 「누가 마셨나 · 컵째인가」 → 사자 입 쪽에(v8 맹검으로 괄호 · 화자는 뺌)
  qRyan: 'And Ryan?',
  call3: '“Ra-i-eon!”',
  roar: 'Roar! Me!',
  lionToo: `“Lion” in Korean letters?${NL}Also 라이언`, // v2 GPT 「라이언이 사자의 한국어인지 영어 소리인지」 → 한글로 적은 것임을 말한다
  ask: `R or L in your name?${NL}Comment it below`, // v5 GPT 「마지막 문장을 다 읽기 전에 끝난다」 → 두 줄(「한글로 써 드려요」는 고정 댓글) · v8 맹검 「매끈한 이모지가 펠트 결과 튄다」 → 글로
};
