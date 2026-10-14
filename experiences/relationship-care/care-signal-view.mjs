// 플레저 시그널 판(2026-10-14)의 새 화면: 오늘 챙길 사람 · 경조사 장부 · 금액 도우미 · 고인·기일 · 선물 메모.
// 계산은 care-today·care-ledger·care-amount·care-memorial·care-gift가 맡고, 여기는 그리기와 단추만 맡는다.
// 상태는 app.mjs의 commit(next)로만 바꾼다(state = next; save(); render()).
import { todayCards, recordTodayContact, snoozeTodayCard } from './care-today.mjs';
import { upcomingDays } from './care-upcoming.mjs';
import { ledgerSummary, amountContext, exportLedgerCsv, previewLedgerCsv, applyLedgerImport, LEDGER_FILE_LIMIT } from './care-ledger.mjs';
import { suggestAmounts, AMOUNT_OCCASIONS, AMOUNT_RELATIONS, AMOUNT_VENUES } from './care-amount.mjs';
import { memorialSchedule, markDeceased, unmarkDeceased, suggestMemorialEvents, addMemorialEvents, isDeceased } from './care-memorial.mjs';
import { addWish, removeWish, recordGift, giftNotes, checkGiftOverlap } from './care-gift.mjs';
import { OCCASION_TYPES } from './model.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;
const short = date => { const [, m, d] = String(date).split('-').map(Number); return m && d ? `${m}월 ${d}일` : ''; };

