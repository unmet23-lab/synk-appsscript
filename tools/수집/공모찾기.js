#!/usr/bin/env node
'use strict';
/**
 * 공모전 찾기 — Opus · Sol · Gemini가 같은 요청문(tools/수집/공모요청문.md)으로 지금 접수 중인 공모를 찾는다(2026-11-25).
 * 받은 답은 그록 공모 보고서 꼴(synk-grok-contests-v1)로 바꿔 공모 지도 보관함의 `그록공모전/`에 넣는다.
 * 넣을 때 lib/grok-contests.cjs 가져오기가 공식 원문을 열어 인용을 대조하므로, 그록 공고와 같은 검증을 거친다.
 * 공모 지도 갱신 예약(09:30 · 15:30 · 21:00)이 이 보고서까지 읽어 지도 · 자격 확인 · 급한 공고 알림으로 넘긴다.
 *
 * 유호님 11-25 「공모전찾기를 opus,sol,제미나이,그록 이렇게 4개로 찾는건 어때?」 → 설계안에 「응, 지어」.
 * 그록 몫은 맹꽁이 봇의 08:30 회차(이틀에 한 번)가 지금 길로 낸다. 그 회차는 지원사업 · 지역 · 입찰 등 여섯 갈래도 함께 본다.
 *
 *   node tools/수집/공모찾기.js <opus|sol|gemini> [--보관함 <폴더>] [--프롬프트만] [--답 <파일>] [--시간분 40]
 *     --답 <파일>  AI를 부르지 않고 받은 답 파일(JSON 글)로 바꾸기 · 넣기만 한다(시험 · 다시 넣기).
 * 끝줄에 요약 JSON 한 줄을 찍는다 — tools/수집/돌리기.js가 읽는다.
 * 끝 코드: 0 받음(0건 포함) · 1 답이 꼴이 아님 · 2 오류 · 3 부르지 못함(로그인 · 한도 · 설치).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const 그록 = require('../lib/grok-contests.cjs');

const 여기 = __dirname;
const 뿌리 = path.resolve(여기, '..', '..');
const 누가들 = Object.freeze({
  opus: { 이름: 'Opus', 모델: 'claude-opus-5-5' },
  sol: { 이름: 'Sol', 모델: 'gpt-6.2-sol', 추론: 'high' },
  gemini: { 이름: 'Gemini', 모델: 'gemini-4-carbon-high' },
});
const 기본보관함 = path.join(os.homedir(), 'Documents', 'SYNK-보관함', '지원사업');
const 한도말 = /usage limit|rate limit|quota|resource_exhausted|429|한도|credit balance/i;
const 로그인말 = /not logged in|login required|please log ?in|unauthori[sz]ed|401|authenticate/i;

const 서울 = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString();
const 글 = (v, n = 220) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

function 인자(argv) {
  const o = { 누가: '', 보관함: 기본보관함, 프롬프트만: false, 답: '', 시간분: 40 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--보관함') o.보관함 = argv[++i];
    else if (a === '--프롬프트만') o.프롬프트만 = true;
    else if (a === '--답') o.답 = argv[++i];
    else if (a === '--시간분') o.시간분 = Math.max(1, Number(argv[++i]) || 40);
    else if (누가들[a]) o.누가 = a;
    else throw new Error(`모르는 인자: ${a}`);
  }
  if (!o.누가) throw new Error(`누가 찾을지 적어 주세요: ${Object.keys(누가들).join(' | ')}`);
  return o;
}

/** 마감이 안 지난(또는 마감을 모르는) 이미 아는 공고 이름 — 같은 공고를 다시 내지 않게 요청문 끝에 붙인다. */
function 이미아는공고(보관함, 오늘 = 서울().slice(0, 10), 최대 = 120) {
  let 지도;
  try { 지도 = require('../공모지도.js'); } catch { return []; }
  let 통합;
  try { ({ 통합 } = 지도.읽기(보관함)); } catch { return []; }
  const 이름들 = [];
  for (const o of 통합.items || []) {
    const 마감 = 지도.공고마감(o);
    if (마감 && 마감 < 오늘) continue;
    const 이름 = 글(지도.짧은이름(o.title || ''), 80);
    if (이름 && !이름들.includes(이름)) 이름들.push(이름);
  }
  return 이름들.slice(-최대);
}

