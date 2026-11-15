#!/usr/bin/env node
'use strict';
/**
 * 팁 장부 동기(2026-11-16) — Workspace 「공유한 게시물」(workspace.synk.im/?tab=tips)과 팁 장부(구글 시트 「팁」 탭)를 잇는 AI 없는 도구.
 * 계약: docs/마케팅/온라인마케팅지도/engagement/company/TIP-SHARES.md
 *
 *   node tools/팁장부동기.js                       미리 보기 — 장부와 카드로 줄을 만들어 진행별 수만 보인다(로그인 · 쓰기 없음)
 *   node tools/팁장부동기.js --실행                 한 회차: 요청 가져가기 → 장부 상태 쓰기 → 줄 올리기 → 로그아웃
 *   node tools/팁장부동기.js --실행 --카드뿌리 <작업본>   그 작업본의 카드로 줄을 만든다(시안을 막 만든 회차 작업본). 거기서 본 시안을 2시간 기억한다
 *   node tools/팁장부동기.js 적용중 [--json]         장부에서 상태가 「적용 중」인 줄 전부(synk-card-apply 「고르기」용, 로그인 없음)
 *   공통: --json(결과를 JSON 한 줄로) · --조용히(정상이면 한 줄만)
 *
 * 장부 주소와 토큰은 %LOCALAPPDATA%/hermes/synk-tip-ledger.json에서, 상태 칸을 쓰는 상태열쇠는 Windows 자격 보관소 SYNK/SNS/tip-ledger-status에서 읽는다.
 * 어느 값도 출력하거나 파일에 쓰지 않는다(저장소는 공개다). 작업실은 tools/작업실예약.js connect(작업실 자동화 계정)로 들어가고 끝에 늘 로그아웃한다.
 * 상태 칸은 Workspace에서 누른 요청만 「새로」 → 「적용 중」 · 「버림」으로 쓴다. 장부의 다른 칸과 카드는 바꾸지 않는다.
 * 끝 코드: 0 정상 · 1 실패 · 2 인자 오류 · 3 작업실 자격 없음 · 4 다른 동기가 도는 중 · 5 상태열쇠 없음(줄은 올렸고 요청은 남김)
 * Windows 예약 「SYNK tip ledger sync」(5분마다, tools/팁장부동기예약/)가 운영 사본에서 --실행 --조용히로 부른다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 설정파일 = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'hermes', 'synk-tip-ledger.json');
const 상태자리 = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '팁장부동기');
const 상태열쇠이름 = 'SYNK/SNS/tip-ledger-status';
const 기억시간 = 2 * 3600 * 1000;
const 잠금낡음 = 10 * 60 * 1000;
// 회사 서버 tip-shares.mjs의 TIP_SHARE_LIMITS와 같은 값. 서버가 넘으면 거절하므로 여기서 자른다.
const 한도 = Object.freeze({ 줄: 300, 바이트: 900000, 요약: 400, 사유: 800, 대상: 120, 진행글: 200, 시안글: 300, 주소: 1000, 게시물ID: 80 });
const 종류값 = ['디자인 참고', 'AI 작업 팁', '도구·서비스', '기타'];
const 상태값 = ['새로', '적용 중', '적용함', '버림'];
const 제어 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const 문제 = (code, message, 끝코드 = 1) => Object.assign(new Error(message), { code, 끝코드 });

// ── 글 다듬기 ──
function 자르기(값, 최대, { 한줄 = false } = {}) {
  let 글 = String(값 ?? '').replace(/\r\n?/g, '\n').replace(제어, '').trim();
  if (한줄) 글 = 글.replace(/\s*\n\s*/g, ' ');
  return 글.length > 최대 ? 글.slice(0, 최대 - 1).trimEnd() + '…' : 글;
}
/** http · https만. 추적 꼬리(utm_* · igsh · igshid · fbclid)는 뗀다. 아니면 빈 글. */
function 주소(값) {
  const 글 = String(값 ?? '').trim();
  if (!글) return '';
  let u; try { u = new URL(글); } catch { return ''; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|igsh|igshid$|fbclid$)/i.test(k)) u.searchParams.delete(k);
  const 끝 = u.href;
  return 끝.length <= 한도.주소 ? 끝 : '';
}
function 공유일(값) {
  const 글 = String(값 ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}(?: \d{1,2}:\d{2})?$/.test(글) ? 글 : '';
}

