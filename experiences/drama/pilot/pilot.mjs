// 드라마 말하기 로컬 시범판 화면(2026-10-31, Claude). 서버 계약: /api/bootstrap·take·reveal·reset(부모 GPT 서버).
// 지키는 것(Fable 설계 검토 반영 — .tmp/drama-pilot-20261031/fable-design.md):
//  · 녹음·받아 적은 글은 이 창의 메모리에만. 콘솔·저장소·내려받기 없음. ObjectURL은 세션 보관함에서만 만들고 비우기·다시하기·창 닫기에 해제.
//  · 장면 안에서는 판정을 말로 보여 주지 않는다 — 인물 되묻기 → 카드 펼침 → 통과(어긋남 셋까지). 안 들림(unclear·no_speech)은 따로 세어 되묻기만, 세 번이면 스스로 확인.
//  · 감독 노트는 장면이 끝난 뒤 하나만: 줄마다 마지막 판정 테이크의 note만 후보. 없으면 「다른 말로 한번 더」 연습(교정 아님).
//  · 녹음 중에는 어떤 소리도 틀지 않고, 소리가 나는 동안에는 녹음을 시작하지 않는다(스피커 소리가 「내 대답」으로 받아 적히지 않게).
//  · 새 상황의 한국어 모범은 /api/reveal 응답으로만 보인다. 첫 제출 전 화면에 한국어 답·첫 글자가 없다.
//  · 마이크 거절·미지원은 한 번만 묻고, 이후엔 녹음 없이 따라 읽기로 이어 간다. 받아쓰기가 안 되면 자동으로 잘했다고 하지 않는다.
import { STR } from './strings.mjs';

const $ = (id) => document.getElementById(id);
const ui = { stage: $('stage'), still: $('still'), loop: $('loop'), reply: $('reply'), subs: $('subs'), slate: $('slate'), panel: $('panel'), dialog: $('dialog'), voice: $('voice'), chip: $('analysisChip'), lang: $('langBtn') };

// bootstrap이 아래 칸을 넘기지 않아도 돌도록 둔 기본값(content.mjs와 같은 파일).
const FALLBACK = {
 reasks: [
  { text: '응? 응? 뭐라고요?', audio: '/media/senior-ask-1.mp3' },
  { text: '미안해요, 여기가 시끄러워서 잘 못 들었어요.', audio: '/media/senior-ask-2.mp3' },
  { text: '천천히 해도 돼요.', audio: '/media/senior-ask-3.mp3' },
 ],
 director: {
  cut: { text: '컷! 좋아요.', audio: '/media/director-cut.mp3' },
  again: { text: '한 번만 더 갈게요.', audio: '/media/director-again.mp3' },
  wrap: { text: '오늘 촬영 여기까지! 수고했어요.', audio: '/media/director-wrap.mp3' },
  betterEnding: { text: '지난번엔 끝이 빠졌는데, 이번엔 다 붙었어요. 좋아요.', audio: '/media/director-better-ending.mp3' },
 },
 assets: { listenLoop: '/media/taeo-listen.mp4', poster: '/media/taeo-still.webp', backdrop: '/media/taeo-still-blur.webp' },
};
const NOTE_ORDER = { ending: 0, length: 1, missing: 2 };

