#!/usr/bin/env node
// friction — 마찰 신호를 세는 장부. 1인 규모의 eval.
//
// 왜 있나: CLAUDE.md는 마찰 신호를 "진화의 연료"라 부르는데, 지금까지 그 연료는
// **기록만 되고 세어지지 않았다.** 지침이 v6.10까지 오는 동안 어느 개정이 실제로 작동했는지
// 잴 수단이 없었다. 풀 eval 하네스는 1인 규모에 유지비가 효용을 넘으니, 세는 것부터 한다.
//
// 사용법:
//   node tools/friction.js                          집계
//   node tools/friction.js add 실수 "설명"           신호 추가(오늘 날짜, ID 자동)
//   node tools/friction.js add 교정 "설명" --date 2026-08-01
//   node tools/friction.js add 실수 "설명" --해소 "무엇이 막았나"   이미 고치고 신고할 때(F107)
//   node tools/friction.js add 마찰 --파일 경로.txt   신고문을 파일로(백틱·따옴표가 든 긴 글 · F297)
//   node tools/friction.js resolve F006 "무엇이 막았나"
//   node tools/friction.js resolve F006 --파일 경로.txt   해소문도 같은 통로다(F301)
//   node tools/friction.js defer F006 "왜 지금 안 닫나 · 어디서 판정했나"   보류(F386)
//   node tools/friction.js --open                   열림만(아직 아무도 판정 안 함)
//   node tools/friction.js --보류                    보류만(판정하고 열어둔 것)
'use strict';
const fs = require('fs');
const path = require('path');

// 테스트는 실제 장부를 건드리면 안 된다 — 회귀 테스트가 기록을 오염시키면 그 기록은 증거가 못 된다
const LEDGER = process.env.SYNK_FRICTION_LEDGER || path.resolve(__dirname, '..', 'docs', '_ops', '마찰신호.md');
/* 조각 폴더 — 새 행은 여기 `F0NN.md` 한 파일씩으로 산다(F250 후반 · 2026-08-08 유호님 지시 「공유 파일 쪼개기」).
 * 옛 한 파일(마찰신호.md)은 **동결 아카이브**다: 열린 행을 닫을 때도 아카이브는 고치지 않고
 * 같은 번호의 조각을 써서 읽기 조립이 조각을 이기게 한다(그림자). 병은 도구가 아니라
 * 「모든 세션이 한 파일에 줄을 끼우는 것」이었다 — 새 행이 새 파일이면 부딪칠 자리 자체가 없다. */
const FOLDER = path.join(path.dirname(LEDGER), '장부');
/* 채번 락 회귀는 **진짜 저장소 위에서** 돌려야 탐지력이 있다(태그 push가 실제로 거절되는지를 본다).
 * 그래서 장부와 별도로 저장소 루트도 갈아끼울 수 있게 둔다 — 격리 저장소를 준 테스트만 git을 만진다. */
const ROOT = process.env.SYNK_FRICTION_ROOT || path.resolve(__dirname, '..');
const KINDS = ['교정', '거절', '실수', '마찰'];

/* ── 세 번째 상태 「보류」 ──────────────────────────────────────────────────
 * 왜 있나 (F386 처방 · 2026-08-12 실측):
 *   장부는 두 상태뿐이었다 — 「해소」(고쳤다) 아니면 「열림」. 그런데 실제로 가장 흔한 제3의
 *   결론은 **「판정했다. 지금은 안 닫는다」** 다. `/evolve` v8.7(2026-08-09)이 12건을 그렇게
 *   판정하고 이유까지 `docs/지침_이력.md:492` 에 적었는데, 장부엔 그걸 적을 칸이 없어서
 *   그 판정이 **장부 밖에만** 남았다. 결과: 08-12 하루에 두 세션이 같은 12건을 「미측정」으로
 *   다시 쟀다(`e594c36e` 전수 대조 → `ea5ea5a8` 재대조). 2회차 = 실수가 아니라 시스템 결함.
 *   🔑 병은 낡음 탐지가 아니다(F386 이 탐지기 3가설을 실측으로 죽였다) — **판정을 적을 자리가
 *      없는 것**이다. 자리가 없으면 판정은 매번 사라지고, 사라진 판정은 매번 다시 든다.
 *
 * 왜 새 열이 아니라 해소 칸의 표식인가:
 *   장부 행은 `| id | 날짜 | 종류 | 신고문 | 해소 |` 5칸이고 이 형식을 그대로 읽는 소비자가
 *   넷이다(rot-check · friction-close-guard · 증거패킷 · 표.js). 열을 늘리면 그 넷이 조용히
 *   갈라진다. 표식은 형식을 안 바꾸므로 **못 읽는 소비자가 생기지 않는다** — 표식을 모르는
 *   쪽은 「해소됨」으로 읽는데, 그쪽(증거패킷의 배포 잔여 경고)에겐 그게 오히려 틀린 답이라
 *   아래 `살아있음` 집계는 보류를 계속 포함한다(결함은 여전히 서 있다).
 *
 * ⚠ 보류 ≠ 해소다. 결함은 그대로 서 있고, 바뀐 것은 **「누가 이미 판정했다」** 하나뿐이다.
 *   그래서 보류는 `/evolve` 발동 분모에서만 빠지고(이미 그 판을 지났다) 살아있음에는 남는다. */
const DEFER = '⏸';

/** 행의 상태 — 열림·보류·해소 셋 중 하나. **판정은 여기 하나뿐이다**(같은 판정을 두 곳에
 *  적으면 갈라진다 · CLAUDE.md 가드 맹점 ④). 소비자는 전부 이 술어를 import 해서 쓴다. */
function 상태(r) {
  const c = String((r && r.resolved) || '').trim();
  if (!c) return '열림';
  return c.startsWith(DEFER) ? '보류' : '해소';
}
const 열렸나 = (r) => 상태(r) === '열림';
const 보류인가 = (r) => 상태(r) === '보류';
const 해소됐나 = (r) => 상태(r) === '해소';
/** 살아있음 = 결함이 아직 서 있다 = 열림 + 보류. 「판정됐나」와 「고쳐졌나」는 다른 축이다. */
const 살아있나 = (r) => !해소됐나(r);
const TAG_PREFIX = 'friction-';   // 예약 태그: friction-F041 (릴리스 태그 synk-v9.NNN과 구분)
const MAX_TRIES = 20;
const LOCK = LEDGER + '.lock';
const LOCK_TRIES = 50;            // × LOCK_WAIT_MS = 5초까지 기다린다
const LOCK_WAIT_MS = 100;
const LOCK_STALE_MS = 30_000;     // 죽은 세션이 남긴 락은 이 시간 뒤 회수한다
// 격리 장부만 준 테스트는 git을 안 만진다. 격리 저장소까지 준 테스트는 락을 실제로 건다.
const ISOLATED = !!process.env.SYNK_FRICTION_LEDGER && !process.env.SYNK_FRICTION_ROOT;

