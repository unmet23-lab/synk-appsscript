// PULSE 고객 앱 다시 짓기 시안 공통 — 예시 자료, 화면 넘기기, 입장 · 고르기 · 의뢰 조작.
// 모델 영상과 완성 광고는 synk.im 공개본을 그대로 부른다. 방의 장면 이미지는 ./assets/cut-0N.webp(캐스팅북 소개 영상에서 뽑음).

const CAST = 'https://synk.im/pulse/casting/';
const FILM = 'https://synk.im/assets/v10/';

// 캐스팅북 모델 21명 가운데 실제 인물(M03)을 뺀 20명. 이름과 한 줄은 캐스팅북 공개본 그대로.
export const MODELS = [
  ['F02', '하린', 'Harin', '상큼한 막내', '165cm · 20대 초반'],
  ['M01', '이안', 'Ian', '책 읽는 남자친구', '182cm · 20대 중반'],
  ['F01', '유나', 'Yuna', '도시의 뮤즈', '168cm · 20대 중반'],
  ['F03', '서진', 'Seojin', '똑 부러진 선배', '170cm · 20대 후반'],
  ['M02', '태준', 'Taejun', '위스키가 어울리는 남자', '184cm · 30대 중반'],
  ['F04', '지유', 'Jiyu', '맑은 새내기', '166cm · 20대 초반'],
  ['F05', '소연', 'Soyeon', '믿고 사는 언니', '162cm · 30대 중반'],
  ['M04', '민재', 'Minjae', '옆집 자취생', '175cm · 20대 후반'],
  ['F06', '은정', 'Eunjeong', '관리 잘한 40대', '160cm · 40대 중반'],
  ['F07', '채원', 'Chaewon', '운동하는 언니', '167cm · 20대 중반'],
  ['M05', '준호', 'Junho', '믿음직한 생활형', '177cm · 30대 후반'],
  ['M06', '한결', 'Hangyeol', '청량한 운동부 후배', '178cm · 20대 초반'],
  ['F08', '윤슬', 'Yunseul', '반달 웃음의 믿음직한 리더', '164cm · 20대 초반'],
  ['F09', '로하', 'Roha', '바이올렛빛 우아한 비주얼', '169cm · 20대 초반'],
  ['F10', '새봄', 'Saebom', '통통 튀는 애플 그린 막내', '160cm · 20대 초반'],
  ['F11', '해인', 'Haein', '맑은 블론드의 상큼한 리드보컬', '167cm · 20대 초반'],
  ['M07', '도현', 'Dohyeon', '믿음직한 눈웃음 리더', '182cm · 20대 초반'],
  ['M08', '하람', 'Haram', '햇살 같은 메인댄서', '177cm · 20대 초반'],
  ['M09', '서율', 'Seoyul', '블루 그레이빛 차가운 비주얼', '180cm · 20대 초반'],
  ['M10', '지온', 'Jion', '장난기 가득 래퍼 막내', '175cm · 20대 초반'],
].map(([id, name, en, line, meta]) => ({
  id, name, en, line, meta, kind: 'model',
  video: `${CAST}video/${id}-loop.mp4`,   // 720×960, 4초
  tall: `${CAST}img/${id}/wall.webp`,     // 720×1280
  face: `${CAST}img/${id}/hero-s.webp`,   // 538×720
}));
export const modelById = id => MODELS.find(m => m.id === id);

