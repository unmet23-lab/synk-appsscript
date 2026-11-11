#!/usr/bin/env node
'use strict';
/**
 * PULSE 의뢰 확인 — 「클라이언트 의뢰 > 작성 > 너와 내가 확인 > 1차 전달 후 수정 > 제작」에서 Claude가 끼는 자리(2026-11-04).
 *
 *   node tools/PULSE의뢰.js 목록                       새 의뢰(확인 전)와 진행 중인 의뢰
 *   node tools/PULSE의뢰.js 받기 <번호>                 의뢰서 · 파일을 git 밖 synk-vendor/pulse-orders/<번호>/로 내려받는다
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
  return { 번호: r.number, 상태: r.status, 제목: project.title, 고객: project.customerName, 받은때: r.submittedAt || '', 메모: (r.notes || []).length, 판: (r.rounds || []).length, id: project.id, revision: project.revision };
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
  if (명령 === '목록') { for (const row of await 목록(ws)) console.log(`${row.번호}  ${row.상태.padEnd(9)}  ${row.제목}  (${row.고객})  메모 ${row.메모} · 판 ${row.판}`); return; }
  if (명령 === '받기') { const r = await 받기(ws, 번호); console.log(`${r.파일}개 받음 → ${r.방}`); return; }
  if (명령 === '메모') { await 메모(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8'))); console.log('올렸습니다'); return; }
  if (명령 === '묻기') { await 묻기(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8')).items); console.log('물었습니다'); return; }
  if (명령 === '소식') { const r = await 소식(ws, 번호, 소식인자(argv.slice(2))); console.log(`초안으로 올렸습니다(${r.초안.slice(0, 8)} · 그림 ${r.그림}장) — 손님에게 올리기는 직원 화면 「작업 소식」에서 사람이 누릅니다`); return; }
  console.log('쓰는 법: node tools/PULSE의뢰.js 목록 | 받기 <번호> | 메모 <번호> <메모.json> | 묻기 <번호> <묻기.json> | 소식 <번호> --글 "…" [--단계 …] [--그림 …] [--영어 "…"]');
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(error.status === 401 ? 3 : 1); });
module.exports = { 의뢰줄, 목록, 찾기, 받기, 메모, 묻기, 소식, 소식인자, 안전한이름, 보관 };
