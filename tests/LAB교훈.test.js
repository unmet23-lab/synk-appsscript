'use strict';
// LAB 교훈 표(11-17) — 이해 시험 · 판본 회차 기록의 교훈을 표 하나로 받고, 시작할 때 읽히고, 안 올린 기록을 점검한다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const L = require('../tools/lib/LAB교훈.js');

const REPO = path.resolve(__dirname, '..');

const 이해글 = [
  '# 낯선 사람 이해 시험 기록',
  '',
  '| 날짜 | 브랜드 | 편 | 점수 | 넘긴 자리 · 걸린 까닭 | 다음 |',
  '|---|---|---|---|---|---|',
  '| 11-16 | LAB 몽골 | M55 「단디 해래이」 — 사투리 | v7 4·3·4·4 | 짧은 칸을 놓침 | 짧은 칸이 많은 편은 첫 시험부터 `--컷` |',
  '| 11-16 | LAB 영어 | E40 「전기장판」 | v3 | 풀이 | 낱말을 쪼개 풀어야 하는 말은 설명란으로 |',
  '| 11-16 | synkbrief | B52 가짜 쇼핑몰 | v2 | — | LAB 줄이 아니라 세지 않는다 |',
  '| 11-10 | LAB 몽골 | 퀴즈 「수박」 | v6 | — | **닫힘** — 수박 |',
  '| 11-10 | LAB 몽골 | 퀴즈 「바람」 | v6 | — | **닫힘** — 바람 |',
  '| 10-30 | LAB 몽골 | M18 | v3 | — | 시작일 앞이라 셈 밖 |',
].join('\n');

const 판본글 = [
  '# 나라 판본 회차 기록',
  '## <YYYY-MM-DD HH:mm> 회차 — 꼴',
  '- 다음 원본에서 바꿀 것: … / 없음',
  '## 2026-11-15 03:19 회차 — 통과 4 · 쉬는 0',
  '',
  '| 편 | 키 | 결과 | 고친 횟수 | 든 시간(분) | 한 줄 |',
  '|---|---|---|---|---|---|',
  '| 미안 | MY | 통과 | 3 | 40 | 말풍선 |',
  '| 미안 | BR | 통과 | 2 | 30 | 말풍선 |',
  '| 지마 | RU | 건너뜀(인사 없음) | — | — | — |',
  '',
  '| 계정 | 시각 | 영상 |',
  '|---|---|---|',
  '| lab-my | 11-18 | 2026 |',
  '',
  '- 다음 원본에서 바꿀 것: 말풍선 뜻 줄은 처음부터 한 줄 폭 안에서 쓴다(「미안」 ③ · ④, 11-14에 이어 두 번째). 단계 알약은 뜻을 담는다.',
  '## 2026-11-15 20:00 회차(조율 세션) — 통과 8',
  '- 다음 원본에서 바꿀 것: ① 상황 줄은 폭으로 감긴다. ② 일본어는 초당 4자다. ⑥ 끝 질문은 끝 카드와 짝. ⑤ 말끝을 흐리지 않는다.',
  '## 2026-11-16 11:49 회차 — 통과 3',
  '- 다음 원본에서 바꿀 것: 없음',
  '## 2026-11-16 21:20 밤 곁 세션 회차(뒤 칸부터)',
  '다음 원본에서 바꿀 것: ① 이름표를 0.8초 뒤에. ② F = Four 칸을 원본 지도에.',
].join('\n');

function 자리만들기(표, { 지문 = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'LAB교훈-'));
  const 쓰기 = (조각, 글) => { const p = path.join(root, ...조각); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); };
  쓰기(L.자리.이해, 이해글);
  쓰기(L.자리.판본, 판본글);
  if (표) {
    const 원천 = [...L.이해원천(이해글), ...L.판본원천(판본글)];
    쓰기(L.자리.표, 지문 ? L.지문적은표(원천, { ...표, 지문: {} }) : JSON.stringify(표, null, 1));
  }
  return root;
}