/** 실패를 null로 돌려주는 git — 장부 기록이 git 사정으로 멈추면 안 된다(신호 유실이 더 나쁘다). */
function gitQuiet(args) {
  const { execFileSync } = require('child_process');
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (_) { return null; }
}

/* 읽기→쓰기를 직렬화한다. **채번 락은 번호만 지키고 파일 내용은 안 지킨다.**
 *
 * 왜 있나 (F148 · 2026-08-07 실측): add() 는 read() 로 파일 전체를 버퍼에 담고,
 *   그 사이 allocateId() 가 git fetch + tag push 로 **네트워크를 다녀온다**(초 단위).
 *   돌아와서 낡은 버퍼에 한 줄 끼워 통째로 writeFileSync 하니, 그 창에 옆 세션이 쓴 행이
 *   흔적 없이 사라진다. 실제로 내 F145 가 옆 세션의 F146 추가에 덮여 없어졌고 —
 *   번호는 안 겹쳤다(태그 락이 일했다). 남은 흔적은 F144 다음이 F146 이라는 구멍뿐이었다.
 *   ☠ 도구는 성공을 출력했고 오류는 없었다. git-scope-guard 가 커밋 diff 를 보여주지
 *   않았으면 콘솔만 믿고 넘어갔을 것이다 — **사라진 쪽은 아무 신호도 남기지 않는다.**
 *
 * `wx` 는 「없을 때만 만든다」를 커널이 원자적으로 판정한다(존재 확인과 생성 사이에 창이 없다).
 * 세션 7개가 동시에 도는 저장소라 보드·장부처럼 모두가 append 하는 파일은 전부 같은 구조다.
 *
 * ⚠ 원칙은 그대로 지킨다 — **기록이 도구 사정으로 멈추면 안 된다**(신호 유실이 더 나쁘다).
 *   락을 끝내 못 잡으면 막지 말고 **경고를 내고 진행한다**. 조용히 넘어가면 지켜진 줄 안다. */
function withLock(fn) {
  for (let i = 0; i < LOCK_TRIES; i++) {
    let fd = null;
    try {
      fd = fs.openSync(LOCK, 'wx');
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      /* 죽은 세션(크래시·Ctrl-C)이 남긴 락을 회수한다 — 안 그러면 한 번의 사고가 장부를 영구히 잠근다.
       * 회수 자체도 경쟁하지만 지는 쪽은 unlink 가 실패할 뿐이라 손실이 없다. */
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > LOCK_STALE_MS) fs.unlinkSync(LOCK);
      } catch (_) { /* 그 사이 주인이 풀었다 */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_WAIT_MS);
      continue;
    }
    try {
      return fn();
    } finally {
      fs.closeSync(fd);
      try { fs.unlinkSync(LOCK); } catch (_) { /* 누가 낡은 락으로 보고 회수했다 */ }
    }
  }
  console.error(
    `⚠ 장부 락을 ${(LOCK_TRIES * LOCK_WAIT_MS) / 1000}초 동안 못 잡았다 — 락 없이 진행한다(기록을 멈추지 않는다).\n`
    + `  남은 락이 죽은 세션 것이면 지워도 된다: ${LOCK}`,
  );
  return fn();
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* 표 가르기는 **공용 통로 하나**에서 온다 — 같은 한 줄짜리 결함이 이 저장소의 표 읽는 곳
 * 네 군데에서 동시에 터졌다(사연은 tools/lib/표.js 머리말). 장부는 add() 만 쓰는 통로가
 * 아니라서(손편집·폰작업반입 병합) 쓰는 쪽의 소독에 기대면 안 되고 읽는 쪽이 버텨야 한다. */
const { 칸나누기, 칸안전 } = require(path.join(__dirname, 'lib', '표.js'));
const splitCells = (raw) => 칸나누기(`|${raw}|`);

/* 조각 폴더의 행들 — 파일 하나 = 행 하나(F0NN.md). **못 읽음 ≠ 없다**:
 * 없다로 번역하면 close-guard 가 침묵한다(새는 방향이 통과다 · 보드 쪼개기 회귀가 못박은 그 자리).
 * 그래서 못 읽은 조각은 열린 행 모양으로 세워 소리가 나게 한다. */
function 조각행들() {
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(FOLDER); } catch (_) { return []; }   // 폴더 없음 = 조각 0 (첫 add 전)
  const out = [];
  for (const 이름 of 이름들) {
    const m = /^(F\d+)\.md$/.exec(이름);
    if (!m) continue;
    let 줄 = null;
    try {
      줄 = fs.readFileSync(path.join(FOLDER, 이름), 'utf8').split('\n')
        .map((l) => l.trim()).find((l) => /^\|\s*F\d+\s*\|/.test(l));
    } catch (_) { /* 아래 폴백 행으로 */ }
    out.push({ 파일: path.join(FOLDER, 이름), 줄: 줄 || `| ${m[1]} | | 마찰 | (조각을 읽지 못했다: ${이름} — 열어 확인한다) | |` });
  }
  return out;
}

function read() {
  const text = fs.readFileSync(LEDGER, 'utf8');
  const lines = text.split('\n');
  const rows = [];
  const 넣기 = (line, i, 파일) => {
    const m = /^\|\s*(F\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (!m) return;
    const cells = splitCells(m[2]);
    const r = { id: m[1], date: cells[0], kind: cells[1], signal: cells[2], resolved: cells[3] || '', line: i, 파일 };
    const 자리 = 파일 ? rows.findIndex((x) => x.id === r.id) : -1;
    if (자리 >= 0) rows[자리] = r;   // 같은 번호는 조각이 이긴다 — 아카이브는 동결이라 이후의 진실은 조각 쪽
    else rows.push(r);
  };
  lines.forEach((line, i) => 넣기(line, i, null));
  for (const c of 조각행들()) 넣기(c.줄, -1, c.파일);
  rows.sort((a, b) => parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10));
  return { text, lines, rows };
}

/* 다른 세션이 이미 쓴 번호를 훑는다 — 장부는 append-only **공유 파일**이라
 * 각 세션이 자기 작업본만 보고 번호를 매기면 같은 번호를 두 개 만든다(2026-08-03 실제 충돌: F015·F016).
 * 이건 이 저장소에서 **세 번째** 같은 형태다 — 버전 동시 발번 9건(bump-version 채번 락으로 해소),
 * 버전 이력 체인 누락(같은 날), 그리고 이것. 「세션이 각자 base에서 순번을 매기면 충돌한다」가 패턴이다.
 * 훑는 범위: origin/master + 모든 로컬 브랜치 + **예약 태그**.
 * 네트워크·git 실패는 막지 않는다(장부 기록이 도구 사정으로 멈추면 신호가 유실된다 — 그게 더 나쁘다). */