const S = {
 lang: (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en',
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
 upload: null, rec: null, micWait: null, playing: false,
 step: 'boot', render: null,
};
const t = () => STR[S.lang];
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
const panel = (...nodes) => { ui.panel.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false)); ui.panel.scrollTop = 0; syncPlayable(); };
function applyStaticText() {
 document.documentElement.lang = S.lang;
 for (const n of document.querySelectorAll('[data-s]')) n.textContent = tx(n.dataset.s);
 ui.lang.textContent = tx('lang');
 ui.lang.setAttribute('aria-label', S.lang === 'ko' ? 'Switch to English' : '한국어로 보기');
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
}
function stopSound() {
 for (const m of [ui.voice, ui.reply]) { try { m.pause(); } catch {} }
 ui.voice.removeAttribute('src'); try { ui.voice.load(); } catch {}
 if (S.playing) setPlaying(false);
}
function playUrl(url, s) {
 return new Promise((res) => {
  if (!url || !live(s) || S.rec) return res(false);
  stopSound();
  let settled = false; const m = ui.voice;
  const done = (ok) => { if (settled) return; settled = true; m.removeEventListener('ended', onEnd); m.removeEventListener('error', onErr); s.signal.removeEventListener('abort', onAbort); setPlaying(false); res(ok); };
  const onEnd = () => done(true); const onErr = () => done(false); const onAbort = () => { try { m.pause(); } catch {} done(false); };
  m.addEventListener('ended', onEnd); m.addEventListener('error', onErr); s.signal.addEventListener('abort', onAbort, { once: true });
  m.src = url; setPlaying(true);
  m.play().catch(() => done(false));
 });
}
function playVideo(url, from, to, s) {
 return new Promise((res) => {
  if (!url || !live(s) || S.rec) return res(false);
  stopSound();
  const v = ui.reply; let settled = false;
  const done = (ok) => { if (settled) return; settled = true; v.removeEventListener('ended', onEnd); v.removeEventListener('error', onErr); v.removeEventListener('timeupdate', onTime); s.signal.removeEventListener('abort', onAbort); try { v.pause(); } catch {} setPlaying(false); res(ok); };
  const onEnd = () => done(true); const onErr = () => done(false); const onAbort = () => done(false);
  const onTime = () => { if (to && v.currentTime >= to - 0.04) done(true); };
  v.addEventListener('ended', onEnd); v.addEventListener('error', onErr); v.addEventListener('timeupdate', onTime); s.signal.addEventListener('abort', onAbort, { once: true });
  if (!v.src.endsWith(url)) v.src = url;
  const go = () => { try { v.currentTime = from || 0; } catch {} v.muted = false; setPlaying(true); v.play().catch(() => done(false)); };
  if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
 });
}
function stageMode(mode) {
 ui.stage.dataset.mode = mode;
 if (mode === 'listen') { ui.loop.muted = true; ui.loop.play().catch(() => {}); } else { try { ui.loop.pause(); } catch {} }
}
const subsShowing = (ko) => !!ko && ui.subs.querySelector('.ko')?.textContent === ko;
function subs(ko, meaning, who) {
 if (!ko) { ui.subs.replaceChildren(); return; }
 ui.subs.replaceChildren(...[
  who ? h('span', { class: 'who' }, who) : null,
  h('p', { class: 'ko', lang: 'ko' }, ko),
  meaning ? h('p', { class: 'mean', lang: 'en' }, meaning) : null].filter(Boolean));
}
function hideSlate() { clearTimeout(slate.t); ui.slate.hidden = true; ui.slate.classList.remove('go'); }
function slate(text, ms = 1400) {
 ui.slate.textContent = text; ui.slate.hidden = false; ui.slate.classList.remove('go'); void ui.slate.offsetWidth; ui.slate.classList.add('go');
 clearTimeout(slate.t); slate.t = setTimeout(() => { ui.slate.hidden = true; }, ms);
}

