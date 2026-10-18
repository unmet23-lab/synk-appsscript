// Public product introductions are separate from account-bound app entitlements.
// A catalogue entry never grants launch access or stores personal information.
export const MEMBER_BENEFITS = [
  {
    id: 'insight',
    name: '내 성향 확인하기',
    kicker: '기록으로 조금 더 알아가는 나',
    headline: '나에게 맞는 방식, 내 기록에서.',
    description: '내가 알려준 관심사·선호와 실제 학습 기록을 나눠 보고, 그 근거를 확인해요.',
    status: 'integrated',
    statusLabel: '내 계정 요약',
    embedded: true,
    asset: 'benefit-insight.webp',
    alt: '책갈피 셋을 꽂은 남색 펠트 수첩과 노란 테 돋보기',
    steps: [
      { title: '나의 관심사·선호', body: '직접 알려준 배우는 목적과 편한 이용 방식을 살펴봐요.' },
      { title: '학습 성향·성장', body: '혼자 응답한 기록과 도움받은 기록, 다시 연습할 내용을 확인해요.' },
      { title: '왜 이렇게 보나요?', body: '선택한 정보와 관찰된 기록을 구분하고 근거를 열어 봐요.' },
    ],
    availability: '로그인한 SYNK ID의 기존 Atlas 요약을 보여줘요. 학습 기록 연결이 꺼져 있으면 직접 알려준 배우는 이유만 표시해요.',
  },
  {
    id: 'subscriptions',
    name: 'AI 구독 계정판',
    kicker: '흩어진 AI 구독을 한눈에',
    headline: 'AI 구독, 이번 주 얼마 남았는지 한 번에.',
    description: '연결한 AI 계정의 남은 사용량과 초기화 시각을 한눈에 보고, 결제일과 구독료도 함께 챙겨요.',
    status: 'integrated',
    statusLabel: 'PC 앱 · 회원 무료',
    embedded: true,
    asset: 'benefit-subscriptions.webp',
    alt: '남은 양을 가리키는 바늘이 달린 반원 펠트 계기판',
    steps: [
      { title: '지금 쓸 계정부터', body: '서비스마다 남은 게 가장 많은 계정을 먼저 보여 주고, 다 쓴 계정이 언제 풀리는지 가까운 순서로 알려 줘요.' },
      { title: '한 번 눌러 전부 확인', body: '이 PC에 연결한 여러 계정을 공식 프로그램으로 한꺼번에 읽어요. 계정마다 로그아웃했다 다시 들어갈 필요가 없어요.' },
      { title: '처음 연결은 따라 하기만', body: '설치 확인부터 로그인까지 단계마다 알려 줘요. 토큰 파일은 열지 않고, 각 서비스가 공식으로 알려 주는 숫자만 모아요.' },
    ],
    availability: 'SYNK ID로 로그인한 회원이 PC 앱에서 무료로 써요. 자동으로 읽을 계정은 해당 서비스의 공식 프로그램을 PC에 설치하거나 API 키를 넣어 연결해요. 자동 확인을 지원하지 않는 서비스도 구독료와 결제일을 직접 기록할 수 있어요. 기록은 이 PC에만 저장해요.',
  },
  {
    id: 'care',
    name: '플레저',
    kicker: '소중한 사람을 챙기는 일',
    headline: '오늘 챙길 사람과 다가오는 날을 한눈에.',
    description: '오늘 연락할 1~3명, 음력까지 챙기는 생일·기념일, 경조사 장부와 금액 도우미를 한곳에서.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/care/',
    asset: 'benefit-care.webp',
    alt: '코랄 하트로 봉한 노란 펠트 편지 봉투',
    steps: [
      { title: '오늘 챙길 사람', body: '전화·문자·만남을 누르면 안부 주기를 다시 시작하고, 바쁘면 3일 뒤로 미뤄요.' },
      { title: '다가오는 날', body: '음력·윤달 생일과 몇 번째 생신·결혼 몇 주년을 미리 알려 주고, 고인은 기일·49재를 조용히 챙겨요.' },
      { title: '장부와 마음 메모', body: '주고받은 경조사비를 사람별로 보고, 금액 도우미와 갖고 싶다고 한 것 메모로 다음 마음을 준비해요.' },
    ],
    availability: '공개 웹에서 무료로 시작하고, SYNK ID로 로그인해 사람·일정·장부와 연락 기록을 내 계정에 보관할 수 있어요. PC 앱은 개발판이며, 앱을 닫은 뒤의 알림은 기기와 브라우저의 지원·설정에 따라 달라요.',
  },
  {
    id: 'fortune',
    name: '무료 운세',
    kicker: '오늘을 가볍게 여는 작은 재미',
    headline: '오늘의 기운부터 궁합과 올해까지.',
    description: '별자리·한국 사주로 오늘의 기운과 할 일, 오늘의 카드 한 장, 궁합, 이번 달 흐름과 올해를 가볍게 읽어요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/fortune/',
    asset: 'benefit-fortune.webp',
    alt: '별과 초승달을 수놓은 남색 펠트 수정 구슬',
    steps: [
      { title: '오늘의 기운', body: '총운·애정·금전·일을 다섯 칸으로, 해 보면 좋은 것과 미뤄 두면 좋은 것, 행운의 색·숫자를 봐요.' },
      { title: '궁합 · 이번 달 · 올해', body: '두 사람의 결, 30일 흐름에서 좋은 날, 올해의 달마다 이야기를 살펴봐요. 태어난 시간을 몰라도 돼요.' },
      { title: '맞았는지 남기기', body: '로그인해 담아 두고 「맞았어요」를 표시하면, 최근 7일을 돌아보며 다시 열어 볼 수 있어요.' },
    ],
    availability: '공개 웹에서 비회원도 광고나 잠금 없이 무료로 볼 수 있어요. SYNK ID로 로그인하면 출생정보·보는 방식·담아 둔 운세와 메모, 궁합을 본 사람을 저장하고 최근 7일의 기록을 돌아봐요. PC 앱은 개발판이며 풀이는 가볍게 즐기는 참고용이에요.',
  },

];

export function memberBenefit(id) {
  return MEMBER_BENEFITS.find(benefit => benefit.id === id) || null;
}

export function benefitPreviewAvailable(id, { native = false, appIds = [], productPreviewsAvailable = [] } = {}) {
  return memberBenefit(id)?.status === 'preview' && native === true
    && Array.isArray(appIds) && appIds.includes(id)
    && Array.isArray(productPreviewsAvailable) && productPreviewsAvailable.includes(id);
}
