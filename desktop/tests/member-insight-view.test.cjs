'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const loaded = import('../renderer/member-insight-view.mjs');
const report = (patch = {}) => ({
  asOf: '2026-10-14T06:20:00.000Z', lastAt: '2026-10-13T04:10:00.000Z', shared: 'practice-and-settings',
  headline: '여행에서 한국어를 써 보고 싶어요.', description: '직접 알려준 목표와 최근 연습을 정리했어요.',
  personal: [{ id: 'goal', title: '배우는 이유', value: '여행', basis: 'self-declared', detail: '직접 선택한 목표예요.' }],
  learning: { answered: 8, independent: 5, assisted: 3, empty: false,
    skills: [{ id: 'listen', label: '짧은 지시 듣기', status: 'practice', line: '최근 독립 첫 응답 4개를 살펴봤어요.', recent: 4, correct: 3, assisted: 1 }],
    content: [{ id: 'review', label: '방향을 나타내는 말', status: 'review' }] },
  reasons: [{ label: '내가 알려준 정보', line: 'Atlas에 연결한 목표를 사용했어요.' }],
  limits: ['연결되지 않은 활동은 포함되지 않아요.'], ...patch,
});

test('ready view shows both requested areas and does not turn independent answers into a score', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report() });
  assert.match(html, /나의 관심사·선호/);
  assert.match(html, /학습 성향·성장/);
  assert.match(html, /직접 알려준 정보/);
  assert.match(html, /혼자 응답한 기록에는 맞힌 답과 틀린 답/);
  assert.match(html, /같은 문항에 다시 응답한 기록도 셀 수 있어요/);
  assert.match(html, /<dt>응답 기록<\/dt><dd>8<span>회<\/span>/);
  assert.match(html, /<dt>혼자 응답<\/dt><dd>5<span>회<\/span>/);
  assert.match(html, /<dt>도움 받고 응답<\/dt><dd>3<span>회<\/span>/);
  assert.doesNotMatch(html, /응답한 문항|<span>개<\/span>/);
  assert.match(html, /최근 독립 첫 응답 4개/);
  assert.match(html, />연습 중</);
  assert.doesNotMatch(html, />practice<|>review</);
  assert.doesNotMatch(html, /75%|정답률|성장률|실력이 향상/);
  assert.match(html, /<details class="mi-evidence">/);
  assert.match(html, /요약 확인.*2026년 10월 14일 오후 3:20/);
  assert.match(html, /href="#benefits"/);
  assert.match(html, /data-insight-action="account">내 정보·연결 설정 확인/);
});

test('declared-only consent hides practice and observed preferences even if a stale report still contains them', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ shared: 'declared-only', personal: [
    { title: '배우는 이유', value: '여행', basis: 'self-declared' },
    { title: '관찰한 취향', value: '숨겨야 할 관찰', basis: 'observed' },
  ] }) });
  assert.match(html, /직접 알려준 배우는 이유만 보여요/);
  assert.match(html, />여행</);
  assert.match(html, /data-insight-action="account"/);
  assert.doesNotMatch(html, /숨겨야 할 관찰|최근 독립 첫 응답|방향을 나타내는 말|mi-counters/);
});

test('empty report states what is missing in each area without inventing a type or practice', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ personal: [], learning: { empty: true, skills: [], content: [] } }) });
  assert.match(html, /아직 나를 소개할 정보가 없어요/);
  assert.match(html, /첫 연습 기록을 기다리고 있어요/);
  assert.doesNotMatch(html, /mi-counters|data-insight-action="download"|data-insight-action="share"/);
});

test('preferences keep compact labels and values while repeated basis appears only once inside evidence', async () => {
  const { renderMemberInsight } = await loaded;
  const detail = '직접 고른 이용 설정이에요. 능력을 판단한 결과는 아니에요.';
  const html = renderMemberInsight({ status: 'ready', report: report({ personal: [
    { id: 'reasons', title: '관심과 목표', value: '여행', basis: 'self-declared', detail: '여행을 위해 배우고 싶어요.' },
    { id: 'support', title: '도움 방식', value: '단계별로', basis: 'self-declared', detail },
    { id: 'textSize', title: '글씨 크기', value: '큰 글씨', basis: 'self-declared', detail },
  ] }) });
  const [visible, evidence] = html.split('<details class="mi-evidence">');
  assert.match(visible, /mi-personal-list.*여행.*여행을 위해 배우고 싶어요/s);
  assert.match(visible, /mi-preference-list.*도움 방식.*단계별로.*글씨 크기.*큰 글씨/s);
  assert.ok(!visible.includes(detail));
  assert.match(evidence, /선택 정보의 근거/);
  assert.equal(evidence.split(detail).length - 1, 1);
  assert.match(evidence, /도움 방식 · 글씨 크기/);
  const unsafeDetail = renderMemberInsight({ status: 'ready', report: report({ personal: [
    { id: 'support', title: '도움 방식', value: '단계별로', basis: 'self-declared', detail: '<img src=x onerror="bad()">' },
  ] }) });
  assert.doesNotMatch(unsafeDetail, /<img/);
  assert.match(unsafeDetail, /<details[^>]*>.*&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/s);
});

