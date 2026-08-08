#!/usr/bin/env node
// toil — 자동화가 없앤 「사람 일」을 세는 장부.
//
// 왜 있나 (2026-08-04 · 로드맵 4단계 ④ 도전안): 「원장 전용 AI 비서」는 3년 뒤 상품인데,
// 그 제품 명세가 되는 것은 코드가 아니라 **「무엇이 아팠는지」**다. 코드는 git에 영원히 남지만
// 「이 손일이 주 몇 건이었고 몇 분 걸렸는가」는 그 손일이 사라지는 순간 같이 사라진다 —
// 없앤 뒤에는 아무도 그것을 세지 않는다. 소급 불가라 지금 시작하는 것 말고 방법이 없다.
//
// 설계 판정 3개:
//   ① ID를 따로 채번하지 않는다 — **버전 번호가 ID다.** bump-version.js의 채번 락이 이미
//      유일성을 보증하므로, 별도 순번을 매기면 그 자체가 네 번째 동시발번 충돌 경로가 된다
//      (버전 9건·마찰 F015·F016·F041이 전부 「세션이 각자 base에서 순번을 매겨서」 났다).
//   ② 기입 통로를 새로 만들지 않는다 — bump-version.js `--toil`이 주 통로다. 새 명령은
//      「스스로 발화하지 않는 장치」가 되어 안 돌아간다(CLAUDE.md).
//   ③ 마찰신호.md에 섞지 않는다 — 그쪽은 해소 칸이 차는 것이 정상이고 살아있는 신호 2건이
//      /evolve 발동 조건이다. 손일은 해소될 성질이 아니라 임계를 영구히 오염시킨다.
//
// 사용법:
//   node tools/toil.js                                집계
//   node tools/toil.js add v9.177 "없앤 손일::주기::대체 장치"
//   node tools/toil.js add v9.177 "..." --date 2026-08-04
//   node tools/toil.js --json                         기계 판독용
'use strict';
const fs = require('fs');
const path = require('path');
const { 칸나누기 } = require('./lib/표.js');   // 날 split 은 백틱 안 파이프에서 칸을 민다(F119·F253)

/* 테스트는 실제 장부를 건드리면 안 된다 — 회귀가 기록을 오염시키면 그 기록은 증거가 못 된다.
 * ⚠ 상수가 아니라 **함수**다. 모듈 로드 시점에 고정하면 같은 프로세스 안에서 env를 갈아끼워도
 *   반영되지 않아, 격리한 줄 알았던 테스트가 조용히 실장부를 읽는다(초판이 실제로 그랬고
 *   「행 2개」를 기대한 검사가 실장부의 4개를 봤다). rot-check.js stateFile()과 같은 패턴. */
const ledgerPath = () =>
  process.env.SYNK_TOIL_LEDGER || path.resolve(__dirname, '..', 'docs', '_ops', '손일장부.md');
const FIELDS = 3;                 // 없앤 손일 | 주기 | 대체 장치
const UNKNOWN = '미상';

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 표 행만 읽는다. 머리말 서술이 아무리 길어도 `| vN.N |`로 시작하는 줄만 데이터다. */
function read() {
  const text = fs.readFileSync(ledgerPath(), 'utf8');
  const lines = text.split('\n');
  const rows = [];
  lines.forEach((line, i) => {
    const m = /^\|\s*(v\d+\.\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (!m) return;
    const cells = 칸나누기(line).slice(1);   // [0]=ver 는 m[1] 로 이미 검증했다
    rows.push({ ver: m[1], date: cells[0], toil: cells[1], cadence: cells[2], device: cells[3] || '', line: i });
  });
  return { text, lines, rows };
}

/* 구분자가 '|'가 아닌 이유 — 회귀가 잡은 실제 결함:
 * 값이 들어갈 곳이 **마크다운 표**인데 그 표의 구분자와 같은 문자를 입력 구분자로 쓰면,
 * "시트 A|B 열을 맞추던 일" 같은 정상 입력이 4칸으로 갈라져 거부된다. add() 안에 '|' 치환
 * 방어를 두었어도 parseSpec이 그 앞에서 죽으므로 방어에 닿지도 못했다. */
const SEP = '::';

/** "없앤 손일::주기::대체 장치" → 세 칸. 칸이 모자라면 채우지 않고 실패시킨다.
 *  ⚠ 주기를 선택으로 두면 전부 빈칸이 된다 — 이 장부에서 주기는 부가정보가 아니라 **본체**다. */
function parseSpec(spec) {
  const parts = String(spec == null ? '' : spec).split(SEP).map((s) => s.trim());
  if (parts.length !== FIELDS || parts.some((p) => !p)) {
    throw new Error(
      `형식: "없앤 손일${SEP}주기${SEP}대체 장치" — 세 칸을 전부 채운다(구분자 ${SEP}).\n` +
      `  못 재는 주기는 "${UNKNOWN}"이라 적는다(추정치를 지어내지 않는다).\n` +
      `  받은 값: ${JSON.stringify(spec)}`
    );
  }
  return { toil: parts[0], cadence: parts[1], device: parts[2] };
}

function isVersion(v) {
  return /^v\d+\.\d+$/.test(String(v || ''));
}

/** 표의 마지막 행 뒤에 넣는다(파일 끝이 아니라) — 아래 서술이 붙어도 안전하게. */
function insertRow(lines, row) {
  let at = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\|\s*v\d+\.\d+\s*\|/.test(lines[i].trim())) { at = i + 1; break; }
  }
  const out = lines.slice();
  out.splice(at, 0, row);
  return out;
}

