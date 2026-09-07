#!/usr/bin/env node
/**
 * 밤 일감 — 낮에 쌓고, 밤에 한 번에 돈다 (유호 확정 2026-09-07).
 *
 * ■ 유호님이 정하신 방식
 *   「앞으로 밤굽기 일정이 밤에 내가 무작위로 일감 쌓아놓은거 한번에 하는거로 변경하자.
 *    앞으로 자기전에 밤 일감 자율주행해줘. 이렇게 세션에 칠테니 그때 모아둔거 계속 이어서 진행」
 *   ⇒ 낮에는 세션들이 일감만 «쌓는다». 밤에 유호님이 한 마디 하시면 그때 모인 것을 한 번에 돈다.
 *
 * ■ 왜 새로 짓나 — 매번 새 스크립트를 짓고 있었다
 *   `밤샘_0831·0901·0902·0907·0907_릴전량` 다섯 벌이 도장·로그·떼어 띄우기를 **각자 베껴** 들고 있다.
 *   베낄 때마다 「성패를 무엇으로 재나」가 조금씩 갈렸고, 일감을 쌓아 둘 자리가 없어서
 *   다음 밤에 할 일이 주석과 트랙 줄에 흩어졌다(0902 주석이 부르는 「트랙 §2-밤일감」은 이미 죽은 절이다).
 *   ⇒ **통은 하나, 도는 자도 하나.** 새 밤 스크립트를 더 짓지 않는다.
 *
 * ■ 원장 = docs/_ops/밤일감.jsonl (append-only · 한 줄이 한 사건)
 *   쌓기 = {일감:…} · 처분 = {처분:<id>, 결과:…}. 손으로 고치지 않는다 —
 *   낮에 여러 세션이 동시에 쌓으므로, 줄을 고치는 순간 서로를 덮는다(자율기록.js 와 같은 규율).
 *
 * ■ 성패의 자는 종료코드«만»이 아니다
 *   일감이 `샌곳`(폴더)과 `샐꼴`(정규식)을 주면 시작 시각 뒤에 «새로 난 파일 수»를 센다.
 *   굽기 도구가 0 을 내고도 옛 파일을 두는 길이 있어서, 종료코드만 보면 거짓 초록이 난다(밤샘_0907 규약).
 *
 * 쓰기
 *   node tools/밤일감.js                       — 쌓인 것 보기
 *   node tools/밤일감.js --쌓기 --파일 x.json   — 일감 넣기(한 건 또는 배열)
 *   node tools/밤일감.js --빼기 <id> --사유 "…" — 안 하기로 한 일감 내리기
 *   node tools/밤일감.js --띄우기               — 떼어 띄운다(유호님 「자기전에 자율주행해줘」에 이것)
 *   node tools/밤일감.js --돌기                 — 지금 이 자리에서 돈다(띄우기가 안에서 부른다)
 *
 * 일감 한 건의 꼴 (필수 = 제목·명령)
 *   { "제목": "릴 92편 다시 굽기",
 *     "명령": [["node","영상/굽기.js","--전량"], ["node","영상/굽기.js","--전량","--가이드","까몽"]],
 *     "상한분": 300,
 *     "샌곳": "영상/out", "샐꼴": "\\.mp4$", "샐것": 92,
 *     "확인": "아침에 무엇을 봐야 하나 — 사람이 읽는 글" }
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 원장길 = path.join(루트, 'docs', '_ops', '밤일감.jsonl');
const 도장길 = path.join(루트, 'docs', '_ops', '밤굽기도장.json');
const 필수 = ['제목', '명령'];

const 시각 = () => new Date().toLocaleTimeString('ko-KR');

function 원장읽기() {
  if (!fs.existsSync(원장길)) return [];
  return fs.readFileSync(원장길, 'utf8').split('\n')
    .filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter(Boolean);
}

/** 남은 일감 = 쌓였고 아직 처분(완주·실패·뺌)되지 않은 것. */
function 남은것() {
  const 줄들 = 원장읽기();
  const 처분된 = new Set(줄들.filter((r) => r.처분).map((r) => r.처분));
  return 줄들.filter((r) => r.일감 && !처분된.has(r.id)).map((r) => ({ ...r.일감, id: r.id, 때: r.때, 쌓은이: r.쌓은이 }));
}

function 덧쓰기(벌) {
  fs.mkdirSync(path.dirname(원장길), { recursive: true });
  fs.appendFileSync(원장길, `${JSON.stringify(벌)}\n`, 'utf8');
}

