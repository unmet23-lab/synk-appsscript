'use strict';
// 주문 폭주 캠퍼스 판 2판 — 귀로 고르는 견본 둘(2026-11-03): 유호님이 소리를 귀로 고르신다(사운드킷 원칙) — 시안 영상과 함께 보낸다.
//   효과음_견본.mp3: world-sfx.mjs를 게임과 같은 길(renderSfx → 버스 → 리미터, LEVEL 그대로)로 OfflineAudioContext에 그려 차례로 잇는다.
//   배경음악_견본.mp3: assets/world/music의 곡마다 고리 처음 18초(앞뒤 0.5초 페이드)를 1초 쉼으로 잇는다(파일 크기 −18 LUFS 그대로 —
//     게임 안에서는 음성보다 8 LU 아래로 더 작다).
//   node experiences/order-rush/qa/world-campus-20261103/소리견본.cjs   → 공용 작업본 .tmp/order-rush-world-20261103/시안/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const GAME = path.resolve(__dirname, '../..');
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'order-rush-world-20261103', '시안');
fs.mkdirSync(OUT, { recursive: true });

// [시각(초), 소리, 선택, 이름표] — 게임에서 나는 차례대로
const ICE = [0.12, 0.165, 0.21];
const SEQ = [];
let t = 0.4;
const add = (name, opts, label, gap = 0.95) => { SEQ.push([t, name, opts || {}, label]); t += gap; };
add('open', {}, '카페 문 열기');
add('arrive', { guest: 'g1' }, '손님 등장(니트 카디건 손님)'); add('arrive', { guest: 'g2' }, '손님 등장(데님 재킷 손님)'); add('arrive', { guest: 'g4' }, '손님 등장(안경 쓴 조교 손님)', 1.3);
add('coffee', { step: 1 }, '커피 — 컵 첫째 칸'); add('milk', { step: 2 }, '우유 — 둘째 칸'); add('ice', { step: 3, hits: ICE }, '얼음 — 셋째 칸(간판 소리)'); add('sugar', { step: 4 }, '설탕 — 넷째 칸', 1.3);
add('tea', { step: 1 }, '차 — 첫째 칸'); add('cold', { step: 2 }, '차갑게 — 둘째 칸'); add('remove', { step: 1 }, '넣은 재료 빼기', 1.3);
add('cup', {}, '컵 하나 더'); add('clear', {}, '비우기', 1.3);
add('serve', {}, '서빙(컵 미끄러짐)', 0.18); add('correct', { combo: 1 }, '맞음(연속 1)', 1.1);
add('serve', {}, '서빙', 0.18); add('correct', { combo: 3 }, '맞음(연속 3)', 0.17); add('combo', {}, '연속 칩(3 · 5 · 8)', 1.1);
add('serve', {}, '서빙', 0.18); add('correct', { combo: 5 }, '맞음(연속 5 — 천장)', 1.3);
add('differ', {}, '주문과 다름(묻는 두 음 — 실패음 없음)', 1.3);
add('leave', { guest: 'g2' }, '러시: 기다리다 떠난 손님', 1.3);
for (const n of [5, 4, 3, 2, 1]) add('tick', { n, last: n <= 3 }, `러시 남은 ${n}초`, 1.0);
add('done', {}, '영업 끝', 1.0);
for (let i = 0; i < 6; i += 1) add('roll', {}, i ? '' : '결과: 주문 점이 찍힐 때마다', 0.11);
add('land', {}, '큰 숫자가 앉음', 0.9); add('coin', {}, '코인', 1.0); add('tap', {}, '단추(멈춤 창 등)', 1.2);
const LENGTH = t + 0.6;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>소리견본</title>'); return; }
      const file = path.join(GAME, u);
      if (!file.startsWith(GAME) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function wav(samples, sr) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    const data = await page.evaluate(async ({ seq, length }) => {
      const m = await import('/world-sfx.mjs');
      const SR = 48000, c = new OfflineAudioContext(1, Math.ceil(SR * length), SR);
      const bus = m.createBus(c, { seed: 11 });
      for (const [at, name, opts] of seq) m.renderSfx(bus, name, at, opts);
      return Array.from((await c.startRendering()).getChannelData(0));
    }, { seq: SEQ, length: LENGTH });
    const raw = path.join(OUT, '효과음_견본.wav');
    fs.writeFileSync(raw, wav(data, 48000));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, '효과음_견본.mp3')]);
    fs.rmSync(raw);
  } finally { await browser.close(); srv.close(); }
  // 배경음악: 곡마다 고리 처음 18초
  const music = JSON.parse(fs.readFileSync(path.join(GAME, 'assets/world/music/music.json'), 'utf8'));
  const parts = [], labels = [];
  let at = 0;
  for (const [id, tr] of Object.entries(music.tracks)) {
    const clip = path.join(OUT, `_${id}.wav`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(tr.loopStart), '-t', '18', '-i', path.join(GAME, tr.file), '-af', 'afade=t=in:d=0.5,afade=t=out:st=17.5:d=0.5,apad=pad_dur=1', '-ar', '44100', '-ac', '2', clip]);
    parts.push(clip);
    labels.push(`${String(Math.floor(at / 60)).padStart(1, '0')}:${String(Math.round(at % 60)).padStart(2, '0')} ${tr.mode === 'rush' ? '점심 러시' : '한가한 오픈'} ${id} · ${tr.bpm} BPM · ${tr.key?.name}`);
    at += 19;
  }
  const list = path.join(OUT, '_list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, '배경음악_견본.mp3')]);
  for (const p of [...parts, list]) fs.rmSync(p);
  const cues = SEQ.filter(([, , , l]) => l).map(([s, , , l]) => `${s.toFixed(1).padStart(5)}초  ${l}`);
  fs.writeFileSync(path.join(OUT, '견본_차례.txt'), `효과음_견본.mp3\n${cues.join('\n')}\n\n배경음악_견본.mp3\n${labels.join('\n')}\n`);
  console.log(fs.readFileSync(path.join(OUT, '견본_차례.txt'), 'utf8'));
})().catch((e) => { console.error(e); process.exit(1); });
