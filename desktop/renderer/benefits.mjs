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
    asset: 'world-book.avif',
    alt: '나의 기록을 펼쳐 보는 펠트 책',
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
    description: 'Claude·ChatGPT(Codex)·Gemini·Higgsfield 계정의 남은 한도와 초기화 시각, 결제일과 구독료를 한 화면에 모아요.',
    status: 'integrated',
    statusLabel: 'PC 앱 · 회원 무료',
    embedded: true,
    asset: 'laptop.webp',
    alt: 'AI 도구가 열린 파란 펠트 노트북',
    steps: [
      { title: '지금 볼 것만 맨 위에', body: '다 쓴 계정, 90% 넘은 한도, 부족한 크레딧, 3일 안 결제만 먼저 보여 줘요.' },
      { title: '한 번 눌러 전부 확인', body: '이 PC에 연결한 여러 계정을 공식 프로그램으로 한꺼번에 읽어요. 계정마다 로그아웃했다 다시 들어갈 필요가 없어요.' },
      { title: '처음 연결은 따라 하기만', body: '설치 확인부터 로그인 코드 붙여넣기까지 단계마다 알려 줘요. 로그인 정보는 이 PC 밖으로 나가지 않아요.' },
    ],
    availability: 'SYNK ID로 로그인한 회원이 PC 앱에서 무료로 써요. 자동으로 읽으려면 각 서비스의 공식 프로그램(Claude Code·Codex·Antigravity CLI·Higgsfield CLI)이 이 PC에 설치·로그인돼 있어야 하고, Suno처럼 공식 출력이 없는 서비스는 직접 넣어요. 기록은 이 PC에만 저장해요.',
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
    asset: 'care-note.webp',
    alt: '기억할 날에 빨간 별표를 붙인 크림색 펠트 메모',
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
    asset: 'fortune-star.avif',
    alt: '크림색 꼬리를 달고 날아가는 노란 펠트 별똥별',
    steps: [
      { title: '오늘의 기운', body: '총운·애정·금전·일을 다섯 칸으로, 해 보면 좋은 것과 미뤄 두면 좋은 것, 행운의 색·숫자를 봐요.' },
      { title: '궁합 · 이번 달 · 올해', body: '두 사람의 결, 30일 흐름에서 좋은 날, 올해의 달마다 이야기를 살펴봐요. 태어난 시간을 몰라도 돼요.' },
      { title: '맞았는지 남기기', body: '로그인해 담아 두고 「맞았어요」를 표시하면, 최근 7일을 돌아보며 다시 열어 볼 수 있어요.' },
    ],
    availability: '공개 웹에서 비회원도 광고나 잠금 없이 무료로 볼 수 있어요. SYNK ID로 로그인하면 출생정보·보는 방식·담아 둔 운세와 메모, 궁합을 본 사람을 저장하고 최근 7일의 기록을 돌아봐요. PC 앱은 개발판이며 풀이는 가볍게 즐기는 참고용이에요.',
  },
  {
    id: 'rehearsal',
    name: '중요한 대화 리허설',
    kicker: '꺼내기 어려웠던 말을 준비하는 시간',
    headline: '중요한 말을 소리 내어 미리.',
    description: '면접·부탁·거절·발표·협상·사과·피드백을 말로 연습하고, 들어간 것과 빠진 것을 바로 확인해요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/rehearsal/',
    asset: 'teacher-cover.png',
    alt: '말할 내용을 준비한 코럴색 펠트 보드와 연단',
    steps: [
      { title: '상황과 상대', body: '7가지 상황에서 상대와 목표, 상대 반응 세기를 골라요.' },
      { title: '누르고 말하기', body: '말로 답하면 받아쓰고, 대화의 뼈대·말버릇·말한 시간과 빠르기를 바로 보여 줘요. 빠진 것은 상대가 되물어요.' },
      { title: '가져갈 한 장과 돌아보기', body: '첫 문장과 「만약 상대가 ~하면」을 정하고, 실제 대화 뒤 어땠는지 남기면 다음 연습이 거기서 시작해요.' },
    ],
    availability: '공개 웹에서 무료로 연습해요. 받아쓰기는 브라우저의 음성 인식을 쓰고 녹음은 저장하지 않아요. SYNK ID로 로그인하면 완료한 연습·다시 한 말·가져갈 한 장·돌아보기를 계정에 보관해요. 생성형 AI 대화와 자동 능력 평가는 제공하지 않아요.',
  },
  {
    id: 'family-album',
    name: '가족 이야기 앨범',
    kicker: '가족의 목소리를 오래 간직하는 방법',
    headline: '가족의 이야기와 목소리를, 하루 한 질문으로.',
    description: '그분께 맞는 질문에 말로 답하면 사진·이야기·원래 목소리가 한 장으로 남고, 모이면 한 권이 돼요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/album/',
    asset: 'studio-camera.webp',
    alt: '가족의 사진과 이야기를 담는 코럴색 끈의 검정 펠트 카메라',
    steps: [
      { title: '누구의 이야기', body: '어머니·아버지·조부모 등 이야기 주인을 정하면, 13가지 주제의 질문 중 그분께 맞는 것부터 골라요.' },
      { title: '말로 답하기', body: '큰 녹음 단추로 원래 목소리를 남기고, 글은 나중에 받아 적어요. 들은 이야기는 다시 묻지 않아요.' },
      { title: '한 권으로', body: '시간 순서·사람별로 모아 보고, 인쇄할 책과 사진·음성 원본 묶음으로 간직해요.' },
    ],
    availability: '공개 웹에서 무료로 시작해요. 이 기기에 보관하거나, SYNK ID로 로그인해 이야기·사진·원래 목소리를 내 계정의 비공개 보관함에 저장할 수 있어요. 가족의 기억은 같은 기기에서 보태며 온라인 가족 초대와 공동 편집은 아직 제공하지 않아요. PC 앱은 개발판이에요.',
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