function 프롬프트(아는것, 지금 = Date.now()) {
  const 본 = fs.readFileSync(path.join(여기, '공모요청문.md'), 'utf8').trim();
  const 날 = 서울(지금);
  const 끝 = [`오늘은 한국 시각 ${날.slice(0, 10)} ${날.slice(11, 16)}이다.`, '', '## 이미 아는 공고', ''];
  끝.push(...(아는것.length ? 아는것.map((x) => `- ${x}`) : ['- (없음)']));
  return `${본}\n\n${끝.join('\n')}\n`;
}

/** 답 글에서 JSON 한 개를 꺼낸다 — 울타리 안 · 앞뒤 말이 붙은 답 모두. */
function JSON꺼내기(답) {
  const s = String(답 || '');
  const 울타리 = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const 후보 of [...울타리.reverse(), s]) {
    const i = 후보.indexOf('{'), j = 후보.lastIndexOf('}');
    if (i < 0 || j <= i) continue;
    try { return JSON.parse(후보.slice(i, j + 1)); } catch { /* 다음 후보 */ }
  }
  return null;
}

/** 받은 답 → 그록 공모 보고서 꼴. 제목이나 주소가 없는 줄은 버리고 그 수를 센다. */
function 보고서로(답, 누가, 지금 = Date.now()) {
  if (!답 || typeof 답 !== 'object' || !Array.isArray(답.items)) return null;
  const 날 = 서울(지금);
  const 칸 = (f) => ({ url: 글(f?.url, 600), quote: 글(f?.quote, 240) });
  const items = [];
  let 버림 = 0;
  for (const r of 답.items.slice(0, 30)) {
    const 제목 = 글(r?.title);
    const 공식 = 그록.주소(r?.officialUrl), 찾음 = 그록.주소(r?.discoveryUrl);
    if (!제목 || (!공식 && !찾음)) { 버림 += 1; continue; }
    items.push({
      title: 제목,
      organizer: 글(r.organizer),
      edition: 글(r.edition, 80),
      noticeId: 글(r.noticeId, 80),
      video: r.video === true ? true : r.video === false ? false : null,
      discoveryUrl: 찾음 || 공식,
      officialUrl: 공식,
      ai: { status: ['allowed', 'conditional', 'prohibited', 'unconfirmed'].includes(r.ai?.status) ? r.ai.status : 'unconfirmed', ...칸(r.ai) },
      deadline: { date: 그록.날짜(r.deadline?.date), kst: 그록.한국마감(r.deadline?.kst, 그록.날짜(r.deadline?.date)), ...칸(r.deadline) },
      deliverables: { items: Array.isArray(r.deliverables?.items) ? r.deliverables.items.map((x) => 글(x, 180)).filter(Boolean).slice(0, 8) : [], ...칸(r.deliverables) },
    });
  }
  const reports = (Array.isArray(답.reports) ? 답.reports : []).map((x) => 글(x, 200)).filter(Boolean).slice(0, 40);
  return {
    보고서: {
      schema: 'synk-grok-contests-v1',
      reportId: `${날.slice(0, 10)}_${날.slice(11, 13)}${날.slice(14, 16)}-${누가}`,
      finder: 누가,
      reports: reports.length ? reports : [`${누가들[누가].이름} 공모전 찾기 ${날.slice(0, 16).replace('T', ' ')}`],
      items,
    },
    버림,
    못연곳: (Array.isArray(답.unavailable) ? 답.unavailable : []).map((x) => 글(x, 200)).filter(Boolean).slice(0, 20),
  };
}

