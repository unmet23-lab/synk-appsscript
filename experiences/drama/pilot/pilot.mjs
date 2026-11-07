// 드라마 말하기 시범판 화면(2026-10-31). 통로 둘(11-02, 설계 experiences/drama/qa/WORLD올리기-20261102/설계.md):
//  · 이PC 시범 서버(tools/drama-pilot.mjs): /api/bootstrap·take·reveal·reset, 리허설에서만 /api/learning.
//  · WORLD 안(synk.im/world/?drama=1 → 같은 출처 게임 틀): 강의는 정적 world-lesson.json, 받아쓰기 · 판정은 부모 창의 드라마 통로
//    (SYNKDramaHost — 계정의 talk world-speaking take를 부른다, 이 창은 토큰을 모른다), 「혼자 해 봄」은 takes.mjs 규칙으로 이 창이 정한다.
// 지키는 것(설계 검토 반영):
//  · 녹음·받아 적은 글은 이 창의 메모리에만. 콘솔·저장소·내려받기 없음. ObjectURL은 세션 보관함에서만 만들고 비우기·다시하기·창 닫기에 해제.
//  · 장면 안에서는 판정을 말로 보여 주지 않는다 — 인물 되묻기 → 카드 펼침 → 통과(어긋남 셋까지). 안 들림(unclear·no_speech)은 따로 세어 되묻기만, 세 번이면 스스로 확인.
//  · 코치 노트는 장면이 끝난 뒤 하나만: 줄마다 마지막 판정 테이크의 note만 후보. 없으면 「다른 말로 한번 더」 연습(교정 아님).
//  · 바깥 틀은 이야기 속 유학생 + 이야기 밖 코치(결정 10-31 「싱크타운 다시 짜기」 ③). 컷·촬영·감독 말과 소리를 쓰지 않는다.
//    코치 목소리는 녹음 전이면(audio null) 소리·자막 없이 패널 글만 둔다.
//  · 녹음 중에는 어떤 소리도 틀지 않고, 소리가 나는 동안에는 녹음을 시작하지 않는다(스피커 소리가 「내 대답」으로 받아 적히지 않게).
//  · 새 상황의 한국어 모범은 /api/reveal 응답으로만 보인다. 첫 제출 전 화면에 한국어 답·첫 글자가 없다.
//  · 마이크 거절·미지원은 한 번만 묻고, 이후엔 녹음 없이 따라 읽기로 이어 간다. 받아쓰기가 안 되면 자동으로 잘했다고 하지 않는다.
//  · 겉은 장면 화면 = 시네마 자막(11-02, docs/디자인/드라마_장면/README.md): 대사는 자막, 아래 유리 카드, 녹음은 음성 구(Orbloom)를 누른다.
//    구의 소리 세기는 녹음 스트림에서 이 창 안에서만 잰다(마이크를 따로 열지 않고, 소리를 밖으로 보내지 않는다).
//    크롬 칩 · 불꽃은 해낸 순간(장면에서 되물은 뒤 스스로 고침 · 테이크 2 통과 · 새 상황 통과)에만.
//  · 학습 기록(Atlas Trail, 응답 꼴 spoken, 11-02): 차례마다 보임 하나 · 테이크마다 시도 하나(atlas-learning.js). WORLD 계정 학습 호스트가
//    있을 때만 남고, 호스트는 학습 기록 동의가 켜진 계정에서만 보낸다 — 없으면 아무것도 남지 않는다. 받아 적은 글 · 소리는 넣지 않고,
//    「혼자 해 봄」 여부는 서버가 테이크 응답의 trail로 정한다.
import { STR, endingFix } from './strings.mjs';
import { newAttemptState, resetAttempts, beginTake, talkObservation, nextCount, settleTake } from './takes.mjs';

const $ = (id) => document.getElementById(id);
const ui = { stage: $('stage'), still: $('still'), loop: $('loop'), reply: $('reply'), subs: $('subs'), slate: $('slate'), panel: $('panel'), dialog: $('dialog'), voice: $('voice'), chip: $('analysisChip'), lang: $('langBtn'),
 app: $('app'), ep: $('epTag'), prog: $('prog'), win: $('win'), winText: $('winText'), mic: $('mic'), orbBtn: $('orbBtn'), orbCanvas: $('orbCanvas'), mstate: $('mstate'), micSub: $('micSub') };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPRING = 'cubic-bezier(.23,1,.32,1)';
// fill 'both': 늦게 시작하는 움직임(delay)도 기다리는 동안 첫 모습(흐림·투명)을 유지한다 — 먼저 또렷하게 보였다 사라지지 않게.
const anim = (el, kf, o) => (reduceMotion() || !el?.animate ? null : el.animate(kf, { fill: 'both', easing: SPRING, ...o }));
// 자막 · 표지는 아래 판(카드 + 구) 위에서 끝나게 — 판 높이를 재어 --dock-h로 넘긴다(짧은 화면에서 겹치지 않게).
const dockEl = document.querySelector('.dock');
// 판이 화면을 거의 다 덮으면(긴 기록 · 새 상황 결과) 자막 · 표지를 둘 자리가 없어 숨긴다 — 같은 말은 카드에 있다.
// 자막 · 표지를 띄우는 순간에도 직접 잰다(크기 감시는 다음 그림 때 돌아 한 박자 늦을 수 있다).
function syncDock() {
 if (!dockEl) return;
 const dh = Math.ceil(dockEl.getBoundingClientRect().height);
 ui.app.style.setProperty('--dock-h', `${dh}px`);
 ui.app.classList.toggle('crowded', dh > ui.app.clientHeight - 230);
 // 표지는 키가 커서 자막보다 먼저 얼굴에 닿는다 — 표지 키(약 140)와 얼굴 자리(화면 위 30%)를 뺀 만큼만 판이 높을 때 띄운다.
 ui.app.classList.toggle('slate-tight', dh > ui.app.clientHeight * .7 - 174);
}
if (window.ResizeObserver && dockEl) new ResizeObserver(syncDock).observe(dockEl);

// bootstrap이 아래 칸을 넘기지 않아도 돌도록 둔 기본값(content.mjs와 같은 파일).
const FALLBACK = {
 reasks: [
  { text: '응? 응? 뭐라고요?', audio: 'media/senior-ask-1.mp3' },
  { text: '미안해요, 여기가 시끄러워서 잘 못 들었어요.', audio: 'media/senior-ask-2.mp3' },
  { text: '천천히 해도 돼요.', audio: 'media/senior-ask-3.mp3' },
 ],
 coach: {
  noteEnding: { text: '끝에 \'요\'를 붙여 봐요. 이 장면을 다시 해 볼까요?', audio: null },
  noteOther: { text: '이 장면을 다시 해 볼까요?', audio: null },
  wrap: { text: '오늘은 여기까지! 수고했어요.', audio: null },
 },
 assets: { listenLoop: 'media/taeo-listen.mp4', poster: 'media/taeo-still.webp', backdrop: 'media/taeo-still-blur.webp', nextImage: 'media/next-fair.webp' },
};
const NOTE_ORDER = { ending: 0, length: 1, missing: 2 };

// 화면 언어(11-03, 몽골 시범 §7 ②): WORLD에서 고른 언어를 따른다 — 같은 출처 localStorage 'synk.world.lang'(brand-opening/world-lang.mjs와
// 같은 키 · 값 ko · en · mn), 주소의 ?lang=이 먼저. 고르기 전이면 기기 언어(한국어 · 키릴 몽골어 · 그 밖은 영어). 언어 단추는 한국어와 학습자
// 언어(영어 또는 몽골어)를 오간다. 대사 · 모범 · 받아 적은 글 같은 학습 내용은 늘 한국어다.
const LANGS = ['ko', 'en', 'mn'];
const deviceLang = () => { const d = String(navigator.language || 'ko').toLowerCase().split(/[-_]/); return d[0] === 'ko' ? 'ko' : (d[0] === 'mn' || d[0] === 'khk') && !d.includes('mong') && !d.includes('cn') ? 'mn' : 'en'; };
function startLang() {
 const ok = (v) => (LANGS.includes(v) ? v : null);
 try { const q = ok(new URLSearchParams(location.search).get('lang')); if (q) return q; } catch {}
 try { const saved = ok(localStorage.getItem('synk.world.lang')); if (saved) return saved; } catch {}
 return deviceLang();
}
const firstLang = startLang();
const savedLang = () => { try { return localStorage.getItem('synk.world.lang'); } catch { return null; } };
const S = {
 lang: firstLang,
 home: firstLang === 'ko' ? (savedLang() === 'mn' || deviceLang() === 'mn' ? 'mn' : 'en') : firstLang, // 언어 단추가 한국어에서 넘어갈 학습자 언어
 boot: null, csrf: '', epoch: 0, maxSeconds: 20,
 consent: null,            // 'yes' | 'no' | null(아직 안 물음)
 mic: 'unknown',           // 'ok' | 'denied' | 'unsupported' | 'unknown'
 micNoticeShown: false,
 lines: new Map(),         // lineId → 줄 상태
 takes: [],                // {id, lineId, phase, n, blob, url}
 retake: null,             // {lineId, mode:'note'|'practice', note, noteTakeId, take2Id}
 transfer: null,
 // 촬영 이력(지금 동의 상태와 따로): 이번 실행에서 녹음을 받아쓰기로 보낸 적이 있는지.
 sentRun: false,
 // 새 상황 모범을 이 창에서 본 적이 있는지(다시하기에도 남김 — 서버 transferRevealed와 같은 뜻, 새 보관 없음).
 revealedEver: false,
 firstExposure: null,      // bootstrap·reset이 준 값(이번 실행 시작 때 새 상황이 처음인지)
 pendingB: null,           // 첫 화면 「남겨 둔 새 상황」 카드: true | false | null(모름 — 다시 묻는다)
 upload: null, rec: null, micWait: null, playing: false, listenLoop: '', loopHeld: false,
 step: 'boot', render: null,
 orb: null, orbAction: null, cardKey: null, // 음성 구 · 구를 눌렀을 때 할 일 · 지금 떠 있는 대사 카드(올라오는 움직임은 새 카드에만)
};
const t = () => STR[S.lang];
// 대사 뜻 · 상황 글은 학습자 언어로 — 몽골 학습자는 화면을 한국어로 바꿔도 뜻은 몽골어다(몽골어 판이 없으면 영어).
const meaningOf = (item) => (S.home === 'mn' && item?.meaningMn) || item?.meaning || '';
const meaningLang = (item) => (S.home === 'mn' && item?.meaningMn ? 'mn' : 'en');
const tx = (key, ...a) => { const v = t()[key]; return typeof v === 'function' ? v(...a) : v; };