/* ───────── 대화창(<dialog>) ───────── */
let dialogResolve = null;
function closeDialog(value = null) { if (ui.dialog.open) ui.dialog.close(); const r = dialogResolve; dialogResolve = null; if (r) r(value); }
function ask({ title, body, note, buttons }) {
 closeDialog();
 return new Promise((res) => {
  dialogResolve = res;
  ui.dialog.replaceChildren(h('div', { class: 'sheet-in' },
   h('h2', {}, title), body ? h('p', {}, body) : null, note ? h('p', { class: 'fine' }, note) : null,
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

async function sendTake(lineId, phase, take, s) {
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
  state.finish = () => {
   if (finished) return; finished = true;
   clearInterval(iv); clearTimeout(deadline); stopStream(stream);
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
function addTake(lineId, phase, blob) {
 const n = S.takes.filter((x) => x.lineId === lineId).length + 1;
 const take = { id: uuid(), lineId, phase, n, blob, url: URL.createObjectURL(blob) };
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
function stepper(active) {
 const steps = [['scene', tx('scene')], ['take2', tx('take2')], ['transfer', tx('transferTitle')], ['wrap', tx('wrapTitle')]];
 const idx = steps.findIndex(([k]) => k === active);
 return h('ol', { class: 'steps', 'aria-label': 'progress' }, steps.map(([k, label], i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' , 'aria-current': i === idx ? 'step' : null }, label)));
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
  out.push(h('span', { class: 'blank', style: `--n:${[...w].length}`, 'aria-label': '빈칸' }));
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
async function ensureConsent(s) {
 if (S.consent || !analysisCapable() || micUnusable()) return;
 const v = await ask({ title: tx('consentTitle'), body: tx('consentBody'), note: tx('consentNote'), buttons: [
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
  if (v === 'yes') { S.consent = 'no'; S.upload?.abort(); updateChip(); }
 } else {
  const v = await ask({ title: tx('consentTitle'), body: tx('consentBody'), note: tx('consentNote'), buttons: [{ label: tx('cancel'), value: 'no' }, { label: tx('consentYes'), value: 'yes', primary: true }] });
  if (v === 'yes') { S.consent = 'yes'; updateChip(); }
 }
});

/* ───────── 시작 ───────── */
async function boot() {
 S.step = 'boot';
 panel(h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('loading')));
 try {
  const r = await api('/api/bootstrap');
  if (!r.ok || !r.data?.lesson?.scene) throw new Error('boot');
  S.boot = r.data; S.csrf = r.data.csrfToken || ''; S.firstExposure = r.data.firstExposure !== false;
  S.maxSeconds = Math.max(5, Math.min(60, Number(r.data.limits?.maxSeconds) || 20));
 } catch {
  panel(h('div', { class: 'block' }, h('p', { class: 'lead' }, tx('bootFail')), h('button', { type: 'button', class: 'pill', on: { click: boot } }, tx('retry'))));
  return;
 }
 const a = { ...FALLBACK.assets, ...(S.boot.lesson.assets || {}) };
 ui.still.src = a.poster; ui.loop.src = a.listenLoop;
 document.documentElement.style.setProperty('--backdrop', `url("${a.backdrop}")`);
 const firstVideo = sceneItems().find((x) => x.video); if (firstVideo) { ui.reply.src = firstVideo.video; ui.reply.preload = 'auto'; }
 updateChip();
 intro();
}

function intro() {
 const s = newScope(); S.step = 'intro'; S.render = intro; hideSlate();
 stageMode('still'); subs(null);
 panel(h('div', { class: 'intro' },
  h('p', { class: 'eyebrow' }, tx('episode')),
  h('h1', {}, tx('todayRole')),
  h('dl', { class: 'cast' },
   h('div', {}, h('dt', {}, tx('me')), h('dd', {}, tx('roleMe'))),
   h('div', {}, h('dt', {}, tx('partner')), h('dd', {}, tx('rolePartner'))),
  ),
  h('p', { class: 'lead' }, tx('logline')),
  h('p', { class: 'fine synth' }, tx('synthetic')),
  h('button', { type: 'button', class: 'pill big', on: { click: () => { if (live(s)) runScene(0); } } }, h('span', { class: 'ic clap', 'aria-hidden': 'true' }), tx('start')),
 ));
}

/* ───────── 장면 ───────── */
async function runScene(i) {
 const s = newScope(); S.step = 'scene'; S.render = () => runScene(i); hideSlate();
 const item = sceneItems()[i];
 if (!item) return directorCut();
 if (item.type === 'actor') {
  await actorBeat(item, s);
  if (!live(s)) return;
  return runScene(i + 1);
 }
 return studentTurn(item, s, { phase: 'scene', onDone: () => runScene(i + 1) });
}

async function actorBeat(item, s, { from } = {}) {
 const who = tx('rolePartner').split(' · ')[0];
 panel(stepper(S.step === 'scene' ? 'scene' : 'take2'), h('div', { class: 'beat' }, h('p', { class: 'eyebrow' }, who), h('p', { class: 'actor-line', lang: 'ko' }, item.text), item.meaning ? h('p', { class: 'mean' }, item.meaning) : null));
 subs(item.text, item.meaning);
 let ok;
 if (item.video) { stageMode('reply'); ok = await playVideo(item.video, from ?? item.videoStart ?? 0, item.videoEnd, s); }
 else { stageMode('still'); ok = await playUrl(item.audio, s); }
 if (!live(s)) return false;
 if (!ok) {
  const v = await choose(s, (go) => [stepper(S.step === 'scene' ? 'scene' : 'take2'), h('div', { class: 'beat' }, h('p', { class: 'actor-line', lang: 'ko' }, item.text), h('div', { class: 'notice quiet' }, tx('mediaFail')),
   h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('again') } }, tx('replay')), h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('continue'))))]);
  if (v === 'again') return actorBeat(item, s, { from });
 }
 subs(null);
 return true;
}

async function reask(s, idx) {
 const r = lessonExtra('reasks')[Math.min(idx, 2)];
 if (!r) return;
 stageMode('still');
 subs(r.text, null);
 await playUrl(r.audio, s);
 if (!live(s)) return;
 subs(null); stageMode('listen');
}

// 내 차례 패널. 돌려줌: 'record' | 'next' | 'skip' | 'mic' | 'open' | null
function turnPanel(item, s, ctx, extra = []) {
 const L = line(item.id);
 const showFull = L.opened || micUnusable() || ctx.mode === 'readAlong';
 const practice = ctx.mode === 'practice' && !L.practiceOpened;
 return choose(s, (go) => [
  stepper(ctx.phase === 'scene' ? 'scene' : 'take2'),
  h('div', { class: 'turn' },
   h('p', { class: 'eyebrow' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), ctx.phase === 'retake' ? `${tx('take2')} · ${tx('yourTurn')}` : tx('yourTurn')),
   micNotice(),
   ...extra,
   h('div', { class: 'card' },
    practice
     ? [h('p', { class: 'mean big' }, item.meaning || ''), h('p', { class: 'fine' }, tx('practiceHint'))]
     : [h('p', { class: 'ko line', lang: 'ko' }, showFull ? item.text : blanked(item.text, item)), item.meaning ? h('p', { class: 'mean' }, item.meaning) : null]),
   h('div', { class: 'row aux' },
    item.modelAudio ? soundBtn(tx('modelListen'), item.modelAudio, s) : null,
    (!showFull || practice) ? h('button', { type: 'button', class: 'ghost', on: { click: () => go('open') } }, tx('openCard')) : null),
   micUnusable()
    ? h('div', { class: 'row main' },
      h('p', { class: 'fine' }, tx('readAlong')),
      h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('next')),
      h('button', { type: 'button', class: 'link', on: { click: () => go('mic') } }, tx('micRetry')))
    : h('div', { class: 'row main' },
      h('button', { type: 'button', class: 'rec', data: { rec: '1' }, disabled: S.playing, on: { click: () => go('record') } }, h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), tx('record')),
      h('button', { type: 'button', class: 'link', on: { click: () => go('skip') } }, tx('skipLine'))),
  )]);
}

function recordingPanel(s) {
 const left = h('span', { class: 'left' }, tx('secondsLeft', S.maxSeconds));
 panel(h('div', { class: 'turn recording' },
  h('p', { class: 'eyebrow' }, h('span', { class: 'live-dot rec', 'aria-hidden': 'true' }), tx('recording'), ' · ', left),
  h('div', { class: 'meter', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
  h('div', { class: 'row main' },
   h('button', { type: 'button', class: 'rec on', on: { click: () => stopRecorder(false) } }, h('span', { class: 'stop-sq', 'aria-hidden': 'true' }), tx('stop')),
   h('button', { type: 'button', class: 'link', on: { click: () => stopRecorder(true) } }, tx('cancel')))));
 return (sec) => { left.textContent = tx('secondsLeft', sec); };
}

async function sendingPanel(item, phase, take, s) {
 panel(h('div', { class: 'turn' }, h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('sending')),
  h('button', { type: 'button', class: 'link', on: { click: () => S.upload?.abort() } }, tx('cancelSend'))));
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
function micWaitPanel() {
 panel(h('div', { class: 'turn preparing' },
  h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('micPreparing')),
  h('p', { class: 'fine' }, tx('micPreparingHint')),
  h('button', { type: 'button', class: 'link', on: { click: () => stopRecorder(true) } }, tx('cancel'))));
}
async function captureAndSend(item, ctx, s) {
 micWaitPanel();
 let tick = null;
 const out = await recordOnce(s, { onStart: () => { if (live(s)) tick = recordingPanel(s); }, onTick: (sec) => tick?.(sec) });
 if (!live(s)) return null;
 if (!out) return null;
 if (out.mic === false) return { mic: false };
 if (out.seconds < 0.6 || !out.blob.size) {
  await choose(s, (go) => [h('div', { class: 'turn' }, h('div', { class: 'notice quiet' }, tx('tooShort')), h('button', { type: 'button', class: 'pill', on: { click: () => go(1) } }, tx('recordAgain')))]);
  return null;
 }
 const take = addTake(item.id, ctx.phase, out.blob);
 if (!analysisOn()) return { take, res: { kind: 'off' } };
 const res = await sendingPanel(item, ctx.phase, take, s);
 return { take, res };
}

async function studentTurn(item, s, ctx) {
 const L = line(item.id);
 await ensureConsent(s);
 if (!live(s)) return;
 stageMode('listen'); subs(null);
 const stepKey = ctx.phase === 'scene' ? 'scene' : 'take2';
 let invalid = 0;   // 이 차례에서 서버가 받지 않은 녹음(413·422) 수
 while (live(s)) {
  const action = await turnPanel(item, s, ctx);
  if (!live(s) || action == null) return;
  if (action === 'open') { if (ctx.mode === 'practice') L.practiceOpened = true; L.opened = true; L.helped = true; continue; }
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
  // 장면에서 말해 본 줄: 받아 적을 수 있었던 테이크, 또는 받아쓰기 없이(꺼짐·서버 사정) 녹음한 테이크.
  if (ctx.phase === 'scene' && (res.kind === 'off' || res.kind === 'down' || (res.kind === 'result' && !unheardData(res.data)))) L.spoken = true;
  if (res.kind === 'off' || res.kind === 'down') {
   const v = await selfCheckPanel(s, take, res.kind === 'off' ? 'practiceOnly' : 'apiDown', stepKey);
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
   await reask(s, L.unheard === 1 ? 1 : 2);
   continue;
  }
  // status ok — 판정이 있는 테이크
  L.unheard = 0;
  const obs = d.observation || { kind: 'pending', note: null };
  if (ctx.phase === 'retake') return ctx.onDone({ take, data: d });
  L.last = { obs, takeId: take.id, transcript: d.transcript || '' };
  if (obs.kind === 'note' && obs.note) {
   L.misses += 1;
   if (L.misses === 1) { await reask(s, 0); continue; }
   if (L.misses === 2) { L.opened = true; L.helped = true; continue; }
  }
  // pass · pending · 세 번째 어긋남 → 진행
  return ctx.onDone({ take, data: d });
 }
}

/* ───────── 컷 → 감독 노트 하나 ───────── */
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
function noteLines(note) {
 if (note.kind === 'ending') return [tx('noteEnding'), tx('noteEndingFix')];
 if (note.kind === 'length') return [tx('noteLength'), tx('noteLengthFix')];
 return [tx('noteMissing', note.word || '…'), tx('noteMissingFix')];
}

async function directorCut() {
 const s = newScope(); S.step = 'cut'; S.render = directorCut;
 const d = lessonExtra('director');
 stageMode('still'); subs(null);
 slate(tx('cutTitle'));
 const cand = pickNote();
 const goal = goalItem();
 if (cand) {
  S.retake = { lineId: cand.item.id, mode: 'note', note: cand.note, noteTakeId: cand.takeId, take2Id: null };
 } else {
  const lastGoal = [...S.takes].reverse().find((x) => x.lineId === goal.id && x.phase === 'scene');
  S.retake = { lineId: goal.id, mode: 'practice', note: null, noteTakeId: lastGoal?.id || null, take2Id: null };
 }
 await sleep(s, 500);
 if (!live(s)) return;
 subs(cand ? d.again.text : d.cut.text, null, tx('director'));
 // 감독 말은 기다리지 않는다. 단추를 누르면 다음 단계의 newScope()가 지금 소리와 리스너를 정리한다.
 playUrl(cand ? d.again.audio : d.cut.audio, s);
 const item = studentItems().find((x) => x.id === S.retake.lineId);
 const noteTake = takeById(S.retake.noteTakeId);
 const v = await choose(s, (go) => [stepper('take2'), h('div', { class: 'director' },
  h('p', { class: 'eyebrow' }, cand ? tx('directorNote') : h('span', { class: 'tag' }, tx('practiceTag'))),
  h('h2', {}, cand ? tx('directorNote') : tx('practiceTitle')),
  h('div', { class: 'card' }, h('p', { class: 'ko line', lang: 'ko' }, item.text), item.meaning ? h('p', { class: 'mean' }, item.meaning) : null),
  cand ? [h('p', { class: 'lead' }, noteLines(cand.note)[0]), h('p', { class: 'lead strong' }, noteLines(cand.note)[1]), h('p', { class: 'fine' }, tx('noteHedge'))]
   : [h('p', { class: 'lead' }, tx('practiceBody'))],
  h('div', { class: 'row aux' }, noteTake ? mineBtn(noteTake, s) : null, item.modelAudio ? soundBtn(tx('modelListen'), item.modelAudio, s) : null),
  h('p', { class: 'fine' }, tx('take2Lead')),
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('go') } }, tx('take2Start')),
   h('button', { type: 'button', class: 'link', on: { click: () => go('skip') } }, tx('toTransfer'))))]);
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

async function retakeResult(item, r, { replay = true } = {}) {
 const s = newScope(); S.step = 'take2-done'; S.render = () => retakeResult(item, r, { replay: false });
 const R = S.retake; const d = lessonExtra('director');
 if (r.take) R.take2Id = r.take.id;
 stageMode('still');
 const data = r.data; const obs = data?.observation;
 let msg = null; let cue = null; let hedge = false;
 // 연습 모드도 판정 종류를 그대로 따른다. 컷 소리는 pass에서만, 「고쳤다」 문구·칭찬 녹음은 노트를 받은 줄이 pass일 때만.
 if (data) {
  if (obs?.kind === 'pass') {
   if (R.mode === 'note') { msg = tx('t2Fixed'); cue = R.note?.kind === 'ending' ? d.betterEnding : d.cut; }
   else { msg = tx('t2PracticePass'); cue = d.cut; }
  } else if (obs?.kind === 'note' && R.mode === 'note') msg = tx('t2Again');
  else if (obs?.kind === 'note' && obs.note) { msg = noteLines(obs.note)[0]; hedge = true; }
  else msg = tx('t2Pending');
 }
 // 언어 전환(replay:false)은 소리를 다시 틀지 않고, 떠 있던 자막의 화자 표식만 지금 언어로 바꾼다.
 if (cue && replay) { subs(cue.text, null, tx('director')); playUrl(cue.audio, s); }
 else if (cue && subsShowing(cue.text)) subs(cue.text, null, tx('director'));
 else subs(null);
 const noteTake = takeById(R.noteTakeId); const t2 = takeById(R.take2Id);
 let checked = null;
 const render = () => choose(s, (go) => [stepper('take2'), h('div', { class: 'director' },
  h('p', { class: 'eyebrow' }, R.mode === 'practice' ? h('span', { class: 'tag' }, tx('practiceTag')) : tx('take2')),
  h('h2', {}, R.mode === 'practice' ? tx('practiceTitle') : tx('take2')),
  data?.transcript ? h('div', { class: 'heard' }, h('p', { class: 'fine' }, tx('heardAs')), h('p', { class: 'ko', lang: 'ko' }, data.transcript)) : null,
  msg ? h('p', { class: 'lead' }, msg) : null,
  hedge ? h('p', { class: 'fine' }, tx('noteHedge')) : null,
  !data && r.take ? h('p', { class: 'fine' }, tx(r.invalid ? 'invalidSelf' : analysisOn() ? 'apiDown' : 'practiceOnly')) : null,
  data?.transcript ? (checked ? h('p', { class: 'fine' }, tx(checked === 'differs' ? 'differsAck' : 'sameAck'))
   : h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('same') } }, tx('same')), h('button', { type: 'button', class: 'ghost', on: { click: () => go('differs') } }, tx('differs')))) : null,
  (noteTake || t2) ? h('div', { class: 'compare' }, h('p', { class: 'fine' }, tx('compare')),
   h('div', { class: 'row' }, noteTake ? mineBtn(noteTake, s, tx('takeLabel', 1)) : null, t2 ? mineBtn(t2, s, tx('takeLabel', 2)) : null)) : null,
  h('div', { class: 'row main' }, h('button', { type: 'button', class: 'pill', on: { click: () => go('next') } }, tx('toTransfer')),
   h('button', { type: 'button', class: 'link', data: { rec: '1' }, on: { click: () => go('again') } }, tx('recordAgain'))))]);
 for (;;) {
  const v = await render();
  if (!live(s) || v == null) return;
  if (v === 'same' || v === 'differs') { checked = v; R.selfCheck = v; continue; }
  if (v === 'again') return runRetake();
  return runTransfer();
 }
}

