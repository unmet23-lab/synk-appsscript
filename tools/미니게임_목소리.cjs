'use strict';
// 미니게임 목소리를 Typecast로 다시 굽는다(2026-10-07 유호님 「미니게임 지금 레이싱이랑 이것저것 … 저렴한품질의 목소리가 많이 적용되어있는데
// 전부 타입캐스트로 바꿔줘」). 레이싱·입장 검사·이야기 교실·말의 리듬·말 랠리·바람길·주문 폭주 2,856줄.
// 연결 방식은 tools/한글단계_목소리.cjs(LAB 한글날 voice-connection.cjs)와 같다:
//   node tools/미니게임_목소리.cjs --dry-run [--game korean-runner,talk-rally] [--json | --jobs]
//       작업·배역·글자·출력 경로·길이 위험 점검(--jobs는 줄마다 한 줄). Typecast를 부르지 않는다.
//   node tools/미니게임_목소리.cjs [--workers 2]   → http://127.0.0.1:5245
//       유호님이 기존 Typecast API 키를 붙여 넣는다. 키는 이 프로세스 메모리에만 2시간 머물고 파일·채팅·기록에 남지 않는다.
//       결제·충전·키 생성 기능은 없고, 월 제공 크레딧이 모자라거나 오류가 이어지면 멈춘다.
//       화면: 배역표(공식 미리듣기·후보 둘), 「샘플 만들기」(배역마다 두 줄 → 저장소 밖에서 듣기), 「전부 만들기」(게임마다 또는 전체 → 게임 폴더에 적용).
//       이 컴퓨터의 명령으로도 같다: POST /generate {"mode":"sample"} · {"mode":"sample","alternates":true} · {"mode":"all","games":["korean-runner"]}
//         · {"mode":"all","confirmed":true} · POST /stop · POST /cast {"role":"mongle","voiceId":"tc_…"} · GET /status
//         · 들어 보기 {"mode":"audition","name":"narrator-20261008","voices":[{"id":"tc_…","name":"…"}],"emotions":["normal","smart"],
//           "lines":[{"game":"korean-racing","id":"intro","previous":"…","next":"…"}]} → 어림만 돌려준다, {"confirmed":true}를 더하면 굽는다.
//           정한 줄을 후보 목소리 × 감정 방식마다 그 게임의 후처리로 구워 저장소 밖 audition/<이름>/에 둔다(게임 폴더·배역 파일은 그대로).
//   node tools/미니게임_목소리.cjs --apply <게임|all>   → 받아 둔 원본만으로 후처리·적용을 다시 한다(유료 호출 없음).
// 원본(Typecast wav)은 저장소 밖 Documents/synk-vendor/minigame-voice/raw/<목소리>/<요청 해시>.wav — 목소리·설정·글이 같으면 다시 사지 않는다.
// 배역·설정은 tools/minigame-voice-casting.json, 게임별 작업·후처리는 tools/lib/미니게임목소리_게임.cjs.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const V = require('./lib/미니게임목소리.cjs'), G = require('./lib/미니게임목소리_게임.cjs');

const argv = process.argv.slice(2);
const flag = name => argv.includes(name), arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const PORT = Number(arg('--port') || 5245), ORIGIN = 'http://127.0.0.1:' + PORT, NONCE = crypto.randomBytes(24).toString('hex');
const WORKERS = Math.max(1, Math.min(4, Number(arg('--workers') || 2)));
const STAGE_WORKERS = Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2)));
const METER = path.join(V.VENDOR, 'meter.json'), SAMPLES = path.join(V.VENDOR, 'samples'), SAMPLE_INDEX = path.join(SAMPLES, 'index.json');
const CATALOG_REL = 'docs/마케팅/SHIFT_과정1편_20260921/audio/voice-catalog.json';
const FATAL = new Set([401, 402, 403]);
// Typecast 주소. 흐름 시험(가짜 Typecast)만 SYNK_TYPECAST_API로 바꾸며, 키가 밖으로 나가지 않게 이 컴퓨터(127.0.0.1) 주소만 받는다.
const API = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SYNK_TYPECAST_API || '') ? process.env.SYNK_TYPECAST_API : 'https://api.typecast.ai';
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const selectedGames = text => { const list = (text || '').split(',').map(s => s.trim()).filter(Boolean); if (!list.length || list.includes('all')) return V.presentGames(); for (const g of list) if (!G.GAMES[g]) throw Error('모르는 게임: ' + g); return V.GAME_ORDER.filter(g => list.includes(g)); };

function loadCatalog() {
  const file = path.join(G.REPO, ...CATALOG_REL.split('/'));
  if (fs.existsSync(file)) return readJson(file, null);
  try { return JSON.parse(execFileSync('git', ['-C', G.REPO, 'show', 'HEAD:' + CATALOG_REL], { encoding: 'utf8', maxBuffer: 1 << 26 })); } catch { return null; }
}

