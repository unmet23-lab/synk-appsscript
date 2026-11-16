// Atlas 새 길 「내 위치」의 최소 그림(재설계 단계 4-4a — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-2 ~ 21-5). 셸은 이 파일을
// 부르지 않는다 — 입구(world-atlas-next.mjs)가 정적으로 받아 홈 플래너로 넘긴다(world-today.mjs와 같다). 판단은 하지 않는다 — 계약
// (world-position-next.mjs · world-diagnostic-next.mjs가 지은 꼴)을 그대로 그린다.
// 화면 글과 화면 검수는 리디자인에서 한다(유호님 11-15 · 21-12). 그래서 새 글을 만들지 않고 지금 판 화면 글 표(world-strings.mjs)의 열쇠만 빌린다.
// 지금 판에 맞는 글이 없는 표지(칸이 따라오는 중 · 아직 칸에 들지 않은 답 · 하루 상한 카드 · 뺀 레이싱 문항 · 칸의 수)는 data-* 칸으로만 싣는다.
// 지금 판 그림(world-position-ui.mjs)은 계정 묶음에 실려 있어 고치지 않는다 — 시범(11-19 ~ 11-30)이 그 묶음으로 돈다. 진단 문항 판과 끝 화면은
// 계약의 꼴이 같아 지금 판 그림(renderDiagnosticItem · renderDiagnosticDone)을 그대로 쓴다(world-learning-ui.mjs). 확인 중 판은 플래너를 받기 전에도
// 그려야 해서 셸(world-learning-ui.mjs nextChecking)에 있다.
// t(키, 값) · has(키) · formatDate(ms, Intl 옵션)는 화면 쪽(world-learning-ui.mjs)이 넘긴다(world-position-ui.mjs와 같은 방식).

const escape = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LED = Object.freeze({ independent: 'ok', practicing: 'check', notyet: '' });
const CELLS = Object.freeze(['independent', 'practicing', 'notyet']);
const DOMAINS = Object.freeze(['listening', 'reading']);
const led = tone => `<i class="w-led${tone ? ` ${tone}` : ''}" aria-hidden="true"></i>`;
const fill = (value, max) => (Math.max(0, Math.min(1, max ? value / max : 0)) * 100).toFixed(1);
const flag = value => (value ? 'true' : 'false');
const count = value => (Number.isSafeInteger(value) && value > 0 ? value : 0);

