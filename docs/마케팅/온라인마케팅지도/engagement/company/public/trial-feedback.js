// 말 랠리 체험 의견 결과(운영자 화면, 2026-11-09). 계약 trial-feedback.v1-final의 GET /api/trial-feedback/summary를 기존 직원 세션으로 읽기만 한다.
// 만족(재미 · 다시 올 마음) · 막힌 점 · 판 안 수행(학습 효과 아님)을 다른 칸에 두고, 분모가 0이면 비율 대신 「—」. 고칠 점은 자동으로 만들지 않는다.
const API = '/api/trial-feedback/summary';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (Number.isFinite(n) ? Number(n).toLocaleString('ko-KR') : '—');
const pct = (part, whole) => (whole > 0 && Number.isFinite(part) ? `${Math.round((part / whole) * 100)}%` : '—');
const ratio = (v) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`);

export const LABEL = {
  fun: { fun_4: '또 하고 싶을 만큼 재미있었어요', fun_3: '재미있었어요', fun_2: '그저 그랬어요', fun_1: '재미없었어요' },
  stuck: { listen: '몽글의 말이 잘 안 들렸어요', read: '대답 카드 글을 읽기 어려웠어요', howto: '무엇을 해야 하는지 몰랐어요', control: '카드를 긋거나 누르는 게 불편했어요',
    sound: '소리가 안 나오거나 끊겼어요', perf: '화면이 느리거나 멈췄어요', none: '막힌 곳 없었어요' },
  again: { again_1d: '내일도 할 것 같아요', again_7d: '일주일 안에 한 번쯤요', again_unsure: '잘 모르겠어요', again_no: '다시 안 할 것 같아요', null: '답 안 함' },
};
const COHORT = /^[a-z0-9-]{1,24}$/;

/** 주소의 고르기(정의 밖 값은 기본값으로). */
export function readFilter(search) {
  const q = new URLSearchParams(search);
  const cohort = q.get('cohort'), days = q.get('days'), data = q.get('data');
  return { cohort: cohort === 'all' || COHORT.test(cohort || '') ? cohort : 'all', days: ['7', '30', '90'].includes(days) ? Number(days) : 30, data: data === 'synthetic' ? 'synthetic' : 'real' };
}

function bars(counts, labels, answered) {
  const rows = Object.keys(labels).filter((k) => k !== 'null').map((k) => {
    const n = counts?.[k] ?? 0;
    return `<li><span class="tf-bl">${esc(labels[k])}</span><span class="tf-track"><i data-w="${answered > 0 ? Math.round((n / answered) * 1000) / 10 : 0}"></i></span><b>${num(n)}</b><small>${pct(n, answered)}</small></li>`;
  });
  return `<ul class="tf-bars">${rows.join('')}</ul>`;
}

/** 요약 응답 → 화면 HTML(순수 함수 — 시험에서 직접 부른다). */
export function renderSummary(r) {
  const d = r.denominators || {};
  if (!d.participants) {
    return `<section class="tf-card tf-empty"><h2>${r.filter?.data === 'synthetic' ? '이 조건의 시험 자료가 없어요' : '아직 실제 참여 기록이 없어요'}</h2>
      <p>${r.filter?.data === 'synthetic' ? '이 기간 · 묶음에는 시험 자료도 없어요.' : '참여 카드는 synk.im 말 랠리 결과 화면에 있어요. 누군가 동의하고 답을 보내면 여기에 나와요.'}</p>
      ${r.otherDataCount ? `<p class="tf-fine">${r.filter?.data === 'synthetic' ? '실제 참여' : '시험 자료'} 쪽에는 참여 번호 ${num(r.otherDataCount)}개가 있어요(여기 숫자에 넣지 않았어요).</p>` : ''}</section>`;
  }
  const again = (r.againVsReturn || []).map((row) => {
    const key = row.again == null ? 'null' : row.again;
    const w1 = row.within1d || {}, w7 = row.within7d || {};
    return `<tr><th scope="row">${esc(LABEL.again[key] || key)}</th><td>${num(row.participants)}</td>
      <td>${w1.eligible ? `${num(w1.returned)} / ${num(w1.eligible)} <small>(${pct(w1.returned, w1.eligible)})</small>` : '—'}${row.participants - (w1.eligible || 0) > 0 ? `<small class="tf-wait">판정 전 ${num(row.participants - (w1.eligible || 0))}</small>` : ''}</td>
      <td>${w7.eligible ? `${num(w7.returned)} / ${num(w7.eligible)} <small>(${pct(w7.returned, w7.eligible)})</small>` : '—'}${row.participants - (w7.eligible || 0) > 0 ? `<small class="tf-wait">판정 전 ${num(row.participants - (w7.eligible || 0))}</small>` : ''}</td></tr>`;
  }).join('');
  const perf = r.performance?.firstRound || {};
  const comments = r.commentsHidden ? '<p class="tf-fine">자유 글은 관리자 · 팀장 · 실무자에게만 보여요(보기 전용 계정은 숫자만).</p>'
    : (r.comments || []).length ? `<ol class="tf-comments">${r.comments.map((c) => `<li><p>${esc(c.note)}</p><small>${esc(c.date)} · ${esc(c.cohort)}${c.fun ? ` · ${esc(LABEL.fun[c.fun])}` : ''}${(c.stuck || []).length ? ` · ${c.stuck.map((s) => esc(LABEL.stuck[s] || s)).join(', ')}` : ''}${c.again ? ` · ${esc(LABEL.again[c.again])}` : ''}</small></li>`).join('')}</ol>`
      : '<p class="tf-fine">아직 자유 글이 없어요.</p>';
  return `
  <section class="tf-card tf-denoms" aria-labelledby="h-d"><h2 id="h-d">분모</h2>
    <dl>
      <div><dt>참여 번호</dt><dd>${num(d.participants)}</dd></div>
      <div><dt>방문(번호 × 날)</dt><dd>${num(d.visits)}</dd></div>
      <div><dt>다시 온 날</dt><dd>${num(d.returnVisits)}<small>다시 온 번호 ${num(d.participantsReturned)}</small></dd></div>
      <div><dt>판 시작</dt><dd>${num(d.roundStarts)}</dd></div>
      <div><dt>판 완료</dt><dd>${num(d.roundCompletes)}</dd></div>
      <div><dt>끝내지 않은 판</dt><dd>${num(d.roundsStartedNotCompleted)}</dd></div>
    </dl>
    <p class="tf-fine">판은 동의한 뒤의 판과 동의 직전에 끝낸 첫 판만 세요. 끝내지 않은 판은 어제까지 시작만 있는 판이에요(닫음 · 그만두기 · 전송 실패를 가리지 않아요).${d.roundsCompletedWithoutStart ? ` 시작 기록 없이 완료만 온 판 ${num(d.roundsCompletedWithoutStart)}개는 완료에 넣었어요.` : ''}</p>
    ${(r.cohorts || []).length > 1 ? `<p class="tf-fine">묶음별 참여 번호: ${r.cohorts.map((c) => `${esc(c.cohort)} ${num(c.participants)}`).join(' · ')}</p>` : ''}
  </section>
  <section class="tf-card" aria-labelledby="h-fun"><h2 id="h-fun">재미 <small>만족 · 답한 ${num(r.fun?.answered)} · 답 안 함 ${num(r.fun?.skipped)}</small></h2>${bars(r.fun?.counts, LABEL.fun, r.fun?.answered || 0)}</section>
  <section class="tf-card" aria-labelledby="h-stuck"><h2 id="h-stuck">막힌 점 <small>답한 ${num(r.stuck?.answered)} · 답 안 함 ${num(r.stuck?.skipped)}</small></h2>${bars(r.stuck?.counts, LABEL.stuck, r.stuck?.answered || 0)}
    <p class="tf-fine">여럿 고를 수 있어 합이 답한 수를 넘어요.</p></section>
  <section class="tf-card tf-wide" aria-labelledby="h-again"><h2 id="h-again">다시 올 마음 ↔ 실제로 다시 옴</h2>
    <div class="tf-scroll"><table><thead><tr><th scope="col">고른 답</th><th scope="col">참여 번호</th><th scope="col">다음 날 다시 옴</th><th scope="col">7일 안 다시 옴</th></tr></thead><tbody>${again}</tbody></table></div>
    <p class="tf-fine">서울 날짜 기준. 첫날 다음 날에 판을 열었거나 시작했으면 「다시 옴」이에요. 그 기간이 아직 다 지나지 않은 번호는 「판정 전」으로 따로 둬요.</p></section>
  <section class="tf-card" aria-labelledby="h-perf"><h2 id="h-perf">판 안 수행 <small>학습 효과 아님</small></h2>
    <dl class="tf-perf"><div><dt>첫 판 맞힌 비율(중앙값)</dt><dd>${ratio(perf.medianCorrectRatio)}</dd></div><div><dt>도움 쓴 첫 판</dt><dd>${ratio(perf.helpedRoundShare)}</dd></div><div><dt>소리 끈 첫 판</dt><dd>${ratio(perf.soundOffShare)}</dd></div></dl>
    <p class="tf-fine">첫 판 ${num(perf.n)}개의 게임 안 숫자예요. 학습 효과는 이 화면에서 판단하지 않고 교원 검수 · 학생 시험 절차로 따로 봐요.</p></section>
  <section class="tf-card tf-wide" aria-labelledby="h-c"><h2 id="h-c">자유 글 <small>최근 50개 · 편집 · 답장 없음</small></h2>${comments}</section>`;
}

function paintBars(root) { for (const i of root.querySelectorAll('.tf-track i[data-w]')) i.style.width = `${Math.min(100, Number(i.dataset.w) || 0)}%`; }

let seq = 0;
async function load() {
  const f = { cohort: $('#f-cohort').value, days: Number($('#f-days').value), data: document.querySelector('input[name=data]:checked').value };
  const qs = new URLSearchParams({ cohort: f.cohort, days: String(f.days), data: f.data });
  history.replaceState(null, '', `?${qs}`);
  $('#synthetic-banner').hidden = f.data !== 'synthetic';
  const out = $('#out'), my = ++seq;
  out.setAttribute('aria-busy', 'true');
  let status = 0, body = null;
  try { const res = await fetch(`${API}?${qs}`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' }); status = res.status; body = await res.json().catch(() => null); }
  catch { status = 0; }
  if (my !== seq) return;
  out.setAttribute('aria-busy', 'false');
  if (status === 401) { out.innerHTML = '<section class="tf-card tf-empty"><h2>회사 프로그램에 로그인한 뒤 열어 주세요</h2><p><a class="tf-btn" href="/">회사 작업실로 가기</a></p></section>'; return; }
  if (status === 403) { out.innerHTML = '<section class="tf-card tf-empty"><h2>이 결과를 볼 권한이 없어요</h2><p>회사 직원 계정(관리자 · 팀장 · 실무자 · 보기 전용)으로 로그인했는지 확인해 주세요.</p></section>'; return; }
  if (status !== 200 || !body?.ok) {
    out.innerHTML = `<section class="tf-card tf-empty" role="alert"><h2>결과를 읽지 못했어요</h2><p>${status ? `서버 응답 ${status}` : '서버에 닿지 않았어요'}. 잠시 뒤 다시 읽어 주세요.</p><p><button type="button" class="tf-btn" data-reload>다시 읽기</button></p></section>`;
    return;
  }
  const sel = $('#f-cohort'), keep = f.cohort;
  sel.innerHTML = '<option value="all">전체</option>' + (body.cohorts || []).map((c) => `<option value="${esc(c.cohort)}">${esc(c.cohort)}</option>`).join('');
  if (keep !== 'all' && !(body.cohorts || []).some((c) => c.cohort === keep)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(keep)}">${esc(keep)}</option>`);
  sel.value = keep;
  out.innerHTML = `<p class="tf-fine tf-when">${esc(body.today || '')} 기준(서울 날짜)</p>` + renderSummary(body);
  paintBars(out);
}

if (typeof document !== 'undefined' && document.getElementById('out')) {
  const f = readFilter(location.search);
  const sel = $('#f-cohort'); if (f.cohort !== 'all') sel.insertAdjacentHTML('beforeend', `<option value="${esc(f.cohort)}">${esc(f.cohort)}</option>`); sel.value = f.cohort;
  $('#f-days').value = String(f.days);
  document.querySelector(`input[name=data][value=${f.data}]`).checked = true;
  $('#filter').addEventListener('change', () => { void load(); });
  $('#reload').addEventListener('click', () => { void load(); });
  $('#out').addEventListener('click', (e) => { if (e.target.closest('[data-reload]')) void load(); });
  void load();
}
