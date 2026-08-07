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
//   node tools/friction.js resolve F006 "무엇이 막았나"
//   node tools/friction.js --open                   살아있는 신호만
'use strict';
const fs = require('fs');
const path = require('path');

// 테스트는 실제 장부를 건드리면 안 된다 — 회귀 테스트가 기록을 오염시키면 그 기록은 증거가 못 된다
const LEDGER = process.env.SYNK_FRICTION_LEDGER || path.resolve(__dirname, '..', 'docs', '_ops', '마찰신호.md');
/* 채번 락 회귀는 **진짜 저장소 위에서** 돌려야 탐지력이 있다(태그 push가 실제로 거절되는지를 본다).
 * 그래서 장부와 별도로 저장소 루트도 갈아끼울 수 있게 둔다 — 격리 저장소를 준 테스트만 git을 만진다. */
const ROOT = process.env.SYNK_FRICTION_ROOT || path.resolve(__dirname, '..');
const KINDS = ['교정', '거절', '실수', '마찰'];
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

/* 코드 범위(백틱)를 **길이를 보존한 채** 공백으로 덮는다 — 덮은 판의 자리 번호로 원문을 자른다.
 * 자를 때 UTF-16 자리로만 세는 이유: 장부엔 이모지가 흔한데 코드포인트로 세면 자리가 어긋난다. */
