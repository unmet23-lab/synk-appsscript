'use strict';
// synk.im/builds/voice-check(10-30) — 브라우저 셈(crackle.js)이 tools/목소리엉킴.py와 같은 숫자를 내는지, 판정 규칙을 본다.
// 예시 두 파일은 영상 속 그 한 줄의 목소리 A(깨져 들린 판) · B(다시 뽑은 판). 파이썬과 같게 ffmpeg로 16k·48k 모노를 만들어 넣는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crackle = require('../docs/마케팅/맞춤도구/voice/crackle.js');

const SAMPLES = path.join(__dirname, '..', 'docs', '마케팅', '맞춤도구', 'voice', 'samples');
const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

function load(file, sr) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, `ffmpeg로 ${path.basename(file)}를 읽었다`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}

// 기본 주파수 f0의 배음 여럿을 더한 모음 비슷한 소리(배음 줄에 에너지가 모인다)
function vowel(f0, seconds, sr) {
  const x = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    for (let h = 1; h * f0 < 4000; h++) s += Math.sin(2 * Math.PI * h * f0 * i / sr) / h;
    x[i] = 0.3 * s;
  }
  return x;
}

test('예시 두 파일이 파이썬 검사기(tools/목소리엉킴.py)와 같은 숫자를 낸다', { skip: !ffmpeg && 'ffmpeg 없음' }, () => {
  const a = path.join(SAMPLES, 'voice-a.wav');
  const b = path.join(SAMPLES, 'voice-b.wav');
  const ra = crackle.measure(load(a, 16000), load(a, 48000));
  assert.equal(ra.crackle.toFixed(1), '20.8');
  assert.equal(Math.round(ra.topHz), 666);
  assert.equal(ra.frames, 53);
  assert.equal(Math.round(ra.medianF0), 400);
  assert.equal(ra.worst3.toFixed(2), '0.59');
  assert.equal(ra.verdict, 'fail');
  const rb = crackle.measure(load(b, 16000), load(b, 48000));
  assert.equal(rb.crackle.toFixed(1), '0.0');
  assert.equal(Math.round(rb.topHz), 403);
  assert.equal(rb.frames, 71);
  assert.equal(Math.round(rb.medianF0), 250);
  assert.equal(rb.verdict, 'pass');
});

test('브라우저 경로(48kHz 한 판 → decimate3로 16kHz)도 파이썬과 창 수까지 같다', { skip: !ffmpeg && 'ffmpeg 없음' }, () => {
  const want = { 'voice-a.wav': ['20.8', 666, 53, 'fail'], 'voice-b.wav': ['0.0', 403, 71, 'pass'] };
  for (const [f, [pct, hz, frames, v]] of Object.entries(want)) {
    const x48 = load(path.join(SAMPLES, f), 48000);
    const ref = load(path.join(SAMPLES, f), 16000);
    const own = crackle.decimate3(x48);
    assert.equal(own.length, ref.length, `${f} 16kHz 길이`);
    let diff = 0, pk = 0;
    for (let i = 0; i < ref.length; i++) { diff = Math.max(diff, Math.abs(own[i] - ref[i])); pk = Math.max(pk, Math.abs(ref[i])); }
    assert.ok(diff / pk < 2e-3, `${f} ffmpeg 16kHz와의 차이 ${(diff / pk).toExponential(2)}`);
    const r = crackle.measure(null, x48);
    assert.deepEqual([r.crackle.toFixed(1), Math.round(r.topHz), r.frames, r.verdict], [pct, hz, frames, v], f);
    assert.equal(r.marks.length, r.frames);
    assert.equal(r.marks.filter((m) => m[1]).length, Math.round(r.crackle * r.frames / 100));
  }
});

test('배음이 고른 소리는 깨짐 0%, 음높이를 그 기본 주파수로 잡는다', () => {
  const r = crackle.measure(vowel(220, 1.5, 16000), vowel(220, 1.5, 48000));
  assert.equal(r.crackle, 0);
  assert.ok(Math.abs(r.topHz - 220) < 2, `최고 음높이 ${r.topHz}`);
  assert.ok(Math.abs(r.medianF0 - 220) < 3, `가운데 기본음 ${r.medianF0}`);
  assert.equal(r.verdict, 'pass');
});

