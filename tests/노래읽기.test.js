/* LAB 노래 읽기 시간 관문(2026-11-15 유호님 「읽기 빠듯하면 읽기 좋게 만들어야지 왜 빠듯하게 만든거야」).
 *
 * ① docs/마케팅/LAB_노래틀/틀/읽기재기.cjs — 판본 글을 song.json 화면 구간과 대어 넘치는 줄과 가장 긴 줄의 읽는 시간을 낸다.
 * ② 편만들기.py 읽기맞춤 — 읽는 시간으로 앞마디 · 진짜 속도 딱지 머묾 · 끝 끼움 마디 수를 고른다(11-15 세 편의 실제 값으로 잰다).
 * ③ tools/곡손질.py 「앞마디」 — 자른 노래 앞에 바탕 갈래 n마디를 붙인다(길이 · 이음매 · 대응).
 * ②③은 python · numpy · ffmpeg로 돈다(CI도 깐다 — 건너뛰는 시험은 조건부 QA가 빨간불로 잡으니 건너뛰기 조건을 두지 않는다).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 틀 = path.join(REPO, 'docs', '마케팅', 'LAB_노래틀', '틀');
const 읽기 = require(path.join(틀, '읽기재기.cjs'));


/** 노래만 판 짜임 — 카운트인 4초 · 진짜 속도 9.5~10.3초 · 끝 물음 10.3~13초 */
const 노래 = () => ({
  fps: 30, duration: 13, bpm: 100, first: 0.3, word: '배고파', syl: ['배', '고', '파'],
  parts: [
    { kind: 'count', t: 0, end: 4 },
    { kind: 'chop', t: 4, end: 5, at: [4.05, 4.3, 4.6] },
    { kind: 'whole', t: 5, end: 7, at: [5.05, 6.2] },
    { kind: 'chop', t: 7, end: 8, at: [7.05, 7.3, 7.6] },
    { kind: 'whole', t: 8, end: 9.5, at: [8.05, 8.9] },
    { kind: 'real', t: 9.5, end: 10.3, at: [9.55] },
    { kind: 'end', t: 10.3, end: 13 },
  ],
});

function 가짜편(판본) {
  const 편 = fs.mkdtempSync(path.join(os.tmpdir(), '노래읽기-'));
  fs.mkdirSync(path.join(편, 'remotion', 'public'), { recursive: true });
  fs.mkdirSync(path.join(편, 'remotion', 'src', '판본'), { recursive: true });
  fs.writeFileSync(path.join(편, 'remotion', 'public', 'song.json'), JSON.stringify(노래()));
  for (const [k, v] of Object.entries(판본)) fs.writeFileSync(path.join(편, 'remotion', 'src', '판본', `${k}.json`), JSON.stringify(v));
  return 편;
}

test('읽기재기 — 끝 물음은 들어오는 0.4초, 다리 글은 빠지는 0.2초를 빼고 잰다', () => {
  const 구간 = 읽기.화면구간(노래());
  assert.deepStrictEqual(구간.bridge, [0, 3.8]);
  assert.ok(Math.abs(구간.end[0] - 10.7) < 1e-9 && 구간.end[1] === 13);
  assert.ok(Math.abs(구간.real[0] - 9.2) < 1e-9 && 구간.real[1] === 10.3);
});

test('읽기재기 — 넘치는 줄만 내고, 필요는 가장 긴 줄의 읽는 시간', () => {
  const 편 = 가짜편({
    // 영어 초당 15자: 끝 물음 45자 = 3초 > 읽히는 2.3초 · 다리 글 30자 = 2초 < 3.8초 · 딱지 15자 = 1초 < 1.1초
    US: { lang: 'en', bridge: 'Hungry? In Korean you say this', mean: 'I’m hungry!', real: 'Talking speed!!', end: 'How do you say “I’m hungry” in your language?' },
    CA: { lang: 'en', bridge: 'Tummy rumbling? Koreans say…', mean: 'I’m hungry!', real: 'Talking speed!', end: 'Your word for it?' },
  });
  try {
    const r = 읽기.재기(편);
    assert.deepStrictEqual(r.넘침.map((z) => `${z.키}.${z.id}`), ['US.end']);
    assert.strictEqual(r.필요.끝, 3);
    assert.ok(r.필요.다리 >= 2 && r.필요.다리 <= 2.1);
    const 끝 = spawnSync('node', [path.join(틀, '읽기재기.cjs'), 편], { encoding: 'utf8' });
    assert.strictEqual(끝.status, 1, '넘치면 끝 코드 1');
    assert.match(끝.stdout, /US end — 읽히는 2\.3초에 45자/);
    const 필요 = JSON.parse(spawnSync('node', [path.join(틀, '읽기재기.cjs'), 편, '--필요'], { encoding: 'utf8' }).stdout);
    assert.deepStrictEqual(Object.keys(필요), ['다리', '딱지', '끝']);
  } finally { fs.rmSync(편, { recursive: true, force: true }); }
});