function seenElsewhere(opts) {
  const rel = path.relative(ROOT, LEDGER).replace(/\\/g, '/');
  const maxIn = (text) => [...String(text).matchAll(/^\|\s*F(\d+)\s*\|/gm)]
    .reduce((a, m) => Math.max(a, Number(m[1]) || 0), 0);

  let max = 0;
  if (!opts || opts.fetch !== false) gitQuiet(['fetch', 'origin', '--tags', '--quiet']);
  /* 훑는 범위에 **클라우드(폰) 브랜치**도 넣는다 — 폰은 채번 태그 push 가 막혀 손으로 번호를 매기는데(F196),
   * 여기가 origin/master + 로컬만 보면 그 손번호를 못 봐서 **양쪽이 서로를 못 보는** 상태가 된다.
   * 실측 08-07: 폰이 F195 를 손으로 달았고 PC 도 같은 번호를 다른 사건에 써서, 반입 때 재번호(F198)가 필요했다.
   * 태그 락은 이 자리를 못 메운다 — 락은 「아직 안 쓰인 순간」을 덮는 것이고, 이건 이미 쓰인 번호를 못 본 것이다. */
  const refs = ['origin/master'];
  for (const 패턴 of ['refs/heads', 'refs/remotes/origin/claude']) {
    (gitQuiet(['for-each-ref', '--format=%(refname:short)', 패턴]) || '')
      .split('\n').map((s) => s.trim()).filter(Boolean).forEach((b) => refs.push(b));
  }
  const relDir = path.relative(ROOT, FOLDER).replace(/\\/g, '/');
  refs.forEach((ref) => {
    const text = gitQuiet(['show', ref + ':' + rel]);
    if (text !== null) max = Math.max(max, maxIn(text));   // null = 그 ref에 장부가 없다
    /* 조각 폴더의 번호는 **파일 이름**이 든다 — 내용을 읽을 필요 없이 이름만 훑는다.
     * (quotepath 가 한글 폴더명을 8진수로 이스케이프해도 `F0NN.md` 는 ASCII 라 그대로 남는다.) */
    const 조각 = gitQuiet(['ls-tree', '-r', '--name-only', ref, '--', relDir]);
    if (조각 !== null) {
      for (const m of 조각.matchAll(/(?:^|\/)F(\d+)\.md/gm)) max = Math.max(max, Number(m[1]) || 0);
    }
  });
  // 예약 태그 — 아직 **장부에 쓰이지도 않은** '방금 가져간' 번호까지 포함한다(bump-version과 같은 이유)
  (gitQuiet(['tag', '-l', TAG_PREFIX + 'F*']) || '').split('\n').forEach((t) => {
    const m = /F(\d+)\s*$/.exec(t.trim());
    if (m) max = Math.max(max, Number(m[1]) || 0);
  });
  return max;
}

function nextId(rows, opts) {
  const local = rows.reduce((a, r) => Math.max(a, parseInt(r.id.slice(1), 10) || 0), 0);
  // 격리 장부 테스트는 git 조회를 건너뛴다(실제 저장소 이력이 픽스처 번호를 밀어버리면 검사가 무의미해진다)
  const elsewhere = ISOLATED ? 0 : seenElsewhere(opts);
  return 'F' + String(Math.max(local, elsewhere) + 1).padStart(3, '0');
}

/* 채번 락 — git push의 원자성을 번호 예약에 쓴다(bump-version과 같은 방식).
 *
 * 왜 훑기만으로는 안 되나 (2026-08-04 실물 충돌 F041 — 내 것과 옆 세션 것 둘):
 *   seenElsewhere는 **이미 기록된** 번호만 본다. 두 세션이 같은 순간에 훑으면 같은 답을 보고
 *   둘 다 그 번호를 쓴다. 훑는 범위를 아무리 넓혀도 「아직 아무 데도 안 쓰인 순간」은 못 덮는다 —
 *   이건 탐지 범위의 문제가 아니라 **고르는 행위가 원자적이지 않다**는 문제다.
 *   (이 파일의 옛 주석은 "마찰 신호는 재번호로 복구 가능하니 락은 과하다"고 판단했는데,
 *    실제로 충돌하자 복구는 「둘 중 누가 물러날지」를 사람이 정하는 일이 됐다. 유호님 결정으로 락 추가.)
 *
 * ⚠ 원칙은 그대로 지킨다 — **기록이 도구 사정으로 멈추면 안 된다.** 오프라인이면 예약을 건너뛰고
 *   훑은 번호로 진행하되 그 사실을 경고로 드러낸다(조용히 넘어가면 예약된 줄 알고 또 충돌한다).
 *
 * 🔴 F196 (2026-08-07 실측) — **거절을 한 가지로 단정하면 폰에서 통째로 죽는다.**
 *   클라우드(폰) 세션의 git 프록시는 지정 `claude/*` 밖 push 를 거부한다(태그 포함). 그런데 fetch 는
 *   성공하므로 위의 오프라인 갈래에 안 걸리고, 아래 루프는 거절을 **전부** 「누가 방금 가져갔다」로
 *   읽어 20회 헛돈 뒤 exit 1 한다 — 즉 **신고문이 버려진다.** 원칙(기록이 멈추면 안 된다)이 있는데
 *   그 갈래에 도달하지 못하는 것이 결함이다. 실물: F195 등재가 이렇게 죽어 손으로 번호를 매겼다.
 *   가르는 방법은 메시지 파싱이 아니라 **증거**다 — 거절 뒤 origin 에 그 태그가 실제로 생겼는가.
 *   생겼으면 선점(다음 후보로), 없으면 push 자체가 막힌 환경(예약 포기하고 진행).
 *
 * 🔴 F201 (2026-08-07 실측) — **같은 커밋 위의 두 세션에게는 락이 조용히 안 물었다.**
 *   라이트웨이트 태그는 커밋을 가리키는 이름일 뿐이라, 두 작업본의 HEAD 가 같으면 두 태그가 **같은
 *   객체**다. 그러면 두 번째 push 는 거절이 아니라 「Everything up-to-date」로 **exit 0** 이고
 *   도구는 그걸 「원격이 보증했다」로 읽는다. 실측: A·B 를 같은 커밋에 두니 **둘 다 F003** 을 받았다.
 *   이 저장소는 세션 다수가 같은 master HEAD 에서 출발하므로 드문 경우가 아니다 — F041 이 실제로
 *   났던 그 모양이다. 그래서 예약 태그를 **세션 고유 객체**(annotated tag)로 만든다: SHA 가 갈리면
 *   두 번째 push 는 「already exists」로 정직하게 거절되고, 그때부터 위의 F196 판별식이 일한다. */

