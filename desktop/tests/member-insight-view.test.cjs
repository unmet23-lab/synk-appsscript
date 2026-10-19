'use strict';
// 「내 성향」 view (desktop/renderer/member-insight-view.mjs), 2026-10-19 skeleton: poster + 「지금의 나」,
// what I chose · what I tried, the 30-day comparison and the floor. The report shapes below follow
// buildMemberInsightReport; sentences arrive already said by Vellum.
const test = require('node:test');
const assert = require('node:assert/strict');
const loaded = import('../renderer/member-insight-view.mjs');
const period = (from, to, answered, independent, assisted, activeDays) => ({ from, to, answered, independent, assisted, activeDays });
const report = (patch = {}) => ({
  asOf: '2026-10-14T06:20:00.000Z', lastAt: '2026-10-13T04:10:00.000Z', shared: 'practice-and-settings', learningEnabled: true, learningRevision: 7,
  now: { kind: 'growth', headline: '최근 30일, 혼자 답한 횟수가 3번에서 5번으로 늘었어요.', support: ['한국 여행 때문에 배우고 있어요.', '요즘은 카페에서 주문하기를 가장 많이 연습했어요.'] },
  settings: { support: 'step', explanation: null, textSize: null, motion: null, audio: null },
  settingChoices: { support: [{ id: 'step', label: '단계별로 도와줘요' }, { id: 'choose', label: '그때그때 맞춰 줘요' }, { id: 'independent', label: '혼자 해 볼게요' }],
    explanation: [{ id: 'brief', label: '짧은 설명' }, { id: 'standard', label: '보통 설명' }, { id: 'detailed', label: '자세한 설명' }] },
  reasonIds: ['travel'], worldReadsAnswers: false, usageLine: '',
  personal: [{ id: 'reasons', title: '직접 밝힌 관심과 목표', value: '한국 여행', basis: 'self-declared' }, { id: 'support', title: '편한 도움 방식', value: '단계별로 도와줘요', basis: 'self-declared' }],
  learning: { answered: 8, independent: 5, assisted: 3, empty: false,
    skills: [{ id: 'listen', label: '짧은 지시 듣기', status: 'practice', line: '최근 놓친 짧은 지시 듣기를 조금 더 연습해 봐요.', recent: 4, correct: 3, assisted: 1, fact: '이 연습에서 최근 혼자 답한 4번 중 3번 맞혔어요. 도움 받고 맞힌 건 1번이에요.' },
      { id: 'read', label: '안내문 읽기', status: 'recent-independent', line: '', recent: 5, correct: 5, assisted: 0, fact: '이 연습에서 최근 혼자 답한 5번 중 5번 맞혔어요.' }],
    content: [{ id: 'review', label: '방향을 나타내는 말', status: 'review' }],
    topics: [{ id: 'cafe', label: '카페에서 주문하기', kind: 'situation', word: '상황', count: 6, activeDays: 3 }],
    periods: { days: 30, sufficient: true, reason: '같은 길이의 두 기간에 답한 횟수를 비교해요.',
      recent: period('2026-09-14T06:20:00.000Z', '2026-10-14T06:20:00.000Z', 8, 5, 3, 4), previous: period('2026-08-15T06:20:00.000Z', '2026-09-14T06:20:00.000Z', 6, 3, 3, 4),
      delta: { answered: 2, independent: 2, assisted: 0, activeDays: 0 } } },
  reasons: [{ label: '한국 여행', line: '여행에서 쓸 말을 연습해요.' }],
  activity: { status: 'disabled', enabledAt: null, periods: null, interests: [], activities: [] },
  understanding: { status: 'unavailable', facets: [], history: [], statementHistory: [], relations: [], activities: [] },
  limits: [], ...patch,
});

