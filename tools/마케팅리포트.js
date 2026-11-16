#!/usr/bin/env node
'use strict';
/**
 * PULSE 고객 방 「마케팅 성과」 리포트를 회사 서버에 올리고, 보고, 내린다 (2026-11-17).
 *
 * 리포트는 이 PC에서 잰 결과를 스크립트가 JSON으로 만든 것이다. 서버는 재지 않고 받은 것을 저장해 고객 방에 전한다
 * (결정 표 2026-11-16 「PULSE 제작 뒤 마케팅 서비스를 두는 자리」). 사람이 화면에 붙여 넣는 일이 아니라서 이 도구가 직원 경로로 올린다.
 * 꼴은 docs/마케팅/PULSE_마케팅성과_20261116/계약.md, 서버는 회사 프로그램의 pulse-marketing.mjs와 pulse-marketing-routes.mjs다.
 *
 *   node tools/마케팅리포트.js 프로젝트                                      내가 볼 수 있는 고객 프로젝트(id, 이름, 고객)
 *   node tools/마케팅리포트.js 목록 <프로젝트id>                              올라가 있는 리포트와 고객에게 보이는지
 *   node tools/마케팅리포트.js 올리기 <프로젝트id> <리포트.json>…             미리 보기(꼴 검사와 서버 목록 읽기까지, 쓰지 않는다)
 *   node tools/마케팅리포트.js 올리기 <프로젝트id> <리포트.json>… --실행       올린다
 *   node tools/마케팅리포트.js 내리기 <프로젝트id> <종류> <회차> [--실행]      한 건을 내린다(--실행이 없으면 미리 보기)
 *   덧붙이는 것: --덮어쓰기(같은 종류와 회차가 이미 있을 때 고쳐 올린다) · --json
 *
 * 지키는 것
 * - 올리기 전에 서버와 같은 꼴 검사(normalizeReport)를 이 PC에서 먼저 돌린다. 파일 하나라도 걸리면 로그인도 하지 않고 멈춘다.
 * - 같은 종류와 회차가 이미 올라가 있으면 멈춘다. 고쳐 올리는 것이면 --덮어쓰기를 붙인다.
 * - 쓰기(올리기 --실행, 내리기 --실행)는 이 PC에서 한 번에 하나만 돈다. 서버는 같은 종류와 회차를 조건 없이 덮기 때문에, 목록을 읽고 올리는
 *   사이에 다른 실행이 끼지 못하게 처음부터 끝까지 잠금을 쥔다. 이 PC 밖에서 올리는 길이 생기면(직원 화면) 서버가 「없을 때만 올리기」를 받게 고친다.
 * - 스위치 marketing이 켜져 있으면 올리기가 곧 그 고객에게 공개다. 미리 보기와 결과에 고객에게 보이는지를 적는다.
 * - 리포트의 실제 자료는 저장소에 두지 않는다(비공개 보관함). 이 도구는 파일을 읽기만 하고 어디에도 옮겨 쓰지 않는다.
 * - 작업실은 tools/작업실예약.js의 connect(작업실 자동화 계정)로 들어가고, 직접 로그인했으면 끝에 로그아웃한다.
 *
 * 끝 코드: 0 됨 · 1 막힘이나 실패 · 2 쓰는 법이 틀림 · 3 작업실 자동화 자격이 없음 · 4 이 PC에서 다른 쓰기가 도는 중
 */
const fs = require('fs');
const net = require('net');
const path = require('path');
const { pathToFileURL } = require('url');

