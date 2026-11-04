// 시안 세 벌이 함께 쓰는 글. 첫 화면 글은 유호님 승인 원고(docs/마케팅/PULSE_소개글_20261103/README.md 5-1절, 앱 film-views.mjs)와 한 글자도 다르지 않게 둔다.
export const M = (p) => new URL('../media/' + p, import.meta.url).href;
export const HERO = {
  kicker: 'SYNK PULSE · AI 광고 제작',
  title: ['모든 컷을', '먼저 보여 드리는', 'AI 광고'],
  lead: '영상에 들어갈 모든 컷을 장면 이미지로 먼저 보여 드려요. AI 모델 21명 캐스팅, 제품·로고는 실제 파일로 합성해요.',
  start: '광고 의뢰하기',
  open: '받은 링크로 내 프로젝트 열기',
  demo: '예시 프로젝트',
  note: '상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.',
};
export const WORKS = {
  kicker: '완성 광고',
  title: 'SYNK가 끝까지 만든 광고예요',
  text: '가상 브랜드로 만든 자체 작품이에요. 새 작품은 완성되는 대로 더해요.',
  list: [
    { id: 'gift', name: '유리결', line: '홀리데이 기프트 · 15초', tag: '대표작', film: M('gift/film.mp4'), ratio: '9:16' },
    { id: 'maejin', name: '매진 임박', line: '홈쇼핑 × 공포 코미디', film: M('maejin/film.mp4'), loop: M('maejin/loop.mp4'), ratio: '16:9' },
  ],
};
export const CHECKS = {
  kicker: '이렇게 만들어요',
  title: '영상 전에 세 번 확인해요',
  text: '모델 고르기, 광고가 남길 한 문장과 글 콘티, 컷마다 장면 이미지.',
  three: ['모델 고르기', '광고가 남길 한 문장과 글 콘티', '컷마다 장면 이미지'],
};
export const PROMISES = [
  ['컷마다 장면 먼저', '대표 그림 한두 장이 아니라 들어갈 모든 컷을 완성 화질로 먼저 보여 드려요. 장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.'],
  ['출연자는 캐스팅', '이름과 얼굴이 정해진 AI 모델 21명 가운데 골라요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.'],
  ['제품·로고·화면 위 글자는 진짜로', '다시 그리지 않고 보내 주신 사진과 파일로 합성해, 글자가 뭉개지거나 로고가 바뀌지 않아요.'],
  ['무엇으로 남길지 먼저', '이야기로 여운을 남길지, 한 장면의 임팩트로 남길지 기획 첫 줄에 정해요.'],
  ['소리부터', '목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 못 나온 컷은 보정으로 덮지 않고 다시 만들어요.'],
];
export const STAGES = {
  title: '맡기면 이렇게 진행돼요',
  list: [
    ['의뢰서를 써요', '제품 이름, 올릴 곳, 사진 몇 장이면 돼요. 쓰는 동안 화면에서 어떻게 보일지 바로 보여 드려요.'],
    ['저희가 먼저 확인해요', '빠진 게 있으면 그 칸만 다시 여쭤요. 같은 말을 두 번 묻지 않아요. 진행과 값도 이때 안내해 드려요.'],
    ['1차안을 받아요', '모델, 광고가 남길 한 문장과 글 콘티, 모든 컷의 장면 이미지를 영상 전에 차례로 보여 드려요. 컷마다 의견을 남기세요.'],
    ['확인하신 컷으로 만들어요', '목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 제품 · 로고 · 글자는 실제 파일을 그대로 얹어요.'],
    ['파일을 받아요', '올릴 곳에 맞는 파일로 받아요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.'],
  ],
  after: '맡기신 뒤에는 초대 링크 하나로 시안을 보고 의견을 남기고, 최종 파일까지 한곳에서 받아요.',
  afterLink: '예시 프로젝트 체험하기',
};
export const MAKER = {
  kicker: '만드는 사람',
  title: '카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요',
  text: 'AI 광고가 어색해지는 곳은 대개 표정과 호흡, 말이 끝나는 타이밍이에요. SYNK PULSE는 배우로 활동한 대표 유호가 연출해요.',
  credits: ['넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연', 'tvN 「코미디빅리그」 코너 출연', '부활 「너의 모습」 뮤직비디오 주연'],
};
export const PRICES = { kicker: '값', list: [['15초 광고', '39만원부터'], ['30초 광고와 편집본', '89만원부터'], ['기업 캠페인', '250만원부터']] };
export const FOOT = { note: '앱을 설치하지 않아도 휴대폰과 컴퓨터에서 열려요. 영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.', creator: '제작자 공간', credit: '가상 브랜드로 만든 자체 작품의 장면이에요.' };

