// 레이싱 입구 — 오늘의 레이스 카드, 코스 고르기 창(문장 도전 18코스 · 어휘 연습 400스테이지), 공통 코인 줄, 함께 달릴 친구.
// 코스를 바꾸고 레이스를 시작하는 일은 app.js가 맡는다(api). 여기서는 app.js가 주는 지금 상태(api.view())를 그리기만 한다.
import { $, $$, el } from './kit/lab.mjs';
import { CAMPAIGN, CHAPTERS, medalFor } from './campaign.js';
import { FINALES } from './finales.js';
import { STAGES, WORD_BY_ID, reviewStage } from './learning.js';
import { openDialog, closeDialog } from './screens.js';

export const ALL_COURSES = CHAPTERS.flatMap((ch) => [...CAMPAIGN.filter((s) => s.chapter === ch.id), ...FINALES.filter((s) => s.chapter === ch.id)]);
const PAGE = 12;
const stageSize = (s) => (s.campaign ? s.items.length : s.words.length);
const pad = (n) => String(n).padStart(3, '0');

/** 코스 이름표(결과 화면 머리글에도 쓴다): 어휘 스테이지는 번호를 붙인다. */
export const labelStage = (s) => (s.number && !s.campaign ? `${pad(s.number)} · ${s.title}` : s.title);

/** 코스 한 줄 설명: 몇 단계의 무슨 연습인지. */
export function stageMeta(s) {
  if (s.personalized) return s.skill;
  if (s.review) return s.campaign ? '문장 복습 · 놓친 문장부터' : '어휘 복습 · 틀린 단어부터';
  if (s.finale) return `${s.level}단계 결승 · ${CHAPTERS[s.chapter - 1].title}`;
  if (s.campaign) return `${s.level}단계 · ${s.skill}`;
  return `어휘 ${pad(s.number)} · ${s.mode === 'picture' ? '그림을 보고 고르기' : '듣고 단어 고르기'}`;
}

