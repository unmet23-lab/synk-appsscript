// WORLD 앱 창 「연습」 보기(2026-11-22 유호님 「사용자 실력을 빗대어봤을때 부족한부분 위주로 추천해주도록」).
// 최근 연습에서 놓친 곳을 첫 판에 세우고, 그 곳을 연습하는 게임을 노란 칸으로 앞에 둔다.
// 쓰는 자료는 Atlas 요약의 기술 목록(summary.practice.skills) 하나다. 서버가 연습이 필요한 차례(priority)로 보낸다.
// 요약은 실력 · 등급 · 비율을 말하지 않는다(atlas/account-summary.js). 이 화면도 최근 연습에서 일어난 일만 말한다.
// 게임마다 연습하는 기술은 각 게임 문항의 기술 꼬리표(packages/atlas/map/index.json의 bank별 기술)를 줄였다.
// main은 그 게임의 주된 연습, also는 문항 몇 개만 닿는 기술이다. 추천은 main을 먼저 본다.
export const GAME_SKILLS = Object.freeze({
  'korean-runner': { main: ['ko.listening.sequence', 'ko.listening.negation', 'ko.listening.detail'], also: [], text: '순서 · 부정 듣기' },
  'korean-racing': { main: ['ko.listening.word'], also: ['ko.listening.detail', 'ko.listening.main', 'ko.listening.reason', 'ko.listening.negation', 'ko.listening.sequence', 'ko.reading.grammar', 'ko.reading.detail', 'ko.reading.negation', 'ko.reading.condition'], text: '낱말 듣기' },
  'korean-rhythm': { main: ['ko.listening.reason', 'ko.listening.negation', 'ko.listening.condition', 'ko.listening.detail'], also: [], text: '이유 · 부정 듣기' },
  'order-rush': { main: ['ko.listening.detail', 'ko.listening.condition', 'ko.listening.negation'], also: [], text: '세부 · 조건 듣기' },
  'entry-check': { main: ['ko.reading.condition', 'ko.reading.negation', 'ko.reading.detail'], also: [], text: '조건 · 부정 읽기' },
  'story-classroom': { main: ['ko.reading.sequence', 'ko.reading.detail', 'ko.reading.negation'], also: [], text: '순서 · 세부 읽기' },
  'blank-slice': { main: ['ko.reading.vocabulary', 'ko.reading.grammar'], also: [], text: '낱말 · 문형 읽기' },
  'talk-rally': { main: ['ko.listening.response'], also: [], text: '듣고 대답하기' },
  'learning-hub': { main: [], also: [], text: '모든 게임' },
});
// 게임 칸과 머리 글에 쓰는 짧은 이름. 없는 기술은 요약이 보낸 이름(label)을 그대로 쓴다.
export const SKILL_SHORT = Object.freeze({
  'ko.listening.word': '낱말 듣기', 'ko.listening.detail': '세부 듣기', 'ko.listening.negation': '부정·변경 듣기', 'ko.listening.sequence': '순서 듣기',
  'ko.listening.reason': '이유 듣기', 'ko.listening.condition': '조건 듣기', 'ko.listening.main': '핵심 듣기', 'ko.listening.response': '듣고 대답하기',
  'ko.reading.vocabulary': '낱말 뜻 읽기', 'ko.reading.grammar': '조사·문형 읽기', 'ko.reading.detail': '세부 읽기', 'ko.reading.negation': '부정·변경 읽기',
  'ko.reading.sequence': '순서 읽기', 'ko.reading.reason': '이유 읽기', 'ko.reading.condition': '조건 읽기', 'ko.reading.main': '핵심 읽기',
});
// 요약의 상태(atlas/learning.js)를 짧게. 최근 연습에서 일어난 일만 말한다.
export const STATUS_WORDS = Object.freeze({ practice: '최근 놓쳤어요', supported: '도움 받고 해냈어요', checking: '확인하는 중', review: '다시 볼 때',
  unseen: '기록이 적어요', 'recent-independent': '혼자 해냈어요' });
