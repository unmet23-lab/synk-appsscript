#!/usr/bin/env node
// rot-check — 「조용한 부패」를 주기적으로 한 번에 훑는다.
//
// 왜 있나 (2026-08-03 루프 진단): 하네스에 **트리거 층이 통째로 없었다.**
// 훅 4종은 전부 PreToolUse = 내 행동을 **막는 게이트**지, 무언가를 **띄우는 트리거**가 아니다.
// 그래서 도구는 만들어졌는데 아무도 돌리지 않았다 — 실측 두 개가 그 증거였다:
//   · 마찰 신호가 3건 쌓였다(지침의 /evolve 발동 조건은 2건). 세는 도구는 있는데 아무도 안 봤다.
//   · 급여 정본이 v1.3인데 파생 3종이 v1.1 수치를 인용 중이었다. 엣지는 멀쩡히 붙어 있었다.
// 공통점: 실패가 **에러가 아니라 침묵**으로 나타난다. 침묵은 아무도 안 읽으면 영원히 침묵이다.
//
// 설계 판정 — 루프 담론은 "cron으로 에이전트를 상시 돌려라"라고 하지만 여기선 틀린 처방이다.
//   ① 이 하네스는 상주 프로세스가 없다(세션이 켜질 때만 존재한다). 세션 밖 cron은 읽는 사람이 없다.
//   ② 유호님 병목은 「일감 발견」이 아니라 **「결정 대기」**다. 일감을 더 찾아내는 루프는 큐에 기름을 붓는다.
// → 그래서 트리거는 **SessionStart + 주기 스로틀**이고, 산출은 **새 일감이 아니라 부패와 결정 순위**다.
//
// 정지 조건은 무르지 않다 — 검사 결과가 0건이면 **아무것도 출력하지 않는다**.
// ("코드를 개선하라"는 정지 조건이 될 수 없지만 "깨진 링크 0건"은 된다.)
//
// 사용법:
//   node tools/rot-check.js            전체 리포트(0건이어도 「부패 없음」 한 줄은 찍는다)
//   node tools/rot-check.js --quiet    0건이면 완전 침묵 (사람이 손으로 돌릴 때)
//   node tools/rot-check.js --json     기계 판독용
//   node tools/rot-check.js --hook     SessionStart 훅 모드(스로틀 + additionalContext)
//   node tools/rot-check.js --hook --force   스로틀 무시(테스트·수동 확인용)
//   SYNK_ROT_INTERVAL_DAYS=7  주기(기본 7일) · SYNK_ROT_STATE=<경로>  상태 파일 위치
//   SYNK_ROT_LIVE=0           라이브 대조를 끈다(≈15초 pull). 끄면 「초록」이 아니라 **미측정**으로 낸다.
//                             `collect()` 를 직접 부르면 기본이 꺼짐이다 — 회귀·CI 가 네트워크를 안 타야 하므로.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INTERVAL_DAYS = 7;
const stateFile = () =>
  process.env.SYNK_ROT_STATE || path.join(ROOT, '.claude', 'state', 'rot-check.json');

/* ── 수집 ────────────────────────────────────────────────────────────────── */
// 각 검사는 **독립적으로** 실패할 수 있어야 한다. 하나가 터져서 나머지가 통째로 침묵하면
// 「부패 없음」과 「검사기가 죽었음」이 또 똑같이 생긴다 — 이 도구가 고치려는 바로 그 병이다.
function attempt(name, fn) {
  try {
    return { name, ok: true, value: fn() };
  } catch (e) {
    return { name, ok: false, error: (e && e.message) || String(e) };
  }
}

