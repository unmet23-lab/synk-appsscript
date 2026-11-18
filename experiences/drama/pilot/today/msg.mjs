// 「오늘」 메신저 판(11-19 유호님 「셋 다 전보다 훨씬 낫다 … a,b,c 다 괜찮은데 C가 가장 좋을것같네」 — qa/오늘한장-20261114/현황.md 14절,
// 시안 qa/오늘한장-20261114/움직임시안_20261118/c.html). screen.mjs의 오늘 장이 이 판을 그린다. 끝 화면(일력 한 장)은 screen.mjs 그대로다.
//   태오가 동그란 영상 메시지로 먼저 말을 건다 → 다 말하면 그 동그라미가 머리의 얼굴 자리로 날아간다(넓은 화면은 왼쪽에 듣는 얼굴로 남고 대화가 오른쪽에 들어온다) →
//   입력 중 점 → 어제 내 대사를 인용한 말풍선(흐렸던 「요」가 또렷해진다) → 오늘 장면 수와 시간 → 장면 사진 앨범 → 답장 단추 「좋아요, 시작할게요」.
// 강조 순위(설계 움직임시안_20261118/설계.md): 첫 1초는 태오의 얼굴과 목소리, 다음은 고칠 한마디, 그다음은 시작 단추. 장면 목록과 날짜는 물러선다.
// 동작마다 효과음 하나(sfx/ — LAB 무대의 소리, 일레븐랩스 효과음과 브랜드 사운드킷). 소리 자동 재생이 막히면 영상 메시지에 「눌러서 듣기」가 뜨고 대화는 바로 온다.
import { sceneFor, quoteFor, TAEO_SAY_AT } from './content.mjs';
import { proofLine as proof } from './plan.mjs';

