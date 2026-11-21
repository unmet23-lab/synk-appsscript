#!/usr/bin/env node
// 꿈 무대 4급 시험판 서버(2026-11-21). 짓기.cjs가 만든 시험판 폴더를 내보내고, 녹음을 이 PC의 faster-whisper로 받아 적는다.
//   node experiences/drama/qa/꿈무대4급시험_20261121/서버.mjs [포트=4913] [시험판 폴더]
// 127.0.0.1에서만 연다. 받은 소리는 임시 파일로 한 번 받아 적고 바로 지운다. 받아 적은 글은 파일로 남기지 않는다.
// 받아쓰기 일꾼을 못 띄우면 /stt/status가 ok:false를 주고, 시험판은 녹음만 하는 판으로 돈다.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 자리 = createRequire(import.meta.url)('./자리.cjs');
const 포트 = Number(process.argv[2]) || 4913;
const 뿌리 = path.resolve(process.argv[3] || 자리.밖);
const 상한바이트 = 2.5 * 1024 * 1024;
const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-dream-g4-'));

const 형 = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

/* ── 받아쓰기 일꾼 ── */
let 일꾼 = null, 준비 = null, 번호 = 0;
const 기다림 = new Map();
function 일꾼띄우기() {
  if (준비) return 준비;
  준비 = new Promise((됨) => {
    일꾼 = spawn('python', ['-X', 'utf8', path.join(여기, '받아쓰기일꾼.py')], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let 남은 = '';
    일꾼.stdout.setEncoding('utf8');
    일꾼.stdout.on('data', (조각) => {
      남은 += 조각;
      let i;
      while ((i = 남은.indexOf('\n')) >= 0) {
        const 줄 = 남은.slice(0, i).trim(); 남은 = 남은.slice(i + 1);
        if (!줄) continue;
        let 답; try { 답 = JSON.parse(줄); } catch { continue; }
        if ('ready' in 답) { console.log(`받아쓰기 일꾼: ${답.ready ? `${답.model} · ${답.device}` : `못 엶 — ${답.error}`}`); 됨(답.ready ? { ok: true, 장치: 답.device, 모델: 답.model } : { ok: false, 까닭: 답.error }); continue; }
        const 받을이 = 기다림.get(답.id); if (받을이) { 기다림.delete(답.id); 받을이(답); }
      }
    });
    일꾼.stderr.setEncoding('utf8');
    일꾼.stderr.on('data', (글) => process.stderr.write(`  [일꾼] ${글}`));
    일꾼.on('error', (e) => 됨({ ok: false, 까닭: e.message }));
    일꾼.on('exit', (code) => {
      됨({ ok: false, 까닭: `일꾼이 끝남(${code})` });
      for (const [, 받을이] of 기다림) 받을이({ error: '일꾼이 끝남' });
      기다림.clear(); 준비 = null; 일꾼 = null;
    });
  });
  return 준비;
}
function 받아쓰기(파일) {
  return new Promise((됨) => {
    const id = ++번호;
    const 시계 = setTimeout(() => { 기다림.delete(id); 됨({ error: '시간 넘김' }); }, 240000);
    기다림.set(id, (답) => { clearTimeout(시계); 됨(답); });
    일꾼.stdin.write(`${JSON.stringify({ id, path: 파일 })}\n`);
  });
}

/* ── 요청 ── */
const 제이슨 = (답, code, 몸) => { 답.writeHead(code, { 'content-type': 형['.json'], 'cache-control': 'no-store' }); 답.end(JSON.stringify(몸)); };
async function 녹음받기(요청, 답) {
  const 상태 = await 일꾼띄우기();
  if (!상태.ok) return 제이슨(답, 503, { status: 'unavailable' });
  const 조각 = []; let 크기 = 0, 넘침 = false;
  for await (const c of 요청) { 크기 += c.length; if (크기 > 상한바이트) { 넘침 = true; break; } 조각.push(c); }
  if (넘침) return 제이슨(답, 413, { status: 'too_large' });
  if (!크기) return 제이슨(답, 400, { status: 'empty' });
  const 확장 = /mp4|aac/.test(요청.headers['content-type'] || '') ? '.m4a' : /wav/.test(요청.headers['content-type'] || '') ? '.wav' : '.webm';
  const 파일 = path.join(임시, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${확장}`);
  fs.writeFileSync(파일, Buffer.concat(조각));
  try {
    const r = await 받아쓰기(파일);
    if (r.error) { console.log(`받아쓰기 실패: ${r.error}`); return 제이슨(답, 500, { status: 'error' }); }
    console.log(`받아씀 ${r.ms}ms · ${r.text.length}자`);
    return 제이슨(답, 200, { status: 'ok', text: r.text, ms: r.ms });
  } finally { fs.rm(파일, { force: true }, () => {}); }
}
function 파일주기(요청, 답) {
  let 상대; try { 상대 = decodeURIComponent(요청.url.split('?')[0]); } catch { 답.writeHead(400).end(); return; }
  if (상대.endsWith('/')) 상대 += 'index.html';
  const 절대 = path.resolve(뿌리, `.${상대}`);
  if (!절대.startsWith(뿌리 + path.sep) && 절대 !== 뿌리) { 답.writeHead(403).end(); return; }
  fs.stat(절대, (e, st) => {
    if (e || !st.isFile()) { 답.writeHead(404).end('없다'); return; }
    const 공통 = { 'content-type': 형[path.extname(절대).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
    const 구간 = /^bytes=(\d*)-(\d*)$/.exec(요청.headers.range || '');
    if (구간 && st.size > 0) {
      let 시작 = 구간[1] === '' ? null : Number(구간[1]); let 끝 = 구간[2] === '' ? null : Number(구간[2]);
      if (시작 === null) { 시작 = Math.max(0, st.size - (끝 ?? 0)); 끝 = st.size - 1; } else if (끝 === null || 끝 >= st.size) 끝 = st.size - 1;
      if (시작 > 끝 || 시작 >= st.size) { 답.writeHead(416, { 'content-range': `bytes */${st.size}` }).end(); return; }
      답.writeHead(206, { ...공통, 'content-length': 끝 - 시작 + 1, 'content-range': `bytes ${시작}-${끝}/${st.size}` });
      fs.createReadStream(절대, { start: 시작, end: 끝 }).pipe(답); return;
    }
    답.writeHead(200, { ...공통, 'content-length': st.size });
    fs.createReadStream(절대).pipe(답);
  });
}

http.createServer(async (요청, 답) => {
  const 길 = 요청.url.split('?')[0];
  try {
    if (길 === '/stt/status' && 요청.method === 'GET') return 제이슨(답, 200, await 일꾼띄우기());
    if (길 === '/stt' && 요청.method === 'POST') return await 녹음받기(요청, 답);
    if (요청.method !== 'GET') { 답.writeHead(405).end(); return; }
    파일주기(요청, 답);
  } catch (e) { console.error(e); if (!답.headersSent) 제이슨(답, 500, { status: 'error' }); }
}).listen(포트, '127.0.0.1', () => {
  console.log(`꿈 무대 4급 시험판 — http://127.0.0.1:${포트}/  (뿌리 = ${뿌리})`);
  일꾼띄우기();
});
const 치우기 = () => { try { 일꾼?.kill(); } catch {} try { fs.rmSync(임시, { recursive: true, force: true }); } catch {} process.exit(0); };
process.on('SIGINT', 치우기); process.on('SIGTERM', 치우기);