test('all remote display strings are escaped and arbitrary data cannot create attributes or tags', async () => {
  const { renderMemberInsight } = await loaded;
  const attack = '<img src=x onerror="alert(1)"><script>bad()</script>&\'"';
  const html = renderMemberInsight({ status: 'ready', report: report({
    headline: attack, description: attack, asOf: attack, lastAt: attack,
    personal: [{ id: attack, title: attack, value: attack, detail: attack, basis: attack, at: attack }],
    learning: { answered: attack, independent: attack, assisted: attack, empty: false,
      skills: [{ id: attack, label: attack, line: attack, status: attack, lastAt: attack }],
      content: [{ id: attack, label: attack, status: attack }] },
    reasons: [{ label: attack, line: attack }], limits: [attack],
  }) });
  assert.doesNotMatch(html, /<img|<script| onerror="|datetime="<|NaN|Invalid Date/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&amp;&#39;&quot;/);
  assert.equal((html.match(/id="benefit-title"/g) || []).length, 1);
});

test('loading, account, and error states discard any stale report and expose the relevant action', async () => {
  const { renderMemberInsight } = await loaded;
  for (const [status, action] of [['loading', null], ['signed-out', 'account'], ['unconfigured', 'account'], ['error', 'refresh']]) {
    const html = renderMemberInsight({ status, report: report(), message: '<b>오류</b>' }, { native: true });
    assert.doesNotMatch(html, /여행에서 한국어|짧은 지시 듣기/);
    assert.match(html, /data-view="benefits"/);
    assert.match(html, /id="benefit-title" tabindex="-1"/);
    if (action) assert.ok(html.includes(`data-insight-action="${action}"`));
    else { assert.match(html, /aria-busy="true"/); assert.match(html, /role="status"/); }
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
    interests: [{ id: 'path', label: 'PATH', kind: 'favorite', recentCount: 0, previousCount: 0, lastAt: null, detail: '직접 즐겨찾기로 골랐어요.' },
      { id: 'world', label: 'WORLD', kind: 'opened', recentCount: 5, previousCount: 2, lastAt: '2026-10-13T04:10:00.000Z', detail: '이 계정으로 앱을 연 기록이에요.' }],
    activities: [{ id: 'open-path', targetId: 'path', label: 'PATH 열기', reason: '즐겨찾기로 고른 앱에서 이어서 살펴봐요.', basis: 'self-declared' }], ...patch };
}

test('app observations stay separate from self-declarations, with actual periods and an allowed activity action', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ activity: usage() }) });
  assert.match(html, /직접 고른 즐겨찾기/);assert.match(html, /실제 앱 열기에서 관찰/);
  assert.match(html, /앱 열기 관측 · 이전 30일 2회 · 최근 30일 5회/);
  assert.match(html, /3회 더 많음/);assert.match(html, /1일 더 많음/);
  assert.match(html, /datetime="2026-08-15T06:20:00.000Z"/);
  assert.match(html, /시작 이후/);assert.match(html, /끝 시각까지/);
  assert.match(html, /data-insight-action="activity" data-insight-target="path"/);
  assert.match(html, /즐겨찾기로 고른 앱에서 이어서 살펴봐요/);
  assert.match(html, /메모 본문이나 고객 자료의 내용은 읽지 않아요/);
  assert.match(html, /끄면 지금까지 모은 앱 이용 관찰 기록도 지워져요/);
  assert.match(html, /data-insight-action="disable-activity"/);
  assert.doesNotMatch(html, /%|성장률|관심 점수/);
});

