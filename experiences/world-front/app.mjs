/* 첫날 끝 · 맞춤 앞면 틀(2026-11-19). 화면은 시안 10z6의 뼈대 판(J) · 사진 결을 옮긴 것이다.
 * 화면은 host가 api.show(state)로 정한다. 약속은 HOST.md에 있다. 부모 창에 host가 없으면 dev-host.mjs의 가짜 host로 혼자 돈다.
 * 시안의 주소 값 판 · 우표 결 · 바탕 결 ed · 나중 판 · 옛 끝 글은 걷었다. 시안의 알림 자리는 host 부르기로 바꿨다. */
import {T} from './strings.mjs';

const SND = '../seoul-arrival/assets/snd/';        // 방 소리 · 초침 · 새벽(서울행과 같은 파일)
const NOTE = '../seoul-arrival/assets/img/note1.webp';   // 엄마 쪽지(서울행과 같은 파일)
// 이 폴더에 실은 자리 사진. 없는 열쇠는 r-union으로 보인다(사진 빠짐).
const PHOTOS = new Set(['ph9-greet', 'ph8-cafe', 'ph6-store', 'ph3-way', 'ph3-plan', 'ph9-hangul', 'ph6-exam', 'ph3-rhythm', 'ph3-read', 'ph9-travel', 'ph3-people', 'ph6-life', 'ph6-work', 'ph3-culture', 'r-union']);
const photoKey = k => PHOTOS.has(k) ? k : 'r-union';
const J = true, PHOTO = true;   // 뼈대 판 · 사진 결만 남겼다. 시안 코드와 줄을 맞추려고 이름은 남긴다

/* ── 상태: host가 준 state + 이 화면에서만 바꾼 것(「나중에」 · 바꾸기 · 둘째 날 다음 단계) ── */
let state = null, L = {}, LANG = 'ko';
const P = {v: 'end', front: false, dream: 'idol', who: 'login', pc: false, lang: 'ko', hangul: 'ask', after: false, goal: '', step: '', prev: '', still: false};
let STUDENT = {name: '', en: '', cy: '', call: '', from: '', face: '', crop: null, card: ''}, SEOHA = '서하';
const GOALKEYS = ['travel', 'people', 'life', 'work', 'culture', 'exam'];
function syncP() {
  const s = state || {}, view = ['end', 'off', 'more', 'day2', 'front'].includes(s.view) ? s.view : 'end';
  P.front = view === 'front';
  P.v = P.front ? 'day2' : view;   // front = 둘째 날부터의 맞춤 화면(시안 v=day2 + goal)
  P.dream = s.dream === 'actor' ? 'actor' : 'idol';
  P.pc = s.who === 'pc';
  P.who = s.who === 'guest' ? 'guest' : 'login';
  P.lang = LANG;
  const h = ['reads', 'new', 'ask', 'skip'].includes(s.hangul) ? s.hangul : 'ask';
  P.hangul = h === 'ask' && L.hangul ? L.hangul : h;   // 「나중에」는 host에 알리지 않는다 — 이 화면에서만
  P.goal = 'goal' in L ? L.goal : (GOALKEYS.includes(s.goal) || s.goal === 'later_' ? s.goal : '');
  P.step = 'step' in L ? L.step : (['hangul', 'goal'].includes(s.step) ? s.step : '');
  P.prev = L.prev || '';
  P.day = Math.max(1, Number(s.day) || (view === 'day2' || view === 'front' ? 2 : 1));   // 첫날부터 며칠째(첫날 = 1)
  // 셋째 날부터는 「어제 · 둘째 날 아침」 판(새벽 창가)이 사실과 달라 건너뛰고 질문부터
  if (P.v === 'day2' && !P.front && P.day > 2 && !P.step && !P.pc && !P.goal) P.step = ['ask', 'skip'].includes(P.hangul) ? 'hangul' : 'goal';
  P.after = !!s.after && P.v !== 'day2';   // 「첫날 연습 → 둘째 날」은 시안이 재지 않은 조합(측정 K)
  P.still = !!s.reduced;
  const st = s.student || {}, name = String(st.name || '');
  STUDENT = {name, en: st.nameEn || name, cy: st.nameCy || st.nameEn || name, call: st.call || '', from: st.from || '', face: st.face || '', crop: st.faceCrop || null, card: st.card || ''};
  SEOHA = '서하' + (STUDENT.call ? ' ' + STUDENT.call : '');
  document.body.dataset.dream = P.dream;
  document.body.classList.toggle('still', P.still);
  document.documentElement.lang = P.lang;
}
// host가 준 state를 받는다. 넘김 열쇠(바꾸기 · 다음 단계)는 새 state마다 비우고, 「나중에」는 답이 생길 때까지 둔다.
function take(next) {
  state = next;
  if (['ko', 'en', 'mn'].includes(next.lang)) LANG = next.lang;
  const keep = {};
  if (L.hangul && next.hangul === 'ask') keep.hangul = L.hangul;
  if (L.consent) keep.consent = L.consent;
  L = keep;
}
const nameUI = () => P.lang === 'mn' ? STUDENT.cy : P.lang === 'en' ? STUDENT.en : STUDENT.name;   // 10j: 화면 언어의 글자로 쓴 이름
const MQ = matchMedia('(prefers-reduced-motion: reduce)');
const calm = () => P.still || MQ.matches;
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ── 기록(있는 사실만). PC 창은 서울행이 없다 ── */
const R = () => {
  const rec = (state && state.record) || {}, login = P.who === 'login' && !P.pc, spoke = login ? Math.max(0, Math.min(5, Number(rec.spoke) || 0)) : 0;
  return {login, guest: P.who === 'guest' && !P.pc, wrap: login && !!rec.wrap, spoke, n: login ? Math.min(3, Number(rec.n ?? spoke) || 0) : 0, t2: login && !!rec.t2, tr: login && !!rec.tr, mom: login && !!rec.mom, seoul: !P.pc};
};

/* ── 글 ── */
const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const tr = (ko, v) => P.lang === 'ko' ? '' : fill((T[P.lang] || {})[ko] || '', v);
const ui = (ko, v) => P.lang === 'ko' ? fill(ko, v) : fill((T[P.lang] || {})[ko] || ko, v);
const sub = (ko, v) => { const t = tr(ko, v); return t ? `<small>${esc(t)}</small>` : ''; };
const qline = ko => P.lang === 'ko' ? esc(ko) : `${esc(tr(ko) || ko)}<small class="kq" lang="ko">${esc(ko)}</small>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const mins = m => P.lang === 'ko' ? `${m}분` : P.lang === 'mn' ? `${m} мин` : `${m} min`;
const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };
const say = (ko, v = {}) => esc(fill(ko, v)).replace(/‘([^’]+)’/g, '<q>$1</q>');   // 10l: 따옴표는 CSS(인쇄 꼴)로
const speech = (ko, v = {}) => { const h = say(ko, v).replace(/(<q>[^<]*<\/q>[^\s<]*)/, '<span class="nw">$1</span>'), i = h.indexOf('<span class="nw">'); return i > 0 ? `<span class="pre">${h.slice(0, i).trim()}</span> ${h.slice(i)}` : h; };
const NUM = ['', '한', '두', '세', '네', '다섯'];
// 10v: 소리 물결 = 그 말의 음절 박자(받침 있는 음절은 높게 · 없는 음절은 낮게 · 끝 음절은 가장 낮게)
const wave = s => { const ws = String(s).replace(/[.?!,。]/g, '').trim().split(/\s+/).filter(Boolean), n = ws.join('').length; let k = 0; return `<i class="wv" aria-hidden="true">${ws.map(w => [...w].map(c => { k++; const u = c.charCodeAt(0) - 0xAC00, closed = u >= 0 && u < 11172 && u % 28 > 0; return `<b style="height:${k === n ? 6 : closed ? 14 : 9}px"></b>`; }).join('')).join('<i class="sp"></i>')}</i>`; };

/* ── 할 일(host의 Item) ── */
const NEW = '아직 안 해 본 것부터 해요.';
const isHangul = p => !!p && p.line === '한글부터 해요';   // 한글 먼저 판(다리의 한글 만나기 Item)
// 둘째 날 목표 = 사진 하나(여행 · 대화 · 생활 · 직장 · 문화 · 시험)
const GOALS = [['travel', '여행', 'ph9-travel'], ['people', '사람들과 대화', 'ph3-people'], ['life', '한국 생활', 'ph6-life'], ['work', '직장', 'ph6-work'], ['culture', '한국 문화', 'ph3-culture'], ['exam', '시험·자격 준비', 'ph6-exam']];
const goalName = () => (GOALS.find(g => g[0] === P.goal) || [])[1] || '';
// 밤 끝 화면 꼬리표: 그 레슨이 다루는 것 + 분(생활 레슨), 나머지는 종류 + 분
const metaOf = p => { const t = (p && p.topic) || ''; return t.includes('{m}') ? t : (p && p.kind) || ''; };
const myName = () => `저는 ${STUDENT.name}${josa(STUDENT.name, '이에요', '예요')}.`;

/* ── 그림 조각 ── */
const ICON = {
  stick: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="7.2" rx="4.6" ry="5.4" fill="#fff"/><rect x="10.6" y="12.4" width="2.8" height="10" rx="1.4" fill="currentColor" opacity=".95"/></svg>',
  seat: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="2.5" width="13" height="12.5" rx="4.5" fill="#fff"/><rect x="3.5" y="13" width="17" height="5.5" rx="2.2" fill="currentColor" opacity=".9"/><rect x="5" y="18" width="2.2" height="4" rx="1.1" fill="currentColor" opacity=".6"/><rect x="16.8" y="18" width="2.2" height="4" rx="1.1" fill="currentColor" opacity=".6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  crest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.7-3.3 8.3-8 9.8-4.7-1.5-8-5.1-8-9.8V5.5z" fill="currentColor"/><path d="M8 9.5h8M8 12.5h8M12 7v9" stroke="#fbf8f2" stroke-width="1.4" stroke-linecap="round"/></svg>'
};
const light = () => P.dream === 'actor' ? ICON.seat : ICON.stick;
const cssUrl = u => `url('${String(u).replace(/['\\\n]/g, c => '\\' + c)}')`;
// 얼굴 원: 서울행 전신 그림을 얼굴 자리(faceCrop)로 자른다 — 얼굴 폭이 원의 1/1.3, 얼굴 가운데가 위에서 48%(서울행 얼굴 칸과 같은 비)
function faceCss() {
  const s = STUDENT; if (!s.face) return '';
  const c = s.crop, img = `background-image:${cssUrl(s.face)}`;
  if (!c || !(Number(c.fw) > 0)) return img;
  const ar = c.w > 0 && c.h > 0 ? c.h / c.w : 1672 / 941, k = 1.3 * c.fw;
  const px = (0.5 - c.fx / k) / (1 - 1 / k), py = (0.48 - c.fy * ar / k) / (1 - ar / k);
  return `${img};background-size:${(100 / k).toFixed(2)}% auto;background-position:${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`;
}
const PY = {'ph9-greet': 18, 'ph9-hangul': 16};   // 10k · 10w · 10z3: 사진마다 세로 초점(%)
const photo = k => { k = photoKey(k); return `<span class="pcard"><img src="assets/ph/${k}.webp" alt="" draggable="false"${PY[k] ? ` style="object-position:50% ${PY[k]}%"` : ''}></span>`; };
const idPhoto = () => STUDENT.card ? `<div class="id-photo" style="${esc(`background-image:${cssUrl(STUDENT.card)}`)}"></div>` : '';
// 10e: 학생증 작은 판 — 서울행에서 받은 학생증(이름은 한글로)이 「한글, 읽을 수 있어요?」의 견본
const miniCard = () => `<div class="idcard mini${STUDENT.card ? '' : ' nophoto'}" aria-hidden="true"><div class="id-school"><b>${ICON.crest}새솔대학교</b><span>SAESOL UNIV.</span></div>${idPhoto()}<div class="id-info"><div class="nm">${esc(STUDENT.name)}<small>${esc(STUDENT.en.toUpperCase())}</small></div><span>국제학부 1학년 · ${esc(STUDENT.from)}</span></div></div>`;