const 루트 = path.resolve(__dirname, '..');
const 회사폴더 = path.join(루트, 'docs', '마케팅', '온라인마케팅지도', 'engagement', 'company');
const 프로젝트꼴 = /^[a-f0-9-]{36}$/;
const 회차꼴 = /^[0-9A-Za-z][0-9A-Za-z-]{0,39}$/;
// pulse-marketing-routes.mjs가 올리기 몸통에 두는 상한 둘이다(바이트, 그리고 몸통 글의 길이). 하나라도 넘는 파일은 보내기 전에 막는다.
const 몸통한도 = Object.freeze({ 바이트: 900000, 글자: 300000 });
// 이 PC에서 쓰기(올리기 --실행, 내리기 --실행)는 한 번에 하나만 돈다. 서버는 같은 종류와 회차를 조건 없이 덮으므로,
// 두 실행이 같은 목록을 읽고 차례로 올리면 --덮어쓰기 없이도 덮인다. 이름 붙은 파이프(Windows)와 추상 소켓(Linux)은
// 한 프로세스만 들을 수 있고 프로세스가 죽으면 운영체제가 풀어 주므로 낡은 잠금이 남지 않는다.
const 쓰기잠금이름 = 'synk-marketing-report-write';
const 종류이름 = { 'ai-search': 'AI 검색', 'competitor-ads': '경쟁사 광고', 'label-review': '표기 검수', memo: '메모' };

const 문제 = (끝코드, 글) => Object.assign(new Error(글), { 끝코드 });
const 열쇠 = (r) => `${r.kind}:${r.runId}`;

let 꼴모듈 = null;
async function 꼴검사모듈() {
  if (!꼴모듈) 꼴모듈 = await import(pathToFileURL(path.join(회사폴더, 'pulse-marketing.mjs')).href);
  return 꼴모듈;
}

/** 리포트 파일들을 읽고 서버와 같은 꼴 검사를 돌린다. 걸림이 하나라도 있으면 올리지 않는다. */
async function 파일읽기(파일들) {
  const { normalizeReport, summaryLineOf } = await 꼴검사모듈();
  const 줄 = [], 걸림 = [], 본것 = new Map();
  for (const 받은 of 파일들) {
    const 파일 = path.resolve(받은), 이름 = path.basename(파일);
    // 오류 문장은 이 도구가 쓴 것만 내보낸다. JSON.parse와 fs의 오류 글에는 리포트 원문 조각이나 절대 경로가 실릴 수 있다.
    let 글자;
    try { 글자 = fs.readFileSync(파일, 'utf8'); }
    catch (e) { 걸림.push(`${이름}: ${e.code === 'ENOENT' ? '파일이 없다' : e.code === 'EISDIR' ? '폴더다' : `파일을 읽지 못했다(${/^[A-Z0-9_]{1,24}$/.test(String(e.code)) ? e.code : '까닭 모름'})`}`); continue; }
    if (글자.charCodeAt(0) === 0xfeff) 글자 = 글자.slice(1);
    let 원본;
    try { 원본 = JSON.parse(글자); }
    catch { 걸림.push(`${이름}: JSON으로 읽지 못했다`); continue; }
    let 정리;
    try { 정리 = normalizeReport(원본); }
    // 꼴 검사의 오류 글은 서버 모듈이 지은 문장이고(어느 칸인지만 적힌다) 리포트의 값은 들어 있지 않다. 그 밖의 오류는 글을 옮기지 않는다.
    catch (e) { 걸림.push(`${이름}: ${e && e.status ? String(e.message).slice(0, 200) : '꼴 검사를 돌리지 못했다'}`); continue; }
    // 서버가 받는 몸통과 같은 글을 지어 두 상한을 모두 본다(작업실 연결이 JSON.stringify({report})를 그대로 보낸다).
    const 몸통 = JSON.stringify({ report: 원본 }), 바이트 = Buffer.byteLength(몸통);
    if (바이트 > 몸통한도.바이트) { 걸림.push(`${이름}: 보낼 몸통이 ${바이트}바이트라 서버 상한 ${몸통한도.바이트}바이트를 넘는다`); continue; }
    if (몸통.length > 몸통한도.글자) { 걸림.push(`${이름}: 보낼 몸통이 ${몸통.length}자라 서버 상한 ${몸통한도.글자}자를 넘는다(서버가 읽지 않는 summary 같은 칸을 빼면 줄어든다)`); continue; }
    if (본것.has(열쇠(정리))) { 걸림.push(`${이름}: ${본것.get(열쇠(정리))}와 종류와 회차(${열쇠(정리)})가 같다`); continue; }
    본것.set(열쇠(정리), 이름);
    줄.push({ 파일, 이름, report: 원본, kind: 정리.kind, runId: 정리.runId, title: 정리.title, 한줄: summaryLineOf(정리), 바이트 });
  }
  return { 줄, 걸림 };
}