/* ───────── 새 상황 ───────── */
async function runTransfer() {
 const s = newScope(); S.step = 'transfer'; S.render = runTransfer;
 // tries: 녹음해 보낸 횟수(단추 모양용). spoke: 소리가 들린(또는 받아쓰기 없이 녹음한) 시도 수.
 // firstHinted: 첫 「말해 본 시도」가 시작될 때 모범이 공개돼 있었는지 — 첫 시도에서 한 번만 정하고 뒤 시도로 덮지 않는다.
 const T = S.transfer || (S.transfer = { tries: 0, spoke: 0, firstHinted: null, revealed: null, revealedBeforeFirst: false, last: null, selfCheck: null, unheard: 0 });
 const markSpoken = (d) => {
  // 서버 take.hinted는 이전 실행(다시하기 전)의 모범 공개도 포함한다. 받아쓰기 없이 녹음한 경우는 이 창의 기억으로만 안다.
  if (!T.spoke) T.firstHinted = d?.take ? (!!d.take.hinted || T.revealedBeforeFirst) : (!!T.revealed || S.revealedEver);
  T.spoke += 1;
 };
 const tr = S.boot.lesson.transfer;
 stageMode('still'); subs(null);
 if (T.tries === 0 && !T.introShown) { T.introShown = true; slate(tx('transferTitle'), 1200); }
 await ensureConsent(s);
 if (!live(s)) return;
 const item = { id: tr.id };
 for (;;) {
  const v = await transferPanel(s, tr, T);
  if (!live(s) || v == null) return;
  if (v === 'finish') return wrap();
  if (v === 'hint') { await revealModel(s, T); if (!live(s)) return; continue; }
  if (v === 'same' || v === 'differs') { T.selfCheck = v; continue; }
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
   T.tries += 1; T.selfCheck = null; T.lastTakeId = take.id;
   if (res.kind === 'off' || res.kind === 'down') { markSpoken(null); T.last = { kind: res.kind }; continue; }
   const d = res.data;
   // 무음·받아 적은 글 없음은 시도로 세지 않는다(모범 보기 전 안내도 그대로 남는다).
   if (unheardData(d)) { T.unheard += 1; T.last = { kind: 'unheard' }; continue; }
   markSpoken(d);
   // 글은 받아 적었지만 언어를 가리지 못한 unclear는 「안 들림」이 아니라 보류로 보여 준다.
   if (d.status === 'unclear') d.observation = { kind: 'pending', note: null, sure: false };
   T.unheard = 0;
   T.last = { kind: 'result', data: d };
  }
 }
}

