'use strict';
// 개발부 지침 묶음 재기: 같은 과제를 「지침 없는 Claude(plain)」와 「지침 묶음을 얹은 Claude(pack)」로 돌려 결과를 모은다.
//   node 돌리기.cjs <결과 폴더> [--과제 T1,T2] [--팔 plain,pack] [--횟수 1 | --회 2] [--동시 3]
// 두 팔의 차이는 묶음 플래그(--append-system-prompt-file 지침.md, --plugin-dir plugin) 하나다. 둘 다 이 PC 사람의 CLAUDE.md를 빼고
// (claudeMdExcludes), 과제마다 새 임시 폴더에서 같은 도구 허락으로 돈다. 무인 실행이라 묻는 말은 답에 남는다.
// 환경변수는 솔리오가 직원을 띄울 때처럼(office-task-runtime.cjs employeeEnv) 지운다. 이 도구를 Claude 앱 안에서 부르면 앱의 변수가 새어 들어가
// 게시 도구와 앱의 임시 폴더를 쓰게 된다(11-25 1차에서 그랬다). 거절된 도구는 meta.json에 남긴다. 채점.cjs가 오류 · 한도 · 시간 초과 · 거절이 있는 쌍을 뺀다.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');
const 과제들 = require('./과제.cjs'), { walk, sha } = 과제들;

const out = path.resolve(process.argv[2] || 'out');
const opt = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : null; };
const pick = (opt('과제') || 과제들.map(t => t.id).join(',')).split(',');
const arms = (opt('팔') || 'plain,pack').split(',');
const reps = Number(opt('횟수') || 1), lanes = Number(opt('동시') || 3);
const PACK = path.resolve(__dirname, '..', '개발부');
const claude = execFileSync('where', ['claude'], { encoding: 'utf8' }).split(/\r?\n/).map(s => s.trim()).find(s => /\.exe$/i.test(s)) || 'claude';
const TIMEOUT = 15 * 60e3;

fs.mkdirSync(out, { recursive: true });
const settings = path.join(out, 'settings.json');
fs.writeFileSync(settings, JSON.stringify({ claudeMdExcludes: ['**/CLAUDE.md', '**/.claude/CLAUDE.md'] }));

function employeeEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(?:CLAUDE|ANTHROPIC|CODEX|OPENAI|ELECTRON|SOLIO_MAIL)/i.test(k) || /^NODE_OPTIONS$/i.test(k)) delete env[k];
  env.CLAUDE_CODE_USE_POWERSHELL_TOOL = '0'; // 명령 도구를 두 팔 모두 Bash 하나로 맞춘다
  return env;
}
const BASH = ['cd', 'ls', 'pwd', 'cat', 'head', 'tail', 'echo', 'grep', 'find', 'wc', 'diff', 'test', 'node', 'npm test', 'npm run', 'mkdir', 'mv', 'cp', 'rm', 'rmdir', 'sed', 'git status', 'git diff'];
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', ...BASH.map(c => `Bash(${c}:*)`)].join(',');
function writeSeed(dir, seed) {
  for (const [f, body] of Object.entries(seed)) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); }
}
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of walk(from)) { const p = path.join(to, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.copyFileSync(path.join(from, f), p); }
}
function diff(a, b) {
  try { return execFileSync('git', ['diff', '--no-index', '--no-color', '--', a, b], { encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { return String(e.stdout || ''); }
}

function runOne(task, arm, rep) {
  return new Promise(resolve => {
    const where = path.join(out, task.id, `${arm}-${rep}`);
    fs.rmSync(where, { recursive: true, force: true });
    fs.mkdirSync(where, { recursive: true });
    const seedDir = path.join(out, task.id, 'seed');
    if (!fs.existsSync(seedDir)) { fs.mkdirSync(seedDir, { recursive: true }); writeSeed(seedDir, task.seed); }
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'solio-dev-'));
    writeSeed(work, task.seed);
    const seedHash = Object.fromEntries(walk(work).map(f => [f, sha(fs.readFileSync(path.join(work, f)))]));
    const args = ['-p', '--output-format', 'json', '--setting-sources', 'project', '--settings', settings,
      '--permission-mode', 'acceptEdits', '--allowedTools', TOOLS];
    if (arm === 'pack') args.push('--append-system-prompt-file', path.join(PACK, '지침.md'), '--plugin-dir', path.join(PACK, 'plugin'));
    args.push('--', task.요청);
    const started = Date.now();
    const child = spawn(claude, args, { cwd: work, windowsHide: true, shell: false, env: employeeEnv() });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT);
    child.on('close', code => {
      clearTimeout(timer);
      let res = null;
      try { res = JSON.parse(stdout.trim().split(/\r?\n/).pop()); } catch {}
      const answer = res?.result || '';
      let checks = [];
      try { checks = task.검사(work, seedHash).map(([name, ok, detail]) => ({ name, ok: !!ok, ...(detail && detail.length ? { detail } : {}) })); }
      catch (e) { checks = [{ name: '검사 실행', ok: false, detail: String(e.message) }]; }
      copyTree(work, path.join(where, 'files'));
      fs.writeFileSync(path.join(where, 'answer.md'), answer);
      fs.writeFileSync(path.join(where, 'diff.patch'), diff(seedDir, path.join(where, 'files')).slice(0, 80000));
      fs.writeFileSync(path.join(where, 'checks.json'), JSON.stringify(checks, null, 2));
      const meta = { task: task.id, arm, rep, packSha256: arm === 'pack' ? sha(fs.readFileSync(path.join(PACK, '지침.md'))) : null, code, timedOut, seconds: Math.round((Date.now() - started) / 1000), turns: res?.num_turns ?? null,
        isError: res?.is_error ?? null, models: res?.modelUsage ? Object.keys(res.modelUsage) : null, costUsdEquivalent: res?.total_cost_usd ?? null,
        passed: checks.filter(c => c.ok).length, total: checks.length, denials: (res?.permission_denials || []).map(d => `${d.tool_name}: ${String(d.tool_input?.command || d.tool_input?.file_path || '').replace(/\s+/g, ' ').slice(0, 120)}`), stderr: stderr.slice(-2000) };
      fs.writeFileSync(path.join(where, 'meta.json'), JSON.stringify(meta, null, 2));
      fs.rmSync(work, { recursive: true, force: true });
      console.log(`${task.id} ${arm}-${rep}: 검사 ${meta.passed}/${meta.total} · ${meta.seconds}초 · 차례 ${meta.turns}${meta.denials.length ? ` · 거절 ${meta.denials.length}` : ''}${timedOut ? ' · 시간 초과' : ''}${res ? '' : ' · 답 없음'}`);
      resolve(meta);
    });
  });
}

(async () => {
  const jobs = [];
  // --회 N: N회째만 돌린다(앞 회의 결과를 덮지 않는다)
  const only = opt('회') ? [Number(opt('회'))] : Array.from({ length: reps }, (_, i) => i + 1);
  for (const r of only) for (const id of pick) for (const arm of arms) jobs.push([과제들.find(t => t.id === id), arm, r]);
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(lanes, jobs.length) }, async () => {
    while (next < jobs.length) { const [t, a, r] = jobs[next++]; results.push(await runOne(t, a, r)); }
  }));
  fs.writeFileSync(path.join(out, '돌린결과.json'), JSON.stringify(results, null, 2));
})();