/** 예약 태그에 새길 주인 — 세션마다 달라야 SHA 가 갈린다(같으면 F201 이 그대로 돌아온다). */
function 예약자() {
  return (process.env.CLAUDE_CODE_HOST_SESSION_ID || 'unknown') + '/' + process.pid;
}
function allocateId(rows) {
  if (ISOLATED) return nextId(rows);                       // 격리 장부 — git 접촉 금지

  const online = gitQuiet(['fetch', 'origin', '--tags', '--quiet']) !== null;
  let n = parseInt(nextId(rows, { fetch: false }).slice(1), 10);
  const 미예약진행 = (id, 사유) => {
    console.error('⚠ ' + 사유 + ' 번호를 예약하지 못했다 — ' + id + ' 로 진행한다. 다른 세션이 같은 번호를 쓸 수 있다(그때는 재번호).');
    return id;
  };
  if (!online) return 미예약진행('F' + String(n).padStart(3, '0'), 'origin fetch 실패.');

  for (let i = 0; i < MAX_TRIES; i++, n++) {
    const id = 'F' + String(n).padStart(3, '0');
    const tag = TAG_PREFIX + id;
    /* `-a` 가 F201 의 전부다 — 라이트웨이트로 만들면 같은 커밋 위의 옆 세션과 **같은 객체**가 된다.
     * 실패 사유도 가른다: 로컬에 이미 있으면 다음 후보, 아니면(신원 없음 등) 기록을 멈추지 않는다. */
    if (gitQuiet(['tag', '-a', tag, '-m', '예약 ' + id + ' · ' + 예약자()]) === null) {
      if (gitQuiet(['rev-parse', '--verify', '--quiet', 'refs/tags/' + tag]) !== null) continue;
      return 미예약진행(id, '예약 태그를 만들지 못했다(git 사용자 정보 없음?).');
    }
    if (gitQuiet(['push', 'origin', tag]) !== null) return id;   // 원격이 보증 = 내 번호
    gitQuiet(['tag', '-d', tag]);
    /* 거절 사유를 가른다(F196) — 증거는 메시지가 아니라 **origin 이 그 태그를 실제로 갖고 있느냐**다.
     * 갖고 있으면 진짜 선점(다음 후보로). 아니면 예약을 접고 진행한다 — 못 갈랐을 때(ls-remote 실패)도
     * 진행 쪽이다: 번호 중복은 재번호로 복구되지만 **버려진 신고문은 복구 경로가 없다**(F196 실물). */
    const 원격 = gitQuiet(['ls-remote', '--tags', 'origin', 'refs/tags/' + tag]);
    if (원격 !== null && 원격.trim()) continue;                   // 원격이 갖고 있다 = 누가 방금 가져갔다
    return 미예약진행(id, 원격 === null
      ? 'origin 조회가 실패해 거절 사유를 못 갈랐다.'
      : '태그 push 가 막힌 환경이다(선점이 아니다 — 클라우드/폰 프록시는 claude/* 밖 push 를 거절한다 · F196).');
  }
  console.error(`[friction] ${MAX_TRIES}회 시도에도 번호를 예약하지 못했다. 잠시 뒤 다시 시도한다.`);
  process.exit(1);
}

/* 신고문이 **이미 착지한 해소를 스스로 지목**하는가 — 지목하면 그 문구를 돌려준다.
 *
 * 왜 있나 (F107 · 2026-08-05): 이 저장소의 정상 순서는 「고치고 → 신고」다.
 *   그러면 수리 커밋에는 아직 없는 번호가 들어갈 수 없고(행이 없으니까),
 *   번호를 다는 유일한 커밋은 **신고 커밋**인데 friction-close-guard 는 신고 커밋을 면제한다.
 *   → 번호를 단 커밋과 행을 안 건드린 커밋이 **영원히 겹치지 않아** 가드가 원리상 못 짖는다.
 *   실제로 F107 은 신고 제목에 「해소 장치 동반: b7a2a18·fff91f0」이라 적고도 칸은 빈 채 남았다.
 *
 * 이 축은 세 번째다(F092 안 고치고 닫음 · F096 고치고 안 닫음 · F107 가드가 있는데 못 봄) —
 *   CLAUDE.md 신뢰성: 3번째는 **원인을 쓸 수 없게** 만든다. 그래서 탐지가 아니라 통로를 바꾼다.
 *   판별식은 여기 하나만 두고 훅이 require 한다(같은 판정을 두 곳에 적으면 갈라진다 · 맹점 ④).
 *
 * ⚠ 왜 이 좁은 문구인가 — 장부 108행 전수 실측으로 골랐다.
 *   「착지한 sha 가 있으면」은 거짓양성 12건(신고문은 **원인** 커밋을 늘 지목한다),
 *   「해소 계열 낱말 + 착지 sha」는 1건 + 아직 열린 F105 를 오지목했다. 이 규칙만 0건이다.
 *   좁아서 표기를 바꾸면 샌다 — 그래서 이건 **보조**고, 본체는 아래 `--해소` 통로다. */
function 해소주장(signal) {
  const m = /해소\s*[=:]|해소\s*장치/.exec(String(signal || ''));
  return m ? m[0].trim() : null;
}

/* ── 통로의 마지막 칸 — 장부를 쓴 그 자리에서 커밋한다 ─────────────────────────
 *
 * 왜 있나 (2026-08-07 실측): **장부를 커밋하는 자리가 통로 어디에도 없었다.**
 *   이 도구는 편집만 하고 · friction-close-guard 는 커밋 **뒤**에 짖고(차단 아님) ·
 *   auto-commit 은 이 파일을 의도적으로 제외한다. 그래서 커밋은 사람 손으로 넘어갔는데,
 *   손은 「남의 미커밋은 그대로 두고 보고한다」 규약에 막힌다 — 장부는 모든 세션이
 *   규약상 만지는 공용 장부라(handoff-store.공용장부) 언제나 남의 행이 섞여 있다.
 *   결과 = 죽은 세션의 장부 행이 **주인 없는 미커밋**으로 뜬 채 쌓인다. 하루 3회 손으로
 *   수거됐고(4e647ad·8ecd37a·이 트랙) 한 번은 실제로 소실됐다(F123 → 4143996 이 되살림).
 *   F025·F037·F073 은 셋 다 **미커밋으로 떠 있는 시간**에만 일어난다 — 그 시간을 0으로 만든다.
 *
 * 🔑 왜 auto-commit 금지가 여기엔 안 걸리나 — 그 금지 사유는 「F0NN 을 모르는 통로가
 *   커밋하면 friction-close-guard 가 우회된다」였다. 이 통로는 번호를 **안다.** 메시지에
 *   그 번호를 박으므로 close-guard 는 그대로 짖는다(신고 커밋 면제·해소 커밋 통과 전부 유지).
 *
 * ⚠ 같은 파일의 남의 행은 **함께 실린다** — git 은 파일 단위다. 장부는 행끼리 독립이라
 *   손실은 없지만(선례 8ecd37a) 조용히 하지 않는다: 몇 행이 동승했는지 세어 밝힌다.
 *   ⚠ 실패는 어느 층이든 조용히 물러난다 — 기록이 도구 사정으로 멈추면 안 된다(withLock 원칙).
 */
