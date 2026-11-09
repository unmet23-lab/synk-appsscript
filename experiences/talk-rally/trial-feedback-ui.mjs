// 말 랠리 체험 의견 카드 · 입구 참여 줄(2026-11-09). 상태와 보내기는 trial-feedback.mjs, 화면 글은 설계 §4(README 체험 의견 절).
// 게임을 막지 않는다: 결과 화면 맨 아래 접힌 카드, 덮개 · 자동 포커스 없음. 동의(보내기) 전에는 어떤 요청도 없다. WORLD에서는 app.mjs가 불러오지 않는다.
import { createTrialFeedback, resolveCollector, cohortFrom, normalizeAnswers, newId } from './trial-feedback.mjs';

const Q_FUN = [['fun_4', '또 하고 싶을 만큼 재미있었어요'], ['fun_3', '재미있었어요'], ['fun_2', '그저 그랬어요'], ['fun_1', '재미없었어요']];
const Q_STUCK = [['listen', '몽글의 말이 잘 안 들렸어요'], ['read', '대답 카드 글을 읽기 어려웠어요'], ['howto', '무엇을 해야 하는지 몰랐어요'],
  ['control', '카드를 긋거나 누르는 게 불편했어요'], ['sound', '소리가 안 나오거나 끊겼어요'], ['perf', '화면이 느리거나 멈췄어요'], ['none', '막힌 곳 없었어요']];
const Q_AGAIN = [['again_1d', '내일도 할 것 같아요'], ['again_7d', '일주일 안에 한 번쯤요'], ['again_unsure', '잘 모르겠어요'], ['again_no', '다시 안 할 것 같아요']];

export const COPY = Object.freeze({
  tag: '체험 의견 · 선택',
  title: '말 랠리를 같이 고쳐 주실래요?',
  lede: '질문 3개, 30초면 끝나요. 안 해도 게임은 그대로예요.',
  join: '참여하기', no: '괜찮아요',
  consentTitle: '보내기 전에 읽어 주세요',
  sends: '보내는 것: 아래 답, 이번 판의 맞힌 수·도움 쓴 수·소리를 켰는지·판 종류(보통/하루 도전), 모집 링크로 왔다면 그 링크 이름, 그리고 앞으로 30일 동안 이 브라우저에서 말 랠리를 다시 열었는지와 한 판을 시작·완료했는지(완료한 판은 맞힌 수·도움 쓴 수·소리 설정·판 종류도).',
  notSends: '보내지 않는 것: 이름·연락처·목소리·계정·들은 문장과 고른 대답.',
  keep: '이 브라우저의 익명 참여 번호로만 묶어요. 운영 기록은 90일 뒤 저절로 지워지고, 사고 복구용 백업에는 그 뒤에도 남아 있을 수 있어요. 90일 동안 입구에서 언제든 그만두고 보낸 기록을 지울 수 있어요.',
  age: '만 14세 이상이에요',
  qFun: '몽글이랑 공을 주고받는 거, 재미있었어요?',
  qStuck: '어디서 막혔어요? 해당하는 걸 모두 골라 주세요.',
  qNote: '더 알려 주고 싶은 게 있으면 짧게 적어 주세요(선택, 100자)',
  noteHint: '이름·연락처는 적지 말아 주세요.',
  qAgain: '내일이나 일주일 안에 또 한 판 할 것 같아요?',
  clear: '고른 것 지우기',
  skipHint: '건너뛰고 싶은 질문은 비워 두셔도 돼요.',
  needHint: '14세 확인에 체크하고 질문 하나 이상에 답하면 보낼 수 있어요.',
  send: '보내기', sending: '보내는 중…', cancel: '취소',
  sent: '고마워요! 답을 보냈어요. 다음에 오시면 다시 온 것과 판 결과만 조용히 셀게요.',
  offline: '인터넷에 닿지 않아 아직 못 보냈어요. 이 브라우저에 담아 두었다가 다음에 열 때 다시 보낼게요.',
  offlineOnce: '인터넷에 닿지 않아 못 보냈어요. 이 브라우저는 답을 담아 둘 수 없어 이 화면에서만 다시 보낼 수 있어요.',
  busy: '지금은 받을 수 없어요. 잠시 뒤에 다시 보내 주세요.',
  full: '지금은 체험 참여를 더 받지 않아요. 답은 보내지 않았어요.',
  refused: '지금은 체험 의견을 받지 않아요. 답은 보내지 않았어요.',
  invalid: '답을 보내지 못했어요. 새로 고친 뒤 다시 해 주세요.',
  retry: '지금 다시 보내기',
  lineActive: (d) => `체험 참여 중 · ${d}일 남았어요.`,
  linePending: '체험 답을 아직 보내지 못했어요.',
  lineExpired: '체험 기간이 끝났어요. 더 보내지 않아요.',
  lineEnded: '지금은 체험 기록을 더 받지 않아요. 더 보내지 않아요.',
  lineWithdrawing: '이 브라우저에서는 그만두었지만 서버 기록은 아직 남아 있어요.',
  lineWithdrawn: '그만두었어요. 보낸 기록을 지웠어요.',
  lineErasing: '보낸 기록을 지우는 중이에요…',
  leave: '그만두기', erase: '보낸 기록 지우기', eraseAgain: '다시 지우기', resend: '다시 보내기',
  confirmLeave: '그만두면 지금까지 보낸 답과 방문 기록을 지워요. 게임 기록은 그대로예요. 그만둘까요?',
});

