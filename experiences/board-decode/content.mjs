// 게시판 해독 — 판 원고(설계 experiences/board-decode/설계.md). 글은 모두 화면이 얹고 사진에는 글자가 없다.
// 판 하나 = 게시물 + 갈림 말(forks: 낱말 하나로 답이 뒤집힌다) + 칸(태오의 질문 · 보기 셋) + 정정 쪽지.
// 칸의 keys 마지막이 그 칸의 갈림 자리다. 보기의 ok = 그 낱말일 때 정답, null = 어느 쪽이든 틀린 미끼. 태오는 해요체(1화 설정과 같다).
// 보기는 뜻풀이가 아니라 행동으로 쓴다 — 쉬운 뜻 문자열이 보기에 들어가면 content.test.mjs가 잡는다.

export const WORDS = Object.freeze({
  제외: { easy: '그건 빼고', twin: '한함', pic: 'cal', clues: ['도서관 운영: 매일 9시 ~ 18시 (일요일 [[제외]])', '버스비는 참가비에서 [[제외]]됩니다. 따로 내세요.'] },
  한함: { easy: '그것만', twin: '제외', pic: 'gate', clues: ['주차: 교직원에 [[한함]] (학생 차는 들어갈 수 없음)', '이 쿠폰은 오늘에 [[한해]] 쓸 수 있습니다.'] },
  보관: { easy: '잘 맡아 둠', twin: '폐기', pic: 'locker', clues: ['짐은 1층 사물함에 [[보관]]하세요. 집에 갈 때 찾아가세요.', '우유는 냉장고에 [[보관]]하세요.'] },
  폐기: { easy: '버림', twin: '보관', pic: 'trash', clues: ['날짜가 지난 우유는 모두 [[폐기]]합니다.', '찾아가지 않은 우산은 한 달 뒤 [[폐기]]합니다.'] },
  선착순: { easy: '먼저 온 사람부터', twin: '사전 접수', pic: 'queue', clues: ['커피 쿠폰 [[선착순]] 3명! (네 번째 분은 못 받아요)', '[[선착순]] 30명이 다 찼습니다. 다음에 또 오세요.'] },
  '사전 접수': { easy: '미리 신청함', twin: '선착순', pic: 'form', clues: ['[[사전 접수]]는 행사 전날까지입니다. 당일에는 신청할 수 없습니다.', '[[사전 접수]]를 마친 분만 들어올 수 있습니다.'] },
  '우천 시': { easy: '비가 오면', decoy: '사람이 많으면', pic: 'umbrella', clues: ['[[우천 시]] 체육 대회는 체육관에서 합니다.', '[[우천 시]] 우산을 가지고 오세요.'] },
  연기: { easy: '다른 날로 미룸', twin: '취소', pic: 'move', clues: ['시험 날짜가 다음 주로 [[연기]]되었습니다.', '회의를 금요일로 [[연기]]합니다.'] },
  취소: { easy: '아예 안 함', twin: '연기', pic: 'cancel', clues: ['오늘 소풍은 [[취소]]되었습니다. 다른 날에도 가지 않습니다.', '오늘 수업은 [[취소]]되었습니다. 보충 수업은 없습니다.'] },
  필수: { easy: '꼭 해야 함', twin: '권장', pic: 'must', clues: ['안전 교육 [[필수]] — 안 받으면 기숙사에 들어갈 수 없습니다.', '이름은 [[필수]], 전화번호는 안 써도 됩니다.'] },
  권장: { easy: '하면 좋음', twin: '필수', pic: 'good', clues: ['운동화 [[권장]] (구두도 괜찮아요)', '예약을 [[권장]]합니다. 예약이 없어도 들어올 수 있어요.'] },
  불가: { easy: '할 수 없음', twin: '가능', pic: 'ban', clues: ['교환 [[불가]] — 한 번 사면 바꿀 수 없습니다.', '오늘은 주차 [[불가]]입니다. 차를 가져오지 마세요.'] },
  가능: { easy: '할 수 있음', twin: '불가', pic: 'okay', clues: ['카드 결제 [[가능]]합니다. 현금도 됩니다.', '1층은 밤 12시까지 이용 [[가능]]합니다.'] },
  연장: { easy: '기간을 늘림', decoy: '기간을 줄임', pic: 'longer', clues: ['도서관 이용 시간을 밤 12시까지 [[연장]]합니다.', '책 반납 날짜를 일주일 [[연장]]할 수 있습니다.'] },
  제한: { easy: '정한 만큼만 하게 함', decoy: '더 하게 해 줌', pic: 'limit', clues: ['한 사람당 2개로 [[제한]]합니다. 세 개는 안 돼요.', '수강 인원을 30명으로 [[제한]]합니다.'] },
});