function 장부커밋(제목, 대상) {
  // 격리 장부(tmp)를 준 테스트는 저장소 밖을 가리킨다 — git 이 모르는 파일은 건드리지 않는다.
  const rel = path.relative(ROOT, 대상 || LEDGER);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const 경로 = rel.replace(/\\/g, '/');
  if (gitQuiet(['rev-parse', '--is-inside-work-tree']) === null) return null;
  // rebase·merge 중이면 그 상태를 만든 손이 끝낼 일이다 (F035·F038)
  for (const 상태 of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD']) {
    const p = gitQuiet(['rev-parse', '--git-path', 상태]);
    if (p && fs.existsSync(path.resolve(ROOT, p.trim()))) return { 건너뜀: '병합·리베이스 진행 중' };
  }
  return { 경로, 제목 };
}

/** 위 판정을 실제 커밋으로 옮긴다. 내몫 = 이번 편집이 낸 `[추가, 삭제]` 행 수. */
function 장부커밋실행(계획, 내몫) {
  if (!계획 || !계획.경로) return 계획;
  const { 경로, 제목 } = 계획;
  /* 갓 태어난 조각은 미추적이라 diff HEAD 에 안 보인다 — 경로를 못 박아 스테이지부터 한다.
   * (F025: 미추적은 이력·stash·reflog 어디에도 없는 유일한 무보호 상태 — 그 시간을 0으로 만든다.) */
  const 추적전 = gitQuiet(['status', '--porcelain', '--', 경로]);
  const 미추적이었나 = 추적전 !== null && /^\?\?/m.test(추적전);
  if (미추적이었나) gitQuiet(['add', '--', 경로]);
  /* 🔴 `add` 가 **안 먹은 것**과 「정말 바뀐 게 없다」가 아래 diff 에서 같은 모양이다(F493 실측:
   * 고아 잠금 아래 `add` 가 조용히 지고 → diff 빈손 → 「커밋할 변경이 없다(장부는 저장됐다)」).
   * 그 문장은 맞는 얼굴인데 값이 틀렸다 — 갓 태어난 조각이 **미추적**으로 남는다(F025 무보호).
   * 그래서 미추적이었던 경로는 add 뒤에 **실제로 스테이지됐는지**를 다시 본다. */
  if (미추적이었나) {
    const 추적후 = gitQuiet(['status', '--porcelain', '--', 경로]);
    if (추적후 === null || /^\?\?/m.test(추적후)) return { 실패: true, 동승: 0, 미추적: true };
  }
  const stat = gitQuiet(['diff', '--numstat', 'HEAD', '--', 경로]);
  if (stat === null || !stat.trim()) return { 건너뜀: '커밋할 변경이 없다' };
  const [추가, 삭제] = stat.trim().split('\n')[0].split('\t').map((n) => Number(n) || 0);
  const 동승 = Math.max(0, 추가 - 내몫[0]) + Math.max(0, 삭제 - 내몫[1]);

  /* 경로를 못 박아 커밋한다(CLAUDE.md: add/commit 을 나누면 그 틈에 남의 스테이징이 얹힌다).
   * 세션이 여럿 도는 저장소라 옆 세션의 훅과 index.lock 이 겹친다 — 짧게만 기다린다. */
  let 커밋됨 = false;
  for (let i = 0; i < 3 && !커밋됨; i++) {
    커밋됨 = gitQuiet(['commit', '-m', 제목, '--', 경로]) !== null;
    if (!커밋됨) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }

  /* 커밋했다고 믿지 말고 결과를 본다(F071). **실패했다고도 믿지 않는다** — 옆 세션이 같은 순간에
   * 같은 파일을 실으면 내 커밋은 「할 것 없음」으로 지는데, 그건 장부가 안 남은 게 아니라 **이미
   * 남은 것**이다. 거기서 「손으로 커밋하라」고 지시하면 거짓 경보고, 늘 틀리는 경보는 꺼진다.
   * 그래서 판정은 명령의 성패가 아니라 **지금 파일 상태 하나**로 한다(현재를 읽어 판정한다). */
  const 남은 = gitQuiet(['status', '--porcelain', '--', 경로]);
  if (남은 === null || 남은.trim()) return { 실패: true, 동승 };
  return { 해시: (gitQuiet(['rev-parse', '--short', 'HEAD']) || '').trim(), 동승, 남이실음: !커밋됨 };
}

/** 커밋 결과를 한 줄로 보고한다 — 동승·실패는 조용히 넘기지 않는다. */
function 커밋보고(r) {
  if (!r) return;
  if (r.건너뜀) { console.log(`  · 커밋 건너뜀 — ${r.건너뜀}(장부는 저장됐다)`); return; }
  if (r.실패) {
    console.log(r.미추적
      ? '  🔴 장부 조각이 **미추적**으로 남았다 — 손으로 `git add` 부터 한다(미추적은 이력 어디에도 없는 유일한 무보호 상태 · F025)'
      : '  ⚠ 장부가 미커밋으로 남았다 — 손으로 커밋한다(기록 자체는 안 잃었다)');
    /* 고아 잠금이면 그 처방(손 커밋)도 똑같이 막힌다 — 따를 수 없는 처방은 우회를 정상 통로로
     * 만든다(F103). 3회 재시도가 겨눈 것은 «경합»뿐이라, 고아는 여기서 이름을 대야 한다. */
    let 잠금 = '';
    try { 잠금 = require(path.join(__dirname, 'lib', 'git잠금.js')).고아잠금줄(ROOT); } catch (_) { /* 곁가지 */ }
    if (잠금) console.log(잠금);
    return;
  }
  if (r.남이실음) { console.log('  ✔ 장부는 이미 커밋돼 있다 — 옆 세션이 같은 순간에 실었다'); return; }
  console.log(`  ✔ 커밋 ${r.해시}${r.동승 ? ` (남의 행 ${r.동승}개 동승 — 장부는 공용이라 정상)` : ''}`);
}

