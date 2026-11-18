#!/usr/bin/env node
'use strict';
/**
 * PULSE 의뢰 확인 — 「클라이언트 의뢰 > 작성 > 너와 내가 확인 > 1차 전달 후 수정 > 제작」에서 Claude가 끼는 자리(2026-11-04).
 *
 *   node tools/PULSE의뢰.js 목록                       새 의뢰(확인 전)와 진행 중인 의뢰
 *   node tools/PULSE의뢰.js 받기 <번호>                 의뢰서 · 파일을 git 밖 synk-vendor/pulse-orders/<번호>/로 내려받는다
 *   node tools/PULSE의뢰.js 정리 [--실행 [--없는것 <번호…>]]  서버에서 지운 의뢰의 PC 사본을 보인다(--실행이면 지운다). 1차 확인 예약이 10분마다 같은 일을 한다
 *                                                      --없는것 <번호…>: 작업실 목록에서 사라진 그 번호도 지운다 — 사람이 지운 의뢰라고 확인한 번호만
 *   node tools/PULSE의뢰.js 메모 <번호> <메모.json>      직원만 보는 1차 확인을 올린다
 *   node tools/PULSE의뢰.js 묻기 <번호> <묻기.json>      빠진 것만 손님에게 묻는다(손님에게 보이는 일 — 유호님 확인 뒤에)
 *   node tools/PULSE의뢰.js 소식 <번호> --글 "…" [--단계 check|draft|make|review] [--그림 a.png b.jpg …] [--영어 "…"]
 *                                                      작업 소식을 초안으로만 올린다 — 손님에게 올리기는 늘 사람이 직원 화면 「작업 소식」에서 누른다
 *
 * 메모.json: {"summary","lines":[한 문장 후보],"model","ref","risks":[…]}. 묻기.json: {"items":[{"label","why"}]}.
 * 로그인은 작업실 예약과 같은 Windows 자격 보관소 항목을 쓴다. 손님 자료는 공개 저장소에 넣지 않는다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const 보관 = process.env.SYNK_PULSE_ORDERS || path.join(os.homedir(), 'Documents', 'synk-vendor', 'pulse-orders');
const 번호꼴 = /^P-\d{4}-[0-9A-F]{4}$/;
const 안전한이름 = (이름) => String(이름 || '파일').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

function 의뢰줄(project) {
  const r = project.studio?.request;
  if (!r) return null;
  // 단계: 프로젝트의 단계(received · planning · … · archived). 보관(archived)된 프로젝트는 서버가 메모를 받지 않는다 — 1차 확인이 이것으로 거른다.
  return { 번호: r.number, 상태: r.status, 단계: project.stage || '', 제목: project.title, 고객: project.customerName, 받은때: r.submittedAt || '', 메모: (r.notes || []).length, 판: (r.rounds || []).length, id: project.id, revision: project.revision };
}
async function 목록(ws) {
  const { projects = [] } = await ws.get('/api/client-projects');
  const 줄 = [];
  for (const project of projects) {
    // 목록에는 기획 문서가 없을 수 있어 프로젝트마다 다시 읽는다. 의뢰서 프로젝트만 남긴다.
    const full = project.studio ? project : (await ws.get(`/api/client-projects/${project.id}/studio`)).project;
    const row = 의뢰줄(full);
    if (row) 줄.push(row);
  }
  return 줄.sort((a, b) => String(b.받은때).localeCompare(String(a.받은때)));
}
async function 찾기(ws, 번호) {
  if (!번호꼴.test(String(번호))) throw new Error(`의뢰 번호 꼴이 아닙니다: ${번호}`);
  const 같은번호 = (await 목록(ws)).filter((item) => item.번호 === 번호), row = 같은번호[0];
  if (!row) throw new Error(`그 번호의 의뢰를 찾지 못했습니다: ${번호}`);
  if (같은번호.length > 1) throw new Error(`같은 번호의 의뢰가 ${같은번호.length}개라 고르지 않습니다: ${번호} — 작업실에서 프로젝트로 찾아 주세요`);
  return { row, project: (await ws.get(`/api/client-projects/${row.id}/studio`)).project };
}
async function 내려받기(ws, 주소, 대상) {
  const r = await ws.fetch(ws.base + 주소, { headers: ws.headers(), redirect: 'error', signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`${주소} 내려받기 실패(${r.status})`);
  fs.writeFileSync(대상, Buffer.from(await r.arrayBuffer()));
}
async function 받기(ws, 번호, { 폴더 = 보관 } = {}) {
  const { project } = await 찾기(ws, 번호);
  const 방 = path.join(폴더, 번호), 자료 = path.join(방, '손님자료');
  fs.mkdirSync(자료, { recursive: true });
  const r = project.studio.request;
  fs.writeFileSync(path.join(방, '의뢰서.json'), JSON.stringify({ 번호: r.number, 받은때: r.submittedAt, 제목: project.title, 고객: project.customerName, 연락처: project.contact, 답: r.answers, 파일: r.files, 물음: r.asks }, null, 2));
  let 수 = 0;
  for (const asset of project.studio.assets || []) {
    await 내려받기(ws, `/api/client-projects/${project.id}/studio/media/${asset.id}`, path.join(자료, `${asset.id.slice(0, 8)}_${안전한이름(asset.fileName)}`));
    수++;
  }
  for (const file of project.intake?.files || []) {
    await 내려받기(ws, `/api/client-projects/${project.id}/intake-files/${file.id}`, path.join(자료, `${file.id.slice(0, 8)}_${안전한이름(file.fileName)}`));
    수++;
  }
  return { 방, 파일: 수 };
}
// ── PC 사본 정리(11-18) ──
// 의뢰서 동의 줄 「제작으로 이어지지 않으면 90일 뒤 지워요」는 회사 서버가 지킨다(판 4 설계 11-7 — 예고 뒤 「지운 의뢰」, studio.request.status 'retired').
// 받기가 이 PC에 둔 사본(의뢰서.json · 손님자료 · 읽은자료 · 자료한장.md)은 서버가 지워도 남았다. 그래서 서버가 그 의뢰를 지우면 PC 사본도 지운다.
// 서버는 지운 의뢰를 목록에 「지운 의뢰」로 남기고, 프로젝트 문서를 지우는 길은 없다. 권한 밖 프로젝트는 목록에서 빠지고 읽기도 404다.
// 그래서 목록에서 아예 사라진 번호는 지운 의뢰인지, 로그인 계정 · 권한이 바뀐 것인지 PC가 가릴 수 없다. 제작 중인 의뢰일 수도 있어(GPT 검수 GA1)
// 저절로 지우지 않는다. 처음 못 찾은 때를 장부에 적어 알리고(처음 · 14일째), 사람이 지운 의뢰가 맞다고 본 번호만 `정리 --실행 --없는것 <번호…>`로 지운다
// (번호를 꼭 적는다 — 알림을 받지 않은 다른 숨은 의뢰까지 함께 지우지 않게, GPT 다시 검수 GA1).
// 목록에 의뢰가 하나도 없으면(로그인 · 권한 이상) 아무것도 세지 않는다.
const 하루 = 24 * 60 * 60 * 1000;
const 다시알림날수 = 14;
const 정리장부빈것 = () => ({ 없음: {}, 못지움: {} });

/** 이 PC 주문 폴더의 번호들 — 번호 꼴인 진짜 폴더만(링크 · 접점은 건너뛴다). 폴더가 없으면 빈 목록.
 *  보관 폴더(pulse-orders) 자체가 링크 · 접점이면 다른 곳의 폴더를 지울 수 있어 아무것도 보지 않는다(GPT 검수 GA2).
 *  그 위 마디는 따진다 — synk-vendor는 11-07부터 D:로 가는 정션이 정상이다. */
