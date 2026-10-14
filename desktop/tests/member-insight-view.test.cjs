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