test('the first screen says one sentence about now, three counts and one white button, never a score', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report() });
  assert.match(html, /<span class="mi2-label">지금의 나<\/span><h2 id="mi2-now-title">최근 30일, 혼자 답한 횟수가 3번에서 5번으로 늘었어요.<\/h2>/);
  assert.match(html, /<dt>답함<\/dt><dd><b>8<\/b>번<\/dd>/);assert.match(html, /<dt>혼자 답함<\/dt><dd><b>5<\/b>번<\/dd>/);assert.match(html, /<dt>연습한 날<\/dt><dd><b>4<\/b>일<\/dd>/);
  assert.match(html, /10월 14일 기준 최근 30일 기록이에요. 점수나 급수는 매기지 않아요./);
  assert.equal((html.match(/class="mi2-pill"/g) || []).length, 1, 'one white button on the first screen');
  assert.match(html, /class="mi2-pill" data-insight-action="activity" data-insight-target="world"><span class="mi2-led" aria-hidden="true"><\/span>WORLD에서 이어서 하기/);
  assert.match(html, /다음 한 걸음<\/span><p class="mi2-next-title">방향을 나타내는 말/);
  assert.match(html, /data-insight-action="jump" data-insight-target="mi2-why"/);assert.match(html, /<details class="mi2-fold" id="mi2-why">/);
  assert.match(html, />혼자 해냄</);assert.match(html, />한 번 더</);assert.match(html, />다시 볼 때</);
  assert.doesNotMatch(html, />practice<|>review<|>recent-independent</);
  assert.doesNotMatch(html, /%|정답률|성장률|실력이 향상|줄었|급수입니다|성격 유형은 [^매]/);
  assert.match(html, /href="#benefits"/);assert.match(html, /data-insight-action="account"[^>]*>내 정보·연결 설정/);
});

test('the comparison says 「늘었어요」 only for answers, independent answers and practice days, and never a fall', async () => {
  const { renderMemberInsight } = await loaded;
  const value = report();value.learning.periods.previous.assisted = 1;value.learning.periods.recent.assisted = 3;
  value.learning.periods.previous.activeDays = 6;
  const html = renderMemberInsight({ status: 'ready', report: value });
  const table = html.split('<table>')[1].split('</table>')[0];
  assert.match(table, /답한 횟수<\/th><td>6번<\/td><td><b>8번<\/b> <span class="mi2-up">늘었어요/);
  assert.match(table, /도움 받고 답한 횟수<\/th><td>1번<\/td><td><b>3번<\/b><\/td>/, 'help is not called growth');
  assert.match(table, /연습한 날<\/th><td>6일<\/td><td><b>4일<\/b><\/td>/, 'a smaller number is shown as it is');
  assert.doesNotMatch(html, /줄었|떨어|감소/);
  value.learning.periods.sufficient = false;
  const short = renderMemberInsight({ status: 'ready', report: value });
  assert.doesNotMatch(short, /<table>|class="mi2-up"/);assert.match(short, /아직 비교할 만큼 기록이 쌓이지 않았어요/);
});

test('with learning sharing off, practice, counts and settings never show even if a stale report still has them', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ shared: 'declared-only', learningEnabled: false,
    now: { kind: 'disconnected', headline: '학습 기록 연결이 꺼져 있어 연습 기록은 보지 않아요.', support: ['배우는 이유만 보여요. 연결을 켜면 해 본 것과 다음에 할 것도 함께 봐요.'] } }) });
  assert.match(html, /data-mi2-kind="disconnected"/);
  assert.match(html, /class="mi2-pill" data-insight-action="account">.*계정에서 연결 켜기/);
  assert.match(html, />한국 여행</);
  assert.doesNotMatch(html, /짧은 지시 듣기|방향을 나타내는 말|mi2-numbers|<table>|편한 도움 방식|data-insight-target="world"/);
  assert.match(html, /학습 기록 연결을 켜면 도움 방식과 설명 길이도 여기서 함께 보여요/);
});

test('an empty member is told what will appear and how to start, with no invented type or practice', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ personal: [], reasons: [], reasonIds: [], settings: { support: null, explanation: null, textSize: null, motion: null, audio: null },
    now: { kind: 'empty', headline: '아직 나를 설명할 기록이 없어요. 하나만 하면 다음엔 달라져요.', support: ['연습을 하면 해 본 것과 다음에 할 것을 여기서 보여 드려요. 기록이 없다고 실력이 없다는 뜻은 아니에요.'] },
    learning: { answered: 0, independent: 0, assisted: 0, empty: true, skills: [], content: [], topics: [], periods: null } }) });
  assert.match(html, /data-mi2-kind="empty"/);assert.match(html, /기록이 없다고 실력이 없다는 뜻은 아니에요/);
  assert.match(html, /WORLD에서 첫 연습 해 보기/);assert.match(html, /data-insight-action="account">배우는 이유 알려 주기/);
  assert.doesNotMatch(html, /mi2-numbers|mi2-pair|data-insight-action="download"|data-insight-action="share"/);
});

