// Original reading checks. Building, moving and following pictures never call these.
export const READING_CHECKS = Object.freeze([
  { id: 'town-reading-place', skill: 'detail', passage: '오늘 쉼터는 찻집 안에 있습니다. 밖의 자리는 내일부터 이용할 수 있습니다.',
    question: '오늘은 어디에서 쉴 수 있나요?', choices: ['찻집 밖', '찻집 안', '내일부터만 쉴 수 있어요'], correct: 1,
    hint: '오늘 이용할 수 있는 곳을 찾아요.', explanation: '오늘 쉼터는 찻집 안에 있습니다.' },
  { id: 'town-reading-negation', skill: 'negation', passage: '차는 쉼터의 의자에 앉아서 마셔 주세요. 안내판 앞에서는 차를 마시지 마세요.',
    question: '차를 마시면 안 되는 곳은 어디인가요?', choices: ['쉼터의 의자', '찻집 안의 자리', '안내판 앞'], correct: 2,
    hint: '“마시지 마세요” 앞에 있는 장소를 찾아요.', explanation: '안내판 앞에서는 차를 마시지 말라고 했어요.' },
  { id: 'town-reading-sequence', skill: 'sequence', passage: '먼저 안내판의 그림을 확인하세요. 그다음 화살표를 따라 쉼터로 오세요. 자리에 앉은 뒤 차를 주문하세요.',
    question: '가장 먼저 해야 하는 일은 무엇인가요?', choices: ['안내판의 그림 확인하기', '차 주문하기', '쉼터의 의자에 앉기'], correct: 0,
    hint: '“먼저” 뒤의 일을 찾아요.', explanation: '안내판의 그림을 먼저 확인한 뒤 쉼터로 와요.' },
  { id: 'town-detail-market', skill: 'detail', passage: '오늘 꽃 시장은 빵집 옆에서 열립니다. 과일 시장은 공원 입구에서 열립니다.',
    question: '꽃을 사려면 어디로 가야 하나요?', choices: ['공원 입구', '빵집 옆', '찻집 안'], correct: 1,
    hint: '꽃 시장의 장소와 과일 시장의 장소를 구분해요.', explanation: '꽃 시장은 빵집 옆에서 열립니다.' },
  { id: 'town-detail-library', skill: 'detail', passage: '마을 도서관 안내입니다. 어린이 책은 1층, 한국어 책은 2층에 있습니다.',
    question: '한국어 책은 몇 층에 있나요?', choices: ['1층', '3층', '2층'], correct: 2,
    hint: '“한국어 책” 바로 뒤의 층을 찾아요.', explanation: '한국어 책은 2층에 있습니다.' },
  { id: 'town-detail-lost', skill: 'detail', passage: '잃어버린 물건을 보관합니다. 우산은 관리실에, 가방은 안내 데스크에 있습니다.',
    question: '우산을 찾으려면 어디로 가야 하나요?', choices: ['관리실', '안내 데스크', '버스 정류장'], correct: 0,
    hint: '우산이 있는 곳을 찾아요.', explanation: '우산은 관리실에 보관하고 있습니다.' },
  { id: 'town-detail-festival', skill: 'detail', passage: '마을 축제에 오신 것을 환영합니다. 음악 공연은 무대 왼쪽에서, 음식 판매는 무대 오른쪽에서 합니다.',
    question: '음악 공연은 어디에서 하나요?', choices: ['무대 오른쪽', '무대 왼쪽', '공원 밖'], correct: 1,
    hint: '공연 장소와 음식을 파는 장소를 구분해요.', explanation: '음악 공연은 무대 왼쪽에서 합니다.' },
  { id: 'town-detail-workshop', skill: 'detail', passage: '토요일 공방 수업 안내입니다. 그림 수업은 오전 10시에, 컵 만들기는 오후 2시에 시작합니다.',
    question: '컵 만들기 수업은 언제 시작하나요?', choices: ['오전 10시', '오전 2시', '오후 2시'], correct: 2,
    hint: '“컵 만들기” 옆의 시간과 오전·오후를 확인해요.', explanation: '컵 만들기 수업은 오후 2시에 시작합니다.' },
  { id: 'town-negation-flowers', skill: 'negation', passage: '공원의 꽃을 구경해 주세요. 사진은 찍어도 됩니다. 꽃은 꺾지 마세요.',
    question: '공원에서 하면 안 되는 일은 무엇인가요?', choices: ['꽃 꺾기', '사진 찍기', '꽃 구경하기'], correct: 0,
    hint: '“하지 마세요”라는 뜻의 표현을 찾아요.', explanation: '꽃을 꺾지 말라고 했어요. 구경과 사진 촬영은 할 수 있어요.' },
  { id: 'town-negation-books', skill: 'negation', passage: '읽은 책은 책장에 직접 꽂지 마세요. 책상 위의 파란 바구니에 놓아 주세요.',
    question: '읽은 책으로 하면 안 되는 행동은 무엇인가요?', choices: ['책을 읽기', '책장에 직접 꽂기', '파란 바구니에 놓기'], correct: 1,
    hint: '하지 말라는 행동과 대신 해야 하는 행동을 구분해요.', explanation: '책장에 직접 꽂으면 안 됩니다. 파란 바구니에 놓아야 해요.' },
  { id: 'town-negation-bike', skill: 'negation', passage: '마을 다리에서는 자전거를 타지 마세요. 자전거에서 내려서 걸어가 주세요.',
    question: '다리에서 하지 말아야 할 일은 무엇인가요?', choices: ['자전거에서 내리기', '걸어가기', '자전거 타기'], correct: 2,
    hint: '“타지 마세요”의 뜻을 생각해요.', explanation: '다리에서는 자전거를 타면 안 되고, 내려서 걸어가야 해요.' },
  { id: 'town-negation-desk', skill: 'negation', passage: '공방에서 가위를 사용할 수 있습니다. 사용한 가위는 가져가지 말고 이 상자에 넣어 주세요.',
    question: '공방에서 하면 안 되는 행동은 무엇인가요?', choices: ['가위를 집으로 가져가기', '가위를 사용하기', '사용한 가위를 상자에 넣기'], correct: 0,
    hint: '사용 허용과 가져가기 금지를 구분해요.', explanation: '가위는 사용할 수 있지만 가져가면 안 됩니다.' },
  { id: 'town-negation-bus', skill: 'negation', passage: '버스를 기다리는 분들께 알립니다. 문 앞에 서 있지 마세요. 노란 선 뒤에서 기다려 주세요.',
    question: '어디에 서 있으면 안 되나요?', choices: ['노란 선 뒤', '버스 문 앞', '정류장의 의자 옆'], correct: 1,
    hint: '서 있지 말라는 장소를 찾아요.', explanation: '버스 문 앞에 서 있으면 안 됩니다. 노란 선 뒤에서 기다려야 해요.' },
  { id: 'town-sequence-borrow', skill: 'sequence', passage: '우산을 빌리려면 먼저 이름을 적어 주세요. 그다음 우산을 하나 고르세요. 돌아올 때 같은 곳에 반납해 주세요.',
    question: '우산을 고르기 전에 무엇을 해야 하나요?', choices: ['우산 반납하기', '집에 돌아가기', '이름 적기'], correct: 2,
    hint: '“먼저” 해야 하는 일을 찾아요.', explanation: '이름을 적은 다음 우산을 골라야 해요.' },
  { id: 'town-sequence-class', skill: 'sequence', passage: '공방 수업은 다음 순서로 합니다. 손을 씻은 뒤 앞치마를 입으세요. 앞치마를 입고 나서 재료를 받으세요.',
    question: '앞치마를 입은 다음에는 무엇을 하나요?', choices: ['재료 받기', '손 씻기', '집에 가기'], correct: 0,
    hint: '앞치마를 입기 전과 입은 뒤를 구분해요.', explanation: '손을 씻고 앞치마를 입은 뒤 재료를 받아요.' },
  { id: 'town-sequence-parcel', skill: 'sequence', passage: '마을 선물을 보냅니다. 먼저 상자에 선물을 넣으세요. 다음으로 상자를 닫으세요. 마지막에 받는 사람의 이름을 쓰세요.',
    question: '가장 마지막에 하는 일은 무엇인가요?', choices: ['선물을 상자에 넣기', '받는 사람 이름 쓰기', '상자 닫기'], correct: 1,
    hint: '“마지막에” 뒤에 있는 행동을 찾아요.', explanation: '선물을 넣고 상자를 닫은 뒤, 마지막에 이름을 씁니다.' },
  { id: 'town-sequence-garden', skill: 'sequence', passage: '작은 화분을 만들어요. 화분에 흙을 먼저 넣으세요. 그다음 씨앗을 심고 물을 주세요.',
    question: '씨앗을 심기 전에 해야 하는 일은 무엇인가요?', choices: ['물을 주기', '꽃을 꺾기', '흙을 넣기'], correct: 2,
    hint: '씨앗을 심기 앞에 있는 행동을 찾아요.', explanation: '화분에 흙을 먼저 넣고 씨앗을 심어요.' },
  { id: 'town-sequence-ticket', skill: 'sequence', passage: '마을 공연을 보려면 매표소에서 표를 사세요. 산 표를 입구에서 보여 주세요. 그다음 안으로 들어가세요.',
    question: '표를 산 다음, 안으로 들어가기 전에 무엇을 하나요?', choices: ['입구에서 표 보여 주기', '다시 표 사기', '공연장 밖으로 나가기'], correct: 0,
    hint: '표 구매와 입장 사이의 행동을 찾아요.', explanation: '표를 산 뒤 입구에서 보여 주고 안으로 들어가요.' },
  // 읽고 이유 이해하기·핵심 이해하기(2026-10-20, 「내 위치」 짧은 진단이 비어 있던 두 항목, Fable 검수 반영). 다른 문항처럼 교원 검수 전 초안이다.
  { id: 'town-reason-library', skill: 'reason', passage: '오늘 마을 도서관은 오후 3시에 문을 닫습니다. 저녁에 도서관 청소를 하기 때문입니다. 내일은 아침 9시에 문을 엽니다.',
    question: '오늘 도서관이 오후 3시에 문을 닫는 이유는 무엇인가요?', choices: ['청소를 해야 해서', '내일 아침에 문을 열어서', '책을 빌리는 사람이 없어서'], correct: 0,
    hint: '“때문입니다” 앞에 있는 말을 찾아요.', explanation: '저녁에 도서관 청소를 하기 때문에 오늘은 오후 3시에 문을 닫아요.' },
  { id: 'town-reason-bakery', skill: 'reason', passage: '오늘은 오븐이 고장 나서 빵을 굽지 못합니다. 대신 쿠키와 우유는 팝니다. 오븐은 내일 고칩니다.',
    question: '오늘 빵을 팔지 않는 이유는 무엇인가요?', choices: ['쿠키와 우유만 팔고 싶어서', '오븐이 고장 나서', '내일 오븐을 고쳐서'], correct: 1,
    hint: '“-아서” 앞에 있는 일을 찾아요.', explanation: '오븐이 고장 나서 오늘은 빵을 굽지 못해요.' },
  { id: 'town-reason-walk', skill: 'reason', passage: '오늘은 비가 많이 오니까 공원 산책 모임은 쉽니다. 다음 모임은 토요일 아침에 합니다.',
    question: '오늘 산책 모임을 쉬는 이유는 무엇인가요?', choices: ['토요일 아침에 모여서', '공원이 문을 닫아서', '비가 많이 와서'], correct: 2,
    hint: '“-니까” 앞에 있는 말을 찾아요.', explanation: '비가 많이 오니까 오늘 산책 모임은 쉬어요.' },
  { id: 'town-reason-bus', skill: 'reason', passage: '오늘 마을 버스는 시장 앞에 서지 않습니다. 시장 앞 길에서 축제를 하기 때문입니다. 시장에 가실 분은 다음 정류장에서 내려 주세요.',
    question: '오늘 버스가 시장 앞에 서지 않는 이유는 무엇인가요?', choices: ['다음 정류장에서 내려야 해서', '시장 앞 길에서 축제를 해서', '버스에 사람이 많아서'], correct: 1,
    hint: '두 번째 문장의 “때문입니다” 앞을 읽어요.', explanation: '시장 앞 길에서 축제를 하기 때문에 버스가 시장 앞에 서지 않아요.' },
  { id: 'town-reason-florist', skill: 'reason', passage: '오늘 오후에는 꽃 시장에 꽃을 사러 가서 꽃집 문을 열지 않습니다. 저녁 6시에 다시 문을 엽니다.',
    question: '오늘 오후에 꽃집이 문을 열지 않는 이유는 무엇인가요?', choices: ['저녁 6시에 다시 열어서', '꽃이 다 팔려서', '꽃 시장에 꽃을 사러 가서'], correct: 2,
    hint: '“-아서” 앞에 있는 일을 찾아요.', explanation: '꽃 시장에 꽃을 사러 가서 오늘 오후에는 꽃집 문을 열지 않아요.' },
  { id: 'town-reason-quiet', skill: 'reason', passage: '도서관 2층에서는 작은 소리로 이야기해 주세요. 시험 공부를 하는 학생이 많기 때문입니다. 이야기를 하고 싶으면 1층 카페를 이용하세요.',
    question: '2층에서 작은 소리로 이야기해야 하는 이유는 무엇인가요?', choices: ['시험 공부를 하는 학생이 많아서', '1층에 카페가 있어서', '2층에서 시험을 봐서'], correct: 0,
    hint: '“-기 때문입니다” 앞에 있는 일을 찾아요.', explanation: '시험 공부를 하는 학생이 많기 때문에 2층에서는 작은 소리로 이야기해야 해요.' },
  { id: 'town-main-swim', skill: 'main', passage: '마을 수영장에서 어린이 수영 수업을 엽니다. 수업은 매주 토요일 오전에 있습니다. 신청은 이번 주 금요일까지 안내 데스크에서 합니다.',
    question: '이 안내문은 무엇에 대한 안내인가요?', choices: ['수영장 청소 시간', '어린이 수영 수업', '안내 데스크의 위치'], correct: 1,
    hint: '한 문장에만 나오는 것이 아니라, 안내문 전체가 알리는 것을 찾아요.', explanation: '수업 요일도, 신청 방법도 모두 어린이 수영 수업에 대한 말이에요.' },
  { id: 'town-main-cup', skill: 'main', passage: '이번 주부터 마을 카페에 자기 컵을 가지고 오시면 커피를 500원 싸게 드립니다. 종이컵을 덜 쓰고 싶습니다. 많이 도와주세요.',
    question: '카페가 이 글에서 가장 하고 싶은 말은 무엇인가요?', choices: ['자기 컵을 가지고 와 주세요', '커피 값이 올랐어요', '종이컵을 팔아요'], correct: 0,
    hint: '카페가 손님에게 부탁하는 것을 찾아요.', explanation: '종이컵을 덜 쓰고 싶어서 손님에게 자기 컵을 가지고 오라고 부탁하는 글이에요. 컵을 가지고 오면 커피도 싸게 줘요.' },
  { id: 'town-main-post', skill: 'main', passage: '마을 우체국이 다음 달 1일에 은행 옆 새 건물로 이사합니다. 이번 달까지는 지금 자리에서 일합니다. 새 우체국도 아침 9시에 문을 엽니다.',
    question: '이 안내문의 중심 내용은 무엇인가요?', choices: ['은행이 새 건물로 이사해요', '우체국이 여는 시간이 바뀌어요', '우체국이 다른 곳으로 이사해요'], correct: 2,
    hint: '여러 문장이 함께 알리는 일을 찾아요.', explanation: '우체국이 다음 달에 은행 옆 새 건물로 이사한다는 안내예요.' },
  { id: 'town-main-cat', skill: 'main', passage: '우리 고양이를 찾습니다. 이름은 구름이고 하얀 고양이입니다. 어제 저녁에 공원 앞에서 잃어버렸습니다. 보신 분은 꽃집으로 연락해 주세요.',
    question: '이 글은 무엇에 대한 글인가요?', choices: ['잃어버린 고양이를 찾는 글', '고양이를 파는 글', '꽃집을 소개하는 글'], correct: 0,
    hint: '글을 쓴 사람이 무엇을 바라는지 생각해요.', explanation: '공원 앞에서 잃어버린 하얀 고양이를 찾고 있어요.' },
  { id: 'town-main-swap', skill: 'main', passage: '이번 주 토요일에 마을 광장에서 물건을 바꾸는 시장이 열립니다. 쓰지 않는 물건을 가지고 오시면 다른 물건과 바꿀 수 있습니다. 누구나 올 수 있습니다.',
    question: '이 안내문은 무엇에 대한 안내인가요?', choices: ['토요일 날씨', '마을 광장의 위치', '물건을 바꾸는 시장'], correct: 2,
    hint: '안내문의 문장들이 모두 무엇에 대해 말하는지 찾아요.', explanation: '토요일에 마을 광장에서 열리는, 물건을 바꾸는 시장을 알려요.' },
  { id: 'town-main-thanks', skill: 'main', passage: '지난주에 길에서 넘어졌을 때 도와주신 분께 감사합니다. 그분 덕분에 병원에 빨리 갈 수 있었습니다. 다시 만나면 꼭 차 한 잔 사 드리고 싶습니다.',
    question: '이 글을 쓴 사람이 가장 하고 싶은 말은 무엇인가요?', choices: ['병원이 너무 멀어요', '도와주신 분께 고마워요', '길에서 차를 마셨어요'], correct: 1,
    hint: '글을 쓴 사람이 처음과 끝에 무엇을 말하는지 봐요.', explanation: '넘어졌을 때 도와준 사람에게 고마운 마음을 전하는 글이에요.' },
]);
export function readingMetadata(item) {
  return { id: item.id, itemKey: `synk-town.reading-check.${item.id}.v1`, familyKey: `synk-town.reading-check.${item.id}.v1`,
    skillId: `ko.reading.${item.skill}`, difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false, confounded: false };
}
export function readingAnswer(item, selected) {
  if (!Number.isInteger(selected) || selected < 0 || selected >= item.choices.length) throw Error('답을 골라 주세요.');
  return { correct: selected === item.correct, assessable: true,
    choice: { selectedId: `option-${selected}`, correctId: `option-${item.correct}` } };
}
function allowedChecks(assignment) {
  return READING_CHECKS.filter(item => {
    if (!assignment) return true;
    const m = readingMetadata(item);
    return m.skillId === assignment.skillId && m.difficulty === assignment.difficulty
      && m.responseFormat === assignment.responseFormat && m.modality === assignment.modality
      && Array.isArray(assignment.familyKeys) && assignment.familyKeys.includes(m.familyKey)
      && Array.isArray(assignment.itemKeys) && assignment.itemKeys.includes(m.itemKey);
  });
}
export function selectReadingChecks(coach, { assignment = coach.assignment?.() ?? null, limit = 3 } = {}) {
  let pool = allowedChecks(assignment);
  const count = Math.min(limit, assignment?.requiredAttempts ?? limit), selected = [];
  while (pool.length && selected.length < count) {
    const candidates = pool.map(item => { const m = readingMetadata(item); return { ...item, ...m, skillIds: [m.skillId], label: item.question }; });
    const plan = coach.recommend(candidates), next = pool.find(item => item.id === plan?.selected?.id);
    if (!next) break;
    selected.push(next); pool = pool.filter(item => item.id !== next.id);
  }
  return selected;
}

