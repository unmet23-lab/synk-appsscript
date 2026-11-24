'use strict';
// 첫컷검사의 「인물」 질문(2026-11-23) — 최종 확인 · 마감 관문의 배역별 얼굴판을 첫 시험 컷의 다른 눈(GPT)으로 당긴다.
// ① tools/첫컷검사.py: 컷표 틀 2의 이 컷 줄 AI 배역마다 「인물」 기준 그림의 얼굴을 기준_<배역>.jpg로, 이 구간 칸의 얼굴을 얼굴판.jpg(11-24)로
//    눈에게 주고 질문 「인물」을 더한다.
//    같은 배역이 나오는 다른 컷의 받은 판 얼굴은 얼굴판_다른컷.jpg로(11-24 — 받은 뒤 검사가 --배역판으로 고른 판 · 걸림 없는 파일을 넘긴다).
//    실제 사람 배역(승인 얼굴 세트)과 손 · 몸만 나오는 단역은 빼고(실제 사람이 든 컷 줄은 얼굴판도 없음), 기준 얼굴 지문을 기록에 묶고, 확인 못 함은 흠이다(가짜 눈 — tests/fixtures/첫컷검사/인물_시험.py).
// ② tools/lib/첫컷눈_gpt.js: 작업 폴더의 기준_*.jpg와 얼굴판.jpg를 프레임 뒤에 첨부한다(가짜 codex계정 — AI를 부르지 않는다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import PIL'], { encoding: 'utf8' }).status === 0;

test('기준 얼굴 · 얼굴판 · 다른 컷 얼굴판 · 실제 사람 제외 · 기준 바뀜 · 확인 못 함은 흠 · 앞 기록 거르기 · 받은 뒤 검사 힌트 · 눈판', { skip: !파이썬 && '파이썬(Pillow) 없음' }, () => {
  execFileSync('python', ['-I', '-B', '-X', 'utf8', path.join(__dirname, 'fixtures', '첫컷검사', '인물_시험.py')], { encoding: 'utf8', stdio: 'pipe' });
});

test('눈 실행기는 컷연결 · 초 · 기준 얼굴 · 얼굴판 · 다른 컷 얼굴판 그림을 이 순서로 첨부하고 다른 파일은 붙이지 않는다', () => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '첫컷눈-'));
  try {
    for (const f of ['얼굴판_다른컷.jpg', '얼굴판.jpg', '초_01.jpg', '초_00.jpg', '컷연결.jpg', '기준_하린.jpg', '기준_로지.jpg', '다른.jpg', '기준_메모.txt']) fs.writeFileSync(path.join(폴더, f), 'x');
    const 로그 = path.join(폴더, '부름.json');
    const 가짜 = path.join(폴더, '가짜계정.js');
    fs.writeFileSync(가짜, `
const fs = require('node:fs');
let 글 = '';
process.stdin.on('data', (d) => { 글 += d; }).on('end', () => {
  const a = process.argv.slice(2);
  fs.writeFileSync(${JSON.stringify(로그)}, JSON.stringify({ 인자: a, 글 }));
  fs.writeFileSync(a[a.indexOf('-o') + 1], '{"판정": {}}');
});`);
    const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', 'lib', '첫컷눈_gpt.js')],
      { cwd: 폴더, input: '질문 글', encoding: 'utf8', env: { ...process.env, SYNK_CODEX_ROTATE: 가짜 } });
    assert.equal(r.status, 0, r.stderr);
    const { 인자, 글 } = JSON.parse(fs.readFileSync(로그, 'utf8'));
    const 첨부 = 인자.flatMap((x, i) => (인자[i - 1] === '-i' ? [path.basename(x)] : []));
    assert.deepEqual(첨부, ['컷연결.jpg', '초_00.jpg', '초_01.jpg', '기준_로지.jpg', '기준_하린.jpg', '얼굴판.jpg', '얼굴판_다른컷.jpg']);
    assert.match(글, /첨부 그림은 이 순서로 붙였다: 컷연결\.jpg, 초_00\.jpg, 초_01\.jpg, 기준_로지\.jpg, 기준_하린\.jpg, 얼굴판\.jpg, 얼굴판_다른컷\.jpg/);
  } finally {
    fs.rmSync(폴더, { recursive: true, force: true });
  }
});