// 단서 카드의 그림(글자 없음). viewBox 0 0 70 50.
export const PICS = Object.freeze({
  cal: "<rect x='5' y='6' width='60' height='38' rx='4' fill='#fff' stroke='#1f2d52'/><g fill='#d7dbe3'><rect x='10' y='13' width='7' height='7'/><rect x='18' y='13' width='7' height='7'/><rect x='26' y='13' width='7' height='7'/><rect x='34' y='13' width='7' height='7'/><rect x='42' y='13' width='7' height='7'/><rect x='10' y='27' width='7' height='7'/><rect x='18' y='27' width='7' height='7'/><rect x='26' y='27' width='7' height='7'/><rect x='34' y='27' width='7' height='7'/><rect x='42' y='27' width='7' height='7'/></g><rect x='52' y='13' width='7' height='7' fill='#f3c5bb'/><rect x='52' y='27' width='7' height='7' fill='#f3c5bb'/><path d='M50 11l11 11m0-11L50 22M50 25l11 11m0-11L50 36' stroke='#d94f38' stroke-width='1.8'/>",
  gate: "<path d='M6 44V10h4v34M60 44V10h4v34' stroke='#1f2d52' fill='none'/><path d='M10 16h50' stroke='#1f2d52' stroke-width='3'/><circle cx='24' cy='26' r='4.5' fill='#1f7f5c'/><path d='M18 44v-5a6 6 0 0 1 12 0v5z' fill='#1f7f5c'/><g fill='#c9ccd3'><circle cx='43' cy='26' r='4.5'/><path d='M37 44v-5a6 6 0 0 1 12 0v5z'/></g><path d='M36 22l14 14m0-14L36 36' stroke='#d94f38' stroke-width='1.8'/>",
  locker: "<rect x='17' y='4' width='36' height='44' rx='2' fill='#fff' stroke='#1f2d52'/><path d='M35 4v44M17 26h36' stroke='#1f2d52'/><circle cx='30' cy='15' r='1.4' fill='#1f2d52'/><circle cx='40' cy='15' r='1.4' fill='#1f2d52'/><rect x='38' y='30' width='12' height='13' rx='2' fill='#f3d36b' stroke='#1f2d52'/>",
  trash: "<path d='M11 16l5-8h10l5 8v26H11z' fill='#fff' stroke='#1f2d52'/><path d='M36 25h9m-4-4l4 4-4 4' stroke='#d94f38' stroke-width='1.8' fill='none'/><path d='M49 18h16M52 18l2 26h8l2-26' fill='#fff' stroke='#1f2d52'/>",
  queue: "<g fill='#1f7f5c'><circle cx='9' cy='16' r='5'/><circle cx='23' cy='16' r='5'/><circle cx='37' cy='16' r='5'/><path d='M4 40v-11a5 5 0 0 1 10 0v11zM18 40v-11a5 5 0 0 1 10 0v11zM32 40v-11a5 5 0 0 1 10 0v11z'/></g><g fill='#c9ccd3'><circle cx='51' cy='16' r='5'/><circle cx='64' cy='16' r='5'/><path d='M46 40v-11a5 5 0 0 1 10 0v11zM59 40v-11a5 5 0 0 1 10 0v11z'/></g>",
  form: "<rect x='14' y='5' width='28' height='40' rx='2' fill='#fff' stroke='#1f2d52'/><path d='M20 15h16M20 23h16M20 31h9' stroke='#c9ccd3' stroke-width='2'/><path d='M46 40l3-9 11-11 5 5-11 11z' fill='#f3d36b' stroke='#1f2d52'/><path d='M22 41l-5-4' stroke='none'/>",
  umbrella: "<path d='M13 26a22 22 0 0 1 44 0z' fill='#fff' stroke='#1f2d52'/><path d='M35 26v14a4 4 0 0 1-8 0' fill='none' stroke='#1f2d52'/><path d='M11 7l-3 8M25 1l-3 6M49 1l-3 6M63 7l-3 8' stroke='#6d8ac0' stroke-width='2'/>",
  move: "<rect x='4' y='12' width='26' height='28' rx='3' fill='#fff' stroke='#c9ccd3'/><rect x='40' y='12' width='26' height='28' rx='3' fill='#fff' stroke='#1f2d52'/><circle cx='17' cy='26' r='4' fill='#c9ccd3'/><circle cx='53' cy='26' r='4' fill='#1f7f5c'/><path d='M31 26h8m-4-4l4 4-4 4' stroke='#1f7f5c' stroke-width='2' fill='none'/>",
  cancel: "<rect x='19' y='9' width='32' height='32' rx='3' fill='#fff' stroke='#1f2d52'/><circle cx='35' cy='25' r='5' fill='#c9ccd3'/><path d='M21 11l28 28M49 11L21 39' stroke='#d94f38' stroke-width='2.5'/>",
  must: "<rect x='19' y='6' width='32' height='38' rx='3' fill='#fff' stroke='#1f2d52'/><circle cx='35' cy='25' r='11' fill='none' stroke='#d94f38' stroke-width='2.5'/><circle cx='35' cy='25' r='3.5' fill='#d94f38'/>",
  good: "<path d='M24 44V22l8-14c4 0 6 3 5 7l-2 7h13c3 0 5 3 4 6l-4 13c-1 2-2 3-5 3z' fill='#fff' stroke='#1f7f5c'/><rect x='13' y='22' width='9' height='22' rx='2' fill='#dff1e8' stroke='#1f7f5c'/>",
  ban: "<circle cx='35' cy='25' r='18' fill='#fff' stroke='#d94f38' stroke-width='3'/><path d='M22 12l26 26' stroke='#d94f38' stroke-width='3'/>",
  okay: "<circle cx='35' cy='25' r='18' fill='#fff' stroke='#1f7f5c' stroke-width='3'/><path d='M25 25l7 8 13-15' fill='none' stroke='#1f7f5c' stroke-width='3'/>",
  longer: "<rect x='6' y='18' width='30' height='14' rx='2' fill='#c9ccd3'/><rect x='36' y='18' width='20' height='14' fill='#dff1e8' stroke='#1f7f5c' stroke-dasharray='3 2'/><path d='M57 25h8m-4-4l4 4-4 4' stroke='#1f7f5c' stroke-width='2' fill='none'/>",
  limit: "<g fill='#1f2d52'><rect x='10' y='13' width='10' height='24' rx='2'/><rect x='24' y='13' width='10' height='24' rx='2'/></g><rect x='43' y='13' width='10' height='24' rx='2' fill='#e6e7ea'/><path d='M38 7v36' stroke='#d94f38' stroke-width='2.5'/>",
});

