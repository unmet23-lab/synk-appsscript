#!/usr/bin/env node
// 폰작업반입 — 클라우드(폰) 세션이 `claude/*` 브랜치에 남긴 작업을 master 로 가져온다.
//
// 왜 있나 (2026-08-07 첫 실사용에서 절차를 세 번 손으로 짰다):
//   **폰 작업은 「제출」이지 「반영」이 아니다.** 폰의 클로드가 "완료했습니다"라고 해도 결과는
//   옆길 브랜치에 놓이고, PC 에서 받아야 정본이 된다. 첫 실사용에서 PDF 16종·문서 40여 곳이
//   9시간 방치됐고 그 사이 master 가 20커밋 움직여 충돌 2건이 생겼다. 브랜치 3개 중 2개는
//   08-03·08-04 잔재였다 — 아무도 안 치우고 있었다.
//
// 🔴 merge 를 쓰지 않는다. 충돌이 나는 자리는 대개 docs/세션보드.md 인데, 그 파일은
//    **남의 살아있는 세션이 미커밋으로 들고 있다**(첫 실사용에서 8개). merge 는 그 위에
//    충돌 마커를 얹으므로 F073 사고가 된다. 게다가 폰의 보드 변경은 갈라진 시점 기준이라
//    이미 낡았다 — F076 때 "동승 보드 줄은 낡아서 안 가져왔다"와 같은 판정이다.
//    → 공유 파일을 뺀 나머지를 `checkout <브랜치> -- <경로>` 로 가져오고,
//      병합 이력만 `merge -s ours` 로 남긴다(그래야 「대기 중」 목록에서 사라진다).
//
// ⚠ 이 도구는 git 을 자기 안에서 부르므로 git-scope-guard(PreToolUse 훅)를 타지 않는다.
//   그래서 그 가드가 하던 검사를 **여기서 직접 한다** — 가져올 파일이 지금 미커밋이면 멈춘다.
//   느슨한 쪽이 실질 정책이 되게 두지 않는다(F081).
//
// 🔑 git 출력은 **한 줄에 여러 값을 담지 않는다.** 값마다 줄을 바꿔 세 줄씩 읽는다 —
//   제어문자 구분자를 쓰면 소스에 날문자가 심기고(F091·F158, 이 파일을 짜다가 실제로 3번째로
//   밟았다), 그건 눈에 안 보여서 어느 편집이 지워도 티가 안 난다. 안 쓰면 심을 수도 없다.
//
// 쓰는 법
//   node tools/폰작업반입.js                  대기·잔재 브랜치 목록 (아무것도 안 바꾼다)
//   node tools/폰작업반입.js --받기 <브랜치>   반입 → 커밋 → 병합 이력
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.SYNK_반입_ROOT || path.resolve(__dirname, '..');

/* 가져오지 않는 파일 — 여러 세션이 동시에 쓰는 자리라 브랜치 판은 갈라진 시점에서 이미 낡았다.
 * ⚠ 기준은 「덜 중요해서」가 아니라 「낡아서」다. 목록 정본은 tools/lib/선언판.js **한 벌**이다
 * (F357 — 여기 옛 보드 2경로만 적혀 있는 사이 F250 의 보드·장부·인계문 조각이 전부 새는
 *  자리였다: 브랜치 판 보드 조각이 죽은 줄을 되살리고, 장부 조각의 낡은 판이 남의 해소 칸을
 *  조용히 되돌린다). */
const { 선언판인가, 장부폴더 } = require(path.join(__dirname, 'lib', '선언판.js'));
/* master 직접 커밋을 그 자리에서 미는 공용 통로 — 같은 판정을 두 곳에 적으면 갈라진다. */
const 동기 = require(path.join(__dirname, 'lib', 'master동기.js'));

/* 추가전용 — 행마다 번호가 붙은 장부. `checkout` 은 파일을 **통째로** 바꾸므로 갈라진 뒤
 * master 에 붙은 행이 소리 없이 사라진다(F195 실측: 대기 브랜치 하나를 받으면 폰은 두 행의
 * 문구만 고쳤는데 그 사이 master 에 붙은 4행이 삭제로 실린다 — git 은 오류 0, `--stat` 도
 * 「1 파일 변경」으로만 보인다). 통째로 뺄 수도 없다: 폰이 적은 신호가 통째로
 * 사라진다. → **행 단위로 합친다.** */
const 추가전용 = ['docs/_ops/마찰신호.md'];