const DONE = 'recent-independent';
const SHOWN = 4;
export const shortName = skill => SKILL_SHORT[skill?.id] || skill?.label || '';
/** 최근 혼자 처음 푼 문항 가운데 맞힌 비율(유호님 11-22 「비율도 보여 줘」). 요약의 recent · correct는 그 기술에서 가장 연습이 필요한
 *  한 칸(난이도 하나 × 답 꼴 하나)의 최근 30일 셈이다(최대 12문항). 푼 문항이 없으면 비율을 만들지 않는다. */
export function ratioOf(skill) {
  const recent = skill?.recent, correct = skill?.correct;
  if (!Number.isSafeInteger(recent) || recent < 1 || !Number.isSafeInteger(correct) || correct < 0 || correct > recent) return null;
  return { recent, correct, pct: Math.round(correct / recent * 100) };
}
// 셈의 범위를 그대로 말한다(카본 A1): 그 기술 전체가 아니라 연습이 필요한 한 유형 · 최근 30일 · 처음 혼자 푼 문항이다.
export const ratioText = ratio => `연습이 필요한 유형 · 최근 첫 시도 ${ratio.recent}문항 중 ${ratio.correct}문항 맞힘`;
/** 요약에서 쓸 수 있는 기술만(서버 차례 그대로). */
export function practiceSkills(summary) {
  const rows = Array.isArray(summary?.practice?.skills) ? summary.practice.skills : [];
  return rows.filter(row => row && typeof row.id === 'string' && typeof row.label === 'string' && row.label);
}
/** 처음 고를 기술: 혼자 해낸 기술이 아닌 첫 기술. 모두 혼자 해냈으면 첫 기술. */
export function firstPick(skills) { return skills.find(row => row.status !== DONE) || skills[0] || null; }
/** 한 기술을 연습하는 게임(주된 연습 먼저, 셋까지). */
export function gamesFor(skillId, paths) {
  const score = path => { const g = GAME_SKILLS[path];if (!g || !skillId) return -1;const m = g.main.indexOf(skillId);if (m >= 0) return m;const a = g.also.indexOf(skillId);return a >= 0 ? 10 + a : -1; };
  return paths.filter(path => score(path) >= 0).sort((a, b) => score(a) - score(b)).slice(0, 3);
}
/** 게임 차례: 고른 기술의 게임 → 다른 연습할 기술의 게임 → 나머지. 모든 게임 · 상점은 끝. */
export function orderGames(paths, skills, pick) {
  const chosen = gamesFor(pick?.id, paths), other = new Set(skills.filter(row => row !== pick && row.status !== DONE).flatMap(row => gamesFor(row.id, paths)));
  const rank = path => path === 'learning-hub' ? 9 : chosen.includes(path) ? chosen.indexOf(path) : other.has(path) ? 5 : 7;
  return { order: [...paths].sort((a, b) => rank(a) - rank(b)), chosen };
}
// 받침에 맞춘 조사: particle('조건 읽기', '을', '를') → '를'. 으로/로는 ㄹ 받침도 로.
export function particle(word, withFinal, without) {
  const last = String(word).replace(/[^가-힣]+$/, '').slice(-1), code = last ? last.charCodeAt(0) - 0xac00 : -1;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;
  if (withFinal === '으로') return final === 0 || final === 8 ? without : withFinal;
  return final ? withFinal : without;
}

/**
 * 연습 보기의 판 넷(첫 판 · 최근 연습 · 최근 30일 · 게임)을 짓고, 요약이 오거나 기술을 고르면 다시 채운다.
 * element · button은 account-view의 것을 받는다(시험의 작은 DOM에서도 같이 돈다).
 */
