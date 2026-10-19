#!/usr/bin/env node
// 공개 도구 재현: 지난 공개 커밋 C가 바꾼 파일(A·M)만 로컬 폴더에 꺼내고 지운 파일(D)은 --지움으로 준 뒤,
// `node tools/공개.js 올리기 --원본 <폴더> <경로…> --위에 C^ --json`(미리 보기)의 바뀐 파일·새 blob이 C와 같은지 본다.
// 사용: node docs/_ops/qa/publish-tool-repro-20261019/재현.cjs <tools/공개.js가 있는 저장소 뿌리> <커밋…> [--기록 <파일>] [--덧 "<도구에 더 줄 인자>"]
// 사본은 도구 기본(~/Documents/synk-vendor/synk-policy-publish.git, 없으면 도구를 한 번 돌려 받는다).
// 실제 공개·push는 하지 않는다(--위에는 미리 보기 전용). 종료 0 = 모두 같음.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const [뿌리, ...나머지] = process.argv.slice(2);
if (!뿌리) { console.error('사용: node 재현.cjs <저장소 뿌리> <커밋…> [--기록 <파일>] [--덧 "<인자>"]'); process.exit(2); }
let 기록파일 = null, 덧 = [];
const 커밋들 = [];
for (let i = 0; i < 나머지.length; i++) {
  if (나머지[i] === '--기록') 기록파일 = 나머지[++i];
  else if (나머지[i] === '--덧') 덧 = 나머지[++i].split(' ').filter(Boolean);
  else 커밋들.push(나머지[i]);
}
const 사본 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const env = { ...process.env, GIT_NO_LAZY_FETCH: '1' };
const git = (args, o = {}) => {
  const r = spawnSync('git', ['--git-dir', 사본, '-c', 'core.quotepath=false', ...args], { env, maxBuffer: 1 << 30, ...o });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const 줄 = [];
const 적기 = (s) => { 줄.push(s); console.log(s); };
let 모두같음 = true;
적기(`# 공개 도구 재현 ${new Date().toISOString()} · 도구 ${path.join(뿌리, 'tools', '공개.js')}`);
spawnSync('git', ['--git-dir', 사본, 'fetch', '-q', '--no-tags', '--filter=blob:none', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { env });
for (const c of 커밋들) {
  const 전체 = git(['rev-parse', `${c}^{commit}`]).toString().trim();
  const 제목 = git(['log', '-1', '--format=%s', 전체]).toString().trim();
  const 바뀜 = git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', `${전체}^`, 전체]).toString('utf8').split('\0');
  const 실제 = new Map();
  for (let i = 0; i + 1 < 바뀜.length; i += 2) {
    if (!바뀜[i]) break;
    const [, , , 새, 상태] = 바뀜[i].slice(1).split(' ');
    실제.set(바뀜[i + 1], { 상태, 새: /^0+$/.test(새) ? null : 새 });
  }
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-publish-repro-'));
  const 올릴 = [...실제].filter(([, v]) => v.새).map(([p]) => p);
  const 지울 = [...실제].filter(([, v]) => !v.새).map(([p]) => p);
  // 필요한 blob을 한 번에 받는다
  const oids = 올릴.map((p) => 실제.get(p).새);
  for (let i = 0; i < oids.length; i += 400) spawnSync('git', ['--git-dir', 사본, 'fetch', '-q', '--no-tags', '--filter=blob:none', '--stdin', 'origin'], { env, input: `${oids.slice(i, i + 400).join('\n')}\n` });
  for (const p of 올릴) {
    const f = path.join(폴더, ...p.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, git(['cat-file', 'blob', 실제.get(p).새]));
  }
  const 인자 = ['tools/공개.js', '올리기', '--원본', 폴더, ...올릴, ...지울.flatMap((p) => ['--지움', p]), '--위에', `${전체}^`, '--json', ...덧];
  // 경로가 많으면 명령줄이 길어진다(Windows 한도 32K) — 실패하면 길이를 같이 적는다
  const 길이 = 인자.join(' ').length;
  const r = spawnSync(process.execPath, 인자, { cwd: 뿌리, maxBuffer: 1 << 28, encoding: 'utf8' });
  fs.rmSync(폴더, { recursive: true, force: true });
  let 결과;
  try { 결과 = JSON.parse(r.stdout); } catch (_) { 적기(`## ${c} ${제목}\n  도구 출력을 못 읽었다(종료 ${r.status}, 인자 ${길이}자): ${String(r.stderr).slice(0, 400)}`); 모두같음 = false; continue; }
  const 후보 = new Map(결과.항목.map((x) => [x.경로, x.후]));
  const 같음 = [], 다름 = [], 실제만 = [], 후보만 = [];
  for (const [p, v] of 실제) {
    if (!후보.has(p)) 실제만.push(p);
    else if (후보.get(p) === v.새) 같음.push(p);
    else 다름.push(p);
  }
  for (const p of 후보.keys()) if (!실제.has(p)) 후보만.push(p);
  const 판정 = !다름.length && !실제만.length && !후보만.length ? '같음' : '다름';
  if (판정 !== '같음') 모두같음 = false;
  적기(`## ${전체.slice(0, 7)} ${제목}`);
  적기(`  실제 바뀐 파일 ${실제.size}개(지움 ${지울.length}) · 도구 결과 ${결과.결과} · 후보 ${후보.size}개 · 판정 ${판정} — 같은 blob ${같음.length}/${실제.size}`);
  if (다름.length) 적기(`  blob이 다름: ${다름.join(', ')}`);
  if (실제만.length) 적기(`  실제에만: ${실제만.join(', ')} ${결과.건너뜀 ? `(건너뜀 이유: ${결과.건너뜀.filter((x) => 실제만.includes(x.경로)).map((x) => `${x.경로}=${x.이유}`).join('; ')})` : ''}`);
  if (후보만.length) 적기(`  후보에만: ${후보만.join(', ')} (${결과.항목.filter((x) => 후보만.includes(x.경로)).map((x) => `${x.경로}: ${x.방법}`).join('; ')})`);
  const 토큰 = 결과.항목.filter((x) => x.종류 === '토큰' || /\?v=/.test(x.방법));
  if (토큰.length) 적기(`  ?v= 손댄 파일: ${토큰.map((x) => `${x.경로}(${x.방법})`).join('; ')}`);
  if (결과.걸림 && 결과.걸림.length) 적기(`  걸림: ${결과.걸림.map((x) => `[${x.검사}] ${x.경로 || ''} ${x.이유}`).join(' | ')}`);
  if (결과.알림 && 결과.알림.length) 적기(`  알림 ${결과.알림.length}개: ${결과.알림.slice(0, 4).map((x) => `[${x.검사}] ${x.경로 || ''}`).join(' · ')}${결과.알림.length > 4 ? ' …' : ''}`);
}
적기(`# 전체 판정: ${모두같음 ? '모두 같음' : '다른 것이 있음'}`);
if (기록파일) fs.writeFileSync(기록파일, `${줄.join('\n')}\n`);
process.exit(모두같음 ? 0 : 1);
