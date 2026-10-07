'use strict';
// 미니게임 목소리 — 배역(tools/minigame-voice-casting.json)·작업 목록·원본 저장소(캐시)·미리보기(dry-run).
// 유료 호출은 여기 없다. Typecast를 부르는 곳은 tools/미니게임_목소리.cjs 하나이고, 이 파일은 그 요청의 모양과 열쇠만 만든다.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const G = require('./미니게임목소리_게임.cjs');

const CASTING_FILE = path.join(G.REPO, 'tools', 'minigame-voice-casting.json');
// 원본·샘플·무대 자리(저장소 밖). SYNK_MINIGAME_VOICE_VENDOR는 흐름 시험의 임시 폴더용.
const VENDOR = process.env.SYNK_MINIGAME_VOICE_VENDOR ? path.resolve(process.env.SYNK_MINIGAME_VOICE_VENDOR) : path.join(os.homedir(), 'Documents', 'synk-vendor', 'minigame-voice');
const VOICE_ID = /^tc_[0-9a-f]{24}$/;
const GAME_ORDER = ['korean-racing', 'entry-check', 'story-classroom', 'korean-rhythm', 'talk-rally', 'korean-runner', 'order-rush'];
const PLAN_CREDITS = 200000;   // Typecast API Lite 월 제공(유호님 요금제, 1글자 = 1크레딧 기준)

const loadCasting = (file = CASTING_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));
// 이 저장소에 있는 게임만(흐름 시험의 임시 사본처럼 일부만 있는 작업본). 실제 저장소에는 일곱 게임이 다 있어야 한다(시험이 본다).
const presentGames = (repo = G.REPO) => GAME_ORDER.filter(id => fs.existsSync(G.gameDir(id, repo)));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

// 한 줄을 누구 목소리·어떤 설정으로 부를지: 배역 기본값 ← 게임별(games) ← 줄별(lines["게임/id"]).
function voiceFor(casting, job) {
  const role = casting.roles[job.role];
  if (!role) throw Error(`배역 없음: ${job.role} (${job.game}/${job.id})`);
  const s = { ...casting.defaults, ...role.settings, ...(casting.games?.[job.game]?.[job.role] || {}), ...(casting.lines?.[`${job.game}/${job.id}`] || {}) };
  const voice = s.voice || role.voice;
  return { voice: { id: voice.id, name: voice.name }, model: casting.model, language: casting.language,
    emotion: s.emotion, intensity: s.intensity, tempo: s.tempo, seed: s.seed, targetLufs: s.targetLufs };
}
// Typecast 요청 본문(한글단계_목소리.cjs와 같은 모양). 키는 머리에만 들어가고 여기에는 없다.
function request(v, text) {
  return { seed: v.seed, model: v.model, voice_id: v.voice.id, text, language: v.language,
    output: { audio_format: 'wav', audio_tempo: v.tempo, target_lufs: v.targetLufs },
    prompt: { emotion_type: 'preset', emotion_preset: v.emotion, emotion_intensity: v.intensity } };
}
// 원본 저장소의 열쇠 = 요청 본문(목소리·설정·글) 그대로의 해시. 같은 요청은 두 번 값을 내지 않는다.
const cacheKey = (v, text) => sha(JSON.stringify(request(v, text))).slice(0, 32);
const rawPath = (v, key, vendor = VENDOR) => path.join(vendor, 'raw', v.voice.id, key + '.wav');

// 모든 게임의 작업 + 목소리·열쇠. games를 주면 그 게임만.
async function allJobs({ casting = loadCasting(), repo = G.REPO, games = presentGames(repo) } = {}) {
  const out = [];
  for (const id of games) {
    const adapter = G.GAMES[id];
    if (!adapter) throw Error('모르는 게임: ' + id);
    for (const job of await adapter.jobs(repo)) {
      const v = voiceFor(casting, job);
      out.push({ ...job, voice: v, key: cacheKey(v, job.text) });
    }
  }
  return out;
}

const chars = list => list.reduce((n, j) => n + [...j.text].length, 0);
const unique = list => [...new Map(list.map(j => [j.key, j])).values()];