// 직접: 이 도구가 스스로 로그인했는가. 그럴 때만 끝에 로그아웃한다(받아 쓴 세션은 준 쪽의 것이다). 옵션.연결과 옵션.직접은 시험용이다.
async function 연결하기(옵션) {
  const connect = 옵션.연결 || require('./작업실예약.js').connect;
  try { return { ws: await connect({}), 직접: 옵션.직접 ?? (!process.env.SYNK_WORKSPACE_SESSION && !옵션.연결) }; }
  catch (e) { if (e.code === 'NO_CREDENTIAL') throw 문제(3, e.message); throw e; }
}

/** 쓰기 잠금을 잡는다. 돌려주는 함수를 부르면 푼다. 이미 잡혀 있으면 끝 코드 4로 던진다(기다리지 않는다). */
function 쓰기잠그기(이름 = 쓰기잠금이름) {
  const 주소 = process.platform === 'win32' ? `\\\\.\\pipe\\${이름}` : `${String.fromCharCode(0)}${이름}`;
  return new Promise((resolve, reject) => {
    const 문 = net.createServer((손님) => 손님.destroy());
    문.once('error', (e) => reject(e.code === 'EADDRINUSE' || e.code === 'EACCES'
      ? 문제(4, '이 PC에서 다른 마케팅 리포트 올리기나 내리기가 도는 중이다. 끝난 뒤 다시 한다.')
      : 문제(1, `쓰기 잠금을 잡지 못했다(${/^[A-Z0-9_]{1,24}$/.test(String(e.code)) ? e.code : '까닭 모름'}).`)));
    문.listen(주소, () => resolve(() => new Promise((끝) => 문.close(() => 끝()))));
  });
}

/** 연결을 열어 일을 하고, 직접 로그인했으면 로그아웃까지 한다. 오류는 결과에 적어 돌려준다. 쓰기가 참이면 처음부터 끝까지 쓰기 잠금을 쥔다. */
async function 연결해서(결과, 옵션, 일, 쓰기 = false) {
  // 프로젝트 id는 주소에 그대로 들어간다. main을 거치지 않고 불러 쓸 때도 꼴이 틀리면 로그인하지 않는다.
  if (결과.명령 !== '프로젝트' && !프로젝트꼴.test(String(결과.프로젝트 || ''))) { 결과.끝코드 = 2; 결과.오류 = '프로젝트 id는 36자(16진수와 줄표)다.'; return 결과; }
  let ws = null, 직접 = false, 풀기 = null;
  try {
    // 잠금은 서버 목록을 읽기 전에 잡는다. 목록을 읽은 뒤에 잡으면 두 실행이 같은 빈 목록을 본다.
    if (쓰기) 풀기 = await 쓰기잠그기(옵션.잠금이름);
    ({ ws, 직접 } = await 연결하기(옵션));
    await 일(ws);
  } catch (e) {
    결과.끝코드 = e.끝코드 || 1; 결과.오류 = String(e.message || e).slice(0, 300);
  } finally {
    if (ws && 직접) { try { await ws.post('/api/logout', {}); } catch { 결과.로그아웃 = '실패'; if (!결과.끝코드) 결과.끝코드 = 1; } }
    if (풀기) await 풀기();
  }
  return 결과;
}

const 서버목록 = (ws, 프로젝트) => ws.get(`/api/client-projects/${프로젝트}/marketing`);
// 스위치는 관리자만 읽는다. 읽지 못하면 「모름」으로 둔다(올리기를 막지 않는다).
async function 스위치읽기(ws) {
  try { const 답 = await ws.get('/api/settings/pulse-features'); return typeof 답.marketing === 'boolean' ? (답.marketing ? '켜짐' : '꺼짐') : '모름'; }
  catch { return '모름'; }
}
function 앞상태(결과, 앞) {
  결과.이름 = 앞.project || null; 결과.고객에게보임 = !!앞.visible; 결과.앞건수 = (앞.reports || []).length;
  if (앞.broken) throw 문제(1, '서버가 이 프로젝트의 저장된 리포트 목록을 읽지 못한다. 올리기와 내리기가 막혀 있으니 서버 자료부터 본다.');
}

