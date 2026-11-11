import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SubwayRun, clockText, START_MINUTES, SCHOOL_MINUTES, WRONG_MINUTES } from './core.mjs';
import { startLevel } from './level.mjs';
import { buildJourney, allLines, ROUTES } from './journeys.mjs';
import { LINES, STATIONS, transfersAt } from './lines.mjs';

const seeds = Array.from({ length: 400 }, (_, i) => i * 7919 + 13);

function play(journey, picker) {
  const run = new SubwayRun(journey);
  while (!run.finished) { run.hearingDone(); run.choose(picker(run.current, run)); }
  return run;
}

test('안내가 끝나기 전에는 고를 수 없고, 손짓 없이는 다음으로 가지 않는다', () => {
  const run = new SubwayRun(buildJourney({ seed: 5 }));
  const first = run.current;
  assert.equal(run.canChoose, false);
  assert.equal(run.choose(first.options[0].id), null);
  assert.equal(run.current, first);
  run.hearingDone();
  assert.equal(run.current, first, '듣기만 해서는 넘어가지 않는다');
  assert.ok(run.choose(first.answer));
  assert.notEqual(run.current, first);
});

test('생각 · 도움은 시계를 움직이지 않는다', () => {
  const run = new SubwayRun(buildJourney({ seed: 9 }));
  run.hearingDone(); run.help('replay'); run.help('text');
  assert.equal(run.minutes, START_MINUTES);
});

test('틀려도 늘 도착하고, 오답은 +3분, 끝까지 맞히면 9시 전에 닿는다', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed });
    const perfect = play(j, (d) => d.answer), wrong = play(j, (d) => d.options.find((o) => o.id !== d.answer).id);
    assert.equal(perfect.finished, true); assert.equal(wrong.finished, true);
    assert.ok(perfect.minutes <= SCHOOL_MINUTES, `끝까지 맞힌 판 ${clockText(perfect.minutes)}`);
    assert.ok(wrong.minutes >= perfect.minutes + j.decisions.length * WRONG_MINUTES);
  }
});

test('시작 난도: 주소 > 학생이 고른 난도 > 시험 목표 급, 없으면 첫 등굣길', () => {
  assert.equal(startLevel(), 'basic');
  assert.equal(startLevel({ grade: '2' }), 'basic');
  assert.equal(startLevel({ grade: '3' }), 'busy');
  assert.equal(startLevel({ saved: 'basic', grade: '4' }), 'basic', '고른 난도를 목표 급이 덮지 않는다');
  assert.equal(startLevel({ saved: 'busy' }), 'busy');
  assert.equal(startLevel({ forced: 'busy', saved: 'basic' }), 'busy');
  assert.equal(startLevel({ saved: '이상한 값', grade: 'x' }), 'basic');
});

test('소리가 끊긴 문항은 맞혔어도 「맞힌 안내」 수에 들지 않고, 도착과 시계는 그대로다', () => {
  const j = buildJourney({ seed: 21 }), counted = j.decisions.filter((d) => d.assessable);
  assert.ok(counted.length >= 2, '근거 결정이 둘 이상인 씨앗');
  const cut = counted[0];
  const run = new SubwayRun(j);
  while (!run.finished) { run.hearingDone(run.current !== cut); run.choose(run.current.answer); }
  const s = run.summary();
  assert.equal(s.total, counted.length - 1, '끊긴 문항은 분모에서 빠진다');
  assert.equal(s.right, counted.length - 1, '끊긴 문항은 분자에서도 빠진다');
  assert.equal(run.results.find((r) => r.id === cut.id).assessable, false);
  assert.equal(run.finished, true);
  const clean = play(j, (d) => d.answer);
  assert.equal(clean.summary().total, counted.length);
  assert.equal(run.minutes, clean.minutes, '듣기가 끊겨도 맞힌 구간의 시계는 같다');
});

test('소리가 끊긴 문항을 틀려도 분자 · 분모에 안 들고, 끊긴 뒤 다음 문항은 다시 센다', () => {
  const j = buildJourney({ seed: 21 }), counted = j.decisions.filter((d) => d.assessable);
  const run = new SubwayRun(j);
  while (!run.finished) { const d = run.current; run.hearingDone(d !== counted[0]); run.choose(d === counted[0] ? d.options.find((o) => o.id !== d.answer).id : d.answer); }
  const s = run.summary();
  assert.equal(s.total, counted.length - 1);
  assert.equal(s.right, counted.length - 1);
  assert.equal(s.wrongs.length, 1, '틀린 칸은 다시 들을 목록에 그대로 있다');
  assert.equal(run.results.find((r) => r.id === counted[1].id).assessable, true, '끊김은 그 문항에서 끝난다');
});

test('한 판의 결정은 5~7번이고 시청 표지 · 내릴 역이 든다', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed });
    assert.ok(j.decisions.length >= 5 && j.decisions.length <= 7, String(j.decisions.length));
    assert.equal(j.decisions.filter((d) => d.kind === 'fork').length, 1);
    assert.equal(j.decisions.filter((d) => d.kind === 'exit').length, 1);
    assert.equal(j.decisions.filter((d) => d.kind === 'stop' && d.target).length, 2);
    for (const d of j.decisions) assert.equal(d.options.length, 3);
  }
});