test('learning opt-out does not hide independently authorized app observations', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ shared: 'declared-only', activity: usage(),
    learning: { empty: false, answered: 999, skills: [{ label: 'private-learning' }], periods: { reason: 'private-periods' } } }) });
  assert.match(html, /실제 앱 열기에서 관찰/);assert.match(html, /기간별 앱 이용 기록/);
  assert.match(html, /학습 정보는 직접 알려준 배우는 이유만 보여요. 앱 이용 기록은 별도로 연결할 수 있어요/);
  assert.doesNotMatch(html, /private-learning|private-periods|999|기간별 연습 기록/);
});

test('insufficient periods show observed amounts and reason without a fabricated delta', async () => {
  const { renderMemberInsight } = await loaded, activity = usage();
  activity.periods.sufficient = false;activity.periods.reason = '이전 기간 전체를 수집하지 못했어요.';
  const html = renderMemberInsight({ status: 'ready', report: report({ activity }) });
  assert.match(html, /이전 기간 전체를 수집하지 못했어요/);assert.match(html, /비교 보류/);
  assert.doesNotMatch(html, /3회 더 많음|1일 더 많음/);
  assert.match(html, /아직 비교하기 어려워요/);
});

test('disabled, loading, unavailable and failed activity states do not leak stale observations', async () => {
  const { renderMemberInsight } = await loaded;
  for (const status of ['disabled', 'loading', 'unavailable', 'error']) {
    const html = renderMemberInsight({ status: 'ready', report: report({ activity: usage({ status, interests: [{ id: 'path', kind: 'opened', label: 'private-stale-activity' }] }) }) });
    assert.doesNotMatch(html, /private-stale-activity|기간별 앱 이용 기록|data-insight-target="path"/);
    assert.match(html, /data-insight-action="enable-activity"/);
    if (status === 'loading') assert.match(html, /data-insight-action="enable-activity" disabled/);
  }
  const emptyHtml = renderMemberInsight({ status: 'ready', report: report({ activity: usage({ status: 'empty', interests: [], activities: [] }) }) });
  assert.match(emptyHtml, /아직 앱 이용에서 확인할 관심 정보가 없어요/);
});

test('practice suggestions explain their reason and open WORLD selection without promising a question deep link', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report() });
  assert.match(html, /다시 살펴볼 내용으로 정리됐어요/);
  assert.match(html, /data-insight-action="activity" data-insight-target="world">WORLD에서 연습 고르기/);
  assert.doesNotMatch(html, /data-insight-content|문항 바로 시작/);
  const busy = renderMemberInsight({ status: 'ready', activityPending: true, report: report({ activity: usage() }) });
  assert.match(busy, /data-insight-action="disable-activity" disabled/);
  assert.match(busy, /data-insight-target="world" disabled/);
});

test('new activity display strings are escaped while unknown destinations never become launch buttons', async () => {
  const { renderMemberInsight } = await loaded, activity = usage(), attack = '<img src=x onerror="bad()">';
  activity.interests[0].label = attack;activity.interests[0].detail = attack;
  activity.periods.reason = attack;activity.activities[0].reason = attack;
  activity.activities.push({ targetId: 'https://private.invalid', basis: 'observed', reason: attack });
  const html = renderMemberInsight({ status: 'ready', report: report({ activity }) });
  assert.doesNotMatch(html, /<img| onerror="|private\.invalid/);
  assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
});

function understanding(patch = {}) {
  return { status: 'ready', headline: '내가 고른 관심과 반복해서 이용한 방식을 함께 살펴봐요.',
    paragraphs: ['여행지 음식·주문에 관심이 있다고 직접 알려줬어요.', '최근에는 WORLD를 여러 날 다시 열었어요.'],
    facets: [
      { id: 'topics', title: '직접 고른 관심 주제', line: '여행지 음식·주문', basis: 'self-declared', claim: null, evidenceLine: '직접 선택한 관심 주제예요.', available: true,
        choices: [{ id: 'travel-food', label: '여행지 음식·주문' }, { id: 'ai-tools', label: 'AI 도구 활용' }], multiple: true, selected: ['travel-food'], review: null, override: null },
      { id: 'usage-repeat', title: '여러 날 다시 연 앱', line: 'WORLD를 여러 날 다시 열었어요.', basis: 'observed', claim: { version: 1 }, evidenceLine: '최근 30일 동안 3일에 걸쳐 5회 열었어요.', available: true,
        choices: [{ id: 'world', label: 'WORLD' }, { id: 'no-fixed-app', label: '특정 앱으로 정해 두지 않음' }], multiple: false, selected: [], review: { verdict: 'contextual', at: '2026-10-14T05:00:00.000Z' }, override: null },
      { id: 'practice-mode', title: '반복한 학습 방식', line: '기록이 아직 부족해요.', basis: 'empty', claim: null, evidenceLine: '충분한 연습 기록이 쌓이면 살펴봐요.', available: true,
        choices: [{ id: 'listening', label: '듣기' }], multiple: false, selected: [], review: null, override: null },
    ], history: [{ kind: 'review', id: 'review-1', facetId: 'usage-repeat', title: '여러 날 다시 연 앱', line: '상황마다 달라요라고 확인했어요.', note: '과제를 할 때 열어요.', at: '2026-10-14T05:00:00.000Z' }],
    limitations: ['활동 횟수가 곧 관심의 강도는 아니에요.'], ...patch };
}

test('understanding keeps two areas, shows claim evidence and offers three explicit review paths', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }) });
  assert.match(html, /최근 기록을 이렇게 읽었어요/);assert.match(html, /여행지 음식·주문에 관심이 있다고 직접 알려줬어요/);
  assert.match(html, /data-insight-action="understanding-review" data-insight-facet="usage-repeat" data-insight-verdict="agree"/);
  assert.match(html, /data-insight-verdict="disagree"/);assert.match(html, /data-insight-verdict="contextual"/);
  assert.match(html, /이 설명의 근거 보기/);assert.match(html, /최근 30일 동안 3일에 걸쳐 5회/);
  assert.doesNotMatch(html, /data-insight-action="understanding-review" data-insight-facet="topics"/);
  assert.doesNotMatch(html, /data-insight-action="understanding-review" data-insight-facet="practice-mode"/);
  assert.match(html, /data-insight-action="understanding-edit" data-insight-facet="practice-mode"/);
  assert.equal((html.match(/class="mi-section"/g) || []).length, 2);
  assert.ok(html.indexOf('data-insight-facet-row="topics"') < html.indexOf('id="insight-learning-title"'));
  assert.ok(html.indexOf('data-insight-facet-row="practice-mode"') > html.indexOf('id="insight-learning-title"'));
  assert.doesNotMatch(html, /data-insight-editor|type="checkbox"/);
});