/** 커밋 제목에 실을 요약 — 개행·과길이를 자른다(제목은 한 줄이어야 한다). */
function 제목요약(s, n = 54) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function add(kind, signal, date, 해소) {
  if (!KINDS.includes(kind)) {
    console.error(`[friction] 종류는 ${KINDS.join('·')} 중 하나여야 한다 (받은 값: ${kind})`);
    process.exit(1);
  }
  if (!signal || !signal.trim()) {
    console.error('[friction] 신호 설명이 비었다. 무엇이 마찰이었는지 한 문장으로 적는다.');
    process.exit(1);
  }
  // '|'는 표를 깨뜨린다 — 삼키지 말고 치환해서 장부가 파싱 불가가 되는 것을 막는다
  const safe = 칸안전(signal);
  const 해소safe = 칸안전(해소 || '');

  /* 「고치고 → 신고」인데 해소 칸을 비우는 조합을 여기서 막는다 — 그게 F107 이 샌 자리다. */
  const 주장 = 해소주장(safe);
  if (주장 && !해소safe) {
    console.error(
      `[friction] 이 신고문은 이미 착지한 해소를 스스로 지목한다("${주장}") — 그런데 해소 칸은 빈 채 행이 태어난다.\n`
      + '  그 조합이 F107 이 새어 나간 자리다: 번호를 다는 커밋이 신고 커밋 하나뿐이라\n'
      + '  friction-close-guard 는 그 커밋을 면제하고, 열린 행은 아무도 못 본 채 남는다.\n'
      + '\n'
      + '  → 이미 고쳤으면 한 번에 적는다(행이 해소된 채로 태어난다):\n'
      + `     node tools/friction.js add ${kind} "신고문" --해소 "무엇이 실제로 막았나"\n`
      + '  → 아직 안 고쳤으면 신고문에서 해소 얘기를 빼고, 고친 뒤에 닫는다:\n'
      + `     node tools/friction.js add ${kind} "신고문(해소 언급 없이)"\n`
      + '     node tools/friction.js resolve F0NN "무엇이 막았나"',
    );
    process.exit(1);
  }

  /* 채번은 락 **밖**에서 한다 — git fetch·tag push 로 네트워크를 다녀오는데,
   * 그걸 락 안에 두면 보유 시간이 초 단위가 되고 그때 LOCK_STALE_MS 가 산 락을 회수해 버린다.
   * 번호는 이미 태그 락이 원자적으로 지킨다(F148 때 번호는 안 겹쳤다) — 안 지켜지던 건 파일이다. */
  const id = allocateId(read().rows);
  /* 빈 해소 칸은 예전 그대로 `| |` 한 칸으로 둔다 — 템플릿에 빈 문자열을 끼우면 `|  |` 가 되고,
   * 장부 형식을 그대로 읽는 검사·도구가 조용히 갈라진다(회귀가 실제로 잡았다). */
  const 행문 = (rid) => 해소safe
    ? `| ${rid} | ${date || today()} | ${kind} | ${safe} | ${해소safe} |`
    : `| ${rid} | ${date || today()} | ${kind} | ${safe} | |`;
  /* 행은 조각 파일 하나로 태어난다 — 한 파일에 줄을 끼우던 시절의 「낡은 버퍼가 남의 행을 덮는」
   * 자리(F148)가 통째로 없다. `wx` 는 「없을 때만 만든다」를 커널이 원자적으로 판정하므로,
   * 태그 예약이 못 덮는 마지막 창(오프라인 폴백 둘이 같은 번호를 고른 경우)도 여기서 다음 번호로
   * 비킨다 — 신고문을 버리는 갈래는 없다(기록이 도구 사정으로 멈추면 안 된다).
   * 채번이 전역 최대+1 에서 시작하므로 비켜간 번호가 아카이브의 번호와 겹칠 일도 없다. */
  const 실은id = withLock(() => {
    fs.mkdirSync(FOLDER, { recursive: true });
    for (let n = parseInt(id.slice(1), 10); ; n++) {
      const rid = 'F' + String(n).padStart(3, '0');
      try {
        fs.writeFileSync(path.join(FOLDER, rid + '.md'), 행문(rid) + '\n', { flag: 'wx' });
        return rid;
      } catch (e) { if (e.code !== 'EEXIST') throw e; }
    }
  });
  if (실은id !== id) console.error(`  ⚠ ${id} 는 그 사이 딴 세션이 가져갔다 — ${실은id} 로 실었다.`);
  console.log(`  + ${실은id}  ${kind}  ${safe}`);
  if (해소safe) console.log(`  ✔ ${실은id} 해소 → ${해소safe}   (신고와 동시에 닫았다 — 열린 채 남지 않는다)`);
  /* 신고 커밋은 close-guard 가 면제한다(그 행을 만든 커밋) — 번호를 박아 두면 그 판정이 그대로 산다. */
  커밋보고(장부커밋실행(장부커밋(`docs: 마찰 ${실은id} ${해소safe ? '신고·해소' : '신고'} — ${제목요약(safe)}`, path.join(FOLDER, 실은id + '.md')), [1, 0]));
}

function resolve(id, by) {
  const safe = 칸안전(by || '');
  if (!safe) {
    console.error('[friction] 무엇이 이 신호를 막았는지 적는다(조항·훅·커밋). 빈 해소는 기록하지 않는다.');
    process.exit(1);
  }
  /* 찾기·검사·쓰기를 **한 락 안에서** 한다(F148) — 같은 조각을 두 세션이 같은 순간에 닫는
   * 창을 직렬화한다(「이미 해소」 검사가 그 창 안에서 유효해야 한다).
   * ⚠ 락 안에서는 process.exit 를 부르지 않는다 — finally 가 안 돌아 락 파일이 남는다. */
  const 결과 = withLock(() => {
    const { rows } = read();
    const r = rows.find((x) => x.id.toUpperCase() === String(id).toUpperCase());
    if (!r) return `[friction] ${id} 를 못 찾았다.`;
    /* 보류 → 해소는 **정상 전이**다(판정해서 열어뒀던 것을 실제로 고쳤다). 여기서 `r.resolved`
     * 진리값으로 막으면 보류가 영구 봉인이 되어, 고친 세션이 닫을 통로를 잃는다. */
    if (해소됐나(r)) return `[friction] ${r.id} 는 이미 해소로 기록돼 있다: ${r.resolved}`;
    if (보류인가(r)) console.log(`  ⏸→✔ ${r.id} 는 보류였다 — 그 판정을 해소로 올린다 (이전: ${r.resolved})`);
    /* 조각이면 그 파일을 다시 쓰고, 동결 아카이브의 열린 행이면 **아카이브를 고치지 않는다** —
     * 같은 번호의 조각을 새로 써서 읽기 조립이 그쪽을 이기게 한다(그림자). 여기가 한 줄이라도
     * 아카이브를 고치면 「모든 세션이 한 파일을 고친다」로 되돌아간다 — 이 설계의 급소다. */
    const 경로 = r.파일 || path.join(FOLDER, r.id + '.md');
    fs.mkdirSync(FOLDER, { recursive: true });
    fs.writeFileSync(경로, `| ${r.id} | ${r.date} | ${r.kind} | ${r.signal} | ${safe} |\n`, 'utf8');
    console.log(`  ✔ ${r.id} 해소 → ${safe}`);
    return { 경로 };
  });
  if (typeof 결과 === 'string') {
    console.error(결과);
    process.exit(1);
  }
  // 해소 칸을 채운 커밋이라 close-guard 가 고를 「열린 행」이 아니다 — 번호는 그대로 박는다.
  커밋보고(장부커밋실행(장부커밋(`docs: 마찰 ${String(id).toUpperCase()} 해소 — ${제목요약(safe)}`, 결과.경로), [1, 1]));
}

/** 「지금은 안 닫는다」를 장부에 적는다 — 고친 것이 아니라 **판정한 것**을 기록하는 통로.
 *  사유엔 «어디서 판정했나»(개정 판·보드 줄·커밋)를 함께 적는다. 그게 없으면 다음 세션이
 *  판정의 출처를 못 찾아 결국 다시 재게 되고, 그러면 이 상태를 만든 이유가 사라진다. */