// ── 판단과 진행 ──
const 언제판단 = { 지금: '시안', '그 작업 때': '기록', '안 맞음': '기각' };
function 머리판단(적용안) { const m = /^\s*\[(시안|기록|기각)\]/.exec(String(적용안 || '')); return m ? m[1] : ''; }
function 카드링크(카드) {
  if (!카드) return '';
  if (String(카드.시안 || '').trim()) return String(카드.시안).trim();
  // 「시안 대기 — <링크>」(11-16부터) 또는 옛 「시안 대기 — <자리 설명>」(11-12 판). 링크가 있으면 링크, 없으면 설명 전체.
  const m = /^시안 대기\s*[—–-]\s*(.+)$/.exec(String(카드.상태 || '').trim());
  if (!m) return '';
  const 링크 = /(https?:\/\/[^\s)」>]+)/.exec(m[1]);
  return 링크 ? 링크[1] : m[1].trim();
}

/**
 * 장부 줄 하나(웹앱 list의 칸) + 그 줄의 카드 머리(없으면 null) → 회사 서버 줄.
 * 카드가 이긴다: 카드의 기각 · 판단 > 적용안 머리 > 카드 언제 > 장부 언제. 진행은 장부의 버림 · 적용함 · 적용 중이 먼저다.
 */
function 줄만들기(장부줄, 카드) {
  const 카드상태 = String(카드?.상태 || '').trim();
  const 판단됨 = Boolean(String(장부줄['Claude 날짜'] || '').trim()) || Boolean(카드);
  let 판단 = '';
  if (판단됨) {
    if (카드 && /^기각/.test(카드상태)) 판단 = '기각';
    else if (카드 && ['시안', '기록'].includes(String(카드.판단 || '').trim())) 판단 = String(카드.판단).trim();
    else 판단 = 머리판단(장부줄.적용안) || 언제판단[String(카드?.언제 || '').trim()] || 언제판단[String(장부줄.언제 || '').trim()] || '';
  }
  const 링크 = 판단 === '시안' ? 카드링크(카드) : '';
  const 시안주소 = 주소(링크);
  const draft = !링크 ? null : 시안주소 ? { url: 시안주소 } : { text: 자르기(링크, 한도.시안글, { 한줄: true }) };
  let 사유 = 장부줄['가져올 것'];
  if (판단 === '기각') {
    const 카드사유 = /^기각/.test(카드상태) ? 카드상태.replace(/^기각\s*[—–-]?\s*/, '') : '';
    사유 = 카드사유 || String(장부줄.적용안 || '').replace(/^\s*\[기각\]\s*/, '').replace(/^사유\s*:\s*/, '');
  }
  const 원상태 = String(장부줄.상태 || '').trim();
  const 장부상태 = 상태값.includes(원상태) ? 원상태 : '새로';
  let stage, stageNote = '';
  // 사람이 상태 칸에 네 값 밖의 글을 적었으면 고를 수 없게 보류로 보이고 그 글을 그대로 알린다. 빈 칸은 새 줄이다.
  if (원상태 && !상태값.includes(원상태)) { stage = '보류'; stageNote = 자르기(`장부 상태 칸: ${원상태}`, 한도.진행글, { 한줄: true }); }
  else if (장부상태 === '버림') stage = '버림';
  else if (장부상태 === '적용함' || /^적용함/.test(카드상태)) stage = '적용함';
  else if (장부상태 === '적용 중' || /^적용 중/.test(카드상태)) stage = '적용 중';
  else if (/^보류/.test(카드상태)) { stage = '보류'; stageNote = 자르기(카드상태.replace(/^보류\s*[—–-]?\s*/, ''), 한도.진행글, { 한줄: true }); }
  else if (!판단) stage = '판단 전';
  else if (판단 !== '시안') stage = 판단;
  else if (draft) stage = '시안 나옴';
  else if (/^시안 만드는 중/.test(카드상태)) stage = '시안 만드는 중';
  else stage = '시안 차례';
  const 게시물ID = String(장부줄.게시물ID || '').trim();
  return {
    row: Number(장부줄.row),
    postId: /^[A-Za-z0-9_-]{0,80}$/.test(게시물ID) ? 게시물ID : '',
    sharedAt: 공유일(장부줄.날짜),
    url: 주소(장부줄.링크),
    summary: 자르기(장부줄.요약, 한도.요약),
    kind: 종류값.includes(String(장부줄.종류 || '').trim()) ? String(장부줄.종류).trim() : (String(장부줄.종류 || '').trim() ? '기타' : ''),
    target: 자르기(장부줄.어디에, 한도.대상, { 한줄: true }),
    verdict: 판단,
    note: 자르기(사유, 한도.사유),
    status: 장부상태,
    stage,
    stageNote,
    draft,
  };
}

