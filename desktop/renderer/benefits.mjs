// Public product introductions are separate from account-bound app entitlements.
// A catalogue entry never grants launch access or stores personal information.
// 무료 운세는 다시 만드는 동안 목록에서 내려 두었다(2026-10-30). 앱 원천은 experiences/daily-fortune, 계정 저장·로그인 연결은 그대로다.
export const MEMBER_BENEFITS = [
  {
    id: 'insight',
    name: '내 성향',
    kicker: '내가 고른 것과 실제 학습 기록',
    headline: '내가 고른 것과 실제로 한 것을 나눠서 봐요.',
    description: '직접 고른 관심사·이용 방식과 WORLD 학습 기록을 나눠 보여 주고, 왜 그렇게 봤는지 근거도 보여 줘요.',
    status: 'integrated',
    statusLabel: '로그인하면 바로',
    embedded: true,
    asset: 'benefit-insight.webp',
    alt: '책갈피 셋을 꽂은 남색 펠트 수첩과 노란 테 돋보기',
    steps: [
      { title: '내가 고른 것', body: '한국어를 배우는 이유, 편한 도움 방식처럼 직접 고른 것을 모아 봐요.' },
      { title: '실제 학습 기록', body: '혼자 푼 답과 도움받은 답, 다시 연습할 항목을 나눠 봐요.' },
      { title: '왜 이렇게 보나요?', body: '고른 정보와 기록에서 본 것을 나누고, 근거가 된 기록을 열어 봐요.' },
    ],
    availability: 'SYNK ID로 로그인하면 볼 수 있어요. 학습 기록 연결을 꺼 두면 직접 고른 배우는 이유만 보여요.',
  },
  {
    id: 'subscriptions',
    name: 'AI 구독 계정판',
    kicker: 'AI 구독 남은 양·결제일',
    headline: 'AI 구독마다 이번 주에 남은 양을 보여 줘요.',
    description: '연결한 AI 계정의 남은 사용량과 다시 채워지는 시각을 보고, 결제일과 구독료도 함께 챙겨요.',
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
    kicker: '생일·경조사·연락 챙기기',
    headline: '오늘 연락할 사람과 다가오는 날을 먼저 알려 줘요.',
    description: '오늘 연락할 1~3명, 음력 생일과 기념일, 경조사 장부와 금액 도우미가 들어 있어요.',
    status: 'preview',
    statusLabel: '웹에서 무료',
    publicUrl: 'https://synk.im/care/',
    asset: 'benefit-care.webp',
    alt: '코랄 하트로 봉한 노란 펠트 편지 봉투',
    steps: [
      { title: '오늘 챙길 사람', body: '전화·문자·만남을 누르면 안부 주기를 다시 시작하고, 바쁘면 3일 뒤로 미뤄요.' },
      { title: '다가오는 날', body: '음력·윤달 생일과 몇 번째 생신·결혼 몇 주년을 미리 알려 주고, 고인은 기일·49재를 조용히 챙겨요.' },
      { title: '장부와 마음 메모', body: '주고받은 경조사비를 사람별로 보고, 금액 도우미와 갖고 싶다고 한 것 메모로 다음 마음을 준비해요.' },
    ],
    availability: '웹(synk.im/care)에서 로그인 없이 무료로 시작해요. SYNK ID로 로그인하면 사람·일정·장부와 연락 기록을 계정에 보관해요. 창을 닫은 뒤에도 알림을 받으려면 Windows PC 앱 설정의 「플레저 PC 알림」을 켜 주세요.',
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