function 주문폴더들(폴더 = 보관) {
  try { if (fs.lstatSync(폴더).isSymbolicLink()) return []; } catch { return []; }
  try { return fs.readdirSync(폴더, { withFileTypes: true }).filter((칸) => 칸.isDirectory() && !칸.isSymbolicLink() && 번호꼴.test(칸.name)).map((칸) => 칸.name).sort(); } catch { return []; }
}

/** 서버 목록의 줄을 번호마다 묶는다 → Map(번호 → 줄들). 번호 꼴이 아닌 줄은 뺀다. */
function 번호묶음(줄들) {
  const 묶음 = new Map();
  for (const 줄 of 줄들 || []) {
    if (!줄 || !번호꼴.test(String(줄.번호))) continue;
    if (!묶음.has(줄.번호)) 묶음.set(줄.번호, []);
    묶음.get(줄.번호).push(줄);
  }
  return 묶음;
}
/** 같은 번호의 프로젝트가 하나 이상 있고 모두 「지운 의뢰」인가. 하나라도 살아 있으면 남긴다. */
const 모두지운의뢰 = (같은) => 같은.length > 0 && 같은.every((줄) => 줄.상태 === 'retired');

/** PC 사본을 어떻게 할지 정한다(순수). 줄들: 목록()의 줄. 번호들: 이 PC의 주문 폴더. 장부: { 없음: { 번호: {처음, 알림?, 다시알림?} }, 못지움 }.
 *  → { 지울: [{ 번호, 까닭: '지운 의뢰' | '서버에 없음' }], 없음: [{ 번호, 처음, 알림?, 다시알림?, 날수 }], 장부(다음 장부) }
 *  지울: 같은 번호의 줄이 모두 「지운 의뢰」인 것. 없는번호들(사람이 고른 손 실행)에 든 번호는 목록에서 사라졌을 때만 넣는다.
 *  없음: 목록에서 사라진 번호 — 처음 못 찾은 때와 알림 표시를 잇는다. 다시 보이면 풀린다. */