async function 프로젝트목록(옵션 = {}) {
  const 결과 = { 명령: '프로젝트', 프로젝트: [], 끝코드: 0 };
  return 연결해서(결과, 옵션, async (ws) => {
    const 답 = await ws.get('/api/client-projects');
    결과.프로젝트 = (답.projects || []).map((p) => ({ id: p.id, 이름: p.title || '', 고객: p.customerName || '', 단계: p.stage || '' }));
  });
}

async function 목록(프로젝트, 옵션 = {}) {
  const 결과 = { 명령: '목록', 프로젝트, 리포트: [], 끝코드: 0 };
  return 연결해서(결과, 옵션, async (ws) => {
    const 앞 = await 서버목록(ws, 프로젝트);
    결과.리포트 = 앞.reports || [];
    결과.스위치 = await 스위치읽기(ws);
    앞상태(결과, 앞);
  });
}

async function 올리기(프로젝트, 파일들, 옵션 = {}) {
  const 결과 = { 명령: '올리기', 프로젝트, 실행: !!옵션.실행, 줄: [], 걸림: [], 겹침: [], 올림: [], 끝코드: 0 };
  const 읽음 = await 파일읽기(파일들);
  결과.줄 = 읽음.줄.map(({ report, 파일, ...남은 }) => 남은);
  결과.걸림 = 읽음.걸림;
  if (읽음.걸림.length) { 결과.끝코드 = 1; return 결과; }
  return 연결해서(결과, 옵션, async (ws) => {
    const 앞 = await 서버목록(ws, 프로젝트);
    결과.스위치 = await 스위치읽기(ws);
    앞상태(결과, 앞);
    const 있는 = new Set(앞.reports.map(열쇠));
    결과.겹침 = 읽음.줄.filter((r) => 있는.has(열쇠(r))).map(열쇠);
    if (결과.겹침.length && !옵션.덮어쓰기) throw 문제(1, `이미 올라가 있는 회차다: ${결과.겹침.join(', ')}. 고쳐 올리는 것이면 --덮어쓰기를 붙인다.`);
    if (!옵션.실행) return;
    for (const r of 읽음.줄) {
      let 답;
      try { 답 = await ws.post(`/api/client-projects/${프로젝트}/marketing/report`, { report: r.report }); }
      catch (e) { throw 문제(1, `${r.이름}에서 멈췄다(앞의 ${결과.올림.length}건은 올라갔다): ${String(e.message || e).slice(0, 200)}`); }
      결과.올림.push({ kind: r.kind, runId: r.runId, 덮음: !!답.replaced });
      결과.고객에게보임 = !!답.visible;
      // 쓰기 잠금은 이 PC 안의 실행만 줄 세운다. 목록에 없던 회차를 서버가 「덮었다」고 답하면 그 사이 이 PC 밖에서 같은 회차가 올라온 것이다.
      // 이미 덮인 뒤라 되돌릴 수 없으므로 더 올리지 않고 일어난 일을 그대로 알린다.
      if (답.replaced && !있는.has(열쇠(r))) throw 문제(1, `${r.이름}: 목록을 읽을 때는 없던 회차(${열쇠(r)})가 그 사이 다른 곳에서 올라와 있었고, 이번 올리기가 그것을 덮었다. 앞서 올라온 내용은 서버에 남아 있지 않다. 여기까지 ${결과.올림.length}건이 올라갔고 나머지는 올리지 않았다.`);
    }
    const 뒤 = await 서버목록(ws, 프로젝트);
    결과.뒤건수 = (뒤.reports || []).length; 결과.고객에게보임 = !!뒤.visible;
  }, !!옵션.실행);
}

