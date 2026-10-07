'use strict';
// 미니게임 목소리(tools/미니게임_목소리.cjs): 작업이 지금 게임 파일을 정확히 덮는지, 글을 바꾸지 않는지, 미리보기 합계, 배역 규칙,
// 후처리 형식이 지금 파일과 같은지, 게임이 읽는 목록에 제작 도구·목소리 이름이 들어가지 않는지. Typecast를 부르지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const V = require('../tools/lib/미니게임목소리.cjs'), G = require('../tools/lib/미니게임목소리_게임.cjs');
const TOOL = require('../tools/미니게임_목소리.cjs');

const REPO = path.resolve(__dirname, '..');
const CATALOG = path.join(REPO, 'docs', '마케팅', 'SHIFT_과정1편_20260921', 'audio', 'voice-catalog.json');
const catalog = fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, 'utf8')) : null;
const casting = V.loadCasting();
let cachedJobs = null;
const jobs = async () => (cachedJobs ||= await V.allJobs({ casting }));
const len = s => [...s].length;

test('게임마다 작업이 지금 음성 파일을 정확히 덮는다(이름·개수), id는 게임 안에서 하나', async () => {
  const all = await jobs();
  for (const id of V.GAME_ORDER) {
    const mine = all.filter(j => j.game === id), adapter = G.GAMES[id];
    assert.deepEqual(mine.flatMap(j => j.outputs).sort(), adapter.current().sort(), `${id}: 출력 = 지금 파일`);
    assert.equal(mine.length, adapter.shipped().length, `${id}: 줄 수 = 지금 목록`);
    assert.equal(new Set(mine.map(j => j.id)).size, mine.length, `${id}: id 겹침 없음`);
  }
  assert.equal(all.filter(j => j.game === 'korean-runner').flatMap(j => j.outputs).length, 2 * all.filter(j => j.game === 'korean-runner').length, '바람길은 wav와 mp3 둘');
});

test('글은 바꾸지 않는다: 부르는 글 = 지금 목록의 글(입장 검사는 숫자를 읽는 글 spoken)', async () => {
  const all = await jobs();
  for (const id of V.GAME_ORDER) {
    const shipped = new Map(G.GAMES[id].shipped().map(s => [s.id, s.text]));
    for (const j of all.filter(x => x.game === id)) assert.equal(j.text, shipped.get(j.id), `${id}/${j.id}`);
  }
});

test('미리보기 합계: 게임마다 줄·글자·출력 파일 수가 지금 목록에서 센 값과 같고 문제가 없다', async () => {
  const r = await V.dryRun({ casting, catalog });
  assert.deepEqual(r.problems, []);
  let lines = 0, chars = 0, outputs = 0;
  for (const id of V.GAME_ORDER) {
    const shipped = G.GAMES[id].shipped(), files = G.GAMES[id].current();
    assert.equal(r.perGame[id].lines, shipped.length, id);
    assert.equal(r.perGame[id].chars, shipped.reduce((n, s) => n + len(s.text), 0), id);
    assert.equal(r.perGame[id].outputs, files.length, id);
    assert.ok(r.perGame[id].billable <= r.perGame[id].chars, `${id}: 같은 글은 한 번만 부른다`);
    lines += shipped.length; chars += shipped.reduce((n, s) => n + len(s.text), 0); outputs += files.length;
  }
  assert.deepEqual([r.totals.lines, r.totals.chars, r.totals.outputs], [lines, chars, outputs]);
  assert.ok(r.totals.billable < r.totals.plan * 0.2, '월 제공 크레딧의 20% 안');
  const roles = Object.values(r.perRole).reduce((n, x) => n + x.lines, 0);
  assert.equal(roles, lines, '배역별 줄의 합 = 전체');
});

test('배역: 해설은 서현, 바람은 혜리, 배역마다 기본 + 후보 둘, 성별·감정 지원, 한 게임 안에서 목소리가 겹치지 않는다', async () => {
  const all = await jobs();
  assert.equal(casting.roles.narrator.voice.id, 'tc_69f2e455ea79fd197aa0476f');
  assert.equal(casting.roles.wind.voice.id, 'tc_62e8f21e979b3860fe2f6a24');
  assert.deepEqual(V.castingProblems(casting, all, catalog), []);
  const used = new Set(all.map(j => j.role));
  for (const role of ['narrator', 'wind', 'mongle', 'kkamong', 'marin', 'teacher', ...G.ANIMALS]) assert.ok(used.has(role), `${role}가 쓰인다`);
  // 같은 동물은 입장 검사와 주문 폭주에서 같은 목소리, 몽글은 말 랠리와 이야기 교실에서 같은 목소리
  const voiceOf = (game, role) => new Set(all.filter(j => j.game === game && j.role === role).map(j => j.voice.voice.id));
  for (const animal of G.ANIMALS) assert.deepEqual(voiceOf('entry-check', animal), voiceOf('order-rush', animal), animal);
  assert.deepEqual(voiceOf('talk-rally', 'mongle'), voiceOf('story-classroom', 'mongle'));
  // 모든 기본 목소리는 서로 다르다(해설과 캐릭터가 섞이지 않게)
  const defaults = Object.values(casting.roles).map(r => r.voice.id);
  assert.equal(new Set(defaults).size, defaults.length, '기본 목소리 겹침 없음');
  if (catalog) for (const r of Object.values(casting.roles)) for (const v of [r.voice, ...r.alternates])
    assert.equal(v.preview, catalog.find(c => c.voice_id === v.id).preview_url, `${r.label} ${v.name} 공식 미리듣기 주소`);
});