test('a review opens a bounded draft with explicit save and cancel rather than automatic storage', async () => {
  const { renderMemberInsight } = await loaded;
  const state = { status: 'ready', report: report({ understanding: understanding() }),
    understandingEditor: { facetId: 'usage-repeat', mode: 'review', verdict: 'disagree', note: '관심이 아니라 필요한 업무예요.' } };
  const html = renderMemberInsight(state);
  assert.match(html, /data-insight-editor data-insight-facet="usage-repeat"/);
  assert.match(html, /관찰한 기록은 유지하고/);assert.match(html, /다음 설명에 반영하도록 저장해요/);
  assert.match(html, /덧붙인 말은 직접 남긴 설명으로 표시하며, 의미를 추측하지 않아요/);
  assert.match(html, /maxlength="400"/);assert.match(html, /관심이 아니라 필요한 업무예요/);
  assert.match(html, /data-insight-action="understanding-save">이 내용으로 반영/);
  assert.match(html, /data-insight-action="understanding-cancel">취소/);
  assert.equal((html.match(/mi-button-primary/g) || []).length, 1);
  const busy = renderMemberInsight({ ...state, understandingPending: true });
  assert.match(busy, /data-insight-action="understanding-save" disabled/);
  assert.match(busy, /data-insight-action="understanding-cancel" disabled/);
  assert.match(busy, /data-insight-action="understanding-remove"[^>]* disabled/);
});

test('direct edits use current choices and draft values, with no hidden claims or arbitrary targets', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }),
    understandingEditor: { facetId: 'topics', mode: 'override', values: ['ai-tools'], note: '' } });
  assert.match(html, /type="checkbox" name="insight-choice" value="ai-tools" checked/);
  assert.match(html, /type="checkbox" name="insight-choice" value="travel-food">/);
  assert.match(html, /관심 주제를 최대 5개/);
  assert.doesNotMatch(html, /type="hidden"|data-insight-claim|data-insight-target="topics"/);
  const unavailable = understanding();unavailable.facets[1].available = false;
  const closed = renderMemberInsight({ status: 'ready', report: report({ understanding: unavailable }), understandingEditor: { facetId: 'usage-repeat', mode: 'review', verdict: 'agree' } });
  assert.doesNotMatch(closed, /data-insight-editor|data-insight-action="understanding-review" data-insight-facet="usage-repeat"/);
});