/* 선언판에서 반입이 예외로 받는 것 둘 — ①추가전용은 행 단위로 합친다(위) ②장부 조각의
 * «새 파일(A)»은 받는다: 번호는 origin 태그가 원자 채번이라 안 겹치고, 브랜치가 적은 신호를
 * 통째로 잃는 것이 정확히 추가전용이 막던 그 사고다. 기존 조각의 변경(M)·삭제(D)는
 * 갈라진 시점 판이라 받지 않는다(남의 해소 칸이 되돌아가는 자리). */
const 반입제외인가 = (f, s) => 선언판인가(f) && !추가전용.includes(f)
  && !(String(f).startsWith(장부폴더) && String(s).startsWith('A'));

const 행ID = (l) => (/^\|\s*(F\d+)\s*\|/.exec(String(l).trim()) || [])[1];

/** 내 판에 폰에만 있는 행을 붙인다. **같은 번호인데 내용이 다르면 내 판을 남긴다** —
 *  폰의 바탕은 갈라진 시점이라 낡았고(공유 파일과 같은 판정), 폰이 손으로 매긴 번호가 남의
 *  번호와 겹치기도 한다(실측: 대기 브랜치가 master 의 F195 와 **다른 사건**을 같은 번호로 들고 있었다).
 *  돌려주는 `버림` 은 버리는 게 아니라 **커밋 메시지에 전문으로 실어** 다시 올릴 자리를 남긴다. */
function 행합치기(내판, 폰판) {
  const 개행 = /\r\n/.test(내판) ? '\r\n' : '\n';
  const 줄 = String(내판).split(/\r?\n/);
  const 내행 = new Map();
  for (const l of 줄) { const id = 행ID(l); if (id) 내행.set(id, l.trim()); }

  const 붙임 = [], 버림 = [];
  for (const l of String(폰판).split(/\r?\n/)) {
    const id = 행ID(l);
    if (!id) continue;
    if (!내행.has(id)) 붙임.push(l.trim());
    else if (내행.get(id) !== l.trim()) 버림.push(l.trim());
  }
  // 표의 마지막 행 뒤에 넣는다(파일 끝이 아니라) — friction.js add 와 같은 자리다.
  let at = 줄.length;
  for (let i = 줄.length - 1; i >= 0; i--) if (행ID(줄[i])) { at = i + 1; break; }
  줄.splice(at, 0, ...붙임);
  return { 내용: 줄.join(개행), 붙임, 버림 };
}

function git(args, { 실패허용 = false } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (r.error || r.status !== 0) {
    if (실패허용) return null;
    console.error(`git ${args.slice(0, 3).join(' ')} 실패:\n${r.stderr || r.error}`);
    process.exit(1);
  }
  return String(r.stdout || '');
}

const 줄들 = (s) => String(s || '').split(/\r?\n/).filter(Boolean);

/** 값마다 줄을 바꿔 받은 출력을 n 개씩 묶는다. 빈 값도 한 줄을 차지하므로 **버리지 않는다** —
 *  filter(Boolean) 로 지우면 제목이 빈 브랜치 하나에 뒤가 통째로 밀린다. */
function 묶어읽기(out, n) {
  const 원시 = String(out || '').replace(/\r/g, '').split('\n');
  if (원시.length && 원시[원시.length - 1] === '') 원시.pop();
  const 결과 = [];
  for (let i = 0; i + n - 1 < 원시.length; i += n) 결과.push(원시.slice(i, i + n));
  return 결과;
}

/** 원격의 `claude/*` 브랜치를 미병합·잔재로 가른다. fetch 실패는 0건이 아니라 「못 봄」이다. */
function 브랜치들() {
  if (git(['fetch', '--quiet', 'origin'], { 실패허용: true }) === null) return null;
  const 뽑기 = (인자) => 묶어읽기(git(['for-each-ref', ...인자,
    '--format=%(refname:short)%0a%(committerdate:relative)%0a%(contents:subject)',
    'refs/remotes/origin/claude/']), 3)
    .map(([이름, 언제, 제목]) => ({ 이름, 언제, 제목 }));
  /* 🔑 기준은 **로컬 master** 다(origin/master 가 아니다) — 이 도구의 질문은 "내가 받았나"이고,
   *   push 는 별개 단계다. origin 기준으로 재면 반입 직후에도 계속 「대기 중」으로 떠서,
   *   받은 사람이 한 번 더 받으려 든다(실측: 회귀가 이걸 잡았다).
   *   ⚠ 작업본소유자.js 는 일부러 origin 기준이다 — 거긴 "원격에 뭐가 놓여 있나"를 묻는 자리라
   *     반입 후 push 전에 한 번 더 알리는 게 맞다(그건 「아직 안 밀었다」는 신호다). */
  return { 대기: 뽑기(['--no-merged', 'master']), 잔재: 뽑기(['--merged', 'master']) };
}