function 정리계획(줄들, 번호들, 장부 = 정리장부빈것(), 지금 = new Date(), { 없는번호들 = [] } = {}) {
  const 고른없음 = new Set(없는번호들 || []);
  const 지금ms = +new Date(지금), 앞없음 = (장부 && 장부.없음) || {}, 앞못지움 = (장부 && 장부.못지움) || {};
  const 묶음 = 번호묶음(줄들);
  const 지울 = [], 없음 = [], 다음 = 정리장부빈것();
  for (const 번호 of 번호들 || []) {
    if (앞못지움[번호] && typeof 앞못지움[번호] === 'object') 다음.못지움[번호] = { ...앞못지움[번호] };
    const 같은 = 묶음.get(번호) || [];
    if (같은.length) {
      if (모두지운의뢰(같은)) 지울.push({ 번호, 까닭: '지운 의뢰' });
      continue;
    }
    if (!묶음.size) { if (앞없음[번호]) 다음.없음[번호] = 앞없음[번호]; continue; } // 목록이 비었다 — 세지도 풀지도 않는다
    const 앞 = 앞없음[번호] && typeof 앞없음[번호] === 'object' ? 앞없음[번호] : {};
    const 처음ms = Date.parse(앞.처음);
    const 줄 = Number.isFinite(처음ms) && 처음ms <= 지금ms ? { ...앞 } : { 처음: new Date(지금ms).toISOString() };
    다음.없음[번호] = 줄;
    없음.push({ 번호, ...줄, 날수: Math.floor((지금ms - Date.parse(줄.처음)) / 하루) });
    if (고른없음.has(번호)) 지울.push({ 번호, 까닭: '서버에 없음' });
  }
  return { 지울, 없음, 장부: 다음 };
}