test('원본 저장소 열쇠: 목소리·설정·글이 모두 같을 때만 같다(다시 사지 않기)', () => {
  const v = V.voiceFor(casting, { game: 'korean-racing', id: 'intro', role: 'narrator' });
  const k = V.cacheKey(v, '출발!');
  assert.equal(V.cacheKey({ ...v }, '출발!'), k);
  assert.notEqual(V.cacheKey(v, '출발'), k);
  assert.notEqual(V.cacheKey({ ...v, tempo: v.tempo + 0.01 }, '출발!'), k);
  assert.notEqual(V.cacheKey({ ...v, voice: { id: 'tc_000000000000000000000000', name: 'x' } }, '출발!'), k);
  assert.ok(!V.rawPath(v, k).startsWith(REPO), '원본은 저장소 밖');
  assert.ok(!JSON.stringify(V.request(v, '출발!')).includes('KEY'), '요청 본문에 키 자리가 없다');
});

test('샘플: 배역마다 두 줄, 후보까지면 목소리마다 같은 두 줄', async () => {
  const all = await jobs(), picks = V.pickSamples(all);
  const roles = [...new Set(all.map(j => j.role))];
  for (const role of roles) {
    const mine = picks.filter(p => p.role === role);
    assert.equal(mine.length, 2, role);
    assert.notEqual(mine[0].job.key, mine[1].job.key, role);
  }
  const alt = V.sampleTasks(all, casting, { alternates: true });
  assert.equal(alt.length, picks.length * 3);
});

// ── 후처리(ffmpeg가 있을 때) ──────────────────────────────────────────────
const hasFfmpeg = !!(G.tool('ffmpeg') && G.tool('ffprobe'));
// Typecast 원본과 같은 모양: 44.1kHz 16bit mono wav, 앞 0.3초·끝 0.3초 무음, 사이에 말소리처럼 떨리는 소리.
function fixtureWav(file, seconds = 2.2) {
  const rate = 44100, n = Math.round(rate * seconds), data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate, on = t > 0.3 && t < seconds - 0.3 ? 1 : 0;
    const v = on * 0.22 * (Math.sin(2 * Math.PI * 190 * t) + 0.4 * Math.sin(2 * Math.PI * 380 * t)) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
}
const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'synk-minigame-voice-'));
const pickJobs = (all, game) => {
  const mine = all.filter(j => j.game === game);
  if (game === 'talk-rally') return [mine.find(j => j.group === 'voice'), mine.find(j => j.group === 'narration')];
  if (game === 'korean-racing') return [mine[0], mine.find(j => j.group === 'tutorial-manifest.json')];
  if (game === 'korean-runner') return [mine[0], mine.find(j => j.id.startsWith('check-'))];
  return [mine[0]];
};

