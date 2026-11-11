// 고르는 판(pickpanel.mjs, 11-11 B 「길 안내 표지판」): 칸 글 · 색 · 화살이 결정마다 뜻대로인지, 누름 칸(#zones)이 판의 세 칸과 같은 자리인지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { splitLabel, tileColor, arrowOf, labelHtml, optionHtml, QUESTION } from './pickpanel.mjs';
import { buildJourney } from './journeys.mjs';
import { LINES } from './lines.mjs';

const DOORS = [{ id: 'left', text: '왼쪽 문' }, { id: 'stay', text: '그대로' }, { id: 'right', text: '오른쪽 문' }];
const FORK = [{ id: 'other', line: 1, color: '#0052A4', text: '청량리 방면' }, { id: 'way', line: 1, color: '#0052A4', text: '서울역 방면' }, { id: 'out', text: '나가는 곳' }];
const EXIT = [{ id: 'e3', exit: 3 }, { id: 'e4', exit: 4 }, { id: 'e5', exit: 5 }];
const BOARD = [{ id: 'board', text: '이 열차 타기' }, { id: 'wait', text: '다음 열차 기다리기' }, { id: 'opposite', text: '반대편 승강장 가기' }];

test('굵은 말 + 가는 말: 마지막 띄어쓰기로 가르고, 뒷말이 한 글자면(「문」 말고) 가르지 않는다 · 출구는 번호 | 번 출구', () => {
  assert.deepEqual(splitLabel(DOORS[0]), ['왼쪽', '문']);
  assert.deepEqual(splitLabel(DOORS[1]), ['그대로', '']);
  assert.deepEqual(splitLabel(FORK[0]), ['청량리', '방면']);
  assert.deepEqual(splitLabel(FORK[2]), ['나가는 곳', '']);
  assert.deepEqual(splitLabel(EXIT[0]), ['3', '번 출구']);
  assert.deepEqual(splitLabel(BOARD[1]), ['다음 열차', '기다리기']);
  assert.deepEqual(splitLabel({ id: 'line2', line: 2, color: '#00A84D', text: '2호선 타는 곳' }), ['2호선', '타는 곳']);
});

test('칸 색: 통로는 가는 노선 색, 출구는 노랑, 나가는 곳은 흰색, 그 밖은 지금 노선 — 어두운 판 위 강조색은 채움보다 밝다', () => {
  const line = LINES[2].color;
  assert.equal(tileColor(FORK[0], line).fill, '#0052A4');
  assert.equal(tileColor(EXIT[0], line).fill, '#ffd400');
  assert.equal(tileColor(FORK[2], line).fill, '#f4f4f5');
  assert.equal(tileColor(DOORS[1], line).fill, line);
  const [r, g, b] = tileColor(FORK[0], line).accent.match(/\d+/g).map(Number);
  assert.ok(r > 0x00 && g > 0x52 && b > 0xa4, '1호선 남색을 밝힌 강조색');
  assert.equal(tileColor(EXIT[0], line).ink, '#16171a', '노란 칸 위 글은 먹색');
});

test('화살: 문 · 승강장은 왼쪽 · 위 · 오른쪽(승강장 가운데는 멈춤 표), 통로 · 출구는 왼쪽 위 · 위 · 오른쪽 위', () => {
  assert.deepEqual([0, 1, 2].map((i) => arrowOf('door', i)), ['l', 'u', 'r']);
  assert.deepEqual([0, 1, 2].map((i) => arrowOf('board', i)), ['l', 'wait', 'r']);
  for (const k of ['fork', 'exit']) assert.deepEqual([0, 1, 2].map((i) => arrowOf(k, i)), ['ul', 'u', 'ur']);
});

test('칸 글: 문 · 승강장만 영문, 통로는 노선 동그라미(로마자 없음), 출구는 큰 번호, 글은 이스케이프', () => {
  assert.match(labelHtml('door', DOORS[0]), /<b class="pk-big">왼쪽<\/b><span class="pk-small">문<\/span><\/span><span class="pk-en">Left door/);
  assert.match(labelHtml('fork', FORK[0]), /pk-line" style="--c:#0052A4">1<\/span>.*청량리.*방면/);
  assert.doesNotMatch(labelHtml('fork', FORK[0]), /pk-en/);
  assert.doesNotMatch(labelHtml('fork', FORK[2]), /pk-en|pk-line/, '나가는 곳: 화살이 이미 말한다 — 표지 · 영문을 또 달지 않는다');
  assert.match(labelHtml('exit', EXIT[0]), /^<b class="pk-num">3<\/b><span class="pk-small">번 출구<\/span>$/);
  assert.doesNotMatch(labelHtml('door', { id: 'x', text: '<b>"' }), /<b>"|<b><\/b>/);
  assert.match(optionHtml('door', DOORS[2], 2, LINES[2].color), /data-dir="r".*--c:#00A84D.*pk-arrow/);
});

test('모든 여정의 모든 결정: 칸 셋에 글이 있고, 굵은 말이 칸에 들어가는 길이(일곱 자 안)다', () => {
  const kindOf = (d) => (d.kind === 'stop' ? 'door' : d.kind === 'exit' ? 'exit' : d.kind === 'fork' ? 'fork' : 'board');
  let n = 0;
  for (const level of ['basic', 'busy']) for (let seed = 1; seed <= 60; seed++) {
    for (const d of buildJourney({ seed, level }).decisions) {
      const kind = kindOf(d);
      assert.ok(QUESTION[kind], `${d.kind}: 질문`);
      assert.equal(d.options.length, 3);
      for (const o of d.options) {
        const [big] = splitLabel(o);
        assert.ok(big && big.length <= 7, `${d.id}: 「${big}」`);
        assert.ok(labelHtml(kind, o).length > 20);
        n += 1;
      }
    }
  }
  assert.ok(n > 300);
});

test('누름 칸(#zones)은 판의 세 칸과 같은 자리 — 판 높이에서 머리를 뺀 아래, 폭 ⅓씩', () => {
  const css = readFileSync(fileURLToPath(new URL('./style.css', import.meta.url)), 'utf8');
  assert.match(css, /\.zones\{[^}]*bottom:0;height:calc\(var\(--pick-h\) - var\(--pick-head\)\);display:grid;grid-template-columns:1fr 1fr 1fr/);
  assert.match(css, /\.pk-opts\{[^}]*top:var\(--pick-head\);bottom:0;display:grid;grid-template-columns:repeat\(3,1fr\)/);
  assert.match(css, /\.pick\{[^}]*bottom:0;height:var\(--pick-h\)/);
  assert.doesNotMatch(css, /route-map|\.rm-/, '옛 아래 역 지도는 걷었다');
});