test('읽기재기 — 모두 넉넉하면 끝 코드 0', () => {
  const 편 = 가짜편({ CA: { lang: 'en', bridge: 'Koreans say…', mean: 'Hungry!', real: 'Real speed!', end: 'And you?' } });
  try {
    const 끝 = spawnSync('node', [path.join(틀, '읽기재기.cjs'), 편], { encoding: 'utf8' });
    assert.strictEqual(끝.status, 0, 끝.stdout + 끝.stderr);
  } finally { fs.rmSync(편, { recursive: true, force: true }); }
});

function 맞춤(인자) {
  const py = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('편만들기', sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
a = json.loads(sys.argv[2])
print(json.dumps(m.읽기맞춤(*a)))`;
  const r = spawnSync('python', ['-X', 'utf8', '-c', py, path.join(틀, '편만들기.py'), JSON.stringify(인자)], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('편만들기 읽기맞춤 — 11-15 세 편(메들리 A)의 실제 값', () => {
  const 마디 = (bpm) => 240 / bpm;
  // 배고파: 끝 물음만 한 마디 더(2.72초 → 5.12초)
  assert.deepStrictEqual(맞춤([4.051, 1.935, 마디(100.03), 60 / 100.03, 2.0749, false, { 다리: 3.847, 딱지: 1.693, 끝: 3.334 }]), [0, 0, 3]);
  // 잠깐만: 딱지 한 박 머묾 + 끝 물음 한 마디 더
  const [n1, h1, k1] = 맞춤([4.845, 1.139, 마디(101.895), 60 / 101.895, 1.9497, false, { 다리: 4.539, 딱지: 1.693, 끝: 4.125 }]);
  assert.deepStrictEqual([n1, k1], [0, 3]);
  assert.ok(Math.abs(h1 - 60 / 101.895) < 1e-9);
  // 진짜: 카운트인 3.09초라 앞마디 하나 · 딱지 두 박 · 끝 한 마디 더
  const [n2, h2, k2] = 맞춤([3.093, 0.938, 마디(101.895), 60 / 101.895, 0.7899, false, { 다리: 5, 딱지: 1.693, 끝: 3.77 }]);
  assert.deepStrictEqual([n2, k2], [1, 3]);
  assert.ok(Math.abs(h2 - 2 * 60 / 101.895) < 1e-9);
  // --읽기 없이(판본 글이 아직 없는 첫 자르기) — 예전대로 끝 화면 2.5초
  assert.deepStrictEqual(맞춤([4, 1, 2.4, 0.6, 2.0749, false, { 다리: 0, 딱지: 0, 끝: null }]), [0, 0, 2]);
  assert.deepStrictEqual(맞춤([4, 1, 2.4, 0.6, 0.5, true, { 다리: 0, 딱지: 0, 끝: null }]), [0, 0, 3]);
  // 앞마디를 주면 그 값
  assert.strictEqual(맞춤([3.093, 2, 2.4, 0.6, 0.5, false, { 다리: 9, 딱지: 0, 끝: 1 }, 0])[0], 0);
});

test('곡손질 앞마디 — 자른 노래 앞에 바탕 갈래 한 마디, 박 자리 · 대응 그대로', () => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '곡손질앞마디-'));
  try {
    // 120bpm(마디 2초) 20초 — 바탕은 440Hz, 섞인 곡은 바탕 + 박마다 딸깍
    const 만들기 = `import numpy as np, subprocess, sys
SR = 48000; t = np.arange(20 * SR) / SR
acc = 0.2 * np.sin(2 * np.pi * 440 * t)
mix = acc.copy(); mix[(np.arange(len(t)) % (SR // 2)) < 200] += 0.5
for name, x in (('곡', mix), ('바탕', acc), ('목소리', np.zeros_like(t))):
    st = np.stack([x, x], 1).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', sys.argv[1] + '/' + name + '.wav'], input=st.tobytes(), check=True)`;
    const m = spawnSync('python', ['-X', 'utf8', '-c', 만들기, 폴더], { encoding: 'utf8' });
    assert.strictEqual(m.status, 0, m.stderr);
    const 계획 = { 이름: '시험', 곡: path.join(폴더, '곡.wav'), 바탕: path.join(폴더, '바탕.wav'), 목소리: path.join(폴더, '목소리.wav'),
      박: { bpm: 120, 첫박: 0 }, 앞마디: { 마디: 1 }, 자르기: [6, 14, 0], 목표길이: [9, 11] };
    fs.writeFileSync(path.join(폴더, '계획.json'), JSON.stringify(계획));
    const r = spawnSync('python', ['-X', 'utf8', path.join(REPO, 'tools', '곡손질.py'), path.join(폴더, '계획.json'), '--미리'], { encoding: 'utf8' });
    const 보고 = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'), r.stdout.lastIndexOf('}') + 1));
    assert.strictEqual(보고.길이, 10, '자른 8초 + 앞마디 2초');
    assert.deepStrictEqual(보고.앞마디, { 마디: 1, 길이: 2 });
    assert.ok(보고.이음매.some((j) => Math.abs(j.초 - 2) < 1e-6), '앞마디 끝이 이음매로 잡힌다');
    assert.match(보고.대응, /\+ 앞마디 길이$/);
    assert.deepStrictEqual(보고.확인할것, []);
  } finally { fs.rmSync(폴더, { recursive: true, force: true }); }
});

test('노래 편 song.json에 사용자 폴더 · 드라이브 경로가 없다 — 공개 저장소(11-15)', () => {
  const 마케팅 = path.join(REPO, 'docs', '마케팅');
  const 편들 = fs.readdirSync(마케팅).filter((d) => d.startsWith('LAB_노래_') && fs.existsSync(path.join(마케팅, d, 'remotion', 'public', 'song.json')));
  assert.ok(편들.length >= 3, `노래 편이 ${편들.length}개뿐`);
  for (const 편 of 편들) {
    const 글 = fs.readFileSync(path.join(마케팅, 편, 'remotion', 'public', 'song.json'), 'utf8');
    assert.doesNotMatch(글, /[A-Za-z]:[\/]|[\/]Users[\/]|[\/]home[\/]/, `${편}: 경로는 이식경로.py 꼴(synk-vendor/… · ~/…)로 적는다`);
  }
});

test('이식경로 — 사용자 폴더와 synk-vendor를 줄이고 다시 푼다', () => {
  const py = `import json, os, sys
sys.path.insert(0, sys.argv[1]); import 이식경로 as ep
home = os.path.expanduser('~')
r = [ep.줄이기(os.path.join(home, 'ego', 'a', 'b.mp4')), ep.줄이기('D:/synk-vendor/lab/x.json'), ep.줄이기(chr(92).join(['C:', 'Users', '누구', 'Documents', 'synk-vendor', 'lab', 'y.json'])),
     ep.줄이기('E:/어딘가/z.wav'), ep.줄이기('synk-vendor/lab/x.json'), ep.풀기('~/ego/a/b.mp4') == os.path.join(home, 'ego', 'a', 'b.mp4')]
print(json.dumps(r, ensure_ascii=False))`;
  const r = spawnSync('python', ['-X', 'utf8', '-c', py, 틀], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(JSON.parse(r.stdout), ['~/ego/a/b.mp4', 'synk-vendor/lab/x.json', 'synk-vendor/lab/y.json', 'z.wav', 'synk-vendor/lab/x.json', true]);
});