export function createPositionNextView({ t, has = () => true, formatDate = null } = {}) {
  if (typeof t !== 'function') throw TypeError('WORLD position next view needs the screen-language t()');
  const skillName = id => (has(`position.skill.${id}`) ? t(`position.skill.${id}`) : String(id ?? ''));
  const day = at => {
    if (!Number.isFinite(at)) return '';
    return formatDate ? formatDate(at, { month: 'short', day: 'numeric' }) : new Date(at + 9 * 3600000).toISOString().slice(5, 10);
  };
  const poster = (word, sub) =>
    `<div class="life-poster wpos-poster"><span class="w-print wpos-print" data-print="position" aria-hidden="true"><i></i></span><small class="life-poster-label">MY POSITION</small><strong class="life-poster-word">${escape(word)}</strong><p class="life-poster-sub">${escape(sub)}</p></div>`;
  const practiceButton = (id, practice) =>
    practice?.(id)
      ? `<button class="quiet-button wpos-practice" type="button" data-position-practice="${escape(id)}">${escape(t('position.practice.start'))} <span aria-hidden="true">→</span></button>`
      : '';
  const summaryOf = board =>
    t(board.exam === 'topik2' ? 'position.summary.topik2' : 'position.summary', { ...board.counts, total: board.total });
  const numbers = row =>
    `data-answered="${count(row.answered ?? row.independent)}" data-correct="${count(row.correct)}" data-helped="${count(row.helped)}"`;

  // 능력 한 줄 — 이름과 칸, 펼치면 본 난도마다 칸(「난도 n 연습 중」). 칸의 수는 data-*로만(글은 리디자인).
  function skillRow(skill, practice) {
    const seen = skill.levels.filter(level => level.cell !== 'notyet');
    const levels = seen
      .map(
        level =>
          `<li data-difficulty="${level.difficulty}" data-cell="${level.cell}" ${numbers(level)} data-missed="${count(level.missed)}">${escape(t('position.note.level', { n: level.difficulty, state: t(`position.cell.${level.cell}`) }))}</li>`,
      )
      .join('');
    const body = levels
      ? `<ul class="wpos-levels">${levels}</ul>`
      : `<p class="wpos-empty">${escape(t('position.evidence.none'))}</p>`;
    const chip = `<span class="wpos-chip" data-tone="${LED[skill.cell] || 'idle'}">${led(LED[skill.cell])}${escape(t(`position.cell.${skill.cell}`))}</span>`;
    return `<details class="wpos-skill" data-skill="${escape(skill.id)}" data-cell="${skill.cell}" data-catching="${flag(skill.catching)}" ${numbers(skill)} data-missed="${count(skill.missed)}"><summary><span class="wpos-skill-name">${escape(skillName(skill.id))}</span>${chip}</summary><div class="wpos-skill-body">${body}${practiceButton(skill.id, practice)}</div></details>`;
  }

  // 먼저 볼 항목(최대 셋 — 계약의 attention 차례 그대로).
  function attentionBlock(board, practice) {
    const rows = board.attention.map(id => board.skills.find(skill => skill.id === id)).filter(Boolean);
    if (!rows.length) return '';
    const items = rows
      .map(
        skill =>
          `<li data-skill="${escape(skill.id)}" data-missed="${count(skill.missed)}" data-helped="${count(skill.helped)}"><span class="wpos-attention-copy"><strong>${escape(skillName(skill.id))}</strong></span>${practiceButton(skill.id, practice)}</li>`,
      )
      .join('');
    return `<section class="wpos-attention" data-position-attention><p class="life-section-label">LOOK FIRST</p><h3>${escape(t('position.attention.title'))}</h3><ul>${items}</ul></section>`;
  }

  // 짧은 진단(selectDiagnosticNext의 판) — 빠진 까닭의 글은 지금 판과 같은 차례다. 뺀 레이싱 문항(withheld)은 학생에게는 「진단 문항이 아직 없는
  // 항목」과 같아 그 줄에 함께 세고, 까닭은 data-withheld에 남긴다.
  function diagnosticBlock(board, plan, diagnosed) {
    if (!plan) return '';
    const by = reason => plan.missing.filter(row => row.reason === reason).map(row => row.skillId);
    const notes = [];
    const none = [...by('no-item'), ...by('withheld')];
    if (plan.reason === 'history.incomplete') notes.push(t('position.diagnostic.history'));
    else if (!plan.items.length && plan.missing.length && none.length === plan.missing.length)
      notes.push(t(board.exam === 'topik2' ? 'position.diagnostic.noneYet2' : 'position.diagnostic.noneYet'));
    else {
      const audio = by('audio');
      const unknown = by('unknown');
      const seen = by('all-seen');
      if (none.length)
        notes.push(t('position.diagnostic.missing', { n: none.length, skills: none.map(skillName).join(' · ') }));
      if (audio.length) notes.push(t('position.diagnostic.audioOff', { n: audio.length }));
      if (unknown.length) notes.push(t('position.diagnostic.unknown', { n: unknown.length }));
      if (seen.length && !plan.items.length) notes.push(t('position.diagnostic.allSeen'));
    }
    const ready = plan.status === 'ready' && plan.items.length > 0;
    const held = by('withheld');
    const start = ready
      ? `<button class="felt-button" type="button" data-position-diagnostic>${escape(t(diagnosed ? 'position.diagnostic.again' : 'position.diagnostic.start'))} <span aria-hidden="true">→</span></button>`
      : '';
    return `<section class="wpos-diagnostic" data-diagnostic="${ready ? 'ready' : 'unavailable'}"${held.length ? ` data-withheld="${escape(held.join(' '))}"` : ''}><p class="life-section-label">QUICK CHECK</p><h3>${escape(t('position.diagnostic.title'))}</h3>${ready ? `<p>${escape(t('position.diagnostic.intro', { n: plan.items.length }))}</p>` : ''}${notes.map(note => `<p class="wpos-note">${escape(note)}</p>`).join('')}${start}</section>`;
  }

  // 돌아올 단위 카드(§21-4) — 이름은 그 단위를 싣는 문항이 낸 한국어 이름(학습 내용)이다. 열 수 있으면 단추, 아니면 까닭: 아직 돌아올 때가 아님은
  // 그때의 날짜, 낼 문항 없음 · 소리를 끈 날은 지금 판의 글. 하루 상한은 맞는 글이 없어 data-why로만(글은 리디자인).
  function cardsBlock(cards) {
    const list = cards
      .map(card => {
        const why =
          card.why === 'not-due'
            ? day(card.dueAt)
            : card.why === 'no-item'
              ? t('followup.noSupply')
              : card.why === 'audio'
                ? t('practice.audioOff')
                : '';
        const open = card.open
          ? `<button class="quiet-button wfol-open" type="button" data-position-recheck="${escape(card.unit)}">${escape(t(card.source === 'life' ? 'followup.openReview' : 'followup.open'))} <span aria-hidden="true">→</span></button>`
          : '';
        const sub = card.source === 'life' ? `<small>${escape(t('position.source.life'))}</small>` : '';
        return `<li class="wfol-card" data-unit="${escape(card.unit)}" data-source="${card.source}" data-why="${escape(card.why ?? '')}" data-lapses="${count(card.lapses)}" data-sittings="${count(card.sittings)}"${card.dueNow ? ' data-due' : ''}><p class="wfol-head"><strong lang="ko">${escape(card.label)}</strong>${sub}</p>${why ? `<p class="wfol-note">${escape(why)}</p>` : ''}${open}</li>`;
      })
      .join('');
    return `<section class="wpos-followups"${cards.length ? ' data-cards' : ''}><p class="life-section-label">CHECK AGAIN</p><h3>${escape(t('followup.title'))}</h3><p>${escape(t('followup.note'))}</p>${cards.length ? `<ul class="wfol-list">${list}</ul>` : `<p>${escape(t('followup.empty'))}</p>`}</section>`;
  }

  // 영역별 진행과 능력 줄(지금과 같은 꼴 — 영역마다 항목 수, 칸이 정해진 항목 수).
  function groups(board, practice) {
    return DOMAINS.map(domain => {
      const skills = board.skills.filter(skill => skill.domain === domain);
      const row = board.domains?.[domain];
      const progress = row
        ? `<p class="wpos-progress"><span>${escape(t('position.progress', { checked: row.checked, total: row.total }))}</span><span class="wpos-bar" aria-hidden="true"><i style="width:${fill(row.checked, row.total)}%"></i></span></p>`
        : '';
      return `<section class="wpos-group" data-domain="${domain}"><h3>${escape(t(`position.domain.${domain}`))} <span>${skills.length}</span></h3>${progress}<div class="wpos-skills">${skills.map(skill => skillRow(skill, practice)).join('')}</div></section>`;
    }).join('');
  }

  // 옮겨 오기 전 기록(§21-3 A4 · 정본 §5-6) — 측정 칸과 따로. 한 줄(예전 기록 n개 — 혼자 낸 첫 답과 도움받은 첫 만남)과 그 능력의 이름.
  function carriedBlock(board) {
    const rows = (board.carried?.skills ?? []).filter(row => count(row.answered) + count(row.helped) > 0);
    if (!rows.length) return '';
    const n = rows.reduce((sum, row) => sum + count(row.answered) + count(row.helped), 0);
    const items = rows.map(row => `<li data-skill="${escape(row.id)}" ${numbers(row)}>${escape(skillName(row.id))}</li>`).join('');
    return `<section class="wpos-carried" data-position-carried${Number.isFinite(board.carried.at) ? ` data-at="${board.carried.at}"` : ''}><p class="wpos-note">${escape(t('position.evidence.folded', { n }))}</p><ul>${items}</ul></section>`;
  }

  // TOPIK II 쓰기: 자동으로 맞음 · 틀림을 매기지 않아 항목 칸에 넣지 않고, 쓰기 연습으로 가는 줄만(지금 판과 같다).
  function writingBlock(board, writing) {
    if (board.exam !== 'topik2') return '';
    const open = writing
      ? `<button class="quiet-button wpos-practice" type="button" data-position-writing>${escape(t('writing.title'))} <span aria-hidden="true">→</span></button>`
      : '';
    return `<section class="wpos-group" data-domain="writing"><h3>${escape(t('plan.area.writing'))}</h3><p class="wpos-note">${escape(t('position.writing.note'))}</p>${open}</section>`;
  }

  // 판 한 장. board: buildPositionNext · plan: selectDiagnosticNext · cards: recheckCards · exams: 고를 수 있는 시험(둘 이상일 때 위에 고르기) ·
  // practice(skillId): 「이 항목 연습하기」를 달 수 있나 · scope: 'account' | 'device' | null · diagnosed: 이 문서에서 진단을 한 번 했나 · writing: 쓰기 줄 단추.
  // 시험 형식 연습 · 예상 급수 · 놓친 곳 카드는 새 길에서 숨긴다(21-10의 4 · 5 — 4-4d · 4-6).
  // month: 30일째 문장(4-4c — 21-7) { text, unit, misses, reviews } — 셸이 Vellum으로 지은 문장(그 화면 언어의 줄이 없으면 셸이 null을 넘긴다).
  // 판 맨 위(머리 그림 바로 뒤)에 한 줄로 싣는다. 모양은 리디자인이 정한다 — 여기서는 글 한 줄과 수를 data-*로만.
  function board({ board, plan = null, cards = [], exams = null, practice = null, scope = null, diagnosed = false, writing = false, month = null } = {}) {
    if (!board || !Array.isArray(board.skills)) throw TypeError('WORLD position next view needs the position board');
    const exam = board.exam === 'topik2' ? 'topik2' : 'topik1';
    const summary = summaryOf(board);
    const counts = CELLS.map(
      cell =>
        `<li data-cell="${cell}">${led(LED[cell])}<strong>${count(board.counts?.[cell])}</strong><span>${escape(t(`position.cell.${cell}`))}</span></li>`,
    ).join('');
    const examSwitch =
      Array.isArray(exams) && exams.length > 1
        ? `<div class="wpos-exam" role="group" aria-label="${escape(t('position.exam.label'))}">${exams.map(id => `<button class="wpos-exam-pill" type="button" data-position-exam="${escape(id)}" aria-pressed="${flag(id === exam)}">${escape(t(`goal.exam.type.${id}`))}</button>`).join('')}</div>`
        : '';
    const incomplete = board.complete
      ? ''
      : `<p class="wpos-note" data-position-incomplete>${escape(t('position.incomplete'))}</p>`;
    const scopeLine = scope
      ? `<p class="wpos-scope">${escape(t(scope === 'account' ? 'position.scope.account' : 'position.scope.device'))}</p>`
      : '';
    // 다시 확인 카드는 있으면 진단 앞에, 없으면 판 끝에 한 줄(지금 판과 같은 자리).
    const recheck = cardsBlock(cards);
    const monthLine =
      typeof month?.text === 'string' && month.text
        ? `<p class="wpos-month" data-position-month data-unit="${escape(month.unit)}" data-misses="${count(month.misses)}" data-reviews="${count(month.reviews)}">${escape(month.text)}</p>`
        : '';
    return `<div class="wpos life-heading" data-position-next="engine" data-exam="${exam}" data-complete="${flag(board.complete)}" data-unfolded="${flag(board.unfolded)}" data-catching="${flag(board.catching)}" tabindex="-1">${poster(t('position.title'), summary)}${monthLine}${examSwitch}<ul class="wpos-counts" aria-label="${escape(summary)}">${counts}</ul><p class="wpos-intro">${escape(t('position.intro'))}</p>${incomplete}${attentionBlock(board, practice)}${cards.length ? recheck : ''}${diagnosticBlock(board, plan, diagnosed)}${groups(board, practice)}${writingBlock(board, writing)}${carriedBlock(board)}${cards.length ? '' : recheck}${scopeLine}</div>`;
  }

  return Object.freeze({ board });
}