function add(ver, spec, date) {
  if (!isVersion(ver)) throw new Error(`버전 형식이 아님(vN.N): ${ver}`);
  const { toil, cadence, device } = parseSpec(spec);
  const { lines, rows } = read();
  if (rows.some((r) => r.ver === ver)) {
    // 한 버전이 여러 손일을 없앨 수 있다. 막지 않고 알리기만 한다 — 기록 유실이 중복보다 나쁘다.
    console.error(`⚠ ${ver} 행이 이미 있다 — 같은 버전에 한 줄 더 추가한다.`);
  }
  // '|'는 표를 깨뜨린다. 삼키지 말고 치환해 장부가 파싱 불가가 되는 것을 막는다(friction.js와 같은 처리).
  const safe = (s) => String(s).replace(/\|/g, '/').replace(/\n/g, ' ').trim();
  const row = `| ${ver} | ${date || today()} | ${safe(toil)} | ${safe(cadence)} | ${safe(device)} |`;
  fs.writeFileSync(ledgerPath(), insertRow(lines, row).join('\n'), 'utf8');
  console.log(`  + ${ver}  ${safe(toil)}  (주기 ${safe(cadence)} → ${safe(device)})`);
  return row;
}

/** 마지막 기입 이후 며칠인가. 장부가 비면 null(「없음」과 「낡음」을 같은 모양으로 만들지 않는다). */
function daysSinceLast(rows, now) {
  const dates = (rows || []).map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) return null;
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  const ref = now instanceof Date ? now : new Date();
  return Math.floor((ref - last) / 86400000);
}

/* ⚠ 완전일치로 세면 안 된다 — 실제 기입은 `미상(소급)`처럼 사유가 붙는다.
 * 초판이 `=== UNKNOWN`이라 소급 3건을 「실측」으로 셌다. 이 장부가 막으려던 바로 그 형태
 * (못 잰 것을 잰 것처럼 보이게 하는 것)가 집계에서 일어났다. 접두 판정으로 고정한다. */
const isUnknown = (c) => !c || String(c).trim().startsWith(UNKNOWN);

function stats(rows) {
  const unknown = rows.filter((r) => isUnknown(r.cadence)).length;
  return { total: rows.length, unknownCadence: unknown, measured: rows.length - unknown };
}

function report(asJson) {
  const { rows } = read();
  const s = stats(rows);
  const idle = daysSinceLast(rows);
  if (asJson) { console.log(JSON.stringify({ ...s, daysSinceLast: idle, rows }, null, 2)); return; }

  console.log(`\n[손일 장부] ${s.total}건 · 주기 실측 ${s.measured} · 미상 ${s.unknownCadence}`);
  if (idle !== null) console.log(`  마지막 기입: ${idle}일 전\n`);
  for (const r of rows) {
    console.log(`  ${r.ver.padEnd(8)} ${r.date}  ${r.toil}`);
    console.log(`  ${' '.repeat(8)} ${' '.repeat(10)}  주기 ${r.cadence} → ${r.device}`);
  }
  if (s.unknownCadence) {
    console.log(`\n  ⚠ 주기 미상 ${s.unknownCadence}건 — 이미 없앤 손일은 다시 못 잰다.`);
    console.log('    다음 건부터는 없애기 **전에** 주기를 적는다(그게 이 장부의 존재 이유다).');
  }
  console.log('');
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  if (!fs.existsSync(ledgerPath())) {
    console.error(`[toil] 장부가 없다: ${ledgerPath()}`);
    process.exit(1);
  }
  if (args[0] === 'add') {
    const di = args.indexOf('--date');
    const date = di !== -1 ? args[di + 1] : null;
    const rest = di !== -1 ? args.slice(1, di) : args.slice(1);
    add(rest[0], rest.slice(1).join(' '), date);
  } else {
    report(args.includes('--json'));
  }
}

module.exports = { read, add, parseSpec, isVersion, insertRow, daysSinceLast, stats, isUnknown, ledgerPath, UNKNOWN, FIELDS, SEP };

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
