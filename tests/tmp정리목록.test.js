'use strict';

// .tmp 한 달 정리 목록 — 임시 폴더에 가짜 .tmp를 만들어 시각을 되돌려 놓고 확인한다. 실제 .tmp·정리 대기 폴더는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 정리 = require('../tools/tmp정리목록.js');

const 하루 = 24 * 60 * 60 * 1000;
function 옛날로(p, 일) {
  const 시각 = new Date(Date.now() - 일 * 하루);
  const 돌기 = (q) => { for (const e of fs.readdirSync(q, { withFileTypes: true })) { const r = path.join(q, e.name); if (e.isDirectory()) 돌기(r); fs.utimesSync(r, 시각, 시각); } };
  if (fs.statSync(p).isDirectory()) 돌기(p);
  fs.utimesSync(p, 시각, 시각);
}

test('14일 넘게 손대지 않은 폴더만 후보로 — 최근 파일이 하나라도 있거나 _보존.txt가 있으면 뺀다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tmp-list-'));
  try {
    const 임시 = path.join(방, '.tmp'), 대기 = path.join(방, '정리대기');
    const 만들기 = (이름, 파일들) => { for (const [f, 크기] of 파일들) { const p = path.join(임시, 이름, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.alloc(크기)); } };
    만들기('옛큰것', [['a.bin', 3 * 1048576], ['안/b.bin', 1048576]]);
    만들기('옛작은것', [['c.txt', 10]]);
    만들기('보존', [['_보존.txt', 1], ['d.txt', 10]]);
    만들기('섞임', [['e.txt', 10]]);
    옛날로(path.join(임시, '옛큰것'), 30); 옛날로(path.join(임시, '옛작은것'), 20); 옛날로(path.join(임시, '보존'), 40); 옛날로(path.join(임시, '섞임'), 30);
    fs.writeFileSync(path.join(임시, '섞임', '새.txt'), '최근');
    fs.writeFileSync(path.join(임시, '맨위.log'), Buffer.alloc(2048)); 옛날로(path.join(임시, '맨위.log'), 15);
    fs.mkdirSync(path.join(대기, '20261001', '지난것'), { recursive: true });
    fs.writeFileSync(path.join(대기, '20261001', '지난것', 'x.bin'), Buffer.alloc(1048576));

    const 목록 = 정리.목록만들기({ 임시, 대기 });
    assert.deepEqual(목록.후보.map((c) => [c.이름, c.MB, c.파일, c.git]), [['옛큰것', 4, 2, null], ['옛작은것', 0, 1, null]]);
    assert.equal(목록.오래된파일, 1);
    assert.equal(목록.대기폴더, 1);
    const 글 = 정리.글로(목록);
    assert.match(글, /폴더 2개/);
    assert.match(글, /- 옛큰것 · 4MB · 2개/);
    assert.match(글, /맨 위 파일 중 14일 넘은 것 1개/);
    assert.match(글, /지우지는 않아요/);

    const r = 정리.옮기기(['옛작은것', '섞임', '../밖'], { 임시, 대기, 지금: new Date(2026, 10, 1).getTime() });
    assert.deepEqual(r.옮김, ['옛작은것']);
    assert.deepEqual(r.남김.map((x) => x.이름), ['섞임', '../밖']);
    assert.ok(fs.existsSync(path.join(대기, '20261101', '옛작은것', 'c.txt')));
    assert.ok(fs.existsSync(path.join(임시, '섞임', '새.txt')), '후보가 아닌 폴더는 그대로');
    assert.equal(정리.글로(정리.목록만들기({ 임시: path.join(방, '없음'), 대기 })).includes('정리할 폴더 없음'), true);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
