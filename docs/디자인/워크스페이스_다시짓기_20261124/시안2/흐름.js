// 세 시안이 함께 쓰는 예시 자료와 흐름(로그인 → 들어가는 순간 → 첫 화면 → 처리 → 다음 일).
// 사람 · 고객 · 대화는 예시다. 그림은 이미 저장소에 있는 우리 작품(SNS 표지, PULSE 장면)을 부른다.
const IMG = {
  'cut-03': '../../PULSE고객앱_다시짓기_20261124/assets/cut-03.webp',
  'cut-04': '../../PULSE고객앱_다시짓기_20261124/assets/cut-04.webp',
  'cut-05': '../../PULSE고객앱_다시짓기_20261124/assets/cut-05.webp',
  'cut-06': '../../PULSE고객앱_다시짓기_20261124/assets/cut-06.webp',
  'cut-01': '../../PULSE고객앱_다시짓기_20261124/assets/cut-01.webp',
  'gyeseyo': '../시안/img/cover-lab-gyeseyo.jpg',
  'deopda': '../시안/img/cover-lab-deopda.jpg',
  'geojeol': '../시안/img/cover-lab-geojeol.jpg',
  'deomeogeo': '../시안/img/cover-lab-deomeogeo.jpg',
  'privacy': '../시안/img/cover-brief-privacy.jpg',
  'profile': '../시안/img/cover-brief-profile.jpg',
  'tomato': '../시안/img/cover-builds-tomato.jpg',
  'space': '../시안/img/cover-builds-space.jpg',
  'orb': '../../PULSE고객앱_다시짓기_20261124/그림/솔리오_hello_노랑.webp',
};
const CO = {
  LAB: { name: 'LAB 한국어', color: '#F96859' },
  SHIFT: { name: 'SHIFT AI 강의', color: '#3D6BC9' },
  PULSE: { name: 'PULSE 광고', color: '#99295D' },
  PATH: { name: 'PATH 유학', color: '#526956' },
  SYNK: { name: 'SYNK', color: '#1B1A17' },
};
// rank: 0 고객이 기다림 · 1 동료가 기다림 · 2 오늘까지거나 지남 · 3 그 밖
const ITEMS = [
  { id: 'p1', co: 'PULSE', rank: 0, kind: '고객 편집본', who: '카페 봄날 사장님', due: '오늘', title: '카페 봄날 광고, 2차 편집본 확인',
    why: '고객이 기다려요', body: '사장님이 「딸기 라떼 장면을 더 길게」라고 하셔서 4초를 늘렸어요. 괜찮으면 사장님께 보내 주세요.', img: 'cut-05', shape: 'wide',
    acts: [{ k: 'send', label: '사장님께 보내기', primary: true, done: '사장님께 보냈어요' }, { k: 'note', label: '고칠 점 적기', done: '고칠 점을 편집 담당에게 보냈어요' }] },
  { id: 'm1', co: 'LAB', rank: 1, kind: '메신저 할 일', who: '김하린', due: '오늘', title: '몽골 유튜브 오후 1시 게시물 자막 확인',
    why: '김하린 님이 답을 기다려요', body: '「숙제」를 몽골어 두 가지로 넣었어요. 아이들이 더 잘 알아듣는 쪽을 골라 주세요.', img: 'gyeseyo', shape: 'tall',
    acts: [{ k: 'accept', label: '수락하기', primary: true, done: '수락했어요' }, { k: 'chat', label: '대화 열기' }] },
  { id: 's1', co: 'LAB', rank: 1, kind: 'SNS 승인', who: 'LAB 릴스', due: '내일 07:00', title: '릴스 「뜨거워!」 내일 아침 게시',
    why: '게시 전에 승인이 필요해요', body: '몽골 아이가 처음 먹어 본 호떡 이야기예요. 표지와 첫 3초를 보고 승인해 주세요.', img: 'deopda', shape: 'tall',
    acts: [{ k: 'approve', label: '승인하기', primary: true, done: '승인했어요. 내일 07:00에 올라가요' }, { k: 'note', label: '고칠 점 적기', done: '고칠 점을 만든 사람에게 보냈어요' }] },
  { id: 'c1', co: 'SHIFT', rank: 2, kind: '강의 자료', who: '중소기업 3곳', due: '11월 24일', late: true, title: '중소기업 AI 업무 자동화 강의 자료 확인',
    why: '확인 날짜가 지났어요', body: '목요일 강의에 쓸 32쪽 자료예요. 7쪽의 사례만 새로 바뀌었어요.', img: null,
    acts: [{ k: 'done', label: '확인했어요', primary: true, done: '확인으로 표시했어요' }, { k: 'open', label: '자료 열기' }] },
  { id: 'a1', co: 'PATH', rank: 2, kind: '상담', who: '신입생 바트에르덴', due: '오늘 15:00', title: '신입생 체류 서류 안내 상담',
    why: '오늘 오후 3시예요', body: '외국인 등록 서류가 하나 빠졌어요. 상담 전에 빠진 서류 목록을 한 번 봐 주세요.', img: null,
    acts: [{ k: 'ready', label: '준비됐어요', primary: true, done: '상담 준비를 끝냈어요' }, { k: 'open', label: '서류 목록 열기' }] },
  { id: 'm2', co: 'LAB', rank: 3, kind: '메신저 할 일', who: '김하린', due: '11월 27일', title: '12월 반 교재 표지 고르기',
    why: '김하린 님이 맡긴 일', body: '표지 후보 둘 중 하나를 골라 주세요. 금요일에 인쇄를 맡겨요.', img: 'geojeol', shape: 'tall',
    acts: [{ k: 'accept', label: '수락하기', primary: true, done: '수락했어요' }, { k: 'chat', label: '대화 열기' }] },
  { id: 'b1', co: 'SYNK', rank: 3, kind: 'SNS 승인', who: 'synkbrief', due: '11월 28일', title: 'synkbrief 「내 정보 찾기」 표지',
    why: '모레 게시해요', body: '검색에 드러난 내 정보를 찾는 법이에요. 표지 문장이 길지 않은지 봐 주세요.', img: 'privacy', shape: 'tall',
    acts: [{ k: 'approve', label: '승인하기', primary: true, done: '승인했어요' }, { k: 'note', label: '고칠 점 적기', done: '고칠 점을 보냈어요' }] },
  { id: 'p2', co: 'PULSE', rank: 3, kind: '캐스팅', who: '봄 시즌 광고', due: '11월 30일', title: '봄 시즌 캐스팅 후보 셋 고르기',
    why: '이번 달 안에 정해요', body: '후보 여섯 명 중 셋을 고르면 다음 주 촬영 일정이 잡혀요.', img: 'cut-03', shape: 'wide',
    acts: [{ k: 'pick', label: '후보 보기', primary: true, done: '후보를 골랐어요' }] },
];
const RANK_LABEL = ['고객이 기다려요', '동료가 기다려요', '오늘까지', '이번 주'];
const USER = { name: '유호', role: 'PATH · 정착·상담 책임자' };