export function createLobby(api) {
  let collection = 'campaign', page = 0, filter = 'all';
  const dialog = $('#course-dialog');

  /* ── 오늘의 레이스 ── */
  function renderStart(v) {
    const s = v.stage, best = v.progress.stages[s.id]?.bestScore ?? null, total = stageSize(s);
    $('#l-meta').textContent = v.target ? '이번 목표' : stageMeta(s);
    $('#l-title').textContent = labelStage(s);
    const medals = best == null ? 0 : medalFor(best, total);
    $('#l-medals').replaceChildren(...[1, 2, 3].map((i) => el('i', i <= medals ? 'on' : '')),
      el('span', '', best == null ? `${total}문제 · 처음 달려요` : `최고 ${best} / ${total}${v.progress.stages[s.id]?.cleared ? ' · 통과' : ''}`));
    $('#l-medals').setAttribute('aria-label', `학습 메달 3개 중 ${medals}개`);
    $('#l-reason').textContent = reasonFor(v);
    const label = $('#start').querySelector('span');
    label.textContent = v.starting ? '소리를 준비하고 있어요' : v.pendingStart ? '준비되면 바로 출발해요'
      : !v.unlocked ? '앞 코스부터 달리기' : v.firstRun ? '조작 연습부터 시작' : '레이스 시작';
    $('#start').setAttribute('aria-busy', String(!!(v.starting || v.pendingStart)));
    $('#watch').hidden = !!v.target;
    $('#choose-course').hidden = !!v.target;
    for (const name of ['marin', 'kkamong']) $(`#driver-${name}`).setAttribute('aria-pressed', String(v.driver === name));
    const status = $('#world-status');
    status.classList.toggle('warn', v.load === 'failed');
    status.hidden = v.load === 'ready';
    if (v.load === 'failed') {
      status.textContent = '이 브라우저에서 3D 해안도로를 열지 못했어요. ';
      const retry = el('button', 'chip-btn', '다시 열기');
      retry.type = 'button';
      retry.addEventListener('click', () => location.reload());
      status.append(retry);
    } else status.textContent = v.pendingStart ? '해안도로를 준비하고 있어요. 준비되면 바로 출발해요.' : '해안도로를 준비하고 있어요. 레이스 시작을 누르면 준비되는 대로 출발해요.';
    $('#learning-scope').textContent = v.scope;
    $('#reset-learning').hidden = !!v.hosted;
  }

  function reasonFor(v) {
    const s = v.stage;
    if (v.target) return v.personal?.reason || v.targetUnavailable;
    if (!v.unlocked) return s.finale ? '이 챕터의 두 코스를 통과하면 결승전이 열려요. 자동 시연은 지금도 볼 수 있어요.'
      : '앞 코스를 다섯 문제 중 넷 이상 맞히면 열려요. 자동 시연은 지금도 볼 수 있어요.';
    if (v.firstRun) return '처음이라 30초 조작 연습부터 함께 달려요. 연습이 끝나면 바로 이 코스로 출발해요.';
    if (s.personalized) return v.personal?.reason || '지금까지의 기록에 맞춰 고른 다섯 문항이에요.';
    if (s.review) return '지난 레이스에서 놓친 것부터 다시 만나요.';
    if (s.finale) return `챕터에서 익힌 표현을 새 문장으로 만나요. 넷 이상 맞히면 ${s.reward.title} 보상을 받아요.`;
    if (s.campaign) return `${CHAPTERS[s.chapter - 1].goal}를 연습해요. ${v.progress.stages[s.id]?.cleared ? '이미 통과한 코스라 메달을 더 모아요.' : '넷 이상 맞히면 다음 코스가 열려요.'}`;
    return `${s.words.slice(0, 3).map((id) => WORD_BY_ID[id].word).join(' · ')} … 다섯 단어를 듣고 골라요.`;
  }

  /** 공통 코인 줄(입구): 보유 코인. 저장 공간을 읽을 수 없으면 ‘코인저장불가’(다른 게임과 같은 말). */
  function renderCoins(garage, saved = true) {
    for (const node of $$('[data-collection-balance]')) node.textContent = saved && garage ? `보유 ${garage.coins.toLocaleString('ko-KR')}코인` : '코인저장불가';
  }

  /* ── 코스 고르기 ── */
  function list(v) {
    if (collection === 'campaign') return ALL_COURSES;
    const query = $('#stage-search').value.trim();
    return STAGES.filter((s) => (filter === 'all' || s.mode === filter || s.band === filter)
      && (!query || `${s.title} ${s.number} ${s.words.map((id) => WORD_BY_ID[id].word).join(' ')}`.includes(query)));
  }

  function renderCourses() {
    const v = api.view(), progress = v.progress, campaign = collection === 'campaign';
    for (const kind of ['campaign', 'words']) $(`#collection-${kind}`).setAttribute('aria-pressed', String(kind === collection));
    const courses = ALL_COURSES.filter((s) => progress.stages[s.id]?.cleared).length;
    const medals = ALL_COURSES.reduce((n, s) => n + medalFor(progress.stages[s.id]?.bestScore || 0), 0);
    const words = Object.values(progress.words).filter((p) => p.correct > 0).length;
    const stages = STAGES.filter((s) => progress.stages[s.id]?.cleared).length;
    $('#course-stats').innerHTML = campaign
      ? `통과 <b>${courses}</b> / ${ALL_COURSES.length}코스 · 학습 메달 <b>${medals}</b> / ${ALL_COURSES.length * 3}`
      : `정답을 고른 단어 <b>${words.toLocaleString('ko-KR')}</b> / 2,000 · 통과 <b>${stages}</b> / ${STAGES.length}스테이지`;
    const review = reviewStage(progress, collection);
    $('#review-stage').hidden = !review;
    $('#review-stage').textContent = campaign ? '놓친 문장부터 복습' : '틀린 단어부터 복습';
    $('#journey-next').textContent = v.personal ? '나에게 맞는 5문항 달리기' : `추천: ${v.recommended.title} 달리기`;
    const mission = v.mission;
    $('#today-mission').hidden = !mission || mission.completed;
    if (mission) $('#today-mission').textContent = `오늘의 미션 · ${mission.title} +${mission.reward}`;
    $('#word-tools').hidden = campaign;
    for (const chip of $$('#stage-filter [data-filter]')) chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter));
    $('#course-rule').textContent = campaign
      ? '다섯 문제 중 넷을 맞히면 다음 코스가 열려요. 챕터마다 두 코스를 지나면 새 문장 결승전과 특별 꾸미기 보상이 기다려요.'
      : '어휘 연습은 순서와 상관없이 자유롭게 달려요. 틀린 단어는 복습 코스로 다시 만나요.';
    const all = list(v), pages = Math.max(1, Math.ceil(all.length / PAGE));
    page = Math.min(Math.max(0, page), pages - 1);
    $('#stage-pagination').hidden = pages === 1;
    $('#stage-page').textContent = `${page + 1} / ${pages}`;
    $('#stage-prev').disabled = page === 0;
    $('#stage-next').disabled = page >= pages - 1;
    const grid = $('#stage-grid');
    grid.replaceChildren(...all.slice(page * PAGE, page * PAGE + PAGE).map((s) => tile(s, v)));
    if (!all.length) grid.append(el('p', 'empty-stages', '다른 단어나 주제로 찾아보세요.'));
  }

  function tile(s, v) {
    const progress = v.progress.stages[s.id], unlocked = v.isUnlocked(s), picked = s.id === v.stage.id;
    // 한 줄이 한 챕터(코스 둘 + 결승): 챕터마다 분홍·버터를 번갈아, 결승은 라피스
    const color = s.finale ? 'c-lapis' : s.campaign ? (s.chapter % 2 ? 'c-blush' : 'c-butter') : s.mode === 'picture' ? 'c-butter' : 'c-blush';
    const button = el('button', `course-tile ${color}${unlocked ? '' : ' locked'}`);
    button.type = 'button';
    button.dataset.stage = s.id;
    button.setAttribute('aria-pressed', String(picked));
    const total = stageSize(s), medals = progress ? medalFor(progress.bestScore, total) : 0;
    const sub = s.finale ? `새 문장 5개 · ${s.reward.title}` : s.campaign ? CHAPTERS[s.chapter - 1].goal : s.words.map((id) => WORD_BY_ID[id].word).join(' · ');
    const status = el('span', 'ct-status');
    status.append(...[1, 2, 3].map((i) => el('i', i <= medals ? 'on' : '')),
      el('span', '', !unlocked ? (s.finale ? '두 코스를 통과하면 열려요' : '앞 코스를 통과하면 열려요')
        : progress ? `최고 ${progress.bestScore} / ${total}${progress.cleared ? ' · 통과' : ''}` : `${total}문제 · 처음 도전`));
    button.append(el('span', 'ct-meta', stageMeta(s)), el('strong', 'ct-title', labelStage(s)), el('span', 'ct-sub', sub), status);
    if (s.finale) button.append(el('span', 'ct-flag', '결승'));
    button.setAttribute('aria-label', `${labelStage(s)}, ${stageMeta(s)}, ${status.textContent}${picked ? ', 지금 고른 코스' : ''}`);
    button.addEventListener('click', () => { closeDialog(dialog); api.select(s); });
    return button;
  }

  function openCourses() {
    const v = api.view();
    if (v.target) return;
    collection = v.stage.campaign || v.stage.personalized ? 'campaign' : 'words';
    const index = (collection === 'campaign' ? ALL_COURSES : list(v)).findIndex((s) => s.id === v.stage.id);
    page = index < 0 ? 0 : Math.floor(index / PAGE);
    renderCourses();
    openDialog(dialog);
    dialog.querySelector('.course-tile[aria-pressed="true"]')?.focus({ preventScroll: false });
  }

  /* ── 이벤트 ── */
  $('#choose-course').addEventListener('click', openCourses);
  $('#course-close').addEventListener('click', () => closeDialog(dialog));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(dialog); });   // 창 바깥(어두운 곳)을 누르면 닫는다
  for (const kind of ['campaign', 'words']) $(`#collection-${kind}`).addEventListener('click', () => { collection = kind; page = 0; renderCourses(); });
  $('#stage-search').addEventListener('input', () => { page = 0; renderCourses(); });
  for (const chip of $$('#stage-filter [data-filter]')) chip.addEventListener('click', () => { filter = chip.dataset.filter; page = 0; renderCourses(); });
  $('#stage-prev').addEventListener('click', () => { page--; renderCourses(); });
  $('#stage-next').addEventListener('click', () => { page++; renderCourses(); });
  $('#review-stage').addEventListener('click', () => {
    const s = reviewStage(api.view().progress, collection);
    if (!s) return;
    closeDialog(dialog);
    api.select(s);
  });
  $('#journey-next').addEventListener('click', () => { closeDialog(dialog); api.journey(); });
  $('#today-mission').addEventListener('click', () => {
    const mission = api.view().mission;
    if (!mission || mission.completed) return;
    closeDialog(dialog);
    api.mission(mission);
  });

  return {
    render(v = api.view()) { renderStart(v); renderCoins(v.garage, v.garageSaved); if (dialog.open) renderCourses(); },
    renderCoins,
    openCourses,
    closeCourses: () => closeDialog(dialog),
    get collection() { return collection; },
    useCollection(kind) { collection = kind; page = 0; },
  };
}