function memorySection() {
  const M = require('./memory-graph.js');
  const dir = M.memoryDir();
  const nodes = M.load(dir);
  if (!nodes) throw new Error(`메모리 디렉터리를 못 찾음: ${dir}`);
  const d = M.diagnose(nodes);
  const dec = M.decisions(nodes);

  // 그래프 밖의 결정 부채 — 본문에 ⏳는 있는데 [[막힘>…]] 엣지가 없는 토픽.
  // 이게 왜 중요한가: 결정 큐 위상정렬은 **엣지로만** 순위를 매긴다. 글로만 있는 ⏳는
  // 큐에 아예 안 잡히므로, 「차단자 2개」가 「대기 2건」을 뜻한다고 오해하게 만든다.
  const unwired = [];
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    let text = '';
    try { text = fs.readFileSync(n.full, 'utf8'); } catch (_) { continue; }
    if (!text.includes('⏳')) continue;
    if (n.links.some((l) => l.type === '막힘')) continue;
    unwired.push(n.slug);
  }

  const totalLinks = [...nodes.values()].reduce((a, n) => a + n.links.length, 0);
  const typed = [...nodes.values()]
    .reduce((a, n) => a + n.links.filter((l) => l.type !== '관련').length, 0);

  return { dir, count: nodes.size - 1, totalLinks, typed, diagnose: d, decisions: dec, unwired };
}

function docSection() {
  const D = require('./doc-graph.js');
  const g = D.build();
  if (!g.docs.size) throw new Error('문서를 하나도 못 읽었다 — SKIP 규칙이 docs를 통째로 걸렀을 수 있다');
  return {
    docs: g.docs.size,
    broken: g.broken,
    stale: g.stale,
    canonUnknown: g.canonUnknown,
    unversioned: g.unversioned.length,
    mapGaps: g.mapGaps,
  };
}

function frictionSection() {
  const F = require('./friction.js');
  if (!fs.existsSync(F.LEDGER)) throw new Error(`장부가 없다: ${F.LEDGER}`);
  const { rows } = F.read();
  return { open: rows.filter((r) => !r.resolved), total: rows.length };
}

function harnessSection() {
  // 이식 폴더(바탕화면 SYNK_하네스)는 머리말에 정본 버전을 박아 「스스로 낡음을 말하는」 생성물이지만,
  // 여는 사람이 없으면 그 고백도 침묵이다 — 실측: v6.12 개정 당일, 폴더는 v6.11인 채로 하루를 보냈다(08-03).
  // 폴더가 없으면 부패가 아니다(아직 안 꺼낸 것) — 「없음」과 「낡음」을 같은 모양으로 만들지 않는다.
  const H = require('./harness-export.js'); // require는 생성기를 실행하지 않는다 — 경로·정본 버전만 얻는다
  const dir = process.env.SYNK_HARNESS_OUT || H.DEFAULT_OUT;
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) return { present: false, canonical: H.VER };
  const m = fs.readFileSync(readme, 'utf8').match(/지침 \*\*(v[\d.]+)/);
  const stamp = m ? m[1] : null;
  return { present: true, canonical: H.VER, stamp, stale: !stamp || stamp !== H.VER };
}

function 배포Section(라이브) {
  /* 「커밋은 했는데 `clasp push` 를 안 했다」 — 루트(유호님이 매일 쓰는 라이브 학원 시스템)는
   * @HEAD 를 서빙해서 배포 설명에 심는 **지문이 원리상 안 선다**(배포판점검 머리말). 그래서
   * `deploy-freshness` 훅은 루트에 영원히 침묵하고, `/deploy` 를 안 부른 커밋의 드리프트는
   * 아무 층에서도 안 보인다 — **스킬은 불러야 적용된다.** 여기서 라이브를 받아 바이트로 잰다.
   * 왜 주간인가: 드리프트는 느리게 생기고 재는 값이 비싸다(라이브 pull ~15초).
   * 왜 `/deploy` 안이 아닌가: /deploy 는 끝에 push 를 하므로 재는 순간 답이 늘 「같음」이다.
   * 🔴 라이브를 안 재는 호출(테스트·CI·`SYNK_ROT_LIVE=0`)은 **초록이 아니라 미측정**으로 낸다. */
  const D = require('./배포판점검.js');
  if (!라이브) return { 측정: false, 결과: [] };
  return { 측정: true, 결과: D.claspProjects().map((p) => D.점검(p, ROOT, { 라이브: true })) };
}

