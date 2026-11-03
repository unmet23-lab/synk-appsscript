// 환승 러시 시안 서버(2026-11-04): / = 게임 틀(같은 출처 .game-frame iframe, 앱과 같은 꼴), 그 밖의 길은 experiences/ 폴더, /재료/는 git 밖 공용 작업본 재료.
//   node experiences/subway-rush/qa/시안-20261104/시안서버.mjs [포트=5294]   → http://127.0.0.1:5294/?look=a  (?look=b · ?w=390&h=844 · ?auto=1)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.resolve(여기, '../../..');
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
const 재료 = path.join(공용작업본(path.resolve(EXP, '..')), '.tmp', 'subway-rush-20261104', '재료');
const PORT = Number(process.argv[2]) || 5294;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const 틀 = (q, w, h) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>환승 러시 시안</title><style>html,body{margin:0;height:100%;background:#060709;display:grid;place-items:center}iframe{border:0;display:block;${w ? `width:${w}px;height:${h}px` : 'width:100%;height:100%'}}</style><iframe class="game-frame" src="/subway-rush/qa/%EC%8B%9C%EC%95%88-20261104/%EC%8B%9C%EC%95%88.html?${q}" allow="autoplay"></iframe>`;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    if (p === '/') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(틀(url.searchParams.toString(), Number(url.searchParams.get('w')) || 390, Number(url.searchParams.get('h')) || 844)); }
    let file;
    if (p.startsWith('/재료/')) file = path.join(재료, path.basename(p));
    else { file = path.resolve(EXP, '.' + p); if (!file.startsWith(EXP)) throw Error('outside'); if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('nf'); }
}).listen(PORT, '127.0.0.1', () => console.log(`시안 http://127.0.0.1:${PORT}/?look=a`));