// 완성 광고(synk.im/pulse 공개본의 이름과 길이 그대로).
export const FILMS = [
  { id: 'himkkeot', name: '힘껏 블랙프라이데이 세일', len: '15초', tall: true, video: `${FILM}pulse-film-himkkeot-20261109c.mp4`, poster: `${FILM}pulse-film-himkkeot-20261109.webp` },
  { id: 'omitok15', name: '오미톡 「치익이 톡이 될 때까지」', len: '15초', tall: true, video: `${FILM}pulse-film-omitok15-20261117.mp4`, poster: `${FILM}pulse-film-omitok15-20261109.webp` },
  { id: 'modu', name: '모두의코스 「가는 데마다 또 그 사람」', len: '39초', tall: true, video: `${FILM}pulse-film-modu-20261117.mp4`, poster: `${FILM}pulse-film-modu-20261109.webp` },
  { id: 'pet', name: '첨벙댕', len: '26초', tall: true, video: `${FILM}pulse-film-pet-20261117.mp4`, poster: `${FILM}pulse-film-pet-20261117.webp` },
  { id: 'shimo', name: '홀리데이 기프트 「霜の肌理」', len: '15초', tall: true, video: `${FILM}pulse-film-shimo-20261109c.mp4`, poster: `${FILM}pulse-film-shimo-20261106.webp` },
  { id: 'omitok1', name: '오미톡 제품 광고', len: '13초', tall: true, video: `${FILM}pulse-film-omitok1-20261109c.mp4`, poster: `${FILM}pulse-film-omitok1-20261109.webp` },
  { id: 'casting', name: '캐스팅북 「손님을 부르는 모델」', len: '30초', tall: false, video: `${FILM}pulse-film-casting-20261109c.mp4`, poster: `${FILM}pulse-film-casting-20261109.webp` },
  { id: 'somchae', name: '솜채 「연말 빈방」', len: '1분', tall: false, video: `${FILM}pulse-film-somchae-20261109c.mp4`, poster: `${FILM}pulse-film-somchae-20261109.webp` },
  { id: 'maejin', name: '「매진 임박」', len: '1분 15초', tall: false, video: `${FILM}pulse-film-maejin-20261109c.mp4`, poster: `${FILM}pulse-film-maejin-20261109c.webp` },
].map(f => ({ ...f, kind: 'film' }));

// 모델 띠에 완성 광고를 섞는다: 모델 셋마다 세로 광고 하나.
export function mixedRow() {
  const tall = FILMS.filter(f => f.tall);
  const out = [];
  MODELS.forEach((m, i) => { out.push(m); if (i % 3 === 2 && tall.length) out.push(tall.shift()); });
  return out;
}

// 예시 프로젝트. 값은 고객 앱의 실제 칸 이름과 패키지(15초 · 10일 · 수정 2회 · 6컷)를 따른다.
export const PROJECT = {
  brand: '카페 온기', title: '딸기 라떼 신메뉴', no: 'P-1124-ON07',
  channel: '매장 화면 · 행사', ratio: '16:9', pkg: '15초 한 편', terms: '10일 · 수정 2회', price: '29만원',
  // 받으실 날: 결제(글 콘티 확인 뒤) 전에는 날짜가 없다(room-view.mjs 방향 제안의 「결제한 날부터 N일」).
  dueBefore: '결제한 날부터 10일', due: '12월 1일 화요일', cast: 'F02', staff: '김하늘', director: '유호',
};
export const STAGES = ['의뢰서', '담당자 검토', '영상 전 확인', '제작', '영상 · 납품'];
export const CHECKS = ['방향과 모델', '한 문장과 글 콘티', '장면 이미지'];

// 방향 두 안(영상 전 확인 1/3). 추천은 첫째.
export const DIRECTIONS = [
  { id: 'poster', name: '포스터를 보고 온 손님', line: '창문에 붙은 모델 포스터를 본 손님이 문을 열고 들어와 같은 딸기 라떼를 시켜요.', pick: true },
  { id: 'pour', name: '따르는 순간 하나', line: '우유가 딸기 위로 번지는 3초를 가장 크게 보여 주고, 끝에 모델이 한 모금 마셔요.' },
];
// 방향 제안에 함께 오는 값(room-view.mjs 방향 카드: 값 · 받으실 날 · 수정 횟수).
export const OFFER = '29만원 · 결제한 날부터 10일 · 수정 2회';
// 하린의 옷 · 머리(casting-catalog.mjs F02). 고르지 않으면 「맡김」(결정 11-10 — 기본은 담당자에게 맡기기).
export const KEEP = '맡김';
export const LOOKS = [
  { id: 'base', name: '기본 옷', src: `${CAST}img/F02/fullbody-s.webp` },
  { id: 'look1', name: '파스텔 캐주얼', src: `${CAST}img/F02/look-1-s.webp` },
  { id: 'look2', name: '스트라이프 원피스', src: `${CAST}img/F02/look-2-s.webp` },
];
export const HAIRS = [
  { id: 'base', name: '어깨 길이 레이어드', src: `${CAST}img/F02/hero-s.webp` },
  { id: 'hair2', name: '하이 포니테일', src: `${CAST}img/F02/hair-2-s.webp` },
  { id: 'hair3', name: '긴 웨이브', src: `${CAST}img/F02/hair-3-s.webp` },
];