function notebooklmSection() {
  // 하네스 폴더와 결정적으로 다른 점: 노트북LM 묶음은 **올린 뒤 손이 닿지 않는다.**
  // 자료는 구글 계정 안으로 복사돼 버려서, 저장소가 아무리 바뀌어도 그쪽은 그대로다.
  // 즉 「스스로 낡음을 말하는」 배너조차 올라간 사본에는 만든 날짜로 굳어 있다 —
  // 낡음을 알려야 할 상대는 폴더가 아니라 **올린 사람**이다. 그래서 주간 점검이 진다.
  const N = require('./notebooklm-export.js'); // require는 생성기를 실행하지 않는다
  const dir = process.env.SYNK_NOTEBOOKLM_OUT || N.DEFAULT_OUT;
  const readme = path.join(dir, 'README_먼저읽기.md');
  if (!fs.existsSync(readme)) return { present: false }; // 아직 안 쓰는 것 = 부패 아님
  const madeAt = fs.statSync(readme).mtimeMs;
  // 앵커는 굵기표시(**)를 건너뛰고 날짜만 본다 — 문구 앵커는 문구가 바뀌면 죽고,
  // 죽어도 경고는 그대로 떠서 「(날짜 미검출)」이라는 쓸모없는 값으로 조용히 낡는다.
  // 생성기와 이 앵커가 어긋나는지는 tests/노트북LM묶음.test.js가 왕복으로 검사한다.
  const m = fs.readFileSync(readme, 'utf8').match(/만든 날\s*\**\s*(\d{4}-\d{2}-\d{2})/);
  const changed = [];
  for (const { root } of N.SOURCE_ROOTS) {
    for (const f of N.walk(root)) {
      if (fs.statSync(f).mtimeMs > madeAt) changed.push(path.basename(f));
    }
  }
  return { present: true, made: m ? m[1] : '(날짜 미검출)', changed };
}

function nblmDriveSection() {
  /* 노트북LM **자동 갱신** 배선(예약 작업 SYNK_NotebookLM)의 감시.
   *
   * 왜 필요한가 — 자동화를 붙이면 「안 도는 것」이 「아무 일도 안 일어남」으로 나타난다.
   * 드라이브가 꺼져 있거나 크롬이 실패하면 생성기는 정직하게 멈추고 로그만 남기는데,
   * **그 로그를 아무도 안 연다.** 장치를 만들고 발동 조건을 안 만든 형태(F026)의 재발이라
   * 여기서 읽는다 — 「자동이니까 되겠지」가 정확히 조용한 실패의 모양이다.
   *
   * 로그가 없으면 부패가 아니다(아직 한 번도 안 돌았거나 이 기계가 아니다). */
  const log = path.join(__dirname, 'notebooklm-drive.log');
  if (!fs.existsSync(log)) return { present: false };
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => /\bOK\b|FAILED/.test(l));
  if (!lines.length) return { present: true, unknown: true };
  const last = lines[lines.length - 1];
  const failed = /FAILED/.test(last);
  const 마지막성공 = [...lines].reverse().find((l) => /\bOK\b/.test(l)) || null;
  // 로그 줄머리 = `%date% %time%` (예: 2026-08-04 12:24:57.19)
  const 날짜 = (s) => (s && s.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  const 성공일 = 날짜(마지막성공);
  const 지난날 = 성공일 ? Math.floor((Date.now() - new Date(성공일 + 'T00:00:00').getTime()) / 86400000) : null;
  return { present: true, failed, last, 성공일, 지난날 };
}