const WD = '일월화수목금토';
const COUNT = ['', '하나', '두 개', '세 개'];
const count = (n) => COUNT[n] || `${n}개`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 「요」 한 글자는 낫표로 — screen.mjs의 yo와 같다.
const yo = (s) => esc(s).replace(/&#39;요&#39;/g, '<em class="td-yo">「요」</em>');
// 말하기 단추의 마이크 — 누르면 내가 말한다는 뜻(재생 삼각형은 「본다」로 읽혔다 — 11-18 시안 GPT 맹검).
const MIC = '<svg class="td-mic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const RING = '<svg class="td-ring2" viewBox="0 0 236 236" aria-hidden="true"><circle class="tr" cx="118" cy="118" r="114"/><circle class="pg" cx="118" cy="118" r="114" pathLength="1"/></svg>';
const sentences = (s) => String(s || '').trim().split(/(?<=[.?!])\s+/).filter(Boolean);

/** 장면 사진 앨범의 칸 하나 — 장면 컷 · 번호 · 시간 표 · 할 일 · 어디와 누구. 누르면 아래 말풍선에 앱이 본 까닭과 근거가 뜬다. */
function photo(it, i, lesson) {
 const sc = sceneFor(it, lesson) || { scene: {}, action: it.title, say: it.why?.lead || it.why?.text || '' };
 const img = sc.scene.img ? `<img src="${esc(sc.scene.img)}" alt="" decoding="async">` : '';
 // 어디 · 누구는 덩이마다 묶는다 — 좁은 칸에서 둘째 줄이 가운뎃점으로 시작하지 않게(11-19 Fable F5).
 const parts = [sc.scene.place, sc.scene.who].filter(Boolean);
 const head = parts.map((x, k) => `<span class="td-nb">${esc(x)}${k < parts.length - 1 ? ' ·' : ''}</span>`).join(' ');
 const text = it.why?.text || '';
 const rest = [sc.say ? text.replace(sc.say, '').trim() : text, it.why?.next || ''].filter(Boolean).join(' ');
 const more = `<b>${i + 1} · ${esc(sc.action)}</b>${sc.say ? `<span class="td-dsay">${yo(sc.say)}</span>` : ''}${rest ? `<span class="td-drest">${yo(rest)}</span>` : ''}<span class="td-proof">${esc(proof(it))}</span>`;
 return `<div class="td-scn-card td-ph${i === 0 ? ' big' : ''}" data-kind="${esc(it.kind)}" data-title="${esc(it.title)}">
  <button type="button" class="td-ph-b" data-ph aria-expanded="false" aria-controls="td-detail"><span class="td-im">${img}<span class="td-no" aria-hidden="true">${i + 1}</span><span class="td-mn">${it.minutes}분</span></span>
  <span class="td-t"><b>${esc(sc.action)}</b>${head ? `<span>${head}</span>` : ''}</span></button><template>${more}</template></div>`;
}

/**
 * 오늘 장(메신저 판) HTML. t: plan.mjs today 계약(이어서 연 날은 남은 차례만). line: 태오 한마디 { text, media }.
 * resume: 시작한 뒤 다시 연 날 — 영상 메시지를 다시 틀지 않는다. empty: 오늘 할 것이 없는 날.
 */
export function msgView({ t, lesson = {}, line = null, assets, resume = false, empty = false, day = Date.now() }) {
 const d = new Date(day);
 const n = empty ? 0 : t.items.length, min = empty ? 0 : t.minutes;
 const video = !resume && line?.media?.video ? line.media.video : null;
 const note = resume ? '' : `<div class="td-mg td-note-m" data-note-m>
   <button type="button" class="td-note${video ? '' : ' still'}" data-note aria-label="태오 선배 영상 메시지${video ? ' 듣기' : ''}: ${esc(line?.text || '')}"${video ? ` data-say="${esc(video)}"` : ''}>
    <video playsinline preload="auto" poster="${esc(assets.poster)}" ${video ? `src="${esc(video)}"` : `src="${esc(assets.listenLoop)}" muted loop autoplay`}></video>${RING}
    ${video ? '<span class="td-play"><i aria-hidden="true"></i>눌러서 듣기</span>' : ''}</button>
   <p class="td-cap" data-cap aria-live="polite">${video ? '' : yo(line?.text || '')}</p></div>`;
 const q = !empty && !resume ? quoteFor(t.items[0], lesson) : null;
 const msgs = [];
 // 할 것이 없는 날은 태오의 한마디(영상 메시지 아래 글)가 곧 그 말이다 — 말풍선을 따로 두지 않는다.
 if (!empty) {
  if (q) {
   msgs.push(`<div class="td-mg td-b" data-m><span class="td-qt"><span class="td-qk">${esc(q.label)}</span><span class="td-ql">「${esc(q.tail)}${q.ghost ? `<i class="td-gh" data-gh>${esc(q.ghost)}</i>` : ''}」</span></span>${yo(q.said)}</div>`);
   msgs.push(`<p class="td-mg td-b" data-m data-ask>${yo(q.ask)}</p>`);
  }
  msgs.push(`<p class="td-mg td-b" data-m>${resume ? `남은 장면 ${count(n)}, 이어서 해요. ${min}분이면 돼요.` : `오늘은 장면 ${count(n)}만 같이 해요. ${min}분이면 돼요.`}</p>`);
  msgs.push(`<div class="td-mg td-al" data-m data-album>${t.items.map((it, i) => photo(it, i, lesson)).join('')}</div>`);
  msgs.push('<div class="td-mg td-b td-detail" id="td-detail" data-detail hidden></div>');
 }
 const go = empty
  ? `<button type="button" class="td-go2" data-episode>1화 처음부터</button>`
  : `<button type="button" class="td-go2" data-go>${MIC}<span class="td-gl">${resume ? '이어서 할게요' : '좋아요, 시작할게요'}</span><span class="td-gm">· ${min}분</span></button>${resume ? '' : '<button type="button" class="td-later" data-episode>이따가 할게요</button>'}`;
 const subj = n === 1 ? '장면 하나가' : `장면 ${count(n)}가`;
 const wait = video && !empty ? `<div class="td-wait" data-wait><span>다 보면 오늘 할 ${subj} 와요 · ${min}분</span><button type="button" class="td-snd td-snd2" data-snd aria-pressed="true"><i aria-hidden="true"></i>소리</button><button type="button" data-skip>건너뛰기</button></div>` : '';
 return `<div class="td-msg-stage"><aside class="td-msg-left" data-left></aside>
  <section class="td-msg-app" aria-label="태오 선배의 메시지">
   <header class="td-msg-hd">${line?.media?.video
    ? `<button type="button" class="td-av${resume ? ' face' : ''}" data-av data-say="${esc(line.media.video)}" aria-label="태오 선배 한마디 다시 듣기"${resume ? '' : ' disabled'}><span aria-hidden="true">태</span><img src="${esc(assets.poster)}" alt=""></button>`
    : `<span class="td-av${resume ? ' face' : ''}" data-av aria-hidden="true"><span>태</span><img src="${esc(assets.poster)}" alt=""></span>`}
    <span class="td-nm2"><b>태오 선배</b><span class="td-st" data-st>드라마에서 만난 선배 · 학생 식당</span></span>
    <button type="button" class="td-snd" data-snd aria-pressed="true"><i aria-hidden="true"></i>소리</button></header>
   <div class="td-thread" data-thread><span class="td-day" data-day>오늘 · ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일</span>${note}${msgs.join('')}</div>
   ${wait}<div class="td-reply" data-reply>${go}</div>
  </section></div>`;
}

/**
 * 오늘 장의 움직임과 소리 — 그린 뒤 한 번 부른다. root가 화면에서 빠지면(다음 차례로 갔으면) 멈춘다.
 * line: 태오 한마디, assets: { listenLoop, poster }. 시험이 보는 것: 단추(data-go)와 장면 칸(.td-scn-card)은 처음부터 DOM에 있다(차례대로 드러날 뿐).
 */
export function msgPlay(root, { line = null, assets, resume = false, empty = false } = {}) {
 const $ = (s) => root.querySelector(s);
 const media = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
 const reduce = media('(prefers-reduced-motion: reduce)');
 const mq = (() => { try { return matchMedia('(min-width: 1024px)'); } catch { return null; } })();
 let wide = Boolean(mq?.matches);
 const alive = () => root.isConnected;
 const pause = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 40) : ms));
 const read = (s) => new Promise((r) => setTimeout(r, 1400 + [...String(s || '')].length * 55)); // 글을 읽을 시간 — 움직임 줄이기와 상관없다
 let quiet = false;
 // 녹화 도구(qa/오늘한장-20261114/오늘녹화.cjs)가 window.__sfx를 깔아 두면 소리마다 시각을 남긴다 — 녹화에 같은 소리를 입히려고. 평소에는 없다.
 const log = (name, vol, back = 0) => { try { window.__sfx?.push({ t: performance.now() / 1000 - back, name, vol }); } catch { /* 없음 */ } };
 const sfx = (name, vol = 0.5) => { if (quiet || !alive()) return; log(`sfx/${name}`, vol); try { const a = new Audio(new URL(`./sfx/${name}`, import.meta.url).href); a.volume = vol; a.play().catch(() => {}); } catch { /* 소리 없이 */ } };
 const thread = $('[data-thread]'), note = $('[data-note]'), noteM = $('[data-note-m]'), v = note?.querySelector('video'), cap = $('[data-cap]');
 const scroll = () => { if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); };
 const show = (el, cls = 'in') => { if (!el) return; el.classList.add(cls); };
 const status = (s) => { const st = $('[data-st]'); if (st) { st.textContent = s || '드라마에서 만난 선배 · 학생 식당'; st.classList.toggle('typing', !!s); } };
 // 소리 단추는 머리와(넓은 화면은 보는 동안 기다림 줄에도) 있다 — 둘이 같은 상태다.
 const snds = [...root.querySelectorAll('[data-snd]')];
 for (const snd of snds) snd.addEventListener('click', () => {
  quiet = !quiet; for (const x of snds) { x.setAttribute('aria-pressed', String(!quiet)); x.classList.toggle('off', quiet); }
  // 말하는 판(고리가 아닌 때)과 머리에서 다시 듣는 소리를 같이 끈다 — 듣는 고리는 늘 무음이다.
  if (v && !note.classList.contains('still') && !v.loop) v.muted = quiet;
  const h = root.querySelector('video.td-again'); if (h) h.muted = quiet;
 });

 // 넓은 화면: 영상 메시지는 왼쪽 기둥에서 크게 — 보는 동안은 가운데, 다 말하면 왼쪽으로 비키고 대화가 들어온다.
 // 보는 동안 대화 칸은 비어 있어 숨기고(inert) 소리 단추는 기다림 줄에 둔다. 폭이 바뀌면(태블릿을 돌림) 같은 판단으로 다시 놓는다(11-19 Fable F4).
 const left = $('[data-left]'), app = $('.td-msg-app'), waitEl = $('[data-wait]'), reply = $('[data-reply]');
 const place = () => {
  if (!noteM || !noteM.isConnected) { root.classList.toggle('solo', wide); root.classList.remove('pre'); if (app) app.inert = false; return; }
  if (wide) {
   left.append(noteM); if (!left.querySelector('.td-who2')) left.insertAdjacentHTML('beforeend', `<p class="td-who2${done ? ' gone' : ''}"><b>태오 선배</b> · 드라마에서 만난 선배</p>`);
   if (waitEl) left.append(waitEl); root.classList.remove('solo'); root.classList.toggle('pre', !done); if (app) app.inert = !done; noteM.classList.remove('kept');
  } else {
   const day = $('[data-day]'); thread.insertBefore(noteM, day ? day.nextSibling : thread.firstChild);
   if (waitEl) app.insertBefore(waitEl, reply); root.classList.remove('pre', 'solo'); if (app) app.inert = false; if (done) noteM.classList.add('kept');
  }
 };
 let done = false;
 place();
 mq?.addEventListener?.('change', () => { if (!alive()) return; wide = mq.matches; place(); });
 requestAnimationFrame(() => root.classList.add('on'));
 sfx('notify.wav', 0.45);

 // 자막 — 문장마다 말이 시작하는 초(content.mjs TAEO_SAY_AT), 없으면 글자 수에 비례.
 const said = sentences(line?.text);
 const startsOf = (dur) => {
  const at = TAEO_SAY_AT[line?.code];
  if (at && at.length === said.length) return at;
  const lead = Math.min(1.2, dur * 0.15), span = Math.max(0.5, dur - lead - 0.3), total = said.join('').length || 1;
  let acc = 0; return said.map((s) => { const x = lead + (span * acc) / total; acc += s.length; return x; });
 };
 let cur = -1;
 const tick = () => {
  if (!v || !cap || !alive() || note.classList.contains('heard')) return;
  const d = v.duration || 8, at = startsOf(d), t = v.currentTime;
  let i = -1; at.forEach((x, k) => { if (t >= x) i = k; });
  if (i !== cur) { cur = i; cap.innerHTML = i < 0 ? '' : said[i].split(' ').map((w, k) => `<span class="w" style="animation-delay:${k * 60}ms">${yo(w)}</span>`).join(' '); }
  const pg = note.querySelector('.pg'); if (pg) pg.style.strokeDashoffset = String(1 - Math.min(1, t / d));
  if (!v.paused && !v.ended) requestAnimationFrame(tick);
 };

 async function after({ keep = false } = {}) {
  if (done || !alive()) return; done = true;
  $('[data-wait]')?.classList.add('gone');
  if (noteM && !keep) {
   if (wide) {
    // 왼쪽에 남아 듣는 얼굴로 — 말하는 판을 듣는 고리로 바꾼다.
    note.classList.add('heard'); $('.td-who2')?.classList.add('gone'); const pg = note.querySelector('.pg'); if (pg) pg.style.strokeDashoffset = '0';
    if (v && !note.classList.contains('still')) { v.muted = true; v.loop = true; v.src = assets.listenLoop; v.play().catch(() => {}); }
    if (!note.classList.contains('still') && !empty) cap?.classList.add('gone'); // 글로만 말한 날은 그 글이 남는다
    const day = $('[data-day]'); day?.classList.add('gone'); setTimeout(() => day?.remove(), reduce ? 0 : 450);
   } else {
    // 동그라미가 머리의 얼굴 자리로 날아간다.
    const a = $('[data-av]'), n = note.getBoundingClientRect(), av = a.getBoundingClientRect();
    if (!reduce && n.width) {
     const fly = document.createElement('div'); fly.className = 'td-fly'; fly.setAttribute('aria-hidden', 'true');
     Object.assign(fly.style, { left: `${n.left + 6}px`, top: `${n.top + 6}px`, width: `${n.width - 12}px`, height: `${n.height - 12}px` });
     if (v) { v.pause(); fly.append(v); }
     root.append(fly); sfx('whoosh.mp3', 0.4);
     fly.animate([{ left: fly.style.left, top: fly.style.top, width: fly.style.width, height: fly.style.height }, { left: `${av.left}px`, top: `${av.top}px`, width: `${av.width}px`, height: `${av.height}px` }], { duration: 800, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
      .finished.then(() => { fly.remove(); a.classList.add('face'); a.disabled = !a.dataset.say; sfx('clipsnap.mp3', 0.45); a.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }).catch(() => { fly.remove(); a.classList.add('face'); a.disabled = !a.dataset.say; });
    } else { a.classList.add('face'); a.disabled = !a.dataset.say; }
    if (note.classList.contains('still') || empty) thread.insertBefore(Object.assign(document.createElement('p'), { className: 'td-mg td-b', innerHTML: yo(line?.text || '') }), root.querySelector('[data-m]') || null).setAttribute('data-m', '');
    noteM.classList.add('gone'); $('[data-day]')?.classList.add('gone');
    setTimeout(() => { noteM.remove(); $('[data-day]')?.remove(); }, reduce ? 0 : 650);
   }
  }
  if (wide && noteM) { root.classList.remove('pre'); if (app) app.inert = false; sfx('slide.mp3', 0.4); }
  if (keep && noteM && !wide) noteM.classList.add('kept'); // 소리가 막힌 날 — 영상 메시지는 대화 안에 작게 남아 누르면 듣는다
  if (!keep) await pause(700);
  for (const m of root.querySelectorAll('[data-m]')) {
   if (!alive()) return;
   if (m.matches('[data-album]')) { await pause(400); sfx('whoosh.mp3', 0.45); show(m); setTimeout(() => sfx('flip.mp3', 0.35), 160); scroll(); setTimeout(scroll, 700); continue; }
   if (!keep) await typing(m.matches('[data-ask]') ? 0 : 750);
   show(m); sfx('pop.mp3', 0.45); scroll();
   if (m.matches('[data-ask]')) { const g = $('[data-gh]'); if (g) setTimeout(() => { g.classList.add('on'); sfx('stamp.mp3', 0.55); }, 300); }
   await pause(m.querySelector('.td-qt') ? 900 : 550);
  }
  await pause(900);
  if (!alive()) return;
  show($('[data-reply]')); sfx('pop.mp3', 0.35); scroll();
 }
 async function typing(ms) {
  if (!ms || reduce) return;
  const d = document.createElement('div'); d.className = 'td-mg td-dots in'; d.setAttribute('aria-hidden', 'true'); d.innerHTML = '<i></i><i></i><i></i>';
  thread.append(d); status('입력 중…'); scroll();
  await pause(ms); d.remove(); status('');
 }

 // 장면 사진을 누르면 그 할 일의 까닭과 근거가 앨범 아래 말풍선에 뜬다(장면 판의 펼침과 같은 글). 다시 누르면 닫힌다.
 const detail = $('[data-detail]');
 for (const b of root.querySelectorAll('[data-ph]')) b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') === 'true';
  for (const x of root.querySelectorAll('[data-ph]')) x.setAttribute('aria-expanded', 'false');
  sfx('press.mp3', 0.4);
  if (open || !detail) { if (detail) detail.hidden = true; return; }
  b.setAttribute('aria-expanded', 'true');
  detail.innerHTML = b.parentElement.querySelector('template').innerHTML; detail.hidden = false; detail.classList.remove('in'); void detail.offsetWidth; detail.classList.add('in'); scroll();
 });

 // 머리의 얼굴을 누르면 그 한마디를 다시 듣는다(휴대폰 — 영상은 날아간 뒤라 소리만). 날아오기 전에는 꺼 둔다.
 const av = $('[data-av]');
 if (av?.dataset.say) av.addEventListener('click', () => {
  if (!av.classList.contains('face') || !av.dataset.say) return;
  let h = root.querySelector('video.td-again'); if (!h) { h = document.createElement('video'); h.className = 'td-again'; h.hidden = true; h.playsInline = true; h.src = av.dataset.say; root.append(h); h.addEventListener('ended', () => av.classList.remove('speaking')); }
  av.classList.add('speaking'); h.muted = quiet; try { h.currentTime = 0; } catch { /* 처음 */ } h.play().catch(() => av.classList.remove('speaking'));
 });
 // 이어서 연 날 — 영상 메시지 없이 말풍선부터.
 if (resume || !noteM) { show(noteM); return after({ keep: true }); }
 show(noteM);
 if (!v || note.classList.contains('still')) {
  // 구운 한마디가 없거나 파일이 없다 — 듣는 얼굴과 글로 말하고, 읽을 만큼 기다린 뒤 이어진다.
  return read(line?.text).then(() => after());
 }
 const still = () => { note.classList.add('still'); note.removeAttribute('data-say'); if (av) { av.removeAttribute('data-say'); av.disabled = true; } v.removeAttribute('src'); v.src = assets.listenLoop; v.muted = true; v.loop = true; v.play().catch(() => {}); if (cap) cap.innerHTML = yo(line?.text || ''); };
 const blocked = () => { note.classList.add('tap'); after({ keep: true }); };
 const talk = new URL(note.dataset.say, location.href).href;
 const toLoop = () => { note.classList.add('heard'); cap?.classList.add('gone'); const pg = note.querySelector('.pg'); if (pg) pg.style.strokeDashoffset = '0'; v.muted = true; v.loop = true; v.src = assets.listenLoop; v.play().catch(() => {}); };
 const play = () => {
  note.classList.remove('tap', 'heard'); cap?.classList.remove('gone'); cur = -1;
  if (v.src !== talk) v.src = talk;
  v.loop = false; v.muted = quiet; try { v.currentTime = 0; } catch { /* 처음 */ }
  return v.play().then(() => { requestAnimationFrame(tick); });
 };
 v.addEventListener('play', () => { if (!v.muted && !note.classList.contains('still')) log(`video:${new URL(v.currentSrc || v.src, location.href).pathname}`, 1, v.currentTime || 0); });
 v.addEventListener('ended', () => { tick(); if (!done) after(); else if (wide) toLoop(); });
 v.addEventListener('error', () => { if (note.classList.contains('still')) return; still(); if (!done) read(line?.text).then(() => after()); }, { once: true });
 note.addEventListener('click', () => { if (note.classList.contains('still')) return; sfx('press.mp3', 0.4); play().catch(() => {}); });
 $('[data-skip]')?.addEventListener('click', () => { sfx('press.mp3', 0.4); v.pause(); after(); });
 setTimeout(() => { if (!alive() || done || note.classList.contains('still')) return; play().catch((e) => { if (v.error || e?.name === 'NotSupportedError') return; blocked(); }); }, reduce ? 0 : 450);
}