/** 카드 목록(파일 이름 → 머리)에서 장부 카드 칸(docs/참고카드/카드/x.md)의 카드를 찾는다. */
function 카드찾기(카드표, 카드칸) {
  const 이름 = path.basename(String(카드칸 || '').trim().replace(/\\/g, '/'));
  return 이름 && 카드표.get(이름) || null;
}

/** 장부 줄들 + 카드표 → 올릴 줄 묶음(새것부터, 300줄 · 900KB 안). */
function 묶음만들기(장부줄들, 카드표) {
  const 줄들 = 장부줄들
    .filter((r) => Number.isSafeInteger(Number(r.row)) && Number(r.row) >= 2)
    .map((r) => 줄만들기(r, 카드찾기(카드표, r.카드)))
    .sort((a, b) => b.row - a.row)
    .slice(0, 한도.줄);
  while (줄들.length && Buffer.byteLength(JSON.stringify(줄들)) > 한도.바이트) 줄들.pop();
  return 줄들;
}

// ── 카드 ──
function 카드읽기(뿌리) {
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '참고카드_목록.js'), '--json'], { cwd: 뿌리, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw 문제('CARDS', `카드 목록을 읽지 못했다(${뿌리}): ${String(r.stderr || '').trim().slice(-200)}`);
  const 목록 = JSON.parse(r.stdout);
  return new Map(목록.filter((c) => !c.오류).map((c) => [c.파일, c]));
}

/** 카드뿌리에서 본 시안을 기억하고(2시간), 기억과 지금 카드를 합친다. 운영 사본이 아직 그 커밋을 못 받았을 때 단추가 사라지지 않게. */
function 기억합치기(카드표, 뿌리카드표, 기억, 지금) {
  const 남김 = {};
  for (const [파일, 값] of Object.entries(기억 || {})) if (지금 - Date.parse(값.at) < 기억시간) 남김[파일] = 값;
  if (뿌리카드표) for (const [파일, 카드] of 뿌리카드표) if (카드링크(카드)) 남김[파일] = { at: new Date(지금).toISOString(), 판단: 카드.판단 || '', 상태: 카드.상태 || '', 시안: 카드링크(카드) };
  const 합친 = new Map(카드표);
  // 뿌리 작업본은 갈라진 뒤라 다른 카드의 상태가 운영 사본보다 낡았을 수 있다. 운영 사본에 없는 새 카드(막 만든 판단)만 바로 쓴다.
  if (뿌리카드표) for (const [파일, 카드] of 뿌리카드표) if (!카드표.has(파일)) 합친.set(파일, 카드);
  for (const [파일, 값] of Object.entries(남김)) {
    const 내카드 = 카드표.get(파일);
    // 이 작업본(운영 사본)이 따라왔거나 그 뒤 카드가 닫혔으면(적용 · 기각 · 보류) 기억은 할 일을 다 했다.
    if (내카드 && (카드링크(내카드) || /^(적용|기각|보류)/.test(String(내카드.상태 || '')))) { delete 남김[파일]; continue; }
    const 바탕 = 내카드 || 합친.get(파일) || { 파일 };
    합친.set(파일, { ...바탕, 판단: 값.판단 || 바탕.판단 || '시안', 상태: 값.상태, 시안: 값.시안 });
  }
  return { 합친, 기억: 남김 };
}