function 정리장부읽기(파일) {
  try {
    const 읽은 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    const 칸 = (값) => (값 && typeof 값 === 'object' && !Array.isArray(값) ? { ...값 } : {});
    return { 없음: 칸(읽은?.없음), 못지움: 칸(읽은?.못지움) };
  } catch { return 정리장부빈것(); }
}
function 정리장부쓰기(파일, 장부) {
  try { fs.mkdirSync(path.dirname(파일), { recursive: true }); fs.writeFileSync(파일, JSON.stringify(장부, null, 2) + '\n'); return true; } catch { return false; }
}
/** 알림을 보낸 뒤 장부의 그 번호들에 표시를 남긴다(종류 '없음' | '못지움', 칸 '알림' | '다시알림'). 보내기가 실패하면 부르지 않아 다음 회차가 다시 보낸다. */
function 정리장부표시(파일, 종류, 번호들, 칸, 때) {
  const 장부 = 정리장부읽기(파일);
  for (const 번호 of 번호들) if (장부[종류]?.[번호] && typeof 장부[종류][번호] === 'object') 장부[종류][번호][칸] = 때;
  return 정리장부쓰기(파일, 장부);
}

/** 서버 목록(줄들)에 맞춰 이 PC의 주문 폴더를 지운다. 장부파일이 없으면 장부 없이 돈다(손 실행).
 *  → { 지움: [{번호, 까닭}], 못지움: [{번호, 까닭, 오류, 처음, 알림?}], 없음: [{번호, 처음, 알림?, 다시알림?, 날수}] } */
function PC사본정리(줄들, { 폴더 = 보관, 장부파일 = '', 지금 = new Date(), 없는번호들 = [], 지우기 = (경로) => fs.rmSync(경로, { recursive: true, force: true, maxRetries: 2 }) } = {}) {
  const 앞장부 = 장부파일 ? 정리장부읽기(장부파일) : 정리장부빈것();
  const 계획 = 정리계획(줄들, 주문폴더들(폴더), 앞장부, 지금, { 없는번호들 });
  const 지움 = [], 못지움 = [];
  for (const 할일 of 계획.지울) {
    const 방 = path.join(폴더, 할일.번호);
    try {
      const 상태 = fs.lstatSync(방);
      if (!상태.isDirectory() || 상태.isSymbolicLink()) throw Object.assign(new Error('폴더가 아니다'), { code: 'NOT_DIR' });
      지우기(방);
      if (fs.existsSync(방)) throw Object.assign(new Error('지운 뒤에도 남았다'), { code: 'LEFT' });
      지움.push(할일);
      delete 계획.장부.없음[할일.번호]; delete 계획.장부.못지움[할일.번호];
    } catch (오류) {
      if (!계획.장부.못지움[할일.번호]) 계획.장부.못지움[할일.번호] = { 처음: new Date(+new Date(지금)).toISOString() };
      못지움.push({ ...할일, 오류: String(오류?.code || 'ERR'), ...계획.장부.못지움[할일.번호] });
    }
  }
  if (장부파일) 정리장부쓰기(장부파일, 계획.장부); // 못 쓰면 알림 표시만 잃는다 — 다음 회차가 다시 알린다(지우는 판단은 장부를 쓰지 않는다)
  const 없음 = 계획.없음.filter((일) => !지움.some((x) => x.번호 === 일.번호));
  return { 지움, 못지움, 없음 };
}

/** 손 명령의 --없는것 <번호…>를 읽는다. 뒤의 값은 모두 번호여야 하고 하나 이상이어야 한다 — 꼴이 틀린 값이 하나라도 있으면 멈춘다(다시 검수 GA1). */
function 없는번호읽기(argv) {
  const 칸 = (argv || []).indexOf('--없는것');
  if (칸 < 0) return [];
  const 값들 = argv.slice(칸 + 1).map(String);
  if (!값들.length || 값들.some((값) => !번호꼴.test(값))) throw new Error('--없는것은 명령 맨 끝에 두고, 그 뒤에는 지울 의뢰 번호만 적어 주세요(예: 정리 --실행 --없는것 P-1112-DDDD) — 알림에 나온 번호만 지운다.');
  return 값들;
}

