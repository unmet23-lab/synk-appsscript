'use strict';
/* 시험 픽스처가 git 프로세스를 덜 띄우게 하는 도우미(2026-11-11 — tests/내커밋.test.js · tests/공개.test.js).
 * 바쁜 윈도우에서는 프로세스 하나 띄우는 데 0.1~2초라 픽스처가 띄우는 git 수가 시험 파일 시간을 정한다. 만드는 상태(ref · 객체 · 설정 · 색인)는 옛 길과 같고 수만 줄인다.
 * 근거와 실측: docs/현장노트/시험_화면확인.md 「바로올리기 시험 한 파일이 test-ci 전체 런의 긴 막대다」. 같은 길을 tests/바로올리기.test.js가 먼저 갔다(11-10). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

/** 시험만 쓰는 전역 git 설정 파일 — 자동 정리(maintenance · gc --auto · receive의 autogc)만 끈다. commit · fetch · push마다 정리 프로세스가
 *  하나씩 더 뜨는데(receive-pack 안에서도) 시험 저장소는 작아 정리할 것이 없고 시험이 재는 동작과도 무관하다. 프로세스가 끝나면 지운다. */
function 시험전역설정(이름) {
  const 파일 = path.join(os.tmpdir(), `${이름}-gitconfig-${process.pid}`);
  fs.writeFileSync(파일, '[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n[receive]\n\tautogc = false\n');
  process.on('exit', () => { try { fs.rmSync(파일, { force: true }); } catch (_) { /* 이미 없음 */ } });
  return 파일;
}

/** git 설정 파일에 적을 값(따옴표 · 역슬래시를 git 규칙대로 막는다 — 윈도우 경로의 `\`를 그대로 두면 설정을 못 읽는다). */
const 설정값 = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** git 폴더(.git · bare)의 config 끝에 섹션들을 붙인다 — `git config` · `git remote add`를 여러 번 띄우는 대신. 섹션들: [['remote "origin"', { url, fetch }], …] */
function 설정붙이기(git폴더, 섹션들) {
  const 줄 = [];
  for (const [섹션, 값들] of 섹션들) {
    줄.push(`[${섹션}]`);
    for (const [k, v] of Object.entries(값들)) 줄.push(`\t${k} = ${설정값(v)}`);
  }
  fs.appendFileSync(path.join(git폴더, 'config'), `${줄.join('\n')}\n`);
}

/** origin을 가리키는 원격 설정(`git remote add origin <주소>`가 쓰는 두 줄) */
const 원격설정 = (주소) => ['remote "origin"', { url: 주소, fetch: '+refs/heads/*:refs/remotes/origin/*' }];