// ── 장부 웹앱 ──
function 장부설정() {
  let cfg; try { cfg = JSON.parse(fs.readFileSync(설정파일, 'utf8')); } catch { throw 문제('LEDGER_CONFIG', '장부 설정 파일을 읽지 못했다'); }
  if (!cfg.url || !cfg.token) throw 문제('LEDGER_CONFIG', '장부 설정에 주소나 토큰이 없다');
  return cfg;
}
async function 장부부르기(cfg, 몸, { fetchImpl = fetch } = {}) {
  const r = await fetchImpl(cfg.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...몸, token: cfg.token }), redirect: 'follow', signal: AbortSignal.timeout(60000) });
  const 글 = await r.text();
  let j; try { j = JSON.parse(글); } catch { throw 문제('LEDGER_RESPONSE', `장부가 JSON 대신 다른 응답을 줬다(HTTP ${r.status})`); }
  return j;
}
async function 장부목록(cfg, 옵션) {
  const j = await 장부부르기(cfg, { action: 'list' }, 옵션);
  if (!j.ok || !Array.isArray(j.rows)) throw 문제('LEDGER_LIST', `장부 목록을 읽지 못했다: ${j.error || '모양이 다름'}`);
  return j.rows;
}
function 상태열쇠읽기() {
  if (process.platform !== 'win32') return null;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'sns-자격.ps1'), 'get', 상태열쇠이름], { encoding: 'utf8', windowsHide: true });
  if (r.status === 3) return null;
  if (r.status !== 0) throw 문제('STATUS_KEY', 'Windows 자격 보관소에서 상태열쇠를 읽지 못했다');
  try { return JSON.parse(r.stdout).token || null; } catch { return null; }
}

/** 요청 하나를 장부에 쓴다. 이미 그 상태면 옮김, 다른 상태면 어긋남. 장부가 쓰지 못했으면 { 남김: 까닭 }(결과를 보내지 않아 다음 회차가 다시 받는다). */
async function 요청쓰기(cfg, 열쇠, 요청, 옵션) {
  // 게시물ID가 빈 줄은 쓰지 않는다. 빈 ID끼리는 줄이 밀려도 같아 보여 다른 줄을 바꿀 수 있다(서버도 이런 줄은 고르지 못하게 한다).
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(요청.postId || ''))) return { id: 요청.id, outcome: 'conflict' };
  const j = await 장부부르기(cfg, { action: 'status', statusKey: 열쇠, row: 요청.row, 게시물ID: 요청.postId, 상태: 요청.to, 전상태: 요청.from }, 옵션);
  if (j.ok) return { id: 요청.id, outcome: 'applied', current: 요청.to };
  if (j.error === '상태가 바뀜' && typeof j.현재 === 'string') {
    const 답 = { id: 요청.id, outcome: j.현재 === 요청.to ? 'applied' : 'conflict' };
    if (상태값.includes(j.현재)) 답.current = j.현재;
    return 답;
  }
  if (['row와 게시물ID가 맞지 않음', 'row가 범위 밖', '게시물ID가 빈 줄은 바꾸지 않음'].includes(j.error)) return { id: 요청.id, outcome: 'conflict' };
  // 결과를 보내지 않아 다음 회차가 다시 받는다. 까닭은 기록과 끝 코드로 남긴다.
  return { 남김: String(j.error || '알 수 없는 응답').slice(0, 80) };
}

// ── 잠금 · 기억 · 기록 ──
function 살아있나(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function 잠그기(자리 = 상태자리) {
  fs.mkdirSync(자리, { recursive: true });
  const 잠금 = path.join(자리, '.잠금'), 주인 = path.join(잠금, 'owner.json');
  try { fs.mkdirSync(잠금); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let 앞 = null; try { 앞 = JSON.parse(fs.readFileSync(주인, 'utf8')); } catch {}
    let 나이 = Infinity; try { 나이 = Date.now() - fs.statSync(잠금).mtimeMs; } catch {}
    // 주인 파일이 아직 없는 잠금은 다른 실행이 막 잡은 것일 수 있어 1분 안이면 넘겨받지 않는다.
    const 낡음 = 앞 ? Date.now() - Date.parse(앞.at) > 잠금낡음 || !살아있나(앞.pid) : 나이 > 60000;
    if (!낡음) throw 문제('LOCKED', '다른 팁 장부 동기가 도는 중이다', 4);
    fs.rmSync(잠금, { recursive: true, force: true }); fs.mkdirSync(잠금);
  }
  const 표 = `${process.pid}-${Date.now()}`;
  fs.writeFileSync(주인, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), 표 }));
  return () => { try { if (JSON.parse(fs.readFileSync(주인, 'utf8')).표 === 표) fs.rmSync(잠금, { recursive: true, force: true }); } catch {} };
}
function 기억읽기(자리 = 상태자리) { try { return JSON.parse(fs.readFileSync(path.join(자리, '시안기억.json'), 'utf8')); } catch { return {}; } }
function 기억쓰기(값, 자리 = 상태자리) { fs.mkdirSync(자리, { recursive: true }); fs.writeFileSync(path.join(자리, '시안기억.json'), JSON.stringify(값, null, 1)); }
function 기록남기기(줄, 자리 = 상태자리) {
  try {
    fs.mkdirSync(자리, { recursive: true });
    const 파일 = path.join(자리, '기록.jsonl');
    try { if (fs.statSync(파일).size > 1024 * 1024) { const 글 = fs.readFileSync(파일, 'utf8').split('\n'); fs.writeFileSync(파일, 글.slice(Math.floor(글.length / 2)).join('\n')); } } catch {}
    fs.appendFileSync(파일, JSON.stringify(줄) + '\n');
  } catch {}
}