/** 예약이 도는 운영 사본과 이 작업본의 작업 방 → { 방들, 운영찾음 }. 운영 사본은 tools/운영사본.js 찾기().운영사본(설계 검토 P1 — 칸 이름). */
function 기본작업방들() {
  const 뿌리들 = [path.join(__dirname, '..')];
  let 운영 = null;
  try { 운영 = require('./운영사본.js').찾기().운영사본 || null; } catch { /* 못 찾음 — 알린다 */ }
  if (운영) 뿌리들.push(운영);
  return { 방들: [...new Set(뿌리들.map((뿌리) => path.resolve(뿌리, 'output', '크레딧작업', 'PULSE의뢰확인')))], 운영찾음: !!운영 };
}

/** 손 명령 「정리」의 몸통 — 목록 · 작업 방을 받아 시험할 수 있게 뗐다(설계 검토). --실행이 없으면 미리 보기만 한다.
 *  --없는것 <번호…>로 고른 번호 가운데 비어 있지 않은 목록에 없는 번호는, 주문 폴더가 이미 없어도 작업 방의 남긴 메모를 지운다(메모 장부 줄은 남긴다).
 *  → { 미리보기 } 또는 { 지움, 못지움, 없음, 메모: [{ 방, 수 | null }] } */
function 손정리(줄들, { argv = [], 폴더 = 보관, 작업방 = 기본작업방들, 출력 = (글) => console.log(글) } = {}) {
  const 없는번호들 = 없는번호읽기(argv);
  if (!argv.includes('--실행')) {
    const 계획 = 정리계획(줄들, 주문폴더들(폴더), 정리장부빈것());
    for (const 일 of 계획.지울) 출력(`${일.번호}  지울 것 — ${일.까닭}`);
    for (const 일 of 계획.없음) 출력(`${일.번호}  작업실 목록에 없음 — 지운 의뢰가 맞으면 --실행 --없는것 ${일.번호}로 지운다(로그인 계정 · 권한부터 확인)`);
    출력(`${폴더} · 주문 폴더 ${주문폴더들(폴더).length}개 · 지운 의뢰 ${계획.지울.length}개 · 목록에 없음 ${계획.없음.length}개(미리 보기 — 지우려면 --실행)`);
    return { 미리보기: 계획 };
  }
  const r = PC사본정리(줄들, { 폴더, 없는번호들 });
  for (const 일 of r.지움) 출력(`${일.번호}  지움 — ${일.까닭}`);
  for (const 일 of r.못지움) 출력(`${일.번호}  못 지움(${일.오류}) — ${일.까닭}`);
  for (const 일 of r.없음) 출력(`${일.번호}  작업실 목록에 없어 남김(--없는것 ${일.번호}를 주면 지운다)`);
  // 남긴 메모 — 예약은 서버가 지운 의뢰만 정리하므로(다시 검수 GA2) 손으로 고른 번호는 여기서 지운다. 목록이 비면 건드리지 않는다.
  const 묶음 = 번호묶음(줄들);
  const 메모대상 = 묶음.size ? 없는번호들.filter((번호) => !묶음.has(번호)) : [];
  const 메모 = [];
  if (메모대상.length) {
    const { 의뢰메모지우기 } = require('./크레딧작업/PULSE의뢰확인.js');
    const { 방들, 운영찾음 } = 작업방();
    if (!운영찾음) 출력('운영 사본을 찾지 못했어요 — 이 작업본의 작업 방만 봤어요. 예약이 도는 운영 사본의 output/크레딧작업/PULSE의뢰확인/메모대기/를 손으로 확인해 주세요.');
    for (const 방 of 방들) {
      if (!fs.existsSync(방)) { 출력(`${방} · 작업 방이 없어요`); 메모.push({ 방, 수: null }); continue; }
      const { 지움: 수, 못지움 } = 의뢰메모지우기(방, 메모대상); // 메모 장부는 건드리지 않는다 — 예약의 잠금 밖이라(다시 검수 GA1)
      메모.push({ 방, 수, 못지움 });
      출력(`${방} · 남긴 메모 ${수}개 지움${못지움.length ? ` · 못 지움 ${못지움.join(' · ')} — 파일이 열려 있으면 닫고 다시 쳐 주세요` : ''}`);
    }
  }
  출력(`지움 ${r.지움.length} · 못 지움 ${r.못지움.length} · 목록에 없어 남김 ${r.없음.length}`);
  return { ...r, 메모 };
}