test('what I chose lists the choices with a place to change each, and settings change here only when the account allows it', async () => {
  const { renderMemberInsight } = await loaded;
  const follows = report({ worldFollowsSettings: true });
  const html = renderMemberInsight({ status: 'ready', report: follows, settingsWritable: true });
  const told = html.split('id="mi2-told"')[1].split('</section>')[0];
  assert.match(told, /<dt>배우는 이유<\/dt><dd><span class="mi2-value">한국 여행<\/span><span class="mi2-detail">여행에서 쓸 말을 연습해요.<\/span>/);
  assert.match(told, /<dt>편한 도움 방식<\/dt><dd><span class="mi2-value">단계별로 도와줘요/);
  assert.match(told, /<dt>편한 설명 길이<\/dt><dd><span class="mi2-unset">아직 안 골랐어요/);
  assert.match(told, /data-insight-action="settings-edit" data-insight-field="support">고치기/);
  assert.match(told, /data-insight-action="settings-edit" data-insight-field="explanation">고르기/);
  assert.match(told, /여기서 고치면 계정 설정에 바로 저장되고, WORLD 연습도 같은 설정을 써요/);
  const locked = renderMemberInsight({ status: 'ready', report: follows, settingsWritable: false }).split('id="mi2-told"')[1].split('</section>')[0];
  assert.doesNotMatch(locked, /settings-edit/);assert.match(locked, /지금 여기서 바꿀 수 없어요. WORLD 학습 목표에서 바꿔 주세요/);
  const off = renderMemberInsight({ status: 'ready', report: report({ learningEnabled: false, worldFollowsSettings: true }), settingsWritable: true });
  assert.doesNotMatch(off, /settings-edit/, 'a summary whose learning storage is off cannot save a setting');
});

test('until WORLD follows these settings, they are shown but not changed here and nothing promises WORLD uses them', async () => {
  const { renderMemberInsight } = await loaded;
  for (const flag of [undefined, false]) {
    const state = { status: 'ready', report: report({ worldFollowsSettings: flag }), settingsWritable: true };
    const told = renderMemberInsight(state).split('id="mi2-told"')[1].split('</section>')[0];
    assert.match(told, /<dt>편한 도움 방식<\/dt><dd><span class="mi2-value">단계별로 도와줘요/);
    assert.doesNotMatch(told, /settings-edit/);
    assert.match(told, /<p class="mi2-foot">도움 방식·설명 길이는 WORLD 학습 목표에서 바꿔요.<\/p>/);
    const opened = renderMemberInsight({ ...state, settingsEditor: { field: 'support', value: 'independent' } });
    assert.doesNotMatch(opened, /data-insight-settings-editor|WORLD 연습도 같은 설정을 써요|WORLD 연습과 다른 기기도/, 'a stale editor state cannot reopen the promise');
  }
});

test('the settings editor offers the account\'s choices with explicit save and cancel', async () => {
  const { renderMemberInsight } = await loaded;
  const state = { status: 'ready', report: report({ worldFollowsSettings: true }), settingsWritable: true, settingsEditor: { field: 'support', value: null } };
  const html = renderMemberInsight(state);
  assert.match(html, /data-insight-settings-editor data-insight-field="support"/);
  assert.match(html, /type="radio" name="insight-setting" value="step" checked/, 'the stored value starts selected');
  assert.match(html, /value="independent"><span>혼자 해 볼게요/);
  assert.match(html, /계정 설정에 바로 저장돼요. WORLD 연습과 다른 기기도 같은 설정을 써요/);
  assert.match(html, /data-insight-action="settings-save"><span class="mi2-led" aria-hidden="true"><\/span>저장/);
  assert.match(html, /data-insight-action="settings-cancel">취소/);
  const busy = renderMemberInsight({ ...state, settingsPending: true });
  assert.match(busy, /settings-save" disabled/);assert.match(busy, /settings-cancel" disabled/);assert.match(busy, /value="step" checked disabled/);
  const notice = renderMemberInsight({ ...state, settingsEditor: null, settingsMessage: '저장했어요. WORLD 연습도 이 방식을 써요.' });
  assert.match(notice, /class="mi2-notice" role="status" aria-live="polite">저장했어요/);
});

