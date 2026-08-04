#!/usr/bin/env node
/**
 * effort-audit.js — Claude Code 의 reasoning effort 레벨(low/medium/high/xhigh/max)이
 * 실제로 토큰·돈·시간을 얼마나 바꾸는지 **세션 로그로 잰다**.
 *
 *   node tools/effort-audit.js                 # 기본: claude-opus-5
 *   node tools/effort-audit.js --model ALL
 *   node tools/effort-audit.js --model claude-fable-5
 *   node tools/effort-audit.js --json
 *
 * 왜 이 도구가 있나 — effort 는 Claude 5 계열에서 `budget_tokens` 가 폐기돼(400)
 * **고정 사고 토큰 한도가 존재하지 않는다.** 레벨별 「토큰량」은 문서로 답할 수 없고
 * 실측으로만 답할 수 있다. 그래서 잰다.
 *
 * 🔑 이 도구의 핵심은 표1이 아니라 **표2**다.
 *    단순 집계는 「어려운 일에 max 를 골랐다」는 선택 편향에 오염된다.
 *    표2는 같은 세션·같은 모델 안에서 레벨이 바뀐 구간만 짝지어 그 편향을 걷어낸다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 가격: claude.exe 내부 pricing tier 표 (per MTok, USD) ──────────────────
const TIERS = {
  tier_3_15:  { input: 3,  output: 15, cw5m: 3.75,  cw1h: 6,  cr: 0.3 },
  tier_5_25:  { input: 5,  output: 25, cw5m: 6.25,  cw1h: 10, cr: 0.5 },
  tier_10_50: { input: 10, output: 50, cw5m: 12.5,  cw1h: 20, cr: 1   },
  tier_15_75: { input: 15, output: 75, cw5m: 18.75, cw1h: 30, cr: 1.5 },
};
const MODEL_TIER = {
  'claude-sonnet-5': 'tier_3_15',
  'claude-opus-5':   'tier_5_25',
  'claude-opus-4-8': 'tier_5_25',
  'claude-fable-5':  'tier_10_50',
};
const ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const MIN_PAIR = 30;   // 짝비교에 넣을 최소 응답 수

// ── 인자 ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const MODEL = arg('--model', 'claude-opus-5');
const AS_JSON = argv.includes('--json');

function transcriptDir() {
  const explicit = arg('--dir', null);
  if (explicit) return explicit;
  const slug = process.cwd().replace(/:/g, '-').replace(/[\\/]/g, '-');
  const d = path.join(os.homedir(), '.claude', 'projects', slug);
  if (!fs.existsSync(d)) {
    console.error(`세션 로그를 못 찾았다: ${d}\n--dir 로 직접 지정하라.`);
    process.exit(1);
  }
  return d;
}

// ── 수집 ──────────────────────────────────────────────────────────────────
const blank = () => ({
  n: 0, out: 0, outs: [], inp: 0, cr: 0, cw5: 0, cw1: 0,
  think: 0, thinkChars: 0, textChars: 0, toolChars: 0, tools: 0,
  turns: 0, sessions: new Set(), lat: [],
});
const wanted = m => MODEL === 'ALL' || m === MODEL;

function collect(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  const glob = {};                       // effort -> stats
  const perSession = {};                 // file -> model -> effort -> stats
  const g = e => glob[e] || (glob[e] = blank());

  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); } catch { continue; }
    let prevTs = null, prevWasToolResult = false, turnEfforts = new Set();

    for (const l of lines) {
      if (!l || l[0] !== '{') continue;
      let d; try { d = JSON.parse(l); } catch { continue; }
      const ts = d.timestamp ? Date.parse(d.timestamp) : null;

      if (d.type === 'user') {
        const c = d.message && d.message.content;
        const isToolResult = Array.isArray(c) && c.some(b => b && b.type === 'tool_result');
        // 사람이 새로 친 메시지 = 유저턴 경계
        if (!isToolResult && !d.isSidechain && !d.isMeta) {
          for (const e of turnEfforts) g(e).turns++;
          turnEfforts = new Set();
        }
        prevWasToolResult = isToolResult;
        prevTs = ts;
        continue;
      }
      if (d.type !== 'assistant' || !d.message || !d.message.usage || !d.effort || d.isSidechain
          || !wanted(d.message.model)) { if (ts) prevTs = ts; continue; }

      const u = d.message.usage, eff = d.effort, s = g(eff);
      const ps = (((perSession[f] || (perSession[f] = {}))[d.message.model]
                 || (perSession[f][d.message.model] = {}))[eff]
                 || (perSession[f][d.message.model][eff] = blank()));

      for (const t of [s, ps]) {
        t.n++;
        const o = u.output_tokens || 0;
        t.out += o; t.outs.push(o);
        t.inp += u.input_tokens || 0;
        t.cr  += u.cache_read_input_tokens || 0;
        const cc = u.cache_creation || {};
        if (cc.ephemeral_5m_input_tokens || cc.ephemeral_1h_input_tokens) {
          t.cw5 += cc.ephemeral_5m_input_tokens || 0;
          t.cw1 += cc.ephemeral_1h_input_tokens || 0;
        } else { t.cw5 += u.cache_creation_input_tokens || 0; }
        for (const b of (d.message.content || [])) {
          if (!b) continue;
          if (b.type === 'thinking') { t.think++; t.thinkChars += (b.thinking || '').length; }
          else if (b.type === 'text') t.textChars += (b.text || '').length;
          else if (b.type === 'tool_use') { t.tools++; t.toolChars += JSON.stringify(b.input || {}).length; }
        }
      }
      s.sessions.add(f);
      // 지연: 사람 타이핑 구간을 빼려고 「직전이 tool_result(=자동 연쇄)」인 응답만 센다
      if (prevWasToolResult && prevTs && ts) {
        const dt = (ts - prevTs) / 1000;
        if (dt > 0 && dt < 600) s.lat.push(dt);
      }
      turnEfforts.add(eff);
      prevTs = ts; prevWasToolResult = false;
    }
    for (const e of turnEfforts) g(e).turns++;
  }
  return { glob, perSession, fileCount: files.length };
}

// ── 통계 도우미 ───────────────────────────────────────────────────────────
const q = (a, p) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const geo = a => a.length ? Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length) : NaN;
const keysOf = o => Object.keys(o).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const M = 1e6;
function costOf(s) {
  const t = TIERS[MODEL_TIER[MODEL]];
  if (!t) return null;   // ALL 이거나 모르는 모델이면 돈 계산 생략
  return s.out / M * t.output + s.inp / M * t.input + s.cr / M * t.cr
       + s.cw5 / M * t.cw5m + s.cw1 / M * t.cw1h;
}
function table(hdr, rows) {
  const w = hdr.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => String(c).padStart(w[i])).join(' | ');
  return [line(hdr), w.map(n => '-'.repeat(n)).join('-+-'), ...rows.map(line)].join('\n');
}

// ── 실행 ──────────────────────────────────────────────────────────────────
const DIR = transcriptDir();
const { glob, perSession, fileCount } = collect(DIR);
const keys = keysOf(glob);
if (!keys.length) { console.error('effort 가 기록된 응답이 없다. Claude Code 2.1.2xx 이상 로그가 필요하다.'); process.exit(1); }

// 표2: 같은 세션·같은 모델 안 짝비교
const pairs = {};
for (const f of Object.keys(perSession)) for (const m of Object.keys(perSession[f])) {
  const effs = keysOf(perSession[f][m]).filter(e => perSession[f][m][e].n >= MIN_PAIR);
  for (let i = 0; i < effs.length; i++) for (let j = i + 1; j < effs.length; j++) {
    const A = perSession[f][m][effs[i]], B = perSession[f][m][effs[j]];
    const k = `${effs[i]} → ${effs[j]}`;
    (pairs[k] || (pairs[k] = [])).push({
      outRatio: (B.out / B.n) / (A.out / A.n),
      hiddenA: A.out / (A.textChars + A.thinkChars + A.toolChars),
      hiddenB: B.out / (B.textChars + B.thinkChars + B.toolChars),
    });
  }
}

if (AS_JSON) {
  const out = { model: MODEL, dir: DIR, files: fileCount, levels: {}, pairs: {} };
  for (const k of keys) {
    const s = glob[k];
    out.levels[k] = {
      responses: s.n, sessions: s.sessions.size, userTurns: s.turns,
      outputTokens: s.out, avgOutput: Math.round(s.out / s.n), medianOutput: q(s.outs, .5),
      p90Output: q(s.outs, .9), thinkBlockRate: +(s.think / s.n).toFixed(3),
      hiddenIndex: +(s.out / (s.textChars + s.thinkChars + s.toolChars)).toFixed(3),
      cacheReadTokens: s.cr, costUsd: costOf(s), medianLatencySec: +q(s.lat, .5).toFixed(1),
      p99LatencySec: +q(s.lat, .99).toFixed(1),
    };
  }
  for (const k of Object.keys(pairs)) out.pairs[k] = {
    n: pairs[k].length,
    outputRatio: +geo(pairs[k].map(p => p.outRatio)).toFixed(3),
    hiddenRatio: +geo(pairs[k].map(p => p.hiddenB / p.hiddenA)).toFixed(3),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const tier = MODEL_TIER[MODEL];
console.log(`# effort 실측 — 모델 ${MODEL} · 세션 로그 ${fileCount}개`);
console.log(`  ${DIR}`);
if (tier) { const t = TIERS[tier]; console.log(`  가격 ${tier}: in $${t.input} / out $${t.output} / cache-read $${t.cr} per MTok`); }
console.log('');

console.log('## 표1 — 단순 집계  ⚠어려운 일에 상위 레벨을 골랐다는 선택 편향이 들어 있다');
console.log(table(
  ['effort', '응답', '세션', '평균출력', '중앙값', 'p90', 'p99', '사고블록%', '툴콜/응답'],
  keys.map(k => { const s = glob[k]; return [
    k, s.n, s.sessions.size, Math.round(s.out / s.n), q(s.outs, .5), q(s.outs, .9), q(s.outs, .99),
    (100 * s.think / s.n).toFixed(1) + '%', (s.tools / s.n).toFixed(2)]; })));
console.log('');

console.log(`## 표2 — 같은 세션·같은 모델 안에서 레벨이 바뀐 구간만 짝비교  ✅편향 제거 (각 ${MIN_PAIR}응답 이상)`);
if (!Object.keys(pairs).length) console.log('  짝을 이룰 구간이 없다.');
else console.log(table(
  ['전환', '짝', '출력 배수', '숨은추론 배수'],
  Object.keys(pairs).sort().map(k => [k, pairs[k].length,
    geo(pairs[k].map(p => p.outRatio)).toFixed(2) + 'x',
    geo(pairs[k].map(p => p.hiddenB / p.hiddenA)).toFixed(3) + 'x'])));
console.log('');

console.log('## 표3 — 숨은 추론 지수 = 출력토큰 ÷ transcript 에 실제로 남은 글자');
console.log('   (사고 블록은 요약본이라, 이 값이 클수록 화면에 안 남은 추론이 많다)');
console.log(table(
  ['effort', '렌더글자/출력토큰', '숨은추론지수'],
  keys.map(k => { const s = glob[k]; const ch = s.textChars + s.thinkChars + s.toolChars;
    return [k, (ch / s.out).toFixed(2), (s.out / ch).toFixed(2)]; })));
console.log('');

if (tier) {
  console.log('## 표4 — 돈  🔑출력 비중이 낮다 = effort 는 요금 손잡이가 아니다');
  console.log(table(
    ['effort', '출력Mtok', '캐시읽기Mtok', '총액$', '$/응답', '출력이 총액에서'],
    keys.map(k => { const s = glob[k]; const c = costOf(s);
      return [k, (s.out / M).toFixed(2), (s.cr / M).toFixed(1), '$' + c.toFixed(2),
        '$' + (c / s.n).toFixed(4),
        (100 * (s.out / M * TIERS[tier].output) / c).toFixed(0) + '%']; })));
  console.log('  * 구독제면 실제 청구액이 아니라 레벨 간 비교용 환산치다.');
  console.log('');
}

console.log('## 표5 — 지연 (tool_result 직후 응답만 — 사람 타이핑 구간 제외)');
console.log(table(
  ['effort', '표본', '중앙값s', '평균s', 'p90s', 'p99s'],
  keys.map(k => { const s = glob[k]; const avg = s.lat.length ? s.lat.reduce((a, b) => a + b, 0) / s.lat.length : 0;
    return [k, s.lat.length, q(s.lat, .5).toFixed(1), avg.toFixed(1), q(s.lat, .9).toFixed(1), q(s.lat, .99).toFixed(1)]; })));