test('공략 시험: 소리 없이 찍는 네 공략은 근거 정답률이 우연 근처이고 끝까지 들은 판보다 늦다', () => {
  const strategies = {
    '늘 그대로 · 가운데': (d) => d.kind === 'stop' ? 'stay' : d.options[1].id,
    '늘 첫 칸': (d) => d.options[0].id,
    '긴 안내에서 내림': (d) => d.kind === 'stop' ? (transfersAt(d.station, d.line).length ? (d.side) : 'stay') : d.options[1].id,
    '첫 역에서 내림': (d, run) => d.kind === 'stop' ? (run.results.filter((r) => r.kind === 'stop').length === 0 ? 'right' : 'stay') : d.options[0].id,
  };
  for (const [name, pick] of Object.entries(strategies)) {
    let right = 0, total = 0, later = 0;
    for (const seed of seeds) {
      const j = buildJourney({ seed });
      const s = play(j, pick).summary(), p = play(j, (d) => d.answer).summary();
      right += s.right; total += s.total; if (s.arrive > p.arrive) later += 1;
    }
    const rate = right / total;
    assert.ok(rate < 0.6, `${name}: 정답률 ${rate.toFixed(2)}`);
    assert.ok(later / seeds.length > 0.95, `${name}: 늦은 판 ${later}/${seeds.length}`);
  }
});

test('가운데 칸이 답인 비율이 표지 · 출구에서 ⅓ 근처다', () => {
  let center = 0, total = 0;
  for (const seed of seeds) for (const d of buildJourney({ seed }).decisions) if (d.kind !== 'stop') { total += 1; if (d.options[1].id === d.answer) center += 1; }
  const rate = center / total;
  assert.ok(rate > 0.22 && rate < 0.44, rate.toFixed(2));
});

test('환승 말이 없는 역의 그대로는 근거로 세지 않고 연속에도 안 든다', () => {
  const run = new SubwayRun(buildJourney({ seed: 11 }));
  for (const seed of seeds) {
    const j = buildJourney({ seed });
    for (const d of j.decisions) if (d.kind === 'stop' && !d.target && !transfersAt(d.station, d.line).length) { assert.equal(d.assessable, false, d.id); assert.equal(d.answer, 'stay'); }
  }
  assert.ok(run);
});

test('연속 정답 3 · 5에서 시계가 1분 돌아온다', () => {
  const j = buildJourney({ seed: seeds.find((s) => buildJourney({ seed: s }).decisions.filter((d) => d.assessable).length >= 5) });
  const run = play(j, (d) => d.answer);
  assert.deepEqual(run.results.filter((r) => r.bonus).map((r) => r.streakHit), [3, 5]);
});

test('틀린 까닭: 역을 놓침 · 반대 문 · 일찍 내림이 갈린다', () => {
  const j = buildJourney({ seed: 3 });
  const target = j.decisions.find((d) => d.kind === 'stop' && d.target);
  const wrongDoor = target.side === 'left' ? 'right' : 'left';
  const mk = (pick) => { const run = new SubwayRun(j); while (run.current !== target) { run.hearingDone(); run.choose(run.current.answer); } run.hearingDone(); return run.choose(pick).cause; };
  assert.equal(mk('stay'), 'missed-station');
  assert.equal(mk(wrongDoor), 'wrong-door');
});

test('소리가 끊긴 안내의 답은 평가하지 않는다', () => {
  const j = buildJourney({ seed: 21 });
  const run = new SubwayRun(j);
  run.hearingDone(false);
  assert.equal(run.choose(run.current.answer).assessable, false);
});

test('노선 사실: 안내의 환승 = 실제 환승(양쪽), 원고의 역은 노선 순서 안', () => {
  for (const line of allLines()) {
    if (!line.voice.startsWith('stop-')) continue;
    const station = Object.keys(STATIONS).find((n) => STATIONS[n].slug === line.voice.split('-')[1]);
    assert.ok(station, line.voice);
    const onLine = STATIONS[station].lines.filter((n) => LINES[n].order.includes(station));
    assert.ok(onLine.length, station);
    const mentioned = [...line.text.matchAll(/(\d)호선/g)].map((m) => Number(m[1]));
    const possible = STATIONS[station].lines;
    for (const n of mentioned) assert.ok(possible.includes(n), `${station}: ${n}호선`);
    // 탄 노선 하나를 뺀 나머지가 전부 안내에 든다(역방향 — 실제 환승역이면 안내에 반드시 있다)
    if (possible.length > 1) assert.equal(mentioned.length, possible.length - 1, `${station}: ${line.text}`);
    else assert.equal(mentioned.length, 0, `${station}: ${line.text}`);
  }
  for (const route of ROUTES.line2) { const order = LINES[2].order; let i = order.indexOf(route.start); const dir = order.indexOf(route.stops[0]) > i ? 1 : -1; for (const s of route.stops) { i += dir; assert.equal(order[i], s, `${route.start} → ${s}`); } }
  for (const route of ROUTES.line1) { const order = LINES[1].order; const from = order.indexOf('시청'); assert.equal(order.indexOf(route.stops[0]), from + 1, route.dest); route.stops.forEach((s) => assert.ok(order.indexOf(s) > from, s)); for (let k = 1; k < route.stops.length; k++) assert.equal(order.indexOf(route.stops[k]), order.indexOf(route.stops[k - 1]) + 1); }
});

