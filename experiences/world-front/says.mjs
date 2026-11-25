// 오늘 할 일 카드의 대사 녹음(2026-11-25, 유호님 「응, 둘 다 바꿔」 — 기기 음성 대신 녹음).
// 글 → assets/say/<이름>.mp3. 표에 없는 글은 소리 없이 글만 보인다(기기 음성을 쓰지 않는다).
// 표는 레슨 원고(synk-world-app/life-content.mjs)의 앞 세 말과 맞아야 한다 — tests/world-front-says.test.mjs가 대조한다.
// 굽기: qa/대사녹음_20261125/plan.json(tools/나레이션굽기.mjs).
export const SAY = Object.freeze({
  '안녕하세요.': 'hello',
  '감사합니다.': 'thank-you',
  '저는 수진이에요.': 'i-am-sujin',
  '저는 서하예요.': 'i-am-seoha',
  '따뜻한 차 한 잔 주세요.': 'one-warm-tea',
  '여기서 마실게요.': 'drink-here',
  '포장해 주세요.': 'to-go',
  '따뜻한 차를 마시고 싶어요.': 'want-warm-tea',
  '주스는 품절이에요.': 'juice-sold-out',
  '주스 대신 따뜻한 차로 바꿔 주세요.': 'tea-instead',
  '한 잔 더 주세요.': 'one-more-cup',
  '따뜻한 차 두 잔 주세요.': 'two-warm-teas',
  '이거 얼마예요?': 'how-much',
  '봉투 하나 주세요.': 'one-bag',
  '카드로 계산할게요.': 'pay-by-card',
  '공원이 어디에 있어요?': 'where-is-the-park',
  '오른쪽으로 가세요.': 'go-right',
  '은행 옆에 있어요.': 'next-to-the-bank',
  '이 버스는 공원에 가요?': 'this-bus-to-the-park',
  '다음 정류장에서 내려요.': 'get-off-next-stop',
  '교통카드를 찍으세요.': 'tap-your-card',
  '내일 오후 세 시에 만나요.': 'meet-tomorrow-three',
  '어디에서 만날까요?': 'where-shall-we-meet',
  '조금 늦을 것 같아요.': 'a-little-late',
});