const 기본표 = () => ({
  시작일: '2026-11-01',
  교훈: [
    { id: 'L01', 단계: ['시험'], 할것: '짧은 칸도 시험 그림에 든다', 근거: ['이해:2026-11-16:몽골:M55'], 올린날: '2026-11-17', 올린곳: '기본값', 자리: 'tools/낯선이시험.js 자동 칸' },
    { id: 'L07', 단계: ['원본'], 할것: '낱말 짜임 풀이는 캡션으로 보낸다', 근거: ['이해:2026-11-16:영어:E40'], 올린날: '2026-11-15', 올린곳: '읽힘' },
    { id: 'P01', 단계: ['판본', '원본'], 할것: '말풍선 뜻 줄은 한 줄 폭 안에서 쓴다', 근거: ['판본:2026-11-15 03:19 회차:전체', '판본:2026-11-15 20:00 회차:①', '판본:2026-11-16 21:20 밤 곁 세션 회차:①'], 올린날: '2026-11-17', 올린곳: '읽힘' },
    { id: 'P02', 단계: ['판본'], 할것: '언어별 읽기 속도로 글자 수를 센다', 근거: ['판본:2026-11-15 20:00 회차:②', '판본:2026-11-16 21:20 밤 곁 세션 회차:②'], 올린날: '2026-11-17', 올린곳: '읽힘' },
    { id: 'P05', 단계: ['판본'], 할것: '끝 질문은 끝 카드와 짝을 맞춘다', 근거: ['판본:2026-11-15 20:00 회차:⑥', '판본:2026-11-15 20:00 회차:⑤'], 올린날: '2026-11-17', 올린곳: '읽힘' },
  ],
  뺌: [
    { 근거: '이해:2026-11-10:몽골:퀴즈', 까닭: '닫힘 — 퀴즈 칸 멈춤' },
    { 근거: '이해:2026-11-10:몽골:퀴즈#2', 까닭: '닫힘 — 위와 같다' },
  ],
});

test('이해 시험 기록 — LAB 줄만 「이해:YYYY-MM-DD:줄:편 코드」로 읽고, 같은 열쇠는 아래(옛 줄)부터 세어 위의 새 줄에 #2를 붙인다', () => {
  const r = L.이해원천(이해글);
  assert.deepEqual(r.map((x) => x.키), ['이해:2026-11-16:몽골:M55', '이해:2026-11-16:영어:E40', '이해:2026-11-10:몽골:퀴즈#2', '이해:2026-11-10:몽골:퀴즈', '이해:2026-10-30:몽골:M18']);
  assert.equal(r[0].날, '2026-11-16');
  assert.match(r[0].글, /--컷/);
  assert.match(r[3].글, /바람/, '맨 열쇠는 아래의 옛 줄');
  // 표 맨 위에 같은 날 같은 편 줄을 더해도 이미 받은 옛 줄의 열쇠는 그대로다(Fable 5.2 P2-1)
  const 더한 = 이해글.replace('| 11-16 | LAB 몽골 | M55', '| 11-10 | LAB 몽골 | 퀴즈 「새」 | v1 | — | 새 교훈 |\n| 11-16 | LAB 몽골 | M55');
  const r2 = L.이해원천(더한);
  assert.equal(r2.find((x) => /바람/.test(x.글)).키, '이해:2026-11-10:몽골:퀴즈');
  assert.equal(r2.find((x) => /수박/.test(x.글)).키, '이해:2026-11-10:몽골:퀴즈#2');
  assert.equal(r2.find((x) => /새 교훈/.test(x.글)).키, '이해:2026-11-10:몽골:퀴즈#3');
});

