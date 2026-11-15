'use strict';
// 카본 판 심사(tools/카본판심사.js, 11-16 시험 도입) — 관문 판을 넷씩 묶고 끝 판을 붙이는 꼴, 컷표 요약, 지시문이 아르곤웹 점검을
// 넘는지, 미리보기가 보내지 않고 작업 파일만 만드는지 본다. 실제 보내기는 공용 차례 · Gemini가 있어야 해서 PC에서 실제 편으로 확인한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 뿌리 = path.join(__dirname, '..');
const 판심사 = require('../tools/카본판심사.js');
const 웹 = require('../tools/아르곤웹.js');

const 컷표 = {
  편: { 이름: '시험 편', 비율: '9:16', 길이: 20 },
  이기는것: '여운 — 시험',
  한문장: '시험 한 문장',
  인물: { 수아: { 묘사: 'A felt doll.', 옷: 'A red coat.', 설정: { 반복장치: '빨간 우산' } } },
  소품: { 우산: { 생김새: 'A red umbrella.' } },
  장면: { 밤: { 시간대: '밤', 빛: 'Blue hour.' } },
  detail: Array.from({ length: 19 }, (_, i) => ({ cut: `C${i + 1}`, t: i * 2.5, dur: 2.5, 장면: '밤', 인물: i % 2 ? ['수아'] : [], 소품: { 우산: i % 3 ? '화면밖' : '보임' }, line: `컷 ${i + 1} 내용` })),
};

test('컷표 요약 — 컷마다 시각 · 장면 · 인물 · 보이는 소품 · 내용을 한 줄로, 머리에 인물 · 소품 · 장면을 싣는다', () => {
  const 글 = 판심사.컷표요약(컷표);
  assert.match(글, /^컷표 요약/);
  assert.match(글, /- 수아: A felt doll\. A red coat\. · 되풀이 장치: 빨간 우산/);
  assert.match(글, /- 우산: A red umbrella\./);
  assert.match(글, /- 밤: 밤 — Blue hour\./);
  assert.match(글, /^C1 · 0:00\.0~0:02\.5 · 장면 밤 · 인물 없음 · 보이는 소품 우산 · 내용: 컷 1 내용$/m);
  assert.match(글, /^C2 · 0:02\.5~0:05\.0 · 장면 밤 · 인물 수아 · 보이는 소품 없음 · 내용: 컷 2 내용$/m);
  assert.equal(글.split('\n').filter((l) => /^C\d+ · /.test(l)).length, 19);
});

test('묶기 — 전체 판을 넷씩, 끝 판은 자리가 있으면 마지막 묶음에, 없으면 따로(한 대화 그림 4장)', () => {
  const 컷들 = Array.from({ length: 53 }, (_, i) => `K${i + 1}`);
  const 일곱 = 판심사.묶기(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], '끝', 컷들);
  assert.deepEqual(일곱.map((b) => b.그림), [['p1', 'p2', 'p3', 'p4'], ['p5', 'p6', 'p7', '끝']], '11-16 시험의 대화 A · B 꼴');
  assert.deepEqual([일곱[0].컷[0], 일곱[0].컷.at(-1), 일곱[1].컷[0], 일곱[1].컷.at(-1)], ['K1', 'K32', 'K33', 'K53']);
  const 넷 = 판심사.묶기(['p1', 'p2', 'p3', 'p4'], '끝', 컷들.slice(0, 30));
  assert.deepEqual(넷.map((b) => b.그림), [['p1', 'p2', 'p3', 'p4'], ['끝']]);
  assert.deepEqual(넷[1].컷, []);
  const 끝없음 = 판심사.묶기(['p1', 'p2'], '', 컷들.slice(0, 12));
  assert.deepEqual(끝없음.map((b) => b.그림), [['p1', 'p2']]);
  for (const b of 일곱) assert.ok(b.그림.length <= 웹.그림한도);
});

test('지시문 — 네 물음과 답 꼴을 싣고, 한 줄이며, 아르곤웹 점검(길이 · 낱말)을 넘는다', () => {
  const 묶음들 = 판심사.묶기(['p1', 'p2', 'p3', 'p4', 'p5'], '끝', 컷표.detail.map((d) => d.cut).concat(Array.from({ length: 21 }, (_, i) => `D${i}`)));
  for (const b of 묶음들) {
    const 글 = 판심사.지시문(b, 묶음들.length, '시험 편 · 9:16 · 20초');
    assert.ok(!/\n/.test(글), '빈 줄 · 줄바꿈이 있으면 보내기 전 확인이 멈춘다');
    for (const 낱말 of ['① 자막과 그림이 맞는가', '② 붙은 컷 사이가 이어지는가', '③ 주인공과 헷갈리는', '④ 컷표요약과 그림이 다른 곳', '등급(P1']) assert.ok(글.includes(낱말), 낱말);
    const r = 웹.점검한편({ id: `묶음${b.번호}`, prompt: 글 });
    assert.deepEqual(r.걸림, [], JSON.stringify(r.걸림));
  }
  assert.match(판심사.지시문(묶음들[0], 2, 'x'), /컷은 C1부터 /);
  assert.match(판심사.지시문(묶음들[1], 2, 'x'), /끝 판입니다/);
});

test('미리보기 — 판목록의 전체 판 · 끝 판으로 작업 파일을 만들고 보내지 않는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '카본판심사-'));
  const 편 = path.join(dir, '편');
  const 판 = path.join(dir, '판');
  fs.mkdirSync(편); fs.mkdirSync(판);
  fs.writeFileSync(path.join(편, '컷표.json'), JSON.stringify(컷표));
  const 그림 = (n) => { const f = path.join(판, n); fs.writeFileSync(f, Buffer.from([0xff, 0xd8, 0xff, 0xd9])); return f; };
  const 전체 = [그림('전체_1.jpg'), 그림('전체_2.jpg'), 그림('전체_3.jpg')];
  const 끝 = 그림('끝.jpg');
  fs.writeFileSync(path.join(판, '판목록.json'), JSON.stringify({ 컷: 컷표.detail.map((d) => ({ cut: d.cut })), 판: { 전체, 끝 } }));
  const 출력 = path.join(dir, '출력');
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '카본판심사.js'), 편, '--판', 판, '--출력', 출력, '--미리보기'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /대화 1개\(4장\)/);
  const 작업 = JSON.parse(fs.readFileSync(path.join(출력, '카본', '작업_1.json'), 'utf8'));
  assert.deepEqual(작업.files.map((f) => path.basename(f)), ['전체_1.jpg', '전체_2.jpg', '전체_3.jpg', '끝.jpg', '컷표요약.txt']);
  assert.ok(!fs.existsSync(작업.out), '미리보기는 답을 만들지 않는다');
  assert.ok(!fs.existsSync(`${작업.out}.보냄.json`), '미리보기는 보내지 않는다');
  assert.match(fs.readFileSync(작업.promptFile, 'utf8'), /「시험 편 · 9:16 · 20초」/);
  assert.deepEqual(웹.작업문제(웹.작업읽기(path.join(출력, '카본', '작업_1.json'))), []);
});

test('인자 — --최종이나 --판이 없으면 1, 모르는 선택은 1', () => {
  const r = spawnSync(process.execPath, [path.join(뿌리, 'tools', '카본판심사.js'), 뿌리], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.throws(() => 판심사.인자읽기(['x', '--모름']), /모르는 선택/);
});
