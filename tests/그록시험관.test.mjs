// 그록 시험관(tools/그록시험관.mjs)과 그록 통로의 그림 읽기 갈래 — 그록을 부르지 않고 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { 자료고르기, 시험글, 답다듬기 } from '../tools/그록시험관.mjs';

test('답다듬기: 앞의 혼잣말을 떼고 「1.」부터, 번호가 없으면 그대로', () => {
  assert.equal(답다듬기('먼저 열어 보겠습니다.경로가 막혀서 다시 엽니다.1. 이 영상은\n2. 할 수 있게'), '1. 이 영상은\n2. 할 수 있게');
  assert.equal(답다듬기('준비합니다.\n1) 첫 답'), '1) 첫 답');
  assert.equal(답다듬기('번호 없는 답'), '번호 없는 답');
});

const require = createRequire(import.meta.url);
const 그록 = require('../tools/lib/그록호출.js');

test('자료고르기: 질문 · 말 · 정지컷 · 지난 그림을 GPT 시험관과 같은 규칙으로 고른다', t => {
  const 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-examiner-'));
  t.after(() => fs.rmSync(밖, { recursive: true, force: true }));
  assert.throws(() => 자료고르기(밖), /질문\.md가 없다/);
  fs.writeFileSync(path.join(밖, '질문.md'), '\uFEFF1. 한 문장으로 무슨 말인가?');
  fs.writeFileSync(path.join(밖, '말.txt'), '안녕');
  assert.throws(() => 자료고르기(밖), /정지컷/);
  for (const f of ['정지컷_02.jpg', '정지컷_01.jpg', '지난1_B30.jpg', '메모.jpg']) fs.writeFileSync(path.join(밖, f), 'x');
  const 자료 = 자료고르기(밖);
  assert.deepEqual(자료.장면, ['정지컷_01.jpg', '정지컷_02.jpg']);
  assert.deepEqual(자료.지난, ['지난1_B30.jpg']);
  assert.equal(자료.질문, '1. 한 문장으로 무슨 말인가?');
  const 글 = 시험글(자료);
  assert.match(글, /그림 차례: 정지컷_01\.jpg, 정지컷_02\.jpg, 지난1_B30\.jpg/);
  assert.match(글, /\[말\.txt\]\n안녕$/);
});

test('그록 통로 그림 읽기: 읽기 · 찾기는 사용자 폴더와 D:에서만 막고, 셸 · 고치기 · 웹은 늘 막는다', () => {
  const a = 그록.인자목록({ 프롬프트파일: 'p.md', 작업폴더: 'C:/grok-눈가림/x', 웹: false, 턴: 8, 그림읽기: true });
  const 막은 = a.flatMap((v, i) => (v === '--deny' ? [a[i + 1]] : []));
  for (const t of ['Read', 'Grep', 'Glob']) {
    assert.ok(!막은.includes(t), `${t}를 통째로 막지 않는다`);
    assert.ok(막은.includes(`${t}(C:/Users/**)`) && 막은.includes(`${t}(D:/**)`), `${t}는 사용자 폴더 · D:만 막는다`);
  }
  for (const t of ['Bash', 'Edit', 'Write', 'MCPTool', 'WebFetch', 'WebSearch']) assert.ok(막은.includes(t), t);
  const 글만 = 그록.인자목록({ 프롬프트파일: 'p.md', 작업폴더: 'w', 웹: false, 턴: 8 });
  assert.ok(글만.includes('Read') && !글만.some(v => /Read\(/.test(v)), '그림이 없으면 읽기를 통째로 막는다');
});