test('saved feedback remains discoverable and removable after leaving its editor', async () => {
  const { renderMemberInsight } = await loaded;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }), understandingMessage: '수정한 내용을 저장하고 새 설명에 반영했어요.' });
  assert.match(html, /<details class="mi-understanding-history"><summary>내가 확인·수정한 내용/);
  assert.match(html, /내가 덧붙인 말: 과제를 할 때 열어요/);
  assert.match(html, /data-insight-action="understanding-remove" data-insight-kind="review" data-insight-id="review-1" data-insight-facet="usage-repeat"/);
  assert.match(html, /실제 이용 기록은 그대로 남아요/);
  assert.match(html, /role="status" aria-live="polite">수정한 내용을 저장하고/);
  assert.doesNotMatch(html, /data-insight-editor/);
});

test('understanding unavailable states never render stale paragraphs, history, or active edit forms', async () => {
  const { renderMemberInsight } = await loaded;
  for (const status of ['loading', 'error', 'unavailable']) {
    const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding({ status }) }), understandingEditor: { facetId: 'topics', mode: 'override', values: [] } });
    assert.doesNotMatch(html, /여행지 음식·주문에 관심|과제를 할 때|understanding-save|understanding-remove|data-insight-editor/);
    assert.match(html, /학습 성향·성장/);assert.match(html, /짧은 지시 듣기/);
  }
});

test('understanding explanations, user notes, draft text and notices cannot inject markup', async () => {
  const { renderMemberInsight } = await loaded, attack = '</textarea><img src=x onerror="bad()">', value = understanding();
  value.headline = attack;value.paragraphs = [attack];value.facets[0].title = attack;value.facets[0].line = attack;value.facets[0].evidenceLine = attack;
  value.facets[0].choices[0].label = attack;value.history[0].title = attack;value.history[0].line = attack;value.history[0].note = attack;
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }), understandingMessage: attack,
    understandingEditor: { facetId: 'topics', mode: 'override', values: ['travel-food'], note: attack } });
  assert.doesNotMatch(html, /<img| onerror="/);assert.match(html, /&lt;\/textarea&gt;&lt;img/);
  assert.equal((html.match(/<textarea/g) || []).length, 1);assert.equal((html.match(/<\/textarea>/g) || []).length, 1);
});

test('failed feedback refresh keeps only the unsaved editor snapshot available for retry or cancel', async () => {
  const { renderMemberInsight } = await loaded, value = understanding();
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: { status: 'error', facets: [], history: [] } }),
    understandingMessage: '저장하지 못했어요.', understandingEditor: { facetId: 'topics', mode: 'override', values: ['ai-tools'], note: '다시 시도할 입력', facet: value.facets[0] } });
  assert.match(html, /mi-interrupted-editor/);assert.match(html, /저장되지 않은 입력이에요/);
  assert.match(html, /value="ai-tools" checked/);assert.match(html, /다시 시도할 입력/);
  assert.match(html, /understanding-save/);assert.match(html, /understanding-cancel/);
  assert.doesNotMatch(html, /mi-understanding-history|mi-understanding-facets|여행지 음식·주문에 관심/);
});

test('explicit interests provide reasoned fixed-target activities while unsafe destinations are ignored', async () => {
  const { renderMemberInsight } = await loaded, value = understanding();
  value.activities = [{ targetId: 'pulse', basis: 'self-declared', reason: '영상 제작을 직접 골라 PULSE에서 이어서 살펴봐요.' }, { targetId: 'https://private.invalid', basis: 'self-declared', reason: 'not rendered' }];
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value, activity: usage() }) });
  assert.match(html, /mi-understanding-next/);assert.match(html, /영상 제작을 직접 골라/);
  assert.match(html, /data-insight-target="pulse">PULSE 열기/);assert.doesNotMatch(html, /private.invalid|not rendered/);
  assert.doesNotMatch(html, /즐겨찾기로 고른 앱에서 이어서 살펴봐요/);
});

test('a refreshed missing or disconnected facet preserves only unsaved words and cancellation', async () => {
  const { renderMemberInsight } = await loaded;
  const facet = { ...understanding().facets[1], id: 'learning-topic:sit-travel-order', title: '이전 관찰 제목', line: '이전 관찰 해석', choices: [{ id: 'interested', label: '이전 선택지' }] };
  for (const facets of [[], [{ ...facet, available: false, claim: null }]]) {
    const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding({ facets, history: [] }) }),
      understandingEditor: { facetId: facet.id, mode: 'review', verdict: 'agree', values: [], note: '<저장 전 입력>', facet } });
    const interrupted = html.split('<div class="mi-interrupted-editor">')[1]?.split('<section class="mi-section"')[0] || '';
    assert.match(interrupted, /현재 연결한 기록으로 이 항목을 확인할 수 없어/);
    assert.match(interrupted, /readonly>&lt;저장 전 입력&gt;<\/textarea>/);
    assert.match(interrupted, /understanding-cancel/);
    assert.doesNotMatch(interrupted, /understanding-save|data-insight-editor|이전 관찰 제목|이전 관찰 해석|이전 선택지/);
  }
});

