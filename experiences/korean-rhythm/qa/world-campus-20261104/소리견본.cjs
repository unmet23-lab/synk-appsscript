'use strict';
// 말의 리듬 캠퍼스 판 — 귀로 고르는 견본 둘(2026-11-04, 주문 폭주 캠퍼스 판 소리견본.cjs를 옮김): 시안 영상과 함께 보낸다.
//   효과음_견본.mp3: world-sfx.mjs를 게임과 같은 길(renderSfx → 버스 → 리미터, LEVEL 그대로)로 OfflineAudioContext에 그려 차례로 잇는다.
//   키음_전후.mp3: 「초록」 같은 자리 10초를 곡과 함께 — 앞은 지금까지의 키음(사인 삑), 1초 쉬고 뒤는 새 키음. 노트 시각은 실제 보면(편하게)이고 곡 크기는 게임 길(0.7)이다.
//   node experiences/korean-rhythm/qa/world-campus-20261104/소리견본.cjs   → 공용 작업본 .tmp/rhythm-world-20261104/시안/
const path = require('node:path'), fs = require('node:fs'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM, path.resolve(__dirname, '../../../../node_modules')] }));
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const GAME = path.resolve(__dirname, '../..');
const OUT = path.join(공용작업본(path.resolve(__dirname, '../../../..')), '.tmp', 'rhythm-world-20261104', '시안');
fs.mkdirSync(OUT, { recursive: true });

// [시각(초), 소리, 선택, 이름표] — 게임에서 나는 차례대로
const SEQ = [];
let t = 0.4;
const add = (name, opts, label, gap = 0.95) => { SEQ.push([t, name, opts || {}, label]); t += gap; };
add('open', {}, '무대 연습 시작(불 켜짐)', 1.2);
for (let i = 0; i < 4; i += 1) add('count', { accent: i === 3 }, i ? '' : '네 박 카운트', 0.54);
t += 0.5;
add('key', { lane: 0, quality: 1 }, 'O 레인 — 딱!', 0.6); add('key', { lane: 1, quality: 1 }, 'X 레인 — 딱!', 0.6); add('key', { lane: 0, quality: 0.8 }, 'O 레인 — 좋아요', 0.6);
add('key', { lane: 1, quality: 0.8 }, 'X 레인 — 좋아요', 0.6); add('key', { lane: 0, quality: 0.5 }, 'O 레인 — 아쉬워요', 0.6); add('key', { lane: 1, quality: 0.5 }, 'X 레인 — 아쉬워요', 0.9);
add('release', {}, '길게 누른 노트를 끝까지', 0.9);
add('milestone', {}, '콤보 10 · 25 · 50 · 100', 1.2);
add('listen', {}, '문장 안내음(음성 0.45초 전, 늘 같은 소리)', 1.2);
add('pick', { lane: 0 }, '답을 먼저 고름', 0.9);
add('right', { n: 1 }, '맞음(첫 문장)', 1.1); add('right', { n: 3 }, '맞음(셋째)', 1.1); add('right', { n: 5 }, '맞음(다섯째 — 천장)', 1.3);
add('differ', {}, '들은 내용과 다름(묻는 두 음 — 실패음 없음)', 1.3);
add('done', {}, '무대 끝', 1.2);
for (let i = 1; i <= 5; i += 1) add('dot', { step: i, ok: i !== 3 }, i === 1 ? '결과: 문장 점이 찍힘(셋째는 놓침)' : '', 0.14);
t += 0.3;
for (let i = 0; i < 6; i += 1) add('roll', {}, i ? '' : '박자 점수 굴림', 0.08);
add('land', {}, '큰 숫자가 앉음', 0.9); add('stamp', {}, '5/5 도장', 1.1); add('coin', {}, '코인', 1.0);
const LENGTH = t + 0.6;

function serve() {
  return new Promise((resolve) => {
    const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.json': 'application/json' };
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>소리견본</title>'); return; }
      const file = path.join(GAME, u);
      if (!file.startsWith(GAME) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
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
    const sfx = await page.evaluate(async ({ seq, length }) => {
      const m = await import('/world-sfx.mjs');
      const SR = 48000, c = new OfflineAudioContext(1, Math.ceil(SR * length), SR);
      const bus = m.createBus(c, { seed: 11 });
      for (const [at, name, opts] of seq) m.renderSfx(bus, name, at, opts);
      return Array.from((await c.startRendering()).getChannelData(0));
    }, { seq: SEQ, length: LENGTH });
    const raw = path.join(OUT, '효과음_견본.wav');
    fs.writeFileSync(raw, wav(sfx, 48000));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, '효과음_견본.mp3')]);
    fs.rmSync(raw);
    // 키음 전후: 곡 같은 자리를 두 번(사인 삑 → 새 키음)
    const mix = await page.evaluate(async () => {
      const m = await import('/world-sfx.mjs'), core = await import('/core.mjs');
      const track = core.TRACKS[0], round = new core.RoundState(track, 'normal', 7);
      const SR = 48000, LEN = 10, GAP = 1, from = track.beatTimes[64];
      const c0 = new OfflineAudioContext(1, 8, SR);
      const song = await c0.decodeAudioData(await (await fetch('/' + track.audioUrl)).arrayBuffer());
      const c = new OfflineAudioContext(1, Math.ceil(SR * (LEN * 2 + GAP)), SR);
      const master = c.createGain(); master.gain.value = 0.7; master.connect(c.destination);
      for (const at of [0, LEN + GAP]) {
        const s = c.createBufferSource(), g = c.createGain();
        s.buffer = song; s.connect(g); g.connect(master);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + 0.05); g.gain.setValueAtTime(1, at + LEN - 0.3); g.gain.linearRampToValueAtTime(0, at + LEN);
        s.start(at, from, LEN);
      }
      const notes = round.notes.filter((n) => n.time >= from && n.time < from + LEN - 0.4);
      const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
      for (const n of notes) {   // 앞: 지금까지의 키음(audio.mjs hit — 사인, 음악 길 위)
        const at = n.time - from, o = c.createOscillator(), g = c.createGain();
        o.frequency.value = freq([72, 76, 79, 81][n.lane]);
        g.gain.setValueAtTime(0.035, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.17);
      }
      const bus = m.createBus(c, { seed: 5 });
      for (const n of notes) m.renderSfx(bus, 'key', LEN + GAP + n.time - from, { lane: n.lane, quality: 1 });   // 뒤: 새 키음
      return { data: Array.from((await c.startRendering()).getChannelData(0)), notes: notes.length, from };
    });
    const raw2 = path.join(OUT, '키음_전후.wav');
    fs.writeFileSync(raw2, wav(mix.data, 48000));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw2, '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', path.join(OUT, '키음_전후.mp3')]);
    fs.rmSync(raw2);
    const cues = SEQ.filter(([, , , l]) => l).map(([s, , , l]) => `${s.toFixed(1).padStart(5)}초  ${l}`);
    fs.writeFileSync(path.join(OUT, '견본_차례.txt'), `효과음_견본.mp3\n${cues.join('\n')}\n\n키음_전후.mp3\n0~10초 지금까지의 키음(사인 삑) · 11~21초 새 키음 — 「초록」 ${mix.from.toFixed(1)}초부터 같은 자리, 노트 ${mix.notes}개\n`);
    console.log(fs.readFileSync(path.join(OUT, '견본_차례.txt'), 'utf8'));
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