// 장면 이미지 여섯 컷(15초 · 6컷).
export const CUTS = [
  { no: '01', sec: 2, src: './assets/cut-01.webp', what: '아침, 손님 없는 카페. 사장님이 휴대폰을 본다.' },
  { no: '02', sec: 2, src: './assets/cut-02.webp', what: '하린 사진이 찍힌 종이가방이 가게 앞을 지나간다.' },
  { no: '03', sec: 3, src: './assets/cut-03.webp', what: '지나가던 두 사람이 창문의 하린 포스터 앞에 멈춘다.' },
  { no: '04', sec: 2, src: './assets/cut-04.webp', what: '골목 가로등에 걸린 하린 배너.' },
  { no: '05', sec: 3, src: './assets/cut-05.webp', what: '딸기 위로 우유가 번진다.' },
  { no: '06', sec: 3, src: './assets/cut-06.webp', what: '포스터를 보고 온 손님에게 딸기 라떼를 건넨다.' },
];

// 담당자와 나눈 말(최근 것이 아래). 방마다 그 단계까지의 말만 보인다.
const T_REQ = [
  { who: 'me', at: '11월 21일 10:12', text: '포스터는 가게 창문에 붙은 느낌이면 좋겠어요.' },
  { who: 'staff', at: '11월 21일 10:40', text: '네, 방향 안을 만들 때 반영할게요.' },
];
export const TALK = {
  pick: [...T_REQ, { who: 'staff', at: '오늘 09:05', text: '방향 두 안과 추천 모델이에요. 그대로 맡기셔도 되고, 바꾸고 싶은 것만 눌러 고르셔도 돼요.', news: true }],
  images: [...T_REQ,
    { who: 'staff', at: '11월 22일 15:20', text: '글 콘티 확인해 주셔서 고마워요. 결제가 확인되면 장면 이미지를 만들게요.' },
    { who: 'staff', at: '오늘 09:05', text: '장면 이미지 여섯 컷 올렸어요. 3번 창문 포스터는 말씀하신 대로 창 안쪽에 붙였어요.', news: true }],
};