/** 자식 프로세스 하나를 돌린다 — 시간을 넘기면 묶음째 끈다. → { code, out, err, 초 } */
function 돌리기(파일, 인자들, { 입력 = '', cwd, env, 시간ms }) {
  const 시작 = Date.now();
  return new Promise((resolve) => {
    const c = spawn(파일, 인자들, { cwd, env, windowsHide: true });
    let out = '', err = '', 끝남 = false;
    c.stdout.on('data', (d) => { out = (out + d).slice(-4_000_000); });
    c.stderr.on('data', (d) => { err = (err + d).slice(-64_000); });
    const 타이머 = setTimeout(() => {
      err += '\n[공모찾기] 시간 넘김 — 끔';
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else c.kill('SIGKILL');
    }, 시간ms);
    const 끝 = (code) => { if (끝남) return; 끝남 = true; clearTimeout(타이머); resolve({ code, out, err, 초: Math.round((Date.now() - 시작) / 1000) }); };
    c.on('error', (e) => { err += `\n${e.message}`; 끝(127); });
    c.on('close', (code) => 끝(code ?? 1));
    if (입력) c.stdin.end(입력); else c.stdin.end();
  });
}

function 깨끗한환경() {
  const env = { ...process.env };
  for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) delete env[k];
  return env;
}

/** AI를 부른다 → { 답글, 초, 막힘?: '한도' | '로그인' | '설치' | '실패', 까닭 } */
async function 부르기(누가, 글내용, 시간ms) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), `synk-contest-${누가}-`));
  const env = 깨끗한환경();
  try {
    let r, 답글 = '';
    if (누가 === 'opus') {
      const exe = process.env.SYNK_CLAUDE_BIN || path.join(os.homedir(), '.local', 'bin', 'claude.exe');
      if (!fs.existsSync(exe)) return { 막힘: '설치', 까닭: `claude 없음: ${exe}` };
      r = await 돌리기(exe, ['-p', '--model', 누가들.opus.모델, '--allowedTools', 'WebSearch', 'WebFetch',
        '--disallowedTools', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'Task', '--output-format', 'json', '--max-turns', '80',
        '--no-session-persistence'], { 입력: 글내용, cwd: 방, env, 시간ms });
      let j = null;
      try { j = JSON.parse(r.out.trim().split(/\r?\n/).filter(Boolean).pop() || ''); } catch { /* 아래에서 실패로 */ }
      if (j && !j.is_error) 답글 = String(j.result || '');
      else if (j?.result) r.err += `\n${j.result}`;
    } else if (누가 === 'sol') {
      const 답파일 = path.join(방, '답.txt');
      r = await 돌리기(process.execPath, [path.join(뿌리, 'tools', 'codex계정.js'), 'exec', '--skip-git-repo-check', '-C', 방, '-s', 'read-only',
        '-m', 누가들.sol.모델, '-c', `model_reasoning_effort="${누가들.sol.추론}"`, '-c', 'web_search="live"', '-o', 답파일, '-'],
      { 입력: 글내용, cwd: 방, env, 시간ms });
      if (r.code === 3) return { 막힘: '한도', 까닭: '굽기 · 앱 계정이 모두 막힘(codex계정.js 종료 3)', 초: r.초 };
      답글 = fs.existsSync(답파일) ? fs.readFileSync(답파일, 'utf8') : '';
    } else if (누가 === 'gemini') {
      const exe = process.env.SYNK_AGY_BIN || [path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe')].find((p) => fs.existsSync(p)) || 'agy';
      const 초 = Math.max(60, Math.floor(시간ms / 1000) - 30);
      r = await 돌리기(exe, ['-p', 글내용, '--model', 누가들.gemini.모델, '--sandbox', '--disable-slash-commands', '--output-format', 'json', '--print-timeout', `${초}s`],
        { cwd: 방, env: { ...env, AGY_CLI_DISABLE_AUTO_UPDATE: 'true' }, 시간ms });
      let j = null;
      try { j = JSON.parse(r.out.trim().split(/\r?\n/).filter(Boolean).pop() || ''); } catch { /* 아래에서 실패로 */ }
      if (j && /SUCCESS/i.test(j.status || '')) 답글 = String(j.response || '');
      else if (j) r.err += `\n${JSON.stringify(j).slice(0, 400)}`;
    }
    if (답글.trim()) return { 답글, 초: r.초 };
    const 말 = `${r.err}\n${r.out.slice(-2000)}`;
    if (r.code === 127) return { 막힘: '설치', 까닭: 글(말, 200), 초: r.초 };
    if (한도말.test(말)) return { 막힘: '한도', 까닭: 글(말.match(new RegExp(`.{0,80}(${한도말.source}).{0,80}`, 'i'))?.[0] || 말, 200), 초: r.초 };
    if (로그인말.test(말)) return { 막힘: '로그인', 까닭: 글(말, 200), 초: r.초 };
    return { 막힘: '실패', 까닭: 글(/시간 넘김/.test(말) ? '시간 넘김' : 말.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || `종료 ${r.code}`, 200), 초: r.초 };
  } finally {
    try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 남겨도 된다 */ }
  }
}