// Authored contrasts for the selected option, not a diagnosis of the learner.
const CORRECTIONS = {
  'town-reading-place': ['밖의 자리는 내일부터예요. 오늘 이용할 수 있는 곳을 찾아요.', null, '내일부터라는 말은 밖의 자리에만 해당해요. 안의 쉼터는 오늘도 열어요.'],
  'town-reading-negation': ['의자에서는 차를 마셔도 돼요. 마시지 말라는 장소를 찾아요.', '찻집 안 전체를 금지한 안내가 아니에요. 금지한 장소는 안내판 앞이에요.'],
  'town-reading-sequence': [null, '주문은 자리에 앉은 뒤예요. 가장 먼저 하는 일은 그림 확인이에요.', '앉기는 쉼터에 온 뒤예요. 그 전에 안내판 그림을 확인해요.'],
  'town-detail-market': ['공원 입구는 과일 시장이에요. 질문은 꽃 시장을 물어요.', null, '이 안내에서 찻집은 꽃 시장의 장소가 아니에요. 빵집 옆을 찾아요.'],
  'town-detail-library': ['1층은 어린이 책이 있는 곳이에요. 한국어 책은 2층이에요.', '안내에는 3층에 한국어 책이 있다고 쓰여 있지 않아요. 2층을 찾아요.'],
  'town-detail-lost': [null, '안내 데스크는 가방이 있는 곳이에요. 우산은 관리실에 있어요.', '버스 정류장은 이 안내의 보관 장소가 아니에요. 우산은 관리실에 있어요.'],
  'town-detail-festival': ['무대 오른쪽은 음식을 파는 곳이에요. 공연은 왼쪽이에요.', null, '공원 밖이라는 안내는 없어요. 음악 공연은 무대 왼쪽이에요.'],
  'town-detail-workshop': ['오전 10시는 그림 수업이에요. 컵 만들기 시간을 찾아요.', '숫자 2뿐 아니라 오후도 확인해요. 컵 만들기는 오후 2시예요.'],
  'town-negation-flowers': [null, '사진은 찍어도 된다고 했어요. 금지한 행동은 꽃 꺾기예요.', '꽃은 구경해 달라고 했어요. 꺾는 행동만 금지했어요.'],
  'town-negation-books': ['책 읽기를 금지한 안내가 아니에요. 읽은 뒤 책을 놓는 방법에 관한 안내예요.', null, '바구니에 놓는 것은 해야 하는 행동이에요. 책장에 직접 꽂지 말라고 했어요.'],
  'town-negation-bike': ['자전거에서 내리는 것은 해야 하는 행동이에요.', '걸어가는 것은 해야 하는 행동이에요. 타고 가는 것을 금지했어요.'],
  'town-negation-desk': [null, '가위 사용은 허용했어요. 가져가는 것만 금지했어요.', '상자에 넣는 것은 사용 후 해야 하는 행동이에요.'],
  'town-negation-bus': ['노란 선 뒤는 기다려야 하는 곳이에요. 문 앞에 서 있지 말라고 했어요.', null, '의자 옆을 금지했다는 말은 없어요. 금지한 곳은 버스 문 앞이에요.'],
  'town-sequence-borrow': ['반납은 돌아올 때예요. 우산을 고르기 전에는 이름을 적어요.', '집에 돌아가는 순서는 안내에 없어요. 먼저 이름을 적어요.'],
  'town-sequence-class': [null, '손 씻기는 앞치마를 입기 전이에요. 질문은 입은 다음을 물어요.', '집에 가기는 이 수업 순서에 없어요. 앞치마를 입은 뒤 재료를 받아요.'],
  'town-sequence-parcel': ['선물 넣기는 첫 번째예요. 마지막에는 받는 사람 이름을 써요.', null, '상자를 닫은 뒤 이름을 쓰는 일이 남아 있어요.'],
  'town-sequence-garden': ['물 주기는 씨앗을 심은 뒤예요. 심기 전에는 흙을 넣어요.', '꽃 꺾기는 이 순서에 없어요. 먼저 흙을 넣어요.'],
  'town-sequence-ticket': [null, '이미 산 표를 다시 사는 것이 아니에요. 입구에서 보여 주세요.', '밖으로 나가는 것이 아니에요. 산 표를 입구에서 보여 주고 들어가요.'],
  'town-reason-library': [null, '아침 9시는 내일 문을 여는 시간이에요. 오늘 문을 닫는 이유가 아니에요.', '빌리는 사람이 없다는 말은 안내에 없어요. 이유는 저녁 청소예요.'],
  'town-reason-bakery': ['쿠키와 우유는 빵 대신 파는 것이에요. 빵을 못 파는 이유가 아니에요.', null, '오븐을 고치는 것은 내일 할 일이에요. 오늘 빵을 못 파는 이유는 고장이에요.'],
  'town-reason-walk': ['토요일 아침은 다음 모임 시간이에요. 오늘 쉬는 이유가 아니에요.', '공원이 문을 닫는다는 말은 안내에 없어요. 이유는 비예요.', null],
  'town-reason-bus': ['다음 정류장에서 내리는 것은 시장에 가는 방법이에요. 버스가 서지 않는 이유가 아니에요.', null, '버스에 사람이 많다는 말은 안내에 없어요. 이유는 시장 앞 축제예요.'],
  'town-reason-florist': ['저녁 6시는 다시 문을 여는 시간이에요. 오후에 문을 열지 않는 이유가 아니에요.', '꽃이 다 팔렸다는 말은 안내에 없어요. 이유는 꽃 시장에 가는 것이에요.', null],
  'town-reason-quiet': [null, '1층 카페는 이야기하고 싶을 때 가는 곳이에요. 작은 소리로 말해야 하는 이유가 아니에요.', '2층에서 시험을 본다는 말은 안내에 없어요. 시험 공부를 하는 학생이 많은 것이 이유예요.'],
  'town-main-swim': ['청소 이야기는 안내에 없어요. 안내문 전체가 어린이 수영 수업을 알려요.', null, '안내 데스크는 신청하는 곳으로 한 번 나와요. 안내문 전체는 수영 수업에 대한 것이에요.'],
  'town-main-cup': [null, '값이 올랐다는 말은 없어요. 컵을 가지고 오면 커피가 더 싸요.', '종이컵을 판다는 말은 없어요. 종이컵을 덜 쓰고 싶다고 했어요.'],
  'town-main-post': ['은행은 새 우체국 옆에 있는 건물이에요. 이사하는 것은 은행이 아니라 우체국이에요.', '여는 시간이 바뀐다는 말은 없어요. 새 우체국도 아침 9시에 열어요.', null],
  'town-main-cat': [null, '고양이를 판다는 말은 없어요. 잃어버린 고양이를 찾고 있어요.', '꽃집은 연락할 곳이에요. 글은 고양이를 찾는 내용이에요.'],
  'town-main-swap': ['날씨 이야기는 안내에 없어요. 안내는 물건을 바꾸는 시장을 알려요.', '광장은 시장이 열리는 곳으로 나와요. 안내문 전체는 물건을 바꾸는 시장에 대한 것이에요.', null],
  'town-main-thanks': ['병원이 멀다는 말은 없어요. 도와주신 덕분에 병원에 빨리 갔어요.', null, '차는 다시 만나면 사 드리고 싶은 것이에요. 길에서 마신 것이 아니에요.'],
};
export function readingFeedback(item, selected) {
  readingAnswer(item, selected);
  return selected === item.correct ? item.explanation
    : `고른 답: ${item.choices[selected]}. ${CORRECTIONS[item.id]?.[selected] || item.explanation} 정답: ${item.choices[item.correct]}.`;
}
export function readingFollowUp(coach, item, round, index) {
  if (index + 1 >= round.length) return { round, status: 'complete' };
  const used = new Set(round.slice(0, index + 1).map(q => q.id));
  const pool = allowedChecks(coach.assignment?.() ?? null).filter(q => q.skill === item.skill && !used.has(q.id)
    && coach.exposure?.(readingMetadata(q))?.seen === false);
  if (!pool.length) return { round, status: 'unavailable' };
  const candidates = pool.map(q => ({ ...readingMetadata(q), ...q, skillIds: [readingMetadata(q).skillId], label: q.question }));
  const plan = coach.recommend(candidates), next = pool.find(q => q.id === plan?.selected?.id);
  if (!next) return { round, status: 'unavailable' };
  const updated = [...round], existing = updated.findIndex((q, i) => i > index && q.id === next.id);
  if (existing > index) [updated[index + 1], updated[existing]] = [updated[existing], updated[index + 1]];
  else updated[index + 1] = next;
  return { round: updated, status: 'new', item: next };
}