function statementPreview(text = '혼자 하는 게 좋아요. 처음에는 예시가 필요해요. 아마 음악을 좋아할 거예요.') {
  return { version: 1, text, proposals: [
    { id: 'p0', field: 'support', value: 'independent', polarity: 'prefer', condition: null, summary: '혼자 시도하기를 원해요.', status: 'pending', confirmable: true, evidence: { quote: '혼자 하는 게 좋아요.' }, reasonLabel: '' },
    { id: 'p1', field: 'support', value: 'example', polarity: 'prefer', condition: 'first-try', summary: '처음 시도할 때 예시를 원해요.', status: 'pending', confirmable: true, evidence: { quote: '처음에는 예시가 필요해요.' }, reasonLabel: '' },
  ], unresolved: [{ quote: '아마 음악을 좋아할 거예요.', reason: 'uncertain', reasonLabel: '추측으로 쓴 내용은 확정하지 않아요.' }], question: null };
}

test('natural wording opens an explicit preview before any interpretation can be confirmed', async () => {
  const { renderMemberInsight } = await loaded, value = report({ understanding: understanding() });
  assert.match(renderMemberInsight({ status: 'ready', report: value }), /understanding-describe/);
  const html = renderMemberInsight({ status: 'ready', report: value, understandingStatementEditor: { text: '', stage: 'writing', preview: null, acceptedIds: [] } });
  assert.match(html, /data-insight-statement-editor/);assert.match(html, /data-insight-field="statement"/);
  assert.match(html, /understanding-preview" disabled/);assert.match(html, /직접 확인한 해석만 다음 설명에 반영/);
  assert.match(html, /500자 이내/);assert.match(html, /understanding-cancel/);
  assert.doesNotMatch(html, /understanding-confirm-statement|type="checkbox"|data-insight-editor data-/);
  assert.equal((html.match(/mi-button-primary/g) || []).length, 1);
});

test('preview starts with no selections and keeps conditions and unresolved language distinct', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  const state = { status: 'ready', report: report({ understanding: understanding() }), understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: [] } };
  const html = renderMemberInsight(state);
  assert.match(html, /data-insight-proposal="p0" value="p0">/);assert.doesNotMatch(html, / checked/);
  assert.match(html, /understanding-confirm-statement" disabled>선택한 해석 0개 반영/);
  assert.match(html, /처음 시도할 때에만/);assert.match(html, /별도 조건 없음/);
  assert.match(html, /아직 반영하지 않은 부분/);assert.match(html, /추측으로 쓴 내용은 확정하지 않아요/);assert.doesNotMatch(html, />uncertain</);
  assert.equal((html.match(/name="insight-proposal"/g) || []).length, 2);
  const selected = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, acceptedIds: ['p1', 'unknown'] } });
  assert.match(selected, /value="p1" checked/);assert.match(selected, /understanding-confirm-statement">선택한 해석 1개 반영/);
  const edited = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, text: '짧은 설명이 좋아요.' } });
  assert.doesNotMatch(edited, /insight-proposal|understanding-confirm-statement|아마 음악/);assert.match(edited, /짧은 설명이 좋아요/);
});

test('preview displays negative and conflicting meanings without automatically resolving them', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  preview.proposals[0] = { ...preview.proposals[0], polarity: 'avoid', status: 'conflict', reasonLabel: '함께 적용하기 어려워요. 맞는 뜻만 골라 주세요.' };
  preview.proposals.push({ ...preview.proposals[0], id: 'bad-condition', condition: 'unknown' });
  preview.question = { id: 'q0', label: '어떤 뜻이 맞나요?', options: [{ id: 'a', label: '원문을 고치거나 맞는 뜻만 고르기' }] };
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }), understandingPending: true,
    understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: ['p0'] } });
  assert.match(html, /선호하지 않음/);assert.match(html, /함께 적용하기 어려워요/);assert.match(html, /어떤 뜻이 맞나요/);
  assert.match(html, /value="p0" checked disabled/);assert.doesNotMatch(html, /bad-condition/);
  assert.match(html, /understanding-confirm-statement" disabled/);assert.match(html, /understanding-edit-text" disabled/);
});

