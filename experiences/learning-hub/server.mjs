import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['learning-hub', 'korean-racing', 'korean-runner', 'korean-rhythm', 'order-rush', 'entry-check', 'story-classroom', 'synk-account', 'atlas-lab', 'blank-slice','teacher-world','synk-town','hangul-stage']);
// The Atlas lab's consultation demo reads the published computer recommendation tool, read-only.
const consult = new Map([['/consult/computer/rules.js', '../docs/마케팅/맞춤도구/computer/rules.js'], ['/consult/computer/content.js', '../docs/마케팅/맞춤도구/computer/content.js']]);
consult.set('/synk-town/engine/loom-motion.js','../tools/lib/loom-motion.js');
consult.set('/synk-town/engine/loom-life.js','../tools/lib/loom-life.js');
const classroomPublic={
  'teacher-world':new Set(['index.html','style.css','app.mjs','personalization-ui.mjs','personalization.css']),
  'synk-town':new Set(['linked.html','app.mjs','style.css','linked-client.mjs','understanding.mjs','understanding-ui.mjs'])
};
const accountPublic = new Set(['index.html', 'client.html', 'teacher.html', 'teacher.css', 'preview.html', 'platform.html', 'platform.css', 'config.json', 'style.css',
  'platform.webmanifest', 'world.webmanifest', 'world-classroom.css', 'assets/app-platform.png', 'assets/app-world.png',
  'dist/app.js', 'dist/client.js', 'dist/teacher.js', 'dist/preview.js', 'dist/platform.js',
  'assets/SUIT-Variable.woff2', 'assets/InterTight-700.woff2', 'assets/scrapbook.css', 'assets/sticker-book.webp',
  'assets/thread-shift.webp', 'assets/slab-coral-long.webp', 'assets/slab-cream-long.webp', 'assets/chip-blush-long.webp', 'assets/badge-cream.webp', 'assets/badge-check.webp',
  'assets/tex-blush.webp', 'assets/laptop-felt.webp', 'assets/sticker-search.webp', 'assets/sticker-person.webp', 'assets/synk-logo.svg',
  'assets/InterTight-Regular.ttf', 'assets/InterTight-Medium.ttf', 'assets/DMMono-Medium.ttf']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
  '.ttf': 'font/ttf', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json' };
export function targetFor(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  if (consult.has(pathname)) return path.resolve(root, consult.get(pathname));
  const request = pathname === '/' ? '/learning-hub/' : pathname;
  const target = path.resolve(root, '.' + request + (request.endsWith('/') ? 'index.html' : ''));
  const relative = path.relative(root, target), segments = relative.split(path.sep);
  if (!allowed.has(segments[0]) || relative.startsWith('..') || path.isAbsolute(relative)
    || segments.some(s => s.startsWith('.')) || !types[path.extname(target)]
    || segments.includes('qa') || segments.includes('site-package')) return null;
  if (segments[0] === 'synk-account' && !accountPublic.has(segments.slice(1).join('/'))) return null;
  const publicFiles=classroomPublic[segments[0]],name=segments.slice(1).join('/');
  if(publicFiles&&!publicFiles.has(name)&&!(name.startsWith('assets/')&&/\.(?:png|webp|svg|woff2|ttf|jpg)$/.test(name)))return null;
  return target;
}
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      if (new URL(req.url, 'http://localhost').pathname === '/') { res.writeHead(302, { Location: '/synk-account/platform.html', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).end(); return; }
      const target = targetFor(req.url); if (!target) { res.writeHead(404).end(); return; }
      const stat = await fs.stat(target); if (!stat.isFile()) { res.writeHead(404).end(); return; }
      const real = await fs.realpath(target), listed = [...consult.values()].some(file => path.resolve(root, file) === real);
      if (path.relative(root, real).startsWith('..') && !listed) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(target);
      const head = { 'Content-Type': types[path.extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'Accept-Ranges': 'bytes' };
      // 영상·소리의 범위 요청(Safari·iOS는 영상에 206이 꼭 필요하다 — 입장 검사 근무지 영상)
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
        if (start >= data.length || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }).end(); return; }
        const part = data.subarray(start, end + 1);
        res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': part.length });
        res.end(req.method === 'HEAD' ? undefined : part);
        return;
      }
      res.writeHead(200, { ...head, 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404).end(); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SYNK_LEARNING_PORT || 4280);
  createServer().listen(port, '127.0.0.1', () => console.log(`SYNK 맞춤 학습: http://127.0.0.1:${port}/`));
}