/* ── 소리: 서울행 방 소리 · 초침 + 파일 없이 만든 짧은 질감(스위치 · 종이 · 불빛) ── */
const S = {on: false, ctx: null, amb: {}};
const ctx = () => S.ctx || (S.ctx = new (window.AudioContext || window.webkitAudioContext)());
function amb(name, vol, sec = 1.2) {
  if (!S.on) return;
  let a = S.amb[name];
  if (!a) { a = new Audio(`${SND}${name}.mp3`); a.loop = true; a.volume = 0; S.amb[name] = a; }
  a.play().catch(() => {}); ramp(a, vol, sec);
}
function ramp(a, to, sec) {
  if (!a) return;
  const from = a.volume, t0 = performance.now(), id = (a._ramp || 0) + 1;
  a._ramp = id;   // 새 램프가 앞 램프를 이긴다 — 껐다 곧 켜도 앞의 「0까지」 램프가 멈추지 않게
  (function f(t) { if (a._ramp !== id) return; const k = Math.min(1, (t - t0) / (sec * 1000)); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(f); else if (to === 0) a.pause(); })(t0);
}
function stopAmb(sec = 1) { Object.values(S.amb).forEach(a => ramp(a, 0, sec)); }
function noise(c, len) { const b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfx(kind, when = 0) {
  if (!S.on) return;
  const c = ctx(), t = c.currentTime + when, out = c.destination;
  const env = (node, peak, dur) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(g).connect(out); return g; };
  if (kind === 'switch') {
    [[0, .55], [.021, .32]].forEach(([dt, g]) => { const s = c.createBufferSource(); s.buffer = noise(c, .05); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = .9; const gg = c.createGain(); gg.gain.setValueAtTime(g, t + dt); gg.gain.exponentialRampToValueAtTime(.0001, t + dt + .028); s.connect(bp).connect(gg).connect(out); s.start(t + dt); s.stop(t + dt + .05); });
    const o = c.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + .07); env(o, .22, .09); o.start(t); o.stop(t + .12);
  } else if (kind === 'paper') {
    const s = c.createBufferSource(); s.buffer = noise(c, .22); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, t); bp.frequency.linearRampToValueAtTime(2600, t + .18); bp.Q.value = .8; s.connect(bp); env(bp, .2, .2); s.start(t); s.stop(t + .22);
  } else if (kind === 'flick') {   // 사진이 옆으로 넘어갈 때 종이 스치는 소리
    const s = c.createBufferSource(); s.buffer = noise(c, .08); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.4; s.connect(bp); env(bp, .07, .07); s.start(t); s.stop(t + .08);
  } else if (kind.startsWith('chime')) {
    const f = Number(kind.slice(5)) || 880; const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; env(o, .07, .55); o.start(t); o.stop(t + .6);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01; env(o2, .018, .3); o2.start(t); o2.stop(t + .35);
  } else if (kind === 'tap') {
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 520; env(o, .05, .07); o.start(t); o.stop(t + .08);
  }
}
function soundBtn() { return `<div class="hud"><button type="button" data-act="sound" aria-label="${esc(ui(S.on ? '소리 끄기' : '소리 켜기'))}" aria-pressed="${S.on}">${ICON.sound}</button></div>`; }
function setSound(on) {
  S.on = on; if (on) { try { ctx().resume?.(); } catch {} }
  document.querySelectorAll('[data-act="sound"]').forEach(b => { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', ui(on ? '소리 끄기' : '소리 켜기')); b.querySelector('.w').style.display = on ? '' : 'none'; b.querySelector('.x').style.display = on ? 'none' : ''; });
  if (!on) stopAmb(.3); else roomSound();
}
function roomSound() {
  const v = app.querySelector('.view'); if (!v) return;
  if (v.classList.contains('dawn')) amb('amb_dawn', .4);
  else if (v.classList.contains('night') && !v.classList.contains('off')) { amb('amb_room', .5); amb('amb_clock', .22); }
  else stopAmb(1.2);   // 종이(맞춤) 화면은 조용히 — 거기엔 소리 단추가 없다
}

/* ── 화면 ── */
const app = document.getElementById('app');
const ambBg = document.getElementById('ambient');
let toastT = 0;
function toast(msg, sr) { let t = app.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); app.append(t); } t.textContent = msg; t.classList.toggle('sr', !!sr); t.classList.toggle('ovjm', !!app.querySelector(':scope > .view.jm')); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }

// 첫날 끝 — 서하가 내일 할 일을 말한다. 한글 답이 없으면 사람 말이 아닌 화면 질문.
function tomorrowBlock(plan) {
  if (P.hangul === 'ask') {   // 답 전에는 끝 단추를 그리지 않는다. 「나중에 할게요」 한 번이면 끝낼 수 있다
    return `<div class="askq"><p class="ask-lab">${esc(ui('내일 할 일을 고르려고 해요'))}</p><p class="ask-q">${qline('한글, 읽을 수 있어요?')}</p>
      ${choiceAns('data-hangul', 'dark')}
      <button type="button" class="later" data-hangul="skip">${esc(ui('나중에 할게요'))}</button></div>`;
  }
  if (!plan) return '';
  const line = plan.lineTomorrow || '내일은 ‘{t}’부터 해요';
  return `<div class="seoha"><span class="face" style="background-image:url(assets/seoha.webp)" aria-hidden="true"></span><div><div class="who"><b>${esc(SEOHA)}</b></div>
    <p class="say">${say(line, {t: plan.title})}${sub(line, {t: plan.title})}</p>
    <p class="meta">${esc(ui(metaOf(plan), {m: plan.min}))}</p></div></div>`;
}

let QUIET = false;   // 같은 화면을 다시 그릴 때(언어 · 새 state)는 등장 움직임 없이
function nightView({off = false} = {}) {
  const r = R(), plan = state.plan;
  const w = (txt, open, label) => `<button class="w" type="button" data-open="${open}" aria-haspopup="dialog" aria-label="${esc(label.includes(txt) ? label : `${txt} · ${label}`)}">${esc(txt)}</button>`;
  const rows = [];   // [보이는 줄(html), 번역 열쇠, 줄 꼴, 번역 값]
  if (r.guest || (!r.wrap && r.spoke === 0)) {   // 1화를 아직 안 본 로그인 학생도 그날 한 일은 학생증과 한글 이름이다
    rows.push([esc('서울에서 첫날'), '서울에서 첫날', 'lead']);
    rows.push([esc('학생증 받고'), '학생증 받고']);
    rows.push([esc('이름은 한글로'), '이름은 한글로']);
  } else {
    rows.push([esc(r.spoke > 0 ? '오늘, 한국어로' : '오늘은'), r.spoke > 0 ? '오늘, 한국어로' : '오늘은', 'lead']);
    if (r.spoke > 0) rows.push([`1화에서 ${w(`${NUM[r.spoke]} 줄`, 'lines', ui('1화에서 말한 줄'))}`, r.spoke === 5 ? '1화에서 다섯 줄' : r.spoke === 1 && P.lang === 'en' ? '1화에서 한 줄' : '1화에서 {n}줄', '', {n: r.spoke}]);
    else rows.push([esc('1화를 끝까지 듣고'), '1화를 끝까지 듣고']);
    if (r.mom) rows.push([`엄마한테 ${w('한 줄', 'mom', ui('엄마 쪽지와 내 답'))}`, '엄마한테 한 줄']);
  }
  if (!r.guest && !r.wrap && r.spoke === 0 && r.mom) rows.push([`엄마한테 ${w('한 줄', 'mom', ui('엄마 쪽지와 내 답'))}`, '엄마한테 한 줄']);
  const rec = P.hangul === 'ask' && !r.guest && rows.length > 1, plain = h => h.replace(/<[^>]+>/g, '');   // 10z: 질문 동안은 두 줄 기록
  const recT = rec && P.lang !== 'ko' ? `${tr(rows[0][1])} ${rows.slice(1).map(x => tr(x[1], x[3] || {})).join(' · ')}` : '';
  const poem = rec ? `<span class="ln rc"><span class="rl">${esc(ui('오늘 한 일'))}</span><span class="ko">${plain(rows[0][0])} ${rows.slice(1).map(x => plain(x[0])).join(' · ')}</span>${recT ? `<small>${esc(recT)}</small>` : ''}</span>` : rows.map(([html, key, cls, v]) => `<span class="ln ${cls || ''}"><span class="ko">${html}</span>${sub(key, v)}</span>`).join('');
  const tag = r.guest || !r.wrap ? '기숙사 들어가는 날 · 밤' : '개강 첫날 · 밤';   // 개강 첫날 = 1화 장면
  const spot = r.wrap && P.hangul !== 'ask' ? spotTag() : '';   // 사진 속 자리 이름표: 1화를 본 학생에게만, 한글 질문 동안은 뺀다
  const bye = '오늘은 여기까지';
  const acts = P.hangul === 'ask' ? '' : r.guest
    ? `<div class="acts"><button class="go" type="button" data-act="login">${esc(ui('로그인하고 1화 보기'))}</button><button class="tx" type="button" data-act="bye">${esc(ui(bye))}</button></div>`
    : `<div class="acts"><button class="go" type="button" data-act="bye">${esc(ui(bye))}</button><button class="tx" type="button" data-act="more">${esc(ui('지금 더 연습하기'))}<span class="arw" aria-hidden="true">→</span></button></div>`;
  const nm = nameUI();
  return `<section class="view night ${P.still || QUIET ? '' : 'enter'} ${off ? 'off' : ''} ${P.hangul === 'ask' ? 'asking' : ''}" aria-label="${esc(ui(tag))}">
    <div class="ph"><img class="on" src="assets/night.webp" alt=""><img class="off" src="assets/night-off.webp" alt=""><i class="lamp" aria-hidden="true"></i>${spot}</div>
    ${soundBtn()}
    <p class="tag"><button type="button" class="me-tag" data-open="card" aria-haspopup="dialog" aria-label="${esc(`${STUDENT.name} · ${ui('내 학생증')}`)}"><span class="me" style="${esc(faceCss())}"></span>${esc(STUDENT.name)}${P.lang !== 'ko' && nm !== STUDENT.name ? `<small>${esc(nm)}</small>` : ''}</button><span>${esc(ui(tag))}</span></p>
    <h1 class="poem${rec ? ' rec' : ''}">${poem}</h1>
    <div class="foot">
      ${rec ? tomorrowBlock(plan).replace('<p class="ask-q">', '<p class="ask-q" role="heading" aria-level="1">') : tomorrowBlock(plan)}
      ${acts}
    </div>
    <div class="rest" aria-live="polite"><p>${esc(ui('앱을 닫아도 내일 여기서 이어져요'))}</p><button type="button" class="next" data-act="more">${esc(ui('지금 더 하기'))}<span aria-hidden="true">→</span></button></div>
    <div class="sheet" role="dialog" aria-modal="true"><div class="sheet-card" tabindex="-1"></div></div>
  </section>`;
}
// 자리 이름표: 그 창의 불빛 + 가는 지시선 + 램프 색 글
const spotTag = () => `<div class="spot r" style="left:84.4%;top:56.6%"><span>${esc(ui('1화 · 학생 식당'))}</span><i></i><b></b></div>`;
const EXPR = '혹시 도서관이 어디에 있는지 아세요?';   // 1화 장면 속 표현(서울행 1화 원고)