// ── 적용(유료 호출 없음): 받아 둔 원본 → 무대에서 후처리·검사 → 모두 통과하면 게임 폴더에 넣고 목록·기록을 고친다 ──
function sourceInfo(job, adapter) {
  const v = job.voice;
  return { sourceKey: job.key, text: job.text, ...(job.speaker ? { speaker: job.speaker } : {}), voice: v.voice.name, voiceId: v.voice.id, provider: 'Typecast', model: v.model,
    emotion: v.emotion, ...(v.emotion === V.SMART ? { previousText: v.previousText, nextText: v.nextText } : { intensity: v.intensity }),
    tempo: v.tempo, seed: v.seed, targetLufs: v.targetLufs, post: adapter.post };
}
function writeRecord(game, results, casting, repo = G.REPO) {
  const file = path.join(G.gameDir(game, repo), 'qa', 'voice.source.json'), prev = readJson(file, { lines: {} });
  const lines = { ...prev.lines };
  for (const r of results) lines[r.job.id] = { role: r.job.role, voice: r.job.voice.voice.name, tempo: r.job.voice.tempo, key: r.job.key,
    sha: Object.fromEntries(Object.keys(r.files).map(rel => [rel, crypto.createHash('sha256').update(fs.readFileSync(r.files[rel])).digest('hex').slice(0, 16)])) };
  const roles = [...new Set(Object.values(lines).map(l => l.role))];
  return { note: '미니게임 목소리 제작 기록(tools/미니게임_목소리.cjs). qa/·*.source.json이라 공개 묶음에서 빠진다. 배역·설정의 원본은 tools/minigame-voice-casting.json.',
    provider: 'Typecast', model: casting.model, post: G.GAMES[game].post, updatedAt: new Date().toISOString(),
    voices: Object.fromEntries(roles.map(r => [r, { label: casting.roles[r]?.label, ...(casting.roles[r]?.voice || {}), settings: casting.roles[r]?.settings }])), lines };
}
async function applyGame(game, jobs, { onStep = () => {}, stopped = () => false } = {}) {
  const adapter = G.GAMES[game], casting = V.loadCasting();
  const missing = jobs.filter(j => !fs.existsSync(V.rawPath(j.voice, j.key)));
  if (missing.length) return { ok: false, why: `원본 ${missing.length}줄이 아직 없다(적용하지 않음)` };
  const stage = path.join(V.VENDOR, 'stage', game);
  fs.rmSync(stage, { recursive: true, force: true });
  const results = new Array(jobs.length), problems = [];
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: STAGE_WORKERS }, async () => {
    while (next < jobs.length && !stopped()) {
      const i = next++, j = jobs[i];
      try {
        const r = await adapter.process(j, V.rawPath(j.voice, j.key), stage);
        results[i] = { job: j, ...r, source: sourceInfo(j, adapter) };
        problems.push(...adapter.validate(j, r.metrics).map(p => `${j.id}: ${p}`));
      } catch (e) { problems.push(`${j.id}: ${e.message}`); }
      onStep(++done, jobs.length);
    }
  }));
  if (stopped()) return { ok: false, why: '멈춤(적용하지 않음)' };
  if (problems.length) return { ok: false, why: `검사를 통과하지 못한 줄 ${problems.length}개 — 게임 폴더는 그대로`, problems: problems.slice(0, 40) };
  const changed = G.install(adapter, results, { jobs, record: writeRecord(game, results, casting) });
  return { ok: true, files: results.reduce((n, r) => n + Object.keys(r.files).length, 0), changed: [...new Set(changed)].filter(f => !/\.source\.json$/.test(f)).concat('qa/voice.source.json') };
}
// 샘플: 원본 → 그 게임의 후처리 → 저장소 밖 samples/<배역>/<목소리>/<게임>__<id>.(mp3|wav). 게임 폴더는 건드리지 않는다.
async function buildSamples(tasks) {
  const index = [];
  for (const t of tasks) {
    const raw = V.rawPath(t.job.voice, t.job.key);
    if (!fs.existsSync(raw)) continue;
    const adapter = G.GAMES[t.job.game], stage = path.join(V.VENDOR, 'sample-stage', t.job.voice.voice.id);
    try {
      const r = await adapter.process(t.job, raw, stage);
      const main = r.files[t.job.outputs.find(o => o.endsWith('.mp3')) || t.job.outputs[0]];
      const rel = [t.role, t.job.voice.voice.id, `${t.job.game}__${t.job.id}${path.extname(main)}`].join('/');
      fs.mkdirSync(path.dirname(path.join(SAMPLES, ...rel.split('/'))), { recursive: true });
      fs.copyFileSync(main, path.join(SAMPLES, ...rel.split('/')));
      index.push({ role: t.role, voice: t.job.voice.voice, alternate: t.alternate, game: t.job.game, id: t.job.id, text: t.job.text, file: rel, problems: adapter.validate(t.job, r.metrics) });
    } catch (e) { say(`샘플 후처리 실패 ${t.job.game}/${t.job.id}: ${e.message}`); }
  }
  const prev = readJson(SAMPLE_INDEX, []).filter(p => !index.some(x => x.file === p.file));
  fs.mkdirSync(SAMPLES, { recursive: true });
  fs.writeFileSync(SAMPLE_INDEX, JSON.stringify([...prev, ...index], null, 1));
  return index;
}
// 들어 보기: 정한 줄 × 후보 목소리 × 감정 방식(프리셋 이름 또는 smart). smart의 앞뒤 글은 줄마다 준다 — 소리로 나오지 않고 감정을 읽는 데만 쓴다.
// 결과는 저장소 밖 audition/<이름>/<목소리>/<감정>/<게임>__<id>.mp3와 index.json. 게임 폴더·배역 파일은 건드리지 않는다.
const AUDITION = path.join(V.VENDOR, 'audition');
async function auditionTasks(body, casting) {
  const { name, voices = [], emotions = ['normal'], lines = [] } = body;
  if (!/^[a-z0-9-]{3,40}$/.test(name || '')) throw Error('들어 보기 이름(name)은 영문 소문자·숫자·- 3~40자');
  if (!voices.length || !lines.length) throw Error('목소리(voices)와 줄(lines)을 주세요.');
  for (const v of voices) if (!V.VOICE_ID.test(v.id || '') || !v.name) throw Error('목소리 id·이름을 확인해 주세요: ' + JSON.stringify(v));
  for (const e of emotions) if (e !== V.SMART && !V.PRESETS.includes(e)) throw Error('모르는 감정: ' + e);
  const all = await V.allJobs({ casting, games: selectedGames([...new Set(lines.map(l => l.game))].join(',')) });
  const tasks = [];
  for (const l of lines) {
    const job = all.find(j => j.game === l.game && j.id === l.id);
    if (!job) throw Error(`줄 없음: ${l.game}/${l.id}`);
    // 발음 시험: 소리로 읽을 글을 바꿔 구워 볼 수 있다(text). 같은 줄의 여러 글은 tag로 가른다(파일 이름 <id>~<tag>).
    const text = l.text ? String(l.text) : job.text, tag = l.tag ? String(l.tag) : '';
    if (tag && !/^[a-z0-9-]{1,20}$/.test(tag)) throw Error('tag는 영문 소문자·숫자·- 20자까지: ' + tag);
    for (const voice of voices) for (const emotion of emotions) {
      const { previousText, nextText, ...base } = job.voice;
      const v = { ...base, voice: { id: voice.id, name: voice.name }, emotion, ...(emotion === V.SMART ? { previousText: String(l.previous || ''), nextText: String(l.next || '') } : {}) };
      tasks.push({ name, emotion, tag, job: { ...job, text, voice: v, key: V.cacheKey(v, text) } });
    }
  }
  return tasks;
}
async function buildAudition(tasks) {
  const name = tasks[0].name, dir = path.join(AUDITION, name), stageRoot = path.join(V.VENDOR, 'audition-stage', name), index = [];
  for (const t of tasks) {
    const raw = V.rawPath(t.job.voice, t.job.key);
    if (!fs.existsSync(raw)) continue;
    const adapter = G.GAMES[t.job.game], v = t.job.voice;
    try {
      const r = await adapter.process(t.job, raw, path.join(stageRoot, v.voice.id, t.emotion));
      const main = r.files[t.job.outputs.find(o => o.endsWith('.mp3')) || t.job.outputs[0]];
      const rel = [v.voice.id, t.emotion, `${t.job.game}__${t.job.id}${t.tag ? '~' + t.tag : ''}${path.extname(main)}`].join('/');
      fs.mkdirSync(path.dirname(path.join(dir, ...rel.split('/'))), { recursive: true });
      fs.copyFileSync(main, path.join(dir, ...rel.split('/')));
      index.push({ game: t.job.game, id: t.job.id, ...(t.tag ? { tag: t.tag } : {}), role: t.job.role, text: t.job.text, voice: v.voice, emotion: t.emotion, tempo: v.tempo,
        ...(t.emotion === V.SMART ? { previous: v.previousText, next: v.nextText } : {}), seconds: Math.round((await G.probe(main)).duration * 1000) / 1000,
        file: rel, key: t.job.key, problems: adapter.validate(t.job, r.metrics) });
    } catch (e) { say(`들어 보기 후처리 실패 ${t.job.game}/${t.job.id}: ${e.message}`); }
  }
  const prev = readJson(path.join(dir, 'index.json'), []).filter(p => !index.some(x => x.file === p.file));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([...prev, ...index], null, 1));
  fs.rmSync(stageRoot, { recursive: true, force: true });
  return index;
}

