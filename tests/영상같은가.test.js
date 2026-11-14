'use strict';
// tools/영상같은가.js — 틀을 고친 뒤 영상이 고치기 전과 같은지. ffmpeg 없이 돈다(ffprobe · ffmpeg 자리에 가짜 실행기를 넣는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { 재기, 판정, 통계읽기, 화면셈, 소리셈, 보이기, main, 기본선 } = require('../tools/영상같은가.js');

const pcm = (표본들) => { const b = Buffer.alloc(표본들.length * 2); 표본들.forEach((v, i) => b.writeInt16LE(v, i * 2)); return b; };
const 통계글 = (mse들) => mse들.map((m, i) => `n:${i + 1} mse_avg:${m} mse_y:${m} mse_u:0.00 mse_v:0.00 psnr_avg:${m > 0 ? (10 * Math.log10(65025 / m)).toFixed(2) : 'inf'} psnr_y:inf psnr_u:inf psnr_v:inf`).join('\n') + '\n';

// 가짜 ffprobe · ffmpeg: 파일 이름 → { 폭, 높이, 프레임, 소리(PCM Buffer | null) }, psnr 통계는 mse 목록
function 가짜(파일들, mse들) {
  const 부른 = [];
  const 실행 = (cmd, args, opts = {}) => {
    부른.push([cmd, ...args].join(' '));
    const 이름 = (p) => path.basename(String(p));
    if (cmd === 'ffprobe') {
      const f = 파일들[이름(args[args.length - 1])];
      if (!f) return { status: 1, stdout: '', stderr: 'No such file' };
      const streams = [{ codec_type: 'video', width: f.폭, height: f.높이, nb_read_frames: String(f.프레임), r_frame_rate: '30/1' }];
      if (f.소리) streams.push({ codec_type: 'audio' });
      return { status: 0, stdout: JSON.stringify({ streams, format: { duration: String(f.프레임 / 30) } }), stderr: '' };
    }
    if (args.includes('-lavfi')) {
      if (mse들 === '실패') return { status: 1, stdout: '', stderr: 'psnr 오류' };
      fs.writeFileSync(path.join(opts.cwd, 'psnr.log'), 통계글(mse들));
      return { status: 0, stdout: '', stderr: '' };
    }
    const f = 파일들[이름(args[args.indexOf('-i') + 1])];
    return { status: 0, stdout: f.소리, stderr: '' };
  };
  return { 실행, 부른 };
}

test('통계 읽기 · 화면 셈 — 프레임별 MSE에서 평균 · 가장 낮은 프레임', () => {
  const 프레임 = 통계읽기(통계글([0, 0, 2.0, 0.5]) + '쓸데없는 줄\n');
  assert.deepEqual(프레임, [{ n: 1, mse: 0 }, { n: 2, mse: 0 }, { n: 3, mse: 2 }, { n: 4, mse: 0.5 }]);
  const 셈 = 화면셈(프레임);
  assert.equal(셈.최저프레임, 3);
  assert.equal(셈.다른프레임, 2);
  assert.ok(Math.abs(셈.최저 - 10 * Math.log10(65025 / 2)) < 1e-9);
  assert.ok(Math.abs(셈.평균 - 10 * Math.log10(65025 / 0.625)) < 1e-9);
  assert.equal(화면셈(통계읽기(통계글([0, 0]))).평균, Infinity);
  assert.equal(화면셈([]), null);
});

test('소리 셈 — 같은 표본 · 잔차 봉우리 · 길이 차이', () => {
  assert.deepEqual(소리셈(pcm([1, -2, 3]), pcm([1, -2, 3])), { 같은표본: true, 길이같음: true, 잔차dB: -Infinity, 표본: 3 });
  const 다름 = 소리셈(pcm([0, 100, 0]), pcm([0, 100 + 328, 0]));
  assert.equal(다름.같은표본, false);
  assert.ok(Math.abs(다름.잔차dB - 20 * Math.log10(328 / 32768)) < 1e-9, '약 −40dBFS');
  const 짧음 = 소리셈(pcm([5, 5, 5, 5]), pcm([5, 5]));
  assert.equal(짧음.길이같음, false);
  assert.equal(짧음.표본차, 2);
  assert.equal(짧음.잔차dB, -Infinity);
});

test('재기 + 판정 — 같은 화소 · 같은 표본이면 같음', () => {
  const 소리 = pcm([10, 20, 30]);
  const g = 가짜({ 'a.mp4': { 폭: 1080, 높이: 1920, 프레임: 3, 소리 }, 'b.mp4': { 폭: 1080, 높이: 1920, 프레임: 3, 소리: Buffer.from(소리) } }, [0, 0, 0]);
  const m = 재기('a.mp4', 'b.mp4', { 실행: g.실행 });
  assert.deepEqual(판정(m), { 같음: true, 까닭: [] });
  assert.match(보이기(m, 판정(m)), /같은 화소\(3프레임 모두 MSE 0\)[\s\S]*같은 표본\(3개\)[\s\S]*→ 같음/);
  assert.ok(g.부른.some((c) => /psnr=stats_file=psnr\.log/.test(c)), 'psnr 통계는 상대 이름으로');
});