async function 스튜디오(ws, project, body) {
  return ws.post(`/api/client-projects/${project.id}/studio`, { revision: project.revision, ...body });
}
async function 메모(ws, 번호, note) {
  const { project } = await 찾기(ws, 번호);
  await 스튜디오(ws, project, { action: 'request_note', note: { by: 'Claude', ...note } });
  return { 번호, 남김: true };
}
async function 묻기(ws, 번호, items) {
  const { project } = await 찾기(ws, 번호);
  await 스튜디오(ws, project, { action: 'request_ask', items });
  return { 번호, 물음: items.length };
}

// 작업 소식(운영 조각 4 · 설계 S1): 제작 세션은 작업 중 화면을 초안까지만 올린다(progress_save). 손님에게 올리기(progress_post)는 이 도구에 잇지 않는다.
// 그림은 결과물 프레임만(PNG · JPG 넷까지) — 작업 도구 화면 캡처에는 다른 손님 파일이 찍힐 수 있다. 소식 전용 그림으로 올린다(x-studio-purpose: progress — 프로젝트당 40장).
// 영어 프로젝트는 --영어로 손님에게 보일 영어를 함께 둔다(없으면 직원 화면에서 붙인 뒤에 올릴 수 있다).
const 소식단계 = ['check', 'draft', 'make', 'review'];
function 소식인자(args) {
  const out = { 글: '', 단계: '', 그림: [], 영어: '' };
  for (let i = 0; i < args.length; i++) {
    const 칸 = args[i];
    if (칸 === '--글' || 칸 === '--단계' || 칸 === '--영어') { if (i + 1 >= args.length) throw new Error(`${칸} 뒤에 값을 적어 주세요.`); out[칸.slice(2)] = String(args[++i]); continue; }
    if (칸 === '--그림') { while (i + 1 < args.length && !String(args[i + 1]).startsWith('--')) out.그림.push(String(args[++i])); continue; }
    throw new Error(`모르는 칸입니다: ${칸}`);
  }
  return out;
}
const 그림형식 = (파일) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' })[path.extname(파일).toLowerCase()] || '';
async function 소식그림(ws, project, 파일) {
  const type = 그림형식(파일), bytes = fs.readFileSync(파일);
  const r = await ws.fetch(ws.base + `/api/client-projects/${project.id}/studio/media`, { method: 'POST', redirect: 'error', body: bytes, signal: AbortSignal.timeout(180000),
    headers: ws.headers({ 'content-type': type, 'content-length': String(bytes.length), 'x-file-name': encodeURIComponent(path.basename(파일)), 'x-project-revision': String(project.revision), 'x-studio-purpose': 'progress' }) });
  let data = {};try { data = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(`${path.basename(파일)} 올리기 실패(${r.status}) — ${data.error || ''}`.trim()), { status: r.status });
  return data;
}
async function 소식(ws, 번호, { 글 = '', 단계 = '', 그림 = [], 영어 = '' } = {}) {
  const 본문 = String(글).trim();
  if (!본문) throw new Error('--글로 손님에게 보일 소식 글을 적어 주세요.');
  if (String(글).length > 600) throw new Error('소식 글은 600자까지입니다.');
  if (단계 && !소식단계.includes(단계)) throw new Error(`단계는 ${소식단계.join(' · ')} 가운데 하나입니다.`);
  if (그림.length > 4) throw new Error('그림은 넷까지 붙입니다.');
  for (const 파일 of 그림) { if (!그림형식(파일)) throw new Error(`작업 소식에는 PNG · JPG만 올립니다: ${파일}`); if (!fs.existsSync(파일)) throw new Error(`파일이 없습니다: ${파일}`); }
  let { project } = await 찾기(ws, 번호);
  if (!project.studio?.request?.progressFeed) throw new Error('이 서버는 아직 작업 소식을 모릅니다 — 회사 판이 오른 뒤 쓰세요.');
  // --영어는 영어 프로젝트에만 — 다른 언어 프로젝트에 넣으면 그 언어의 확인된 번역으로 저장된다(끝 판 카본 검수 A2). 한국어 프로젝트는 번역을 두지 않는다.
  if (영어.trim() && project.translation?.locale !== 'en') throw new Error(`이 프로젝트는 영어 프로젝트가 아닙니다(${project.translation?.locale || 'ko'}) — --영어를 빼거나 직원 화면에서 그 언어로 적어 주세요.`);
  const assets = [];
  for (const 파일 of 그림) { const data = await 소식그림(ws, project, 파일); project = data.project; assets.push(data.asset.id); }
  const saved = await 스튜디오(ws, project, { action: 'progress_save', text: 본문, ...(단계 ? { stage: 단계 } : {}), assets, ...(영어.trim() ? { translation: { text: 영어.trim() } } : {}) });
  const item = (saved?.project?.studio?.request?.progress || []).at(-1);
  return { 번호, 초안: item?.id || '', 그림: assets.length };
}

