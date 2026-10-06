// Public product introductions are separate from account-bound app entitlements.
// A catalogue entry never grants launch access or stores personal information.
export const MEMBER_BENEFITS = [
  {
    id: 'care',
    name: '플레저',
    kicker: '소중한 사람을 챙기는 일',
    headline: '기억하고 싶은 날에, 내 마음이 닿도록.',
    description: '다가오는 생일과 경조사를 기억하고, 관계에 맞는 말로 마음을 전할 준비를 해요.',
    status: 'preview',
    statusLabel: '개발 미리보기',
    asset: 'care-note.webp',
    alt: '기억할 날에 빨간 별표를 붙인 크림색 펠트 메모',
    steps: [
      { title: '한 사람부터 기억해요', body: '이름과 중요한 날을 등록하고, 언제 챙길지 정해요.' },
      { title: '우리 사이에 맞는 말을 찾아요', body: '직접 제공한 대화에서 표현의 특징을 확인하고, 원하는 말투를 골라요.' },
      { title: '내 마음을 담아 직접 전해요', body: '메시지 초안을 고치고 복사해 직접 연락해요. 챙긴 날도 기록할 수 있어요.' },
    ],
    availability: 'SYNK 회원 무료 제공 예정. 현재는 개발 환경에서 미리 볼 수 있어요. 회원 계정 연결과 앱을 꺼도 오는 알림을 준비하고 있어요.',
  },
  {
    id: 'fortune',
    name: '무료 운세',
    kicker: '오늘을 가볍게 여는 작은 재미',
    headline: '오늘의 운세, 작은 행운부터 만나보세요.',
    description: '별자리와 한국 사주로 오늘을 살펴보고, 작은 행동과 한 줄 기록을 내 계정에 간직해요.',
    status: 'preview',
    statusLabel: '개발 미리보기',
    asset: 'fortune-star.avif',
    alt: '크림색 꼬리를 달고 날아가는 노란 펠트 별똥별',
    steps: [
      { title: '운세 보는 방식을 골라요', body: '별자리 12궁을 직접 고르거나 생일로 찾아요. 한국 사주는 양력 생년월일과 태어난 시간으로 계산하며, 시간을 몰라도 볼 수 있어요.' },
      { title: '나를 알아가는 한 주를 펼쳐요', body: '오늘의 풀이와 일주일의 작은 행동을 살펴봐요. 별자리의 상징과 사주의 네 기둥·일간·오행도 쉬운 안내로 알아가요.' },
      { title: '내 계정에 하루를 남겨요', body: '로그인한 뒤 내 정보와 마음에 드는 결과를 직접 저장해요. 실천 표시와 한 줄 메모를 보관하고 다시 열거나 파일로 내보낼 수 있어요.' },
    ],
    availability: '비회원도 무료로 운세를 볼 수 있어요. 계정 저장은 로그인 연결 설정과 서버 준비 뒤 사용할 수 있는 개발 기능이에요. 저장 단추를 눌렀을 때만 정보를 보관하며, 유료 AI를 호출하거나 미래를 단정하지 않아요.',
  },
  {
    id: 'rehearsal',
    name: '중요한 대화 리허설',
    kicker: '꺼내기 어려웠던 말을 준비하는 시간',
    headline: '내일의 중요한 말, 오늘 한번 해보세요.',
    description: '면접·부탁·거절을 연습하고, 처음 쓴 말과 다시 쓴 말을 내 성장 작품집으로 간직해요.',
    status: 'preview',
    statusLabel: '개발 미리보기',
    asset: 'teacher-cover.png',
    alt: '말할 내용을 준비한 코럴색 펠트 보드와 연단',
    steps: [
      { title: '앞둔 대화를 골라요', body: '준비된 상황 중 필요한 대화를 고르고, 꼭 전하고 싶은 내용을 정해요.' },
      { title: '상대의 반응까지 연습해요', body: '직접 답변을 쓰고 준비된 상대 반응을 경험해요. 어디서 막혔는지와 연습 난이도는 직접 확인해요.' },
      { title: '내 성장 작품집으로 가져가요', body: '처음 쓴 말과 다시 쓴 말, 실제로 쓸 첫 문장을 한 권에 담아요. 파일로 간직하고 인쇄할 수 있어요.' },
    ],
    availability: 'SYNK 회원 무료 제공 예정. 현재는 준비된 시나리오와 직접 남긴 회고를 사용하는 로컬 개발판이에요. 생성형 AI 대화와 계정 간 동기화는 연결하지 않았어요.',
  },
  {
    id: 'family-album',
    name: '가족 이야기 앨범',
    kicker: '가족의 목소리를 오래 간직하는 방법',
    headline: '사진 뒤의 이야기까지, 그 목소리 그대로.',
    description: '사진과 목소리, 우리 집 손맛을 함께 남기고, 인쇄할 수 있는 가족의 책과 원본 파일로 가져가요.',
    status: 'preview',
    statusLabel: '개발 미리보기',
    asset: 'studio-camera.webp',
    alt: '가족의 사진과 이야기를 담는 코럴색 끈의 검정 펠트 카메라',
    steps: [
      { title: '사진 한 장을 골라요', body: '처음 살던 집, 첫 직장, 함께 간 여행. 이야기하고 싶은 순간에서 시작해요.' },
      { title: '익숙한 목소리로 들려줘요', body: '사진 속 기억을 글로 적고 실제 녹음한 음성을 첨부해요. 지원 브라우저에서는 마이크로 직접 녹음할 수 있어요.' },
      { title: '우리 가족의 책으로 가져가요', body: '이야기와 우리 집 레시피를 인쇄할 수 있는 책으로 묶어요. 사진·음성 원본과 함께 내려받아 SYNK 밖에서도 열어 보세요.' },
    ],
    availability: 'SYNK 회원 무료 제공 예정. 현재는 사진·이야기·원래 목소리를 이 기기에 저장하는 로컬 개발판이에요. 가족의 기억은 같은 기기에서 보태며, 온라인 가족 초대와 공동 편집은 아직 연결하지 않았어요.',
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