export function createWorldPractice({ element, button, games, openGame, showAccount, context = '개인 학습', connected = true }) {
  let summary = null, state = 'loading', pick = null, rowButtons = new Map();
  const hero = element('section', null, 'wp-hero'), record = element('section', null, 'wp-record'), skillsTile = element('section', null, 'wp-skills'), gamesTile = element('section', null, 'wp-games');
  hero.setAttribute('aria-label', '오늘의 연습');skillsTile.setAttribute('aria-label', '최근 연습');record.setAttribute('aria-label', '최근 30일');gamesTile.setAttribute('aria-label', '게임');
  const paths = games.map(game => game.path), labelOf = path => games.find(game => game.path === path)?.label || path;
  const head = (title, note) => { const box = element('div', null, 'wp-head');box.append(element('h3', title));if (note) box.append(element('p', note, 'small'));return box; };
  function drawHero(skills) {
    const art = element('div', null, 'wp-art');art.setAttribute('aria-hidden', 'true');
    const body = element('div', null, 'wp-hero-body'), ctx = element('p', null, 'wp-ctx');
    const where = element('span', `${context}${connected ? '' : ' · 기록은 이 기기에만'}`, connected ? 'wp-where' : 'wp-where off');
    let tag = '오늘의 연습', title, why, go = null;
    if (state === 'off') { title = '놓친 곳에 맞춰 골라 드려요';why = '「학습 기록 연결」을 켜면 최근 연습에서 놓친 곳을 찾아 그 곳을 연습할 게임을 앞에 둬요.';go = button('내 SYNK ID에서 켜기', async () => showAccount(), 'sb-btn wp-go'); }
    else if (pick) {
      const done = pick.status === DONE, list = gamesFor(pick.id, paths);
      tag = done ? '잘 이어 가는 곳' : pick.status === 'practice' ? '오늘은 놓친 곳부터' : '오늘의 연습';title = pick.label;why = typeof pick.line === 'string' && pick.line ? pick.line : STATUS_WORDS[pick.status] || '';
      go = list.length ? button(`${labelOf(list[0])}${particle(labelOf(list[0]), '으로', '로')} 연습`, () => openGame(list[0]), 'sb-btn wp-go')
        : button('모든 미니게임 열기', () => openGame('learning-hub'), 'sb-btn wp-go');
      if (!list.length) why = `${why} 이 연습만 하는 게임은 아직 없어요. 모든 미니게임에서 골라 주세요.`.trim();
    } else if (state === 'error') { title = '연습을 골라 시작해요';why = '학습 요약을 불러오지 못해 놓친 곳을 고르지 못했어요. 아래 게임은 그대로 할 수 있어요.'; }
    else if (state === 'loading') { title = '최근 연습을 보고 있어요';why = '놓친 곳을 찾으면 그 곳을 연습할 게임을 앞에 둘게요.'; }
    else if (summary?.practice?.answered > 0) { title = '연습을 골라 이어 가요';why = '최근 연습에서 놓친 곳을 아직 고르지 못했어요. 아래 게임에서 골라 이어 가요.'; }
    else { title = '첫 연습을 해 봐요';why = '아직 연습 기록이 적어요. 한 판을 마치면 놓친 곳을 찾아 그 곳을 연습할 게임을 골라 드려요.';go = button('바람길로 시작', () => openGame('korean-runner'), 'sb-btn wp-go'); }
    ctx.append(where, element('span', tag, 'wp-tag'));
    body.append(ctx, element('h2', title), element('p', why, 'wp-why'));
    const ratio = state !== 'off' && pick ? ratioOf(pick) : null;
    if (ratio) {
      const meta = element('p', null, 'wp-meta'), bar = element('progress', null, 'wp-bar');bar.setAttribute('max', '100');bar.setAttribute('value', String(ratio.pct));bar.setAttribute('aria-hidden', 'true');
      meta.append(element('span', ratioText(ratio)), bar, element('b', `${ratio.pct}%`));body.append(meta);
    }
    const actions = element('div', null, 'wp-acts');if (go) { go.dataset.recGo = '';actions.append(go); }
    hero.replaceChildren(art, body, actions);
  }
  function drawSkills(skills) {
    const list = element('ul', null, 'wp-skill-list');rowButtons = new Map();
    for (const row of skills.slice(0, SHOWN)) {
      // 다시 그린 뒤에도 키보드 초점이 고른 줄에 남게 한다.
      const b = button('', async () => { pick = row;draw();rowButtons.get(row.id)?.focus?.({ preventScroll: true }); }, 'wp-skill');rowButtons.set(row.id, b);b.dataset.skill = row.id;b.dataset.status = row.status || '';b.dataset.word = STATUS_WORDS[row.status] || '';b.setAttribute('aria-pressed', String(row === pick));
      const ratio = ratioOf(row);b.append(element('b', row.label), element('em', ratio ? `${ratio.pct}%` : '', 'wp-pct'));
      if (ratio) { const bar = element('progress', null, 'wp-bar');bar.setAttribute('max', '100');bar.setAttribute('value', String(ratio.pct));bar.setAttribute('aria-hidden', 'true');b.append(bar);b.setAttribute('title', ratioText(ratio)); }
      const li = element('li');li.append(b);list.append(li);
    }
    const empty = state === 'off' ? '학습 기록 연결이 꺼져 있어 계정의 연습을 보지 않아요.' : state === 'error' ? '학습 요약을 불러오지 못했어요.' : state === 'loading' ? '불러오고 있어요.' : '아직 보여 줄 연습이 없어요.';
    skillsTile.replaceChildren(head('최근 연습', '놓친 곳부터 · 최근 첫 시도 비율'), skills.length ? list : element('p', empty, 'small'));
  }
  function drawRecord() {
    const periods = summary?.practice?.periods, recent = periods?.recent && Number.isSafeInteger(periods.recent.answered) && periods.recent.answered > 0 ? periods.recent : null;
    const practice = summary?.practice || {};
    const big = element('p', null, 'wp-big');
    if (state === 'off') { record.replaceChildren(head('최근 30일'), element('p', '학습 기록 연결을 켜면 연습한 날과 문항을 보여 줘요.', 'small'));return; }
    if (recent) {
      big.append(element('b', String(recent.activeDays || 0)), element('span', '일 연습했어요'));
      record.setAttribute('aria-label', '최근 30일');record.replaceChildren(head('최근 30일'), big, element('p', `혼자 맞힌 문항 ${recent.independent || 0} · 도움 받은 문항 ${recent.assisted || 0}`, 'wp-counts'));
    } else if (Number.isSafeInteger(practice.answered) && practice.answered > 0) {
      big.append(element('b', String(practice.answered)), element('span', '문항 연습했어요'));
      record.setAttribute('aria-label', '지금까지');record.replaceChildren(head('지금까지'), big, element('p', `혼자 맞힌 문항 ${practice.independent || 0} · 도움 받은 문항 ${practice.assisted || 0}`, 'wp-counts'));
    } else record.replaceChildren(head('최근 30일'), element('p', state === 'loading' ? '불러오고 있어요.' : state === 'error' ? '연습 기록을 불러오지 못했어요.' : '아직 저장된 연습이 없어요.', 'small'));
  }
  function drawGames(skills) {
    const { order, chosen } = orderGames(paths, skills, pick);
    const links = element('div', null, 'game-links');
    for (const path of order) {
      const rec = chosen.includes(path), b = button(labelOf(path), () => openGame(path), 'sb-glass');
      b.dataset.game = path;b.dataset.skills = rec ? shortName(pick) : GAME_SKILLS[path]?.text || '';if (rec) b.dataset.rec = '';links.append(b);
    }
    const note = !pick ? (connected && state !== 'off' ? '누르면 바로 열려요. 기록은 계정에 남아요.' : '누르면 바로 열려요. 기록은 이 기기에만 남아요.') : !chosen.length ? `「${shortName(pick)}」만 하는 게임은 아직 없어요. 모든 미니게임에서 골라 주세요.`
      : pick.status === DONE ? `노란 칸에서 「${shortName(pick)}」${particle(shortName(pick), '을', '를')} 가볍게 이어 가요.` : `노란 칸은 「${shortName(pick)}」${particle(shortName(pick), '을', '를')} 연습하는 게임이에요.`;
    gamesTile.replaceChildren(head('게임', note), links);
  }
  function draw() { const skills = practiceSkills(summary);if (pick && !skills.includes(pick)) pick = null;drawHero(skills);drawSkills(skills);drawRecord();drawGames(skills); }
  /** 요약 받음(result: synk-account ?view=atlas 응답) 또는 실패(null). */
  function setSummary(result, failed = false) {
    const previous = pick?.id;summary = result?.summary || null;
    state = failed ? 'error' : !result ? 'loading' : result.shared && result.shared !== 'practice-and-settings' ? 'off' : 'ready';
    const skills = practiceSkills(summary);pick = skills.find(row => row.id === previous) || firstPick(skills);draw();
  }
  draw();
  return { hero, record, skills: skillsTile, games: gamesTile, setSummary, status: () => ({ state, pick: pick?.id || null }) };
}