// 게시판 사진: 파일 이름 → 배경 자르기. 장면 사진은 assets/photo/<이름>.webp
export const ROUNDS = Object.freeze([
  {
    id: 'laundry', board: 'board-dorm', crop: '175% auto|43% 46%', where: { ko: '새솔관 4층', en: 'Saesol Hall, 4F', mn: 'Сэсол байр, 4-р давхар' }, when: { ko: '목 오전 10:05', en: 'Thu 10:05 AM', mn: 'Пүрэв, 10:05' }, hero: 'scene-towel',
    title: { ko: '세탁실 공지', en: 'Laundry notice', mn: 'Хувцас угаалгын өрөөний зарлал' },
    forks: { f1: ['제외', '한함'], f2: ['보관', '폐기'] },
    notices: [{
      id: 'dorm', style: 'n-paper', org: '새솔관 생활 안내', no: '공지 제12호', title: '세탁실 정기 점검 안내', seal: '새솔\n관리',
      lines: ['세탁기 점검으로 오늘 오전 9시부터 오후 1시까지 아래 세탁실을 쓸 수 없습니다.', { key: 'f1' }, { key: 'f2' }],
      foot: '새솔관 관리실',
    }],
    variants: {
      제외: '· 점검 대상: 3층을 [[제외]]한 모든 층',
      한함: '· 점검 대상: 3층 세탁실에 [[한함]]',
      보관: '· 점검 전까지 찾아가지 않은 빨래는 관리실에서 [[보관]]합니다.',
      폐기: '· 점검 전까지 찾아가지 않은 빨래는 관리실에서 [[폐기]]합니다.',
    },
    scraps: [{ text: '룸메이트 구해요', sub: '5층 · 조용한 분', fringe: true }, { text: '중고 교재 삽니다', sub: '이번 학기 전공 책' }, { text: '복도에 짐을 두지 마세요' }, { text: '자전거 팝니다 · 302호' }, { text: '검은 우산 주웠어요 → 관리실' }],
    open: { first: '저 지금 수업 중인데 ㅠㅠ 4층 살죠? 엘리베이터 옆에 세탁실 공지 붙었다던데 좀 봐 줘요.' },
    slots: [
      { fork: 'f1', keys: ['f1'], focus: 'dorm', say: '11시에 수업 끝나는데 오전에 꼭 빨아야 돼요. 3층이랑 4층 중에 어디로 가면 돼요?', after: '오케이, 고마워요!',
        opts: [
          { t: '3층으로 가세요. 3층은 돼요', ok: '제외', pic: 'scene-tape', title: '3층 문 앞의 태오', line: '문에 노란 테이프가 X자로 붙어 있다. 바구니를 든 태오에게서 문자가 온다. 「여기 막혔는데요…?」' },
          { t: '4층으로 가세요. 4층은 돼요', ok: '한함', pic: 'scene-tape', title: '4층 문 앞의 태오', line: '문에 노란 테이프가 X자로 붙어 있다. 바구니를 든 태오에게서 문자가 온다. 「여기 된다면서요…」' },
          { t: '다 막혔어요. 오후 1시까지 기다리세요', ok: null, pic: 'scene-busy', title: '세탁기는 돌아가고 있었다', line: '오후 1시, 태오가 세탁기 도는 소리를 듣고 멈춰 선다. 「오전에 됐잖아요…」' },
        ] },
      { fork: 'f2', keys: ['f2'], focus: 'dorm', say: { by: 'f1', 제외: '아 맞다, 제 수건은요? 오늘 아침 8시에 4층 세탁기에 넣어 놓고 10시인 지금까지 안 찾아갔어요.', 한함: '아 맞다, 제 수건은요? 오늘 아침 8시에 3층 세탁기에 넣어 놓고 10시인 지금까지 안 찾아갔어요.' }, after: { 보관: '휴, 다행이다.', 폐기: '아… 알았어요 ㅠㅠ' },
        opts: [
          { t: '관리실에 있을 거예요. 가서 달라고 하세요', ok: '보관', pic: 'scene-trash', title: '「그 빨래요?」', line: '관리실 아저씨: 「안내대로 아침에 다 버렸는데요.」 태오: 「제 수건…」' },
          { t: '없을 거예요. 새로 사셔야 될 것 같아요', ok: '폐기', pic: 'scene-new', title: '새 수건을 사 온 태오', line: '그날 저녁, 관리실에서 문자가 온다. 「수건 찾아가세요~」 태오: 「…?????」' },
          { t: '세탁기 안에 그대로 있을 거예요', ok: null, pic: 'scene-drum', title: '텅 빈 세탁기', line: '태오가 세탁기 문을 열어 본다. 아무것도 없다.' },
        ] },
    ],
    // 정정: 앞에서 푼 f2 자리에 쪽지가 붙는다. flips = 앞 답이 뒤집히나.
    patches: {
      보관: { after: 'f2', line: '찾아가지 않은 빨래는 금요일까지 관리실에서 [[보관]]한 뒤 [[폐기]]합니다.', key: '폐기', flips: false, say: '방금 공지 바뀌었다던데요? 저 토요일에 찾으러 가도 돼요?', after_say: '금요일까지군요. 오늘 바로 찾을게요!',
        opts: [
          { t: '안 돼요. 금요일까지 찾으셔야 돼요', ok: true },
          { t: '돼요. 토요일에도 관리실에 있대요', ok: false, pic: 'scene-trash', title: '토요일의 관리실', line: '관리실 아저씨: 「금요일까지였는데요. 어제 다 버렸어요.」' },
          { t: '안 돼요. 오늘까지 찾으셔야 돼요', ok: false, pic: 'scene-new', title: '달려온 태오', line: '수업을 빠지고 온 태오에게 아저씨가 말한다. 「금요일까지 괜찮은데요?」' },
        ], win: '금요일까지 찾으면 된다', react: '태오: 「진짜 잘 읽네요. 오늘 저녁은 제가 살게요.」' },
      폐기: { after: 'f2', line: '찾아가지 않은 빨래는 [[폐기]]하지 않고 금요일까지 관리실에서 [[보관]]합니다.', key: '보관', flips: true, say: '방금 공지 바뀌었다던데요? 그럼 제 수건은 어떻게 돼요?', after_say: '살았다 ㅠㅠㅠ',
        opts: [
          { t: '관리실에 있대요. 금요일까지 찾으세요', ok: true },
          { t: '관리실에 있대요. 다음 주에 찾아도 돼요', ok: false, pic: 'scene-trash', title: '다음 주의 관리실', line: '관리실 아저씨: 「금요일까지였는데요. 이제 없어요.」' },
          { t: '이제 없대요. 새로 사셔야 돼요', ok: false, pic: 'scene-new', title: '새 수건을 또 산 태오', line: '그날 저녁, 관리실에서 문자가 온다. 「수건 찾아가세요~」 태오: 「…?????」' },
        ], win: '태오의 수건이 살았다', react: '태오: 「없었으면 새로 살 뻔했어요. 오늘 저녁은 제가 살게요.」' },
    },
    outcome: () => 'done',   // 정정 쪽지 뒤에는 어느 조합이든 수건을 찾는다(폐기 조합도 쪽지로 뒤집힌다)
    ask: 'f1',
  },
  {
    id: 'festival', board: 'board-festival', crop: 'cover|50% 50%', where: { ko: '학생회관 1층', en: 'Student Union, 1F', mn: 'Оюутны төв, 1-р давхар' }, when: { ko: '화 오후 4:40', en: 'Tue 4:40 PM', mn: 'Мягмар, 16:40' }, hero: 'scene-win2',
    title: { ko: '축제 포스터', en: 'Festival poster', mn: 'Наадмын зурагт хуудас' },
    forks: { f1: ['선착순', '사전 접수'], f2: ['연기', '취소'] },
    notices: [
      { id: 'poster', style: 'n-fest', org: '제12회 새솔 가을 축제', title: '솔빛제', lines: [{ big: '떡볶이 무료 나눔' }, { key: 'f1' }, { big: '밤 공연 「솔빛 콘서트」' }, '같은 날 저녁 7시 · 대운동장'] },
      { id: 'council', style: 'n-paper n-small', org: '총학생회 알림', title: '솔빛 콘서트 안내', lines: [{ key: 'f2' }] },
    ],
    variants: {
      선착순: '11월 12일(목) 낮 12시 · 대운동장 · [[선착순]] 200명',
      '사전 접수': '11월 12일(목) 낮 12시 · 대운동장 · [[사전 접수]] 200명',
      연기: '[[우천 시]] 12일 밤 공연을 [[연기]]합니다.',
      취소: '[[우천 시]] 12일 밤 공연을 [[취소]]합니다.',
    },
    scraps: [{ text: '원룸 급매', sub: '정문 걸어서 5분', fringe: true }, { text: '에어팟 한쪽 주웠어요', sub: '학생회실로 오세요' }, { text: '기타 동아리 새 회원 모집' }],
    open: { first: '학생회관 게시판 앞이죠? 저 지금 수업 중이라 못 가요. 축제 포스터 좀 봐 줘요.', done: '수건 찾았어요 ㅋㅋ 고마워요. 이번엔 축제 포스터 좀 봐 줘요. 저 지금 수업 중이에요.' },
    slots: [
      { fork: 'f1', keys: ['f1'], focus: 'poster', say: '목요일 떡볶이 공짜래요! 저 수업이 1시에 끝나는데, 그때 가도 받을 수 있어요?', after: { 선착순: '오케이, 부탁해요!', '사전 접수': '앗, 저 아직 안 했어요. 지금 할게요!' },
        opts: [
          { t: '1시면 없을 수도 있어요. 제가 일찍 가서 줄 설게요', ok: '선착순', pic: 'scene-rope', title: '혼자 선 줄', line: '11시 반부터 아무도 없는 운동장에 섰다. 12시, 사회자: 「신청하신 분 이름 부를게요!」 내 이름은 없다.' },
          { t: '신청한 사람만 받아요. 선배는 신청했어요?', ok: '사전 접수', pic: 'scene-council', title: '신청할 곳이 없다', line: '학생회실 문이 닫혀 있다. 그사이 운동장 줄은 벌써 저 끝까지 갔다. 태오: 「신청 안 받는대요…」' },
          { t: '1시부터 나눠 준대요. 딱 맞네요', ok: null, pic: 'scene-pot', title: '빈 냄비', line: '1시 반, 대운동장. 냄비가 비어 있다. 아주머니: 「오늘 준비한 거 다 나갔어요~」' },
        ] },
      { fork: 'f2', keys: ['우천 시', 'f2'], focus: 'council', say: '근데 목요일에 비 온대요. 밤 콘서트는 어떻게 돼요?', after: { 연기: '아, 그럼 기다려야겠네요.', 취소: '아깝다… 알았어요.' },
        opts: [
          { t: '다른 날 한대요. 날짜 나오면 같이 가요', ok: '연기', pic: 'scene-wait', title: '사흘째 묻는 태오', line: '태오: 「콘서트 날짜 나왔어요?」 사흘째다. 학생회 글을 다시 보니 그 공연은 이제 없다.' },
          { t: '안 한대요. 올해 콘서트는 못 봐요', ok: '취소', pic: 'scene-concert', title: '놓친 콘서트', line: '다음 주 목요일 밤, 멀리서 음악 소리가 들린다. 태오: 「…오늘 하는 거였어요?」' },
          { t: '비 와도 그냥 한대요. 우산 챙기세요', ok: null, pic: 'scene-rain', title: '비 오는 대운동장', line: '무대에 불이 꺼져 있다. 우산을 쓴 태오와 나뿐이다. 태오: 「…여기 맞아요?」' },
        ] },
    ],
    patches: {
      연기: { after: 'f2', line: '공연은 11월 19일(목)로 [[연기]]합니다. 19일에도 비가 오면 [[취소]]합니다.', key: '취소', flips: false, say: '공지 또 붙었다면서요? 19일에도 비 오면 어떻게 돼요?', after_say: '그럼 19일에는 날씨부터 봐야겠네요!',
        opts: [
          { t: '그럼 못 봐요. 19일이 마지막이에요', ok: true },
          { t: '그럼 26일로 또 미룬대요. 그때 가요', ok: false, pic: 'scene-wait', title: '26일을 기다린 태오', line: '태오: 「26일에 몇 시예요?」 학생회 글을 다시 보니 그 공연은 이제 없다.' },
          { t: '그래도 19일에 한대요. 우산 챙기세요', ok: false, pic: 'scene-rain', title: '또 비 오는 대운동장', line: '19일 밤, 무대에 불이 꺼져 있다. 태오: 「…오늘도요?」' },
        ], win: '19일 밤, 날씨만 맑으면', react: '태오: 「비 오면 어떻게 되는지까지 챙겨 주네요. 19일에 같이 가요.」' },
      취소: { after: 'f2', line: '비 예보로 12일 밤 공연을 11월 19일(목)로 [[연기]]합니다.', key: '연기', flips: true, say: '방금 공지 바뀌었다던데요? 콘서트 아예 못 보는 거예요?', after_say: '대박, 19일에 같이 가요!',
        opts: [
          { t: '볼 수 있어요. 19일에 같이 가요', ok: true },
          { t: '볼 수 있어요. 12일에 그대로 해요', ok: false, pic: 'scene-rain', title: '비 오는 대운동장', line: '무대에 불이 꺼져 있다. 우산을 쓴 태오와 나뿐이다. 태오: 「…여기 맞아요?」' },
          { t: '못 봐요. 19일까지 기다려도 안 해요', ok: false, pic: 'scene-concert', title: '놓친 콘서트', line: '19일 밤, 멀리서 음악 소리가 들린다. 태오: 「…오늘 하는 거였어요?」' },
        ], win: '19일 밤, 콘서트 간다', react: '태오: 「안 읽었으면 그냥 포기할 뻔했어요. 19일에 같이 가요.」' },
    },
    outcome: () => 'done',
    ask: 'f1',
  },
  {
    id: 'season', board: 'board-dept', crop: 'cover|50% 50%', where: { ko: '인문관 2층', en: 'Humanities Hall, 2F', mn: 'Хүмүүнлэгийн байр, 2-р давхар' }, when: { ko: '월 오후 1:15', en: 'Mon 1:15 PM', mn: 'Даваа, 13:15' }, hero: 'scene-winter-win',
    title: { ko: '계절학기 공지', en: 'Winter term notice', mn: 'Өвлийн сургалтын зарлал' },
    forks: { f1: ['필수', '권장'], f2: ['불가', '가능'] },
    notices: [
      { id: 'dept', style: 'n-paper', org: '한국어문학과 알림', no: '11월 23일', title: '겨울 계절학기 안내', lines: [{ key: 'f1' }, '· 온라인 수강 정정: 11월 30일(월) ~ 12월 4일(금)', { key: 'f2' }], foot: '학과 사무실' },
    ],
    variants: {
      필수: '· 「대학 영어」: 졸업 [[필수]] 과목',
      권장: '· 「대학 영어」: 수강 [[권장]] 과목',
      불가: '· 정정 기간 이후에는 학과 사무실에서 변경 [[불가]]',
      가능: '· 정정 기간 이후에는 학과 사무실에서 변경 [[가능]]',
    },
    scraps: [{ text: '겨울방학 기숙사 신청', sub: '관리실로 문의', fringe: true }, { text: '과외 구합니다', sub: '수학 · 영어' }, { text: '우산 놓고 가신 분 찾아가세요' }],
    open: { first: '인문관 2층 지나가요? 학과 게시판에 계절학기 공지 붙었대요. 좀 봐 줘요.', done: '콘서트 잘 다녀왔어요 ㅋㅋ 근데 저 겨울 계절학기 들어야 하는데, 학과 게시판 좀 봐 줘요.' },
    slots: [
      { fork: 'f1', keys: ['f1'], focus: 'dept', say: '저 2월에 졸업인데 「대학 영어」 꼭 들어야 돼요? 겨울에 아르바이트 있어서요.', after: { 필수: '아이고… 알겠어요.', 권장: '오, 다행이다!' },
        opts: [
          { t: '네, 들으셔야 졸업할 수 있어요', ok: '필수', pic: 'scene-winter', title: '겨울이 통째로 사라졌다', line: '태오가 아르바이트까지 그만두고 겨울 내내 영어 강의실에 앉아 있었다. 「안 들어도 됐다고요?」' },
          { t: '아니요, 안 들으셔도 돼요', ok: '권장', pic: 'scene-gown', title: '졸업이 안 된다고요?', line: '2월, 학과 사무실에서 연락이 온다. 「대학 영어가 빠져서 졸업이 어렵겠는데요.」 태오: 「…네?」' },
          { t: '12월 4일까지만 들으시면 돼요', ok: null, pic: 'scene-winter', title: '빈 강의실의 태오', line: '12월 4일, 태오가 빈 강의실에 앉아 있다. 조교: 「그 날짜는 수강 정정 기간인데요?」' },
        ] },
      { fork: 'f2', keys: ['f2'], focus: 'dept', say: '시간표 아직 못 정했어요. 정정 기간 끝나고 다음 주에 바꿔도 돼요?', after: { 불가: '그럼 이번 주에 정해야겠네요.', 가능: '오, 그럼 천천히 정할게요.' },
        opts: [
          { t: '안 돼요. 금요일까지 정하셔야 돼요', ok: '불가', pic: 'scene-laptop', title: '밤새운 태오', line: '태오가 목요일 밤을 새워 시간표를 짰다. 그다음 주에 조교가 말한다. 「기간 지나도 사무실에서 바꿔 드리는데요?」' },
          { t: '돼요. 학과 사무실에 가서 바꾸세요', ok: '가능', pic: 'scene-office', title: '늦었습니다', line: '다음 주 월요일, 학과 사무실 앞. 불이 꺼져 있고 메일 답장이 온다. 「정정 기간이 지났습니다.」' },
          { t: '아직 못 바꿔요. 11월 30일부터예요', ok: null, pic: 'scene-wait', title: '「그게 아니라요…」', line: '태오가 다시 묻는다. 「그래서 기간 끝나고 바꿔도 돼요?」 물어본 건 그게 아니었다.' },
        ] },
    ],
    patches: {
      불가: { after: 'f2', line: '수강 정정 기간을 12월 11일(금)까지 [[연장]]합니다.', key: '연장', flips: true, say: '방금 공지 바뀌었다던데요? 그럼 12월 8일에 바꿔도 돼요?', after_say: '오, 일주일 벌었네요!',
        opts: [
          { t: '돼요. 11일까지 바꾸시면 돼요', ok: true },
          { t: '안 돼요. 12월 4일까지예요', ok: false, pic: 'scene-laptop', title: '밤새운 태오', line: '태오가 목요일 밤을 새워 시간표를 짰다. 다음 주 월요일에 조교가 말한다. 「11일까지 되는데요?」' },
          { t: '돼요. 12월 안에는 언제든 돼요', ok: false, pic: 'scene-office', title: '늦었습니다', line: '12월 14일 월요일, 학과 사무실 앞. 메일 답장이 온다. 「정정 기간이 지났습니다.」' },
        ], win: '일주일을 벌었다', react: '태오: 「이제 저보다 잘 읽네요 ㅋㅋ 다음에 커피 살게요.」' },
      가능: { after: 'f2', line: '정정 기간 이후의 변경은 한 사람당 한 번으로 [[제한]]합니다.', key: '제한', flips: false, say: '방금 공지 바뀌었다던데요? 그럼 기간 끝나고 두 번 바꿔도 돼요?', after_say: '그럼 한 번에 잘 정해야겠네요!',
        opts: [
          { t: '안 돼요. 한 번만 바꾸실 수 있어요', ok: true },
          { t: '돼요. 두 번까지는 바꾸실 수 있어요', ok: false, pic: 'scene-office', title: '두 번째는 안 됩니다', line: '두 번째 메일에 답장이 온다. 「변경은 한 번만 됩니다.」 태오: 「…네?」' },
          { t: '안 돼요. 기간 끝나면 한 번도 못 바꾸세요', ok: false, pic: 'scene-laptop', title: '밤새운 태오', line: '태오가 목요일 밤을 새워 시간표를 짰다. 다음 주 월요일에 조교가 말한다. 「기간 지나고 한 번은 되는데요?」' },
        ], win: '한 번은 바꿀 수 있다', react: '태오: 「이제 저보다 잘 읽네요 ㅋㅋ 다음에 커피 살게요.」' },
    },
    outcome: () => 'done',
    ask: 'f2',
  },
]);