const Q = { screen: 'login', done: [], skipped: [], cur: null, noteFor: '', toast: '' };
function queue() {
  const left = ITEMS.filter(i => !Q.done.includes(i.id));
  const pos = id => { const n = Q.skipped.lastIndexOf(id); return n < 0 ? -1 : n; };
  return left.sort((a, b) => (pos(a.id) - pos(b.id)) || (a.rank - b.rank) || (ITEMS.indexOf(a) - ITEMS.indexOf(b)));
}
const byId = id => ITEMS.find(i => i.id === id);
const img = key => (key ? IMG[key] : '');
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let paint = () => {};
function go(screen, opts = {}) {
  Q.screen = screen;
  if (screen === 'work') Q.cur = opts.id || queue()[0]?.id || null;
  if (screen === 'work' && !Q.cur) Q.screen = 'home';
  Q.noteFor = '';
  paint(opts.how || screen);
  try { history.replaceState(null, '', '#' + Q.screen); } catch {}
}
function act(id, k) {
  const item = byId(id); const a = item?.acts.find(x => x.k === k); if (!a) return;
  if (k === 'note') { Q.noteFor = Q.noteFor === id ? '' : id; paint('note'); return; }
  if (!a.done) { say(k === 'chat' ? '메신저에서 이 대화가 열려요(시안에서는 여기까지예요).' : '자료가 새 창으로 열려요(시안에서는 여기까지예요).'); return; }
  finish(id, a.done);
}
function sendNote(id) {
  const item = byId(id); const a = item?.acts.find(x => x.k === 'note');
  const box = document.querySelector(`[data-note="${id}"] textarea`);
  if (box && !box.value.trim()) { box.focus(); say('고칠 점을 한 줄 적어 주세요.'); return; }
  finish(id, a?.done || '고칠 점을 보냈어요');
}
function finish(id, text) {
  Q.done.push(id); Q.noteFor = '';
  const next = queue()[0];
  say(`${text}. ${next ? '다음 일로 넘어갈게요.' : '오늘 차례를 모두 끝냈어요.'}`);
  if (next) { Q.cur = next.id; paint('advance'); } else { Q.screen = 'home'; Q.cur = null; paint('alldone'); }
}
function skip(id) {
  Q.skipped.push(id); Q.noteFor = '';
  const list = queue(); Q.cur = list[0]?.id === id && list.length > 1 ? list[1].id : list[0]?.id;
  say('맨 뒤로 보냈어요.'); paint('skip');
}
function undo() {
  const id = Q.done.pop(); if (!id) return; Q.cur = id; Q.screen = 'work'; say('되돌렸어요.'); paint('undo');
}
let toastTimer;
function say(text) {
  Q.toast = text; const el = document.getElementById('toast'); if (!el) return;
  el.innerHTML = `<span>${esc(text)}</span>${Q.done.length && /넘어갈게요|끝냈어요|보냈어요|했어요/.test(text) ? '<button type="button" data-undo>되돌리기</button>' : ''}`;
  el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act],[data-skip],[data-send-note],[data-undo],[data-open]'); if (!t) return;
  if (t.matches('a')) e.preventDefault();
  if (t.dataset.go) go(t.dataset.go, { how: t.dataset.how });
  else if (t.dataset.act) act(t.dataset.id, t.dataset.act);
  else if (t.dataset.skip) skip(t.dataset.skip);
  else if (t.dataset.sendNote) sendNote(t.dataset.sendNote);
  else if (t.dataset.open) go('work', { id: t.dataset.open, how: 'open' });
  else if (t.hasAttribute('data-undo')) undo();
});
document.addEventListener('keydown', e => {
  if (Q.screen !== 'work' || e.target.closest('input,textarea')) return;
  const item = byId(Q.cur); if (!item) return;
  if (e.key === 'Enter' && !e.target.closest('button')) { const p = item.acts.find(a => a.primary); if (p) act(item.id, p.k); }
  if (e.key.toLowerCase() === 's') skip(item.id);
  if (e.key === 'Escape') go('home');
});
function boot(fn) {
  paint = fn;
  const h = location.hash.slice(1);
  if (h === 'home' || h === 'work') { Q.screen = h; if (h === 'work') Q.cur = queue()[0].id; }
  paint('boot');
}