function mapSection() {
  /* 바탕화면 SYNK_지도 폴더 — 유호님이 실제로 여는 사본이 repo 정본과 갈라졌는지.
   * 도구(tools/지도대장.js)는 e27a93a 로 들어왔는데 **발화 지점이 0**이었다(「장치와
   * 발동 조건은 같은 커밋에서」 미충족 · 커밋 메시지에 미완성으로 명시). 여기가 그 발동
   * 조건이다 — 주간 점검이 돌 때마다 같이 잰다(2026-08-04).
   * 폴더가 없으면 부패가 아니라 미실행이다(CI·클라우드·다른 기계). */
  const M = require('./지도대장.js');
  const 결과 = M.훑기();
  if (!결과.있음) return { present: false, dir: 결과.dir };
  const 문제지도 = 결과.지도들.filter((m) => m.문제.length);
  return {
    present: true,
    지도수: 결과.지도들.length,
    문제수: 문제지도.reduce((a, m) => a + m.문제.length, 0),
    지도들: 문제지도.map((m) => ({ 이름: m.이름, 첫문제: (m.문제[0] || '').split('\n')[0] })),
  };
}

function toilSection() {
  /* 손일 장부(docs/_ops/손일장부.md)가 자라고 있는지.
   *
   * 다른 섹션과 성격이 다르다 — 여기서 썩는 것은 파일이 아니라 **기억**이다.
   * 손일을 없애는 순간 「그게 얼마나 자주·몇 분이었나」를 잴 마지막 기회가 지나가고,
   * 그 뒤에는 아무도 되살릴 수 없다(소급 불가). 그래서 검사 대상은 「낡았나」가 아니라
   * **「기입 통로가 아직 도는가」**다.
   *
   * ⚠ 매 릴리스가 손일을 없애는 것은 아니므로 임계를 날짜로 둔다 — 버전 수로 재면
   *   개원 전처럼 릴리스가 잦은 구간에서 경고가 노이즈가 되고, 노이즈가 되면 꺼진다.
   * 장부가 없거나 한 줄도 없으면 부패가 아니다(아직 안 쓰는 것). */
  const T = require('./toil.js');
  if (!fs.existsSync(T.ledgerPath())) return { present: false };
  const { rows } = T.read();
  const idle = T.daysSinceLast(rows);
  const limit = Number(process.env.SYNK_TOIL_IDLE_DAYS || 30);
  return { present: true, count: rows.length, idle, limit, stale: idle !== null && idle >= limit };
}

/* ── 판정 ────────────────────────────────────────────────────────────────── */
// 🔴 = 무언가가 이미 거짓을 말하고 있다(고치기 전엔 그래프·문서가 거짓말한다)
// ⚠  = 아직 거짓은 아니지만 방치하면 🔴이 된다
const EVOLVE_THRESHOLD = 2; // 지침: 마찰 신호 2건이면 /evolve 실행을 **제안**한다