function 새id() {
  return `일_${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── 쌓기 ─────────────────────────────────────────────────────────────── */
function 쌓기(파일) {
  const 것들 = [].concat(JSON.parse(fs.readFileSync(파일, 'utf8')));
  for (const 하나 of 것들) {
    const 빠진 = 필수.filter((k) => !하나[k]);
    if (빠진.length) {
      console.error(`🔴 «${하나.제목 || '(제목 없음)'}» 에 ${빠진.join('·')} 이 없다 — 안 쌓았다.`);
      process.exitCode = 1;
      continue;
    }
    const id = 새id();
    덧쓰기({ id, 때: new Date().toISOString(), 쌓은이: process.env.SYNK_세션 || '세션', 일감: 하나 });
    console.log(`✅ 쌓았다 ${id} — ${하나.제목}`);
  }
}

/* ── 보기 ─────────────────────────────────────────────────────────────── */
function 보기() {
  const ls = 남은것();
  if (!ls.length) { console.log('■ 밤 일감 — 쌓인 것 0건'); return; }
  console.log(`■ 밤 일감 — 쌓인 것 ${ls.length}건 (유호님이 「자기전에 밤 일감 자율주행해줘」 하시면 돈다)`);
  for (const [i, o] of ls.entries()) {
    console.log(`   ${i + 1}. [${o.id}] ${o.제목}`);
    console.log(`      명령 ${o.명령.length}개 · 상한 ${o.상한분 || 300}분${o.샐것 ? ` · 셀 것 ${o.샐것}개` : ''}`);
    if (o.확인) console.log(`      아침에: ${o.확인}`);
  }
}

/* ── 돌기 ─────────────────────────────────────────────────────────────── */
function 새로난수(샌곳, 샐꼴, since) {
  try {
    const 방 = path.join(루트, 샌곳);
    const re = new RegExp(샐꼴);
    return fs.readdirSync(방)
      .filter((f) => re.test(f) && fs.statSync(path.join(방, f)).mtimeMs >= since).length;
  } catch (_) { return 0; }
}

function 도장(상태, 사유, 기록) {
  try {
    const 임시 = `${도장길}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(도장길), { recursive: true });
    fs.writeFileSync(임시, `${JSON.stringify({
      시각: new Date().toISOString(), 무엇: '밤일감.js', 상태, 완주: 상태 === '완주',
      사유, pid: process.pid, 단계: 기록,
    }, null, 2)}\n`, 'utf8');
    fs.renameSync(임시, 도장길);
  } catch (_) { /* 도장이 일감을 막지 않는다 */ }
}

function 돌기(로그fd) {
  const 말 = (s) => { try { fs.writeSync(로그fd, `${s}\n`); } catch (_) { /* 로그가 일감을 막지 않는다 */ } };
  const ls = 남은것();
  말(`\n══ 밤 일감 ${ls.length}건 · 시작 ${new Date().toLocaleString('ko-KR')} · pid ${process.pid} ══`);
  if (!ls.length) { 도장('완주', '쌓인 것 0건', []); return 0; }

  /* 콘센트 — 배터리로 두면 잠들어 몇 시간에 한 장이 된다(memory night-bake-needs-wall-power).
     못 재면 «모름»이지 «꽂힘»이 아니다. 그래서 2 가 아니면 서고, 그 사실을 도장에 남긴다. */
  const 전원 = String(spawnSync('powershell',
    ['-NoProfile', '-Command', '(Get-CimInstance Win32_Battery).BatteryStatus'],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 }).stdout || '').trim();
  if (전원 !== '2') {
    말(`🔴 콘센트가 안 꽂혔다(BatteryStatus=${전원 || '?'}) — 밤일감을 돌리지 않는다.`);
    도장('죽음', `콘센트 안 꽂힘(${전원 || '?'})`, []);
    return 1;
  }
  말('   ✅ 콘센트 꽂힘');

  const 기록 = [];
  for (const [i, 일] of ls.entries()) {
    const t0 = Date.now();
    말(`\n■ ${시각()} [${i + 1}/${ls.length}] ${일.제목}`);
    let 종료 = 0;
    for (const 명 of 일.명령) {
      말(`   ▶ ${명.join(' ')}`);
      const r = spawnSync(명[0], 명.slice(1), {
        cwd: 루트, stdio: ['ignore', 로그fd, 로그fd], windowsHide: true,
        timeout: (일.상한분 || 300) * 60 * 1000,
      });
      if (r.status !== 0) { 종료 = r.status ?? -1; 말(`   🔴 종료코드 ${종료}`); break; }
    }
    const 난것 = 일.샌곳 ? 새로난수(일.샌곳, 일.샐꼴 || '.', t0) : null;
    const 됨 = 종료 === 0 && (일.샐것 == null || (난것 ?? 0) >= 일.샐것);
    const 분 = Number(((Date.now() - t0) / 60000).toFixed(1));
    기록.push({ id: 일.id, 제목: 일.제목, 됨, 분, 종료코드: 종료, 난것, 샐것: 일.샐것 ?? null });
    말(됨 ? `   ✅ ${일.제목} — ${분}분${난것 != null ? ` · 새로 난 것 ${난것}` : ''}`
          : `   🔴 ${일.제목} — ${분}분 · 종료 ${종료}${난것 != null ? ` · 새로 난 것 ${난것}/${일.샐것}` : ''}`);
    덧쓰기({ 처분: 일.id, 결과: 됨 ? '완주' : '실패', 때: new Date().toISOString(), 분, 난것: 난것 ?? null });
    도장('돌는중', `${기록.filter((x) => x.됨).length}/${ls.length}건`, 기록);
  }

  const 성공 = 기록.filter((x) => x.됨).length;
  말(`\n══ 끝 ${new Date().toLocaleString('ko-KR')} — ${성공}/${ls.length}건 ══`);
  for (const 일 of ls) if (일.확인) 말(`   아침에 볼 것 · ${일.제목}: ${일.확인}`);
  도장(성공 === ls.length ? '완주' : (성공 ? '일부' : '죽음'), `${성공}/${ls.length}건`, 기록);
  return 성공 === ls.length ? 0 : 1;
}