test('이해 시험 기록 — 12월 다음에 1월 줄이 위에 오면 해를 넘기고, 같은 해 안에서 조금 뒤섞인 줄은 해를 넘기지 않는다(Fable 5.2 P2-2)', () => {
  const 글 = ['| 01-03 | LAB 몽골 | M90 | v1 | — | 새해 |', '| 12-30 | LAB 몽골 | M89 | v1 | — | 연말 |', '| 11-02 | LAB 영어 | E50 | v1 | — | 뒤섞임 |', '| 11-05 | LAB 영어 | E51 | v1 | — | 앞 |'].join('\n');
  assert.deepEqual(L.이해원천(글).map((x) => x.키), ['이해:2027-01-03:몽골:M90', '이해:2026-12-30:몽골:M89', '이해:2026-11-02:영어:E50', '이해:2026-11-05:영어:E51']);
});

test('판본 회차 기록 — 괄호 안 번호는 항목 머리가 아니고, 「- 」 없는 줄 · 굵게 · 줄표도 읽으며, 「없음」 · 꼴 설명 절은 뺀다', () => {
  assert.deepEqual(L.번호조각('말풍선 뜻 줄(「미안」 ③ · ④, 두 번째). 단계 알약').map((x) => x.번호), ['전체']);
  assert.deepEqual(L.번호조각('① 가 ② 나 ⑥ 다').map((x) => [x.번호, x.글]), [['①', '가'], ['②', '나'], ['⑥', '다']]);
  assert.deepEqual(L.번호조각('앞글 ① 가 ② 나').map((x) => x.번호), ['전체'], '머리 앞에 글이 있으면 번호 목록이 아니다');
  const r = L.판본원천(판본글);
  assert.deepEqual(r.map((x) => x.키), ['판본:2026-11-15 03:19 회차:전체', '판본:2026-11-15 20:00 회차:①', '판본:2026-11-15 20:00 회차:②', '판본:2026-11-15 20:00 회차:⑥', '판본:2026-11-15 20:00 회차:⑤',
    '판본:2026-11-16 21:20 밤 곁 세션 회차:①', '판본:2026-11-16 21:20 밤 곁 세션 회차:②']);
  for (const 줄 of ['* 다음 원본에서 바꿀 것: 가', '- **다음 원본에서 바꿀 것**: 가', '  - 다음 원본에서 바꿀 것: 가', '- 다음 원본에서 바꿀 것 — 가', '- **다음 원본에서 바꿀 것:** 가']) {
    assert.deepEqual(L.판본원천(`## 2026-11-20 03:19 회차 — 통과 1\n${줄}`).map((x) => [x.키, x.글]), [['판본:2026-11-20 03:19 회차:전체', '가']], 줄);
  }
  assert.deepEqual(L.판본못읽음(`## 2026-11-20 03:19 회차 — 통과 1\n- 다음 원본에서 바꿀 것들 가\n- 판본 지도에 다음 원본에서 바꿀 것을 적었다`).map((x) => x.줄번호), [2], '그 말로 시작하는데 꼴을 못 읽은 줄만 걸린다');
  assert.equal(L.회차머리('## 2026-11-15 새벽 — 「형오빠」 판본(조율 세션)'), '2026-11-15 새벽');
  assert.equal(L.회차머리('## <YYYY-MM-DD HH:mm> 회차 — 꼴'), null);
});

test('판본 숫자 — 머리가 「편 · 키 · 결과 · 고친 횟수」인 첫 표만 세고, 뒤의 다른 표는 섞지 않는다', () => {
  assert.deepEqual(L.판본숫자(판본글), [{ 회차: '2026-11-15 03:19 회차', 판본: 3, 통과: 2, 고친평균: 2.5 }]);
});