async function main(argv) {
  const [명령, 번호, 파일] = argv;
  const { connect } = require('./작업실예약.js');
  const ws = await connect();
  if (명령 === '목록') { for (const row of await 목록(ws)) console.log(`${row.번호}  ${row.상태.padEnd(9)}  ${row.제목}  (${row.고객})  메모 ${row.메모} · 판 ${row.판}${row.단계 === 'archived' ? ' · 보관' : ''}`); return; }
  if (명령 === '받기') { const r = await 받기(ws, 번호); console.log(`${r.파일}개 받음 → ${r.방}`); return; }
  if (명령 === '정리') {
    없는번호읽기(argv); // 목록을 읽기 전에 인자부터 본다 — 틀리면 아무것도 하지 않는다
    손정리(await 목록(ws), { argv });
    return;
  }
  if (명령 === '메모') { await 메모(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8'))); console.log('올렸습니다'); return; }
  if (명령 === '묻기') { await 묻기(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8')).items); console.log('물었습니다'); return; }
  if (명령 === '소식') { const r = await 소식(ws, 번호, 소식인자(argv.slice(2))); console.log(`초안으로 올렸습니다(${r.초안.slice(0, 8)} · 그림 ${r.그림}장) — 손님에게 올리기는 직원 화면 「작업 소식」에서 사람이 누릅니다`); return; }
  console.log('쓰는 법: node tools/PULSE의뢰.js 목록 | 받기 <번호> | 정리 [--실행 [--없는것 <번호…>]] | 메모 <번호> <메모.json> | 묻기 <번호> <묻기.json> | 소식 <번호> --글 "…" [--단계 …] [--그림 …] [--영어 "…"]');
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(error.status === 401 ? 3 : 1); });
module.exports = { 의뢰줄, 목록, 찾기, 받기, 메모, 묻기, 소식, 소식인자, 안전한이름, 보관, 번호꼴, 주문폴더들, 번호묶음, 모두지운의뢰, 정리계획, PC사본정리, 정리장부표시, 다시알림날수, 없는번호읽기, 손정리, 기본작업방들 };