/* ── 띄우기 — 콘솔에서 완전히 뗀다(WMI CreateFlags=520 · .claude/rules/bake-tools.md) ── */
function 띄우기() {
  const ls = 남은것();
  if (!ls.length) { console.log('■ 쌓인 밤 일감이 0건이다 — 띄우지 않는다.'); return 0; }
  const 로그 = path.join(process.env.TEMP || os.tmpdir(), `밤일감_${new Date().toISOString().slice(2, 10).replace(/-/g, '')}.log`);
  const 명 = `"${process.execPath}" "${path.join(__dirname, '밤일감.js')}" --돌기 --로그 "${로그}"`;
  const ps = `$si=([WMIClass]'Win32_ProcessStartup').CreateInstance();$si.CreateFlags=520;$si.ShowWindow=0;`
    + `$r=([WMIClass]'Win32_Process').Create('${명.replace(/'/g, "''")}','${루트.replace(/'/g, "''")}',$si);`
    + `"$($r.ReturnValue) $($r.ProcessId)"`;
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true });
  const [코드, pid] = String(r.stdout || '').trim().split(/\s+/);
  if (코드 !== '0') { console.error(`🔴 못 띄웠다 (ReturnValue=${코드})`); return 1; }
  console.log(`✅ 밤 일감 ${ls.length}건을 떼어 띄웠다 — pid ${pid}`);
  console.log(`   로그 ${로그}`);
  console.log('   세션이 닫혀도 돈다. 아침에 docs/_ops/밤굽기도장.json 을 본다(완주 ≠ 합격).');
  return 0;
}

/* ── 들머리 ───────────────────────────────────────────────────────────── */
const 인자 = process.argv.slice(2);
const 값 = (f) => { const i = 인자.indexOf(f); return i >= 0 ? 인자[i + 1] : undefined; };

if (인자.includes('--쌓기')) {
  const f = 값('--파일');
  if (!f) { console.error('쓰기: node tools/밤일감.js --쌓기 --파일 <json>'); process.exit(2); }
  쌓기(f);
} else if (인자.includes('--빼기')) {
  const id = 값('--빼기');
  const 사유 = 값('--사유') || '';
  if (!남은것().some((o) => o.id === id)) { console.error(`🔴 남은 일감에 ${id} 가 없다`); process.exit(1); }
  덧쓰기({ 처분: id, 결과: '뺌', 때: new Date().toISOString(), 사유 });
  console.log(`✅ 뺐다 ${id}${사유 ? ` — ${사유}` : ''}`);
} else if (인자.includes('--돌기')) {
  const 로그 = 값('--로그');
  const fd = 로그 ? fs.openSync(로그, 'a') : 1;
  process.exit(돌기(fd));
} else if (인자.includes('--띄우기')) {
  process.exit(띄우기());
} else {
  보기();
}