function collect({ 라이브 = false } = {}) {
  const mem = attempt('memory', memorySection);
  const doc = attempt('doc', docSection);
  const fri = attempt('friction', frictionSection);
  const har = attempt('harness', harnessSection);
  const nbl = attempt('notebooklm', notebooklmSection);
  const nbd = attempt('notebooklm-drive', nblmDriveSection);
  const toi = attempt('toil', toilSection);
  const map = attempt('지도', mapSection);
  const dep = attempt('배포판', () => 배포Section(라이브));

  const red = [];
  const warn = [];
  const notes = [];

  for (const s of [mem, doc, fri, har, nbl, nbd, toi, map, dep]) {
    if (!s.ok) red.push({ kind: '검사기 고장', text: `${s.name} 검사가 실패했다 — ${s.error}` });
  }

  if (dep.ok && dep.value.측정) {
    for (const r of dep.value.결과) {
      if (r.level === 'stale') red.push({ kind: '라이브 낡음', text: r.lines.join('\n      ') });
      else if (r.level === 'unknown') warn.push({ kind: '배포 판정 불가', text: r.lines[0] });
      // 확인 불가는 **경고가 아니라 메모**다 — 폰·CI엔 자격증명이 없고, 그건 부패가 아니다.
      // 단 침묵시키지도 않는다: 통과와 미실행이 같은 모양이면 이 도구의 존재 이유가 사라진다.
      else if (r.level === 'unreachable') notes.push({ kind: '라이브 미측정', text: r.lines.join(' / ') });
    }
  }

  if (mem.ok) {
    const d = mem.value.diagnose;
    for (const b of d.broken) red.push({ kind: '깨진 링크', text: `${b.from} --${b.type}> ${b.target}` });
    for (const g of d.ghostInIndex) red.push({ kind: '인덱스 유령', text: `MEMORY.md가 없는 파일을 가리킨다: ${g}` });
    for (const u of d.unknown) warn.push({ kind: '미지 링크 타입', text: `${u.from}: ${u.type}>${u.target}` });
    for (const m of d.missingFromIndex) warn.push({ kind: '인덱스 누락', text: m });
    for (const o of d.orphans) warn.push({ kind: '고아 노드', text: o });
  }

  if (doc.ok) {
    for (const b of doc.value.broken) red.push({ kind: '깨진 참조', text: `${b.from} → ${b.target}` });
    for (const s of doc.value.stale) {
      red.push({ kind: '낡은 인용', text: `${s.from} — ${path.basename(s.target)} 인용 ${s.cited} → 현재 ${s.now}` });
    }
    for (const c of doc.value.canonUnknown) {
      warn.push({ kind: '정본 버전 미상', text: `${c.target}(${c.from}이 ${c.cited} 인용)` });
    }
    // 색인 밖 문서는 **한 줄로** 올린다 — 12건이 각자 한 줄을 먹으면 warn 렌더 상한(12)을
    // 통째로 차지해 다른 신호를 밀어낸다. 전량은 도구가 갖고 있다.
    const mg = doc.value.mapGaps;
    if (mg.noMap) {
      red.push({ kind: '지도 실종', text: 'docs/문서_지도.md 가 없다 — 색인이 통째로 사라졌다' });
    } else if (mg.missing.length) {
      const 앞 = mg.missing.slice(0, 3).map((m) => path.basename(m)).join('·');
      warn.push({
        kind: '지도 누락',
        text: `${mg.missing.length}종이 문서_지도.md 색인 밖 — ${앞}${mg.missing.length > 3 ? ' 외' : ''}` +
          ' · 색인이 갈라지면 정본 지목이 두 갈래가 된다(08-07 실측) · 전량: node tools/doc-graph.js',
      });
    }
  }

  if (har.ok && har.value.present && har.value.stale) {
    warn.push({
      kind: '이식 폴더 낡음',
      text: `바탕화면 SYNK_하네스 = ${har.value.stamp || '(스탬프 미검출)'} · 정본 = ${har.value.canonical}` +
        ' — 다른 도구(Codex·Kimi·웹·Obsidian)가 낡은 지침을 읽는다. 수리: node tools/harness-export.js',
    });
  }

  if (nbl.ok && nbl.value.present && nbl.value.changed.length) {
    const n = nbl.value.changed.length;
    warn.push({
      kind: '노트북LM 묶음 낡음',
      text: `묶음(만든 날 ${nbl.value.made}) 이후 원천 ${n}개가 바뀌었다 — ` +
        `${nbl.value.changed.slice(0, 3).join(', ')}${n > 3 ? ` 외 ${n - 3}건` : ''}. ` +
        '올라간 사본은 저장소가 만질 수 없으므로 스스로 안 낫는다. ' +
        '수리: node tools/notebooklm-export.js → 노트북LM에서 옛 노트북을 지우고 새로 올린다',
    });
  }

  if (nbd.ok && nbd.value.present && !nbd.value.unknown) {
    if (nbd.value.failed) {
      red.push({
        kind: '노트북LM 자동 갱신 실패',
        text: `예약 작업 SYNK_NotebookLM 마지막 실행이 실패했다 — ${nbd.value.last.trim()}\n` +
          '     드라이브 데스크톱이 꺼졌거나 크롬 실패. 노트북LM 소스는 그 시점에서 멈춰 있다' +
          '(화면상으론 「있는 것」처럼 보이므로 조용한 낡음이다). 수리: node tools/notebooklm-drive.js',
      });
    } else if (nbd.value.지난날 !== null && nbd.value.지난날 >= 3) {
      warn.push({
        kind: '노트북LM 자동 갱신 멈춤',
        text: `마지막 성공이 ${nbd.value.성공일}(${nbd.value.지난날}일 전) — 매일 도는 배선인데 안 돌고 있다. ` +
          'PC가 꺼져 있었다면 정상이지만, 켜져 있었다면 예약 작업을 확인하라(schtasks /query /tn SYNK_NotebookLM).',
      });
    }
  }

  if (map.ok && map.value.present && map.value.문제수) {
    warn.push({
      kind: '지도 사본 갈림',
      text: `바탕화면 SYNK_지도 ${map.value.지도수}종 중 문제 ${map.value.문제수}건 — ` +
        map.value.지도들.slice(0, 3).map((m) => `${m.이름}(${m.첫문제})`).join(' · ') +
        ' — 유호님이 여는 사본이 정본과 갈라졌거나 신선도를 모른다.' +
        ' 상세: node tools/지도대장.js · 수리: --bake / --stamp',
    });
  }

  if (toi.ok && toi.value.present && toi.value.stale) {
    warn.push({
      kind: '손일 장부 정체',
      text: `마지막 기입이 ${toi.value.idle}일 전(기준 ${toi.value.limit}일) — 그 사이 사람 일을 없앤 릴리스가 정말 없었나. ` +
        '없앤 뒤에는 「그게 얼마나 자주였나」를 다시 못 잰다(소급 불가). ' +
        '기입: node tools/bump-version.js --desc "..." --toil "없앤 손일::주기::대체 장치"',
    });
  }

  if (fri.ok && fri.value.open.length >= EVOLVE_THRESHOLD) {
    notes.push({
      kind: '/evolve 발동 조건 도달',
      text: `살아있는 마찰 신호 ${fri.value.open.length}건(기준 ${EVOLVE_THRESHOLD}건) — ` +
        fri.value.open.map((r) => r.id).join(', '),
    });
  }

  return { mem, doc, fri, har, dep, red, warn, notes, findings: red.length + warn.length + notes.length };
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */
function render(r) {
  const out = [];
  const push = (s) => out.push(s);

  if (r.red.length) {
    push(`🔴 수리 필요 ${r.red.length}건`);
    for (const x of r.red) push(`   [${x.kind}] ${x.text}`);
  }
  if (r.warn.length) {
    push(`⚠ 주의 ${r.warn.length}건`);
    for (const x of r.warn.slice(0, 12)) push(`   [${x.kind}] ${x.text}`);
    if (r.warn.length > 12) push(`   … 외 ${r.warn.length - 12}건`);
  }
  for (const n of r.notes) push(`▶ ${n.kind} — ${n.text}`);

  // 결정 큐 — 부패가 아니라 **순서**다. 이 도구가 존재하는 이유의 절반이 여기에 있다.
  if (r.mem.ok) {
    const dec = r.mem.value.decisions;
    if (dec.ranked.length) {
      push(`\n결정 큐 (막힘> 위상정렬) — 기다리는 항목 ${dec.waiting}개`);
      for (const x of dec.ranked.slice(0, 3)) {
        push(`   ${String(x.unblocks).padStart(2)}건 해소 ← ${x.blocker} [${x.kind}]`);
      }
      if (dec.cycles.length) push(`   ☠️ 순환 대기 ${dec.cycles.length}건 — 서로 기다려 영원히 안 풀린다`);
    }
    const un = r.mem.value.unwired;
    if (un.length) {
      push(`   ℹ 큐 밖의 ⏳ — ${un.length}개 토픽이 글로만 대기 중(막힘> 엣지가 없어 순위에 안 잡힌다)`);
    }
  }
  return out.join('\n');
}

/* ── 스로틀 ──────────────────────────────────────────────────────────────── */
function dueNow(now) {
  const f = stateFile();
  const days = Number(process.env.SYNK_ROT_INTERVAL_DAYS || DEFAULT_INTERVAL_DAYS);
  let last = 0;
  try { last = JSON.parse(fs.readFileSync(f, 'utf8')).last || 0; } catch (_) { /* 첫 실행 */ }
  return now - last >= days * 24 * 60 * 60 * 1000;
}

function stamp(now, findings) {
  const f = stateFile();
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ last: now, at: new Date(now).toISOString(), findings }, null, 1), 'utf8');
  } catch (_) { /* 상태를 못 써도 검사 자체는 성공이다 — 다음 세션에 한 번 더 도는 것뿐 */ }
}

