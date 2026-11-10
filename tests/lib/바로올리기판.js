/* 바로올리기 시험의 공용 판 — tests/바로올리기_*.test.js 다섯이 함께 쓴다(11-11 한 파일을 나누며 옮김).
 * 불러오는 순간 그 시험 프로세스의 환경을 정리한다: GIT_* 를 지우고 시험 전용 전역 git 설정(자동 정리 끔)을 가리키게 하고,
 * 작성자 · 커미터를 「시험」으로, SYNK_따라가기_저장중초=0(「방금 저장된 파일」 시험만 따로 켠다)으로 둔다.
 * 시험 파일마다 프로세스가 따로라 설정 파일도 pid마다 따로다. 실제 저장소·원격·전역 git 설정은 건드리지 않는다.
 * SYNK_BARO_TOOL: 뮤테이션 시험이 일부러 망가뜨린 도구 사본(tools/ 안)을 넣는다 — 다섯 파일 모두 이 모듈의 `도구`를 쓴다. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
// SYNK_BARO_TOOL: 뮤테이션 시험이 일부러 망가뜨린 사본(tools/ 안)을 넣는다
const 도구경로 = process.env.SYNK_BARO_TOOL ? path.resolve(process.env.SYNK_BARO_TOOL) : path.join(REPO, 'tools', '바로올리기.js');
const 도구 = require(도구경로);
const 정책 = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'git-storage-policy.json'), 'utf8'));

for (const k of Object.keys(process.env)) if (/^GIT_/.test(k)) delete process.env[k];
/* 시험만 쓰는 전역 git 설정 — 자동 정리(maintenance · gc --auto)만 끈다. commit · fetch · push마다 git이 정리 프로세스를 하나씩 더 띄우는데
 * (receive-pack 안에서도 하나) 시험 저장소는 작아 정리할 것이 없고, 시험이 재는 동작과도 무관하다(11-10 실측 — docs/현장노트/시험_화면확인.md). */
const 시험전역설정 = path.join(os.tmpdir(), `synk-baro-test-gitconfig-${process.pid}`);
fs.writeFileSync(시험전역설정, '[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n[receive]\n\tautogc = false\n');
process.on('exit', () => { try { fs.rmSync(시험전역설정, { force: true }); } catch (_) {} });
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: 시험전역설정,
  GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_NAME: '시험', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: '시험', GIT_COMMITTER_EMAIL: 'test@example.invalid',
});
// 시험은 파일을 쓰자마자 따라간다 — 「방금 저장된 파일」 시험만 따로 켠다
process.env.SYNK_따라가기_저장중초 = '0';

function 깃(폴더) {
  const g = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: 폴더, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  g.바이트 = (...args) => execFileSync('git', args, { cwd: 폴더, stdio: ['pipe', 'pipe', 'pipe'] });
  return g;
}

/** 공용 작업본은 겹친 경로에서 멈추지 않는다 — 그 경로만 남기고 옮긴다(2026-11-03). 작업본 바이트는 호출자가 본다. */
function 남겼다(r) {
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.ok(r.남김 && r.남김.length, JSON.stringify(r));
}
const 원격머리 = (판) => 깃(판.원격)('rev-parse', 'refs/heads/master').trim();

function 쓰기(폴더, 경로, 내용) {
  const 파일 = path.join(폴더, 경로);
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  fs.writeFileSync(파일, 내용);
}