test('all remote display strings are escaped and arbitrary data cannot create attributes or tags', async () => {
  const { renderMemberInsight } = await loaded;
  const attack = '<img src=x onerror="alert(1)"><script>bad()</script>&\'"';
  const value = report({ asOf: attack, lastAt: attack, now: { kind: attack, headline: attack, support: [attack, attack] },
    personal: [{ id: 'reasons', title: attack, value: attack, basis: attack }], reasons: [{ label: attack, line: attack }], usageLine: attack });
  value.learning.skills[0].label = attack;value.learning.skills[0].fact = attack;value.learning.content[0].label = attack;value.learning.topics[0].word = attack;
  const html = renderMemberInsight({ status: 'ready', report: value });
  assert.doesNotMatch(html, /<img|<script| onerror="|datetime="<|NaN|Invalid Date/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);assert.match(html, /&amp;&#39;&quot;/);
  assert.equal((html.match(/id="benefit-title"/g) || []).length, 1);
});

test('loading, account and error states discard any stale report and expose the relevant action', async () => {
  const { renderMemberInsight } = await loaded;
  for (const [status, action] of [['loading', null], ['signed-out', 'account'], ['unconfigured', 'account'], ['error', 'refresh']]) {
    const html = renderMemberInsight({ status, report: report(), message: '<b>오류</b>' }, { native: true });
    assert.doesNotMatch(html, /혼자 답한 횟수가|짧은 지시 듣기/);
    assert.match(html, /data-view="benefits"/);assert.match(html, /id="benefit-title" tabindex="-1"/);
    if (action) assert.ok(html.includes(`data-insight-action="${action}"`));
    else { assert.match(html, /aria-busy="true"/);assert.match(html, /role="status"/); }
    if (status === 'error') assert.match(html, /&lt;b&gt;오류&lt;\/b&gt;/);
  }
  assert.match(renderMemberInsight({ status: 'ready', report: null }), /기록을 불러오지 못했어요/);
  assert.doesNotThrow(() => renderMemberInsight(null));
});

function usage(patch = {}) {
  return { status: 'ready', enabledAt: '2026-07-01T00:00:00.000Z',
    periods: { days: 30, previous: { from: '2026-08-15T06:20:00.000Z', to: '2026-09-14T06:20:00.000Z', observations: 2, activeDays: 2 },
      recent: { from: '2026-09-14T06:20:00.000Z', to: '2026-10-14T06:20:00.000Z', observations: 5, activeDays: 3 },
      sufficient: true, reason: '앱을 연 횟수만 비교해요.', delta: { observations: 3, activeDays: 1 } },
    interests: [{ id: 'world', label: 'WORLD', kind: 'opened', recentCount: 5, previousCount: 2, lastAt: '2026-10-13T04:10:00.000Z', detail: '이 계정으로 앱을 연 기록이에요.' }],
    activities: [], ...patch };
}

test('app use stays in its consent card: what was opened, since when, and that turning it off deletes it', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ activity: usage(), usageLine: 'WORLD를 3일 동안 5번 열었어요.' }) });
  const card = html.split('class="mi2-consent"')[1].split('</div></div>')[0];
  assert.match(card, /앱 이용 기록 켜짐/);assert.match(card, /WORLD를 3일 동안 5번 열었어요. 7월 1일부터 모았고, 끄면 모은 기록도 지워져요/);
  assert.match(card, /data-insight-action="disable-activity"/);
  assert.match(html, /앱을 연 날<\/th><td>2일<\/td><td><b>3일<\/b><\/td>/, 'opening days are compared without 「늘었어요」');
  assert.match(html, /메모나 고객 자료의 내용은 읽지 않아요/);
  assert.doesNotMatch(html, /관심 점수|성장률/);
});

test('disabled, loading, unavailable and failed app use never leak stale observations', async () => {
  const { renderMemberInsight } = await loaded;
  for (const status of ['disabled', 'loading', 'unavailable', 'error']) {
    const html = renderMemberInsight({ status: 'ready', report: report({ activity: usage({ status, interests: [{ id: 'path', kind: 'opened', label: 'private-stale-activity' }] }), usageLine: '' }) });
    assert.doesNotMatch(html, /private-stale-activity|앱을 연 날|앱 이용 기록 켜짐/);
    if (['disabled', 'loading'].includes(status)) assert.match(html, /data-insight-action="enable-activity"/);
    if (status === 'loading') assert.match(html, /data-insight-action="enable-activity" disabled/);
  }
  const busy = renderMemberInsight({ status: 'ready', activityPending: true, report: report({ activity: usage() }) });
  assert.match(busy, /data-insight-action="disable-activity" disabled/);assert.match(busy, /data-insight-target="world" disabled/);
});