// ── 미리보기·오프라인 적용 ────────────────────────────────────────────────
async function cli() {
  if (flag('--help')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 16).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return true; }
  if (flag('--dry-run')) {
    const r = await V.dryRun({ games: selectedGames(arg('--game')), catalog: loadCatalog() });
    if (flag('--jobs')) console.log(['게임\tid\t배역\t목소리\ttempo\t글자\t출력\t글', ...r.jobs.map(j => [j.game, j.id, j.role, j.voice.voice.name, j.voice.tempo, [...j.text].length, j.outputs.join(' '), j.text].join('\t'))].join('\n'));
    else if (flag('--json')) { const { jobs, ...rest } = r; console.log(JSON.stringify(rest, null, 1)); } else console.log(V.formatDryRun(r));
    process.exitCode = r.problems.length ? 1 : 0;
    return true;
  }
  if (arg('--apply')) {
    const games = selectedGames(arg('--apply'));
    const jobs = await V.allJobs({ games });
    for (const g of games) {
      const r = await applyGame(g, jobs.filter(j => j.game === g), { onStep: (d, n) => { if (d % 200 === 0 || d === n) process.stdout.write(`\r  ${g} ${d}/${n}`); } });
      console.log(`\n${g}: ${r.ok ? `적용 ${r.files}개 파일 · 목록 ${r.changed.join(', ')}` : r.why}`);
      if (r.problems) console.log(r.problems.map(p => '  ✗ ' + p).join('\n'));
    }
    return true;
  }
  return false;
}

