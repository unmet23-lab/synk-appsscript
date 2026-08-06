#!/usr/bin/env node
/**
 * 증거 패킷 — 유호님께 「적용할까요?」를 물을 때 딸려 가는 7항목을 자동 조립한다.
 *
 * 왜 있나 — 유호님이 기술 문서 여러 개를 조립해서 판단하실 필요가 없어야 한다
 *   (CLAUDE.md 「판단 재료의 단위도 유호님이 직접 셀 수 있는 것으로 환산한다」).
 *   7항목 중 6개는 git·gh·장부에서 그냥 나온다. 사람이 쓰는 건 ③ 한 줄뿐이다.
 *
 *   node tools/증거패킷.js <sha> [--env 개발|운영] [--영향 "한 줄"]
 *
 * ⚠ 이 도구는 **읽기만** 한다 — 배포도 승인도 하지 않는다.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 실행 = (cmd, args) => {
  try { return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }; }
  catch (e) { return { ok: false, out: '', 오류: e.code === 'ENOENT' ? `${cmd} 없음` : (e.message || '').split('\n')[0] }; }
};
// ⚠ `-c core.quotepath=false` 없이는 한글 경로가 `\354\235\270…` 로 나온다 —
//    유호님이 읽어야 하는 패킷에서 파일 이름이 사라지면 ②가 판단 재료가 못 된다.
//    repo 설정은 건드리지 않는다(다른 도구·CI가 그 설정에 얹혀 있다) — 호출마다 끈다.
const git = (...args) => 실행('git', ['-c', 'core.quotepath=false', ...args]);

function 테스트결과(sha) {
  const r = 실행('gh', ['run', 'list', '--commit', sha, '--limit', '5',
    '--json', 'conclusion,status,workflowName,url']);
  if (!r.ok) return { 층: '원격 미확인', 줄: [`⚠ ${r.오류} — 로컬 초록은 CI 초록이 아니다(직접 확인 필요)`] };

  let runs = [];
  try { runs = JSON.parse(r.out || '[]'); } catch { /* 형식이 바뀌었으면 아래에서 걸린다 */ }
  if (!runs.length) {
    // 내 커밋엔 run 이 없을 수 있다 — 바로 뒤 push 에 밀린다(CLAUDE.md)
    const 최신 = 실행('gh', ['run', 'list', '--limit', '3', '--json', 'conclusion,workflowName,headSha,url']);
    let 뒤 = [];
    try { 뒤 = JSON.parse(최신.out || '[]'); } catch { /* 무시 */ }
    return {
      층: '이 SHA 로 등록된 run 0건',
      줄: ['⚠ 뒤 push 에 밀렸을 수 있다 — 이 커밋을 담은 최신 run 을 대신 본다:',
        ...뒤.map((x) => `   ${x.conclusion || '진행중'} · ${x.workflowName} · ${(x.headSha || '').slice(0, 8)} · ${x.url}`)],
    };
  }
  return {
    층: '원격 run',
    줄: runs.map((x) => `${x.conclusion === 'success' ? '✅' : '🔴'} ${x.conclusion || x.status} · ${x.workflowName} · ${x.url}`),
  };
}

function 잔여(cwd) {
  const 줄 = [];
  const 장부 = path.join(cwd, 'tools', 'friction.js');
  if (fs.existsSync(장부)) {
    const r = 실행('node', [장부]);
    const m = /살아있음\s+(\d+)/.exec(r.out);
    if (m) 줄.push(`마찰 장부 열린 항목 ${m[1]}건 (전체 목록: node tools/friction.js)`);
  }
  // 문서에 박힌 동결 표식 — 「구현하지 마라」가 살아 있는데 배포하면 안 된다.
  // 장부·보드는 P0 를 **기록하는** 자리라 언제나 걸린다 → 빼야 신호가 산다(거짓 경보는 곧 꺼진다).
  const 기록처 = /마찰신호|세션보드|_ops/;
  const g = git('grep', '-l', '-e', 'failed_p0', '--', 'docs', '계약');
  const 걸림 = g.ok ? g.out.split('\n').filter((p) => p && !기록처.test(p)) : [];
  if (걸림.length) 줄.push(`⛔ failed_p0 동결 표식이 살아 있는 문서: ${걸림.join(' · ')}`);

  const s = 실행('node', [path.join(cwd, 'tools', '승인.js'), 'check']);
  if (s.out) 줄.push(...s.out.split('\n').filter(Boolean).map((l) => `  ${l}`));
  return 줄.length ? 줄 : ['(기계가 세는 잔여 항목 0 — 사람이 아는 것은 ③에 적는다)'];
}

function 패킷(sha, 환경, 영향) {
  const cwd = process.cwd();
  const 정보 = git('show', '-s', '--format=%H%n%s%n%an%n%ad', '--date=iso', sha);
  if (!정보.ok) { console.error(`[증거패킷] ${sha} 를 찾을 수 없다`); process.exit(1); }
  const [full, 제목, 작성자, 시각] = 정보.out.split('\n');
  const stat = git('show', '--stat', '--format=', full).out;
  const 테스트 = 테스트결과(full);

  console.log(`# 적용 승인 요청 — ${제목}\n`);
  console.log(`**① 적용할 커밋**  \`${full.slice(0, 10)}\` · ${작성자} · ${시각}\n`);
  console.log('**② 변경되는 것**\n```');
  console.log(stat || '(변경 없음)');
  console.log('```\n');
  console.log(`**③ 학생·운영자에게 미치는 영향**  ${영향 || '⚠ 아직 안 적음 — 이 한 줄은 사람이 쓴다(자동 조립 불가)'}\n`);
  console.log('**④ 남은 P0/P1/P2**');
  console.log(잔여(cwd).map((l) => `- ${l}`).join('\n') + '\n');
  console.log(`**⑤ 실행한 테스트와 결과** (${테스트.층})`);
  console.log(테스트.줄.map((l) => `- ${l}`).join('\n') + '\n');
  console.log(`**⑥ 적용 환경**  ${환경 || '⚠ 미지정 — `--env` 로 못박는다'}\n`);
  console.log('**⑦ 실패 시 롤백**');
  console.log(`- \`git revert ${full.slice(0, 10)}\` (되돌림 커밋이 남는다 — reset 은 남의 이력을 지운다)`);
  console.log(`- 직전 상태 = \`${git('rev-parse', '--short', `${full}^`).out || '(첫 커밋)'}\`\n`);
  console.log('---');
  console.log(`**${환경 || '(환경 미지정)'} 에 \`${full.slice(0, 10)}\` 을 적용할까요?**`);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 값 = (플래그) => { const i = argv.indexOf(플래그); return i >= 0 ? argv[i + 1] : null; };
  const sha = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--env' && argv[argv.indexOf(a) - 1] !== '--영향');
  if (!sha) { console.error('사용법: 증거패킷.js <sha> [--env 개발|운영] [--영향 "한 줄"]'); process.exit(1); }
  패킷(sha, 값('--env'), 값('--영향'));
}

module.exports = { 잔여, 테스트결과 };