function 진행수(줄들) { const 수 = {}; for (const r of 줄들) 수[r.stage] = (수[r.stage] || 0) + 1; return 수; }

/**
 * 한 회차. 옵션: 카드뿌리(시안을 막 만든 작업본), 사유(기록용), 연결(시험용 connect), fetchImpl, 열쇠(시험용), 자리(상태 폴더).
 * 돌려주는 값: { 줄, 시안나옴, 요청, 옮김, 어긋남, 남김, 저장, 끝코드 }.
 */
async function 한번(옵션 = {}) {
  const 자리 = 옵션.자리 || 상태자리;
  let 풀기;
  try { 풀기 = 잠그기(자리); } catch (e) { return { 사유: 옵션.사유 || '예약', 끝코드: e.끝코드 || 1, 오류: String(e.message || e).slice(0, 300) }; }
  const 시작 = Date.now();
  let ws = null, 직접 = false;
  const 결과 = { 사유: 옵션.사유 || '예약', 줄: 0, 시안나옴: 0, 요청: 0, 옮김: 0, 어긋남: 0, 남김: 0, 저장: false, 끝코드: 0 };
  try {
    const cfg = 옵션.장부 || 장부설정();
    const 뿌리카드 = 옵션.카드뿌리 ? 카드읽기(path.resolve(옵션.카드뿌리)) : null;
    const 내카드 = 옵션.카드표 || 카드읽기(루트);
    const { 합친, 기억 } = 기억합치기(내카드, 뿌리카드, 기억읽기(자리), Date.now());
    기억쓰기(기억, 자리);
    let 장부줄들 = await 장부목록(cfg, 옵션);
    let 읽은때 = new Date().toISOString();

    const connect = 옵션.연결 || require('./작업실예약.js').connect;
    try { ws = await connect({}); 직접 = !process.env.SYNK_WORKSPACE_SESSION && !옵션.연결; }
    catch (e) { if (e.code === 'NO_CREDENTIAL') throw 문제('NO_CREDENTIAL', e.message, 3); throw e; }

    const { requests } = await ws.post('/api/tip-shares/sync', { version: 1 });
    결과.요청 = requests.length;
    const results = [];
    if (requests.length) {
      const 열쇠 = 옵션.열쇠 !== undefined ? 옵션.열쇠 : 상태열쇠읽기();
      if (!열쇠) { 결과.남김 = requests.length; 결과.끝코드 = 5; }
      else {
        for (const 요청 of requests) {
          const 답 = await 요청쓰기(cfg, 열쇠, 요청, 옵션);
          if (답.남김) { 결과.남김++; 결과.장부오류 = 답.남김; continue; }
          results.push(답);
          if (답.outcome === 'applied') 결과.옮김++; else 결과.어긋남++;
        }
        if (results.length) { 장부줄들 = await 장부목록(cfg, 옵션); 읽은때 = new Date().toISOString(); }
        // 열쇠가 틀렸으면 5(열쇠 문제), 그 밖에 장부가 쓰지 못했으면 1. 줄은 그대로 올린다.
        if (결과.장부오류) 결과.끝코드 = 결과.장부오류 === 'unauthorized status' ? 5 : 1;
      }
    }
    const 줄들 = 묶음만들기(장부줄들, 합친);
    결과.줄 = 줄들.length;
    결과.시안나옴 = 줄들.filter((r) => r.stage === '시안 나옴' && r.status === '새로').length;
    결과.진행 = 진행수(줄들);
    const 답 = await ws.post('/api/tip-shares/snapshot', { version: 1, generatedAt: 읽은때, rows: 줄들, results });
    결과.저장 = 답.stored; 결과.바뀜 = 답.changed; 결과.정리 = 답.settled; 결과.열린요청 = 답.open;
    return 결과;
  } catch (e) {
    결과.끝코드 = e.끝코드 || 1; 결과.오류 = String(e.message || e).slice(0, 300);
    return 결과;
  } finally {
    if (ws && 직접) { try { await ws.post('/api/logout', {}); } catch { 결과.로그아웃 = '실패'; if (!결과.끝코드) 결과.끝코드 = 1; } }
    결과.걸린초 = Math.round((Date.now() - 시작) / 100) / 10;
    풀기();
    기록남기기({ at: new Date().toISOString(), ...결과, 진행: undefined }, 자리);
  }
}

