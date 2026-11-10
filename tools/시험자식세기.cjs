'use strict';
/**
 * 시험자식세기 — node 시험이 시험마다 띄운 자식 프로세스(git · node …)의 수와 시간을 센다. 긴 시험 파일이 무엇에 시간을 쓰는지 볼 때.
 *
 *   SYNK_CHILD_COUNT=<결과.jsonl> node --require ./tools/시험자식세기.cjs --test tests/<파일>.test.js
 *       시험 프로세스마다 <결과>-<pid>.jsonl 한 장(시험마다 한 줄: 수 · ms · 벽ms · 종류별 수 · ms). --test-name-pattern도 된다.
 *   node tools/시험자식세기.cjs <결과-pid.jsonl> [<견줄 jsonl>]
 *       묶어 보인다 — 종류별 합과 시험마다(벽 시간 큰 순, 둘을 주면 앞 → 뒤).
 *
 * 환경 변수 이름이 ASCII인 까닭: Git Bash는 `한글이름=값 명령` 꼴을 명령으로 읽는다.
 * spawnSync · execFileSync(동기 호출)만 센다 — 바로올리기 · 내커밋 같은 git 도구와 그 시험이 쓰는 길이다. push · clone이 안에서 띄우는
 * git(receive-pack · upload-pack 등)은 세지 않는다. 시간은 부하에 따라 몇 배씩 출렁이니 다른 때 잰 런끼리는 수로 견준다.
 * 근거와 11-10 실측: docs/현장노트/시험_화면확인.md 「바로올리기 시험 한 파일이 test-ci 전체 런의 긴 막대다」.
 */
const fs = require('node:fs');
const path = require('node:path');

function 묶기(파일들) {
  const [앞, 뒤] = 파일들.map((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((x) => !x.시험.startsWith('(')));
  const 합 = (xs, k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
  const 보기 = (xs, 이름) => {
    console.log(`== ${이름}: 시험 ${xs.length} · 벽 ${(합(xs, '벽ms') / 60000).toFixed(1)}분 · 자식 ${합(xs, '수')}개 · 자식 안 ${(합(xs, 'ms') / 60000).toFixed(1)}분 · 하나 평균 ${(합(xs, 'ms') / Math.max(1, 합(xs, '수'))).toFixed(0)}ms`);
    const m = {};
    for (const x of xs) for (const [k, v] of Object.entries(x.종류)) { const s = m[k] || (m[k] = { 수: 0, ms: 0 }); s.수 += v.수; s.ms += v.ms; }
    for (const [k, v] of Object.entries(m).sort((p, q) => q[1].ms - p[1].ms).slice(0, 15)) console.log(`   ${k.padEnd(26)} ${String(v.수).padStart(6)}번 ${(v.ms / 1000).toFixed(0).padStart(6)}초`);
  };
  보기(앞, '앞');
  if (뒤) 보기(뒤, '뒤');
  const 뒤표 = new Map((뒤 || []).map((x) => [x.시험, x]));
  console.log(`\n== 시험마다(앞 벽 시간 큰 순) — 초 · 자식 수${뒤 ? ' → 뒤' : ''}`);
  for (const x of [...앞].sort((p, q) => q.벽ms - p.벽ms)) {
    const y = 뒤표.get(x.시험);
    console.log(`${(x.벽ms / 1000).toFixed(1).padStart(7)}초 ${String(x.수).padStart(5)}개${y ? ` → ${(y.벽ms / 1000).toFixed(1).padStart(6)}초 ${String(y.수).padStart(5)}개` : ''}  ${x.시험.slice(0, 90)}`);
  }
}

/** git 인자에서 하위 명령(앞의 `-c 값` · `-C 폴더` · `--git-dir 폴더` · `--no-pager` 같은 전역 선택은 건너뛴다) */
function git하위명령(args) {
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '-c' || a === '-C' || a === '--git-dir' || a === '--work-tree') { i++; continue; }
    if (!a.startsWith('-')) return a;
  }
  return '(없음)';
}

function 세기시작(출력) {
  const cp = require('node:child_process');
  let 지금 = '(밖)';
  const 표 = new Map();
  const 칸 = (이름) => { if (!표.has(이름)) 표.set(이름, { 시험: 이름, 시작: Date.now(), 끝: 0, 수: 0, ms: 0, 종류: {} }); return 표.get(이름); };
  for (const 이름 of ['spawnSync', 'execFileSync']) {
    const 원래 = cp[이름];
    cp[이름] = function 센(cmd, args, opts) {
      const 실행 = path.basename(String(cmd)).replace(/\.exe$/i, '');
      const 키 = 실행 === 'git' ? `git ${git하위명령(Array.isArray(args) ? args : [])}` : 실행;
      const s = process.hrtime.bigint();
      try { return 원래.call(this, cmd, args, opts); } finally {
        const ms = Number(process.hrtime.bigint() - s) / 1e6;
        const k = 칸(지금); k.수++; k.ms += ms;
        const t = k.종류[키] || (k.종류[키] = { 수: 0, ms: 0 }); t.수++; t.ms += ms;
      }
    };
  }
  const nt = require('node:test');
  const 원래test = nt.test;
  const 감싼 = function test(이름, ...나머지) {
    const i = 나머지.findIndex((x) => typeof x === 'function');
    if (i >= 0) {
      const f = 나머지[i];
      나머지[i] = async function 잰(ctx, ...더) {
        지금 = String(이름); 칸(지금).시작 = Date.now();
        try { return await f.call(this, ctx, ...더); } finally { 칸(String(이름)).끝 = Date.now(); 지금 = '(사이)'; }
      };
    }
    return 원래test.call(this, 이름, ...나머지);
  };
  Object.assign(감싼, 원래test);
  nt.test = 감싼;
  process.on('exit', () => {
    if (![...표.keys()].some((k) => !k.startsWith('('))) return;   // 시험을 안 돈 프로세스(node --test 러너 · 시험이 띄운 도구)는 남기지 않는다
    fs.writeFileSync(출력.replace(/(\.jsonl)?$/, `-${process.pid}.jsonl`), `${[...표.values()].map((x) => JSON.stringify({ ...x, 벽ms: x.끝 ? x.끝 - x.시작 : null })).join('\n')}\n`);
  });
}

if (require.main === module) {
  const 파일들 = process.argv.slice(2);
  if (!파일들.length) { console.error('사용법: node tools/시험자식세기.cjs <결과-pid.jsonl> [<견줄 jsonl>] — 세기는 머리말'); process.exit(2); }
  묶기(파일들);
} else if (process.env.SYNK_CHILD_COUNT) {
  세기시작(path.resolve(process.env.SYNK_CHILD_COUNT));
}

module.exports = { 묶기, git하위명령 };