/** 이 브랜치에서 무엇을 가져오게 되나 — 실제로 바꾸기 전에 전부 드러낸다. */
function 계획(브랜치) {
  const 상태 = 줄들(git(['diff', '--name-status', `master...${브랜치}`]))
    .map((l) => { const [s, ...p] = l.split('\t'); return { s, f: p.join('\t') }; });
  /* 선언판의 삭제(D)도 함께 무시한다 — 브랜치가 자기 보드 조각을 지운 것(board-move 가 하는
   * 그 모양)이 아래 「파일 삭제 N건」 정지에 걸리면 그 브랜치는 영원히 받을 수 없게 된다(F103 꼴). */
  const 삭제 = 상태.filter((x) => x.s.startsWith('D') && !반입제외인가(x.f, x.s)).map((x) => x.f);
  const 가져올것 = 상태.filter((x) => !x.s.startsWith('D') && !반입제외인가(x.f, x.s)).map((x) => x.f);

  /* 미커밋과 겹치면 남의 편집을 덮는다 — 이건 경고가 아니라 정지 사유다.
   * 🔑 판정은 `status` 가 아니라 **내용**이다: 도구가 파일을 같은 내용으로 다시 쓰면 stat 만 달라져
   *   `status` 는 `M` 을 내는데(실측: 워크트리 블롭 해시가 인덱스와 **동일**한데도 M) 그건 편집이 아니다.
   *   그 거짓 겹침 하나로 반입이 통째로 막힌다. 미추적 파일은 내용 비교 대상이 아니라 따로 더한다. */
  const 미커밋 = new Set([
    ...줄들(git(['diff', '--name-only', 'HEAD'])),
    ...줄들(git(['ls-files', '--others', '--exclude-standard'])),
  ]);
  const 겹침 = 가져올것.filter((f) => 미커밋.has(f));

  /* 양쪽에서 바뀐 파일 — 덮어쓰는 건 맞지만 **무엇을 덮는지는 알고 덮어야 한다.**
   * 갈라진 지점 이후 master 도 건드린 파일이 여기 뜬다(merge 라면 충돌이 났을 자리). */
  const 갈래 = (git(['merge-base', 'master', 브랜치]) || '').trim();
  const master바뀐것 = new Set(줄들(git(['diff', '--name-only', `${갈래}..master`])));
  const 합칠것 = 가져올것.filter((f) => 추가전용.includes(f));
  const 양쪽 = 가져올것.filter((f) => master바뀐것.has(f) && !추가전용.includes(f));

  return { 상태, 삭제, 가져올것, 겹침, 양쪽, 합칠것, 제외: 상태.length - 삭제.length - 가져올것.length };
}

function 목록보기() {
  const b = 브랜치들();
  if (b === null) { console.log('⚠ 원격을 못 읽었다(fetch 실패) — 0건이 아니라 판정 불가다.'); return; }

  if (!b.대기.length) console.log('☁ 대기 중인 폰 브랜치 없음');
  for (const br of b.대기) {
    const p = 계획(br.이름);
    console.log(`\n☁ ${br.이름}  (${br.언제})`);
    console.log(`   ${br.제목}`);
    console.log(`   변경 ${p.상태.length}건 → 가져올 것 ${p.가져올것.length}건`
      + (p.제외 ? ` (공유 파일 ${p.제외}건 제외 — 갈라진 시점 판이라 낡았다)` : ''));
    if (p.삭제.length) console.log(`   ⚠ 파일 삭제 ${p.삭제.length}건 — 이 도구로는 못 지운다(손으로): ${p.삭제.join(', ')}`);
    if (p.양쪽.length) console.log(`   ⏭ master 가 갈라진 뒤 고친 파일 ${p.양쪽.length}건 — **건너뛴다**(덮으면 그 편집이 삭제로 실린다): ${p.양쪽.slice(0, 6).join(', ')}${p.양쪽.length > 6 ? ' …' : ''}`);
    if (p.합칠것.length) console.log(`   ✚ 추가전용 ${p.합칠것.length}건은 덮지 않고 **행 단위로 합친다**: ${p.합칠것.join(', ')}`);
    console.log(p.겹침.length
      ? `   🔴 미커밋과 겹침 ${p.겹침.length}건 — 받으면 남의 편집이 사라진다: ${p.겹침.join(', ')}`
      : '   ✅ 미커밋 겹침 0건');
    console.log(`   받으려면: node tools/폰작업반입.js --받기 ${br.이름}`);
  }

  if (b.잔재.length) {
    console.log(`\n🗑 잔재 브랜치 ${b.잔재.length}개 — 내용이 이미 master 에 있다(용도 끝)`);
    for (const br of b.잔재) console.log(`   · ${br.이름}  (${br.언제})  ${br.제목}`);
    console.log('   지우는 건 **원격 조작**이라 여기서 하지 않는다 — 유호님 승인 뒤 손으로:');
    console.log(`   git push origin --delete ${b.잔재[0].이름.replace(/^origin\//, '')}`);
  }
}