async function 적용중목록(옵션 = {}) {
  const 줄들 = await 장부목록(옵션.장부 || 장부설정(), 옵션);
  return 줄들.filter((r) => String(r.상태 || '').trim() === '적용 중').map((r) => ({ row: r.row, 게시물ID: r.게시물ID, 카드: r.카드, 요약: 자르기(r.요약, 120, { 한줄: true }) }));
}

async function main(argv = process.argv.slice(2)) {
  const 알아 = new Set(['--실행', '--json', '--조용히', '--카드뿌리', '적용중']);
  const 값 = {}; const 남은 = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--카드뿌리') { 값.카드뿌리 = argv[++i]; if (!값.카드뿌리) { console.error('--카드뿌리 뒤에 작업본 폴더를 주세요'); return 2; } continue; }
    if (!알아.has(a)) 남은.push(a); else 값[a] = true;
  }
  if (남은.length) { console.error(`모르는 인자: ${남은.join(' ')} (아는 것: --실행 --카드뿌리 <작업본> --json --조용히 적용중)`); return 2; }
  const 출력 = (j, 글) => console.log(값['--json'] ? JSON.stringify(j) : 글);
  try {
    if (값.적용중) {
      const 줄 = await 적용중목록();
      출력(줄, 줄.length ? 줄.map((r) => `${r.row}행 ${r.게시물ID} · ${r.카드 || '카드 없음'} · ${r.요약}`).join('\n') : '「적용 중」인 줄 없음');
      return 0;
    }
    if (!값['--실행']) {
      const cfg = 장부설정();
      const 뿌리카드 = 값.카드뿌리 ? 카드읽기(path.resolve(값.카드뿌리)) : null;
      const { 합친 } = 기억합치기(카드읽기(루트), 뿌리카드, 기억읽기(), Date.now());
      const 줄들 = 묶음만들기(await 장부목록(cfg), 합친);
      const 수 = 진행수(줄들);
      출력({ 줄: 줄들.length, 진행: 수 }, `미리 보기 — 줄 ${줄들.length}개, 진행: ${Object.entries(수).map(([k, v]) => `${k} ${v}`).join(' · ')}\n(로그인과 쓰기는 하지 않았다. 올리려면 --실행)`);
      return 0;
    }
    const 결과 = await 한번({ 카드뿌리: 값.카드뿌리, 사유: 값.카드뿌리 ? '카드뿌리' : '예약' });
    const 한줄 = 결과.오류 ? `팁 장부 동기 실패(${결과.끝코드}): ${결과.오류}`
      : `팁 장부 동기 — 줄 ${결과.줄} · 고르실 시안 ${결과.시안나옴} · 요청 ${결과.요청}(옮김 ${결과.옮김} · 어긋남 ${결과.어긋남} · 남김 ${결과.남김})${결과.저장 ? (결과.바뀜 ? ' · 새 판' : ' · 같은 판') : ' · 더 새 판이 있어 줄은 그대로'} · ${결과.걸린초}초${결과.장부오류 ? ` · 장부가 쓰지 못함(${결과.장부오류})` : 결과.끝코드 === 5 ? ' · 상태열쇠가 없어 요청을 장부에 못 옮김' : ''}`;
    if (!값['--조용히'] || 결과.끝코드) 출력(결과, 한줄);
    return 결과.끝코드;
  } catch (e) {
    console.error(`팁 장부 동기 실패: ${String(e.message || e).slice(0, 300)}`);
    return e.끝코드 || 1;
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { 줄만들기, 묶음만들기, 카드찾기, 기억합치기, 요청쓰기, 한번, 적용중목록, 잠그기, 주소, 자르기, 한도, main };
