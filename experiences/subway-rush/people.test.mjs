import test from 'node:test';
import assert from 'node:assert/strict';
import { planDay, allPeopleLines, allMeetingItems, PEOPLE } from './people.mjs';
import { buildJourney } from './journeys.mjs';
import { SubwayRun } from './core.mjs';

const seeds = Array.from({ length: 300 }, (_, i) => i * 6271 + 5);

test('판마다 만남은 1~2번이고 역이 적은 판은 1번이다', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed }), { meetings } = planDay(j);
    const stops = j.decisions.filter((d) => d.kind === 'stop').length;
    assert.ok(meetings.length >= 1 && meetings.length <= 2, String(meetings.length));
    if (stops < 4) assert.equal(meetings.length, 1);
  }
});

test('두 열차의 칸은 서로 다르다', () => {
  for (const seed of seeds) { const { cars } = planDay(buildJourney({ seed })); assert.notEqual(cars[0], cars[1]); }
});

test('만남은 안내가 없는 자리에만 온다: 그대로 뒤 · 내릴 문 뒤 · 출구 뒤', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed });
    for (const m of planDay(j).meetings) {
      const d = j.decisions[m.after], when = PEOPLE[m.person].when;
      if (when === 'between') { assert.equal(d.kind, 'stop'); assert.equal(d.target, false); assert.equal(j.decisions[m.after + 1].kind, 'stop'); }
      if (when === 'door') { assert.equal(d.kind, 'stop'); assert.equal(d.target, true); }
      if (when === 'exit') assert.equal(d.kind, 'exit');
    }
  }
});

test('칸에 사는 사람만 그 열차에서 만난다', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed }), plan = planDay(j);
    for (const m of plan.meetings) { const home = PEOPLE[m.person].car; if (home) assert.equal(plan.cars[j.decisions[m.after].leg], home, m.person); }
  }
});

test('근거로 세는 만남은 직장인 · 여행객뿐이고, 직장인의 답은 방금 들은 다음 역이다', () => {
  let saw = 0;
  for (const seed of seeds) {
    const j = buildJourney({ seed });
    for (const m of planDay(j).meetings) {
      assert.equal(!!m.scene.item, ['worker', 'traveler'].includes(m.person), m.person);
      if (m.person === 'worker') {
        saw += 1;
        const next = j.decisions[m.after + 1].station;
        assert.equal(m.scene.lead.text, `다음 역은 ${next}입니다.`);
        const right = m.scene.replies.find((r) => r.right);
        assert.ok(right.text.startsWith(next), `${right.text} ≠ ${next}`);
        assert.equal(m.scene.replies.filter((r) => r.right).length, 1);
      }
      if (m.person === 'traveler') {
        const right = m.scene.replies.filter((r) => r.right);
        assert.equal(right.length, 1);
        assert.equal(right[0].id, m.scene.answer);
      }
    }
  }
  assert.ok(saw > 0, '직장인 만남이 한 번은 나와야 한다');
});

test('실제 판의 근거 만남은 모두 검수 원본에 있고 보기까지 같다', () => {
  const reviewed = new Map(allMeetingItems().map((m) => [m.item.id, m]));
  const sorted = (s) => s.replies.map((r) => r.text).sort().join('|');
  for (const level of ['basic', 'busy']) for (const seed of seeds) for (const m of planDay(buildJourney({ seed, level }), { seed }).meetings) {
    if (!m.scene.item) continue;
    const found = reviewed.get(m.scene.item.id);
    assert.ok(found, m.scene.item.id);
    assert.equal(sorted(m.scene), sorted(found), m.scene.item.id);
    assert.equal(m.scene.lead?.text, found.lead?.text, m.scene.item.id);
  }
});

test('대답 자리는 섞이고 만남은 시계에 닿지 않는다', () => {
  const firstIsRight = { yes: 0, total: 0 };
  for (const seed of seeds) {
    const j = buildJourney({ seed }), run = new SubwayRun(j), before = run.minutes;
    planDay(j); // 판을 짜도 시계는 그대로
    assert.equal(run.minutes, before);
    for (const m of planDay(j).meetings) if (m.scene.answer) { firstIsRight.total += 1; if (m.scene.replies[0].id === m.scene.answer) firstIsRight.yes += 1; }
  }
  const rate = firstIsRight.yes / firstIsRight.total;
  assert.ok(rate > 0.2 && rate < 0.47, rate.toFixed(2));
});

test('있는 사진만 쓴다', () => {
  const available = { cars: ['calm', 'rush'], people: ['fan', 'worker', 'traveler'] };
  for (const seed of seeds) {
    const plan = planDay(buildJourney({ seed }), { available });
    assert.ok(available.cars.includes(plan.cars[0]) && available.cars.includes(plan.cars[1]));
    for (const m of plan.meetings) assert.ok(available.people.includes(m.person));
  }
});

test('이미 만난 사람보다 처음 만나는 사람을 앞세운다', () => {
  let freshFirst = 0, total = 0;
  for (const seed of seeds) { const m = planDay(buildJourney({ seed }), { seen: ['traveler'] }).meetings; total += m.length; freshFirst += m.filter((x) => x.person !== 'traveler').length; }
  assert.ok(freshFirst / total > 0.8, `${freshFirst}/${total}`);
});

test('원고에 금지 소재가 없고, 읽는 글에 숫자 · 영문이 없다', () => {
  const banned = /전도|예수|잡상인|구걸|노숙|장애|싸움|술 취|취객/;
  for (const l of allPeopleLines()) {
    assert.ok(!banned.test(l.text), l.text);
    assert.ok(!/[0-9A-Za-z]/.test(l.say), `${l.voice}: ${l.say}`);
  }
});