test('점검 — 표가 모든 기록을 받으면 걸림 0, 안 올린 기록 · 없는 근거 · 바뀐 글 · 지문 없음 · 꼴을 따로 내고, 출처를 주면 그 기록만 본다', () => {
  const 원천 = [...L.이해원천(이해글), ...L.판본원천(판본글)];
  const 표 = JSON.parse(L.지문적은표(원천, { ...기본표(), 지문: {} }));
  const ok = L.점검(원천, 표);
  assert.equal(L.걸림수(ok), 0);
  // 받은 뒤 줄을 고쳐 쓰면 지문이 달라진다(Fable 5.2 P3-1)
  const 고친 = 원천.map((x) => (x.키 === '이해:2026-11-16:몽골:M55' ? { ...x, 글: `${x.글} 새 교훈 하나 더` } : x));
  assert.deepEqual(L.점검(고친, 표).바뀜.map((x) => x.키), ['이해:2026-11-16:몽골:M55']);
  const 나쁜 = JSON.parse(JSON.stringify(표));
  나쁜.교훈[1].근거 = ['이해:2026-11-16:영어:E4O'];   // 오타
  delete 나쁜.지문['판본:2026-11-15 20:00 회차:②'];
  나쁜.교훈.push({ id: 'L01', 단계: ['딴데'], 할것: '짧', 근거: [], 올린날: '11-17', 올린곳: '검사' });
  const bad = L.점검(원천, 나쁜);
  assert.deepEqual(bad.안올림.map((x) => x.키), ['이해:2026-11-16:영어:E40']);
  assert.deepEqual(bad.없는근거, ['이해:2026-11-16:영어:E4O']);
  assert.deepEqual(bad.지문없음.map((x) => x.키), ['판본:2026-11-15 20:00 회차:②']);
  assert.ok(bad.꼴.some((t) => /id가 겹친다/.test(t)));
  assert.ok(bad.꼴.some((t) => /단계는/.test(t)));
  assert.ok(bad.꼴.some((t) => /근거가 없다/.test(t)));
  assert.ok(bad.꼴.some((t) => /올린날/.test(t)));
  assert.ok(bad.꼴.some((t) => /자리/.test(t)), '기본값 · 검사는 자리를 적는다');
  // 판본 회차는 판본 줄만, 제작 회차는 이해 줄만 본다 — 남이 방금 올린 줄로 막히지 않는다(Fable 5.2 P2-3)
  const 판본만 = L.점검(원천, 나쁜, { 출처: '판본' });
  assert.deepEqual(판본만.안올림, []);
  assert.deepEqual(판본만.없는근거, []);
  assert.deepEqual(판본만.지문없음.map((x) => x.키), ['판본:2026-11-15 20:00 회차:②']);
  const 이해만 = L.점검(원천, 나쁜, { 출처: '이해', 못읽음: [{ 회차: 'x', 줄번호: 1, 글: 'x' }] });
  assert.deepEqual(이해만.지문없음, []);
  assert.deepEqual(이해만.못읽음, [], '못 읽은 판본 줄은 판본 점검 몫');
});

test('지문 — 받은 줄만 정렬해 적고, 표를 한 줄에 하나 꼴로 다시 쓴다(두 회차가 다른 교훈에 열쇠를 더하면 git이 합친다)', () => {
  const 원천 = [...L.이해원천(이해글), ...L.판본원천(판본글)];
  const 글 = L.지문적은표(원천, { ...기본표(), 지문: { '이해:2099-01-01:없는:X1': 'abc' } });
  const j = JSON.parse(글);
  assert.ok(!('이해:2099-01-01:없는:X1' in j.지문), '받지 않은 열쇠의 지문은 지운다');
  assert.deepEqual(Object.keys(j.지문), [...Object.keys(j.지문)].sort((a, b) => a.localeCompare(b, 'ko')));
  assert.equal(j.지문['이해:2026-11-16:몽골:M55'], L.지문of(원천[0].글));
  assert.match(글, /"근거": \[\n\s+"이해:2026-11-16:몽골:M55"\n\s+\]/, '근거 배열은 한 줄에 하나');
  assert.equal(L.지문of('가  나\n다'), L.지문of('가 나 다'), '빈칸만 다른 글은 같은 지문');
});