// 보낸 의뢰서(고객 앱 요약 줄의 이름과 빈 칸 문구 그대로).
export const BRIEF = [
  ['광고할 것', '딸기 라떼 신메뉴 · 음료 · 식품'],
  ['올릴 곳', '매장 화면 · 행사'],
  ['길이 · 구성', '15초 · 한 편 · 29만원부터 · 10일 · 수정 2회'],
  ['모델', '추천해 주세요'],
  ['화면 글자', '제품 이름만 얹어요'],
  ['피할 말', '없음'],
  ['받은 자료', '파일 3개(제품 정면 · 옆면 · 로고)'],
];
export const briefHTML = () => `<dl class="brief">${BRIEF.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

// 길이 · 구성(request-data.mjs PACKAGES 값 그대로).
export const PACKAGES = [
  ['15초', '한 편 · 29만원부터 · 10일 · 수정 2회'],
  ['30초', '30초 + 15초 · 6초 편집본 · 59만원부터 · 14일 · 수정 3회'],
  ['60초', '브랜드 필름, 또는 같은 모델 시리즈 3편 · 149만원부터 · 21일 · 수정 3회'],
  ['기업', '기업 캠페인 · 250만원부터 · 기간 · 수정 협의'],
  ['사진', '모델이 제품을 든 사진 5장 · 9.9만원부터 · 3일 · 수정 2회'],
];
// 로그인 코드 안내(film-home.mjs 그대로).
export const CODE_SENT = '진행 중인 의뢰가 있으면 이 주소로 코드를 보냈어요. 메일의 여섯 자리를 넣어 주세요.';
// 의뢰를 보낸 뒤(room-view.mjs check).
export const CHECK_COPY = { title: '지금은 저희 차례예요', text: '보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 방향 두 안을 보내 드려요.' };

// 의뢰서에서 먼저 받는 셋과 접어 두는 것들. 접힌 칸은 비워 두면 「추천대로」다.
export const ESSENTIALS = ['무엇을 광고하나요', '제품 사진', '올릴 곳'];
export const CHANNELS = ['릴스 · 쇼츠 · 틱톡', '유튜브 · 웹사이트', '상세페이지 · 자사몰', '매장 화면 · 행사'];
export const FOLDED = [
  { id: 'model', icon: 'person', name: '모델', rec: '추천해 주세요' },
  { id: 'length', icon: 'clock', name: '길이', rec: '저희가 제안해요' },
  { id: 'mood', icon: 'spark', name: '느낌', rec: '저희가 제안해요' },
  { id: 'text', icon: 'type', name: '화면 글자', rec: '제품 이름만 얹어요' },
  { id: 'avoid', icon: 'ban', name: '피할 말', rec: '없음' },
  { id: 'files', icon: 'clip', name: '자료 더', rec: '나중에 보내도 돼요' },
];

// 선 아이콘. 글자를 넣은 네모는 아이콘으로 쓰지 않는다.
const ICON = {
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/>',
  compass: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="m9 15 1.8-4.2L15 9l-1.8 4.2z"/>',
  shirt: '<path d="M8 4 4 6.5l1.8 3.3L8 9v11h8V9l2.2.8L20 6.5 16 4c-.6 1.4-2.1 2.3-4 2.3S8.6 5.4 8 4z"/>',
  hair: '<path d="M6 13c0-5 2.7-8 6-8s6 3 6 8"/><path d="M6 13c0 4 1 6 2 7M18 13c0 4-1 6-2 7"/><path d="M9 9c1.5.8 4.5.8 6-1"/>',
  clock: '<path d="M12 7v5l3 2"/><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0"/>',
  spark: '<path d="M12 3c.6 4 2 6.4 6 7-4 .6-5.4 3-6 7-.6-4-2-6.4-6-7 4-.6 5.4-3 6-7z"/>',
  type: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  ban: '<path d="M6 6l12 12"/><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0"/>',
  clip: '<path d="M15.5 7.5 8.6 14.4a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5l5.2-5.2"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="m3.5 16 5-5 4 4 3-3 5 5"/>',
  script: '<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h5"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  chat: '<path d="M4 6.5h16v10H10l-4 3v-3H4z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  back: '<path d="M20 12H5M10 7l-5 5 5 5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  wand: '<path d="m4 20 11-11M14 4v3M12.5 5.5h3M19 9v3M17.5 10.5h3M8 4v2M7 5h2"/><path d="m13 7 4 4"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));

// 영상: 보일 때만 튼다. 움직임 줄이기면 첫 그림만.
const seen = new IntersectionObserver(entries => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting && !reduced && v.dataset.auto !== 'off') { if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); }
    else v.pause();
  }
}, { threshold: 0.15 });
export function video(src, poster, { auto = true, cls = '' } = {}) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  if (poster) v.poster = poster;
  v.dataset.src = src;
  if (!auto) v.dataset.auto = 'off';
  if (cls) v.className = cls;
  seen.observe(v);
  return v;
}
export function playNow(v) { if (!v || reduced) return; if (!v.src && v.dataset.src) v.src = v.dataset.src; v.dataset.auto = 'on'; v.play().catch(() => {}); }
export function stopNow(v) { if (!v) return; v.dataset.auto = 'off'; v.pause(); }

// 소리: 누른 뒤에만 아주 작게.
let ctx;
function tone(freq, dur, gain = 0.04, type = 'sine') {
  try {
    ctx ||= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}
export const sound = {
  tick: () => tone(1800, 0.04, 0.02, 'square'),
  shutter: () => { tone(900, 0.05, 0.05, 'square'); setTimeout(() => tone(500, 0.08, 0.04, 'square'), 60); },
  soft: () => tone(660, 0.25, 0.03),
};

// 화면 넘기기: 주소 끝(#entry · #moment · #pick · #wait · #images · #request)로 화면을 고른다.
export function router(views, { first = 'entry' } = {}) {
  let cur = null;
  const show = async name => {
    if (!views[name]) name = first;
    if (cur === name) return;
    const prev = cur; cur = name;
    document.documentElement.dataset.screen = name;
    await views[name](prev);
    $$('.mock-bar [data-go]').forEach(a => a.setAttribute('aria-current', String(a.dataset.go === name)));
  };
  const go = name => { if (location.hash !== `#${name}`) history.pushState(null, '', `#${name}`); show(name); };
  addEventListener('popstate', () => show(location.hash.slice(1)));
  document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.dataset.go); } });
  show(location.hash.slice(1) || first);
  return go;
}