/* 병합 이력만 남긴다 — 내용은 위에서 checkout 으로 가져왔거나, 가져올 게 애초에 없었다.
 * 이게 없으면 그 브랜치가 영원히 「대기 중」으로 뜬다(작업본소유자).
 * `-s ours` = master 의 트리를 그대로 둔다. 낡은 공유 파일 판을 **일부러** 버리는 것이고,
 * 버려도 사라지지 않는다 — 브랜치가 이 병합의 부모로 남아 `git show` 로 영원히 읽힌다. */
function 병합이력(브랜치, 사유, 꼬리 = '') {
  const 임시 = path.join(os.tmpdir(), `synk-병합-${process.pid}.txt`);
  fs.writeFileSync(임시, `폰 브랜치 병합 이력 기록 — ${사유}\n${꼬리}`, 'utf8');
  git(['merge', '-s', 'ours', 브랜치, '-F', 임시]);
  fs.unlinkSync(임시);
  const 남았나 = 줄들(git(['for-each-ref', '--no-merged', 'master',
    '--format=%(refname:short)', `refs/remotes/${브랜치}`]));
  console.log(남았나.length ? '⚠ 아직 미병합으로 잡힌다 — 확인 필요' : '✅ 대기 목록에서 빠졌다');
  console.log('\n다음: 원격에 올린다 — git push origin master');
}

