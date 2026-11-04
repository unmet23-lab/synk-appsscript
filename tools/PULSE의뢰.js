#!/usr/bin/env node
'use strict';
/**
 * PULSE 의뢰 확인 — 「클라이언트 의뢰 > 작성 > 너와 내가 확인 > 1차 전달 후 수정 > 제작」에서 Claude가 끼는 자리(2026-11-04).
 *
 *   node tools/PULSE의뢰.js 목록                       새 의뢰(확인 전)와 진행 중인 의뢰
 *   node tools/PULSE의뢰.js 받기 <번호>                 의뢰서 · 파일을 git 밖 synk-vendor/pulse-orders/<번호>/로 내려받는다
 *   node tools/PULSE의뢰.js 메모 <번호> <메모.json>      직원만 보는 1차 확인을 올린다
 *   node tools/PULSE의뢰.js 묻기 <번호> <묻기.json>      빠진 것만 손님에게 묻는다(손님에게 보이는 일 — 유호님 확인 뒤에)
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

async function main(argv) {
  const [명령, 번호, 파일] = argv;
  const { connect } = require('./작업실예약.js');
  const ws = await connect();
  if (명령 === '목록') { for (const row of await 목록(ws)) console.log(`${row.번호}  ${row.상태.padEnd(9)}  ${row.제목}  (${row.고객})  메모 ${row.메모} · 판 ${row.판}`); return; }
  if (명령 === '받기') { const r = await 받기(ws, 번호); console.log(`${r.파일}개 받음 → ${r.방}`); return; }
  if (명령 === '메모') { await 메모(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8'))); console.log('올렸습니다'); return; }
  if (명령 === '묻기') { await 묻기(ws, 번호, JSON.parse(fs.readFileSync(파일, 'utf8')).items); console.log('물었습니다'); return; }
  console.log('쓰는 법: node tools/PULSE의뢰.js 목록 | 받기 <번호> | 메모 <번호> <메모.json> | 묻기 <번호> <묻기.json>');
}
if (require.main === module) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(error.status === 401 ? 3 : 1); });
module.exports = { 의뢰줄, 목록, 찾기, 받기, 메모, 묻기, 안전한이름, 보관 };