function sheet(kind) {
  const r = R(), v = app.querySelector('.view'), box = v.querySelector('.sheet'), card = box.querySelector('.sheet-card');
  v.scrollTop = 0; v.classList.add('lock');
  let head = '', body = '';
  if (kind === 'card') {
    head = ui('내 학생증');
    body = `<div class="idcard${STUDENT.card ? '' : ' nophoto'}"><div class="id-school"><b>${ICON.crest}새솔대학교</b><span>SAESOL UNIV.</span></div>
      ${idPhoto()}
      <div class="id-info"><div class="nm">${esc(STUDENT.name)}<small>${esc(STUDENT.en.toUpperCase())}</small></div><span>국제학부 1학년 · ${esc(STUDENT.from)}</span><span>학번 <b>2027-0412</b></span><span>발급 2027. 2. 23.</span></div>
      <div class="id-foot"><span class="id-dream">꿈 · ${P.dream === 'actor' ? '배우' : '아이돌'}</span></div></div>`;
  } else if (kind === 'lines') {   // 기록은 수뿐이다(best.s1e01 {n,t2,tr}) — 어느 줄을 말했는지는 없어 문장을 지어내지 않는다
    head = ui('1화에서 말한 줄');
    const row = (ko, k, v) => `<li>${light()}<span>${esc(ko)}${sub(k || ko, v)}</span></li>`;
    body = `<ol class="said">${r.n ? row(`장면에서 ${NUM[r.n]} 줄`, r.n === 1 && P.lang === 'en' ? '장면에서 한 줄' : '장면에서 {n}줄', {n: r.n}) : ''}${r.t2 ? row('한 번 더 · 한 줄') : ''}${r.tr ? row('새 상황 · 한 줄') : ''}</ol>
      <p class="expr"><span>${esc(ui('1화 장면 속 표현'))}</span><b>${esc(EXPR)}</b></p>`;
  } else if (kind === 'mom') {
    head = ui('엄마 쪽지와 내 답');
    const ok = ((state.record || {}).momAnswer) === 'ok';
    body = `<img class="momshot" src="${NOTE}" alt="엄마의 쪽지: 공부 잘 돼? 친구 있어? 엄마도 한국말 해 볼래. 맞아?"><div class="myreply"><span>${ok ? '맞아.' : '있어. ㅅ 두 개!'}</span></div>`;
  }
  card.innerHTML = `<div class="sheet-head"><b>${esc(head)}</b><button type="button" data-act="close">${esc(ui('닫기'))}</button></div>${body}`;
  box.setAttribute('aria-label', head);   // 화면 읽기: 이름 있는 대화상자
  box.classList.add('on'); sfx('paper'); setTimeout(() => card.focus({preventScroll: true}), 60);
  [...v.children].forEach(c => { if (c !== box) c.inert = true; });   // 10g: 판이 열린 동안 초점은 판 안에만
}

/* ══ 종이(맞춤) ══ */
// 할 일 하나 = 자리 사진 하나 + 이름 · 그 레슨의 말 · 왜. 서하가 고른 것이 가운데, 다른 걸로 둘이 양옆.
function optionsFor() {
  const plan = state.plan, alts = (Array.isArray(state.alts) ? state.alts : []).filter(Boolean), out = [];
  const mk = (it, pick) => ({item: it, title: it.title || '', min: Number(it.min) || 0, pick, ph: photoKey(it.photo), lab: pick ? '' : it.title || '', alt: !pick});
  if (alts[0]) out.push(mk(alts[0], false));
  if (plan) out.push(mk(plan, true));
  if (alts[1]) out.push(mk(alts[1], false));
  return out;
}
const pickIndex = opts => Math.max(0, opts.findIndex(o => o.pick));
const choseLine = () => { const g = goalName(); return `<span class="why chose"><span>${esc(P.lang === 'ko' ? `‘${g}’${josa(g, '을', '를')} 골라서 정했어요` : ui('‘{g}’을 골라서 정했어요', {g: ui(g)}))}</span><button type="button" data-act="regoal">${esc(ui('바꾸기'))}<span class="arw" aria-hidden="true">→</span></button></span>`; };   // 10z4: 둘째 날 고른 목표 · 바꾸기는 서하 이름 줄 오른쪽
function capHTML(o) {
  const it = o.item || {}, says = Array.isArray(it.says) && it.says.length ? it.says : null, plan = state.plan || {}, day2 = P.v === 'day2';
  const body = says
    ? `<div class="sayw"><ul class="says sl">${says.map(s => `<li>${TTS ? `<button type="button" class="say-play bub" data-say="${esc(s)}" aria-label="${esc(ui('들어 보기'))} · ${esc(s)}">` : '<span class="say-play bub nob">'}<span lang="ko">${s === myName() ? esc(s).replace(esc(STUDENT.name), `<span class="nmslot">${esc(STUDENT.name)}</span>`) : esc(s)}</span>${TTS ? `${wave(s)}</button>` : '</span>'}</li>`).join('')}</ul>${TTS ? `<div class="sa-row"><button type="button" class="say-all" data-sayall aria-pressed="false"><i class="sa-g" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i><span>${esc(ui('모두 듣기'))}</span></button></div>` : ''}</div>`   // 10q: 눌러 듣는 말풍선 · 10p: 내 이름 자리
    : `<p class="tp">${esc(ui(it.topic || it.kind || plan.kind || '', {m: o.min}))}</p>`;
  let why = '';
  if (!o.pick) why = `<p class="why alt">${esc(ui('다른 걸로'))}</p>`;
  else if (day2 && goalName() && !isHangul(plan)) why = '';   // 고른 목표 줄은 서하 이름 줄 오른쪽에 있다
  else why = plan.reason && plan.reason !== NEW ? `<p class="why">${esc(ui(plan.reason))}</p>` : '';   // 10v: 첫 판 까닭 줄은 뺀다
  const named = !o.pick || (plan.line && !isHangul(plan));   // 10e: 서하 말에 이름이 없는 판(시험)은 이름표에 이름
  return `${named ? `<p class="nm">${esc(o.title)}</p>` : ''}${body}${why}`;
}
function railHTML(opts, {label, kind = 'task'}) {
  const rid = 'r' + Math.random().toString(36).slice(2, 7);
  const items = opts.map((o, i) => `<button type="button" class="ri" role="option" id="${rid}-${i}" data-i="${i}" aria-label="${esc(o.label || (P.lang !== 'ko' && o.item && o.item.titleUi) || o.title)}${o.min ? ' · ' + mins(o.min) : ''}">${photo(o.ph) + (o.lab ? `<span class="rlab" aria-hidden="true">${o.alt ? `<small>${esc(ui('다른 걸로'))}</small>` : ''}${esc(o.lab)}</span>` : '')}</button>`).join('');
  const ticks = opts.map((o, i) => kind === 'goals' ? `<i data-i="${i}" data-go="${i}">${esc(o.label || o.title)}${P.lang !== 'ko' ? ` <small lang="ko">${esc(o.title)}</small>` : ''}</i>` : `<i data-i="${i}"></i>`).join('');   // 10x: 목표 이름 줄
  const arrows = kind === 'task' ? `<div class="rnav" aria-hidden="true"><button type="button" tabindex="-1" data-step="-1">‹</button><button type="button" tabindex="-1" data-step="1">›</button></div>` : '';   // 10l: 넓은 화면의 ‹ ›
  return `<div class="rail ${kind}" role="listbox" aria-orientation="horizontal" aria-label="${esc(label)}" tabindex="0">${items}</div><div class="ticks${kind === 'goals' ? ' gn' : ''}" aria-hidden="true">${ticks}</div>${arrows}`;
}

// 10j: 탐색 한 벌 — 문 넷이 같은 캡슐에(PC는 이야기 없이 셋). 휴대폰은 화면 아래에 떠 있고, 넓은 화면은 머리에
const jNav = () => `<nav class="jnav" aria-label="${esc([...(P.pc ? [] : ['이야기']), '맞춤', '배우기', '놀이'].map(k => ui(k)).join(' · '))}">${P.pc ? '' : `<button type="button" data-act="story"><span>${esc(ui('이야기'))}</span></button>`}<button type="button" class="on" aria-current="page"><span>${esc(ui('맞춤'))}</span></button><button type="button" data-act="tab" data-tab="learn"><span>${esc(ui('배우기'))}</span></button><button type="button" data-act="tab" data-tab="play"><span>${esc(ui('놀이'))}</span></button></nav>`;
// 「나」: 내 계정 · 설정 · 로그아웃(host.openMe). PC는 10y 이름표 그대로 누르는 단추로, 그 밖에는 머리글자 원 하나
const initial = () => ([...(nameUI() || STUDENT.name || '·')][0] || '·').toUpperCase();   // 화면 언어의 이름 첫 글자(한국어 판은 「볼」)
const meBtn = () => `<button type="button" class="jme${P.pc ? '' : ' jme-o'}" data-act="me" aria-label="${esc(`${ui('나')} · ${ui('내 계정 · 설정')}`)}"><i class="ini" aria-hidden="true">${esc(initial())}</i>${P.pc ? `<b>${esc(nameUI())}</b>` : ''}</button>`;
const header = () => `<header class="hd jhd">${jNav()}${meBtn()}</header>`;

