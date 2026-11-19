/* 혼자 열린 틀(부모 창에 SYNKFrontHost가 없을 때)의 가짜 host. 시안 10z6과 같은 주소 값으로 state를 짓는다.
 *   v=end|off|more|day2   dream=idol|actor   who=login|guest   lines=0~5   hangul=reads|new|ask|skip   lang=ko|en|mn
 *   mom=fix|ok|later   after=1   goal=travel|people|life|work|culture|exam|later_   step=hangul|goal   pc=1
 *   더한 값: consent=1(목표 저장 동의 줄)   pos=none(위치 지도 없음)   still=1(움직임 줄이기)
 * 할 일 표는 시안이 실제 계획 코드로 잰 값이다(.tmp/first-day-end-20261110/측정/결과.json, 측정 A~O). 화면 비교와 손 시험에만 쓴다. */
import {LOOK_FACES} from '../seoul-arrival/data.mjs';

const STUDENTS = {
  idol: {name: '볼로르', nameEn: 'Bolor', nameCy: 'Болор', look: 'mn_f', call: '언니', from: '몽골'},
  actor: {name: '투안', nameEn: 'Tuan', nameCy: 'Туан', look: 'vn_m', call: '누나', from: '베트남'}
};
// 할 일마다 자리 사진 하나 · 그 레슨이 실제로 가르치는 말(life-content.mjs의 표현 셋). 말이 없는 활동은 다루는 것만.
const LESSON = {
  '첫 인사 세 마디': {photo: 'ph9-greet', topic: '만남 · 감사 · 소개 · {m}분', says: me => ['안녕하세요.', '감사합니다.', me]},
  '카페에서 하는 말': {photo: 'ph8-cafe', topic: '주문 · 매장 이용 · 포장 · {m}분', says: () => ['따뜻한 차 한 잔 주세요.', '여기서 마실게요.', '포장해 주세요.']},
  '계산대 앞 세 마디': {photo: 'ph6-store', topic: '가격 · 봉투 · 카드 결제 · {m}분', says: () => ['이거 얼마예요?', '봉투 하나 주세요.', '카드로 계산할게요.']},
  '어디로 가면 될까요?': {photo: 'ph3-way', topic: '위치 묻기 · 방향 · 주변 장소 · {m}분', says: () => ['공원이 어디에 있어요?', '오른쪽으로 가세요.', '은행 옆에 있어요.']},
  '언제, 어디서 만날까요?': {photo: 'ph3-plan', topic: '약속 시간 · 장소 · 늦는 연락 · {m}분', says: () => ['내일 오후 세 시에 만나요.', '어디에서 만날까요?', '조금 늦을 것 같아요.']},
  '한글 만나기': {photo: 'ph9-hangul', topic: '소리 듣기 · 글자 고르기 · 따라 쓰기'},
  '짧은 진단': {photo: 'ph6-exam', topic: '시작점 확인'},
  '말의 리듬': {photo: 'ph3-rhythm', topic: '박자 맞춰 읽기'},
  '바람길 · 짧은 지시 듣기': {photo: 'ph3-rhythm', topic: '짧은 지시 듣기'},
  '읽기 짧은 연습': {photo: 'ph3-read', topic: '짧은 글 읽기'}
};
const NEW = '아직 안 해 본 것부터 해요.';
const GOALR = '직접 고른 목표와 이어지는 활동이에요. 짧게 시작해 봐요.';
const PLANS = {
  first: {title: '첫 인사 세 마디', kind: '생활 한국어 · {m}분', min: 2, reason: NEW, alts: [['카페에서 하는 말', 2], ['계산대 앞 세 마디', 2]]},
  hangul: {title: '한글 만나기', kind: '한글 · {m}분', min: 5, reason: '한글부터 만나요. 소리를 듣고 글자를 고르며 읽는 법을 익혀요.', alts: [['첫 인사 세 마디', 2], ['카페에서 하는 말', 2]], line: '한글부터 해요', lineTomorrow: '내일은 한글부터 해요'},
  next: {title: '카페에서 하는 말', kind: '생활 한국어 · {m}분', min: 2, reason: '마친 레슨 바로 다음이에요. 처음 보는 표현이 나와요.', alts: [['계산대 앞 세 마디', 2], ['어디로 가면 될까요?', 2]]},
  travel: {title: '카페에서 하는 말', kind: '생활 한국어 · {m}분', min: 2, reason: GOALR, alts: [['계산대 앞 세 마디', 2], ['어디로 가면 될까요?', 2]]},
  people: {title: '첫 인사 세 마디', kind: '생활 한국어 · {m}분', min: 2, reason: GOALR, alts: [['언제, 어디서 만날까요?', 2], ['카페에서 하는 말', 2]]},
  life: {title: '첫 인사 세 마디', kind: '생활 한국어 · {m}분', min: 2, reason: GOALR, alts: [['카페에서 하는 말', 2], ['계산대 앞 세 마디', 2]]},
  work: {title: '언제, 어디서 만날까요?', kind: '생활 한국어 · {m}분', min: 2, reason: GOALR, alts: [['첫 인사 세 마디', 2], ['카페에서 하는 말', 2]]},
  culture: {title: '카페에서 하는 말', kind: '생활 한국어 · {m}분', min: 2, reason: GOALR, alts: [['말의 리듬', 4], ['한글 만나기', 5]]},
  exam: {title: '짧은 진단', kind: '짧은 진단 · {m}분', line: '처음 보는 문제로 짧게 확인해요.', min: 5, reason: '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.', alts: [['바람길 · 짧은 지시 듣기', 3], ['읽기 짧은 연습', 3]]}
};
PLANS.later_ = PLANS.first;
const GOALS = ['travel', 'people', 'life', 'work', 'culture', 'exam'];
// 목표 저장 동의(학습 목표 창 world-strings goal.consent.account · goal.consent.note와 같은 글)
const CONSENT = {
  ko: {label: '내 계정에 저장하기', note: '목표와 도움 방식을 기억해 추천에 써요.'},
  en: {label: 'Save to my account', note: 'We remember your goals and help style to suggest practice.'},
  mn: {label: 'Бүртгэлдээ хадгалах', note: 'Зорилго, тусламжийн хэлбэрийг санаж дасгал санал болгоход ашиглана.'}
};
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };

export function createDevHost(search = location.search) {
  const Q = new URLSearchParams(search);
  const D = {
    v: ['off', 'more', 'day2'].includes(Q.get('v')) ? Q.get('v') : 'end',
    dream: Q.get('dream') === 'actor' ? 'actor' : 'idol',
    who: Q.get('who') === 'guest' ? 'guest' : 'login',
    lines: Q.has('lines') ? Math.max(0, Math.min(5, Number(Q.get('lines')) || 0)) : 5,
    hangul: ['new', 'ask', 'skip'].includes(Q.get('hangul')) ? Q.get('hangul') : 'reads',
    lang: ['en', 'mn'].includes(Q.get('lang')) ? Q.get('lang') : 'ko',
    mom: ['ok', 'later'].includes(Q.get('mom')) ? Q.get('mom') : 'fix',
    after: Q.get('after') === '1',
    goal: GOALS.includes(Q.get('goal')) || Q.get('goal') === 'later_' ? Q.get('goal') : '',
    step: ['hangul', 'goal'].includes(Q.get('step')) ? Q.get('step') : '',
    pc: Q.get('pc') === '1',
    consent: Q.get('consent') === '1', agreed: false,
    pos: Q.get('pos') !== 'none',
    still: Q.get('still') === '1'
  };
  if (D.v === 'day2') D.after = false;   // 「첫날 연습 → 둘째 날」은 시안이 재지 않은 조합(측정 K)
  const ST = STUDENTS[D.dream], me = `저는 ${ST.name}${josa(ST.name, '이에요', '예요')}.`;
  let api = null;
  const item = (title, min, p = {}) => {
    const L = LESSON[title] || {};
    return {token: `dev:${title}`, title, titleUi: title, kind: p.kind || '생활 한국어 · {m}분', min, reason: p.reason || null, line: p.line || null, lineTomorrow: p.lineTomorrow || null,
      photo: L.photo || null, topic: L.topic || null, says: L.says ? L.says(me) : null};
  };
  // 엔진이 실제로 고른 것(측정 A~O)
  const planOf = (d = D) => {
    if (d.hangul === 'new') return PLANS.hangul;                       // 측정 C · E · M — 한글 처음이면 목표와 상관없이 먼저
    if (d.v === 'day2' && PLANS[d.goal]) return PLANS[d.goal];         // 측정 L · N · O
    if (d.after) return PLANS.next;                                    // 측정 G
    return PLANS.first;                                                // 측정 A · B · D · F · I
  };
  const itemOf = p => item(p.title, p.min, p);
  const R = () => {
    const login = D.who === 'login' && !D.pc, spoke = login ? D.lines : 0;
    return {login, guest: D.who === 'guest' && !D.pc, spoke, n: Math.min(spoke, 3), t2: spoke >= 4, tr: spoke >= 5, mom: login && D.mom !== 'later', wrap: login};
  };
  function state() {
    const r = R(), plan = planOf(), day2 = D.v === 'day2';
    const today = [];
    if (!D.pc) today.push({key: 'card', label: '학생증'});
    if (r.spoke > 0) today.push({key: 'lines', label: `1화 · ${r.spoke}줄`});
    else if (r.wrap) today.push({key: 'heard', label: '1화 끝까지 들음'});
    if (r.mom) today.push({key: 'mom', label: '엄마에게 답장'});
    if (D.after && !day2) today.push({key: 'practice', label: PLANS.first.title});
    const practicing = D.after && !day2 ? 2 : 0, read = Array.from({length: 8}, (_, i) => i < 2 ? (practicing ? 'p' : 't') : '');
    const crop = LOOK_FACES[ST.look];
    return {
      view: day2 && D.goal ? 'front' : D.v, lang: D.lang, who: D.pc ? 'pc' : D.who, dream: D.dream,
      student: {name: ST.name, nameEn: ST.nameEn, nameCy: ST.nameCy, call: ST.call, from: ST.from,
        face: `../seoul-arrival/assets/img/look-${ST.look.replace('_', '-')}.webp`, faceCrop: crop ? {fx: crop.fx, fy: crop.fy, fw: crop.fw} : null, card: null},
      record: {spoke: r.spoke, n: r.n, t2: r.t2, tr: r.tr, mom: r.mom, wrap: r.wrap, momAnswer: D.mom === 'ok' ? 'ok' : 'fix'},
      hangul: D.hangul, after: D.after, goal: D.goal, step: D.step,
      plan: itemOf(plan), alts: plan.alts.map(([t, m]) => item(t, m)),
      preview: {
        hangul: {reads: itemOf(planOf({...D, hangul: 'reads'})), new: itemOf(planOf({...D, hangul: 'new'}))},
        goals: Object.fromEntries(GOALS.map(g => [g, itemOf(PLANS[g])]))
      },
      today,
      position: D.pos ? {total: 16, done: 0, practicing, rows: [{label: '듣기', cells: Array(8).fill('')}, {label: '읽기', cells: read}], names: ['낱말 뜻 읽기', '조사·문형 읽기']} : null,
      consent: {needed: D.consent && !D.agreed, ...CONSENT[D.lang]},
      reduced: D.still
    };
  }
  const note = (what, ...a) => console.info('[dev-host]', what, ...a);   // 실제 앱에서는 이 자리에서 해당 화면이 열린다
  return {
    ready(a) { api = a; api.show(state()); },
    async answerHangul(v) { if (!['reads', 'new'].includes(v)) return null; D.hangul = v; return state(); },
    async chooseGoal(goal, {consent = false} = {}) {
      if (goal !== 'later_' && !GOALS.includes(goal)) return null;
      if (goal !== 'later_' && D.consent && !D.agreed && !consent) return {error: 'needConsent'};
      if (consent) D.agreed = true;
      D.goal = goal; D.v = 'day2'; D.step = ''; return state();
    },
    async bye() { D.v = 'off'; return null; },
    async more() { D.v = 'more'; return state(); },
    async open(token) {
      note('open', token);
      if (D.v === 'more' && !D.after) setTimeout(() => { D.after = true; api && api.show(state()); }, 300);   // 첫 연습을 마치고 돌아온 것처럼
      return null;
    },
    async openStory() { note('openStory'); return null; },
    async openTab(tab) { note('openTab', tab); return null; },
    async openAll() { note('openAll'); return null; },
    async openMe() { note('openMe'); return null; },
    async signIn() { note('signIn'); return null; },
    async seen(key) { note('seen', key); return null; }
  };
}