// 시안 확인: 옛 체험(?demo=gift) 자료 그대로. 실제 앱에서는 프로젝트 자료가 이 자리에 온다.
export const REVIEW = {
  project: '유리결 홀리데이 세트 15초 광고',
  oneLine: '서리꽃이 피는 순간을 담은 홀리데이 세트',
  owner: '김하늘',
  stage: '영상 확인',
  stages: ['의뢰서', '확인', '1차안', '제작', '영상 확인', '납품'],
  stageAt: 4,
  duration: 15,
  memo: '제품이 떠 있는 시간과 끝 장면을 중심으로 봐 주세요.',
  versions: [
    { id: 'v1', no: 1, label: '1차 시안', short: '1차', note: '', src: M('gift/v1.mp4'), sec: M('gift/sec1/') },
    { id: 'v2', no: 2, label: '2차 시안', short: '2차', note: '뚜껑 접사 더함', src: M('gift/v2.mp4'), sec: M('gift/sec2/') },
  ],
  scenes: [
    { no: 1, title: '결정이 자라요', text: '깜깜한 유리 위에서 눈 결정 하나가 자라요. 얼음에 금이 가는 작은 소리로 시작해요.', from: 0, to: 3 },
    { no: 2, title: '서리가 구슬을 덮어요', text: '카메라가 물러나면 결정은 유리구슬 겉에 붙어 있어요. 서리가 번지고 구슬 안에 앰플과 크림이 보여요.', from: 3, to: 6 },
    { no: 3, title: '깨지고, 멈춰요', text: '구슬이 깨지는 순간 소리가 사라지고 조각과 두 제품이 허공에 멈춰요. 카메라만 그 사이를 지나가요.', from: 6, to: 11 },
    { no: 4, title: '이름을 남겨요', text: '시간이 다시 흐르고 두 제품이 내려앉아요. 떨어진 결정이 뚜껑에 앉아 피어나고 이름이 떠요.', from: 11, to: 15 },
  ],
  notes: [
    { who: '체험 고객', mine: true, version: 'v1', at: 8, text: '떠 있는 시간이 길어요. 뚜껑 위 결정을 더 크게 보여 주세요.' },
    { who: '김하늘', mine: false, version: 'v2', at: 9, text: '제품이 떠 있는 시간을 5초에서 2초로 줄이고, 결정이 뚜껑에 피어나는 순간을 접사로 크게 보여 드려요.' },
  ],
  approve: {
    question: '이 시안으로 최종본을 만들까요?',
    hint: (label) => `「${label}」 그대로 괜찮으면 승인해 주세요. 바꿀 곳이 있으면 의견을 먼저 남겨 주세요.`,
    label: '이 시안 최종 승인',
    dialogTitle: '이 시안을 승인할까요?',
    dialogText: '이 시안의 내용과 표현을 확인했고, 이 시안대로 최종본을 만드는 데 동의합니다.',
    dialogNote: '승인한 시안과 시각은 기록에 남아요.',
    back: '다시 살펴보기',
    confirm: '확인했고 승인합니다',
    done: '승인했어요. 최종 파일을 준비해 드려요.',
    send: (n) => `의견 ${n}개 보내기`,
    sent: '보냈어요. 반영한 수정본이 오면 알려 드려요.',
  },
  changed: { from: 6, to: 13 },
  startAt: 10, // 달라진 곳 가운데 가장 또렷한 순간(결정이 뚜껑에 피어나요)부터 보여 준다.
  noteLabel: '이 순간에 남길 의견',
  notePlaceholder: '어떤 부분이 어떻게 바뀌면 좋을까요?',
  ask: '담당자에게 묻기',
  file: '파일 받기',
  disclaimer: '가상 브랜드로 만든 자체 작품으로 꾸민 예시예요.',
};
export const fmt = (s) => { const m = Math.floor(s / 60), r = Math.floor(s % 60), c = Math.floor((s % 1) * 100); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
export const fmtShort = (s) => `${String(Math.floor(s / 60)).padStart(1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 열린 창 안에서만 Tab이 돈다.
export const trapTab = (box) => box.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const list = [...box.querySelectorAll('a[href],button,input,[tabindex="0"]')].filter((el) => el.offsetParent !== null);
  if (!list.length) { e.preventDefault(); return; }
  const first = list[0], last = list.at(-1), now = document.activeElement;
  if (e.shiftKey && (now === first || now === box)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && now === last) { e.preventDefault(); first.focus(); }
});