test('후처리: 게임마다 지금 파일과 같은 형식(코덱·표본율·채널·비트율)이고 그 게임의 검사를 통과한다', { skip: !hasFfmpeg && 'ffmpeg 없음' }, async () => {
  const all = await jobs(), dir = tmpRoot(), raw = path.join(dir, 'raw.wav');
  fixtureWav(raw);
  try {
    for (const game of V.GAME_ORDER) for (const j of pickJobs(all, game)) {
      const adapter = G.GAMES[game], r = await adapter.process(j, raw, path.join(dir, game));
      assert.deepEqual(adapter.validate(j, r.metrics), [], `${game}/${j.id} 검사`);
      for (const [rel, file] of Object.entries(r.files)) {
        const made = await G.probe(file), now = await G.probe(path.join(G.gameDir(game), ...rel.split('/')));
        for (const k of ['codec', 'sampleRate', 'channels', 'bitRate', 'bits']) assert.equal(made[k], now[k], `${game}/${rel} ${k}`);
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('적용: 무대 결과를 넣으면 다시 만든 줄만 목록이 바뀌고, 게임이 읽는 파일에 제작 도구·목소리 이름이 없다', { skip: !hasFfmpeg && 'ffmpeg 없음' }, async () => {
  const all = await jobs(), dir = tmpRoot(), raw = path.join(dir, 'raw.wav');
  fixtureWav(raw);
  // 가짜 저장소: 목록 파일만 복사한다(오디오는 결과로 들어간다)
  const copy = (game, rel) => { const to = path.join(dir, 'experiences', game, ...rel.split('/')); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(G.gameDir(game), ...rel.split('/')), to); };
  const files = {
    'korean-racing': ['manifest.json', 'challenge-manifest.json', 'choice-manifest.json', 'finale-manifest.json', 'garage-manifest.json', 'tutorial-manifest.json'].map(f => 'assets/narration/' + f),
    'entry-check': ['assets/voice/voices.json'], 'story-classroom': ['assets/voice/manifest.json', 'assets/voice/jobs.json'],
    'korean-rhythm': ['assets/narration/manifest.json', 'narration.mjs'], 'talk-rally': ['assets/voice/manifest.json', 'assets/narration/manifest.json'],
    'korean-runner': ['assets/voice/manifest.json', 'voice-timing.mjs'], 'order-rush': [],
  };
  try {
    for (const game of V.GAME_ORDER) {
      for (const rel of files[game]) copy(game, rel);
      const adapter = G.GAMES[game], picked = pickJobs(all, game), results = [];
      for (const j of picked) results.push({ job: j, ...(await adapter.process(j, raw, path.join(dir, 'stage', game))), source: TOOL.sourceInfo(j, adapter) });
      const before = Object.fromEntries(files[game].map(rel => [rel, fs.readFileSync(path.join(G.gameDir(game), ...rel.split('/')), 'utf8')]));
      const changed = G.install(adapter, results, { repo: dir, jobs: all.filter(j => j.game === game), record: TOOL.writeRecord(game, results, casting, dir) });
      for (const rel of changed.filter(f => !f.endsWith('.source.json'))) {
        const text = fs.readFileSync(path.join(dir, 'experiences', game, ...rel.split('/')), 'utf8');
        assert.ok(!G.TOOL_NAMES.test(text), `${game}/${rel}에 제작 도구 이름`);
        assert.notEqual(text, before[rel], `${game}/${rel}가 바뀌었다`);
      }
      for (const r of results) for (const rel of Object.keys(r.files)) assert.ok(fs.existsSync(path.join(dir, 'experiences', game, ...rel.split('/'))), `${game}/${rel} 들어감`);
      const record = JSON.parse(fs.readFileSync(path.join(dir, 'experiences', game, 'qa', 'voice.source.json'), 'utf8'));
      assert.deepEqual(Object.keys(record.lines).sort(), picked.map(j => j.id).sort());
    }
    // 다시 만들지 않은 줄은 그대로: 레이싱 목록에서 고른 두 줄 말고는 지금 값과 같다
    const racingNow = JSON.parse(fs.readFileSync(path.join(G.gameDir('korean-racing'), 'assets', 'narration', 'manifest.json'), 'utf8'));
    const racingNew = JSON.parse(fs.readFileSync(path.join(dir, 'experiences', 'korean-racing', 'assets', 'narration', 'manifest.json'), 'utf8'));
    const touched = new Set(pickJobs(all, 'korean-racing').map(j => j.id));
    assert.equal(racingNew.clips.length, racingNow.clips.length);
    racingNew.clips.forEach((c, i) => { if (!touched.has(c.id)) assert.deepEqual(c, racingNow.clips[i]); });
    // 리듬 narration.mjs와 바람길 voice-timing.mjs는 게임이 바로 읽는다 — 모듈로 읽혀야 한다
    for (const [game, rel, name] of [['korean-rhythm', 'narration.mjs', 'NARRATION'], ['korean-runner', 'voice-timing.mjs', 'VOICE_SECONDS']]) {
      const mod = await import(require('node:url').pathToFileURL(path.join(dir, 'experiences', game, rel)).href);
      assert.ok(Object.keys(mod[name]).length > 10, `${game}/${rel}`);
    }
    // 말 랠리 안내의 .source.json은 시험이 보는 대로 몽글과 다른 목소리를 적는다
    const story = JSON.parse(fs.readFileSync(path.join(dir, 'experiences', 'story-classroom', 'assets', 'voice', `${pickJobs(all, 'story-classroom')[0].id}.source.json`), 'utf8'));
    assert.equal(story.provider, 'Typecast');
    const narr = JSON.parse(fs.readFileSync(path.join(dir, 'experiences', 'talk-rally', 'assets', 'narration', 'intro.source.json'), 'utf8'));
    assert.notEqual(narr.voice, casting.roles.mongle.voice.name);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('화면 요청: 다른 Host·다른 사이트는 막고, 키 연결은 화면 토큰이 있을 때만', () => {
  const req = (headers, method = 'POST') => ({ method, headers: { host: '127.0.0.1:5245', ...headers } });
  assert.equal(TOOL.allowed(req({ host: 'evil.test' }), '/generate'), 'Host rejected');
  assert.equal(TOOL.allowed(req({ origin: 'https://evil.test' }), '/generate'), 'Origin rejected');
  assert.equal(TOOL.allowed(req({ origin: 'http://127.0.0.1:5245', 'x-local-token': 'nope' }), '/generate'), 'Origin rejected');
  assert.equal(TOOL.allowed(req({}), '/connect'), 'Form token required');
  assert.equal(TOOL.allowed(req({}), '/generate'), null, '이 컴퓨터의 명령');
  assert.equal(TOOL.allowed(req({}, 'GET'), '/status'), null);
});
