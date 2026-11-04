// 말 랠리를 WORLD 게임 틀(같은 출처 .game-frame iframe)처럼 열어 보는 시험 서버(2026-11-03). WORLD 앱 없이 캠퍼스 판 겉 · 소리를 빠르게 본다.
//   node experiences/talk-rally/qa/world-campus-20261104/틀서버.mjs [포트=5331]   → http://127.0.0.1:5331/ (틀 · ?w=폭&h=높이로 틀 크기)
// / = 틀 페이지, 그 밖의 길은 experiences/ 폴더(/talk-rally/ = 게임, /brand-opening/ = 앱 설정 world-sound.mjs — 앱 안과 같은 길).
// 학습 기록 · 계정은 앱 밖이라 입구 안내 줄이 「학습 기록을 저장할 수 없어서…」로 나온다(앱 안에서는 실제 연습 안내).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.argv[2]) || 5331;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const frame = (w, h) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#060709}iframe{border:0;display:block;${w ? `width:${w}px;height:${h}px` : 'width:100%;height:100%'}}</style><iframe class="game-frame" src="/talk-rally/index.html?qa=1" allow="autoplay"></iframe>`;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    if (p === '/') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(frame(Number(url.searchParams.get('w')) || 0, Number(url.searchParams.get('h')) || 0)); }
    let file = path.resolve(EXP, '.' + p);
    if (!file.startsWith(EXP)) throw Error('outside');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('nf'); }
}).listen(PORT, '127.0.0.1', () => console.log(`틀 http://127.0.0.1:${PORT}/`));