const maskCode = (t) => String(t).replace(/```[\s\S]*?```|`[^`\n]*`/g, (m) => ' '.repeat(m.length));

/* 표 한 줄을 칸으로 나눈다. **백틱 안의 파이프는 칸막이가 아니다.**
 * 장부는 add() 만 쓰는 통로가 아니다 — 손편집·폰작업반입 병합으로도 행이 늘어나므로
 * 쓰는 쪽의 소독에 기대면 안 되고 읽는 쪽이 버텨야 한다.
 * 실측 08-07: 손편집으로 들어온 F193 행(`4e647ad`)의 `2>&1|docs/세션보드.md` 가 칸을 하나 밀어
 * **살아있는 신호가 「해소됨」으로 읽혔다** — --open 목록에서 통째로 사라지고, 집계의 해소 수단에는
 * 경로 조각이 올라간다. 더 나쁜 건 resolve: 잘린 signal 을 그대로 되써서 신고문 뒷부분이 조용히 사라진다. */
function splitCells(raw) {
  const masked = maskCode(raw);
  const out = [];
  let cur = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '|') continue;
    out.push(raw.slice(cur, i));
    cur = i + 1;
  }
  out.push(raw.slice(cur));
  return out.map((c) => c.trim());
}

/* 칸에 넣기 전 소독. 깨뜨리는 것은 **날 파이프뿐**이라 백틱 안은 그대로 둔다
 * (전에는 전부 삼켜서, 파이프를 설명하는 해소문이 `/` 로 바뀐 채 장부에 남았다). */
function 칸안전(s) {
  const t = String(s).replace(/\n/g, ' ');
  const masked = maskCode(t);
  let out = '';
  for (let i = 0; i < t.length; i++) out += masked[i] === '|' ? '/' : t[i];
  return out.trim();
}

function read() {
  const text = fs.readFileSync(LEDGER, 'utf8');
  const lines = text.split('\n');
  const rows = [];
  lines.forEach((line, i) => {
    const m = /^\|\s*(F\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (!m) return;
    const cells = splitCells(m[2]);
    rows.push({ id: m[1], date: cells[0], kind: cells[1], signal: cells[2], resolved: cells[3] || '', line: i });
  });
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
  refs.forEach((ref) => {
    const text = gitQuiet(['show', ref + ':' + rel]);
    if (text !== null) max = Math.max(max, maxIn(text));   // null = 그 ref에 장부가 없다
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
  const row = 해소safe
    ? `| ${id} | ${date || today()} | ${kind} | ${safe} | ${해소safe} |`
    : `| ${id} | ${date || today()} | ${kind} | ${safe} | |`;
  /* 🔴 낡은 버퍼가 아니라 **락 안에서 다시 읽은** 내용에 끼운다 — 이 재읽기가 F148 의 수리다.
   * 위에서 read() 한 lines 를 재사용하면 채번이 네트워크를 다녀온 사이의 남의 행이 사라진다. */
  withLock(() => {
    const { lines } = read();
    // 표의 마지막 행 뒤에 넣는다(파일 끝이 아니라) — 아래에 다른 서술이 붙어도 안전하게
    let at = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\|\s*F\d+\s*\|/.test(lines[i].trim())) { at = i + 1; break; }
    }
    lines.splice(at, 0, row);
    fs.writeFileSync(LEDGER, lines.join('\n'), 'utf8');
  });
  console.log(`  + ${id}  ${kind}  ${safe}`);
  if (해소safe) console.log(`  ✔ ${id} 해소 → ${해소safe}   (신고와 동시에 닫았다 — 열린 채 남지 않는다)`);
}

function resolve(id, by) {
  const safe = 칸안전(by || '');
  if (!safe) {
    console.error('[friction] 무엇이 이 신호를 막았는지 적는다(조항·훅·커밋). 빈 해소는 기록하지 않는다.');
    process.exit(1);
  }
  /* 찾기·검사·쓰기를 **한 락 안에서** 한다(F148) — 밖에서 읽고 안에서 쓰면 그 사이 남의 행이 덮인다.
   * resolve 는 행 번호(r.line)로 쓰기 때문에 add 보다 더 위험하다: 그 사이 누가 행을 끼우면
   * 낡은 번호가 **엉뚱한 행**을 가리켜 남의 신호를 내 해소문으로 덮어쓴다.
   * ⚠ 락 안에서는 process.exit 를 부르지 않는다 — finally 가 안 돌아 락 파일이 남는다. */
  const 실패 = withLock(() => {
    const { lines, rows } = read();
    const r = rows.find((x) => x.id.toUpperCase() === String(id).toUpperCase());
    if (!r) return `[friction] ${id} 를 못 찾았다.`;
    if (r.resolved) return `[friction] ${r.id} 는 이미 해소로 기록돼 있다: ${r.resolved}`;
    lines[r.line] = `| ${r.id} | ${r.date} | ${r.kind} | ${r.signal} | ${safe} |`;
    fs.writeFileSync(LEDGER, lines.join('\n'), 'utf8');
    console.log(`  ✔ ${r.id} 해소 → ${safe}`);
    return null;
  });
  if (실패) {
    console.error(실패);
    process.exit(1);
  }
}

function report(openOnly) {
  const { rows } = read();
  const open = rows.filter((r) => !r.resolved);
  const closed = rows.filter((r) => r.resolved);

  if (openOnly) {
    console.log(`\n[마찰 신호] 살아있는 신호 ${open.length}건\n`);
    for (const r of open) console.log(`  ${r.id}  ${r.date}  [${r.kind}]  ${r.signal}`);
    console.log('');
    return;
  }

  console.log(`\n[마찰 신호] 전체 ${rows.length}건 · 해소 ${closed.length} · 살아있음 ${open.length}\n`);

  console.log('  종류별 (살아있음/전체):');
  for (const k of KINDS) {
    const all = rows.filter((r) => r.kind === k);
    if (!all.length) continue;
    const o = all.filter((r) => !r.resolved).length;
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
    console.log('\n  ⚠ 살아있는 신호 — /evolve 의 개정 재료:');
    for (const r of open) console.log(`    ${r.id}  ${r.date}  [${r.kind}]  ${r.signal}`);
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
  if (cmd === 'add') {
    /* `--date` 는 토큰 1개, `--해소` 는 다음 플래그 전까지 전부 — 신고문과 같은 규칙이라
     * 따옴표를 빠뜨려도 말이 잘리지 않는다(셸이 둘인 저장소다 · CLAUDE.md 실행). */
    const 남은 = args.slice(1);
    let date = null; let 해소 = null; const 본문 = [];
    for (let i = 0; i < 남은.length; i++) {
      if (남은[i] === '--date') { date = 남은[++i] || null; continue; }
      if (남은[i] === '--해소') {
        const 조각 = [];
        while (i + 1 < 남은.length && !/^--/.test(남은[i + 1])) 조각.push(남은[++i]);
        해소 = 조각.join(' ');
        continue;
      }
      본문.push(남은[i]);
    }
    add(본문[0], 본문.slice(1).join(' '), date, 해소);
  } else if (cmd === 'resolve') {
    resolve(args[1], args.slice(2).join(' '));
  } else {
    report(args.includes('--open'));
  }
}

if (require.main === module) main();
module.exports = {
  read, splitCells, nextId, allocateId, seenElsewhere, 해소주장, withLock, 예약자,
  LEDGER, KINDS, TAG_PREFIX, LOCK, LOCK_STALE_MS,
};