// 시안 조작 띠(손님 화면 밖).
export function mockBar(label) {
  const bar = document.createElement('nav');
  bar.className = 'mock-bar';
  bar.setAttribute('aria-label', '시안 화면 고르기');
  bar.innerHTML = `<a href="./">${label}</a><button data-go="entry">입장</button><button data-go="request">새 의뢰</button><button data-go="pick">방: 고르기</button><button data-go="images">방: 장면 도착</button>`;
  document.body.append(bar);
}

// 입장: 메일 → 여섯 자리 → 열림. 실제 앱과 같은 순서(가입 · 비밀번호 없음).
// 꼴: form[data-login] 안에 [data-step=email] · [data-step=code] 칸, [data-go-label], [data-msg].
export function bindLogin(form, onDone) {
  const email = $('input[name=email]', form), code = $('input[name=code]', form);
  const label = $('[data-go-label]', form), msg = $('[data-msg]', form);
  let step = 'email';
  const set = s => {
    step = s; form.dataset.step = s;
    $$('[data-step]', form).forEach(el => { el.hidden = el.dataset.step !== s; });
    if (label) label.textContent = s === 'email' ? '코드 받기' : '열기';
    if (msg) msg.textContent = s === 'code' ? CODE_SENT : '';
    (s === 'email' ? email : code)?.focus();
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (step === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { msg.textContent = '의뢰서에 적은 메일 주소를 넣어 주세요.'; email.focus(); return; }
      sound.tick(); set('code');
    } else {
      const v = code.value.replace(/\D/g, '');
      if (v.length !== 6) { msg.textContent = '메일에 온 숫자 여섯 자리를 넣어 주세요.'; code.focus(); return; }
      sound.shutter(); onDone();
    }
  });
  code?.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); if (code.value.length === 6) form.requestSubmit(); });
  $('[data-back]', form)?.addEventListener('click', () => set('email'));
  set('email');
  return { reset: () => { email.value = ''; if (code) code.value = ''; set('email'); } };
}

// 접힌 칸(아이콘) 열고 닫기. 꼴: [data-fold=id] 단추, [data-sheet=id] 판. 판 안의 [data-choose] 단추가 값을 고른다.
export function bindFolds(root, { onChange } = {}) {
  root._unfold?.();
  const close = () => { $$('[data-sheet]', root).forEach(s => { s.hidden = true; }); $$('[data-fold]', root).forEach(b => b.setAttribute('aria-expanded', 'false')); };
  const onClick = e => {
    const b = e.target.closest('[data-fold]');
    if (b) {
      const id = b.dataset.fold, sheet = $(`[data-sheet="${id}"]`, root), open = sheet?.hidden;
      close();
      if (sheet && open) { sheet.hidden = false; b.setAttribute('aria-expanded', 'true'); sound.tick(); $('button, input, textarea', sheet)?.focus({ preventScroll: true }); }
      return;
    }
    const c = e.target.closest('[data-choose]');
    if (c) {
      const sheet = c.closest('[data-sheet]'), id = sheet.dataset.sheet;
      $$('[data-choose]', sheet).forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      const fold = $(`[data-fold="${id}"]`, root);
      fold?.classList.add('is-set'); fold?.classList.remove('is-rec');
      const val = $(`[data-fold="${id}"] [data-val]`, root); if (val) val.textContent = c.dataset.choose;
      sound.tick(); onChange?.(id, c.dataset.choose, c);
      setTimeout(close, reduced ? 0 : 220);
      return;
    }
    if (e.target.closest('[data-sheet-close]')) close();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  root.addEventListener('click', onClick); addEventListener('keydown', onKey);
  root._unfold = () => { root.removeEventListener('click', onClick); removeEventListener('keydown', onKey); };
  return { close };
}