function 작업본(폴더) {
  const g = 깃(폴더);
  return {
    폴더, g,
    쓰기: (p, v) => 쓰기(폴더, p, v),
    읽기: (p) => fs.readFileSync(path.join(폴더, p), 'utf8'),
    바이트: (p) => fs.readFileSync(path.join(폴더, p)),
    있나: (p) => fs.existsSync(path.join(폴더, p)),
    머리: () => g('rev-parse', 'HEAD').trim(),
    상태: () => g('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean).sort(),
    gitdir: () => path.resolve(폴더, g('rev-parse', '--git-dir').trim()),
  };
}

/** git 설정 파일에 적을 값(따옴표 · 역슬래시를 git 규칙대로 막는다 — 윈도우 경로의 `\`를 그대로 두면 설정을 못 읽는다). */
const 설정값 = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** .gitattributes · .gitignore인가 — 시험 저장소에 끼면 add가 바이트를 바꾸거나(변환) 새 파일을 빼서(무시) 아래 남push 지름길(fast-import)이 같은 커밋을 못 만든다. 그때는 옛 길(복제 · add · push)로 간다. */
const 규칙파일 = (p) => /(^|\/)\.git(attributes|ignore)$/.test(p);
/** git이 이 바이트로 만들 blob의 sha(필터 없이) — 남push가 「바뀐 것 없음」을 git commit처럼 막는 데 쓴다. */
const blobsha = (v) => { const b = Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };

/**
 * origin(bare) · 공용 작업본(master) · 워크트리 · 남의 push.
 * 만드는 상태는 예전(설정 다섯 번 · push · fetch)과 같다 — git 프로세스 수만 줄였다(11-10: 판 하나에 git 20개 → 9개, 시험 136곳).
 * 설정은 .git/config에 한 번에 적고, origin에는 push 대신 바탕 커밋의 객체를 복사해 가지를 세운다. 공용 작업본은 전처럼 fetch로 받는다.
 */
function 새판(t, { 파일 = {}, autocrlf = 'false', 정책고침 = null } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-baro-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 원격 = path.join(뿌리, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'pipe' });
  const 공용폴더 = path.join(뿌리, '공용');
  fs.mkdirSync(공용폴더);
  const 공용 = 작업본(공용폴더);
  공용.g('init', '-q', '-b', 'master');
  fs.appendFileSync(path.join(공용폴더, '.git', 'config'), [
    '[core]', `\tautocrlf = ${autocrlf}`, '[extensions]', '\tworktreeConfig = true',
    '[remote "origin"]', `\turl = ${설정값(원격)}`, '\tfetch = +refs/heads/*:refs/remotes/origin/*', '',
  ].join('\n'));
  쓰기(공용폴더, 'tools/git-storage-policy.json', `${JSON.stringify({ ...정책, ...(정책고침 || {}) }, null, 2)}\n`);
  for (const [p, v] of Object.entries(파일)) 쓰기(공용폴더, p, v);
  공용.g('-c', 'core.autocrlf=false', 'add', '-A');            // 바탕 커밋은 준 바이트 그대로(CRLF가 든 blob도 만든다)
  공용.g('-c', 'core.autocrlf=false', 'commit', '-q', '-m', '바탕');
  fs.cpSync(path.join(공용폴더, '.git', 'objects'), path.join(원격, 'objects'), { recursive: true });
  execFileSync('git', ['--git-dir', 원격, 'update-ref', 'refs/heads/master', 공용.머리()], { stdio: 'pipe' });
  공용.g('fetch', '-q', 'origin');
  const 판 = { 뿌리, 원격, 공용 };
  판.워크트리 = (이름, 바탕 = 'master') => {
    const 폴더 = path.join(뿌리, 이름);
    공용.g('worktree', 'add', '-q', '-b', `claude/${이름}`, 폴더, 바탕);
    return 작업본(폴더);
  };
  /**
   * 다른 곳에서 origin에 커밋을 올린다(남의 push). 값이 null이면 지운다.
   * 복제 · add · commit · push(git 13개, 약 3초 — 시험 180곳)와 같은 커밋(나무 · 부모 · 작성자 · 메시지)을 origin에 fast-import 한 번으로 만든다(11-10).
   * 같은 커밋이 되는 조건만 지름길로 간다 — .gitattributes · .gitignore가 끼거나 파일 · 폴더 자리가 바뀌거나 폴더를 지우면 옛 길로 간다.
   * 바뀐 것이 없으면 git commit처럼 던진다.
   */
  판.남push = (파일들, 메시지 = '남의 push') => {
    const 있던 = new Map(execFileSync('git', ['--git-dir', 원격, '-c', 'core.quotepath=false', 'ls-tree', '-r', '-z', 'master'], { stdio: 'pipe' })
      .toString('utf8').split('\0').filter(Boolean).map((줄) => { const 탭 = 줄.indexOf('\t'); const [모드, , sha] = 줄.slice(0, 탭).split(' '); return [줄.slice(탭 + 1), { 모드, sha }]; }));
    const 경로들 = Object.keys(파일들);
    const 자리겹침 = (p) => [...있던.keys()].some((q) => q.startsWith(`${p}/`)) || p.split('/').slice(0, -1).some((_, i, 앞) => 있던.has(앞.slice(0, i + 1).join('/')));
    const 지름길 = !경로들.some(규칙파일) && ![...있던.keys()].some(규칙파일) && !경로들.some(자리겹침)
      && !경로들.some((p, i) => 경로들.some((q, j) => i !== j && q.startsWith(`${p}/`)))
      && !경로들.some((p) => p.startsWith('"') || /[\u0000-\u001f]/.test(p));   // fast-import가 따옴표로 읽을 경로는 옛 길로
    if (!지름길) return 판.남push복제(파일들, 메시지);
    const 바뀜 = 경로들.filter((p) => (파일들[p] === null ? 있던.has(p) : !있던.has(p) || 있던.get(p).sha !== blobsha(파일들[p])));
    if (!바뀜.length) throw new Error('남push: 바뀐 것이 없다(git commit이면 「nothing to commit」)');
    const 초 = Math.floor(Date.now() / 1000), 분 = -new Date().getTimezoneOffset();
    const 때 = `${초} ${분 < 0 ? '-' : '+'}${String(Math.floor(Math.abs(분) / 60)).padStart(2, '0')}${String(Math.abs(분) % 60).padStart(2, '0')}`;
    const 조각 = [];
    const 글 = (s) => 조각.push(Buffer.from(s, 'utf8'));
    const 데이터 = (v) => { const b = Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'); 글(`data ${b.length}\n`); 조각.push(b); 글('\n'); };
    글(`commit refs/heads/master\nmark :1\nauthor ${process.env.GIT_AUTHOR_NAME} <${process.env.GIT_AUTHOR_EMAIL}> ${때}\ncommitter ${process.env.GIT_COMMITTER_NAME} <${process.env.GIT_COMMITTER_EMAIL}> ${때}\n`);
    데이터(`${메시지}\n`);
    글('from refs/heads/master^0\n');
    for (const p of 바뀜) {
      if (파일들[p] === null) 글(`D ${p}\n`);
      else { 글(`M ${있던.has(p) ? 있던.get(p).모드 : '100644'} inline ${p}\n`); 데이터(파일들[p]); }
    }
    글('\nget-mark :1\n');
    return execFileSync('git', ['--git-dir', 원격, 'fast-import', '--quiet'], { input: Buffer.concat(조각), stdio: ['pipe', 'pipe', 'pipe'] }).toString('utf8').trim();
  };
  /** 남push의 옛 길 — 복제해 커밋하고 push한다(지름길이 같은 커밋을 못 만드는 경우). */
  판.남push복제 = (파일들, 메시지 = '남의 push') => {
    const 다른 = path.join(뿌리, `다른-${crypto.randomBytes(3).toString('hex')}`);
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
    const g = 깃(다른);
    for (const [p, v] of Object.entries(파일들)) {
      if (v === null) fs.rmSync(path.join(다른, p), { force: true });
      else 쓰기(다른, p, v);
    }
    g('add', '-A');
    g('commit', '-q', '-m', 메시지);
    g('push', '-q', 'origin', 'master');
    return g('rev-parse', 'HEAD').trim();
  };
  /** 로컬 커밋의 작성자·작성 시각·메시지 그대로 origin에 올린다(내커밋.js 올리기가 다시 쌓아 올린 짝처럼) */
  판.짝push = (곳, 커밋, 파일들) => {
    const 다른 = path.join(뿌리, `짝-${crypto.randomBytes(3).toString('hex')}`);
    execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', 원격, 다른], { stdio: 'pipe' });
    for (const [p, v] of Object.entries(파일들)) 쓰기(다른, p, v);
    깃(다른)('add', '-A');
    const [이름, 메일, 날짜, 몸] = 곳.g('log', '-1', '--date=raw', '--format=%an%x00%ae%x00%ad%x00%B', 커밋).split('\0');
    execFileSync('git', ['commit', '-q', '-F', '-'], {
      cwd: 다른, input: 몸, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_AUTHOR_NAME: 이름, GIT_AUTHOR_EMAIL: 메일, GIT_AUTHOR_DATE: 날짜 },
    });
    깃(다른)('push', '-q', 'origin', 'master');
    return 깃(다른)('rev-parse', 'HEAD').trim();
  };
  /** 공용 작업본 master에 origin에 없는 커밋(남의 미푸시 = 꼬리)을 만든다 */
  판.미푸시 = (파일들, 메시지 = '남의 미푸시') => {
    for (const [p, v] of Object.entries(파일들)) 공용.쓰기(p, v);
    공용.g('add', '-A', '--', ...Object.keys(파일들));
    공용.g('commit', '-q', '-m', 메시지);
    return 공용.머리();
  };
  판.원격머리 = () => execFileSync('git', ['--git-dir', 원격, 'rev-parse', 'master'], { encoding: 'utf8', stdio: 'pipe' }).trim();
  판.원격파일 = (p, rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'show', `${rev}:${p}`], { encoding: 'utf8', stdio: 'pipe' });
  판.원격바이트 = (p, rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'cat-file', 'blob', `${rev}:${p}`], { stdio: 'pipe' });
  판.원격부모 = (rev = 'master') => execFileSync('git', ['--git-dir', 원격, 'rev-parse', `${rev}^`], { encoding: 'utf8', stdio: 'pipe' }).trim();
  판.원격에있나 = (p, rev = 'master') => spawnSync('git', ['--git-dir', 원격, 'cat-file', '-e', `${rev}:${p}`]).status === 0;
  return 판;
}