// 배역마다 샘플 두 줄: 그 배역이 나오는 처음 두 게임에서 한 줄씩(한 게임뿐이면 그 게임에서 두 줄).
// 12~40자 문장 가운데 중간 길이를 고른다(낱말 하나짜리 레이싱 보기 대신 문장).
function pickSamples(jobs) {
  const byRole = new Map();
  for (const j of jobs) { if (!byRole.has(j.role)) byRole.set(j.role, []); byRole.get(j.role).push(j); }
  const picks = [];
  for (const [role, list] of byRole) {
    const games = [...new Set(list.map(j => j.game))];
    const middle = (pool, skip = new Set()) => {
      const cands = pool.filter(j => !skip.has(j.key));
      const good = cands.filter(j => j.text.length >= 12 && j.text.length <= 40);
      const use = (good.length ? good : cands).slice().sort((a, b) => a.text.length - b.text.length || a.id.localeCompare(b.id));
      return use[Math.floor((use.length - 1) / 2)];
    };
    const first = middle(list.filter(j => j.game === games[0]));
    // 한 게임뿐이면 첫 줄과 다르게 시작하는 줄(「임무 완료. 케이크…」 「임무 완료. 리본…」처럼 같은 틀 두 번을 피한다)
    const lead = t => t.replace(/\s/g, '').slice(0, 4);
    const others = list.filter(j => j.key !== first.key && lead(j.text) !== lead(first.text));
    const second = games.length > 1 ? middle(list.filter(j => j.game === games[1])) : middle(others.length ? others : list, new Set([first.key]));
    picks.push(...[first, second].filter(Boolean).map(j => ({ role, job: j })));
  }
  return picks;
}
// 후보 목소리로도 같은 두 줄을 만든다(비교용).
function sampleTasks(jobs, casting, { alternates = false } = {}) {
  const tasks = [];
  for (const { role, job } of pickSamples(jobs)) {
    const voices = [casting.roles[role].voice, ...(alternates ? casting.roles[role].alternates || [] : [])];
    for (const voice of voices) {
      const v = { ...job.voice, voice: { id: voice.id, name: voice.name } };
      tasks.push({ role, job: { ...job, voice: v, key: cacheKey(v, job.text) }, alternate: voice.id !== casting.roles[role].voice.id });
    }
  }
  return tasks;
}

// 길이 어림(돈을 쓰기 전 위험 줄 찾기, 실제 길이는 만든 뒤 각 게임 검사가 다시 본다).
// Typecast 서현 실측(LAB 한글날, tempo 1.0 근처) 문장 5.2~7.1음절/초 → 느린 쪽 5.0음절/초로 잡는다.
const EST = { syllablesPerSecond: 5.0, sentencePause: 0.3, commaPause: 0.12,
  edges: { 'korean-racing': 1.0, 'korean-runner': 0.86, 'order-rush': 0.96, 'story-classroom': 1.16, 'korean-rhythm': 1.2, 'talk-rally': 0.13, 'entry-check': 0.24 } };
const LIMITS = [
  { game: 'korean-runner', when: j => !j.id.startsWith('check-'), max: 5.3, why: '부탁은 첫 동작 전에 끝나야 한다(build-voice-manifest.py)' },
  { game: 'korean-runner', when: j => j.id.startsWith('check-'), max: 8, why: '듣기 확인' },
  { game: 'talk-rally', when: j => j.group === 'voice', max: 2.5, why: '몽글의 말(core.test)' },
  { game: 'talk-rally', when: j => j.group === 'narration', max: 4.5, why: '안내(narration.test)' },
  { game: 'korean-rhythm', when: () => true, max: 14, why: '리듬 판에 들어가는 길이' },
  { game: 'order-rush', when: () => true, max: 15, why: 'qa/verify-assets.mjs' },
];
function estimateSeconds(job) {
  const t = job.text, syl = (t.match(/[가-힣]/g) || []).length;
  const inner = (t.replace(/[.!?…]+\s*$/, '').match(/[.!?](\s|$)/g) || []).length, commas = (t.match(/,/g) || []).length;
  return syl / (EST.syllablesPerSecond * (job.voice.tempo || 1)) + inner * EST.sentencePause + commas * EST.commaPause + (EST.edges[job.game] || 0.3);
}
function durationRisks(jobs, share = 0.85) {
  const out = [];
  for (const j of jobs) for (const l of LIMITS) if (l.game === j.game && l.when(j)) {
    const est = estimateSeconds(j);
    if (est > l.max * share) out.push({ game: j.game, id: j.id, text: j.text, estimate: Number(est.toFixed(2)), max: l.max, why: l.why });
  }
  return out;
}

