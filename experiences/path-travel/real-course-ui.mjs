import { REAL_PLACES } from './real-places.mjs?v=20261007-halfday1';
import { mapLink } from './real-guide.mjs?v=20261007-halfday1';
import { REAL_COURSE_OFFERINGS } from './real-course-data.mjs?v=20261007-halfday1';
import {
  createRealCourseFromSelection, createRealCourseExample, normalizeRealCourse,
  evaluateRealCourse, suggestRealCourseAlternatives, replaceRealCourseStop, exportRealCourseMemo,
} from './real-course.mjs?v=20261007-halfday1';

const $ = selector => document.querySelector(selector);
const choices = REAL_PLACES.filter(place => place.category !== 'stay');
const places = new Map(REAL_PLACES.map(place => [place.id, place]));
const money = value => `${value.toLocaleString('ko-KR')}원`;
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, className = 'felt-choice') {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function link(text, url) {
  const node = el('a', '', text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
}
function routeLink(from, to) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1'); url.searchParams.set('origin', `${from.name} ${from.address}`);
  url.searchParams.set('destination', `${to.name} ${to.address}`); url.searchParams.set('travelmode', 'walking');
  return url.href;
}

// This planner owns only an in-memory draft and applied result. It never writes
// to the saved venue list, reactions, visits or virtual itinerary.
export function createRealCourseUI({ getSelected, getState }) {
  let draft = null, applied = null;
  const form = $('#course-form'), result = $('#course-result');
  const error = $('#course-error'), memo = $('#course-memo-dialog');
  function clearError() {
    error.hidden = true; error.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  }
  function fail(cause) {
    clearError(); error.textContent = cause.message; error.hidden = false;
    const input = [...form.querySelectorAll('[data-course-field]')].find(node => node.dataset.courseField === cause.field);
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
    else { error.tabIndex = -1; error.focus(); }
  }
  function markDraft() {
    clearError();
    result.querySelectorAll('[data-course-replace]').forEach(button => { button.disabled = true; });
    $('#course-draft').textContent = applied ? '수정 중이에요. 아래 결과와 메모는 마지막으로 확인한 코스입니다. ‘반나절 일정 확인’을 눌러 새 값을 반영해 주세요.' : '시간과 장소를 고른 뒤 ‘반나절 일정 확인’을 눌러 보세요.';
  }
  function readDraft() {
    for (const input of form.querySelectorAll('input[data-course-field]')) {
      if (input.validity.badInput) {
        const cause = new TypeError('입력한 값을 확인해 주세요. 날짜·시각은 끝까지, 숫자는 정수로 입력해 주세요.');
        cause.field = input.dataset.courseField; throw cause;
      }
    }
    const number = value => value === '' ? null : Number(value);
    return {
      date: $('#course-date').value, startTime: $('#course-start').value, totalBudget: number($('#course-budget').value),
      stops: draft.stops.map((stop, i) => ({
        placeId: $(`#course-place-${i}`).value, stayMinutes: number($(`#course-stay-${i}`).value),
        useOffering: Boolean($(`#course-offering-${i}`)?.checked),
      })),
      transfers: draft.transfers.map((_, i) => number($(`#course-transfer-${i}`).value)),
    };
  }
  function capture() {
    try { if (draft) draft = readDraft(); return true; }
    catch (cause) { fail(cause); return false; }
  }
  function numeric(id, field, value, min, max) {
    const input = el('input'); input.id = id; input.type = 'number'; input.min = min; input.max = max;
    input.step = '1'; input.inputMode = 'numeric'; input.value = value ?? ''; input.placeholder = '미정';
    input.dataset.courseField = field; input.setAttribute('aria-describedby', 'course-timing-help course-error'); return input;
  }
  function label(text, input) {
    const node = el('label'); node.htmlFor = input.id; node.append(el('span', '', text), input); return node;
  }
  function renderStops() {
    $('#course-stops').replaceChildren(...draft.stops.map((stop, i) => {
      const row = el('fieldset', 'course-stop'); row.dataset.courseStop = i;
      row.append(el('legend', '', `${String(i + 1).padStart(2, '0')} / 머물 곳`));
      const fields = el('div', 'course-stop-inputs'), select = el('select');
      select.id = `course-place-${i}`; select.dataset.courseField = `stops.${i}.placeId`;
      select.setAttribute('aria-describedby', 'course-error');
      for (const place of choices) { const option = el('option', '', place.name); option.value = place.id; select.append(option); }
      select.value = stop.placeId;
      select.addEventListener('change', event => {
        if (!capture()) { select.value = stop.placeId; event.stopPropagation(); return; }
        draft.stops[i].useOffering = false;
        for (const gap of [i - 1, i]) if (gap >= 0 && gap < draft.transfers.length) draft.transfers[gap] = null;
        renderStops(); markDraft(); $(`#course-place-${i}`).focus({ preventScroll: true });
      });
      fields.append(label(`${i + 1}번째 장소`, select), label('머무를 시간 · 분', numeric(`course-stay-${i}`, `stops.${i}.stayMinutes`, stop.stayMinutes, 10, 180)));
      row.append(fields);
      const place = places.get(stop.placeId);
      const offering = REAL_COURSE_OFFERINGS[place.id];
      if (offering?.kind === 'sample') {
        const input = el('input'); input.type = 'checkbox'; input.id = `course-offering-${i}`; input.checked = Boolean(stop.useOffering);
        const amount = offering.amount;
        const option = el('label', 'consent course-offering'); option.htmlFor = input.id;
        option.append(input, el('span', '', `${offering.label} 1개 · ${money(amount)}을 표시 비용에 넣기`)); row.append(option);
        row.append(el('p', 'course-help', '매장 최저비용이 아닌 예시 메뉴예요. 세금·추가 주문 조건은 매장에서 확인해 주세요.'));
      }
      const actions = el('div', 'course-stop-actions');
      for (const [direction, text, target] of [['up', '앞으로', i - 1], ['down', '뒤로', i + 1]]) {
        const move = button(text, () => {
          if (!capture()) return; [draft.stops[i], draft.stops[target]] = [draft.stops[target], draft.stops[i]];
          // A changed pair has no verified transfer estimate. Require fresh user input.
          draft.transfers = draft.transfers.map(() => null); renderStops(); markDraft();
          const next = $(`[data-course-move="${direction}"][data-index="${target}"]`);
          (next.disabled ? $(`#course-place-${target}`) : next).focus({ preventScroll: true });
        });
        move.disabled = target < 0 || target >= draft.stops.length; move.dataset.courseMove = direction; move.dataset.index = i;
        move.setAttribute('aria-label', `${text}: ${place.name}`); actions.append(move);
      }
      const remove = button('빼기', () => {
        if (!capture()) return; draft.stops.splice(i, 1); draft.transfers = Array(draft.stops.length - 1).fill(null);
        renderStops(); markDraft(); $('#course-place-0').focus({ preventScroll: true });
      }); remove.disabled = draft.stops.length === 2; remove.dataset.courseRemove = i; remove.setAttribute('aria-label', `코스에서 빼기: ${place.name}`); actions.append(remove);
      row.append(actions);
      if (i < draft.stops.length - 1) {
        const gap = el('div', 'course-transfer');
        gap.append(label('다음 장소까지 이동에 잡을 시간 · 분', numeric(`course-transfer-${i}`, `transfers.${i}`, draft.transfers[i], 0, 180)));
        gap.append(link('지도에서 두 장소의 경로 확인 ↗', routeLink(place, places.get(draft.stops[i + 1].placeId))));
        row.append(gap);
      }
      return row;
    }));
  }
  function writeForm(course, { example = false } = {}) {
    draft = course; form.hidden = false;
    $('#course-date').value = course.date; $('#course-start').value = course.startTime;
    $('#course-budget').value = course.totalBudget ?? '';
    $('#course-example-note').textContent = example ? '식사 60분 → 관람 75분 → 차 45분, 이동 여유 15분씩을 넣은 편집용 예시예요. 실측 시간이나 예약된 코스가 아니며, 날짜와 필요한 시간을 직접 정해 주세요.' : '담은 순서를 코스 초안으로 가져왔어요. 머무를 시간과 이동 여유를 직접 넣어 주세요. 원래 방문 목록은 그대로 유지됩니다.';
    renderStops(); markDraft();
  }
  function load(kind) {
    try {
      const next = kind === 'example' ? createRealCourseExample() : createRealCourseFromSelection(getSelected());
      writeForm(next, { example: kind === 'example' });
      $('#course-date').focus();
    } catch (cause) { fail(cause); }
  }
  function renderResult() {
    const evaluation = evaluateRealCourse(applied);
    result.hidden = false;
    $('#course-summary').textContent = `${applied.date || '날짜 미정'} · ${applied.startTime || '시작 미정'} → ${evaluation.endTime || '종료 미정'} (서울 시간). 입력한 체류·이동 여유로 계산한 계획입니다.`;
    $('#course-cost-summary').textContent = `확인한 표시 비용 ${money(evaluation.knownSubtotal)}${evaluation.unknownCostIds.length ? ` + 금액 확인 필요 ${evaluation.unknownCostIds.length}곳` : ''}. ${evaluation.budget.reason} 교통·추가 주문·현장 변동 비용은 별도입니다.`;
    $('#course-cost-summary').dataset.status = evaluation.budget.status;
    $('#course-timeline').replaceChildren(...evaluation.stops.map((stop, i) => {
      const row = el('li', 'course-timeline-stop'); row.dataset.courseResultStop = i; row.dataset.schedule = stop.schedule.status;
      const heading = el('div', 'course-timeline-heading');
      heading.append(el('p', 'course-time', `${stop.arrivalTime || '시각 미정'} – ${stop.departureTime || '시각 미정'}`), el('h5', '', stop.place.name)); row.append(heading);
      row.append(el('p', 'course-schedule', `${stop.schedule.label} · ${stop.schedule.reason}`));
      row.append(el('p', 'course-cost', `${stop.cost.amount === null ? '금액 확인 필요' : money(stop.cost.amount)} · ${stop.cost.reason}`));
      const links = el('div', 'course-links');
      links.append(link('공식 운영 안내 ↗', stop.schedule.sourceUrl || stop.place.visitSourceUrl || stop.place.sourceUrl), link('장소 지도 ↗', mapLink(stop.place)));
      if (stop.cost.sourceUrl) links.append(link('가격 근거 ↗', stop.cost.sourceUrl)); row.append(links);
      if (i < evaluation.stops.length - 1) row.append(el('p', 'course-gap-note', applied.transfers[i] === null ? '다음 이동 여유 미정 → 이후 시각도 미정' : `다음 이동에 잡은 여유 ${applied.transfers[i]}분 · 실제 보행시간 아님`));
      if (stop.schedule.status === 'unmatched' || evaluation.budget.status === 'unmatched') {
        const alternatives = suggestRealCourseAlternatives(applied, i, { state: getState() });
        if (alternatives.length) {
          const details = el('details', 'course-alternatives'); details.append(el('summary', '', '같은 분야의 다른 곳 보기'));
          for (const candidate of alternatives.slice(0, 3)) {
            const choice = el('div', 'course-alternative');
            choice.append(el('strong', '', candidate.place.name), el('p', 'course-help', candidate.reasons.join(' · ')));
            const replace = button('이 장소로 바꾸기', () => {
              // Apply to the last confirmed course; never silently absorb draft edits.
              applied = replaceRealCourseStop(applied, i, candidate.place.id, { useOffering: candidate.course.stops[i].useOffering });
              writeForm(structuredClone(applied));
              $('#course-example-note').textContent = '선택한 대안을 반영했어요. 경로가 바뀐 이동 여유는 지도 확인 후 다시 넣어 주세요.';
              $('#course-draft').textContent = ''; renderResult(); $('#course-result-title').focus();
            }); replace.dataset.courseReplace = candidate.place.id; replace.dataset.index = i; replace.setAttribute('aria-label', `이 장소로 바꾸기: ${candidate.place.name}`); choice.append(replace); details.append(choice);
          }
          row.append(details);
        } else row.append(el('p', 'course-help', evaluation.budget.status === 'unmatched'
          ? '현재 조건에서 비용을 낮출 수 있다고 확인된 같은 분야 대안이 없어요. 위에서 예산·시간·장소를 직접 바꿔 보세요.'
          : '이 시간에 체류까지 확인되는 같은 분야 대안이 없어요. 위에서 시간이나 장소를 직접 바꿔 보세요.'));
      }
      return row;
    }));
  }
  $('#course-template').addEventListener('click', () => load('example'));
  for (const id of ['course-from-list', 'course-from-list-bottom']) $('#' + id).addEventListener('click', () => load('selection'));
  form.addEventListener('input', markDraft);
  form.addEventListener('change', markDraft);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const next = normalizeRealCourse(readDraft());
      evaluateRealCourse(next); // Validate before replacing the prior applied result.
      applied = next; draft = structuredClone(next); clearError(); $('#course-draft').textContent = '';
      renderResult(); $('#course-result-title').focus();
    } catch (cause) { fail(cause); }
  });
  function reset() {
    draft = null; applied = null; form.reset(); form.hidden = true; result.hidden = true;
    $('#course-stops').replaceChildren(); $('#course-timeline').replaceChildren();
    $('#course-summary').textContent = ''; $('#course-cost-summary').textContent = '';
    $('#course-draft').textContent = ''; $('#course-memo-content').value = ''; clearError(); if (memo.open) memo.close();
  }
  $('#course-clear').addEventListener('click', () => { reset(); $('#course-template').focus(); });
  $('#course-export').addEventListener('click', () => {
    if (!applied) return;
    $('#course-memo-content').value = exportRealCourseMemo(applied); $('#course-memo-status').textContent = '브라우저의 다운로드 설정에 따라 열리거나 저장됩니다.'; memo.showModal();
  });
  $('#course-memo-close').addEventListener('click', () => memo.close());
  $('#course-memo-select').addEventListener('click', () => { $('#course-memo-content').focus(); $('#course-memo-content').select(); });
  $('#course-memo-save').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([$('#course-memo-content').value], { type: 'text/plain;charset=utf-8' }));
    const anchor = el('a'); anchor.href = url; anchor.download = 'synk-jongno-halfday.txt'; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); $('#course-memo-status').textContent = '메모 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요.';
  });
  return {
    reset,
    updateSelection() {
      const ids = getSelected().filter(id => places.get(id)?.category !== 'stay');
      $('#course-selection-note').textContent = `현재 담은 장소 중 식사·차·문화 ${ids.length}곳. 2~3곳을 담으면 그 순서로 코스를 만들 수 있어요. 숙박은 반나절 코스에서 제외합니다.`;
    },
  };
}