/* ───────── DOM 도우미(동적 글은 늘 텍스트 노드로) ───────── */
function h(tag, props = {}, ...kids) {
 const n = document.createElement(tag);
 for (const [k, v] of Object.entries(props || {})) {
  if (v == null || v === false) continue;
  if (k === 'class') n.className = v;
  else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
  else if (k === 'data') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
  else if (k === 'text') n.textContent = v;
  else if (v === true) n.setAttribute(k, '');
  else n.setAttribute(k, v);
 }
 for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
 return n;
}
// busy: 녹음 · 받아 적기 동안 카드를 보이되 누르지도 키보드로 닿지도 못하게(inert).
const setBusy = (on) => { ui.panel.classList.toggle('busy', on); ui.panel.inert = on; };
const panel = (...nodes) => { setBusy(false); ui.panel.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false)); ui.panel.scrollTop = 0; syncPlayable(); syncDock(); };
// 대사 카드가 새로 뜰 때만 아래에서 탄력 있게 올라온다(같은 차례를 다시 그릴 때는 그대로).
function cardIn(key) {
 if (S.cardKey === key) return;
 S.cardKey = key;
 // fill 'backwards': 끝난 뒤에는 움직임 값을 남기지 않는다 — 남기면 .busy의 흐려짐(opacity)이 먹지 않는다.
 anim(ui.panel, [{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'translateY(-6px)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 650, fill: 'backwards' });
}

/* ───────── 위 띠: 회차 알약 · 진행 띠 ───────── */
const PHASE_TAG = { intro: 'EP.01 · Scene 2', scene: 'EP.01 · Scene 2', take2: 'EP.01 · One more', transfer: 'New situation', wrap: 'EP.01 · Today' };
function progCells() { return S.boot ? sceneItems().length + 3 : 10; }
function setProg(n) {
 const total = progCells();
 if (ui.prog.children.length !== total) ui.prog.replaceChildren(...Array.from({ length: total }, () => h('i')));
 [...ui.prog.children].forEach((c, k) => c.style.setProperty('--p', k < n ? 1 : 0));
}
function setPhase(phase, n) { ui.ep.textContent = PHASE_TAG[phase] || PHASE_TAG.scene; if (n != null) setProg(n); }

/* ───────── 음성 구(Orbloom) ───────── */
const ORB_THEME = { preset: 'nebula-violet-02', id: 'synk-drama', seed: 2.4,
 colors: { base: '#0d0b1c', interior: '#030208', accents: ['#8b7bff', '#6fd3ff', '#ffffff'] },
 appearance: { intensity: 1, detail: .78, glass: .5, glow: .95 }, motion: { speed: .8, drift: .6 },
 audioResponse: { brightness: 1.25, motion: .65, pulse: .95 } };
async function initOrb() {
 try {
  const { createOrb, createOrbTheme } = await import('./orbloom.mjs');
  S.orb = createOrb(ui.orbCanvas, { theme: createOrbTheme(ORB_THEME), quality: 'balanced', state: 'idle' });
 } catch { ui.orbBtn.querySelector('.orb-motion')?.classList.add('orb-no-webgl'); }
}
// 구 상태와 아래 라벨(고정폭 영문 — 한글은 넣지 않는다). action이 있으면 구를 눌러 그 일을 한다.
function orbMode(state, label, { action = null, aria = '', sub = null } = {}) {
 try { S.orb?.setState(state); } catch {}
 ui.mstate.textContent = label;
 ui.mstate.classList.toggle('on', state === 'speaking' || state === 'listening');
 S.orbAction = action;
 // 누를 수 없음(disabled)과 흐리게 보임은 나눈다 — 흐린 구는 「소리가 끝나면 누를 수 있음」(wait)일 때만, 해낸 순간은 밝게.
 ui.orbBtn.disabled = !action || (state === 'listening' && S.playing);
 ui.orbBtn.classList.toggle('wait', state === 'listening' && S.playing);
 ui.orbBtn.setAttribute('aria-label', aria || label);
 ui.micSub.replaceChildren(...(sub ? [sub] : []));
 ui.mic.hidden = false;
 syncDock();
}
function hideMic() { S.orbAction = null; ui.mic.hidden = true; syncDock(); try { S.orb?.setState('idle'); S.orb?.setAudioLevel(0); } catch {} }
ui.orbBtn.addEventListener('click', () => { const f = S.orbAction; if (f && !ui.orbBtn.disabled) f(); });
// 녹음 스트림의 세기를 구에 넣는다. 돌려줌: 끊는 함수.
function orbListen(stream) {
 if (!S.orb || !stream) return () => {};
 try {
  const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
  const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0;
  const mute = ctx.createGain(); mute.gain.value = 0;
  src.connect(hp); hp.connect(an); an.connect(mute); mute.connect(ctx.destination);
  ctx.resume().catch(() => {});
  const detach = S.orb.attachAudioSource(an);
  return () => { try { detach?.(); } catch {} try { src.disconnect(); hp.disconnect(); an.disconnect(); mute.disconnect(); ctx.close(); } catch {} try { S.orb.setAudioLevel(0); } catch {} };
 } catch { return () => {}; }
}

/* ───────── 해낸 순간 — 크롬 칩 · 작은 불꽃(여기만) ───────── */
function celebrate(s) {
 ui.winText.textContent = tx('winChip');
 ui.win.hidden = false;
 anim(ui.win, [{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.06)', offset: .65 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 600 });
 if (!reduceMotion()) {
  const cols = ['#6fd3ff', '#8b7bff', '#ffcf5c', '#fff'];
  for (let i = 0; i < 14; i++) {
   const p = h('i', { class: 'spark', style: `background:${cols[i % 4]};left:50%;top:39%` }); ui.app.append(p);
   const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
   p.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.3)` }], { duration: 800 + Math.random() * 300, easing: SPRING, fill: 'forwards' }).onfinish = () => p.remove();
  }
 }
 try { S.orb?.setState('success'); } catch {}
 const hide = () => { const a = anim(ui.win, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-10px) scale(.96)' }], { duration: 300 }); if (a) a.onfinish = () => { ui.win.hidden = true; }; else ui.win.hidden = true; };
 setTimeout(hide, 1500); // 단계가 바뀌어도 칩은 제때 사라진다
}
function applyStaticText() {
 document.documentElement.lang = S.lang;
 for (const n of document.querySelectorAll('[data-s]')) n.textContent = tx(n.dataset.s);
 ui.lang.textContent = S.lang === 'ko' ? (S.home === 'mn' ? 'MN' : 'EN') : tx('lang');
 ui.lang.setAttribute('aria-label', S.lang !== 'ko' ? '한국어로 보기' : S.home === 'mn' ? 'Монгол хэлээр харах' : 'Switch to English');
 updateChip();
}

/* ───────── 단계 정리 묶음 ───────── */
let scope = null;
function newScope() {
 if (scope) scope.dispose();
 const ac = new AbortController(); const timers = new Set(); const offs = [];
 const s = {
  epoch: S.epoch, alive: true, signal: ac.signal,
  timer(fn, ms) { const id = setTimeout(() => { timers.delete(id); if (s.alive) fn(); }, ms); timers.add(id); return id; },
  on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); offs.push(() => target.removeEventListener(ev, fn, opts)); },
  dispose() { if (!s.alive) return; s.alive = false; ac.abort(); timers.forEach(clearTimeout); timers.clear(); offs.splice(0).forEach((f) => f()); stopRecorder(true); stopSound(); closeDialog(); },
 };
 scope = s; return s;
}
const live = (s) => !!s && s.alive && s.epoch === S.epoch;
const sleep = (s, ms) => new Promise((res) => { s.timer(res, ms); s.signal.addEventListener('abort', () => res(), { once: true }); });

/* ───────── 소리·영상 ───────── */
function setPlaying(on) { S.playing = on; document.body.classList.toggle('is-playing', on); syncPlayable(); }
function syncPlayable() {
 // 소리가 나는 동안 녹음 단추를 막고, 녹음하는 동안 소리 단추를 막는다.
 for (const b of ui.panel.querySelectorAll('[data-rec]')) b.disabled = S.playing;
 for (const b of ui.panel.querySelectorAll('[data-sound]')) b.disabled = !!S.rec;
 if (S.orbAction && !S.rec && !S.upload) { ui.orbBtn.disabled = S.playing; ui.orbBtn.classList.toggle('wait', S.playing); }
}
// 재생은 늘 하나만 살아 있다(11-07). 멈춤(stopSound)이 오면 번호를 올리고 살아 있던 재생을 바로 접는다 — 듣기 · 안전 시계를 모두 떼고
// 기다리던 쪽에는 false를 준다(전에는 다시 듣기가 앞 소리를 끊으면 앞 약속이 끝내 안 풀렸다). 접힌 재생의 늦은 소식(실패 · 정보 받음 ·
// 구간 끝)은 자기 번호가 아니면 미디어를 멈추거나 「재생 중」을 풀지 않는다 — 지금 나오는 소리를 건드리지 않게.
let playGen = 0, current = null;
function stopSound() {
 playGen++;
 const c = current; current = null; if (c) c();
 for (const m of [ui.voice, ui.reply]) { try { m.pause(); } catch {} }
 ui.voice.removeAttribute('src'); try { ui.voice.load(); } catch {}
 if (S.playing) setPlaying(false);
}
// 재생 끝 소식(ended)이 끝내 오지 않는 브라우저 · 기기(헤드리스 · 블루투스 전환 등)에서는 「재생 중」이 풀리지 않아 녹음 단추가
// 잠긴 채 장면이 멈췄다(11-07). 재생이 시작되면 남은 길이에 여유를 더한 때를, 시작조차 안 되면 기다릴 만큼을 재고, 그때까지
// 안 끝나면 멈추고 다음으로 잇는다 — 느린 망에서 잠깐 멈추는 정도로는 걸리지 않게 넉넉히 둔다.
const END_GRACE_MS = 8000, END_CAP_S = 30, START_WAIT_MS = 15000;
function endGuard(m, s, left, isDone, finish) {
 const started = { v: false };
 let lastAt = -1, rearms = 0;
 const arm = (sec) => s.timer(check, (Number.isFinite(sec) ? Math.max(0, sec) : END_CAP_S) * 1000 + END_GRACE_MS);
 // 시계가 울리면: 아직 나아가는 중이면(느린 망) 남은 만큼 다시 기다리고, 멈춰 있으면 끝 근처일 때만 끝난 것으로 —
 // 아니면 false로 풀어 대사를 통째 자막 · 다시 듣기로 보인다(반만 듣고 자막이 사라진 채 넘어가지 않게).
 function check() {
  if (isDone()) return;
  const at = m.currentTime;
  if (!m.paused && !m.ended && at > lastAt + 0.5 && rearms < 4) { lastAt = at; rearms++; arm(left()); return; }
  const near = m.ended || !(left() > 1);
  try { m.pause(); } catch {}
  finish(near);
 }
 const onPlaying = () => {
  if (started.v) return; started.v = true;
  lastAt = m.currentTime; arm(left());
 };
 m.addEventListener('playing', onPlaying);
 s.timer(() => { if (!isDone() && !started.v) { try { m.pause(); } catch {} finish(false); } }, START_WAIT_MS);
 return () => m.removeEventListener('playing', onPlaying);
}
function playUrl(url, s) {
 return new Promise((res) => {
  if (!url || !live(s) || S.rec) return res(false);
  stopSound();
  const gen = playGen, m = ui.voice; let settled = false; let unguard = () => {};
  const done = (ok) => {
   if (settled) return; settled = true; unguard();
   m.removeEventListener('ended', onEnd); m.removeEventListener('error', onErr); s.signal.removeEventListener('abort', onAbort);
   if (current === cancel) current = null;
   if (gen === playGen) setPlaying(false);
   res(ok);
  };
  const cancel = () => done(false);
  const onEnd = () => done(true); const onErr = () => done(false); const onAbort = () => { if (gen === playGen) { try { m.pause(); } catch {} } done(false); };
  m.addEventListener('ended', onEnd); m.addEventListener('error', onErr); s.signal.addEventListener('abort', onAbort, { once: true });
  current = cancel;
  unguard = endGuard(m, s, () => m.duration - m.currentTime, () => settled || gen !== playGen, done);
  m.src = url; setPlaying(true);
  m.play().catch(() => done(false));
 });
}
function playVideo(url, from, to, s) {
 return new Promise((res) => {
  if (!url || !live(s) || S.rec) return res(false);
  stopSound();
  const gen = playGen, v = ui.reply; let settled = false; let unguard = () => {}; let go = null;
  // 정보 받음(loadedmetadata)을 기다리던 go도 접을 때 뗀다 — 먼저 접힌 뒤 늦게 온 소식이 접힌 영상을 혼자 틀지 않게(11-07)
  const done = (ok) => {
   if (settled) return; settled = true; unguard();
   if (go) v.removeEventListener('loadedmetadata', go);
   v.removeEventListener('ended', onEnd); v.removeEventListener('error', onErr); v.removeEventListener('timeupdate', onTime); s.signal.removeEventListener('abort', onAbort);
   if (current === cancel) current = null;
   if (gen === playGen) { try { v.pause(); } catch {} setPlaying(false); }
   res(ok);
  };
  const cancel = () => done(false);
  const onEnd = () => done(true); const onErr = () => done(false); const onAbort = () => done(false);
  const onTime = () => { if (to && v.currentTime >= to - 0.04) done(true); };
  v.addEventListener('ended', onEnd); v.addEventListener('error', onErr); v.addEventListener('timeupdate', onTime); s.signal.addEventListener('abort', onAbort, { once: true });
  current = cancel;
  unguard = endGuard(v, s, () => (to || v.duration) - v.currentTime, () => settled || gen !== playGen, done);
  if (!v.src.endsWith(url)) v.src = url;
  go = () => {
   if (settled || gen !== playGen) return;
   if (S.rec || !live(s)) { done(false); return; }
   try { v.currentTime = from || 0; } catch {} v.muted = false; setPlaying(true); v.play().catch(() => done(false));
  };
  if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
 });
}
// listen: 그 줄의 듣는 고리(쇼케이스 영상을 넣었으면 그 장면의 고리, 아니면 기본 고리).
// 쇼케이스 고리는 첫 그림에 멈춰 두었다가 녹음을 시작할 때 처음부터 돈다(startHeldLoop) — 영상판에서 학습자 줄과 듣는 반응이 맞게.
// 녹음을 못 하는 차례(마이크 거절·미지원 — 따라 읽기)는 녹음 시작이 없으므로 멈춰 두지 않고 바로 돌린다.
// 고리 파일을 바꿀 때는 첫 그림이 뜰 때까지 정지 사진 층을 두어 검은 깜빡임이 녹화에 들어가지 않게 한다.
function stageMode(mode, listen = null) {
 const token = (stageMode.n = (stageMode.n || 0) + 1);
 ui.stage.dataset.mode = mode;
 S.loopHeld = false;
 if (mode === 'listen') {
  const url = listen || S.listenLoop;
  if (url && !ui.loop.src.endsWith(url)) {
   ui.loop.src = url;
   ui.stage.dataset.mode = 'still';
   ui.loop.addEventListener('loadeddata', () => { if (stageMode.n === token) ui.stage.dataset.mode = 'listen'; }, { once: true });
  }
  ui.loop.muted = true;
  if (listen && !micUnusable()) { S.loopHeld = true; try { ui.loop.pause(); ui.loop.currentTime = 0; } catch {} }
  else ui.loop.play().catch(() => {});
 } else { try { ui.loop.pause(); } catch {} }
}
function startHeldLoop() {
 if (!S.loopHeld) return;
 S.loopHeld = false;
 try { ui.loop.currentTime = 0; } catch {}
 ui.loop.play().catch(() => {});
}
// 그 차례의 쇼케이스 고리: 장면에서 아직 어긋남이 없는 첫 시도면 listenFirst(C3), 그다음은 listen(C2·C4).
const listenOf = (item, ctx) => (ctx.phase === 'scene' && !line(item.id).misses && item.listenFirst) || item.listen || null;
const subsShowing = (ko) => !!ko && ui.subs.querySelector('.ko')?.textContent === ko;
// 자막: 말하는 사람(고정폭 영문) · 대사 · 뜻. motion 'words'는 낱말마다 110ms로 흐림에서 떠오르고, 'cue'는 넘어가는 화면이라 60ms로 더 빠르게(읽을 시간을 먹지 않게), 'pop'은 0.6배에서 톡 튀어 들어온다(되묻기). 글의 \n은 한 화면 안 줄바꿈.
function subs(ko, meaning, who, motion = null, meanLang = 'en') {
 if (!ko) { ui.subs.replaceChildren(); return; }
 syncDock();
 const words = [];
 const kids = ko.split('\n').flatMap((row, r) => {
  const ws = row.split(' ').map((w) => h('span', { class: 'w' }, w));
  words.push(...ws);
  return [...(r ? [' ', h('br')] : []), ...ws.flatMap((w, i) => (i ? [' ', w] : [w]))];
 });
 const line = h('p', { class: 'ko', lang: 'ko' }, kids);
 const prevWho = ui.subs.querySelector('.who')?.textContent;
 const whoEl = who ? h('span', { class: 'who' }, who) : null;
 const meanEl = meaning ? h('p', { class: 'mean', lang: meanLang }, meaning) : null;
 ui.subs.replaceChildren(...[whoEl, line, meanEl].filter(Boolean));
 if (!motion) return;
 if (prevWho !== who) anim(whoEl, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 350 });
 if (motion === 'pop') anim(line, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .6 }, { transform: 'rotate(-1.5deg) scale(1.02)', offset: .8 }, { transform: 'none', opacity: 1 }], { duration: 520 });
 else { const quick = motion === 'cue'; words.forEach((w, i) => anim(w, [{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(8px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: quick ? 360 : 520, delay: i * (quick ? 60 : 110) })); }
 anim(meanEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: motion === 'pop' || motion === 'cue' ? 150 : 150 + words.length * 110 });
}
// 장면 사진은 0.6초에 떠오르고 9초 동안 1.1 → 1.0으로 아주 느리게 밀린다.
function pushStill() { anim(ui.still, [{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 9000, easing: 'linear' }); }
// 표지(회차 · 장면 끝): 작은 고정폭 영문 · 큰 제목(글자마다 70ms 흐림 → 또렷) · 빛 줄 · 작은 글. ms 뒤 사라진다(0이면 남긴다).
function hideSlate() { clearTimeout(slate.t); ui.slate.hidden = true; }
function slate(title, { k = '', sub = '', ms = 1400 } = {}) {
 // 글자마다 움직이되 줄은 낱말 사이에서만 바뀐다(몽골어 제목처럼 긴 낱말이 390폭에서 가운데로 끊기지 않게).
 const t = h('span', { class: 't' }, title.split(' ').flatMap((w, i) => [i ? ' ' : null, h('span', { class: 'w' }, [...w].map((c) => h('span', {}, c)))]));
 const bar = h('span', { class: 'bar' });
 ui.slate.replaceChildren(...[k ? h('span', { class: 'k' }, k) : null, t, bar, sub ? h('span', { class: 's' }, sub) : null].filter(Boolean));
 syncDock();
 ui.slate.hidden = false;
 anim(ui.slate, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
 // 글자 사이는 70ms, 긴 제목은 전체가 560ms 안에 — 표지가 사라지기 전에 제목이 다 보이게.
 const chars = [...t.querySelectorAll('.w > span')], step = Math.min(70, 560 / chars.length);
 chars.forEach((c, i) => anim(c, [{ opacity: 0, filter: 'blur(10px)', transform: 'translateY(14px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 650, delay: 120 + i * step }));
 anim(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 400 });
 clearTimeout(slate.t);
 if (ms) slate.t = setTimeout(() => { const a = anim(ui.slate, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 }); if (a) a.onfinish = () => { ui.slate.hidden = true; }; else ui.slate.hidden = true; }, ms);
}

/* ───────── 대화창(<dialog>) ───────── */
let dialogResolve = null;
function closeDialog(value = null) { if (ui.dialog.open) ui.dialog.close(); const r = dialogResolve; dialogResolve = null; if (r) r(value); }
function ask({ title, body, note, buttons, link = null }) {
 closeDialog();
 return new Promise((res) => {
  dialogResolve = res;
  ui.dialog.replaceChildren(h('div', { class: 'sheet-in' },
   h('h2', {}, title), body ? h('p', {}, body) : null, note ? h('p', { class: 'fine' }, note) : null,
   link ? h('p', { class: 'fine' }, h('a', { class: 'policy', href: link.href, target: '_blank', rel: 'noopener' }, link.label)) : null,
   h('div', { class: 'row' }, buttons.map((b) => h('button', { type: 'button', class: b.primary ? 'pill' : 'ghost', on: { click: () => closeDialog(b.value) } }, b.label)))));
  ui.dialog.showModal();
 });
}
ui.dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(null); });

/* ───────── 서버 ───────── */
async function api(path, { method = 'GET', json, body, signal } = {}) {
 const headers = {};
 if (method !== 'GET') headers['X-Pilot-CSRF'] = S.csrf;
 if (json) headers['Content-Type'] = 'application/json';
 const r = await fetch(path, { method, credentials: 'same-origin', headers, body: json ? JSON.stringify(json) : body, signal, cache: 'no-store' });
 let data = null; try { data = await r.json(); } catch {}
 return { ok: r.ok, status: r.status, data };
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const analysisCapable = () => !!S.boot?.capabilities?.analysis;
const analysisOn = () => analysisCapable() && S.consent === 'yes';
// 소리가 안 들린 응답(무음·받아 적은 글 없음). 녹음은 했어도 「말해 본 시도」로 세지 않는다.
const unheardData = (d) => d.status === 'no_speech' || (d.status === 'unclear' && !String(d.transcript || '').trim());

// 학습 기록: 리허설 서버가 합성 계정을 주면(bootstrap.learning) 그 계정의 호스트를 세우고, WORLD 안이면 WORLD 호스트를 그대로 쓴다.
// 기록이 실패해도 장면은 그대로 간다.
function learningCall(op, { signal, ...args }) {
 return api('/api/learning', { method: 'POST', json: { op, ...args }, signal }).then((r) => {
  // 학습 기록 서버의 거절({ok:false})은 그대로 넘겨 동기화가 판단하게 하고, 시범 서버 세션이 끝났으면 다시 열 때까지 멈춘다.
  if (r.data?.ok === false || r.ok && r.data) return r.data;
  throw Object.assign(new Error('learning'), { code: r.status === 401 ? 'AUTH_REQUIRED' : 'NETWORK_ERROR' });
 });
}
function setupTrail() {
 const D = window.DramaLearning; if (!D) return null;
 const L = S.boot?.learning;
 try {
  if (L && !window.SYNKLearningHost) D.createRehearsalHost({ accountKey: L.accountKey, revision: L.revision, connected: L.connected === true, storage: localStorage,
   transport: { get: (a) => learningCall('get', a), post: (a) => learningCall('post', a) } });
  return D.createRecorder();
 } catch { return null; }
}

/* ───────── WORLD 통로(11-02) ─────────
 * 같은 출처 부모 창(WORLD)이 이 게임 틀을 연 동안만 SYNKDramaHost = {status(), take(payload)}를 둔다. 둘 다 계정의 talk world-speaking을
 * 부르고(status · take), 계정이 바뀌면 던진다. 부모가 없는데 WORLD 공개본(html data-drama="world")이면 WORLD에서 열라고만 보인다. */
function findDramaHost() {
 try { if (window.parent !== window && window.parent.location.origin === location.origin) return window.parent.SYNKDramaHost || null; } catch { /* 다른 출처 — 계정 통로 없음 */ }
 return null;
}
const worldBuild = document.documentElement.dataset.drama === 'world';
// C(7~10일 뒤 처음 보는 문항, 설계 §17)는 시도 상태를 따로 둔다 — 같은 창에서 1화 새 상황을 먼저 냈거나 모범을 봤어도 C의 「혼자 해 봄」은 C만 본다.
const W = { host: null, lesson: null, attempts: newAttemptState(), delayedAttempts: newAttemptState(), counts: new Map(), off: false, limit: false };
const isDelayed = (lineId) => !!S.boot?.lesson?.delayed && S.boot.lesson.delayed.id === lineId;
const attemptsFor = (lineId) => (isDelayed(lineId) ? W.delayedAttempts : W.attempts);
const inWorld = () => !!W.host;
// 대사마다 녹음 상한: talk는 answerSec + 5초를 넘으면 too_long — 그보다 조금 먼저 멈춘다(recordOnce의 AUTO_STOP_MARGIN). 시범 서버는 20초.
const maxSecondsFor = (item) => (inWorld() && Number.isInteger(item?.answerSec) ? item.answerSec + 5 : 20);
const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
// 받아쓰기를 이번 판 끈다(오늘 횟수 끝 · 서버 스위치 꺼짐 · 대사 은행 판이 바뀜).
function worldAnalysisOff(why) { W[why] = true; if (S.boot) S.boot.capabilities.analysis = false; updateChip(); }
async function sendTakeWorld(item, phase, take, s) {
 const epoch = S.epoch, lineId = item.id, key = `${phase}:${lineId}`;
 const count = W.counts.get(key) || { judged: 0, unheard: 0 };
 const requestId = uuid();
 const state = attemptsFor(lineId);
 let turn; try { turn = beginTake(state, { lineId, phase, requestId }); } catch { return { kind: 'down' }; }
 const ac = new AbortController(); S.upload = ac;
 const onAbort = () => ac.abort(); s.signal.addEventListener('abort', onAbort, { once: true });
 const aborted = new Promise((res) => ac.signal.addEventListener('abort', () => res(null), { once: true }));
 S.sentRun = true;
 try {
  const data = await blobToBase64(take.blob);
  const mime = (take.blob.type || 'audio/webm').split(';')[0];
  // 취소하면 기다리기만 멈춘다 — 이미 보낸 요청은 talk가 하루 횟수에 센다.
  const r = await Promise.race([W.host.take({ action: 'take', request_id: requestId, consent: 'send-once', lang: S.lang, audio: { mime, data },
   seconds: Math.max(0.01, Math.round(take.seconds * 100) / 100), lines_version: W.lesson.linesVersion, line_id: lineId, take: { judged: count.judged, unheard: count.unheard } }), aborted]);
  if (epoch !== S.epoch || !live(s)) return { kind: 'stale' };
  if (r === null) return { kind: 'aborted' };
  if (r?.status === 'too_long') return { kind: 'input' };
  if (r?.status === 'limit') { worldAnalysisOff('limit'); return { kind: 'down', limit: true }; }
  if (r?.status === 'off') { worldAnalysisOff('off'); return { kind: 'down' }; }
  if (r?.status !== 'ok' || !r.take) return { kind: 'down' };
  const out = talkObservation(r.take);
  W.counts.set(key, nextCount(count, out));
  return { kind: 'result', data: settleTake(state, { phase, turn, out, reviewed: item.reviewed === true }) };
 } catch (error) {
  if (epoch !== S.epoch || !live(s)) return { kind: 'stale' };
  // 판이 바뀜(409 ITEM_CHANGED · ITEM_NOT_OPEN) — 이번 판은 받아쓰기를 끈다. 같은 요청 id 충돌(REQUEST_CONFLICT)은 그 테이크만.
  if (error?.status === 409 && ['ITEM_CHANGED', 'ITEM_NOT_OPEN'].includes(error.code)) worldAnalysisOff('off');
  return { kind: 'down' };
 } finally { s.signal.removeEventListener('abort', onAbort); if (S.upload === ac) S.upload = null; }
}
async function bootWorld() {
 const r = await fetch('world-lesson.json', { cache: 'no-cache' });
 if (!r.ok) throw new Error('lesson');
 W.lesson = await r.json();
 if (!W.lesson?.lesson?.scene) throw new Error('lesson');
 let status = null; try { status = await W.host.status(); } catch { status = null; W.statusFailed = true; }
 // 드라마 스위치가 켜지고 대사 은행 지문이 같고 오늘 횟수가 남았을 때만 받아쓰기를 연다.
 const analysis = !!status && status.dramaEnabled === true && status.linesVersion === W.lesson.linesVersion && status.dramaRemaining !== 0;
 W.limit = status?.dramaRemaining === 0;
 return { lesson: W.lesson.lesson, capabilities: { analysis, microphone: true }, limits: { maxSeconds: 20 }, firstExposure: true, learning: null };
}

// 처음 status가 일시 오류로 실패했으면 차례마다 한 번 다시 물어 받아쓰기를 되살린다(한도 · 꺼짐 · 판 다름은 그대로 둔다).
async function retryWorldStatus() {
 if (!inWorld() || !W.statusFailed || W.off || W.limit || S.boot.capabilities.analysis) return;
 let status = null; try { status = await W.host.status(); } catch { return; }
 W.statusFailed = false;
 W.limit = status?.dramaRemaining === 0;
 S.boot.capabilities.analysis = status?.dramaEnabled === true && status.linesVersion === W.lesson.linesVersion && !W.limit;
 updateChip();
}

async function sendTake(lineId, phase, take, s) {
 if (inWorld()) return sendTakeWorld(phase === 'transfer' ? (isDelayed(lineId) ? S.boot.lesson.delayed : S.boot.lesson.transfer) : studentItems().find((x) => x.id === lineId) || { id: lineId }, phase, take, s);
 const ac = new AbortController(); S.upload = ac;
 const onAbort = () => ac.abort(); s.signal.addEventListener('abort', onAbort, { once: true });
 const epoch = S.epoch;
 const fd = new FormData();
 fd.append('audio', take.blob, `take.${extFor(take.blob.type)}`);
 fd.append('lineId', lineId); fd.append('phase', phase); fd.append('consent', 'yes'); fd.append('requestId', uuid());
 S.sentRun = true;
 try {
  const r = await api('/api/take', { method: 'POST', body: fd, signal: ac.signal });
  if (epoch !== S.epoch || !live(s)) return { kind: 'stale' };
  // 413(용량)·422(길이·형식)는 서버 장애가 아니라 이 녹음을 받을 수 없다는 뜻 — 짧게 다시 녹음하도록 따로 안내한다.
  if (r.status === 413 || r.status === 422) return { kind: 'input' };
  if (!r.ok || !r.data || r.data.status === 'unavailable' || r.data.error) return { kind: 'down' };
  return { kind: 'result', data: r.data };
 } catch {
  if (epoch !== S.epoch || !live(s)) return { kind: 'stale' };
  return ac.signal.aborted ? { kind: 'aborted' } : { kind: 'down' };
 } finally { s.signal.removeEventListener('abort', onAbort); if (S.upload === ac) S.upload = null; }
}

/* ───────── 녹음(메모리만) ───────── */
const extFor = (type) => /mp4|m4a|aac/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
function pickMime() {
 for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
 return '';
}
const micUnusable = () => S.mic === 'denied' || S.mic === 'unsupported';
// wait: recordOnce의 대기 표. 취소된 대기의 늦은 허용·거절은 지금 마이크 상태(S.mic)를 바꾸지 않는다.
async function getStream(wait = null) {
 if (micUnusable()) return null;
 if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') { S.mic = 'unsupported'; return null; }
 try {
  const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  if (!wait?.cancelled) S.mic = 'ok';
  return st;
 } catch (e) {
  if (!wait?.cancelled) S.mic = (e && (e.name === 'NotFoundError' || e.name === 'NotReadableError' || e.name === 'OverconstrainedError')) ? 'unsupported' : 'denied';
  return null;
 }
}
const stopStream = (st) => st?.getTracks().forEach((tr) => tr.stop());
function stopRecorder(cancel) {
 // 마이크 허용을 기다리는 중의 취소: 권한 창에 답이 없어도 대기를 바로 풀고(내 차례로 돌아감),
 // 허용이 늦게 오면 그 스트림은 바로 닫고 녹음을 시작하지 않는다(recordOnce).
 if (!S.rec && cancel && S.micWait) { S.micWait.cancel(); return; }
 const r = S.rec; if (!r) return;
 r.cancelled = r.cancelled || cancel;
 try { if (r.rec.state !== 'inactive') r.rec.stop(); else r.finish(); } catch { r.finish(); }
}
// 서버는 해독 길이 20.04초까지만 받는다. 브라우저 시계·인코더 지연이 있어도 넘지 않게 이만큼 먼저 멈춘다.
const AUTO_STOP_MARGIN = 0.6;
// 녹음 한 번. 돌려줌: {blob, seconds} | {mic:false} | null(취소)
// onStart: 녹음기가 실제로 시작된 뒤 한 번(이때 녹음 패널을 그린다). onTick(남은 초).
async function recordOnce(s, { onStart, onTick } = {}) {
 if (S.playing) stopSound();
 // getUserMedia는 중간에 멈출 수 없다. 취소 약속과 경주시켜 취소하면 바로 풀고, 늦게 온 응답은 따로 정리한다.
 const CANCELLED = {};
 const wait = { cancelled: false, cancel: null };
 const cancelled = new Promise((res) => { wait.cancel = () => { wait.cancelled = true; res(CANCELLED); }; });
 S.micWait = wait;
 const pending = getStream(wait);   // 거절은 getStream 안에서 null로 바뀐다(처리 안 된 거절 없음).
 let stream;
 try { stream = await Promise.race([pending, cancelled]); } finally { if (S.micWait === wait) S.micWait = null; }
 if (stream === CANCELLED || wait.cancelled || !live(s)) {
  wait.cancelled = true;
  // 늦은 허용은 바로 닫는다. 이 대기의 응답은 S.micWait·S.rec·S.mic를 건드리지 않는다.
  pending.then(stopStream, () => {});
  return null;
 }
 if (!stream) return { mic: false };
 const mime = pickMime();
 let rec; try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch { stopStream(stream); S.mic = 'unsupported'; return { mic: false }; }
 const chunks = [];
 return new Promise((res) => {
  const t0 = performance.now(); let iv = 0; let deadline = 0; let finished = false;
  const limit = Math.max(1, S.maxSeconds - AUTO_STOP_MARGIN);
  const state = { rec, cancelled: false, unsupported: false, finish: null };
  let unlisten = () => {};
  state.finish = () => {
   if (finished) return; finished = true;
   clearInterval(iv); clearTimeout(deadline); unlisten(); stopStream(stream);
   if (S.rec === state) S.rec = null;
   syncPlayable(); document.body.classList.remove('is-recording');
   const seconds = (performance.now() - t0) / 1000;
   // 녹음기가 시작조차 못 함(NotSupportedError 등): 생성자 실패와 같이 지원 안 됨으로 두고 따라 읽기로 잇는다.
   if (state.unsupported) { S.mic = 'unsupported'; return res(live(s) ? { mic: false } : null); }
   if (state.cancelled || !live(s)) return res(null);
   res({ blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), seconds });
  };
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = state.finish; rec.onerror = () => { state.cancelled = true; state.finish(); };
  S.rec = state;
  try { rec.start(250); } catch { state.unsupported = true; state.finish(); return; }
  document.body.classList.add('is-recording');
  unlisten = orbListen(stream);
  onStart?.();
  syncPlayable();
  // 자동 멈춤은 표시용 tick과 따로 잡는다(200ms 간격 검사로 늦게 멈추지 않게).
  deadline = setTimeout(() => { if (S.rec === state) stopRecorder(false); }, limit * 1000);
  iv = setInterval(() => {
   const el = (performance.now() - t0) / 1000;
   onTick?.(Math.max(0, Math.ceil(limit - el)));
  }, 200);
  onTick?.(Math.ceil(limit));
 });
}

/* ───────── 세션 녹음 보관함 ───────── */
function addTake(lineId, phase, blob, seconds = null) {
 const n = S.takes.filter((x) => x.lineId === lineId).length + 1;
 const take = { id: uuid(), lineId, phase, n, blob, seconds, url: URL.createObjectURL(blob) };
 S.takes.push(take);
 return take;
}
function clearTakes() {
 stopSound();
 for (const x of S.takes) URL.revokeObjectURL(x.url);
 S.takes = [];
}
const takeById = (id) => S.takes.find((x) => x.id === id);
function playTake(take, s) { return take ? playUrl(take.url, s) : Promise.resolve(false); }

/* ───────── 줄 상태 ───────── */
function line(id) {
 if (!S.lines.has(id)) S.lines.set(id, { misses: 0, unheard: 0, opened: false, helped: false, spoken: false, readAlong: false, last: null });
 return S.lines.get(id);
}
const sceneItems = () => S.boot.lesson.scene;
const studentItems = () => sceneItems().filter((x) => x.type === 'student');
const lessonExtra = (k) => S.boot.lesson[k] || FALLBACK[k];
const goalItem = () => studentItems().find((x) => x.goal) || studentItems().find((x) => x.id === 's1e01-7') || studentItems()[0];

/* ───────── 공통 패널 조각 ───────── */
// 단계 표시는 위 띠(회차 알약 · 진행 띠)가 맡는다 — 패널 안 단계 줄은 두지 않는다(시네마 자막 결). 돌려줌 null.
function stepper(active) {
 const base = S.boot ? sceneItems().length : 7;
 setPhase(active, active === 'take2' ? base + 1 : active === 'transfer' ? base + 2 : active === 'wrap' ? base + 3 : null);
 return null;
}
// 장면 카드의 빈칸에 낱말을 넘겨 넣는다(통과한 줄). 끝맺음을 고친 줄이면 마지막 「요」가 따뜻하게 빛난다.
function revealBlanks(warmYo) {
 const blanks = [...ui.panel.querySelectorAll('.blank')];
 blanks.forEach((b, i) => {
  const f = b.querySelector('.fill'); if (!f) return;
  if (warmYo && i === blanks.length - 1 && f.textContent.endsWith('요')) f.replaceChildren(f.textContent.slice(0, -1), h('span', { class: 'yo' }, '요'));
  b.classList.add('done'); b.removeAttribute('aria-label'); f.removeAttribute('aria-hidden');
  anim(f, [{ opacity: 0, transform: 'translateY(60%) rotateX(80deg)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 150 });
 });
}
function blanked(text, item) {
 const words = (item.blanks || item.spec?.keys?.map((k) => k.word) || []).filter(Boolean).sort((a, b) => b.length - a.length);
 if (!words.length) return [h('span', {}, text)];
 const out = []; let rest = text;
 while (rest) {
  let best = -1, w = '';
  for (const k of words) { const i = rest.indexOf(k); if (i >= 0 && (best < 0 || i < best)) { best = i; w = k; } }
  if (best < 0) { out.push(h('span', {}, rest)); break; }
  if (best) out.push(h('span', {}, rest.slice(0, best)));
  out.push(h('span', { class: 'blank', style: `--n:${[...w].length}`, 'aria-label': '빈칸' }, h('span', { class: 'fill', 'aria-hidden': 'true' }, w)));
  rest = rest.slice(best + w.length);
 }
 return out;
}
function soundBtn(label, url, s, cls = 'ghost') {
 return h('button', { type: 'button', class: `${cls} sound`, data: { sound: '1' }, on: { click: () => { if (live(s)) playUrl(url, s); } } }, h('span', { class: 'ic play', 'aria-hidden': 'true' }), label);
}
function mineBtn(take, s, label = tx('playMine')) {
 return h('button', { type: 'button', class: 'ghost sound', data: { sound: '1' }, on: { click: () => { if (live(s)) playTake(take, s); } } }, h('span', { class: 'ic play', 'aria-hidden': 'true' }), label);
}
function micNotice() {
 if (!micUnusable()) return null;
 const first = !S.micNoticeShown; S.micNoticeShown = true;
 return h('div', { class: `notice ${first ? '' : 'quiet'}` }, tx(S.mic === 'denied' ? 'micDenied' : 'micUnsupported'));
}
function choose(s, build) {
 // build(resolve) → 노드들. 단계가 바뀌면 null로 끝난다.
 return new Promise((res) => {
  let done = false; const fin = (v) => { if (done) return; done = true; res(v); };
  s.signal.addEventListener('abort', () => fin(null), { once: true });
  panel(...build((v) => { if (live(s)) fin(v); }));
 });
}

/* ───────── 동의 ───────── */
// WORLD 안에서는 처리방침(수탁자 표의 받아 적기 줄)을 함께 보인다. 이PC 시범은 공개 쪽 주소가 없다.
const consentLink = () => (inWorld() ? { href: '/privacy/', label: tx('privacyLink') } : null);
async function ensureConsent(s) {
 if (S.consent || !analysisCapable() || micUnusable()) return;
 const v = await ask({ title: tx('consentTitle'), body: tx('consentBody'), note: tx('consentNote'), link: consentLink(), buttons: [
  { label: tx('consentNo'), value: 'no' }, { label: tx('consentYes'), value: 'yes', primary: true }] });
 if (!live(s)) return;
 S.consent = v === 'yes' ? 'yes' : 'no';
 updateChip();
}
function updateChip() {
 const c = ui.chip;
 if (!S.boot) { c.hidden = true; return; }
 c.hidden = false;
 const on = analysisOn();
 c.textContent = analysisCapable() ? (on ? tx('analysisOn') : tx('analysisOff')) : tx('analysisNA');
 c.classList.toggle('on', on);
 c.disabled = !analysisCapable();
}
ui.chip.addEventListener('click', async () => {
 if (!analysisCapable()) return;
 if (analysisOn()) {
  const v = await ask({ title: tx('withdrawTitle'), body: tx('withdrawBody'), buttons: [{ label: tx('cancel'), value: 'no' }, { label: tx('withdrawYes'), value: 'yes', primary: true }] });
  if (v === 'yes') { S.consent = 'no'; S.upload?.abort(); updateChip(); if (S.step === 'intro') intro(); }
 } else {
  const v = await ask({ title: tx('consentTitle'), body: tx('consentBody'), note: tx('consentNote'), link: consentLink(), buttons: [{ label: tx('cancel'), value: 'no' }, { label: tx('consentYes'), value: 'yes', primary: true }] });
  if (v === 'yes') { S.consent = 'yes'; updateChip(); if (S.step === 'intro') intro(); }
 }
});

/* ───────── 시작 ───────── */
async function boot() {
 S.step = 'boot';
 panel(h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('loading')));
 try {
  W.host = findDramaHost();
  if (!W.host && worldBuild) return openInWorld();
  let data;
  if (W.host) data = await bootWorld();
  else { const r = await api('/api/bootstrap'); if (!r.ok || !r.data?.lesson?.scene) throw new Error('boot'); data = r.data; }
  S.boot = data; S.csrf = data.csrfToken || ''; S.firstExposure = data.firstExposure !== false;
  S.maxSeconds = Math.max(5, Math.min(60, Number(data.limits?.maxSeconds) || 20));
  if (S.trail === undefined) S.trail = setupTrail();
 } catch {
  panel(h('div', { class: 'block' }, h('p', { class: 'lead' }, tx(W.host ? 'bootFailWorld' : 'bootFail')), h('button', { type: 'button', class: 'pill', on: { click: boot } }, tx('retry'))));
  return;
 }
 const a = { ...FALLBACK.assets, ...(S.boot.lesson.assets || {}) };
 ui.still.src = a.poster; ui.loop.src = a.listenLoop; S.listenLoop = a.listenLoop;
 document.documentElement.style.setProperty('--backdrop', `url("${a.backdrop}")`);
 const firstVideo = sceneItems().find((x) => x.video); if (firstVideo) { ui.reply.src = firstVideo.video; ui.reply.preload = 'auto'; }
 updateChip();
 intro();
}

// WORLD 공개본을 게임 틀 밖에서 바로 연 경우 — 계정 · 기록 · 받아쓰기가 없으니 WORLD에서 열게 한다.
function openInWorld() {
 S.step = 'outside'; S.render = openInWorld; hideMic(); updateChip();
 panel(h('div', { class: 'block' }, h('p', { class: 'lead' }, tx('openInWorld')),
  h('a', { class: 'pill', href: '../?drama=1', target: '_top' }, tx('openInWorldBtn'))));
}

// 첫 화면: 회차 표지(「Episode 01 · 개강 첫날 · 나는 한국에 막 온 유학생」)가 장면 위에 남고, 아래 유리 카드에 상대 · 때와 곳 · 시작 단추.
function intro() {
 const s = newScope(); S.step = 'intro'; S.render = intro; S.cardKey = null;
 checkCards(s);
 stageMode('still'); subs(null); hideMic(); setPhase('intro', 0); pushStill();
 slate(tx('episodeTitle'), { k: 'Episode 01', sub: tx('heroLine'), ms: 0 });
 cardIn('intro');
 const held = S.pendingB === true && S.delayedDue !== true, card = S.delayedDue === true || held;
 panel(h('div', { class: 'intro' },
  h('dl', { class: 'cast' },
   h('div', {}, h('dt', {}, tx('partner')), h('dd', {}, tx('rolePartner'))),
   h('div', {}, h('dt', {}, tx('placeLabel')), h('dd', {}, tx('place'))),
  ),
  h('p', { class: 'lead' }, tx('logline')),
  h('p', { class: 'fine synth' }, tx('synthetic')),
  S.delayedDue === true
   ? h('div', { class: 'card situation delayed' }, h('p', { class: 'k' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'New situation', h('b', {}, tx('delayedTitle'))),
    h('p', { class: 'fine' }, tx('delayedLead')),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'pill', on: { click: () => { if (live(s)) runTransfer('delayed'); } } }, tx('delayedStart'))))
   : held
   ? h('div', { class: 'card situation delayed' }, h('p', { class: 'k' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'New situation', h('b', {}, tx('transferTitle'))),
    h('p', { class: 'fine' }, tx('heldLead')),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'pill', on: { click: () => { if (live(s)) runTransfer('held'); } } }, tx('heldStart'))))
   : null,
  h('button', { type: 'button', class: card ? 'ghost big' : 'pill big', on: { click: () => { if (live(s)) runScene(0); } } }, h('span', { class: 'ic play', 'aria-hidden': 'true' }), tx(card ? 'delayedSkip' : 'start')),
 ));
}

// 첫 화면 카드 둘. 계정 기록이 아직 덜 모였으면(null) 첫 화면에 있는 동안 잠시 간격을 두고 다시 묻고, 끝내 모르면 내지 않는다(문항을 아낀다).
//  · C(설계 §17): WORLD 안에서 받아쓰기가 켜져 있고 기록기가 「d7 차례 · t6 처음」이라 할 때.
//  · 남겨 둔 B(11-03, 몽골 시범 §7 ④): 받아쓰기가 켜져 있고 이 계정이 장면 줄은 봤는데 새 상황은 안 봤을 때 — 받아쓰기가 막혀 「나중에 다시」로
//    둔 학생이 장면을 다시 하지 않고 B만 할 수 있게. C가 차례면 내지 않는다(C는 B 판정이 있어야 오니 둘이 함께 올 일은 없다).
async function checkCards(s) {
 const C = S.boot?.lesson?.delayed, B = S.boot?.lesson?.transfer;
 if (!inWorld() || !S.trail) return;
 const wantC = !!C && !!S.trail.delayedDue && S.delayedDue !== false;
 const wantB = !!B && !!S.trail.seen && S.pendingB !== false;
 if (!wantC && !wantB) return;
 await null; // 첫 화면을 다 그린 뒤에 묻는다 — 그리는 도중 다시 그리면 앞 판 단추가 끝난 범위에 묶인다
 // 받아쓰기를 끈(동의 거절) 동안은 카드를 내리고 묻지 않는다 — 칩에서 다시 켜면 첫 화면이 다시 묻는다(화면 검수 F4).
 if (S.consent === 'no') {
  if (S.delayedDue === true || S.pendingB === true) { if (S.delayedDue === true) S.delayedDue = null; if (S.pendingB === true) S.pendingB = null; if (live(s)) intro(); }
  return;
 }
 for (let i = 0; i < 12 && live(s); i++) {
  // 받아쓰기를 지금 못 쓰면 내지 않는다(status가 잠깐 실패했으면 모름으로 두고 다시 묻는다). 동의 · 받아 적기 실패는 lazy 기록이 막는다.
  if (W.statusFailed) await retryWorldStatus();
  if (!live(s)) return;
  const off = analysisCapable() ? undefined : W.statusFailed ? null : false;
  const due = !wantC ? false : off !== undefined ? off : S.trail.delayedDue({ lineId: C.id, skillId: C.skill });
  const held = !wantB || due === true ? false : off !== undefined ? off : heldTransfer(B);
  // 보이는 카드가 바뀌면 어느 쪽이든 다시 그린다 — 카드가 있었는데 한도 · 꺼짐 · 창 만료로 차례가 아니게 됐으면 카드를 거둔다(화면 검수 A3).
  // 모름 → 없음처럼 화면이 그대로면 다시 그리지 않는다(다시 그리면 그사이 칩으로 연 받아쓰기 창이 닫힌다).
  if (due !== null && held !== null) {
   const changed = (wantC && (due === true) !== (S.delayedDue === true)) || (wantB && (held === true) !== (S.pendingB === true));
   if (wantC) S.delayedDue = due;
   if (wantB) S.pendingB = held;
   if (changed && live(s)) intro();
   return;
  }
  await sleep(s, 2500);
 }
}
// 남겨 둔 B인지: B는 안 봤고 장면 학생 줄을 모두 봤으면 참(장면 끝까지 간 계정만 — 첫 줄에서 멈춘 계정이 장면 전에 B를 쓰지 않게, 화면 검수 F1).
// 기록이 덜 모여 모르면 null.
function heldTransfer(B) {
 const b = S.trail.seen(B.id);
 if (b !== false) return b === true ? false : null;
 const lines = studentItems().map((x) => S.trail.seen(x.id));
 return lines.every((v) => v === true) ? true : lines.includes(null) ? null : false;
}

/* ───────── 장면 ───────── */
async function runScene(i) {
 const s = newScope(); S.step = 'scene'; S.render = () => runScene(i); hideSlate();
 setPhase('scene', i);
 const item = sceneItems()[i];
 if (!item) return afterScene();
 if (item.type === 'actor') {
  await actorBeat(item, s);
  if (!live(s)) return;
  return runScene(i + 1);
 }
 return studentTurn(item, s, { phase: 'scene', onDone: () => runScene(i + 1) });
}

// 자막 규칙(결정 11-05 · docs/디자인/드라마_장면/README.md): 선배 대사는 소리가 쉬는 자리에서 다음 화면으로 넘어간다(item.cues). 시각은 재생 중인 소리에서 읽어
// 시작이 늦거나 끊겨도 어긋나지 않고, 테이크 2처럼 중간부터 틀어도 맞는 화면을 찾는다. 한 화면은 최소 1.5초 — 소리가 먼저 끝나면 그만큼 더 둔다.
const CUE_MIN_MS = 1500;
function followCues(cues, media, from) {
 let shown = -1, shownAt = 0;
 const show = (t) => {
  let i = 0;
  for (let k = 1; k < cues.length; k++) if (t >= cues[k].at) i = k;
  if (i === shown) return;
  shown = i; shownAt = performance.now();
  subs(cues[i].text, meaningOf(cues[i]), 'Taeo', 'cue', meaningLang(cues[i]));
 };
 let raf = 0;
 const tick = () => { if (!media.paused) show(media.currentTime); raf = requestAnimationFrame(tick); };
 // 탭을 옮기거나 창을 가리면 그림 틱이 멈춘다 — 소리는 계속 나므로 소리 시각 · 끝 소식으로도 넘긴다(끝나면 마지막 화면).
 const onTime = () => { if (!media.paused || media.ended) show(media.currentTime); };
 media.addEventListener('timeupdate', onTime); media.addEventListener('ended', onTime);
 show(from);
 raf = requestAnimationFrame(tick);
 return { stop: () => { cancelAnimationFrame(raf); media.removeEventListener('timeupdate', onTime); media.removeEventListener('ended', onTime); }, left: () => Math.max(0, CUE_MIN_MS - (performance.now() - shownAt)) };
}
// 선배 대사: 아래 카드는 내리고 대사는 자막으로만(영상이 주인공). 구는 쉬는 상태.
async function actorBeat(item, s, { from } = {}) {
 S.cardKey = null; panel();
 orbMode('idle', 'Listen');
 const start = item.video ? from ?? item.videoStart ?? 0 : 0;
 const cues = item.cues?.length ? followCues(item.cues, item.video ? ui.reply : ui.voice, start) : null;
 if (!cues) subs(item.text, meaningOf(item), 'Taeo', 'words', meaningLang(item));
 let ok;
 if (item.video) { stageMode('reply'); ok = await playVideo(item.video, start, item.videoEnd, s); }
 else { stageMode('still'); pushStill(); ok = await playUrl(item.audio, s); }
 cues?.stop();
 if (!live(s)) return false;
 if (ok && cues?.left()) { await sleep(s, cues.left()); if (!live(s)) return false; }
 if (!ok) {
  if (cues) subs(item.text, meaningOf(item), 'Taeo', null, meaningLang(item)); // 소리가 안 나면 시각을 읽을 수 없다 — 대사를 통째로
  const v = await choose(s, (go) => [stepper(S.step === 'scene' ? 'scene' : 'take2'), h('div', { class: 'beat' }, h('p', { class: 'actor-line', lang: 'ko' }, item.text), h('div', { class: 'notice quiet' }, tx('mediaFail')),
   h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('again') } }, tx('replay')), h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('continue'))))]);
  if (v === 'again') return actorBeat(item, s, { from });
 }
 subs(null);
 return true;
}

// 첫 되묻기는 그 줄에 쇼케이스 되묻기 영상(reaskVideo)이 있으면 영상으로, 없으면 정지 사진 + 녹음으로.
async function reask(s, idx, item) {
 const r = lessonExtra('reasks')[Math.min(idx, 2)];
 if (!r) return;
 subs(r.text, null, 'Taeo', 'pop');
 orbMode('idle', 'Listen');
 let ok = false;
 if (idx === 0 && item?.reaskVideo) { stageMode('reply'); ok = await playVideo(item.reaskVideo, 0, null, s); }
 if (!ok && live(s)) { stageMode('still'); await playUrl(r.audio, s); }
 if (!live(s)) return;
 subs(null); // 듣는 고리는 다음 차례 패널을 그릴 때 다시 건다(studentTurn).
}

// 내 차례 패널. 돌려줌: 'record' | 'next' | 'skip' | 'mic' | 'open' | null
// 대사 카드(유리): YOUR TURN + 한글 안내, 빈칸 대사, 뜻, 작은 단추. 녹음은 아래 음성 구를 누른다.
function turnPanel(item, s, ctx, extra = []) {
 const L = line(item.id);
 const showFull = L.opened || micUnusable() || ctx.mode === 'readAlong';
 const practice = ctx.mode === 'practice' && !L.practiceOpened;
 const hint = practice ? tx('cardHintPractice') : ctx.phase === 'retake' ? tx('cardHintRetake') : showFull ? tx('cardHintFull') : tx('cardHint');
 const p = choose(s, (go) => {
  if (micUnusable()) hideMic();
  else orbMode('listening', 'Tap to speak', { action: () => go('record'), aria: tx('record') });
  return [
   stepper(ctx.phase === 'scene' ? 'scene' : 'take2'),
   h('div', { class: 'turn' },
    h('p', { class: 'k' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), ctx.phase === 'retake' ? 'One more · Your turn' : 'Your turn', h('b', {}, hint)),
    micNotice(),
    ...extra,
    practice
     ? [h('p', { class: 'mean big', lang: meaningLang(item) }, meaningOf(item)), h('p', { class: 'fine' }, tx('practiceHint'))]
     : [h('p', { class: 'cardline ko', lang: 'ko' }, showFull ? item.text : blanked(item.text, item)), meaningOf(item) ? h('p', { class: 'mean', lang: meaningLang(item) }, meaningOf(item)) : null],
    h('div', { class: 'row aux' },
     item.modelAudio ? soundBtn(tx('modelListen'), item.modelAudio, s) : null,
     (!showFull || practice) ? h('button', { type: 'button', class: 'ghost', on: { click: () => go('open') } }, tx('openCard')) : null,
     micUnusable() ? null : h('button', { type: 'button', class: 'link', on: { click: () => go('skip') } }, tx('skipLine'))),
    micUnusable()
     ? h('div', { class: 'row main' },
       h('p', { class: 'fine' }, tx('readAlong')),
       h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('next')),
       h('button', { type: 'button', class: 'link', on: { click: () => go('mic') } }, tx('micRetry')))
     : null,
   )];
 });
 cardIn(`${ctx.phase}:${item.id}`);
 return p;
}

// 녹음 중: 카드는 그대로 두고(누를 수 없게) 구가 말소리에 반응한다. 구를 다시 누르면 말 끝, 아래 「취소」.
function recordingPanel(s) {
 setBusy(true);
 const label = (sec) => `Speaking · ${sec}s`;
 orbMode('speaking', label(S.maxSeconds), { action: () => stopRecorder(false), aria: tx('stop'),
  sub: h('button', { type: 'button', class: 'link', on: { click: () => stopRecorder(true) } }, tx('cancel')) });
 return (sec) => { ui.mstate.textContent = label(sec); };
}

// 받아 적는 중: 카드는 그대로, 구는 생각하는 상태.
async function sendingPanel(item, phase, take, s) {
 setBusy(true);
 orbMode('thinking', 'Transcribing', { aria: tx('sending'), sub: h('button', { type: 'button', class: 'link', on: { click: () => S.upload?.abort() } }, tx('cancelSend')) });
 return sendTake(item.id, phase, take, s);
}

// 서버가 이 녹음을 받지 않음(413·422 — 너무 길거나 읽을 수 없음). 시도로 세지 않고 다시 녹음하게 한다.
// 같은 차례에서 거듭되면(기기 코덱 등) 「직접 확인하고 계속」도 연다 — 판정·분석 없이 넘어가며 말해 본 줄로 세지 않는다.
const INVALID_REPEAT = 2;
function invalidTakePanel(s, take, stepKey, repeated) {
 return choose(s, (go) => [stepper(stepKey), h('div', { class: 'turn' },
  h('div', { class: 'notice quiet' }, tx(repeated ? 'takeInvalidRepeat' : 'takeInvalid')),
  h('div', { class: 'row' }, mineBtn(take, s),
   repeated ? h('button', { type: 'button', class: 'ghost', data: { rec: '1' }, on: { click: () => go('again') } }, tx('recordAgain')) : null),
  h('div', { class: 'row main' }, repeated
   ? h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('continueNoCheck'))
   : h('button', { type: 'button', class: 'pill', data: { rec: '1' }, on: { click: () => go('again') } }, tx('recordAgain'))))]);
}
// 받아쓰기 없이(꺼짐·서버 사정·세 번 안 들림) 내 녹음을 듣고 이어 가기. 돌려줌 'again' | 'next'
function selfCheckPanel(s, take, msgKey, stepKey) {
 return choose(s, (go) => [stepper(stepKey), h('div', { class: 'turn' },
  h('div', { class: 'notice quiet' }, tx(msgKey)),
  h('div', { class: 'row' }, mineBtn(take, s), h('button', { type: 'button', class: 'ghost', data: { rec: '1' }, on: { click: () => go('again') } }, tx('recordAgain'))),
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('next'))))]);
}

// 녹음 → (받아쓰기) 한 번. 돌려줌 {take, res} | {mic:false} | null
// 마이크 준비: 카드는 그대로(누를 수 없게), 구 아래에 허용 안내와 「취소」.
function micWaitPanel() {
 setBusy(true);
 orbMode('thinking', 'Preparing mic', { aria: tx('micPreparing'),
  sub: h('span', { class: 'mic-hint' }, h('span', { class: 'fine' }, tx('micPreparingHint')), h('button', { type: 'button', class: 'link', on: { click: () => stopRecorder(true) } }, tx('cancel'))) });
}
async function captureAndSend(item, ctx, s) {
 S.maxSeconds = maxSecondsFor(ctx.phase === 'transfer' ? (isDelayed(item.id) ? S.boot.lesson.delayed : S.boot.lesson.transfer) : item);
 micWaitPanel();
 let tick = null;
 const out = await recordOnce(s, { onStart: () => { if (live(s)) { tick = recordingPanel(s); startHeldLoop(); } }, onTick: (sec) => tick?.(sec) });
 // 녹음이 끝나면 구를 내린다 — 다음 단계(받아 적는 중 · 되묻기 · 통과 · 다음 차례)가 구를 다시 정하고,
 // 직접 확인 · 다시 녹음 · 너무 짧음 카드는 카드 안 단추로 잇는다(누를 일 없는 구에 상황과 다른 라벨을 남기지 않게).
 const rest = () => { if (live(s)) hideMic(); };
 rest();
 if (!live(s)) return null;
 if (!out) return null;
 if (out.mic === false) return { mic: false };
 if (out.seconds < 0.6 || !out.blob.size) {
  await choose(s, (go) => [h('div', { class: 'turn' }, h('div', { class: 'notice quiet' }, tx('tooShort')), h('button', { type: 'button', class: 'pill', on: { click: () => go(1) } }, tx('recordAgain')))]);
  return null;
 }
 const take = addTake(item.id, ctx.phase, out.blob, out.seconds);
 // 오늘 받아쓰기 횟수를 이미 다 쓴 WORLD 계정이면 「연습만」 대신 그 안내를 보인다.
 if (!analysisOn()) return { take, res: { kind: 'off', limit: inWorld() && W.limit } };
 const res = await sendingPanel(item, ctx.phase, take, s);
 rest();
 return { take, res };
}

async function studentTurn(item, s, ctx) {
 const L = line(item.id);
 await retryWorldStatus();
 if (!live(s)) return;
 await ensureConsent(s);
 if (!live(s)) return;
 subs(null);
 // 이 차례의 학습 기록. 테이크 2에서 「다시 녹음」으로 돌아와도 같은 차례라 보임을 다시 열지 않고 시도 번호를 잇는다.
 let P;
 if (ctx.phase === 'retake' && S.retake && S.retake.trail !== undefined) P = S.retake.trail;
 else {
  // 장면 줄의 차례는 줄 상태에 둔다 — 장면이 끝난 뒤 그 줄에 준 코치 노트를 같은 보임의 도움(explanation)으로 남긴다(afterScene).
  // 같은 줄을 다시 그려도 보임을 새로 열지 않는다(노트가 시도 없는 새 보임에 붙지 않게, 화면 검수 A2).
  if (ctx.phase === 'scene' && L.trail !== undefined) P = L.trail;
  else P = S.trail?.open({ lineId: item.id, skillId: item.skill, phase: ctx.phase }) || null;
  if (ctx.phase === 'scene') L.trail = P;
  // 테이크 2 앞의 코치 카드(afterScene)가 이 줄의 한국어 대사 전체와 모범 듣기를 이미 보였다.
  if (ctx.phase === 'retake' && S.retake) { S.retake.trail = P; P?.help('answer'); }
 }
 // 카드가 보인 정도를 도움으로 남긴다 — turnPanel과 같은 조건(연습 모드는 뜻만 보여 한국어 도움이 없다). 차례 안에서 마이크가 막혀 대사가
 // 다 펼쳐지는 것까지 잡게 카드를 그릴 때마다 본다(같은 도움은 한 번만 남는다).
 const noteHelp = () => {
  if (ctx.mode === 'practice' && !L.practiceOpened) return;
  P?.help('text');
  if (L.opened || micUnusable() || ctx.mode === 'readAlong') P?.help('answer');
 };
 const stepKey = ctx.phase === 'scene' ? 'scene' : 'take2';
 let invalid = 0;   // 이 차례에서 서버가 받지 않은 녹음(413·422) 수
 while (live(s)) {
  stageMode('listen', listenOf(item, ctx));
  noteHelp();
  const action = await turnPanel(item, s, ctx);
  if (!live(s) || action == null) return;
  if (action === 'open') { if (ctx.mode === 'practice') L.practiceOpened = true; L.opened = true; L.helped = true; P?.help('answer'); continue; }
  if (action === 'mic') { S.mic = 'unknown'; const st = await getStream(); stopStream(st); continue; }
  if (action === 'skip') return ctx.onDone({ skipped: true });
  if (action === 'next') { if (micUnusable()) L.readAlong = true; return ctx.onDone({ readAlong: micUnusable() }); }
  // 녹음
  const got = await captureAndSend(item, ctx, s);
  if (!live(s)) return;
  if (!got || got.mic === false) continue;
  const { take, res } = got;
  if (res.kind === 'stale') return;
  if (res.kind === 'aborted') continue;
  if (res.kind === 'input') {
   invalid += 1;
   const v = await invalidTakePanel(s, take, stepKey, invalid >= INVALID_REPEAT);
   if (!live(s) || v == null) return;
   if (v === 'next') return ctx.onDone({ take, invalid: true });
   continue;
  }
  P?.take(res);
  // 장면에서 말해 본 줄: 받아 적을 수 있었던 테이크, 또는 받아쓰기 없이(꺼짐·서버 사정) 녹음한 테이크.
  if (ctx.phase === 'scene' && (res.kind === 'off' || res.kind === 'down' || (res.kind === 'result' && !unheardData(res.data)))) L.spoken = true;
  if (res.kind === 'off' || res.kind === 'down') {
   const v = await selfCheckPanel(s, take, res.limit ? 'dailyLimit' : res.kind === 'off' ? 'practiceOnly' : 'apiDown', stepKey);
   if (v === 'again') continue;
   if (v == null) return;
   return ctx.onDone({ take });
  }
  const d = res.data;
  // 테이크 2에서 받아 적은 글이 있는 unclear는 판정 보류(명세 밖)로 결과 화면에 보인다. 장면 안에서는 인물 되묻기로 둔다.
  if (ctx.phase === 'retake' && d.status === 'unclear' && String(d.transcript || '').trim()) return ctx.onDone({ take, data: { ...d, observation: { kind: 'pending', note: null, sure: false } } });
  if (d.status === 'unclear' || d.status === 'no_speech') {
   L.unheard += 1;
   if (L.unheard >= 3) {
    L.unheard = 0;
    const v = await selfCheckPanel(s, take, 'unheardSelf', stepKey);
    if (v === 'again') continue;
    if (v == null) return;
    return ctx.onDone({ take });
   }
   await reask(s, L.unheard === 1 ? 1 : 2, item);
   continue;
  }
  // status ok — 판정이 있는 테이크
  L.unheard = 0;
  const obs = d.observation || { kind: 'pending', note: null };
  if (ctx.phase === 'retake') return ctx.onDone({ take, data: d });
  L.last = { obs, takeId: take.id, transcript: d.transcript || '' };
  if (obs.kind === 'note' && obs.note) {
   L.misses += 1;
   if (obs.note.kind === 'ending') L.endingMissed = true;
   if (L.misses === 1) { await reask(s, 0, item); continue; }
   if (L.misses === 2) { L.opened = true; L.helped = true; P?.help('answer'); continue; }
  }
  // 통과: 빈칸에 낱말이 넘겨 들어가고, 되물은 뒤 스스로 고친 줄이면 해낸 순간(크롬 칩 · 불꽃). 말로 판정하지는 않는다.
  if (obs.kind === 'pass') {
   setBusy(false); // 같은 카드에서
   revealBlanks(!!L.endingMissed);
   orbMode('success', 'Nice');
   if (L.misses) celebrate(s);
   await sleep(s, L.misses ? 2000 : 1200);
   if (!live(s)) return;
  }
  // pass · pending · 세 번째 어긋남 → 진행
  return ctx.onDone({ take, data: d });
 }
}

/* ───────── 장면 끝 → 코치 노트 하나 ───────── */
function pickNote() {
 const cands = [];
 studentItems().forEach((it, order) => {
  const L = S.lines.get(it.id);
  const o = L?.last?.obs;
  if (o && o.kind === 'note' && o.note && NOTE_ORDER[o.note.kind] != null) cands.push({ item: it, note: o.note, takeId: L.last.takeId, order, goal: it === goalItem() });
 });
 cands.sort((a, b) => (NOTE_ORDER[a.note.kind] - NOTE_ORDER[b.note.kind]) || (b.goal - a.goal) || (a.order - b.order));
 return cands[0] || null;
}
// [카드 글, 굵은 둘째 줄]. 끝맺음은 「헤맸어 → 헤맸어요」처럼 고칠 꼴을 보이고, 꼴을 확실히 못 만들면 다시 해 보자는 말로.
function noteLines(note) {
 if (note.kind === 'ending') return [tx('noteEnding'), endingFix(note) || tx('noteEndingFix')];
 if (note.kind === 'length') return [tx('noteLength'), tx('noteLengthFix')];
 return [tx('noteMissing', note.word || '…'), tx('noteMissingFix')];
}
// 코치 목소리를 틀고 자막을 단다. 녹음 전(audio null)이면 아무것도 하지 않는다 — 패널 글로 충분하고, 들리지 않는 말을 자막으로 띄우지 않는다.
function coachSay(cue, s, { replay = true } = {}) {
 if (!cue?.audio) { subs(null); return; }
 if (replay) { subs(cue.text, null, 'Coach', 'words'); playUrl(cue.audio, s); }
 else if (subsShowing(cue.text)) subs(cue.text, null, 'Coach');
 else subs(null);
}

async function afterScene() {
 const s = newScope(); S.step = 'cut'; S.render = afterScene;
 const c = lessonExtra('coach');
 stageMode('still'); subs(null); hideMic(); S.cardKey = null; panel();
 slate(tx('sceneEnd'), { k: 'Episode 01' });
 const cand = pickNote();
 const goal = goalItem();
 if (cand) {
  S.retake = { lineId: cand.item.id, mode: 'note', note: cand.note, noteTakeId: cand.takeId, take2Id: null };
 } else {
  const lastGoal = [...S.takes].reverse().find((x) => x.lineId === goal.id && x.phase === 'scene');
  S.retake = { lineId: goal.id, mode: 'practice', note: null, noteTakeId: lastGoal?.id || null, take2Id: null };
 }
 await sleep(s, 1850); // 「장면 끝」 표지가 사라진 뒤에 카드가 올라온다(겹치지 않게)
 if (!live(s)) return;
 hideSlate();
 // 코치 말은 노트가 있을 때만(연습 「다른 말로 한번 더」는 글 카드만). 기다리지 않는다 — 단추를 누르면 다음 단계의 newScope()가 소리를 정리한다.
 if (cand) coachSay(cand.note.kind === 'ending' ? c.noteEnding : c.noteOther, s);
 const item = studentItems().find((x) => x.id === S.retake.lineId);
 const noteTake = takeById(S.retake.noteTakeId);
 const [noteText, noteFix] = cand ? noteLines(cand.note) : [];
 const chosen = choose(s, (go) => [stepper('take2'), h('div', { class: 'director' },
  h('p', { class: 'k' }, cand ? 'Coach note' : 'Practice', h('b', {}, tx('sceneEnd'))),
  h('h2', {}, cand ? tx('coachNote') : tx('practiceTitle')),
  h('div', { class: 'card' }, h('p', { class: 'ko line', lang: 'ko' }, item.text), meaningOf(item) ? h('p', { class: 'mean', lang: meaningLang(item) }, meaningOf(item)) : null),
  cand ? [h('p', { class: 'lead' }, noteText), endingFix(cand.note) ? h('p', { class: 'fix ko', lang: 'ko' }, noteFix.slice(0, -1), h('span', { class: 'yo' }, '요')) : h('p', { class: 'lead strong' }, noteFix), h('p', { class: 'fine' }, tx('noteHedge'))]
   : [h('p', { class: 'lead' }, tx('practiceBody'))],
  h('div', { class: 'row aux' }, noteTake ? mineBtn(noteTake, s) : null, item.modelAudio ? soundBtn(tx('modelListen'), item.modelAudio, s) : null),
  h('p', { class: 'fine' }, tx('take2Lead')),
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('go') } }, tx('take2Start')),
   h('button', { type: 'button', class: 'link', on: { click: () => go('skip') } }, tx('toTransfer'))))]);
 cardIn('after');
 // 노트를 받았다는 사실(11-03, 몽골 시범 §7 ①) — 노트 종류는 그 줄 마지막 판정 시도의 choice(note-…)가 말한다. 테이크 2를 건너뛰어도 남는다.
 if (cand) S.lines.get(cand.item.id)?.trail?.help('explanation');
 const v = await chosen;
 if (!live(s) || v == null) return;
 if (v === 'skip') { S.retake.skipped = true; return runTransfer(); }
 subs(null);
 return runRetake();
}

async function runRetake() {
 const s = newScope(); S.step = 'take2'; S.render = runRetake; hideSlate();
 const R = S.retake;
 const items = sceneItems();
 const idx = items.findIndex((x) => x.id === R.lineId);
 const prev = items.slice(0, idx).reverse().find((x) => x.type === 'actor');
 const item = items[idx];
 if (prev) { await actorBeat(prev, s, { from: prev.retakeStart ?? prev.videoStart }); if (!live(s)) return; }
 return studentTurn(item, s, { phase: 'retake', mode: R.mode, onDone: (r) => retakeResult(item, r || {}) });
}

async function retakeResult(item, r) {
 const s = newScope(); S.step = 'take2-done'; S.render = () => retakeResult(item, r);
 const R = S.retake;
 if (r.take) R.take2Id = r.take.id;
 stageMode('still'); subs(null);
 const data = r.data; const obs = data?.observation;
 let msg = null; let hedge = false;
 // 연습 모드도 판정 종류를 그대로 따른다. 「고쳤다」 문구는 노트를 받은 줄이 pass일 때만.
 // 통과는 코치 목소리 없이 화면 ✓만 둔다(쇼케이스 새글 G6 — 「지난번엔…」 칭찬 녹음은 감독 틀이라 쓰지 않는다).
 const passed = !!data && obs?.kind === 'pass';
 if (data) {
  if (passed) msg = R.mode === 'note' ? tx('t2Fixed') : tx('t2PracticePass');
  else if (obs?.kind === 'note' && R.mode === 'note') msg = tx('t2Again');
  else if (obs?.kind === 'note' && obs.note) { msg = noteLines(obs.note)[0]; hedge = true; }
  else msg = tx('t2Pending');
 }
 const noteTake = takeById(R.noteTakeId); const t2 = takeById(R.take2Id);
 // 「같아요/달라요」 고른 것은 언어를 바꿔 다시 그려도 남는다.
 let checked = r.selfCheck || null;
 hideMic(); S.cardKey = null;
 // 해낸 순간은 처음 그릴 때 한 번만(언어 바꾸기 · 확인 단추로 다시 그릴 때는 없이).
 if (passed && !r.celebrated) { r.celebrated = true; celebrate(s); }
 const render = () => choose(s, (go) => [stepper('take2'), h('div', { class: 'director' },
  h('p', { class: 'k' }, R.mode === 'practice' ? 'Practice · One more' : 'One more'),
  h('h2', {}, R.mode === 'practice' ? tx('practiceTitle') : tx('take2')),
  data?.transcript ? h('div', { class: 'heard' }, h('p', { class: 'fine' }, tx('heardAs')), h('p', { class: 'ko', lang: 'ko' }, data.transcript)) : null,
  msg ? h('p', { class: passed ? 'lead passed' : 'lead' }, passed ? h('span', { class: 'tick on', 'aria-hidden': 'true' }) : null, msg) : null,
  hedge ? h('p', { class: 'fine' }, tx('noteHedge')) : null,
  !data && r.take ? h('p', { class: 'fine' }, tx(r.invalid ? 'invalidSelf' : analysisOn() ? 'apiDown' : inWorld() && W.limit ? 'dailyLimit' : 'practiceOnly')) : null,
  data?.transcript ? (checked ? h('p', { class: 'fine' }, tx(checked === 'differs' ? 'differsAck' : 'sameAck'))
   : h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('same') } }, tx('same')), h('button', { type: 'button', class: 'ghost', on: { click: () => go('differs') } }, tx('differs')))) : null,
  (noteTake || t2) ? h('div', { class: 'compare' }, h('p', { class: 'fine' }, tx('compare')),
   h('div', { class: 'row' }, noteTake ? mineBtn(noteTake, s, tx('takeLabel', 1)) : null, t2 ? mineBtn(t2, s, tx('takeLabel', 2)) : null)) : null,
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('toTransfer')),
   h('button', { type: 'button', class: 'link', data: { rec: '1' }, on: { click: () => go('again') } }, tx('recordAgain'))))]);
 for (;;) {
  const v = await render();
  if (!live(s) || v == null) return;
  if (v === 'same' || v === 'differs') { checked = v; r.selfCheck = v; R.selfCheck = v; if (v === 'differs') R.trail?.excludeLast(); continue; }
  if (v === 'again') return runRetake();
  return runTransfer();
 }
}

/* ───────── 새 상황 ───────── */
// kind: 'transfer'(장면 뒤 B) · 'delayed'(첫 화면의 C) · 'held'(첫 화면의 남겨 둔 B — 마치면 첫 화면으로).
async function runTransfer(kind = 'transfer', { rerender = false } = {}) {
 const delayed = kind === 'delayed', fromIntro = kind !== 'transfer';
 const s = newScope(); S.step = 'transfer'; S.render = () => runTransfer(kind, { rerender: true });
 // tries: 녹음해 보낸 횟수(단추 모양용). spoke: 소리가 들린(또는 받아쓰기 없이 녹음한) 시도 수.
 // firstHinted: 첫 「말해 본 시도」가 시작될 때 모범이 공개돼 있었는지 — 첫 시도에서 한 번만 정하고 뒤 시도로 덮지 않는다.
 const slot = delayed ? 'delayedRun' : 'transfer';
 const T = S[slot] || (S[slot] = { tries: 0, spoke: 0, firstHinted: null, revealed: null, revealedBeforeFirst: false, last: null, selfCheck: null, unheard: 0 });
 T.fromIntro = fromIntro;
 // C에 기록 없이 다시 들어오면 지난 안내(받아쓰기 꺼짐 · 다시 녹음 등)는 지우고 지금 상태로 새로 그린다 — 시도 수 · 모범 본 사실은 둔다(화면 검수 r2).
 // 언어 단추 · 동의 칩처럼 같은 화면을 다시 그릴 때(rerender)는 지금 안내와 「내 녹음 듣기」를 그대로 둔다.
 if (fromIntro && !rerender && !T.trail?.recorded) Object.assign(T, { last: null, lastTakeId: null, selfCheck: null, invalid: 0 });
 const markSpoken = (d) => {
  // 서버 take.hinted는 이전 실행(다시하기 전)의 모범 공개도 포함한다. 받아쓰기 없이 녹음한 경우는 이 창의 기억으로만 안다.
  if (!T.spoke) T.firstHinted = d?.take ? (!!d.take.hinted || T.revealedBeforeFirst) : (!!T.revealed || (!delayed && S.revealedEver));
  T.spoke += 1;
 };
 const tr = delayed ? S.boot.lesson.delayed : S.boot.lesson.transfer;
 stageMode('still'); subs(null); hideMic(); S.cardKey = null; panel();
 // 표지가 사라진 뒤에 카드가 올라온다(겹치지 않게).
 if (T.tries === 0 && !T.introShown) { T.introShown = true; slate(tx(delayed ? 'delayedTitle' : 'transferTitle'), { k: 'New situation', ms: 1200 }); await sleep(s, 1650); if (!live(s)) return; hideSlate(); }
 else hideSlate(); // 첫 화면 회차 표지(ms 0)는 스스로 사라지지 않는다 — C에 두 번째로 들어올 때도 걷는다.
 await retryWorldStatus();
 if (!live(s)) return;
 await ensureConsent(s);
 if (!live(s)) return;
 const item = { id: tr.id };
 // C는 판정된 첫 테이크가 올 때만 기록에 남긴다(lazy, 설계 검토 P1) — 그 전에 닫거나 받아쓰기가 안 되면 카드가 남아 다음에 다시 할 수 있다.
 // B는 받아 적기까지 간 첫 테이크가 올 때 남긴다(11-03, 몽골 시범 §7 ④) — 받아쓰기 꺼짐 · 서버 사정 테이크로는 B를 쓰지 않는다.
 if (T.trail === undefined) T.trail = S.trail?.open({ lineId: tr.id, skillId: tr.skill, phase: 'transfer', lazy: delayed ? true : 'transcribed' }) || null;
 // WORLD에서 받아쓰기를 지금 못 쓰면(서버 꺼짐 · 오늘 횟수 끝 · 대사 은행 판 다름 · status 실패) B를 열지 않고 남겨 둔다 — 탓하지 않는 한 줄과
 // 「다시 확인」 · 「나중에 다시」. 기록기가 없으면(로그인 · 학습 기록 동의 전) 남는 것이 없으니 그대로 연습한다.
 while (!delayed && inWorld() && T.trail && !T.trail.recorded && !analysisCapable()) {
  const v = await heldPanel(s, T);
  if (!live(s) || v == null) return;
  if (v === 'later') return leaveHeld(T);
  T.heldChecked = true;
  await recheckWorldStatus();
  if (!live(s)) return;
  // 부팅 때부터 꺼져 있던 세션은 동의를 물은 적이 없다 — 받아쓰기가 돌아왔으면 여기서 묻는다(이미 답했으면 바로 돌아온다).
  await ensureConsent(s);
  if (!live(s)) return;
 }
 for (;;) {
  const v = await transferPanel(s, tr, T);
  if (!live(s) || v == null) return;
  // C · 남겨 둔 B를 마치면 첫 화면으로 — 기록이 남았으면 카드를 거둔다(Atlas가 그 문항을 본 것으로 안다), 아니면 카드가 남는다.
  if (v === 'finish') {
   if (fromIntro) { if (T.trail?.recorded) { if (delayed) S.delayedDue = false; else S.pendingB = false; } S.trail?.flush(); return backToIntro(kind); }
   return wrap();
  }
  if (v === 'later') return backToIntro(kind);
  if (v === 'held') return leaveHeld(T);
  if (v === 'hint') { await revealModel(s, T, tr); if (!live(s)) return; continue; }
  if (v === 'same' || v === 'differs') { T.selfCheck = v; if (v === 'differs') T.trail?.excludeLast(); continue; }
  if (v === 'mic') { S.mic = 'unknown'; stopStream(await getStream()); continue; }
  if (v === 'record') {
   const got = await captureAndSend(item, { phase: 'transfer' }, s);
   if (!live(s)) return;
   if (!got || got.mic === false) continue;
   const { take, res } = got;
   if (res.kind === 'stale') return;
   if (res.kind === 'aborted') continue;
   // 서버가 받지 않은 녹음(너무 길거나 읽을 수 없음)은 시도로 세지 않고 다시 녹음을 권한다.
   // 거듭되면 「마치기」를 열어(transferPanel) 막히지 않게 한다 — 시도·말해 봄·모범 이력은 그대로.
   if (res.kind === 'input') { T.invalid = (T.invalid || 0) + 1; T.selfCheck = null; T.lastTakeId = take.id; T.last = { kind: 'input' }; continue; }
   T.trail?.take(res);
   T.tries += 1; T.selfCheck = null; T.lastTakeId = take.id;
   if (res.kind === 'off' || res.kind === 'down') { markSpoken(null); T.last = { kind: res.kind, limit: !!res.limit }; continue; }
   const d = res.data;
   // 무음·받아 적은 글 없음은 시도로 세지 않는다(모범 보기 전 안내도 그대로 남는다).
   if (unheardData(d)) { T.unheard += 1; T.last = { kind: 'unheard' }; continue; }
   markSpoken(d);
   // 글은 받아 적었지만 언어를 가리지 못한 unclear는 「안 들림」이 아니라 보류로 보여 준다.
   if (d.status === 'unclear') d.observation = { kind: 'pending', note: null, sure: false };
   T.unheard = 0;
   T.last = { kind: 'result', data: d };
   if (d.observation?.kind === 'pass') celebrate(s); // 해낸 순간 — 처음 보는 상황에서 장소와 묻는 말을 찾았을 때
  }
 }
}

// 받아쓰기가 막혀 B를 열지 않을 때. 녹음 구는 내리고(보낼 수 없으니) 다시 확인 · 나중에 다시만 둔다.
function heldPanel(s, T) {
 hideMic();
 const p = choose(s, (go) => [stepper('transfer'), h('div', { class: 'transfer' },
  h('p', { class: 'k' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'New situation', h('b', {}, tx('transferTitle'))),
  h('div', { class: 'notice quiet' }, tx(W.limit ? 'heldLimit' : 'heldDown'), T.heldChecked ? h('p', { class: 'fine' }, tx(W.statusFailed ? 'heldCheckFail' : W.limit ? 'heldStillLimit' : 'heldStill')) : null),
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('retry') } }, tx('heldRetry')),
   h('button', { type: 'button', class: 'ghost', on: { click: () => go('later') } }, tx(T.fromIntro ? 'delayedLater' : 'heldLater'))))]);
 cardIn('transfer-held');
 return p;
}
// B를 쓰지 않고 떠난다 — 장면 뒤면 마침 화면(「남겨 뒀어요」), 첫 화면에서 왔으면 첫 화면. 첫 화면 카드는 기록으로 다시 정한다.
function leaveHeld(T) {
 T.deferred = true; S.pendingB = null; S.trail?.flush();
 return T.fromIntro ? backToIntro('held') : wrap();
}
// 첫 화면에서 연 남겨 둔 B를 떠날 때는 그 판 상태(S.transfer)를 비운다 — 그 뒤 「1화 처음부터」로 장면을 하고 여는 B가 지난 테이크 · 기록기를
// 잇지 않게(화면 검수 A1). 판정 · 모범 본 사실은 Atlas 기록과 W.attempts(takes.mjs)가 그대로 안다. C는 지금처럼 S.delayedRun을 둔다.
function backToIntro(kind) {
 if (kind === 'held') S.transfer = null;
 return intro();
}
// 「다시 확인」: 꺼짐 · 오늘 횟수 끝이라도 status를 다시 묻는다(retryWorldStatus는 잠깐 실패만 다시 묻는다).
async function recheckWorldStatus() {
 if (!inWorld()) return;
 let status = null; try { status = await W.host.status(); } catch { W.statusFailed = true; return; }
 W.statusFailed = false; W.off = false;
 W.limit = status?.dramaRemaining === 0;
 S.boot.capabilities.analysis = status?.dramaEnabled === true && status.linesVersion === W.lesson.linesVersion && !W.limit;
 updateChip();
}

function transferPanel(s, tr, T) {
 const lastTake = takeById(T.lastTakeId);
 const L = T.last; const d = L?.kind === 'result' ? L.data : null; const obs = d?.observation;
 // B를 아직 쓰지 않았는데 받아 적기가 막혔다(서버 사정 · 오늘 횟수 끝) — 모범 보기 · 마치기 대신 「나중에 다시」(B를 쓰지 않는다, §7 ④).
 const held = !isDelayed(tr.id) && !!T.trail && !T.trail.recorded && (L?.kind === 'down' || (L?.kind === 'off' && L.limit));
 let outcome = null;
 if (L?.kind === 'off') outcome = h('div', { class: 'notice quiet' }, tx(L.limit ? 'dailyLimit' : 'practiceOnly'), held ? h('p', { class: 'fine' }, tx('heldNote')) : null);
 else if (L?.kind === 'down') outcome = h('div', { class: 'notice quiet' }, tx(L.limit ? 'dailyLimit' : 'apiDown'), held ? h('p', { class: 'fine' }, tx('heldNote')) : null);
 else if (L?.kind === 'input') outcome = h('div', { class: 'notice quiet' }, tx(T.invalid >= INVALID_REPEAT ? 'takeInvalidRepeat' : 'takeInvalid'));
 else if (L?.kind === 'unheard') outcome = h('div', { class: 'notice quiet' }, tx(T.unheard >= 3 ? 'unheardSelf' : 'unheardRetry'));
 else if (d) {
  const lines = [];
  if (T.selfCheck === 'differs') lines.push(h('p', { class: 'fine' }, tx('differsAck')));
  else if (obs?.kind === 'pass') lines.push(h('p', { class: 'lead' }, tx('transferPass')));
  // 새 상황에서는 모범을 열기 전 한국어 답 낱말을 보이지 않는다 — missing 노트는 낱말 없는 안내로.
  else if (obs?.kind === 'note' && obs.note) { const a = obs.note.kind === 'missing' ? tx('transferMissing') : noteLines(obs.note)[0]; lines.push(h('p', { class: 'lead' }, a), h('p', { class: 'fine' }, tx('noteHedge'))); }
  else lines.push(h('p', { class: 'lead' }, tx('transferPending')));
  outcome = h('div', { class: 'result' },
   d.transcript ? h('div', { class: 'heard' }, h('p', { class: 'fine' }, tx('heardAs')), h('p', { class: 'ko', lang: 'ko' }, d.transcript)) : null,
   ...lines);
 }
 const promptKo = S.lang === 'ko' && tr.promptKo ? tr.promptKo : null;
 const promptMn = S.home === 'mn' && tr.promptMn ? tr.promptMn : null;
 const p = choose(s, (go) => {
  if (micUnusable()) hideMic();
  else orbMode('listening', obs?.kind === 'pass' && T.selfCheck !== 'differs' ? 'One more' : T.tries ? 'Say it again' : 'Tap to speak', { action: () => go('record'), aria: T.tries ? tx('tryAgain') : tx('record') });
  return [stepper('transfer'), h('div', { class: 'transfer' },
  h('p', { class: 'k' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'New situation', h('b', {}, tx(isDelayed(tr.id) ? 'delayedTitle' : 'transferTitle'))),
  h('p', { class: 'lead' }, tx('transferLead')),
  h('div', { class: 'card situation' }, h('p', { class: 'fine' }, tx('transferPromptLabel')), h('p', { class: 'mean big', lang: promptMn ? 'mn' : 'en' }, promptMn || tr.prompt), promptKo ? h('p', { class: 'fine' }, promptKo) : null),
  micNotice(),
  T.revealed ? h('div', { class: 'card model' }, h('p', { class: 'fine' }, tx('modelLabel')), h('p', { class: 'ko line', lang: 'ko' }, T.revealed.text), h('p', { class: 'fine' }, tx(tr.reviewed ? 'modelReviewed' : 'modelUnreviewed')),
   T.revealed.modelAudio ? h('div', { class: 'row' }, soundBtn(tx('modelListen'), T.revealed.modelAudio, s)) : null) : null,
  outcome,
  d?.transcript && !T.selfCheck ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('same') } }, tx('same')), h('button', { type: 'button', class: 'ghost', on: { click: () => go('differs') } }, tx('differs'))) : null,
  T.selfCheck === 'same' ? h('p', { class: 'fine' }, tx('sameAck')) : null,
  lastTake ? h('div', { class: 'row' }, mineBtn(lastTake, s)) : null,
  micUnusable()
   ? h('div', { class: 'row main' }, h('p', { class: 'fine' }, tx('readAlongTransfer')), h('button', { type: 'button', class: 'link', on: { click: () => go('mic') } }, tx('micRetry')))
   : null,
  h('div', { class: 'row' },
   !T.revealed && !held ? h('button', { type: 'button', class: 'link', on: { click: () => go('hint') } }, tx('hintBtn')) : null,
   // C · 남겨 둔 B는 첫 화면에서 바로 들어오므로 테이크 전에도 돌아갈 수 있게 — 기록이 없으면 카드가 남는다(화면 검수 F3).
   T.fromIntro && !held && !(T.tries || micUnusable() || T.revealed || T.invalid >= INVALID_REPEAT) ? h('button', { type: 'button', class: 'ghost', on: { click: () => go('later') } }, tx('delayedLater')) : null,
   held ? h('button', { type: 'button', class: 'pill', on: { click: () => go('held') } }, tx(T.fromIntro ? 'delayedLater' : 'heldLater'))
    : (T.tries || micUnusable() || T.revealed || T.invalid >= INVALID_REPEAT) ? h('button', { type: 'button', class: T.tries ? 'pill' : 'ghost', on: { click: () => go('finish') } }, tx('finish')) : null),
  )];
 });
 cardIn('transfer');
 return p;
}

async function revealModel(s, T, tr = S.boot.lesson.transfer) {
 // C(한 번뿐인 문항)는 판정된 테이크가 남기 전이면 늘 묻고, 모범을 보면 그 한 번을 쓴다는 것을 알린다(화면 검수 F1).
 const once = isDelayed(tr.id) && !T.trail?.recorded;
 if (!T.spoke || once) {
  const ok = await ask({ title: tx('hintConfirmTitle'), body: tx(once ? 'hintConfirmBodyDelayed' : 'hintConfirmBody'), buttons: [{ label: tx('cancel'), value: 'no' }, { label: tx('hintShow'), value: 'yes', primary: true }] });
  if (ok !== 'yes' || !live(s)) return;
 }
 const epoch = S.epoch;
 let r;
 if (inWorld()) { attemptsFor(tr.id).transferRevealed = true; r = { ok: true, data: isDelayed(tr.id) ? W.lesson.delayedReveal : W.lesson.reveal }; }
 else { try { r = await api('/api/reveal', { method: 'POST', json: { lineId: tr.id }, signal: s.signal }); } catch { r = null; } }
 if (!live(s) || epoch !== S.epoch) return;
 if (!r?.ok || !r.data?.text) { await ask({ title: tx('apiDown'), buttons: [{ label: tx('close'), value: 'ok', primary: true }] }); return; }
 // 서버가 reveal을 먼저 기록한 뒤에만 보인다.
 T.revealed = { text: r.data.text, modelAudio: r.data.modelAudio || null };
 T.trail?.help('answer');
 if (!T.spoke) T.revealedBeforeFirst = true;
 if (!isDelayed(tr.id)) S.revealedEver = true;
}

/* ───────── 마침 ───────── */
async function wrap({ replay = true } = {}) {
 const s = newScope(); S.step = 'wrap'; S.render = () => wrap({ replay: false }); hideSlate();
 stageMode('still'); hideMic();
 if (replay) S.cardKey = null;
 // 언어 전환·실패 화면에서 돌아올 때는 코치 마침 말을 다시 틀지 않는다.
 coachSay(lessonExtra('coach').wrap, s, { replay });
 const items = studentItems();
 // 녹음 비우기와 상관없이 촬영 중 소리가 들린 줄을 센다.
 const spoken = items.filter((x) => line(x.id).spoken).length;
 const readAlong = items.filter((x) => line(x.id).readAlong).length;
 const R = S.retake; const T = S.transfer;
 const rItem = R && items.find((x) => x.id === R.lineId);
 const did2 = R && R.take2Id;
 // 첫 「말해 본 시도」 때의 모범 공개 여부가 기준. 이전 실행에서 본 모범도 서버 hinted로 들어온다.
 const hintState = T?.spoke ? (T.firstHinted ? 'hintBefore' : T.revealed ? 'hintAfter' : S.firstExposure === false ? 'hintNoneRepeat' : 'hintNone')
  : T?.revealed ? 'hintSeenOnly' : null;
 const tick = (on) => h('span', { class: `tick ${on ? 'on' : ''}`, 'aria-hidden': 'true' });
 const render = (msg) => {
  // 촬영 이력(이번 실행에서 받아쓰기로 보낸 적 있음)과 지금 동의 상태를 따로 보인다. 철회해도 이미 받은 분석을 없던 일로 쓰지 않는다.
  const mode = S.sentRun ? 'on' : analysisCapable() ? 'off' : 'na';
  const withdrawn = S.sentRun && !analysisOn();
  const p = choose(s, (go) => [stepper('wrap'), h('div', { class: 'wrap' },
  h('p', { class: 'k' }, 'Today', h('b', {}, tx('episode'))),
  h('h2', {}, tx('wrapTitle')),
  // 끝 그림 = 다음 회(콘티 56–60초). 칸 15에는 태오가 없다.
  h('div', { class: 'next-ep' }, h('img', { class: 'next-img', src: { ...FALLBACK.assets, ...(S.boot.lesson.assets || {}) }.nextImage, alt: '', decoding: 'async' }),
   h('div', { class: 'next-body' }, h('p', { class: 'eyebrow' }, tx('wrapNext')), h('p', { class: 'strong' }, tx('nextTitle')), h('p', { class: 'fine' }, tx('nextLine')))),
  // 선배의 메모 · 오늘 배운 표현 — 쇼케이스 콘티 「오늘의 끝」 글(10-31 굽기 전 검수 반영본).
  h('div', { class: 'memo' }, h('p', { class: 'eyebrow' }, tx('wrapMemoFrom')), h('p', { class: 'ko line', lang: 'ko' }, '처음엔 \'선배님\'이 안전해요. 나한텐 그냥 \'선배\'! —\u00a0태오'), S.lang === 'ko' ? null : h('p', { class: 'mean' }, tx('wrapMemoMean'))),
  h('div', { class: 'learned' }, h('p', { class: 'eyebrow' }, tx('wrapLearned')), h('p', { class: 'ko line', lang: 'ko' }, '혹시 (장소)이/가 어디에 있는지 아세요?'), S.lang === 'ko' ? null : h('p', { class: 'mean' }, tx('wrapLearnedMean'))),
  h('ul', { class: 'log' },
   h('li', {}, tick(spoken > 0), h('div', {}, h('b', {}, tx('wrapSpoken')), h('p', {}, tx('wrapLines', spoken, items.length)),
    readAlong ? h('p', { class: 'fine' }, tx('wrapReadAlong', readAlong)) : null, h('p', { class: 'fine' }, tx('wrapAnalysis')[mode]),
    withdrawn ? h('p', { class: 'fine' }, tx('wrapWithdrawn')) : null)),
   h('li', {}, tick(!!did2), h('div', {}, h('b', {}, R?.mode === 'note' ? tx('wrapNote') : tx('wrapPractice')),
    rItem ? h('p', { lang: 'ko', class: 'ko' }, rItem.text) : null, !did2 ? h('p', { class: 'fine' }, tx('wrapNoTake2')) : null)),
   h('li', {}, tick(!!T?.spoke && !(T.deferred && !T.trail?.recorded)), h('div', {}, h('b', {}, tx('wrapTransfer')), h('p', {}, T?.deferred && !T.trail?.recorded ? tx('wrapTransferHeld') : T?.spoke ? tx('wrapTransferTried') : T?.tries ? tx('wrapTransferUnheard') : T?.invalid ? tx('wrapTransferInvalid') : tx('wrapTransferNot')),
    hintState && !(T.deferred && !T.trail?.recorded) ? h('p', { class: 'fine' }, tx(hintState)) : null)),
  ),
  h('details', { class: 'takes', open: msg ? '' : null }, h('summary', { class: 'eyebrow' }, tx('myTakes')),
   S.takes.length ? h('div', { class: 'take-list' }, S.takes.map((k) => {
    const it = items.find((x) => x.id === k.lineId);
    const label = it ? `${it.text.slice(0, 14)}… · ${tx('takeLabel', k.n)}` : `${tx(isDelayed(k.lineId) ? 'delayedTitle' : 'transferTitle')} · ${tx('takeLabel', k.n)}`;
    return mineBtn(k, s, label);
   })) : h('p', { class: 'fine' }, msg || tx('noTakes'))),
  h('div', { class: 'row main' },
   h('button', { type: 'button', class: 'pill', on: { click: () => go('restart') } }, tx('restart')),
   S.takes.length ? h('button', { type: 'button', class: 'ghost', on: { click: () => go('clear') } }, tx('clearTakes')) : null,
   analysisOn() ? h('button', { type: 'button', class: 'link', on: { click: () => go('withdraw') } }, tx('withdrawShort')) : null),
  h('p', { class: 'fine foot' }, tx('privacyFoot')),
  )]);
  cardIn('wrap');
  return p;
 };
 let msg = null;
 for (;;) {
  const v = await render(msg);
  if (!live(s) || v == null) return;
  if (v === 'clear') { clearTakes(); msg = tx('cleared'); continue; }
  if (v === 'withdraw') { S.consent = 'no'; S.upload?.abort(); updateChip(); continue; }
  if (v === 'restart') return restart();
 }
}

async function restart() {
 S.epoch += 1;
 const s = newScope(); S.step = 'reset'; S.render = null; subs(null); hideMic();
 panel(h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('loading')));
 let r = null;
 if (inWorld()) { W.counts.clear(); r = { ok: true, data: resetAttempts(W.attempts) }; }
 else { try { r = await api('/api/reset', { method: 'POST', json: {}, signal: s.signal }); } catch {} }
 if (!live(s)) return;
 if (!r?.ok || !r.data?.ok) return resetFailed();
 clearTakes();
 S.lines.clear(); S.retake = null; S.transfer = null; S.micNoticeShown = false; S.sentRun = false; S.pendingB = null;
 // C는 기록 · 모범 본 사실은 두고 이번 판의 테이크 흔적만 비운다(화면 검수 F2).
 if (S.delayedRun) Object.assign(S.delayedRun, { tries: 0, spoke: 0, last: null, lastTakeId: null, selfCheck: null, unheard: 0, invalid: 0 });
 if (inWorld()) resetAttempts(W.delayedAttempts);
 S.firstExposure = r.data.firstExposure !== false;
 intro();
}
// 서버가 다시하기를 받지 않았으면 새 실행으로 넘어가지 않는다. 지금 기록(녹음·촬영 기록)은 그대로 두고 다시 시도하거나 기록으로 돌아간다.
function resetFailed() {
 const s = newScope(); S.step = 'reset-fail'; S.render = resetFailed;
 panel(h('div', { class: 'block' }, h('p', { class: 'lead' }, tx('resetFail')),
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => { if (live(s)) restart(); } } }, tx('retry')),
   h('button', { type: 'button', class: 'ghost', on: { click: () => { if (live(s)) wrap({ replay: false }); } } }, tx('backToWrap')))));
}

/* ───────── 언어 · 창 닫기 ───────── */
ui.lang.addEventListener('click', () => {
 S.lang = S.lang === 'ko' ? S.home : 'ko';
 applyStaticText();
 // 녹음·마이크 허용 대기·전송 중이 아니면 지금 단계를 새 언어로 다시 그린다(intro·wrap 등 상태를 잃지 않는 단계만).
 if (!S.rec && !S.micWait && !S.upload && ['intro', 'wrap', 'transfer', 'take2-done', 'reset-fail', 'outside'].includes(S.step) && S.render) S.render();
});
window.addEventListener('pagehide', () => { stopRecorder(true); S.upload?.abort(); clearTakes(); S.trail?.flush(); });

applyStaticText();
initOrb();
boot();