async function 내리기(프로젝트, kind, runId, 옵션 = {}) {
  const 결과 = { 명령: '내리기', 프로젝트, kind, runId, 실행: !!옵션.실행, 내림: false, 끝코드: 0 };
  return 연결해서(결과, 옵션, async (ws) => {
    const 앞 = await 서버목록(ws, 프로젝트);
    앞상태(결과, 앞);
    const 찾음 = 앞.reports.find((r) => r.kind === kind && r.runId === runId);
    if (!찾음) throw 문제(1, `그 리포트가 올라가 있지 않다(${kind}:${runId}).`);
    결과.대상 = { title: 찾음.title, summaryLine: 찾음.summaryLine, uploadedAt: 찾음.uploadedAt };
    결과.마지막 = 앞.reports.length === 1;
    if (!옵션.실행) return;
    const 답 = await ws.post(`/api/client-projects/${프로젝트}/marketing/report/remove`, { kind, runId });
    결과.내림 = true; 결과.고객에게보임 = !!답.visible; 결과.뒤건수 = 앞.reports.length - 1;
  }, !!옵션.실행);
}

// ── 사람에게 보이는 글 ──
const 프로젝트글 = (결과) => (결과.이름 ? `프로젝트 「${결과.이름.name}」(고객 ${결과.이름.client || '이름 없음'})` : `프로젝트 ${결과.프로젝트}`);
function 보임글(결과) {
  if (결과.고객에게보임) return '지금 그 고객의 방에 「마케팅 성과」 칸이 보인다.';
  if (결과.스위치 === '꺼짐') return '스위치 marketing이 꺼져 있어 고객에게는 보이지 않는다.';
  if (결과.스위치 === '켜짐') return '스위치 marketing이 켜져 있다. 리포트가 한 건이라도 올라가면 바로 그 고객에게 보인다.';
  return '지금은 고객에게 보이지 않는다. 스위치 marketing이 켜져 있으면 올리는 즉시 보인다(스위치 상태는 관리자만 읽을 수 있어 여기서는 모른다).';
}
const 리포트줄 = (r) => `  ${종류이름[r.kind] || r.kind} · ${r.runId} · ${r.title} — ${r.한줄 !== undefined ? r.한줄 : r.summaryLine}`;

function 글(결과) {
  const 줄 = [];
  if (결과.명령 === '프로젝트') {
    if (!결과.오류) 줄.push(결과.프로젝트.length ? 결과.프로젝트.map((p) => `${p.id} · ${p.이름} · 고객 ${p.고객 || '이름 없음'}${p.단계 ? ` · ${p.단계}` : ''}`).join('\n') : '볼 수 있는 고객 프로젝트가 없다.');
  } else if (결과.명령 === '목록') {
    if (!결과.오류) {
      줄.push(`${프로젝트글(결과)}에 올라가 있는 리포트는 ${결과.리포트.length}건이다. ${보임글(결과)}`);
      for (const r of 결과.리포트) 줄.push(`${리포트줄(r)} (올린 때 ${r.uploadedAt})`);
    }
  } else if (결과.명령 === '올리기') {
    if (결과.걸림.length) { 줄.push(`꼴 검사에서 ${결과.걸림.length}건이 걸려 아무것도 올리지 않았다(로그인도 하지 않았다).`); for (const g of 결과.걸림) 줄.push(`  ${g}`); }
    else if (결과.올림.length && !결과.오류) {
      줄.push(`${프로젝트글(결과)}에 ${결과.올림.length}건을 올렸다(새로 ${결과.올림.filter((r) => !r.덮음).length}건, 덮어쓴 것 ${결과.올림.filter((r) => r.덮음).length}건). 이제 ${결과.뒤건수}건이 있다. ${보임글(결과)}`);
      for (const r of 결과.줄) 줄.push(리포트줄(r));
    } else if (!결과.오류) {
      줄.push(`미리 보기다. 올리지 않았다. ${프로젝트글(결과)}에 지금 ${결과.앞건수}건이 있고, 이번에 올릴 것은 ${결과.줄.length}건이다${결과.겹침.length ? `(덮어쓸 회차 ${결과.겹침.join(', ')})` : ''}. ${보임글(결과)}`);
      for (const r of 결과.줄) 줄.push(리포트줄(r));
      줄.push('올리려면 같은 명령에 --실행을 붙인다.');
    } else if (결과.줄.length) { for (const r of 결과.줄) 줄.push(리포트줄(r)); }
  } else if (결과.명령 === '내리기') {
    if (결과.내림 && !결과.오류) 줄.push(`${프로젝트글(결과)}에서 ${종류이름[결과.kind] || 결과.kind} ${결과.runId}를 내렸다. 이제 ${결과.뒤건수}건이 있다. ${결과.고객에게보임 ? '칸은 그대로 보인다.' : '고객에게는 칸이 보이지 않는다.'}`);
    else if (!결과.오류) 줄.push(`미리 보기다. 내리지 않았다. ${프로젝트글(결과)}에서 내릴 것은 「${결과.대상.title}」(${결과.대상.summaryLine})이다.${결과.마지막 ? ' 이 프로젝트의 마지막 리포트라서 내리면 고객 방에서 칸이 사라진다.' : ''} 내리려면 --실행을 붙인다.`);
  }
  if (결과.오류) 줄.push(`${결과.명령} 실패: ${결과.오류}`);
  if (결과.로그아웃) 줄.push('작업실 로그아웃에 실패했다.');
  return 줄.join('\n');
}

