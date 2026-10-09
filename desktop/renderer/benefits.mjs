// Public product introductions are separate from account-bound app entitlements.
// A catalogue entry never grants launch access or stores personal information.
export const MEMBER_BENEFITS = [
  {
    id: 'care',
    name: '플레저',
    kicker: '소중한 사람을 챙기는 일',
    headline: '중요한 날과 연락을 챙겨요.',
    description: '사람·일정을 기억하고, 관계에 맞는 문구와 챙긴 기록을 남겨요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/care/',
    asset: 'care-note.webp',
    alt: '기억할 날에 빨간 별표를 붙인 크림색 펠트 메모',
    steps: [
      { title: '사람과 일정', body: '생일·경조사를 등록하고 챙길 날을 정해요.' },
      { title: '관계별 문구', body: '제공한 대화와 직접 고른 말투로 메시지 초안을 준비해요.' },
      { title: '연락과 기록', body: '초안을 고쳐 직접 연락하고, 챙긴 날을 기록해요.' },
    ],
    availability: '공개 웹에서 무료로 시작하고, SYNK ID로 로그인해 사람·일정·문구와 연락 기록을 내 계정에 보관할 수 있어요. PC 앱은 개발판이며, 앱을 닫은 뒤의 알림은 기기와 브라우저의 지원·설정에 따라 달라요.',
  },
  {
    id: 'fortune',
    name: '무료 운세',
    kicker: '오늘을 가볍게 여는 작은 재미',
    headline: '오늘의 운세와 한 줄 기록.',
    description: '별자리·한국 사주로 오늘과 이번 주를 살펴보고 실천과 메모를 남겨요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/fortune/',
    asset: 'fortune-star.avif',
    alt: '크림색 꼬리를 달고 날아가는 노란 펠트 별똥별',
    steps: [
      { title: '별자리와 사주', body: '12궁 또는 양력 출생정보로 살펴봐요. 태어난 시간을 몰라도 볼 수 있어요.' },
      { title: '오늘과 이번 주', body: '풀이·쉬운 해설·작은 실천을 함께 읽어요.' },
      { title: '내 하루 보관', body: '로그인해 결과·실천·메모를 저장하고 최근 7일 기록을 열거나 내보내요.' },
    ],
    availability: '공개 웹에서 비회원도 무료로 운세를 볼 수 있어요. SYNK ID로 로그인해 출생정보·선호 방식·보관한 결과와 메모를 직접 저장하고, 최근 7일의 기록을 다시 볼 수 있어요. PC 앱은 개발판이며 풀이는 가볍게 즐기는 참고용이에요.',
  },
  {
    id: 'rehearsal',
    name: '중요한 대화 리허설',
    kicker: '꺼내기 어려웠던 말을 준비하는 시간',
    headline: '중요한 말을 미리 연습해요.',
    description: '면접·부탁·거절을 연습하고, 다시 쓴 말과 첫 문장을 성장 작품집에 담아요.',
    status: 'preview',
    statusLabel: '공개 웹 · PC 개발판',
    publicUrl: 'https://synk.im/rehearsal/',
    asset: 'teacher-cover.png',
    alt: '말할 내용을 준비한 코럴색 펠트 보드와 연단',
    steps: [
      { title: '상황 고르기', body: '면접·부탁·거절 중 필요한 상황과 전할 내용을 정해요.' },
      { title: '연습과 다시 쓰기', body: '답변을 쓰고 준비된 상대 반응을 보며 말을 다듬어요.' },
      { title: '성장 작품집', body: '처음 쓴 말·다시 쓴 말·실제로 쓸 첫 문장을 저장하고 내려받거나 인쇄해요.' },
    ],
    availability: '공개 웹에서 준비된 상황과 직접 쓴 답변으로 무료로 연습해요. SYNK ID로 로그인하면 완료한 연습·다시 쓴 말·첫 문장을 계정에 보관하고 성장 작품집으로 내려받을 수 있어요. PC 앱은 개발판이며 생성형 AI 대화와 자동 능력 평가는 제공하지 않아요.',
  },
  {
    id: 'family-album',
    name: '가족 이야기 앨범',
    kicker: '가족의 목소리를 오래 간직하는 방법',
    headline: '가족의 이야기와 목소리를 그대로.',
    description: '사진·이야기·원래 목소리와 레시피를 모아 가족의 책과 원본으로 간직해요.',
    status: 'preview',
    statusLabel: '개발 미리보기',
    asset: 'studio-camera.webp',
    alt: '가족의 사진과 이야기를 담는 코럴색 끈의 검정 펠트 카메라',
    steps: [
      { title: '사진·이야기·목소리', body: '기억을 글로 적고 실제 음성을 첨부하거나 지원 브라우저에서 녹음해요.' },
      { title: '가족 기억과 레시피', body: '같은 기기에서 가족의 기억과 우리 집 손맛을 보태요.' },
      { title: '책과 원본 내보내기', body: '인쇄할 책과 사진·음성 원본을 내려받아 SYNK 밖에서도 간직해요.' },
    ],
    availability: '사진·이야기·원래 목소리와 레시피를 남기는 개발판이에요. 기기 보관을 선택하거나, SYNK ID 연결이 설정된 앱에서 내 계정과 비공개 원본 보관함에 저장할 수 있어요. 가족의 기억은 같은 기기에서 보태며 온라인 가족 초대와 공동 편집은 아직 제공하지 않아요.',
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
