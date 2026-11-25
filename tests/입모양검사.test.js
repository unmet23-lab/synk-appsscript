'use strict';
// 입 모양 검사(tools/입모양검사.py) — 계산과 판정만 본다. 얼굴 모델과 Demucs가 드는 영상 재기는 이 PC에서만 돌아 여기서는 부르지 않는다.
// 자체시험: 입을 0.3초 늦게 민 값에서 밀림을 정확히 찾고, 걸릴 컷(첫 음절 뒤 굳음 · 다른 말 · 0.17초 이름)은 걸고,
// 지나갈 컷(잘 맞는 컷 · 값이 흔들린 짧은 컷 · 소리만 어긋난 후렴 되풀이)은 걸지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tool = path.join(__dirname, '..', 'tools', '입모양검사.py');
const py = process.env.SYNK_PYTHON || 'python';
const 없음 = spawnSync(py, ['-I', '-X', 'utf8', '-c', 'import numpy'], { encoding: 'utf8' }).status !== 0 && 'numpy 없음';

test('계산과 판정 자체시험을 지난다', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, '--자체시험'], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /자체시험 통과/);
});

test('영상이 없으면 통과로 끝나지 않는다', { skip: 없음 }, () => {
  const r = spawnSync(py, ['-I', '-X', 'utf8', tool, '없는영상.mp4'], { encoding: 'utf8', timeout: 60000 });
  assert.notEqual(r.status, 0);
});