function transferPanel(s, tr, T) {
 const lastTake = takeById(T.lastTakeId);
 const L = T.last; const d = L?.kind === 'result' ? L.data : null; const obs = d?.observation;
 let outcome = null;
 if (L?.kind === 'off') outcome = h('div', { class: 'notice quiet' }, tx('practiceOnly'));
 else if (L?.kind === 'down') outcome = h('div', { class: 'notice quiet' }, tx('apiDown'));
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
 return choose(s, (go) => [stepper('transfer'), h('div', { class: 'transfer' },
  h('p', { class: 'eyebrow' }, tx('transferTitle')),
  h('p', { class: 'lead' }, tx('transferLead')),
  h('div', { class: 'card situation' }, h('p', { class: 'fine' }, tx('transferPromptLabel')), h('p', { class: 'mean big', lang: 'en' }, tr.prompt), promptKo ? h('p', { class: 'fine' }, promptKo) : null),
  micNotice(),
  T.revealed ? h('div', { class: 'card model' }, h('p', { class: 'fine' }, tx('modelLabel')), h('p', { class: 'ko line', lang: 'ko' }, T.revealed.text), h('p', { class: 'fine' }, tx('modelUnreviewed')),
   T.revealed.modelAudio ? h('div', { class: 'row' }, soundBtn(tx('modelListen'), T.revealed.modelAudio, s)) : null) : null,
  outcome,
  d?.transcript && !T.selfCheck ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', on: { click: () => go('same') } }, tx('same')), h('button', { type: 'button', class: 'ghost', on: { click: () => go('differs') } }, tx('differs'))) : null,
  T.selfCheck === 'same' ? h('p', { class: 'fine' }, tx('sameAck')) : null,
  lastTake ? h('div', { class: 'row' }, mineBtn(lastTake, s)) : null,
  micUnusable()
   ? h('div', { class: 'row main' }, h('p', { class: 'fine' }, tx('readAlong')), h('button', { type: 'button', class: 'link', on: { click: () => go('mic') } }, tx('micRetry')))
   : h('div', { class: 'row main' }, h('button', { type: 'button', class: T.tries ? 'ghost' : 'rec', data: { rec: '1' }, disabled: S.playing, on: { click: () => go('record') } }, h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), T.tries ? tx('tryAgain') : tx('record'))),
  h('div', { class: 'row' },
   !T.revealed ? h('button', { type: 'button', class: 'link', on: { click: () => go('hint') } }, tx('hintBtn')) : null,
   (T.tries || micUnusable() || T.revealed || T.invalid >= INVALID_REPEAT) ? h('button', { type: 'button', class: T.tries ? 'pill' : 'ghost', on: { click: () => go('finish') } }, tx('finish')) : null),
 )]);
}