const 쓰는법 = '쓰는 법: 프로젝트 | 목록 <프로젝트id> | 올리기 <프로젝트id> <리포트.json>… [--실행] [--덮어쓰기] | 내리기 <프로젝트id> <종류> <회차> [--실행]   (덧붙임: --json)';

async function main(argv = process.argv.slice(2), 옵션 = {}) {
  const 깃발 = new Set(['--실행', '--덮어쓰기', '--json']);
  const 값 = {}, 남은 = [];
  for (const a of argv) {
    if (깃발.has(a)) 값[a] = true;
    else if (a.startsWith('--')) { console.error(`모르는 인자: ${a}\n${쓰는법}`); return 2; }
    else 남은.push(a);
  }
  const [명령, 프로젝트, ...인자] = 남은;
  const 틀림 = (까닭) => { console.error(`${까닭}\n${쓰는법}`); return 2; };
  if (!['프로젝트', '목록', '올리기', '내리기'].includes(명령)) return 틀림(명령 ? `모르는 명령: ${명령}` : '명령이 없다.');
  if (명령 !== '프로젝트' && !프로젝트꼴.test(프로젝트 || '')) return 틀림('프로젝트 id는 36자(16진수와 줄표)다. 「프로젝트」 명령으로 찾는다.');
  const 넘길 = { ...옵션, 실행: !!값['--실행'], 덮어쓰기: !!값['--덮어쓰기'] };
  let 결과;
  try {
    if (명령 === '프로젝트') { if (프로젝트 !== undefined) return 틀림('「프로젝트」 명령에는 다른 인자를 붙이지 않는다.'); 결과 = await 프로젝트목록(넘길); }
    else if (명령 === '목록') { if (인자.length) return 틀림('「목록」에는 프로젝트 id 하나만 준다.'); 결과 = await 목록(프로젝트, 넘길); }
    else if (명령 === '올리기') { if (!인자.length) return 틀림('올릴 리포트 파일을 하나 이상 준다.'); 결과 = await 올리기(프로젝트, 인자, 넘길); }
    else {
      if (인자.length !== 2 || !Object.hasOwn(종류이름, 인자[0]) || !회차꼴.test(인자[1])) return 틀림(`「내리기」에는 종류(${Object.keys(종류이름).join(' · ')})와 회차를 준다.`);
      결과 = await 내리기(프로젝트, 인자[0], 인자[1], 넘길);
    }
  } catch (e) {
    console.error(`${명령} 실패: ${String(e.message || e).slice(0, 300)}`);
    return e.끝코드 || 1;
  }
  const 낼곳 = 결과.끝코드 ? console.error : console.log;
  낼곳(값['--json'] ? JSON.stringify(결과) : 글(결과));
  return 결과.끝코드;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { 파일읽기, 프로젝트목록, 목록, 올리기, 내리기, 쓰기잠그기, 글, main, 몸통한도 };