/** 지금 공모 지도에 실릴 공고 수 — 넣기 전후를 견줘 새 공고 수를 센다. */
function 지도공고수(보관함) {
  try {
    const 통합 = JSON.parse(fs.readFileSync(path.join(보관함, '통합목록.json'), 'utf8'));
    return 그록.합치기(통합, 그록.보고서읽기(보관함)).items.length;
  } catch { return null; }
}

async function main(argv) {
  const o = 인자(argv);
  const 지금 = Date.now();
  const 아는것 = 이미아는공고(o.보관함);
  const 요청 = 프롬프트(아는것, 지금);
  if (o.프롬프트만) { process.stdout.write(요청); return 0; }
  const 요약 = { 누가: o.누가, 때: new Date(지금).toISOString(), 아는공고: 아는것.length };
  let 답글 = '', 초 = 0;
  if (o.답) 답글 = fs.readFileSync(o.답, 'utf8');
  else {
    const r = await 부르기(o.누가, 요청, o.시간분 * 60_000);
    초 = r.초 || 0;
    if (r.막힘) { console.log(`${누가들[o.누가].이름}: 못 부름(${r.막힘}) — ${r.까닭}`); console.log(JSON.stringify({ ...요약, 결과: '못 부름', 막힘: r.막힘, 까닭: r.까닭, 걸린초: 초 })); return 3; }
    답글 = r.답글;
  }
  const 날 = 서울(지금);
  const 원본폴더 = path.join(o.보관함, '공모수집', 날.slice(0, 10));
  fs.mkdirSync(원본폴더, { recursive: true });
  const 원본파일 = path.join(원본폴더, `${o.누가}-${날.slice(11, 13)}${날.slice(14, 16)}.json`);
  const 바꿈 = 보고서로(JSON꺼내기(답글), o.누가, 지금);
  fs.writeFileSync(원본파일, JSON.stringify({ 누가: o.누가, 때: 요약.때, 걸린초: 초, 답글, 보고서: 바꿈?.보고서 || null }, null, 1));
  if (!바꿈) { console.log(`${누가들[o.누가].이름}: 답이 JSON 꼴이 아님 — ${원본파일}`); console.log(JSON.stringify({ ...요약, 결과: '꼴 아님', 원본: 원본파일, 걸린초: 초 })); return 1; }
  const 전 = 지도공고수(o.보관함);
  let 넣음 = { already: false, items: [] };
  if (바꿈.보고서.items.length) 넣음 = await 그록.가져오기(o.보관함, 바꿈.보고서);
  const 후 = 지도공고수(o.보관함);
  const 원문확인 = 넣음.items.filter((x) => x.officialUrl).length;
  const 결과 = { ...요약, 결과: '받음', 찾음: 바꿈.보고서.items.length, 버림: 바꿈.버림, 원문확인, 새공고: 전 != null && 후 != null ? Math.max(0, 후 - 전) : null, 못연곳: 바꿈.못연곳.length, 원본: 원본파일, 걸린초: 초 };
  console.log(`${누가들[o.누가].이름}: 찾음 ${결과.찾음} · 원문 확인 ${원문확인} · 지도에 새 공고 ${결과.새공고 ?? '?'}${바꿈.버림 ? ` · 버림 ${바꿈.버림}` : ''}`);
  console.log(JSON.stringify(결과));
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack || e.message); console.log(JSON.stringify({ 결과: '오류', 까닭: 글(e.message, 200) })); process.exitCode = 2; });

module.exports = { 인자, 이미아는공고, 프롬프트, JSON꺼내기, 보고서로, 누가들 };