// 배역 점검: 쓰는 배역마다 목소리가 있고, 같은 게임 안에서 서로 다른 배역이 같은 목소리를 쓰지 않는다.
function castingProblems(casting, jobs, catalog = null) {
  const bad = [], used = [...new Set(jobs.map(j => j.role))];
  for (const role of used) {
    const r = casting.roles[role];
    if (!r) { bad.push(`배역 없음: ${role}`); continue; }
    for (const v of [r.voice, ...(r.alternates || [])]) {
      if (!VOICE_ID.test(v.id || '')) bad.push(`${role}: 목소리 id 모양이 아님 ${v.id}`);
      if (catalog) {
        const c = catalog.find(x => x.voice_id === v.id);
        if (!c) bad.push(`${role}: 목록에 없는 목소리 ${v.name} ${v.id}`);
        else if (!c.models.some(m => m.version === casting.model && m.emotions.includes((r.settings || {}).emotion || casting.defaults.emotion))) bad.push(`${role}: ${v.name}은 ${casting.model}의 감정을 지원하지 않음`);
        else if (r.gender && c.gender !== r.gender) bad.push(`${role}: ${v.name}의 성별(${c.gender})이 배역(${r.gender})과 다름`);
      }
    }
    if ((r.alternates || []).length < 2) bad.push(`${role}: 후보가 둘보다 적음`);
  }
  for (const game of new Set(jobs.map(j => j.game))) {
    const seen = new Map();
    for (const j of jobs.filter(x => x.game === game)) {
      const other = seen.get(j.voice.voice.id);
      if (other && other !== j.role) bad.push(`${game}: ${other}와 ${j.role}가 같은 목소리(${j.voice.voice.name})`);
      seen.set(j.voice.voice.id, j.role);
    }
  }
  return bad;
}

// 미리보기: 무엇을 누구 목소리로 몇 글자, 어디에 쓰는지. 출력 경로는 모두 지금 있는 파일이어야 한다(같은 이름으로 바꾼다).
async function dryRun({ casting = loadCasting(), repo = G.REPO, games = presentGames(repo), vendor = VENDOR, catalog = null } = {}) {
  const jobs = await allJobs({ casting, games, repo });
  const problems = [], warnings = [];
  const perGame = {}, perRole = {};
  for (const id of games) {
    const adapter = G.GAMES[id], mine = jobs.filter(j => j.game === id);
    const outputs = mine.flatMap(j => j.outputs), current = adapter.current(repo);
    const dupes = outputs.filter((o, i) => outputs.indexOf(o) !== i);
    const missing = outputs.filter(o => !fs.existsSync(path.join(G.gameDir(id, repo), ...o.split('/'))));
    const uncovered = current.filter(f => !outputs.includes(f));
    const ids = mine.map(j => j.id), dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dupes.length) problems.push(`${id}: 같은 출력 파일을 두 줄이 씀 ${dupes.slice(0, 3).join(', ')}`);
    if (dupIds.length) problems.push(`${id}: 같은 id ${dupIds.slice(0, 3).join(', ')}`);
    if (missing.length) problems.push(`${id}: 지금 없는 출력 파일 ${missing.length}개(예: ${missing.slice(0, 3).join(', ')})`);
    if (uncovered.length) problems.push(`${id}: 작업이 덮지 않는 지금 음성 파일 ${uncovered.length}개(예: ${uncovered.slice(0, 3).join(', ')})`);
    if (adapter.stale && await adapter.stale(repo)) problems.push(`${id}: 얼린 원고(jobs.json)가 지금 원고와 다르다 — 그 게임의 원고 내보내기 스크립트를 먼저`);
    const u = unique(mine);
    perGame[id] = { label: adapter.label, lines: mine.length, chars: chars(mine), billable: chars(u), outputs: outputs.length,
      cached: u.filter(j => fs.existsSync(rawPath(j.voice, j.key, vendor))).length, unique: u.length, post: adapter.post };
  }
  for (const j of jobs) {
    const r = perRole[j.role] || (perRole[j.role] = { label: casting.roles[j.role]?.label || j.role, voice: j.voice.voice, lines: 0, chars: 0, games: {}, tempos: new Set() });
    r.lines += 1; r.chars += [...j.text].length; r.games[j.game] = (r.games[j.game] || 0) + 1; r.tempos.add(j.voice.tempo);
  }
  for (const r of Object.values(perRole)) r.tempos = [...r.tempos].sort();
  problems.push(...castingProblems(casting, jobs, catalog));
  const longest = jobs.reduce((a, j) => (j.text.length > a.text.length ? j : a), jobs[0]);
  if (longest.text.length > 1000) problems.push(`한 줄이 너무 길다(${longest.text.length}자): ${longest.game}/${longest.id}`);
  for (const t of ['ffmpeg', 'ffprobe']) if (!G.tool(t)) problems.push(`${t}이 없다(후처리에 필요)`);
  const risks = durationRisks(jobs);
  if (risks.length) warnings.push(...risks.map(r => `${r.game}/${r.id} 어림 ${r.estimate}초 / 한도 ${r.max}초 — ${r.why} «${r.text}»`));
  const u = unique(jobs), samples = sampleTasks(jobs, casting), samplesAlt = sampleTasks(jobs, casting, { alternates: true });
  return {
    jobs, perGame, perRole, problems, warnings,
    totals: { lines: jobs.length, chars: chars(jobs), billable: chars(u), requests: u.length, outputs: jobs.reduce((n, j) => n + j.outputs.length, 0),
      cached: u.filter(j => fs.existsSync(rawPath(j.voice, j.key, vendor))).length, plan: PLAN_CREDITS, longest: { id: `${longest.game}/${longest.id}`, chars: longest.text.length } },
    samples: { lines: samples.length, chars: chars(samples.map(s => s.job)), withAlternates: { lines: samplesAlt.length, chars: chars(unique(samplesAlt.map(s => s.job))) },
      picks: samples.map(s => ({ role: s.role, game: s.job.game, id: s.job.id, text: s.job.text })) },
  };
}