test('읽는 글에는 숫자가 없다(목소리가 숫자를 잘못 읽지 않게)', () => {
  for (const line of allLines()) assert.ok(!/\d/.test(line.say), line.say);
});

test('바쁜 아침: 3~4급 결정은 ko2 지도이고, 틀려도 늘 도착하며 끝까지 맞히면 9시 전이다', () => {
  let kinds = new Set();
  for (const seed of seeds) {
    const j = buildJourney({ seed, level: 'busy' });
    assert.ok(j.decisions.length >= 4 && j.decisions.length <= 8, String(j.decisions.length));
    for (const d of j.decisions) {
      assert.equal(d.options.length, 3, d.id);
      assert.ok(d.options.some((o) => o.id === d.answer), d.id);
      if (d.grade === 'busy' && d.id.startsWith('busy.')) { assert.equal(d.skillId, 'ko2.listening.detail', d.id); kinds.add(d.id.split('.')[1]); }
    }
    const perfect = play(j, (d) => d.answer), wrong = play(j, (d) => d.options.find((o) => o.id !== d.answer).id);
    assert.ok(perfect.minutes <= SCHOOL_MINUTES, clockText(perfect.minutes));
    assert.equal(wrong.finished, true);
  }
  assert.deepEqual([...kinds].sort(), ['delay', 'exit', 'express', 'short']);
});

test('바쁜 아침 공사 안내: 막힌 번호가 보기에 있고 답은 안내가 말한 다른 번호다', () => {
  for (const seed of seeds) {
    const d = buildJourney({ seed, level: 'busy' }).decisions.find((x) => x.id.startsWith('busy.exit'));
    const [, , closed, open] = d.id.split('.');
    assert.equal(d.answer, `e${open}`);
    assert.ok(d.options.some((o) => o.id === `e${closed}`), '막힌 번호가 미끼로 있어야 한다');
    assert.notEqual(closed, open);
    assert.equal(new Set(d.options.map((o) => o.id)).size, 3, d.id);
    assert.equal(d.lead.voice, `guide-exit-${closed}`);
  }
});

test('바쁜 아침 급행: 건너뛰는 역이 내 역이면 다음 열차, 아니면 이 열차', () => {
  let wait = 0, board = 0;
  for (const seed of seeds) {
    const j = buildJourney({ seed, level: 'busy' }), d = j.decisions.find((x) => x.kind === 'board');
    if (!d) continue;
    const skipIsMine = d.line_.text.includes(`${j.dest}역에 서지 않습니다`);
    assert.equal(d.answer, skipIsMine ? 'wait' : 'board');
    if (skipIsMine) wait += 1; else board += 1;
  }
  assert.ok(wait > 0 && board > 0, `${wait}/${board}`);
});

test('바쁜 아침: 서지 않는다고 안내한 역에 이 열차가 서지 않는다', () => {
  for (const seed of seeds) {
    const j = buildJourney({ seed, level: 'busy' }), at = j.decisions.findIndex((x) => x.kind === 'board');
    if (at < 0 || j.decisions[at].answer !== 'board') continue;
    for (const d of j.decisions.slice(at + 1)) if (d.kind === 'stop') assert.ok(!d.line_.text.includes('종각역입니다'), d.id);
  }
});

test('고쳐 읽는 안내의 원고가 모두 목소리 줄에 있다(바쁜 아침 포함)', () => {
  const voices = new Set(allLines().map((l) => l.voice));
  for (const level of ['basic', 'busy']) for (const seed of seeds) {
    const j = buildJourney({ seed, level });
    assert.ok(voices.has(j.opening.voice), j.opening.voice);
    for (const d of j.decisions) { assert.ok(voices.has(d.line_.voice), d.line_.voice); if (d.lead) assert.ok(voices.has(d.lead.voice), d.lead.voice); if (d.after) assert.ok(voices.has(d.after.voice), d.after.voice); }
  }
});

test('첫 화면 틀: 제목이 하나 있고 안내문 역할이 그 태그에 허용된다(배포 점검 접근성)', () => {
  const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.doesNotMatch(html, /<aside[^>]*role=/);
});

test('시험이 읽지 않는 화면 코드도 문법이 맞다(한 줄 고침이 줄 뒤를 잘라먹지 않게)', () => {
  for (const name of ['app.mjs', 'audio.mjs', 'music.mjs', 'scene.mjs', 'hud.mjs', 'pickpanel.mjs', 'led.mjs']) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(name, import.meta.url))], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name}: ${r.stderr.slice(0, 300)}`);
  }
});