async function revealModel(s, T) {
 if (!T.spoke) {
  const ok = await ask({ title: tx('hintConfirmTitle'), body: tx('hintConfirmBody'), buttons: [{ label: tx('cancel'), value: 'no' }, { label: tx('hintShow'), value: 'yes', primary: true }] });
  if (ok !== 'yes' || !live(s)) return;
 }
 const epoch = S.epoch;
 let r;
 try { r = await api('/api/reveal', { method: 'POST', json: { lineId: S.boot.lesson.transfer.id }, signal: s.signal }); } catch { r = null; }
 if (!live(s) || epoch !== S.epoch) return;
 if (!r?.ok || !r.data?.text) { await ask({ title: tx('apiDown'), buttons: [{ label: tx('close'), value: 'ok', primary: true }] }); return; }
 // 서버가 reveal을 먼저 기록한 뒤에만 보인다.
 T.revealed = { text: r.data.text, modelAudio: r.data.modelAudio || null };
 if (!T.spoke) T.revealedBeforeFirst = true;
 S.revealedEver = true;
}

/* ───────── 마침 ───────── */
async function wrap({ replay = true } = {}) {
 const s = newScope(); S.step = 'wrap'; S.render = () => wrap({ replay: false }); hideSlate();
 const d = lessonExtra('director');
 stageMode('still');
 // 언어 전환·실패 화면에서 돌아올 때는 감독 마침 말을 다시 틀지 않는다.
 if (replay) { subs(d.wrap.text, null, tx('director')); playUrl(d.wrap.audio, s); }
 else if (subsShowing(d.wrap.text)) subs(d.wrap.text, null, tx('director'));
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
  return choose(s, (go) => [stepper('wrap'), h('div', { class: 'wrap' },
  h('h2', {}, tx('wrapTitle')),
  h('ul', { class: 'log' },
   h('li', {}, tick(spoken > 0), h('div', {}, h('b', {}, tx('wrapSpoken')), h('p', {}, tx('wrapLines', spoken, items.length)),
    readAlong ? h('p', { class: 'fine' }, tx('wrapReadAlong', readAlong)) : null, h('p', { class: 'fine' }, tx('wrapAnalysis')[mode]),
    withdrawn ? h('p', { class: 'fine' }, tx('wrapWithdrawn')) : null)),
   h('li', {}, tick(!!did2), h('div', {}, h('b', {}, R?.mode === 'note' ? tx('wrapNote') : tx('wrapPractice')),
    rItem ? h('p', { lang: 'ko', class: 'ko' }, rItem.text) : null, !did2 ? h('p', { class: 'fine' }, tx('wrapNoTake2')) : null)),
   h('li', {}, tick(!!T?.spoke), h('div', {}, h('b', {}, tx('wrapTransfer')), h('p', {}, T?.spoke ? tx('wrapTransferTried') : T?.tries ? tx('wrapTransferUnheard') : T?.invalid ? tx('wrapTransferInvalid') : tx('wrapTransferNot')),
    hintState ? h('p', { class: 'fine' }, tx(hintState)) : null)),
  ),
  h('div', { class: 'next-ep' }, h('p', { class: 'eyebrow' }, tx('wrapNext')), h('p', { class: 'strong' }, tx('nextTitle')), h('p', { class: 'fine' }, tx('nextLine'))),
  h('div', { class: 'takes' }, h('p', { class: 'eyebrow' }, tx('myTakes')),
   S.takes.length ? h('div', { class: 'take-list' }, S.takes.map((k) => {
    const it = items.find((x) => x.id === k.lineId);
    const label = it ? `${it.text.slice(0, 14)}… · ${tx('takeLabel', k.n)}` : `${tx('transferTitle')} · ${tx('takeLabel', k.n)}`;
    return mineBtn(k, s, label);
   })) : h('p', { class: 'fine' }, msg || tx('noTakes'))),
  h('div', { class: 'row main' },
   h('button', { type: 'button', class: 'pill', on: { click: () => go('restart') } }, tx('restart')),
   S.takes.length ? h('button', { type: 'button', class: 'ghost', on: { click: () => go('clear') } }, tx('clearTakes')) : null,
   analysisOn() ? h('button', { type: 'button', class: 'link', on: { click: () => go('withdraw') } }, tx('withdrawShort')) : null),
  h('p', { class: 'fine foot' }, tx('privacyFoot')),
  )]);
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
 const s = newScope(); S.step = 'reset'; S.render = null; subs(null);
 panel(h('div', { class: 'wait' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), tx('loading')));
 let r = null;
 try { r = await api('/api/reset', { method: 'POST', json: {}, signal: s.signal }); } catch {}
 if (!live(s)) return;
 if (!r?.ok || !r.data?.ok) return resetFailed();
 clearTakes();
 S.lines.clear(); S.retake = null; S.transfer = null; S.micNoticeShown = false; S.sentRun = false;
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
 S.lang = S.lang === 'ko' ? 'en' : 'ko';
 applyStaticText();
 // 녹음·마이크 허용 대기·전송 중이 아니면 지금 단계를 새 언어로 다시 그린다(intro·wrap 등 상태를 잃지 않는 단계만).
 if (!S.rec && !S.micWait && !S.upload && ['intro', 'wrap', 'transfer', 'take2-done', 'reset-fail'].includes(S.step) && S.render) S.render();
});
window.addEventListener('pagehide', () => { stopRecorder(true); S.upload?.abort(); clearTakes(); });

applyStaticText();
boot();