function formatDryRun(r) {
  const n = x => x.toLocaleString('en-US'), pct = x => (100 * x / r.totals.plan).toFixed(1) + '%';
  const lines = ['미니게임 목소리 · 미리보기(dry-run) — Typecast를 부르지 않는다', ''];
  lines.push('게임별                줄      글자   부를 글자  출력 파일  받아 둔 원본');
  for (const [id, g] of Object.entries(r.perGame))
    lines.push(`  ${(g.label + ' ' + id).padEnd(26)}${n(g.lines).padStart(5)} ${n(g.chars).padStart(8)} ${n(g.billable).padStart(9)} ${String(g.outputs).padStart(9)} ${(g.cached + '/' + g.unique).padStart(11)}`);
  lines.push(`  ${'합계'.padEnd(26)}${n(r.totals.lines).padStart(5)} ${n(r.totals.chars).padStart(8)} ${n(r.totals.billable).padStart(9)} ${String(r.totals.outputs).padStart(9)} ${(r.totals.cached + '/' + r.totals.requests).padStart(11)}`);
  lines.push('', '배역별(목소리 · 빠르기)');
  for (const [role, x] of Object.entries(r.perRole))
    lines.push(`  ${(x.label + ' ' + role).padEnd(18)}${n(x.lines).padStart(5)}줄 ${n(x.chars).padStart(7)}자  ${x.voice.name} ${x.voice.id} · tempo ${x.tempos.join('/')} · ${Object.entries(x.games).map(([g, c]) => `${g} ${c}`).join(', ')}`);
  lines.push('', `부를 글자 ${n(r.totals.billable)}자(같은 목소리·설정·글은 한 번만) → 월 ${n(r.totals.plan)} 크레딧의 ${pct(r.totals.billable)} (1글자 1크레딧 기준, 실제 비율은 샘플로 잰다)`);
  lines.push(`샘플: 배역마다 두 줄 ${r.samples.lines}줄 ${n(r.samples.chars)}자 · 후보 목소리까지 ${r.samples.withAlternates.lines}줄 ${n(r.samples.withAlternates.chars)}자`);
  const picks = {};
  for (const p of r.samples.picks) (picks[p.role] ||= []).push(`${p.game}/${p.id} «${p.text}»`);
  for (const [role, list] of Object.entries(picks)) lines.push(`  ${(r.perRole[role]?.label || role).padEnd(14)} ${list.join(' · ')}`);
  lines.push(`가장 긴 줄: ${r.totals.longest.id} ${r.totals.longest.chars}자`);
  lines.push('', '후처리(게임마다 지금 파이프라인과 같게)');
  for (const [id, g] of Object.entries(r.perGame)) lines.push(`  ${id}: ${g.post}`);
  if (r.warnings.length) lines.push('', `길이 어림 주의 ${r.warnings.length}줄(만든 뒤 실제 길이로 다시 본다):`, ...r.warnings.slice(0, 12).map(w => '  ' + w));
  lines.push('', r.problems.length ? `문제 ${r.problems.length}개:` : '문제 없음 — 출력 경로 모두 지금 파일과 같은 이름, 겹침·누락 0', ...r.problems.map(p => '  ✗ ' + p));
  return lines.join('\n');
}

module.exports = { CASTING_FILE, VENDOR, VOICE_ID, GAME_ORDER, PLAN_CREDITS, loadCasting, presentGames, voiceFor, request, cacheKey, rawPath, allJobs, chars, unique,
  pickSamples, sampleTasks, estimateSeconds, durationRisks, castingProblems, dryRun, formatDryRun };