const 지문 = (파일) => crypto.createHash('sha256').update(fs.readFileSync(파일)).digest('hex');
const 공용글 = '# 공용\n\n## 가\n- a1\n\n## 나\n- b1\n';

// 가지를 옮긴 뒤 3방향 결과를 쓰는 rename이 EPERM으로 지면(편집기·색인·백신이 그 파일을 잡음) 작업본 미커밋이 빠진다(10-23 공용 작업본 트랙 한 줄).
function rename막기(t, 이름, 몇번, { 기다리는사이 = null } = {}) {
  const 원래 = fs.renameSync, 원래기다림 = Atomics.wait;
  const 막음 = { 진: 0 };
  const 풀기 = () => { fs.renameSync = 원래; Atomics.wait = 원래기다림; };
  t.after(풀기);
  막음.걸기 = () => {
    // 다시 하기 사이 기다림(최대 약 9.5초)을 시험에서는 건너뛰고, 기다리는사이가 있으면 첫 기다림에 한 번 부른다(그사이 남이 저장)
    Atomics.wait = () => { const f = 기다리는사이; 기다리는사이 = null; if (f) f(); return 'timed-out'; };
    fs.renameSync = (from, to) => {
      if (path.basename(String(to)) === 이름 && 막음.진 < 몇번) { 막음.진++; throw Object.assign(new Error(`EPERM: operation not permitted, rename '${from}' -> '${to}'`), { code: 'EPERM' }); }
      return 원래(from, to);
    };
  };
  막음.풀기 = 풀기;
  return 막음;
}