function understanding(patch = {}) {
  const claim = (kind, reference, count, activeDays) => ({ version: 1, kind, source: 'learning', generation: 7, reference, value: kind === 'learning-topic' ? 'interested' : 'fits',
    from: '2026-09-14T06:20:00.000Z', to: '2026-10-14T06:20:00.000Z', count, total: 8, activeDays, lastAt: '2026-10-13T04:10:00.000Z' });
  return { status: 'ready', headline: '', paragraphs: [],
    facets: [
      { id: 'topics', title: '직접 고른 관심 주제', line: '', basis: 'self-declared', claim: null, available: true, topicKind: null, question: null,
        choices: [{ id: 'travel-food', label: '여행지 음식·주문' }, { id: 'ai-tools', label: 'AI 도구 활용' }], multiple: true, selected: ['travel-food'], review: null, override: { values: ['travel-food'], at: '2026-10-12T05:00:00.000Z' } },
      { id: 'practice-mode', title: '기록에 반복해서 나타난 학습 방식', line: '', basis: 'observed', claim: claim('practice-mode', 'listening', 6, 3), available: true, topicKind: null, question: '듣기로 하는 연습이 나와 맞나요?',
        choices: [{ id: 'listening', label: '듣기' }, { id: 'reading', label: '읽기' }], multiple: false, selected: [], review: null, override: null },
      { id: 'learning-topic:sit-cafe', title: '카페에서 주문하기', line: '', basis: 'observed', claim: claim('learning-topic', 'sit-cafe', 6, 3), available: true, topicKind: 'situation', topicWord: '상황', question: '더 배우고 싶은 상황인가요?',
        choices: [{ id: 'interested', label: '관심 있는 내용이에요' }, { id: 'practice-only', label: '연습에서 다룬 내용일 뿐이에요' }, { id: 'not-now', label: '지금 관심 있는 내용은 아니에요' }], multiple: false, selected: [], review: null, override: null },
      { id: 'learning-topic:word-juseyo', title: '주세요', line: '', basis: 'observed', claim: claim('learning-topic', 'word-juseyo', 2, 1), available: true, topicKind: 'word', topicWord: '표현', question: '더 연습하고 싶은 표현인가요?',
        choices: [{ id: 'interested', label: '관심 있는 내용이에요' }], multiple: false, selected: [], review: null, override: null },
    ],
    history: [{ kind: 'override', id: 'override-1', facetId: 'topics', title: '직접 고른 관심 주제', line: '관심 주제로 ‘여행지 음식·주문’을 골랐어요.', note: '여행 준비 중이에요.', at: '2026-10-12T05:00:00.000Z' }],
    statementHistory: [], relations: [], activities: [], limitations: [], ...patch };
}

test('a repeated pattern is asked in one tap, a one-day topic is only listed, and the claim never rides in the page', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }) });
  const seen = html.split('class="mi2-block mi2-seen-block"')[1].split('</section>')[0];
  assert.match(seen, /<h4>듣기 연습<\/h4><span class="mi2-count">3일 동안 6번<\/span>/);
  assert.match(seen, /<summary><span>듣기로 하는 연습이 나와 맞나요\?<\/span><span class="mi2-ask-btn">답하기<\/span><\/summary>/);
  assert.match(seen, /data-insight-action="understanding-answer" data-insight-facet="practice-mode" data-insight-verdict="agree" aria-label="듣기 연습: 맞아요">맞아요/);
  assert.match(seen, /data-insight-facet="learning-topic:sit-cafe" data-insight-value="not-now"[^>]*>지금은 아니에요/);
  assert.match(seen, /<h4 class="mi2-sub">해 본 것<\/h4>.*<span>주세요<\/span><span class="mi2-count">2번<\/span>/s);
  assert.doesNotMatch(seen, /data-insight-facet="learning-topic:word-juseyo"/, 'a one-day topic is not asked yet');
  assert.match(seen, /WORLD 연습 고르기에는 아직 쓰지 않아요/);
  assert.doesNotMatch(html, /data-insight-claim|type="hidden"|"version":1/);
  const reading = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding(), worldReadsAnswers: true }) });
  assert.match(reading, /맞는지 알려 주면 WORLD 연습 고르기에 써요/);
  const busy = renderMemberInsight({ status: 'ready', understandingPending: true, report: report({ understanding: understanding() }) });
  assert.match(busy, /data-insight-verdict="agree" disabled/);
});

test('an answered row shows the answer and its date, and changing it is one more tap', async () => {
  const { renderMemberInsight } = await loaded, value = understanding();
  value.facets[1].review = { verdict: 'contextual', at: '2026-10-13T01:00:00.000Z' };
  value.facets[2].override = { values: ['interested'], at: '2026-10-13T02:00:00.000Z' };
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
  assert.match(html, /<details class="mi2-ask is-answered"><summary><span class="mi2-answer">내 답 · 때에 따라 달라요<\/span><span class="mi2-date"><time datetime="2026-10-13T01:00:00.000Z">10월 13일<\/time><\/span><span class="mi2-ask-btn">바꾸기/);
  assert.match(html, /내 답 · 더 배우고 싶어요/);
  assert.match(html, /data-insight-value="interested" aria-pressed="true"/);assert.match(html, /data-insight-verdict="contextual" aria-pressed="true"/);
});