// ── Typecast 연결(키는 메모리에만) ─────────────────────────────────────────
let key = '', account = null, expiresAt = null, expiryTimer = null;
const forget = () => { key = ''; account = null; expiresAt = null; clearTimeout(expiryTimer); };
// 키 파일(10-07 유호님 「브라우저가 안 보여서」): 유호님이 이 PC의 보안 폴더에 키를 둔 파일을 두면 10초마다 보고 연결한다.
// 키는 메모리로만 읽고 화면·기록·파일에 출력하지 않는다. 파일은 지우거나 고치지 않는다. 같은 내용으로 연결이 실패하면 다시 시도하지 않는다.
const KEY_FILE = arg('--key-file') || path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
function watchKeyFile() {
  let failedHash = null, busy = false;
  const tick = async () => {
    if (key || busy || !fs.existsSync(KEY_FILE)) return;
    busy = true;
    try {
      const candidate = (fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '');
      const hash = crypto.createHash('sha256').update(candidate).digest('hex');
      if (candidate.length < 10 || hash === failedHash) return;
      try {
        const sub = await api('/v1/users/me/subscription', 'GET', null, candidate);
        if (credits(sub).left < 1000) { failedHash = hash; say('키 파일 연결: 월 제공 크레딧이 부족해 연결하지 않음'); return; }
        forget(); key = candidate; account = { plan: sub.plan }; expiresAt = new Date(Date.now() + 7200000).toISOString();
        expiryTimer = setTimeout(forget, 7200000); expiryTimer.unref();
        say('연결됨(보안 폴더의 키 파일에서 — 키는 메모리에만)');
      } catch (e) { failedHash = hash; say('키 파일 연결 실패: ' + (e.status ? 'Typecast HTTP ' + e.status : '연결 오류')); }
    } finally { busy = false; }
  };
  setInterval(tick, 10000).unref(); tick();
}
async function api(route, method = 'GET', body, candidate = key) {
  const response = await fetch(API + route, { method, headers: { 'X-API-KEY': candidate, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
  if (!response.ok) { const e = Error('Typecast HTTP ' + response.status); e.status = response.status; e.retryAfter = Number(response.headers.get('retry-after')) || null; throw e; }
  return response.json();
}
const credits = sub => { const c = sub?.credits; if (!Number.isFinite(c?.plan_credits) || !Number.isFinite(c?.used_credits)) throw Error('월 제공 크레딧 잔량을 확인할 수 없습니다.'); return { plan: c.plan_credits, used: c.used_credits, left: c.plan_credits - c.used_credits }; };
async function withRetry(fn, stopped) {
  const waits = [2000, 5000, 10000, 20000];
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (FATAL.has(e.status) || [400, 404, 413, 422].includes(e.status) || i >= waits.length || stopped()) throw e;
      await sleep(e.retryAfter ? Math.min(60000, e.retryAfter * 1000) : waits[i]);
    }
  }
}
async function makeRaw(job) {
  const file = V.rawPath(job.voice, job.key);
  if (fs.existsSync(file)) return false;
  const request = V.request(job.voice, job.text);
  const data = await api('/v1/text-to-speech/with-timestamps', 'POST', request);
  const bytes = Buffer.from(data.audio || '', 'base64');
  if (bytes.length < 1000 || bytes.toString('ascii', 0, 4) !== 'RIFF') throw Error('빈 음성이거나 wav가 아님');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { audio, ...meta } = data;
  fs.writeFileSync(file.replace(/\.wav$/, '.json'), JSON.stringify({ request, voiceName: job.voice.voice.name, game: job.game, id: job.id, at: new Date().toISOString(), ...meta }, null, 1));
  fs.writeFileSync(file + '.part', bytes); fs.renameSync(file + '.part', file);
  return true;
}

// ── 실행 상태 ─────────────────────────────────────────────────────────────
let meter = readJson(METER, null);   // { chars, spent, perChar } — 실제로 쓴 크레딧 / 보낸 글자
// 어림에 쓰는 글자당 크레딧: 잰 값이 1보다 작아도(잔량 반영이 늦거나 띄어쓰기를 안 세도) 1로 넉넉히 잡는다.
const perChar = () => Math.max(1, meter?.perChar || 1);
let state = { running: false, phase: '대기', log: [] };
const say = text => { state.log = [...state.log.slice(-14), `${new Date().toLocaleTimeString('ko-KR')} ${text}`]; };

async function fetchRaw(jobs) {
  const todo = V.unique(jobs).filter(j => !fs.existsSync(V.rawPath(j.voice, j.key)));
  Object.assign(state, { phase: 'Typecast에서 받기', total: todo.length, done: 0, called: 0, failed: 0, chars: 0, errors: [] });
  if (!todo.length) { say('받을 줄 없음 — 모두 원본이 있다'); return; }
  const before = credits(await api('/v1/users/me/subscription'));
  state.creditsStart = before; state.creditsNow = before;
  const need = Math.ceil(V.chars(todo) * perChar() * 1.05);
  if (need > before.left) throw Error(`어림 ${need} 크레딧이 남은 ${before.left}보다 많다 — 추가 결제 없이 멈춤`);
  say(`받기 시작: ${todo.length}줄 ${V.chars(todo)}자 · 남은 크레딧 ${before.left}`);
  const queue = todo.slice(), maxChars = Math.max(...todo.map(j => [...j.text].length));
  let consecutive = 0, fatal = null, sinceCheck = 0, sentChars = 0;
  const stopped = () => state.stopRequested || !!fatal;
  const worker = async () => {
    while (queue.length && !stopped()) {
      const j = queue.shift();
      try {
        if (await withRetry(() => makeRaw(j), stopped)) { state.called++; state.chars += [...j.text].length; sentChars += [...j.text].length; sinceCheck++; }
        consecutive = 0;
      } catch (e) {
        state.failed++; consecutive++;
        state.errors = [...state.errors.slice(-9), `${j.game}/${j.id}: ${e.message}`];
        if (FATAL.has(e.status)) { fatal = Error(e.status === 401 ? 'API 키가 맞지 않습니다(연결을 지웠습니다).' : `Typecast가 거절했습니다(HTTP ${e.status}) — 크레딧·권한을 확인해 주세요.`); if (e.status === 401) forget(); }
        else if (consecutive >= 3) fatal = Error('오류가 세 번 이어져 멈췄습니다: ' + e.message);
      }
      state.done++;
      if (sinceCheck >= 25 && !fatal) {
        sinceCheck = 0;
        try {
          state.creditsNow = credits(await api('/v1/users/me/subscription'));
          const rest = Math.ceil(V.chars(queue) * perChar());
          if (state.creditsNow.left < Math.max(maxChars * 2, Math.min(rest, 1000))) fatal = Error(`월 제공 크레딧이 거의 다 됐습니다(남은 ${state.creditsNow.left}) — 추가 결제 없이 멈춤`);
        } catch (e) { say('잔량 확인 실패: ' + e.message); }
      }
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  if (key) {
    try {
      state.creditsNow = credits(await api('/v1/users/me/subscription'));
      const spent = state.creditsNow.used - before.used;
      if (sentChars > 0) {
        meter = { chars: (meter?.chars || 0) + sentChars, spent: (meter?.spent || 0) + spent, at: new Date().toISOString() };
        meter.perChar = +(meter.spent / meter.chars).toFixed(3);
        fs.mkdirSync(V.VENDOR, { recursive: true }); fs.writeFileSync(METER, JSON.stringify(meter, null, 1));
      }
      say(`받기 끝: ${state.called}줄 새로 · 실패 ${state.failed} · 이번에 쓴 크레딧 ${spent} (글자당 ${meter?.perChar ?? '-'})`);
    } catch (e) { say('끝 잔량 확인 실패: ' + e.message); }
  }
  if (fatal) throw fatal;
  if (state.stopRequested) throw Error('멈춤 — 받은 원본은 남아 있어 다시 누르면 이어서 받는다');
}

let starting = false;   // 시작 전 점검(잔량·미리보기) 중에 두 번 눌러 둘이 함께 시작하지 않게
async function startRun(body) {
  if (state.running || starting) throw Error('이미 만드는 중');
  if (!key) throw Error('먼저 Typecast 키를 연결해 주세요.');
  starting = true;
  try { return await beginRun(body); } finally { starting = false; }
}
async function beginRun(body) {
  const casting = V.loadCasting(), mode = body.mode;
  if (mode === 'sample') {
    const tasks = V.sampleTasks(await V.allJobs({ casting }), casting, { alternates: !!body.alternates });
    const pending = V.unique(tasks.map(t => t.job)).filter(j => !fs.existsSync(V.rawPath(j.voice, j.key)));
    state = { running: true, mode, phase: '시작', log: state.log, startedAt: new Date().toISOString(), estimate: { lines: pending.length, chars: V.chars(pending) }, applied: {} };
    (async () => {
      try { await fetchRaw(tasks.map(t => t.job)); state.phase = '샘플 후처리'; const made = await buildSamples(tasks); say(`샘플 ${made.length}개 준비 — 화면에서 들어 보세요`); state.phase = '끝'; }
      catch (e) { state.phase = '멈춤'; state.stopReason = e.message; say('멈춤: ' + e.message); }
      finally { state.running = false; state.endedAt = new Date().toISOString(); }
    })();
    return { started: true, estimate: state.estimate };
  }
  if (mode === 'audition') {
    const tasks = await auditionTasks(body, casting);
    const pending = V.unique(tasks.map(t => t.job)).filter(j => !fs.existsSync(V.rawPath(j.voice, j.key)));
    // smart의 앞뒤 글은 Typecast 문서에 값 이야기가 없어 따로 센다. 10-08 실측으로는 값에 들지 않았다
    // (해설 들어 보기 52줄: 글 1,444자 + 앞뒤 글 866자 → 잔량 1,444 줄어듦). 남은 크레딧 비교에만 넉넉히 더한다.
    const contextChars = pending.reduce((n, j) => n + [...(j.voice.previousText || '') + (j.voice.nextText || '')].length, 0);
    const left = credits(await api('/v1/users/me/subscription')).left, estimate = Math.ceil(V.chars(pending) * perChar());
    if (estimate + contextChars > left) throw Error(`어림 ${estimate + contextChars} 크레딧이 남은 ${left}보다 많다 — 추가 결제 없이 멈춤`);
    if (!body.confirmed) return { needConfirm: true, tasks: tasks.length, lines: pending.length, chars: V.chars(pending), contextChars, estimate, left, share: +(100 * estimate / left).toFixed(2) };
    state = { running: true, mode, phase: '시작', log: state.log, startedAt: new Date().toISOString(), estimate: { lines: pending.length, chars: V.chars(pending), contextChars, credits: estimate, left }, applied: {} };
    (async () => {
      try {
        await fetchRaw(tasks.map(t => t.job));
        state.phase = '들어 보기 후처리';
        const made = await buildAudition(tasks);
        state.audition = { name: body.name, made: made.length, dir: path.join(AUDITION, body.name) };
        say(`들어 보기 ${made.length}개 준비 — ${state.audition.dir}`); state.phase = '끝';
      } catch (e) { state.phase = '멈춤'; state.stopReason = e.message; say('멈춤: ' + e.message); }
      finally { state.running = false; state.endedAt = new Date().toISOString(); }
    })();
    return { started: true, estimate: state.estimate };
  }
  if (mode !== 'all') throw Error('mode는 sample·audition·all 가운데 하나');
  if (!meter?.perChar && !body.force) throw Error('먼저 「샘플 만들기」로 한 글자당 크레딧을 잰다.');
  const games = selectedGames((body.games || []).join(','));
  const jobs = await V.allJobs({ casting, games });
  const r = await V.dryRun({ casting, games });
  if (r.problems.length) throw Error('미리보기에서 문제가 있어 시작하지 않았다: ' + r.problems.slice(0, 3).join(' / '));
  const pending = V.unique(jobs).filter(j => !fs.existsSync(V.rawPath(j.voice, j.key)));
  const left = credits(await api('/v1/users/me/subscription')).left, estimate = Math.ceil(V.chars(pending) * perChar());
  if (estimate > left) throw Error(`어림 ${estimate} 크레딧이 남은 ${left}보다 많다 — 추가 결제 없이 멈춤`);
  // 전부 만들기는 늘 어림(줄·글자·크레딧·남은 크레딧)을 먼저 보여 주고 한 번 더 확인받는다. 명령으로는 {"confirmed":true}.
  if (!body.confirmed) return { needConfirm: true, lines: pending.length, chars: V.chars(pending), estimate, left, share: +(100 * estimate / left).toFixed(1), games };
  state = { running: true, mode, games, phase: '시작', log: state.log, startedAt: new Date().toISOString(), estimate: { lines: pending.length, chars: V.chars(pending), credits: estimate, left }, applied: {} };
  (async () => {
    try {
      await fetchRaw(jobs);
      for (const g of games) {
        if (state.stopRequested) break;
        state.phase = `${G.GAMES[g].label} 후처리·적용`;
        const res = await applyGame(g, jobs.filter(j => j.game === g), { onStep: (d, n) => { state.applyDone = d; state.applyTotal = n; }, stopped: () => !!state.stopRequested });
        state.applied[g] = res;
        say(`${G.GAMES[g].label}: ${res.ok ? `적용 ${res.files}개 파일` : res.why}`);
      }
      state.phase = '끝';
    } catch (e) { state.phase = '멈춤'; state.stopReason = e.message; say('멈춤: ' + e.message); }
    finally { state.running = false; state.endedAt = new Date().toISOString(); }
  })();
  return { started: true, estimate: state.estimate };
}

// 배역 바꾸기: 그 배역의 후보(또는 목록에 있는 목소리)로. 앞의 기본값은 후보로 내려간다. tools/minigame-voice-casting.json을 고친다.
function setCast(role, voiceId) {
  if (!V.VOICE_ID.test(voiceId || '')) throw Error('목소리 id를 확인해 주세요.');
  const casting = V.loadCasting(), r = casting.roles[role];
  if (!r) throw Error('모르는 배역: ' + role);
  if (r.fixed) throw Error(`${r.label}은 유호님이 정한 목소리(${r.voice.name})라 여기서 바꾸지 않는다.`);
  if (r.voice.id === voiceId) return r.voice;
  const catalog = loadCatalog() || [], c = catalog.find(x => x.voice_id === voiceId);
  const pick = (r.alternates || []).find(a => a.id === voiceId) || (c && { id: voiceId, name: c.voice_name.kor, preview: c.preview_url });
  if (!pick) throw Error('후보나 목록에 없는 목소리');
  r.alternates = [r.voice, ...(r.alternates || []).filter(a => a.id !== voiceId)];
  r.voice = pick; r.chosen = { at: new Date().toISOString(), note: '화면에서 고름(귀 확인 뒤)' };
  fs.writeFileSync(V.CASTING_FILE, JSON.stringify(casting, null, 2) + '\n');
  return pick;
}

// ── 화면 ─────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = x => Number(x).toLocaleString('ko-KR');
async function page() {
  const casting = V.loadCasting(), r = await V.dryRun({ casting, catalog: null });
  const samples = readJson(SAMPLE_INDEX, []);
  const sampleButtons = (role, voiceId) => {
    const mine = samples.filter(s => s.role === role && s.voice.id === voiceId);
    return mine.length ? mine.map(s => `<button class="clip" data-src="/sample/${esc(s.file)}" title="${esc(s.text + (s.problems?.length ? '\n⚠ ' + s.problems.join(' / ') : ''))}">${s.problems?.length ? '⚠ ' : ''}${esc(G.GAMES[s.game].label)} · ${esc(s.text.length > 16 ? s.text.slice(0, 15) + '…' : s.text)}</button>`).join('') : '<span class="muted">샘플 아직 없음</span>';
  };
  const voiceCell = (role, v, main, fixed) => `<div class="voice ${main ? 'main' : ''}"><div class="vname">${esc(v.name)}${main ? ' <span class="tag">기본</span>' : ''}</div>
    ${v.why ? `<div class="why">${esc(v.why)}</div>` : ''}${v.measure ? `<div class="meta">${esc(v.measure)}</div>` : ''}
    ${v.preview ? `<audio controls preload="none" src="${esc(v.preview)}"></audio>` : ''}<div class="row">${sampleButtons(role, v.id)}</div>
    ${main || fixed ? '' : `<button class="cast" data-role="${esc(role)}" data-voice="${esc(v.id)}">이 목소리로 바꾸기</button>`}</div>`;
  const roles = Object.entries(r.perRole).map(([role, x]) => {
    const c = casting.roles[role];
    return `<section class="role"><h3>${esc(c.label)} <small>${esc(role)} · ${n(x.lines)}줄 ${n(x.chars)}자 · ${esc(Object.keys(x.games).map(g => G.GAMES[g].label).join('·'))} · 빠르기 ${x.tempos.join('/')}</small></h3>
      <p class="why">${esc(c.why || '')}</p><div class="voices">${voiceCell(role, c.voice, true, c.fixed)}${(c.alternates || []).map(a => voiceCell(role, a, false, c.fixed)).join('')}</div></section>`;
  }).join('');
  const games = Object.entries(r.perGame).map(([id, g]) => `<tr><td>${esc(g.label)}</td><td>${n(g.lines)}</td><td>${n(g.chars)}</td><td>${n(g.cached)}/${n(g.unique)}</td><td class="small">${esc(g.post)}</td><td class="applied" data-game="${esc(id)}"></td></tr>`).join('');
  const options = Object.entries(r.perGame).map(([id, g]) => `<option value="${esc(id)}">${esc(g.label)} — ${n(g.lines)}줄 ${n(g.billable)}자</option>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>미니게임 목소리 · Typecast</title><style>
  body{font:16px/1.6 system-ui;color:#2b2320;background:#fbf7f0;margin:0}main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:28px 0 8px}h3{font-size:18px;margin:0}
  small,.muted,.meta,.small{color:#6b645b;font-size:13px}p{margin:6px 0;color:#575046}.box{background:#fef0e9;border-radius:12px;padding:14px 16px}
  section,.panel{background:#fffdf8;border-radius:16px;padding:16px;margin-top:12px;box-shadow:0 8px 20px -14px rgba(73,45,30,.4)}
  input,button,select{font:inherit;border-radius:10px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #bbb}button{border:0;padding:10px 14px;background:#2b2320;color:#fff;cursor:pointer}button:disabled{opacity:.4;cursor:default}
  .actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.actions select{padding:10px}.voices{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:8px}
  .voice{border:1px solid #eadfce;border-radius:12px;padding:10px}.voice.main{border-color:#f96859}.vname{font-weight:750}.tag{font-size:12px;background:#fef0e9;color:#ae322a;border-radius:999px;padding:1px 8px}
  .why{font-size:14px}audio{width:100%;margin-top:6px}.row{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.clip{background:#fff;color:#2b2320;border:1px solid #e2d9cb;padding:6px 10px;font-size:13px}.clip.playing{border-color:#f96859;color:#ae322a}
  .cast{margin-top:8px;background:#fff;color:#ae322a;border:1px solid #f3b6ae;font-size:13px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #eee3d3;padding:6px;text-align:left;vertical-align:top}
  td:first-child,th{white-space:nowrap}td.applied{min-width:80px}
  #state{font-weight:700}#log{white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace;color:#4d463d;margin-top:8px}progress{width:100%;height:12px}</style></head><body><main>
  <h1>미니게임 목소리 · Typecast로 다시 굽기</h1>
  <p>레이싱·입장 검사·이야기 교실·말의 리듬·말 랠리·바람길·주문 폭주의 목소리를 Typecast 목소리로 바꿉니다. 글은 바꾸지 않고, 파일 이름·형식·크기·앞뒤 여백은 지금 게임과 같게 맞춥니다.</p>
  <div class="box">모두 ${n(r.totals.lines)}줄 · ${n(r.totals.chars)}자 · 부를 글자 ${n(r.totals.billable)}자(같은 글은 한 번) — 월 ${n(r.totals.plan)} 크레딧의 ${(100 * r.totals.billable / r.totals.plan).toFixed(1)}% · 받아 둔 원본 ${n(r.totals.cached)}/${n(r.totals.requests)}
   · 샘플 ${r.samples.lines}줄 ${n(r.samples.chars)}자(후보까지 ${n(r.samples.withAlternates.chars)}자)${meter?.perChar ? ` · 잰 비율 글자당 ${meter.perChar} 크레딧` : ''}</div>
  <div class="panel"><p><a href="https://studio.typecast.ai/developers/api" target="_blank" rel="noreferrer">Typecast 로그인 · 기존 API 키 확인 ↗</a> — 기존 계정의 API 키를 복사해 붙여 넣어 주세요. 구글 로그인은 평소 크롬에서 여는 편이 좋습니다.</p>
   <form id="form"><input id="key" type="password" autocomplete="off" placeholder="기존 Typecast API 키" required><button id="connect" style="margin-top:8px">연결 확인</button></form>
   <small>키는 이 컴퓨터의 임시 연결에만 보관하고 파일·채팅에 저장하지 않습니다. 2시간 뒤 잊습니다. 월 제공 크레딧이 모자라면 멈추고 새 결제나 충전을 하지 않습니다.</small>
   <p id="state" role="status">상태를 불러오는 중…</p><progress id="bar" value="0" max="1"></progress>
   <div class="actions"><button data-run="sample">샘플 만들기(배역마다 두 줄)</button><button data-run="sample-alt">후보 목소리까지 샘플</button>
    <select id="games"><option value="all">전체 일곱 게임 — ${n(r.totals.lines)}줄</option>${options}</select><button data-run="all">전부 만들기</button><button id="stop">멈추기</button></div>
   <div id="log"></div></div>
  <h2>게임</h2><div class="panel"><table><tr><th>게임</th><th>줄</th><th>글자</th><th>원본</th><th>후처리(지금 게임과 같게)</th><th>적용</th></tr>${games}</table></div>
  <h2>배역</h2><p class="muted">공식 미리듣기는 바로 들을 수 있고, 샘플은 만든 뒤 여기서 게임과 같은 후처리를 거친 소리로 들립니다. 측정값(음높이·밝기·빠르기)은 미리듣기 앞부분에서 잰 참고값이라 귀로 듣는 판단을 대신하지 않습니다.</p>${roles}
  </main><script nonce="${NONCE}">
  const T='${NONCE}',post=(url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':T},body:JSON.stringify(body||{})}).then(async r=>({ok:r.ok,data:await r.json()}));
  const $=s=>document.querySelector(s);let was=false;
  $('#form').onsubmit=async e=>{e.preventDefault();const v=$('#key').value;$('#key').value='';$('#state').textContent='연결과 잔량을 확인하고 있어요…';const r=await post('/connect',{key:v});$('#state').textContent=r.ok?'연결됐습니다.':r.data.error;};
  document.querySelectorAll('[data-run]').forEach(b=>b.onclick=async()=>{const kind=b.dataset.run;const body=kind==='all'?{mode:'all',games:$('#games').value==='all'?[]:[$('#games').value]}:{mode:'sample',alternates:kind==='sample-alt'};
   let r=await post('/generate',body);if(r.ok&&r.data.needConfirm){const d=r.data;if(!confirm('새로 받을 줄 '+d.lines+'개 · '+d.chars+'자\n어림 '+d.estimate+' 크레딧 = 남은 '+d.left+'의 '+d.share+'%\n(받아 둔 원본은 다시 사지 않습니다)\n만들까요?'))return;r=await post('/generate',{...body,confirmed:true});}
   $('#state').textContent=r.ok?'시작했습니다.':r.data.error;});
  $('#stop').onclick=()=>post('/stop');
  document.querySelectorAll('.cast').forEach(b=>b.onclick=async()=>{const r=await post('/cast',{role:b.dataset.role,voiceId:b.dataset.voice});if(r.ok)location.reload();else alert(r.data.error);});
  let cur=null;document.querySelectorAll('.clip').forEach(b=>b.onclick=()=>{if(cur){cur.a.pause();cur.b.classList.remove('playing')}const a=new Audio(b.dataset.src);cur={a,b};b.classList.add('playing');a.onended=()=>b.classList.remove('playing');a.play();});
  const tick=async()=>{try{const s=await (await fetch('/status')).json();const st=s.state;
   const cr=st.creditsNow?(' · 남은 크레딧 '+st.creditsNow.left+(st.creditsStart?' (이번에 '+(st.creditsNow.used-st.creditsStart.used)+')':'')):'';
   const eta=st.running&&st.total&&st.done&&st.startedAt?Math.round((Date.now()-Date.parse(st.startedAt))/st.done*(st.total-st.done)/60000):null;
   $('#state').textContent=(s.connected?'연결됨':'연결 전')+' · '+st.phase+(st.total?' · '+st.done+'/'+st.total+'줄 · 보낸 글자 '+(st.chars||0)+(st.failed?' · 실패 '+st.failed:''):'')+(eta!==null&&st.done<st.total?' · 남은 시간 약 '+eta+'분':'')+(st.applyTotal&&st.running?' · 후처리 '+st.applyDone+'/'+st.applyTotal:'')+cr+(st.stopReason?' — '+st.stopReason:'');
   $('#bar').max=st.total||1;$('#bar').value=st.done||0;$('#log').textContent=(st.log||[]).join('\\n')+((st.errors||[]).length?'\\n오류: '+st.errors.join('\\n'):'');
   for(const [g,res] of Object.entries(st.applied||{})){const td=document.querySelector('.applied[data-game="'+g+'"]');if(td)td.textContent=res.ok?'적용 '+res.files+'개':res.why;}
   if(was&&!st.running)location.reload();was=st.running;}catch{}};tick();setInterval(tick,1500);
  </script></body></html>`;
}

// ── 서버 ─────────────────────────────────────────────────────────────────
const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
// 브라우저 요청은 이 화면(Origin + 화면 토큰)만, 이 컴퓨터의 명령(Origin 없음)은 키 연결만 빼고 받는다. 다른 사이트의 요청은 Origin으로 막힌다.
function allowed(req, url) {
  if (req.headers.host !== '127.0.0.1:' + PORT) return 'Host rejected';
  if (req.method !== 'POST') return null;
  if (req.headers.origin) return req.headers.origin === ORIGIN && req.headers['x-local-token'] === NONCE ? null : 'Origin rejected';
  return url === '/connect' ? 'Form token required' : null;
}
function serve() {
  http.createServer(async (req, res) => {
    try {
      const url = req.url.split('?')[0], why = allowed(req, url);
      if (why) return reply(res, 403, { error: why });
      if (req.method === 'GET' && url === '/status') return reply(res, 200, { project: 'synk-minigame-voice', connected: !!key, plan: account?.plan || null, expiresAt, meter, state });
      if (req.method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${NONCE}'; connect-src 'self'; media-src 'self' https://static2.typecast.ai; form-action 'self'; frame-ancestors 'none'` });
        return res.end(await page());
      }
      const sample = req.method === 'GET' && /^\/sample\/([a-z]+)\/(tc_[0-9a-f]{24})\/([a-z0-9-]+__[A-Za-z0-9._-]+\.(mp3|wav))$/.exec(url);
      if (sample) {
        const file = path.join(SAMPLES, sample[1], sample[2], sample[3]);
        if (!fs.existsSync(file)) return reply(res, 404, { error: 'Not found' });
        const data = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': sample[4] === 'mp3' ? 'audio/mpeg' : 'audio/wav', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
        return res.end(data);
      }
      if (req.method !== 'POST') return reply(res, 404, { error: 'Not found' });
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16000) throw Error('Request too large'); }
      const body = JSON.parse(raw || '{}');
      if (url === '/connect') {
        if (typeof body.key !== 'string' || body.key.trim().length < 10) throw Error('기존 API 키를 확인해 주세요.');
        const candidate = body.key.trim(), sub = await api('/v1/users/me/subscription', 'GET', null, candidate);
        if (credits(sub).left < 1000) throw Error('기존 월 제공 크레딧이 부족합니다. 추가 결제 없이 중단했습니다.');
        forget(); key = candidate; account = { plan: sub.plan }; expiresAt = new Date(Date.now() + 7200000).toISOString();
        expiryTimer = setTimeout(forget, 7200000); expiryTimer.unref();
        say('연결됨(키는 메모리에만)');
        return reply(res, 200, { connected: true, left: credits(sub).left });
      }
      if (url === '/disconnect') { forget(); return reply(res, 200, { connected: false }); }
      if (url === '/stop') { if (state.running) { state.stopRequested = true; say('멈추는 중 — 지금 받는 줄까지 마친다'); } return reply(res, 200, { stopping: !!state.running }); }
      if (url === '/generate') return reply(res, 200, await startRun(body));
      if (url === '/cast') { if (state.running) throw Error('만드는 중에는 배역을 바꾸지 않는다'); return reply(res, 200, { voice: setCast(body.role, body.voiceId) }); }
      return reply(res, 404, { error: 'Not found' });
    } catch (error) { reply(res, 400, { error: error.message }); }
  }).listen(PORT, '127.0.0.1', async () => {
    // 흐름 시험(가짜 Typecast)에서는 보안 폴더의 실제 키 파일을 읽지 않는다(10-07 시험이 실제 키를 가짜 서버로 보내 실패 문구에 찍힘).
    if (!process.env.SYNK_TYPECAST_API || arg('--key-file')) watchKeyFile();
    try {
      const r = await V.dryRun({ catalog: loadCatalog() });
      console.log(`미니게임 목소리: ${ORIGIN} — ${r.totals.lines}줄 ${r.totals.chars}자(부를 글자 ${r.totals.billable}) · 받아 둔 원본 ${r.totals.cached}/${r.totals.requests}${r.problems.length ? ` · 미리보기 문제 ${r.problems.length}개(--dry-run으로 확인)` : ''}`);
    } catch (e) { console.log(`미니게임 목소리: ${ORIGIN} — 미리보기 실패: ${e.message}`); }
  });
}

if (require.main === module) (async () => { if (!(await cli())) serve(); })().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { applyGame, buildSamples, auditionTasks, allowed: (req, url) => allowed(req, url), sourceInfo, writeRecord };