/** 10-22 트랙 꼴: 공용 작업본 세션들이 origin 고침 일부(Y1·Y2)만 작업본에 받아 쓰고, 다른 고침(X)은 받지 못한 채 제 줄(Z)을 쓰는 중. */
const 일부받음 = (() => {
  const 머리 = '- **시스템 효율 점검(10-20~21, 「시스템 자동화 효율성 점검」 세션):** 낭비의 뿌리 넷을 찾아 공용 작업본 쓰기를 줄였다';
  return {
    X: `${머리}. 이 점검에서 유호님 차례로 남은 것은 없다.\n`,
    X2: `${머리}. **10-22 남은 목록**은 「시스템 자동화 점검」 세션이 이어서 한다.\n`,
    Y1: '- 모두의창업 기한 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다 — 10-25 마감\n',
    Y1b: '- 모두의창업 기한 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다 — 10-23 14시로 정정\n',
    Y2: '- 모두의창업 지원금 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다 — 서약서 서명 전\n',
    Y2b: '- 모두의창업 지원금 줄도 길게 써서 다른 줄과 헷갈리지 않게 한다 — 서약서 두 장 준비 끝\n',
    Z: '- PATH 정착관리 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다 — 근거 조사 넷\n',
    Zb: '- PATH 정착관리 줄은 길게 써서 다른 줄과 헷갈리지 않게 한다 — 근거 조사 다섯(세션이 쓰는 중)\n',
  };
})();

/** 10-22 결정 표 꼴: 공용 작업본 세션들이 표 맨 위에 행을 붙이고 조각으로 올렸는데 origin에는 다른 차례로 들어갔다. */
const 결정표 = (() => {
  const 행 = (날, 이름, 글) => `| 2026-${날} | 확정 | [${이름}] ${글} — 길게 써서 다른 행과 헷갈리지 않게 한다 |\n`;
  return {
    머리: '# 결정\n\n| 날짜 | 상태 | 결정 |\n|---|---|---|\n',
    r1: 행('10-21', 'LAB 온라인 · 첫 연락일', '영업 첫 30곳의 첫 연락은 확인 셋 뒤에 보낸다'),
    r2: 행('10-21', 'LAB 온라인 · 영업 첫 연락 보류', '첫 메일·DM은 앱 확인 뒤로 미룬다'),
    r3: 행('10-20', '작업 방식', '공용 작업본 로컬 master에는 커밋을 쌓지 않는다'),
    A: 행('10-22', '예약 작업 · 멈춤 알림', '워크트리 세션이 올린 행 — 공용 작업본은 받지 못했다'),
    P1: 행('10-22', 'PATH · 아홉 가지', '공용 작업본 세션이 첫째로 붙여 조각으로 올린 행'),
    P2: 행('10-22', '조직 · 정직원 조건', '공용 작업본 세션이 둘째로 붙여 조각으로 올린 행'),
    P3: 행('10-22', 'PATH · 방향', '공용 작업본 세션이 셋째로 붙여 조각으로 올린 행'),
    L: 행('10-22', 'LAB 온라인 · 첫 연락일 다시', '공용 작업본 LAB 세션이 쓰는 중인 행(아직 안 올림)'),
  };
})();

/** 검수 지적 재현용 — 줄마다 한 줄인 짧은 문서 */
const 한줄씩 = (...줄들) => 줄들.map((l) => `${l}\n`).join('');

module.exports = {
  REPO, 도구경로, 도구, 정책, 깃, 남겼다, 원격머리, 쓰기, 작업본, 새판, 지문, 공용글, rename막기, 일부받음, 결정표, 한줄씩,
};