test('셈 · 시작 — 올린날 뒤에 다시 나온 교훈을 맨 위에 「올릴 차례」로 띄우고, 단계마다 고른다', () => {
  const root = 자리만들기(기본표());
  try {
    const 원본 = L.시작(root, '원본');
    assert.equal(원본.줄[0].id, 'L07', 'L07은 11-15에 읽힘으로 올렸는데 11-16에 다시 나왔다');
    assert.equal(원본.줄[0].다시, 1);
    assert.ok(원본.줄.some((e) => e.id === 'L01'), '원본 시작은 시험 교훈도 본다');
    assert.ok(원본.줄.some((e) => e.id === 'P01'), '원본 단계가 붙은 판본 교훈도 본다');
    assert.ok(!원본.줄.some((e) => e.id === 'P02'));
    const 글 = L.시작글(원본);
    assert.match(글, /^\[LAB 교훈\] 이 편을 기획하고/);
    assert.match(글, /L07 낱말 짜임 풀이는 캡션으로 보낸다 — 기록 1번\(11-16\) · 11-15에 올린 뒤에도 1번 다시 — 읽히기로는 안 막혀 기본값이나 검사로 올릴 차례/);
    assert.match(글, /L01 .* · 기본값: tools\/낯선이시험\.js 자동 칸/);
    const 판본 = L.시작(root, '판본');
    assert.deepEqual(판본.줄.map((e) => e.id).sort(), ['P01', 'P02', 'P05']);
    assert.match(L.시작글(판본), /판본 회차 숫자\(통과 \/ 판본 · 고친 횟수 평균\): 2026-11-15 03:19 2\/3 · 2\.5/);
    assert.throws(() => L.시작(root, '딴데'), /단계는/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('입구 — --점검은 안 올린 기록이 있으면 끝 코드 1과 열쇠를 내고, --지문은 지문을 적고, 시작은 늘 0이며 표가 없으면 아무것도 안 낸다', () => {
  const 표 = 기본표();
  표.교훈 = 표.교훈.filter((e) => e.id !== 'L07');
  const root = 자리만들기(표);
  const 빈 = fs.mkdtempSync(path.join(os.tmpdir(), 'LAB교훈빈-'));
  try {
    const run = (args, dir) => spawnSync(process.execPath, [path.join(REPO, 'tools', 'LAB교훈.js'), ...args], { encoding: 'utf8', env: { ...process.env, SYNK_LAB_LESSON_DIR: dir } });
    const c = run(['--점검'], root);
    assert.equal(c.status, 1);
    assert.match(c.stdout, /교훈 표에 안 올린 기록 1줄/);
    assert.match(c.stdout, /이해:2026-11-16:영어:E40 — 낱말을 쪼개 풀어야 하는 말은 설명란으로/);
    assert.equal(run(['--점검', '판본'], root).status, 0, '판본 회차는 남의 이해 줄로 막히지 않는다');
    const s = run(['시작', '원본'], root);
    assert.equal(s.status, 0);
    assert.match(s.stdout, /교훈 표에 아직 안 올린 기록 1개\(이해:2026-11-16:영어:E40\) — 회차를 닫기 전에 node tools\/LAB교훈\.js --점검 이해/);
    // 지문 없이 올린 표 → --점검이 지문 없음으로 걸리고, --지문 뒤에는 그 걸림이 사라진다
    const 날표 = fs.mkdtempSync(path.join(os.tmpdir(), 'LAB교훈날-'));
    try {
      for (const 조각 of [L.자리.이해, L.자리.판본]) { fs.mkdirSync(path.join(날표, ...조각.slice(0, -1)), { recursive: true }); fs.copyFileSync(path.join(root, ...조각), path.join(날표, ...조각)); }
      fs.mkdirSync(path.join(날표, ...L.자리.표.slice(0, -1)), { recursive: true });
      fs.writeFileSync(path.join(날표, ...L.자리.표), JSON.stringify(기본표()));
      const a = run(['--점검'], 날표);
      assert.equal(a.status, 1);
      assert.match(a.stdout, /지문이 없는 기록/);
      assert.equal(run(['--지문'], 날표).status, 0);
      const b = run(['--점검'], 날표);
      assert.equal(b.status, 0, b.stdout);
    } finally { fs.rmSync(날표, { recursive: true, force: true }); }
    const e = run(['시작', '원본'], 빈);
    assert.equal(e.status, 0);
    assert.equal(e.stdout, '');
    assert.equal(run(['시작', '딴데'], root).status, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(빈, { recursive: true, force: true });
  }
});

test('흠 장부 시작 LAB · 새편 — LAB 길이면 교훈 표 줄을 붙이고(흠 장부 줄이 없어도 새편이 버리지 않는다), 표가 없으면 예전처럼 아무것도 안 붙인다', () => {
  const root = 자리만들기(기본표());
  const 빈 = fs.mkdtempSync(path.join(os.tmpdir(), 'LAB교훈빈-'));
  const 장부자리 = fs.mkdtempSync(path.join(os.tmpdir(), '흠장부빈-'));
  const 편 = path.join(장부자리, 'docs', '마케팅', 'LAB_시험_mn_20261117');
  fs.mkdirSync(path.join(편, '게시'), { recursive: true });
  fs.writeFileSync(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 슬롯: '2026-11-20' }));
  const 옛 = { lesson: process.env.SYNK_LAB_LESSON_DIR, ledger: process.env.SYNK_FLAW_LEDGER_DIR };
  try {
    const run = (dir) => spawnSync(process.execPath, [path.join(REPO, 'tools', '흠장부.js'), '시작', 'LAB'], { encoding: 'utf8', env: { ...process.env, SYNK_LAB_LESSON_DIR: dir, SYNK_FLAW_LEDGER_DIR: 장부자리 } });
    const a = run(root);
    assert.equal(a.status, 0);
    assert.match(a.stdout, /^\[LAB 교훈\]/m);
    const b = run(빈);
    assert.equal(b.status, 0);
    assert.equal(b.stdout, '');
    // 새편.js의 흠시작글은 자식 node를 띄우므로 환경 변수로 자리를 넘긴다(Fable 5.2 P1-2 — 「[흠 장부]」만 받던 때는 빈 글이었다)
    process.env.SYNK_LAB_LESSON_DIR = root;
    process.env.SYNK_FLAW_LEDGER_DIR = 장부자리;
    const 새편 = require('../tools/새편.js');
    assert.match(새편.흠시작글(편), /^\[LAB 교훈\]/);
    process.env.SYNK_LAB_LESSON_DIR = 빈;
    assert.equal(새편.흠시작글(편), '');
  } finally {
    if (옛.lesson === undefined) delete process.env.SYNK_LAB_LESSON_DIR; else process.env.SYNK_LAB_LESSON_DIR = 옛.lesson;
    if (옛.ledger === undefined) delete process.env.SYNK_FLAW_LEDGER_DIR; else process.env.SYNK_FLAW_LEDGER_DIR = 옛.ledger;
    for (const d of [root, 빈, 장부자리]) fs.rmSync(d, { recursive: true, force: true });
  }
});

test('실제 표 — 꼴이 맞고, 근거는 모두 지금 기록에 있는 열쇠다(안 올린 기록 · 지문은 회차가 --점검으로 받는다)', () => {
  const 표 = L.표읽기(REPO);
  assert.ok(!표.없음, '표가 있어야 한다');
  const r = L.점검(L.원천읽기(REPO), 표);
  assert.deepEqual(r.꼴, []);
  assert.deepEqual(r.없는근거, []);
});

// 다시 검수(11-17 Fable 5.2) N1 · N2 · N3
test('지문은 있는 것을 덮지 않는다 — 고쳐 쓴 줄은 --지문을 돌려도 점검에 남고, --바뀜받음으로만 풀린다(N1)', () => {
  const root = 자리만들기(기본표());
  try {
    const run = (args) => spawnSync(process.execPath, [path.join(REPO, 'tools', 'LAB교훈.js'), ...args], { encoding: 'utf8', env: { ...process.env, SYNK_LAB_LESSON_DIR: root } });
    const 이해 = path.join(root, ...L.자리.이해);
    fs.writeFileSync(이해, fs.readFileSync(이해, 'utf8').replace('첫 시험부터 `--컷` |', '첫 시험부터 `--컷` · 덧쓴 새 교훈 |'));
    const a = run(['--점검', '이해']);
    assert.equal(a.status, 1);
    assert.match(a.stdout, /받은 뒤 글이 바뀐 기록 1줄[\s\S]*이해:2026-11-16:몽골:M55/);
    assert.equal(run(['--지문', '이해']).status, 0);
    const b = run(['--점검', '이해']);
    assert.equal(b.status, 1, '지시문 차례대로 --지문을 돌려도 고쳐 쓴 줄은 그대로 걸린다');
    assert.equal(run(['--지문', '이해', '--바뀜받음']).status, 2, '덮을 열쇠를 주지 않으면 거절');
    assert.match(run(['--지문', '이해', '--바뀜받음', '이해:2026-11-16:몽골:M55']).stdout, /새로 0줄을 적고 1줄을 덮었다/);
    assert.equal(run(['--점검', '이해']).status, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('판본 기록 — 머리 줄 아래 목록 · 작은 제목 아래 목록을 그 줄의 글로 읽고, 표 칸 · 글 없는 머리는 못 읽은 줄로 띄운다(N2)', () => {
  const 머리 = '## 2026-11-20 03:19 회차 — 통과 1';
  const 목록 = `${머리}\n- 다음 원본에서 바꿀 것:\n  - ① 가를 고친다\n  - ② 나를 고친다\n\n- 쉬는 판본: 없음`;
  assert.deepEqual(L.판본원천(목록).map((x) => [x.키, x.글]), [['판본:2026-11-20 03:19 회차:①', '가를 고친다'], ['판본:2026-11-20 03:19 회차:②', '나를 고친다']]);
  assert.deepEqual(L.판본못읽음(목록), []);
  const 제목 = `${머리}\n### 다음 원본에서 바꿀 것\n- 다를 고친다\n- 라도 고친다\n### 막힌 것\n- 없음`;
  assert.deepEqual(L.판본원천(제목).map((x) => [x.키, x.글]), [['판본:2026-11-20 03:19 회차:전체', '다를 고친다 라도 고친다']]);
  assert.deepEqual(L.판본못읽음(`${머리}\n| 다음 원본에서 바꿀 것 | 가 |`).map((x) => x.줄번호), [2]);
  assert.deepEqual(L.판본못읽음(`${머리}\n**다음 원본에서 바꿀 것**\n\n다음 절`).map((x) => x.줄번호), [2], '머리만 있고 글이 없으면 띄운다');
  assert.deepEqual(L.판본못읽음(`${머리}\n- 다음 원본에서 바꿀 것은 둘이다`).map((x) => x.줄번호), [2]);
  assert.deepEqual(L.판본못읽음(`${머리}\n- 다음 원본에서 바꿀 것: 없음`), []);
  // 머리 항목과 같은 깊이의 다음 항목은 교훈 글이 아니다(세 번째 확인 참고 1)
  assert.deepEqual(L.판본원천(`${머리}\n- 다음 원본에서 바꿀 것:\n- 쉬는 판본: 없음\n- 막힌 것: 없음`), []);
  assert.deepEqual(L.판본원천(`${머리}\n- 다음 원본에서 바꿀 것:\n  - 가를 고친다\n- 쉬는 판본: 없음`).map((x) => x.글), ['가를 고친다']);
});

test('이해 기록 — 12월과 1월 줄이 엇갈려 더해져도 해가 두 번 오르지 않는다(N3)', () => {
  const 글 = ['| 01-03 | LAB 몽골 | M95 | v1 | — | e |', '| 12-31 | LAB 몽골 | M94 | v1 | — | d |', '| 01-02 | LAB 몽골 | M93 | v1 | — | c |', '| 12-31 | LAB 영어 | E92 | v1 | — | b |', '| 11-30 | LAB 몽골 | M91 | v1 | — | a |'].join('\n');
  assert.deepEqual(L.이해원천(글).map((x) => x.날), ['2027-01-03', '2026-12-31', '2027-01-02', '2026-12-31', '2026-11-30']);
});