const radios = (name, list) => list.map(([v, t]) => `<label class="tf-opt"><input type="radio" name="${name}" value="${v}"><span>${t}</span></label>`).join('');
const checks = (name, list) => list.map(([v, t]) => `<label class="tf-opt"><input type="checkbox" name="${name}" value="${v}"><span>${t}</span></label>`).join('');

/**
 * card: 결과 화면의 빈 칸(#r-trial), line: 입구의 한 줄(#trial-line). 수집 주소가 없으면 null(기능 꺼짐).
 * 게임 흐름에서 부르는 함수는 모두 예외를 밖으로 내지 않는다.
 */
export function createTrialUi({ doc = document, loc = location, storage, announce = () => {}, confirmFn = (t) => window.confirm(t), world = false, fetchImpl, now } = {}) {
  const collector = resolveCollector({ origin: loc.origin, hostname: loc.hostname, search: loc.search, world });
  let ls = storage; if (!ls) { try { ls = window.localStorage; } catch { ls = null; } }
  const tf = collector && createTrialFeedback({ storage: ls || { getItem: () => null, setItem: () => { throw new Error('no storage'); }, removeItem: () => {} },
    collector, cohort: cohortFrom(loc.search), ...(fetchImpl ? { fetchImpl } : {}), ...(now ? { now } : {}), onChange: () => paintLine() });
  const card = doc.getElementById('r-trial'), line = doc.getElementById('trial-line');
  if (!tf || !card || !line) { if (card) card.hidden = true; if (line) line.hidden = true; return null; }
  let offeredThisLoad = false, lineFlash = null, round = null, cur = null;
  const safe = (fn) => (...a) => { try { return fn(...a); } catch { return undefined; } };

  /* ── 입구 한 줄 ── */
  function paintLine() {
    const st = tf.status();
    const btn = (act, text) => `<button class="text-link tf-act" type="button" data-tf="${act}">${text}</button>`;
    let html = '';
    if (lineFlash) html = `<span>${lineFlash}</span>`;
    else if (st.phase === 'active') html = `<span>${COPY.lineActive(st.daysLeft)}</span> ${btn('leave', COPY.leave)}`;
    else if (st.phase === 'pending') html = `<span>${COPY.linePending}</span> ${btn('resend', COPY.resend)} · ${btn('leave', COPY.leave)}`;
    else if (st.phase === 'expired') html = `<span>${st.ended ? COPY.lineEnded : COPY.lineExpired}</span> ${btn('leave', COPY.erase)}`;
    else if (st.phase === 'withdrawing' && st.busy) html = `<span>${COPY.lineErasing}</span>`;
    else if (st.phase === 'withdrawing') html = `<span>${COPY.lineWithdrawing}</span> ${btn('erase-again', COPY.eraseAgain)}`;
    line.hidden = !html;
    if (line.dataset.html !== html) { line.innerHTML = html; line.dataset.html = html; }
    line.dataset.phase = st.phase;
  }
  line.addEventListener('click', safe(async (e) => {
    const act = e.target.closest('[data-tf]')?.dataset.tf; if (!act) return;
    if (act === 'resend') {   // 누른 결과를 그 자리에 알린다
      const b = e.target.closest('button'); if (b) { b.disabled = true; b.textContent = COPY.sending; }
      const r = await tf.flush(), st = tf.status();
      const msg = st.phase === 'active' ? COPY.sent : st.phase === 'pending' ? (r.kind === 'busy' ? COPY.busy : COPY.offline)
        : COPY[['full', 'refused', 'invalid'].includes(r.kind) ? r.kind : 'invalid'];
      lineFlash = msg; announce(msg); paintLine();
      setTimeout(() => { lineFlash = null; paintLine(); }, 6000);
      return;
    }
    if (act === 'leave' && !confirmFn(COPY.confirmLeave)) return;
    const r = await tf.withdraw();
    if (r.kind === 'withdrawn') { lineFlash = COPY.lineWithdrawn; announce(COPY.lineWithdrawn); setTimeout(() => { lineFlash = null; paintLine(); }, 6000); }
    else announce(COPY.lineWithdrawing);
    paintLine();
  }));

  /* ── 결과 카드 ── */
  function collapsed() {
    card.innerHTML = `<span class="tag">${COPY.tag}</span>
      <h2 class="tf-title" id="r-trial-title">${COPY.title}</h2>
      <p class="reason">${COPY.lede}</p>
      <div class="tf-actions"><button class="chip-btn tf-join" type="button" data-tf="join">${COPY.join}</button><button class="text-link tf-no" type="button" data-tf="no">${COPY.no}</button></div>`;
    card.dataset.view = 'collapsed';
  }
  function expanded() {
    card.innerHTML = `<span class="tag">${COPY.tag}</span>
      <form class="tf-form" novalidate>
        <section class="tf-consent" aria-labelledby="tf-consent-title">
          <h2 class="tf-title" id="tf-consent-title" tabindex="-1">${COPY.consentTitle}</h2>
          <p>${COPY.sends}</p><p>${COPY.notSends}</p><p>${COPY.keep}</p>
          <label class="tf-age"><input type="checkbox" name="age14"><span>${COPY.age}</span></label>
        </section>
        <p class="fine tf-skip">${COPY.skipHint}</p>
        <div class="tf-qs">
          <fieldset class="tf-q" data-q="fun"><legend><b>1</b> ${COPY.qFun}</legend>${radios('fun', Q_FUN)}<button class="text-link tf-clear" type="button" data-tf="clear" data-name="fun" hidden>${COPY.clear}</button></fieldset>
          <fieldset class="tf-q" data-q="stuck"><legend><b>2</b> ${COPY.qStuck}</legend>${checks('stuck', Q_STUCK)}
            <label class="tf-note"><span>${COPY.qNote}</span><textarea name="note" maxlength="100" rows="2"></textarea><small><span class="tf-count">0</span>/100 · ${COPY.noteHint}</small></label></fieldset>
          <fieldset class="tf-q" data-q="again"><legend><b>3</b> ${COPY.qAgain}</legend>${radios('again', Q_AGAIN)}<button class="text-link tf-clear" type="button" data-tf="clear" data-name="again" hidden>${COPY.clear}</button></fieldset>
        </div>
        <p class="fine tf-need" id="tf-need">${COPY.needHint}</p>
        <div class="tf-actions"><button class="chip-btn tf-send" type="submit" data-tf="send" disabled aria-describedby="tf-need">${COPY.send}</button><button class="text-link" type="button" data-tf="cancel">${COPY.cancel}</button></div>
        <p class="tf-status" role="status" hidden></p>
      </form>`;
    card.dataset.view = 'form';
    sync();
  }
  function done(kind, { retry = false } = {}) {
    const msg = COPY[kind] || COPY.invalid;
    card.innerHTML = `<span class="tag">${COPY.tag}</span>
      <p class="tf-status ${kind === 'sent' ? 'ok' : 'warn'}" role="${kind === 'sent' ? 'status' : 'alert'}" tabindex="-1">${msg}</p>
      ${retry ? `<div class="tf-actions"><button class="chip-btn" type="button" data-tf="retry">${COPY.retry}</button></div>` : ''}`;
    card.dataset.view = kind;
    if (card.isConnected) card.querySelector('.tf-status')?.focus({ preventScroll: false });
  }
  function answers() {
    const f = card.querySelector('form'); if (!f) return null;
    return normalizeAnswers({ fun: f.fun?.value || null, stuck: [...f.querySelectorAll('input[name=stuck]:checked')].map((x) => x.value), note: f.note?.value || '', again: f.again?.value || null });
  }
  function sync() {
    const f = card.querySelector('form'); if (!f) return;
    const ok = f.age14.checked && !!answers();
    const send = f.querySelector('.tf-send');
    if (!send.dataset.busy) send.disabled = !ok;
    f.querySelector('.tf-need').hidden = ok;
    for (const b of f.querySelectorAll('.tf-clear')) b.hidden = !f[b.dataset.name]?.value;
    f.querySelector('.tf-count').textContent = String(f.note.value.length);
  }
  card.addEventListener('change', safe((e) => {
    const f = card.querySelector('form'); if (!f) return;
    if (e.target.name === 'stuck') {   // 「막힌 곳 없었어요」는 혼자만
      if (e.target.value === 'none' && e.target.checked) for (const x of f.querySelectorAll('input[name=stuck]')) { if (x.value !== 'none') x.checked = false; }
      if (e.target.value !== 'none' && e.target.checked) f.querySelector('input[name=stuck][value=none]').checked = false;
    }
    sync();
  }));
  card.addEventListener('input', safe(() => sync()));
  card.addEventListener('submit', safe((e) => { e.preventDefault(); submit(); }));
  card.addEventListener('click', safe((e) => {
    const t = e.target.closest('[data-tf]'); if (!t) return;
    const act = t.dataset.tf;
    if (act === 'join') { expanded(); card.querySelector('#tf-consent-title')?.focus({ preventScroll: false }); return; }
    if (act === 'no') { tf.decline(); card.hidden = true; announce('알겠어요. 체험 의견은 묻지 않을게요.'); return; }
    if (act === 'cancel') { collapsed(); card.querySelector('.tf-join')?.focus({ preventScroll: true }); return; }
    if (act === 'clear') { for (const x of card.querySelectorAll(`input[name=${t.dataset.name}]`)) x.checked = false; sync(); return; }
    if (act === 'retry') { retry(); }
  }));

  async function submit() {
    const f = card.querySelector('form'); if (!f || !round) return;
    const a = answers(); if (!f.age14.checked || !a) { sync(); return; }
    const send = f.querySelector('.tf-send');
    send.dataset.busy = '1'; send.disabled = true; send.textContent = COPY.sending;
    const r = await tf.enroll({ answers: a, round, age14: true });
    if (!card.isConnected) return;
    show(r);
  }
  async function retry() {
    const b = card.querySelector('[data-tf=retry]'); if (b) { b.disabled = true; b.textContent = COPY.sending; }
    const r = await tf.flush();
    if (!card.isConnected) return;
    show(r);
  }
  function show(r) {
    const st = tf.status();
    if (st.phase === 'active' || st.phase === 'expired') { done('sent'); announce(COPY.sent); return; }
    if (st.phase === 'pending') {
      const kind = r.kind === 'busy' ? 'busy' : st.persistent ? 'offline' : 'offlineOnce';
      done(kind, { retry: true }); announce(COPY[kind]); return;
    }
    const kind = ['full', 'refused', 'invalid'].includes(r.kind) ? r.kind : 'invalid';
    done(kind); announce(COPY[kind]);
  }

  return {
    /** 입구가 그려질 때 */
    lobby: safe(() => { tf.lobby(); paintLine(); }),
    /** 판 시작(3D 준비가 끝나 실제로 판이 열린 뒤). roundId · startedAt을 돌려준다 */
    roundStart: safe(({ mode }) => { cur = { roundId: newId(), startedAt: new Date().toISOString(), mode }; tf.roundStart({ roundId: cur.roundId, mode }); return cur; }),
    /** 판 끝(결과 화면). 참여자면 완료 기록, 아니면 카드를 띄울지 정한다 */
    roundComplete: safe(({ mode, total, correct, helped, soundOn }) => {
      if (!cur) { card.hidden = true; return; }
      round = { roundId: cur.roundId, startedAt: cur.startedAt, mode, total, correct, helped, soundOn };
      cur = null;
      if (total >= 1) tf.roundComplete(round);
      if (tf.canOffer() && !offeredThisLoad && total >= 1) { offeredThisLoad = true; collapsed(); card.hidden = false; }
      else card.hidden = true;
    }),
    status: () => tf.status(),
    tf,
  };
}