// 내 위치: 칸 구조(TOPIK I 16칸 = 듣기 8 · 읽기 8)는 꼬리표가 말하고, 오늘 채울 칸 · 연습 중 칸은 그 이름과 같이.
function posBlock() {
  const pos = state.position;
  const head = (extra = '') => `<div class="pos-h"><b>${esc(ui('내 위치'))}</b>${extra}<button type="button" data-act="all">${esc(ui('전체 보기'))}<span class="arw" aria-hidden="true">→</span></button></div>`;
  if (!pos || !Array.isArray(pos.rows) || !pos.rows.length) {   // 위치 지도가 없으면 칸 줄 없이 「전체 보기」만
    return `<button type="button" class="pos-row pos-m" data-act="all"><b>${esc(ui('내 위치'))}</b><span class="arw" aria-hidden="true">→</span></button><div class="pos">${head()}</div>`;
  }
  const rows = pos.rows.map(r => ({label: r.label || '', cells: Array.isArray(r.cells) ? r.cells : []}));
  const all = rows.flatMap(r => r.cells), practicing = Number(pos.practicing) > 0 || all.includes('p'), today = !practicing && all.includes('t');
  const names = (Array.isArray(pos.names) ? pos.names : []).map(n => ui(n)).join(' · ');
  const tagK = 'TOPIK I 16칸';
  const mt = `<span class="mt" aria-hidden="true">${rows.map(r => `<span class="g">${r.cells.map(c => c === 'p' || c === 't' ? `<i class="${c}"></i>` : '<i></i>').join('')}</span>`).join('')}</span>`;
  const segs = cells => cells.map(c => c === 'p' ? '<i class="p"><b></b></i>' : c === 't' ? '<i class="t"></i>' : '<i></i>').join('');
  const strip = `<div class="strip" aria-hidden="true">${rows.map(r => `<span class="dl">${esc(ui(r.label))}</span><span class="rule">${segs(r.cells)}</span>`).join('')}</div>`;
  const tk = `<span class="tkf">${esc(ui(tagK))}</span><span class="tk" aria-hidden="true">TOPIK I</span>`;
  if (!practicing) {
    const row0 = `<button type="button" class="pos-row pos-m" data-act="all"><b>${esc(ui('내 위치'))}</b>${mt}<span class="tk" aria-hidden="true">TOPIK I</span><span class="sr">${esc(ui(tagK))}</span><span class="arw" aria-hidden="true">→</span></button>`;   // 10y: 휴대폰 꼬리표는 「TOPIK I」만
    return row0 + `<div class="pos">${head(tk)}
    ${strip}
    ${today && names ? `<p class="named tdy"><i class="sw t" aria-hidden="true"></i><span>${esc(names)}</span> <em>${esc(ui('오늘 연습'))}</em></p>` : ''}</div>`;   // 10x · 10y · 10z: 칸 판 · 오늘 채울 칸 · 그 칸의 이름
  }
  const row = `<button type="button" class="pos-row pos-m" data-act="all"><b>${esc(ui('내 위치'))}</b>${mt}<span class="sr">${esc(ui(tagK))}</span><span class="pe"><em>${esc(ui('연습 중'))}</em><span class="arw" aria-hidden="true">→</span></span>${names ? `<span class="sr">${esc(names)}</span>` : ''}</button>`;   // 10j · 10g: 「연습 중」은 보이게, 칸 이름은 화면 읽기에
  return row + `<div class="pos">${head(tk)}
    ${strip}
    ${names ? `<p class="named"><i class="sw" aria-hidden="true"></i><span>${esc(names)}</span> <em>${esc(ui('연습 중'))}</em></p>` : ''}</div>`;
}
// 10e: 줄 수 — 한국어는 밤 시와 같은 한글 수사(「세 줄」), 영어 · 몽골어는 숫자
const linesTxt = n => P.lang === 'ko' ? `1화에서 ${NUM[n]} 줄` : ui(n === 5 ? '1화에서 다섯 줄' : n === 1 && P.lang === 'en' ? '1화에서 한 줄' : '1화에서 {n}줄', {n});
// 「오늘 한 것」 줄: host의 today. 아는 열쇠는 틀의 글로, 맞춤에서 마친 것(practice)은 host가 준 이름 그대로
function doneItems() {
  const r = R(), items = [], practice = [];
  for (const row of Array.isArray(state.today) ? state.today : []) {
    if (!row || typeof row !== 'object') continue;
    if (row.key === 'practice') { if (row.label) practice.push(String(row.label)); continue; }
    const t = row.key === 'card' ? ui('학생증') : row.key === 'lines' ? (r.spoke > 0 ? linesTxt(r.spoke) : ui(row.label || '')) : row.key === 'heard' ? ui('1화 끝까지 들음') : row.key === 'mom' ? ui('엄마에게 답장') : ui(row.label || '');
    if (t) items.push(t);
  }
  return {items, practice};
}
function doneLine() {
  const day2 = P.v === 'day2', {items, practice: done} = doneItems();
  const practice = done.length && !day2 ? `<span class="dl2"><b>${esc(ui(items.length ? '맞춤' : '오늘 한 것'))}</b><span>${esc(done[0])}</span></span>` : '';
  if (!items.length && !practice) return '';
  const dl1 = items.length ? `<span class="dl1"><b>${esc(ui(day2 && !(state && state.recordToday) ? (P.day > 2 ? '첫날' : '어제 한 것') : '오늘 한 것'))}</b>${items.map(t => `<span>${esc(t)}</span>`).join('<i aria-hidden="true"></i>')}</span>` : '';
  return `<p class="doneln">${dl1}${practice}</p>`;
}
function sidePanel(r) {
  const day2 = P.v === 'day2', {items} = doneItems();
  const done = items.length ? `<div class="sd"><p class="lab">${esc(ui(day2 && !(state && state.recordToday) ? (P.day > 2 ? '첫날' : '어제 한 것') : '오늘 한 것'))}</p><p class="done">${items.map(t => `<span>${esc(t)}</span>`).join('<i aria-hidden="true"></i>')}</p></div>` : '';
  const expr = r.wrap ? `<div class="sd"><p class="lab">${esc(ui('1화 장면 속 표현'))}</p><p class="expr-q">${esc(EXPR)}</p></div>` : '';
  return `<aside class="side">${posBlock()}${done}${expr}</aside>`;
}
function tagFor(r, day2) {
  if (day2 && P.day > 2) return '오늘';   // 셋째 날부터
  const noEp = r.guest || !r.wrap;   // 1화(개강 첫날 장면)를 안 본 학생은 「개강」 꼬리표를 쓰지 않는다 — 밤 화면과 같은 이름
  return P.pc ? (day2 ? '둘째 날' : '첫날') : noEp ? (day2 ? '둘째 날 · 아침' : '기숙사 들어가는 날 · 밤') : day2 ? '개강 둘째 날 · 아침' : '개강 첫날 · 밤';
}   // 셋째 날부터는 「오늘」

