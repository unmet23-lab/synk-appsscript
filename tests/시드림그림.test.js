// 시드림 그림 도구 — 드리미나를 부르지 않는 --지시문만 판으로 참고 표기 바꾸기를 본다(11-19 유호님 「시드림을 고정하자」).
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 도구 = path.join(__dirname, '..', 'tools', '시드림그림.py');
const 파이썬 = process.platform === 'win32' ? 'python' : 'python3';

function 돌림(글, 참고수) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '시드림-'));
  const 파일 = path.join(폴더, '지시문.txt');
  fs.writeFileSync(파일, 글, 'utf8');
  const 참고 = Array.from({ length: 참고수 }, (_, k) => path.join(폴더, `r${k + 1}.jpg`));
  const r = spawnSync(파이썬, ['-I', '-X', 'utf8', 도구, '시험', 파일, '--밖', 폴더, '--지시문만', ...(참고.length ? ['--참고', ...참고] : [])], { encoding: 'utf8' });
  return r;
}

test('「Images 1 to 4」는 참고 넷의 표기로, 「Image 5」는 다섯째 표기로 바뀐다', () => {
  const r = 돌림('Images 1 to 4 are reference photos of Yuna. Recreate Image 5 exactly.', 5);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\[IMG1\], \[IMG2\], \[IMG3\] and \[IMG4\] are reference photos/);
  assert.match(r.stdout, /Recreate \[IMG5\] exactly/);
});

test('참고 그림보다 큰 번호를 부르면 굽지 않는다', () => {
  const r = 돌림('Images 1 to 4 are reference photos.', 2);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /참고 그림 \[3, 4\]번을 부르는데 참고는 2장이다/);
});

test('참고 없는 지시문은 그대로 나온다', () => {
  const r = 돌림('A seaside promenade in late-afternoon sun.', 0);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'A seaside promenade in late-afternoon sun.');
});