test('clarification choices are explicit non-submit buttons and final confirmation waits for the answer', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  preview.clarifications = [];
  preview.question = { id: 'scope.0', label: '언제 원하는 방식인가요?', options: [{ id: 'first-try', label: '처음 배울 때' }, { id: 'skip', label: '아직 모르겠어요 · 건너뛰기' }] };
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: understanding() }),
    understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: ['p0'], clarifications: [] } });
  assert.match(html, /data-insight-question-title>언제 원하는 방식인가요/);
  assert.match(html, /<button type="button"[^>]*data-insight-action="understanding-answer-statement" data-insight-question="scope\.0" data-insight-option="first-try">처음 배울 때/);
  assert.match(html, /data-insight-option="skip">아직 모르겠어요 · 건너뛰기/);
  assert.match(html, /답변만으로 저장되지는 않아요/);
  assert.match(html, /understanding-confirm-statement" disabled/);
  assert.match(html, /value="p0" checked disabled/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('clarification history stays tied to the draft and offers a restart without persisting an answer', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview();
  const clarifications = [{ questionId: 'scope.0', optionId: 'first-try' }];
  preview.clarifications = clarifications;
  preview.clarificationAnswers = [{ ...clarifications[0], questionLabel: '언제 원하는 방식인가요?', optionLabel: '처음 배울 때' }];
  preview.proposals[0].condition = 'first-try-after-example';
  const state = { status: 'ready', report: report({ understanding: understanding() }),
    understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: [], clarifications } };
  const html = renderMemberInsight(state);
  assert.match(html, /답변으로 뜻을 보완했어요/); assert.match(html, /뜻을 보완한 답변 1개/);
  assert.match(html, /언제 원하는 방식인가요/); assert.match(html, /<strong>처음 배울 때<\/strong>/);
  assert.match(html, /understanding-reset-answers">답변 다시 고르기/);
  assert.match(html, /처음 시도하며 예시를 본 다음/);
  assert.match(html, /그 근거가 된 원문·답변을 저장/);
  const stale = renderMemberInsight({ ...state, understandingStatementEditor: { ...state.understandingStatementEditor, clarifications: [] } });
  assert.match(stale, /data-insight-field="statement"/); assert.doesNotMatch(stale, /insight-proposal|understanding-reset-answers/);
  const busy = renderMemberInsight({ ...state, understandingPending: true });
  assert.match(busy, /understanding-reset-answers" disabled/);
});

test('question identities and clarification text cannot inject markup or actions', async () => {
  const { renderMemberInsight } = await loaded, preview = statementPreview(), attack = '<img src=x onerror="bad()">';
  preview.question = { id: 'scope.0', label: attack, options: [{ id: 'ok', label: attack }, { id: attack, label: 'invalid option' }] };
  preview.clarificationAnswers = [{ questionLabel: attack, optionLabel: attack }];
  const state = { status: 'ready', report: report({ understanding: understanding() }),
    understandingStatementEditor: { text: preview.text, preview, stage: 'preview', acceptedIds: [] } };
  const html = renderMemberInsight(state);
  assert.doesNotMatch(html, /<img| onerror="|invalid option/); assert.match(html, /&lt;img/);
  preview.question.id = attack;
  assert.doesNotMatch(renderMemberInsight(state), /understanding-answer-statement/);
});

test('relations cite source categories and saved statements have individual reversible history', async () => {
  const { renderMemberInsight } = await loaded;
  const value = understanding({ relations: [{ id: 'r0', certainty: 'declared', line: '혼자 시도하되 처음에는 예시가 필요하다고 알려줬어요.', evidence: [{ kind: 'statement', ref: 'internal-not-a-link', label: '직접 확인한 두 가지 뜻' }] }],
    statementHistory: [{ id: 'statement-1', text: '혼자 하는 게 좋아요.', active: true, at: '2026-10-14T05:00:00.000Z', meanings: [{ id: 'p0', line: '혼자 시도하기', condition: null, quote: '혼자 하는 게 좋아요.', active: true }] }] });
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
  assert.match(html, /관심과 이용 방식을 함께 보면/);assert.match(html, /내가 확인한 서술/);assert.match(html, /이 설명을 연결한 근거/);
  assert.doesNotMatch(html, /internal-not-a-link/);
  assert.match(html, /내 원문과 해석 근거 보기/);assert.match(html, /understanding-remove-statement" data-insight-id="statement-1"/);
  for (const status of ['loading', 'error', 'unavailable']) {
    const unavailable = renderMemberInsight({ status: 'ready', report: report({ understanding: { ...value, status } }) });
    assert.doesNotMatch(unavailable, /혼자 시도하되|statement-1|understanding-describe/);
  }
});

test('natural source, proposal and history text remain literal escaped text', async () => {
  const { renderMemberInsight } = await loaded, attack = '</textarea><img src=x onerror="bad()">', preview = statementPreview(attack);
  preview.proposals[0].summary = attack;preview.proposals[0].evidence.quote = attack;preview.unresolved[0].reasonLabel = attack;
  const value = understanding({ relations: [{ line: attack, evidence: [{ kind: 'statement', label: attack }] }], statementHistory: [{ id: 's1', text: attack, at: '2026-10-14T05:00:00.000Z', active: true, meanings: [{ line: attack, quote: attack, active: true }] }] });
  for (const stage of ['writing', 'preview']) {
    const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }), understandingStatementEditor: { text: attack, preview, stage, acceptedIds: [] } });
    assert.doesNotMatch(html, /<img| onerror="/);assert.match(html, /&lt;\/textarea&gt;&lt;img/);
  }
});

test('a relation already in the synthesis appears only once with evidence beside that paragraph', async () => {
  const { renderMemberInsight } = await loaded, line = '평소 혼자 시도하고 처음에는 예시를 원한다고 확인했어요.';
  const value = understanding({ paragraphs: [line], relations: [{ id: 'r0', certainty: 'declared', line, evidence: [{ kind: 'statement', ref: 'private-ref', label: '처음에는 예시가 필요해요.' }] }] });
  const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
  assert.equal(html.split(line).length - 1, 1);assert.doesNotMatch(html, /class="mi-relations"|private-ref/);
  const summary = html.split('<div class="mi-summary">')[1].split('understanding-describe')[0];
  assert.match(summary, /mi-relation-evidence/);assert.match(summary, /이 설명을 연결한 근거/);assert.match(summary, /처음에는 예시가 필요해요/);
});

test('active self-declarations suppress the legacy empty-personal message while inactive or unread feedback does not', async () => {
  const { renderMemberInsight } = await loaded;
  const declared = { ...understanding().facets[0], id: 'support', title: '직접 고른 도움 방식', line: '직접 확인한 내용은 혼자 시도하기예요.' };
  const statement = { id: 's1', text: '처음에는 예시가 필요해요.', active: true, meanings: [{ id: 'p0', line: '예시를 먼저 보기', quote: '처음에는 예시가 필요해요', condition: 'first-try', active: true }] };
  for (const value of [understanding({ facets: [declared] }), understanding({ facets: [], statementHistory: [statement] })]) {
    const html = renderMemberInsight({ status: 'ready', report: report({ personal: [], understanding: value }) });
    assert.doesNotMatch(html, /아직 나를 소개할 정보가 없어요/);
  }
  for (const value of [understanding({ status: 'error', facets: [declared], statementHistory: [statement] }),
    understanding({ facets: [{ ...declared, available: false }], statementHistory: [{ ...statement, active: false }] })]) {
    const html = renderMemberInsight({ status: 'ready', report: report({ personal: [], understanding: value }) });
    assert.match(html, /아직 나를 소개할 정보가 없어요/);
  }
});

test('repeated history rendering shares one date formatter and retains Korean time and invalid-date behavior', async () => {
  const original = Intl.DateTimeFormat;let constructors = 0;
  Intl.DateTimeFormat = new Proxy(original, { construct(Target, args, newTarget) { constructors++;return Reflect.construct(Target, args, newTarget); } });
  try {
    const { renderMemberInsight } = await import('../renderer/member-insight-view.mjs?formatter-regression');
    const value = understanding({ history: Array.from({ length: 100 }, (_, i) => ({ kind: 'review', id: 'date-' + i, facetId: 'practice-mode', title: '합성 날짜', line: '기록 확인', note: '', at: i === 99 ? 'invalid' : '2026-10-14T05:00:00.000Z' })) });
    for (let i = 0; i < 3; i++) {
      const html = renderMemberInsight({ status: 'ready', report: report({ understanding: value }) });
      assert.match(html, /2026년 10월 14일 오후 2:00/);assert.doesNotMatch(html, /Invalid Date|datetime="invalid"/);
    }
    assert.equal(constructors, 1);
  } finally { Intl.DateTimeFormat = original; }
});