test('판정 — 선을 넘지 못하는 까닭을 하나씩 적는다', () => {
  const 틀 = (over) => ({ 기준: { 폭: 1080, 높이: 1920, 프레임: 822, 소리: true }, 견줄: { 폭: 1080, 높이: 1920, 프레임: 822, 소리: true }, 화면: { 평균: 60, 최저: 52, 최저프레임: 7 }, 소리: { 같은표본: true }, ...over });
  assert.equal(판정(틀({})).같음, true);
  assert.match(판정(틀({ 화면: { 평균: 49.9, 최저: 52, 최저프레임: 7 } })).까닭[0], /평균 PSNR 49\.9dB < 50dB/);
  assert.match(판정(틀({ 화면: { 평균: 60, 최저: 44, 최저프레임: 412 } })).까닭[0], /가장 낮은 프레임 PSNR 44\.0dB < 45dB\(412번째\)/);
  assert.match(판정(틀({ 견줄: { 폭: 1080, 높이: 1920, 프레임: 821, 소리: true } })).까닭[0], /프레임 수가 다르다\(822 ↔ 821\)/);
  assert.match(판정(틀({ 견줄: { 폭: 720, 높이: 1280, 프레임: 822, 소리: true }, 화면: null })).까닭[0], /화면 크기가 다르다/);
  assert.match(판정(틀({ 견줄: { 폭: 1080, 높이: 1920, 프레임: 822, 소리: false }, 소리: null })).까닭[0], /소리 줄기가 한쪽에만/);
  assert.match(판정(틀({ 소리: { 같은표본: false, 길이같음: true, 잔차dB: -40 } })).까닭[0], /소리 잔차 봉우리 −40\.0dBFS > −60\.0dBFS/);
  assert.equal(판정(틀({ 소리: { 같은표본: false, 길이같음: true, 잔차dB: -72 } })).같음, true, '잔차가 선 아래면 같음');
  assert.match(판정(틀({ 소리: { 같은표본: false, 길이같음: false, 표본차: 480, 잔차dB: -90 } })).까닭[0], /소리 길이가 다르다\(표본 480개 차이\)/);
  assert.match(판정(틀({ 화면: null })).까닭[0], /화면을 재지 못했다/);
  assert.equal(판정(틀({ 화면: { 평균: 60, 최저: 44, 최저프레임: 7 } }), { ...기본선, 최저: 40 }).같음, true, '선은 인자로만 바뀐다');
});

test('명령줄 — 0 같음 · 1 다름 · 2 못 잼, 크기가 다르면 화면은 재지 않는다', () => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '같은가-'));
  const [a, b, c] = ['a.mp4', 'b.mp4', 'c.mp4'].map((n) => { const f = path.join(폴더, n); fs.writeFileSync(f, 'x'); return f; });
  const 소리 = pcm([1, 2, 3, 4]);
  const 파일들 = { 'a.mp4': { 폭: 1080, 높이: 1920, 프레임: 4, 소리 }, 'b.mp4': { 폭: 1080, 높이: 1920, 프레임: 4, 소리: pcm([1, 2, 3, 999]) }, 'c.mp4': { 폭: 720, 높이: 1280, 프레임: 4, 소리 } };
  const 찍힌 = [];
  const 원래 = { log: console.log, error: console.error };
  console.log = (s) => 찍힌.push(String(s));
  console.error = (s) => 찍힌.push(String(s));
  try {
    assert.equal(main([a, a], { 실행: 가짜(파일들, [0, 0, 0, 0]).실행 }), 0);
    assert.equal(main([a, b], { 실행: 가짜(파일들, [0, 0, 3.5, 0]).실행 }), 1);
    assert.match(찍힌[찍힌.length - 1], /→ 다름: .*소리 잔차 봉우리/);
    const g = 가짜(파일들, [0, 0, 0, 0]);
    assert.equal(main([a, c, '--json'], { 실행: g.실행 }), 1);
    assert.equal(JSON.parse(찍힌[찍힌.length - 1]).화면, null);
    assert.ok(!g.부른.some((x) => /-lavfi/.test(x)), '크기가 다르면 psnr을 돌리지 않는다');
    assert.equal(main([a, a], { 실행: 가짜(파일들, '실패').실행 }), 2);
    assert.equal(main([a], {}), 2);
    assert.equal(main([a, path.join(폴더, '없는.mp4')], {}), 2);
    assert.equal(main([a, a, '--몰라'], {}), 2);
    assert.equal(main([a, a, '--평균', '가'], {}), 2);
  } finally { console.log = 원래.log; console.error = 원래.error; fs.rmSync(폴더, { recursive: true, force: true }); }
});