test('가운데 기본 주파수가 165Hz 아래인 낮은 목소리는 판정하지 않는다', () => {
  const r = crackle.measure(vowel(120, 1.5, 16000), vowel(120, 1.5, 48000));
  assert.ok(r.medianF0 < 165);
  assert.equal(r.verdict, 'low');
});

test('최고 음높이가 560Hz를 넘으면 깨짐이 0%여도 미통과', () => {
  const r = crackle.measure(vowel(620, 1.2, 16000), vowel(620, 1.2, 48000));
  assert.ok(r.topHz > 560, `최고 음높이 ${r.topHz}`);
  assert.equal(r.verdict, 'fail');
});

test('무음 · 짧은 파일은 모음이 없다고 한다(오류 없이)', () => {
  const silent = crackle.measure(new Float32Array(16000), new Float32Array(48000));
  assert.equal(silent.verdict, 'none');
  assert.equal(silent.topHz, null);
  const tiny = crackle.measure(new Float32Array(100), new Float32Array(300));
  assert.equal(tiny.verdict, 'none');
});

test('판정 규칙 — 보이는 값으로 가르고, 음높이는 낮은 목소리에도 본다', () => {
  const base = { frames: 50, medianF0: 250, crackle: 4.9, topHz: 559 };
  assert.equal(crackle.verdict(base), 'pass');
  assert.equal(crackle.verdict({ ...base, crackle: 5 }), 'fail');
  assert.equal(crackle.verdict({ ...base, crackle: 4.96 }), 'fail', '「5.0%」로 보이면 미통과');
  assert.equal(crackle.verdict({ ...base, crackle: 4.94 }), 'pass');
  assert.equal(crackle.verdict({ ...base, topHz: 560 }), 'fail');
  assert.equal(crackle.verdict({ ...base, topHz: 559.6 }), 'fail', '「560Hz」로 보이면 미통과');
  assert.equal(crackle.verdict({ ...base, topHz: null }), 'ear');
  assert.equal(crackle.verdict({ ...base, crackle: 12, topHz: null }), 'fail');
  assert.equal(crackle.verdict({ ...base, medianF0: 150, crackle: 40 }), 'low', '낮은 목소리의 깨짐 %는 판정하지 않는다');
  assert.equal(crackle.verdict({ ...base, medianF0: 150, crackle: 40, topHz: 600 }), 'fail', '음높이는 따로 본다');
  assert.equal(crackle.crackleFails({ ...base, medianF0: 150, crackle: 40 }), false);
  assert.equal(crackle.verdict({ ...base, frames: 0 }), 'none');
});

// 예시 둘은 pcm_s16le 모노 48kHz — ffmpeg 없는 곳(CI)에서도 머리를 직접 읽어 기준값을 본다
function readWav(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  let p = 12, fmt = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22), format: b.readUInt16LE(p + 8) };
    if (id === 'data') {
      assert.deepEqual([fmt.format, fmt.channels, fmt.rate, fmt.bits], [1, 1, 48000, 16], `${path.basename(file)}는 16비트 모노 48kHz`);
      const x = new Float32Array(n / 2);
      for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(p + 8 + i * 2) / 32768;
      return x;
    }
    p += 8 + n + (n % 2);
  }
  throw new Error('data 덩어리 없음');
}

test('ffmpeg 없이 wav를 직접 읽어도(브라우저와 같은 48kHz 한 판) 파이썬 기준값이 나온다', () => {
  const want = { 'voice-a.wav': ['20.8', 666, 53, 400, 'fail'], 'voice-b.wav': ['0.0', 403, 71, 250, 'pass'] };
  for (const [f, w] of Object.entries(want)) {
    const r = crackle.measure(null, readWav(path.join(SAMPLES, f)));
    assert.deepEqual([r.crackle.toFixed(1), Math.round(r.topHz), r.frames, Math.round(r.medianF0), r.verdict], w, f);
  }
});

test('예시 파일은 공개해도 되는 크기다', () => {
  for (const f of ['voice-a.wav', 'voice-b.wav']) assert.ok(fs.statSync(path.join(SAMPLES, f)).size < 600 * 1024, f);
});