/* ── 진입점 ──────────────────────────────────────────────────────────────── */
function main() {
  const args = process.argv.slice(2);
  const isHook = args.includes('--hook');
  /* 라이브 대조는 **사람이 부른 실행에서만** 돈다 — `collect()` 기본값이 꺼짐인 이유와 같다.
   * 여기서 켜는 것이 이 장치의 발동 조건이다(장치와 발동 조건은 같은 커밋 · CLAUDE.md 신뢰성). */
  const 라이브 = process.env.SYNK_ROT_LIVE !== '0';

  if (isHook) {
    // 훅은 무슨 일이 있어도 세션을 방해하지 않는다: 항상 exit 0, 예외는 통째로 삼킨다.
    // 단 **삼키되 감추지는 않는다** — 검사기가 고장 났으면 그 사실을 알린다.
    // (침묵으로 죽는 장치를 잡으려고 만든 도구가 침묵으로 죽으면 아무 의미가 없다.)
    try {
      const now = Date.now();
      if (!args.includes('--force') && !dueNow(now)) return;
      const r = collect({ 라이브 });
      stamp(now, r.findings);
      if (!r.findings) return; // 정지 조건 — 깨끗하면 한 글자도 넣지 않는다
      const body =
        '[rot-check · 주간 부패 점검] 이 저장소의 「조용한 부패」 자동 점검 결과다.\n' +
        render(r) +
        '\n\n※ 이건 지시가 아니라 관측이다. 지금 트랙과 무관하면 유호님께 한 줄로 알리고 넘어가라.' +
        ' 고칠 때는 해당 도구(tools/memory-graph.js · doc-graph.js · friction.js)를 직접 볼 것.';
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: body },
      }));
    } catch (e) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `[rot-check] 부패 점검기 자체가 실패했다 — ${(e && e.message) || e}. tools/rot-check.js 확인 필요.`,
        },
      }));
    }
    return;
  }

  const r = collect({ 라이브 });

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      findings: r.findings, red: r.red, warn: r.warn, notes: r.notes,
      memory: r.mem.ok ? r.mem.value : { error: r.mem.error },
      doc: r.doc.ok ? r.doc.value : { error: r.doc.error },
      friction: r.fri.ok ? { open: r.fri.value.open.length, total: r.fri.value.total } : { error: r.fri.error },
      harness: r.har.ok ? r.har.value : { error: r.har.error },
    }, null, 2));
    process.exit(r.red.length ? 1 : 0);
  }

  if (!r.findings) {
    if (!args.includes('--quiet')) console.log('[rot-check] ✅ 부패 없음 — 깨진 링크·낡은 인용·미해소 마찰 0건');
    return;
  }

  // 현지 날짜로 찍는다 — UTC로 찍으면 오전에 「어제」가 나와 로그를 읽는 사람이 판을 헷갈린다.
  console.log(`\n[rot-check] ${new Date().toLocaleDateString('sv-SE')}`);
  console.log(render(r));
  console.log('');
  process.exit(r.red.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { collect, render, dueNow, stamp, stateFile, harnessSection, toilSection, mapSection, 배포Section, EVOLVE_THRESHOLD };