export function createCareSignal({ $, getState, commit, getSelectedId, getActiveView, setActiveView, notify, choosePerson, download }) {
  let ledgerYear = '', ledgerDirection = '', ledgerPreview = null, amountPerson = null, memorialPerson = null;
  const person = id => getState().people.find(item => item.id === id) || null;

  // ── 오늘 챙길 사람 ─────────────────────────────────────
  function renderToday() {
    const target = $('today-cards'); if (!target) return;
    let result;
    try { result = todayCards({ state: getState() }); } catch (error) { target.innerHTML = `<p class="helper">${esc(error.message)}</p>`; return; }
    $('today-side').textContent = result.dateLabel || '';
    $('today-section').hidden = result.status === 'empty';
    if (!result.cards.length) {
      target.innerHTML = `<div class="today-empty"><span class="dot ok"></span><p>${esc(result.message)}</p>${result.snoozed.length ? `<p class="helper">미뤄 둔 사람 ${result.snoozed.map(s => `${esc(s.personName)}(${esc(s.untilLabel)}까지)`).join(', ')}</p>` : ''}</div>`;
      return;
    }
    target.innerHTML = result.cards.map((card, index) => `<article class="today-card${card.quiet ? ' quiet' : ''}${card.dueToday ? ' due' : ''}">
      <div class="today-top"><span class="person-avatar" aria-hidden="true">${esc([...card.personName][0] || '·')}</span><div><strong>${esc(card.personName)}</strong><span class="today-meta">${esc(card.relationship || '')}${card.relationship ? ' · ' : ''}${esc(card.lastCareLabel)}</span></div>${card.dDayLabel ? `<span class="led-chip ${card.dueToday ? '' : 'plain'}">${esc(card.dDayLabel)}</span>` : ''}</div>
      <h3>${esc(card.headline)}</h3>
      ${card.nthLabel || card.ageLabel ? `<p class="today-nth">${esc([card.nthLabel, card.ageLabel].filter(Boolean).join(' · '))}</p>` : ''}
      <p class="today-reason">${esc(card.notice || card.reason || '')}</p>
      <div class="today-actions"><button type="button" class="${index === 0 ? 'felt-button' : 'soft-button'}" data-today-draft="${esc(card.personId)}">${card.quiet ? '조용한 문구 준비하기' : '문구 준비하기'}</button>
        <div class="today-done" role="group" aria-label="${esc(card.personName)} 챙긴 방법">${card.actions.map(a => `<button type="button" class="chip small" data-today-done="${esc(card.key)}" data-how="${a.how}">${esc(a.label)}</button>`).join('')}</div>
        ${card.canSnooze ? `<button type="button" class="text-button" data-today-snooze="${esc(card.key)}">${card.snoozeDays}일 뒤에</button>` : ''}</div>
    </article>`).join('');
    target.dataset.cards = JSON.stringify(result.cards.map(card => ({ key: card.key, personId: card.personId, eventId: card.eventId || '', occurrenceId: card.occurrenceId || '', followupId: card.followupId || '' })));
  }
  function cardOf(key) { try { return JSON.parse($('today-cards').dataset.cards || '[]').find(card => card.key === key) || null; } catch { return null; } }

  // ── 다가오는 날의 「몇 번째」 ─────────────────────────────
  let upcomingIndex = new Map();
  function refreshUpcoming() {
    try { upcomingIndex = new Map(upcomingDays(getState(), { days: 400 }).items.map(item => [`${item.eventId}:${item.date}`, item])); } catch { upcomingIndex = new Map(); }
  }
  function upcomingLabel(eventId, date) {
    const item = upcomingIndex.get(`${eventId}:${date}`);
    return item ? [item.nthLabel, item.ageLabel, item.lunar?.label].filter(Boolean).join(' · ') : '';
  }

  // ── 경조사 장부 ───────────────────────────────────────
  function renderLedger() {
    const view = $('ledger-view'); if (!view) return;
    view.hidden = getActiveView() !== 'ledger';
    if (view.hidden) return;
    const state = getState();
    const filters = { ...(ledgerYear ? { year: Number(ledgerYear) } : {}), ...(ledgerDirection ? { direction: ledgerDirection } : {}) };
    const summary = ledgerSummary(state, filters), all = ledgerSummary(state);
    const t = summary.totals;
    view.innerHTML = `<div class="ledger-head"><div><p class="kicker">LEDGER · 경조사 장부</p><h2 id="ledger-title" class="page-title" tabindex="-1">주고받은 마음,<br><span class="hl">한눈에.</span></h2><p class="lead">축의금·조의금·선물·참석을 사람별로 모아요. 다음에 얼마가 좋을지 정할 때 지난 기록을 함께 봐요.</p></div>
      <div class="poster low" data-word="장부" data-len="2"><span class="label">GIVE &amp; TAKE</span><img class="cut" src="assets/art/piggy.webp" alt="코럴색 펠트 저금통" width="629" height="720"></div></div>
      <ul class="meta"><li><small class="ko">보낸 마음</small><span class="big">${won(t.sent.totalWon)}</span><span class="small muted">${t.sent.count}건</span></li><li><small class="ko">받은 마음</small><span class="big">${won(t.received.totalWon)}</span><span class="small muted">${t.received.count}건</span></li><li><small class="ko">사람</small><span class="big">${summary.people.length}</span></li><li><small class="ko">기록 해</small>${all.years.length ? `${all.years.at(-1)}–${all.years[0]}` : '—'}</li></ul>
      <div class="ledger-tools"><div class="seg" role="group" aria-label="방향">${[['', '전체'], ['sent', '보낸 것'], ['received', '받은 것']].map(([id, label]) => `<button type="button" data-ledger-direction="${id}" aria-pressed="${ledgerDirection === id}">${label}</button>`).join('')}</div>
        <label class="ledger-year">연도<select id="ledger-year"><option value="">모든 해</option>${all.years.map(y => `<option value="${y}" ${String(y) === ledgerYear ? 'selected' : ''}>${y}년</option>`).join('')}</select></label>
        <span class="grow"></span><button type="button" class="soft-button" data-amount-open="">금액 도우미</button><button type="button" class="soft-button" data-ledger-export ${summary.entries.length ? '' : 'disabled'}>CSV 내보내기</button><label class="soft-button file-button" for="ledger-import">CSV 가져오기<input id="ledger-import" type="file" accept=".csv,text/csv" class="visually-hidden"></label></div>
      ${ledgerPreview ? previewBlock(ledgerPreview) : ''}
      ${summary.people.length ? `<section class="ledger-people"><h3 class="ledger-sub">사람별</h3><div class="ledger-table" role="table" aria-label="사람별 경조사 합계"><div class="lt-row lt-head" role="row"><span role="columnheader">이름</span><span role="columnheader">보낸 것</span><span role="columnheader">받은 것</span><span role="columnheader">마지막</span><span role="columnheader"></span></div>${summary.people.map(row => `<div class="lt-row" role="row"><span role="cell"><strong>${esc(row.name)}</strong>${row.relationship ? `<small>${esc(row.relationship)}</small>` : ''}${row.deceased ? '<small>고인</small>' : ''}</span><span role="cell" class="num">${won(row.sent.totalWon)}<small>${row.sent.count}건</small></span><span role="cell" class="num">${won(row.received.totalWon)}<small>${row.received.count}건</small></span><span role="cell">${row.lastAmount ? `${esc(row.lastAmount.label)}<small>${esc(short(row.lastAmount.date))}</small>` : row.lastDate ? esc(short(row.lastDate)) : '—'}</span><span role="cell"><button type="button" class="text-button" data-amount-open="${esc(row.personId)}">얼마?</button></span></div>`).join('')}</div></section>` : `<div class="empty"><strong>아직 장부에 적은 마음이 없어요.</strong><p>사람 수첩의 「우리의 기록」에서 경조금·선물·참석을 남기거나, 쓰던 엑셀을 위 「CSV 가져오기」로 불러와요.</p></div>`}
      ${summary.byOccasion.length ? `<section class="ledger-occasions"><h3 class="ledger-sub">행사별</h3><div class="occasion-grid">${summary.byOccasion.map(o => `<div class="card"><span class="eyebrow">${esc(o.label)}</span><p><span class="num">${won(o.sent.totalWon)}</span> 보냄 · <span class="num">${won(o.received.totalWon)}</span> 받음</p></div>`).join('')}</div></section>` : ''}
      <p class="helper">${esc(summary.note)} 금액은 이 기기나 내 계정에만 보관해요.</p>`;
  }
  function previewBlock(preview) {
    const c = preview.counts;
    return `<section class="ledger-preview card" aria-label="CSV 미리 보기"><div class="card-top"><span class="eyebrow">가져오기 미리 보기</span><span class="small muted">${c.total}줄 · 바로 더할 수 있는 줄 ${c.ready}</span></div>
      <p class="helper">${preview.notes.map(esc).join(' ')}</p>
      <div class="preview-rows">${preview.rows.slice(0, 200).map(row => `<label class="check-label preview-row${row.errors.length ? ' bad' : ''}"><input type="checkbox" data-preview-index="${row.index}" ${row.ready ? 'checked' : ''} ${row.errors.length || row.match.status === 'many' ? 'disabled' : ''}><span><strong>${esc(row.name)}</strong> · ${esc(row.date)} · ${row.direction === 'received' ? '받음' : '보냄'}${row.amountWon !== null ? ` · ${won(row.amountWon)}` : ''}${row.item ? ` · ${esc(row.item)}` : ''}<small>${row.errors.length ? esc(row.errors.join(' ')) : row.match.status === 'none' ? '수첩에 없는 이름 · 새 사람으로 더해요' : row.match.status === 'many' ? '같은 이름이 여러 명 · 사람 수첩에서 직접 남겨 주세요' : ''}${row.duplicate ? ' · 이미 있는 기록과 같아요' : ''}</small></span></label>`).join('')}</div>
      <div class="action-row"><button type="button" class="felt-button" data-ledger-apply>고른 줄 더하기</button><button type="button" class="text-button" data-ledger-cancel>취소</button></div></section>`;
  }

  // ── 금액 도우미 ───────────────────────────────────────
  function openAmount(personId = '') {
    amountPerson = personId || getSelectedId() || null;
    const context = amountPerson ? (() => { try { return amountContext(getState(), amountPerson); } catch { return null; } })() : null;
    const received = context?.receivedWon ?? '';
    $('amount-fields').innerHTML = `${amountPerson && person(amountPerson) ? `<p class="small muted">${esc(person(amountPerson).name)}${received ? ` · 지난번 받은 금액 ${won(received)}` : ''}</p>` : ''}
      <div class="form-grid"><label>무슨 일인가요<select id="amount-occasion">${Object.entries(AMOUNT_OCCASIONS).map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('')}</select></label>
      <label>나와의 사이<select id="amount-relation">${Object.entries(AMOUNT_RELATIONS).map(([id, label]) => `<option value="${id}" ${id === 'coworker' ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label>장소·식사<select id="amount-venue">${Object.entries(AMOUNT_VENUES).map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('')}</select></label>
      <label>지난번 받은 금액 <span class="optional">원 · 선택</span><input id="amount-received" type="number" min="0" step="10000" inputmode="numeric" value="${esc(received)}"></label></div>
      <label class="check-label"><input id="amount-attending" type="checkbox" checked><span>직접 가요</span></label>`;
    renderAmount();
    $('amount-dialog').showModal();
  }
  function renderAmount() {
    try {
      const result = suggestAmounts({ occasion: $('amount-occasion').value, relation: $('amount-relation').value, venue: $('amount-venue').value, attending: $('amount-attending').checked, receivedWon: $('amount-received').value ? Number($('amount-received').value) : null });
      $('amount-result').innerHTML = `<p class="amount-headline">${esc(result.headline)}</p><div class="amount-candidates">${result.candidates.map(c => `<div class="amount-candidate${c.recommended ? ' on' : ''}"><strong class="num">${esc(c.label)}</strong><p>${esc(c.reason)}</p></div>`).join('')}</div>${result.basis.length ? `<ul class="amount-basis">${result.basis.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}<p class="helper">${esc(result.cautions.join(' '))} ${esc(result.sourceNote || '')}</p>`;
    } catch (error) { $('amount-result').innerHTML = `<p class="helper">${esc(error.message)}</p>`; }
  }

  // ── 고인·기일 ─────────────────────────────────────────
  function openMemorial() {
    memorialPerson = getSelectedId(); const who = person(memorialPerson); if (!who) return;
    $('memorial-title').textContent = `${who.name}님을 고인으로 기억하기`;
    $('memorial-died').value = who.diedOn || '';
    $('memorial-unmark').hidden = !isDeceased(who);
    $('memorial-save').textContent = isDeceased(who) ? '기일 정보 저장' : '고인으로 표시';
    previewMemorial();
    $('memorial-dialog').showModal();
  }
  function previewMemorial() {
    const value = $('memorial-died').value, target = $('memorial-preview');
    if (!value) { target.innerHTML = '<p class="helper">돌아가신 날을 적으면 49재와 다음 기일을 계산해 드려요.</p>'; return; }
    try {
      const s = memorialSchedule({ diedOn: value });
      const suggestions = suggestMemorialEvents({ ...getState(), people: getState().people.map(p => p.id === memorialPerson ? { ...p, deceased: true, diedOn: value } : p) }, memorialPerson);
      target.innerHTML = `<ul class="rows memorial-rows">${!s.fortyNinth.passed ? `<li><div><span class="t">49재 · ${esc(short(s.fortyNinth.date))}</span><span class="s">${esc(s.fortyNinth.note)}</span></div></li>` : ''}${s.lunar?.next ? `<li><div><span class="t">음력 기일 · ${esc(short(s.lunar.next.date))} (${esc(s.lunar.label)})</span><span class="s">${s.lunar.next.nth}주기 · 제사 전날 ${esc(short(s.lunar.next.eveDate))}</span></div></li>` : ''}${s.solar ? `<li><div><span class="t">양력 기일 · ${esc(short(s.solar.date))}</span><span class="s">${s.solar.nth}주기</span></div></li>` : ''}</ul>
        ${suggestions.events.length ? `<fieldset class="memorial-add"><legend>일정으로 더하기</legend>${suggestions.events.map(e => `<label class="check-label"><input type="checkbox" data-memorial-key="${e.key}" checked><span>${esc(e.title)} · ${esc(short(e.date))}${e.calendar === 'lunar' ? ' (음력)' : ''}</span></label>`).join('')}</fieldset>` : ''}
        <p class="helper">${s.notes.map(esc).join(' ')}</p>`;
    } catch (error) { target.innerHTML = `<p class="helper">${esc(error.message)}</p>`; }
  }
  function renderMemorialPanel() {
    const panel = $('memorial-panel'), who = person(getSelectedId());
    if (!panel) return;
    panel.hidden = !who || !isDeceased(who);
    $('open-memorial').textContent = who && isDeceased(who) ? '기일 정보' : '고인으로 기억';
    if (panel.hidden) return;
    let body = '';
    if (who.diedOn) { try { const s = memorialSchedule({ diedOn: who.diedOn }); body = `${s.lunar?.next ? `<p><strong>다음 음력 기일</strong> ${esc(short(s.lunar.next.date))} · ${s.lunar.next.nth}주기 · 제사 전날 ${esc(short(s.lunar.next.eveDate))}</p>` : ''}${!s.fortyNinth.passed ? `<p><strong>49재</strong> ${esc(short(s.fortyNinth.date))}</p>` : ''}`; } catch { body = ''; } }
    panel.innerHTML = `<span class="eyebrow">조용히 기억하는 분</span>${body || '<p class="helper">돌아가신 날을 적으면 기일과 49재를 계산해 드려요.</p>'}<p class="helper">축하 문구와 이모지 없이, 조용한 안내만 드려요.</p>`;
  }

  // ── 선물·마음 메모 ─────────────────────────────────────
  function renderGifts() {
    const target = $('gift-notes'), id = getSelectedId();
    if (!target || !id || !person(id)) return;
    let notes; try { notes = giftNotes(getState(), id); } catch { return; }
    target.innerHTML = `${notes.wishes.open.length ? `<ul class="rows wish-rows">${notes.wishes.open.map(w => `<li><div><span class="t">${esc(w.text)}</span>${w.notedOn ? `<span class="s">${esc(short(w.notedOn))}에 들은 것</span>` : ''}</div><div class="action-row"><button type="button" class="soft-button" data-wish-given="${esc(w.id)}">드렸어요</button><button type="button" class="text-button danger" data-wish-remove="${esc(w.id)}">지우기</button></div></li>`).join('')}</ul>` : '<p class="helper">갖고 싶다고 말한 것을 적어 두면 선물 고를 때 꺼내 봐요.</p>'}
      ${notes.sent.length || notes.received.length ? `<p class="helper gift-history">${notes.sent.length ? `드린 선물: ${notes.sent.slice(0, 4).map(g => `${esc(g.text)}(${esc(short(g.date))})`).join(', ')}` : ''}${notes.sent.length && notes.received.length ? ' · ' : ''}${notes.received.length ? `받은 선물: ${notes.received.slice(0, 4).map(g => `${esc(g.text)}(${esc(short(g.date))})`).join(', ')}` : ''}</p>` : ''}`;
  }

  function render() {
    refreshUpcoming(); renderToday(); renderLedger(); renderMemorialPanel(); renderGifts();
    const select = $('care-log-occasion');
    if (select && select.options.length <= 1) select.insertAdjacentHTML('beforeend', Object.entries(OCCASION_TYPES).map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join(''));
  }

  async function onClick(event) {
    const t = event.target.closest('button,[data-ledger-direction]'); if (!t) return false;
    const state = getState();
    if (t.dataset.todayDraft) { await choosePerson(t.dataset.todayDraft, 'message'); return true; }
    if (t.dataset.todayDone) { const card = cardOf(t.dataset.todayDone); if (!card) return true; commit(recordTodayContact(state, { personId: card.personId, how: t.dataset.how, ...(card.eventId ? { eventId: card.eventId } : {}), ...(card.occurrenceId ? { occurrenceId: card.occurrenceId } : {}), ...(card.followupId ? { followupId: card.followupId } : {}) })); notify('챙긴 기록을 남겼어요. 안부 주기를 다시 시작할게요.'); return true; }
    if (t.dataset.todaySnooze) { const card = cardOf(t.dataset.todaySnooze); if (!card) return true; commit(snoozeTodayCard(state, { personId: card.personId, ...(card.followupId ? { followupId: card.followupId } : {}), ...(card.occurrenceId ? { occurrenceId: card.occurrenceId } : {}) })); notify('3일 뒤에 다시 보여 드릴게요.'); return true; }
    if (t.dataset.ledgerDirection !== undefined) { ledgerDirection = t.dataset.ledgerDirection; renderLedger(); return true; }
    if (t.dataset.amountOpen !== undefined) { openAmount(t.dataset.amountOpen); return true; }
    if (t.id === 'open-amount') { openAmount(getSelectedId()); return true; }
    if (t.dataset.ledgerExport !== undefined) { download(exportLedgerCsv(state, { ...(ledgerYear ? { year: Number(ledgerYear) } : {}), ...(ledgerDirection ? { direction: ledgerDirection } : {}) }), 'synk-care-ledger.csv', 'text/csv;charset=utf-8'); notify('장부를 CSV로 내려받아요. 엑셀에서 바로 열 수 있어요.'); return true; }
    if (t.dataset.ledgerCancel !== undefined) { ledgerPreview = null; renderLedger(); return true; }
    if (t.dataset.ledgerApply !== undefined) {
      const choices = [...document.querySelectorAll('[data-preview-index]:checked')].map(box => { const row = ledgerPreview.rows[Number(box.dataset.previewIndex)]; return { index: row.index, ...(row.match.status === 'none' ? { newPerson: true } : {}), ...(row.duplicate ? { allowDuplicate: true } : {}) }; });
      const result = applyLedgerImport(state, ledgerPreview, choices); ledgerPreview = null; commit(result.state); notify(`장부에 ${result.added}줄을 더했어요.${result.createdPeople ? ` 새 사람 ${result.createdPeople}명도 수첩에 넣었어요.` : ''}`); return true;
    }
    if (t.dataset.closeDialog) { $(t.dataset.closeDialog).close(); return true; }
    if (t.id === 'open-memorial') { openMemorial(); return true; }
    if (t.id === 'memorial-save') {
      const diedOn = $('memorial-died').value;
      let next = markDeceased(state, memorialPerson, { diedOn });
      const keys = [...document.querySelectorAll('[data-memorial-key]:checked')].map(box => box.dataset.memorialKey);
      if (diedOn && keys.length) next = addMemorialEvents(next, memorialPerson, keys);
      commit(next); $('memorial-dialog').close(); notify(keys.length ? '고인으로 표시하고 기일을 일정에 더했어요.' : '고인으로 표시했어요. 축하 대신 조용한 안내만 드려요.'); return true;
    }
    if (t.id === 'memorial-unmark') { commit(unmarkDeceased(state, memorialPerson)); $('memorial-dialog').close(); notify('고인 표시를 해제했어요.'); return true; }
    if (t.dataset.wishGiven) { const notes = giftNotes(state, getSelectedId()), wish = notes.wishes.open.find(w => w.id === t.dataset.wishGiven); if (!wish) return true; const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()); commit(recordGift(state, { personId: getSelectedId(), item: wish.text, occurredOn: today, direction: 'sent', wishId: wish.id })); notify('드린 선물로 기록했어요.'); return true; }
    if (t.dataset.wishRemove) { commit(removeWish(state, { personId: getSelectedId(), wishId: t.dataset.wishRemove })); return true; }
    if (t.id === 'show-ledger') { setActiveView('ledger'); return true; }
    return false;
  }
  async function onChange(event) {
    const input = event.target;
    if (input.id === 'ledger-year') { ledgerYear = input.value; renderLedger(); return true; }
    if (input.id === 'ledger-import' && input.files[0]) {
      const file = input.files[0]; input.value = '';
      if (file.size > LEDGER_FILE_LIMIT) throw new Error('파일은 4 MB 이내로 준비해 주세요.');
      ledgerPreview = previewLedgerCsv(getState(), await file.text()); renderLedger(); return true;
    }
    if (['amount-occasion', 'amount-relation', 'amount-venue', 'amount-attending', 'amount-received'].includes(input.id)) { renderAmount(); return true; }
    if (input.id === 'memorial-died') { previewMemorial(); return true; }
    return false;
  }
  async function onSubmit(event) {
    if (event.target.id !== 'wish-form') return false;
    event.preventDefault();
    const text = $('wish-text').value.trim(); if (!text) return true;
    commit(addWish(getState(), { personId: getSelectedId(), text })); $('wish-text').value = ''; $('wish-overlap').textContent = ''; notify('갖고 싶다고 한 것을 메모했어요.'); return true;
  }
  function onInput(event) {
    if (event.target.id !== 'wish-text') return;
    try { const result = checkGiftOverlap(getState(), { personId: getSelectedId(), item: event.target.value }); $('wish-overlap').textContent = event.target.value.trim() ? result.message || '' : ''; } catch { $('wish-overlap').textContent = ''; }
  }
  function shownEventIds() { try { return new Set(todayCards({ state: getState() }).cards.map(card => card.eventId).filter(Boolean)); } catch { return new Set(); } }
  return { render, upcomingLabel, shownEventIds, onClick, onChange, onSubmit, onInput };
}