function defer(id, why) {
  const safe = 칸안전(why || '');
  if (!safe) {
    console.error('[friction] 왜 지금 안 닫는지와 **어디서 판정했는지**를 적는다(개정 판·보드 줄·커밋). 빈 보류는 기록하지 않는다.');
    process.exit(1);
  }
  const 결과 = withLock(() => {
    const { rows } = read();
    const r = rows.find((x) => x.id.toUpperCase() === String(id).toUpperCase());
    if (!r) return `[friction] ${id} 를 못 찾았다.`;
    if (해소됐나(r)) return `[friction] ${r.id} 는 이미 해소다 — 보류로 되돌리지 않는다: ${r.resolved}`;
    if (보류인가(r)) return `[friction] ${r.id} 는 이미 보류다: ${r.resolved}\n   바꾸려면 그 판정을 뒤집는 근거부터 적는다(resolve 로 닫거나, 조각 파일을 직접 고친다).`;
    /* 아카이브(동결)의 열린 행이면 조각을 새로 써서 그림자로 덮는다 — resolve 와 같은 통로다.
     * 여기서 아카이브를 한 줄이라도 고치면 「모든 세션이 한 파일을 고친다」로 되돌아간다. */
    const 경로 = r.파일 || path.join(FOLDER, r.id + '.md');
    fs.mkdirSync(FOLDER, { recursive: true });
    fs.writeFileSync(경로, `| ${r.id} | ${r.date} | ${r.kind} | ${r.signal} | ${DEFER} ${safe} |\n`, 'utf8');
    console.log(`  ⏸ ${r.id} 보류 → ${safe}`);
    return { 경로 };
  });
  if (typeof 결과 === 'string') {
    console.error(결과);
    process.exit(1);
  }
  커밋보고(장부커밋실행(장부커밋(`docs: 마찰 ${String(id).toUpperCase()} 보류 — ${제목요약(safe)}`, 결과.경로), [1, 1]));
}