function homeView() {
  const r = R(), plan = state.plan, day2 = P.v === 'day2', time = day2 ? 'morning' : 'lamp';
  const tag = tagFor(r, day2);
  // 한글 답이 없으면(끝 화면 질문을 건너뛰었거나 PC로 들어옴) 오늘 할 일보다 먼저 화면 질문 한 번
  if (P.hangul === 'ask' && !day2) return askView({r, tag, time});
  const fd = P.after && !day2;
  let lead = '';
  if (plan) {
    const line = day2 ? (plan.line ? plan.line : '오늘은 ‘{t}’부터 해요') : P.after ? josa(plan.title, '다음은 ‘{t}’이에요', '다음은 ‘{t}’예요') : isHangul(plan) ? '한글부터 해요' : P.hangul === 'skip' ? '‘{t}’부터 해요' : '그럼 지금 ‘{t}’부터 해요';
    // PC 앱 창: 서울행이 없어 서하를 아직 만나지 않았다 — 사람 없이 화면 글로
    const pcLine = plan.line ? plan.line : P.after ? josa(plan.title, '다음은 ‘{t}’이에요', '다음은 ‘{t}’예요') : plan.title === '첫 인사 세 마디' ? '처음 만나는 사람에게 ‘{t}’부터 해요' : '오늘은 ‘{t}’부터 해요';
    lead = P.pc
      ? `${day2 && goalName() && !isHangul(plan) ? `<p class="who pcg">${choseLine()}</p>` : ''}<h1 class="lede">${speech(pcLine, {t: plan.title})}${sub(pcLine, {t: plan.title})}</h1>`   // PC: 서하 이름 줄이 없어 고른 목표 · 바꾸기를 따로 한 줄
      : `<p class="who"><span class="face" style="background-image:url(assets/seoha.webp)" aria-hidden="true"></span><b>${esc(SEOHA)}</b>${day2 && goalName() && !isHangul(plan) ? choseLine() : ''}</p><h1 class="lede">${speech(line, {t: plan.title})}${sub(line, {t: plan.title})}</h1>`;
  }
  const opts = optionsFor();
  return `<section class="view home ${time} ${P.pc ? 'pc' : ''} jm" aria-label="${esc(ui('맞춤'))}">
    <div class="pg">${header()}<div class="cols">
      <div class="today${fd ? ' fd' : ''}">
        <div class="ta${fd ? ' fd' : ''}"><p class="tag">${esc(ui(tag))}</p>${fd ? `<p class="fdone"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"/><path d="M5.6 10.4l2.9 2.9 5.9-6.2"/></svg><span>${esc(ui('첫 연습을 마쳤어요'))}</span></p>` : ''}
        ${lead}</div>
        <div class="trail">${opts.length ? railHTML(opts, {label: ui('오늘 할 일') + ' · ' + ui('다른 걸로')}) : ''}</div>
        <div class="tb"><div class="cap" aria-live="polite">${opts.length ? capHTML(opts[pickIndex(opts)]) : ''}</div>
        ${plan ? `<button class="start" type="button" data-act="start">${esc(ui('맞춤 연습 시작'))}<small>${mins(plan.min)}</small></button>` : ''}
        ${doneLine()}
        <div class="pos-ph full">${posBlock()}</div></div>
      </div>
      ${sidePanel(r)}
    </div></div>
  </section>`;
}

// 한글 답: 위아래 카드 둘(가 · ㄱ) + 그 답을 고르면 무엇부터 하는지(host의 preview.hangul)
const HANS = [['reads', '읽을 수 있어요'], ['new', '아직 몰라요']];
const nbm = s => s.replace(/(\d+) (мин|min)/g, '$1 $2').replace(/ · (?=[^·]*$)/, ' · ');   // 10y: 끝 「· 2 мин」은 앞 낱말과 한 덩어리
const choiceAns = (attr, cls = '') => {
  const pv = (state.preview && state.preview.hangul) || {}, ps = attr !== 'data-hangul2' ? HANS.map(([k]) => pv[k] || null) : null;
  const same = ps && ps[0] && ps[1] && ps[0].title === ps[1].title;   // 10s: 두 답의 할 일이 같으면 줄을 뺀다
  return `<div class="chs ${cls} st2">${HANS.map(([k, ko], hi) => { const p = ps && !same ? ps[hi] : null; return `<button type="button" class="ch" ${attr}="${k}" aria-pressed="false"><i class="gl" aria-hidden="true">${k === 'new' ? 'ㄱ' : '가'}</i><span class="lb">${esc(ui(ko))}</span>${p ? `<span class="nx">${k === 'new' && P.lang !== 'ko' ? `${esc(ui('한글부터 해요').replace(/[.。]\s*$/, ''))} · ${mins(p.min)}` : P.lang !== 'ko' ? nbm(esc(ui(metaOf(p), {m: p.min}))) : `<span lang="ko">${esc(p.title)}</span> · ${mins(p.min)}`}</span>` : ''}</button>`; }).join('')}</div>`;
};
function askView({r, tag, time}) {
  return `<section class="view home ${time} ${P.pc ? 'pc' : ''} asking ja" aria-label="${esc(ui('맞춤'))}">
    <div class="pg">${header()}<div class="jhero" aria-hidden="true">${photo('ph9-hangul')}</div><div class="cols">
      <div class="today">
        <div class="ta"><p class="tag">${esc(ui(tag))}</p>
        <h1 class="lede q two-l"><span class="pre">${esc(ui('오늘 할 일을 고르려고 해요'))}</span> ${qline('한글, 읽을 수 있어요?')}</h1></div>
        <div class="tb">${choiceAns('data-hangul3')}
        <button class="skip" type="button" data-act="hskip">${esc(ui('나중에 할게요'))}</button></div>
      </div>
      ${sidePanel(r)}
    </div></div>
  </section>`;
}

/* ══ 둘째 날 ══ */
// 1. 새벽 창가(사진): 어제 일을 받는 서하 한 줄은 1화를 마치고 한 줄이라도 말한 학생에게만. PC는 이 판 없이 종이 질문부터.
function dawnView() {
  const r = R(), yesterday = r.wrap && r.spoke > 0;
  const tag = r.guest || !r.wrap ? '둘째 날 · 아침' : '개강 둘째 날 · 아침';   // 밤 꼬리표 · tagFor와 같게: 1화를 안 본 학생은 「개강」을 뺀다
  const top = yesterday
    ? `<p class="who"><span class="face" style="background-image:url(assets/seoha.webp)" aria-hidden="true"></span><b>${esc(SEOHA)}</b></p><p class="big">${esc('어제 식당에서 선배한테 길 물어봤죠')}${sub('어제 식당에서 선배한테 길 물어봤죠')}</p>`
    : `<p class="big plain">${esc(ui('둘째 날 아침이에요'))}</p>`;
  return `<section class="view night dawn ${P.still || QUIET ? '' : 'enter'}" aria-label="${esc(ui(tag))}">
    <div class="ph"><img class="on" src="assets/morning2.webp" alt="">${yesterday ? spotTag() : ''}</div>
    ${soundBtn()}
    <p class="tag"><span>${esc(ui(tag))}</span></p>
    <div class="dtop">${top}</div>
    <div class="foot"><div class="acts"><button class="go" type="button" data-act="d2go">${esc(ui('오늘 시작하기'))}</button></div></div>
  </section>`;
}
// 2. 종이 질문: 한글 답이 없으면 한글부터, 그다음 목표 한 번. 목표는 여섯 사진의 줄 — 가운데 것의 이름과 「고르면 오늘은 …」이 아래에.
function d2Ask() {
  const r = R(), step = P.step || (['ask', 'skip'].includes(P.hangul) ? 'hangul' : 'goal');
  const tag = tagFor(r, true), cs = state.consent;
  // 목표 저장 동의(학습 목표 창과 같은 스위치): host가 needed를 줄 때만 고르기 단추 바로 위에 한 줄
  const consent = cs && cs.needed ? `<label class="consent"><input type="checkbox" data-consent${L.consent ? ' checked' : ''}><span class="ct"><b>${esc(cs.label || '')}</b>${cs.note ? `<small>${esc(cs.note)}</small>` : ''}</span></label><p class="consent-need" role="alert" hidden></p>` : '';
  const body = step === 'hangul'
    ? `${r.seoul ? miniCard() : ''}<h1 class="lede q">${qline('한글, 읽을 수 있어요?')}</h1>${choiceAns('data-hangul2')}<button class="skip" type="button" data-act="h2skip">${esc(ui('나중에 할게요'))}</button>`
    : `<div class="ta"><p class="tag ey">${esc(ui(tag))}</p><h1 class="lede q two-l"><span class="pre">${esc('한국어를')}</span> ${esc('어디에 제일 쓰고 싶어요?')}${sub('한국어, 어디에 제일 쓰고 싶어요?')}</h1></div>
       ${P.hangul === 'new' ? `<p class="hint">${esc(ui('오늘은 한글부터 해요. 고른 목표는 기억해 둘게요.'))}</p>` : ''}
       <div class="trail">${railHTML(GOALS.map(([k, ko, ph]) => ({key: k, title: ko, label: ui(ko), lab: ui(ko), ph})), {label: P.lang === 'ko' ? '한국어를 어디에 제일 쓰고 싶어요?' : ui('한국어, 어디에 제일 쓰고 싶어요?'), kind: 'goals'})}</div>
       <div class="tb"><div class="cap" aria-live="polite">${goalCap(goalStart())}</div>
       ${consent}<div class="acts2"><button class="start" type="button" data-act="goal">${esc(ui('이걸로 할게요'))}</button>${P.prev ? `<button class="skip" type="button" data-act="keep">${esc(ui('그대로 둘게요'))}</button>` : `<button class="skip" type="button" data-act="later">${esc(ui('나중에 할게요'))}</button>`}</div></div>`;
  return `<section class="view home morning d2q ${P.pc ? 'pc' : ''} ${step === 'hangul' ? 'd2h' : ''}" aria-label="${esc(ui(tag))}">
    <header class="hd"><p class="tag">${esc(ui(tag))}</p></header>
    <div class="pg"><div class="today solo">${body}</div></div>
  </section>`;
}
const goalStart = () => Math.max(0, GOALS.findIndex(g => g[0] === P.prev));   // 10e: 바꾸기로 들어오면 고른 목표가 가운데
function goalCap(i) {
  const [k, ko] = GOALS[i], p = ((state.preview && state.preview.goals) || {})[k];
  const then = P.hangul === 'new' || !p || !p.title ? '' : `<p class="why">${esc(ui('고르면 오늘은 ‘{t}’부터', {t: p.title}))}</p>`;
  return `<p class="nm g">${esc(ui(ko))}${P.lang !== 'ko' ? `<span class="mn">${esc(ko)}</span>` : ''}</p>${then}`;
}

/* ── 가운데만 크고 또렷한 줄(참고 카드 11-04 · drag-rail.js의 원리: 한 장씩 넘기는 큰 사진, 끌면 손을 따라오고 놓으면 가장 가까운 칸에 선다) ── */
function mountRail(box, {onCenter, onTap, loop = false}) {
  const items = [...box.querySelectorAll('.ri')], n = items.length, ticks = [...box.parentElement.querySelectorAll('.ticks i')];
  let pos = Number(box.dataset.start || 0), target = pos, vel = 0, raf = 0, center = -1, drag = null, handled = 0, lastT = 0;
  ticks.forEach((t, i) => { if (t.dataset.go != null) t.addEventListener('click', () => { sfx('tap'); go(i); }); });   // 10x: 목표 이름을 누르면 그 칸으로
  const g1 = () => items[0].offsetWidth + 14;
  const mod = x => ((x % n) + n) % n;
  const off = i => { let d = i - pos; if (loop) { d = mod(d); if (d > n / 2) d -= n; } return d; };
  function layout() {
    const g = g1();
    items.forEach((el, i) => {
      const d = off(i), a = Math.abs(d);
      const op = a < .999 ? 1 : 0;
      el.style.transform = `translate(-50%,-50%) translateX(${(d * g).toFixed(1)}px) scale(1.000) rotate(0.00deg)`;
      el.style.opacity = op.toFixed(3);
      el.style.pointerEvents = op <= .01 ? 'none' : '';   // 10g: 숨긴 칸은 누름을 받지 않는다
      el.style.zIndex = String(100 - Math.round(a * 10));
      el.dataset.side = d > .5 ? 'r' : d < -.5 ? 'l' : 'c';
    });
    const c = loop ? mod(Math.round(pos)) : Math.max(0, Math.min(n - 1, Math.round(pos)));
    if (c !== center) {
      const first = center < 0; center = c;
      items.forEach((el, i) => { el.setAttribute('aria-selected', i === c ? 'true' : 'false'); el.classList.toggle('on', i === c); el.tabIndex = -1; });
      box.setAttribute('aria-activedescendant', items[c].id || '');
      ticks.forEach((t, i) => t.classList.toggle('on', i === c));
      if (!first) { sfx('flick'); onCenter && onCenter(c); }
    }
  }
  function frame(t) {
    const dt = Math.min(.034, (t - (lastT || t)) / 1000 || .016); lastT = t;
    if (!drag) { const k = 210, dmp = 27, acc = k * (target - pos) - dmp * vel; vel += acc * dt; pos += vel * dt; if (Math.abs(target - pos) < .0015 && Math.abs(vel) < .01) { pos = target; vel = 0; layout(); raf = 0; lastT = 0; return; } }
    layout(); raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (calm()) { pos = target; vel = 0; layout(); return; } if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } };
  const go = i => { if (loop) { let dd = mod(i - center); if (dd > n / 2) dd -= n; target = Math.round(target) + dd; } else target = Math.max(0, Math.min(n - 1, i)); wake(); };
  const step = k => { if (loop) target = Math.round(target) + k; else target = Math.max(0, Math.min(n - 1, Math.round(target) + k)); wake(); };
  box.addEventListener('pointerdown', e => {
    if (e.button) return;
    drag = {x0: e.clientX, y0: e.clientY, p0: pos, t: performance.now(), lx: e.clientX, lt: performance.now(), v: 0, moved: false, id: e.pointerId, el: e.target.closest('.ri')};
    vel = 0; try { box.setPointerCapture(e.pointerId); } catch {}
    if (!raf && !calm()) wake();
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { drag.moved = true; box.classList.add('dragging'); }
    if (!drag.moved) return;
    let p = drag.p0 - dx / g1();
    if (!loop) { if (p < 0) p = p * .35; if (p > n - 1) p = n - 1 + (p - (n - 1)) * .35; }   // 끝에서는 고무줄처럼(고리 줄은 끝이 없다)
    const now = performance.now(), dtt = Math.max(1, now - drag.lt);
    drag.v = drag.v * .6 + (-(e.clientX - drag.lx) / g1() / (dtt / 1000)) * .4; drag.lx = e.clientX; drag.lt = now;
    pos = p; if (calm()) layout();
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; box.classList.remove('dragging');
    if (d.moved) { const held = performance.now() - d.lt > 90, t = Math.round(pos + (held ? 0 : Math.max(-2, Math.min(2, d.v * .16)))); if (loop) { target = t; wake(); } else go(t); handled = performance.now(); return; }
    if (e.type === 'pointercancel') { target = Math.round(pos); wake(); return; }
    handled = performance.now();
    const i = d.el ? Number(d.el.dataset.i) : Math.round(pos);
    if (i !== center) go(i); else { target = Math.round(pos); wake(); onTap && onTap(i, items[i]); }
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('click', e => {   // 키보드 Enter · 화면 읽기의 누름(손가락 · 펜 · 마우스 누름은 위에서 처리)
    const el = e.target.closest('.ri'); if (!el) return; e.stopPropagation();
    if (performance.now() - handled < 600) return;
    const i = Number(el.dataset.i); if (i !== center) go(i); else onTap && onTap(i, el);
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === box) { e.preventDefault(); onTap && onTap(center, items[center]); }
  });
  let wheelT = 0;
  box.addEventListener('wheel', e => { const v = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0; if (Math.abs(v) < 8) return; e.preventDefault(); const now = performance.now(); if (now - wheelT < 260) return; wheelT = now; step(Math.sign(v)); }, {passive: false});
  items.forEach(el => el.addEventListener('dragstart', e => e.preventDefault()));
  layout();
  const ro = new ResizeObserver(() => layout()); ro.observe(box);
  return {get center() { return center; }, get target() { return Math.round(target); }, go, el: box};
}

// 누름: 사진이 살짝 눌렸다 돌아온다(오늘 할 일 큰 사진은 그대로)
function postmark(el) {
  return new Promise(res => {
    if (!el) { res(); return; }
    sfx('tap'); const c = el.querySelector('.pcard');
    if (!calm() && c && !c.closest('.rail.task')) c.animate([{transform: 'none'}, {transform: 'scale(.96)', offset: .4}, {transform: 'none'}], {duration: 340, easing: 'cubic-bezier(.3,.7,.3,1)'});
    setTimeout(res, calm() ? 0 : 300);
  });
}
// 문 두 짝(Motion 「Doors」의 원리 — 학교 시안 2판과 같은 넘김): 닫힌 동안 사진이 가운데 크게 뜨고, 열리면 다음 화면
function doors(photoK, mid) {
  return new Promise(res => {
    if (calm()) { mid && mid(); res(); return; }
    const d = document.createElement('div'); d.className = 'doors';
    d.innerHTML = `<i></i><i></i><b>${photoK ? photo(photoK) : ''}</b>`; app.append(d);
    requestAnimationFrame(() => d.classList.add('shut'));
    setTimeout(() => { mid && mid(); requestAnimationFrame(() => { d.classList.remove('shut'); d.classList.add('open'); }); }, 760);
    setTimeout(() => { d.remove(); res(); }, 1500);
  });
}

/* ── 그리기 · 넘기기 ── */
let RAIL = null, shownView = '';
function render() {
  stopSay();   // 10t: 화면이 바뀌면 읽던 말을 멈춘다
  const night = P.v === 'end' || P.v === 'off';
  const home = P.v === 'more' || !!P.goal || (P.front && !P.step);
  const dawn = !home && P.v === 'day2' && !P.step && !P.pc;
  const key = night ? P.v : home ? 'home' : dawn ? 'dawn' : 'ask';
  QUIET = key === shownView;
  app.classList.toggle('paper', !night && !dawn);
  ambBg.querySelector('img').src = P.v === 'day2' ? 'assets/morning2.webp' : 'assets/night.webp';
  app.querySelector(':scope > .doors') ? app.querySelectorAll(':scope > :not(.doors)').forEach(n => n.remove()) : (app.innerHTML = '');
  app.insertAdjacentHTML('afterbegin', P.v === 'end' ? nightView() : P.v === 'off' ? nightView({off: true}) : home ? homeView() : dawn ? dawnView() : d2Ask());
  const v = app.querySelector('.view');
  RAIL = null;
  const box = v.querySelector('.rail');
  if (box) {
    const goals = box.classList.contains('goals');
    const opts = goals ? null : optionsFor();
    box.dataset.start = goals ? String(goalStart()) : String(pickIndex(opts));
    if (opts) { const nb = v.querySelectorAll('.rnav button'), i0 = Number(box.dataset.start) || 0; if (nb.length === 2) { nb[0].disabled = i0 <= 0; nb[1].disabled = i0 >= opts.length - 1; } }   // 첫 칸에서도 갈 수 없는 쪽 화살표는 끈다
    RAIL = mountRail(box, {loop: goals,
      onCenter: i => { stopSay(); const cap = v.querySelector('.cap'); cap.classList.remove('swap'); void cap.offsetWidth; cap.innerHTML = goals ? goalCap(i) : capHTML(opts[i]); cap.classList.add('swap'); fitToday(true); const st = v.querySelector('.start small'); if (st && opts) st.textContent = mins(opts[i].min); if (opts) { const nb = v.querySelectorAll('.rnav button'); if (nb.length === 2) { nb[0].disabled = i === 0; nb[1].disabled = i === opts.length - 1; } } },
      onTap: (i, el) => { const s = el.querySelector('.pcard'); sfx('tap'); if (!calm() && s && goals) s.animate([{transform: 'none'}, {transform: 'scale(.95) rotate(-1.5deg)', offset: .4}, {transform: 'none'}], {duration: 380, easing: 'cubic-bezier(.3,.7,.3,1)'}); }
    });
  }
  if (v.classList.contains('night')) {
    placeSpot(v, P.still || QUIET || P.v === 'off' ? 0 : v.classList.contains('dawn') ? 1300 : 1650);
    if (!P.still && !QUIET && P.v === 'end') {
      setTimeout(() => sfx('paper'), 900);
      Array.from({length: R().spoke}, (_, i) => setTimeout(() => sfx('chime' + [784, 880, 988, 1047, 1175][i]), 1500 + i * 90));
      setTimeout(() => sfx('paper'), 2000);
    }
  }
  if (key === 'ask' && v.querySelector('.rail.goals') && shownView !== 'ask') call('seen', 'goal');   // 목표 질문을 보였다
  shownView = key;
  setSound(S.on);
  // 글꼴이 다 온 뒤 한 번 더 맞춘다. 넘김 등장 움직임(translateY 4%)이 도는 중이면 끝난 뒤에 잰다 — 도중에 재면 세운 폰 위 사진이 약 33px 커져
  // 내 위치 칸 줄이 시작 단추 뒤로 밀렸다(시안 10z6에도 있던 일: 「지금 더 연습하기」로 넘어온 몽골어 판)
  fitToday(); document.fonts?.ready?.then(() => { const v = app.querySelector('.view'), an = v ? v.getAnimations().filter(a => a.playState === 'running') : []; if (an.length) Promise.all(an.map(a => a.finished.catch(() => {}))).then(() => fitToday()); else fitToday(); });
}
// 10t: 넓은 화면 맞춤은 넘칠 때만 줄인다 — 가운데 띠 → 위 여백 → 글 한 단계(.tight) 차례
let fitRaf = 0;
// 10z: 세운 폰 — 위 사진 키 = 남는 키(내 위치 판 아래 끝이 떠 있는 시작 단추 위 28). 사진은 110 ~ 360, 「다른 걸로」 넘길 때(keep)는 넘칠 때만 줄임
function fitPhone(t, rail, keep, fromResize) {
  if (fromResize && rail.style.getPropertyValue('--rh') && rail.dataset.fw === String(innerWidth) && Math.abs(innerHeight - (+rail.dataset.fh || innerHeight)) < 120) return;   // 높이만 조금 바뀐 resize(주소 줄)
  const board = t.querySelector('.pos-ph'), st = app.querySelector('.view.jm .start'); if (!board || !st) return;
  const slack = () => st.getBoundingClientRect().top - 28 - (board.getBoundingClientRect().bottom - rail.getBoundingClientRect().top);
  const pad = () => { const pg = t.closest('.pg'); if (pg) pg.style.setProperty('--pb', Math.ceil(innerHeight - st.getBoundingClientRect().top + 28) + 'px'); };   // 10z6 Z3-3: 쪽 아래 여백 = 떠 있는 판 + 28
  if (keep && rail.style.getPropertyValue('--rh')) { const s = slack(), h = rail.getBoundingClientRect().height, n = Math.max(110, Math.min(+rail.dataset.rh0 || h, Math.floor(h + s))); if (n !== Math.round(h)) rail.style.setProperty('--rh', n + 'px'); pad(); return; }   // 10z6 Z3-2: 넘길 때는 처음 맞춘 키까지만
  rail.style.removeProperty('--rh');
  const rh = Math.round(Math.min(360, Math.max(110, rail.getBoundingClientRect().height + slack())));
  rail.style.setProperty('--rh', rh + 'px'); rail.dataset.fw = String(innerWidth); rail.dataset.fh = String(innerHeight); rail.dataset.rh0 = String(rh); pad();
}
function fitNamed(t) {   // 10z2: 「내 위치」 머리 줄 — 이름표가 「전체 보기」 앞에 안 들어가면 칸 줄 위 둘째 줄로
  const pos = t.querySelector('.pos-ph > .pos'); if (!pos) return;
  pos.classList.remove('nm2');
  const nm = pos.querySelector('.named'), bt = pos.querySelector('.pos-h > button');
  if (nm && bt && nm.getClientRects().length && nm.getBoundingClientRect().right > bt.getBoundingClientRect().left - 8) pos.classList.add('nm2');
}
function fitToday(keep, fromResize) {
  const t = app.querySelector('.view.jm .today'); if (!t) return;
  fitNamed(t);
  const reset = () => { t.style.removeProperty('--tt'); t.style.removeProperty('--tg'); };
  const pg = t.closest('.pg');
  const rail = t.querySelector('.rail.task');
  if (pg && rail && matchMedia('(max-width:1023px) and (min-height:501px)').matches) { reset(); t.classList.remove('tight', 'tight2'); fitPhone(t, rail, keep, fromResize); return; }   // 10z: 세운 폰은 위 사진 키로
  rail?.style.removeProperty('--rh');
  if (!pg || !matchMedia('(min-width:1024px)').matches) { reset(); t.classList.remove('tight', 'tight2'); return; }
  const over = () => pg.scrollHeight - pg.clientHeight;
  const rowsOf = () => getComputedStyle(t).gridTemplateRows.split(' ').map(parseFloat);
  // 10y: 위 여백의 바닥 = 머리 탐색 아래 끝 + 8
  const nav = app.querySelector('.view.jm .jhd .jnav'), floor = Math.max(40, nav ? Math.ceil(nav.getBoundingClientRect().bottom - t.getBoundingClientRect().top + 8) : 40);
  if (keep && t.style.getPropertyValue('--tt')) {   // 10y: 「다른 걸로」 넘길 때 위 여백은 그대로 — 넘치면 가운데 띠부터, 그래도 넘치면 처음부터
    const now = {cl: ['tight', 'tight2'].filter(c => t.classList.contains(c)).join(' '), tt: t.style.getPropertyValue('--tt'), tg: t.style.getPropertyValue('--tg')};
    const put = s => { t.classList.remove('tight', 'tight2'); if (s.cl) t.classList.add(...s.cl.split(' ')); t.style.setProperty('--tt', s.tt); if (s.tg) t.style.setProperty('--tg', s.tg); else t.style.removeProperty('--tg'); };
    const b0 = t.dataset.tt0 ? {cl: t.dataset.cl0 || '', tt: t.dataset.tt0, tg: t.dataset.tg0 || ''} : null;
    if (b0 && (b0.cl !== now.cl || b0.tt !== now.tt || b0.tg !== now.tg)) { put(b0); if (over() <= 0) return; put(now); }   // 10z6 Z3-5: 처음 맞춘 판이 들어가면 그 판으로
    if (over() <= 0) return;
    const band = rowsOf()[4] || 0, be = Math.max(0, band - 16);
    t.style.setProperty('--tg', `minmax(${Math.floor(band - Math.min(be, over()))}px,${Math.floor(band)}px)`);
    if (over() <= 0) return;
  }
  reset(); t.classList.remove('tight', 'tight2');
  const fit = () => {   // 위 여백(바닥 = 탐색 아래) · 가운데 띠(바닥 16)를 바닥까지 남은 몫에 비례해 넘친 만큼만 줄인다
    const o = over(); if (o <= 0) return 0;
    const rows = rowsOf(), top = rows[0] || 0, band = rows[4] || 0;
    const te = Math.max(0, top - floor), be = Math.max(0, band - 16), k = te + be ? Math.min(1, o / (te + be)) : 0;
    t.style.setProperty('--tt', Math.floor(top - te * k) + 'px'); t.style.setProperty('--tg', `minmax(${Math.floor(band - be * k)}px,${Math.floor(band)}px)`);
    if (over() > 0) t.style.setProperty('--tg', Math.floor(band - be * k) + 'px');   // 10z6 T3-5: 줄여도 넘치면 띠를 줄인 값에 굳힘
    return over();
  };
  if (fit() > 0) { reset(); t.classList.add('tight'); if (fit() > 0) { reset(); t.classList.add('tight2'); fit(); } }
  if (!t.style.getPropertyValue('--tt')) t.style.setProperty('--tt', Math.floor(Math.max(floor, rowsOf()[0] || 0)) + 'px');   // 10y: 맞춘 위 여백을 px로 굳힘
  if (!keep) { t.dataset.tt0 = t.style.getPropertyValue('--tt'); t.dataset.tg0 = t.style.getPropertyValue('--tg'); t.dataset.cl0 = ['tight', 'tight2'].filter(c => t.classList.contains(c)).join(' '); }   // 10z6 Z3-5: 처음 맞춘 판을 남김
}
addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fitToday(false, true)); });
let nightLand = innerWidth > innerHeight;
addEventListener('resize', () => { const land = innerWidth > innerHeight, v = app.querySelector('.view.night'); if (v && v.scrollTop && (land !== nightLand || getComputedStyle(v).overflowY !== 'auto')) v.scrollTop = 0; nightLand = land; });   // 10y: 돌리면 맨 위로
// 10e: 넘긴 뒤 초점은 새 화면의 첫 말(서하 말 · 시 · 질문)로
function focusLead() { const v = app.querySelector('.view'), f = v && (v.querySelector('.night.asking .ask-q') || v.querySelector('.lede, .dawn .big, .poem'));
  if (!f) return; f.tabIndex = -1; f.focus({preventScroll: true}); }
// 화면 넘김: 옛 화면이 흐려지는 동안 host 답(p)을 기다렸다가 새 화면. patch는 이 화면에서만 바꾸는 열쇠
let TRANS = false, PENDING = null;
async function swap(patch = {}, p = null) {
  busy = true;
  const old = app.querySelector('.view');
  let faded = Promise.resolve();
  if (!calm() && old) { old.style.transition = 'opacity .5s ease, transform .7s var(--sp)'; old.style.opacity = '0'; old.style.transform = 'translateY(-3%)'; faded = wait(420); }
  let res = null;
  if (p) { TRANS = true; PENDING = null; try { res = await p; } catch (e) { console.warn('[world-front]', e); } }
  await faded;
  const failed = !!(res && res.error && res.error !== 'needConsent');
  const next = res && typeof res === 'object' && res.view ? res : PENDING; if (next === PENDING) PENDING = null; TRANS = false;
  if (next) take(next);
  if (!failed) for (const [k, val] of Object.entries(patch)) { if (val === undefined) delete L[k]; else L[k] = val; }   // 저장이 실패하면 같은 질문에 머문다
  syncP(); render(); focusLead();
  if (failed && res.error !== 'goalWindow') toast(ui('저장하지 못했어요. 잠시 뒤 다시 골라 주세요.'));   // 한글 답 저장 실패 등(앱 알림은 모달 아래에 가린다). render가 #app을 비우므로 그린 뒤에 띄운다
  if (!calm()) app.querySelector('.view').animate([{opacity: 0, transform: 'translateY(4%)'}, {opacity: 1, transform: 'none'}], {duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)'});
  busy = false; flush();   // 넘기는 동안 더 온 state
}
// 사진 속 자리 이름표: 위 시 · 아래 덩어리와 겹치면 숨긴다
function placeSpot(v, delay) {
  const spot = v.querySelector('.spot'); if (!spot) return;
  const clash = () => {
    if (!spot.isConnected) { removeEventListener('resize', clash); return; }
    spot.classList.remove('hide');
    const a = spot.getBoundingClientRect(), f = v.querySelector('.foot')?.getBoundingClientRect(), p = v.querySelector('.poem, .dtop')?.getBoundingClientRect();
    spot.classList.toggle('hide', !!((f && a.bottom > f.top - 10) || (p && a.top < p.bottom + 10)));
  };
  clash(); requestAnimationFrame(clash); document.fonts?.ready?.then(clash); addEventListener('resize', clash);
  if (!delay) spot.classList.add('on'); else setTimeout(() => spot.classList.add('on'), delay);
}
function refreshFoot() {   // 한글 답 뒤: 아래 덩어리만 다시 그린다(늦게 뜨는 등장 움직임은 끈다)
  const v = app.querySelector('.view.night'); if (!v) { render(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = nightView({off: v.classList.contains('off')});
  const fresh = tmp.querySelector('.foot'); fresh.querySelectorAll('.seoha,.acts,.askq').forEach(el => { el.style.animation = 'none'; });
  v.querySelector('.foot').replaceWith(fresh);
  const fp = tmp.querySelector('.poem'), op = v.querySelector('.poem');   // 10z: 답하면 두 줄 기록 → 원래 시(누르는 낱말 있음)
  if (fp && op && fp.className !== op.className) { [fp, ...fp.querySelectorAll('*')].forEach(x => { x.style.animation = 'none'; }); op.replaceWith(fp); if (!calm()) fp.animate([{opacity: 0}, {opacity: 1}], {duration: 420, easing: 'ease-out'}); }
  v.classList.toggle('asking', P.hangul === 'ask');   // 10e: 답하면 시가 원래 크기로
  const sy = fresh.querySelector('.say'); if (sy) { sy.tabIndex = -1; sy.focus({preventScroll: true}); }   // 10e: 초점은 서하의 새 말로
  if (!calm()) fresh.animate([{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)'});
  const spot = tmp.querySelector('.spot');   // 답한 뒤에는 질문 동안 뺐던 자리 이름표를 다시 둔다
  if (spot && !v.querySelector('.spot')) { v.querySelector('.ph').append(spot); placeSpot(v, 700); }
}
// 답(한글): 누른 카드를 고르고 → 다음
function pressAns(b, then) {
  b.closest('.chs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  busy = true;   // 누름 뒤 기다리는 동안 다른 답 · 「나중에」를 받지 않는다
  sfx('tap'); setTimeout(() => { busy = false; then(); }, calm() ? 0 : 420);
}

let busy = false;
// 10o: 대사 듣기 — 브라우저 말소리(ko-KR). 못 쓰면 풍선은 누르지 않는 글
const TTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
if (!TTS) document.body.classList.add('no-tts');
let sayU = null;
function stopSay() { if (TTS) { sayU = null; window.speechSynthesis.cancel(); } document.querySelectorAll('.say-play.on').forEach(x => x.classList.remove('on')); document.querySelectorAll('.say-all.on').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); }
function speakAll(chip) {   // 10z: 세 말을 차례로 — 다시 누르면 멈춤
  if (!TTS) return;
  if (chip.classList.contains('on')) { stopSay(); return; }
  const rows = [...chip.closest('.cap').querySelectorAll('.say-play[data-say]')]; let i = 0;
  const next = () => { if (i >= rows.length) { chip.classList.remove('on'); chip.setAttribute('aria-pressed', 'false'); return; } const b = rows[i++]; speakKo(b.dataset.say, b, next); chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true'); };
  next();
}
function speakKo(t, b, done) {
  if (!TTS) return;
  const s = window.speechSynthesis;
  stopSay();
  const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; u.rate = .92;
  const v = s.getVoices().find(x => /^ko/i.test(x.lang)); if (v) u.voice = v;
  sayU = u; b.classList.add('on');
  u.onend = u.onerror = e => { if (sayU === u) { sayU = null; b.classList.remove('on'); if (done && !(e && e.type === 'error')) done(); else document.querySelectorAll('.say-all.on').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); } };
  s.speak(u);
}
// 10e: 기록 판 — 닫으면 연 단추로 초점을 돌려준다
let opener = null;
function closeSheet() { app.querySelector('.sheet')?.classList.remove('on'); app.querySelector('.view')?.classList.remove('lock'); app.querySelectorAll('.view > [inert]').forEach(c => { c.inert = false; }); if (opener && opener.isConnected) opener.focus({preventScroll: true}); opener = null; }
// 목표 저장 동의가 꺼져 있어 고르기를 멈춤: 그 줄 아래에 한 줄, 초점은 체크 상자로
function needConsent() {
  const v = app.querySelector('.view'), box = v && v.querySelector('[data-consent]'), msg = v && v.querySelector('.consent-need');
  if (!box || !msg) return;
  const lb = (state.consent && state.consent.label) || '';
  msg.textContent = P.lang === 'ko' ? `먼저 ${lb}${josa(lb, '을', '를')} 켜 주세요` : ui('먼저 {label}을 켜 주세요', {label: lb});
  msg.hidden = false; box.focus();
}
let LAST = null;   // 마지막으로 연 할 일(첫 연습을 마치고 돌아올 때 문 두 짝에 그 사진)
app.addEventListener('change', e => { if (e.target.matches('[data-consent]')) { L.consent = e.target.checked; const m = app.querySelector('.consent-need'); if (m && e.target.checked) m.hidden = true; } });
app.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || busy) return;
  if (b.classList.contains('ri')) return;   // 줄 칸은 줄이 처리한다
  if (b.dataset.say !== undefined) { speakKo(b.dataset.say, b); return; }
  if (b.dataset.sayall !== undefined) { speakAll(b); return; }
  if (b.dataset.step && RAIL) { sfx('tap'); const n = RAIL.el.querySelectorAll('.ri').length; RAIL.go(Math.max(0, Math.min(n - 1, RAIL.target + Number(b.dataset.step)))); RAIL.el.focus({preventScroll: true}); return; }   // 10l: 넓은 화면 ‹ ›
  const act = b.dataset.act;
  if (act === 'sound') { setSound(!S.on); return; }
  if (b.dataset.open) { opener = b; sheet(b.dataset.open); return; }
  if (act === 'close') { closeSheet(); return; }
  if (b.dataset.hangul) {   // 밤 끝 화면 한글 질문: 답하면 아래 덩어리만 다시
    sfx('tap'); b.closest('.chs, .askq').querySelectorAll('[data-hangul]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const k = b.dataset.hangul;
    if (k === 'skip') { L.hangul = 'skip'; syncP(); busy = true; setTimeout(() => { busy = false; refreshFoot(); }, 460); return; }
    busy = true; TRANS = true; PENDING = null;
    Promise.all([call('answerHangul', k), wait(460)]).then(([res]) => {
      const pend = PENDING, next = pend || (res && res.view ? res : null); PENDING = null; TRANS = false; busy = false;   // 기다리는 동안 host가 보낸 더 새 state가 있으면 그것을
      // 기다리는 동안 다른 화면이나 다른 학생의 state가 왔으면 아래 덩어리만이 아니라 화면을 통째로 다시 그린다
      const moved = !!next && (next.view !== state.view || next.who !== state.who || JSON.stringify(next.student) !== JSON.stringify(state.student));
      if (res && res.error) {   // 저장 실패: 답하지 않은 채로(기다리는 동안 온 state는 받는다)
        if (pend) take(pend);
        syncP(); if (moved) { render(); focusLead(); } else { app.querySelectorAll('[data-hangul]').forEach(x => x.setAttribute('aria-pressed', 'false')); if (pend) refreshFoot(); }
        toast(ui('저장하지 못했어요. 잠시 뒤 다시 골라 주세요.')); return;
      }
      if (next) take(next); else state = {...state, hangul: k};
      syncP(); if (moved) { render(); focusLead(); } else refreshFoot();
    });
    return;
  }
  if (b.dataset.hangul3) { const k = b.dataset.hangul3; pressAns(b, () => swap({}, call('answerHangul', k))); return; }
  if (act === 'hskip') { swap({hangul: 'skip'}); return; }
  if (b.dataset.hangul2) { const k = b.dataset.hangul2; pressAns(b, () => swap({step: 'goal'}, call('answerHangul', k))); return; }
  if (act === 'h2skip') { swap({hangul: 'skip', step: 'goal'}); return; }
  if (act === 'bye') {   // 불 끔은 바로 — host에는 첫날 끝을 적게 알린다
    sfx('switch'); const v = app.querySelector('.view'); v.scrollTop = 0; v.classList.remove('enter'); v.classList.add('off');
    ramp(S.amb.amb_room, 0, 1.6); setTimeout(() => ramp(S.amb.amb_clock, 0, 2.2), 3200);
    state = {...state, view: 'off'}; syncP(); shownView = 'off';
    call('bye').then(res => { if (res && res.view) show(res); });
    return;
  }
  if (act === 'more') { sfx('paper'); swap({}, call('more')); return; }
  if (act === 'login') { call('signIn'); return; }
  if (act === 'story') { call('openStory').then(res => { if (res && res.view) show(res); }); return; }   // 이야기에서 돌아오면 새 기록으로
  if (act === 'tab') { call('openTab', b.dataset.tab === 'play' ? 'play' : 'learn'); return; }
  if (act === 'all') { call('openAll'); return; }
  if (act === 'me') { call('openMe'); return; }
  if (act === 'd2go') { sfx('paper'); call('seen', 'day2'); swap({step: ['ask', 'skip'].includes(P.hangul) ? 'hangul' : 'goal'}); return; }
  if (act === 'start') {
    stopSay();
    const opts = optionsFor(), i = RAIL ? RAIL.center : pickIndex(opts), o = opts[i], el = RAIL && RAIL.el.querySelectorAll('.ri')[i];
    if (!o) return;
    busy = true;
    postmark(el).then(() => { busy = false; LAST = {photo: o.ph}; return call('open', o.item.token); }).then(res => { if (res && res.view) show(res); });
    return;
  }
  if (act === 'goal') {
    const i = RAIL ? RAIL.center : 0, [k, , ph] = GOALS[i], el = RAIL && RAIL.el.querySelectorAll('.ri')[i];
    const box = app.querySelector('[data-consent]'), consent = !!(box && box.checked);
    busy = true;
    postmark(el).then(async () => {
      TRANS = true; PENDING = null;
      const res = await call('chooseGoal', k, {consent});
      if (res && res.error === 'needConsent') { TRANS = false; busy = false; needConsent(); flush(); return; }
      if (res && res.error === 'goalWindow') { TRANS = false; busy = false; toast(ui('시험 정보가 있어서 학습 목표 창에서 바꿔요.')); flush(); return; }   // 시험 정보가 있는 학생: 학습 목표 창이 열렸다(닫히면 host가 새 state를 보낸다)
      if (res && res.error) { TRANS = false; busy = false; toast(ui('저장하지 못했어요. 잠시 뒤 다시 골라 주세요.')); flush(); return; }
      const next = res && res.view ? res : PENDING; if (next === PENDING) PENDING = null;
      if (!next) { TRANS = false; busy = false; return; }   // 고르지 못함(host가 알림을 띄운다) — 화면은 그대로
      await doors(ph, () => { take(next); syncP(); render(); focusLead(); });
      TRANS = false; busy = false; flush();
    });
    return;
  }
  if (act === 'later') { swap({}, call('chooseGoal', 'later_', {consent: false})); return; }
  if (act === 'regoal') { swap({goal: '', step: 'goal', prev: P.goal}); return; }   // 10e: 바꾸기 — 고른 목표에서 줄이 열린다
  if (act === 'keep') { swap({goal: undefined, step: undefined, prev: undefined}); return; }   // 10e: 「그대로 둘게요」 — 고른 목표로 되돌아간다
});
document.addEventListener('keydown', e => {   // 10g: 판이 열린 동안 Tab은 판 안에서 돌고, Esc는 초점이 어디 있든 닫는다
  const sh = app.querySelector('.sheet.on'); if (!sh) return;
  if (e.key === 'Escape') { closeSheet(); return; }
  if (e.key !== 'Tab') return;
  const f = [...sh.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled);
  if (!f.length) { e.preventDefault(); return; }
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey ? i <= 0 : (i < 0 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
});
app.addEventListener('click', e => { const s = e.target.closest('.sheet'); if (s && e.target === s) closeSheet(); });

/* ── host와 주고받기(HOST.md) ── */
function flush() { if (PENDING && !TRANS) { const n = PENDING; PENDING = null; show(n); } }
function show(next) {
  if (!next || typeof next !== 'object') return;
  if (TRANS) { PENDING = next; return; }
  const prev = state;
  if (!prev) { take(next); syncP(); render(); return; }
  // 불 끔은 이미 화면에서 했다
  if (prev.view === 'off' && next.view === 'off' && app.querySelector('.view.night.off')) { take(next); syncP(); return; }
  // 첫날 첫 연습을 마치고 돌아옴: 문 두 짝 사이에 다음 화면(시안 10z6 넘김)
  if (prev.view === 'more' && next.view === 'more' && !prev.after && next.after) {
    busy = true; TRANS = true;
    doors((LAST && LAST.photo) || photoKey(prev.plan && prev.plan.photo), () => { take(next); syncP(); render(); focusLead(); })
      .then(() => { busy = false; TRANS = false; toast(ui('첫 연습을 마쳤어요'), true); flush(); });   // 10s: 위 칩이 같은 말 — 알림은 화면 읽기에만
    return;
  }
  if (prev.view !== next.view) { swap({}, Promise.resolve(next)); return; }
  take(next); syncP(); render();
}
async function call(name, ...args) {
  try { const f = host && host[name]; return typeof f === 'function' ? await f.apply(host, args) : null; }
  catch (e) { console.warn('[world-front]', name, e); return null; }
}
const api = Object.freeze({
  show,
  setLang(lang) { if (!['ko', 'en', 'mn'].includes(lang) || lang === LANG) return; LANG = lang; if (state) { state = {...state, lang}; syncP(); render(); } else P.lang = lang; },
  setSound(on) { setSound(!!on); },
  wake() { try { ctx().resume?.(); } catch {} }
});
// 부모 창(같은 출처)의 host. 틀 안인데 아직 없으면 잠깐 기다리고, 혼자 열린 판은 가짜 host로
async function findHost() {
  const get = () => { try { return window.parent !== window ? window.parent.SYNKFrontHost || null : null; } catch { return null; } };
  let h = get();
  for (let i = 0; !h && window.parent !== window && i < 30; i++) { await wait(50); h = get(); }
  if (h) return h;
  // 앱 틀 안에서는 가짜 학생 화면을 띄우지 않는다 — host가 끝내 없으면(앱이 틀을 떼는 중) 빈 채로 둔다. 가짜 host는 이 폴더를 혼자 열었을 때만.
  if (window.parent !== window) return null;
  const {createDevHost} = await import('./dev-host.mjs');
  return createDevHost();
}
const host = await findHost();
if (host) host.ready(api);