function 받기(브랜치) {
  if (!브랜치.startsWith('origin/claude/')) {
    console.error(`❌ 클라우드 브랜치가 아니다: ${브랜치}`);
    console.error('   origin/claude/… 형태만 받는다(다른 브랜치는 손으로 판단할 일이다).');
    process.exit(1);
  }
  if (git(['fetch', '--quiet', 'origin'], { 실패허용: true }) === null) {
    console.error('❌ fetch 실패 — 낡은 캐시로 반입하지 않는다.'); process.exit(1);
  }
  /* 이미 master 의 조상이면 끝난 브랜치다. `-s ours` 로 이력만 남긴 브랜치는 내용이 여전히
   * 달라 보이므로(트리를 일부러 안 가져왔다) 「가져올 것」 계산만으로는 재반입을 못 막는다. */
  if (git(['merge-base', '--is-ancestor', 브랜치, 'master'], { 실패허용: true }) !== null) {
    console.error(`❌ 이미 master 에 들어와 있다: ${브랜치}`);
    console.error('   내용이 달라 보여도 그건 공유 파일을 일부러 안 가져온 자리다 — 다시 받지 않는다.');
    process.exit(1);
  }
  const p = 계획(브랜치);
  /* 0건에는 성격이 다른 둘이 섞여 있다 — 갈라서 다루지 않으면 **받을 수 없는 브랜치**가 생긴다.
   * ①정말 빈 브랜치(이미 반입됨) = 멈출 자리.
   * ②변경이 전부 공유 파일이라 제외된 것 = 가져올 내용은 없지만 **이력은 남겨야 한다.**
   *   멈추면 그 브랜치는 영원히 「대기 중」으로 떠서 매 세션 시작을 오염시킨다(방치 9시간과 같은 계열). */
  /* 갈라진 뒤 master 도 건드린 파일은 **덮지 않고 건너뛴다** — 폰의 바탕은 그보다 옛 판이라
   * 덮으면 master 의 뒤 편집이 삭제로 실린다(F195 의 일반형 · 커밋에서라면 git-scope-guard ⑨ 가 막는 그 모양).
   * 실측: `bw80kq` 의 설계 문서는 이미 다른 경로로 들어와 있었고, 덮었으면 master 가 붙인 계보 각주가 사라졌다.
   * 버리는 게 아니라 커밋 메시지에 적고 브랜치가 부모로 남는다 — 폰 판이 맞으면 그 명령을 손으로 친다. */
  const 건너뜀 = p.양쪽;
  const 덮을것 = p.가져올것.filter((f) => !추가전용.includes(f) && !건너뜀.includes(f));

  if (!덮을것.length && !p.합칠것.length) {
    if ((!p.제외 && !건너뜀.length) || p.삭제.length) {
      console.error('❌ 가져올 것이 0건이다 — 이미 들어왔거나 브랜치가 비었다.');
      process.exit(1);
    }
    const 담긴것 = 줄들(git(['log', '--format=%h %s', `master..${브랜치}`])).map((s) => `  ${s}`).join('\n');
    console.log(`가져올 것 0건 — 변경 ${p.상태.length}건이 전부 공유 파일이거나 master 가 뒤에 고친 파일이다.`);
    console.log('   내용은 안 가져오되 이력은 남긴다(안 그러면 대기 목록에서 안 빠진다).');
    병합이력(브랜치, 건너뜀.length ? '내용이 master 에 이미 있거나 공유 파일뿐이었다' : '공유 파일뿐이라 내용은 안 가져왔다',
      `\n변경 ${p.상태.length}건이 전부 공유 선언판(보드·장부·인계문 조각 포함)이거나 갈라진 뒤 master 가 고친 파일이다 —\n`
      + '갈라진 시점 판이라 이미 낡았고, 덮으면 남의 뒤 편집이 삭제로 실린다(F073·F195).\n'
      + (건너뜀.length ? `건너뛴 파일: ${건너뜀.join(', ')}\n` : '')
      + '\n'
      + '버린 게 아니라 이 병합의 부모로 남는다 — 내용은 `git show` 로 읽는다:\n'
      + `${담긴것}\n`);
    return;
  }
  if (p.겹침.length) {
    console.error(`❌ 미커밋과 겹치는 파일 ${p.겹침.length}건 — 덮으면 남의 편집이 사라진다(F073):`);
    console.error(`   ${p.겹침.join('\n   ')}`);
    console.error('   그 세션이 커밋할 때까지 기다린다. 고쳐서 대신 커밋하지 않는다.');
    process.exit(1);
  }
  if (p.삭제.length) {
    console.error(`❌ 파일 삭제 ${p.삭제.length}건이 섞여 있다 — checkout 으로는 못 지운다:`);
    console.error(`   ${p.삭제.join('\n   ')}`);
    console.error('   삭제는 되돌림 비용이 다르므로 손으로 판단한다.');
    process.exit(1);
  }

  console.log(`가져올 것 ${p.가져올것.length}건` + (p.제외 ? ` (공유 파일 ${p.제외}건 제외)` : ''));
  if (건너뜀.length) console.log(`⏭ master 가 갈라진 뒤 고친 ${건너뜀.length}건은 **건너뛴다**(덮으면 그 편집이 삭제로 실린다): ${건너뜀.join(', ')}`);

  if (덮을것.length) git(['checkout', 브랜치, '--', ...덮을것]);
  const 합침 = p.합칠것.map((f) => {
    const 절대 = path.join(ROOT, f);
    const r = 행합치기(fs.readFileSync(절대, 'utf8'), git(['show', `${브랜치}:${f}`]));
    fs.writeFileSync(절대, r.내용, 'utf8');
    console.log(`✚ ${f} — 덮지 않고 합쳤다: 폰 행 ${r.붙임.length}건 붙임`
      + (r.버림.length ? ` · ⚠ 같은 번호가 다른 행 ${r.버림.length}건은 내 판을 남겼다(커밋 메시지에 전문)` : ''));
    return { f, ...r };
  });

  // 들어온 js 는 여기서 구문검사한다 — 깨진 채로 커밋하면 남의 배포 게이트까지 막는다.
  const js = 덮을것.filter((f) => f.endsWith('.js'));
  for (const f of js) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(`❌ 구문 오류 ${f}:\n${r.stderr}`); process.exit(1); }
  }
  if (js.length) console.log(`✅ node --check ${js.length}종 통과`);

  const 제목들 = 줄들(git(['log', '--format=%s', `master..${브랜치}`])).map((s) => `  - ${s}`).join('\n');
  const 안실은것 = (건너뜀.length
      ? `\n⏭ 갈라진 뒤 master 도 고친 ${건너뜀.length}건은 **건너뛰었다** — 폰의 바탕이 더 옛 판이라\n`
        + '   덮으면 master 의 뒤 편집이 삭제로 실린다(F195 의 일반형). 폰 판이 맞다고 판단되면 손으로:\n'
        + 건너뜀.map((f) => `   git checkout ${브랜치} -- "${f}"\n`).join('')
      : '')
    + 합침.map(({ f, 붙임, 버림 }) =>
      `\n✚ ${f} — 추가전용이라 덮지 않고 행 단위로 합쳤다(폰 행 ${붙임.length}건 붙임).\n`
      + (버림.length
        ? `⚠ 같은 번호를 다른 내용으로 쓴 행 ${버림.length}건은 **내 판을 남겼다** — 폰 판을 여기 그대로 싣는다.\n`
          + '   같은 사건의 문구 수정이면 이대로 두고, 다른 사건이면 새 번호로 다시 올린다:\n'
          + '   node tools/friction.js add <종류> "신고문"\n'
          + 버림.map((l) => `   ${l}\n`).join('')
        : '')).join('');

  /* 합쳐 보니 바뀌는 게 없을 수 있다 — 폰이 고친 행을 전부 내 판으로 남긴 경우(실측 `hftriw`).
   * 그럼 커밋할 게 없어 `git commit` 이 exit 1 로 죽고, **안 실은 폰 행이 어디에도 안 남는다.**
   * 「가져올 것 0건」과 같은 자리다: 내용은 못 가져와도 이력과 버린 것은 남긴다. */
  const 실제변경 = 줄들(git(['diff', 'HEAD', '--name-only', '--', ...덮을것, ...p.합칠것]));
  if (!실제변경.length) {
    console.log('실제로 바뀐 내용 0건 — 폰 판이 이미 반영돼 있거나 전부 내 판을 남겼다. 이력만 남긴다.');
    병합이력(브랜치, '합쳐 보니 바뀌는 내용이 없었다(전부 내 판을 남겼거나 이미 반영됨)',
      `${안실은것}\n브랜치가 담고 있던 커밋:\n${제목들}\n`);
    return;
  }

  const 메시지 = `폰(클라우드) 세션 작업 반입 — ${브랜치.replace('origin/claude/', '')}\n\n`
    + '폰 작업은 「제출」이지 「반영」이 아니다 — 브랜치에 놓인 것을 master 로 가져온다.\n'
    + 'merge 를 쓰지 않는 이유는 tools/폰작업반입.js 머리말에 있다(공유 파일 충돌 = F073).\n\n'
    + `가져온 것 ${실제변경.length}건`
    + (p.제외 ? ` (공유 파일 ${p.제외}건 제외 — 갈라진 시점 판이라 낡았다)` : '') + '\n'
    + 안실은것
    + `\n브랜치가 담고 있던 커밋:\n${제목들}\n`;
  const 임시 = path.join(os.tmpdir(), `synk-반입-${process.pid}.txt`);
  fs.writeFileSync(임시, 메시지, 'utf8');
  git(['commit', '-F', 임시, '--', ...덮을것, ...p.합칠것]);
  fs.unlinkSync(임시);

  // 커밋했다고 믿지 않는다 — 결과를 본다(F071: no-op 은 성공처럼 조용하다).
  const 방금 = (git(['log', '--format=%h %s', '-1']) || '').trim();
  if (!방금.includes('반입')) { console.error(`❌ 커밋이 안 된 것 같다 — HEAD: ${방금}`); process.exit(1); }
  console.log(`✅ 커밋 ${방금}`);
  /* 커밋과 push 는 한 벌이다 — 폰에서 가져온 것이 이 노트북에만 남으면 반입한 값이 절반이다
   * (master 직접 커밋이라 쌓이면 갈라져 push 자체가 튕긴다 · tools/lib/master동기.js). */
  console.log(동기.줄내기('폰작업반입', 동기.밀기(ROOT)));

  병합이력(브랜치, `내용은 ${방금.split(' ')[0]} 로 이미 반입(공유 파일 제외)`);
}

if (require.main === module) {
  const i = process.argv.indexOf('--받기');
  if (i >= 0) {
    const 브랜치 = process.argv[i + 1];
    if (!브랜치) { console.error('❌ 브랜치 이름이 없다: --받기 origin/claude/…'); process.exit(1); }
    받기(브랜치);
  } else 목록보기();
}

module.exports = { 계획, 브랜치들, 묶어읽기, 행합치기, 반입제외인가, 추가전용 };