function report(mode) {
  const { rows } = read();
  const open = rows.filter(열렸나);
  const 보류 = rows.filter(보류인가);
  const closed = rows.filter(해소됐나);
  const 살아있음 = open.length + 보류.length;

  if (mode === 'open' || mode === '보류') {
    const 낼것 = mode === 'open' ? open : 보류;
    console.log(`\n[마찰 신호] ${mode === 'open' ? '열림(아직 아무도 판정 안 함)' : '보류(판정하고 열어둔 것)'} ${낼것.length}건\n`);
    for (const r of 낼것) console.log(`  ${r.id}  ${r.date}  [${r.kind}]  ${mode === 'open' ? r.signal : r.resolved}`);
    console.log('');
    return;
  }

  console.log(`\n[마찰 신호] 전체 ${rows.length}건 · 해소 ${closed.length} · 살아있음 ${살아있음} (열림 ${open.length} · 보류 ${보류.length})\n`);

  console.log('  종류별 (살아있음/전체):');
  for (const k of KINDS) {
    const all = rows.filter((r) => r.kind === k);
    if (!all.length) continue;
    const o = all.filter(살아있나).length;
    const bar = '█'.repeat(all.length);
    console.log(`    ${k}  ${String(o).padStart(2)}/${String(all.length).padStart(2)}  ${bar}`);
  }

  // 어느 장치가 실제로 신호를 막았나 — 이게 "지침이 작동했는가"의 유일한 실측치
  console.log('\n  해소 수단별 (무엇이 실제로 막았나):');
  const byMeans = new Map();
  for (const r of closed) {
    const key = r.resolved.replace(/^\d{4}-\d{2}-\d{2}\s*/, '');
    byMeans.set(key, (byMeans.get(key) || 0) + 1);
  }
  for (const [k, v] of [...byMeans].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(2)}건  ${k}`);
  }

  if (open.length) {
    console.log('\n  ⚠ 열림 — 아직 아무도 판정하지 않았다 (/evolve 의 개정 재료):');
    for (const r of open) console.log(`    ${r.id}  ${r.date}  [${r.kind}]  ${r.signal}`);
  }

  /* 보류를 열림과 **갈라서** 낸다. 붙여 놓으면 「2건 더 났다」와 「12건이 안 닫혔다」가
   * 한 문장에서 같은 모양이 되고, 그게 정확히 F386 이 신고한 포화다. */
  if (보류.length) {
    console.log('\n  ⏸ 보류 — 판정하고 열어둔 것 (결함은 서 있다 · 다시 재지 않는다):');
    for (const r of 보류) console.log(`    ${r.id}  ${r.date}  [${r.kind}]  ${r.resolved.replace(DEFER, '').trim()}`);
  }

  // 월별 추이 — 신호가 줄고 있는지가 하네스가 나아지는지의 신호
  const byMonth = new Map();
  for (const r of rows) {
    const m = (r.date || '').slice(0, 7);
    if (!m) continue;
    byMonth.set(m, (byMonth.get(m) || 0) + 1);
  }
  console.log('\n  월별 발생:');
  for (const [m, v] of [...byMonth].sort()) console.log(`    ${m}  ${'▇'.repeat(v)} ${v}`);
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  if (!fs.existsSync(LEDGER)) {
    console.error(`[friction] 장부가 없다: ${LEDGER}`);
    process.exit(1);
  }
  const cmd = args[0];
  /* ── 텍스트 인자 통로 — add·resolve 가 **같은 함수**를 쓴다 (마찰 F301) ────────────
   * F297 이 `add` 에만 `--파일` 과 「모르는 플래그 거절」을 넣었고 `resolve` 는 그대로 뒀다.
   * 그래서 **바로 옆자리에서 같은 사고가 재발했다**: `resolve F300 --파일 <경로>` 가
   * `args.slice(2).join(' ')` 에 걸려 그 토큰과 절대경로가 통째로 해소문이 됐다(커밋 5fd6800a).
   * 같은 판정을 두 곳에 적으면 갈라진다 — 세 번째를 막으려면 **한 곳에서 파생시킨다.** */
  const 모르는플래그 = (토큰, 허용) => {
    console.error(`[friction] 모르는 옵션이다: ${토큰}\n`
      + `  쓸 수 있는 것: ${허용.join(' · ')}\n`
      + '  (막지 않으면 이 토큰이 본문으로 접혀 장부에 그대로 실린다 — 그게 F297·F301 이다)');
    process.exit(1);
  };
  /** 인자 본문과 `--파일` 중 **하나만** 받아 텍스트 한 덩이를 낸다.
   *  🔑 긴 글은 파일로 준다 — 백틱은 POSIX 셸에서 명령 치환으로 실행되고 따옴표는 말을 자른다.
   *  따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). 줄바꿈·`|` 는 `칸안전` 이 받는다. */
  const 본문또는파일 = (조각들, 파일, 무엇) => {
    const 글 = 조각들.join(' ');
    if (!파일) return 글;
    if (글.trim()) {
      console.error(`[friction] ${무엇}을 인자와 --파일 둘 다로 줬다 — 어느 쪽이 정본인지 갈린다. 하나만 준다.`);
      process.exit(1);
    }
    try { return fs.readFileSync(파일, 'utf8'); } catch (e) {
      console.error(`[friction] --파일 을 못 읽었다: ${파일}\n  ${String(e && e.message)}`);
      process.exit(1);
    }
    return '';
  };

  /** 🔴 셸이 **말을 바꿔치기한** 흔적을 잡는다 (F297·F301 과 같은 계열의 세 번째 · 2026-08-12 실측).
   *
   *  Git Bash(MSYS)는 `/close` 처럼 슬래시로 시작하는 토큰을 **경로로 보고 자동 변환**한다 —
   *  `--해소 "/close 3-b 신설"` 이 장부에 `C:/Program Files/Git/close 3-b 신설` 로 앉았다.
   *  따옴표로 감싸도 안 막힌다(변환은 따옴표보다 뒤에 일어난다). 그리고 **증상이 없다**:
   *  도구는 성공을 찍고 행은 태어나며, 스킬 이름이 경로로 바뀐 줄은 사람만 안다.
   *  앞의 둘과 새는 방향이 같다 — 「통과」다.
   *
   *  ⚠ 막기만 하면 해소문에 `/close`·`/deploy` 를 영영 못 쓴다. 그래서 **처방을 같이 준다**
   *  (따를 수 없는 처방은 우회를 정상 통로로 만든다 · F103). */
  const 셸이바꾼말 = (글, 무엇) => {
    const m = String(글 || '').match(/[A-Za-z]:[\\/]Program Files[\\/]Git[\\/](\S*)/);
    if (!m) return 글;
    console.error(`[friction] ${무엇}에 **셸이 바꿔치기한 경로**가 있다: ${m[0]}\n`
      + `  Git Bash 가 \`/${m[1].split(/[\\/]/).pop()}\` 같은 토큰을 경로로 바꾼 것이다(따옴표로도 안 막힌다).\n`
      + '  이대로 실으면 스킬 이름이 경로로 앉고 **증상이 없다** — 그게 F297·F301 과 같은 새는 방향이다.\n'
      + `  처방 ① 파일로 준다:  node tools/friction.js ${cmd} … --${무엇 === '해소문' ? '해소파일' : '파일'} <경로>\n`
      + '  처방 ② PowerShell 로 같은 명령을 돌린다(거기선 변환이 없다).');
    process.exit(1);
  };

  if (cmd === 'add') {
    /* `--date` 는 토큰 1개, `--해소` 는 다음 플래그 전까지 전부 — 신고문과 같은 규칙이라
     * 따옴표를 빠뜨려도 말이 잘리지 않는다(셸이 둘인 저장소다 · CLAUDE.md 실행). */
    const 남은 = args.slice(1);
    let date = null; let 해소 = null; let 파일 = null; let 해소파일 = null; const 본문 = [];
    for (let i = 0; i < 남은.length; i++) {
      if (남은[i] === '--date') { date = 남은[++i] || null; continue; }
      if (남은[i] === '--파일') { 파일 = 남은[++i] || null; continue; }
      if (남은[i] === '--해소파일') { 해소파일 = 남은[++i] || null; continue; }
      if (남은[i] === '--해소') {
        const 조각 = [];
        while (i + 1 < 남은.length && !/^--/.test(남은[i + 1])) 조각.push(남은[++i]);
        해소 = 조각.join(' ');
        continue;
      }
      /* 🔴 모르는 플래그를 **신고문으로 접지 않는다** (F297 · 2026-08-09 실측).
       *   여기 없던 `--파일` 을 줬더니 그 토큰과 경로가 **그대로 장부 본문**이 되어 커밋까지 갔다.
       *   증상이 없다 — 도구는 성공을 찍고 행은 태어나며, 쓰레기가 들어간 줄은 사람만 안다.
       *   새는 방향은 언제나 「통과」다. 모르면 막는다. */
      if (/^--/.test(남은[i])) 모르는플래그(남은[i], ['--date', '--해소', '--해소파일', '--파일']);
      본문.push(남은[i]);
    }
    /* 🔑 해소문도 신고문과 **같은 두 관문**을 지난다 — 파일 통로 + 셸 변환 탐지.
     *   한쪽만 지나게 두는 것이 정확히 F301 이었다(옆자리를 안 고쳤다). */
    const 해소본문 = 해소파일 ? 본문또는파일([해소 || ''], 해소파일, '해소문') : 해소;
    add(본문[0], 셸이바꾼말(본문또는파일(본문.slice(1), 파일, '신고문'), '신고문'),
      date, 해소본문 == null ? null : 셸이바꾼말(해소본문, '해소문'));
  } else if (cmd === 'resolve') {
    /* add 와 **같은 두 함수**를 쓴다 — 옆자리만 안 고쳐서 F301 이 났다. */
    const 남은 = args.slice(2);
    let 파일 = null; const 조각 = [];
    for (let i = 0; i < 남은.length; i++) {
      if (남은[i] === '--파일') { 파일 = 남은[++i] || null; continue; }
      if (/^--/.test(남은[i])) 모르는플래그(남은[i], ['--파일']);
      조각.push(남은[i]);
    }
    resolve(args[1], 셸이바꾼말(본문또는파일(조각, 파일, '해소문'), '해소문'));
  } else if (cmd === 'defer' || cmd === '보류') {
    /* resolve 와 **같은 두 함수**를 쓴다 — 새 통로를 옆에 내면서 관문을 안 태우는 것이
     * F297→F301 의 형태다(같은 사고가 바로 옆자리에서 재발했다). 세 번째 통로부터 지킨다. */
    const 남은 = args.slice(2);
    let 파일 = null; const 조각 = [];
    for (let i = 0; i < 남은.length; i++) {
      if (남은[i] === '--파일') { 파일 = 남은[++i] || null; continue; }
      if (/^--/.test(남은[i])) 모르는플래그(남은[i], ['--파일']);
      조각.push(남은[i]);
    }
    defer(args[1], 셸이바꾼말(본문또는파일(조각, 파일, '보류 사유'), '보류 사유'));
  } else {
    report(args.includes('--open') ? 'open' : (args.includes('--보류') ? '보류' : null));
  }
}

if (require.main === module) main();
module.exports = {
  read, splitCells, nextId, allocateId, seenElsewhere, 해소주장, withLock, 예약자,
  LEDGER, FOLDER, KINDS, TAG_PREFIX, LOCK, LOCK_STALE_MS,
  // 상태 판정 — 소비자(rot-check · friction-close-guard)는 자기 정규식을 쓰지 않고 이것을 쓴다.
  DEFER, 상태, 열렸나, 보류인가, 해소됐나, 살아있나,
};
