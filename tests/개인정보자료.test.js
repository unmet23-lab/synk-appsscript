'use strict';
// synk.im/brief/privacy-check(synkbrief 「인터넷에 드러난 내 정보를 ChatGPT로 찾고 지우기」 나눔 자료) — 원고 글이 그대로 실리는지, 요청문에 복사 단추, 가린 판 그림.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HERE = path.join(__dirname, '../docs/마케팅/맞춤도구/privacy-check');
const page = require(path.join(HERE, 'page.js'));
const data = page.read();
const html = page.renderPage(data);

test('원고 검사를 통과하고 그림 세 장이 다 있다', () => {
  assert.deepEqual(page.check(data), []);
  assert.deepEqual(page.missingShots(data), []);
  assert.equal((html.match(/<figure class="shot">/g) || []).length, page.SHOTS.length);
});

test('원고의 보이는 글이 한 조각도 빠지지 않고 쪽에 있다', () => {
  const text = page.pageText(html);
  const pieces = page.sourceTexts(data.md);
  assert.ok(pieces.length > 60, `글 조각 ${pieces.length}개`);
  for (const t of pieces) assert.ok(text.includes(t), t);
});

test('붙여 넣는 요청문 하나에만 복사 단추가 있고, 이름 · 아이디 자리는 예시(홍길동 · @내아이디)다', () => {
  const copyable = [...html.matchAll(/<p class="cmd-text" id="(cmd-\d+)">([^<]*)<\/p><button type="button" class="copy" data-copy="\1"/g)].map((m) => m[2]);
  assert.equal(copyable.length, 1);
  assert.ok(copyable[0].startsWith('내 이름은 홍길동, SNS 아이디는 @내아이디야.'));
  assert.ok(copyable[0].endsWith('이름이 같은 다른 사람으로 보이는 정보는 빼 줘.'));
});

test('쪽 글에 실제 실험의 이름 · 아이디가 없다(예시만 쓴다)', () => {
  const text = page.pageText(html);
  assert.ok(!/yuhobuilds|양유호/.test(text));
});

test('머리 큰 제목은 원고 첫 줄, 직접 해 본 결과 · 가림 표시가 제목 바로 아래에 있다', () => {
  assert.equal(page.TITLE_LINES.join(' '), page.sections(page.parse(data.md))[0].title);
  assert.ok(new RegExp(`<p class="ai-note">${page.AI_NOTE}</p>\\s*<figure class="shot">`).test(html));
});

test('링크 미리보기(og.html) 제목 줄 · 작은 글이 쪽과 같다', () => {
  const og = fs.readFileSync(path.join(HERE, 'og.html'), 'utf8');
  assert.ok(og.includes(`<span>${page.TITLE_LINES[0]}</span><span>${page.TITLE_LINES[1]}</span><span class="hl">${page.TITLE_LINES[2]}</span>`));
  assert.ok(og.includes(page.EYEBROW));
  assert.ok(og.includes('synk.im/brief/privacy-check'));
});