test('the topics editor uses the current choices with explicit save and cancel, and closes when the facet is gone', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }), understandingEditor: { facetId: 'topics', mode: 'override', values: ['ai-tools'], note: '' } });
  assert.match(html, /data-insight-editor data-insight-facet="topics"/);
  assert.match(html, /type="checkbox" name="insight-choice" value="ai-tools" checked/);assert.match(html, /type="checkbox" name="insight-choice" value="travel-food">/);
  assert.match(html, /다섯 개까지/);assert.match(html, /maxlength="400"/);
  assert.match(html, /data-insight-action="understanding-save"><span class="mi2-led" aria-hidden="true"><\/span>저장/);assert.match(html, /data-insight-action="understanding-cancel">취소/);
  assert.doesNotMatch(html, /type="hidden"|data-insight-claim/);
  const busy = renderMemberInsight({ status: 'ready', understandingPending: true, report: report({ understanding: understanding() }), understandingEditor: { facetId: 'topics', mode: 'override', values: [], note: '' } });
  assert.match(busy, /understanding-save" disabled/);assert.match(busy, /understanding-cancel" disabled/);assert.match(busy, /understanding-remove"[^>]* disabled/);
});

test('saved corrections stay listed with their notes, each removable, and all can be cleared', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }), understandingMessage: '확인·수정한 내용을 저장했어요.' });
  assert.match(html, /<details class="mi2-fold mi2-history"><summary>내가 고친 내역 1건<\/summary>/);
  assert.match(html, /<h4>관심 주제<\/h4><p>관심 주제로 ‘여행지 음식·주문’을 골랐어요.<\/p><p class="mi-history-note">덧붙인 말: 여행 준비 중이에요.<\/p>/);
  assert.match(html, /data-insight-action="understanding-remove" data-insight-kind="override" data-insight-id="override-1" data-insight-facet="topics">되돌리기/);
  assert.match(html, /data-insight-action="understanding-clear">모두 지우기/);
  assert.match(html, /되돌리면 이 화면 설명에 더는 쓰지 않아요. 원래 연습 기록은 그대로 남아요/);
  assert.match(html, /내가 고름 · <time datetime="2026-10-12T05:00:00.000Z">10월 12일<\/time> · <button[^>]*data-insight-action="understanding-remove"/, 'the chosen row can be undone where it is shown');
  assert.match(html, /role="status" aria-live="polite">확인·수정한 내용을 저장했어요/);
});

test('understanding not ready never renders stale answers, history or edit forms', async () => {
  const { renderMemberInsight } = await loaded;
  for (const status of ['loading', 'error', 'unavailable']) {
    const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding({ status }) }), understandingEditor: { facetId: 'topics', mode: 'override', values: [] } });
    assert.doesNotMatch(html, /여행 준비 중|understanding-answer|understanding-remove|understanding-save|data-insight-editor|understanding-describe/);
    assert.match(html, /짧은 지시 듣기/, 'practice from the summary still shows');
  }
});

test('notes, draft text and notices cannot inject markup', async () => {
  const { renderMemberInsight } = await loaded, attack = '</textarea><img src=x onerror="bad()">', value = understanding();
  value.facets[0].choices[0].label = attack;value.history[0].line = attack;value.history[0].note = attack;value.facets[1].question = attack;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }), understandingMessage: attack, settingsMessage: attack,
    understandingEditor: { facetId: 'topics', mode: 'override', values: ['travel-food'], note: attack } });
  assert.doesNotMatch(html, /<img| onerror="/);assert.match(html, /&lt;\/textarea&gt;&lt;img/);
  assert.equal((html.match(/<textarea/g) || []).length, 1);assert.equal((html.match(/<\/textarea>/g) || []).length, 1);
});

test('an editor whose facet disappeared keeps only the unsaved words and cancellation', async () => {
  const { renderMemberInsight } = await loaded, value = understanding();
  const facet = { ...value.facets[0], id: 'topics' };
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding({ facets: [{ ...facet, available: false }] }) }),
    understandingEditor: { facetId: 'topics', mode: 'override', values: [], note: '<저장 전 입력>', facet } });
  const interrupted = html.split('mi-interrupted-editor')[1] || '';
  assert.match(interrupted, /지금 연결한 기록으로는 이 항목을 확인할 수 없어/);assert.match(interrupted, /readonly>&lt;저장 전 입력&gt;<\/textarea>/);
  assert.match(interrupted, /understanding-cancel/);assert.doesNotMatch(interrupted.split('</div></div>')[0], /understanding-save/);
  const failed = renderMemberInsight({ status: 'ready', report: report({ understanding: { status: 'error', facets: [], history: [] } }),
    understandingEditor: { facetId: 'topics', mode: 'override', values: ['ai-tools'], note: '다시 시도할 입력', facet: value.facets[0] } });
  assert.match(failed, /저장되지 않은 입력이에요/);assert.match(failed, /value="ai-tools" checked/);assert.match(failed, /다시 시도할 입력/);
});

