/* SYNK Workspace 다시 짓기 시안 — 다섯 시안이 함께 쓰는 예시 자료 (2026-11-24)
 * SNS 편 제목 · 표지는 실제 게시 준비 편에서 가져왔다. 사람 · 고객 · 대화는 예시다(실제 직원 · 고객 아님).
 * 화면은 이 값을 바꿔 상태를 보인다(승인 · 고르기 · 보내기). 새로고침하면 처음으로 돌아간다. */
window.WS = {
  now: { date: '2026-11-24', label: '11월 24일 화요일', time: '09:40' },

  me: { id: 'yuho', name: '유호', role: '대표 · 관리자', scope: '회사 넷 모두' },

  companies: [
    { id: 'LAB', name: 'LAB', ko: '한국어 수업', color: '#F96859', ink: '#1E0E0A', soft: '#FFB4A9', deep: '#AE322A',
      line: '외국인 한국어 수업과 나라별 SNS 레슨', scene: 'img/scene-room.jpg',
      metric: { value: 38, unit: '명', label: '이번 달 수강생' },
      sub: [ ['수업 중인 반', '3반'], ['오늘 나가는 편', '9편'], ['12월 반 신청', '10 / 12명'] ],
      blocked: '몽골 유튜브 오후 1시 편 자막 확인' },
    { id: 'SHIFT', name: 'SHIFT', ko: 'AI 강의', color: '#3D6BC9', ink: '#FFFFFF', soft: '#C5D6F5', deep: '#24448C',
      line: '기업 · 학교 AI 업무 강의', scene: 'img/scene-shift.jpg',
      metric: { value: 2, unit: '회', label: '이번 주 강의' },
      sub: [ ['다음 강의', '11.27 (금) 10:00'], ['신청 기관', '3곳'], ['강사', '1명'] ],
      blocked: null },
    { id: 'PULSE', name: 'PULSE', ko: '영상 제작', color: '#99295D', ink: '#FFFFFF', soft: '#F8C7DE', deep: '#6E1B42',
      line: 'AI 광고 · 홍보 영상 제작', scene: 'img/scene-pulse-studio.jpg',
      metric: { value: 3, unit: '건', label: '진행 중인 프로젝트' },
      sub: [ ['고객 확인 대기', '1건'], ['이번 주 납품', '1건'], ['새 문의', '2건'] ],
      blocked: '봄날 베이커리 2차 편집본 내부 확인' },
    { id: 'PATH', name: 'PATH', ko: '유학 · 정착 상담', color: '#526956', ink: '#FFFFFF', soft: '#D3E8BE', deep: '#3F6B2E',
      line: '유학 준비와 한국 정착 상담', scene: 'img/scene-path.jpg',
      metric: { value: 2, unit: '건', label: '오늘 상담' },
      sub: [ ['오늘 14:00', '비자 상담'], ['오늘 16:30', '정착 지원'], ['진행 중', '5명'] ],
      blocked: null }
  ],

  people: [
    { id: 'yuho', name: '유호', role: '대표', companies: ['LAB', 'SHIFT', 'PULSE', 'PATH'], status: '근무 중', work: '전체 운영 · SNS 승인' },
    { id: 'harin', name: '김하린', role: '한국어 강사', companies: ['LAB'], status: '수업 중', work: '몽골 반 · 12월 반 교재' },
    { id: 'bayar', name: '바야르', role: '몽골 SNS 담당', companies: ['LAB'], status: '근무 중', work: '몽골 인스타 · 유튜브 자막' },
    { id: 'soyeon', name: '이소연', role: '수업 운영', companies: ['LAB'], status: '근무 중', work: '신청 · 출석 · 학부모 안내' },
    { id: 'minjae', name: '정민재', role: 'PD', companies: ['PULSE'], status: '근무 중', work: '고객 프로젝트 셋 · 편집 확인' },
    { id: 'chaewon', name: '한채원', role: '편집', companies: ['PULSE'], status: '자리 비움', work: '광고 편집 · 자막' },
    { id: 'dohyun', name: '최도현', role: '촬영', companies: ['PULSE', 'LAB'], status: '근무 중', work: '스튜디오 촬영 · LAB 수업 영상' },
    { id: 'junho', name: '박준호', role: 'AI 강사', companies: ['SHIFT'], status: '외근', work: '기업 강의 · 강의 자료' },
    { id: 'yuna', name: '오유나', role: '유학 상담', companies: ['PATH'], status: '근무 중', work: '비자 · 입학 서류' },
    { id: 'azam', name: '아잠', role: '정착 지원', companies: ['PATH', 'LAB'], status: '근무 중', work: '집 구하기 · 은행 · 우즈베크 LAB' }
  ],

  /* 유호님 차례: SNS 검토 대기 23판 중 가까운 8판 */
  review: {
    total: 23,
    items: [
      { id: 'r1', company: 'LAB', account: '@synk.mn', country: '몽골', platform: '인스타그램', when: '오늘 13:00', whenSort: 1300,
        title: '조금만 더~ 「더 먹어」를 몽골어로', caption: '할머니가 밥을 더 퍼 줄 때 듣는 말. 「조금만 더~」는 정말 조금일까요?', cover: 'img/cover-lab-deomeogeo.jpg',
        checks: ['자막 검사 통과', '처음 보는 사람 이해 확인'], length: '18.2초' },
      { id: 'r2', company: 'LAB', account: '@synk.mn', country: '몽골', platform: '유튜브', when: '오늘 13:00', whenSort: 1301,
        title: '계세요? 「숙제님이 계셔?!」', caption: '「계세요」는 사람에게만 써요. 숙제에 높임말을 쓰면 생기는 일.', cover: 'img/cover-lab-gyeseyo.jpg',
        checks: ['자막 검사 통과', '번역 두 가지 — 확인 요청'], length: '21.4초', note: '바야르: 「숙제님」 번역을 두 가지로 넣었어요' },
      { id: 'r3', company: 'LAB', account: '@synk.mn', country: '몽골', platform: '틱톡', when: '오늘 17:00', whenSort: 1700,
        title: '싫어요! 거절하는 말', caption: '「싫어요」보다 부드럽게 거절하는 말 세 가지.', cover: 'img/cover-lab-geojeol.jpg',
        checks: ['자막 검사 통과', '처음 보는 사람 이해 확인'], length: '19.6초' },
      { id: 'r4', company: 'LAB', account: '@synk.mn', country: '몽골', platform: '인스타그램', when: '오늘 21:00', whenSort: 2100,
        title: '뜨거워! 「덥다」와 「뜨겁다」', caption: '날씨가 더울 때와 국이 뜨거울 때. 몽골어로는 한 낱말이에요.', cover: 'img/cover-lab-deopda.jpg',
        checks: ['자막 검사 통과', '처음 보는 사람 이해 확인'], length: '19.6초' },
      { id: 'r5', company: 'SYNK', account: '@synkbrief', country: '한국', platform: '인스타그램', when: '내일 13:00', whenSort: 2513,
        title: '내 이름과 아이디로 인터넷에 드러난 내 정보 찾기', caption: 'ChatGPT에 이 문장 하나로 내 정보가 어디까지 보이는지 확인해요.', cover: 'img/cover-brief-privacy.jpg',
        checks: ['화면 글 검사 통과'], length: '32초' },
      { id: 'r6', company: 'SYNK', account: '@synkbrief', country: '한국', platform: '유튜브', when: '내일 17:00', whenSort: 2517,
        title: '셀카 한 장을 프로필 사진으로 바꾸는 명령어', caption: '정장 · 흰 배경 · 자연광. 세 줄이면 됩니다.', cover: 'img/cover-brief-profile.jpg',
        checks: ['화면 글 검사 통과'], length: '28초' },
      { id: 'r7', company: 'SYNK', account: '@yuhobuilds', country: '한국', platform: '인스타그램', when: '내일 21:00', whenSort: 2521,
        title: '작업 파일 1,046개를 30초에 골라내기', caption: '내가 고른 작품 3편의 파일이 20.97GB 안에 섞여 있었어요.', cover: 'img/cover-builds-space.jpg',
        checks: ['화면 글 검사 통과'], length: '24초' },
      { id: 'r8', company: 'SYNK', account: '@yuhobuilds', country: '한국', platform: '유튜브', when: '11.26 (목) 13:00', whenSort: 2613,
        title: '1화 · 2화 · 3화 세 장 다 꼭지', caption: '토마토 꼭지 하나로 세 화를 잇는 법.', cover: 'img/cover-builds-tomato.jpg',
        checks: ['화면 글 검사 통과'], length: '26초' }
    ]
  },

  /* 텔레그램으로 공유하신 게시물 중 시안이 나온 것 */
  tips: [
    { id: 't1', date: '11월 19일', area: 'SNS 영상', title: '소용돌이 한가운데 선 기사, 카메라가 칼을 따라 떨어지는 한 컷',
      take: 'Higgsfield 둘째 편의 두 군대 소용돌이 8초를 「한가운데로 떨어져 창 자루에 닿는」 한 컷으로 바꾼다.' },
    { id: 't2', date: '11월 11일', area: '홈페이지', title: '두 색에 포인트 색 하나 — 가장 중요한 자리에만',
      take: '산호색이 열 곳에 칠해진 아틀라스 칸을, 놓친 답 → 고른 것 → 바뀐 과제 네 곳으로 모은다.' },
    { id: 't3', date: '11월 3일', area: 'PULSE 영상', title: '집 고양이의 바깥 생활을 누아르로',
      take: '6초 안팎 멀티샷 아홉, 같은 고양이 셋을 끝까지. 한국판 「집에선 냥이, 밖에선 두목」.' },
    { id: 't4', date: '11월 1일', area: '영상 모션', title: '사람 뒤로 들어가는 글자 · 카드',
      take: 'SAM 3 사람 마스크와 Remotion으로 크레딧 없이. 창가 역광 · 얕은 심도 · 낮은 채도.' }
  ],

  /* 오늘 나가는 SNS(14편) 가운데 시각별 */
  going: [
    { time: '13:00', count: 3, line: 'LAB 몽골 인스타 · 유튜브, 우즈베크 텔레그램' },
    { time: '17:00', count: 4, line: 'LAB 몽골 틱톡, 캄보디아 틱톡, VK, RUTUBE' },
    { time: '21:00', count: 7, line: 'LAB 몽골 인스타 외 6편' }
  ],

  /* 오늘 하루 시간표 */
  timeline: [
    { time: '06:00', end: '06:20', kind: 'auto', company: null, title: '회사 이미지 묶음 배포', state: 'done', note: '오류 없이 끝남' },
    { time: '09:00', end: '09:30', kind: 'auto', company: null, title: '트렌드 수집', state: 'done', note: '새 제작 양식 10개' },
    { time: '11:30', end: '12:00', kind: 'auto', company: null, title: '참고 카드 시안 회차', state: 'next', note: '공유 게시물 시안 1장' },
    { time: '12:30', end: '12:45', kind: 'me', company: 'LAB', title: '몽골 유튜브 자막 확인', state: 'me', note: '바야르가 요청 · 마감 12:30' },
    { time: '13:00', end: '13:10', kind: 'sns', company: 'LAB', title: 'SNS 3편 나감', state: 'wait', note: '그중 2편 승인 필요' },
    { time: '14:00', end: '15:00', kind: 'meet', company: 'PATH', title: '우즈베크 학생 비자 상담', state: 'wait', note: '오유나' },
    { time: '14:00', end: '14:30', kind: 'auto', company: null, title: '게시 회차', state: 'wait', note: '승인한 판을 겁니다' },
    { time: '16:30', end: '17:30', kind: 'meet', company: 'PATH', title: '정착 지원 · 집 계약 동행', state: 'wait', note: '아잠' },
    { time: '17:00', end: '17:10', kind: 'sns', company: 'LAB', title: 'SNS 4편 나감', state: 'wait', note: '' },
    { time: '21:00', end: '21:10', kind: 'sns', company: 'LAB', title: 'SNS 7편 나감', state: 'wait', note: '' }
  ],

  /* 메신저 */
  channels: [
    { id: 'all', name: '전체 공지', kind: 'room', unread: 0, members: 10 },
    { id: 'lab', name: 'LAB 수업방', kind: 'room', company: 'LAB', unread: 3, members: 6 },
    { id: 'pulse', name: 'PULSE 제작방', kind: 'room', company: 'PULSE', unread: 1, members: 4 },
    { id: 'path', name: 'PATH 상담방', kind: 'room', company: 'PATH', unread: 0, members: 3 },
    { id: 'shift', name: 'SHIFT 강의방', kind: 'room', company: 'SHIFT', unread: 0, members: 2 },
    { id: 'dm-harin', name: '김하린', kind: 'dm', person: 'harin', unread: 1 },
    { id: 'dm-minjae', name: '정민재', kind: 'dm', person: 'minjae', unread: 0 },
    { id: 'me', name: '나에게', kind: 'dm', person: 'yuho', unread: 0 }
  ],
  messages: {
    lab: [
      { who: 'harin', at: '09:12', text: '내일 몽골 반 수업 자료 올렸어요. 「계세요」 편 대사로 연습 문제 세 개 만들었습니다.' },
      { who: 'bayar', at: '09:20', text: '몽골 유튜브 오후 1시 편 자막 확인 부탁드려요. 「숙제님」 번역을 두 가지로 넣었어요.', task: { title: '자막 확인', owner: '유호', due: '오늘 12:30' } },
      { who: 'soyeon', at: '09:31', text: '12월 반 신청이 5명 더 들어왔어요. 정원 12명 중 10명입니다.' }
    ],
    pulse: [
      { who: 'minjae', at: '08:55', text: '봄날 베이커리 30초 광고 2차 편집본 올렸어요. 고객에게 보내기 전에 한 번 봐 주세요.', file: '봄날베이커리_30s_v2.mp4 · 42MB' }
    ],
    all: [
      { who: 'yuho', at: '어제 18:02', text: '12월 1일부터 LAB 겨울 반이 열립니다. 반별 담당은 사람 화면에서 확인해 주세요.' }
    ],
    path: [
      { who: 'yuna', at: '어제 17:40', text: '내일 14시 비자 상담 학생 서류 다 받았어요.' }
    ],
    shift: [
      { who: 'junho', at: '11.22 15:10', text: '27일 강의 자료 초안 올렸습니다. 실습은 세 개로 줄였어요.' }
    ],
    'dm-harin': [
      { who: 'harin', at: '08:40', text: '대표님, 12월 반 교재 표지 두 가지 중 하나 골라 주실 수 있을까요?' }
    ],
    'dm-minjae': [
      { who: 'minjae', at: '어제 20:10', text: '고양이 누아르 시안 재밌네요. PULSE 채널 첫 편으로 해 볼까요?' }
    ],
    me: [
      { who: 'yuho', at: '11.22 23:05', text: 'PATH 상담 화면에 서류 체크 칸 넣기' }
    ]
  },

  /* PULSE 고객 프로젝트(예시) */
  projects: [
    { id: 'p1', client: '봄날 베이커리', title: '30초 매장 광고', stage: '2차 편집', next: '내부 확인 뒤 고객에게', owner: 'minjae', due: '11.26' },
    { id: 'p2', client: '한빛 어학원', title: '학원 홍보 영상 60초', stage: '기획', next: '콘티 확정', owner: 'minjae', due: '12.03' },
    { id: 'p3', client: '모아 카페', title: '인스타 릴스 세 편', stage: '촬영 준비', next: '촬영 11.28', owner: 'dohyun', due: '12.05' }
  ],

  /* 운영 상태 */
  health: [
    { label: '예약 문제', value: '0건', ok: true },
    { label: '멈춘 게시물', value: '0개', ok: true },
    { label: '연결된 SNS 계정', value: '44 / 59', ok: true },
    { label: '다시 로그인할 계정', value: '카카오 · Pinterest', ok: false }
  ],

  /* 만들기(작업실) */
  make: {
    templates: 197, newToday: 10,
    drafts: [
      { title: 'LAB 우즈베크 「아까워」', stage: '콘티', updated: '어제' },
      { title: 'synkbrief 「회의록 요약 명령어」', stage: '대본', updated: '11.22' }
    ]
  },

  /* 화면 이동: 다섯 시안이 같은 메뉴를 쓴다 */
  nav: [
    { id: 'today', label: '오늘' },
    { id: 'messenger', label: '메신저' },
    { id: 'sns', label: 'SNS' },
    { id: 'make', label: '만들기' },
    { id: 'people', label: '사람' },
    { id: 'company', label: '회사', children: ['LAB', 'SHIFT', 'PULSE', 'PATH'] },
    { id: 'admin', label: '관리' }
  ]
};