/** .gitattributes · .gitignore인가 — 끼면 add가 바이트를 바꾸거나(변환) 새 파일을 빼서(무시) fast-import가 같은 커밋을 못 만든다. */
const 규칙파일 = (p) => /(^|\/)\.git(attributes|ignore)$/.test(p);
const 바이트 = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(String(v), 'utf8'));
/** git이 이 바이트로 만들 blob의 sha(필터 없이) */
const blobsha = (v) => { const b = 바이트(v); return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
/** 지금 시각을 git 날짜 꼴(`<초> <+hhmm>`)로 — git commit이 쓰는 것과 같다 */
function 지금때() {
  const 초 = Math.floor(Date.now() / 1000), 분 = -new Date().getTimezoneOffset();
  return `${초} ${분 < 0 ? '-' : '+'}${String(Math.floor(Math.abs(분) / 60)).padStart(2, '0')}${String(Math.abs(분) % 60).padStart(2, '0')}`;
}

/**
 * bare 원격의 가지 위에 커밋 하나를 fast-import로 만든다 — 복제 · add · commit · push(git 5개 + push · clone 안의 git)와 같은 커밋(나무 · 부모 · 작성자 ·
 * 메시지 · 모드)을 git 2개(ls-tree · fast-import)로. 파일들: 경로 → 내용(글 · Buffer), null이면 지움.
 * 같은 커밋이 되는 조건만 이 길로 간다 — .gitattributes · .gitignore가 끼거나(새로 · 이미), 파일 ↔ 폴더 자리가 바뀌거나 폴더 · 없는 파일을 지우거나,
 * 일반 파일이 아닌 항목(링크 · 하위 모듈)을 바꾸거나, fast-import가 따옴표로 읽을 경로면 null을 돌려준다 — 부른 쪽이 옛 길로 간다.
 * 옛 길이 작업본에서 `add -A`로 함께 담던 것(작업본에 남은 추적 밖 파일)은 담지 않는다 — 그런 작업본이면 부른 쪽이 옛 길을 쓴다.
 * 바뀐 것이 없으면 git commit처럼 던진다. 작성자: git 머리 줄 그대로(`이름 <메일> <초> <+hhmm>`), 없으면 GIT_AUTHOR_* 환경과 지금.
 * 메시지: 커밋에 들어갈 바이트 그대로(git commit -m이면 끝에 줄바꿈 하나).
 */
function 원격에빠른커밋(원격, 가지, 파일들, 메시지, { 작성자 = null } = {}) {
  const 있던 = new Map(execFileSync('git', ['--git-dir', 원격, '-c', 'core.quotepath=false', 'ls-tree', '-r', '-z', 가지], { stdio: 'pipe' })
    .toString('utf8').split('\0').filter(Boolean).map((줄) => { const 탭 = 줄.indexOf('\t'); const [모드, , sha] = 줄.slice(0, 탭).split(' '); return [줄.slice(탭 + 1), { 모드, sha }]; }));
  const 경로들 = Object.keys(파일들);
  const 자리겹침 = (p) => [...있던.keys()].some((q) => q.startsWith(`${p}/`)) || p.split('/').slice(0, -1).some((_, i, 앞) => 있던.has(앞.slice(0, i + 1).join('/')));
  const 지름길 = !경로들.some(규칙파일) && ![...있던.keys()].some(규칙파일) && !경로들.some(자리겹침)
    && !경로들.some((p, i) => 경로들.some((q, j) => i !== j && q.startsWith(`${p}/`)))
    && !경로들.some((p) => 있던.has(p) && !/^100(644|755)$/.test(있던.get(p).모드))
    && !경로들.some((p) => 파일들[p] === null && !있던.has(p))   // 없는 파일 지우기는 옛 길이 던지는 그대로
    && !경로들.some((p) => p.startsWith('"') || /[\u0000-\u001f]/.test(p));
  if (!지름길) return null;
  const 바뀜 = 경로들.filter((p) => (파일들[p] === null ? 있던.has(p) : !있던.has(p) || 있던.get(p).sha !== blobsha(파일들[p])));
  if (!바뀜.length) throw new Error('원격에빠른커밋: 바뀐 것이 없다(git commit이면 「nothing to commit」)');
  const 때 = 지금때();
  const 조각 = [];
  const 글 = (s) => 조각.push(Buffer.from(s, 'utf8'));
  const 데이터 = (v) => { const b = 바이트(v); 글(`data ${b.length}\n`); 조각.push(b); 글('\n'); };
  글(`commit refs/heads/${가지}\nmark :1\n`);
  글(`author ${작성자 || `${process.env.GIT_AUTHOR_NAME} <${process.env.GIT_AUTHOR_EMAIL}> ${때}`}\n`);
  글(`committer ${process.env.GIT_COMMITTER_NAME} <${process.env.GIT_COMMITTER_EMAIL}> ${때}\n`);
  데이터(메시지);
  글(`from refs/heads/${가지}^0\n`);
  for (const p of 바뀜) {
    if (파일들[p] === null) 글(`D ${p}\n`);
    else { 글(`M ${있던.has(p) ? 있던.get(p).모드 : '100644'} inline ${p}\n`); 데이터(파일들[p]); }
  }
  글('\nget-mark :1\n');
  return execFileSync('git', ['--git-dir', 원격, 'fast-import', '--quiet'], { input: Buffer.concat(조각), stdio: ['pipe', 'pipe', 'pipe'] }).toString('utf8').trim();
}

/** 작업본(.git이 든 폴더)의 객체를 bare 원격에 복사하고 가지를 그 커밋에 세운다 — `git push origin <가지>`(push 안에서 receive-pack · unpack ·
 *  연결 검사 · 정리가 더 뜬다) 대신 git 하나(update-ref). 원격의 가지가 아직 없을 때(첫 push)만 쓴다. */
function 객체복사로세우기(작업본git폴더, 원격, 가지, 커밋) {
  fs.cpSync(path.join(작업본git폴더, 'objects'), path.join(원격, 'objects'), { recursive: true });
  execFileSync('git', ['--git-dir', 원격, 'update-ref', `refs/heads/${가지}`, 커밋, ''], { stdio: 'pipe' });
}

module.exports = { 시험전역설정, 설정값, 설정붙이기, 원격설정, 규칙파일, blobsha, 지금때, 원격에빠른커밋, 객체복사로세우기 };