test('declared apps link only to fixed targets, unknown destinations never become launch buttons', async () => {
  const { renderMemberInsight } = await loaded, value = understanding();
  value.activities = [{ targetId: 'pulse', basis: 'self-declared', reason: '고른 관심 주제 ‘영상 제작’과 이어지는 앱이에요.' }, { targetId: 'https://private.invalid', basis: 'self-declared', reason: 'not rendered' }];
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
  assert.match(html, /고른 관심 주제 ‘영상 제작’과 이어지는 앱이에요/);assert.match(html, /data-insight-target="pulse">PULSE 열기/);
  assert.doesNotMatch(html, /private.invalid|not rendered/);
});

function statementPreview(text = '혼자 하는 게 좋아요. 처음에는 예시가 필요해요. 아마 음악을 좋아할 거예요.') {
  return { version: 1, text, proposals: [
    { id: 'p0', field: 'support', value: 'independent', polarity: 'prefer', condition: null, summary: '혼자 시도하기를 원해요.', status: 'pending', confirmable: true, evidence: { quote: '혼자 하는 게 좋아요.' }, reasonLabel: '' },
    { id: 'p1', field: 'support', value: 'example', polarity: 'prefer', condition: 'first-try', summary: '처음 시도할 때 예시를 원해요.', status: 'pending', confirmable: true, evidence: { quote: '처음에는 예시가 필요해요.' }, reasonLabel: '' },
  ], unresolved: [{ quote: '아마 음악을 좋아할 거예요.', reason: 'uncertain', reasonLabel: '추측으로 쓴 내용은 확정하지 않아요.' }], question: null };
}

test('「내 말로 알려 주기」 has one entrance and opens an explicit preview before anything is saved', async () => {
  const { renderMemberInsight } = await loaded, value = report({ understanding: understanding() });
  const closed = renderMemberInsight({ status: 'ready', report: value });
  assert.equal((closed.match(/data-insight-action="understanding-describe"/g) || []).length, 1, 'one entrance');
  const html = renderMemberInsight({ status: 'ready', report: value, understandingStatementEditor: { text: '', stage: 'writing', preview: null, acceptedIds: [] } });
  assert.match(html, /data-insight-statement-editor/);assert.match(html, /data-insight-field="statement"/);
  assert.match(html, /understanding-preview" disabled/);assert.match(html, /맞다고 고른 뜻만 저장해요/);assert.match(html, /500자 이내/);
  assert.doesNotMatch(html, /understanding-confirm-statement|type="checkbox"|data-insight-action="understanding-describe"/);
});

test('the preview starts with nothing chosen and keeps conditions and unresolved words apart', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  const state = { status: 'ready', report: report({ understanding: understanding() }), understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: [] } };
  const html = renderMemberInsight(state);
  assert.match(html, /data-insight-proposal="p0" value="p0">/);assert.doesNotMatch(html.split('data-insight-statement-editor')[1], / checked/);
  assert.match(html, /understanding-confirm-statement" disabled><span class="mi2-led" aria-hidden="true"><\/span>고른 뜻 0개 저장/);
  assert.match(html, /처음 시도할 때에만/);assert.match(html, /원하는 것 · 언제나/);
  assert.match(html, /아직 쓰지 않는 부분/);assert.match(html, /추측으로 쓴 내용은 확정하지 않아요/);assert.doesNotMatch(html, />uncertain</);
  const selected = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, acceptedIds: ['p1', 'unknown'] } });
  assert.match(selected, /value="p1" checked/);assert.match(selected, /고른 뜻 1개 저장/);
  const edited = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, text: '짧은 설명이 좋아요.' } });
  assert.doesNotMatch(edited, /insight-proposal|understanding-confirm-statement|아마 음악/);assert.match(edited, /짧은 설명이 좋아요/);
});

test('avoided and conflicting meanings are shown, never resolved, and a question waits before confirming', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  preview.proposals[0] = { ...preview.proposals[0], polarity: 'avoid', status: 'conflict', reasonLabel: '함께 적용하기 어려워요. 맞는 뜻만 골라 주세요.' };
  preview.proposals.push({ ...preview.proposals[0], id: 'bad-condition', condition: 'unknown' });
  preview.question = { id: 'scope.0', label: '언제 원하는 방식인가요?', options: [{ id: 'first-try', label: '처음 배울 때' }, { id: 'skip', label: '아직 모르겠어요 · 건너뛰기' }] };
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }),
    understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: ['p0'], clarifications: [] } });
  assert.match(html, /원하지 않는 것/);assert.match(html, /함께 적용하기 어려워요/);assert.doesNotMatch(html, /bad-condition/);
  assert.match(html, /data-insight-question-title>언제 원하는 방식인가요/);
  assert.match(html, /<button type="button" class="mi2-ghost" data-insight-action="understanding-answer-statement" data-insight-question="scope\.0" data-insight-option="first-try">처음 배울 때/);
  assert.match(html, /답만으로는 저장되지 않아요/);assert.match(html, /understanding-confirm-statement" disabled/);assert.match(html, /value="p0" checked disabled/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('clarification history stays with the draft and offers a restart without saving an answer', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  const clarifications = [{ questionId: 'scope.0', optionId: 'first-try' }];
  preview.clarifications = clarifications;
  preview.clarificationAnswers = [{ ...clarifications[0], questionLabel: '언제 원하는 방식인가요?', optionLabel: '처음 배울 때' }];
  preview.proposals[0].condition = 'first-try-after-example';
  const state = { status: 'ready', report: report({ understanding: understanding() }), understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: [], clarifications } };
  const html = renderMemberInsight(state);
  assert.match(html, /답으로 뜻을 보완했어요/);assert.match(html, /뜻을 보완한 답 1개/);assert.match(html, /<strong>처음 배울 때<\/strong>/);
  assert.match(html, /understanding-reset-answers">답 다시 고르기/);assert.match(html, /처음 시도하며 예시를 본 다음/);assert.match(html, /그 근거가 된 내 말·답을 저장/);
  const stale = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, clarifications: [] } });
  assert.match(stale, /data-insight-field="statement"/);assert.doesNotMatch(stale, /insight-proposal|understanding-reset-answers/);
  assert.match(renderMemberInsight({ ...state, understandingPending: true }), /understanding-reset-answers" disabled/);
});

test('saved statements show as 「내 말」 with their own undo, and their text stays literal', async () => {
  const { renderMemberInsight } = await loaded, attack = '</textarea><img src=x onerror="bad()">';
  const value = understanding({ statementHistory: [{ id: 'statement-1', text: '처음엔 예시부터 보고 싶어요.', active: true, at: '2026-10-14T05:00:00.000Z',
    meanings: [{ id: 'p0', line: '예시를 먼저 보기', condition: 'first-try', quote: '처음엔 예시부터 보고 싶어요.', active: true, field: 'support', value: 'example', polarity: 'prefer' }], clarificationAnswers: [] }] });
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
  assert.match(html, /<dt>내 말<\/dt><dd><span class="mi2-value">「처음엔 예시부터 보고 싶어요.」<\/span><span class="mi2-edited">내가 알려 줌 · <time datetime="2026-10-14T05:00:00.000Z">10월 14일<\/time> · <button[^>]*data-insight-action="understanding-remove-statement" data-insight-id="statement-1">되돌리기/);
  assert.match(html, /내가 고친 내역 2건/);
  const unsafe = understanding({ statementHistory: [{ id: 's1', text: attack, active: true, at: '2026-10-14T05:00:00.000Z', meanings: [] }] });
  assert.doesNotMatch(renderMemberInsight({ status: 'ready', report: report({ understanding: unsafe }) }), /<img| onerror="/);
});

test('dates use one shared formatter in Korea\'s calendar, and invalid dates are left out', async () => {
  const original = Intl.DateTimeFormat;let constructors = 0;
  Intl.DateTimeFormat = new Proxy(original, { construct(Target, args, newTarget) { constructors++;return Reflect.construct(Target, args, newTarget); } });
  try {
    const { renderMemberInsight } = await import('../renderer/member-insight-view.mjs?formatter-regression');
    const value = understanding({ history: Array.from({ length: 100 }, (_, i) => ({ kind: 'review', id: 'date-' + i, facetId: 'practice-mode', title: '합성 날짜', line: '맞다고 답했어요.', note: '', at: i === 99 ? 'invalid' : '2026-10-14T15:30:00.000Z' })) });
    for (let i = 0; i < 3; i++) {
      const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
      assert.match(html, /<time datetime="2026-10-14T15:30:00.000Z">10월 15일<\/time>/, 'Korea\'s date, not UTC');
      assert.doesNotMatch(html, /Invalid Date|datetime="invalid"/);
    }
    assert.equal(constructors, 1);
  } finally { Intl.DateTimeFormat = original; }
});
